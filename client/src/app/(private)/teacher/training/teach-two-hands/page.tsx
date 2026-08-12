'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Brain, ArrowLeft, Trash2, Camera, Award, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { normalizeHandKeypoints, classifyKNN, StoredSample, HandKeypoint } from '@/lib/knn-classifier';
import { assessQuality, calculateROI } from '@/lib/image-quality';
import { GOLDEN_TEST_DATASET } from '@/lib/golden-dataset';
import CameraView from '@/components/CameraView';
import SampleGallery from '@/components/SampleGallery';
import DataCollector from '@/components/journey/DataCollector';
import { TfTrainer } from '@/lib/tf-trainer';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { useStabilityDetector } from '@/hooks/useStabilityDetector';
// Predefined classes for teaching
const CLASSES = [
  { id: 'class_3', label: '2 Bàn Tay, 1 Ngón Tay ☝️☝️', voicePrompt: 'Hãy giơ hai bàn tay, mỗi tay một ngón nhé!' },
  { id: 'class_4', label: '2 Bàn Tay, 2 Ngón Tay ✌️✌️', voicePrompt: 'Hãy giơ hai bàn tay, mỗi tay hai ngón nhé!' },
];

// Mapping từ class ID sang golden dataset expectedLabel
// Golden dataset chỉ có nhãn cho 1 bàn tay (1 ngón, 2 ngón)
// class_3/class_4 dùng cùng golden label vì mỗi tay được xử lý riêng
const CLASS_TO_GOLDEN_LABEL: Record<string, string> = {
  'class_1': '1 Ngón Tay ☝️',
  'class_2': '2 Ngón Tay ✌️',
  'class_3': '1 Ngón Tay ☝️', // mỗi tay = 1 ngón
  'class_4': '2 Ngón Tay ✌️', // mỗi tay = 2 ngón
};

/**
 * Đếm số ngón tay đang duỗi ra dựa trên geometry của hand landmarks.
 * MediaPipe Hand Landmarks: 21 điểm
 *   - Ngón cái:  1(CMC) 2(MCP) 3(IP) 4(TIP)
 *   - Ngón trỏ:  5(MCP) 6(PIP) 7(DIP) 8(TIP)
 *   - Ngón giữa: 9(MCP) 10(PIP) 11(DIP) 12(TIP)
 *   - Ngón áp út: 13(MCP) 14(PIP) 15(DIP) 16(TIP)
 *   - Ngón út:   17(MCP) 18(PIP) 19(DIP) 20(TIP)
 *
 * Ngón tay duỗi = TIP ở xa wrist hơn PIP (so sánh khoảng cách y từ wrist)
 * Ngón cái: so sánh TIP(4) vs IP(3) theo trục x (ngón cái mở sang ngang)
 */
function countExtendedFingers(keypoints: HandKeypoint[]): number {
  if (!keypoints || keypoints.length < 21) return -1;

  const wrist = keypoints[0];
  let count = 0;

  // Ngón cái: so sánh khoảng cách TIP(4) vs IP(3) từ wrist theo trục x
  // Ngón cái duỗi khi TIP xa hơn IP theo chiều ngang
  const thumbTip = keypoints[4];
  const thumbIP = keypoints[3];
  const thumbMCP = keypoints[2];
  const thumbDistTip = Math.abs(thumbTip.x - wrist.x);
  const thumbDistIP = Math.abs(thumbIP.x - wrist.x);
  const thumbDistMCP = Math.abs(thumbMCP.x - wrist.x);
  // Ngón cái duỗi khi TIP xa hơn cả IP và IP xa hơn MCP đáng kể
  // Bỏ qua ngón cái (thumb) vì việc phát hiện ngón cái cụp/xòe rất thiếu ổn định
  // Tạm comment logic đếm ngón cái
  /*
  if (thumbDistTip > thumbDistIP && thumbDistIP > thumbDistMCP * 1.1) {
    count++;
  }
  */

  // Ngón trỏ đến ngón út: so sánh TIP vs PIP theo khoảng cách từ wrist
  // Ngón duỗi khi TIP ở xa wrist hơn PIP
  const fingerIndices = [
    { tip: 8, pip: 6 },   // Ngón trỏ
    { tip: 12, pip: 10 }, // Ngón giữa
    { tip: 16, pip: 14 }, // Ngón áp út
    { tip: 20, pip: 18 }, // Ngón út
  ];

  for (const { tip, pip } of fingerIndices) {
    const tipDist = Math.sqrt(
      (keypoints[tip].x - wrist.x) ** 2 + (keypoints[tip].y - wrist.y) ** 2
    );
    const pipDist = Math.sqrt(
      (keypoints[pip].x - wrist.x) ** 2 + (keypoints[pip].y - wrist.y) ** 2
    );
    if (tipDist > pipDist * 1.05) {
      count++;
    }
  }

  return count;
}

/**
 * Xác định số ngón tay mong đợi cho mỗi class (tính trên từng bàn tay)
 *  - class_1: 1 ngón (index finger)
 *  - class_2: 2 ngón (index + middle)
 *  - class_3: 1 ngón mỗi tay
 *  - class_4: 2 ngón mỗi tay
 */
function getExpectedFingerCount(classId: string): number {
  if (classId === 'class_1' || classId === 'class_3') return 1;
  if (classId === 'class_2' || classId === 'class_4') return 2;
  return -1; // unknown
}

export default function TeacherTeachTwoHandsPage() {
  const router = useRouter();
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [activeClass, setActiveClass] = useState<string>('class_3');
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState<'camera' | 'upload' | 'video'>('camera');

  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  
  // Test/Prediction states
  const [predictedLabel, setPredictedLabel] = useState<string>('Chưa nhận diện... 🤔');
  const [confidence, setConfidence] = useState<number>(0);
  const [speakDebounceText, setSpeakDebounceText] = useState<string>('');
  const [effectEmoji, setEffectEmoji] = useState<string | null>(null);

  // Modal / Submission states
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp ảnh rõ nét và giữ tay thật yên lặng khi chụp');
  const [teacherNotes, setTeacherNotes] = useState('Bộ dữ liệu chuẩn dành cho học sinh');
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [penaltyWarning, setPenaltyWarning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Capture states
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);
  const prevUnlockedRef = useRef(false);

  const trainerRef = useRef<TfTrainer | null>(null);

  useEffect(() => {
    trainerRef.current = new TfTrainer();
  }, []);

  // Challenge Stages


  // Camera and Handpose Setup (Detect up to 2 hands)
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 640,
    height: 480,
  });

  const { handsRef, modelStatus } = useMl5Handpose(videoRef, cameraActive, {
    maxHands: 2,
  });

  const { isStable, motionScore } = useStabilityDetector(
    () => {
      const hands = handsRef.current;
      if (!hands || hands.length < 2) return null;
      return [...(hands[0].keypoints as { x: number; y: number }[] ?? []), ...(hands[1].keypoints as { x: number; y: number }[] ?? [])];
    },
    videoRef,
    modelStatus === 'ready'
  );

  useEffect(() => {
  }, []);


  const getVideoThumb = () => {
    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;
    const cv = document.createElement('canvas');
    cv.width = vW;
    cv.height = vH;
    const ctx = cv.getContext('2d');
    if (ctx && videoRef.current) ctx.drawImage(videoRef.current, 0, 0, vW, vH);
    return cv.toDataURL('image/jpeg', 0.8);
  };

  // Capture a training sample
  const captureSample = () => {
    const hands = handsRef.current;
    if (!hands || hands.length === 0) return;
    if (hands.length < 2) return;

    const activeClassLabel = CLASSES.find(c => c.id === activeClass)?.label || 'Không tên';
    let knnLabel = activeClassLabel;
    if (activeClass === 'class_3') knnLabel = CLASSES[0].label;
    if (activeClass === 'class_4') knnLabel = CLASSES[1].label;

    const thumbnail = getVideoThumb();
    // FIX: Sử dụng CLASS_TO_GOLDEN_LABEL mapping thay vì so sánh trực tiếp activeClass
    const goldenLabel = CLASS_TO_GOLDEN_LABEL[activeClass] || '';
    const goldenCurrentClass = GOLDEN_TEST_DATASET.filter(g => g.expectedLabel === goldenLabel);
    const goldenOtherClasses = GOLDEN_TEST_DATASET.filter(g => g.expectedLabel !== goldenLabel);

    const expectedFingers = getExpectedFingerCount(activeClass);

    const vW = videoRef.current ? videoRef.current.videoWidth || 640 : 640;
    const vH = videoRef.current ? videoRef.current.videoHeight || 480 : 480;
    const frameCv = document.createElement('canvas');
    frameCv.width = vW;
    frameCv.height = vH;
    const frameCtx = frameCv.getContext('2d');
    if (frameCtx && videoRef.current) {
      frameCtx.drawImage(videoRef.current, 0, 0, vW, vH);
    }

    // Stability check: tay đang rung?
    if (!isStable) {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setValidationToast(`⚠️ Tay đang rung (motion: ${motionScore.toFixed(1)}px). Hãy giữ yên tay rồi chụp lại!`);
      toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 3000);
      return;
    }

    setSamples(prev => {
      const newSamples: StoredSample[] = [];
      let rejectedAny = false;
      let rejectionMsg = '';

      const processHand = (handIndex: number) => {
        if (hands[handIndex] && hands[handIndex].keypoints && hands[handIndex].keypoints.length >= 21) {
          const features = normalizeHandKeypoints(hands[handIndex].keypoints);
          let isValid = true;

          // Quality Assessment (Dark/Blurry Check)
          const roi = calculateROI(hands[handIndex].keypoints as { x: number; y: number }[], frameCv.width, frameCv.height, 0.1);
          const quality = frameCtx ? assessQuality(frameCv, roi, hands[handIndex].keypoints as { x: number; y: number }[]) : undefined;
          if (quality?.isDark || quality?.isBlurry) {
            isValid = false;
            rejectedAny = true;
            rejectionMsg = quality.isDark ? `⚠️ Ảnh bị quá tối.` : `⚠️ Ảnh bị mờ. Vui lòng giữ tay thật yên lặng khi chụp!`;
          }

          // Validation 1: Finger counting heuristic
          // Kiểm tra trực tiếp số ngón tay duỗi ra so với nhãn mong đợi
          if (isValid && expectedFingers > 0) {
            const detectedFingers = countExtendedFingers(hands[handIndex].keypoints);
            if (detectedFingers >= 0) {
              // Bỏ qua ngón cái khi đếm, nên bây giờ có thể so sánh chính xác số ngón
              if (detectedFingers !== expectedFingers) {
                isValid = false;
                rejectedAny = true;
                rejectionMsg = `Bạn đang giơ ${detectedFingers} ngón tay chính, nhưng nhãn "${activeClassLabel}" cần ${expectedFingers} ngón! 🖐️`;
              }
            }
          }

          // Validation 2: So sánh khoảng cách với golden dataset bằng KNN chuẩn
          // Chỉ chạy nếu validation 1 pass
          if (isValid && GOLDEN_TEST_DATASET.length > 0) {
            const mappedGolden = GOLDEN_TEST_DATASET.map(g => ({
              label: g.expectedLabel,
              features: g.features
            }));
            
            const result = classifyKNN(features, mappedGolden, 3);
            const flippedFeatures = features.map((v, i) => i % 2 === 0 ? -v : v);
            const flippedResult = classifyKNN(flippedFeatures, mappedGolden, 3);
            
            if (result.label !== goldenLabel && flippedResult.label !== goldenLabel) {
              isValid = false;
              rejectedAny = true;
              const finalResult = result.confidence >= flippedResult.confidence ? result : flippedResult;
              rejectionMsg = `Cử chỉ này trông giống "${finalResult.label}" hơn là "${activeClassLabel}"! Bạn thử lại nhé? 🤔`;
            }
          }

          // Luôn lưu sample, đánh dấu isValid để tô viền đỏ (giống teach-gestures)
          newSamples.push({
            id: crypto.randomUUID(),
            label: knnLabel,
            features,
            sourceId: activeClass,
            thumbnail,
            isValid
          });
        }
      };

      processHand(0);
      processHand(1);

      // Hiển thị cảnh báo nếu có sample bị reject
      if (rejectedAny && rejectionMsg) {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setValidationToast(`⚠️ ${rejectionMsg}`);
        toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 5000);
        // Phát voice feedback cho bé
        speakEnglish('Try again');
      }

      return newSamples.length > 0 ? [...prev, ...newSamples] : prev;
    });
  };

  const startCapturing = () => {
    if (modelStatus !== 'ready') return;
    playClickSound();
    setIsCapturing(true);
    captureSample();
    captureIntervalRef.current = setInterval(captureSample, 300);
  };

  const stopCapturing = () => {
    setIsCapturing(false);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  const deleteSample = (id: string) => {
    setSamples(prev => prev.filter(s => s.id !== id));
  };

  // Clear samples for a class
  const clearClassSamples = (classId: string) => {
    playClickSound();
    const classLabel = CLASSES.find(c => c.id === classId)?.label || classId;
    setSamples(prev => prev.filter(s => s.sourceId ? s.sourceId !== classId : s.label !== classLabel));
    setIsTrained(false);
    speakEnglish(`All samples cleared`);
  };

  const handleTrain = async () => {
    const validSamples = samples.filter(s => s.isValid !== false);
    const c3 = validSamples.filter(s => s.sourceId === 'class_3').length;
    const c4 = validSamples.filter(s => s.sourceId === 'class_4').length;

    if (c3 < 6 || c4 < 6) { // c3/c4 need 6 samples (3 captures x 2 hands)
      speakEnglish('Need more samples to learn');
      return;
    }
    
    playClickSound();
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      if (trainerRef.current) {
        await trainerRef.current.train(validSamples, (epoch, progress, loss, acc) => {
          setTrainingProgress(progress);
        });
        
        setIsTraining(false);
        setIsTrained(true);
        playSuccessSound();
        speakEnglish('Learning complete. Let us test!');
      }
    } catch (err) {
      console.error('Training failed', err);
      setIsTraining(false);
      alert('Quá trình huấn luyện thất bại. Xem console log.');
    }
  };

  // Prediction loop
  useEffect(() => {
    if (!isTrained || modelStatus !== 'ready' || !trainerRef.current) return;

    let rafId: number;

    const runPrediction = async () => {
      const hands = handsRef.current;
      
      if (hands && hands.length > 0) {
        if (hands.length >= 2) {
          // Dual Hand Prediction logic: classify both hands and count total fingers
          const hand1 = hands[0];
          const hand2 = hands[1];
          const f1 = normalizeHandKeypoints(hand1?.keypoints || []);
          const f2 = normalizeHandKeypoints(hand2?.keypoints || []);

          const pred1 = await trainerRef.current!.predict(f1);
          const pred2 = await trainerRef.current!.predict(f2);

          const isHand1One = pred1.label.includes('1');
          const isHand2One = pred2.label.includes('1');
          
          let totalFingers = 0;
          totalFingers += isHand1One ? 1 : 2;
          totalFingers += isHand2One ? 1 : 2;

          setPredictedLabel(`2 Bàn Tay 👐 (Tay 1: ${isHand1One ? '1 ngón' : '2 ngón'}, Tay 2: ${isHand2One ? '1 ngón' : '2 ngón'} | Tổng: ${totalFingers} ngón)`);
          setConfidence(Math.round((pred1.confidence + pred2.confidence) / 2));
        } else {
          // Single Hand Prediction
          const hand = hands[0];
          const kps = hand.keypoints;
          if (kps && kps.length >= 21) {
            const features = normalizeHandKeypoints(kps);
            const result = await trainerRef.current!.predict(features);
            setPredictedLabel(result.label);
            setConfidence(result.confidence);
          }
        }
      } else {
        setPredictedLabel('AI đang đợi tay bạn... ✋');
        setConfidence(0);
      }

      rafId = requestAnimationFrame(runPrediction);
    };

    runPrediction();
    return () => cancelAnimationFrame(rafId);
  }, [isTrained, modelStatus, samples]);

  // Audio TTS reader for predicted values (de-bounced)
  useEffect(() => {
    if (!isTrained || predictedLabel.startsWith('AI đang') || predictedLabel.startsWith('Chưa')) return;

    const timer = setTimeout(() => {
      if (predictedLabel !== speakDebounceText) {
        setSpeakDebounceText(predictedLabel);
        
        let msg = '';
        if (predictedLabel.includes('1 Ngón Tay')) {
          msg = 'Bạn A I đoán đây là 1 ngón tay!';
          setEffectEmoji('☝️');
        } else if (predictedLabel.includes('2 Ngón Tay')) {
          msg = 'Bạn A I đoán đây là 2 ngón tay!';
          setEffectEmoji('✌️');
        } else if (predictedLabel.includes('2 Bàn Tay')) {
          msg = 'A I thấy cả hai bàn tay!';
          setEffectEmoji('👐');
        }

        if (msg) {
          speakEnglish('Validation failed');
          setTimeout(() => setEffectEmoji(null), 1200);
        }
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [predictedLabel, speakDebounceText, isTrained]);

  // Canvas drawing loop
  useEffect(() => {
    let rafId: number;

    const runFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && modelStatus === 'ready') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
            canvas.width = video.clientWidth;
            canvas.height = video.clientHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const hands = handsRef.current;

          if (hands && hands.length > 0) {
            hands.forEach((hand, idx) => {
              const kps = hand.keypoints;
              if (kps && kps.length >= 21) {
                drawHandSkeleton(ctx, kps, video.videoWidth, video.videoHeight, canvas.width, canvas.height, {
                  lineColor: idx === 0 ? '#6366f1' : '#ec4899',
                  jointColor1: idx === 0 ? '#4f46e5' : '#db2777',
                  jointColor2: idx === 0 ? '#4f46e5' : '#db2777',
                  jointRadius: 5,
                });
              }
            });
          }
        }
      }
      rafId = requestAnimationFrame(runFrame);
    };

    runFrame();
    return () => cancelAnimationFrame(rafId);
  }, [modelStatus, videoRef, canvasRef]);

  // Handle open submission evaluation
  const handleOpenSubmit = () => {
    playClickSound();
    
    // Evaluate accuracy against Golden Dataset
    const targetClasses = [CLASSES[0].label, CLASSES[1].label];

    const testCases = GOLDEN_TEST_DATASET.filter(g => targetClasses.includes(g.expectedLabel));

    let correctCount = 0;
    testCases.forEach(testCase => {
      const result = classifyKNN(testCase.features, samples, 3);
      if (result.label === testCase.expectedLabel) {
        correctCount++;
      }
    });

    let calculatedAccuracy = Math.round((correctCount / testCases.length) * 100);

    // Apply penalty for insufficient samples (2% per missing image below threshold of 10)
    const MIN_SAMPLES_PER_CLASS = 10;
    let totalPenalty = 0;

    const sampleCounts: Record<string, number> = { class_1: 0, class_2: 0, class_3: 0, class_4: 0 };
    samples.forEach(s => {
      if (s.sourceId && s.sourceId in sampleCounts) {
        sampleCounts[s.sourceId]++;
      }
    });

    let hasPenalty = false;
    const classesToCheck = ['class_3', 'class_4'];
    classesToCheck.forEach(cid => {
      const count = sampleCounts[cid];
      if (count < MIN_SAMPLES_PER_CLASS) {
        totalPenalty += (MIN_SAMPLES_PER_CLASS - count) * 2;
        hasPenalty = true;
      }
    });

    calculatedAccuracy = Math.max(0, Math.round(calculatedAccuracy - totalPenalty));
    
    setPenaltyWarning(hasPenalty);
    setSubmitScore(calculatedAccuracy);
    setShowSubmitModal(true);
  };

  // Submit to Server
  const handleSubmitAssignment = async () => {
    if (submitScore === null) return;

    try {
      setIsSubmitting(true);
      
      let processedSamples: StoredSample[] = samples;

      if (isCloudinaryConfigured()) {
        try {
          processedSamples = await uploadSamplesToCloudinary(
            samples, 
            'teach-two-hands-dataset'
          );
        } catch (uploadErr) {
          console.error('Lỗi upload ảnh:', uploadErr);
        }
      }

      const finalSamples = processedSamples.map(s => {
        const { thumbnail, ...rest } = s;
        return {
          ...rest,
          thumbnailUrl: thumbnail
        };
      });

      await api.createDataset('teach-two-hands', processedSamples, submitScore, reflectionAnswer, true, teacherNotes, true);
      
      setSubmitSuccess(true);
      playSuccessSound();
      speakEnglish('Submission successful!');
    } catch (err) {
      console.error('Failed to create dataset', err);
      speakEnglish('Submission failed!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-indigo-50 to-purple-100 py-8 px-4 select-none">
      <div className="max-w-[1600px] w-[98%] mx-auto">
        
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/home"
            onClick={playClickSound}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-indigo-200 text-indigo-700 font-extrabold shadow-sm hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Về Trang Chủ</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧠👩‍🏫</span>
            <h1 className="text-2xl md:text-3xl font-black text-indigo-900">Giáo Viên Huấn Luyện AI</h1>
          </div>
        </div>

        {/* Sandbox Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Instructions & Class Management */}
          <div className="bg-white rounded-3xl p-6 border-4 border-indigo-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="text-xs font-black text-indigo-600 tracking-wider mb-2 uppercase">Lớp học AI của bạn</div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Các bước dạy học cho AI:</h3>

              {/* Stage 2: Two-hand classes */}
              <div className="mb-2">
                <span className="text-xs font-black text-emerald-600 tracking-wider uppercase">Bước 2: 2 Bàn tay 👐</span>
              </div>
              {/* Class Tabs */}
              <div className="space-y-3 mb-6">
                {CLASSES.slice(2, 4).map(cls => {
                  const validSamples = samples.filter(s => s.isValid !== false);
                  const rawCount = validSamples.filter(s => s.sourceId === cls.id).length;
                  const classSampleCount = Math.floor(rawCount / 2);
                  const isSelected = activeClass === cls.id;
                  const hasEnough = classSampleCount >= 3;
                  
                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        playClickSound();
                        setActiveClass(cls.id);
                        // speakEnglish(cls.voicePrompt);
                      }}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/80 shadow-md ring-2 ring-indigo-200'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-indigo-900">{cls.label}</div>
                        <div className="text-xs text-gray-500 font-semibold mt-1 flex items-center gap-1.5">
                          <span>Đã chụp:</span>
                          <span className="text-indigo-600 font-black">{classSampleCount} ảnh</span>
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                            hasEnough ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'
                          }`}>
                            {hasEnough
                              ? classSampleCount >= 10 ? '✅ Đủ mẫu (10+)' : '✅ Đủ mẫu — 💡 Chụp thêm!'
                              : `⚠️ Thiếu ${3 - classSampleCount} ảnh`}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {classSampleCount > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); clearClassSamples(cls.id); }} className="p-2 hover:bg-red-100 rounded-lg text-red-500" title="Xóa hết"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>





              {/* Capture Button */}
              {activeDataTab === 'camera' && (
                <button
                  onMouseDown={startCapturing}
                  onMouseUp={stopCapturing}
                  onMouseLeave={stopCapturing}
                  onTouchStart={startCapturing}
                  onTouchEnd={stopCapturing}
                  disabled={modelStatus !== 'ready'}
                  className={`w-full font-extrabold py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-lg mb-4 border-b-4 ${
                    isCapturing
                      ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white animate-pulse scale-95'
                      : 'bg-indigo-500 hover:bg-indigo-600 border-indigo-700 text-white active:scale-95 disabled:bg-gray-300 disabled:scale-100'
                  }`}
                >
                  <Camera className="w-6 h-6" />
                  <span>{isCapturing ? 'ĐANG THU MẪU...' : 'GIỮ ĐỂ CHỤP 📸'}</span>
                </button>
              )}

              <SampleGallery
                samples={samples.filter(s => s.sourceId === activeClass)}
                onDeleteSample={deleteSample}
                onClearAll={() => clearClassSamples(activeClass)}
              />

              {/* Validation toast */}
              {validationToast && (
                <div className="mt-3 p-3 bg-red-100 border-2 border-red-400 rounded-2xl text-sm font-bold text-red-700 flex items-center gap-2 animate-bounce shadow-lg">
                  <span className="text-xl">🚨</span>
                  <span>{validationToast}</span>
                </div>
              )}

              {/* Requirement notification block */}
              {(() => {
                const getCount = (id: string, label: string) => {
                  const raw = samples.filter(s => s.sourceId === id || (s.label === label && !s.sourceId)).length;
                  return Math.floor(raw / 2);
                };
                const c3 = getCount(CLASSES[0].id, CLASSES[0].label);
                const c4 = getCount(CLASSES[1].id, CLASSES[1].label);
                const isReady = c3 >= 10 && c4 >= 10;

                if (!isReady) {
                  return (
                    <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-4 text-xs font-bold mb-6 flex flex-col gap-1.5 shadow-inner">
                      <span className="text-red-800 text-sm font-extrabold block">⚠️ Yêu cầu dữ liệu:</span>
                      <span>Bạn cần chụp ít nhất 10 ảnh cho mỗi nhóm để AI có thể học tốt nhé:</span>
                      <ul className="list-disc pl-4 space-y-1">
                        {c3 < 10 && <li>Nhóm &quot;{CLASSES[0].label}&quot;: thiếu {10 - c3} ảnh mẫu.</li>}
                        {c4 < 10 && <li>Nhóm &quot;{CLASSES[1].label}&quot;: thiếu {10 - c4} ảnh mẫu.</li>}
                      </ul>
                    </div>
                  );
                }

                return (
                  <div className="bg-green-50 border-2 border-green-200 text-green-700 rounded-2xl p-4 text-xs font-bold mb-6 shadow-inner">
                    <span>🎉 Tuyệt vời! Bạn đã thu thập đủ dữ liệu rồi. Hãy nhấn nút <b>&quot;HUẤN LUYỆN AI 🧠🚀&quot;</b> bên dưới nhé!</span>
                  </div>
                );
              })()}

              <p className="text-xs font-semibold text-gray-500 text-center leading-relaxed mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                💡 <b>Mẹo:</b> Hãy di chuyển bàn tay nhẹ nhàng khi chụp để AI có thể học được nhiều góc độ khác nhau nhé!
              </p>
            </div>

            {/* Train Button & Progress */}
            <div>
              {isTraining ? (
                <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-700">AI đang học bài... ⚙️</span>
                    <span className="text-xs font-black text-indigo-800">{trainingProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-150" style={{ width: `${trainingProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleTrain}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg border-b-4 border-emerald-700 flex items-center justify-center gap-2 text-lg"
                >
                  <Brain className="w-6 h-6" />
                  <span>HUẤN LUYỆN AI 🧠🚀</span>
                </button>
              )}

              {isTrained && !isTraining && (
                <button
                  onClick={() => handleOpenSubmit()}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-extrabold py-3 px-6 rounded-2xl shadow-md mt-3 border-b-4 border-yellow-600 flex items-center justify-center gap-2"
                >
                  <Award className="w-5 h-5" />
                  <span>LƯU BỘ DỮ LIỆU 🎒</span>
                </button>
              )}

              {/* View History Link */}
              <div className="mt-4">
                <Link
                  href="/teacher/templates"
                  onClick={playClickSound}
                  className="inline-flex items-center justify-center gap-2 w-full bg-white hover:bg-indigo-50 text-indigo-600 border-2 border-indigo-200 font-bold py-3 px-4 rounded-xl shadow-sm transition-colors"
                >
                  <span className="text-xl">📊</span>
                  <span>Xem lại bộ dữ liệu đã nộp</span>
                </Link>
              </div>

            </div>

          </div>

          {/* MIDDLE / RIGHT: Camera Preview & Real-time Live Prediction */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Live Camera Box */}
            <div className="bg-white rounded-3xl p-6 border-4 border-indigo-400 shadow-xl relative flex flex-col items-center">
              
              {/* Floating Emoji Particles Reward */}
              {effectEmoji && (
                <div className="absolute inset-0 bg-white/40 flex items-center justify-center z-30 rounded-3xl animate-ping duration-1000">
                  <span className="text-9xl">{effectEmoji}</span>
                </div>
              )}

              <DataCollector
                mode="hand-2"
                videoRef={videoRef}
                activeClassId={activeClass}
                activeClassLabel={CLASSES.find(c => c.id === activeClass)?.label || activeClass}
                activeTab={activeDataTab}
                onTabChange={setActiveDataTab}
                onSamplesCollected={(newSamples) => {
                  setSamples(prev => [...prev, ...newSamples]);
                }}
              >
                <CameraView
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  modelStatus={modelStatus}
                  cameraError={cameraError}
                  loadingText="ĐANG KHỞI ĐỘNG CAMERA NHẬN DẠNG XƯƠNG TAY..."
                  hudText={isTrained ? `Đang dự đoán dựa trên các mẫu bạn dạy` : `Chế độ thu thập dữ liệu - Chọn lớp bên trái để chụp`}
                  theme="blue"
                  onRetry={retryCamera}
                />
              </DataCollector>
            </div>

            {/* Test Results Screen */}
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white rounded-3xl p-6 shadow-xl border-4 border-purple-400">
              <h4 className="font-extrabold text-sm text-purple-300 tracking-widest uppercase mb-2">Màn hình kiểm tra kết quả:</h4>
              
              {isTrained ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-purple-300 block">AI đang đoán bạn làm:</span>
                    <span className="text-2xl font-black text-yellow-300">{predictedLabel}</span>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
                    <span className="text-xs font-semibold text-purple-200 block text-center">Độ tự tin của AI:</span>
                    <span className="text-xl font-black text-green-300">{confidence}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-purple-200 font-bold">
                  Bạn hãy chụp mẫu tay bên trái rồi bấm <span className="text-yellow-300">&quot;Huấn Luyện AI&quot;</span> để xem kết quả dự đoán trực tiếp ở đây nhé! 🤖✨
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Submission & Grading Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border-4 border-indigo-400 shadow-2xl relative overflow-hidden">
            
            {submitSuccess ? (
              <div className="text-center py-8">
                <span className="text-7xl">🏆🎉</span>
                <h3 className="text-2xl font-black text-indigo-900 mt-4">
                  Lưu Bộ Dữ Liệu Hoàn Tất!
                </h3>
                <p className="text-gray-600 font-semibold mt-2">
                  Bộ dữ liệu của bạn đã được lưu vào hệ thống mẫu.
                </p>
                <button
                  onClick={() => {
                    setShowSubmitModal(false);
                    setSubmitSuccess(false);
                    router.push('/teacher/templates');
                  }}
                  className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-extrabold rounded-full hover:scale-105 transition-transform"
                >
                  Tuyệt vời! Về trang chủ thôi
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-black text-indigo-900 mb-2 flex items-center gap-2">
                  <span>🎒</span> Bảng Lưu Bộ Dữ Liệu Đánh Giá
                </h3>
                <p className="text-xs text-gray-500 font-bold mb-4">
                  Hệ thống sẽ chạy thử nghiệm chấm chéo tự động với 10 mẫu tiêu chuẩn (5 mẫu 1 ngón tay, 5 mẫu 2 ngón tay) để đánh giá chất lượng mô hình của bạn.
                </p>

                {/* Score badge */}
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs text-indigo-700 font-bold block">Điểm tự động kiểm thử (Test Score):</span>
                    <span className="text-lg text-indigo-900 font-black">
                      {submitScore}% chính xác
                    </span>
                  </div>
                  <span className="text-3xl">
                    {submitScore && submitScore >= 80 ? '🦁🌟' : '🐨👍'}
                  </span>
                </div>

                {penaltyWarning && (
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 mb-4 text-xs font-semibold text-orange-800">
                    💡 Mẹo: Bạn chụp hơi ít ảnh nên điểm bị trừ một chút (cần ít nhất 10 ảnh cho mỗi cử chỉ). Bạn hãy đóng bảng này và chụp thêm nhiều góc độ khác nhau để được 100% nhé!
                  </div>
                )}

                {/* Question Section */}
                <div className="mb-4">
                  <label className="text-xs font-black text-gray-700 block mb-1.5 flex items-center gap-1">
                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                    <span>Ghi chú: Yếu tố nào giúp AI học tốt nhất?</span>
                  </label>
                  <select
                    value={reflectionAnswer}
                    onChange={(e) => setReflectionAnswer(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-indigo-400"
                  >
                    <option value="Chụp ảnh rõ nét và giữ tay thật yên lặng khi chụp">
                      Chụp hình đủ sáng, rõ nét tay và giữ tay đứng yên khi chụp ☝️
                    </option>
                    <option value="Chạy nhảy rung lắc camera thật mạnh">
                      Chạy nhảy đùa nghịch và lắc camera thật mạnh 🤪
                    </option>
                    <option value="Chụp nhiều vật thể lộn xộn trong phòng">
                      Chụp thật nhiều thứ đồ chơi lộn xộn đằng sau tay 🧸
                    </option>
                  </select>
                </div>

                {/* Text feedback */}
                <div className="mb-6">
                  <label className="text-xs font-black text-gray-700 block mb-1.5">
                    Ghi chú của Giáo viên (Mô tả bộ dữ liệu):
                  </label>
                  <textarea
                    rows={2}
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    placeholder="Mô tả bộ dữ liệu mẫu..."
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-indigo-400 resize-none"
                  />
                </div>

                {/* Submit Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowSubmitModal(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-extrabold rounded-xl hover:bg-gray-50"
                  >
                    HỦY
                  </button>
                  <button
                    onClick={handleSubmitAssignment}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 border-b-4 border-indigo-800 disabled:bg-gray-300"
                  >
                    {isSubmitting ? 'ĐANG LƯU...' : 'XÁC NHẬN LƯU'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

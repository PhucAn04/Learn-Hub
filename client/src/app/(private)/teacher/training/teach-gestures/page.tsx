'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Brain, ArrowLeft, Trash2, Camera, Award, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { normalizeHandKeypoints, classifyKNN, StoredSample } from '@/lib/knn-classifier';
import { HandResult } from '@/types/ml5';
import { GOLDEN_GESTURES_DATASET } from '@/lib/golden-gestures-dataset';
import CameraView from '@/components/CameraView';
import SampleGallery from '@/components/SampleGallery';
import DataCollector from '@/components/journey/DataCollector';
import { TfTrainer } from '@/lib/tf-trainer';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { assessQuality, calculateROI } from '@/lib/image-quality';
import { useStabilityDetector } from '@/hooks/useStabilityDetector';
// Predefined classes for teaching
const CLASSES = [
  { id: 'class_1', label: 'Thích (Thumbs Up) 👍', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Thích nhé!' },
  { id: 'class_2', label: 'Quyết Tâm (Fist) ✊', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Quyết tâm nào!' },
  { id: 'class_3', label: 'Chiến Thắng (Peace) ✌️', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Chiến thắng nhé!' },
  { id: 'class_4', label: 'Chào Bạn (Open Hand) ✋', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Chào bạn nhé!' },
  { id: 'class_5', label: 'Rock & Roll 🤘', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Rock and Roll nào!' },
  { id: 'class_6', label: 'Chỉ Tay (Point) ☝️', voicePrompt: 'Hãy dạy bạn A I nhận biết cử chỉ Chỉ tay nhé!' },
];

export default function TeacherTeachGesturesPage() {
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [activeClass, setActiveClass] = useState<string>('class_1');
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
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const trainerRef = useRef<TfTrainer | null>(null);

  useEffect(() => {
    trainerRef.current = new TfTrainer();
  }, []);

  // Challenge Stages
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      const kps = handsRef.current?.[0]?.keypoints;
      return kps && kps.length > 0 ? (kps as { x: number; y: number }[]) : null;
    },
    videoRef,
    modelStatus === 'ready',
    { threshold: 12 }
  );

  useEffect(() => {
  }, []);

  const getVideoThumb = (hands?: HandResult[]) => {
    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;
    const cv = document.createElement('canvas');
    cv.width = vW;
    cv.height = vH;
    const ctx = cv.getContext('2d');
    if (ctx && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, vW, vH);
      if (hands && hands.length > 0) {
        hands.forEach((hand, idx) => {
          const kps = hand.keypoints;
          if (kps && kps.length >= 21) {
            drawHandSkeleton(ctx, kps, vW, vH, vW, vH, {
              lineColor: idx === 0 ? '#6366f1' : '#ec4899',
              jointColor1: idx === 0 ? '#4f46e5' : '#db2777',
              jointColor2: idx === 0 ? '#4f46e5' : '#db2777',
              jointRadius: 2,
            });
          }
        });
      }
    }
    return cv.toDataURL('image/jpeg', 0.8);
  };

  // Capture a training sample
  const captureSample = () => {
    const hands = handsRef.current;
    if (!hands || hands.length === 0) {
      return;
    }
    
    const isTwoHandClass = false;
    if (isTwoHandClass && hands.length < 2) {
      return;
    }

    const activeClassLabel = CLASSES.find(c => c.id === activeClass)?.label || activeClass;
    const knnLabel = activeClassLabel;

    const rawThumbnail = getVideoThumb();
    const thumbnail = getVideoThumb(hands);

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

      // Golden dataset references for validation
      const goldenCurrentClass = GOLDEN_GESTURES_DATASET.filter(g => g.expectedLabel === activeClass);
      const goldenOtherClasses = GOLDEN_GESTURES_DATASET.filter(g => g.expectedLabel !== activeClass);

      // Helper to process a hand
      const processHand = (handIndex: number) => {
        if (hands[handIndex] && hands[handIndex].keypoints && hands[handIndex].keypoints.length >= 21) {
          const features = normalizeHandKeypoints(hands[handIndex].keypoints);
          let isValid = true;

          // Quality Assessment (Dark/Blurry Check)
          const roi = hands[handIndex]?.keypoints
            ? calculateROI(hands[handIndex].keypoints as { x: number; y: number }[], frameCv.width, frameCv.height, 0.1)
            : undefined;
          const quality = frameCtx ? assessQuality(frameCv, roi, hands[handIndex].keypoints as { x: number; y: number }[]) : undefined;
          if (quality?.isDark || quality?.isBlurry) {
            isValid = false;
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setValidationToast(quality.isDark
              ? `⚠️ Ảnh bị quá tối (độ sáng: ${Math.round(quality.brightness)}/255). Hãy đảm bảo đủ ánh sáng!`
              : `⚠️ Ảnh bị mờ. Vui lòng giữ tay thật yên lặng khi chụp!`);
            toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 4000);
          }

          if (isValid && GOLDEN_GESTURES_DATASET.length > 0) {
            const mappedGolden = GOLDEN_GESTURES_DATASET.map(g => ({
              label: g.expectedLabel,
              features: g.features
            }));
            
            const result = classifyKNN(features, mappedGolden, 3);
            const flippedFeatures = features.map((v, i) => i % 2 === 0 ? -v : v);
            const flippedResult = classifyKNN(flippedFeatures, mappedGolden, 3);
            
            if (result.label !== activeClass && flippedResult.label !== activeClass) {
              isValid = false;
              const finalResult = result.confidence >= flippedResult.confidence ? result : flippedResult;
              const cls = CLASSES.find(c => c.id === finalResult.label);
              const closestWrongLabel = cls?.label || finalResult.label;
              
              if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
              setValidationToast(`⚠️ Cử chỉ này trông giống "${closestWrongLabel}" hơn! Bạn thử lại nhé?`);
              toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 4000);
            }
          }

          newSamples.push({
            id: crypto.randomUUID(),
            label: knnLabel,
            features,
            sourceId: activeClass,
            thumbnail,
            rawThumbnail,
            isValid,
            quality
          });
        }
      };

      processHand(0); // First hand
      processHand(1); // Second hand

      if (newSamples.length > 0) {
        return [...prev, ...newSamples];
      }
      return prev;
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

  // Clear ALL samples across all classes (reset entire dataset)
  const clearAllSamples = () => {
    playClickSound();
    setSamples([]);
    setIsTrained(false);
    setPredictedLabel('Chưa nhận diện... 🤔');
    setConfidence(0);
    speakEnglish('All data cleared. Start collecting again!');
  };

  // Run real model training
  const handleTrain = async () => {
    const validSamples = samples.filter(s => s.isValid !== false);
    const c1 = validSamples.filter(s => s.sourceId === 'class_1' || (s.label === CLASSES[0].label && !s.sourceId)).length;
    const c2 = validSamples.filter(s => s.sourceId === 'class_2' || (s.label === CLASSES[1].label && !s.sourceId)).length;
    const c3 = validSamples.filter(s => s.sourceId === 'class_3').length;
    const c4 = validSamples.filter(s => s.sourceId === 'class_4').length;

    if (c1 < 3 || c2 < 3 || c3 < 3 || c4 < 3) {
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
        const hand = hands[0];
        const kps = hand.keypoints;
        if (kps && kps.length >= 21) {
          const features = normalizeHandKeypoints(kps);
          const resultKNN = classifyKNN(features, samples, 3);
          const result = await trainerRef.current!.predict(features);
          
          if (resultKNN.minDistance > 0.65) {
            setPredictedLabel('Khác thường, không có dữ liệu này trong thư viện ảnh của bạn!');
            setConfidence(0);
          } else {
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
        if (predictedLabel.includes('Thích')) {
          msg = 'A I đoán bạn đang Thích!';
          setEffectEmoji('👍');
        } else if (predictedLabel.includes('Quyết Tâm')) {
          msg = 'A I đoán bạn đang Quyết tâm!';
          setEffectEmoji('✊');
        } else if (predictedLabel.includes('Chiến Thắng')) {
          msg = 'A I đoán bạn đang Chiến thắng!';
          setEffectEmoji('✌️');
        } else if (predictedLabel.includes('Chào Bạn')) {
          msg = 'A I đoán bạn đang Chào bạn!';
          setEffectEmoji('✋');
        } else if (predictedLabel.includes('Rock & Roll')) {
          msg = 'A I đoán bạn đang làm cử chỉ Rock and Roll!';
          setEffectEmoji('🤘');
        } else if (predictedLabel.includes('Chỉ Tay')) {
          msg = 'A I đoán bạn đang Chỉ tay!';
          setEffectEmoji('☝️');
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

    // 1. Evaluate accuracy against Golden Dataset
    let kaggleCorrect = 0;
    GOLDEN_GESTURES_DATASET.forEach(testCase => {
      const result = classifyKNN(testCase.features, samples, 4);
      const flippedFeatures = testCase.features.map((v, i) => i % 2 === 0 ? -v : v);
      const flippedResult = classifyKNN(flippedFeatures, samples, 4);
      
      const expectedText = CLASSES.find(c => c.id === testCase.expectedLabel)?.label || testCase.expectedLabel;
      if (result.label === expectedText || flippedResult.label === expectedText) {
        kaggleCorrect++;
      }
    });
    const kaggleAccuracy = GOLDEN_GESTURES_DATASET.length > 0
      ? (kaggleCorrect / GOLDEN_GESTURES_DATASET.length) * 100
      : 0;

    // 2. Leave-One-Out Cross Validation (LOOCV) on user's own samples
    let loocvCorrect = 0;
    samples.forEach((holdOut, idx) => {
      const otherSamples = samples.filter((_, i) => i !== idx);
      if (otherSamples.length === 0) return;
      const result = classifyKNN(holdOut.features, otherSamples, 4);
      if (result.label === holdOut.label) {
        loocvCorrect++;
      }
    });
    const loocvAccuracy = samples.length > 0
      ? (loocvCorrect / samples.length) * 100
      : 0;

    // 3. Combine both approaches (Average)
    let calculatedAccuracy = Math.round((kaggleAccuracy + loocvAccuracy) / 2);

    // Apply penalty for insufficient samples (2% per missing image below threshold of 10)
    const MIN_SAMPLES_PER_CLASS = 10;
    let totalPenalty = 0;

    const getCaptures = (classId: string) =>
      samples.filter(s => s.sourceId === classId).length;

    const captureCounts = [
      getCaptures('class_1'),
      getCaptures('class_2'),
      getCaptures('class_3'),
      getCaptures('class_4'),
    ];

    let hasPenalty = false;
    captureCounts.forEach(count => {
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

      // Step 1: Upload images to Cloudinary (if configured)
      let processedSamples = samples;
      if (isCloudinaryConfigured()) {
        setUploadProgress('Đang tải ảnh lên Cloud...');
        processedSamples = await uploadSamplesToCloudinary(
          samples,
          'teach-gestures',
          (uploaded, total) => {
            setUploadProgress(`Tải ảnh ${uploaded}/${total}...`);
          }
        );
        setUploadProgress('Đang lưu bài...');
      }

      // Step 2: Save to new Dataset API
      await api.createDataset('teach-gestures', processedSamples, submitScore, reflectionAnswer, true, teacherNotes, true);
      
      setSubmitSuccess(true);
      setUploadProgress('');
      playSuccessSound();
      speakEnglish('Submission successful!');
    } catch (err) {
      console.error('Failed to submit assignment', err);
      setUploadProgress('');
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
            <h1 className="text-2xl md:text-3xl font-black text-indigo-900">Dạy AI học Cử chỉ (Gestures)</h1>
          </div>
        </div>

        {/* Sandbox Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Instructions & Class Management */}
          <div className="bg-white rounded-3xl p-6 border-4 border-indigo-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="text-xs font-black text-indigo-600 tracking-wider mb-2 uppercase">Lớp học AI của bạn</div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Các bước dạy học cử chỉ:</h3>

              {/* Class Tabs */}
              <div className="space-y-3 mb-6">
                {CLASSES.map(cls => {
                  const validSamples = samples.filter(s => s.isValid !== false);
                  const rawCount = validSamples.filter(s => s.sourceId === cls.id || (s.label === cls.label && !s.sourceId)).length;
                  const classSampleCount = rawCount;
                  const isSelected = activeClass === cls.id;
                  const hasEnough = classSampleCount >= 3;
                  
                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        playClickSound();
                        setActiveClass(cls.id);
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
                              ? classSampleCount >= 10
                                ? '✅ Đủ mẫu (10+)'
                                : `✅ Đủ mẫu — 💡 Chụp thêm để tăng điểm!`
                              : `⚠️ Thiếu ${3 - classSampleCount} ảnh`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {classSampleCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearClassSamples(cls.id);
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                            title="Xóa hết mẫu lớp này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                  className={`w-full font-extrabold py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-lg mb-6 border-b-4 ${
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

              {/* Validation toast notification */}
              {validationToast && (
                <div className="mt-3 p-3 bg-red-100 border-2 border-red-400 rounded-2xl text-sm font-bold text-red-700 flex items-center gap-2 animate-bounce shadow-lg">
                  <span className="text-xl">🚨</span>
                  <span>{validationToast}</span>
                </div>
              )}

              {/* Requirement notification block */}
              {(() => {
                const getCount = (id: string, label: string) => {
                  return samples.filter(s => s.sourceId === id || (s.label === label && !s.sourceId)).length;
                };
                const c1 = getCount(CLASSES[0].id, CLASSES[0].label);
                const c2 = getCount(CLASSES[1].id, CLASSES[1].label);
                const c3 = getCount(CLASSES[2].id, CLASSES[2].label);
                const c4 = getCount(CLASSES[3].id, CLASSES[3].label);
                const isReady = c1 >= 3 && c2 >= 3 && c3 >= 3 && c4 >= 3;

                if (!isReady) {
                  return (
                    <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-4 text-xs font-bold mb-6 flex flex-col gap-1.5 shadow-inner">
                      <span className="text-red-800 text-sm font-extrabold block">⚠️ Yêu cầu dữ liệu:</span>
                      <span>Bạn cần chụp ít nhất 3 ảnh cho mỗi nhóm để AI có thể học tốt nhé:</span>
                      <ul className="list-disc pl-4 space-y-1">
                        {c1 < 3 && <li>Nhóm "{CLASSES[0].label}": thiếu {3 - c1} ảnh mẫu.</li>}
                        {c2 < 3 && <li>Nhóm "{CLASSES[1].label}": thiếu {3 - c2} ảnh mẫu.</li>}
                        {c3 < 3 && <li>Nhóm "{CLASSES[2].label}": thiếu {3 - c3} ảnh mẫu.</li>}
                        {c4 < 3 && <li>Nhóm "{CLASSES[3].label}": thiếu {3 - c4} ảnh mẫu.</li>}
                      </ul>
                    </div>
                  );
                }

                return (
                  <div className="bg-green-50 border-2 border-green-200 text-green-700 rounded-2xl p-4 text-xs font-bold mb-6 shadow-inner">
                    <span>🎉 Tuyệt vời! Bạn đã thu thập đủ dữ liệu rồi. Hãy nhấn nút <b>"HUẤN LUYỆN AI 🧠🚀"</b> bên dưới nhé!</span>
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
                  onClick={handleOpenSubmit}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-extrabold py-3 px-6 rounded-2xl shadow-md mt-3 border-b-4 border-yellow-600 flex items-center justify-center gap-2"
                >
                  <Award className="w-5 h-5" />
                  <span>LƯU BỘ DỮ LIỆU 🎒</span>
                </button>
              )}

              {/* Clear All Dataset Button */}
              {samples.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={clearAllSamples}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-3 px-6 rounded-2xl border-2 border-red-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>XÓA TOÀN BỘ DỮ LIỆU & LÀM LẠI 🔄</span>
                  </button>
                </div>
              )}

              {/* View History Link */}
              <div className="mt-4">
                <Link
                  href="/teacher/templates"
                  onClick={playClickSound}
                  className="inline-flex items-center justify-center gap-2 w-full bg-white hover:bg-indigo-50 text-indigo-600 border-2 border-indigo-200 font-bold py-3 px-4 rounded-xl shadow-sm transition-colors"
                >
                  <span className="text-xl">📊</span>
                  <span>Xem lại bộ dữ liệu đã lưu</span>
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
                mode="gesture"
                videoRef={videoRef}
                activeClassId={activeClass}
                activeClassLabel={CLASSES.find(c => c.id === activeClass)?.label || activeClass}
                activeTab={activeDataTab}
                onTabChange={setActiveDataTab}
                onSamplesCollected={(newSamples) => {
                  setSamples(prev => [...prev, ...newSamples]);
                }}
                onValidateSample={({ features, classId }) => {
                  // Golden gestures dataset KNN validation for uploaded/video frames
                  if (GOLDEN_GESTURES_DATASET.length === 0) return { isValid: true };
                  
                  const mappedGolden = GOLDEN_GESTURES_DATASET.map(g => ({
                    label: g.expectedLabel,
                    features: g.features,
                  }));
                  
                  const result = classifyKNN(features, mappedGolden, 3);
                  const flippedFeatures = features.map((v, i) => i % 2 === 0 ? -v : v);
                  const flippedResult = classifyKNN(flippedFeatures, mappedGolden, 3);
                  
                  if (result.label !== classId && flippedResult.label !== classId) {
                    const finalResult = result.confidence >= flippedResult.confidence ? result : flippedResult;
                    const cls = CLASSES.find(c => c.id === finalResult.label);
                    const closestWrongLabel = cls?.label || finalResult.label;
                    return {
                      isValid: false,
                      isQuestionable: true,
                      questionableReason: `Cử chỉ này trông giống "${closestWrongLabel}" hơn! Hãy thử lại nhé? 🤔`,
                    };
                  }
                  return { isValid: true };
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
                  Bạn hãy chụp mẫu tay bên trái rồi bấm <span className="text-yellow-300">"HUẤN LUYỆN AI"</span> để xem kết quả dự đoán trực tiếp ở đây nhé! 🤖✨
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
                <h3 className="text-2xl font-black text-indigo-900 mt-4">Lưu Dữ Liệu Hoàn Tất!</h3>
                <p className="text-gray-600 font-semibold mt-2">Bộ dữ liệu của bạn đã được lưu vào hệ thống.</p>
                <Link
                  href="/teacher/templates"
                  className="inline-block mt-6 px-6 py-2.5 bg-indigo-600 text-white font-extrabold rounded-full hover:scale-105 transition-transform"
                >
                  Trở về Quản lý Mẫu
                </Link>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-black text-indigo-900 mb-2 flex items-center gap-2">
                  <span>🎒</span> Bảng Đánh Giá Dữ Liệu
                </h3>
                <p className="text-xs text-gray-500 font-bold mb-4">
                  Hệ thống sẽ chạy thử nghiệm chấm chéo tự động với 20 mẫu tiêu chuẩn từ Kaggle (5 mẫu mỗi cử chỉ) để đánh giá chất lượng mô hình của bạn.
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
                    <span>Bạn hãy trả lời: Làm sao để AI học bài chuẩn nhất?</span>
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
                    Ghi chú của giáo viên (Mô tả bộ dữ liệu):
                  </label>
                  <textarea
                    rows={2}
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    placeholder="Mô tả bộ dữ liệu này..."
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
                    {isSubmitting ? (uploadProgress || 'ĐANG GỬI...') : 'XÁC NHẬN LƯU'}
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

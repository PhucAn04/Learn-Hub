'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Brain, ArrowLeft, Trash2, Camera, Award, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCamera } from '@/hooks/useCamera';
import { useMl5FaceMesh } from '@/hooks/useMl5FaceMesh';
import { 
  FACE_OVAL,
  FACE_L_EYE,
  FACE_R_EYE,
  FACE_LIPS,
  FACE_NOSE,
  drawPolyline,
  normalizeFaceKeypoints,
  getSmileMetricsFromFaceMesh,
  drawFaceStickers,
  getFaceKeypoints,
  drawFaceSkeleton
} from '@/lib/face-drawing';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { normalizeFaceFeatures, classifyKNN, StoredSample } from '@/lib/knn-classifier';
import { EMOTION_LANDMARK_DATASET } from '@/lib/emotion-landmark-dataset';
import CameraView from '@/components/CameraView';
import SampleGallery from '@/components/SampleGallery';
import DataCollector from '@/components/journey/DataCollector';
import { TfTrainer } from '@/lib/tf-trainer';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
// Predefined classes for teaching
const CLASSES = [
  { id: 'class_1', label: 'Vui vẻ (Happy) 😀', voicePrompt: 'Hãy dạy bạn A I nhận biết nét mặt vui vẻ nhé!' },
  { id: 'class_2', label: 'Buồn bã (Sad) 😢', voicePrompt: 'Hãy dạy bạn A I nhận biết nét mặt buồn bã nào!' },
  { id: 'class_3', label: 'Ngạc nhiên (Surprised) 😲', voicePrompt: 'Hãy dạy bạn A I nhận biết nét mặt ngạc nhiên nhé!' },
  { id: 'class_4', label: 'Bình thường (Neutral) 😐', voicePrompt: 'Hãy dạy bạn A I nhận biết nét mặt bình thường của bạn nhé!' },
];

export default function TeacherTeachFacePage() {
  const router = useRouter();
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [activeClass, setActiveClass] = useState<string>('class_1');
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
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp ảnh rõ nét và giữ đầu thật yên lặng khi chụp');
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState<'camera' | 'upload' | 'video'>('camera');
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [liveExpression, setLiveExpression] = useState<string>('...');

  // Camera and Handpose Setup (Detect up to 2 hands)
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 640,
    height: 480,
  });

  const { allFacesRef, modelStatus } = useMl5FaceMesh(videoRef, cameraActive, {
    maxFaces: 1,
  });

  useEffect(() => {
  }, []);

  const getVideoThumb = (faces?: any[]) => {
    const cv = document.createElement('canvas');
    cv.width = 240; cv.height = 240;
    const ctx = cv.getContext('2d');
    if (ctx && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, 240, 240);
      
      if (faces && faces.length > 0) {
        faces.forEach((kpsRaw) => {
          const kps = getFaceKeypoints(kpsRaw);
          if (kps && kps.length >= 30) {
            ctx.save();
            drawFaceSkeleton(ctx, kps, videoRef.current!.videoWidth || 640, videoRef.current!.videoHeight || 480, 240, 240);
            ctx.restore();
          }
        });
      }
    }
    return cv.toDataURL('image/jpeg', 0.8);
  };

  // Expression ratio extraction from face mesh landmarks
  // Uses specific landmarks to compute shape-invariant expression metrics
  const getExpressionRatios = (kps: { x: number; y: number }[]) => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    // Face dimensions for normalization
    const faceLeft = kps[234] || kps[127];
    const faceRight = kps[454] || kps[356];
    const faceTop = kps[10];
    const chin = kps[152];
    const faceWidth = Math.max(dist(faceLeft, faceRight), 0.001);
    const faceHeight = Math.max(dist(faceTop, chin), 0.001);

    // 1. Mouth Aspect Ratio (MAR): how open is the mouth
    const topLip = kps[13];
    const bottomLip = kps[14];
    const leftMouth = kps[61];
    const rightMouth = kps[291];
    const mouthWidth = dist(leftMouth, rightMouth);
    const mouthOpen = dist(topLip, bottomLip);
    const mar = mouthOpen / Math.max(mouthWidth, 0.001);

    // 2. Smile Ratio: mouth width relative to face width (wider = smiling)
    const smileRatio = mouthWidth / faceWidth;

    // 3. Mouth corner vertical position relative to mouth center
    // Positive = corners up (happy), Negative = corners down (sad)
    const mouthCenterY = (topLip.y + bottomLip.y) / 2;
    const cornerAvgY = (leftMouth.y + rightMouth.y) / 2;
    const cornerLift = (mouthCenterY - cornerAvgY) / faceHeight; // positive = happy

    // 4. Eye Aspect Ratio (EAR): how open are the eyes
    const leftEyeTop = kps[159];
    const leftEyeBottom = kps[145];
    const leftEyeLeft = kps[33];
    const leftEyeRight = kps[133];
    const rightEyeTop = kps[386];
    const rightEyeBottom = kps[374];
    const rightEyeLeft = kps[362];
    const rightEyeRight = kps[263];
    const leftEAR = dist(leftEyeTop, leftEyeBottom) / Math.max(dist(leftEyeLeft, leftEyeRight), 0.001);
    const rightEAR = dist(rightEyeTop, rightEyeBottom) / Math.max(dist(rightEyeLeft, rightEyeRight), 0.001);
    const ear = (leftEAR + rightEAR) / 2;

    // 5. Eyebrow height relative to eyes
    const leftBrow = kps[105];
    const rightBrow = kps[334];
    const browHeight = ((dist(leftBrow, leftEyeTop) + dist(rightBrow, rightEyeTop)) / 2) / faceHeight;

    return { mar, smileRatio, cornerLift, ear, browHeight };
  };

  // Detect expression from ratios
  const detectExpression = (r: { mar: number; smileRatio: number; cornerLift: number; ear: number; browHeight: number }) => {
    // Surprised: mouth open wide (O-shape), but not stretched wide like a laugh
    if (r.mar > 0.22 && r.smileRatio < 0.38) return 'Ngạc nhiên 😲';

    // Happy: wide smile OR (corners up + mouth not open like an O)
    if (r.smileRatio > 0.40 || (r.cornerLift > 0.015 && r.mar < 0.2)) return 'Vui vẻ 😀';
    
    // Neutral: relaxed mouth, corners not down
    if (r.smileRatio >= 0.34 && r.cornerLift >= -0.002) return 'Bình thường 😐';

    // Sad: fallback for narrow mouth or downturned corners
    return 'Buồn bã 😢';
  };

  // Rule-based expression validation
  const validateExpression = (kps: { x: number; y: number }[], classId: string) => {
    const r = getExpressionRatios(kps);
    const detected = detectExpression(r);

    if (classId === 'class_1') {
      if (detected !== 'Vui vẻ 😀') {
        return { isValid: false, suggestion: `Bạn chưa cười đủ tươi! AI thấy bạn đang "${detected}". Cười thật tươi lên nhé! 😀` };
      }
    } else if (classId === 'class_2') {
      if (detected !== 'Buồn bã 😢') {
        return { isValid: false, suggestion: `AI thấy bạn đang "${detected}". Hãy thử làm mặt buồn nhé 😢` };
      }
    } else if (classId === 'class_3') {
      if (detected !== 'Ngạc nhiên 😲') {
        return { isValid: false, suggestion: `AI thấy bạn đang "${detected}". Há miệng to và mở mắt to nhé! 😲` };
      }
    } else if (classId === 'class_4') {
      if (detected !== 'Bình thường 😐') {
        return { isValid: false, suggestion: `AI thấy bạn đang "${detected}". Giữ mặt bình thường, thư giãn nhé 😐` };
      }
    }

    return { isValid: true, suggestion: '' };
  };

  // Capture a training sample
  const captureSample = () => {
    const faces = allFacesRef.current;
    if (!faces || faces.length === 0) {
      return;
    }
    
    const activeClassLabel = CLASSES.find(c => c.id === activeClass)?.label || activeClass;
    const face = faces[0];
    const kps = getFaceKeypoints(face);
    if (!kps || kps.length < 468) return;

    const features = normalizeFaceFeatures(kps);
    const rawThumbnail = getVideoThumb();
    const thumbnail = getVideoThumb(faces);

    // Rule-based expression validation using facial ratios
    const validation = validateExpression(kps, activeClass);

    setSamples(prev => {
      if (!validation.isValid) {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setValidationToast(`⚠️ ${validation.suggestion}`);
        toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 4000);
      }

      const newSample: StoredSample = {
        id: crypto.randomUUID(),
        label: activeClassLabel,
        features,
        sourceId: activeClass,
        thumbnail,
        rawThumbnail,
        isValid: validation.isValid
      };

      return [...prev, newSample];
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
    const c1 = samples.filter(s => s.sourceId === 'class_1' || (s.label === CLASSES[0].label && !s.sourceId)).length;
    const c2 = samples.filter(s => s.sourceId === 'class_2' || (s.label === CLASSES[1].label && !s.sourceId)).length;
    const c3 = samples.filter(s => s.sourceId === 'class_3' || (s.label === CLASSES[2].label && !s.sourceId)).length;
    const c4 = samples.filter(s => s.sourceId === 'class_4' || (s.label === CLASSES[3].label && !s.sourceId)).length;

    if (c1 < 3 || c2 < 3 || c3 < 3 || c4 < 3) {
      speakEnglish('Need more samples to learn');
      return;
    }
    
    playClickSound();
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      if (trainerRef.current) {
        await trainerRef.current.train(samples, (epoch, progress, loss, acc) => {
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
      const faces = allFacesRef.current;
      
      if (faces && faces.length > 0) {
        const face = faces[0];
        const kps = getFaceKeypoints(face);
        if (kps && kps.length >= 468) {
          const features = normalizeFaceFeatures(kps);
          const result = await trainerRef.current!.predict(features);
          setPredictedLabel(result.label);
          setConfidence(result.confidence);
        }
      } else {
        setPredictedLabel('AI đang đợi khuôn mặt bạn... 👀');
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
        if (predictedLabel.includes('Vui vẻ')) {
          msg = 'AI đoán bạn đang rất vui!';
          setEffectEmoji('😀');
        } else if (predictedLabel.includes('Buồn bã')) {
          msg = 'AI đoán bạn đang buồn!';
          setEffectEmoji('😢');
        } else if (predictedLabel.includes('Ngạc nhiên')) {
          msg = 'AI đoán bạn đang ngạc nhiên!';
          setEffectEmoji('😲');
        } else if (predictedLabel.includes('Bình thường')) {
          msg = 'AI đoán bạn đang bình thường!';
          setEffectEmoji('😐');
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

    const drawFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && modelStatus === 'ready') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = video.getBoundingClientRect();
          const displayWidth = Math.round(rect.width);
          const displayHeight = Math.round(rect.height);

          if (displayWidth > 0 && displayHeight > 0 && (canvas.width !== displayWidth || canvas.height !== displayHeight)) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const allFaces = allFacesRef.current;
          const validFaces = allFaces.filter(kps => kps.length >= 30);

          if (validFaces.length > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
            validFaces.forEach((kpsRaw, faceIdx) => {
              ctx.save();

              const kps = normalizeFaceKeypoints(kpsRaw, video, canvas);
              
              // Colors
              const ovalColor = '#60a5fa';
              const eyeColor = '#a78bfa';
              const lipsColor = '#fbbf24';
              const noseColor = '#34d399';
              const dotColor = 'rgba(96,165,250,0.55)';

              // Draw face wireframe
              if (kps.length > 100) {
                ctx.strokeStyle = ovalColor;
                ctx.lineWidth = 1.8;
                drawPolyline(ctx, FACE_OVAL, kps);

                ctx.strokeStyle = eyeColor;
                ctx.lineWidth = 1.4;
                drawPolyline(ctx, FACE_L_EYE, kps);
                drawPolyline(ctx, FACE_R_EYE, kps);

                ctx.strokeStyle = lipsColor;
                ctx.lineWidth = 1.4;
                drawPolyline(ctx, FACE_LIPS, kps);

                ctx.strokeStyle = noseColor;
                ctx.lineWidth = 1.2;
                drawPolyline(ctx, FACE_NOSE, kps);
              }

              // Draw keypoints
              ctx.fillStyle = dotColor;
              for (const point of kps) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.restore();

              // Update live expression from the first face
              if (faceIdx === 0 && kps.length >= 468) {
                const ratios = getExpressionRatios(kps);
                setLiveExpression(detectExpression(ratios));
              }
            });
          }
        }
      }
      rafId = requestAnimationFrame(drawFrame);
    };

    drawFrame();
    return () => cancelAnimationFrame(rafId);
  }, [modelStatus, videoRef, canvasRef, allFacesRef]);

  // Handle open submission evaluation
  const handleOpenSubmit = () => {
    playClickSound();

    // 1. Evaluate accuracy against Emotion Landmark Dataset (real video landmarks)
    let kaggleCorrect = 0;
    EMOTION_LANDMARK_DATASET.forEach(testCase => {
      const result = classifyKNN(testCase.features, samples, 3);
      const expectedText = CLASSES.find(c => c.id === testCase.expectedLabel)?.label || testCase.expectedLabel;
      if (result.label === expectedText) {
        kaggleCorrect++;
      }
    });
    const kaggleAccuracy = EMOTION_LANDMARK_DATASET.length > 0 
      ? (kaggleCorrect / EMOTION_LANDMARK_DATASET.length) * 100
      : 0;

    // 2. Leave-One-Out Cross Validation (LOOCV) on user's own samples
    let loocvCorrect = 0;
    samples.forEach((holdOut, idx) => {
      const otherSamples = samples.filter((_, i) => i !== idx);
      if (otherSamples.length === 0) return;
      const result = classifyKNN(holdOut.features, otherSamples, 3);
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
          'teach-face',
          (uploaded, total) => {
            setUploadProgress(`Tải ảnh ${uploaded}/${total}...`);
          }
        );
        setUploadProgress('Đang lưu bài...');
      }

      await api.createDataset('teach-face', processedSamples, submitScore, reflectionAnswer, true, teacherNotes, true);
      
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
            <h1 className="text-2xl md:text-3xl font-black text-indigo-900">Dạy AI học Cảm xúc (Face)</h1>
          </div>
        </div>

        {/* Sandbox Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Instructions & Class Management */}
          <div className="bg-white rounded-3xl p-6 border-4 border-indigo-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="text-xs font-black text-indigo-600 tracking-wider mb-2 uppercase">Lớp học AI của bạn</div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Các bước dạy học cảm xúc:</h3>

              {/* Class Tabs */}
              <div className="space-y-3 mb-6">
                {CLASSES.map(cls => {
                  const rawCount = samples.filter(s => s.sourceId === cls.id || (s.label === cls.label && !s.sourceId)).length;
                  const classSampleCount = rawCount;
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
                💡 <b>Mẹo cho bạn:</b> Hãy di chuyển khuôn mặt nhẹ nhàng khi chụp để AI có thể học được nhiều góc độ khác nhau nhé!
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
                  <span>Xem danh sách Template</span>
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
                mode="emotion"
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
                  loadingText="ĐANG KHỞI ĐỘNG CAMERA NHẬN DẠNG KHUÔN MẶT..."
                  hudText={isTrained ? `Đang dự đoán dựa trên các mẫu bạn dạy` : `Chế độ thu thập dữ liệu - Chọn lớp bên trái để chụp`}
                  theme="blue"
                  onRetry={retryCamera}
                />
              </DataCollector>

              {/* Live Expression Indicator */}
              {modelStatus === 'ready' && !isTrained && (
                <div className="w-full mt-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔍</span>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 block">AI đang thấy biểu cảm:</span>
                      <span className="text-sm font-black text-indigo-800">{liveExpression}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 block">Nhãn đang chọn:</span>
                    <span className="text-sm font-black text-emerald-700">{CLASSES.find(c => c.id === activeClass)?.label}</span>
                  </div>
                </div>
              )}
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
                  Bạn hãy chụp mẫu nét mặt bên trái rồi bấm <span className="text-yellow-300">"Huấn Luyện AI"</span> để xem kết quả dự đoán trực tiếp ở đây nhé! 🤖✨
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
                <h3 className="text-2xl font-black text-indigo-900 mt-4">Nộp Bài Hoàn Tất!</h3>
                <p className="text-gray-600 font-semibold mt-2">Bộ dữ liệu của bạn đã được lưu thành công.</p>
                <button
                  onClick={() => router.push('/teacher/templates')}
                  className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-extrabold rounded-full hover:scale-105 transition-transform"
                >
                  Tuyệt vời! Đóng thôi
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-black text-indigo-900 mb-2 flex items-center gap-2">
                  <span>🎒</span> Bảng Lưu Bộ Dữ Liệu
                </h3>
                <p className="text-xs text-gray-500 font-bold mb-4">
                  Hệ thống sẽ chạy thử nghiệm chấm chéo tự động với 20 mẫu tiêu chuẩn từ Kaggle (5 mẫu mỗi cảm xúc) để đánh giá chất lượng mô hình của bạn.
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
                    💡 Mẹo: Bạn chụp hơi ít ảnh nên điểm bị trừ một chút (cần ít nhất 10 ảnh cho mỗi cảm xúc). Bạn hãy đóng bảng này và chụp thêm nhiều góc độ khác nhau để được 100% nhé!
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
                    <option value="Chụp ảnh rõ nét và giữ đầu thật yên lặng khi chụp">
                      Chụp hình đủ sáng, rõ nét mặt và giữ đầu đứng yên khi chụp ☝️
                    </option>
                    <option value="Chạy nhảy rung lắc camera thật mạnh">
                      Chạy nhảy đùa nghịch và lắc camera thật mạnh 🤪
                    </option>
                    <option value="Chụp nhiều vật thể lộn xộn trong phòng">
                      Chụp thật nhiều thứ đồ chơi lộn xộn đằng sau lưng 🧸
                    </option>
                  </select>
                </div>

                {/* Text feedback */}
                <div className="mb-6">
                  <label className="text-xs font-black text-gray-700 block mb-1.5">
                    Ghi chú của Giáo viên:
                  </label>
                  <textarea
                    rows={2}
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    placeholder="Nhập ghi chú cho bộ dữ liệu mẫu..."
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

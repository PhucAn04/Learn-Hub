'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Brain,
  Camera,
  Trash2,
  Plus,
  X,
  Save,
  Sparkles,
  ImagePlus,
  Download,
  Settings,
  Video,
  Film,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Square,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCamera } from '@/hooks/useCamera';
import { useMobilenet } from '@/hooks/useMobilenet';
import { playSuccessSound, playClickSound, speakEnglish } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';
import { classifyKNN } from '@/lib/knn-classifier';
import CameraView from '@/components/CameraView';
import SampleGallery from '@/components/SampleGallery';
import { TfTrainer } from '@/lib/tf-trainer';
import {
  uploadSamplesToCloudinary,
  uploadModelToCloudinary,
  isCloudinaryConfigured,
} from '@/lib/cloudinary';
import { assessQuality } from '@/lib/image-quality';
import { checkMisclassification, cosineSimilarity, REFERENCE_CENTROIDS } from '@/lib/reference-embeddings';
import { TEACHER_DATASET_PRESETS, cleanClassLabel, matchLabelToDataset } from '@/lib/dataset-label-mapping';

/** Số mẫu tối thiểu mỗi nhãn để có thể huấn luyện (ít nhất 3 mẫu) */
const MIN_SAMPLES_PER_CLASS = 3;

const MAX_CLASSES = 10;
const OOD_CONFIDENCE_THRESHOLD = 65;
const OOD_MAX_KNN_DISTANCE = 1.2;

export default function TeacherTeachActionPage() {
  const router = useRouter();

  // ── Custom Classes ─────────────────────────────────────
  const [classes, setClasses] = useState<{ id: string; label: string; emoji: string }[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [newEmojiInput, setNewEmojiInput] = useState('✨');

  // ── Data Collection ────────────────────────────────────
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [activeClass, setActiveClass] = useState<string>('');

  // ── Training ───────────────────────────────────────────
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingLogs, setTrainingLogs] = useState<{ epoch: number; loss: number; acc: number }[]>([]);

  // ── Hyperparameters ────────────────────────────────────
  const [hpEpochs, setHpEpochs] = useState(50);
  const [hpBatchSize, setHpBatchSize] = useState(32);
  const [hpLearningRate, setHpLearningRate] = useState(0.005);
  const [showSettings, setShowSettings] = useState(false);

  // ── Prediction ─────────────────────────────────────────
  const [predictedLabel, setPredictedLabel] = useState('Chưa nhận diện... 🤔');
  const [confidence, setConfidence] = useState(0);
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [predictionActive, setPredictionActive] = useState(false);
  const [isDetectedInLibrary, setIsDetectedInLibrary] = useState(false);
  const activeStreakRef = useRef(0);
  const idleStreakRef = useRef(0);
  const lastActiveTimeRef = useRef(Date.now());
  const isDetectedRef = useRef(false);

  // ── Hold-to-Record ─────────────────────────────────────
  const [capturingType, setCapturingType] = useState<'gesture' | 'object' | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Upload để dự đoán ──────────────────────────────────
  const [predictImage, setPredictImage] = useState<string | null>(null);
  const [predictResult, setPredictResult] = useState<{ label: string; confidence: number; confidences: Record<string, number>; isOOD: boolean; reason?: string } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const predictFileRef = useRef<HTMLInputElement | null>(null);

  // ── Submission ─────────────────────────────────────────
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [teacherNotes, setTeacherNotes] = useState('Bộ dữ liệu mẫu để học sinh tham khảo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ── UI ─────────────────────────────────────────────────
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const classIdCounterRef = useRef(0);

  // ── Video Recording & Motion Tracking (3s countdown + 5s/10s recording @ 120ms / 8.3 FPS) ──
  const [videoRecordingState, setVideoRecordingState] = useState<'idle' | 'countdown' | 'recording' | 'processing'>('idle');
  const [countdownSec, setCountdownSec] = useState(3);
  const [recordingDurationSec, setRecordingDurationSec] = useState<5 | 10>(10);
  const [recordingSecLeft, setRecordingSecLeft] = useState(10);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [liveMotionScore, setLiveMotionScore] = useState(0);
  const [recordedFramesCount, setRecordedFramesCount] = useState(0);
  const [isExtractingVideo, setIsExtractingVideo] = useState(false);
  const fileInputVideoRef = useRef<HTMLInputElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const finishRecordingEarlyRef = useRef<(() => void) | null>(null);

  // ── Motion Sequence Flipbook Player ───────────────────
  const [showMotionPlayer, setShowMotionPlayer] = useState(false);
  const [motionPlayerIdx, setMotionPlayerIdx] = useState(0);
  const [isMotionPlaying, setIsMotionPlaying] = useState(false);
  const motionPlayerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Refs ───────────────────────────────────────────────
  const trainerRef = useRef<TfTrainer | null>(null);
  const fileInputObjectRef = useRef<HTMLInputElement | null>(null);
  const fileInputGestureRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    trainerRef.current = new TfTrainer();
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (recordingProgressIntervalRef.current) clearInterval(recordingProgressIntervalRef.current);
      if (motionPlayerIntervalRef.current) clearInterval(motionPlayerIntervalRef.current);
    };
  }, []);

  // ── Effect chạy chuỗi chuyển động liên tục (8.3 FPS / 120ms) ──
  useEffect(() => {
    if (!showMotionPlayer || !isMotionPlaying) {
      if (motionPlayerIntervalRef.current) clearInterval(motionPlayerIntervalRef.current);
      return;
    }
    const gestureFrames = samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'gesture');
    if (gestureFrames.length === 0) return;

    motionPlayerIntervalRef.current = setInterval(() => {
      setMotionPlayerIdx((prev) => (prev + 1) % gestureFrames.length);
    }, 120);

    return () => {
      if (motionPlayerIntervalRef.current) clearInterval(motionPlayerIntervalRef.current);
    };
  }, [showMotionPlayer, isMotionPlaying, samples, activeClass]);

  const { videoRef, canvasRef, cameraError, retryCamera } = useCamera({ width: 640, height: 480 });
  const { modelStatus, extractFeatures, extractFeaturesFromVideo, extractFeaturesFromBase64 } = useMobilenet();

  // ── Toast ──────────────────────────────────────────────
  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setValidationToast(msg);
    toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 4000);
  };

  // ── Class Management ───────────────────────────────────
  const addClass = () => {
    const rawLabel = newLabelInput.trim();
    if (!rawLabel) return;
    const label = cleanClassLabel(rawLabel, newEmojiInput) || rawLabel;
    if (classes.length >= MAX_CLASSES) { showToast(`⚠️ Tối đa ${MAX_CLASSES} nhãn!`); return; }
    if (classes.some((c) => c.label === label)) { showToast('⚠️ Nhãn này đã tồn tại!'); return; }
    const newId = `class_action_${++classIdCounterRef.current}`;
    setClasses((prev) => [...prev, { id: newId, label, emoji: newEmojiInput || '✨' }]);
    setNewLabelInput('');
    setActiveClass(newId);
    playClickSound();
  };

  const removeClass = (classId: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    setSamples((prev) => prev.filter((s) => s.sourceId !== classId));
    setIsTrained(false);
    setActiveClass((prev) => (prev === classId ? classes[0]?.id || '' : prev));
  };

  const applyPreset = (presetId: string) => {
    const preset = TEACHER_DATASET_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const newClasses = preset.classes.map((c) => ({
      id: `class_action_${++classIdCounterRef.current}`,
      label: cleanClassLabel(c.label, c.emoji) || c.label,
      emoji: c.emoji,
    }));
    setClasses(newClasses);
    setActiveClass(newClasses[0]?.id || '');
    setSamples([]);
    setIsTrained(false);
    playSuccessSound();
    showToast(`Đã nạp kịch bản: ${preset.title}! Hãy thu thập cử chỉ và sự vật nhé 📸`);
  };

  const clearClassSamples = (classId: string, type?: 'object' | 'gesture') => {
    playClickSound();
    setSamples((prev) => prev.filter((s) => {
      if (s.sourceId !== classId) return true;
      if (type && s.sourceType !== type) return true;
      return false;
    }));
    setIsTrained(false);
  };

  // ── Capture ────────────────────────────────────────────
  const captureSample = (type: 'gesture' | 'object') => {
    if (modelStatus !== 'ready' || !videoRef.current || !activeClass) return;
    const video = videoRef.current;
    const features = extractFeaturesFromVideo(video);
    if (!features) { showToast('⚠️ Không thể trích xuất đặc trưng!'); return; }

    const vW = video.videoWidth || 640;
    const vH = video.videoHeight || 480;
    const cv = document.createElement('canvas');
    cv.width = vW; cv.height = vH;
    const ctx = cv.getContext('2d');
    if (ctx) ctx.drawImage(video, 0, 0, vW, vH);
    const thumbnail = cv.toDataURL('image/jpeg', 0.8);

    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';

    let isValid = true;
    let isQuestionable = false;
    let questionableReason: string | undefined;
    let quality: ReturnType<typeof assessQuality> | undefined;

    if (type === 'object') {
      // ── BỘ 2: HÌNH ẢNH SỰ VẬT TƯƠNG ĐƯƠNG ──
      // Đối soát với các bộ dữ liệu sự vật (Dataset 1..5: Chó Mèo, Bệnh Lá, Côn Trùng, Trái Cây)
      quality = ctx ? assessQuality(cv) : undefined;
      const isQualityOk = !(quality?.isDark || quality?.isBlurry);

      const mischeck = checkMisclassification(
        features,
        activeClassLabel,
        classes.map((c) => c.label)
      );

      isValid = isQualityOk && !mischeck.isSuspect;
      isQuestionable = mischeck.isSuspect;
      questionableReason = mischeck.message;

      if (!isQualityOk && quality) {
        showToast(`⚠️ ${quality.isDark ? 'Ảnh hơi tối! 🌙' : 'Ảnh hơi mờ! 📸'}`);
      } else if (mischeck.isSuspect) {
        showToast(mischeck.message || '⚠️ Ảnh sự vật có dấu hiệu sai nhãn (không tính vào khung mẫu)!');
      }
    } else {
      // ── BỘ 1: VIDEO / CỬ CHỈ HÀNH ĐỘNG ──
      // Dữ liệu hành động/cử chỉ riêng do giáo viên thu trực tiếp (không liên quan đến dataset sự vật Dataset 1..5)
      isValid = true;
      isQuestionable = false;
    }

    setSamples((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: activeClassLabel,
        sourceId: activeClass,
        sourceType: type,
        features,
        thumbnail,
        rawThumbnail: thumbnail,
        isValid,
        isQuestionable,
        questionableReason,
        quality,
      },
    ]);
    playClickSound();
  };

  const startCapturing = (type: 'gesture' | 'object') => {
    if (modelStatus !== 'ready' || !activeClass) return;
    playClickSound();
    setCapturingType(type);
    captureSample(type);
    captureIntervalRef.current = setInterval(() => captureSample(type), 300);
  };

  const stopCapturing = () => {
    setCapturingType(null);
    if (captureIntervalRef.current) { clearInterval(captureIntervalRef.current); captureIntervalRef.current = null; }
  };

  // ── Live Video Recording (3s Countdown + High-Frequency Motion Capture @ 120ms / 8.3 FPS) ──
  const startLiveVideoRecording = () => {
    if (modelStatus !== 'ready' || !videoRef.current || !activeClass || videoRecordingState !== 'idle') return;
    playClickSound();

    setVideoRecordingState('countdown');
    setCountdownSec(3);

    let count = 3;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdownSec(count);
        playClickSound();
      } else {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        beginRecordingVideo();
      }
    }, 1000);
  };

  const beginRecordingVideo = () => {
    setVideoRecordingState('recording');
    const totalDurationSec = recordingDurationSec;
    setRecordingSecLeft(totalDurationSec);
    setRecordingProgress(0);
    setLiveMotionScore(0);
    setRecordedFramesCount(0);
    playSuccessSound();

    const video = videoRef.current;
    if (!video) {
      setVideoRecordingState('idle');
      return;
    }

    const DURATION_MS = totalDurationSec * 1000;
    const startTime = Date.now();
    const capturedItems: { canvas: HTMLCanvasElement; motionScore: number; timestamp: number }[] = [];

    // Canvas phụ siêu nhẹ (80x60) để tính vi sai chuyển động pixel liên tục (< 0.1ms)
    const diffCv = document.createElement('canvas');
    diffCv.width = 80;
    diffCv.height = 60;
    const diffCtx = diffCv.getContext('2d', { willReadFrequently: true });
    let prevPixelData: Uint8ClampedArray | null = null;

    let isFinished = false;

    const finalizeRecording = () => {
      if (isFinished) return;
      isFinished = true;
      clearInterval(frameCaptureInterval);
      if (recordingProgressIntervalRef.current) clearInterval(recordingProgressIntervalRef.current);
      finishRecordingEarlyRef.current = null;
      processLiveRecordedFrames(capturedItems);
    };

    finishRecordingEarlyRef.current = finalizeRecording;

    // LẤY MẪU CHUYỂN ĐỘNG TẦN SUẤT CAO: Mỗi 120ms (Khoảng 8.3 khung hình/giây chuẩn Teachable Machine)
    const frameCaptureInterval = setInterval(() => {
      if (!videoRef.current || isFinished) return;
      const v = videoRef.current;
      const vW = v.videoWidth || 640;
      const vH = v.videoHeight || 480;

      // 1. Đo lường cường độ chuyển động vi sai giữa 2 khung hình liên tiếp
      let motionPct = 0;
      if (diffCtx) {
        diffCtx.drawImage(v, 0, 0, 80, 60);
        const imgData = diffCtx.getImageData(0, 0, 80, 60);
        const data = imgData.data;
        if (prevPixelData) {
          let totalDiff = 0;
          const len = data.length;
          for (let i = 0; i < len; i += 4) {
            totalDiff += Math.abs(data[i] - prevPixelData[i]) +
                         Math.abs(data[i + 1] - prevPixelData[i + 1]) +
                         Math.abs(data[i + 2] - prevPixelData[i + 2]);
          }
          const avgDiff = totalDiff / (80 * 60 * 3);
          motionPct = Math.min(100, Math.round((avgDiff / 25) * 100));
        }
        prevPixelData = new Uint8ClampedArray(data);
        setLiveMotionScore(motionPct);
      }

      // 2. Chụp khung hình gốc
      const cv = document.createElement('canvas');
      cv.width = vW;
      cv.height = vH;
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, vW, vH);
        capturedItems.push({
          canvas: cv,
          motionScore: motionPct,
          timestamp: Date.now() - startTime,
        });
        setRecordedFramesCount(capturedItems.length);
      }
    }, 120);

    // Tiến trình và đếm ngược cập nhật mỗi 100ms
    if (recordingProgressIntervalRef.current) clearInterval(recordingProgressIntervalRef.current);
    recordingProgressIntervalRef.current = setInterval(() => {
      if (isFinished) return;
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setRecordingSecLeft(remaining);
      setRecordingProgress(pct);

      if (elapsed >= DURATION_MS) {
        finalizeRecording();
      }
    }, 100);
  };

  const processLiveRecordedFrames = async (
    capturedItems: { canvas: HTMLCanvasElement; motionScore: number; timestamp: number }[]
  ) => {
    setVideoRecordingState('processing');
    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';

    try {
      if (capturedItems.length === 0) {
        showToast('⚠️ Chưa thu thập được khung hình nào từ camera!');
        setVideoRecordingState('idle');
        return;
      }

      // Tối ưu hóa chuỗi chuyển động chuẩn Teachable Machine:
      // Ưu tiên giữ lại các frame có chuyển động rõ nét (motionScore >= 8%) và các mốc chuyển tiếp
      let selectedItems = capturedItems;
      if (capturedItems.length > 40) {
        const motionItems = capturedItems.filter((it) => it.motionScore >= 8);
        if (motionItems.length >= 20) {
          const stride = Math.max(1, Math.floor(motionItems.length / 35));
          selectedItems = motionItems.filter((_, idx) => idx % stride === 0);
          if (!selectedItems.includes(capturedItems[0])) {
            selectedItems.unshift(capturedItems[0]);
          }
        } else {
          const step = Math.ceil(capturedItems.length / 35);
          selectedItems = capturedItems.filter((_, idx) => idx % step === 0);
        }
      }

      const newSamples: StoredSample[] = [];
      const totalFrames = selectedItems.length;

      for (let i = 0; i < totalFrames; i++) {
        const item = selectedItems[i];
        const features = extractFeatures(item.canvas);
        if (!features) continue;

        const thumbnail = item.canvas.toDataURL('image/jpeg', 0.8);

        const phaseName =
          i === 0
            ? 'Bắt đầu'
            : i === Math.floor(totalFrames / 2)
            ? 'Đỉnh cử chỉ'
            : i === totalFrames - 1
            ? 'Thu tay'
            : `Chuyển động #${i + 1}`;

        newSamples.push({
          id: crypto.randomUUID(),
          label: activeClassLabel,
          sourceId: activeClass,
          sourceType: 'gesture',
          features,
          thumbnail,
          rawThumbnail: thumbnail,
          isValid: true,
          isQuestionable: false,
          questionableReason: `Frame ${i + 1}/${totalFrames} [${phaseName}] (${item.motionScore}% chuyển động)`,
        });
      }

      if (newSamples.length > 0) {
        setSamples((prev) => [...prev, ...newSamples]);
        playSuccessSound();
        showToast(`✅ Đã thu nhận chuỗi chuyển động gồm ${newSamples.length} khung hình mượt mà (8 FPS) cho "${activeClassLabel}"!`);
      } else {
        showToast('⚠️ Không thể trích xuất khung hình hợp lệ từ video!');
      }
    } catch (err) {
      console.error('Error processing live video:', err);
      showToast('⚠️ Có lỗi khi xử lý chuỗi chuyển động!');
    } finally {
      setVideoRecordingState('idle');
      setLiveMotionScore(0);
      setRecordedFramesCount(0);
    }
  };

  // ── Video File Upload & Frame Slicing ─────────────────
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeClass || modelStatus !== 'ready') return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const videoFile = files[0];

    setIsExtractingVideo(true);
    showToast('⏳ Đang phân tích video và cắt 8 khung hình đại diện...');
    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';

    try {
      const frames = await extractFramesFromVideoFile(videoFile, 8);
      const newSamples: StoredSample[] = [];

      for (const frame of frames) {
        const features = extractFeatures(frame.canvas);
        if (!features) continue;

        // ── BỘ 1: VIDEO / CỬ CHỈ HÀNH ĐỘNG ──
        // Video hành động tải lên phục vụ học nhận diện cử chỉ (không đối soát với dataset sự vật Dataset 1..5)
        newSamples.push({
          id: crypto.randomUUID(),
          label: activeClassLabel,
          sourceId: activeClass,
          sourceType: 'gesture',
          features,
          thumbnail: frame.thumbnail,
          rawThumbnail: frame.thumbnail,
          isValid: true,
          isQuestionable: false,
        });
      }

      if (newSamples.length > 0) {
        setSamples((prev) => [...prev, ...newSamples]);
        playSuccessSound();
        showToast(`✅ Đã cắt ${newSamples.length} khung hình hành động từ video "${videoFile.name}" cho nhãn "${activeClassLabel}"!`);
      } else {
        showToast('⚠️ Không thể trích xuất khung hình từ video!');
      }
    } catch (err) {
      console.error('Failed to extract frames from video:', err);
      showToast('⚠️ Lỗi khi cắt frame từ file video!');
    } finally {
      setIsExtractingVideo(false);
      if (fileInputVideoRef.current) fileInputVideoRef.current.value = '';
    }
  };

  // ── File Upload ────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'gesture' | 'object') => {
    if (!activeClass || modelStatus !== 'ready') return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';
    const typeLabel = type === 'object' ? 'sự vật' : 'cử chỉ';

    const validImageFiles = Array.from(files).filter(
      (file) => file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)
    );

    if (validImageFiles.length === 0) {
      showToast('⚠️ Vui lòng chọn file hình ảnh hợp lệ!');
      return;
    }

    const newSamples: StoredSample[] = [];
    let misclassifiedCount = 0;
    let firstSuspectMsg = '';

    for (const file of validImageFiles) {
      try {
        const base64 = await fileToBase64(file);
        const features = await extractFeaturesFromBase64(base64);
        if (!features) continue;

        let isValid = true;
        let isQuestionable = false;
        let questionableReason: string | undefined;

        if (type === 'object') {
          // ── BỘ 2: HÌNH ẢNH SỰ VẬT TƯƠNG ĐƯƠNG ──
          // Đối soát với các bộ dữ liệu sự vật (Dataset 1..5) để phát hiện ảnh sai nhãn
          const mischeck = checkMisclassification(
            features,
            activeClassLabel,
            classes.map((c) => c.label)
          );

          if (mischeck.isSuspect) {
            misclassifiedCount++;
            if (!firstSuspectMsg) firstSuspectMsg = mischeck.message || '';
            isValid = false;
            isQuestionable = true;
            questionableReason = mischeck.message;
          }
        } else {
          // ── BỘ 1: VIDEO / CỬ CHỈ HÀNH ĐỘNG ──
          // Dữ liệu cử chỉ của giáo viên (không đối soát với dataset sự vật Dataset 1..5)
          isValid = true;
          isQuestionable = false;
        }

        newSamples.push({
          id: crypto.randomUUID(),
          label: activeClassLabel,
          sourceId: activeClass,
          sourceType: type,
          features,
          thumbnail: base64,
          rawThumbnail: base64,
          isValid,
          isQuestionable,
          questionableReason,
        });
      } catch (err) {
        console.error('Failed to process uploaded image:', err);
      }
    }

    if (newSamples.length > 0) {
      setSamples((prev) => [...prev, ...newSamples]);
      const validAddedCount = newSamples.filter((s) => s.isValid !== false && !s.isQuestionable).length;
      if (misclassifiedCount > 0) {
        showToast(
          firstSuspectMsg
            ? `${firstSuspectMsg} (Ảnh sai nhãn không được tính vào khung mẫu!)`
            : `⚠️ Phát hiện ${misclassifiedCount} ảnh ${typeLabel} sai nhãn (không tính vào khung mẫu)!`
        );
      } else {
        showToast(`✅ Đã thêm ${validAddedCount} ảnh ${typeLabel} cho "${activeClassLabel}"!`);
      }
      playClickSound();
    } else {
      showToast('⚠️ Không thể trích xuất đặc trưng từ ảnh đã chọn!');
    }

    if (type === 'object' && fileInputObjectRef.current) fileInputObjectRef.current.value = '';
    if (type === 'gesture' && fileInputGestureRef.current) fileInputGestureRef.current.value = '';
  };

  // ── Training ───────────────────────────────────────────
  const canTrain = useMemo(() => {
    if (classes.length < 2) return false;
    return classes.every(
      (c) =>
        samples.filter((s) => s.isValid !== false && !s.isQuestionable && s.sourceId === c.id).length >=
        MIN_SAMPLES_PER_CLASS
    );
  }, [classes, samples]);

  const handleTrain = async () => {
    if (!canTrain) {
      showToast(`⚠️ Cần ít nhất ${MIN_SAMPLES_PER_CLASS} mẫu hợp lệ cho mỗi nhãn!`);
      return;
    }
    setIsTraining(true); setTrainingProgress(0); setTrainingLogs([]); playClickSound();
    try {
      const validSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable);

      // Tích hợp dữ liệu đặc trưng chuẩn từ Thư viện ảnh (Dataset Prototypes) cho các nhãn tương ứng (Chó, Mèo, Bọ Cánh Cứng...)
      const trainingDatasetSamples: StoredSample[] = [...validSamples];
      for (const c of classes) {
        const match = matchLabelToDataset(c.label);
        if (match.matched && match.classMapping && REFERENCE_CENTROIDS[match.classMapping.key]) {
          const centroid = REFERENCE_CENTROIDS[match.classMapping.key];
          for (let i = 0; i < 10; i++) {
            const noisy = i === 0 ? centroid : centroid.map((v) => v + (Math.random() - 0.5) * 0.04);
            const norm = Math.sqrt(noisy.reduce((sum, v) => sum + v * v, 0)) || 1;
            trainingDatasetSamples.push({
              id: `proto_${c.id}_${i}`,
              label: c.label,
              sourceId: c.id,
              sourceType: 'object',
              features: noisy.map((v) => v / norm),
              thumbnail: '',
              isValid: true,
            });
          }
        }
      }

      if (trainerRef.current) {
        await trainerRef.current.train(trainingDatasetSamples, (_epoch, progress, loss, acc) => {
          setTrainingProgress(progress);
          setTrainingLogs((prev) => [...prev, { epoch: _epoch, loss, acc }]);
        }, { epochs: hpEpochs, batchSize: hpBatchSize, learningRate: hpLearningRate });
        setIsTraining(false);
        setIsTrained(true);
        setPredictionActive(false);
        setIsDetectedInLibrary(false);
        setPredictedLabel('Chưa nhận diện... 💤');
        setConfidence(0);
        setConfidences({});
        playSuccessSound();
        showToast('🎉 Dạy AI thành công! Hãy bấm "Bật nhận diện Camera 🎭" khi bạn sẵn sàng thử.');
        speakEnglish('Learning complete. Let us test!');
      }
    } catch (err) { console.error('Training failed:', err); setIsTraining(false); showToast('❌ Huấn luyện thất bại.'); }
  };

  // ── Realtime Prediction loop với cơ chế lọc OOD & Tự động tắt khi không có cử chỉ ──
  useEffect(() => {
    if (!predictionActive || !isTrained || modelStatus !== 'ready' || !trainerRef.current) {
      setIsDetectedInLibrary(false);
      isDetectedRef.current = false;
      return;
    }
    let rafId: number;
    activeStreakRef.current = 0;
    idleStreakRef.current = 0;
    lastActiveTimeRef.current = Date.now();
    isDetectedRef.current = false;

    const gestureSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable && s.sourceType === 'gesture');
    const objectSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable && s.sourceType === 'object');

    const predict = async () => {
      if (!videoRef.current || !trainerRef.current?.isTrained()) {
        rafId = requestAnimationFrame(predict);
        return;
      }
      try {
        const features = extractFeaturesFromVideo(videoRef.current);
        if (features) {
          // 1. Khung hình luôn chạy qua Neural Network (NN)
          const result = await trainerRef.current.predict(features);

          // 2. Đối soát chặt chẽ với Thư viện ảnh để loại bỏ phông nền/rác (OOD):
          const winningGestureSamples = gestureSamples.filter((s) => s.label === result?.label);
          const winningObjectSamples = objectSamples.filter((s) => s.label === result?.label);

          let maxSimInClass = -1;
          let isGestureMatch = false;

          // Nếu nhãn có mẫu cử chỉ (Set 1 Video / Webcam):
          // Ngưỡng khắc khe >= 0.83 để loại trừ hoàn toàn phông nền phòng/người ngồi im
          for (const s of winningGestureSamples) {
            const sim = cosineSimilarity(features, s.features);
            if (sim > maxSimInClass) maxSimInClass = sim;
          }
          if (winningGestureSamples.length > 0 && maxSimInClass >= 0.83) {
            isGestureMatch = true;
          }

          // Nếu nhãn chỉ có ảnh sự vật (Set 2 Upload / Dataset):
          if (winningGestureSamples.length === 0) {
            for (const s of winningObjectSamples) {
              const sim = cosineSimilarity(features, s.features);
              if (sim > maxSimInClass) maxSimInClass = sim;
            }
            const match = matchLabelToDataset(result?.label || '');
            if (match.matched && match.classMapping && REFERENCE_CENTROIDS[match.classMapping.key]) {
              const cSim = cosineSimilarity(features, REFERENCE_CENTROIDS[match.classMapping.key]);
              if (cSim > maxSimInClass) maxSimInClass = cSim;
            }
            if (maxSimInClass >= 0.75) {
              isGestureMatch = true;
            }
          }

          // Khung hình thuộc Thư viện ảnh khi: NN tự tin >= 75% VÀ khớp chặt chẽ mẫu thư viện
          const isFrameInLibrary = result && result.confidence >= 75 && isGestureMatch;

          if (isFrameInLibrary) {
            activeStreakRef.current++;
            idleStreakRef.current = 0;

            // Khắc khe hơn: Cần ít nhất 4 frames liên tiếp xác nhận cử chỉ đúng
            if (activeStreakRef.current >= 4) {
              lastActiveTimeRef.current = Date.now();

              if (!isDetectedRef.current) {
                isDetectedRef.current = true;
                setIsDetectedInLibrary(true);
              }
              setConfidence(result.confidence);
              setPredictedLabel(result.label);
              if (result.confidences) {
                setConfidences(result.confidences);
              }
            }
          } else {
            idleStreakRef.current++;
            activeStreakRef.current = 0;

            // Khi 4 frames liên tiếp không có cử chỉ trong Thư viện -> Chuyển sang IDLE & ẨN THANH NĂNG LƯỢNG
            if (idleStreakRef.current >= 4) {
              if (isDetectedRef.current) {
                isDetectedRef.current = false;
                setIsDetectedInLibrary(false);
                setConfidence(0);
                setPredictedLabel('Đang chờ cử chỉ... 💤');
                const zeroConf: Record<string, number> = {};
                classes.forEach((c) => { zeroConf[c.label] = 0; });
                setConfidences(zeroConf);
              }

              // Tự động tắt nhận diện sau đúng 10s không có cử chỉ trong Thư viện ảnh (chạy ngầm hoàn toàn)
              const idleMs = Date.now() - lastActiveTimeRef.current;
              if (idleMs >= 10000) {
                setPredictionActive(false);
                setIsDetectedInLibrary(false);
                isDetectedRef.current = false;
                playClickSound();
                showToast('💤 Đã tự động tắt nhận diện do không có cử chỉ trong Thư viện ảnh.');
                return;
              }
            }
          }
        }
      } catch (err) {
        /* skip frame */
      }
      rafId = requestAnimationFrame(predict);
    };

    predict();
    return () => cancelAnimationFrame(rafId);
  }, [predictionActive, isTrained, modelStatus, samples, classes, extractFeaturesFromVideo, videoRef]);

  // ── Upload predict ─────────────────────────────────────
  const handlePredictUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || !trainerRef.current?.isTrained()) return;
    setIsPredicting(true); setPredictResult(null);
    try {
      const base64 = await fileToBase64(file);
      setPredictImage(base64);
      const features = await extractFeaturesFromBase64(base64);
      if (!features) { showToast('⚠️ Không thể xử lý ảnh này.'); setIsPredicting(false); return; }

      // 1. Chạy qua Mạng Nơ-ron (NN) đã học
      const result = await trainerRef.current.predict(features);

      // 2. Thu thập các key centroid của các nhãn đang dạy (Active Classes)
      const activeCentroidKeys = new Set<string>();
      const activeClassMap: Record<string, string> = {};
      for (const c of classes) {
        const match = matchLabelToDataset(c.label);
        if (match.matched && match.classMapping && REFERENCE_CENTROIDS[match.classMapping.key]) {
          activeCentroidKeys.add(match.classMapping.key);
          activeClassMap[c.label] = match.classMapping.key;
        }
      }

      // 3. Tính độ tương đồng với từng lớp đang dạy (Active Classes)
      let maxActiveSim = -1;
      let matchedLabel: string | null = null;
      const classSims: Record<string, number> = {};

      for (const c of classes) {
        let maxC = -1;
        // Kiểm tra đối soát với các mẫu thực tế giáo viên đã nạp (webcam/video/upload)
        const cSamples = samples.filter((s) => s.label === c.label && s.isValid !== false);
        for (const s of cSamples) {
          const sim = cosineSimilarity(features, s.features);
          if (sim > maxC) maxC = sim;
        }
        // Kiểm tra đối soát với centroid chuẩn của nhãn đó (nếu có trong dataset)
        const cKey = activeClassMap[c.label];
        if (cKey && REFERENCE_CENTROIDS[cKey]) {
          const cSim = cosineSimilarity(features, REFERENCE_CENTROIDS[cKey]);
          if (cSim > maxC) maxC = cSim;
        }
        classSims[c.label] = maxC;
        if (maxC > maxActiveSim) {
          maxActiveSim = maxC;
          matchedLabel = c.label;
        }
      }

      // Sắp xếp điểm tương đồng các lớp đang dạy để tính khoảng cách phân biệt (margin)
      const sortedSims = Object.values(classSims).sort((a, b) => b - a);
      const runnerUpSim = sortedSims.length > 1 ? sortedSims[1] : 0;
      const margin = maxActiveSim - runnerUpSim;

      // 4. Đối soát với TẤT CẢ các lớp centroid KHÁC (Inactive Centroids) trong toàn bộ 5 dataset
      let maxOtherCentroidSim = -1;
      let bestOtherKey = '';
      for (const [key, centroidVec] of Object.entries(REFERENCE_CENTROIDS)) {
        if (!activeCentroidKeys.has(key)) {
          const sim = cosineSimilarity(features, centroidVec);
          if (sim > maxOtherCentroidSim) {
            maxOtherCentroidSim = sim;
            bestOtherKey = key;
          }
        }
      }

      // 5. Các quy tắc REJECT OOD (Loại trừ ảnh lạ):
      // A. Ảnh thuộc về một lớp sự vật khác ngoài các lớp đang dạy (VD: tải táo/lá/bọ khi chỉ dạy chó/mèo)
      const belongsToOtherDatasetClass =
        maxOtherCentroidSim > maxActiveSim + 0.03 ||
        (maxOtherCentroidSim >= 0.65 && maxOtherCentroidSim > maxActiveSim);

      // B. Ảnh hoàn toàn không giống bất kỳ mẫu nào đã dạy (độ tương đồng tuyệt đối quá thấp)
      // Để vượt qua, ảnh phải đạt >= 0.54 với centroid chuẩn hoặc >= 0.62 với ảnh mẫu giáo viên
      const lowAbsoluteSimilarity = maxActiveSim < 0.54;

      // C. Độ cách biệt quá mập mờ giữa các lớp (ảnh noise, phông nền mờ, vật thể lạ không định hình)
      const ambiguousLowMargin = classes.length >= 2 && maxActiveSim < 0.65 && margin < 0.035;

      // D. Mạng nơ-ron không đủ tự tin
      const lowConfidence = result.confidence < 60 && maxActiveSim < 0.60;

      const isOOD = belongsToOtherDatasetClass || lowAbsoluteSimilarity || ambiguousLowMargin || lowConfidence;

      if (isOOD) {
        let reason = 'Ảnh không giống các mẫu trong Thư viện ảnh hoặc bộ dữ liệu đã dạy.';
        if (belongsToOtherDatasetClass) {
          reason = `Ảnh có dấu hiệu thuộc nhóm đối tượng khác (${bestOtherKey}) nằm ngoài các nhãn đang dạy.`;
        } else if (lowAbsoluteSimilarity) {
          reason = 'Độ tương đồng quá thấp, ảnh không nằm trong bộ dữ liệu hoặc Thư viện ảnh.';
        } else if (ambiguousLowMargin) {
          reason = 'Không phân biệt rõ ràng với các nhãn đã dạy (ảnh mờ hoặc vật thể không xác định).';
        }

        setPredictResult({
          label: 'Không nhận diện được',
          confidence: 0,
          confidences: {},
          isOOD: true,
          reason,
        });
      } else {
        // Ảnh hợp lệ: Tính toán phân bổ tự tin chính xác
        const targetLabel = matchedLabel || result.label;
        const confidences: Record<string, number> = {};
        let sumExp = 0;
        for (const c of classes) {
          const s = Math.max(0.1, classSims[c.label] || 0.2);
          const expVal = Math.exp((s - maxActiveSim) * 10);
          confidences[c.label] = expVal;
          sumExp += expVal;
        }
        for (const c of classes) {
          confidences[c.label] = Number(((confidences[c.label] || 0) / sumExp).toFixed(2));
        }
        const topConfidence = Math.min(100, Math.max(result.confidence, Math.round((confidences[targetLabel] || 0.85) * 100)));

        setPredictResult({
          label: targetLabel,
          confidence: topConfidence,
          confidences,
          isOOD: false,
        });
      }
    } catch { showToast('❌ Lỗi khi dự đoán ảnh.'); }
    finally { setIsPredicting(false); if (predictFileRef.current) predictFileRef.current.value = ''; }
  };

  // ── Self-Evaluation ────────────────────────────────────
  const selfAccuracy = useMemo(() => {
    const validSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable);
    if (validSamples.length < 4) return null;
    let correct = 0;
    validSamples.forEach((sample, i) => {
      const others = validSamples.filter((_, j) => j !== i);
      if (others.length > 0) { const result = classifyKNN(sample.features, others, 3); if (result.label === sample.label) correct++; }
    });
    return Math.round((correct / validSamples.length) * 100);
  }, [samples]);

  // ── Submit ─────────────────────────────────────────────
  const handleOpenSubmit = () => { if (!isTrained) { showToast('⚠️ Hãy huấn luyện trước!'); return; } playClickSound(); setShowSubmitModal(true); };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      let processedSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable);
      if (isCloudinaryConfigured()) {
        setUploadProgress('Đang tải ảnh lên Cloud...');
        processedSamples = await uploadSamplesToCloudinary(processedSamples, 'teach-action', (uploaded, total) => setUploadProgress(`Tải ảnh ${uploaded}/${total}...`));
        setUploadProgress('Đang lưu bộ mẫu...');
      }
      const response = await api.createDataset('teach-action', processedSamples, selfAccuracy ?? 100, '', true, teacherNotes, true, 'camera', classes);
      if (trainerRef.current?.isTrained()) {
        setUploadProgress('Đang lưu mô hình AI...');
        const blobs = await trainerRef.current.saveToBlobs();
        if (blobs && isCloudinaryConfigured()) {
          const { modelJsonUrl } = await uploadModelToCloudinary(blobs.jsonBlob, blobs.weightsBlob, 'teach-action');
          if (modelJsonUrl && response?.model?.id) { await api.updateModelArtifacts(response.model.id, { algorithm: 'neural_network', modelArtifactUrl: modelJsonUrl, testScore: selfAccuracy ?? 100 }); }
        }
      }
      setSubmitSuccess(true); setUploadProgress(''); playSuccessSound(); speakEnglish('Template saved successfully!');
    } catch (err) { console.error('Submit failed:', err); setUploadProgress(''); showToast('❌ Lưu thất bại.'); }
    finally { setIsSubmitting(false); }
  };

  // ── Sample counts (chỉ tính ảnh hợp lệ, không tính ảnh sai nhãn) ──
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    classes.forEach((c) => { counts[c.id] = samples.filter((s) => s.isValid !== false && !s.isQuestionable && s.sourceId === c.id).length; });
    return counts;
  }, [classes, samples]);

  // ═══════════════════════════════════════════════════════
  // ═══ RENDER ════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-[1600px] w-[98%] mx-auto space-y-8">
        {/* ── HEADER ── */}
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/teacher/training')} className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-slate-500 hover:text-violet-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-violet-900 tracking-tight flex items-center gap-3">
              <Sparkles className="w-10 h-10 text-violet-500" />
              Gán Nhãn Bằng Hành Động
            </h1>
            <p className="text-lg text-slate-600 font-medium mt-2">
              Tạo nhãn tùy ý, dùng cử chỉ tay để gán — AI học liên kết hành động với nhãn.
            </p>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ══ LEFT: Label Management & Sample Gallery ══ */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-violet-100 flex flex-col">
            {/* Quick Presets & Flexible Classification */}
            <div className="mb-4 bg-slate-50 border-2 border-dashed border-violet-200 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-black text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Gợi ý mẫu nhanh 1-Click (hoặc tự do tạo 3 nhãn tùy ý)
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                Tự do tùy biến bất kỳ 3 nhãn nào. AI hỗ trợ đối soát cử chỉ & hình ảnh thông minh!
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('agri-doctor')}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center gap-1"
                  title="Plant_Village + Pest_Dataset: Lá Khỏe, Lá Bệnh, Bọ Cánh Cứng"
                >
                  🌿 Bác sĩ Nông nghiệp (3 nhãn)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('animal-world')}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center gap-1"
                  title="Cats_And_Dogs + Pest_Dataset: Chó, Mèo, Bọ Cánh Cứng"
                >
                  🐾 Thế giới Động vật (3 nhãn)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('fruit-garden')}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center gap-1"
                  title="Fruit_Classification_10_Class: Táo, Chuối, Cam"
                >
                  🍎 Vườn Trái Cây (3 nhãn)
                </button>
              </div>
            </div>

            {/* Add new label */}
            <div className="mb-4 space-y-2">
              <div className="flex gap-2">
                <input type="text" value={newLabelInput} onChange={(e) => setNewLabelInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addClass()} placeholder="Tên nhãn (VD: Chó)" className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:border-violet-500 transition-colors" />
                <input type="text" value={newEmojiInput} onChange={(e) => setNewEmojiInput(e.target.value)} className="w-14 bg-slate-50 border-2 border-slate-200 rounded-xl px-2 py-2.5 text-center text-lg focus:outline-none focus:border-violet-500 transition-colors" placeholder="🐶" />
                <button onClick={addClass} disabled={!newLabelInput.trim() || classes.length >= MAX_CLASSES} className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Thêm
                </button>
              </div>
              {classes.length === 0 && (
                <p className="text-xs text-slate-400 font-semibold italic">
                  💡 Thêm nhãn, rồi làm cử chỉ trước camera để AI học (VD: giơ tay trái = &quot;Chó 🐶&quot;, giơ tay phải = &quot;Mèo 🐱&quot;)
                </p>
              )}
            </div>

            {/* Class list */}
            <div className="flex flex-col gap-3 mb-4">
              {classes.map((c) => {
                const count = classCounts[c.id] || 0;
                const gestureCount = samples.filter((s) => s.sourceId === c.id && s.sourceType === 'gesture' && s.isValid !== false && !s.isQuestionable).length;
                const objectCount = samples.filter((s) => s.sourceId === c.id && s.sourceType === 'object' && s.isValid !== false && !s.isQuestionable).length;
                const isActive = activeClass === c.id;
                const hasBoth = gestureCount > 0 && objectCount > 0;
                const progress = Math.min(100, (gestureCount > 0 ? 50 : 0) + (objectCount > 0 ? 50 : 0));
                return (
                  <button key={c.id} onClick={() => { playClickSound(); setActiveClass(c.id); }}
                    className={`relative overflow-hidden p-4 rounded-2xl border-4 transition-all text-left group ${isActive ? 'border-violet-500 bg-violet-50 shadow-md scale-105 z-10' : 'border-slate-100 bg-white hover:border-violet-200'}`}
                  >
                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <div className={`font-extrabold text-lg ${isActive ? 'text-violet-800' : 'text-slate-600'}`}>{c.emoji} {c.label}</div>
                        <div className="text-xs font-bold flex items-center gap-1.5 mt-0.5 text-slate-500">
                          <span>🎬 {gestureCount} cử chỉ</span>
                          <span>•</span>
                          <span>🖼️ {objectCount} sự vật</span>
                          {hasBoth ? (
                            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                              ✅ Sẵn sàng
                            </span>
                          ) : gestureCount > 0 ? (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                              ⚠️ Thiếu sự vật
                            </span>
                          ) : objectCount > 0 ? (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                              ⚠️ Thiếu cử chỉ
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                              Chưa có dữ liệu
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {count > 0 && (<div onClick={(e) => { e.stopPropagation(); clearClassSamples(c.id); }} className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer" title="Xóa mẫu"><Trash2 className="w-4 h-4" /></div>)}
                        <div onClick={(e) => { e.stopPropagation(); if (confirm(`Xóa nhãn "${c.label}"?`)) removeClass(c.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer" title="Xóa nhãn"><X className="w-4 h-4" /></div>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1.5 bg-violet-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </button>
                );
              })}
            </div>

            {/* Split Data Collection UI (2 Bộ Dữ Liệu Đối Ứng) */}
            {activeClass && (
              <div className="flex flex-col gap-4 mb-4 mt-2">
                {/* ── BỘ 1: VIDEO / CỬ CHỈ HÀNH ĐỘNG ── */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border-2 border-emerald-300 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="font-black text-emerald-950 text-sm flex items-center gap-2">
                      <span className="bg-emerald-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-sm">1</span>
                      🎬 BỘ 1: VIDEO / CỬ CHỈ HÀNH ĐỘNG
                    </h4>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'gesture' && s.isValid !== false && !s.isQuestionable).length} frames
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 mb-3 font-medium leading-relaxed">
                    AI học nhận diện hành động từ video tải lên, clip quay trực tiếp hoặc camera.
                  </p>

                  {/* Duration Selector & Motion Flipbook Trigger */}
                  <div className="flex items-center justify-between gap-2 mb-3 bg-white/80 p-2 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Thời lượng quay:</span>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-100/70 p-0.5 rounded-lg">
                      <button
                        onClick={() => setRecordingDurationSec(5)}
                        disabled={videoRecordingState !== 'idle'}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all ${
                          recordingDurationSec === 5
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-emerald-800 hover:bg-emerald-200/60'
                        }`}
                        title="Quay 5 giây - Bắt nhanh khoảng 30-40 khung hình cử chỉ"
                      >
                        5s (Nhanh)
                      </button>
                      <button
                        onClick={() => setRecordingDurationSec(10)}
                        disabled={videoRecordingState !== 'idle'}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all ${
                          recordingDurationSec === 10
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-emerald-800 hover:bg-emerald-200/60'
                        }`}
                        title="Quay 10 giây - Bắt chuyển động dài, đầy đủ các giai đoạn cử chỉ"
                      >
                        10s (Đầy đủ)
                      </button>
                    </div>
                  </div>

                  {/* Hidden inputs */}
                  <input ref={fileInputVideoRef} type="file" accept="video/*,video/mp4,video/webm,video/quicktime" onChange={handleVideoUpload} className="hidden" />
                  <input ref={fileInputGestureRef} type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e, 'gesture')} className="hidden" />

                  {/* Action Buttons Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={startLiveVideoRecording}
                      disabled={modelStatus !== 'ready' || videoRecordingState !== 'idle'}
                      className="font-black py-2.5 px-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 active:scale-95 text-white disabled:bg-gray-300 disabled:text-gray-500"
                      title={`Đếm ngược 3s rồi quay ${recordingDurationSec}s liên tục với tần suất 8 FPS`}
                    >
                      <Film className="w-4 h-4 text-white" />
                      {videoRecordingState === 'countdown'
                        ? `Chờ ${countdownSec}s...`
                        : videoRecordingState === 'recording'
                        ? `Đang quay (${recordingSecLeft}s)`
                        : `Quay Video (${recordingDurationSec}s)`}
                    </button>

                    <button
                      onClick={() => fileInputVideoRef.current?.click()}
                      disabled={modelStatus !== 'ready' || isExtractingVideo || videoRecordingState !== 'idle'}
                      className="font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs border-2 bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-800 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400"
                      title="Tải video MP4/WebM từ máy tính để tự động cắt 8 khung hình"
                    >
                      {isExtractingVideo ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Video className="w-4 h-4 text-emerald-700" />
                      )}
                      <span>{isExtractingVideo ? 'Đang cắt...' : 'Tải Video lên'}</span>
                    </button>

                    <button
                      onClick={() => fileInputGestureRef.current?.click()}
                      disabled={modelStatus !== 'ready' || videoRecordingState !== 'idle'}
                      className="font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs border-2 bg-white hover:bg-emerald-100 border-emerald-200 text-emerald-700 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400"
                      title="Tải ảnh cử chỉ từ máy tính"
                    >
                      <ImagePlus className="w-4 h-4" /> Tải ảnh lên
                    </button>

                    <button
                      onPointerDown={() => startCapturing('gesture')}
                      onPointerUp={stopCapturing}
                      onPointerLeave={stopCapturing}
                      disabled={modelStatus !== 'ready' || videoRecordingState !== 'idle'}
                      className={`font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs active:scale-95 disabled:bg-gray-300 select-none ${capturingType === 'gesture' ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                      title="Nhấn giữ để chụp ảnh cử chỉ liên tục từ camera"
                    >
                      <Camera className="w-4 h-4" />
                      {capturingType === 'gesture' ? 'ĐANG CHỤP...' : 'Giữ chụp ảnh'}
                    </button>
                  </div>

                  {/* Motion Sequence Flipbook Viewer Button */}
                  {samples.some((s) => s.sourceId === activeClass && s.sourceType === 'gesture') && (
                    <button
                      onClick={() => {
                        setMotionPlayerIdx(0);
                        setIsMotionPlaying(true);
                        setShowMotionPlayer(true);
                      }}
                      className="w-full mb-3 py-2 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
                      title="Xem lại chuỗi chuyển động mượt mà liên tục (8 FPS) như một đoạn clip ngắn"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-700 fill-emerald-700" />
                      <span>
                        ▶️ Xem chuỗi chuyển động ({samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'gesture').length} frames mượt)
                      </span>
                    </button>
                  )}

                  <SampleGallery
                    samples={samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'gesture')}
                    onDeleteSample={(id) => { setSamples((prev) => prev.filter((s) => s.id !== id)); setIsTrained(false); }}
                    onClearAll={() => clearClassSamples(activeClass, 'gesture')}
                    isTrained={isTrained}
                  />
                </div>

                {/* ── BỘ 2: HÌNH ẢNH SỰ VẬT TƯƠNG ĐƯƠNG ── */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border-2 border-amber-300 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="font-black text-amber-950 text-sm flex items-center gap-2">
                      <span className="bg-amber-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-sm">2</span>
                      🖼️ BỘ 2: HÌNH ẢNH SỰ VẬT TƯƠNG ĐƯƠNG
                    </h4>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'object' && s.isValid !== false && !s.isQuestionable).length} ảnh
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800/80 mb-3 font-medium leading-relaxed">
                    Hình ảnh sự vật sẽ hiển thị khi bạn làm đúng hành động ở Bộ 1!
                  </p>

                  <div className="flex gap-2 mb-3">
                    <input ref={fileInputObjectRef} type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e, 'object')} className="hidden" />
                    <button
                      onClick={() => fileInputObjectRef.current?.click()}
                      disabled={modelStatus !== 'ready' || videoRecordingState !== 'idle'}
                      className="flex-1 font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs border-2 bg-white hover:bg-amber-100 border-amber-300 text-amber-800 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <ImagePlus className="w-4 h-4" /> Tải ảnh lên
                    </button>
                    <button
                      onPointerDown={() => startCapturing('object')}
                      onPointerUp={stopCapturing}
                      onPointerLeave={stopCapturing}
                      disabled={modelStatus !== 'ready' || videoRecordingState !== 'idle'}
                      className={`flex-1 font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs active:scale-95 disabled:bg-gray-300 select-none ${capturingType === 'object' ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                    >
                      <Camera className="w-4 h-4" />
                      {capturingType === 'object' ? 'ĐANG CHỤP...' : 'Giữ chụp ảnh'}
                    </button>
                  </div>

                  <SampleGallery
                    samples={samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'object')}
                    onDeleteSample={(id) => { setSamples((prev) => prev.filter((s) => s.id !== id)); setIsTrained(false); }}
                    onClearAll={() => clearClassSamples(activeClass, 'object')}
                    isTrained={isTrained}
                  />
                </div>
              </div>
            )}

            {/* Toast */}
            {validationToast && (
              <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-2xl text-sm font-bold text-yellow-700 flex items-center gap-2 animate-bounce shadow-lg">
                <span className="text-xl">⚠️</span><span>{validationToast}</span>
              </div>
            )}

            {/* Train + Submit */}
            <div className="mt-auto pt-4 space-y-2">
              <button onClick={() => setShowSettings(!showSettings)} className="w-full text-xs font-bold text-slate-400 hover:text-violet-600 flex items-center justify-center gap-1 py-1 transition-colors">
                <Settings className="w-3.5 h-3.5" /> {showSettings ? 'Ẩn cài đặt ▲' : 'Cài đặt nâng cao ▼'}
              </button>

              {showSettings && (
                <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 space-y-3 text-xs">
                  <h4 className="font-black text-slate-700 text-sm flex items-center gap-1.5">⚙️ Under the Hood</h4>
                  <div><div className="flex justify-between mb-1"><span className="font-bold text-slate-600">Epochs</span><span className="font-black text-violet-700">{hpEpochs}</span></div><input type="range" min={10} max={200} step={10} value={hpEpochs} onChange={(e) => setHpEpochs(Number(e.target.value))} className="w-full accent-violet-500" /></div>
                  <div><div className="flex justify-between mb-1"><span className="font-bold text-slate-600">Batch Size</span><span className="font-black text-violet-700">{hpBatchSize}</span></div><input type="range" min={8} max={128} step={8} value={hpBatchSize} onChange={(e) => setHpBatchSize(Number(e.target.value))} className="w-full accent-violet-500" /></div>
                  <div><div className="flex justify-between mb-1"><span className="font-bold text-slate-600">Learning Rate</span><span className="font-black text-violet-700">{hpLearningRate}</span></div><input type="range" min={0.0001} max={0.01} step={0.0001} value={hpLearningRate} onChange={(e) => setHpLearningRate(Number(e.target.value))} className="w-full accent-violet-500" /></div>
                </div>
              )}

              {isTraining ? (
                <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-violet-700">AI đang học cử chỉ... ⚙️</span>
                    <span className="text-xs font-black text-violet-800">{trainingProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-violet-600 h-full transition-all duration-150" style={{ width: `${trainingProgress}%` }} />
                  </div>
                  {trainingLogs.length > 0 && (
                    <div className="flex gap-4 mt-2 text-[10px] font-bold text-violet-600">
                      <span>Loss: {trainingLogs[trainingLogs.length - 1].loss.toFixed(4)}</span>
                      <span>Acc: {(trainingLogs[trainingLogs.length - 1].acc * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={handleTrain} disabled={!canTrain}
                    className={`w-full font-extrabold py-3.5 px-6 rounded-2xl shadow-lg border-b-4 flex items-center justify-center gap-2 text-lg transition-all ${canTrain ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white' : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'}`}
                  >
                    <Brain className="w-6 h-6" /> {isTrained ? 'HUẤN LUYỆN LẠI 🔄' : 'DẠY AI HỌC 🚀'}
                  </button>
                  {isTrained && (
                    <button onClick={handleOpenSubmit} className="w-full font-extrabold py-3 px-6 rounded-2xl shadow-md border-b-4 bg-purple-500 hover:bg-purple-600 border-purple-700 text-white flex items-center justify-center gap-2 text-base transition-all">
                      <Save className="w-5 h-5" /> LƯU & XUẤT BẢN TEMPLATE
                    </button>
                  )}
                  {isTrained && (
                    <button onClick={async () => { try { const blobs = await trainerRef.current?.saveToBlobs(); if (!blobs) return; const jsonUrl = URL.createObjectURL(blobs.jsonBlob); const a1 = document.createElement('a'); a1.href = jsonUrl; a1.download = 'model.json'; a1.click(); URL.revokeObjectURL(jsonUrl); const weightsUrl = URL.createObjectURL(blobs.weightsBlob); const a2 = document.createElement('a'); a2.href = weightsUrl; a2.download = 'weights.bin'; a2.click(); URL.revokeObjectURL(weightsUrl); showToast('✅ Đã tải model!'); } catch { showToast('❌ Không thể export.'); } }}
                      className="w-full font-bold py-2.5 px-4 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-2 text-sm transition-all"
                    >
                      <Download className="w-4 h-4" /> Tải Model về máy (TF.js)
                    </button>
                  )}
                </>
              )}

              {!canTrain && classes.length > 0 && (
                <p className="text-xs text-center text-slate-400 font-semibold">
                  {classes.length < 2 ? '📌 Cần ít nhất 2 nhãn' : `📌 Cần ít nhất ${MIN_SAMPLES_PER_CLASS} mẫu cho mỗi nhãn (nên có cả cử chỉ và ảnh sự vật)`}
                </p>
              )}
            </div>
          </div>

          {/* ══ CENTER + RIGHT: Camera & Prediction ══ */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Camera View with Video Recording Overlays */}
            <div className="bg-white rounded-3xl p-6 border-4 border-violet-400 shadow-xl relative flex flex-col items-center overflow-hidden">
              <CameraView videoRef={videoRef} canvasRef={canvasRef} modelStatus={modelStatus} cameraError={cameraError} loadingText="ĐANG TẢI AI NHẬN DIỆN CỬ CHỈ..." theme="blue" onRetry={retryCamera} />
              
              {modelStatus === 'ready' && videoRecordingState === 'idle' && (
                <div className="absolute top-8 right-8 flex items-center gap-2 z-10">
                  {isTrained && predictionActive ? (
                    <div className="bg-red-600 text-white text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-pulse border-2 border-white/60">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                      <span>🔴 LIVE: Đang nhận diện cử chỉ</span>
                    </div>
                  ) : (
                    <div className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> MobileNet sẵn sàng
                    </div>
                  )}
                </div>
              )}

              {/* 3s COUNTDOWN OVERLAY */}
              {videoRecordingState === 'countdown' && (
                <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in duration-200">
                  <div className="text-sm md:text-base font-bold uppercase tracking-wider text-amber-300 mb-2 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
                    Chuẩn bị thực hiện hành động: {classes.find((c) => c.id === activeClass)?.emoji} {classes.find((c) => c.id === activeClass)?.label}
                  </div>
                  <div className="text-8xl md:text-9xl font-black text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] scale-110 animate-pulse">
                    {countdownSec}
                  </div>
                  <p className="text-xs md:text-sm font-semibold text-slate-300 mt-4 bg-white/10 px-5 py-2 rounded-full border border-white/20">
                    Sẵn sàng trước camera (Bắt đầu quay sau {countdownSec} giây)
                  </p>
                </div>
              )}

              {/* MOTION RECORDING OVERLAY (TEACHABLE MACHINE STYLE) */}
              {videoRecordingState === 'recording' && (
                <>
                  {/* Top Bar: Recording Badge & Early Finish Button */}
                  <div className="absolute top-6 left-6 right-6 z-30 flex items-center justify-between pointer-events-auto">
                    <div className="flex items-center gap-2 bg-red-600/95 backdrop-blur-md text-white px-4 py-2 rounded-full font-black text-xs md:text-sm shadow-2xl animate-pulse border-2 border-white/40">
                      <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                      <span>ĐANG THU CHUYỂN ĐỘNG ({recordingSecLeft}s)</span>
                    </div>

                    <button
                      onClick={() => finishRecordingEarlyRef.current?.()}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-full font-black text-xs md:text-sm shadow-2xl border-2 border-white/40 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Hoàn thành sớm cử chỉ mà không cần chờ hết thời gian"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Hoàn thành & Cắt ngay ⏹️</span>
                    </button>
                  </div>

                  {/* Bottom Bar: Time Progress & Frame Counter */}
                  <div className="absolute bottom-6 left-6 right-6 z-30">
                    <div className="bg-black/85 backdrop-blur-md p-4 rounded-2xl border border-white/30 shadow-2xl space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-black text-white">
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <Film className="w-4 h-4 text-amber-400" />
                          <span>Đang quay hành động: <strong>{recordingSecLeft}s</strong> còn lại ({recordingDurationSec}s)</span>
                        </span>
                        <span className="text-amber-300 font-mono text-xs font-extrabold bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
                          📸 {recordedFramesCount} frames (@ 8 FPS)
                        </span>
                      </div>

                      {/* Time Progress Bar */}
                      <div>
                        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 h-full transition-all duration-100 rounded-full"
                            style={{ width: `${recordingProgress}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-300 mt-1.5">
                          <span>Tiến độ ghi hình</span>
                          <span className="text-amber-300 font-mono font-bold">{Math.round(recordingProgress)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* PROCESSING OVERLAY */}
              {videoRecordingState === 'processing' && (
                <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                  <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
                  <div className="text-base font-black text-white">Đang cắt frame và trích xuất đặc trưng AI...</div>
                  <p className="text-xs text-slate-300 mt-1">Đang nạp khung hình vào Bộ 1</p>
                </div>
              )}
            </div>

            {/* ══ MINI PLAYGROUND ══ */}
            {isTrained && predictionActive && (
              <div className="bg-gradient-to-r from-violet-900 to-purple-900 text-white rounded-3xl p-6 shadow-xl border-4 border-violet-400">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-black text-sm text-violet-300 tracking-widest uppercase flex items-center gap-2">
                    🎭 Playground — Thử Cử Chỉ Realtime
                  </h4>
                  <button
                    onClick={() => {
                      setPredictionActive(false);
                      playClickSound();
                    }}
                    className="text-xs font-bold bg-white/10 hover:bg-red-500/80 text-violet-200 hover:text-white px-3 py-1.5 rounded-xl border border-white/20 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span>✕</span> Tắt nhận diện
                  </button>
                </div>

                {/* Status indicator bar */}
                <div className="text-[11px] text-violet-200 bg-white/5 px-3 py-2 rounded-xl border border-white/10 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {isDetectedInLibrary ? (
                      <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Đang nhận diện cử chỉ trong Thư viện ảnh
                      </span>
                    ) : (
                      <span className="text-violet-200/80 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-400/60" />
                        AI đang quan sát camera...
                      </span>
                    )}
                  </span>
                  <span className={isDetectedInLibrary ? "text-emerald-400 font-bold flex items-center gap-1.5" : "text-violet-300/70 font-medium flex items-center gap-1.5"}>
                    <span className={`w-2 h-2 rounded-full ${isDetectedInLibrary ? 'bg-emerald-400 animate-pulse' : 'bg-violet-400/40'}`} />
                    {isDetectedInLibrary ? "Khớp cử chỉ" : "Chờ cử chỉ..."}
                  </span>
                </div>

                {/* Main result */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">
                      {isDetectedInLibrary
                        ? (classes.find((c) => c.label === predictedLabel)?.emoji || '🤖')
                        : '💤'}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-violet-300 block">
                        {isDetectedInLibrary ? 'AI nhận ra cử chỉ:' : 'Trạng thái AI:'}
                      </span>
                      <span className={`text-2xl font-black drop-shadow-md ${isDetectedInLibrary ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400' : 'text-violet-300/70'}`}>
                        {isDetectedInLibrary ? predictedLabel : 'Đang quan sát camera...'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl px-4 py-2 border border-white/20 text-center">
                    <span className="text-[10px] font-semibold text-violet-300 uppercase block">Độ Tự Tin</span>
                    <span className="text-2xl font-black">
                      {isDetectedInLibrary ? confidence : 0}
                      <span className="text-sm text-violet-300">%</span>
                    </span>
                  </div>
                </div>

                {/* Confidence bars for all classes — CHỈ HIỆN KHI PHÁT HIỆN CỬ CHỈ TRONG THƯ VIỆN ẢNH */}
                {isDetectedInLibrary ? (
                  <div className="space-y-2 mb-4 animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Thanh năng lượng nhận diện:
                    </div>
                    {classes.map((c) => {
                      const pct = Math.round((confidences[c.label] || 0) * 100);
                      const isTop = c.label === predictedLabel && confidence >= 60;
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <span className="text-lg w-7 text-center shrink-0">{c.emoji}</span>
                          <span className={`text-xs font-bold w-20 truncate ${isTop ? 'text-white font-extrabold' : 'text-violet-300'}`}>{c.label}</span>
                          <div className="flex-1 bg-white/10 rounded-full h-5 overflow-hidden relative">
                            <div className={`h-full rounded-full transition-all duration-300 ${isTop ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-violet-400/30'}`} style={{ width: `${Math.max(2, pct)}%` }} />
                            <span className={`absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-black ${pct > 50 ? 'text-white' : 'text-violet-200'}`}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-2xl p-4 mb-4 border border-dashed border-white/20 text-center">
                    <p className="text-xs font-bold text-violet-200 leading-relaxed">
                      AI đang quan sát camera... Hãy làm một trong các cử chỉ đã dạy ({classes.map((c) => `${c.emoji} ${c.label}`).join(', ')}) để kích hoạt nhận diện! 🎭
                    </p>
                  </div>
                )}

                {/* 🌟 EQUIVALENT OBJECT IMAGE DISPLAY (KẾT HỢP ĐỐI ỨNG HÀNH ĐỘNG -> HÌNH ẢNH) */}
                {isDetectedInLibrary && (() => {
                  const isMatchingActive = confidence >= 60 && classes.some((c) => c.label === predictedLabel);
                  if (!isMatchingActive) return null;

                  const matchedObjectSamples = samples.filter((s) => s.label === predictedLabel && s.sourceType === 'object');
                  const activeEmoji = classes.find((c) => c.label === predictedLabel)?.emoji || '🎯';

                  if (matchedObjectSamples.length > 0) {
                    const heroImage = matchedObjectSamples[0];
                    return (
                      <div className="bg-gradient-to-b from-amber-500/20 via-purple-900/40 to-black/40 rounded-3xl p-5 mb-4 border-2 border-amber-400 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            HÌNH ẢNH SỰ VẬT TƯƠNG ĐƯƠNG BÊN BỘ 2:
                          </span>
                          <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow">
                            ✅ Khớp hành động: {activeEmoji} {predictedLabel}
                          </span>
                        </div>

                        {/* Hero Image Showcase */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/20">
                          <div className="w-48 h-48 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-4 border-amber-300 shadow-2xl shrink-0 bg-black group relative">
                            <img src={heroImage.thumbnail} alt={predictedLabel} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md rounded-lg py-0.5 px-2 text-center text-[10px] font-bold text-amber-300">
                              {activeEmoji} {predictedLabel}
                            </div>
                          </div>

                          <div className="flex-1 space-y-2 text-center sm:text-left">
                            <h5 className="font-black text-xl text-amber-300 flex items-center justify-center sm:justify-start gap-2">
                              <span>{activeEmoji}</span> {predictedLabel}
                            </h5>
                            <p className="text-xs text-violet-200 leading-relaxed font-medium">
                              Khi bạn làm hành động <strong className="text-white">&quot;{predictedLabel}&quot;</strong> trước camera, hệ thống lập tức hiển thị hình ảnh sự vật tương đương này!
                            </p>
                            {matchedObjectSamples.length > 1 && (
                              <div className="pt-2">
                                <span className="text-[11px] font-bold text-violet-300 block mb-1.5">Các ảnh sự vật khác của nhãn này ({matchedObjectSamples.length} ảnh):</span>
                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                  {matchedObjectSamples.map((s, idx) => (
                                    <div key={s.id} className="w-12 h-12 shrink-0 rounded-xl overflow-hidden border-2 border-white/40 shadow-sm bg-black">
                                      <img src={s.thumbnail} alt={`${predictedLabel} ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-white/10 rounded-2xl p-4 mb-4 border border-dashed border-amber-300/40 text-center">
                      <p className="text-xs font-bold text-amber-300">
                        💡 Nhãn &quot;{activeEmoji} {predictedLabel}&quot; chưa có hình ảnh sự vật tương đương ở Bộ 2.
                      </p>
                      <p className="text-[11px] text-violet-300 mt-1">
                        Hãy nạp ảnh vào &quot;Bộ 2: Hình ảnh sự vật tương đương&quot; để AI hiển thị khi bạn làm hành động này!
                      </p>
                    </div>
                  );
                })()}

                {/* Sliding indicator */}
                {isDetectedInLibrary && classes.length >= 2 && (
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10 animate-in fade-in">
                    <div className="flex items-center justify-between text-sm mb-2">
                      {classes.map((c) => (
                        <span key={c.id} className={`font-bold ${c.label === predictedLabel && confidence >= 60 ? 'text-amber-300' : 'text-violet-400'}`}>
                          {c.emoji} {c.label}
                        </span>
                      ))}
                    </div>
                    <div className="relative h-3 bg-white/10 rounded-full">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-lg border-2 border-white transition-all duration-300"
                        style={{
                          left: `${(() => {
                            const topIdx = classes.findIndex((c) => c.label === predictedLabel);
                            if (topIdx < 0 || classes.length < 2 || confidence < 60) return 50;
                            return (topIdx / (classes.length - 1)) * 100;
                          })()}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prediction toggle (when not active) */}
            {isTrained && !predictionActive && (
              <div className="bg-gradient-to-r from-violet-900 to-purple-900 text-white rounded-3xl p-6 shadow-xl border-4 border-violet-400">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-sm text-amber-300 tracking-wider uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Thử nghiệm cử chỉ Realtime:
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 px-3 py-0.5 rounded-full">
                    ✅ Mô hình đã sẵn sàng
                  </span>
                </div>
                <p className="text-xs text-violet-200 mb-4 leading-relaxed font-medium">
                  Chỉ bật nhận diện khi bạn cần thử. AI sẽ nhận diện khi bạn làm đúng cử chỉ đã dạy, và tự động tắt nếu nằm ngoài bộ dữ liệu.
                </p>
                <button
                  onClick={() => {
                    setPredictedLabel('Đang chờ cử chỉ... 💤');
                    setConfidence(0);
                    setConfidences({});
                    setIsDetectedInLibrary(false);
                    isDetectedRef.current = false;
                    activeStreakRef.current = 0;
                    idleStreakRef.current = 0;
                    lastActiveTimeRef.current = Date.now();
                    setPredictionActive(true);
                    playSuccessSound();
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-base transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 active:scale-95"
                >
                  <Camera className="w-6 h-6 text-slate-950" />
                  <span>Bật nhận diện Camera 🎭</span>
                </button>
              </div>
            )}

            {/* Not trained message */}
            {!isTrained && (
              <div className="bg-gradient-to-r from-violet-900 to-purple-900 text-white rounded-3xl p-6 shadow-xl border-4 border-violet-400">
                <h4 className="font-extrabold text-[11px] text-violet-300 tracking-widest uppercase mb-3">Nhận diện cử chỉ:</h4>
                <div className="flex items-center gap-4 opacity-50 py-2">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Brain className="w-5 h-5" /></div>
                  <p className="font-bold text-sm">Thêm nhãn, làm cử chỉ, rồi huấn luyện để AI nhận diện! 🎭✨</p>
                </div>
              </div>
            )}

            {/* Upload predict */}
            {isTrained && (
              <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-amber-200">
                <h4 className="font-black text-lg text-amber-900 mb-3 flex items-center gap-2">
                  <ImagePlus className="w-5 h-5 text-amber-600" /> Thử Bằng Ảnh Upload
                </h4>
                <p className="text-xs text-slate-500 mb-3">Tải ảnh cử chỉ từ máy tính để AI dự đoán.</p>
                <input ref={predictFileRef} type="file" accept="image/*" onChange={handlePredictUpload} className="hidden" />
                <button onClick={() => predictFileRef.current?.click()} disabled={isPredicting}
                  className="w-full font-bold py-3 px-4 rounded-2xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
                >
                  {isPredicting ? (<><div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />Đang phân tích...</>) : (<><ImagePlus className="w-4 h-4" />Tải ảnh lên để dự đoán</>)}
                </button>
                {predictImage && predictResult && (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-4 items-start">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-slate-200 shrink-0"><img src={predictImage} alt="Predict" className="w-full h-full object-cover" /></div>
                      <div className="flex-1">
                        {predictResult.isOOD ? (
                          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                            <p className="font-bold text-red-700 text-sm flex items-center gap-1.5">
                              🚫 Không nhận diện được (Ảnh lạ)
                            </p>
                            <p className="text-[11px] text-red-600 mt-1 font-medium leading-relaxed">
                              {predictResult.reason || 'Ảnh không thuộc bất kỳ nhãn nào trong Thư viện ảnh hoặc bộ dữ liệu đã dạy.'}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                            <p className="text-xs text-slate-500 font-semibold">AI đoán:</p>
                            <p className="font-black text-xl text-emerald-800 flex items-center gap-2">{classes.find((c) => c.label === predictResult.label)?.emoji || '🤖'} {predictResult.label}</p>
                            <p className="text-sm font-bold text-emerald-600 mt-1">Độ tự tin: {predictResult.confidence}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {!predictResult.isOOD && Object.keys(predictResult.confidences).length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                        {classes.map((c) => {
                          const pct = Math.round((predictResult.confidences[c.label] || 0) * 100);
                          const isTop = c.label === predictResult.label && !predictResult.isOOD;
                          return (<div key={c.id} className="flex items-center gap-2"><span className="text-sm w-6 text-center">{c.emoji}</span><span className="text-[11px] font-bold w-14 truncate text-slate-600">{c.label}</span><div className="flex-1 bg-slate-200 rounded-full h-4 overflow-hidden relative"><div className={`h-full rounded-full transition-all ${isTop ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ width: `${Math.max(2, pct)}%` }} /><span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-black text-slate-600">{pct}%</span></div></div>);
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ SUBMIT MODAL ═══ */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border-4 border-white">
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6 text-white relative">
              <button onClick={() => !isSubmitting && !submitSuccess && setShowSubmitModal(false)} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors" disabled={isSubmitting || submitSuccess}><X className="w-6 h-6" /></button>
              <h2 className="text-2xl font-black flex items-center gap-2"><Save className="w-7 h-7" /> Lưu Template Gán Nhãn Hành Động</h2>
              <p className="text-violet-100 mt-2 font-medium">Các nhãn: {classes.map((c) => `${c.emoji} ${c.label}`).join(', ')}</p>
            </div>
            <div className="p-6 space-y-6">
              {!submitSuccess ? (
                <>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-500 font-semibold">Số nhãn:</span><span className="font-black text-slate-800 ml-2">{classes.length}</span></div>
                      <div><span className="text-slate-500 font-semibold">Tổng mẫu hợp lệ:</span><span className="font-black text-slate-800 ml-2">{samples.filter((s) => s.isValid !== false && !s.isQuestionable).length}</span></div>
                      {selfAccuracy !== null && (<div className="col-span-2"><span className="text-slate-500 font-semibold">Độ chính xác:</span><span className={`font-black ml-2 ${selfAccuracy >= 80 ? 'text-emerald-600' : selfAccuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{selfAccuracy}%</span></div>)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Lời nhắn cho học sinh</label>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 font-medium text-slate-700 focus:outline-none focus:border-violet-400 transition-colors resize-none" rows={3} value={teacherNotes} onChange={(e) => setTeacherNotes(e.target.value)} placeholder="VD: Hãy thử làm cử chỉ khác nhau nhé!" />
                  </div>
                  <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-4 rounded-xl font-extrabold text-lg text-white bg-violet-600 hover:bg-violet-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-300">
                    {isSubmitting ? (<><div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />{uploadProgress || 'Đang xử lý...'}</>) : 'Xuất Bản Template 🚀'}
                  </button>
                </>
              ) : (
                <div className="text-center py-8">
                  <span className="text-7xl">🎉🎭</span>
                  <h3 className="text-2xl font-black text-violet-900 mt-4">Đã Lưu Thành Công!</h3>
                  <p className="text-slate-500 font-medium mt-2">Học sinh có thể tìm thấy bài tập này trong phần Sandbox.</p>
                  <button onClick={() => router.push('/teacher/templates')} className="mt-6 font-bold text-violet-600 hover:text-violet-800">Xem thư viện template →</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ POPUP XEM CHUỖI CHUYỂN ĐỘNG (MOTION FLIPBOOK PLAYER) ══ */}
      {showMotionPlayer && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-white/10 rounded-2xl">
                  {classes.find((c) => c.id === activeClass)?.emoji || '🎬'}
                </span>
                <div>
                  <h3 className="font-black text-lg text-emerald-400 flex items-center gap-2">
                    Chuỗi Chuyển Động: {classes.find((c) => c.id === activeClass)?.label}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Phát lại liên tục các frame chuyển động AI đã bắt được ở tần suất 8 FPS
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMotionPlayer(false);
                  setIsMotionPlaying(false);
                }}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                title="Đóng xem trước"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const gestureList = samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'gesture');
              if (gestureList.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    Chưa có frame cử chỉ nào cho nhãn này. Hãy quay video để bắt chuyển động!
                  </div>
                );
              }
              const currentFrame = gestureList[Math.min(motionPlayerIdx, gestureList.length - 1)];

              return (
                <div className="space-y-4">
                  {/* Main Video-like Frame Screen */}
                  <div className="relative aspect-[4/3] max-h-[360px] w-full bg-black rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center shadow-inner">
                    {currentFrame && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentFrame.thumbnail || currentFrame.rawThumbnail}
                        alt={`Khung hình ${motionPlayerIdx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    )}

                    {/* Frame Counter Tag */}
                    <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-emerald-400 border border-emerald-500/30 font-bold">
                      Frame {motionPlayerIdx + 1} / {gestureList.length}
                    </div>

                    {/* 8 FPS Live Tag */}
                    {isMotionPlaying && (
                      <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-white flex items-center gap-1.5 animate-pulse border border-white/20">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        <span>Đang phát 8 FPS</span>
                      </div>
                    )}
                  </div>

                  {/* Timeline Scrubber */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={gestureList.length - 1}
                      value={motionPlayerIdx}
                      onChange={(e) => {
                        setIsMotionPlaying(false);
                        setMotionPlayerIdx(Number(e.target.value));
                      }}
                      className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>0.0s (Bắt đầu)</span>
                      <span className="text-emerald-400 font-bold">Frame {motionPlayerIdx + 1}</span>
                      <span>{(gestureList.length * 0.12).toFixed(1)}s (Kết thúc)</span>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      onClick={() => {
                        setIsMotionPlaying(false);
                        setMotionPlayerIdx(0);
                      }}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Về frame đầu tiên"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setIsMotionPlaying(false);
                        setMotionPlayerIdx((prev) => (prev > 0 ? prev - 1 : gestureList.length - 1));
                      }}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Frame trước"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => setIsMotionPlaying(!isMotionPlaying)}
                      className={`px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                        isMotionPlaying
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isMotionPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-white" /> Tạm dừng
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" /> Phát chuyển động (8 FPS)
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setIsMotionPlaying(false);
                        setMotionPlayerIdx((prev) => (prev + 1) % gestureList.length);
                      }}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Frame tiếp theo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Filmstrip Strip */}
                  <div className="flex gap-1.5 overflow-x-auto p-2 bg-slate-950/70 rounded-2xl border border-white/10 scrollbar-thin">
                    {gestureList.map((f, idx) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setIsMotionPlaying(false);
                          setMotionPlayerIdx(idx);
                        }}
                        className={`relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                          idx === motionPlayerIdx
                            ? 'border-emerald-400 scale-105 shadow-md shadow-emerald-500/30'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.thumbnail || f.rawThumbnail} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 bg-black/80 text-[9px] font-mono px-1 text-white font-bold">
                          {idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Trích xuất N khung hình (mặc định 8 frames) rải đều từ file video (MP4, WebM, MOV)
 */
async function extractFramesFromVideoFile(
  file: File | Blob,
  numFrames = 8
): Promise<{ thumbnail: string; canvas: HTMLCanvasElement }[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const frames: { thumbnail: string; canvas: HTMLCanvasElement }[] = [];

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (!duration || isNaN(duration) || duration <= 0) {
          URL.revokeObjectURL(url);
          reject(new Error('Không thể đọc thời lượng video'));
          return;
        }

        const vW = video.videoWidth || 640;
        const vH = video.videoHeight || 480;

        // Bỏ qua 5% đầu và 5% cuối để tránh khung hình đen/chuyển cảnh
        const startTime = duration * 0.05;
        const endTime = duration * 0.95;
        const step = (endTime - startTime) / Math.max(1, numFrames - 1);

        for (let i = 0; i < numFrames; i++) {
          const targetTime = startTime + i * step;

          await new Promise<void>((seekResolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              seekResolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = Math.min(targetTime, duration - 0.05);
          });

          const canvas = document.createElement('canvas');
          canvas.width = vW;
          canvas.height = vH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, vW, vH);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            frames.push({ thumbnail, canvas });
          }
        }

        URL.revokeObjectURL(url);
        resolve(frames);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Lỗi giải mã file video'));
    };
  });
}

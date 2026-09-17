'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Brain,
  HelpCircle,
  Camera,
  Trash2,
  ImagePlus,
  Eye,
  EyeOff,
  Plus,
  X,
  Sparkles,
  Settings,
  Video,
  Film,
  Play,
  Pause,
  Zap,
  Square,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { StoredSample, classifyKNN } from '@/lib/knn-classifier';
import { DatasetResponse, ModelResponse } from '@/types/models';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { useModelEvaluation } from '@/hooks/useModelEvaluation';
import { getStarRatingInfo } from '@/lib/scoring';
import ReportCard from '@/components/journey/ReportCard';
import CameraView from '@/components/CameraView';
import SampleGallery from '@/components/SampleGallery';
import ActionAIFeedbackModal from '@/components/journey/ActionAIFeedbackModal';
import { useCamera } from '@/hooks/useCamera';
import { useMobilenet } from '@/hooks/useMobilenet';
import { TfTrainer } from '@/lib/tf-trainer';
import { assessQuality } from '@/lib/image-quality';
import { checkMisclassification, REFERENCE_CENTROIDS, cosineSimilarity } from '@/lib/reference-embeddings';
import {
  matchLabelToDataset,
  cleanClassLabel,
  TEACHER_DATASET_PRESETS,
} from '@/lib/dataset-label-mapping';
import {
  validateStudentActionWithTeacherTemplate,
  ActionValidationResult,
} from '@/lib/teacher-action-validator';

// ── Constants ──────────────────────────────────────────
const MIN_SAMPLES_PER_CLASS = 3;
const MAX_CLASSES = 10;

const DEFAULT_INITIAL_CLASSES = [
  { id: 'class_action_1', label: 'Chó', emoji: '🐶' },
  { id: 'class_action_2', label: 'Mèo', emoji: '🐱' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StudentTeachActionPage() {
  const router = useRouter();

  // ── Custom Classes ───────────────────────────────────
  const [classes, setClasses] = useState<{ id: string; label: string; emoji: string }[]>(DEFAULT_INITIAL_CLASSES);
  const [activeClass, setActiveClass] = useState<string>('class_action_1');
  const [newLabelInput, setNewLabelInput] = useState('');
  const [newEmojiInput, setNewEmojiInput] = useState('✨');
  const classIdCounterRef = useRef(2);

  // ── Collection Mode Tab per class: Object vs Gesture ──
  const [dataCollectionTab, setDataCollectionTab] = useState<'object' | 'gesture'>('object');

  // ── Template from Teacher ────────────────────────────
  const [teacherTemplate, setTeacherTemplate] = useState<DatasetResponse | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);

  // ── Data Collection ──────────────────────────────────
  const [samples, setSamples] = useState<StoredSample[]>([]);

  // ── Training ─────────────────────────────────────────
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingLogs, setTrainingLogs] = useState<{ epoch: number; loss: number; acc: number }[]>([]);

  // ── Hyperparameters (Under the Hood) ─────────────────
  const [hpEpochs, setHpEpochs] = useState(50);
  const [hpBatchSize, setHpBatchSize] = useState(32);
  const [hpLearningRate, setHpLearningRate] = useState(0.005);
  const [showSettings, setShowSettings] = useState(false);

  // ── Prediction ───────────────────────────────────────
  const [predictedLabel, setPredictedLabel] = useState('Chưa nhận diện... 🤔');
  const [confidence, setConfidence] = useState(0);
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [predictionActive, setPredictionActive] = useState(false);
  const [isDetectedInLibrary, setIsDetectedInLibrary] = useState(false);
  const activeStreakRef = useRef(0);
  const idleStreakRef = useRef(0);
  const lastActiveTimeRef = useRef(0);
  const isDetectedRef = useRef(false);

  // ── Hold-to-Record ───────────────────────────────────
  const [capturingType, setCapturingType] = useState<'gesture' | 'object' | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Video Recording & Motion Tracking (3s countdown + 5s/10s auto record @ 120ms) ──
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

  // ── Motion Sequence Flipbook Player ──────────────────
  const [showMotionPlayer, setShowMotionPlayer] = useState(false);
  const [motionPlayerIdx, setMotionPlayerIdx] = useState(0);
  const [isMotionPlaying, setIsMotionPlaying] = useState(false);
  const motionPlayerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Static Image Test (4-Tier Bulletproof OOD) ───────
  const [predictImage, setPredictImage] = useState<string | null>(null);
  const [predictResult, setPredictResult] = useState<{
    label: string;
    confidence: number;
    confidences: Record<string, number>;
    isOOD: boolean;
    reason?: string;
  } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const predictFileRef = useRef<HTMLInputElement | null>(null);

  // ── Teacher Validation Modal (Sau khi Dạy AI) ────────
  const [validationResult, setValidationResult] = useState<ActionValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // ── Submission & Evaluation ──────────────────────────
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp ảnh rõ nét kết hợp quay cử chỉ đều tay');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [createdModelId, setCreatedModelId] = useState<string | null>(null);

  // ── View Teacher Samples ─────────────────────────────
  const [showTeacherSamples, setShowTeacherSamples] = useState(false);

  // ── UI ───────────────────────────────────────────────
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Refs ─────────────────────────────────────────────
  const trainerRef = useRef<TfTrainer | null>(null);
  const fileInputObjectRef = useRef<HTMLInputElement | null>(null);
  const fileInputGestureRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    trainerRef.current = new TfTrainer();
    lastActiveTimeRef.current = Date.now();
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (recordingProgressIntervalRef.current) clearInterval(recordingProgressIntervalRef.current);
      if (motionPlayerIntervalRef.current) clearInterval(motionPlayerIntervalRef.current);
    };
  }, []);

  // ── Motion Player Loop (Flipbook @ 8.3 FPS / 120ms) ──
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

  // ── Camera & MobileNet ───────────────────────────────
  const { videoRef, canvasRef, cameraError, retryCamera } = useCamera({ width: 640, height: 480 });
  const { modelStatus, extractFeaturesFromVideo, extractFeaturesFromBase64 } = useMobilenet();

  // ── Toast helper ─────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setValidationToast(msg);
    toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 4000);
  }, []);

  // ── Class Management ─────────────────────────────────
  const addClass = useCallback(() => {
    const rawLabel = newLabelInput.trim();
    if (!rawLabel) return;
    const label = cleanClassLabel(rawLabel, newEmojiInput) || rawLabel;
    if (classes.length >= MAX_CLASSES) {
      showToast(`⚠️ Tối đa ${MAX_CLASSES} nhãn!`);
      return;
    }
    if (classes.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      showToast('⚠️ Nhãn này đã tồn tại!');
      return;
    }

    const newId = `class_action_${++classIdCounterRef.current}`;
    const newClass = { id: newId, label, emoji: newEmojiInput || '✨' };
    setClasses((prev) => [...prev, newClass]);
    setNewLabelInput('');
    setActiveClass(newId);
    playClickSound();
  }, [newLabelInput, newEmojiInput, classes, showToast]);

  const removeClass = useCallback((classId: string) => {
    if (classes.length <= 2) {
      showToast('⚠️ Cần giữ lại ít nhất 2 nhãn để AI phân loại!');
      return;
    }
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    setSamples((prev) => prev.filter((s) => s.sourceId !== classId));
    setIsTrained(false);
    setActiveClass((prev) => (prev === classId ? classes.find((c) => c.id !== classId)?.id || '' : prev));
    playClickSound();
  }, [classes, showToast]);

  const applyPreset = useCallback((presetId: string) => {
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
    showToast(`Đã nạp kịch bản: ${preset.title}! Hãy quay cử chỉ hoặc chụp ảnh nhé 🎬`);
  }, [showToast]);

  // ── Fetch Teacher Template for teach-action ──────────
  useEffect(() => {
    let ignore = false;
    api.getTemplates('teach-action')
      .then(async (res) => {
        if (ignore) return;
        if (res && res.length > 0) {
          const template = res[0];
          try {
            const fileData = await api.getDatasetFile(template.id);
            template.samples = fileData.samples || (Array.isArray(fileData) ? fileData : []);
          } catch (e) {
            console.error('Failed to load teach-action template samples', e);
          }
          if (ignore) return;
          setTeacherTemplate(template);
        }
        setTemplateLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        console.error('Failed to load teach-action template', err);
        setTemplateLoading(false);
      });
    return () => { ignore = true; };
  }, []);

  const loadTeacherTemplate = useCallback(() => {
    if (!teacherTemplate) return;
    if (teacherTemplate.customClasses && teacherTemplate.customClasses.length > 0) {
      const templateClasses = teacherTemplate.customClasses.map((c: { id: string; label: string; emoji?: string }) => ({
        id: c.id,
        label: cleanClassLabel(c.label, c.emoji) || c.label,
        emoji: c.emoji || '✨',
      }));
      setClasses(templateClasses);
      setActiveClass(templateClasses[0]?.id || '');
      setSamples([]);
      setIsTrained(false);
      playSuccessSound();
      showToast(`🎓 Đã nạp ${templateClasses.length} nhãn từ bài tập của Thầy/Cô!`);
    }
  }, [teacherTemplate, showToast]);

  // ── Evaluation Hook ──────────────────────────────────
  const {
    evaluation,
    previousEvaluation,
    modelVersion,
    isEvaluating,
    runEvaluation,
  } = useModelEvaluation({
    challengeType: 'teach-action',
    classes,
    goldenDataset: [],
    dynamicDataset: [],
    teacherSamples: teacherTemplate?.samples,
  });

  // ── Helper: Capture single frame (Object or Gesture) ─
  const captureFrame = useCallback((sourceType: 'object' | 'gesture' = 'object') => {
    if (modelStatus !== 'ready' || !videoRef.current || !activeClass) return;

    const video = videoRef.current;
    const features = extractFeaturesFromVideo(video);
    if (!features) return;

    const vW = video.videoWidth || 640;
    const vH = video.videoHeight || 480;
    const cv = document.createElement('canvas');
    cv.width = vW;
    cv.height = vH;
    const ctx = cv.getContext('2d');
    if (ctx) ctx.drawImage(video, 0, 0, vW, vH);
    const thumbnail = cv.toDataURL('image/jpeg', 0.8);

    const quality = ctx ? assessQuality(cv) : undefined;
    const isQualityOk = !(quality?.isDark || quality?.isBlurry);
    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';

    const mischeck = checkMisclassification(
      features,
      activeClassLabel,
      classes.map((c) => c.label)
    );

    const isValid = isQualityOk && !mischeck.isSuspect;

    setSamples((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: activeClassLabel,
        sourceId: activeClass,
        sourceType,
        features,
        thumbnail,
        rawThumbnail: thumbnail,
        isValid,
        isQuestionable: mischeck.isSuspect,
        questionableReason: mischeck.message,
        quality,
      },
    ]);

    playClickSound();
  }, [modelStatus, videoRef, activeClass, classes, extractFeaturesFromVideo]);

  // ── Hold-to-Record ───────────────────────────────────
  const startCapturing = useCallback((type: 'gesture' | 'object') => {
    if (modelStatus !== 'ready' || !activeClass) return;
    playClickSound();
    setCapturingType(type);
    captureFrame(type);
    // Gesture quay nhanh hơn (120ms), Object chụp bình thường (300ms)
    const intervalMs = type === 'gesture' ? 120 : 300;
    captureIntervalRef.current = setInterval(() => captureFrame(type), intervalMs);
  }, [modelStatus, activeClass, captureFrame]);

  const stopCapturing = useCallback(() => {
    setCapturingType(null);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, [activeClass]);

  // ── Auto Motion Recording (Countdown 3s + 5s/10s Motion Tracking @ 120ms) ──
  const startMotionRecording = useCallback(() => {
    if (modelStatus !== 'ready' || !activeClass || videoRecordingState !== 'idle') return;

    playClickSound();
    setVideoRecordingState('countdown');
    setCountdownSec(3);

    let cd = 3;
    countdownIntervalRef.current = setInterval(() => {
      cd--;
      setCountdownSec(cd);
      if (cd <= 0) {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;

        // Bắt đầu ghi hình
        setVideoRecordingState('recording');
        playSuccessSound();
        speakEnglish('Start action!');

        const totalDurationMs = recordingDurationSec * 1000;
        const intervalMs = 120; // 8.3 FPS
        const startTime = Date.now();
        let framesCaptured = 0;
        let prevImageData: ImageData | null = null;

        setRecordingSecLeft(recordingDurationSec);
        setRecordingProgress(0);
        setRecordedFramesCount(0);

        const recordInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
          const secLeft = Math.max(0, Math.ceil((totalDurationMs - elapsed) / 1000));
          setRecordingProgress(progress);
          setRecordingSecLeft(secLeft);

          if (videoRef.current) {
            const video = videoRef.current;
            const cv = document.createElement('canvas');
            cv.width = 160;
            cv.height = 120;
            const ctx = cv.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, 160, 120);
              const currData = ctx.getImageData(0, 0, 160, 120);

              let motion = 0;
              if (prevImageData) {
                let diffSum = 0;
                for (let i = 0; i < currData.data.length; i += 4) {
                  diffSum += Math.abs(currData.data[i] - prevImageData.data[i]);
                }
                motion = Math.round((diffSum / (160 * 120)) * 10) / 10;
              }
              prevImageData = currData;
              setLiveMotionScore(motion);

              // Lưu frame
              captureFrame('gesture');
              framesCaptured++;
              setRecordedFramesCount(framesCaptured);
            }
          }

          if (elapsed >= totalDurationMs) {
            clearInterval(recordInterval);
            recordingProgressIntervalRef.current = null;
            setVideoRecordingState('idle');
            playSuccessSound();
            speakEnglish('Recording complete!');
            showToast(`✅ Đã thu thành công ${framesCaptured} khung hình cử chỉ!`);
          }
        }, intervalMs);

        recordingProgressIntervalRef.current = recordInterval;

        finishRecordingEarlyRef.current = () => {
          clearInterval(recordInterval);
          recordingProgressIntervalRef.current = null;
          setVideoRecordingState('idle');
          playSuccessSound();
          showToast(`⏹ Đã dừng quay sớm. Đã thu ${framesCaptured} khung hình!`);
        };
      }
    }, 1000);
  }, [modelStatus, activeClass, videoRecordingState, recordingDurationSec, captureFrame, showToast, videoRef]);

  // ── Batch File Upload (Object or Gesture) ─────────────
  const handleBatchUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    sourceType: 'object' | 'gesture'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeClass) return;

    const imageFiles = Array.from(files).filter(
      (file) => file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      showToast('⚠️ Vui lòng chọn file hình ảnh hợp lệ!');
      return;
    }

    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';
    const newSamples: StoredSample[] = [];
    let misclassifiedCount = 0;

    for (const file of imageFiles) {
      try {
        const base64 = await fileToBase64(file);
        const features = await extractFeaturesFromBase64(base64);
        if (features) {
          const mischeck = checkMisclassification(
            features,
            activeClassLabel,
            classes.map((c) => c.label)
          );
          if (mischeck.isSuspect) misclassifiedCount++;

          newSamples.push({
            id: crypto.randomUUID(),
            label: activeClassLabel,
            sourceId: activeClass,
            sourceType,
            features,
            thumbnail: base64,
            rawThumbnail: base64,
            isValid: !mischeck.isSuspect,
            isQuestionable: mischeck.isSuspect,
            questionableReason: mischeck.message,
          });
        }
      } catch {
        // skip failed
      }
    }

    if (newSamples.length > 0) {
      setSamples((prev) => [...prev, ...newSamples]);
      setIsTrained(false);
      playClickSound();
      showToast(`✅ Đã thêm ${newSamples.length} ảnh (${sourceType === 'gesture' ? 'Cử chỉ' : 'Đối tượng'}) cho "${activeClassLabel}"!`);
    }

    e.target.value = '';
  }, [activeClass, classes, extractFeaturesFromBase64, showToast]);

  // ── Sample Counts ────────────────────────────────────
  const classCounts = useMemo(() => {
    const counts: Record<string, { total: number; object: number; gesture: number }> = {};
    classes.forEach((c) => {
      const classSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable && s.sourceId === c.id);
      counts[c.id] = {
        total: classSamples.length,
        object: classSamples.filter((s) => s.sourceType === 'object' || !s.sourceType).length,
        gesture: classSamples.filter((s) => s.sourceType === 'gesture').length,
      };
    });
    return counts;
  }, [classes, samples]);

  const canTrain = useMemo(() => {
    if (classes.length < 2 || modelStatus !== 'ready') return false;
    return classes.every((c) => (classCounts[c.id]?.total || 0) >= MIN_SAMPLES_PER_CLASS);
  }, [classes, classCounts, modelStatus]);

  // ── Training with Teacher Template Validation ────────
  const handleTrain = useCallback(async () => {
    if (!canTrain) {
      showToast(`⚠️ Cần ít nhất ${MIN_SAMPLES_PER_CLASS} mẫu hợp lệ cho mỗi nhãn để huấn luyện!`);
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingLogs([]);
    playClickSound();

    try {
      const validSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable);
      const trainingDatasetSamples: StoredSample[] = [...validSamples];

      // Dataset Prototypes
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
              features: noisy.map((v) => v / norm),
              thumbnail: '',
              isValid: true,
            });
          }
        }
      }

      if (trainerRef.current) {
        await trainerRef.current.train(
          trainingDatasetSamples,
          (_epoch, progress, loss, acc) => {
            setTrainingProgress(progress);
            setTrainingLogs((prev) => [...prev, { epoch: _epoch, loss, acc }]);
          },
          { epochs: hpEpochs, batchSize: hpBatchSize, learningRate: hpLearningRate }
        );

        setIsTraining(false);
        setIsTrained(true);
        playSuccessSound();
        speakEnglish('Learning complete!');

        // ── BƯỚC XÁC THỰC VỚI BỘ MẪU GIÁO VIÊN (Chuyên biệt Hành động & Đối tượng) ──
        const valResult = await validateStudentActionWithTeacherTemplate(
          validSamples,
          classes,
          teacherTemplate?.samples,
          trainerRef.current
        );

        setValidationResult(valResult);
        setShowValidationModal(true);

        if (valResult.hasTeacherTemplate) {
          showToast(`🎓 Đã đối soát bài mẫu Thầy/Cô: Vật thể ${valResult.objectAccuracyScore}%, Cử chỉ ${valResult.gestureAccuracyScore}%!`);
        } else {
          showToast(`✅ Đã hoàn tất huấn luyện! Độ chuẩn xác: ${valResult.overallAccuracyScore}%`);
        }
      }
    } catch (err) {
      console.error('Training failed:', err);
      setIsTraining(false);
      showToast('❌ Huấn luyện thất bại. Hãy kiểm tra dữ liệu và thử lại.');
    }
  }, [canTrain, samples, classes, hpEpochs, hpBatchSize, hpLearningRate, teacherTemplate, showToast]);

  // ── Real-time Prediction Loop ────────────────────────
  useEffect(() => {
    if (!predictionActive || !isTrained || modelStatus !== 'ready' || !trainerRef.current) return;
    lastActiveTimeRef.current = Date.now();

    let rafId: number;
    const validSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable);

    const predict = async () => {
      if (!videoRef.current || !trainerRef.current?.isTrained()) {
        rafId = requestAnimationFrame(predict);
        return;
      }
      try {
        const features = extractFeaturesFromVideo(videoRef.current);
        if (features) {
          const result = await trainerRef.current.predict(features);

          const cSamples = validSamples.filter((s) => s.label === result?.label);
          let maxSimInClass = -1;
          for (const s of cSamples) {
            const sim = cosineSimilarity(features, s.features);
            if (sim > maxSimInClass) maxSimInClass = sim;
          }

          const match = matchLabelToDataset(result?.label || '');
          if (match.matched && match.classMapping && REFERENCE_CENTROIDS[match.classMapping.key]) {
            const cSim = cosineSimilarity(features, REFERENCE_CENTROIDS[match.classMapping.key]);
            if (cSim > maxSimInClass) maxSimInClass = cSim;
          }

          const isFrameInLibrary = result && result.confidence >= 65 && maxSimInClass >= 0.65;

          if (isFrameInLibrary) {
            activeStreakRef.current++;
            idleStreakRef.current = 0;

            if (activeStreakRef.current >= 3) {
              lastActiveTimeRef.current = Date.now();
              if (!isDetectedRef.current) {
                isDetectedRef.current = true;
                setIsDetectedInLibrary(true);
              }
              setConfidence(result.confidence);
              setPredictedLabel(result.label);
              if (result.confidences) setConfidences(result.confidences);
            }
          } else {
            idleStreakRef.current++;
            activeStreakRef.current = 0;

            if (idleStreakRef.current >= 4) {
              if (isDetectedRef.current) {
                isDetectedRef.current = false;
                setIsDetectedInLibrary(false);
                setConfidence(0);
                setPredictedLabel('Đang chờ hành động / đối tượng... 💤');
                const zeroConf: Record<string, number> = {};
                classes.forEach((c) => { zeroConf[c.label] = 0; });
                setConfidences(zeroConf);
              }

              const idleMs = Date.now() - lastActiveTimeRef.current;
              if (idleMs >= 10000) {
                setPredictionActive(false);
                setIsDetectedInLibrary(false);
                isDetectedRef.current = false;
                playClickSound();
                showToast('💤 Đã tự động tắt nhận diện do không có hoạt động.');
                return;
              }
            }
          }
        }
      } catch {
        // skip frame
      }
      rafId = requestAnimationFrame(predict);
    };

    predict();
    return () => cancelAnimationFrame(rafId);
  }, [predictionActive, isTrained, modelStatus, samples, classes, extractFeaturesFromVideo, videoRef, showToast]);

  // ── Static Image Upload Prediction (4-Tier Bulletproof OOD) ──
  const handlePredictUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const isImage = file && (file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name));
    if (!file || !isImage || !trainerRef.current?.isTrained()) return;

    setIsPredicting(true);
    setPredictResult(null);
    try {
      const base64 = await fileToBase64(file);
      setPredictImage(base64);

      const features = await extractFeaturesFromBase64(base64);
      if (!features) {
        showToast('⚠️ Không thể xử lý ảnh này.');
        setIsPredicting(false);
        return;
      }

      const result = await trainerRef.current.predict(features);

      const activeCentroidKeys = new Set<string>();
      const activeClassMap: Record<string, string> = {};
      for (const c of classes) {
        const match = matchLabelToDataset(c.label);
        if (match.matched && match.classMapping && REFERENCE_CENTROIDS[match.classMapping.key]) {
          activeCentroidKeys.add(match.classMapping.key);
          activeClassMap[c.label] = match.classMapping.key;
        }
      }

      let maxActiveSim = -1;
      let matchedLabel: string | null = null;
      const classSims: Record<string, number> = {};

      for (const c of classes) {
        let maxC = -1;
        const cSamples = samples.filter((s) => s.label === c.label && s.isValid !== false && !s.isQuestionable);
        for (const s of cSamples) {
          const sim = cosineSimilarity(features, s.features);
          if (sim > maxC) maxC = sim;
        }
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

      const sortedSims = Object.values(classSims).sort((a, b) => b - a);
      const runnerUpSim = sortedSims.length > 1 ? sortedSims[1] : 0;
      const margin = maxActiveSim - runnerUpSim;

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

      const belongsToOtherDatasetClass =
        maxOtherCentroidSim > maxActiveSim + 0.03 ||
        (maxOtherCentroidSim >= 0.65 && maxOtherCentroidSim > maxActiveSim);

      const lowAbsoluteSimilarity = maxActiveSim < 0.54;
      const ambiguousLowMargin = classes.length >= 2 && maxActiveSim < 0.65 && margin < 0.035;
      const lowConfidence = result.confidence < 60 && maxActiveSim < 0.60;

      const isOOD = belongsToOtherDatasetClass || lowAbsoluteSimilarity || ambiguousLowMargin || lowConfidence;

      if (isOOD) {
        let reason = 'Ảnh không giống các mẫu trong Thư viện ảnh hoặc bộ dữ liệu đã dạy.';
        if (belongsToOtherDatasetClass) {
          reason = `Ảnh có dấu hiệu thuộc nhóm đối tượng khác (${bestOtherKey}) nằm ngoài các nhãn đang dạy.`;
        } else if (lowAbsoluteSimilarity) {
          reason = 'Độ tương đồng quá thấp, ảnh không nằm trong bộ dữ liệu hoặc Thư viện ảnh.';
        } else if (ambiguousLowMargin) {
          reason = 'Không phân biệt rõ ràng với các nhãn đã dạy.';
        }

        setPredictResult({
          label: 'Không nhận diện được',
          confidence: 0,
          confidences: {},
          isOOD: true,
          reason,
        });
      } else {
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
    } catch {
      showToast('❌ Lỗi khi dự đoán ảnh.');
    } finally {
      setIsPredicting(false);
      if (predictFileRef.current) predictFileRef.current.value = '';
    }
  }, [classes, samples, showToast]);

  // ── Self-Evaluation (LOO-KNN) ────────────────────────
  const selfAccuracy = useMemo(() => {
    const validSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable);
    if (validSamples.length < 4) return null;
    let correct = 0;
    validSamples.forEach((sample, i) => {
      const others = validSamples.filter((_, j) => j !== i);
      if (others.length > 0) {
        const result = classifyKNN(sample.features, others, 3);
        if (result.label === sample.label) correct++;
      }
    });
    return Math.round((correct / validSamples.length) * 100);
  }, [samples]);

  // ── Submission Flow ──────────────────────────────────
  const handleTrainComplete = useCallback(() => {
    if (!isTrained) {
      showToast('⚠️ Hãy huấn luyện mô hình trước!');
      return;
    }
    setSubmitScore(selfAccuracy ?? 100);
    setShowSubmitModal(true);
    playClickSound();
  }, [isTrained, selfAccuracy, showToast]);

  const handleSubmitAssignment = useCallback(async () => {
    if (submitScore === null) return;
    try {
      setIsSubmitting(true);

      let processedSamples = samples.filter((s) => s.isValid !== false && !s.isQuestionable);
      if (isCloudinaryConfigured()) {
        setUploadProgress('Đang tải ảnh lên Cloud...');
        processedSamples = await uploadSamplesToCloudinary(
          processedSamples,
          'teach-action',
          (uploaded, total) => setUploadProgress(`Tải ảnh ${uploaded}/${total}...`)
        );
        setUploadProgress('Đang lưu bài...');
      }

      const created = await api.createDataset(
        'teach-action',
        processedSamples,
        submitScore,
        `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`,
        false,
        '',
        false,
        'camera',
        classes
      );

      if (created?.model?.id) {
        setCreatedModelId(created.model.id);

        await api.updateModelArtifacts(created.model.id, {
          algorithm: 'neural_network',
          testScore: submitScore,
          hyperparameters: { epochs: hpEpochs, batchSize: hpBatchSize, learningRate: hpLearningRate },
        }).catch(() => {});

        if (trainerRef.current?.isTrained()) {
          setUploadProgress('Đang tải mô hình lên...');
          const blobs = await trainerRef.current.saveToBlobs();
          if (blobs) {
            const formData = new FormData();
            formData.append('files', blobs.jsonBlob, 'model.json');
            formData.append('files', blobs.weightsBlob, 'model.weights.bin');
            await api.uploadModelArtifactsFiles(created.model.id, formData).catch((e) => {
              console.error('Failed to upload model artifacts', e);
            });
          }
        }

        setUploadProgress('Đang đánh giá AI...');
        await runEvaluation(processedSamples, created.model.id);
      }

      await api.submitAssignment(
        submitScore,
        { samples: processedSamples },
        `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`,
        'teach-action'
      );
      await api.saveProgress('teach-action', submitScore);

      setUploadProgress('');
      setShowSubmitModal(false);
      setShowReportCard(true);
      playSuccessSound();
    } catch (err) {
      console.error('Failed to submit assignment', err);
      setUploadProgress('');
      speakEnglish('Submission failed!');
    } finally {
      setIsSubmitting(false);
    }
  }, [submitScore, samples, classes, reflectionAnswer, teacherMessage, hpEpochs, hpBatchSize, hpLearningRate, runEvaluation]);

  const gestureFramesForActive = useMemo(() => {
    return samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'gesture');
  }, [samples, activeClass]);

  const activeClassObj = classes.find((c) => c.id === activeClass);
  const activeClassLabel = activeClassObj?.label || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-cyan-50 to-indigo-100 py-8 px-4 select-none">
      <div className="max-w-[1600px] w-[98%] mx-auto space-y-6">

        {/* ── HEADER & NAVIGATION ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              onClick={playClickSound}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-teal-200 text-teal-700 font-extrabold shadow-sm hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Về Trang Chủ</span>
            </Link>

            {/* Switch to Teach-Free Mode Button */}
            <Link
              href="/challenge/teach-free"
              onClick={playClickSound}
              className="px-4 py-2 bg-white rounded-full border-2 border-indigo-200 text-indigo-700 font-extrabold shadow-sm hover:scale-105 transition-transform flex items-center gap-2 text-sm"
              title="Chuyển sang Chế Độ Phân Loại Ảnh Tạo Nhãn Tự Do (Teach Free)"
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>🖼️ Chế Độ Phân Loại Ảnh Tạo Nhãn Tự Do</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl">🎬⚡</span>
            <h1 className="text-2xl md:text-3xl font-black text-teal-900">
              Bé Tập Dạy AI Hành Động & Đối Tượng
            </h1>
          </div>
        </div>

        {/* ── TEACHER TEMPLATE BANNER (Nếu có bài tập mẫu từ Thầy/Cô) ── */}
        {teacherTemplate && (
          <div className="bg-white rounded-2xl p-4 border-2 border-indigo-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <span className="font-black text-indigo-900 text-sm">
                  Thầy/Cô đã giao bài tập mẫu: Phân loại hành động kết hợp đối tượng
                </span>
                {teacherTemplate.teacherNotes && (
                  <p className="text-xs text-indigo-600 mt-0.5 font-medium">
                    📝 {teacherTemplate.teacherNotes}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={loadTeacherTemplate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-start md:self-auto shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Nạp bài từ Thầy Cô
            </button>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {!showSubmitModal && !showReportCard && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ══ LEFT: Label Management & Data Collection ══ */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-teal-200 flex flex-col">

              {/* MobileNet Status */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold mb-4 ${
                modelStatus === 'ready' ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200' :
                modelStatus === 'error' ? 'bg-red-50 text-red-700 border-2 border-red-200' :
                'bg-amber-50 text-amber-700 border-2 border-amber-200 animate-pulse'
              }`}>
                <span>{modelStatus === 'ready' ? '🟢' : modelStatus === 'error' ? '🔴' : '🟡'}</span>
                {modelStatus === 'ready' ? 'MobileNet sẵn sàng nhận diện cử chỉ & ảnh' : modelStatus === 'error' ? 'Lỗi tải MobileNet' : 'Đang tải MobileNet...'}
              </div>

              {/* Quick Presets 1-Click */}
              <div className="mb-4 bg-teal-50/70 border-2 border-dashed border-teal-300 rounded-2xl p-3">
                <div className="text-[11px] font-black text-teal-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Gợi ý kịch bản mẫu 1-Click
                </div>
                <p className="text-[11px] text-teal-700 mb-2 leading-relaxed">
                  Chọn kịch bản có sẵn hoặc tự do gõ nhãn mới ở ô bên dưới!
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('agri-doctor')}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:scale-105 active:scale-95 transition-all shadow-sm"
                  >
                    🌿 Bác sĩ Nông nghiệp
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('animal-world')}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 hover:scale-105 active:scale-95 transition-all shadow-sm"
                  >
                    🐾 Thế giới Động vật
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('fruit-garden')}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all shadow-sm"
                  >
                    🍎 Vườn Trái Cây
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('rock-paper-scissors')}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-300 hover:bg-indigo-100 hover:scale-105 active:scale-95 transition-all shadow-sm"
                  >
                    ✊ Oẳn tù tì
                  </button>
                </div>
              </div>

              {/* Add New Label */}
              <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addClass()}
                    placeholder="Nhập tên hành động/vật (VD: Vẫy tay, Quả táo)"
                    className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                  <input
                    type="text"
                    value={newEmojiInput}
                    onChange={(e) => setNewEmojiInput(e.target.value)}
                    className="w-14 bg-slate-50 border-2 border-slate-200 rounded-xl px-2 py-2.5 text-center text-lg focus:outline-none focus:border-teal-500 transition-colors"
                    placeholder="👋"
                  />
                  <button
                    onClick={addClass}
                    disabled={!newLabelInput.trim() || classes.length >= MAX_CLASSES}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-3 rounded-xl text-sm transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm
                  </button>
                </div>
              </div>

              {/* Class List */}
              <div className="flex flex-col gap-2.5 mb-4 max-h-[250px] overflow-y-auto pr-1">
                {classes.map((c) => {
                  const counts = classCounts[c.id] || { total: 0, object: 0, gesture: 0 };
                  const isActive = activeClass === c.id;
                  const canTrainClass = counts.total >= MIN_SAMPLES_PER_CLASS;

                  return (
                    <div
                      key={c.id}
                      onClick={() => { playClickSound(); setActiveClass(c.id); }}
                      className={`relative overflow-hidden p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        isActive
                          ? 'border-teal-500 bg-teal-50 shadow-md scale-[1.02]'
                          : 'border-slate-100 bg-white hover:border-teal-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div>
                          <div className={`font-black text-base ${isActive ? 'text-teal-900' : 'text-slate-700'}`}>
                            {c.emoji} {c.label}
                          </div>
                          <div className={`text-xs font-bold flex items-center gap-2 mt-0.5 ${
                            canTrainClass ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            <span>Tổng: {counts.total} mẫu</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({counts.object} ảnh vật + {counts.gesture} cử chỉ)
                            </span>
                            {canTrainClass ? (
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                                ✅ Sẵn sàng
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                                ⚠️ Thiếu {MIN_SAMPLES_PER_CLASS - counts.total}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Bé có chắc muốn xóa nhãn "${c.label}" và toàn bộ ảnh không?`)) {
                                removeClass(c.id);
                              }
                            }}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Data Collection Mode Switcher (Object vs Gesture) */}
              {activeClass && (
                <div className="mb-4 bg-slate-100 p-1.5 rounded-2xl flex gap-1 border border-slate-200">
                  <button
                    onClick={() => setDataCollectionTab('object')}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                      dataCollectionTab === 'object'
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span>🖼️ Ảnh Đối Tượng</span>
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-bold">
                      {classCounts[activeClass]?.object || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => setDataCollectionTab('gesture')}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                      dataCollectionTab === 'gesture'
                        ? 'bg-white text-indigo-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span>🎥 Chuỗi Cử Chỉ</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full font-bold">
                      {classCounts[activeClass]?.gesture || 0}
                    </span>
                  </button>
                </div>
              )}

              {/* Active Tab Actions */}
              {activeClass && dataCollectionTab === 'object' && (
                <div className="space-y-2 mb-4">
                  <button
                    onPointerDown={() => startCapturing('object')}
                    onPointerUp={stopCapturing}
                    onPointerLeave={stopCapturing}
                    disabled={modelStatus !== 'ready'}
                    className={`w-full font-extrabold py-3 px-4 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm border-b-4 select-none ${
                      capturingType === 'object'
                        ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white animate-pulse'
                        : 'bg-teal-600 hover:bg-teal-700 border-teal-800 text-white active:scale-95'
                    } disabled:bg-gray-300`}
                  >
                    <Camera className="w-5 h-5" />
                    {capturingType === 'object' ? 'ĐANG CHỤP... THẢ ĐỂ DỪNG 🔴' : 'GIỮ ĐỂ CHỤP LIÊN TỤC 📸'}
                  </button>

                  <input
                    ref={fileInputObjectRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleBatchUpload(e, 'object')}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputObjectRef.current?.click()}
                    disabled={modelStatus !== 'ready'}
                    className="w-full font-extrabold py-2.5 px-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm border-b-4 bg-white hover:bg-slate-50 border-slate-200 text-teal-700 active:scale-95 disabled:bg-gray-100"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Tải ảnh đối tượng từ máy tính
                  </button>
                </div>
              )}

              {activeClass && dataCollectionTab === 'gesture' && (
                <div className="space-y-2 mb-4">
                  {/* Motion Recording Status or Triggers */}
                  {videoRecordingState === 'countdown' ? (
                    <div className="bg-amber-100 border-2 border-amber-300 rounded-2xl p-4 text-center animate-bounce">
                      <span className="text-3xl font-black text-amber-800">{countdownSec}</span>
                      <p className="text-xs font-bold text-amber-700 mt-1">Chuẩn bị thực hiện cử chỉ nhé!</p>
                    </div>
                  ) : videoRecordingState === 'recording' ? (
                    <div className="bg-rose-500 text-white rounded-2xl p-4 space-y-2 shadow-lg animate-pulse">
                      <div className="flex justify-between items-center text-xs font-black">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                          ĐANG QUAY CỬ CHỈ... ({recordingSecLeft}s)
                        </span>
                        <span>{recordedFramesCount} ảnh</span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                        <div className="bg-white h-full transition-all" style={{ width: `${recordingProgress}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-[10px] opacity-90">
                        <span>Chuyển động: {liveMotionScore}px</span>
                        <button
                          onClick={() => finishRecordingEarlyRef.current?.()}
                          className="bg-white text-rose-600 px-2 py-0.5 rounded-full font-bold"
                        >
                          Dừng sớm ⏹
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onPointerDown={() => startCapturing('gesture')}
                        onPointerUp={stopCapturing}
                        onPointerLeave={stopCapturing}
                        disabled={modelStatus !== 'ready'}
                        className={`w-full font-extrabold py-3 px-4 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm border-b-4 select-none ${
                          capturingType === 'gesture'
                            ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white animate-pulse'
                            : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white active:scale-95'
                        } disabled:bg-gray-300`}
                      >
                        <Film className="w-5 h-5" />
                        {capturingType === 'gesture' ? 'ĐANG QUAY CỬ CHỈ... THẢ ĐỂ DỪNG 🔴' : 'GIỮ ĐỂ QUAY CỬ CHỈ 🎥'}
                      </button>

                      {/* Auto Record 5s/10s */}
                      <div className="flex gap-2">
                        <button
                          onClick={startMotionRecording}
                          disabled={modelStatus !== 'ready'}
                          className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-2xl shadow-sm text-xs border-b-4 border-amber-700 active:scale-95 flex items-center justify-center gap-1"
                        >
                          <Zap className="w-4 h-4" />
                          Tự động thu {recordingDurationSec}s ⏱️
                        </button>
                        <button
                          onClick={() => setRecordingDurationSec((prev) => (prev === 5 ? 10 : 5))}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs border border-slate-300"
                          title="Đổi thời gian quay"
                        >
                          {recordingDurationSec}s
                        </button>
                      </div>

                      {/* Batch Upload Gestures */}
                      <input
                        ref={fileInputGestureRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleBatchUpload(e, 'gesture')}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputGestureRef.current?.click()}
                        disabled={modelStatus !== 'ready'}
                        className="w-full font-extrabold py-2 px-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs border-b-4 bg-white hover:bg-slate-50 border-slate-200 text-indigo-700 active:scale-95 disabled:bg-gray-100"
                      >
                        <ImagePlus className="w-4 h-4" />
                        Tải ảnh cử chỉ từ máy tính
                      </button>

                      {/* Flipbook Player Trigger */}
                      {gestureFramesForActive.length > 0 && (
                        <button
                          onClick={() => {
                            setShowMotionPlayer(true);
                            setIsMotionPlaying(true);
                            setMotionPlayerIdx(0);
                          }}
                          className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-extrabold rounded-2xl border border-indigo-200 text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Film className="w-4 h-4 text-indigo-600" />
                          Xem Chuỗi Chuyển Động (Flipbook) 🎞️ ({gestureFramesForActive.length} ảnh)
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Sample Gallery */}
              {activeClass && (
                <SampleGallery
                  samples={samples.filter((s) => s.sourceId === activeClass)}
                  onDeleteSample={(id) => {
                    setSamples((prev) => prev.filter((s) => s.id !== id));
                    setIsTrained(false);
                  }}
                  onClearAll={() => {
                    setSamples((prev) => prev.filter((s) => s.sourceId !== activeClass));
                    setIsTrained(false);
                  }}
                  isTrained={isTrained}
                />
              )}

              {/* Toast */}
              {validationToast && (
                <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-2xl text-xs font-bold text-yellow-800 flex items-center gap-2 animate-bounce shadow-lg">
                  <span className="text-lg">⚠️</span>
                  <span>{validationToast}</span>
                </div>
              )}

              {/* Hyperparameters panel */}
              <div className="mt-auto pt-4 space-y-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full text-xs font-bold text-slate-400 hover:text-teal-600 flex items-center justify-center gap-1 py-1 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {showSettings ? 'Ẩn cài đặt nâng cao ▲' : 'Cài đặt nâng cao (Under the Hood) ▼'}
                </button>

                {showSettings && (
                  <div className="bg-slate-50 rounded-2xl p-3.5 border-2 border-slate-200 space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-600">Epochs</span>
                        <span className="font-black text-teal-700">{hpEpochs}</span>
                      </div>
                      <input
                        type="range" min={10} max={200} step={10} value={hpEpochs}
                        onChange={(e) => setHpEpochs(Number(e.target.value))}
                        className="w-full accent-teal-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-600">Batch Size</span>
                        <span className="font-black text-teal-700">{hpBatchSize}</span>
                      </div>
                      <input
                        type="range" min={8} max={128} step={8} value={hpBatchSize}
                        onChange={(e) => setHpBatchSize(Number(e.target.value))}
                        className="w-full accent-teal-600"
                      />
                    </div>
                  </div>
                )}

                {/* Train + Submit */}
                {isTraining ? (
                  <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-teal-700">AI đang học nhận diện hành động... ⚙️</span>
                      <span className="text-xs font-black text-teal-800">{trainingProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className="bg-teal-600 h-full transition-all duration-150" style={{ width: `${trainingProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleTrain}
                      disabled={!canTrain}
                      className={`w-full font-extrabold py-3.5 px-6 rounded-2xl shadow-lg border-b-4 flex items-center justify-center gap-2 text-lg transition-all ${
                        canTrain
                          ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white active:scale-95'
                          : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Brain className="w-6 h-6" />
                      {isTrained ? 'HUẤN LUYỆN LẠI 🔄' : 'DẠY BẠN AI HỌC 🚀'}
                    </button>

                    {isTrained && (
                      <button
                        onClick={handleTrainComplete}
                        className="w-full font-extrabold py-3 px-6 rounded-2xl shadow-md border-b-4 bg-purple-500 hover:bg-purple-600 border-purple-700 text-white flex items-center justify-center gap-2 text-base transition-all active:scale-95"
                      >
                        📤 NỘP BÀI CHO THẦY CÔ
                      </button>
                    )}

                    {isTrained && validationResult && (
                      <button
                        onClick={() => {
                          playClickSound();
                          setShowValidationModal(true);
                        }}
                        className="w-full font-extrabold py-2.5 px-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                      >
                        <Brain className="w-4 h-4 text-indigo-600" />
                        <span>Xem Lại Kết Quả Đối Soát Thầy Cô 🔍</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ══ CENTER + RIGHT: Camera & Real-time / Static Prediction ══ */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Camera View */}
              <div className="bg-white rounded-3xl overflow-hidden border-4 border-teal-200 shadow-lg">
                <CameraView
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  modelStatus={modelStatus}
                  cameraError={cameraError}
                  onRetry={retryCamera}
                />
              </div>

              {/* Prediction Area */}
              {isTrained && (
                <div className="bg-gradient-to-br from-teal-800 to-indigo-900 rounded-3xl p-6 text-white shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black flex items-center gap-2">
                      🔮 Dự Đoán Thời Gian Thực
                    </h3>
                    <button
                      onClick={() => {
                        const next = !predictionActive;
                        setPredictionActive(next);
                        if (next) {
                          lastActiveTimeRef.current = Date.now();
                          activeStreakRef.current = 0;
                          idleStreakRef.current = 0;
                          isDetectedRef.current = false;
                          setIsDetectedInLibrary(false);
                          setPredictedLabel('Đang chờ hành động / đối tượng... 💤');
                          setConfidence(0);
                          const zeroConf: Record<string, number> = {};
                          classes.forEach((c) => { zeroConf[c.label] = 0; });
                          setConfidences(zeroConf);
                        }
                      }}
                      className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${
                        predictionActive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
                      }`}
                    >
                      {predictionActive ? '⏹ Tắt' : '▶️ Bật nhận diện'}
                    </button>
                  </div>

                  {predictionActive && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <span className="text-4xl font-black">{predictedLabel}</span>
                        <div className="text-sm opacity-80 mt-1">Độ tự tin: {confidence}%</div>
                      </div>

                      {isDetectedInLibrary && confidence >= 50 && Object.keys(confidences).length > 0 && (
                        <div className="space-y-1.5 mt-4">
                          {classes.map((c) => {
                            const pct = Math.round((confidences[c.label] || 0) * 100);
                            return (
                              <div key={c.id} className="flex items-center gap-2">
                                <span className="text-xs font-bold w-24 truncate">{c.emoji} {c.label}</span>
                                <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-200"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold w-12 text-right">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Self-Evaluation Badge */}
                  {selfAccuracy !== null && (
                    <div className="mt-4 bg-white/10 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs font-bold">🎯 Tự đánh giá (LOO-KNN):</span>
                      <span className={`text-sm font-black ${selfAccuracy >= 80 ? 'text-emerald-300' : selfAccuracy >= 60 ? 'text-amber-300' : 'text-red-300'}`}>
                        {selfAccuracy}%
                      </span>
                    </div>
                  )}

                  {/* Static Image Test */}
                  <div className="mt-4 border-t border-white/20 pt-4">
                    <h4 className="text-sm font-bold mb-2">📷 Test ảnh upload</h4>
                    <input ref={predictFileRef} type="file" accept="image/*" onChange={handlePredictUpload} className="hidden" />
                    <button
                      onClick={() => predictFileRef.current?.click()}
                      disabled={isPredicting}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                      {isPredicting ? 'Đang xử lý...' : '🖼️ Chọn ảnh để test'}
                    </button>

                    {predictResult && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-3">
                          {predictImage && (
                            <img src={predictImage} alt="test" className="w-20 h-20 rounded-xl object-cover border-2 border-white/30 shrink-0" />
                          )}
                          <div className="flex-1">
                            {predictResult.isOOD ? (
                              <div className="bg-red-500/20 border-2 border-red-400 rounded-xl p-3 text-white">
                                <p className="font-bold text-red-200 text-sm">
                                  🚫 Không nhận diện được (Ảnh lạ)
                                </p>
                                <p className="text-xs text-red-300 mt-1 font-medium leading-relaxed">
                                  {predictResult.reason}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <div className="text-lg font-black text-emerald-300">
                                  ✅ {predictResult.label}
                                </div>
                                <div className="text-xs opacity-80 mt-0.5">Độ tự tin: {predictResult.confidence}%</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── FLIPBOOK MOTION PLAYER MODAL ── */}
        {showMotionPlayer && gestureFramesForActive.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border-4 border-indigo-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                  <Film className="w-5 h-5 text-indigo-600" />
                  Xem Chuỗi Cử Chỉ: {activeClassLabel}
                </h3>
                <button
                  onClick={() => {
                    setShowMotionPlayer(false);
                    setIsMotionPlaying(false);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Player Screen */}
              <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-slate-200 bg-black flex items-center justify-center">
                {gestureFramesForActive[motionPlayerIdx]?.thumbnail ? (
                  <img
                    src={gestureFramesForActive[motionPlayerIdx].thumbnail}
                    alt="motion"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-white text-xs">Không có ảnh</span>
                )}
                <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded-md">
                  {motionPlayerIdx + 1} / {gestureFramesForActive.length} (8.3 FPS)
                </span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setMotionPlayerIdx((prev) => (prev > 0 ? prev - 1 : gestureFramesForActive.length - 1))}
                  className="p-2 hover:bg-slate-100 rounded-xl"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-700" />
                </button>
                <button
                  onClick={() => setIsMotionPlaying(!isMotionPlaying)}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  {isMotionPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isMotionPlaying ? 'Tạm dừng' : 'Phát'}
                </button>
                <button
                  onClick={() => setMotionPlayerIdx((prev) => (prev + 1) % gestureFramesForActive.length)}
                  className="p-2 hover:bg-slate-100 rounded-xl"
                >
                  <ChevronRight className="w-5 h-5 text-slate-700" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTION TEACHER TEMPLATE VALIDATION MODAL ── */}
        {showValidationModal && validationResult && (
          <ActionAIFeedbackModal
            isOpen={showValidationModal}
            onClose={() => setShowValidationModal(false)}
            onProceed={() => setShowValidationModal(false)}
            validationResult={validationResult}
            classes={classes}
            onDeleteSample={(sampleId) => {
              setSamples((prev) => prev.filter((s) => s.id !== sampleId));
              setIsTrained(false);
            }}
          />
        )}

        {/* ── REPORT CARD MODAL ── */}
        {showReportCard && evaluation && (
          <ReportCard
            isOpen={showReportCard}
            onClose={() => setShowReportCard(false)}
            onRevise={() => {
              setShowReportCard(false);
              setShowSubmitModal(false);
              setSubmitSuccess(false);
              setCreatedModelId(null);
            }}
            onFinalize={() => router.push('/home')}
            evaluation={evaluation}
            version={modelVersion}
            previousEvaluation={previousEvaluation}
          />
        )}

        {/* ── SUBMISSION MODAL ── */}
        {showSubmitModal && (
          <div className="flex justify-center animate-in fade-in zoom-in duration-300">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 border-4 border-teal-400 shadow-2xl relative overflow-hidden">
              {submitSuccess ? (
                <div className="text-center py-8">
                  <span className="text-7xl">🏆🎉</span>
                  <h3 className="text-2xl font-black text-teal-900 mt-4">Nộp Bài Hoàn Tất!</h3>
                  <p className="text-gray-600 font-semibold mt-2">
                    Bé đã dạy AI phân biệt hành động & đối tượng thành công!
                  </p>
                  <div className="flex gap-3 mt-6 justify-center">
                    <button
                      onClick={() => {
                        setShowSubmitModal(false);
                        setSubmitSuccess(false);
                      }}
                      className="px-6 py-2.5 bg-teal-600 text-white font-extrabold rounded-full hover:scale-105 transition-transform"
                    >
                      🧪 Tiếp Tục Thử Nghiệm
                    </button>
                    <button
                      onClick={() => router.push('/home')}
                      className="px-6 py-2.5 bg-gray-200 text-gray-700 font-extrabold rounded-full hover:scale-105 transition-transform"
                    >
                      🏠 Về Trang Chủ
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-black text-teal-900 mb-2 flex items-center gap-2">
                    <span>🎒</span> Trả Lời Câu Hỏi Cuối Cùng
                  </h3>

                  {/* Score badge */}
                  {(() => {
                    const score = submitScore ?? 0;
                    const { stars, badgeEmoji, feedbackMessage } = getStarRatingInfo(score);
                    return (
                      <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4 flex items-center justify-between mb-6">
                        <div>
                          <span className="text-xs text-teal-700 font-bold block">Độ chuẩn xác nhận diện cử chỉ:</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-lg text-teal-900 font-black">
                              {Math.round(score / 10)}/10 điểm
                            </span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }, (_, i) => (
                                <span key={i} className={`text-base ${i < stars ? '' : 'opacity-20'}`}>⭐</span>
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-teal-600 font-semibold block mt-0.5">{feedbackMessage}</span>
                        </div>
                        <span className="text-3xl">{badgeEmoji}</span>
                      </div>
                    );
                  })()}

                  {/* Question */}
                  <div className="mb-4">
                    <label className="text-xs font-black text-gray-700 block mb-1.5 flex items-center gap-1">
                      <HelpCircle className="w-4 h-4 text-teal-600" />
                      <span>Bé hãy trả lời: Làm sao để AI nhận diện hành động chuẩn nhất?</span>
                    </label>
                    <select
                      value={reflectionAnswer}
                      onChange={(e) => setReflectionAnswer(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-teal-400"
                    >
                      <option value="Chụp ảnh rõ nét kết hợp quay cử chỉ đều tay">
                        Chụp ảnh rõ nét và thực hiện cử chỉ đều tay từ nhiều góc 🎥
                      </option>
                      <option value="Quay thật nhanh để AI hoa mắt">
                        Lắc tay thật nhanh để AI hoa mắt 🌪️
                      </option>
                      <option value="Chỉ cần 1 ảnh tĩnh là đủ">
                        Chỉ cần 1 ảnh tĩnh không cần quay cử chỉ 🛑
                      </option>
                    </select>
                  </div>

                  {/* Text feedback */}
                  <div className="mb-6">
                    <label className="text-xs font-black text-gray-700 block mb-1.5">Lời nhắn gửi Thầy Cô giáo:</label>
                    <textarea
                      rows={2}
                      value={teacherMessage}
                      onChange={(e) => setTeacherMessage(e.target.value)}
                      placeholder="Con gửi thầy cô bài dạy AI hành động con vừa làm..."
                      className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-teal-400 resize-none"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowSubmitModal(false)}
                      disabled={isSubmitting}
                      className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-extrabold rounded-xl hover:bg-gray-50"
                    >
                      QUAY LẠI
                    </button>
                    <button
                      onClick={handleSubmitAssignment}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-teal-600 text-white font-extrabold rounded-xl hover:bg-teal-700 border-b-4 border-teal-800 disabled:bg-gray-300"
                    >
                      {isSubmitting ? (uploadProgress || 'ĐANG GỬI...') : 'XÁC NHẬN NỘP'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

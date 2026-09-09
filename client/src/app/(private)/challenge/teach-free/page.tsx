'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Brain, HelpCircle, Camera, Trash2, ImagePlus, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { StoredSample, classifyKNN } from '@/lib/knn-classifier';
import { calculateAutoHyperparameters } from '@/lib/ml-classifier';
import { DatasetResponse, ModelResponse } from '@/types/models';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { useModelEvaluation } from '@/hooks/useModelEvaluation';
import { getStarRatingInfo } from '@/lib/scoring';
import ReportCard from '@/components/journey/ReportCard';
import CameraView from '@/components/CameraView';
import SampleGallery from '@/components/SampleGallery';
import { useCamera } from '@/hooks/useCamera';
import { useMobilenet } from '@/hooks/useMobilenet';
import { TfTrainer } from '@/lib/tf-trainer';
import { assessQuality } from '@/lib/image-quality';
import { checkMisclassification, REFERENCE_CENTROIDS, cosineSimilarity } from '@/lib/reference-embeddings';
import { matchLabelToDataset, cleanClassLabel } from '@/lib/dataset-label-mapping';

// ── Constants ──────────────────────────────────────────
/** Số mẫu tối thiểu mỗi nhãn để có thể huấn luyện (ít nhất 3 mẫu) */
const MIN_SAMPLES_PER_CLASS = 3;
/** Mục tiêu số mẫu thu thập mỗi nhãn (10 mẫu) */
const TARGET_SAMPLES_PER_CLASS = 10;
const OOD_CONFIDENCE_THRESHOLD = 65;
const OOD_MAX_KNN_DISTANCE = 1.2;

// ── Helpers ────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StudentTeachFreePage() {
  const router = useRouter();

  // ── Template ────────────────────────────────────────
  const [teacherTemplate, setTeacherTemplate] = useState<DatasetResponse | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [classes, setClasses] = useState<{ id: string; label: string; emoji?: string }[]>([]);

  // ── Data Collection ─────────────────────────────────
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [activeClass, setActiveClass] = useState<string>('');

  // ── Training ────────────────────────────────────────
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingLogs, setTrainingLogs] = useState<{ epoch: number; loss: number; acc: number }[]>([]);

  // ── Prediction ──────────────────────────────────────
  const [predictedLabel, setPredictedLabel] = useState('Chưa nhận diện... 🤔');
  const [confidence, setConfidence] = useState(0);
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [predictionActive, setPredictionActive] = useState(false);
  const [isDetectedInLibrary, setIsDetectedInLibrary] = useState(false);
  const lastActiveTimeRef = useRef<number>(Date.now());
  const activeStreakRef = useRef<number>(0);
  const idleStreakRef = useRef<number>(0);
  const isDetectedRef = useRef<boolean>(false);

  // ── Hold-to-Record ──────────────────────────────────
  const [isCapturing, setIsCapturing] = useState(false);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Static Image Test ───────────────────────────────
  const [predictImage, setPredictImage] = useState<string | null>(null);
  const [predictResult, setPredictResult] = useState<{ label: string; confidence: number; confidences: Record<string, number>; isOOD: boolean; reason?: string } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const predictFileRef = useRef<HTMLInputElement | null>(null);

  // ── Submission ──────────────────────────────────────
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp ảnh rõ nét từ nhiều góc khác nhau');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [createdModelId, setCreatedModelId] = useState<string | null>(null);

  // ── View Teacher Samples ────────────────────────────
  const [showTeacherSamples, setShowTeacherSamples] = useState(false);

  // ── UI ──────────────────────────────────────────────
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Refs ────────────────────────────────────────────
  const trainerRef = useRef<TfTrainer | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    trainerRef.current = new TfTrainer();
  }, []);

  // ── Camera & MobileNet ──────────────────────────────
  const { videoRef, canvasRef, cameraError, retryCamera } = useCamera({ width: 640, height: 480 });
  const { modelStatus, extractFeaturesFromVideo, extractFeaturesFromBase64 } = useMobilenet();

  // ── Toast helper ────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setValidationToast(msg);
    toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 4000);
  }, []);

  // ── Fetch Teacher Template ──────────────────────────
  useEffect(() => {
    let ignore = false;
    api.getTemplates('teach-free')
      .then(async (res) => {
        if (ignore) return;
        if (res && res.length > 0) {
          const template = res[0];
          try {
            const fileData = await api.getDatasetFile(template.id);
            template.samples = fileData.samples || (Array.isArray(fileData) ? fileData : []);
          } catch (e) {
            console.error('Failed to load template samples', e);
          }
          if (ignore) return;
          setTeacherTemplate(template);
          if (template.customClasses && template.customClasses.length > 0) {
            setClasses(template.customClasses.map((c: { id: string; label: string; emoji?: string }) => ({
              id: c.id,
              label: cleanClassLabel(c.label, c.emoji) || c.label,
              emoji: c.emoji || '✨'
            })));
            setActiveClass(template.customClasses[0].id);
          }
        }
        setTemplateLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        console.error('Failed to load template', err);
        setTemplateLoading(false);
      });
    return () => { ignore = true; };
  }, []);

  // ── Evaluation Hook ─────────────────────────────────
  const {
    evaluation,
    previousEvaluation,
    modelVersion,
    isEvaluating,
    runEvaluation,
  } = useModelEvaluation({
    challengeType: 'teach-free',
    classes,
    goldenDataset: [],
    dynamicDataset: [],
    teacherSamples: teacherTemplate?.samples,
  });

  // ── Capture from camera ─────────────────────────────
  const captureSample = useCallback(() => {
    if (modelStatus !== 'ready' || !videoRef.current || !activeClass) return;

    const video = videoRef.current;
    const features = extractFeaturesFromVideo(video);
    if (!features) {
      showToast('⚠️ Không thể trích xuất đặc trưng. Hãy thử lại!');
      return;
    }

    const vW = video.videoWidth || 640;
    const vH = video.videoHeight || 480;
    const cv = document.createElement('canvas');
    cv.width = vW; cv.height = vH;
    const ctx = cv.getContext('2d');
    if (ctx) ctx.drawImage(video, 0, 0, vW, vH);
    const thumbnail = cv.toDataURL('image/jpeg', 0.8);

    const quality = ctx ? assessQuality(cv) : undefined;
    const isQualityOk = !(quality?.isDark || quality?.isBlurry);

    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';

    // Zero-Shot Cross-Check: bắt buộc ảnh phải có thể thuộc nhãn đó
    // Nếu khác tên nhãn hoặc là ảnh lạ (OOD) -> vẫn đưa vào Thư viện ảnh nhưng chỉ cảnh báo viền đỏ ảnh lạ thôi, trên khung tên nhãn thì không tính cộng ảnh vào
    const mischeck = checkMisclassification(
      features,
      activeClassLabel,
      classes.map((c) => c.label)
    );

    // Ảnh chỉ hợp lệ khi đạt chất lượng và không có dấu hiệu sai nhãn / ảnh lạ
    const isValid = isQualityOk && !mischeck.isSuspect;

    if (!isQualityOk && quality) {
      const msg = quality.isDark ? 'Ảnh hơi tối! 🌙' : 'Ảnh hơi mờ! 📸';
      showToast(`⚠️ ${msg}`);
    } else if (mischeck.isSuspect) {
      showToast(mischeck.message || '⚠️ Ảnh vừa chụp có dấu hiệu sai nhãn hoặc là ảnh lạ (đã đánh dấu viền đỏ trong Thư viện, không tính vào số mẫu)!');
    }

    setSamples((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: activeClassLabel,
        sourceId: activeClass,
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
  }, [modelStatus, videoRef, activeClass, classes, extractFeaturesFromVideo, showToast]);

  // ── Hold-to-Record ──────────────────────────────────
  const startCapturing = useCallback(() => {
    if (modelStatus !== 'ready' || !activeClass) return;
    playClickSound();
    setIsCapturing(true);
    captureSample();
    captureIntervalRef.current = setInterval(captureSample, 300);
  }, [modelStatus, activeClass, captureSample]);

  const stopCapturing = useCallback(() => {
    setIsCapturing(false);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, []);

  // ── File Upload (batch) ─────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    let firstSuspectMsg = '';

    for (const file of imageFiles) {
      try {
        const base64 = await fileToBase64(file);
        const features = await extractFeaturesFromBase64(base64);
        if (features) {
          // Zero-Shot Cross-Check: bắt buộc ảnh phải có thể thuộc nhãn đó
          // Nếu khác tên nhãn hoặc là ảnh lạ (OOD) -> vẫn đưa vào Thư viện ảnh nhưng chỉ cảnh báo viền đỏ ảnh lạ thôi, trên khung tên nhãn thì không tính cộng ảnh vào
          const mischeck = checkMisclassification(
            features,
            activeClassLabel,
            classes.map((c) => c.label)
          );

          if (mischeck.isSuspect) {
            misclassifiedCount++;
            if (!firstSuspectMsg) {
              firstSuspectMsg = mischeck.message || '';
            }
          }

          newSamples.push({
            id: crypto.randomUUID(),
            label: activeClassLabel,
            sourceId: activeClass,
            features,
            thumbnail: base64,
            rawThumbnail: base64,
            isValid: !mischeck.isSuspect,
            isQuestionable: mischeck.isSuspect,
            questionableReason: mischeck.message,
          });
        }
      } catch {
        // skip failed files
      }
    }

    if (newSamples.length > 0) {
      setSamples((prev) => [...prev, ...newSamples]);
      setIsTrained(false);
      const validAddedCount = newSamples.filter((s) => s.isValid !== false && !s.isQuestionable).length;
      if (misclassifiedCount > 0) {
        showToast(
          firstSuspectMsg
            ? `${firstSuspectMsg} (Đã thêm vào Thư viện với viền đỏ cảnh báo, không tính vào số mẫu!)`
            : `⚠️ Phát hiện ${misclassifiedCount} ảnh lạ / sai nhãn (đã thêm vào Thư viện với viền đỏ cảnh báo, không tính vào số mẫu)!`
        );
      } else {
        showToast(`✅ Đã thêm ${validAddedCount} ảnh hợp lệ cho "${activeClassLabel}"!`);
      }
      playClickSound();
    } else {
      showToast('⚠️ Không thể trích xuất đặc trưng từ ảnh đã chọn!');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [activeClass, classes, extractFeaturesFromBase64, showToast]);

  // ── Clear samples ───────────────────────────────────
  const clearClassSamples = useCallback((classId: string) => {
    setSamples((prev) => prev.filter((s) => s.sourceId !== classId));
    setIsTrained(false);
  }, []);

  // ── Can Train check ─────────────────────────────────
  const canTrain = useMemo(() => {
    if (classes.length < 2 || modelStatus !== 'ready') return false;
    return classes.every((c) => {
      const count = samples.filter(
        (s) => s.isValid !== false && !s.isQuestionable && s.sourceId === c.id
      ).length;
      return count >= MIN_SAMPLES_PER_CLASS;
    });
  }, [classes, samples, modelStatus]);

  // ── Training ────────────────────────────────────────
  const handleTrain = useCallback(async () => {
    if (!canTrain) {
      showToast(`⚠️ Cần ít nhất ${MIN_SAMPLES_PER_CLASS} ảnh hợp lệ cho mỗi nhãn (mục tiêu ${TARGET_SAMPLES_PER_CLASS} mẫu)!`);
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingLogs([]);
    playClickSound();

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
              features: noisy.map((v) => v / norm),
              thumbnail: '',
              isValid: true,
            });
          }
        }
      }

      const autoParams = calculateAutoHyperparameters(validSamples.length);
      if (trainerRef.current) {
        await trainerRef.current.train(
          trainingDatasetSamples,
          (_epoch, progress, loss, acc) => {
            setTrainingProgress(progress);
            setTrainingLogs((prev) => [...prev, { epoch: _epoch, loss, acc }]);
          },
          { epochs: autoParams.epochs, batchSize: autoParams.batchSize, learningRate: autoParams.learningRate }
        );
        setIsTraining(false);
        setIsTrained(true);
        playSuccessSound();
        speakEnglish('Learning complete!');
      }
    } catch (err) {
      console.error('Training failed:', err);
      setIsTraining(false);
      showToast('❌ Huấn luyện thất bại. Hãy kiểm tra dữ liệu và thử lại.');
    }
  }, [canTrain, samples, classes, showToast]);

  // ── Prediction loop — chỉ chạy khi user bật predictionActive ──
  useEffect(() => {
    if (!predictionActive || !isTrained || modelStatus !== 'ready' || !trainerRef.current) return;

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

          // Đối soát chặt chẽ với Thư viện ảnh để loại bỏ phông nền/rác (OOD):
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

          // Khung hình thuộc Thư viện ảnh khi: NN tự tin >= 65% VÀ khớp mẫu thư viện (sim >= 0.65)
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
              if (result.confidences) {
                setConfidences(result.confidences);
              }
            }
          } else {
            idleStreakRef.current++;
            activeStreakRef.current = 0;

            if (idleStreakRef.current >= 4) {
              if (isDetectedRef.current) {
                isDetectedRef.current = false;
                setIsDetectedInLibrary(false);
                setConfidence(0);
                setPredictedLabel('Đang chờ đối tượng... 💤');
                const zeroConf: Record<string, number> = {};
                classes.forEach((c) => { zeroConf[c.label] = 0; });
                setConfidences(zeroConf);
              }

              // Tự động tắt nhận diện sau đúng 10s không có đối tượng trong Thư viện ảnh (chạy ngầm)
              const idleMs = Date.now() - lastActiveTimeRef.current;
              if (idleMs >= 10000) {
                setPredictionActive(false);
                setIsDetectedInLibrary(false);
                isDetectedRef.current = false;
                playClickSound();
                showToast('💤 Đã tự động tắt nhận diện do không có đối tượng trong Thư viện ảnh.');
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

  // ── Upload ảnh để dự đoán (Static Test với 4-Tier Bulletproof OOD) ──
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
        setPredictResult({
          label: result.label,
          confidence: result.confidence,
          confidences: result.confidences || {},
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

  // ── Self-Evaluation (LOO-KNN) ───────────────────────
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

  // ── Submit Flow ─────────────────────────────────────
  const handleTrainComplete = useCallback(() => {
    if (!isTrained) { showToast('⚠️ Hãy huấn luyện mô hình trước!'); return; }
    setSubmitScore(selfAccuracy ?? 100);
    setShowSubmitModal(true);
    playClickSound();
  }, [isTrained, selfAccuracy, showToast]);

  const handleSubmitAssignment = useCallback(async () => {
    if (submitScore === null) return;
    try {
      setIsSubmitting(true);

      let processedSamples = samples;
      if (isCloudinaryConfigured()) {
        setUploadProgress('Đang tải ảnh lên Cloud...');
        processedSamples = await uploadSamplesToCloudinary(
          samples, 'teach-free',
          (uploaded, total) => setUploadProgress(`Tải ảnh ${uploaded}/${total}...`)
        );
        setUploadProgress('Đang lưu bài...');
      }

      const created = await api.createDataset('teach-free', processedSamples, submitScore, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`);
      if (created?.model?.id) {
        setCreatedModelId(created.model.id);

        await api.updateModelArtifacts(created.model.id, {
          algorithm: 'neural_network',
          testScore: submitScore,
          hyperparameters: calculateAutoHyperparameters(processedSamples.length),
        }).catch(() => {});

        // Upload model blobs
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

        // Run evaluation
        setUploadProgress('Đang đánh giá AI...');
        await runEvaluation(processedSamples, created.model.id);
      }

      await api.submitAssignment(submitScore, { samples: processedSamples }, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`, 'teach-free');
      await api.saveProgress('teach-free', submitScore);

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
  }, [submitScore, samples, reflectionAnswer, teacherMessage, runEvaluation]);

  const handleRevise = useCallback(() => {
    setShowReportCard(false);
    setShowSubmitModal(false);
    setSubmitSuccess(false);
    setCreatedModelId(null);
    playClickSound();
  }, []);

  const handleFinalize = useCallback(async () => {
    try {
      setUploadProgress('Đang tổng hợp điểm kỹ năng...');
      setIsSubmitting(true);
      setShowReportCard(false);
      setShowSubmitModal(true);

      const chain = await api.getModelChain('teach-free').catch(() => []);

      let dataCurationScore = 0;
      let debuggingScore = 0;
      let improvementScore = 0;
      let overallScore = 0;
      const strengths: string[] = [];
      const improvements: string[] = [];
      let summary = '';

      if (chain.length > 0) {
        const latest = chain[chain.length - 1];
        const eval_ = latest.evaluation;

        if (eval_?.datasetHealth) {
          const dh = eval_.datasetHealth;
          dataCurationScore = Math.round((dh.qualityScore + dh.balanceRatio * 100) / 2);
          if (dh.blurrySampleCount > 0) dataCurationScore -= dh.blurrySampleCount * 2;
          if (dh.darkSampleCount > 0) dataCurationScore -= dh.darkSampleCount * 2;
          dataCurationScore = Math.max(0, Math.min(100, dataCurationScore));
        }

        if (eval_?.confusionMatrix) {
          const cm = eval_.confusionMatrix;
          const minAcc = Math.min(...Object.values(cm.perClassAccuracy) as number[]);
          debuggingScore = minAcc;
        }

        if (chain.length > 1) {
          const first = chain[0];
          const improvement = latest.testScore - first.testScore;
          improvementScore = Math.max(0, Math.min(100, 50 + improvement));
        } else {
          improvementScore = dataCurationScore;
        }

        overallScore = Math.round((dataCurationScore + debuggingScore + improvementScore) / 3);

        if (overallScore >= 80) summary = 'Bé thể hiện kỹ năng dạy AI xuất sắc!';
        else if (overallScore >= 60) summary = 'Bé đã biết cách dạy AI, nhưng cần cẩn thận hơn.';
        else summary = 'Bé cần chú ý chụp ảnh rõ nét và đủ số lượng cho các nhãn nhé.';

        if (dataCurationScore >= 80) strengths.push('Chụp ảnh rõ nét và dữ liệu cân bằng tốt.');
        else improvements.push('Cần chụp ảnh rõ nét hơn, tránh ảnh bị mờ hoặc tối.');

        if (debuggingScore >= 80) strengths.push('Không có nhãn nào bị yếu quá mức, AI học đều.');
        else improvements.push(`Cải thiện thêm cho nhãn "${eval_?.confusionMatrix?.weakestLabel || 'nhãn yếu nhất'}".`);

        const formattedChain = chain.map((m: ModelResponse) => ({
          modelId: m.id,
          version: m.version || 1,
          testScore: m.testScore,
          sampleCount: m.evaluation?.datasetHealth?.sampleCount || 0,
          classSummary: m.evaluation?.datasetHealth?.classSummary || {}
        }));

        await api.upsertAssessment({
          challengeType: 'teach-free',
          modelChain: formattedChain,
          dataCurationScore,
          debuggingScore,
          improvementScore,
          overallScore,
          narrative: { summary, strengths, improvements }
        });
      }

      setSubmitSuccess(true);
      playSuccessSound();
      speakEnglish('Submission successful!');
    } catch (err) {
      console.error('Failed to finalize', err);
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  }, []);

  // ════════════════════════════════════════════════════
  //  JSX
  // ════════════════════════════════════════════════════

  // Loading state
  if (templateLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 via-cyan-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-bounce">🧪</div>
          <p className="text-lg font-bold text-teal-700">Đang tải bài tập...</p>
        </div>
      </div>
    );
  }

  // No template
  if (!teacherTemplate || classes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 via-cyan-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border-4 border-teal-200 shadow-xl">
          <span className="text-6xl">📭</span>
          <h2 className="text-2xl font-black text-slate-800 mt-4 mb-2">Chưa Có Bài Tập</h2>
          <p className="text-slate-600 font-medium mb-6">
            Thầy/Cô giáo chưa tạo bài tập phân loại ảnh tạo nhãn tự do. Hãy quay lại sau nhé!
          </p>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white font-bold rounded-full hover:bg-teal-600 transition-transform hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5" /> Về Trang Chủ
          </Link>
        </div>
      </div>
    );
  }

  const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || '';
  const totalSamples = samples.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-cyan-50 to-indigo-100 py-8 px-4 select-none">
      <div className="max-w-[1600px] w-[98%] mx-auto">

        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <Link
            href="/home"
            onClick={playClickSound}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-teal-200 text-teal-700 font-extrabold shadow-sm hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Về Trang Chủ</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧪🧠</span>
            <h1 className="text-2xl md:text-3xl font-black text-teal-900">Bé Tập Phân Loại Ảnh Tạo Nhãn Tự Do</h1>
          </div>
        </div>

        {/* Main content — conditional render */}
        {!showSubmitModal && !showReportCard && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ══ LEFT: Controls ══ */}
            <div className="flex flex-col gap-4">

              {/* MobileNet Status */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold ${
                modelStatus === 'ready' ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200' :
                modelStatus === 'error' ? 'bg-red-50 text-red-700 border-2 border-red-200' :
                'bg-amber-50 text-amber-700 border-2 border-amber-200 animate-pulse'
              }`}>
                <span>{modelStatus === 'ready' ? '🟢' : modelStatus === 'error' ? '🔴' : '🟡'}</span>
                {modelStatus === 'ready' ? 'MobileNet sẵn sàng' : modelStatus === 'error' ? 'Lỗi tải MobileNet' : 'Đang tải MobileNet...'}
              </div>

              {/* Teacher Info */}
              {teacherTemplate?.teacherNotes && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 text-sm">
                  <span className="font-bold text-blue-700">📝 Ghi chú từ Thầy/Cô:</span>
                  <p className="text-blue-600 mt-1">{teacherTemplate.teacherNotes}</p>
                </div>
              )}

              {/* Class Selector (readonly) */}
              <div className="bg-white rounded-2xl p-4 border-2 border-teal-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-700 mb-3">🏷️ Nhãn bài tập (từ Thầy/Cô)</h3>
                <div className="flex flex-wrap gap-2">
                  {classes.map((c) => {
                    const count = samples.filter((s) => s.sourceId === c.id).length;
                    const validCount = samples.filter((s) => s.sourceId === c.id && s.isValid !== false && !s.isQuestionable).length;
                    const hasTarget = validCount >= TARGET_SAMPLES_PER_CLASS;
                    const canTrainClass = validCount >= MIN_SAMPLES_PER_CLASS;

                    return (
                      <button
                        key={c.id}
                        onClick={() => { setActiveClass(c.id); playClickSound(); }}
                        className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                          activeClass === c.id
                            ? 'bg-teal-500 text-white border-2 border-teal-600 shadow-md scale-105'
                            : 'bg-gray-100 text-gray-700 border-2 border-gray-200 hover:border-teal-300'
                        }`}
                      >
                        <span>{c.emoji || '✨'}</span>
                        <span>{c.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                          hasTarget
                            ? 'bg-emerald-100 text-emerald-800'
                            : canTrainClass
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {validCount}/{TARGET_SAMPLES_PER_CLASS}
                        </span>
                        {hasTarget ? (
                          <span className="text-[10px] text-emerald-600 font-bold hidden sm:inline">✅ Đủ</span>
                        ) : canTrainClass ? (
                          <span className="text-[10px] text-indigo-600 font-bold hidden sm:inline">✅ Có thể dạy</span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-bold hidden sm:inline">⚠️ Thiếu {MIN_SAMPLES_PER_CLASS - validCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Capture buttons */}
              {activeClass && (
                <div className="bg-white rounded-2xl p-4 border-2 border-teal-200 shadow-sm space-y-3">
                  <h3 className="text-sm font-black text-slate-700">
                    📷 Thu thập ảnh cho: {activeClassLabel} {classes.find((c) => c.id === activeClass)?.emoji || ''}
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onPointerDown={startCapturing}
                      onPointerUp={stopCapturing}
                      onPointerLeave={stopCapturing}
                      disabled={modelStatus !== 'ready'}
                      className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                        isCapturing
                          ? 'bg-red-500 text-white border-2 border-red-600 animate-pulse'
                          : 'bg-teal-500 text-white border-2 border-teal-600 hover:bg-teal-600'
                      } disabled:bg-gray-300 disabled:border-gray-400`}
                    >
                      <Camera className="w-4 h-4" />
                      {isCapturing ? 'Đang chụp...' : 'Giữ để chụp'}
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={modelStatus !== 'ready'}
                      className="py-3 rounded-xl font-bold text-sm bg-indigo-500 text-white border-2 border-indigo-600 hover:bg-indigo-600 flex items-center justify-center gap-1.5 disabled:bg-gray-300 disabled:border-gray-400"
                    >
                      <ImagePlus className="w-4 h-4" />
                      Tải ảnh lên
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Sample Gallery */}
              {activeClass && (
                <SampleGallery
                  samples={samples.filter((s) => s.sourceId === activeClass)}
                  onDeleteSample={(id) => { setSamples((prev) => prev.filter((s) => s.id !== id)); setIsTrained(false); }}
                  onClearAll={() => clearClassSamples(activeClass)}
                  isTrained={isTrained}
                />
              )}

              {/* View Teacher Samples */}
              {teacherTemplate?.samples && teacherTemplate.samples.length > 0 && (
                <button
                  onClick={() => setShowTeacherSamples(!showTeacherSamples)}
                  className="w-full text-xs font-bold text-slate-400 hover:text-teal-600 flex items-center justify-center gap-1 py-1 transition-colors"
                >
                  {showTeacherSamples ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showTeacherSamples ? 'Ẩn ảnh mẫu từ Thầy/Cô ▲' : 'Xem ảnh mẫu từ Thầy/Cô ▼'}
                </button>
              )}

              {showTeacherSamples && teacherTemplate?.samples && (
                <div className="bg-blue-50 rounded-2xl p-3 border-2 border-blue-200">
                  <h4 className="text-xs font-black text-blue-700 mb-2">📋 Ảnh mẫu từ Thầy/Cô ({teacherTemplate.samples.length} ảnh)</h4>
                  {classes.map((c) => {
                    const classSamples = teacherTemplate.samples?.filter((s: StoredSample) => s.sourceId === c.id || s.label === c.label) || [];
                    if (classSamples.length === 0) return null;
                    return (
                      <div key={c.id} className="mb-2">
                        <span className="text-[10px] font-bold text-blue-600">{c.emoji || '✨'} {c.label} ({classSamples.length} ảnh)</span>
                        <div className="flex gap-1 overflow-x-auto py-1">
                          {classSamples.slice(0, 8).map((s: StoredSample, idx: number) => (
                            <div key={idx} className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-blue-200">
                              {s.thumbnail && <img src={s.thumbnail} alt={c.label} className="w-full h-full object-cover" />}
                            </div>
                          ))}
                          {classSamples.length > 8 && (
                            <div className="w-12 h-12 shrink-0 rounded-lg bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                              +{classSamples.length - 8}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Toast */}
              {validationToast && (
                <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-2xl text-sm font-bold text-yellow-700 flex items-center gap-2 animate-bounce shadow-lg">
                  <span className="text-xl">⚠️</span>
                  <span>{validationToast}</span>
                </div>
              )}

              {/* Train + Submit */}
              <div className="mt-auto pt-4 space-y-2">
                {isTraining ? (
                  <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-teal-700">AI đang học phân loại ảnh... ⚙️</span>
                      <span className="text-xs font-black text-teal-800">{trainingProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className="bg-teal-600 h-full transition-all duration-150" style={{ width: `${trainingProgress}%` }} />
                    </div>
                    {trainingLogs.length > 0 && (
                      <div className="flex gap-4 mt-2 text-[10px] font-bold text-teal-600">
                        <span>Loss: {trainingLogs[trainingLogs.length - 1].loss.toFixed(4)}</span>
                        <span>Acc: {(trainingLogs[trainingLogs.length - 1].acc * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleTrain}
                      disabled={!canTrain}
                      className={`w-full font-extrabold py-3.5 px-6 rounded-2xl shadow-lg border-b-4 flex items-center justify-center gap-2 text-lg transition-all ${
                        canTrain
                          ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white'
                          : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Brain className="w-6 h-6" />
                      {isTrained ? 'HUẤN LUYỆN LẠI 🔄' : 'DẠY AI HỌC 🚀'}
                    </button>

                    {isTrained && (
                      <button
                        onClick={handleTrainComplete}
                        className="w-full font-extrabold py-3 px-6 rounded-2xl shadow-md border-b-4 bg-purple-500 hover:bg-purple-600 border-purple-700 text-white flex items-center justify-center gap-2 text-base transition-all"
                      >
                        📤 NỘP BÀI CHO THẦY CÔ
                      </button>
                    )}
                  </>
                )}

                {!canTrain && classes.length > 0 && (
                  <p className="text-xs text-center text-slate-400 font-semibold">
                    📌 Cần ít nhất {MIN_SAMPLES_PER_CLASS} ảnh hợp lệ cho mỗi nhãn (mục tiêu {TARGET_SAMPLES_PER_CLASS} mẫu)
                  </p>
                )}
              </div>
            </div>

            {/* ══ CENTER + RIGHT: Camera & Prediction ══ */}
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
                          setPredictedLabel('Đang chờ đối tượng... 💤');
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

                      {/* Per-class confidence bars — CHỈ HIỆN KHI PHÁT HIỆN ĐỐI TƯỢNG TRONG THƯ VIỆN */}
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

                  {/* Self-Evaluation */}
                  {selfAccuracy !== null && totalSamples >= 6 && (
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
                                <p className="font-bold text-red-200 text-sm flex items-center gap-1.5">
                                  🚫 Không nhận diện được (Ảnh lạ)
                                </p>
                                <p className="text-xs text-red-300 mt-1 font-medium leading-relaxed">
                                  {predictResult.reason || 'Ảnh này không giống với các nhãn đã học hoặc nằm ngoài bộ dữ liệu.'}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <div className="text-lg font-black text-emerald-300 flex items-center gap-1.5">
                                  ✅ {predictResult.label}
                                </div>
                                <div className="text-xs opacity-80 mt-0.5">Độ tự tin: {predictResult.confidence}%</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Confidence bars — chỉ hiện khi ảnh thuộc Thư viện / Hợp lệ */}
                        {!predictResult.isOOD && Object.keys(predictResult.confidences).length > 0 && (
                          <div className="bg-white/10 rounded-xl p-3 space-y-1.5 mt-2">
                            {classes.map((c) => {
                              const pct = Math.round((predictResult.confidences[c.label] || 0) * 100);
                              return (
                                <div key={c.id} className="flex items-center gap-2">
                                  <span className="text-xs font-bold w-24 truncate">{c.emoji} {c.label}</span>
                                  <div className="flex-1 bg-white/10 rounded-full h-2.5 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-200"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold w-10 text-right">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ReportCard Modal */}
        {showReportCard && evaluation && (
          <ReportCard
            isOpen={showReportCard}
            onClose={() => setShowReportCard(false)}
            onRevise={handleRevise}
            onFinalize={handleFinalize}
            evaluation={evaluation}
            version={modelVersion}
            previousEvaluation={previousEvaluation}
          />
        )}

        {/* Submission Modal */}
        {showSubmitModal && (
          <div className="flex justify-center animate-in fade-in zoom-in duration-300">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 border-4 border-teal-400 shadow-2xl relative overflow-hidden">
              {submitSuccess ? (
                <div className="text-center py-8">
                  <span className="text-7xl">🏆🎉</span>
                  <h3 className="text-2xl font-black text-teal-900 mt-4">Nộp Bài Hoàn Tất!</h3>
                  <p className="text-gray-600 font-semibold mt-2">
                    Tuyệt vời! Bé đã dạy AI phân loại ảnh thành công! Bé có thể tiếp tục thử nghiệm thêm hoặc quay về trang chủ.
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
                          <span className="text-xs text-teal-700 font-bold block">Bạn AI đoán đúng bao nhiêu câu:</span>
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
                      <span>Bé hãy trả lời: Làm sao để AI phân loại ảnh chuẩn nhất?</span>
                    </label>
                    <select
                      value={reflectionAnswer}
                      onChange={(e) => setReflectionAnswer(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-teal-400"
                    >
                      <option value="Chụp ảnh rõ nét từ nhiều góc khác nhau">
                        Chụp ảnh rõ nét từ nhiều góc, nhiều kích thước khác nhau 📸
                      </option>
                      <option value="Chỉ cần 1 ảnh duy nhất là đủ">
                        Chỉ cần chụp 1 ảnh duy nhất là AI hiểu hết rồi 🤪
                      </option>
                      <option value="Chụp ảnh mờ nhòe và thiếu sáng">
                        Chụp ảnh mờ nhòe để AI tập trung hơn 🌫️
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
                      placeholder="Con gửi thầy cô bài phân loại ảnh con vừa dạy AI..."
                      className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-teal-400 resize-none"
                    />
                  </div>

                  {/* Submit Actions */}
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

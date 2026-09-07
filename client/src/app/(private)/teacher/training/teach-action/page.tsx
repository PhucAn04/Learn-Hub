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

const MIN_SAMPLES_PER_CLASS = 5;
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

  // ── Hold-to-Record ─────────────────────────────────────
  const [capturingType, setCapturingType] = useState<'gesture' | 'object' | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Upload để dự đoán ──────────────────────────────────
  const [predictImage, setPredictImage] = useState<string | null>(null);
  const [predictResult, setPredictResult] = useState<{ label: string; confidence: number; confidences: Record<string, number>; isOOD: boolean } | null>(null);
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

  // ── Refs ───────────────────────────────────────────────
  const trainerRef = useRef<TfTrainer | null>(null);
  const fileInputObjectRef = useRef<HTMLInputElement | null>(null);
  const fileInputGestureRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    trainerRef.current = new TfTrainer();
  }, []);

  const { videoRef, canvasRef, cameraError, retryCamera } = useCamera({ width: 640, height: 480 });
  const { modelStatus, extractFeaturesFromVideo, extractFeaturesFromBase64 } = useMobilenet();

  // ── Toast ──────────────────────────────────────────────
  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setValidationToast(msg);
    toastTimeoutRef.current = setTimeout(() => setValidationToast(null), 4000);
  };

  // ── Class Management ───────────────────────────────────
  const addClass = () => {
    const label = newLabelInput.trim();
    if (!label) return;
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
    const quality = ctx ? assessQuality(cv) : undefined;
    const isValid = !(quality?.isDark || quality?.isBlurry);

    if (!isValid && quality) {
      showToast(`⚠️ ${quality.isDark ? 'Ảnh hơi tối! 🌙' : 'Ảnh hơi mờ! 📸'}`);
    }

    const activeClassLabel = classes.find((c) => c.id === activeClass)?.label || 'Không tên';
    setSamples((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: activeClassLabel, sourceId: activeClass, sourceType: type, features, thumbnail, rawThumbnail: thumbnail, isValid, quality },
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

  useEffect(() => {
    return () => { if (captureIntervalRef.current) clearInterval(captureIntervalRef.current); };
  }, [activeClass]);

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
    for (const file of validImageFiles) {
      try {
        const base64 = await fileToBase64(file);
        const features = await extractFeaturesFromBase64(base64);
        if (!features) continue;
        newSamples.push({
          id: crypto.randomUUID(),
          label: activeClassLabel,
          sourceId: activeClass,
          sourceType: type,
          features,
          thumbnail: base64,
          rawThumbnail: base64,
          isValid: true,
        });
      } catch (err) {
        console.error('Failed to process uploaded image:', err);
      }
    }

    if (newSamples.length > 0) {
      setSamples((prev) => [...prev, ...newSamples]);
      showToast(`✅ Đã thêm ${newSamples.length} ảnh ${typeLabel} cho "${activeClassLabel}"!`);
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
    return classes.every((c) => samples.filter((s) => s.isValid !== false && s.sourceId === c.id).length >= MIN_SAMPLES_PER_CLASS);
  }, [classes, samples]);

  const handleTrain = async () => {
    if (!canTrain) { showToast(`⚠️ Cần ít nhất ${MIN_SAMPLES_PER_CLASS} ảnh hợp lệ cho mỗi nhãn!`); return; }
    setIsTraining(true); setTrainingProgress(0); setTrainingLogs([]); playClickSound();
    try {
      const validSamples = samples.filter((s) => s.isValid !== false);
      if (trainerRef.current) {
        await trainerRef.current.train(validSamples, (_epoch, progress, loss, acc) => {
          setTrainingProgress(progress);
          setTrainingLogs((prev) => [...prev, { epoch: _epoch, loss, acc }]);
        }, { epochs: hpEpochs, batchSize: hpBatchSize, learningRate: hpLearningRate });
        setIsTraining(false); setIsTrained(true); playSuccessSound();
        speakEnglish('Learning complete. Let us test!');
      }
    } catch (err) { console.error('Training failed:', err); setIsTraining(false); showToast('❌ Huấn luyện thất bại.'); }
  };

  // ── Prediction loop ────────────────────────────────────
  useEffect(() => {
    if (!predictionActive || !isTrained || modelStatus !== 'ready' || !trainerRef.current) return;
    let rafId: number;
    let oodCount = 0;
    const validSamples = samples.filter((s) => s.isValid !== false);

    const predict = async () => {
      if (!videoRef.current || !trainerRef.current?.isTrained()) { rafId = requestAnimationFrame(predict); return; }
      try {
        const features = extractFeaturesFromVideo(videoRef.current);
        if (features) {
          const result = await trainerRef.current.predict(features);
          let minDist = Infinity;
          for (const s of validSamples) {
            let dist = 0;
            for (let i = 0; i < features.length && i < s.features.length; i++) { const d = features[i] - s.features[i]; dist += d * d; }
            dist = Math.sqrt(dist);
            if (dist < minDist) minDist = dist;
          }
          const isOod = result.confidence < OOD_CONFIDENCE_THRESHOLD || minDist > OOD_MAX_KNN_DISTANCE;
          if (isOod) { oodCount++; if (oodCount > 10) { setPredictionActive(false); showToast('👀 Không thấy cử chỉ đã học. Đã tắt nhận diện.'); return; } }
          else { oodCount = 0; setPredictedLabel(result.label); setConfidence(result.confidence); if (result.confidences) setConfidences(result.confidences); }
        }
      } catch { /* skip */ }
      rafId = requestAnimationFrame(predict);
    };
    predict();
    return () => cancelAnimationFrame(rafId);
  }, [predictionActive, isTrained, modelStatus, samples, extractFeaturesFromVideo, videoRef]);

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
      const result = await trainerRef.current.predict(features);
      const validSamples = samples.filter((s) => s.isValid !== false);
      const isLowConf = result.confidence < OOD_CONFIDENCE_THRESHOLD;
      let isFar = false;
      if (validSamples.length > 0) {
        let minDist = Infinity;
        for (const s of validSamples) { let dist = 0; for (let i = 0; i < features.length && i < s.features.length; i++) { const d = features[i] - s.features[i]; dist += d * d; } dist = Math.sqrt(dist); if (dist < minDist) minDist = dist; }
        isFar = minDist > OOD_MAX_KNN_DISTANCE;
      }
      setPredictResult({ label: (isLowConf || isFar) ? 'Không nhận diện được' : result.label, confidence: result.confidence, confidences: result.confidences || {}, isOOD: isLowConf || isFar });
    } catch { showToast('❌ Lỗi khi dự đoán ảnh.'); }
    finally { setIsPredicting(false); if (predictFileRef.current) predictFileRef.current.value = ''; }
  };

  // ── Self-Evaluation ────────────────────────────────────
  const selfAccuracy = useMemo(() => {
    const validSamples = samples.filter((s) => s.isValid !== false);
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
      let processedSamples = samples;
      if (isCloudinaryConfigured()) {
        setUploadProgress('Đang tải ảnh lên Cloud...');
        processedSamples = await uploadSamplesToCloudinary(samples, 'teach-action', (uploaded, total) => setUploadProgress(`Tải ảnh ${uploaded}/${total}...`));
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

  // ── Sample counts ──────────────────────────────────────
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    classes.forEach((c) => { counts[c.id] = samples.filter((s) => s.isValid !== false && s.sourceId === c.id).length; });
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
            <h3 className="font-black text-xl text-violet-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎭</span> Quản Lý Nhãn & Cử Chỉ
            </h3>

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
                const isActive = activeClass === c.id;
                const progress = Math.min(100, (count / MIN_SAMPLES_PER_CLASS) * 100);
                return (
                  <button key={c.id} onClick={() => { playClickSound(); setActiveClass(c.id); }}
                    className={`relative overflow-hidden p-4 rounded-2xl border-4 transition-all text-left group ${isActive ? 'border-violet-500 bg-violet-50 shadow-md scale-105 z-10' : 'border-slate-100 bg-white hover:border-violet-200'}`}
                  >
                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <div className={`font-extrabold text-lg ${isActive ? 'text-violet-800' : 'text-slate-600'}`}>{c.emoji} {c.label}</div>
                        <div className={`text-xs font-bold ${count >= MIN_SAMPLES_PER_CLASS ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {count} / {MIN_SAMPLES_PER_CLASS} cử chỉ{count >= MIN_SAMPLES_PER_CLASS && ' ✅'}
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

            {/* Split Data Collection UI */}
            {activeClass && (
              <div className="flex flex-col gap-4 mb-4 mt-2">
                {/* 1. Object Images */}
                <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200">
                  <h4 className="font-bold text-amber-900 mb-3 text-sm flex items-center gap-2">
                    <span className="bg-amber-200 text-amber-800 w-6 h-6 rounded-full flex items-center justify-center">1</span>
                    Ảnh sự vật (Chó/Mèo...)
                  </h4>
                  <div className="flex gap-2 mb-3">
                    <input ref={fileInputObjectRef} type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e, 'object')} className="hidden" />
                    <button onClick={() => fileInputObjectRef.current?.click()} disabled={modelStatus !== 'ready'}
                      className="flex-1 font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-sm border-b-4 bg-white hover:bg-amber-100 border-amber-200 text-amber-700 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <ImagePlus className="w-4 h-4" /> Tải ảnh lên
                    </button>
                    <button onPointerDown={() => startCapturing('object')} onPointerUp={stopCapturing} onPointerLeave={stopCapturing} disabled={modelStatus !== 'ready'}
                      className={`flex-1 font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-sm border-b-4 active:scale-95 disabled:bg-gray-300 select-none ${capturingType === 'object' ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white animate-pulse' : 'bg-amber-500 hover:bg-amber-600 border-amber-700 text-white'}`}
                    >
                      <Camera className="w-4 h-4" />
                      {capturingType === 'object' ? 'ĐANG CHỤP...' : 'Giữ để chụp'}
                    </button>
                  </div>
                  <SampleGallery samples={samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'object')} onDeleteSample={(id) => { setSamples((prev) => prev.filter((s) => s.id !== id)); setIsTrained(false); }} onClearAll={() => clearClassSamples(activeClass, 'object')} isTrained={isTrained} />
                </div>

                {/* 2. Gesture Images */}
                <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-200">
                  <h4 className="font-bold text-emerald-900 mb-3 text-sm flex items-center gap-2">
                    <span className="bg-emerald-200 text-emerald-800 w-6 h-6 rounded-full flex items-center justify-center">2</span>
                    Ảnh cử chỉ tay
                  </h4>
                  <div className="flex gap-2 mb-3">
                    <input ref={fileInputGestureRef} type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(e, 'gesture')} className="hidden" />
                    <button onClick={() => fileInputGestureRef.current?.click()} disabled={modelStatus !== 'ready'}
                      className="flex-1 font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-sm border-b-4 bg-white hover:bg-emerald-100 border-emerald-200 text-emerald-700 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <ImagePlus className="w-4 h-4" /> Tải ảnh lên
                    </button>
                    <button onPointerDown={() => startCapturing('gesture')} onPointerUp={stopCapturing} onPointerLeave={stopCapturing} disabled={modelStatus !== 'ready'}
                      className={`flex-1 font-bold py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-sm border-b-4 active:scale-95 disabled:bg-gray-300 select-none ${capturingType === 'gesture' ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white animate-pulse' : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white'}`}
                    >
                      <Camera className="w-4 h-4" />
                      {capturingType === 'gesture' ? 'ĐANG CHỤP...' : 'Giữ để chụp'}
                    </button>
                  </div>
                  <SampleGallery samples={samples.filter((s) => s.sourceId === activeClass && s.sourceType === 'gesture')} onDeleteSample={(id) => { setSamples((prev) => prev.filter((s) => s.id !== id)); setIsTrained(false); }} onClearAll={() => clearClassSamples(activeClass, 'gesture')} isTrained={isTrained} />
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
                  {classes.length < 2 ? '📌 Cần ít nhất 2 nhãn' : `📌 Cần ít nhất ${MIN_SAMPLES_PER_CLASS} cử chỉ cho mỗi nhãn`}
                </p>
              )}
            </div>
          </div>

          {/* ══ CENTER + RIGHT: Camera & Prediction ══ */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Camera View */}
            <div className="bg-white rounded-3xl p-6 border-4 border-violet-400 shadow-xl relative flex flex-col items-center">
              <CameraView videoRef={videoRef} canvasRef={canvasRef} modelStatus={modelStatus} cameraError={cameraError} loadingText="ĐANG TẢI AI NHẬN DIỆN CỬ CHỈ..." theme="blue" onRetry={retryCamera} />
              {modelStatus === 'ready' && (
                <div className="absolute top-8 right-8 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> MobileNet sẵn sàng
                </div>
              )}
            </div>

            {/* ══ MINI PLAYGROUND ══ */}
            {isTrained && predictionActive && Object.keys(confidences).length > 0 && (
              <div className="bg-gradient-to-r from-violet-900 to-purple-900 text-white rounded-3xl p-6 shadow-xl border-4 border-violet-400">
                <h4 className="font-black text-sm text-violet-300 tracking-widest uppercase mb-4 flex items-center gap-2">
                  🎭 Playground — Thử Cử Chỉ Realtime
                </h4>

                {/* Main result */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{classes.find((c) => c.label === predictedLabel)?.emoji || '🤖'}</span>
                    <div>
                      <span className="text-xs font-semibold text-violet-300 block">AI nhận ra cử chỉ:</span>
                      <span className="text-2xl font-black drop-shadow-md text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">{predictedLabel}</span>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl px-4 py-2 border border-white/20 text-center">
                    <span className="text-[10px] font-semibold text-violet-300 uppercase block">Độ Tự Tin</span>
                    <span className="text-2xl font-black">{confidence}<span className="text-sm text-violet-300">%</span></span>
                  </div>
                </div>

                {/* Confidence bars for all classes */}
                <div className="space-y-2 mb-4">
                  {classes.map((c) => {
                    const pct = Math.round((confidences[c.label] || 0) * 100);
                    const isTop = c.label === predictedLabel;
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="text-lg w-7 text-center shrink-0">{c.emoji}</span>
                        <span className={`text-xs font-bold w-16 truncate ${isTop ? 'text-white' : 'text-violet-300'}`}>{c.label}</span>
                        <div className="flex-1 bg-white/10 rounded-full h-5 overflow-hidden relative">
                          <div className={`h-full rounded-full transition-all duration-300 ${isTop ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-violet-400/50'}`} style={{ width: `${Math.max(2, pct)}%` }} />
                          <span className={`absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-black ${pct > 50 ? 'text-white' : 'text-violet-200'}`}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Display uploaded object images */}
                {(() => {
                  const displaySamples = samples.filter((s) => s.label === predictedLabel && s.sourceType === 'object');
                  if (displaySamples.length > 0) {
                    return (
                      <div className="bg-white/10 rounded-2xl p-4 mb-4 border border-white/20">
                        <p className="text-xs font-semibold text-violet-300 mb-2">Ảnh sự vật tương ứng:</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                          {displaySamples.slice(0, 10).map((s) => (
                            <div key={s.id} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 border-white/30 shadow-md bg-black">
                              <img src={s.thumbnail} alt={s.label} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Sliding indicator */}
                {classes.length >= 2 && (
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                    <div className="flex items-center justify-between text-sm mb-2">
                      {classes.map((c) => (
                        <span key={c.id} className={`font-bold ${c.label === predictedLabel ? 'text-amber-300' : 'text-violet-400'}`}>
                          {c.emoji} {c.label}
                        </span>
                      ))}
                    </div>
                    <div className="relative h-3 bg-white/10 rounded-full">
                      {/* Indicator dot position based on top class index */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-lg border-2 border-white transition-all duration-300"
                        style={{
                          left: `${(() => {
                            const topIdx = classes.findIndex((c) => c.label === predictedLabel);
                            if (topIdx < 0 || classes.length < 2) return 50;
                            return (topIdx / (classes.length - 1)) * 100;
                          })()}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Turn off button */}
                <div className="flex justify-end mt-3">
                  <button onClick={() => setPredictionActive(false)} className="text-[10px] font-bold text-violet-300 hover:text-red-300 transition-colors">✕ Tắt nhận diện</button>
                </div>
              </div>
            )}

            {/* Prediction toggle (when not active) */}
            {isTrained && !predictionActive && (
              <div className="bg-gradient-to-r from-violet-900 to-purple-900 text-white rounded-3xl p-6 shadow-xl border-4 border-violet-400">
                <h4 className="font-extrabold text-[11px] text-violet-300 tracking-widest uppercase mb-3">Nhận diện cử chỉ:</h4>
                <button onClick={() => setPredictionActive(true)} className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center justify-center gap-3">
                  <Camera className="w-6 h-6 text-amber-400" />
                  <span className="font-bold text-base">Bật nhận diện Camera 🎭</span>
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
                          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3"><p className="font-bold text-red-700 text-sm">🚫 Không nhận diện được</p><p className="text-[11px] text-red-500 mt-1">Ảnh không giống các cử chỉ đã học.</p></div>
                        ) : (
                          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                            <p className="text-xs text-slate-500 font-semibold">AI đoán:</p>
                            <p className="font-black text-xl text-emerald-800 flex items-center gap-2">{classes.find((c) => c.label === predictResult.label)?.emoji || '🤖'} {predictResult.label}</p>
                            <p className="text-sm font-bold text-emerald-600 mt-1">Độ tự tin: {predictResult.confidence}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {Object.keys(predictResult.confidences).length > 0 && (
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

            {/* Quick Stats */}
            {classes.length >= 2 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {classes.map((c) => (
                  <div key={c.id} className={`bg-white rounded-2xl p-4 border-2 text-center transition-all ${activeClass === c.id ? 'border-violet-400 shadow-md' : 'border-slate-100'}`}>
                    <span className="text-3xl block mb-1">{c.emoji}</span>
                    <div className="text-sm font-black text-slate-800 truncate">{c.label}</div>
                    <div className={`text-2xl font-black ${(classCounts[c.id] || 0) >= MIN_SAMPLES_PER_CLASS ? 'text-emerald-500' : 'text-amber-500'}`}>{classCounts[c.id] || 0}</div>
                    <div className="text-[10px] text-slate-400 font-bold">cử chỉ</div>
                  </div>
                ))}
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
                      <div><span className="text-slate-500 font-semibold">Tổng mẫu:</span><span className="font-black text-slate-800 ml-2">{samples.filter((s) => s.isValid !== false).length}</span></div>
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

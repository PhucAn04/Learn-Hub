'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, Camera, Trash2, Clock } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useMl5BodyPose } from '@/hooks/useMl5BodyPose';
import { drawBodySkeleton } from '@/lib/body-drawing';
import { normalizeBodyKeypoints } from '@/lib/body-pose-classifier';
import { classifyKNN, classifyKNNDetailed, StoredSample } from '@/lib/knn-classifier';
import { playClickSound, playSuccessSound } from '@/lib/audio';
import { assessQuality, calculateROI } from '@/lib/image-quality';
import CameraView from '@/components/CameraView';
import DataCollector from '@/components/journey/DataCollector';
import SampleGallery from '@/components/SampleGallery';
import AIFeedbackModal from '@/components/journey/AIFeedbackModal';
import { BodyKeypoint } from '@/types/ml5';
import { TfTrainer } from '@/lib/tf-trainer';
import { TeacherTemplate, DatasetResponse } from '@/types/models';

interface BodyTeachPanelProps {
  mode: 'body-pose';
  classes: { id: string; label: string; emoji?: string }[];
  minSamplesPerClass?: number;
  maxVisibleSkeletons?: number;
  teacherTemplate?: TeacherTemplate | DatasetResponse;
  allowCustomClasses?: boolean;
  onClassesChange?: (newClasses: { id: string; label: string; emoji?: string }[]) => void;
  onTrainComplete: (samples: StoredSample[]) => void;
}

export default function BodyTeachPanel({
  mode,
  classes,
  minSamplesPerClass = 1,
  maxVisibleSkeletons = 1,
  teacherTemplate,
  allowCustomClasses = false,
  onClassesChange,
  onTrainComplete,
}: BodyTeachPanelProps) {
  // ── State ───────────────────────────
  const [classesState, setClassesState] = useState(classes);
  const [newClassInput, setNewClassInput] = useState('');
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [activeClass, setActiveClass] = useState<string>(classes[0]?.id || '');

  // Keep activeClass in sync if classesState changes and activeClass is no longer valid
  useEffect(() => {
    if (classesState.length > 0 && !classesState.find(c => c.id === activeClass)) {
      setActiveClass(classesState[0].id);
    }
  }, [classesState, activeClass]);

  const handleAddClass = () => {
    if (!newClassInput.trim()) return;
    const newId = `class_${Date.now()}`;
    const newClass = { id: newId, label: newClassInput.trim(), emoji: '✨' };
    const newClasses = [...classesState, newClass];
    setClassesState(newClasses);
    setNewClassInput('');
    setActiveClass(newId);
    if (onClassesChange) onClassesChange(newClasses);
  };
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [isModelOutdated, setIsModelOutdated] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [predictedLabel, setPredictedLabel] = useState('Chưa nhận diện... 🤔');
  const [validationToast, setValidationToast] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [activeDataTab, setActiveDataTab] = useState<'camera' | 'upload' | 'video'>('camera');
  const [kValue, setKValue] = useState(3);
  const [threshold, setThreshold] = useState(2);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const trainerRef = useRef<TfTrainer | null>(null);
  useEffect(() => {
    trainerRef.current = new TfTrainer();
  }, []);

  // ── Camera ──────────────────────────
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } =
    useCamera({ width: 640, height: 480 });

  // ── Models (conditionally active) ───
  const { posesRef, modelStatus } = useMl5BodyPose(
    videoRef,
    cameraActive
  );

  // ── Drawing loop ────────────────────
  useEffect(() => {
    let animationId: number;
    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const poses = posesRef.current || [];
          for (let i = 0; i < Math.min(poses.length, maxVisibleSkeletons); i++) {
             if (poses[i] && poses[i].keypoints) {
               drawBodySkeleton(ctx, poses[i].keypoints!, video.videoWidth, video.videoHeight, canvas.width, canvas.height);
             }
          }
        }
      }
      animationId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationId);
  }, [videoRef, canvasRef, maxVisibleSkeletons, posesRef]);

  // ── Capture ─────────────────────────
  const captureSingleBodyPose = useCallback(() => {
    const poses = posesRef.current;
    if (!poses || poses.length === 0) {
      alert('Không tìm thấy ai trong khung hình! ⚠️');
      return;
    }
    const pose = poses[0];
    if (!pose || !pose.keypoints) return;
    
    const features = normalizeBodyKeypoints(pose.keypoints);
    if (!features || features.length === 0) return;

    const cv = document.createElement('canvas');
    cv.width = 240;
    cv.height = 240;
    const ctx = cv.getContext('2d');
    if (ctx && videoRef.current) ctx.drawImage(videoRef.current, 0, 0, 240, 240);
    const rawThumbnail = cv.toDataURL('image/jpeg', 0.8);
    
    // Đánh giá chất lượng TRƯỚC KHI vẽ bộ xương lên canvas
    const roi = calculateROI(pose.keypoints as { x: number; y: number }[], cv.width, cv.height, 0.1);
    const quality = assessQuality(cv, roi);
    
    if (ctx && pose.keypoints && videoRef.current) {
        drawBodySkeleton(ctx, pose.keypoints, videoRef.current.videoWidth, videoRef.current.videoHeight, 240, 240);
    }
    const thumbnail = cv.toDataURL('image/jpeg', 0.8);
    const activeClassLabel = classesState.find(c => c.id === activeClass)?.label || activeClass;

    let isBadQuality = false;
    if (quality.isBlurry || quality.isDark) {
      isBadQuality = true;
      const msg = quality.isBlurry 
        ? 'Ảnh hơi mờ! Bé hoặc người đứng mẫu cố gắng đứng yên nhé 🔍' 
        : 'Ảnh hơi tối! Bé tìm chỗ sáng hơn xíu nha 🌑';
      setValidationToast(`⚠️ ${msg}`);
      setTimeout(() => setValidationToast(null), 5000);
    }

    setSamples(prev => [
      ...prev,
      {
        id: `sample_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        label: activeClassLabel,
        sourceId: activeClass,
        features,
        thumbnail,
        rawThumbnail,
        isValid: true,
        quality
      }
    ]);
    playClickSound();
  }, [posesRef, videoRef, classesState, activeClass]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      captureSingleBodyPose();
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, captureSingleBodyPose]);

  // ── Prediction loop ─────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (samples.length > 0 && trainerRef.current) {
      interval = setInterval(async () => {
        const poses = posesRef.current || [];
        if (poses.length > 0 && poses[0].keypoints) {
          const features = normalizeBodyKeypoints(poses[0].keypoints);
          if (features && features.length > 0) {
             const resultKNN = classifyKNN(features, samples, kValue);
             const resultNN = await trainerRef.current!.predict(features);
             if (resultKNN) {
                if (resultNN.confidence < 50 || resultKNN.maxCount < Math.min(threshold, kValue)) {
                  setPredictedLabel('Chưa rõ ràng... 🤔');
                  setConfidence(resultNN.confidence);
                } else {
                  setPredictedLabel(resultNN.label);
                  setConfidence(resultNN.confidence);
                }
             }
          }
        } else {
          setPredictedLabel('Không thấy ai... 👀');
          setConfidence(0);
        }
      }, 300);
    }
    return () => clearInterval(interval);
  }, [samples, posesRef, kValue, threshold]);

  // ── Actions ─────────────────────────
  const handleTrain = async () => {
    if (!canTrain) {
      alert('Vui lòng thu thập thêm mẫu!');
      return;
    }
    
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      if (trainerRef.current) {
        await trainerRef.current.train(samples, (epoch, progress) => {
          setTrainingProgress(progress);
        });
        // progress reaches 100 here, which will trigger the useEffect below
      }
    } catch (err) {
      console.error('Training failed', err);
      setIsTraining(false);
      alert('Lỗi huấn luyện mô hình. Vui lòng thử lại.');
    }
  };

  // Handle train completion & re-evaluation
  useEffect(() => {
    if (isTraining && trainingProgress >= 100) {
      setIsTraining(false);
      setIsTrained(true);
      playSuccessSound();
      
      // Perform initial evaluation immediately
      const targetDataset = ((teacherTemplate?.samples?.length ?? 0) > 0) ? teacherTemplate!.samples! : samples;
      let hasIssues = false;
      
      const evaluated = samples.map(sample => {
        const refDataset = (targetDataset === samples) ? samples.filter(s => s.id !== sample.id) : targetDataset;
        if (refDataset.length === 0) return sample;
        
        const result = classifyKNNDetailed(sample.features, refDataset, kValue);
        const actualThreshold = Math.min(threshold, kValue);
        const bestVotes = (result.counts as Record<string, number>)[result.label] || 0;
        
        let predictedLabel = 'Chưa rõ ràng';
        if (bestVotes >= actualThreshold) {
          predictedLabel = result.label;
        }
        
        const studentClassId = sample.sourceId;
        const classDef = classesState.find(c => c.id === studentClassId);
        const expectedLabel = classDef ? classDef.label : sample.label;
        
        const isMisclassified = (sample.quality?.isBlurry || sample.quality?.isDark) 
          ? false 
          : predictedLabel !== expectedLabel;
        
        if (isMisclassified || sample.quality?.isBlurry || sample.quality?.isDark || sample.isValid === false) {
          hasIssues = true;
        }
        
        return {
          ...sample,
          aiFeedback: {
            isMisclassified,
            predictedLabel,
            nearestMatchThumbnail: result.nearest[0]?.thumbnail
          }
        };
      });
      
      setSamples(evaluated);
      setIsModelOutdated(false);
      
      if (!hasIssues) {
        onTrainComplete(evaluated);
      } else {
        setShowFeedbackModal(true);
      }
    }
  }, [isTraining, trainingProgress, classesState, kValue, threshold, teacherTemplate, samples, onTrainComplete]);

  // Re-evaluate when K or threshold changes
  useEffect(() => {
    if (isTrained && !isTraining) {
      setSamples(prevSamples => {
        let hasChanges = false;
        const targetDataset = ((teacherTemplate?.samples?.length ?? 0) > 0) ? teacherTemplate!.samples! : prevSamples;
        
        const evaluated = prevSamples.map(sample => {
          const refDataset = (targetDataset === prevSamples) ? prevSamples.filter(s => s.id !== sample.id) : targetDataset;
          if (refDataset.length === 0) return sample;
          
          const result = classifyKNNDetailed(sample.features, refDataset, kValue);
          const actualThreshold = Math.min(threshold, kValue);
          
          const bestVotes = (result.counts as Record<string, number>)[result.label] || 0;
          let predictedLabel = 'Chưa rõ ràng';
          if (bestVotes >= actualThreshold) {
            predictedLabel = result.label;
          }
          
          const studentClassId = sample.sourceId;
          const classDef = classesState.find(c => c.id === studentClassId);
          const expectedLabel = classDef ? classDef.label : sample.label;
          
          const isMisclassified = (sample.quality?.isBlurry || sample.quality?.isDark)
            ? false
            : predictedLabel !== expectedLabel;
          
          const currentFeedback = sample.aiFeedback;
          if (!currentFeedback || currentFeedback.isMisclassified !== isMisclassified || currentFeedback.predictedLabel !== predictedLabel) {
            hasChanges = true;
            return {
              ...sample,
              aiFeedback: {
                isMisclassified,
                predictedLabel,
                nearestMatchThumbnail: result.nearest[0]?.thumbnail
              }
            };
          }
          
          return sample;
        });
        
        return hasChanges ? evaluated : prevSamples;
      });
    }
  }, [kValue, threshold, isTrained, isTraining]);

  const handleClearClass = (classId: string) => {
    if (confirm('Bé có chắc muốn xóa hết ảnh của nhãn này không? 🗑️')) {
      const classLabel = classesState.find(c => c.id === classId)?.label || classId;
      setSamples((prev) => prev.filter((s) => s.sourceId ? s.sourceId !== classId : s.label !== classLabel));
      setIsTrained(false);
      setIsModelOutdated(false);
    }
  };

  // ── Render ──────────────────────────
  const canTrain = classesState.length > 0 && classesState.every(c => samples.filter(s => s.sourceId === c.id || (s.label === c.label && !s.sourceId)).length >= minSamplesPerClass);

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-indigo-100 flex flex-col h-full">
          <h3 className="font-black text-xl text-indigo-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🏷️</span> Chọn Tư Thế Để Dạy AI
          </h3>
        
        {allowCustomClasses && (
          <div className="mb-4 flex gap-2">
            <input 
              type="text" 
              value={newClassInput}
              onChange={e => setNewClassInput(e.target.value)}
              placeholder="Nhập tên tư thế mới (VD: Bước 1)"
              className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
            />
            <button 
              onClick={handleAddClass}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors"
            >
              Thêm
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6">
          {classesState.map((c) => {
            const count = samples.filter((s) => s.sourceId === c.id || (s.label === c.label && !s.sourceId)).length;
            const isActive = activeClass === c.id;
            const progress = Math.min(100, (count / minSamplesPerClass) * 100);
            return (
              <button
                key={c.id}
                onClick={() => { playClickSound(); setActiveClass(c.id); }}
                className={`relative overflow-hidden p-4 rounded-2xl border-4 transition-all text-left group ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-md scale-105 z-10' : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <div className={`font-extrabold text-lg ${isActive ? 'text-indigo-800' : 'text-slate-600'}`}>{c.label}</div>
                    <div className={`text-xs font-bold ${count >= minSamplesPerClass ? 'text-emerald-500' : 'text-amber-500'}`}>Đã có {count} mẫu</div>
                  </div>
                  {count > 0 && (
                    <div onClick={(e) => { e.stopPropagation(); handleClearClass(c.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 h-1.5 bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </button>
            );
          })}
        </div>

        {/* Teacher Template Reference */}
        {teacherTemplate && teacherTemplate.samples && (
          <div className="mb-4 bg-indigo-50 rounded-2xl p-3 border border-indigo-100">
            <h3 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
              <span>👀</span> Ảnh mẫu của Cô/Thầy:
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {teacherTemplate.samples.filter((s: StoredSample) => s.sourceId === activeClass).map((sample: StoredSample, i: number) => (
                <img 
                  key={i} 
                  src={sample.thumbnail || sample.rawThumbnail} 
                  alt="Teacher sample" 
                  className="w-14 h-14 rounded-xl object-cover border-2 border-indigo-200 shrink-0" 
                />
              ))}
              {teacherTemplate.samples.filter((s: StoredSample) => s.sourceId === activeClass).length === 0 && (
                <p className="text-xs text-indigo-400 italic">Cô/Thầy chưa lưu ảnh mẫu cho nhãn này.</p>
              )}
            </div>
          </div>
        )}

        {/* Capture button */}
        {activeDataTab === 'camera' && (
          <button
            onClick={() => {
              if (countdown === null) setCountdown(5);
            }}
            disabled={modelStatus !== 'ready' || countdown !== null}
            className={`w-full font-extrabold py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-lg mb-4 border-b-4 ${
              countdown !== null
                ? 'bg-orange-500 hover:bg-orange-600 border-orange-700 text-white animate-pulse'
                : 'bg-indigo-500 hover:bg-indigo-600 border-indigo-700 text-white active:scale-95 disabled:bg-gray-300 disabled:scale-100'
            }`}
          >
            {countdown !== null ? (
              <>
                <Clock className="w-6 h-6 animate-bounce" />
                <span>ĐANG ĐẾM NGƯỢC... {countdown}s</span>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6" />
                <span>NHẤN ĐỂ CHỤP 📸</span>
              </>
            )}
          </button>
        )}

          <SampleGallery
            samples={samples.filter((s) => s.sourceId === activeClass || (s.label === (classesState.find(c => c.id === activeClass)?.label || activeClass) && !s.sourceId))}
            onDeleteSample={(id) => {
              setSamples(prev => prev.filter(s => s.id !== id));
              setIsModelOutdated(true);
            }}
            onClearAll={() => handleClearClass(activeClass)}
            isTrained={isTrained}
          />

          {validationToast && (
            <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-2xl text-sm font-bold text-yellow-700 flex items-center gap-2 animate-bounce shadow-lg">
              <span className="text-xl">⚠️</span>
              <span>{validationToast}</span>
            </div>
          )}

          <div className="mt-auto pt-4">
          {isTraining ? (
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-700">AI đang học tư thế... ⚙️</span>
                <span className="text-xs font-black text-indigo-800">{trainingProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-150" style={{ width: `${trainingProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleTrain} 
                disabled={!canTrain || (isTrained && !isModelOutdated)} 
                className={`w-full font-extrabold py-3.5 px-6 rounded-2xl shadow-lg border-b-4 flex items-center justify-center gap-2 text-lg transition-all ${
                  canTrain && (!isTrained || isModelOutdated) 
                    ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white' 
                    : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Brain className="w-6 h-6" />
                <span>{isModelOutdated && isTrained ? 'Cập nhật mô hình (Re-train) 🔄' : isTrained ? 'ĐÃ DẠY XONG ✅' : 'DẠY BẠN AI HỌC 🚀'}</span>
              </button>
              
              {isTrained && (
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="w-full font-extrabold py-3 px-6 rounded-2xl shadow-md border-b-4 bg-indigo-100 hover:bg-indigo-200 border-indigo-300 text-indigo-700 flex items-center justify-center gap-2 text-base transition-all"
                >
                  <span className="text-xl">📊</span>
                  <span>Xem Phân Tích Tổng Thể</span>
                </button>
              )}
            </div>
          )}
        </div>
        </div>

      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-white rounded-3xl p-6 border-4 border-indigo-400 shadow-xl relative flex flex-col items-center">
          <DataCollector
            mode={mode}
            videoRef={videoRef}
            activeClassId={activeClass}
            activeClassLabel={classesState.find(c => c.id === activeClass)?.label || activeClass}
            activeTab={activeDataTab}
            onTabChange={setActiveDataTab}
            onSamplesCollected={(newSamples) => { 
              setSamples(prev => [...prev, ...newSamples]); 
              setIsModelOutdated(true);
            }}
          >
            <CameraView
              videoRef={videoRef}
              canvasRef={canvasRef}
              modelStatus={modelStatus}
              cameraError={cameraError}
              loadingText="ĐANG TẢI AI CƠ THỂ..."
              theme="blue"
              onRetry={retryCamera}
            />
          </DataCollector>
        </div>

        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white rounded-3xl p-4 shadow-xl border-4 border-purple-400">
          <h4 className="font-extrabold text-[11px] text-purple-300 tracking-widest uppercase mb-1">Kết quả dự đoán của AI:</h4>
          {samples.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-purple-300 block">AI đoán bé đang làm:</span>
                  <span className="text-xl font-black drop-shadow-md text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-400">{predictedLabel}</span>
                </div>
                <div className="bg-white/10 rounded-xl px-3 py-1 border border-white/20 flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-purple-300 uppercase block">Độ Tự Tin</span>
                  <span className="text-lg font-black">{Math.round(confidence * 100)}<span className="text-sm text-purple-300">%</span></span>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-purple-200">K (Số ảnh so sánh): {kValue}</label>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="7"
                    step="2"
                    value={kValue}
                    onChange={(e) => setKValue(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                  <p className="text-[10px] text-purple-300/70 italic leading-tight">Khi bé làm 1 hành động, AI sẽ rút ra K bức ảnh giống nhất trong kho dữ liệu để biểu quyết.</p>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-purple-200">Độ khắt khe (Sự đồng thuận): {Math.min(threshold, kValue)} / {kValue}</label>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={kValue}
                    step="1"
                    value={Math.min(threshold, kValue)}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                  <p className="text-[10px] text-purple-300/70 italic leading-tight">Bức tường lọc: Yêu cầu ít nhất {Math.min(threshold, kValue)} bức ảnh trong nhóm K phải cùng chung 1 nhãn để AI dám kết luận.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 opacity-50 py-2">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Brain className="w-5 h-5" /></div>
              <p className="font-bold text-xs leading-relaxed">Bé hãy chụp mẫu<br/>để AI bắt đầu đoán nhé! 🤖✨</p>
            </div>
          )}
        </div>
      </div>
      </div>

      <AIFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onProceed={() => {
          setShowFeedbackModal(false);
          onTrainComplete(samples);
        }}
        studentSamples={samples}
        teacherTemplate={teacherTemplate}
        kValue={kValue}
        threshold={threshold}
        classes={classes}
        onDeleteSample={(id) => setSamples(prev => prev.filter(s => s.id !== id))}
      />
    </div>
  );
}

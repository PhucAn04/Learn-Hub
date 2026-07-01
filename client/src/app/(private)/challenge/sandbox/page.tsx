'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Brain, ArrowLeft, Trash2, Camera, Save, Plus, X, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { playSuccessSound, speakVietnamese, playClickSound } from '@/lib/audio';
import { normalizeHandKeypoints, classifyKNN, StoredSample } from '@/lib/knn-classifier';
import CameraView from '@/components/CameraView';

export default function SandboxAiPage() {
  const [classes, setClasses] = useState<{ id: string; label: string; requiresTwoHands?: boolean }[]>([
    { id: 'class_1', label: '1 Ngón Tay ☝️', requiresTwoHands: false },
    { id: 'class_2', label: '2 Ngón Tay ✌️', requiresTwoHands: false },
    { id: 'class_3', label: '2 Bàn Tay, 1 Ngón Tay ☝️☝️', requiresTwoHands: true },
    { id: 'class_4', label: '2 Bàn Tay, 2 Ngón Tay ✌️✌️', requiresTwoHands: true },
  ]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassRequiresTwoHands, setNewClassRequiresTwoHands] = useState(false);
  
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
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp nhiều ảnh ở nhiều góc độ và khoảng cách khác nhau');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Camera and Handpose Setup (Detect up to 2 hands)
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 640,
    height: 480,
  });

  const { handsRef, modelStatus } = useMl5Handpose(videoRef, cameraActive, {
    maxHands: 2,
  });

  // Speak initial instruction
  useEffect(() => {
    speakVietnamese('Chào mừng bé đến với phòng thí nghiệm A I! Hãy tự tạo các nhãn tay mới nhé!');
  }, []);

  // Add new custom class
  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    playClickSound();
    const newId = `class_${Date.now()}`;
    setClasses(prev => [...prev, { id: newId, label: newClassName.trim(), requiresTwoHands: newClassRequiresTwoHands }]);
    setActiveClass(newId);
    setNewClassName('');
    setNewClassRequiresTwoHands(false);
    setIsTrained(false); 
  };

  const handleRemoveClass = (idToRemove: string) => {
    playClickSound();
    setClasses(prev => prev.filter(c => c.id !== idToRemove));
    clearClassSamples(idToRemove);
    if (activeClass === idToRemove) {
      setActiveClass(classes[0]?.id || '');
    }
  };

  // Capture a training sample
  const captureSample = () => {
    const hands = handsRef.current;
    if (!hands || hands.length === 0) {
      speakVietnamese('Bạn A I chưa nhìn thấy bàn tay nào trước camera cả!');
      return;
    }

    const currentClass = classes.find(c => c.id === activeClass);
    if (!currentClass) return;

    if (currentClass.requiresTwoHands && hands.length < 2) {
      speakVietnamese('Với dáng tay này, bé cần đưa cả hai bàn tay vào màn hình nhé!');
      return;
    }

    playClickSound();
    
    let features: number[] = [];

    if (currentClass.requiresTwoHands) {
      const sortedHands = [...hands].sort((a, b) => {
        const x1 = a.keypoints[0]?.x || 0;
        const x2 = b.keypoints[0]?.x || 0;
        return x1 - x2; 
      });
      const f1 = normalizeHandKeypoints(sortedHands[0].keypoints);
      const f2 = normalizeHandKeypoints(sortedHands[1].keypoints);
      features = [...f1, ...f2];
    } else {
      features = normalizeHandKeypoints(hands[0].keypoints);
    }
    
    if (features.length > 0) {
      const newSample: StoredSample = {
        label: currentClass.label,
        features,
        sourceId: currentClass.id
      };
      setSamples(prev => [...prev, newSample]);
    }
  };

  // Clear samples for a class
  const clearClassSamples = (classId: string) => {
    playClickSound();
    const classLabel = classes.find(c => c.id === classId)?.label || classId;
    setSamples(prev => prev.filter(s => s.sourceId ? s.sourceId !== classId : s.label !== classLabel));
    setIsTrained(false);
  };

  // Run mock training simulation
  const handleTrain = () => {
    if (classes.length < 2) {
      speakVietnamese('Bé cần tạo ít nhất 2 nhãn để A I học phân biệt nhé!');
      return;
    }

    let isValid = true;
    for (const cls of classes) {
      const count = samples.filter(s => s.sourceId === cls.id || (s.label === cls.label && !s.sourceId)).length;
      if (count < 3) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      speakVietnamese('Bé chưa chụp đủ 3 ảnh mẫu cho mỗi nhóm rồi! Bé hãy chụp thêm hình mẫu nhé!');
      return;
    }
    
    playClickSound();
    setIsTraining(true);
    setTrainingProgress(0);

    const interval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsTraining(false);
          setIsTrained(true);
          playSuccessSound();
          speakVietnamese('A I đã học xong và ghi nhớ các dáng tay của bé rồi!');
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Prediction loop
  useEffect(() => {
    if (!isTrained || modelStatus !== 'ready') return;

    let rafId: number;

    const runPrediction = () => {
      const hands = handsRef.current;
      
      if (hands && hands.length > 0) {
        const samples1Hand = samples.filter(s => s.features.length === 42);
        const samples2Hand = samples.filter(s => s.features.length === 84);

        if (hands.length >= 2 && samples2Hand.length >= 2) {
           const sortedHands = [...hands].sort((a, b) => {
              const x1 = a.keypoints[0]?.x || 0;
              const x2 = b.keypoints[0]?.x || 0;
              return x1 - x2;
           });
           const f1 = normalizeHandKeypoints(sortedHands[0].keypoints);
           const f2 = normalizeHandKeypoints(sortedHands[1].keypoints);
           const f_combined = [...f1, ...f2];
           
           const pred = classifyKNN(f_combined, samples2Hand, 3);
           setPredictedLabel(pred.label);
           setConfidence(pred.confidence);
        } else {
           if (hands.length >= 2 && samples1Hand.length > 0) {
              const f1 = normalizeHandKeypoints(hands[0].keypoints);
              const f2 = normalizeHandKeypoints(hands[1].keypoints);
              const pred1 = classifyKNN(f1, samples1Hand, 3);
              const pred2 = classifyKNN(f2, samples1Hand, 3);
              setPredictedLabel(`Tay 1: ${pred1.label} | Tay 2: ${pred2.label}`);
              setConfidence(Math.round((pred1.confidence + pred2.confidence)/2));
           } else if (samples1Hand.length > 0) {
              const f1 = normalizeHandKeypoints(hands[0].keypoints);
              const pred = classifyKNN(f1, samples1Hand, 3);
              setPredictedLabel(pred.label);
              setConfidence(pred.confidence);
           } else {
              setPredictedLabel('Chưa có mẫu nào phù hợp');
              setConfidence(0);
           }
        }
      } else {
        setPredictedLabel('AI đang đợi tay bé... ✋');
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
        speakVietnamese(`A I nghĩ đây là ${predictedLabel}`);
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
                  lineColor: idx === 0 ? '#10b981' : '#f59e0b',
                  jointColor1: idx === 0 ? '#059669' : '#d97706',
                  jointColor2: idx === 0 ? '#059669' : '#d97706',
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

  // Submit to Server (Sandbox saves data only)
  const handleSaveData = async () => {
    try {
      setIsSubmitting(true);
      // Gửi điểm giả (ví dụ 100) cho Sandbox hoặc xử lý ở server. 
      await api.submitAssignment(100, samples, `[SANDBOX] ${reflectionAnswer} | Lời nhắn: ${teacherMessage}`);
      
      setSubmitSuccess(true);
      playSuccessSound();
      speakVietnamese('Đã lưu dữ liệu Sandbox thành công!');
    } catch (err) {
      console.error('Failed to submit sandbox', err);
      speakVietnamese('Lưu dữ liệu gặp lỗi rồi bé ơi!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-teal-50 to-cyan-100 py-8 px-4 select-none">
      <div className="max-w-6xl mx-auto">
        
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/challenge/teach"
            onClick={playClickSound}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-teal-200 text-teal-700 font-extrabold shadow-sm hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Về Bài Tập</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧪🧑‍🔬</span>
            <h1 className="text-2xl md:text-3xl font-black text-teal-900">Phòng Thí Nghiệm AI</h1>
          </div>
        </div>

        {/* Sandbox Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Instructions & Class Management */}
          <div className="bg-white rounded-3xl p-6 border-4 border-teal-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="text-xs font-black text-teal-600 tracking-wider mb-2 uppercase">Quản lý nhãn tự do</div>
              
              {/* Add New Class */}
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Nhập tên dáng tay..."
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-teal-400"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
                  />
                  <button
                    onClick={handleAddClass}
                    className="bg-teal-500 hover:bg-teal-600 text-white p-2 rounded-xl"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer w-max">
                  <input
                    type="checkbox"
                    checked={newClassRequiresTwoHands}
                    onChange={(e) => setNewClassRequiresTwoHands(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  Dáng 2 bàn tay (Cần đưa cả 2 tay vào)
                </label>
              </div>

              {/* Class Tabs */}
              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2">
                {classes.length === 0 && (
                  <div className="text-center text-gray-400 text-sm font-bold py-4">Chưa có nhãn nào. Bé hãy thêm nhé!</div>
                )}
                {classes.map(cls => {
                  const classSampleCount = samples.filter(s => s.sourceId === cls.id || (s.label === cls.label && !s.sourceId)).length;
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
                          ? 'border-teal-500 bg-teal-50/80 shadow-md ring-2 ring-teal-200'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-teal-900 truncate pr-2" title={cls.label}>
                          {cls.label} {cls.requiresTwoHands && <span className="text-xs text-teal-600 ml-1">(2 tay)</span>}
                        </div>
                        <div className="text-xs text-gray-500 font-semibold mt-1 flex items-center gap-1.5">
                          <span>Đã chụp:</span>
                          <span className="text-teal-600 font-black">{classSampleCount} ảnh</span>
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                            hasEnough ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {hasEnough ? '✅' : `⚠️ Thiếu ${3 - classSampleCount}`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        {classSampleCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearClassSamples(cls.id);
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                            title="Xóa hết mẫu lớp này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveClass(cls.id);
                          }}
                          className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                          title="Xóa nhãn này"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Capture Button */}
              <button
                onClick={captureSample}
                disabled={modelStatus !== 'ready' || classes.length === 0}
                className="w-full bg-teal-500 hover:bg-teal-600 active:scale-95 disabled:bg-gray-300 disabled:scale-100 text-white font-extrabold py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-lg mb-6 border-b-4 border-teal-700"
              >
                <Camera className="w-6 h-6 animate-bounce" />
                <span>CHỤP HÌNH MẪU 📸</span>
              </button>

            </div>

            {/* Train Button & Progress */}
            <div>
              {isTraining ? (
                <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100 animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-teal-700">AI đang học bài... ⚙️</span>
                    <span className="text-xs font-black text-teal-800">{trainingProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-teal-600 h-full transition-all duration-150" style={{ width: `${trainingProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleTrain}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg border-b-4 border-indigo-700 flex items-center justify-center gap-2 text-lg"
                >
                  <Brain className="w-6 h-6" />
                  <span>DẠY BẠN AI HỌC 🧠🚀</span>
                </button>
              )}

              {isTrained && !isTraining && (
                <button
                  onClick={() => { playClickSound(); setShowSubmitModal(true); }}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white font-extrabold py-3 px-6 rounded-2xl shadow-md mt-3 border-b-4 border-sky-700 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  <span>LƯU BỘ DỮ LIỆU NÀY 💾</span>
                </button>
              )}
            </div>

          </div>

          {/* MIDDLE / RIGHT: Camera Preview & Real-time Live Prediction */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Live Camera Box */}
            <div className="bg-white rounded-3xl p-6 border-4 border-teal-400 shadow-xl relative flex flex-col items-center">
              <CameraView
                videoRef={videoRef}
                canvasRef={canvasRef}
                modelStatus={modelStatus}
                cameraError={cameraError}
                loadingText="ĐANG KHỞI ĐỘNG CAMERA NHẬN DẠNG XƯƠNG TAY..."
                hudText={isTrained ? `Đang dự đoán tự do` : `Chế độ Sandbox - Tự tạo nhãn`}
                theme="emerald"
                onRetry={retryCamera}
              />
            </div>

            {/* Test Results Screen */}
            <div className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white rounded-3xl p-6 shadow-xl border-4 border-emerald-400">
              <h4 className="font-extrabold text-sm text-emerald-300 tracking-widest uppercase mb-2">Màn hình kiểm tra Sandbox:</h4>
              
              {isTrained ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-emerald-300 block">AI đang đoán bé làm:</span>
                    <span className="text-2xl font-black text-yellow-300">{predictedLabel}</span>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
                    <span className="text-xs font-semibold text-emerald-200 block text-center">Độ tự tin:</span>
                    <span className="text-xl font-black text-green-300">{confidence}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-emerald-200 font-bold">
                  Tạo nhãn, thu thập ảnh và nhấn <span className="text-yellow-300">"Dạy Bạn AI Học"</span> để xem nhé!
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Submission Modal for Sandbox */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border-4 border-teal-400 shadow-2xl relative overflow-hidden">
            
            {submitSuccess ? (
              <div className="text-center py-8">
                <span className="text-7xl">🧪✨</span>
                <h3 className="text-2xl font-black text-teal-900 mt-4">Lưu Dữ Liệu Thành Công!</h3>
                <p className="text-gray-600 font-semibold mt-2">Dữ liệu Sandbox của bé đã được ghi nhận.</p>
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="mt-6 px-6 py-2.5 bg-teal-600 text-white font-extrabold rounded-full hover:scale-105 transition-transform"
                >
                  Đóng lại
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-black text-teal-900 mb-2 flex items-center gap-2">
                  <span>💾</span> Lưu Cấu Hình Sandbox
                </h3>
                <p className="text-xs text-gray-500 font-bold mb-4">
                  Chế độ này không có điểm số. Bé có thể lưu lại kết quả sáng tạo của mình để Thầy Cô cùng xem nhé!
                </p>

                {/* Score badge - Removed for sandbox, showing custom info instead */}
                <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4 flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs text-teal-700 font-bold block">Tổng số nhãn đã tạo:</span>
                    <span className="text-lg text-teal-900 font-black">
                      {classes.length} nhãn
                    </span>
                  </div>
                  <span className="text-3xl">🎨</span>
                </div>

                {/* Question Section */}
                <div className="mb-4">
                  <label className="text-xs font-black text-gray-700 block mb-1.5 flex items-center gap-1">
                    <HelpCircle className="w-4 h-4 text-teal-600" />
                    <span>Làm sao để AI nhận diện tốt nhiều nhãn khác nhau?</span>
                  </label>
                  <select
                    value={reflectionAnswer}
                    onChange={(e) => setReflectionAnswer(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-teal-400"
                  >
                    <option value="Chụp nhiều ảnh ở nhiều góc độ và khoảng cách khác nhau">
                      Chụp nhiều góc độ đa dạng cho mỗi nhãn 📐
                    </option>
                    <option value="Chỉ cần chụp 1 ảnh là đủ">
                      Chỉ cần chụp 1 tấm hình là đủ rồi 📸
                    </option>
                  </select>
                </div>

                {/* Text feedback */}
                <div className="mb-6">
                  <label className="text-xs font-black text-gray-700 block mb-1.5">
                    Ghi chú thêm:
                  </label>
                  <textarea
                    rows={2}
                    value={teacherMessage}
                    onChange={(e) => setTeacherMessage(e.target.value)}
                    placeholder="Bé đã tạo những nhãn gì đặc biệt..."
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
                    HỦY
                  </button>
                  <button
                    onClick={handleSaveData}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-teal-600 text-white font-extrabold rounded-xl hover:bg-teal-700 border-b-4 border-teal-800 disabled:bg-gray-300"
                  >
                    {isSubmitting ? 'ĐANG LƯU...' : 'LƯU DỮ LIỆU'}
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
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
import ScoreHeader from '@/components/ScoreHeader';
import CameraView from '@/components/CameraView';
import { FaceFilter, SmileMetrics } from '@/types/ml5';
import { api } from '@/lib/api';
import { TfTrainer } from '@/lib/tf-trainer';
import { normalizeFaceFeatures, classifyKNN, StoredSample } from '@/lib/knn-classifier';

import { LeaderboardEntry } from '@/types/models';

// Color palette for multiple faces — each face gets its own color set
const FACE_COLORS = [
  { oval: '#f472b6', eye: '#818cf8', lips: '#fb923c', nose: '#34d399', dot: 'rgba(244,114,182,0.55)' },
  { oval: '#60a5fa', eye: '#a78bfa', lips: '#fbbf24', nose: '#34d399', dot: 'rgba(96,165,250,0.55)' },
  { oval: '#fb923c', eye: '#f472b6', lips: '#818cf8', nose: '#4ade80', dot: 'rgba(251,146,60,0.55)' },
  { oval: '#a78bfa', eye: '#60a5fa', lips: '#f472b6', nose: '#fbbf24', dot: 'rgba(167,139,250,0.55)' },
];

export default function FaceChallenge() {
  const [facesCount, setFacesCount] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<FaceFilter>('sunglasses');
  const [smileProgress, setSmileProgress] = useState(0); // 0 to 100
  const [isSmilingDetected, setIsSmilingDetected] = useState(false);
  
  // Photo capture state
  const [photoCountdown, setPhotoCountdown] = useState<number | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const smileMetricsRef = useRef<SmileMetrics>({
    isSmiling: false,
    progress: 0,
  });

  // Custom hook for camera stream management
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 320,
    height: 240,
  });

  // Custom hook for ml5.js FaceMesh — now returns allFacesRef (array of faces)
  const { allFacesRef, modelStatus, detectorDebug } = useMl5FaceMesh(videoRef, cameraActive, {
    maxFaces: 4,
  });

  // Load custom KNN model from user's "teach-face" dataset
  const trainerRef = useRef<TfTrainer | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);

  useEffect(() => {
    const fetchMyModel = async () => {
      try {
        const datasets = await api.getMyDatasets('teach-face');
        if (datasets && datasets.length > 0) {
          const fileRes = await api.getDatasetFile(datasets[0].id);
          let loadedSamples: StoredSample[] = [];
          if (fileRes && fileRes.data && Array.isArray(fileRes.data)) {
            loadedSamples = fileRes.data;
          } else if (fileRes && Array.isArray(fileRes.samples)) {
            loadedSamples = fileRes.samples;
          }
          
          if (loadedSamples.length > 0) {
            trainerRef.current = new TfTrainer();
            await trainerRef.current.train(loadedSamples);
          }
        }
      } catch (err) {
        console.error('Failed to fetch teach-face model', err);
      } finally {
        setIsLoadingModel(false);
      }
    };
    fetchMyModel();
  }, []);

  // Fetch leaderboard on mount and score change
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const board = await api.getLeaderboard('face');
        setLeaderboard(board.slice(0, 5));
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      }
    };
    fetchLeaderboard();
  }, [score]);

  // Main Drawing & Smile detection Loop — iterate ALL faces
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
          setFacesCount(validFaces.length);

          if (validFaces.length > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
            // Track smile across all faces — any smiling face triggers photo
            let bestSmile: SmileMetrics = { isSmiling: false, progress: 0 };

            validFaces.forEach((kpsRaw, faceIdx) => {
              ctx.save();

              const kps = normalizeFaceKeypoints(kpsRaw, video, canvas);
              const colors = FACE_COLORS[faceIdx % FACE_COLORS.length];

              // Draw face wireframe
              if (kps.length > 100) {
                ctx.strokeStyle = colors.oval;
                ctx.lineWidth = 1.8;
                drawPolyline(ctx, FACE_OVAL, kps);

                ctx.strokeStyle = colors.eye;
                ctx.lineWidth = 1.4;
                drawPolyline(ctx, FACE_L_EYE, kps);
                drawPolyline(ctx, FACE_R_EYE, kps);

                ctx.strokeStyle = colors.lips;
                ctx.lineWidth = 1.4;
                drawPolyline(ctx, FACE_LIPS, kps);

                ctx.strokeStyle = colors.nose;
                ctx.lineWidth = 1.2;
                drawPolyline(ctx, FACE_NOSE, kps);
              }

              // Draw keypoints
              ctx.fillStyle = colors.dot;
              for (const point of kps) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
                ctx.fill();
              }

              // Draw filters/stickers on each face
              drawFaceStickers(ctx, kps, [activeFilter]);

              // Calculate smile metrics for this face
              const faceSmile = getSmileMetricsFromFaceMesh(kps);
              
              // If we have a custom AI model, use it to override the heuristics!
              if (trainerRef.current) {
                const faceKps = getFaceKeypoints(kpsRaw);
                if (faceKps && faceKps.length >= 468) {
                  const features = normalizeFaceFeatures(faceKps);
                  const pred = trainerRef.current.predictSync(features);
                  // In teach-face, 'class_1' is usually mapped to 'Vui vẻ 😀'
                  // We check if the highest confidence class matches a "smile" class taught by teacher
                  // For simplicity, let's use the confidence of class_1 (if it exists) as progress
                  if (pred && pred.confidences && typeof pred.confidences['class_1'] === 'number') {
                    const confidenceVal = pred.confidences['class_1'] * 100;
                    faceSmile.progress = confidenceVal;
                    faceSmile.isSmiling = confidenceVal > 80;
                  } else if (pred && pred.label === 'class_1') {
                     faceSmile.isSmiling = true;
                     faceSmile.progress = 100;
                  } else if (pred && pred.label !== 'class_1') {
                     faceSmile.isSmiling = false;
                     faceSmile.progress = 0;
                  }
                }
              }

              if (faceSmile.progress > bestSmile.progress) {
                bestSmile = faceSmile;
              }

              ctx.restore();
            });

            smileMetricsRef.current = bestSmile;
            setSmileProgress(bestSmile.progress);
            setIsSmilingDetected(bestSmile.isSmiling);
          } else {
            smileMetricsRef.current = {
              isSmiling: false,
              progress: 0,
            };
            setIsSmilingDetected(false);
            setSmileProgress(0);
          }
        }
      }
      rafId = requestAnimationFrame(drawFrame);
    };

    drawFrame();
    return () => cancelAnimationFrame(rafId);
  }, [modelStatus, activeFilter, videoRef, canvasRef, allFacesRef]);

  const triggerFlash = useCallback(() => {
    setFlashActive(true);
    playSuccessSound();
    const newScore = score + 1;
    setScore(newScore);

    // Auto save to backend if user is logged in
    if (api.getToken()) {
      api.saveProgress('face', newScore).catch(console.error);
    }

    // Save the mirrored camera preview with all face stickers baked into the photo.
    if (videoRef.current) {
      const cv = document.createElement('canvas');
      cv.width = videoRef.current.videoWidth;
      cv.height = videoRef.current.videoHeight;
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(cv.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, cv.width, cv.height);

        // Draw stickers on ALL faces into the captured photo
        for (const kpsRaw of allFacesRef.current) {
          const faceKps = getFaceKeypoints(kpsRaw);
          if (faceKps && faceKps.length >= 30) {
            const kps = normalizeFaceKeypoints(faceKps, videoRef.current!, cv);
            drawFaceSkeleton(ctx, faceKps, videoRef.current!.videoWidth || 640, videoRef.current!.videoHeight || 480, cv.width, cv.height);
            drawFaceStickers(ctx, kps, [activeFilter]);
          }
        }

        ctx.restore();
        setCapturedPhotoUrl(cv.toDataURL('image/jpeg'));
      }
    }

    setTimeout(() => {
      setFlashActive(false);
    }, 300);
  }, [activeFilter, videoRef, allFacesRef, score]);

  // Handle Photo taking countdown when smiling
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (isSmilingDetected && photoCountdown === null && !capturedPhotoUrl) {
      // Start countdown
      timer = setTimeout(() => setPhotoCountdown(3), 0);
    }

    if ((!isSmilingDetected || smileProgress < 100) && photoCountdown !== null) {
      timer = setTimeout(() => setPhotoCountdown(null), 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSmilingDetected, smileProgress, photoCountdown, capturedPhotoUrl]);

  // Countdown timer effect
  useEffect(() => {
    if (photoCountdown === null) return;
    if (photoCountdown > 0) {
      const timer = setTimeout(() => {
        setPhotoCountdown(photoCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      // Countdown reached 0: capture only if the latest camera frame is still smiling.
      setPhotoCountdown(null);
      if (smileMetricsRef.current.isSmiling && smileMetricsRef.current.progress >= 100 && !capturedPhotoUrl) {
        triggerFlash();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [photoCountdown, capturedPhotoUrl, triggerFlash]);

  const hudText = `AI thấy: ${facesCount} bạn nhỏ · ${detectorDebug}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-teal-100 py-10 px-4 select-none">
      {/* Visual Flash effect overlay */}
      {flashActive && (
        <div className="fixed inset-0 bg-white z-50 animate-fade-out pointer-events-none" />
      )}

      <div className="max-w-4xl mx-auto">
        {/* Reusable Header */}
        <ScoreHeader score={score} scoreLabel="ẢNH ĐÃ CHỤP" theme="emerald" />

        {/* Game Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left panel: Filter selection */}
          <div className="bg-white rounded-3xl p-6 border-4 border-emerald-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="text-sm font-extrabold text-emerald-600 tracking-wider mb-2 uppercase">Thám Tử Khuôn Mặt</div>
              
              {/* Face counter badge */}
              <div className="bg-emerald-100 rounded-2xl p-3 border-2 border-emerald-200 shadow-inner mb-4 flex items-center justify-center gap-2">
                <span className="text-3xl">{facesCount > 0 ? '👥' : '🔍'}</span>
                <span className="font-black text-emerald-700 text-lg">
                  {facesCount === 0 && 'Đang tìm...'}
                  {facesCount === 1 && '1 bạn nhỏ'}
                  {facesCount >= 2 && `${facesCount} bạn nhỏ! 🎉`}
                </span>
              </div>

              {/* Leaderboard Widget */}
              <div className="bg-yellow-50 rounded-3xl p-5 border-4 border-yellow-300 shadow-inner mb-6">
                <h4 className="font-extrabold text-yellow-800 text-sm mb-3 flex items-center gap-1.5">
                  🏆 TOP 5 CAO THỦ:
                </h4>
                {leaderboard.length === 0 ? (
                  <p className="text-xs font-semibold text-yellow-600">Đang tải bảng xếp hạng...</p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((player, idx) => (
                      <div key={player.userId || idx} className="flex items-center justify-between bg-white/70 px-3 py-2 rounded-2xl border border-yellow-200">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-yellow-700 w-4">{idx + 1}.</span>
                          <span className="text-lg">{player.avatar || '🐼'}</span>
                          <span className="font-bold text-xs text-gray-700 truncate max-w-[80px]">{player.username}</span>
                        </div>
                        <span className="font-black text-xs text-yellow-800">{player.score} ảnh</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-black text-gray-800 leading-tight mb-4">
                Chọn Phụ Kiện:
              </h2>

              {/* Filters list */}
              <div className="flex flex-col gap-3">
                {[
                  { id: 'sunglasses' as const, label: 'Kính mát ngầu 🕶️', color: 'bg-blue-500 border-blue-600' },
                  { id: 'crown' as const, label: 'Vương miện 👑', color: 'bg-yellow-500 border-yellow-600' },
                  { id: 'clownNose' as const, label: 'Mũi hề đỏ 🔴', color: 'bg-red-500 border-red-600' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => { playClickSound(); setActiveFilter(item.id); }}
                    className={`w-full py-4 px-6 rounded-2xl font-extrabold text-lg text-white border-b-4 transition-all ${item.color} ${
                      activeFilter === item.id ? 'brightness-105 translate-y-[2px] border-b-0' : 'opacity-85 hover:opacity-100 hover:-translate-y-[1px]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 mt-6">
              <h4 className="font-bold text-emerald-800 mb-1 flex items-center gap-1">
                <Smile className="w-5 h-5" />
                Cười lên để chụp ảnh:
              </h4>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border border-gray-300 mt-2">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${smileProgress}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-emerald-600 block text-right mt-1">Độ tươi: {smileProgress}%</span>
            </div>
          </div>

          {/* Right Video panel */}
          <div className="md:col-span-2 bg-white rounded-3xl p-6 border-4 border-emerald-400 shadow-xl flex flex-col items-center relative">
            
            {/* Shutter Countdown overlay */}
            {photoCountdown !== null && smileProgress >= 100 && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-30 rounded-3xl">
                <span className="text-9xl font-black text-white animate-bounce">{photoCountdown}</span>
                <span className="text-2xl font-black text-yellow-300 mt-4">CHUẨN BỊ... CƯỜI LÊN ĐI! 📷</span>
              </div>
            )}

            {/* Reusable Camera View */}
            <CameraView
              videoRef={videoRef}
              canvasRef={canvasRef}
              modelStatus={isLoadingModel ? 'loading' : modelStatus}
              cameraError={cameraError || ''}
              loadingText={isLoadingModel ? "ĐANG TẢI MÔ HÌNH AI CỦA BÉ..." : "ĐANG TÌM KHUÔN MẶT CỦA BÉ..."}
              hudText={hudText}
              theme="emerald"
              onRetry={retryCamera}
            />

            {/* Captured Photo Card drawer */}
            {capturedPhotoUrl && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-2xl border-4 border-dashed border-yellow-300 w-full max-w-sm flex flex-col items-center shadow-md animate-fade-in">
                <span className="font-extrabold text-yellow-800 text-sm mb-2">📸 TẤM ẢNH ĐẸP NHẤT CỦA BÉ:</span>
                <img
                  src={capturedPhotoUrl}
                  alt="Captured"
                  className="rounded-xl border-2 border-white shadow-md max-h-40"
                />
                <div className="flex gap-2 mt-3">
                  <a
                    href={capturedPhotoUrl}
                    download="anh-ai-nhi.jpg"
                    onClick={playClickSound}
                    className="px-4 py-2 bg-yellow-500 text-white font-extrabold text-xs rounded-full hover:bg-yellow-600 transition"
                  >
                    Tải về máy 💾
                  </a>
                  <button
                    onClick={() => { playClickSound(); setCapturedPhotoUrl(null); }}
                    className="px-4 py-2 bg-gray-400 text-white font-extrabold text-xs rounded-full hover:bg-gray-500 transition"
                  >
                    Chụp tiếp 🔄
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

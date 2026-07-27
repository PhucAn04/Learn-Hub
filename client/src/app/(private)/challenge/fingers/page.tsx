'use client';

import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { playSuccessSound, speakEnglish } from '@/lib/audio';
import { calculateFingers } from '@/lib/hand-utils';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import ScoreHeader from '@/components/ScoreHeader';
import CameraView from '@/components/CameraView';
import MatchProgressBar from '@/components/MatchProgressBar';
import { api } from '@/lib/api';
import { TfTrainer } from '@/lib/tf-trainer';
import { normalizeHandKeypoints } from '@/lib/knn-classifier';

export default function FingersChallenge() {
  const [targetCount, setTargetCount] = useState<number>(3); // start with 3
  const [detectedCount, setDetectedCount] = useState<number>(0);
  const [matchProgress, setMatchProgress] = useState(0); // 0 to 100%
  const [score, setScore] = useState(0);
  const [handsSeen, setHandsSeen] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const initialTargetCountRef = useRef(targetCount);

  // Custom hook for camera stream management
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 480,
    height: 360,
  });

  // Custom hook for ml5.js Handpose model loading and detecting
  const { handsRef, modelStatus } = useMl5Handpose(videoRef, cameraActive);

  // 1. Generate new target number
  const nextTarget = (current: number) => {
    let nextNum = current;
    while (nextNum === current) {
      nextNum = Math.floor(Math.random() * 5) + 1; // 1 to 5
    }
    setTargetCount(nextNum);
  };

  // Load custom Neural Network model from user's "teach" dataset
  const trainerRef = useRef<TfTrainer | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);

  useEffect(() => {
    const fetchMyModel = async () => {
      try {
        const datasets = await api.getMyDatasets('teach');
        if (datasets && datasets.length > 0) {
          const fileRes = await api.getDatasetFile(datasets[0].id);
          let loadedSamples: any[] = [];
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
        console.error('Failed to fetch teach model', err);
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
        const board = await api.getLeaderboard('fingers');
        setLeaderboard(board.slice(0, 5));
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      }
    };
    fetchLeaderboard();
  }, [score]);

  // 2. Game Frame Loop: Draw hand skeleton and count fingers
  useEffect(() => {
    let rafId: number;

    const runFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && modelStatus === 'ready') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Sync size
          if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
            canvas.width = video.clientWidth;
            canvas.height = video.clientHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const hands = handsRef.current;
          setHandsSeen(hands?.length || 0);

          if (hands && hands.length > 0) {
            const hand = hands[0];
            const kps = hand.keypoints;

            if (kps && kps.length >= 21) {
              drawHandSkeleton(ctx, kps, video.videoWidth, video.videoHeight, canvas.width, canvas.height, {
                lineColor: '#60a5fa',
                jointColor1: '#3b82f6',
                jointColor2: '#60a5fa',
              });

              // Count fingers using helper utility (Heuristic)
              let count = calculateFingers(kps);

              // Override with Neural Network if available and applicable (it was only trained for 1 and 2 fingers)
              if (trainerRef.current && (count === 1 || count === 2 || count === 0)) {
                 const features = normalizeHandKeypoints(kps);
                 trainerRef.current.predict(features).then(pred => {
                   if (pred) {
                     if (pred.label === 'class_1') count = 1;
                     if (pred.label === 'class_2') count = 2;
                   }
                   setDetectedCount(count);
                 });
              } else {
                 setDetectedCount(count);
              }
            }
          } else {
            setDetectedCount(0);
          }
        }
      }
      rafId = requestAnimationFrame(runFrame);
    };

    runFrame();
    return () => cancelAnimationFrame(rafId);
  }, [modelStatus, videoRef, canvasRef, handsRef]);

  // 3. Match Check Timer Loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (modelStatus === 'ready' && detectedCount === targetCount) {
        setMatchProgress(prev => {
          if (prev >= 100) {
            playSuccessSound();
            const newScore = score + 1;
            setScore(newScore);

            // Auto save to backend if user is logged in
            if (api.getToken()) {
              api.saveProgress('fingers', newScore * 10).catch(console.error);
            }

            nextTarget(targetCount);
            return 0;
          }
          return prev + 10; // increase progress
        });
      } else {
        setMatchProgress(0); // reset if doesn't match
      }
    }, 100);

    return () => clearInterval(interval);
  }, [detectedCount, targetCount, modelStatus, score]);

  const hudText = handsSeen > 0 ? `AI Đang Nhìn Bé: ${detectedCount} ngón` : 'AI đang tìm bàn tay...';
  const statusText = detectedCount === targetCount ? '✨ ĐÚNG RỒI! GIỮ NGUYÊN TAY...' : '✋ Hãy giơ đúng số ngón tay';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 py-10 px-4 select-none">
      <div className="max-w-4xl mx-auto">
        {/* Reusable Header */}
        <ScoreHeader score={score * 10} theme="blue" />

        {/* Game Main Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left panel: Mission instructions */}
          <div className="bg-white rounded-3xl p-6 border-4 border-blue-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="text-sm font-extrabold text-blue-600 tracking-wider mb-2 uppercase">Thử Thách Đếm Ngón Tay</div>
              <h2 className="text-3xl font-black text-gray-800 leading-tight mb-4">
                Hãy giơ:
              </h2>
              
              <div className="w-full bg-blue-100 rounded-3xl py-8 flex flex-col items-center justify-center border-2 border-blue-200 shadow-inner mb-4">
                <span className="text-7xl font-black text-blue-600 animate-bounce">{targetCount}</span>
                <span className="text-lg font-extrabold text-blue-700 mt-2">Ngón tay ✋</span>
              </div>

              {/* Leaderboard Widget */}
              <div className="bg-yellow-50 rounded-3xl p-5 border-4 border-yellow-300 shadow-inner">
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
                        <span className="font-black text-xs text-yellow-800">{player.score}đ</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mt-4">
              <h4 className="font-bold text-gray-700 mb-1">Mẹo nhỏ cho bé:</h4>
              <p className="text-gray-500 text-xs font-semibold leading-relaxed">
                Hãy xòe ngón tay thật rõ ràng và đưa tay đối diện thẳng đứng với camera nhé!
              </p>
            </div>
          </div>

          {/* Center/Right: Video camera feeds */}
          <div className="md:col-span-2 bg-white rounded-3xl p-6 border-4 border-blue-400 shadow-xl flex flex-col items-center">
            {/* Reusable Camera View */}
            <CameraView
              videoRef={videoRef}
              canvasRef={canvasRef}
              modelStatus={isLoadingModel ? 'loading' : modelStatus}
              cameraError={cameraError}
              loadingText={isLoadingModel ? "ĐANG TẢI AI MÀ BÉ VỪA DẠY..." : "ĐANG KHỞI ĐỘNG CAMERA AI..."}
              hudText={hudText}
              theme="blue"
              onRetry={retryCamera}
            />

            {/* Reusable Match Progress Bar */}
            <MatchProgressBar
              progress={matchProgress}
              statusText={statusText}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { playSuccessSound } from '@/lib/audio';
import { calculateFingers } from '@/lib/hand-utils';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import CameraView from '@/components/CameraView';
import MatchProgressBar from '@/components/MatchProgressBar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface GamePanelProps {
  gameType: 'fingers' | 'gestures' | 'face';
  onScoreReached: (score: number) => void;
}

// ---------------------------------------------------------------------------
// Fingers Game (fully implemented)
// ---------------------------------------------------------------------------
function FingersGame({ onScoreReached }: { onScoreReached: (score: number) => void }) {
  const [targetCount, setTargetCount] = useState<number>(() => Math.floor(Math.random() * 5) + 1);
  const [detectedCount, setDetectedCount] = useState<number>(0);
  const [matchProgress, setMatchProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [handsSeen, setHandsSeen] = useState(0);

  // Stable ref so the match-timer closure always reads the latest score
  const scoreRef = useRef(score);
  scoreRef.current = score;

  // Camera + Handpose hooks
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 480,
    height: 360,
  });

  const { handsRef, modelStatus } = useMl5Handpose(videoRef, cameraActive, {
    maxHands: 2,
  });

  // Generate next random target (different from current)
  const nextTarget = (current: number) => {
    let next = current;
    while (next === current) {
      next = Math.floor(Math.random() * 5) + 1;
    }
    setTargetCount(next);
  };

  // ------ Frame loop: draw skeleton + count fingers ------
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

              const count = calculateFingers(kps);
              setDetectedCount(count);
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

  // ------ Match check timer (every 100 ms) ------
  useEffect(() => {
    const interval = setInterval(() => {
      if (modelStatus === 'ready' && detectedCount === targetCount) {
        setMatchProgress((prev) => {
          if (prev >= 100) {
            playSuccessSound();
            const newScore = scoreRef.current + 1;
            setScore(newScore);
            onScoreReached(newScore);
            nextTarget(targetCount);
            return 0;
          }
          return prev + 10;
        });
      } else {
        setMatchProgress(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [detectedCount, targetCount, modelStatus, onScoreReached]);

  // Derived UI text
  const hudText =
    handsSeen > 0 ? `AI Đang Nhìn Bé: ${detectedCount} ngón` : 'AI đang tìm bàn tay...';
  const statusText =
    detectedCount === targetCount ? '✨ ĐÚNG RỒI! GIỮ NGUYÊN TAY...' : '✋ Hãy giơ đúng số ngón tay';

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* Score badge */}
      <div className="flex items-center justify-center gap-3 bg-blue-50 rounded-2xl py-3 px-4 border-2 border-blue-200">
        <span className="text-3xl">⭐</span>
        <span className="text-4xl font-black text-blue-700">{score}</span>
        <span className="text-sm font-extrabold text-blue-500 uppercase tracking-wider">điểm</span>
      </div>

      {/* Main game area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: Target card + tip */}
        <div className="bg-white rounded-2xl p-4 border-2 border-blue-300 shadow-md flex flex-col gap-3">
          <div className="text-xs font-extrabold text-blue-600 tracking-wider uppercase">
            🎯 Thử Thách Đếm Ngón Tay
          </div>

          <div className="text-lg font-black text-gray-800">Hãy giơ:</div>

          <div className="w-full bg-blue-100 rounded-2xl py-6 flex flex-col items-center justify-center border-2 border-blue-200 shadow-inner">
            <span className="text-6xl font-black text-blue-600 animate-bounce">{targetCount}</span>
            <span className="text-base font-extrabold text-blue-700 mt-1">Ngón tay ✋</span>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <h4 className="font-bold text-gray-700 text-sm mb-1">💡 Mẹo nhỏ cho bé:</h4>
            <p className="text-gray-500 text-xs font-semibold leading-relaxed">
              Hãy xòe ngón tay thật rõ ràng và đưa tay đối diện thẳng đứng với camera nhé!
            </p>
          </div>
        </div>

        {/* Right: Camera + progress bar */}
        <div className="md:col-span-2 bg-white rounded-2xl p-4 border-2 border-blue-300 shadow-md flex flex-col items-center">
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            modelStatus={modelStatus}
            cameraError={cameraError}
            loadingText="ĐANG KHỞI ĐỘNG CAMERA AI..."
            hudText={hudText}
            theme="blue"
            onRetry={retryCamera}
          />

          <MatchProgressBar progress={matchProgress} statusText={statusText} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coming-soon placeholder for gestures / face
// ---------------------------------------------------------------------------
function ComingSoonPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 bg-yellow-50 rounded-3xl border-4 border-dashed border-yellow-300 select-none">
      <span className="text-6xl">🚧</span>
      <p className="text-xl font-black text-yellow-800 text-center leading-relaxed">
        Trò chơi này đang được xây dựng!
        <br />
        Hãy quay lại sau nhé! 🎮
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GamePanel component
// ---------------------------------------------------------------------------
export default function GamePanel({ gameType, onScoreReached }: GamePanelProps) {
  if (gameType === 'fingers') {
    return <FingersGame onScoreReached={onScoreReached} />;
  }

  // gestures / face → placeholder
  return <ComingSoonPlaceholder />;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { playSuccessSound, speakEnglish } from '@/lib/audio';
import { recognizeGesture } from '@/lib/hand-utils';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { useCamera } from '@/hooks/useCamera';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import ScoreHeader from '@/components/ScoreHeader';
import CameraView from '@/components/CameraView';
import MatchProgressBar from '@/components/MatchProgressBar';
import { GestureType } from '@/types/ml5';
import { api } from '@/lib/api';

const GESTURES = [
  {
    type: 'like' as GestureType,
    label: 'Thích (Thumbs Up) 👍',
    desc: 'Chỉ giơ ngón cái lên và nắm các ngón khác lại!',
    voice: 'Hãy làm cử chỉ Thích, ngón cái giơ lên nào!',
  },
  {
    type: 'fist' as GestureType,
    label: 'Quyết Tâm (Fist) ✊',
    desc: 'Nắm chặt bàn tay lại thể hiện sự quyết tâm nào!',
    voice: 'Hãy nắm chặt bàn tay lại để làm cử chỉ Quyết tâm nào!',
  },
  {
    type: 'peace' as GestureType,
    label: 'Chiến Thắng (Peace) ✌️',
    desc: 'Xòe hai ngón trỏ và giữa thành hình chữ V nhé!',
    voice: 'Hãy giơ hai ngón trỏ và giữa thành hình chữ V chiến thắng nào!',
  },
  {
    type: 'open' as GestureType,
    label: 'Chào Bạn (Open Hand) ✋',
    desc: 'Xòe cả 5 ngón tay ra để vẫy chào AI nào!',
    voice: 'Hãy xòe cả năm ngón tay ra để chào bạn A I nào!',
  },
];

export default function GesturesChallenge() {
  const [targetGestureIdx, setTargetGestureIdx] = useState<number>(0);
  const [detectedGesture, setDetectedGesture] = useState<string>('Không có');
  const [matchProgress, setMatchProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [effectEmoji, setEffectEmoji] = useState<string | null>(null);
  const [handsSeen, setHandsSeen] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Custom hook for camera stream management
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 480,
    height: 360,
  });

  // Custom hook for ml5.js Handpose model loading and detecting
  const { handsRef, modelStatus } = useMl5Handpose(videoRef, cameraActive);

  // Choose next target gesture
  const nextGesture = (currentIdx: number) => {
    let nextIdx = currentIdx;
    while (nextIdx === currentIdx) {
      nextIdx = Math.floor(Math.random() * GESTURES.length);
    }
    setTargetGestureIdx(nextIdx);
    speakEnglish(GESTURES[nextIdx].voice);
  };

  useEffect(() => {
  }, []);

  // Fetch leaderboard on mount and score change
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const board = await api.getLeaderboard('gestures');
        setLeaderboard(board.slice(0, 5));
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      }
    };
    fetchLeaderboard();
  }, [score]);

  // Main Loop: Predict, Recognize, Draw skeleton & float emojis
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
              // Draw hand skeleton using common drawing library
              drawHandSkeleton(ctx, kps, video.videoWidth, video.videoHeight, canvas.width, canvas.height, {
                lineColor: '#f472b6',
                jointColor1: '#db2777',
                jointColor2: '#db2777',
                jointRadius: 5,
              });

              // Recognize Gesture
              const gesture = recognizeGesture(kps);
              setDetectedGesture(gesture);

              // Draw overlay emoji floating near index tip (landmark 8) or thumb tip (4)
              const sx = canvas.width / video.videoWidth;
              const sy = canvas.height / video.videoHeight;
              let targetTip = kps[8];
              if (gesture === 'like') targetTip = kps[4];
              
              if (gesture !== 'unknown') {
                let emoji = '';
                if (gesture === 'like') emoji = '👍';
                if (gesture === 'fist') emoji = '✊';
                if (gesture === 'peace') emoji = '✌️';
                if (gesture === 'open') emoji = '✋';

                ctx.font = '40px Arial';
                ctx.fillText(emoji, targetTip.x * sx - 20, targetTip.y * sy - 25);
              }
            }
          } else {
            setDetectedGesture('unknown');
          }
        }
      }
      rafId = requestAnimationFrame(runFrame);
    };

    runFrame();
    return () => cancelAnimationFrame(rafId);
  }, [modelStatus, videoRef, canvasRef, handsRef]);

  // Match check loop
  useEffect(() => {
    const target = GESTURES[targetGestureIdx].type;

    const timer = setInterval(() => {
      if (modelStatus === 'ready' && detectedGesture === target) {
        setMatchProgress(prev => {
          if (prev >= 100) {
            playSuccessSound();
            const newScore = score + 1;
            setScore(newScore);

            // Auto save to backend if user is logged in
            if (api.getToken()) {
              api.saveProgress('gestures', newScore * 10).catch(console.error);
            }

            setEffectEmoji(target === 'like' ? '👍' : target === 'peace' ? '✌️' : target === 'fist' ? '✊' : '✋');
            setTimeout(() => setEffectEmoji(null), 1000);
            nextGesture(targetGestureIdx);
            return 0;
          }
          return prev + 10;
        });
      } else {
        setMatchProgress(0);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [detectedGesture, targetGestureIdx, modelStatus, score]);

  const getGestureLabel = (type: string) => {
    if (type === 'like') return 'Thích 👍';
    if (type === 'fist') return 'Quyết Tâm ✊';
    if (type === 'peace') return 'Chiến Thắng ✌️';
    if (type === 'open') return 'Chào Bạn ✋';
    return 'Chưa nhận diện... 🤔';
  };

  const hudText = handsSeen > 0 ? `Dáng tay: ${getGestureLabel(detectedGesture)}` : 'AI đang tìm bàn tay...';
  const statusText = detectedGesture === GESTURES[targetGestureIdx].type ? '✨ GIỮ NGUYÊN DÁNG TAY...' : '✋ Hãy xếp tay giống mẫu';

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-100 py-10 px-4 select-none">
      <div className="max-w-4xl mx-auto">
        {/* Reusable Header */}
        <ScoreHeader score={score * 10} theme="pink" />

        {/* Game Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left instructions panel */}
          <div className="bg-white rounded-3xl p-6 border-4 border-pink-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="text-sm font-extrabold text-pink-600 tracking-wider mb-2 uppercase">Nhà Ảo Thuật Cử Chỉ</div>
              <h2 className="text-2xl font-black text-gray-800 leading-tight mb-4">
                Hãy làm hình:
              </h2>

              <div className="w-full bg-pink-50 rounded-3xl py-6 px-4 flex flex-col items-center justify-center border-2 border-pink-100 shadow-inner mb-4">
                <span className="text-xl font-black text-pink-700 text-center">{GESTURES[targetGestureIdx].label}</span>
                <p className="text-xs font-semibold text-pink-500 text-center mt-2">
                  {GESTURES[targetGestureIdx].desc}
                </p>
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
              <h4 className="font-bold text-gray-700 mb-1">Cử chỉ của bé là:</h4>
              <div className="text-lg font-black text-pink-600 animate-pulse">
                {getGestureLabel(detectedGesture)}
              </div>
            </div>
          </div>

          {/* Right Video panel */}
          <div className="md:col-span-2 bg-white rounded-3xl p-6 border-4 border-pink-400 shadow-xl flex flex-col items-center relative">
            {/* Big floating emoji reward */}
            {effectEmoji && (
              <div className="absolute inset-0 bg-white/40 flex items-center justify-center z-30 rounded-3xl animate-ping duration-1000">
                <span className="text-9xl">{effectEmoji}</span>
              </div>
            )}

            {/* Reusable Camera View */}
            <CameraView
              videoRef={videoRef}
              canvasRef={canvasRef}
              modelStatus={modelStatus}
              cameraError={cameraError}
              loadingText="ĐANG TẢI BỘ NHẬN DIỆN TAY..."
              hudText={hudText}
              theme="pink"
              onRetry={retryCamera}
            />

            {/* Reusable Hold progress bar */}
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

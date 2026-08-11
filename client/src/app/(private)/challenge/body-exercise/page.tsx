'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Activity } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { useCamera } from '@/hooks/useCamera';
import { useMl5BodyPose } from '@/hooks/useMl5BodyPose';
import { drawBodySkeleton } from '@/lib/body-drawing';
import { normalizeBodyKeypoints } from '@/lib/body-pose-classifier';
import { classifyKNN, StoredSample } from '@/lib/knn-classifier';
import { TfTrainer } from '@/lib/tf-trainer';
import ScoreHeader from '@/components/ScoreHeader';
import CameraView from '@/components/CameraView';
import MatchProgressBar from '@/components/MatchProgressBar';
import { getExerciseById, exercisePosesToClasses, BODY_EXERCISES } from '@/lib/body-exercises';

import { LeaderboardEntry } from '@/types/models';

export default function BodyExerciseChallenge() {
  const router = useRouter();
  
  const [selectedExercise, setSelectedExercise] = useState(BODY_EXERCISES[0].id);
  const exercise = getExerciseById(selectedExercise)!;
  const CLASSES = exercisePosesToClasses(exercise);

  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  
  const [targetPoseIdx, setTargetPoseIdx] = useState<number>(0);
  const [detectedPose, setDetectedPose] = useState<string>('Không có');
  const [matchProgress, setMatchProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Camera
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 640,
    height: 480,
  });

  // BodyPose Model
  const { posesRef, modelStatus } = useMl5BodyPose(videoRef, cameraActive);

  // Load custom KNN model from user's "teach-body" dataset
  const trainerRef = useRef<TfTrainer | null>(null);

  useEffect(() => {
    let ignore = false;
    const fetchMyModel = async () => {
      setIsLoadingModel(true);
      setSamples([]);
      trainerRef.current = null;
      try {
        const datasets = await api.getMyDatasets('teach-body-' + selectedExercise);
        if (datasets && datasets.length > 0) {
          // get the most recent dataset
          const fileRes = await api.getDatasetFile(datasets[0].id);
          let loadedSamples: StoredSample[] = [];
          if (fileRes && fileRes.data && Array.isArray(fileRes.data)) {
            loadedSamples = fileRes.data;
          } else if (fileRes && Array.isArray(fileRes.samples)) {
            loadedSamples = fileRes.samples;
          }
          
          if (loadedSamples.length > 0 && !ignore) {
            setSamples(loadedSamples);
            trainerRef.current = new TfTrainer();
            await trainerRef.current.train(loadedSamples);
            setTargetPoseIdx(0);
            setScore(0);
          }
        }
      } catch (err) {
        console.error('Failed to fetch teach-body model', err);
      } finally {
        if (!ignore) setIsLoadingModel(false);
      }
    };
    fetchMyModel();

    return () => { ignore = true; };
  }, [selectedExercise]);

  // Fetch leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const board = await api.getLeaderboard('body-exercise');
        setLeaderboard(board.slice(0, 5));
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      }
    };
    fetchLeaderboard();
  }, [score]);

  const nextPose = () => {
    const nextIdx = (targetPoseIdx + 1) % CLASSES.length;
    setTargetPoseIdx(nextIdx);
    speakEnglish(`Next pose: ${CLASSES[nextIdx].label}`);
  };

  // Main Frame Loop
  useEffect(() => {
    let rafId: number;

    const runFrame = async () => {
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

          const poses = posesRef.current;
          if (poses && poses.length > 0 && poses[0].keypoints) {
            drawBodySkeleton(ctx, poses[0].keypoints, video.videoWidth, video.videoHeight, canvas.width, canvas.height);
            
            if (samples.length > 0 && trainerRef.current) {
              const features = normalizeBodyKeypoints(poses[0].keypoints);
              const result = await trainerRef.current.predict(features);
              if (result && result.confidence >= 50) {
                setDetectedPose(result.label);
              } else {
                setDetectedPose('Không rõ');
              }
            }
          } else {
            setDetectedPose('Không thấy ai');
          }
        }
      }
      rafId = requestAnimationFrame(runFrame);
    };

    runFrame();
    return () => cancelAnimationFrame(rafId);
  }, [modelStatus, videoRef, canvasRef, posesRef, samples]);

  // Match check loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (samples.length === 0) return;

      const currentTargetId = CLASSES[targetPoseIdx].id;
      if (detectedPose === currentTargetId) {
        setMatchProgress(prev => {
          if (prev >= 100) {
            playSuccessSound();
            const newScore = score + 10;
            setScore(newScore);

            if (api.getToken()) {
              api.saveProgress('body-exercise', newScore).catch(console.error);
            }

            nextPose();
            return 0;
          }
          return prev + 15;
        });
      } else {
        setMatchProgress(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [detectedPose, targetPoseIdx, score, samples.length]);

  if (isLoadingModel) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="text-sky-600 font-extrabold text-xl animate-pulse">Đang tải trí tuệ nhân tạo của bé...</div>
      </div>
    );
  }

  if (samples.length === 0) {
    return (
      <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-7xl mb-4">😢</span>
        <h2 className="text-2xl font-black text-sky-900 mb-2">Bé chưa dạy AI bài tập nào!</h2>
        <p className="text-slate-600 font-semibold mb-6">Hãy quay lại trang &quot;Huấn Luyện AI&quot; để dạy AI các động tác trước nhé.</p>
        <Link
          href="/challenge/teach-body"
          className="px-6 py-3 bg-sky-600 text-white font-extrabold rounded-full hover:bg-sky-700 transition"
        >
          Đi Dạy AI Ngay
        </Link>
      </div>
    );
  }

  const targetClass = CLASSES[targetPoseIdx];
  const hudText = `AI Thấy: ${CLASSES.find(c => c.id === detectedPose)?.label || 'Không rõ'}`;
  const statusText = detectedPose === targetClass.id ? '✨ ĐÚNG RỒI! GIỮ NGUYÊN...' : `🤸 Hãy làm động tác: ${targetClass.label}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 py-10 px-4 select-none">
      <div className="max-w-4xl mx-auto">
        <ScoreHeader score={score} scoreLabel="ĐIỂM THỂ DỤC" theme="blue" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left panel */}
          <div className="bg-white rounded-3xl p-6 border-4 border-sky-400 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-extrabold text-sky-600 tracking-wider uppercase">Bài Tập Thể Dục</div>
                <select 
                   value={selectedExercise}
                   onChange={(e) => setSelectedExercise(e.target.value)}
                   className="bg-sky-50 text-sky-900 font-bold px-3 py-1 rounded-xl outline-none border border-sky-200 cursor-pointer"
                 >
                   {BODY_EXERCISES.map(ex => (
                     <option key={ex.id} value={ex.id}>{ex.name}</option>
                   ))}
                 </select>
              </div>
              <h2 className="text-2xl font-black text-gray-800 leading-tight mb-4">
                Làm theo động tác này:
              </h2>
              
              <div className="w-full bg-sky-100 rounded-3xl p-6 flex flex-col items-center justify-center border-2 border-sky-200 shadow-inner mb-4">
                <span className="text-7xl font-black text-sky-600 mb-2">{targetClass.emoji}</span>
                <span className="text-lg font-extrabold text-sky-700 text-center">{targetClass.label}</span>
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

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mt-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-700 text-sm mb-1">Mẹo nhỏ:</h4>
                <p className="text-gray-500 text-xs font-semibold">Đứng lùi lại để camera thấy toàn thân nhé!</p>
              </div>
              <Link href="/home" className="p-2 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Video panel */}
          <div className="md:col-span-2 bg-white rounded-3xl p-6 border-4 border-sky-400 shadow-xl flex flex-col items-center">
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

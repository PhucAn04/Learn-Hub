'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Camera, Image as ImageIcon, UploadCloud, Loader2, AlertCircle, Video } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useVideoExtractor } from '@/hooks/useVideoExtractor';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { useOfflineDetector, DetectorMode } from '@/hooks/useOfflineDetector';
import { StoredSample, normalizeHandKeypoints, normalizeFaceFeatures } from '@/lib/knn-classifier';
import { assessQuality } from '@/lib/image-quality';
import { normalizeBodyKeypoints } from '@/lib/body-pose-classifier';
import { HandResult, FaceMeshResult, BodyPoseResult } from '@/types/ml5';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import { drawFaceSkeleton, getFaceKeypoints } from '@/lib/face-drawing';
import { drawBodySkeleton } from '@/lib/body-drawing';

interface DataCollectorProps {
  mode: 'hand-1' | 'hand-2' | 'gesture' | 'emotion' | 'body-pose';
  activeClassId: string;
  activeClassLabel: string;
  activeTab: 'camera' | 'upload' | 'video';
  onTabChange: (tab: 'camera' | 'upload' | 'video') => void;
  onSamplesCollected: (samples: StoredSample[]) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  children: React.ReactNode;
}

export default function DataCollector({
  mode,
  activeClassId,
  activeClassLabel,
  activeTab,
  onTabChange,
  onSamplesCollected,
  videoRef,
  children
}: DataCollectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isProcessing, progress, processImages } = useImageUpload();
  const { isExtracting, progress: videoProgress, extractFrames } = useVideoExtractor();
  
  const detectorMode: DetectorMode = 
    mode.startsWith('hand') || mode === 'gesture' ? 'hand' 
    : mode === 'emotion' ? 'face' 
    : 'body';
    
  const { isReady, isLoading: isModelLoading, detect, initModel } = useOfflineDetector(detectorMode);

  const [countdown, setCountdown] = useState<number | null>(null);
  const { isRecording, recordingDuration, startRecording, stopRecording } = useMediaRecorder(videoRef || { current: null }, 60);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      startRecording();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, startRecording]);

  const handleStartRecording = () => {
    setCountdown(5);
  };

  const handleStopRecording = async () => {
    try {
      const blob = await stopRecording();
      if (blob) {
        // Use recordingDuration to cap frames, preventing the 120-frame Infinity duration bug
        const maxFrames = Math.max(1, recordingDuration * 2);
        const frames = await extractFrames(blob, 2, maxFrames);
        await processDetectedFrames(frames);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xử lý video quay được.');
    }
  };

  // Pre-load offline model when switching to upload or video tab
  useEffect(() => {
    if ((activeTab === 'upload' || activeTab === 'video') && !isReady && !isModelLoading) {
      initModel();
    }
  }, [activeTab, isReady, isModelLoading, initModel]);

  const processDetectedFrames = async (
    processedImages: { canvas: HTMLCanvasElement; thumbnailBase64: string }[]
  ) => {
    const newSamples: StoredSample[] = [];
    let failCount = 0;

    for (const img of processedImages) {
      const rawThumb = img.thumbnailBase64;
      const results = await detect(img.canvas);
      
      let features: number[] | null = null;
      let isValid = false;

      if (detectorMode === 'hand') {
        const hands = results as HandResult[];
        if (hands && hands.length > 0 && hands[0].keypoints) {
          features = normalizeHandKeypoints(hands[0].keypoints);
          isValid = true;
          const ctx = img.canvas.getContext('2d');
          if (ctx) {
            hands.forEach((hand, idx) => {
              if (hand.keypoints) {
                drawHandSkeleton(ctx, hand.keypoints, img.canvas.width, img.canvas.height, img.canvas.width, img.canvas.height, {
                  lineColor: idx === 0 ? '#6366f1' : '#ec4899',
                  jointColor1: idx === 0 ? '#4f46e5' : '#db2777',
                  jointColor2: idx === 0 ? '#4f46e5' : '#db2777',
                  jointRadius: 2,
                });
              }
            });
            img.thumbnailBase64 = img.canvas.toDataURL('image/jpeg', 0.85);
          }
        }
      } else if (detectorMode === 'face') {
        const faces = results as FaceMeshResult[];
        if (faces && faces.length > 0) {
          const keypoints = Array.isArray(faces[0]) ? faces[0] : (faces[0] as any).keypoints;
          if (keypoints) {
             features = normalizeFaceFeatures(keypoints);
             isValid = true;
             const ctx = img.canvas.getContext('2d');
             if (ctx) {
               faces.forEach((face) => {
                 const kps = getFaceKeypoints(face);
                 if (kps && kps.length >= 30) {
                   drawFaceSkeleton(ctx, kps, img.canvas.width, img.canvas.height, img.canvas.width, img.canvas.height);
                 }
               });
               img.thumbnailBase64 = img.canvas.toDataURL('image/jpeg', 0.85);
             }
          }
        }
      } else if (detectorMode === 'body') {
        const poses = results as BodyPoseResult[];
        if (poses && poses.length > 0 && poses[0].keypoints) {
          features = normalizeBodyKeypoints(poses[0].keypoints);
          isValid = true;
          const ctx = img.canvas.getContext('2d');
          if (ctx) {
            poses.forEach((pose) => {
              if (pose.keypoints) {
                drawBodySkeleton(ctx, pose.keypoints, img.canvas.width, img.canvas.height, img.canvas.width, img.canvas.height);
              }
            });
            img.thumbnailBase64 = img.canvas.toDataURL('image/jpeg', 0.85);
          }
        }
      }

      if (features && isValid) {
        // Assess image quality (brightness, blur) — tag only, never block
        const quality = assessQuality(img.canvas);
        newSamples.push({
          id: `sample_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          label: activeClassLabel,
          sourceId: activeClassId,
          features,
          thumbnail: img.thumbnailBase64,
          rawThumbnail: rawThumb,
          isValid: true,
          quality,
        });
      } else {
        failCount++;
      }
    }

    if (newSamples.length > 0) {
      onSamplesCollected(newSamples);
    }
    
    if (failCount > 0) {
      const target = detectorMode === 'hand' ? 'bàn tay' : detectorMode === 'face' ? 'khuôn mặt' : 'cơ thể';
      const unit = activeTab === 'video' ? 'khung hình' : 'bức ảnh';
      alert(`AI không tìm thấy ${target} trong ${failCount} ${unit}. Các ${unit} này đã bị bỏ qua.`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    try {
      if (activeTab === 'video') {
        const file = e.target.files[0];
        if (file) {
          // Extract at 2 fps, max 120 frames (for up to 60s video)
          const frames = await extractFrames(file, 2, 120);
          await processDetectedFrames(frames);
        }
      } else {
        const images = await processImages(e.target.files);
        await processDetectedFrames(images);
      }
    } catch (err) {
      console.error('Error processing uploaded media:', err);
      alert('Có lỗi xảy ra khi xử lý file. Hãy thử lại nhé!');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalProgress = isExtracting ? videoProgress : progress;
  const isBusy = isProcessing || isExtracting;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-4">
        <button
          onClick={() => onTabChange('camera')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap transition-all ${
            activeTab === 'camera' 
              ? 'bg-white text-indigo-700 shadow-sm border-2 border-indigo-100' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Camera className="w-4 h-4" />
          Camera
        </button>
        <button
          onClick={() => onTabChange('upload')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap transition-all ${
            activeTab === 'upload' 
              ? 'bg-white text-indigo-700 shadow-sm border-2 border-indigo-100' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Tải Ảnh
        </button>
        <button
          onClick={() => onTabChange('video')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap transition-all ${
            activeTab === 'video' 
              ? 'bg-white text-indigo-700 shadow-sm border-2 border-indigo-100' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Video className="w-4 h-4" />
          Video
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-3xl border-2 border-indigo-100 p-4 w-full min-h-[400px] flex flex-col">
        {/* CAMERA & VIDEO SHARED WRAPPER */}
        <div 
          className={`flex-1 flex flex-col h-full relative ${
            activeTab === 'video' 
              ? 'border-4 border-dashed border-indigo-100 rounded-2xl overflow-hidden bg-indigo-50/50' 
              : ''
          } ${activeTab === 'upload' ? 'hidden' : ''}`}
        >
          {children}

          {/* Overlays for Video Tab */}
          {activeTab === 'video' && (
            <>
               {/* Busy Overlay */}
               {(isBusy || isModelLoading) && (
                 <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-black text-indigo-900 mb-2">
                      {isModelLoading ? 'Đang tải trí tuệ nhân tạo...' : isExtracting ? 'Đang phân tích video...' : 'Đang phân tích ảnh...'}
                    </h3>
                    <div className="w-64 max-w-sm mx-auto">
                      <div className="h-4 bg-gray-200 rounded-full overflow-hidden w-full mb-2">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-300" 
                          style={{ width: `${totalProgress.total > 0 ? (totalProgress.current / totalProgress.total) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-sm font-bold text-gray-500 text-center">
                        {totalProgress.current} / {totalProgress.total} mẫu
                      </p>
                    </div>
                 </div>
               )}

               {/* Countdown Overlay */}
               {countdown !== null && (
                 <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                   <div className="text-center">
                     <div className="text-9xl font-black text-white animate-pulse drop-shadow-2xl">{countdown}</div>
                     <div className="text-2xl font-bold text-white mt-4">Chuẩn bị...</div>
                   </div>
                 </div>
               )}

             <input 
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                id="media-upload-input"
             />
            </>
          )}
        </div>

        {/* VIDEO TAB CONTROLS (Moved below the camera view) */}
        {activeTab === 'video' && !(isBusy || isModelLoading) && countdown === null && (
          <div className="mt-6 flex flex-col items-center gap-3">
            {isRecording ? (
              <button onClick={handleStopRecording} className="bg-red-500 hover:bg-red-600 text-white font-black py-4 px-8 rounded-full shadow-lg flex items-center gap-3 animate-pulse border-4 border-red-200">
                <span className="w-4 h-4 bg-white rounded-full"></span>
                DỪNG QUAY ({recordingDuration}s)
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
                  <button onClick={handleStartRecording} disabled={!isReady} className="flex-1 max-w-[200px] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-6 rounded-xl shadow border-b-4 border-indigo-800 disabled:bg-gray-400 disabled:border-gray-500 flex items-center justify-center gap-2 transition-transform hover:-translate-y-1">
                    <Video className="w-5 h-5" />
                    QUAY VIDEO
                  </button>
                  <span className="text-sm font-bold text-gray-400 hidden sm:block">hoặc</span>
                  <label htmlFor="media-upload-input" className="flex-1 max-w-[200px] bg-white hover:bg-gray-50 text-indigo-700 font-black py-3 px-6 rounded-xl shadow border-2 border-indigo-200 cursor-pointer flex items-center justify-center gap-2 transition-transform hover:-translate-y-1">
                    <UploadCloud className="w-5 h-5" />
                    TẢI TỪ MÁY
                  </label>
                </div>
                <p className="text-xs font-semibold text-gray-500">
                  <AlertCircle className="inline w-4 h-4 mr-1 text-yellow-500 mb-0.5" />
                  Đừng quên chọn đúng nhãn ở cột bên trái nhé!
                </p>
              </div>
            )}
          </div>
        )}

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed border-indigo-100 rounded-2xl bg-indigo-50/50 relative overflow-hidden transition-all hover:bg-indigo-50">
            {isModelLoading ? (
              <div className="text-center p-8">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-black text-indigo-900 mb-2">Đang tải trí tuệ nhân tạo...</h3>
                <p className="text-sm font-bold text-gray-500">Đợi một chút để AI chuẩn bị học từ ảnh nhé!</p>
              </div>
            ) : isBusy ? (
              <div className="text-center p-8 w-full max-w-sm">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-black text-indigo-900 mb-2">Đang phân tích ảnh...</h3>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden w-full mb-2">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-300" 
                    style={{ 
                      width: `${totalProgress.total > 0 ? (totalProgress.current / totalProgress.total) * 100 : 0}%` 
                    }}
                  />
                </div>
                <p className="text-sm font-bold text-gray-500">
                  {totalProgress.current} / {totalProgress.total} mẫu
                </p>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <UploadCloud className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-xl font-black text-indigo-900 mb-3">Tải ảnh có sẵn lên</h3>
                <p className="text-sm font-semibold text-gray-600 mb-6 max-w-xs mx-auto">
                  Bé có thể chụp bằng điện thoại rồi tải lên đây để dạy AI! Chọn nhiều ảnh cùng lúc cũng được nhé.
                </p>
                <input 
                  type="file"
                  accept="image/jpeg,image/png,image/webp;capture=camera"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload-input"
                />
                <label 
                  htmlFor="image-upload-input"
                  className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-8 rounded-xl cursor-pointer transition-transform hover:scale-105 border-b-4 border-indigo-800"
                >
                  CHỌN ẢNH TỪ MÁY
                </label>

                <div className="mt-6 flex items-start gap-2 bg-yellow-50 text-yellow-800 p-3 rounded-lg text-xs font-semibold text-left max-w-sm mx-auto shadow border border-yellow-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
                  <p>Mẹo: Đừng quên chọn đúng nhãn ở cột bên trái trước khi tải ảnh lên nhé!</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

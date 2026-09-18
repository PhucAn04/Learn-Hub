'use client';

import { useEffect, useRef } from 'react';
import { Bot, Sparkles, AlertCircle, Shield } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useMl5FaceMesh } from '@/hooks/useMl5FaceMesh';
import { useMl5Handpose } from '@/hooks/useMl5Handpose';
import { drawFaceSkeleton } from '@/lib/face-drawing';
import { drawHandSkeleton } from '@/lib/hand-drawing';
import CameraView from '@/components/CameraView';

export default function PlatformIntroPage() {
  const { videoRef, canvasRef, cameraActive, cameraError, retryCamera } = useCamera({
    width: 640,
    height: 480,
  });

  const { modelStatus: faceModelStatus, allFacesRef } = useMl5FaceMesh(videoRef, cameraActive, { maxFaces: 1 });
  const { modelStatus: handModelStatus, handsRef } = useMl5Handpose(videoRef, cameraActive, { maxHands: 2 });

  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
      const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && cameraActive) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Sync canvas dimensions with display dimensions to prevent coordinate misalignment
          const displayW = video.offsetWidth;
          const displayH = video.offsetHeight;
          if (displayW > 0 && displayH > 0 && (canvas.width !== displayW || canvas.height !== displayH)) {
            canvas.width = displayW;
            canvas.height = displayH;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw faces
          const faces = allFacesRef.current;
          if (faces && faces.length > 0) {
            faces.forEach((faceKps) => {
              drawFaceSkeleton(ctx, faceKps, video.videoWidth, video.videoHeight, canvas.width, canvas.height);
              
              // Vẽ thêm 478 điểm mốc (dots) để giống trang dạy AI
              const sx = canvas.width / video.videoWidth;
              const sy = canvas.height / video.videoHeight;
              ctx.fillStyle = 'rgba(96,165,250,0.55)'; // Màu xanh nhẹ cho các điểm
              for (const point of faceKps) {
                ctx.beginPath();
                ctx.arc(point.x * sx, point.y * sy, 1.4, 0, Math.PI * 2);
                ctx.fill();
              }
            });
          }

          // Draw hands
          const hands = handsRef.current;
          if (hands && hands.length > 0) {
            hands.forEach((hand, idx) => {
              if (hand.keypoints) {
                const lineColor = idx === 0 ? '#60a5fa' : '#f472b6';
                const jointColor1 = idx === 0 ? '#3b82f6' : '#ec4899';
                const jointColor2 = idx === 0 ? '#60a5fa' : '#f472b6';
                drawHandSkeleton(ctx, hand.keypoints, video.videoWidth, video.videoHeight, canvas.width, canvas.height, {
                  lineColor,
                  jointColor1,
                  jointColor2,
                });
              }
            });
          }
        }
      }
      requestRef.current = requestAnimationFrame(draw);
    };

    if (cameraActive) {
      requestRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [cameraActive, videoRef, canvasRef, allFacesRef, handsRef]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4 select-none">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Small Title */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 uppercase">
            Computer Vision Core
          </h1>
        </div>

        {/* Text 1: FaceMesh (Full width card) */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-purple-100 transform hover:-translate-y-1 transition-transform">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                <Bot className="w-8 h-8" />
             </div>
             <div>
               <h2 className="text-2xl font-bold text-gray-800">1. Nhận Diện Khuôn Mặt</h2>
               <p className="text-purple-600 font-semibold">FaceMesh</p>
             </div>
          </div>
          <div className="space-y-4 text-gray-700 font-medium leading-relaxed">
            <p>
              Thuật toán định vị chính xác <strong>478 điểm 3D</strong> trên khuôn mặt bạn, từ đường viền mắt, sống mũi cho đến khóe môi. 
            </p>
            <p className="bg-purple-50 p-4 rounded-xl border border-purple-200">
              Nhờ mạng lưới điểm mốc này, AI có thể hiểu được bạn đang cười, nháy mắt hay có biểu cảm ngạc nhiên cực kỳ chuẩn xác, làm nền tảng cho các bài học tương tác khuôn mặt.
            </p>
          </div>
        </div>

        {/* Camera & HandPose (Grid 2 cols) */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Camera Card */}
          <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border-4 border-slate-700 flex flex-col items-center justify-center relative">
            <div className="w-full aspect-video relative rounded-xl overflow-hidden shadow-inner bg-black">
              <CameraView
                videoRef={videoRef}
                canvasRef={canvasRef}
                modelStatus={faceModelStatus === 'loading' || handModelStatus === 'loading' ? 'loading' : 'ready'}
                cameraError={cameraError}
                onRetry={retryCamera}
              />
            </div>
            {/* Status indicators */}
            <div className="flex flex-col gap-2 mt-4 w-full">
               <div className={`px-4 py-2 rounded-xl font-bold text-xs flex justify-between items-center ${
                faceModelStatus === 'ready' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
              }`}>
                <span>FaceMesh</span>
                <span>{faceModelStatus === 'ready' ? 'Sẵn sàng' : 'Đang tải...'}</span>
              </div>
              <div className={`px-4 py-2 rounded-xl font-bold text-xs flex justify-between items-center ${
                handModelStatus === 'ready' ? 'bg-blue-500/20 text-blue-300' : 'bg-yellow-500/20 text-yellow-300'
              }`}>
                <span>HandPose</span>
                <span>{handModelStatus === 'ready' ? 'Sẵn sàng' : 'Đang tải...'}</span>
              </div>
            </div>
            
            {cameraError && (
              <div className="mt-4 flex items-center gap-2 text-red-100 font-bold bg-red-500/50 px-4 py-2 rounded-lg border border-red-400 w-full justify-center text-xs text-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Không thể truy cập Camera.</span>
              </div>
            )}
          </div>

          {/* Text 2: HandPose */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-blue-100 transform hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">2. Nhận Diện Tay</h2>
                <p className="text-blue-600 font-semibold">HandPose</p>
              </div>
            </div>
            
            <div className="space-y-4 text-gray-700 font-medium leading-relaxed">
              <p>
                Mỗi bàn tay được hệ thống mô phỏng thông qua <strong>21 điểm khớp nối</strong> (bao gồm khớp cổ tay và các lóng tay).
              </p>
              <div className="pt-2">
                <p className="text-gray-600 font-medium leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-200">
                  Đặc biệt, hệ thống có thể nhận diện và theo dõi <strong>cùng lúc cả 2 bàn tay</strong> độc lập để đọc các cử chỉ ngón tay phức tạp mà không cần thiết bị đeo ngoài.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Text 3: Security */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-emerald-100 transform hover:-translate-y-1 transition-transform">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <Shield className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-bold text-gray-800">3. Quyền Riêng Tư & Bảo Mật</h2>
          </div>
          <div className="space-y-4 text-gray-700 font-medium leading-relaxed">
            <p>
              An toàn dữ liệu của học sinh là ưu tiên hàng đầu. Tất cả các quá trình quét điểm mốc (landmarks) và nội suy mô hình AI đều được xử lý <strong>ngay trên trình duyệt (Browser Inference)</strong> của bạn bằng WebGL và WebAssembly.
            </p>
            <p className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              Tuyệt đối không có bất kỳ hình ảnh hay đoạn video nào từ camera của bạn được gửi lên máy chủ. Mọi thứ chỉ hoạt động cục bộ trên máy tính của bạn!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

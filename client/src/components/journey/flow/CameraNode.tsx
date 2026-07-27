import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

// CameraNode data should contain the videoRef and canvasRef to render the webcam feed
function CameraNode({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-emerald-400 w-80 relative transform transition-transform hover:scale-105">
      <div className="bg-emerald-500 text-white font-black px-4 py-2 text-center text-lg flex items-center justify-center gap-2">
        <span>👁️ MẮT THẦN CAMERA</span>
      </div>
      <div className="p-2 relative aspect-video bg-gray-900 flex items-center justify-center">
        {data.videoRef && (
          <video
            ref={data.videoRef}
            className="w-full h-full object-cover rounded-xl border-2 border-gray-700"
            autoPlay
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
          />
        )}
        {data.canvasRef && (
          <canvas
            ref={data.canvasRef}
            className="absolute top-0 left-0 w-full h-full object-cover rounded-xl pointer-events-none"
          />
        )}
      </div>
      <div className="p-3 text-center text-sm font-semibold text-gray-600 bg-emerald-50">
        Luồng hình ảnh được đẩy sang phải 👉
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-5 h-5 bg-emerald-500 border-4 border-white right-[-12px]"
      />
    </div>
  );
}

export default memo(CameraNode);

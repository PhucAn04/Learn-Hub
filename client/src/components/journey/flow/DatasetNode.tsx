import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera } from 'lucide-react';

function DatasetNode({ data }: { data: any }) {
  const {
    classes,
    activeClass,
    setActiveClass,
    getClassSampleCount,
    isCapturing,
    startCapturing,
    stopCapturing,
    clearClassSamples,
    modelStatus
  } = data;

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-amber-400 w-96 relative transform transition-transform hover:scale-105">
      {/* Input handle from Camera */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-5 h-5 bg-amber-500 border-4 border-white left-[-12px]"
      />

      <div className="bg-amber-500 text-white font-black px-4 py-2 text-center text-lg flex items-center justify-center gap-2">
        <span>📦 TỦ ĐỒ DỮ LIỆU</span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-600 text-center">
          1. Chọn ngăn tủ và Bấm giữ chụp ảnh để thu thập dữ liệu
        </p>

        {/* Classes selector */}
        <div className="grid grid-cols-2 gap-2">
          {classes && classes.map((cls: any) => {
            const count = getClassSampleCount ? getClassSampleCount(cls.id) : 0;
            const isActive = activeClass === cls.id;
            return (
              <div
                key={cls.id}
                onClick={() => setActiveClass && setActiveClass(cls.id)}
                className={`relative flex flex-col items-center justify-center p-3 rounded-2xl cursor-pointer transition-all border-4 ${
                  isActive
                    ? 'border-amber-500 bg-amber-50 shadow-md transform scale-105'
                    : 'border-gray-100 bg-white hover:border-amber-200'
                }`}
              >
                <div className="text-3xl mb-1">{cls.emoji}</div>
                <div className="font-bold text-sm text-center line-clamp-1">{cls.label}</div>
                <div className="mt-1 bg-amber-200 text-amber-800 text-xs font-black px-3 py-1 rounded-full">
                  {count} ảnh
                </div>
                {count > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (clearClassSamples) clearClassSamples(cls.id);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold shadow-md hover:bg-red-600 flex items-center justify-center"
                    title="Xóa hết"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Capture Button */}
        <button
          onMouseDown={startCapturing}
          onMouseUp={stopCapturing}
          onMouseLeave={stopCapturing}
          onTouchStart={startCapturing}
          onTouchEnd={stopCapturing}
          disabled={modelStatus !== 'ready'}
          className={`w-full font-extrabold py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-lg mt-2 border-b-4 ${
            isCapturing
              ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white animate-pulse scale-95'
              : 'bg-amber-500 hover:bg-amber-600 border-amber-700 text-white active:scale-95 disabled:bg-gray-300 disabled:scale-100'
          }`}
        >
          <Camera className="w-6 h-6" />
          <span>{isCapturing ? 'ĐANG CHỤP NHÁY NHÁY...' : 'GIỮ ĐỂ CHỤP 📸'}</span>
        </button>
      </div>

      {/* Output handle to AI Brain */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-5 h-5 bg-amber-500 border-4 border-white right-[-12px]"
      />
    </div>
  );
}

export default memo(DatasetNode);

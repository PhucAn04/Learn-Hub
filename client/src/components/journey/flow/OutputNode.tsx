import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function OutputNode({ data }: { data: any }) {
  const {
    isTrained,
    predictedLabel,
    confidence
  } = data;

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-rose-400 w-80 relative transform transition-transform hover:scale-105">
      {/* Input handle from Brain */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-5 h-5 bg-rose-500 border-4 border-white left-[-12px]"
      />

      <div className="bg-rose-500 text-white font-black px-4 py-3 text-center text-xl flex items-center justify-center gap-2">
        <span>🎯 KẾT QUẢ AI</span>
      </div>

      <div className="p-6 text-center">
        {!isTrained ? (
          <div className="text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl p-6">
            <span className="text-4xl block mb-2">💤</span>
            <p className="font-semibold text-sm">Chưa có kết quả. Hãy dạy AI trước nhé!</p>
          </div>
        ) : (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 shadow-inner relative overflow-hidden">
            <div className="text-rose-800 font-black text-2xl mb-2 z-10 relative">
              {predictedLabel || 'Đang suy nghĩ...'}
            </div>
            
            {confidence !== undefined && confidence > 0 && (
              <div className="inline-block bg-white text-rose-600 font-bold px-3 py-1 rounded-full text-sm border border-rose-200 shadow-sm z-10 relative">
                Chắc chắn {confidence}%
              </div>
            )}
            
            {/* Fun background particles based on prediction */}
            {predictedLabel && predictedLabel !== 'Khác thường... 👽' && predictedLabel !== 'AI đang đợi khuôn mặt bé... 👀' && (
              <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center text-8xl">
                ✨
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(OutputNode);

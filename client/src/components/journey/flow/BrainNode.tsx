import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function BrainNode({ data }: { data: any }) {
  const {
    isTraining,
    isTrained,
    canTrain,
    trainModel,
    currentEpoch,
    currentLoss,
    currentAcc
  } = data;

  // Gamification Metrics
  const epochProgress = Math.min(100, Math.round(((currentEpoch || 0) / 50) * 100)); // Assuming 50 epochs max
  const lossPercentage = currentLoss !== undefined ? Math.max(0, Math.min(100, currentLoss * 100)) : 100;
  const accPercentage = currentAcc !== undefined ? Math.round(currentAcc * 100) : 0;

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-indigo-500 w-96 relative transform transition-transform hover:scale-105">
      {/* Input handle from Dataset */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-5 h-5 bg-indigo-500 border-4 border-white left-[-12px]"
      />

      <div className="bg-indigo-600 text-white font-black px-4 py-3 text-center text-xl flex items-center justify-center gap-2">
        <span>🧠 BỘ NÃO AI</span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Animated Brain Display */}
        <div className="flex justify-center my-2 relative">
          <div className={`text-8xl transition-all duration-300 ${isTraining ? 'animate-bounce drop-shadow-[0_0_25px_rgba(99,102,241,0.8)] scale-110' : (isTrained ? 'drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]' : 'opacity-70')}`}>
            {isTraining ? '🤯' : (isTrained ? '😎' : '😴')}
          </div>
          
          {/* Bugs visualization for Loss */}
          {isTraining && currentLoss !== undefined && (
            <div className="absolute top-0 right-0 text-2xl transition-opacity duration-300" style={{ opacity: Math.max(0, (lossPercentage - 10) / 100) }}>
              🐛
            </div>
          )}
          {isTraining && currentLoss !== undefined && (
            <div className="absolute bottom-0 left-0 text-2xl transition-opacity duration-300" style={{ opacity: Math.max(0, (lossPercentage - 50) / 100) }}>
              🐞
            </div>
          )}
        </div>

        {isTraining ? (
          <div className="bg-indigo-50 rounded-2xl p-4 border-2 border-indigo-200">
            {/* Rocket Epoch Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs font-bold text-indigo-700 mb-1">
                <span>Chuyến bay Tri thức</span>
                <span>Tầng {currentEpoch || 0}/50</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-4 relative overflow-hidden">
                <div 
                  className="bg-indigo-600 h-4 rounded-full transition-all duration-300 relative"
                  style={{ width: `${epochProgress}%` }}
                >
                  <span className="absolute right-0 -top-1 text-sm">🚀</span>
                </div>
              </div>
            </div>

            {/* Mana Bar (Accuracy) */}
            <div className="mb-3">
              <div className="flex justify-between text-xs font-bold text-green-700 mb-1">
                <span>Sức mạnh Năng lực</span>
                <span>{accPercentage}%</span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                  style={{ width: `${accPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Confusion Level (Loss) */}
            <div>
              <div className="flex justify-between text-xs font-bold text-red-700 mb-1">
                <span>Độ bối rối (Nhiều bọ)</span>
                <span>Giảm dần...</span>
              </div>
              <div className="w-full bg-red-100 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, lossPercentage)}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {isTrained ? (
              <p className="text-green-600 font-bold mb-3">✨ Bộ não đã sẵn sàng hoạt động!</p>
            ) : (
              <p className="text-gray-500 font-semibold mb-3">Não đang ngủ. Hãy chụp ảnh bên trái để đánh thức nhé!</p>
            )}
            
            <button
              onClick={trainModel}
              disabled={!canTrain}
              className={`w-full font-black py-4 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-xl border-b-4 ${
                canTrain
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-purple-800 text-white active:scale-95 animate-pulse'
                  : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
              }`}
            >
              ⚡ DẠY AI NGAY ⚡
            </button>
          </div>
        )}
      </div>

      {/* Output handle to Result Node */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-5 h-5 bg-indigo-500 border-4 border-white right-[-12px]"
      />
    </div>
  );
}

export default memo(BrainNode);

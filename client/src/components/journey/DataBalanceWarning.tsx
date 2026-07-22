import { AlertTriangle, Info } from 'lucide-react';
import React from 'react';

interface DataBalanceWarningProps {
  isImbalanced: boolean;
  counts: Record<string, number>;
  maxRatio: number;
  message: string;
  maxLabel?: string;
  minLabel?: string;
  onBalanceClick?: () => void;
  onTestBothClick?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export default function DataBalanceWarning({
  isImbalanced,
  counts,
  maxRatio,
  message,
  maxLabel,
  minLabel,
  onBalanceClick,
  onTestBothClick,
  showActions = true,
  compact = false
}: DataBalanceWarningProps) {
  if (!isImbalanced && Object.keys(counts).length < 2) {
    return null; // Not enough data to even show balance
  }

  const maxCount = Math.max(...Object.values(counts));
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const ratioText = maxRatio > 1 ? `(tỷ lệ lệch: ${maxRatio.toFixed(1)}x)` : '';

  if (compact) {
    return (
      <div className={`p-2 rounded-lg border flex items-center gap-2 text-xs font-semibold ${
        isImbalanced ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-green-50 border-green-200 text-green-800'
      }`}>
        {isImbalanced ? <AlertTriangle className="w-4 h-4 text-orange-500" /> : <Info className="w-4 h-4 text-green-500" />}
        <span>{isImbalanced ? `Dữ liệu hơi lệch ${ratioText}. ${message}` : 'Dữ liệu cân bằng, rất tốt!'}</span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-2xl border-2 transition-colors ${
      isImbalanced 
        ? 'bg-orange-50 border-orange-200' 
        : 'bg-green-50 border-green-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1 p-2 rounded-full ${
          isImbalanced ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
        }`}>
          {isImbalanced ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
        </div>
        
        <div className="flex-1">
          <h4 className={`font-black text-sm mb-1 ${
            isImbalanced ? 'text-orange-900' : 'text-green-900'
          }`}>
            {isImbalanced ? `Phân Tích Dữ Liệu: Bị Lệch Rồi Bé Ơi! ⚖️ ${ratioText}` : 'Dữ Liệu Rất Cân Bằng! ⚖️✨'}
          </h4>
          
          <p className={`text-xs font-semibold mb-4 leading-relaxed ${
            isImbalanced ? 'text-orange-800' : 'text-green-800'
          }`}>
            {isImbalanced 
              ? message
              : 'Các nhãn đều có số lượng ảnh khá tương đồng. Trí tuệ nhân tạo sẽ học rất công bằng và không bị thiên vị!'}
          </p>

          {/* Bar Chart Visualization */}
          <div className="space-y-3 mb-4">
            {Object.entries(counts).map(([label, count]) => {
              const percentage = (count / maxCount) * 100;
              const isMax = label === maxLabel;
              const isMin = label === minLabel;
              
              return (
                <div key={label} className="relative">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-gray-700 truncate pr-2">{label}</span>
                    <span className="text-gray-500 whitespace-nowrap">{count} ảnh</span>
                  </div>
                  <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isImbalanced 
                          ? (isMax ? 'bg-orange-500' : (isMin ? 'bg-red-400' : 'bg-orange-300'))
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          {isImbalanced && showActions && (
            <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-orange-200">
              {onBalanceClick && (
                <button
                  onClick={onBalanceClick}
                  className="flex-1 py-2 px-3 bg-white border-2 border-orange-300 text-orange-700 font-bold rounded-xl text-xs hover:bg-orange-50 transition-colors"
                >
                  🛠️ Cân Bằng Tự Động
                </button>
              )}
              {onTestBothClick && (
                <button
                  onClick={onTestBothClick}
                  className="flex-1 py-2 px-3 bg-orange-600 border-b-4 border-orange-700 text-white font-bold rounded-xl text-xs hover:bg-orange-500 transition-colors"
                >
                  🔍 So Sánh Cả Hai
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

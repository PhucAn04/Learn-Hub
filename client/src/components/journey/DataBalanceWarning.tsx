import { AlertTriangle, Info } from 'lucide-react';
import React from 'react';

interface DataBalanceWarningProps {
  classCounts: { id: string, label: string, count: number }[];
  onTestBothClick?: () => void;
  compact?: boolean;
}

export default function DataBalanceWarning({
  classCounts,
  onTestBothClick,
  compact = false
}: DataBalanceWarningProps) {
  const activeClasses = classCounts.filter(c => c.count > 0);
  
  if (activeClasses.length < 2) {
    return null; // Not enough data to even show balance
  }

  const maxCount = Math.max(...activeClasses.map(c => c.count));
  const laggingClasses = activeClasses.filter(c => maxCount > c.count * 1.2);
  const isImbalanced = laggingClasses.length > 0;

  if (compact) {
    return (
      <div className={`p-2 rounded-lg border flex items-center gap-2 text-xs font-semibold ${
        isImbalanced ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'
      }`}>
        {isImbalanced ? <AlertTriangle className="w-4 h-4 text-yellow-500" /> : <Info className="w-4 h-4 text-green-500" />}
        <span>{isImbalanced ? 'Dữ liệu hơi lệch.' : 'Dữ liệu cân bằng, rất tốt!'}</span>
      </div>
    );
  }

  if (isImbalanced) {
    const laggingNames = laggingClasses.map(c => c.label).join(', ');
    return (
      <div className="mt-4 bg-yellow-50 border-2 border-yellow-300 text-yellow-800 rounded-2xl p-3 text-xs font-medium shadow-sm leading-relaxed">
        ⚠️ <b className="font-extrabold text-yellow-900">Chú ý: Số lượng ảnh đang chênh lệch!</b><br/>
        Nhãn <b className="font-bold text-yellow-900">[{laggingNames}]</b> đang có quá ít ảnh so với nhãn nhiều nhất. 
        Tỷ lệ ảnh không đều nhau có thể làm AI bị 'thiên vị' và dự đoán kém chính xác. 
        Bé hãy chụp thêm ảnh để cân bằng nhé!
        
        {onTestBothClick && (
          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-yellow-200">
            <button
              onClick={onTestBothClick}
              className="flex-1 py-2 px-3 bg-yellow-600 border-b-4 border-yellow-700 text-white font-bold rounded-xl text-xs hover:bg-yellow-500 transition-colors"
            >
              🔍 So Sánh Cả Hai
            </button>
          </div>
        )}
      </div>
    );
  }

  // Balanced
  return (
    <div className="mt-4 bg-green-50 border-2 border-green-300 text-green-800 rounded-2xl p-3 text-xs font-medium shadow-sm leading-relaxed">
      Dữ liệu cân bằng, rất tốt! Trí tuệ nhân tạo sẽ học rất công bằng và không bị thiên vị!
    </div>
  );
}

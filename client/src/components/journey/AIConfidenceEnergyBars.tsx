import React from 'react';
import { CLASS_COLORS } from '@/lib/scatter-layout';

interface ClassData {
  id: string;
  label: string;
  emoji?: string;
}

interface AIConfidenceEnergyBarsProps {
  classes: ClassData[];
  confidences: Record<string, number> | null;
  isAnomaly?: boolean;
  classCounts?: Record<string, number>;
}

export default function AIConfidenceEnergyBars({ classes, confidences, isAnomaly, classCounts }: AIConfidenceEnergyBarsProps) {
  if (!confidences) return null;

  // Lấy số ảnh nhiều nhất để làm chuẩn tính toán sự thiên vị nhẹ
  let maxCount = 0;
  if (classCounts) {
    maxCount = Math.max(...Object.values(classCounts));
  }

  const adjustedConfidences: Record<string, number> = {};
  classes.forEach(c => {
    let conf = confidences[c.id] || confidences[c.label] || 0;
    const cCount = classCounts ? (classCounts[c.id] || 0) : 0;
    
    // Thuật toán: Thể hiện sự thiên vị (Bias) một cách RẤT NHẸ NHÀNG lên thanh năng lượng.
    // Vì thanh năng lượng khá ngắn, nếu tuột nhiều sẽ giống như bị lỗi.
    // Chúng ta chỉ trừ tối đa khoảng 20% năng lượng của nhãn ít ảnh nhất.
    if (classCounts && maxCount > 0) {
      const penaltyRatio = cCount / maxCount; // 0.0 -> 1.0
      
      // Công thức softPenalty: 
      // Nếu bằng số ảnh (ratio = 1) => softPenalty = 0.8 + 0.2*1 = 1.0 (Giữ nguyên 100%)
      // Nếu 10 ảnh vs 20 ảnh (ratio = 0.5) => softPenalty = 0.8 + 0.2*0.5 = 0.9 (Giảm đi 10% năng lượng)
      // Nhãn bị thua thiệt sẽ bị khuyết đi một mẩu nhỏ xíu ở đuôi thanh năng lượng.
      const softPenalty = 0.8 + 0.2 * penaltyRatio; 
      
      conf = conf * softPenalty; 
    }
    
    adjustedConfidences[c.id] = conf;
  });

  // Tìm lớp có tự tin cao nhất để làm nổi bật
  let maxConfidence = 0;
  let maxClassId = '';
  Object.entries(adjustedConfidences).forEach(([id, conf]) => {
    if (conf > maxConfidence) {
      maxConfidence = conf;
      maxClassId = id;
    }
  });

  return (
    <div className="bg-white rounded-3xl p-4 border-4 border-amber-300 shadow-[0_10px_30px_rgba(245,158,11,0.2)] flex flex-col mt-4">
      <h4 className="font-extrabold text-sm text-amber-600 tracking-widest uppercase mb-3 text-center flex items-center justify-center gap-2">
        <span>⚡</span> Cột Năng Lượng AI
      </h4>
      
      <div className="flex flex-col justify-center gap-3 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100">
        {classes.map((c, idx) => {
          const confidence = adjustedConfidences[c.id] || 0;
          const widthPercent = isAnomaly ? 0 : Math.round(confidence * 100);
          const color = CLASS_COLORS[idx % CLASS_COLORS.length];
          const isWinner = !isAnomaly && (c.id === maxClassId || c.label === maxClassId) && confidence > 0.5;

          return (
            <div key={c.id} className="flex flex-row items-center gap-3 w-full">
              {/* Nhãn và Emoji */}
              <div
                className={`flex items-center justify-end gap-2 w-28 transition-all duration-300 ${
                  isWinner ? 'scale-110 drop-shadow-md' : 'scale-100 opacity-70'
                }`}
              >
                <span
                  className="text-[11px] font-bold leading-tight truncate text-right"
                  style={{ color: isWinner ? color : '#64748b' }}
                >
                  {c.label}
                </span>
                <span className="text-2xl">{c.emoji}</span>
              </div>

              {/* Thanh năng lượng ngang */}
              <div className="flex-1 h-8 sm:h-10 bg-slate-200 rounded-r-xl rounded-l-md overflow-hidden flex items-center border-2 border-slate-300">
                <div
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: color,
                    boxShadow: isWinner ? `0 0 15px ${color}` : 'none',
                    opacity: isWinner ? 1 : 0.6,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {isAnomaly && (
        <p className="mt-3 text-xs font-semibold text-rose-600 text-center leading-relaxed bg-rose-50 border border-rose-200 rounded-xl p-2 animate-pulse">
          ⚠️ Khác thường, không phải dữ liệu AI đã học!
        </p>
      )}
    </div>
  );
}

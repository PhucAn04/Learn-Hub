import React from 'react';
import { CLASS_COLORS } from '@/lib/scatter-layout';

interface ClassData {
  id: string;
  label: string;
  emoji: string;
}

interface AIConfidenceEnergyBarsProps {
  classes: ClassData[];
  confidences: Record<string, number> | null;
}

export default function AIConfidenceEnergyBars({ classes, confidences }: AIConfidenceEnergyBarsProps) {
  if (!confidences) return null;

  // Tìm lớp có tự tin cao nhất để làm nổi bật
  let maxConfidence = 0;
  let maxClassId = '';
  Object.entries(confidences).forEach(([id, conf]) => {
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
          const confidence = confidences[c.id] || confidences[c.label] || 0;
          const widthPercent = Math.round(confidence * 100);
          const color = CLASS_COLORS[idx % CLASS_COLORS.length];
          const isWinner = (c.id === maxClassId || c.label === maxClassId) && confidence > 0.5;

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

      <p className="mt-3 text-xs font-semibold text-gray-500 text-center leading-relaxed bg-amber-50 border border-amber-200 rounded-xl p-2">
        💡 <b>Mách nhỏ:</b> Cột nào dễ đầy hơn? Nhãn nào có nhiều ảnh hơn thì <b>Lực Hút</b> của nó càng mạnh, khiến AI bị thiên vị đấy!
      </p>
    </div>
  );
}

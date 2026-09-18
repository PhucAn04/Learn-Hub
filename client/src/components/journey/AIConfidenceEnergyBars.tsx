import React, { useState } from 'react';
import { CLASS_COLORS } from '@/lib/scatter-layout';
import { Eye, X } from 'lucide-react';

interface ClassData {
  id: string;
  label: string;
  emoji?: string;
}

interface AIConfidenceEnergyBarsProps {
  classes: ClassData[];
  confidences: Record<string, number> | null;
  isAnomaly?: boolean;
  anomalyMessage?: string;
  classCounts?: Record<string, number>;
  isPhaseB?: boolean;
  isMissingData?: boolean;
  teacherHintImages?: string[];
}

export default function AIConfidenceEnergyBars({ classes, confidences, isAnomaly, isMissingData, anomalyMessage, classCounts, isPhaseB, teacherHintImages }: AIConfidenceEnergyBarsProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  if (!confidences && !isAnomaly && !isMissingData) return null;

  const effectiveConfidences = confidences || {};

  // Tính số lượng ảnh trung bình mỗi nhãn để làm chuẩn
  let avgCount = 0;
  if (classCounts && classes.length > 0) {
    const totalCount = Object.values(classCounts).reduce((sum, count) => sum + count, 0);
    avgCount = totalCount / classes.length;
  }

  const adjustedConfidences: Record<string, number> = {};
  classes.forEach(c => {
    // Phase A: Giữ nguyên năng lượng do mô hình bé tự dự đoán (kể cả khi OOD)
    // Phase B: Khi OOD/Anomaly mới tuột về 0%
    let conf = (isPhaseB && isAnomaly) ? 0 : (effectiveConfidences[c.id] || effectiveConfidences[c.label] || 0);
    const cCount = classCounts ? (classCounts[c.id] || 0) : 0;
    
    if (classCounts && avgCount > 0 && !isAnomaly) {
      // Tỷ lệ so với số ảnh trung bình (tối đa là 1.0)
      const balanceRatio = Math.min(1.0, cCount / avgCount);
      
      // Sử dụng công thức phạt mạnh hơn để học sinh dễ thấy sự chênh lệch
      // Nếu balanceRatio = 1 (số ảnh >= trung bình) => softPenalty = 1.0 (Giữ nguyên 100%)
      // Nếu balanceRatio = 0.33 => softPenalty = 0.3 + 0.7 * 0.33 = 0.531 (Giảm ~47% năng lượng)
      const softPenalty = 0.3 + 0.7 * balanceRatio; 
      
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
    <>
      <div className="bg-white rounded-3xl p-4 border-4 border-amber-300 shadow-[0_10px_30px_rgba(245,158,11,0.2)] flex flex-col mt-4 relative">
        <h4 className="font-extrabold text-sm text-amber-600 tracking-widest uppercase mb-3 text-center flex items-center justify-center gap-2">
          <span>⚡</span> Cột Năng Lượng AI
        </h4>
        
        {(isMissingData || (isAnomaly && teacherHintImages && teacherHintImages.length > 0)) && (
          <div className="mb-3 px-3 py-3 bg-yellow-50 border-2 border-yellow-400 rounded-xl shadow-sm flex flex-col gap-3">
            <div className="text-yellow-800 text-xs font-bold text-center animate-pulse">
              {anomalyMessage || (isMissingData ? '✨ Góc độ khá chuẩn, nhưng Thư viện của Bé chưa có! Bé thử tự khám phá thêm xem sao nhé!' : 'Bé có muốn xem Gợi ý từ giáo viên để chụp đúng lại không?')}
            </div>
            {teacherHintImages && teacherHintImages.length > 0 && (
              <div className="flex flex-col items-center">
                {!showHint ? (
                  <button 
                    onClick={() => setShowHint(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold text-xs rounded-full transition-colors border border-amber-300 shadow-sm"
                  >
                    <span>💡</span> Bí quá? Xem gợi ý của Giáo viên!
                  </button>
                ) : (
                  <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <span className="text-[10px] uppercase font-black text-amber-600 tracking-wider mb-2">
                      👀 Gợi ý từ Giáo viên:
                    </span>
                    <div className="flex gap-2 justify-center">
                      {teacherHintImages.map((imgUrl, idx) => (
                        <div key={idx} className="relative group w-12 h-12 rounded-lg border-2 border-amber-300 overflow-hidden shadow-sm cursor-pointer" onClick={() => setPreviewImage(imgUrl)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imgUrl} alt={`Teacher hint ${idx}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

      {isAnomaly && !isMissingData && (!teacherHintImages || teacherHintImages.length === 0) && (
        <p className="mt-3 text-xs font-semibold text-rose-600 text-center leading-relaxed bg-rose-50 border border-rose-200 rounded-xl p-2 animate-pulse">
          {anomalyMessage || '⚠️ Khác thường, dữ liệu này chưa có trong thư viện ảnh của bé!'}
        </p>
      )}
      </div>

      {/* Full-screen Image Preview Overlay */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="bg-white p-2 rounded-2xl shadow-2xl border-4 border-amber-400 max-h-[85vh] overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={previewImage} 
                alt="Teacher hint preview" 
                className="max-w-full max-h-[80vh] object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()} 
              />
            </div>
            
            <p className="mt-4 text-white font-bold tracking-wide text-lg bg-black/50 px-4 py-2 rounded-full border border-white/20">
              💡 Gợi ý tư thế từ Giáo viên
            </p>
          </div>
        </div>
      )}
    </>
  );
}

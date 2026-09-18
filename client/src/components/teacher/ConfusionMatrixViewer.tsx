'use client';

import React from 'react';
import { BarChart3, AlertTriangle, Eye } from 'lucide-react';
import type { ModelEvaluation } from '@/types/models';

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${color}`}>
      {children}
    </span>
  );
}

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
      {icon} {children}
    </h3>
  );
}

function ExplainBox({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-semibold flex gap-2">
      <span className="text-base shrink-0">{emoji}</span>
      <div>{children}</div>
    </div>
  );
}

interface ConfusionMatrixViewerProps {
  evaluation: ModelEvaluation;
  onZoomImage?: (imgUrl: string, title?: string) => void;
}

export default function ConfusionMatrixViewer({ evaluation, onZoomImage }: ConfusionMatrixViewerProps) {
  const cm = evaluation.confusionMatrix;
  const evidence = evaluation.sampleEvidence;

  const groupedDetails = React.useMemo(() => {
    return evidence?.goldenTestDetails?.reduce((acc, td) => {
      if (!acc[td.expectedLabel]) acc[td.expectedLabel] = [];
      acc[td.expectedLabel].push(td);
      return acc;
    }, {} as Record<string, NonNullable<typeof evidence.goldenTestDetails>>) || {};
  }, [evidence?.goldenTestDetails]);

  if (!cm) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <SectionHeader icon={<BarChart3 className="w-4 h-4 text-indigo-500" />}>
        Báo Cáo Tổng Quan (Golden Test)
      </SectionHeader>
      
      {/* Bars per class / Overview */}
      <div className="space-y-4">
        {cm.labels.map(label => {
          const detailsForLabel = groupedDetails[label] || [];
          const total = detailsForLabel.length;
          const correct = detailsForLabel.filter(td => td.isCorrect).length;
          const acc = total > 0 ? Math.round((correct / total) * 100) : (cm.perClassAccuracy[label] ?? 0);
          
          const avgConfidence = total > 0 
            ? Math.round(detailsForLabel.reduce((sum, td) => sum + td.confidence, 0) / total) 
            : null;

          const isWeakest = label === cm.weakestLabel;
          const color = acc >= 80 ? 'bg-green-500' : acc >= 50 ? 'bg-amber-500' : 'bg-red-500';
          const textColor = acc >= 80 ? 'text-green-700' : acc >= 50 ? 'text-amber-700' : 'text-red-700';
          const lightBg = isWeakest ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-100';

          return (
            <div key={label} className={`p-4 rounded-2xl ${lightBg}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-800">{label}</span>
                  {isWeakest && (
                    <Badge color="bg-red-100 text-red-600">
                      <AlertTriangle className="w-3 h-3" /> Yếu nhất
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-semibold text-slate-600">
                  {total > 0 && <span>Số thử nghiệm: {total} | Đúng: {correct}</span>}
                  {avgConfidence !== null && (
                    <span className="bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200">
                      Mô hình tự tin TB: <span className="text-slate-800">{avgConfidence}%</span>
                    </span>
                  )}
                  <span className={`text-sm font-black px-2.5 py-1 rounded-lg bg-white shadow-sm border border-slate-200 ${textColor}`}>
                    Chính xác: {acc}%
                  </span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${acc}%` }} />
              </div>
              
              <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                {acc >= 80 ? (
                   <><span className="text-green-500 text-sm">🌟</span> Rất Tốt: Bé làm rất nhất quán và rõ ràng.</>
                ) : acc >= 50 ? (
                   <><span className="text-amber-500 text-sm">⚠️</span> Cần luyện tập thêm: Cử chỉ chưa ổn định, ngón tay chưa tách rõ.</>
                ) : (
                   <><span className="text-red-500 text-sm">🚨</span> Yếu: Bé gặp khó khăn với cử chỉ này, AI rất hay nhầm.</>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mô Hình Tự Tin — từng ảnh GV chạy qua model bé */}
      {evidence?.modelConfidencePerImage && evidence.modelConfidencePerImage.length > 0 && (() => {
        const learnedItems = evidence.modelConfidencePerImage.filter(td => !td.isUnlearnedStyle);
        const unlearnedItems = evidence.modelConfidencePerImage.filter(td => td.isUnlearnedStyle);
        const learnedCorrect = learnedItems.filter(td => td.isCorrect).length;
        const learnedTotal = learnedItems.length;
        const unlearnedTotal = unlearnedItems.length;

        return (
        <div className="mt-8">
          <SectionHeader icon={<span className="text-base">🧠</span>}>
            Mô Hình AI Đánh Giá Từng Ảnh
          </SectionHeader>
          <p className="text-xs text-slate-500 mb-3 -mt-2 px-1">
            Mỗi ảnh của Giáo viên được đưa qua mô hình AI mà bé đã huấn luyện. &quot;Mô hình tự tin&quot; cho biết AI của bé chắc chắn bao nhiêu %.
          </p>

          {/* Thống kê tổng quan */}
          <div className="flex flex-wrap gap-2 mb-4 text-xs font-semibold">
            <span className="bg-slate-100 px-2.5 py-1 rounded-lg">Tổng: {evidence.modelConfidencePerImage.length} ảnh</span>
            {learnedTotal > 0 && (
              <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-lg">
                ✅ Đã học: {learnedCorrect}/{learnedTotal} đúng
              </span>
            )}
            {unlearnedTotal > 0 && (
              <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg">
                🆕 Kiểu mới chưa học: {unlearnedTotal} ảnh
              </span>
            )}
          </div>

          {/* ── NHÓM 1: Ảnh mà bé ĐÃ HỌC kiểu dáng này ── */}
          {learnedTotal > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-3">
                📋 Kiểu dáng bé đã học — Đánh giá chất lượng model ({learnedCorrect}/{learnedTotal} đúng)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {learnedItems.map((td, i) => (
                  <div key={`learned-${i}`} className={`p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm ${
                    td.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    {td.thumbnail ? (
                      <div 
                        className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-200 relative group cursor-pointer"
                        onClick={() => onZoomImage && onZoomImage(td.thumbnail!, `AI đoán: "${td.predictedLabel}" | Tự tin: ${Math.round(td.confidence)}%`)}
                      >
                        <img src={td.thumbnail} alt={td.expectedLabel} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-5 h-5 text-slate-700" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-lg leading-none mt-0.5">{td.isCorrect ? '✅' : '❌'}</span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 truncate">
                          {td.isCorrect ? '✅' : '❌'} Ảnh
                        </span>
                        <span className={`font-semibold text-[10px] ${
                          td.confidence >= 80 ? 'text-green-600' : td.confidence >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>Mô hình tự tin: {Math.round(td.confidence)}%</span>
                      </div>
                      <div className="text-slate-600 truncate">
                        Đáp án: <span className="font-semibold">{td.expectedLabel}</span>
                      </div>
                      <div className={`${td.isCorrect ? 'text-green-700' : 'text-red-600'} truncate`}>
                        AI đoán: <span className="font-bold">{td.predictedLabel}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NHÓM 2: Ảnh mà bé CHƯA HỌC kiểu dáng này ── */}
          {unlearnedTotal > 0 && (
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 mt-4">
              <h4 className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider mb-2">
                🆕 Kiểu dáng GV có nhưng bé chưa học — {unlearnedTotal} ảnh
              </h4>
              <p className="text-[11px] text-amber-800 font-medium mb-3 leading-relaxed">
                Những ảnh dưới đây thuộc <strong>kiểu tay/cử chỉ mà Giáo viên đã chụp</strong> nhưng <strong>bé chưa bao giờ chụp kiểu này</strong> khi dạy AI.
                Do đó, AI của bé đoán sai là điều bình thường — không phải lỗi của bé.
                Nếu muốn AI nhận diện tốt hơn, bé cần chụp thêm kiểu dáng này.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unlearnedItems.map((td, i) => (
                  <div key={`unlearned-${i}`} className="p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm bg-amber-50 border border-amber-300">
                    {td.thumbnail ? (
                      <div 
                        className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-amber-300 bg-slate-200 relative group cursor-pointer"
                        onClick={() => onZoomImage && onZoomImage(td.thumbnail!, `🆕 Kiểu dáng mới — Nhãn GV: "${td.expectedLabel}" | Bé chưa học kiểu này`)}
                      >
                        <img src={td.thumbnail} alt={td.expectedLabel} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-5 h-5 text-amber-700" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-lg leading-none mt-0.5">🆕</span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-amber-800 truncate">
                          🆕 Kiểu mới
                        </span>
                        <span className="font-semibold text-[10px] text-red-500">
                          Mô hình tự tin: {Math.round(td.confidence)}%
                        </span>
                      </div>
                      <div className="text-amber-900 truncate">
                        Nhãn GV: <span className="font-semibold">{td.expectedLabel}</span>
                      </div>
                      <div className="text-[10px] text-amber-500 font-medium italic">
                        AI chưa được học kiểu dáng này nên tự tin rất kém
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-amber-100 rounded-xl text-xs font-semibold text-amber-800">
                💡 <strong>Gợi ý:</strong> Bé có thể chụp thêm ảnh theo các kiểu dáng này để AI học thêm và nhận diện chính xác hơn ở lần nộp bài sau.
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Fallback: Golden Test Detail (khi không có modelConfidencePerImage) */}
      {(!evidence?.modelConfidencePerImage || evidence.modelConfidencePerImage.length === 0) &&
        evidence?.goldenTestDetails && evidence.goldenTestDetails.length > 0 && (
        <div className="mt-8">
          <SectionHeader icon={<span className="text-base">🔍</span>}>
            Chi Tiết Từng Câu Kiểm Tra
          </SectionHeader>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {evidence.goldenTestDetails.map((td, i) => (
                <div key={i} className={`p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm ${
                  td.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <span className="text-lg leading-none mt-0.5">{td.isCorrect ? '✅' : '❌'}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 truncate">Câu {i + 1}</span>
                      <span className="text-slate-500 font-semibold text-[10px]">Mô hình tự tin: {Math.round(td.confidence)}%</span>
                    </div>
                    <div className="text-slate-600 truncate">
                      Đáp án: <span className="font-semibold">{td.expectedLabel}</span>
                    </div>
                    <div className={`${td.isCorrect ? 'text-green-700' : 'text-red-600'} truncate`}>
                      AI đoán: <span className="font-bold">{td.predictedLabel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Misclassification Summary */}
      {cm.misclassifications && cm.misclassifications.length > 0 && (
        <div className="mt-8 space-y-2">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase">Mẫu Nhầm Lẫn Phổ Biến</h4>
          {cm.misclassifications.map((mc, i) => (
            <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm flex items-center gap-3">
              <span className="text-xl">🔄</span>
              <div>
                <span className="font-bold text-red-800">
                  &ldquo;{mc.trueLabel}&rdquo; → AI đoán &ldquo;{mc.predictedLabel}&rdquo;
                </span>
                <span className="text-red-600 font-extrabold ml-2">{mc.count} lần ({mc.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <ExplainBox emoji="📖">
        <strong>Báo Cáo Tổng Quan &amp; Chi Tiết</strong> giúp phát hiện chính xác bé đang gặp khó khăn ở cử chỉ nào. 
        Nếu mô hình tự tin thấp hoặc dự đoán sai nhiều, hãy cho bé xem lại mẫu và luyện tập thêm.
        <br/><br/>
        <strong>Nhãn yếu nhất</strong> = nhãn mà AI sai nhiều nhất — là ưu tiên #1 để bé cải thiện.
      </ExplainBox>
    </div>
  );
}

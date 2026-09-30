import React from 'react';
import { ModelEvaluation } from '@/types/models';
import { Eye } from 'lucide-react';

interface StudentImageAuditViewerProps {
  evaluation: ModelEvaluation;
  onZoomImage?: (src: string, caption: string) => void;
}

export default function StudentImageAuditViewer({ evaluation, onZoomImage }: StudentImageAuditViewerProps) {
  const auditData = evaluation.sampleEvidence?.studentImageAudit;

  if (!auditData || auditData.length === 0) {
    return null;
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'teacher': return 'Giáo viên';
      case 'golden': return 'Golden';
      case 'self': return 'Học sinh';
      default: return source;
    }
  };

  // Thống kê nhanh
  const totalImages = auditData.length;
  const correctImages = auditData.filter(td => td.isMatch).length;
  const avgConfidence = Math.round(auditData.reduce((sum, td) => sum + td.confidence, 0) / totalImages);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mt-6">
      <div className="mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-700 p-1.5 rounded-xl text-xl">🖼️</span>
          Kiểm Định Ảnh Học Sinh
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Từng ảnh bé chụp được so sánh với bộ dữ liệu chuẩn để đánh giá Độ Chuẩn riêng biệt.
        </p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs font-semibold">
          <span className="bg-slate-100 px-2 py-1 rounded-lg">Tổng: {totalImages} ảnh</span>
          <span className="bg-green-50 text-green-700 px-2 py-1 rounded-lg">✅ Đạt: {correctImages}</span>
          {totalImages - correctImages > 0 && (
            <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg">❌ Sai: {totalImages - correctImages}</span>
          )}
          <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">Độ chuẩn TB: {avgConfidence}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {auditData.map((td, i) => (
          <div key={i} className={`p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm ${
            td.isMatch ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {td.thumbnail ? (
              <div 
                className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-200 relative group cursor-pointer"
                onClick={() => onZoomImage && onZoomImage(td.thumbnail!, `Bé gán: "${td.expectedLabel}" → AI đoán: "${td.predictedLabel}"`)}
              >
                <img src={td.thumbnail} alt={td.expectedLabel} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-5 h-5 text-slate-700" />
                </div>
              </div>
            ) : (
              <span className="text-lg leading-none mt-0.5">{td.isMatch ? '✅' : '❌'}</span>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 truncate">
                  {td.isMatch ? '✅' : '❌'} Ảnh {i + 1}
                </span>
                <span className={`font-semibold text-[10px] ${
                  td.confidence >= 80 ? 'text-green-600' : td.confidence >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>Độ chuẩn: {Math.round(td.confidence)}%</span>
              </div>
              <div className="text-slate-600 truncate">
                Nhãn: <span className="font-semibold">{td.expectedLabel}</span>
              </div>
              <div className={`${td.isMatch ? 'text-green-700' : 'text-red-600'} truncate`}>
                AI đoán: <span className="font-bold">{td.predictedLabel}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                (Nguồn: {getSourceLabel(td.evaluationSource)})
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

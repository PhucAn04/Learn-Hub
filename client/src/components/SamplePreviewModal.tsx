import { X, Trash2, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { StoredSample } from '@/lib/knn-classifier';

interface SamplePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: Partial<StoredSample>; // Allow partial objects for reference images
  onDelete?: () => void;
  readonly?: boolean;
}

export default function SamplePreviewModal({
  isOpen,
  onClose,
  sample,
  onDelete,
  readonly
}: SamplePreviewModalProps) {
  if (!isOpen || !sample) return null;

  const isInvalid = sample.isValid === false || sample.aiFeedback?.isMisclassified === true;
  const isAiMisclassified = sample.aiFeedback?.isMisclassified === true;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className={`bg-white rounded-3xl ${isAiMisclassified ? 'max-w-2xl' : 'max-w-sm'} w-full p-6 border-4 border-indigo-400 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-black text-indigo-900 mb-6 flex items-center gap-2">
          <span>📸</span> Chi tiết ảnh mẫu
        </h3>

        {isAiMisclassified ? (
          /* SIDE-BY-SIDE COMPARISON FOR MISCLASSIFICATION */
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="flex-1 text-center w-full">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Ảnh bé chụp</span>
              <div className="relative rounded-2xl overflow-hidden border-4 border-red-400 bg-slate-900 aspect-square shadow-md">
                <img src={sample.thumbnail || sample.rawThumbnail} alt="Bé chụp" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-sm font-bold bg-amber-100 text-amber-800 px-3 py-2 rounded-xl">Bé gán: {sample.label}</div>
            </div>

            <div className="flex-shrink-0">
              <ChevronRight className="w-10 h-10 text-slate-300 hidden sm:block" />
            </div>

            <div className="flex-1 text-center w-full">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">AI thấy giống ảnh này</span>
              <div className="relative rounded-2xl overflow-hidden border-4 border-indigo-400 bg-slate-900 aspect-square shadow-md">
                 <img src={sample.aiFeedback!.nearestMatchThumbnail || sample.thumbnail} alt="Ảnh tham chiếu" className="w-full h-full object-cover" />
              </div>
              <div className="mt-3 text-sm font-bold bg-indigo-100 text-indigo-800 px-3 py-2 rounded-xl">AI đoán: {sample.aiFeedback!.predictedLabel}</div>
            </div>
          </div>
        ) : (
          /* STANDARD SINGLE IMAGE VIEW */
          <div className={`relative rounded-2xl overflow-hidden border-4 ${isInvalid ? 'border-red-400' : 'border-gray-200'} mb-4 bg-slate-900 flex items-center justify-center min-h-[240px] aspect-square`}>
            {sample.thumbnail ? (
              <img src={sample.thumbnail} alt="Sample preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-gray-500 font-semibold">Không có ảnh thu nhỏ</div>
            )}
            
            {isInvalid && (
              <div className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {!isAiMisclassified && (
            <div>
              <span className="text-xs font-bold text-gray-500 block">Nhãn phân loại:</span>
              <span className="text-lg font-black text-indigo-700">{sample.label}</span>
            </div>
          )}

          {isAiMisclassified ? (
            <div className="p-4 rounded-2xl border-2 bg-red-50 border-red-200 text-center">
              <div className="flex justify-center items-center gap-2 font-black text-red-700 text-base mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span>AI bị nhầm lẫn mất rồi!</span>
              </div>
              <p className="text-sm text-red-600 font-semibold">
                AI thấy ảnh của bé trông giống với tư thế <span className="font-bold text-indigo-700">"{sample.aiFeedback!.predictedLabel}"</span> hơn. Bé hãy xóa ảnh này và chụp lại cho đúng tư thế <span className="font-bold text-indigo-700">"{sample.label}"</span> nhé!
              </p>
            </div>
          ) : sample.isValid !== undefined ? (
            <div className={`p-3 rounded-xl border ${isInvalid ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`flex items-center gap-2 font-bold ${isInvalid ? 'text-red-700' : 'text-green-700'}`}>
                {isInvalid ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>
                  {isInvalid ? 'AI nghĩ ảnh này KHÔNG ĐÚNG nhãn!' : 'Ảnh tốt, AI nhận diện chính xác!'}
                </span>
              </div>
              {isInvalid && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  Lời khuyên: Bé nên xóa ảnh này đi và chụp lại cho đúng nhãn nhé.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {!readonly && onDelete && (
          <div className="flex gap-3 mt-auto">
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex-1 py-4 bg-red-100 text-red-600 hover:bg-red-200 font-extrabold rounded-2xl transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 shadow-sm"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-base">XÓA ẢNH NÀY</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

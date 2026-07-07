import { X, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { StoredSample } from '@/lib/knn-classifier';

interface SamplePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: StoredSample | null;
  onDelete: () => void;
}

export default function SamplePreviewModal({
  isOpen,
  onClose,
  sample,
  onDelete
}: SamplePreviewModalProps) {
  if (!isOpen || !sample) return null;

  const isInvalid = sample.isValid === false;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl max-w-sm w-full p-6 border-4 border-indigo-400 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-black text-indigo-900 mb-4 flex items-center gap-2">
          <span>📸</span> Chi tiết ảnh mẫu
        </h3>

        <div className={`relative rounded-2xl overflow-hidden border-4 ${isInvalid ? 'border-red-400' : 'border-gray-200'} mb-4 bg-slate-900 flex items-center justify-center min-h-[240px]`}>
          {sample.thumbnail ? (
            <img src={sample.thumbnail} alt="Sample preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-gray-500 font-semibold">Không có ảnh thu nhỏ</div>
          )}
          
          {isInvalid && (
            <div className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
          )}
        </div>

        <div className="space-y-3 mb-6">
          <div>
            <span className="text-xs font-bold text-gray-500 block">Nhãn phân loại:</span>
            <span className="text-lg font-black text-indigo-700">{sample.label}</span>
          </div>

          {sample.isValid !== undefined && (
            <div className={`p-3 rounded-xl border ${isInvalid ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`flex items-center gap-2 font-bold ${isInvalid ? 'text-red-700' : 'text-green-700'}`}>
                {isInvalid ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>
                  {isInvalid ? 'AI nghĩ ảnh này không giống nhãn đã chọn!' : 'Ảnh tốt, AI nhận diện chính xác!'}
                </span>
              </div>
              {isInvalid && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  Lời khuyên: Bé nên xóa ảnh này đi và chụp lại cho đúng nhãn nhé.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex-1 py-3 bg-red-100 text-red-600 hover:bg-red-200 font-extrabold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>XÓA ẢNH NÀY</span>
          </button>
        </div>

      </div>
    </div>
  );
}

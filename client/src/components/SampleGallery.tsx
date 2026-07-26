'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, Eye, EyeOff, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { StoredSample } from '@/lib/knn-classifier';

interface SampleGalleryProps {
  samples: StoredSample[];
  onDeleteSample: (id: string) => void;
  onClearAll: () => void;
  isTrained?: boolean;
}

export default function SampleGallery({ samples, onDeleteSample, onClearAll, isTrained = false }: SampleGalleryProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);

  if (samples.length === 0) return null;

  const invalidSamples = samples.filter(s => s.isValid === false || s.aiFeedback?.isMisclassified === true);
  const invalidCount = invalidSamples.length;
  const previewSample = previewIndex !== null ? samples[previewIndex] : null;

  return (
    <div className="mt-4 border-t-2 border-gray-100 pt-4">
      {/* Invalid warning banner */}
      {invalidCount > 0 && (
        <div className="mb-3 bg-red-50 border-2 border-red-300 rounded-2xl p-3 animate-bounce-once">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-extrabold text-red-700">
                ⚠️ Có {invalidCount} ảnh cần kiểm tra lại!
              </p>
              <p className="text-xs text-red-600 mt-1">
                AI nghĩ {invalidCount > 1 ? 'những' : ''} ảnh có viền nổi bật (đỏ/vàng) không đúng nhãn bé đang dạy hoặc bị mờ.
                Bé hãy bấm vào ảnh để xem chi tiết và xóa ảnh bị lỗi nhé!
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-500">
          📷 Thư viện ảnh ({samples.length})
          {invalidCount > 0 && <span className="text-red-500 ml-1">• {invalidCount} ảnh nghi sai</span>}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClearAll();
          }}
          className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg"
        >
          <Trash2 className="w-3 h-3" /> Xóa hết
        </button>
      </div>

      {/* Thumbnail grid - larger size, wrapped */}
      <div className="grid grid-cols-4 gap-2 py-2 px-1 max-h-[240px] overflow-y-auto">
        {samples.map((s, index) => {
          const isInvalid = s.isValid === false || s.aiFeedback?.isMisclassified === true;
          const isBadQuality = s.quality?.isBlurry || s.quality?.isDark;
          const key = s.id || `sample-${index}`;
          
          return (
            <div
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex(index);
              }}
              className={`group relative overflow-hidden rounded-xl shadow-sm cursor-pointer transition-all hover:scale-105 aspect-square ${
                isBadQuality
                  ? 'border-4 border-yellow-500 ring-2 ring-yellow-300 ring-offset-1 z-10'
                  : isInvalid 
                  ? 'border-4 border-red-500 ring-2 ring-red-300 ring-offset-1 z-10' 
                  : 'border-2 border-indigo-100 hover:border-indigo-400'
              }`}
            >
              {s.thumbnail ? (
                <img src={s.thumbnail} alt="thumb" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 bg-slate-800">📷</div>
              )}

              {/* Quality Warning Icon (Top Left) */}
              {(s.quality?.isBlurry || s.quality?.isDark) && (
                <div 
                  className="absolute top-1 left-1 bg-yellow-500 text-white p-1 rounded shadow-lg opacity-90 z-10" 
                  title={s.quality.isBlurry ? 'Ảnh mờ' : 'Ảnh tối'}
                >
                  <AlertTriangle className="w-3 h-3" />
                </div>
              )}

              {isBadQuality ? (
                <div className="absolute inset-0 bg-yellow-500/10 flex items-center justify-center pointer-events-none" />
              ) : isInvalid ? (
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                  <div className="bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
              ) : null}

              {!isInvalid && !isBadQuality && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Eye className="w-5 h-5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full-screen preview modal */}
      {previewSample && previewIndex !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewIndex(null)}>
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 border-4 border-indigo-400 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setPreviewIndex(null)}
              className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-indigo-900 mb-3 flex items-center gap-2">
              📸 Ảnh mẫu #{previewIndex + 1}
            </h3>

            {/* Toggle button */}
            {previewSample.rawThumbnail && (
              <button
                onClick={() => setShowSkeleton(!showSkeleton)}
                className="absolute top-16 right-4 p-2 bg-white hover:bg-gray-100 rounded-full text-indigo-600 shadow-md border border-indigo-200 transition-colors z-[60] flex items-center gap-2"
                title={showSkeleton ? "Ẩn nét vẽ AI" : "Hiện nét vẽ AI"}
              >
                {showSkeleton ? <Eye className="w-5 h-5 text-indigo-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
              </button>
            )}

            {/* Large image preview */}
            <div className="flex gap-3 mb-4">
              <div className={`relative flex-1 rounded-2xl overflow-hidden border-4 ${
                (previewSample.quality?.isBlurry || previewSample.quality?.isDark)
                  ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                  : previewSample.isValid === false 
                  ? 'border-red-500' 
                  : 'border-gray-200'
              } bg-slate-900`}>
                {isTrained && previewSample.aiFeedback?.isMisclassified && (
                  <div className="absolute top-0 inset-x-0 bg-red-500/80 backdrop-blur-sm text-white text-xs py-1 text-center font-bold z-10 truncate shadow-sm">
                    Ảnh của bé
                  </div>
                )}
                {previewSample.thumbnail ? (
                  <img 
                    src={(showSkeleton || !previewSample.rawThumbnail) ? previewSample.thumbnail : previewSample.rawThumbnail} 
                    alt="Preview" 
                    className="w-full aspect-square object-cover" 
                  />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center text-gray-500">Không có ảnh</div>
                )}

                {previewSample.isValid === false && (
                  <div className="absolute bottom-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg animate-pulse z-10">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* AI nearest match for misclassified */}
              {isTrained && previewSample.isValid === false && previewSample.aiFeedback?.isMisclassified && (
                <div className="relative flex-1 rounded-2xl overflow-hidden border-4 border-indigo-400 bg-slate-900 shadow-inner">
                  <div className="absolute top-0 inset-x-0 bg-indigo-500/80 backdrop-blur-sm text-white text-xs py-1 text-center font-bold z-10 truncate shadow-sm">
                    Mẫu ({previewSample.aiFeedback.predictedLabel})
                  </div>
                  {previewSample.aiFeedback.nearestMatchThumbnail ? (
                    <img 
                      src={previewSample.aiFeedback.nearestMatchThumbnail} 
                      className="w-full aspect-square object-cover" 
                      alt="Nearest match"
                    />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center text-xs text-indigo-400 font-bold bg-indigo-50/5">
                      Không có mẫu
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Validation status & Quality Warning */}
            {previewSample.isValid === false ? (
              (previewSample.quality?.isBlurry || previewSample.quality?.isDark) ? (
                <div className="p-4 rounded-xl border-2 bg-yellow-50 border-yellow-300 mb-4">
                  <div className="flex items-center gap-2 font-extrabold text-yellow-700 text-sm">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Ảnh chưa đạt chất lượng!</span>
                  </div>
                  <p className="text-xs text-yellow-600 mt-2 font-semibold leading-relaxed">
                    {previewSample.quality.isBlurry && '📸 Vì ảnh bị mờ nên AI không thể xác định được bé đang giơ mấy ngón tay. '}
                    {previewSample.quality.isDark && '🌙 Vì ảnh hơi tối nên AI không thể nhìn rõ tay bé. '}
                    Bé nên xóa tấm này và chụp lại tấm khác nét hơn để AI học tốt nhất nhé!
                  </p>
                </div>
              ) : (isTrained && previewSample.aiFeedback?.isMisclassified) ? (
                <div className="p-4 rounded-xl border-2 bg-red-50 border-red-300 mb-4">
                  <div className="flex items-center gap-2 font-extrabold text-red-700 text-sm">
                    <AlertTriangle className="w-5 h-5" />
                    <span>AI đã nhầm lẫn ảnh này!</span>
                  </div>
                  <p className="text-xs text-red-600 mt-2 font-semibold leading-relaxed">
                    Ảnh này quá giống với mẫu của nhóm <span className="font-bold">"{previewSample.aiFeedback.predictedLabel}"</span> nên AI đã đoán sai. Bé hãy XÓA đi và chụp lại góc khác nhé!
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border-2 bg-red-50 border-red-300 mb-4">
                  <div className="flex items-center gap-2 font-extrabold text-red-700 text-sm">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Ảnh chưa đạt chuẩn!</span>
                  </div>
                  <p className="text-xs text-red-600 mt-2 font-semibold leading-relaxed">
                    Bạn AI đã xem ảnh này và thấy nó không giống với nhãn "{previewSample.label}" mà bé đang dạy.
                    Bé nên xóa ảnh này đi và chụp lại cho đúng nhé! 🤗
                  </p>
                </div>
              )
            ) : previewSample.isValid === true ? (
              <div className="p-4 rounded-xl border-2 bg-green-50 border-green-300 mb-4">
                <div className="flex items-center gap-2 font-extrabold text-green-700 text-sm">
                  ✅ <span>Ảnh tốt! AI nhận diện đúng nhãn rồi!</span>
                </div>
              </div>
            ) : null}

            {/* Quality Warning fallback for images that are somehow valid but still flagged */}
            {previewSample.isValid !== false && (previewSample.quality?.isBlurry || previewSample.quality?.isDark) && (
              <div className="p-4 rounded-xl border-2 bg-yellow-50 border-yellow-300 mb-4">
                <div className="flex items-center gap-2 font-extrabold text-yellow-700 text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Cảnh báo chất lượng ảnh!</span>
                </div>
                <p className="text-xs text-yellow-600 mt-2 font-semibold leading-relaxed">
                  {previewSample.quality.isBlurry && '📸 Ảnh này hơi mờ. '}
                  {previewSample.quality.isDark && '🌙 Ảnh này hơi tối. '}
                  Bé nên chụp lại tấm khác nét hơn nha!
                </p>
              </div>
            )}

            {/* Navigation and Delete */}
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                disabled={previewIndex <= 0}
                className="p-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  if (previewSample?.id) {
                    onDeleteSample(previewSample.id);
                    if (previewIndex >= samples.length - 1) {
                      setPreviewIndex(samples.length > 1 ? previewIndex - 1 : null);
                    }
                  }
                }}
                className="flex-1 py-3 bg-red-100 text-red-600 hover:bg-red-200 font-extrabold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>XÓA ẢNH NÀY</span>
              </button>

              <button
                onClick={() => setPreviewIndex(Math.min(samples.length - 1, previewIndex + 1))}
                disabled={previewIndex >= samples.length - 1}
                className="p-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded-xl transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-center text-xs text-gray-400 mt-2 font-semibold">
              Ảnh {previewIndex + 1} / {samples.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

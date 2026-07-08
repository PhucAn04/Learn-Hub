'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { StoredSample } from '@/lib/knn-classifier';

interface SampleGalleryProps {
  samples: StoredSample[];
  onDeleteSample: (id: string) => void;
  onClearAll: () => void;
}

export default function SampleGallery({ samples, onDeleteSample, onClearAll }: SampleGalleryProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (samples.length === 0) return null;

  const invalidSamples = samples.filter(s => s.isValid === false);
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
                ⚠️ Có {invalidCount} ảnh có thể sai nhãn!
              </p>
              <p className="text-xs text-red-600 mt-1">
                AI nghĩ {invalidCount > 1 ? 'những' : ''} ảnh có viền đỏ bên dưới không giống với nhãn bé đang dạy.
                Bé hãy bấm vào ảnh để xem chi tiết và xóa ảnh sai nhé!
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
          const isInvalid = s.isValid === false;
          const key = s.id || `sample-${index}`;
          
          return (
            <div
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex(index);
              }}
              className={`group relative overflow-hidden rounded-xl shadow-sm cursor-pointer transition-all hover:scale-105 aspect-square ${
                isInvalid 
                  ? 'border-4 border-red-500 ring-2 ring-red-300 ring-offset-1' 
                  : 'border-2 border-indigo-100 hover:border-indigo-400'
              }`}
            >
              {s.thumbnail ? (
                <img src={s.thumbnail} alt="thumb" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 bg-slate-800">📷</div>
              )}

              {isInvalid && (
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                  <div className="bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
              )}

              {!isInvalid && (
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

            {/* Large image preview */}
            <div className={`relative rounded-2xl overflow-hidden border-4 ${previewSample.isValid === false ? 'border-red-400' : 'border-gray-200'} mb-4 bg-slate-900`}>
              {previewSample.thumbnail ? (
                <img src={previewSample.thumbnail} alt="Preview" className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center text-gray-500">Không có ảnh</div>
              )}

              {previewSample.isValid === false && (
                <div className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg animate-pulse">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
            </div>

            {/* Validation status */}
            {previewSample.isValid === false ? (
              <div className="p-4 rounded-xl border-2 bg-red-50 border-red-300 mb-4">
                <div className="flex items-center gap-2 font-extrabold text-red-700 text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>AI nghĩ ảnh này KHÔNG ĐÚNG nhãn!</span>
                </div>
                <p className="text-xs text-red-600 mt-2 font-semibold leading-relaxed">
                  Bạn AI đã xem ảnh này và thấy nó không giống với nhãn &quot;{previewSample.label}&quot; mà bé đang dạy.
                  Bé nên xóa ảnh này đi và chụp lại cho đúng nhé! 🤗
                </p>
              </div>
            ) : previewSample.isValid === true ? (
              <div className="p-4 rounded-xl border-2 bg-green-50 border-green-300 mb-4">
                <div className="flex items-center gap-2 font-extrabold text-green-700 text-sm">
                  ✅ <span>Ảnh tốt! AI nhận diện đúng nhãn rồi!</span>
                </div>
              </div>
            ) : null}

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

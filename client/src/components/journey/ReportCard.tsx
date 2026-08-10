'use client';

import React, { useState } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Camera } from 'lucide-react';
import type { ModelEvaluation } from '@/types/models';
import VersionComparison from './VersionComparison';

interface ReportCardProps {
  isOpen: boolean;
  onClose: () => void;
  onRevise: () => void;
  onFinalize: () => void;
  evaluation: ModelEvaluation;
  version: number;
  previousEvaluation?: ModelEvaluation | null;
}

// ── Emoji star rating (child-friendly) ──────────────────────────────────────

function StarRating({ score }: { score: number }) {
  const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
  const emoji = score >= 75 ? '🦁' : score >= 50 ? '🐨' : '🐣';
  const message = score >= 90
    ? 'Tuyệt vời luôn! AI học giỏi lắm!'
    : score >= 75
    ? 'Hay quá! AI đã học khá tốt rồi!'
    : score >= 60
    ? 'Được rồi! Nhưng AI vẫn còn nhầm chút xíu.'
    : score >= 40
    ? 'Ồ, AI vẫn còn hay nhầm lắm!'
    : 'AI chưa học được tốt... Thử lại nhé!';

  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-2">{emoji}</div>
      <div className="text-3xl mb-1 tracking-wider">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < stars ? '' : 'opacity-20'}>{i < stars ? '⭐' : '⭐'}</span>
        ))}
      </div>
      <p className="text-lg font-black text-slate-800 mt-2">{message}</p>
    </div>
  );
}

// ── Fullscreen image ──────────────────────────────────────────────────────

function ZoomImage({ src, caption, onClose }: { src: string; caption: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
          <X className="w-4 h-4" />
        </button>
        <img src={src} alt={caption} className="w-full rounded-2xl shadow-2xl" />
        <p className="text-center text-white text-sm font-bold mt-3">{caption}</p>
      </div>
    </div>
  );
}

export default function ReportCard({
  isOpen, onClose, onRevise, onFinalize,
  evaluation, version, previousEvaluation,
}: ReportCardProps) {
  const [zoomedImg, setZoomedImg] = useState<{ src: string; caption: string } | null>(null);

  if (!isOpen) return null;

  const { confusionMatrix: cm, datasetHealth: dh, sampleEvidence: ev } = evaluation;
  const delta = previousEvaluation
    ? evaluation.goldenAccuracy - previousEvaluation.goldenAccuracy
    : null;

  const hasQualityIssues = ev?.qualityIssues && ev.qualityIssues.length > 0;
  const hasMisclassified = ev?.misclassifiedSamples && ev.misclassifiedSamples.length > 0;
  const isImbalanced = dh.isImbalanced;
  const totalProblems = (ev?.qualityIssues?.length || 0) + (ev?.misclassifiedSamples?.length || 0);
  const isPerfect = totalProblems === 0 && !isImbalanced && evaluation.goldenAccuracy >= 80;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4 animate-in fade-in duration-300">
      {/* Zoom modal */}
      {zoomedImg && <ZoomImage src={zoomedImg.src} caption={zoomedImg.caption} onClose={() => setZoomedImg(null)} />}

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">

        {/* ── Header ── */}
        <div className={`px-6 py-5 text-white relative ${
          isPerfect
            ? 'bg-gradient-to-r from-green-500 to-emerald-600'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600'
        }`}>
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <Sparkles className="w-6 h-6 text-yellow-300" />
            <h2 className="text-xl font-black">
              {isPerfect ? 'Bạn AI Học Giỏi Quá! 🎉' : 'Bạn AI Học Thế Nào Rồi?'}
            </h2>
          </div>
          <p className="text-white/70 text-sm font-semibold">Lần dạy AI thứ {version}</p>
        </div>

        <div className="p-6 space-y-5">

          {/* ── 1. Star Rating — thay ScoreCircle ── */}
          <StarRating score={evaluation.goldenAccuracy} />

          {/* ── 2. Version Comparison (simple) ── */}
          <VersionComparison delta={delta} version={version} />

          {/* ── 3. EVIDENCE: Ảnh bé chụp từng nhãn (gallery) ── */}
          {ev?.classPreviews && ev.classPreviews.length > 0 && (
            <div>
              <h3 className="text-sm font-extrabold text-slate-500 mb-3 flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> Ảnh bé đã chụp
              </h3>
              <div className="space-y-3">
                {ev.classPreviews.map(cp => {
                  const maxCount = Math.max(...ev.classPreviews.map(c => c.count));
                  const tooFew = cp.count < maxCount * 0.5 && maxCount >= 6;
                  return (
                    <div key={cp.label} className={`p-3 rounded-2xl ${tooFew ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-700 text-sm">{cp.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-500">{cp.count} ảnh</span>
                          {tooFew && (
                            <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                              📸 Chụp thêm!
                            </span>
                          )}
                        </div>
                      </div>
                      {cp.sampleThumbnails.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto">
                          {cp.sampleThumbnails.map((thumb, i) => (
                            <img
                              key={i}
                              src={thumb}
                              alt={`${cp.label} #${i + 1}`}
                              onClick={() => setZoomedImg({ src: thumb, caption: `${cp.label} — Ảnh #${i + 1}` })}
                              className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm cursor-pointer hover:border-indigo-400 transition-colors shrink-0"
                            />
                          ))}
                          {cp.count > 4 && (
                            <div className="w-16 h-16 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-slate-400">+{cp.count - 4}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 4. EVIDENCE: Ảnh bị mờ / tối ── */}
          {hasQualityIssues && (
            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl">
              <h3 className="text-sm font-extrabold text-amber-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {ev!.qualityIssues.length} ảnh bị mờ hoặc tối
              </h3>
              <p className="text-xs text-amber-700 font-semibold mb-3">
                Những ảnh này khiến bạn AI khó nhìn và dễ đoán sai. Bé hãy xóa bỏ và chụp lại nhé!
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {ev!.qualityIssues.slice(0, 6).map((qi, i) => (
                  <div key={i} className="relative shrink-0">
                    <img
                      src={qi.thumbnail}
                      alt={`Ảnh ${qi.isBlurry ? 'mờ' : 'tối'}`}
                      onClick={() => qi.thumbnail && setZoomedImg({ src: qi.thumbnail, caption: `${qi.label} — ${qi.isBlurry ? 'Ảnh bị mờ 😵‍💫' : 'Ảnh bị tối 🌑'}` })}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-amber-300 cursor-pointer"
                    />
                    <span className="absolute -top-1 -right-1 text-sm">
                      {qi.isBlurry ? '😵‍💫' : '🌑'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 5. EVIDENCE: Ảnh AI đoán sai ── */}
          {hasMisclassified && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
              <h3 className="text-sm font-extrabold text-red-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {ev!.misclassifiedSamples.length} ảnh bạn AI bị nhầm
              </h3>
              <p className="text-xs text-red-700 font-semibold mb-3">
                Bé gán nhãn nhưng bạn AI lại nhận ra khác. Hãy xem lại mấy ảnh này nha!
              </p>
              <div className="space-y-2">
                {ev!.misclassifiedSamples.slice(0, 4).map((ms, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-red-200">
                    {ms.thumbnail && (
                      <img
                        src={ms.thumbnail}
                        alt="Ảnh nhầm"
                        onClick={() => ms.thumbnail && setZoomedImg({ src: ms.thumbnail, caption: `Bé gán: "${ms.label}" nhưng AI đoán: "${ms.predictedLabel}"` })}
                        className="w-12 h-12 rounded-lg object-cover border border-red-200 cursor-pointer shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-500">Bé gán: <strong className="text-red-800">{ms.label}</strong></div>
                      <div className="text-xs font-semibold text-slate-500">AI đoán: <strong className="text-red-600">{ms.predictedLabel}</strong></div>
                    </div>
                    <span className="text-xl shrink-0">🤔</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. EVIDENCE: Nhãn nào AI yếu nhất? (simple, no %) ── */}
          {cm.weakestLabel && evaluation.goldenAccuracy < 90 && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">💡</span>
                <h3 className="text-sm font-extrabold text-indigo-800">Gợi ý cải thiện</h3>
              </div>
              <p className="text-sm text-indigo-700 font-semibold">
                Bạn AI vẫn hay nhầm nhãn <strong>&ldquo;{cm.weakestLabel}&rdquo;</strong> nhất.
                Bé thử chụp thêm ảnh rõ ràng cho nhãn này xem sao! 📸
              </p>
            </div>
          )}

          {/* ── 7. Perfect banner ── */}
          {isPerfect && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl text-center">
              <span className="text-4xl">🏆</span>
              <p className="text-sm font-black text-green-800 mt-1">
                Bé dạy AI giỏi quá! Không có ảnh nào bị lỗi!
              </p>
            </div>
          )}
        </div>

        {/* ── Footer Buttons ── */}
        <div className="px-6 pb-6 flex gap-3">
          {!isPerfect && (
            <button
              onClick={onRevise}
              className="flex-1 py-3.5 px-4 rounded-2xl border-2 border-indigo-300 text-indigo-700 font-extrabold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
            >
              🔧 Sửa Bài & Dạy Lại
            </button>
          )}
          <button
            onClick={onFinalize}
            className={`flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-extrabold text-sm hover:from-green-600 hover:to-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-200 ${
              isPerfect ? 'text-base' : ''
            }`}
          >
            {isPerfect ? '🎉 Hoàn Thành Nộp Bài!' : '✅ Nộp Luôn'}
          </button>
        </div>
      </div>
    </div>
  );
}

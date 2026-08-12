'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usePageData } from '@/hooks/usePageData';
import {
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Camera, BarChart3,
  TrendingUp, MessageSquare, Send, Clock, Activity, Eye, EyeOff,
  ImageOff, Zap, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound, playSuccessSound } from '@/lib/audio';
import type { ModelResponse } from '@/types/models';
import DatasetSnapshotViewer from '@/components/teacher/DatasetSnapshotViewer';
import VersionDiff from '@/components/teacher/VersionDiff';
import ConfusionMatrixViewer from '@/components/teacher/ConfusionMatrixViewer';

// ── Reusable UI Atoms ──────────────────────────────────────────────────────────

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
      {icon} {children}
    </h3>
  );
}

function EvidenceImage({
  src,
  badges,
  caption,
  onClick,
}: {
  src?: string;
  badges?: React.ReactNode;
  caption?: string;
  onClick?: () => void;
}) {
  if (!src) return null;
  return (
    <div
      className="relative group cursor-pointer"
      onClick={onClick}
    >
      <img
        src={src}
        alt={caption || 'sample'}
        className="w-full aspect-square object-cover rounded-xl border-2 border-slate-200 group-hover:border-indigo-400 transition-colors"
      />
      {badges && (
        <div className="absolute top-1 left-1 flex flex-wrap gap-0.5">
          {badges}
        </div>
      )}
      {caption && (
        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b-xl text-center truncate">
          {caption}
        </div>
      )}
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${color}`}>
      {children}
    </span>
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

// ── Fullscreen Image Modal ──────────────────────────────────────────────────

function ImageModal({ src, caption, onClose }: { src: string; caption: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-md w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
          <X className="w-4 h-4" />
        </button>
        <img src={src} alt={caption} className="w-full rounded-2xl shadow-2xl" />
        <p className="text-center text-white text-sm font-bold mt-3">{caption}</p>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function TeacherModelDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const modelId = params.modelId as string;
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; caption: string } | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const { data, loading, refetch: fetchData } = usePageData(async () => {
    if (!modelId || modelId === 'undefined') return null;
    const m = await api.getModelById(modelId);
    let pm: ModelResponse | null = null;
    if (m.parentModelId) {
      pm = await api.getModelById(m.parentModelId).catch(() => null);
    }
    const logs = await api.getActionLogsByModel(modelId).catch(() => []);
    return { model: m, parentModel: pm, actionLogs: logs };
  }, [modelId], Boolean(modelId && modelId !== 'undefined'));

  const model = data?.model || null;
  const parentModel = data?.parentModel || null;
  const actionLogs = data?.actionLogs || [];

  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || !model) return;
    try {
      setSendingFeedback(true);
      await api.addTeacherFeedback(model.id, feedbackText.trim());
      playSuccessSound();
      setFeedbackText('');
      await fetchData();
    } catch (err) {
      console.error('Failed to send feedback', err);
    } finally {
      setSendingFeedback(false);
    }
  };

  const eval_ = model?.evaluation;
  const cm = eval_?.confusionMatrix;
  const dh = eval_?.datasetHealth;
  const cc = eval_?.crossCheck;
  const evidence = eval_?.sampleEvidence;
  const prevEval = parentModel?.evaluation;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* Zoom Modal */}
      {zoomedImage && <ImageModal src={zoomedImage.src} caption={zoomedImage.caption} onClose={() => setZoomedImage(null)} />}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-4 px-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/teacher/students/${userId}`} onClick={playClickSound} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-extrabold text-sm">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Link>
          <span className="h-4 w-[2px] bg-slate-200" />
          <h1 className="text-xl font-black text-slate-900">
            🔬 Chi Tiết Lần Nộp {model?.version ? `V${model.version}` : ''}
          </h1>
        </div>
        <button onClick={() => { playClickSound(); fetchData(); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> TẢI LẠI
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : !model ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 font-semibold italic">Không tìm thấy model.</p>
          </div>
        ) : (
          <>
            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  1. OVERVIEW STATS                                              ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mb-2">
              <SectionHeader icon={<BarChart3 className="w-4 h-4 text-indigo-500" />}>
                Tổng Quan Lần Nộp Bài
              </SectionHeader>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-black ${
                    (model.testScore || 0) >= 80 ? 'text-green-600' :
                    (model.testScore || 0) >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>{model.testScore || 0}%</div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase mt-1">Độ chính xác</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-indigo-600">V{model.version || 1}</div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase mt-1">Phiên bản</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-slate-700">{dh?.sampleCount || '—'}</div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase mt-1">Tổng ảnh</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-black ${dh?.phase === 'PHASE_B' ? 'text-green-600' : 'text-amber-600'}`}>
                  {dh?.phase === 'PHASE_B' ? '✅' : '⚠️'}
                </div>
                <div className="text-[9px] font-extrabold text-slate-400 uppercase mt-1">
                  {dh?.phase === 'PHASE_B' ? 'Hoàn hảo' : 'Cần cải thiện'}
                </div>
                </div>
              </div>
              <ExplainBox emoji="📖">
                <strong>Độ chính xác</strong> = bao nhiêu % câu hỏi kiểm tra AI trả lời đúng. <strong>Phiên bản</strong> = bé đã nộp lần thứ mấy. <strong>Tổng ảnh</strong> = số ảnh bé chụp để dạy AI. <strong>Trạng thái</strong> = dữ liệu có đủ tốt để AI học chưa (cần ≥10 ảnh/nhãn, không mờ/tối, cân bằng).
              </ExplainBox>
            </div>

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  2. DỮ LIỆU CỦA BÉ — Preview ảnh từng nhãn                    ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {evidence?.classPreviews && evidence.classPreviews.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <SectionHeader icon={<Camera className="w-4 h-4 text-purple-500" />}>
                  Bộ Dữ Liệu Của Bé — Ảnh Từng Nhãn
                </SectionHeader>
                <div className="space-y-4">
                  {evidence.classPreviews.map(cp => {
                    const isImbalanced = dh && cp.count < Math.max(...Object.values(dh.classSummary)) * 0.5;
                    return (
                      <div key={cp.label} className={`p-4 rounded-2xl ${isImbalanced ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-slate-700 text-sm">{cp.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-600">{cp.count} ảnh</span>
                            {isImbalanced && (
                              <Badge color="bg-amber-100 text-amber-700">
                                <AlertTriangle className="w-3 h-3" /> Ít quá
                              </Badge>
                            )}
                          </div>
                        </div>
                        {cp.sampleThumbnails.length > 0 ? (
                          <div>
                            <div className="grid grid-cols-4 gap-2">
                              {(expandedClasses[cp.label] ? cp.sampleThumbnails : cp.sampleThumbnails.slice(0, 4)).map((thumb, i) => (
                                <EvidenceImage
                                  key={i}
                                  src={thumb}
                                  caption={`${cp.label} #${i + 1}`}
                                  onClick={() => setZoomedImage({ src: thumb, caption: `${cp.label} — Ảnh mẫu #${i + 1}` })}
                                />
                              ))}
                              {!expandedClasses[cp.label] && cp.sampleThumbnails.length > 4 && (
                                <div 
                                  onClick={() => setExpandedClasses(prev => ({ ...prev, [cp.label]: true }))}
                                  className="flex items-center justify-center aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-200 hover:border-slate-400 transition-colors"
                                >
                                  <span className="text-xs font-bold text-slate-500">+{cp.sampleThumbnails.length - 4} ảnh</span>
                                </div>
                              )}
                            </div>
                            {expandedClasses[cp.label] && cp.sampleThumbnails.length > 4 && (
                              <div className="mt-3 flex justify-center">
                                <button
                                  onClick={() => setExpandedClasses(prev => ({ ...prev, [cp.label]: false }))}
                                  className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
                                >
                                  Ẩn bớt
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Không có ảnh preview</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Balance visualization bar chart */}
                {dh && (
                  <div className="mt-4 p-4 bg-indigo-50 rounded-2xl">
                    <h4 className="text-[10px] font-extrabold text-indigo-600 uppercase mb-2">Phân Bổ Dữ Liệu</h4>
                    <div className="space-y-1.5">
                      {Object.entries(dh.classSummary).map(([label, count]) => {
                        const maxCount = Math.max(...Object.values(dh.classSummary));
                        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-800 w-28 truncate">{label}</span>
                            <div className="flex-1 h-4 bg-white rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct < 50 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-indigo-700 w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-center">
                      <span className={`text-[10px] font-extrabold ${dh.balanceRatio >= 0.7 ? 'text-green-600' : 'text-amber-600'}`}>
                        Tỷ lệ cân bằng: {Math.round(dh.balanceRatio * 100)}%
                        {dh.balanceRatio >= 0.7 ? ' ✅ Tốt' : ' ⚠️ Lệch'}
                      </span>
                    </div>
                  </div>
                )}
                <ExplainBox emoji="📖">
                  Đây là <strong>ảnh mẫu</strong> bé đã chụp cho từng nhãn. Nếu một nhãn có quá ít ảnh so với nhãn khác, AI sẽ bị &ldquo;thiên vị&rdquo; — đoán nhãn nhiều ảnh hơn vì được thấy nhiều ví dụ hơn. Tỷ lệ cân bằng lý tưởng là ≥ 70%.
                </ExplainBox>
              </div>
            )}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  3. ẢNH CÓ VẤN ĐỀ CHẤT LƯỢNG — Mờ / Tối                      ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {evidence?.qualityIssues && evidence.qualityIssues.length > 0 && (
              <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-sm p-6">
                <SectionHeader icon={<ImageOff className="w-4 h-4 text-amber-500" />}>
                  ⚠️ Ảnh Có Vấn Đề Chất Lượng ({evidence.qualityIssues.length} ảnh)
                </SectionHeader>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {evidence.qualityIssues.map((qi, i) => (
                    <EvidenceImage
                      key={i}
                      src={qi.thumbnail}
                      caption={qi.label}
                      onClick={() => qi.thumbnail && setZoomedImage({ src: qi.thumbnail, caption: `${qi.label} — ${qi.isBlurry ? 'Ảnh mờ' : ''} ${qi.isDark ? 'Ảnh tối' : ''}` })}
                      badges={
                        <>
                          {qi.isBlurry && <Badge color="bg-orange-500 text-white"><EyeOff className="w-2.5 h-2.5" /> Mờ</Badge>}
                          {qi.isDark && <Badge color="bg-gray-700 text-white"><Eye className="w-2.5 h-2.5" /> Tối</Badge>}
                        </>
                      }
                    />
                  ))}
                </div>
                <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs font-semibold text-amber-800">
                  💡 <strong>Gợi ý cho bé:</strong> Chụp ảnh ở nơi đủ sáng, giữ tay đứng yên, và không lắc camera.
                  {evidence.qualityIssues.filter(q => q.isBlurry).length > 0 &&
                    ` Có ${evidence.qualityIssues.filter(q => q.isBlurry).length} ảnh bị mờ.`}
                  {evidence.qualityIssues.filter(q => q.isDark).length > 0 &&
                    ` Có ${evidence.qualityIssues.filter(q => q.isDark).length} ảnh bị tối.`}
                </div>
                <ExplainBox emoji="📖">
                  Ảnh <strong>mờ</strong> (😵‍💫) = camera bị rung hoặc tay di chuyển lúc chụp → AI không trích xuất được đặc trưng chính xác.
                  Ảnh <strong>tối</strong> (🌑) = thiếu ánh sáng → AI khó phân biệt hình dạng tay/cử chỉ.
                  Những ảnh này nên được <strong>xóa và chụp lại</strong> ở điều kiện tốt hơn.
                </ExplainBox>
              </div>
            )}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  4. ẢNH BỊ AI ĐOÁN SAI — Misclassified Samples                 ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {evidence?.misclassifiedSamples && evidence.misclassifiedSamples.length > 0 && (
              <div className="bg-white rounded-3xl border-2 border-red-200 shadow-sm p-6">
                <SectionHeader icon={<AlertTriangle className="w-4 h-4 text-red-500" />}>
                  ❌ Ảnh Bé Gán Nhãn Sai ({evidence.misclassifiedSamples.length} ảnh)
                </SectionHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {evidence.misclassifiedSamples.map((ms, i) => (
                    <div key={i} className="bg-red-50 rounded-2xl border border-red-200 p-3 space-y-2">
                      <EvidenceImage
                        src={ms.thumbnail}
                        onClick={() => ms.thumbnail && setZoomedImage({ src: ms.thumbnail, caption: `Bé gán: "${ms.label}" → AI đoán: "${ms.predictedLabel}"` })}
                      />
                      <div className="text-center space-y-0.5">
                        <div className="text-[10px] font-bold text-slate-500">Bé gán nhãn:</div>
                        <div className="text-xs font-black text-red-800">&ldquo;{ms.label}&rdquo;</div>
                        <div className="text-[10px] text-slate-400">↓ AI đoán là:</div>
                        <div className="text-xs font-black text-red-600">&ldquo;{ms.predictedLabel}&rdquo;</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-red-50 rounded-xl text-xs font-semibold text-red-800">
                  💡 Những ảnh này bé đã gán nhãn <strong>&ldquo;{evidence.misclassifiedSamples[0]?.label}&rdquo;</strong> nhưng AI
                  lại nhận diện thành nhãn khác. Bé cần chụp lại rõ hơn hoặc xóa bỏ ảnh không đúng.
                </div>
                <ExplainBox emoji="📖">
                  Khi bé chụp 1 ảnh và gán nhãn &ldquo;1 ngón tay&rdquo;, AI sẽ dùng ảnh đó để học. Nhưng nếu ảnh không đúng (ví dụ: giơ 2 ngón nhưng gán nhãn 1 ngón), AI sẽ <strong>học sai</strong> → dẫn đến đoán sai.
                  Đây là bằng chứng cho thấy bé cần <strong>kiểm tra lại dữ liệu</strong> trước khi dạy AI.
                </ExplainBox>
              </div>
            )}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  5. CONFUSION MATRIX — AI đoán đúng/sai từng nhãn              ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {cm && <ConfusionMatrixViewer evaluation={eval_} />}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  6. CHẤT LƯỢNG DỮ LIỆU — Tổng hợp                             ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {dh && <DatasetSnapshotViewer evaluation={eval_} />}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  7. CROSS-CHECK VỚI GIÁO VIÊN                                  ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {cc && cc.hasTeacherTemplate && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <SectionHeader icon={<CheckCircle2 className="w-4 h-4 text-teal-500" />}>
                  🔍 Cross-Check Với Template Giáo Viên
                </SectionHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-2xl text-center">
                    <div className={`text-2xl font-black ${cc.agreementRate >= 80 ? 'text-green-600' : 'text-amber-600'}`}>{cc.agreementRate}%</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Tỷ lệ đồng ý</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl text-center">
                    <div className={`text-2xl font-black ${cc.conflictCount === 0 ? 'text-green-600' : 'text-red-600'}`}>{cc.conflictCount}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Xung đột</div>
                  </div>
                </div>
                {cc.conflictCount > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs font-semibold text-amber-800">
                    ⚠️ Model của bé có {cc.conflictCount} mẫu không khớp với dữ liệu chuẩn của Giáo viên.
                    Bé cần kiểm tra lại cách gán nhãn.
                  </div>
                )}
              </div>
            )}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  8. SO SÁNH VỚI VERSION TRƯỚC                                  ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {prevEval && eval_ && dh && (
              <VersionDiff 
                currentEvaluation={eval_} 
                previousEvaluation={prevEval} 
                currentVersion={model.version || 2} 
              />
            )}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  9. NHẬT KÝ HÀNH VI                                            ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            {actionLogs.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <SectionHeader icon={<Activity className="w-4 h-4 text-teal-500" />}>
                  Nhật Ký Hành Vi
                </SectionHeader>
                <div className="space-y-2">
                  {actionLogs.map(log => {
                    const details = log.details as Record<string, unknown> | undefined;
                    const icon = log.action === 'ADD_SAMPLES' ? '➕' : log.action === 'DELETE_SAMPLES' ? '🗑️' : '🔄';
                    const label = log.action === 'ADD_SAMPLES'
                      ? `Thêm ${details?.samplesAdded || '?'} ảnh "${details?.targetLabel || '?'}"`
                      : log.action === 'DELETE_SAMPLES'
                        ? `Xóa ${details?.samplesDeleted || '?'} ảnh "${details?.targetLabel || '?'}"`
                        : 'Train lại model';
                    const wasWeak = details?.wasWeakestLabel === true;
                    const date = new Date(log.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={log.id} className={`p-3 rounded-2xl text-sm flex items-center gap-3 ${wasWeak ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1">
                          <span className="font-bold text-slate-700">{label}</span>
                          {wasWeak && <Badge color="bg-green-100 text-green-600">✅ Đúng nhãn yếu</Badge>}
                        </div>
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ╔══════════════════════════════════════════════════════════════════╗ */}
            {/* ║  10. PHẢN HỒI GIÁO VIÊN                                        ║ */}
            {/* ╚══════════════════════════════════════════════════════════════════╝ */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <SectionHeader icon={<MessageSquare className="w-4 h-4 text-amber-500" />}>
                Phản Hồi Giáo Viên
              </SectionHeader>
              {model.teacherFeedback && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-3 text-sm text-amber-900 font-medium">
                  {model.teacherFeedback}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Nhập phản hồi cho học sinh..."
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendFeedback()}
                />
                <button
                  onClick={handleSendFeedback}
                  disabled={sendingFeedback || !feedbackText.trim()}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Gửi
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

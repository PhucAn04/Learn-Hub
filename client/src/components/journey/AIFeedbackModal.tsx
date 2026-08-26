'use client';

import React, { useMemo, useState } from 'react';
import { X, AlertCircle, CheckCircle, Brain, Target, Info, ChevronRight, RefreshCw, Search, Eye, Sparkles } from 'lucide-react';
import { StoredSample, classifyKNNDetailed } from '@/lib/knn-classifier';
import { evaluateStudentDatasetPhase } from '@/lib/teacher-validator';
import SamplePreviewModal from '@/components/SamplePreviewModal';
import { TeacherTemplate, CorrectnessIssue, NearestNeighbor } from '@/types/models';

interface AIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (issueCount: number) => void;
  studentSamples: StoredSample[];
  teacherTemplate?: TeacherTemplate;
  kValue: number;
  threshold: number;
  classes: { id: string; label: string }[];
  onDeleteSample?: (id: string) => void;
}

export default function AIFeedbackModal({
  isOpen,
  onClose,
  onProceed,
  studentSamples,
  teacherTemplate,
  kValue,
  threshold,
  classes,
  onDeleteSample,
}: AIFeedbackModalProps) {
  const [previewSample, setPreviewSample] = useState<StoredSample | null>(null);

  // ── Local K/Threshold — bé tự kéo thanh trong popup, kết quả cập nhật ngay ──
  const [localK, setLocalK] = useState(kValue);
  const [localThreshold, setLocalThreshold] = useState(threshold);

  // Render-time sync: khi modal mở lại (isOpen: false→true), đồng bộ từ props
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setLocalK(kValue);
    setLocalThreshold(threshold);
  }
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
  }

  // Đảm bảo threshold không vượt quá K
  const safeThreshold = Math.min(localThreshold, localK);

  const { balanceIssues, correctnessIssues, qualityIssues, counts, hasTeacherTemplate, datasetPhase, robustIssueCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    classes.forEach(c => counts[c.id] = 0);
    studentSamples.forEach(s => {
      const id = s.sourceId || classes.find(c => c.label === s.label)?.id;
      if (id && counts[id] !== undefined) counts[id]++;
    });

    const balanceIssues = classes.filter(c => counts[c.id] < 3).map(c => ({
      ...c, count: counts[c.id]
    }));

    const teacherSamples: StoredSample[] = (teacherTemplate as TeacherTemplate)?.dataset?.samples || teacherTemplate?.samples || [];
    const hasTeacherTemplate = teacherSamples.length > 0;
    const correctnessIssues: CorrectnessIssue[] = [];
    let robustIssueCount = 0;
    
    studentSamples.forEach((studentSample, index) => {
      const studentClassId = studentSample.sourceId || classes.find(c => c.label === studentSample.label)?.id;
      
      let referenceSamples = teacherSamples;
      if (!hasTeacherTemplate) {
        referenceSamples = studentSamples.filter((_, i) => i !== index);
      }

      if (referenceSamples.length > 0) {
        // ── Display cross-check: dùng localK/safeThreshold (slider bé kéo) ──
        const knn = classifyKNNDetailed(studentSample.features, referenceSamples, localK);
        
        const bestClassId = classes.find(c => c.label === knn.label || c.id === knn.label)?.id || knn.label;
        const bestVotes = (knn.counts as Record<string, number>)[knn.label] || 0;

        const finalPredictedClassId = (bestVotes >= safeThreshold) ? bestClassId : 'unclear';
        
        if (finalPredictedClassId !== studentClassId) {
          let displayClassLabel = 'Chưa rõ ràng 🤔';
          let matchingNearest: NearestNeighbor[] = [];
          
          if (finalPredictedClassId === 'unclear') {
            displayClassLabel = 'Chưa rõ ràng 🤔';
          } else {
            displayClassLabel = classes.find(c => c.id === bestClassId)?.label || bestClassId;
          }

          matchingNearest = knn.nearest.filter((n: NearestNeighbor) => {
            const nClassId = classes.find(c => c.label === n.label || c.id === n.label)?.id || n.label;
            return nClassId === bestClassId;
          });

          correctnessIssues.push({
            studentSample,
            studentClassLabel: classes.find(c => c.id === studentClassId)?.label || studentClassId || 'unknown',
            predictedClassLabel: displayClassLabel,
            votes: bestVotes,
            nearest: knn.nearest,
            matchingNearest: matchingNearest
          });
        }

        // ── Robust cross-check: cho chấm điểm công bằng (Golden Dataset logic) ──
        // Dùng adaptive K lớn để phá cluster ảnh sai nhãn.
        // Giới hạn robustK theo số classes: với 6 classes × 10 mẫu, dùng K quá lớn
        // sẽ khiến KHÔNG class nào đạt threshold → tất cả bị đánh sai.
        // Công thức: K ≈ (samples_per_class * 1.5) để class đúng vẫn có thể thắng.
        const avgSamplesPerClass = Math.max(1, Math.floor(referenceSamples.length / Math.max(classes.length, 2)));
        const robustK = hasTeacherTemplate
          ? localK
          : Math.max(localK, Math.min(Math.ceil(referenceSamples.length * 0.5), Math.ceil(avgSamplesPerClass * 1.5)));
        const robustThreshold = hasTeacherTemplate
          ? safeThreshold
          : Math.ceil(robustK * 0.5);

        if (robustK !== localK || robustThreshold !== safeThreshold) {
          const robustKnn = classifyKNNDetailed(studentSample.features, referenceSamples, robustK);
          const rBestClassId = classes.find(c => c.label === robustKnn.label || c.id === robustKnn.label)?.id || robustKnn.label;
          const rBestVotes = (robustKnn.counts as Record<string, number>)[robustKnn.label] || 0;
          const rPredicted = (rBestVotes >= robustThreshold) ? rBestClassId : 'unclear';
          if (rPredicted !== studentClassId) {
            robustIssueCount++;
          }
        } else {
          // localK already >= robust → reuse display result
          if (finalPredictedClassId !== studentClassId) {
            robustIssueCount++;
          }
        }
      }
    });

    // Image quality analysis per class
    const qualityIssues: { classId: string; classLabel: string; total: number; darkCount: number; blurryCount: number; badSamples: StoredSample[] }[] = [];
    classes.forEach(c => {
      const classSamples = studentSamples.filter(s => (s.sourceId || classes.find(cl => cl.label === s.label)?.id) === c.id);
      const withQuality = classSamples.filter(s => s.quality);
      if (withQuality.length === 0) return;
      const darkOnes = withQuality.filter(s => s.quality!.isDark);
      const blurryOnes = withQuality.filter(s => s.quality!.isBlurry);
      const badOnes = withQuality.filter(s => s.quality!.isDark || s.quality!.isBlurry);
      if (badOnes.length > withQuality.length * 0.5 && badOnes.length >= 2) {
        qualityIssues.push({
          classId: c.id,
          classLabel: c.label,
          total: classSamples.length,
          darkCount: darkOnes.length,
          blurryCount: blurryOnes.length,
          badSamples: badOnes.slice(0, 8),
        });
      }
    });

    const datasetPhase = evaluateStudentDatasetPhase(studentSamples, classes, 3, 10);

    return { balanceIssues, correctnessIssues, qualityIssues, counts, hasTeacherTemplate, datasetPhase, robustIssueCount };
  }, [studentSamples, teacherTemplate, localK, safeThreshold, classes]);

  if (!isOpen) return null;

  const hasIssues = balanceIssues.length > 0 || correctnessIssues.length > 0 || qualityIssues.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className={`px-6 py-4 border-b-2 flex justify-between items-center ${hasIssues ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${hasIssues ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-xl font-black ${hasIssues ? 'text-amber-900' : 'text-emerald-900'}`}>
                Phân Tích Dữ Liệu Của Bé
              </h2>
              <p className={`text-sm font-semibold ${hasIssues ? 'text-amber-700' : 'text-emerald-700'}`}>
                {hasIssues ? 'AI tìm thấy một vài điểm cần bé chú ý nè!' : 'Dữ liệu của bé rất tuyệt vời!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-gray-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {!hasTeacherTemplate && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <Info className="w-8 h-8 text-blue-400 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-blue-900">Không có dữ liệu mẫu của Thầy Cô</h3>
                <p className="text-sm text-blue-700">Hệ thống đang tự dùng chính các bức ảnh bé đã chụp để kiểm tra chéo sự đồng nhất của dữ liệu.</p>
              </div>
            </div>
          )}

          {/* ── Thanh điều chỉnh K & Threshold — bé tự kéo, kết quả cập nhật ngay ── */}
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-indigo-900">🔍 Tinh Chỉnh Bộ Phát Hiện</h3>
            </div>
            <p className="text-xs text-indigo-700 mb-4">Kéo thanh để thay đổi độ nhạy phát hiện ảnh sai nhãn. Kết quả cập nhật ngay!</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* K Slider */}
              <div className="bg-white rounded-xl p-3 border border-indigo-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-indigo-800">👀 K hàng xóm (so sánh)</label>
                  <span className="text-lg font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-lg">{localK}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(3, studentSamples.length - 1)}
                  value={localK}
                  onChange={e => {
                    const newK = Number(e.target.value);
                    setLocalK(newK);
                    if (localThreshold > newK) setLocalThreshold(newK);
                  }}
                  className="w-full accent-indigo-500 h-2"
                />
                <div className="flex justify-between text-[10px] text-indigo-400 mt-0.5">
                  <span>1 (ít)</span>
                  <span>{Math.max(3, studentSamples.length - 1)} (nhiều)</span>
                </div>
              </div>

              {/* Threshold Slider */}
              <div className="bg-white rounded-xl p-3 border border-indigo-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-indigo-800">⚖️ Độ khắt khe (đồng thuận)</label>
                  <span className="text-lg font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-lg">{safeThreshold}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={localK}
                  value={safeThreshold}
                  onChange={e => setLocalThreshold(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-2"
                />
                <div className="flex justify-between text-[10px] text-indigo-400 mt-0.5">
                  <span>1 (dễ tính)</span>
                  <span>{localK} (khắt khe)</span>
                </div>
              </div>
            </div>

            {/* Live result badge */}
            <div className="mt-3 text-center">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                correctnessIssues.length > 0 
                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {correctnessIssues.length > 0 
                  ? `⚠️ Phát hiện ${correctnessIssues.length} ảnh đáng ngờ`
                  : '✅ Không tìm thấy ảnh sai nhãn'}
                {' '}(K={localK}, Đồng thuận={safeThreshold})
              </span>
            </div>
          </div>

          <div className="space-y-6">
              
              {/* BALANCE ISSUES */}
              {(balanceIssues.length > 0 || datasetPhase.balanceInfo.isImbalanced) && (
                <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-sm overflow-hidden">
                  <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <h3 className="font-bold text-rose-800">Dữ liệu chưa cân bằng (Data Imbalance)</h3>
                  </div>
                  <div className="p-4 text-slate-700">
                    {datasetPhase.balanceInfo.isImbalanced && (
                      <p className="mb-3 text-xs font-bold text-rose-700 bg-rose-100/60 p-2.5 rounded-xl border border-rose-200">
                        {datasetPhase.balanceInfo.message}
                      </p>
                    )}
                    <p className="mb-4 text-sm font-medium">Số lượng ảnh thu thập ở các nhãn hiện tại:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {classes.map(c => (
                        <div key={c.id} className={`p-3 rounded-xl border-2 text-center ${counts[c.id] < 3 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                          <div className="text-xs font-bold text-slate-600 mb-1">{c.label}</div>
                          <div className={`text-xl font-black ${counts[c.id] < 3 ? 'text-rose-600' : 'text-emerald-600'}`}>{counts[c.id]} ảnh</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* IMAGE QUALITY ISSUES */}
              {qualityIssues.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm overflow-hidden">
                  <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex items-center gap-2">
                    <Search className="w-5 h-5 text-orange-500" />
                    <h3 className="font-bold text-orange-800">Chất lượng ảnh (Image Quality)</h3>
                  </div>
                  <div className="p-4 text-slate-700">
                    <p className="mb-4 text-sm font-medium">Một số nhãn có quá nhiều ảnh bị tối hoặc mờ. AI sẽ khó nhận ra vì dữ liệu không rõ nét!</p>
                    <div className="space-y-4">
                      {qualityIssues.map((qi, idx) => (
                        <div key={idx} className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                          <div className="text-sm font-bold text-orange-800 mb-2">
                            Nhãn &quot;{qi.classLabel}&quot;: {qi.darkCount + qi.blurryCount}/{qi.total} ảnh có vấn đề
                            {qi.darkCount > 0 && <span className="ml-2 text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded">🌑 {qi.darkCount} tối</span>}
                            {qi.blurryCount > 0 && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">🔍 {qi.blurryCount} mờ</span>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {qi.badSamples.map((s, sidx) => (
                              <div key={sidx} className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-red-400 shadow-sm">
                                <img src={s.thumbnail} alt="Ảnh lỗi" className="w-full h-full object-cover" />
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5">
                                  {s.quality?.isDark && '🌑'}
                                  {s.quality?.isBlurry && '🔍'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* WRONG LABEL / POSE ISSUES */}
              {(correctnessIssues.length > 0) && (
                <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
                  <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-amber-800">Ảnh sai nhãn / Sai cử chỉ</h3>
                  </div>
                  <div className="p-4 text-slate-700">
                    <p className="mb-4 text-sm font-medium">Hệ thống phát hiện một số ảnh bé chụp không khớp với nhãn đã chọn. Bé cần xem xét và xóa những ảnh này nhé:</p>
                    {correctnessIssues.length > 0 && (
                      <div className="space-y-4">
                        <div className="mb-2 text-amber-700 text-sm font-semibold flex items-center gap-2">
                          <Brain className="w-4 h-4" /> Bị AI phát hiện nhầm lẫn {hasTeacherTemplate ? '(So với ảnh Giáo Viên)' : '(So với các ảnh khác của Bé)'}
                        </div>
                          {correctnessIssues.map((issue, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 border-2 border-slate-200 rounded-xl items-center">
                              {/* Student Image */}
                              <div className="text-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Ảnh của bé</span>
                                <div className="relative w-24 h-24 rounded-xl overflow-hidden border-4 border-amber-400 shadow-md">
                                  <img src={issue.studentSample.thumbnail} alt="Bé chụp" className="w-full h-full object-cover" />
                                  <div className="absolute top-1 right-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/20">
                                    Yêu cầu: {threshold} phiếu
                                  </div>
                                  <div 
                                    onClick={() => setPreviewSample(issue.studentSample)}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer text-white"
                                  >
                                    <Eye className="w-8 h-8" />
                                  </div>
                                </div>
                                <div className="mt-2 text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-lg">Bé Gắn: {issue.studentClassLabel}</div>
                              </div>
                              
                              <div className="flex-1 flex flex-col justify-center items-center">
                                <ChevronRight className="w-8 h-8 text-slate-300 hidden sm:block" />
                                <div className="text-center bg-white border-2 border-indigo-100 p-2 rounded-xl text-xs font-semibold text-slate-600 my-2 shadow-sm">
                                  So với <span className="font-bold text-indigo-600 text-sm">K={localK}</span> ảnh<br/>
                                  Cần ≥ <span className="text-indigo-600 font-bold text-sm">{safeThreshold}</span> phiếu<br/>
                                  Nhận: <span className={`font-bold text-sm ${issue.votes >= safeThreshold ? 'text-emerald-600' : 'text-rose-600'}`}>{issue.votes}/{localK}</span> phiếu
                                </div>
                              </div>

                              {/* Nearest Image */}
                              <div className="text-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">AI phát hiện {issue.matchingNearest.length} ảnh chung nhãn này</span>
                                <div className="flex flex-wrap gap-2 justify-center max-w-[200px]">
                                  {issue.matchingNearest.map((n: NearestNeighbor, nidx: number) => (
                                    <div key={nidx} className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-indigo-400 shadow-sm group">
                                      <img src={n.thumbnail} alt="Giáo viên" className="w-full h-full object-cover" />
                                      <div 
                                        onClick={() => setPreviewSample({ ...n, features: [], isValid: true } as StoredSample)}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                                      >
                                        <Eye className="w-5 h-5" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg">AI Đoán: {issue.predictedClassLabel}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                    )}
                  </div>
                </div>
              )}

              {/* SUCCESS STATE */}
              {!hasIssues && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-200">
                    <CheckCircle className="w-12 h-12 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-black text-emerald-900 mb-2">Tuyệt Vời! Xuất Sắc!</h3>
                  <p className="text-emerald-700 max-w-md">Dữ liệu của bé rất cân bằng và chính xác khi so với bộ dữ liệu của giáo viên. Bạn AI sẽ học rất nhanh từ dữ liệu này!</p>
                </div>
              )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t-2 border-slate-100 flex justify-between items-center gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Sửa lại dữ liệu
          </button>
          
          <button 
            onClick={() => onProceed(Math.max(correctnessIssues.length, robustIssueCount) + qualityIssues.length)}
            className={`px-8 py-3 rounded-xl font-black text-white shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 ${
              hasIssues 
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' 
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
            }`}
          >
            {hasIssues ? 'Vẫn Nộp Bài' : 'Lưu Kết Quả Ngay 🚀'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <SamplePreviewModal 
        isOpen={!!previewSample} 
        onClose={() => setPreviewSample(null)} 
        sample={previewSample ?? {}} 
        readonly={!previewSample?.id}
        onDelete={() => {
          if (previewSample?.id && onDeleteSample) {
            onDeleteSample(previewSample.id);
          }
          setPreviewSample(null);
        }} 
      />
    </div>
  );
}

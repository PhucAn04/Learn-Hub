'use client';

import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle,
  Trash2,
  Sparkles,
  Info,
  ArrowRight,
  Film,
  Camera,
} from 'lucide-react';
import { ActionValidationResult } from '@/lib/teacher-action-validator';

interface ActionAIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  validationResult: ActionValidationResult | null;
  classes: { id: string; label: string; emoji?: string }[];
  onDeleteSample?: (sampleId: string) => void;
}

export default function ActionAIFeedbackModal({
  isOpen,
  onClose,
  onProceed,
  validationResult,
  classes,
  onDeleteSample,
}: ActionAIFeedbackModalProps) {
  const [activeTab, setActiveTab] = useState<'correctness' | 'pairing' | 'quality'>('correctness');

  if (!isOpen || !validationResult) return null;

  const {
    hasTeacherTemplate,
    teacherSampleCount,
    teacherObjectCount,
    teacherGestureCount,
    studentSampleCount,
    studentObjectCount,
    studentGestureCount,
    overallAccuracyScore,
    objectAccuracyScore,
    gestureAccuracyScore,
    teacherModelAccuracy,
    correctnessIssues,
    pairingIssues,
    qualityIssues,
    isPairingHealthy,
    hasIssues,
    summaryMessage,
  } = validationResult;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 select-none">
      <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300 border-4 border-teal-300">
        {/* Header */}
        <div
          className={`px-6 py-4 border-b-2 flex justify-between items-center ${
            hasIssues ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                hasIssues ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
              }`}
            >
              <Film className="w-7 h-7" />
            </div>
            <div>
              <h2
                className={`text-xl font-black ${
                  hasIssues ? 'text-amber-950' : 'text-teal-950'
                }`}
              >
                Đối Soát AI Hành Động & Đối Tượng 🎬
              </h2>
              <p
                className={`text-xs font-bold mt-0.5 ${
                  hasIssues ? 'text-amber-700' : 'text-teal-700'
                }`}
              >
                {summaryMessage}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full text-slate-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
          {/* Banner Thông Báo Đối Soát Thầy Cô / Tự Động */}
          {hasTeacherTemplate ? (
            <div className="bg-gradient-to-r from-teal-50 via-cyan-50 to-indigo-50 border-2 border-teal-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎓</span>
                <div>
                  <h3 className="font-black text-teal-950 text-sm">
                    Đã đối soát với bài tập mẫu của Thầy/Cô ({teacherSampleCount} mẫu: 📸 {teacherObjectCount} vật thể + 🎬 {teacherGestureCount} cử chỉ)
                  </h3>
                  <p className="text-xs text-teal-800 mt-0.5 font-medium">
                    Hệ thống so sánh độc lập: vật thể đối soát vật thể, cử chỉ đối soát cử chỉ chuẩn xác 100%.
                  </p>
                </div>
              </div>

              {/* 3 Metrics Badge */}
              <div className="flex gap-2 shrink-0">
                <div className="bg-white px-3 py-2 rounded-xl border border-teal-200 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Khớp Vật Thể 📸</div>
                  <div className="text-base font-black text-emerald-600">{objectAccuracyScore}%</div>
                </div>
                <div className="bg-white px-3 py-2 rounded-xl border border-teal-200 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Khớp Cử Chỉ 🎬</div>
                  <div className="text-base font-black text-indigo-600">{gestureAccuracyScore}%</div>
                </div>
                {teacherModelAccuracy !== null && (
                  <div className="bg-white px-3 py-2 rounded-xl border border-teal-200 text-center shadow-xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">AI Đoán Đúng Bài GV</div>
                    <div className="text-base font-black text-purple-600">{teacherModelAccuracy}%</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-cyan-50 border-2 border-cyan-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Info className="w-8 h-8 text-cyan-600 shrink-0" />
                <div>
                  <h3 className="font-black text-cyan-950 text-sm">
                    Chưa có bài tập mẫu từ Thầy/Cô cho bài này
                  </h3>
                  <p className="text-xs text-cyan-800 mt-0.5">
                    Hệ thống đang kiểm định chéo nội bộ (Leave-One-Out) riêng biệt cho từng loại mẫu (Đối tượng & Cử chỉ).
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="bg-white px-3 py-2 rounded-xl border border-cyan-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Khớp Đối Tượng</div>
                  <div className="text-base font-black text-teal-600">{objectAccuracyScore}%</div>
                </div>
                <div className="bg-white px-3 py-2 rounded-xl border border-cyan-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Khớp Cử Chỉ</div>
                  <div className="text-base font-black text-indigo-600">{gestureAccuracyScore}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('correctness')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'correctness'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🎯 Tính chuẩn xác</span>
              {correctnessIssues.length > 0 && (
                <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                  {correctnessIssues.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pairing')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'pairing'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>⚖️ Cân bằng Cặp Hành Động</span>
              {!isPairingHealthy && (
                <span className="bg-rose-400 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                  {pairingIssues.filter((p) => p.status !== 'balanced').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('quality')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'quality'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📸 Chất lượng ảnh</span>
              {qualityIssues.length > 0 && (
                <span className="bg-rose-400 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                  {qualityIssues.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: Correctness Issues */}
          {activeTab === 'correctness' && (
            <div className="space-y-4">
              {correctnessIssues.length === 0 ? (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                  <span className="text-4xl">🎉✅</span>
                  <h4 className="font-black text-emerald-900 text-base mt-2">
                    Xuất sắc! Không có mẫu nào bị nghi ngờ sai nhãn
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Toàn bộ ảnh đối tượng và khung hình cử chỉ của bé đều khớp chuẩn với các nhãn tương ứng.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Phát hiện {correctnessIssues.length} mẫu có thể bị nhầm lẫn với nhãn khác. Bé xem ảnh so sánh bên dưới và bấm nút Xóa để loại bỏ nhé!
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {correctnessIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-2xl border-2 border-amber-200 shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5">
                              {issue.sourceType === 'gesture' ? (
                                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Film className="w-3 h-3" /> Cử chỉ
                                </span>
                              ) : (
                                <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Camera className="w-3 h-3" /> Đối tượng
                                </span>
                              )}
                              <span className="text-xs font-black text-slate-700">
                                Mẫu #{idx + 1}
                              </span>
                            </span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              Độ tương đồng: {issue.confidence}%
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Ảnh bé chụp / quay */}
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-amber-400 shrink-0">
                              <img
                                src={issue.studentSample.thumbnail}
                                alt="Bé quay"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold text-center py-0.5 truncate">
                                {issue.studentClassLabel}
                              </span>
                            </div>

                            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                            {/* Ảnh mẫu Thầy Cô hoặc kết quả dự đoán */}
                            {issue.nearestTeacherSample ? (
                              <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-teal-400 shrink-0">
                                <img
                                  src={issue.nearestTeacherSample.thumbnail}
                                  alt="Mẫu GV"
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-teal-900/80 text-white text-[9px] font-bold text-center py-0.5 truncate">
                                  Mẫu: {issue.predictedClassLabel}
                                </span>
                              </div>
                            ) : (
                              <div className="flex-1 bg-slate-100 p-2 rounded-xl text-center">
                                <span className="text-xs font-bold text-slate-600 block">
                                  Dự đoán:
                                </span>
                                <span className="text-sm font-black text-indigo-700">
                                  {issue.predictedClassLabel}
                                </span>
                              </div>
                            )}

                            <div className="flex-1 text-xs text-slate-600 font-medium">
                              <p className="line-clamp-3">{issue.reason}</p>
                            </div>
                          </div>
                        </div>

                        {onDeleteSample && (
                          <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                            <button
                              onClick={() => issue.studentSample.id && onDeleteSample(issue.studentSample.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa mẫu này</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Action - Object Pairing Issues */}
          {activeTab === 'pairing' && (
            <div className="space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-xs font-bold text-teal-900 flex items-start gap-2.5">
                <Sparkles className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-sm">Nguyên Tắc Dạy AI Cặp Hành Động & Đối Tượng:</p>
                  <p className="mt-1 font-semibold text-teal-800">
                    Mỗi nhãn cần có cả <strong>Ảnh Đối Tượng 📸</strong> (vật mẫu) và <strong>Chuỗi Cử Chỉ 🎬</strong> (hành động vẫy tay, tương tác). Nếu thiếu 1 trong 2, AI sẽ không thể liên kết được hành động với đồ vật!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pairingIssues.map((p) => {
                  const total = p.objectCount + p.gestureCount;
                  const objPercent = total > 0 ? Math.round((p.objectCount / total) * 100) : 0;
                  const gesPercent = total > 0 ? 100 - objPercent : 0;

                  return (
                    <div
                      key={p.classId}
                      className={`p-4 rounded-2xl border-2 bg-white transition-all shadow-xs ${
                        p.status === 'balanced'
                          ? 'border-teal-200'
                          : 'border-amber-300 bg-amber-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{p.emoji || '✨'}</span>
                          <span className="font-black text-sm text-slate-800">{p.classLabel}</span>
                        </div>
                        {p.status === 'balanced' ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Đủ cặp chuẩn
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {p.status === 'missing_gesture' ? 'Thiếu cử chỉ' : p.status === 'missing_object' ? 'Thiếu vật thể' : 'Thiếu dữ liệu'}
                          </span>
                        )}
                      </div>

                      {/* Counts breakdown */}
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1.5">
                        <span className="flex items-center gap-1 text-orange-700">
                          📸 Vật thể: {p.objectCount} mẫu
                        </span>
                        <span className="flex items-center gap-1 text-indigo-700">
                          🎬 Cử chỉ: {p.gestureCount} mẫu
                        </span>
                      </div>

                      {/* Visual Pairing Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden border border-slate-200">
                        <div
                          className="bg-orange-400 h-full transition-all duration-300"
                          style={{ width: `${objPercent}%` }}
                          title={`Đối tượng: ${objPercent}%`}
                        />
                        <div
                          className="bg-indigo-500 h-full transition-all duration-300"
                          style={{ width: `${gesPercent}%` }}
                          title={`Cử chỉ: ${gesPercent}%`}
                        />
                      </div>

                      <p className="text-xs font-medium text-slate-600 mt-2.5 leading-relaxed">
                        💡 {p.recommendation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Quality Issues */}
          {activeTab === 'quality' && (
            <div className="space-y-4">
              {qualityIssues.length === 0 ? (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                  <span className="text-4xl">📸✨</span>
                  <h4 className="font-black text-emerald-900 text-base mt-2">
                    Chất lượng khung hình rất tốt!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Không có ảnh hay khung hình cử chỉ nào bị quá mờ hoặc quá tối.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qualityIssues.map((q, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border-2 border-rose-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-800">
                          Nhãn: {q.classLabel} ({q.badSamples.length} ảnh chất lượng kém)
                        </span>
                        <div className="flex gap-2 text-[10px] font-bold">
                          {q.darkCount > 0 && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                              🌙 {q.darkCount} ảnh tối
                            </span>
                          )}
                          {q.blurryCount > 0 && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                              🌫️ {q.blurryCount} ảnh mờ
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {q.badSamples.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="relative w-16 h-16 rounded-lg overflow-hidden border border-rose-300 shrink-0"
                          >
                            <img src={s.thumbnail} alt="bad" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-extrabold text-sm hover:bg-slate-50 transition-colors"
          >
            Quay lại chỉnh sửa dữ liệu
          </button>
          <button
            onClick={onProceed}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Tiếp tục thử nghiệm AI</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

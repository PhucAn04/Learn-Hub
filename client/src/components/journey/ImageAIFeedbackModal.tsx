'use client';

import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  Brain,
  Trash2,
  Info,
  ArrowRight,
} from 'lucide-react';
import { ImageValidationResult } from '@/lib/teacher-image-validator';

interface ImageAIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  validationResult: ImageValidationResult | null;
  classes: { id: string; label: string; emoji?: string }[];
  onDeleteSample?: (sampleId: string) => void;
}

export default function ImageAIFeedbackModal({
  isOpen,
  onClose,
  onProceed,
  validationResult,
  classes,
  onDeleteSample,
}: ImageAIFeedbackModalProps) {
  const [activeTab, setActiveTab] = useState<'correctness' | 'balance' | 'quality'>('correctness');

  if (!isOpen || !validationResult) return null;

  const {
    hasTeacherTemplate,
    teacherSampleCount,
    teacherAccuracyScore,
    studentAccuracyScore,
    correctnessIssues,
    qualityIssues,
    balanceIssues,
    hasIssues,
    summaryMessage,
  } = validationResult;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 select-none">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300 border-4 border-indigo-200">
        {/* Header */}
        <div
          className={`px-6 py-4 border-b-2 flex justify-between items-center ${
            hasIssues ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                hasIssues ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <Brain className="w-7 h-7" />
            </div>
            <div>
              <h2
                className={`text-xl font-black ${
                  hasIssues ? 'text-amber-900' : 'text-emerald-900'
                }`}
              >
                Kết Quả Đối Soát & Đánh Giá AI
              </h2>
              <p
                className={`text-xs font-bold mt-0.5 ${
                  hasIssues ? 'text-amber-700' : 'text-emerald-700'
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
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎓</span>
                <div>
                  <h3 className="font-black text-indigo-950 text-sm">
                    Đã đối soát với bài tập mẫu của Thầy/Cô ({teacherSampleCount} ảnh mẫu)
                  </h3>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Hệ thống tự động so sánh đặc trưng ảnh bé thu thập với các mẫu chuẩn do Thầy/Cô cung cấp.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="bg-white px-3 py-2 rounded-xl border border-indigo-200 text-center shrink-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Khớp Mẫu GV</div>
                  <div className="text-lg font-black text-indigo-600">{studentAccuracyScore}%</div>
                </div>
                {teacherAccuracyScore !== null && (
                  <div className="bg-white px-3 py-2 rounded-xl border border-indigo-200 text-center shrink-0">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">AI Đoán Đúng Bài GV</div>
                    <div className="text-lg font-black text-emerald-600">{teacherAccuracyScore}%</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <Info className="w-8 h-8 text-blue-500 shrink-0" />
              <div>
                <h3 className="font-black text-blue-950 text-sm">
                  Chưa có bài tập mẫu từ Thầy/Cô
                </h3>
                <p className="text-xs text-blue-700 mt-0.5">
                  Hệ thống đang sử dụng kiểm tra chéo nội bộ (Leave-One-Out) và tập đặc trưng chuẩn để đánh giá dữ liệu của bé. Độ nhất quán: <strong className="text-blue-900">{studentAccuracyScore}%</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('correctness')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'correctness'
                  ? 'bg-indigo-600 text-white shadow-md'
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
              onClick={() => setActiveTab('balance')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'balance'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>⚖️ Cân bằng mẫu</span>
              {balanceIssues.length > 0 && (
                <span className="bg-rose-400 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                  {balanceIssues.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('quality')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'quality'
                  ? 'bg-indigo-600 text-white shadow-md'
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

          {/* Tab 1: Correctness Issues */}
          {activeTab === 'correctness' && (
            <div className="space-y-4">
              {correctnessIssues.length === 0 ? (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                  <span className="text-4xl">🎉✅</span>
                  <h4 className="font-black text-emerald-900 text-base mt-2">
                    Tuyệt vời! Không có ảnh nào bị nghi ngờ sai nhãn
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Toàn bộ ảnh bé thu thập đều khớp rất chuẩn với các nhãn tương ứng.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Phát hiện {correctnessIssues.length} ảnh có thể bị nhầm lẫn hoặc khác biệt với bài mẫu. Bé có thể xem lại hoặc bấm nút Xóa để chụp lại nhé!
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
                            <span className="text-xs font-black text-slate-700">
                              Ảnh mẫu #{idx + 1}
                            </span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              Độ tương đồng: {issue.confidence}%
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Ảnh bé chụp */}
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-amber-400 shrink-0">
                              <img
                                src={issue.studentSample.thumbnail}
                                alt="Bé chụp"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold text-center py-0.5 truncate">
                                {issue.studentClassLabel}
                              </span>
                            </div>

                            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                            {/* Ảnh mẫu Thầy Cô hoặc kết quả dự đoán */}
                            {issue.nearestTeacherSample ? (
                              <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-indigo-400 shrink-0">
                                <img
                                  src={issue.nearestTeacherSample.thumbnail}
                                  alt="Mẫu GV"
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-indigo-900/80 text-white text-[9px] font-bold text-center py-0.5 truncate">
                                  Mẫu: {issue.predictedClassLabel}
                                </span>
                              </div>
                            ) : (
                              <div className="w-20 h-20 rounded-xl bg-slate-100 border-2 border-slate-200 flex flex-col items-center justify-center text-center p-1 shrink-0">
                                <span className="text-xs">🤔</span>
                                <span className="text-[9px] font-bold text-slate-600 mt-0.5">
                                  {issue.predictedClassLabel}
                                </span>
                              </div>
                            )}

                            <div className="flex-1 text-xs text-slate-600">
                              <p className="font-semibold leading-relaxed">{issue.reason}</p>
                            </div>
                          </div>
                        </div>

                        {onDeleteSample && issue.studentSample.id && (
                          <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                            <button
                              onClick={() => onDeleteSample(issue.studentSample.id!)}
                              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Xóa ảnh này
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

          {/* Tab 2: Balance Issues */}
          {activeTab === 'balance' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
                <h4 className="font-black text-slate-800 text-sm mb-3">
                  Số lượng ảnh thu thập cho từng nhãn:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {classes.map((c) => {
                    const balanceIssue = balanceIssues.find((b) => b.id === c.id);
                    const isShort = !!balanceIssue;
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-xl border-2 text-center ${
                          isShort ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-600 mb-1">
                          {c.emoji} {c.label}
                        </div>
                        <div
                          className={`text-xl font-black ${
                            isShort ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {balanceIssue?.count ?? '>= 3'} ảnh
                        </div>
                        {isShort && (
                          <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                            ⚠️ Cần thêm ảnh
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Quality Issues */}
          {activeTab === 'quality' && (
            <div className="space-y-4">
              {qualityIssues.length === 0 ? (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                  <span className="text-4xl">📸✨</span>
                  <h4 className="font-black text-emerald-900 text-base mt-2">
                    Chất lượng ảnh rất tốt!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Không phát hiện ảnh nào bị mờ hoặc quá tối.
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
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Tiếp tục thử nghiệm AI</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

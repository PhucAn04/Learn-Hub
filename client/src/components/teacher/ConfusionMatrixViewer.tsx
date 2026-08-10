'use client';

import React from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import type { ModelEvaluation } from '@/types/models';

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${color}`}>
      {children}
    </span>
  );
}

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
      {icon} {children}
    </h3>
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

interface ConfusionMatrixViewerProps {
  evaluation: ModelEvaluation;
}

export default function ConfusionMatrixViewer({ evaluation }: ConfusionMatrixViewerProps) {
  const cm = evaluation.confusionMatrix;
  const evidence = evaluation.sampleEvidence;

  if (!cm) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <SectionHeader icon={<BarChart3 className="w-4 h-4 text-indigo-500" />}>
        AI Đoán Đúng/Sai Từng Nhãn (Golden Test)
      </SectionHeader>
      
      {/* Bars per class */}
      <div className="space-y-3">
        {cm.labels.map(label => {
          const acc = cm.perClassAccuracy[label] ?? 0;
          const isWeakest = label === cm.weakestLabel;
          const color = acc >= 80 ? 'bg-green-500' : acc >= 50 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <div key={label} className={`p-3 rounded-2xl ${isWeakest ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <div className="flex items-center gap-1.5">
                  {isWeakest && (
                    <Badge color="bg-red-100 text-red-600">
                      <AlertTriangle className="w-3 h-3" /> Yếu nhất
                    </Badge>
                  )}
                  <span className={`text-sm font-black ${acc >= 80 ? 'text-green-700' : acc >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{acc}%</span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-white rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${acc}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Golden Test Detail */}
      {evidence?.goldenTestDetails && evidence.goldenTestDetails.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase mb-2">Chi Tiết Từng Câu Kiểm Tra</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {evidence.goldenTestDetails.map((td, i) => (
              <div key={i} className={`p-2 rounded-xl text-[11px] flex items-center gap-2 ${
                td.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <span className="text-base">{td.isCorrect ? '✅' : '❌'}</span>
                <div className="min-w-0">
                  <div className="font-bold text-slate-700 truncate">Đáp án: {td.expectedLabel}</div>
                  {!td.isCorrect && (
                    <div className="text-red-600 font-bold truncate">AI đoán: {td.predictedLabel}</div>
                  )}
                  <div className="text-slate-400 font-medium">Tin cậy: {Math.round(td.confidence * 100)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Misclassification Summary */}
      {cm.misclassifications && cm.misclassifications.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase">Mẫu Nhầm Lẫn Phổ Biến</h4>
          {cm.misclassifications.map((mc, i) => (
            <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm flex items-center gap-3">
              <span className="text-xl">🔄</span>
              <div>
                <span className="font-bold text-red-800">
                  &ldquo;{mc.trueLabel}&rdquo; → AI đoán &ldquo;{mc.predictedLabel}&rdquo;
                </span>
                <span className="text-red-600 font-extrabold ml-2">{mc.count} lần ({mc.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <ExplainBox emoji="📖">
        <strong>Golden Test</strong> = bộ đề kiểm tra chuẩn do hệ thống tạo sẵn. AI của bé phải đoán đúng những mẫu test này. Nếu AI đoán sai nhiều ở một nhãn → bé chưa chụp đủ ảnh tốt cho nhãn đó, hoặc ảnh bị lẫn đặc trưng giữa 2 nhãn.
        <br/><strong>Nhãn yếu nhất</strong> = nhãn mà AI sai nhiều nhất — là ưu tiên #1 để bé cải thiện.
      </ExplainBox>
    </div>
  );
}

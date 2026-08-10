'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { ModelEvaluation } from '@/types/models';

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
      {icon} {children}
    </h3>
  );
}

interface VersionDiffProps {
  currentEvaluation: ModelEvaluation;
  previousEvaluation: ModelEvaluation;
  currentVersion: number;
}

export default function VersionDiff({ currentEvaluation, previousEvaluation, currentVersion }: VersionDiffProps) {
  const dh = currentEvaluation.datasetHealth;
  const prevDh = previousEvaluation.datasetHealth;

  if (!dh || !prevDh) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <SectionHeader icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}>
        So Sánh Với V{currentVersion - 1}
      </SectionHeader>
      <div className="space-y-2">
        {[
          { label: 'Độ chính xác', before: previousEvaluation.goldenAccuracy, after: currentEvaluation.goldenAccuracy, suffix: '%' },
          { label: 'Tổng ảnh', before: prevDh.sampleCount, after: dh.sampleCount, suffix: '' },
          { label: 'Cân bằng', before: Math.round(prevDh.balanceRatio * 100), after: Math.round(dh.balanceRatio * 100), suffix: '%' },
          { label: 'Chất lượng', before: prevDh.qualityScore, after: dh.qualityScore, suffix: '' },
          { label: 'Ảnh mờ', before: prevDh.blurrySampleCount, after: dh.blurrySampleCount, suffix: '', invertColor: true },
          { label: 'Ảnh tối', before: prevDh.darkSampleCount, after: dh.darkSampleCount, suffix: '', invertColor: true },
        ].map(item => {
          const d = item.after - item.before;
          const isGood = (item as { invertColor?: boolean }).invertColor ? d <= 0 : d >= 0;
          return (
            <div key={item.label} className="flex items-center justify-between p-3 bg-indigo-50 rounded-2xl text-sm">
              <span className="font-bold text-indigo-900">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{item.before}{item.suffix}</span>
                <span className="text-slate-300">→</span>
                <span className="font-bold text-indigo-800">{item.after}{item.suffix}</span>
                <span className={`font-extrabold text-xs px-1.5 py-0.5 rounded-full ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {d >= 0 ? '+' : ''}{d}{item.suffix} {isGood ? '📈' : '📉'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

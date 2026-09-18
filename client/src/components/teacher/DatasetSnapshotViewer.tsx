'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import type { ModelEvaluation } from '@/types/models';

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
      {icon} {children}
    </h3>
  );
}

interface DatasetSnapshotViewerProps {
  evaluation: ModelEvaluation;
}

export default function DatasetSnapshotViewer({ evaluation }: DatasetSnapshotViewerProps) {
  const dh = evaluation.datasetHealth;
  if (!dh) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <SectionHeader icon={<Zap className="w-4 h-4 text-purple-500" />}>
        Điểm Chất Lượng Tổng Hợp
      </SectionHeader>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded-2xl text-center">
          <div className={`text-xl font-black ${dh.qualityScore >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{dh.qualityScore}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Chất lượng ảnh</div>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl text-center">
          <div className={`text-xl font-black ${dh.balanceRatio >= 0.7 ? 'text-green-600' : 'text-amber-600'}`}>{Math.round(dh.balanceRatio * 100)}%</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Cân bằng</div>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl text-center">
          <div className={`text-xl font-black ${dh.blurrySampleCount === 0 ? 'text-green-600' : 'text-amber-600'}`}>{dh.blurrySampleCount}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Ảnh mờ</div>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl text-center">
          <div className={`text-xl font-black ${dh.darkSampleCount === 0 ? 'text-green-600' : 'text-amber-600'}`}>{dh.darkSampleCount}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Ảnh tối</div>
        </div>
      </div>
    </div>
  );
}

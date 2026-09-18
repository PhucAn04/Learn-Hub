'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp, Camera, Scale } from 'lucide-react';

interface DataHealthProps {
  classSummary: Record<string, number>;
  balanceRatio: number;
  qualityScore: number;
  blurrySampleCount: number;
  darkSampleCount: number;
  phase: 'PHASE_A' | 'PHASE_B';
  totalSamples: number;
}

function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DataHealthDashboard({ classSummary, balanceRatio, qualityScore, blurrySampleCount, darkSampleCount, phase, totalSamples }: DataHealthProps) {
  const balancePct = Math.round(balanceRatio * 100);
  const badPhotos = blurrySampleCount + darkSampleCount;

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      {/* Phase Badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Camera className="w-3.5 h-3.5" /> Sức Khỏe Dữ Liệu
        </h4>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
          phase === 'PHASE_B' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {phase === 'PHASE_B' ? <><CheckCircle2 className="w-3 h-3" /> Hoàn hảo</> : <><AlertTriangle className="w-3 h-3" /> Cần thêm</>}
        </span>
      </div>

      {/* Per-class counts */}
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(classSummary).map(([label, count]) => (
          <div key={label} className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg">
            <span className="text-[10px] font-bold text-slate-500 truncate flex-1">{label}</span>
            <span className="text-xs font-black text-slate-700">{count}</span>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="font-bold text-slate-400 flex items-center gap-1"><Scale className="w-3 h-3" /> Cân bằng</span>
            <span className={`font-extrabold ${balancePct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{balancePct}%</span>
          </div>
          <MiniBar value={balancePct} color={balancePct >= 70 ? 'bg-green-400' : 'bg-amber-400'} />
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="font-bold text-slate-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Chất lượng</span>
            <span className={`font-extrabold ${qualityScore >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{qualityScore}%</span>
          </div>
          <MiniBar value={qualityScore} color={qualityScore >= 70 ? 'bg-green-400' : 'bg-amber-400'} />
        </div>
      </div>

      {/* Warnings */}
      {badPhotos > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {blurrySampleCount > 0 && <span>{blurrySampleCount} ảnh mờ</span>}
          {blurrySampleCount > 0 && darkSampleCount > 0 && <span>·</span>}
          {darkSampleCount > 0 && <span>{darkSampleCount} ảnh tối</span>}
        </div>
      )}

      {/* Total */}
      <div className="text-center text-[10px] font-bold text-slate-400">
        Tổng cộng: {totalSamples} ảnh
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';

export interface ChartPoint {
  version: number;
  score: number;
  date: string;
  modelId?: string;
  sampleCount: number;
  weakestLabel?: string;
}

interface ProgressChartProps {
  points: ChartPoint[];
  width?: number;
  height?: number;
}

export default function ProgressChart({ points, width = 480, height = 200 }: ProgressChartProps) {
  if (!points || points.length <= 1) return null;

  const padding = { top: 20, right: 30, bottom: 40, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
      <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <TrendingUp className="w-4 h-4 text-indigo-500" /> Tiến Trình Qua Các Lần Nộp
      </h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[500px] mx-auto">
          {/* Y-axis gridlines */}
          {[0, 25, 50, 75, 100].map(v => {
            const y = padding.top + plotH - (v / 100) * plotH;
            return (
              <g key={v}>
                <line x1={padding.left} y1={y} x2={padding.left + plotW} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400">{v}%</text>
              </g>
            );
          })}
          {/* Points and lines */}
          {points.map((pt, i) => {
            const x = padding.left + (i / Math.max(points.length - 1, 1)) * plotW;
            const y = padding.top + plotH - (pt.score / 100) * plotH;
            const prev = i > 0 ? points[i - 1] : null;
            const prevX = prev ? padding.left + ((i - 1) / Math.max(points.length - 1, 1)) * plotW : 0;
            const prevY = prev ? padding.top + plotH - (prev.score / 100) * plotH : 0;
            return (
              <g key={i}>
                {prev && <line x1={prevX} y1={prevY} x2={x} y2={y} stroke="#6366f1" strokeWidth={2.5} />}
                <circle cx={x} cy={y} r={5} fill="#6366f1" stroke="white" strokeWidth={2} />
                <text x={x} y={y - 12} textAnchor="middle" className="text-[11px] fill-indigo-700 font-bold">{pt.score}%</text>
                <text x={x} y={height - 8} textAnchor="middle" className="text-[9px] fill-slate-400">V{pt.version}</text>
                <text x={x} y={height} textAnchor="middle" className="text-[8px] fill-slate-300">{pt.date}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

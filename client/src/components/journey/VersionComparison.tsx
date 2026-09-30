'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface VersionComparisonProps {
  delta: number | null;
  version: number;
  currentScore?: number;
  previousScore?: number;
}

/**
 * Chuyển điểm % sang thang 10 (làm tròn 0.5)
 * 75% → 7.5 điểm, 83% → 8.5 điểm, 100% → 10 điểm
 */
function toTen(pct: number): string {
  const raw = pct / 10;
  const rounded = Math.round(raw * 2) / 2; // làm tròn đến 0.5
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

export default function VersionComparison({ delta, version, currentScore, previousScore }: VersionComparisonProps) {
  if (delta === null || version < 2) return null;

  const isBetter = delta > 0;
  const isSame = delta === 0;

  // Điểm hiện tại và trước đó trên thang 10
  const curTen = currentScore !== undefined ? toTen(currentScore) : null;
  const prevTen = previousScore !== undefined ? toTen(previousScore) : null;

  return (
    <div className={`p-4 rounded-2xl ${
      isBetter ? 'bg-green-50 border border-green-200'
        : isSame ? 'bg-blue-50 border border-blue-200'
        : 'bg-amber-50 border border-amber-200'
    }`}>
      {/* Dòng chính */}
      <div className="flex items-center justify-center gap-2 text-lg font-black mb-1">
        {isBetter ? (
          <TrendingUp className="w-5 h-5 text-green-600" />
        ) : isSame ? (
          <Minus className="w-5 h-5 text-blue-600" />
        ) : (
          <TrendingDown className="w-5 h-5 text-amber-600" />
        )}
        <span className={isBetter ? 'text-green-700' : isSame ? 'text-blue-700' : 'text-amber-700'}>
          {isBetter
            ? 'AI học giỏi hơn lần trước rồi! 🎉'
            : isSame
            ? 'AI vẫn giữ phong độ như lần trước!'
            : 'AI cần được dạy kỹ hơn nhé! 💪'}
        </span>
      </div>

      {/* Dòng giải thích cụ thể với điểm /10 */}
      {curTen && prevTen && (
        <p className={`text-sm font-semibold text-center ${
          isBetter ? 'text-green-600' : isSame ? 'text-blue-600' : 'text-amber-600'
        }`}>
          {isBetter
            ? `Lần trước AI được ${prevTen}/10 điểm, lần này được ${curTen}/10 điểm — tăng ${toTen(Math.abs(delta))} điểm!`
            : isSame
            ? `Cả 2 lần AI đều được ${curTen}/10 điểm.`
            : `Lần trước AI được ${prevTen}/10 điểm, nhưng lần này chỉ được ${curTen}/10 điểm. Bé thử chụp lại ảnh rõ hơn xem nào!`}
        </p>
      )}
    </div>
  );
}

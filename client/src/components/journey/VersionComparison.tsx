'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface VersionComparisonProps {
  delta: number | null;
  version: number;
}

export default function VersionComparison({ delta, version }: VersionComparisonProps) {
  if (delta === null || version < 2) return null;

  const isBetter = delta >= 0;

  return (
    <div className={`p-4 rounded-2xl text-center ${
      isBetter ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      <div className="flex items-center justify-center gap-2 text-lg font-black">
        {isBetter ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
        <span className={isBetter ? 'text-green-700' : 'text-red-700'}>
          {isBetter ? `Tốt hơn lần trước ${delta}%! 🎉` : `Ôi, giảm ${Math.abs(delta)}% so với lần trước 😢`}
        </span>
      </div>
    </div>
  );
}

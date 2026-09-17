'use client';

import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { playClickSound } from '@/lib/audio';

interface ScoreHeaderProps {
  score: number;
  scoreLabel?: string;
  theme?: 'blue' | 'pink' | 'emerald';
}

const themeStyles = {
  blue: {
    backBtn: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  },
  pink: {
    backBtn: 'border-pink-300 text-pink-700 hover:bg-pink-50',
  },
  emerald: {
    backBtn: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  },
};

export default function ScoreHeader({
  score,
  scoreLabel = 'ĐIỂM SỐ',
  theme = 'blue',
}: ScoreHeaderProps) {
  const styles = themeStyles[theme];

  return (
    <div className="flex justify-between items-center mb-6">
      <Link
        href="/home"
        onClick={playClickSound}
        className={`flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 font-extrabold transition shadow-md ${styles.backBtn}`}
      >
        <ArrowLeft className="w-5 h-5" />
        Trang Chủ
      </Link>

      <div className="flex items-center gap-2 bg-yellow-200 border-2 border-yellow-400 px-6 py-2 rounded-full font-black text-yellow-800 text-lg shadow-md">
        <Star className="w-6 h-6 text-yellow-600 fill-yellow-500 animate-pulse" />
        <span>
          {scoreLabel}: {score}
        </span>
      </div>
    </div>
  );
}

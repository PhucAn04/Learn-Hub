'use client';

import React, { useEffect, useMemo } from 'react';
import { playSuccessSound } from '@/lib/audio';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UnlockCelebrationProps {
  title: string;
  emoji: string;
  onDismiss: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#f43f5e', // rose-500
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#eab308', // yellow-500
];

interface ConfettiPiece {
  id: number;
  left: string;
  size: number;
  color: string;
  delay: string;
  duration: string;
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: 4 + Math.random() * 4,         // 4-8px
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${(Math.random() * 1.2).toFixed(2)}s`,
    duration: `${(1.5 + Math.random() * 1.5).toFixed(2)}s`,
  }));
}

// ─── Component ───────────────────────────────────────────────────────────────

const UnlockCelebration: React.FC<UnlockCelebrationProps> = ({
  title,
  emoji,
  onDismiss,
}) => {
  // Generate confetti pieces once
  const confetti = useMemo(() => generateConfetti(30), []);

  // Play sound + auto-dismiss
  useEffect(() => {
    playSuccessSound();
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* --- Injected CSS keyframes (scoped via data-attribute) --- */}
      <style jsx global>{`
        @keyframes uc-scale-in {
          0% {
            transform: scale(0) rotate(-20deg);
            opacity: 0;
          }
          60% {
            transform: scale(1.25) rotate(5deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes uc-float-up {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-110vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes uc-fade-in {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* --- Overlay --- */}
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onDismiss}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onDismiss();
        }}
      >
        {/* Confetti pieces */}
        {confetti.map((c) => (
          <div
            key={c.id}
            className="pointer-events-none absolute rounded-sm"
            style={{
              left: c.left,
              bottom: '-10px',
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              animation: `uc-float-up ${c.duration} ${c.delay} ease-out forwards`,
            }}
          />
        ))}

        {/* Emoji */}
        <div
          className="text-8xl select-none"
          style={{ animation: 'uc-scale-in 0.6s ease-out forwards' }}
        >
          {emoji}
        </div>

        {/* Title */}
        <p
          className="mt-4 text-center text-2xl font-black text-white drop-shadow-lg"
          style={{ animation: 'uc-fade-in 0.5s 0.3s ease-out both' }}
        >
          🔓 Mở khóa: {title}!
        </p>
      </div>
    </>
  );
};

export default UnlockCelebration;

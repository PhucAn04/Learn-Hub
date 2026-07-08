'use client';

import React from 'react';
import { playClickSound } from '@/lib/audio';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomCardProps {
  title: string;
  icon: string;
  description: string;
  status: 'locked' | 'available' | 'in-progress' | 'completed';
  progress: number; // 0 – 100
  onClick: () => void;
  colorScheme: {
    border: string;   // Tailwind-compatible or raw CSS color
    bg: string;
    accent: string;
    gradient: string; // e.g. "linear-gradient(135deg, #8b5cf6, #6366f1)"
  };
  lockMessage?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const RoomCard: React.FC<RoomCardProps> = ({
  title,
  icon,
  description,
  status,
  progress,
  onClick,
  colorScheme,
  lockMessage,
}) => {
  const isLocked = status === 'locked';
  const isAvailable = status === 'available';
  const isInProgress = status === 'in-progress';
  const isCompleted = status === 'completed';

  // ── Click handler ────────────────────────────────────────────────────────
  const handleClick = () => {
    if (isLocked) return;
    playClickSound();
    onClick();
  };

  // ── Derive dynamic styles ────────────────────────────────────────────────
  let borderColor = '#e5e7eb'; // gray-200 fallback
  let bgColor = '#ffffff';
  let extraClasses = '';

  if (isLocked) {
    borderColor = '#d1d5db';
    bgColor = '#f9fafb';
    extraClasses = 'opacity-50 grayscale cursor-not-allowed';
  } else if (isAvailable) {
    borderColor = colorScheme.border;
    bgColor = colorScheme.bg;
  } else if (isInProgress) {
    borderColor = colorScheme.border;
    bgColor = colorScheme.bg;
  } else if (isCompleted) {
    borderColor = '#facc15'; // yellow-400
    bgColor = '#fefce8';     // yellow-50
  }

  return (
    <>
      {/* Pulsing glow keyframes (only rendered once per page thanks to browser de-dup) */}
      <style jsx global>{`
        @keyframes rc-pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
          }
          50% {
            box-shadow: 0 0 24px 4px rgba(139, 92, 246, 0.35);
          }
        }
      `}</style>

      <div
        role="button"
        tabIndex={isLocked ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (!isLocked && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`
          relative flex min-h-[200px] flex-col rounded-3xl border-[3px] p-6
          shadow-lg transition-transform duration-200
          ${!isLocked ? 'hover:scale-[1.02] active:scale-[0.98]' : ''}
          ${extraClasses}
        `}
        style={{
          borderColor,
          backgroundColor: bgColor,
          ...(isAvailable
            ? { animation: 'rc-pulse-glow 2.5s ease-in-out infinite' }
            : {}),
        }}
      >
        {/* ── Locked badge ─────────────────────────────────────────────── */}
        {isLocked && (
          <span className="absolute right-3 top-3 text-2xl leading-none">🔒</span>
        )}

        {/* ── Completed star badge ─────────────────────────────────────── */}
        {isCompleted && (
          <span className="absolute right-3 top-3 text-2xl leading-none">⭐</span>
        )}

        {/* ── Icon ─────────────────────────────────────────────────────── */}
        <span className="mb-2 select-none text-5xl">{icon}</span>

        {/* ── Title ────────────────────────────────────────────────────── */}
        <h3 className="text-xl font-black text-gray-800">{title}</h3>

        {/* ── Description ──────────────────────────────────────────────── */}
        <p className="mt-1 flex-1 text-sm text-gray-600">{description}</p>

        {/* ── Bottom area (status-dependent) ───────────────────────────── */}
        <div className="mt-4">
          {/* Locked → message tag */}
          {isLocked && lockMessage && (
            <span className="inline-block rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-500">
              {lockMessage}
            </span>
          )}

          {/* Available → CTA button */}
          {isAvailable && (
            <button
              type="button"
              className="w-full rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-md transition-shadow hover:shadow-lg"
              style={{ background: colorScheme.gradient }}
            >
              VÀO PHÒNG →
            </button>
          )}

          {/* In-progress → progress bar + CTA */}
          {isInProgress && (
            <>
              {/* Progress bar */}
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, progress))}%`,
                    background: colorScheme.gradient,
                  }}
                />
              </div>

              <button
                type="button"
                className="w-full rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-md transition-shadow hover:shadow-lg"
                style={{ background: colorScheme.gradient }}
              >
                TIẾP TỤC →
              </button>
            </>
          )}

          {/* Completed → tag */}
          {isCompleted && (
            <span className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
              ✅ Hoàn thành
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default RoomCard;

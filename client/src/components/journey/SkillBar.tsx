'use client';

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Skill {
  icon: string;
  label: string;
  completed: boolean;
  progress: number; // 0 – 100
}

interface SkillBarProps {
  skills: Skill[];
  totalStars: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RING_SIZE = 56;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2; // 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 163.36

// ─── Component ───────────────────────────────────────────────────────────────

const SkillBar: React.FC<SkillBarProps> = ({ skills, totalStars }) => {
  return (
    <div className="flex items-center justify-center gap-6 rounded-2xl bg-white/80 px-6 py-3 shadow-md backdrop-blur">
      {/* Skill items */}
      {skills.map((skill, idx) => {
        const dashOffset =
          RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * skill.progress) / 100;

        // Determine ring colour
        let ringColor: string;
        if (skill.completed) {
          ringColor = '#22c55e'; // green-500
        } else if (skill.progress > 0) {
          ringColor = '#8b5cf6'; // violet-500
        } else {
          ringColor = '#d1d5db'; // gray-300
        }

        return (
          <div key={idx} className="flex flex-col items-center gap-1">
            {/* Ring + icon wrapper */}
            <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
              {/* SVG progress ring */}
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                className="absolute inset-0 -rotate-90"
              >
                {/* Background track */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth={RING_STROKE}
                />
                {/* Foreground arc */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
                />
              </svg>

              {/* Emoji icon */}
              <span className="absolute inset-0 flex items-center justify-center text-2xl select-none">
                {skill.icon}
              </span>

              {/* Completed star badge */}
              {skill.completed && (
                <span className="absolute -right-1 -top-1 text-sm leading-none">
                  ⭐
                </span>
              )}
            </div>

            {/* Label */}
            <span className="max-w-[64px] truncate text-center text-xs font-bold text-gray-700">
              {skill.label}
            </span>
          </div>
        );
      })}

      {/* Divider */}
      <div className="mx-1 h-10 w-px bg-gray-200" />

      {/* Star counter */}
      <div className="flex items-center gap-1 rounded-full bg-yellow-50 px-3 py-1.5 shadow-sm">
        <span className="text-lg leading-none">⭐</span>
        <span className="text-sm font-black text-yellow-600">{totalStars}</span>
      </div>
    </div>
  );
};

export default SkillBar;

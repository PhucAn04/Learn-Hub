'use client';

interface MatchProgressBarProps {
  progress: number;
  statusText: string;
  className?: string;
}

export default function MatchProgressBar({
  progress,
  statusText,
  className = 'w-full max-w-lg mt-6',
}: MatchProgressBarProps) {
  return (
    <div className={className}>
      <div className="flex justify-between font-extrabold text-sm mb-2 text-gray-700">
        <span>{statusText}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden border-2 border-gray-300">
        <div
          className="bg-green-500 h-full rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

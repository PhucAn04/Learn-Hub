'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SandboxPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-indigo-100 p-8">
      <Link
        href="/home"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-indigo-200 text-indigo-700 font-extrabold shadow-sm hover:scale-105 transition-transform mb-8"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Về Trang Chủ</span>
      </Link>
      <div className="flex flex-col items-center justify-center pt-20">
        <span className="text-6xl">🧪</span>
        <h1 className="text-2xl font-black text-indigo-900 mt-4">Phòng Thí Nghiệm AI</h1>
        <p className="text-sm text-slate-500 font-semibold mt-2">Tính năng đang được phát triển...</p>
      </div>
    </div>
  );
}

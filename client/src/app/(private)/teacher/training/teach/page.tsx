'use client';

import { Sparkles, Brain, ArrowLeft, Trash2, Camera, Award, HelpCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { playClickSound } from '@/lib/audio';
import TeachFlowPanel from '@/components/journey/flow/TeachFlowPanel';

// Predefined classes for teaching
const CLASSES = [
  { id: 'class_1', label: '1 Ngón Tay ☝️', emoji: '☝️' },
  { id: 'class_2', label: '2 Ngón Tay ✌️', emoji: '✌️' },
];

export default function TeacherTeachPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-indigo-50 to-purple-100 py-8 px-4 select-none">
      <div className="max-w-[1600px] w-[98%] mx-auto">
        
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/home"
            onClick={playClickSound}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-indigo-200 text-indigo-700 font-extrabold shadow-sm hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Về Trang Chủ</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧠👩‍🏫</span>
            <h1 className="text-2xl md:text-3xl font-black text-indigo-900">Dạy AI học Nhận Dạng 1 Bàn Tay</h1>
          </div>
        </div>

        {/* Màn hình TeachFlowPanel mới */}
        <div className="w-full">
          <TeachFlowPanel
            mode="hand-1"
            classes={CLASSES}
            minSamplesPerClass={3}
            onTrainComplete={(samples) => {
              console.log('Huấn luyện thành công!', samples);
              // Lưu vào dataset hoặc mở modal (tạm ẩn)
            }}
          />
        </div>

      </div>
    </div>
  );
}

'use client';

import { ArrowLeft, Brain, Sparkles, Move, Presentation, ThumbsUp, HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const TRAINING_MODULES = [
  {
    id: 'teach',
    title: 'Đếm ngón tay trên 1 bàn',
    description: 'Dạy AI phân biệt 1 ngón và 2 ngón tay.',
    icon: <Sparkles className="w-8 h-8 text-amber-500" />,
    color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    link: '/teacher/training/teach',
  },
  {
    id: 'teach-two-hands',
    title: 'Đếm ngón tay trên 2 bàn tay',
    description: 'Dạy AI nhận diện bàn tay trái và phải.',
    icon: <Move className="w-8 h-8 text-blue-500" />,
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    link: '/teacher/training/teach-two-hands',
  },
  {
    id: 'teach-gestures',
    title: 'Cử Chỉ Ngôn Ngữ Ký Hiệu',
    description: 'Huấn luyện AI 4 cử chỉ giao tiếp cơ bản.',
    icon: <ThumbsUp className="w-8 h-8 text-emerald-500" />,
    color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    link: '/teacher/training/teach-gestures',
  },
  {
    id: 'teach-face',
    title: 'Biểu Cảm Khuôn Mặt',
    description: 'Dạy AI phân biệt vui, buồn, ngạc nhiên...',
    icon: <Presentation className="w-8 h-8 text-purple-500" />,
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400',
    link: '/teacher/training/teach-face',
  },
];

const BODY_EXERCISES = [
  { id: 'teach-body', title: 'Tất cả Động tác', link: '/teacher/training/teach-body', description: 'Tạo dữ liệu mẫu cho các động tác vươn thở, tay, chân, lườn, bụng' }
];

export default function TeacherTrainingDashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-[1600px] w-[98%] mx-auto space-y-12">
        {/* HEADER */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push('/teacher')}
            className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
              <Brain className="w-10 h-10 text-indigo-500" />
              Tạo Dữ Liệu Mẫu
            </h1>
            <p className="text-lg text-slate-600 font-medium mt-2">
              Chọn một chủ đề để thu thập dữ liệu và làm mẫu cho học sinh.
            </p>
          </div>
        </div>

        {/* CORE CHALLENGES GRID */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            ⭐ Bài Tập Cơ Bản (Có kiểm duyệt Gốc)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TRAINING_MODULES.map((module) => (
              <Link href={module.link} key={module.id}>
                <div className={`p-8 rounded-3xl border-4 transition-all duration-300 cursor-pointer flex items-center gap-6 ${module.color}`}>
                  <div className="p-4 bg-white rounded-2xl shadow-sm">
                    {module.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">{module.title}</h2>
                    <p className="text-slate-600 font-medium">{module.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* BODY EXERCISES GRID */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <HeartPulse className="w-8 h-8 text-rose-500" /> Bài Tập Thể Dục Khung Xương (Tự do tạo Nhãn)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            {BODY_EXERCISES.map((module) => (
              <Link href={module.link} key={module.id}>
                <div className="p-8 rounded-3xl border-4 bg-rose-50 border-rose-200 hover:border-rose-400 transition-all duration-300 cursor-pointer flex items-center gap-6">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm text-4xl shrink-0">
                    🤸
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">{module.title}</h2>
                    <p className="text-slate-600 font-medium">{module.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

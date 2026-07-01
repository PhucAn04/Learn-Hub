'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Loader2, Calendar, Smile, Hand, Gamepad2, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';
import Link from 'next/link';

export default function StudentProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stats, setStats] = useState<Record<string, number>>({
    fingers: 0,
    gestures: 0,
    face: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      try {
        const profile = await api.getProfile();
        if (profile.role !== 'student') {
          router.replace('/profile/teacher');
          return;
        }
        setCurrentUser(profile);

        const userStats = await api.getUserStats();
        setStats(userStats);
      } catch (err) {
        console.error('Failed to load profile data', err);
        api.clearToken();
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const getMedal = (score: number) => {
    if (score >= 80) return { emoji: '🥇', label: 'Huy Chương Vàng', desc: 'Kỷ lục gia AI xuất sắc!' };
    if (score >= 40) return { emoji: '🥈', label: 'Huy Chương Bạc', desc: 'Chiến binh AI thông minh!' };
    if (score >= 10) return { emoji: '🥉', label: 'Huy Chương Đồng', desc: 'Học viên AI chăm chỉ!' };
    return { emoji: '🎗️', label: 'Băng Đeo Danh Dự', desc: 'Bắt đầu hành trình khám phá AI!' };
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-purple-50 to-pink-100">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-purple-50 to-pink-100 py-10 px-4 select-none">
      <div className="max-w-4xl mx-auto">
        {/* Back navigation */}
        <div className="mb-6">
          <Link
            href="/"
            onClick={playClickSound}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 border-purple-200 font-extrabold text-purple-700 hover:bg-purple-50 transition shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            Về Trang Chủ
          </Link>
        </div>

        {/* User Card */}
        <div className="bg-white rounded-3xl p-8 border-4 border-purple-300 shadow-xl flex flex-col md:flex-row items-center gap-8 mb-8 relative overflow-hidden">
          <div className="text-7xl bg-purple-100 border-4 border-purple-200 w-28 h-28 rounded-full flex items-center justify-center shadow-lg relative z-10 transform hover:scale-105 transition-transform duration-300">
            {currentUser.avatar || '🦁'}
          </div>
          <div className="flex-1 text-center md:text-left relative z-10">
            <div className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-black mb-2 uppercase">Học Sinh 🦁</div>
            <h2 className="text-3xl font-black text-gray-800 leading-tight mb-2">
              {currentUser.username}
            </h2>
            <p className="text-sm font-semibold text-gray-500 flex items-center justify-center md:justify-start gap-1">
              <Calendar className="w-4 h-4 text-purple-400" />
              Đã gia nhập từ: {new Date(currentUser.createdAt).toLocaleDateString('vi-VN')}
            </p>
            <p className="text-xs font-semibold text-gray-400 mt-1">
              Email học tập: {currentUser.email}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Finger Stats */}
          <div className="bg-white rounded-3xl p-6 border-4 border-blue-400 shadow-lg hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-blue-200 shadow-inner">
              <Hand className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-gray-500 text-xs tracking-wider uppercase mb-1">Đếm Ngón Tay</h4>
            <div className="text-3xl font-black text-blue-600 mb-4">{stats.fingers} điểm</div>
            
            {/* Medal badge */}
            <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100 flex items-center gap-3">
              <span className="text-3xl">{getMedal(stats.fingers).emoji}</span>
              <div>
                <div className="text-xs font-extrabold text-blue-800">{getMedal(stats.fingers).label}</div>
                <div className="text-[10px] font-semibold text-blue-600">{getMedal(stats.fingers).desc}</div>
              </div>
            </div>
          </div>

          {/* Gesture Stats */}
          <div className="bg-white rounded-3xl p-6 border-4 border-pink-400 shadow-lg hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mb-4 border border-pink-200 shadow-inner">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-gray-500 text-xs tracking-wider uppercase mb-1">Ảo Thuật Tay</h4>
            <div className="text-3xl font-black text-pink-600 mb-4">{stats.gestures} điểm</div>
            
            {/* Medal badge */}
            <div className="bg-pink-50/50 rounded-2xl p-3 border border-pink-100 flex items-center gap-3">
              <span className="text-3xl">{getMedal(stats.gestures).emoji}</span>
              <div>
                <div className="text-xs font-extrabold text-pink-800">{getMedal(stats.gestures).label}</div>
                <div className="text-[10px] font-semibold text-pink-600">{getMedal(stats.gestures).desc}</div>
              </div>
            </div>
          </div>

          {/* Face Stats */}
          <div className="bg-white rounded-3xl p-6 border-4 border-emerald-400 shadow-lg hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 border border-emerald-200 shadow-inner">
              <Smile className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-gray-500 text-xs tracking-wider uppercase mb-1">Thám Tử Mặt</h4>
            <div className="text-3xl font-black text-emerald-600 mb-4">{stats.face} ảnh</div>
            
            {/* Medal badge */}
            <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100 flex items-center gap-3">
              <span className="text-3xl">{getMedal(stats.face * 10).emoji}</span>
              <div>
                <div className="text-xs font-extrabold text-emerald-800">{getMedal(stats.face * 10).label}</div>
                <div className="text-[10px] font-semibold text-emerald-600">{getMedal(stats.face * 10).desc}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

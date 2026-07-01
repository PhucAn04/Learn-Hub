'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Calendar, ArrowLeft, BookOpen, Users, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';
import Link from 'next/link';

export default function TeacherProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submissionsCount, setSubmissionsCount] = useState(0);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      try {
        const profile = await api.getProfile();
        if (profile.role !== 'teacher') {
          router.replace('/profile/student');
          return;
        }
        setCurrentUser(profile);

        // Fetch submissions count for display
        const subs = await api.getSubmissions();
        setSubmissionsCount(subs.length);
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

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-100">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-indigo-50 via-slate-50 to-slate-100 py-10 px-4 select-none">
      <div className="max-w-4xl mx-auto">
        
        {/* Back navigation */}
        <div className="mb-6">
          <Link
            href="/"
            onClick={playClickSound}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 border-indigo-200 font-extrabold text-indigo-700 hover:bg-indigo-50 transition shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            Về Trang Chủ
          </Link>
        </div>

        {/* User Card */}
        <div className="bg-white rounded-3xl p-8 border-4 border-indigo-300 shadow-xl flex flex-col md:flex-row items-center gap-8 mb-8 relative overflow-hidden">
          <div className="text-7xl bg-indigo-100 border-4 border-indigo-200 w-28 h-28 rounded-full flex items-center justify-center shadow-lg relative z-10 transform hover:scale-105 transition-transform duration-300">
            {currentUser.avatar || '👩‍🏫'}
          </div>
          <div className="flex-1 text-center md:text-left relative z-10">
            <div className="inline-block px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-black mb-2 uppercase tracking-wider">
              Giáo Viên 👩‍🏫
            </div>
            <h2 className="text-3xl font-black text-gray-800 leading-tight mb-2">
              {currentUser.username}
            </h2>
            <p className="text-sm font-semibold text-gray-500 flex items-center justify-center md:justify-start gap-1">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Đã gia nhập từ: {new Date(currentUser.createdAt).toLocaleDateString('vi-VN')}
            </p>
            <p className="text-xs font-semibold text-gray-400 mt-1">
              Email giáo án: {currentUser.email}
            </p>
          </div>
        </div>

        {/* Teacher Toolbox Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Submissions Dashboard */}
          <Link
            href="/teacher"
            onClick={playClickSound}
            className="bg-white rounded-3xl p-6 border-4 border-indigo-500 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 border border-indigo-200 shadow-inner group-hover:rotate-6 transition-transform">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-indigo-900 mb-1">Chấm Điểm Bài Tập</h3>
              <p className="text-gray-500 text-xs font-semibold leading-relaxed mb-4">
                Xem và chấm điểm chéo các mô hình AI do học sinh tự huấn luyện và gửi nộp.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-indigo-50 pt-4 mt-2">
              <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                {submissionsCount} bài chưa xem
              </span>
              <span className="text-sm font-bold text-indigo-700 group-hover:translate-x-1 transition-transform">
                Mở Dashboards →
              </span>
            </div>
          </Link>

          {/* Card 2: Classroom Stats / Concept Notes */}
          <div className="bg-white rounded-3xl p-6 border-4 border-emerald-400 shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 border border-emerald-200 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-emerald-900 mb-1">Lớp Học Của Tôi</h3>
              <p className="text-gray-500 text-xs font-semibold leading-relaxed mb-4">
                Quản lý các tài khoản học sinh, hướng dẫn bài giảng "Bé tập làm quen với công nghệ học máy".
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-emerald-50 pt-4 mt-2">
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                Hoạt động tích cực
              </span>
              <Link href="/concepts" onClick={playClickSound} className="text-xs font-black text-emerald-700 hover:underline">
                Xem giáo án khái niệm AI
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

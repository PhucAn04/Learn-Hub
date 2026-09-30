'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Calendar, Smile, Hand, Gamepad2, ArrowLeft, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';
import { UserProfile } from '@/types/models';
import Link from 'next/link';

export const getEvaluation = (score?: number) => {
  if (score === undefined || score === 0) {
    return { emoji: '☁️', text: 'Bé chưa thu thập dữ liệu cho bài này.', title: 'Chưa học' };
  }
  if (score < 40) {
    return { emoji: '😵', text: 'Dữ liệu chưa chính xác, Bạn AI nhận diện còn rất kém.', title: 'Bối rối' };
  }
  if (score < 50) {
    return { emoji: '🥺', text: 'Dữ liệu chưa chính xác lắm, Bạn AI nhận còn khá yếu kém.', title: 'Hơi khó hiểu' };
  }
  if (score < 65) {
    return { emoji: '🤔', text: 'Dữ liệu khá ổn, cần cho Bạn AI học thêm.', title: 'Đang cố hiểu' };
  }
  if (score < 70) {
    return { emoji: '🧐', text: 'Dữ liệu khá ổn, Bạn AI đang tiến bộ, cần cho Bạn AI học thêm.', title: 'Tiến bộ' };
  }
  if (score < 80) {
    return { emoji: '😃', text: 'Dữ liệu khá tốt, cần cho Bạn học nhiều thêm nữa.', title: 'Đã hiểu' };
  }
  return { emoji: '🤩', text: 'Dữ liệu rất tốt, bé hãy giữ thói quen này để trí nhớ của bạn AI luôn sáng suốt nhé.', title: 'Siêu thông minh!' };
};

interface SubjectCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  dataKey: string;
  href: string;
  score: number;
}

const SubjectCard = ({ id, title, icon, color, dataKey, href, score }: SubjectCardProps) => {
  const evalResult = getEvaluation(score);
  const isUnplayed = score === 0;

  return (
    <div className={`bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col h-full transition-all ${isUnplayed ? 'opacity-80 grayscale-[20%]' : 'hover:shadow-md hover:border-sky-200 hover:-translate-y-1'}`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${isUnplayed ? 'bg-gray-100 text-gray-400' : `bg-${color}-100 text-${color}-600`}`}>
        {icon}
      </div>
      <h4 className="font-extrabold text-gray-800 text-lg mb-2">{title}</h4>
      
      {/* Khối hiển thị Trạng thái Bạn AI */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl filter drop-shadow-sm">{evalResult.emoji}</div>
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Bạn AI:</div>
          <div className={`font-black text-sm ${isUnplayed ? 'text-gray-500' : 'text-amber-600'}`}>{evalResult.title}</div>
        </div>
      </div>
      
      <div className="bg-slate-50 rounded-xl p-4 flex-1 mb-5 border border-slate-100">
        <p className="text-sm font-semibold text-gray-600 leading-relaxed">
          {evalResult.text}
        </p>
      </div>

      <Link href={href} className={`w-full block py-3 font-bold text-center rounded-xl transition-colors text-sm ${isUnplayed ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : `bg-${color}-50 hover:bg-${color}-100 text-${color}-700`}`}>
        {dataKey === 'teach-body' ? 'Vào Phòng Tập' : 'Xem Lịch Sử'}
      </Link>
    </div>
  );
};

export default function StudentProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
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


  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-sky-50">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  // Tính toán điểm Thể Dục Tổng Quát dựa trên 5 bài
  const bodyScores = [stats['teach-body-1'], stats['teach-body-2'], stats['teach-body-3'], stats['teach-body-4'], stats['teach-body-5']].filter(Boolean);
  const totalBodyScore = bodyScores.length > 0 ? bodyScores.reduce((a, b) => a + (b || 0), 0) / bodyScores.length : 0;
  // Gán điểm tổng vào stats để Card dùng
  const displayStats: Record<string, number> = { ...stats, 'teach-body': totalBodyScore };


  return (
    <div className="flex-1 bg-sky-50 py-10 px-4 select-none">
      <div className="max-w-6xl mx-auto">
        {/* Back navigation */}
        <div className="mb-6">
          <Link
            href="/home"
            onClick={playClickSound}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white font-bold text-sky-700 hover:bg-sky-100 transition shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            Về Trang Chủ
          </Link>
        </div>

        {/* User Card */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 mb-10">
          <div className="text-7xl bg-sky-100 w-32 h-32 rounded-[2rem] flex items-center justify-center shadow-inner transform hover:rotate-3 transition-transform duration-300">
            {currentUser.avatar || '👦'}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 rounded-full text-sm font-bold mb-3">Hồ Sơ Học Tập AI</div>
            <h2 className="text-3xl font-black text-gray-800 leading-tight mb-2">
              {currentUser.username}
            </h2>
            <p className="text-sm font-medium text-gray-500 flex items-center justify-center md:justify-start gap-1.5">
              <Calendar className="w-4 h-4" />
              Gia nhập từ: {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('vi-VN') : 'Mới tham gia'}
            </p>
          </div>
        </div>

        {/* Subjects Grid */}
        <h3 className="text-2xl font-black text-gray-800 mb-6 px-2">Các Môn Học AI</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-10">
          <SubjectCard id="teach" title="Đếm Ngón Tay" icon={<Hand className="w-7 h-7" />} color="blue" dataKey="teach" href="/student/history/teach" score={displayStats['teach'] || 0} />
          <SubjectCard id="teach-two-hands" title="2 Bàn Tay" icon={<Hand className="w-7 h-7" />} color="teal" dataKey="teach-two-hands" href="/student/history/teach-two-hands" score={displayStats['teach-two-hands'] || 0} />
          <SubjectCard id="teach-face" title="Thám Tử Mặt" icon={<Smile className="w-7 h-7" />} color="emerald" dataKey="teach-face" href="/student/history/teach-face" score={displayStats['teach-face'] || 0} />
          <SubjectCard id="teach-gestures" title="Ảo Thuật Tay" icon={<Gamepad2 className="w-7 h-7" />} color="pink" dataKey="teach-gestures" href="/student/history/teach-gestures" score={displayStats['teach-gestures'] || 0} />
          {/* Thẻ Thể Dục bây giờ giống các thẻ khác */}
          <SubjectCard id="teach-body" title="Thể Dục Cơ Thể" icon={<Activity className="w-7 h-7" />} color="indigo" dataKey="teach-body" href="/profile/student/teach-body" score={displayStats['teach-body'] || 0} />
        </div>
      </div>
    </div>
  );
}

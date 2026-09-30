'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Activity } from 'lucide-react';
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

interface BodyExerciseCardProps {
  title: string;
  dataKey: string;
  historyLink: string;
  score: number;
}

const BodyExerciseCard = ({ title, dataKey, historyLink, score }: BodyExerciseCardProps) => {
  const evalResult = getEvaluation(score);
  const isUnplayed = score === 0;

  return (
    <div className={`bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col h-full transition-all ${isUnplayed ? 'opacity-80 grayscale-[20%]' : 'hover:shadow-md hover:border-indigo-200 hover:-translate-y-1'}`}>
      <h4 className="font-extrabold text-indigo-900 text-lg mb-4 text-center">{title}</h4>
      
      {/* Khối hiển thị Trạng thái Bạn AI */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <div className="text-5xl filter drop-shadow-sm mb-2">{evalResult.emoji}</div>
        <div className="text-center">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Bạn AI:</div>
          <div className={`font-black text-sm ${isUnplayed ? 'text-gray-500' : 'text-amber-600'}`}>{evalResult.title}</div>
        </div>
      </div>
      
      <div className="bg-indigo-50/50 rounded-xl p-4 flex-1 mb-5 border border-indigo-50 text-center">
        <p className="text-sm font-semibold text-gray-600 leading-relaxed">
          {evalResult.text}
        </p>
      </div>

      <Link href={historyLink} className={`w-full block py-3 font-bold text-center rounded-xl transition-colors text-sm ${isUnplayed ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}>
        Xem Lịch Sử
      </Link>
    </div>
  );
};

export default function TeachBodyHistoryPage() {
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


  return (
    <div className="flex-1 bg-sky-50 py-10 px-4 select-none">
      <div className="max-w-5xl mx-auto">
        {/* Back navigation */}
        <div className="mb-8">
          <Link
            href="/profile/student"
            onClick={playClickSound}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white font-bold text-sky-700 hover:bg-sky-100 transition shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            Trở Về Bảng Điểm
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm flex items-center gap-6 mb-10">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-[1.5rem] flex items-center justify-center">
            <Activity className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-800 mb-2">Phòng Tập Thể Dục</h2>
            <p className="text-sm font-medium text-gray-500">
              Tại đây bé có thể xem lại kết quả của từng bài tập độc lập nhé.
            </p>
          </div>
        </div>

        {/* Exercises Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <BodyExerciseCard title="1. Vươn Thở" dataKey="teach-body-1" historyLink="/student/history/teach-body-1" score={stats['teach-body-1'] || 0} />
          <BodyExerciseCard title="2. Động Tác Tay" dataKey="teach-body-2" historyLink="/student/history/teach-body-2" score={stats['teach-body-2'] || 0} />
          <BodyExerciseCard title="3. Động Tác Lườn" dataKey="teach-body-3" historyLink="/student/history/teach-body-3" score={stats['teach-body-3'] || 0} />
          <BodyExerciseCard title="4. Động Tác Bụng" dataKey="teach-body-4" historyLink="/student/history/teach-body-4" score={stats['teach-body-4'] || 0} />
          <BodyExerciseCard title="5. Động Tác Chân" dataKey="teach-body-5" historyLink="/student/history/teach-body-5" score={stats['teach-body-5'] || 0} />
        </div>
      </div>
    </div>
  );
}

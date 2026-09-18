'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function ProfileDispatcherPage() {
  const router = useRouter();

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const dispatch = async () => {
      try {
        const profile = await api.getProfile();
        if (profile.role === 'teacher') {
          router.replace('/teacher');
        } else {
          router.replace('/profile/student');
        }
      } catch (err) {
        console.error('Failed to dispatch user profile', err);
        api.clearToken();
        router.push('/login');
      }
    };

    dispatch();
  }, [router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-3">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      <span className="font-extrabold text-sm text-slate-500">Đang chuẩn bị trang cá nhân...</span>
    </div>
  );
}

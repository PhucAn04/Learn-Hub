'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { playSuccessSound } from '@/lib/audio';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      api.setToken(token);
      playSuccessSound();
      api.getProfile().then(profile => {
        if (profile.role === 'teacher') {
          router.push('/teacher');
        } else {
          router.push('/home');
        }
      }).catch(() => {
        router.push('/home');
      });
    } else {
      router.push('/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-100 flex flex-col items-center justify-center p-4">
      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl mb-6">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
      <h2 className="text-2xl font-black text-gray-800">Đang xử lý đăng nhập...</h2>
      <p className="text-gray-500 font-bold mt-2">Bé đợi chút xíu nha! 🚀</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}

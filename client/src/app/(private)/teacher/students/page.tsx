'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TeacherStudentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/teacher');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-indigo-600 rounded-full" role="status" />
      <span className="ml-2 font-bold text-slate-600 text-sm">Đang chuyển hướng...</span>
    </div>
  );
}

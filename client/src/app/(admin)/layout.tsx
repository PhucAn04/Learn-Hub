'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    const checkAuth = async () => {
      const token = adminApi.getToken();
      if (!token) {
        setIsAuthenticated(false);
        if (!isLoginPage) router.replace('/admin/login');
      } else {
        try {
          await adminApi.getProfile();
          setIsAuthenticated(true);
          if (isLoginPage) router.replace('/admin');
        } catch {
          setIsAuthenticated(false);
          adminApi.clearToken();
          if (!isLoginPage) router.replace('/admin/login');
        }
      }
    };
    checkAuth();
  }, [router, pathname, isLoginPage]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-indigo-600 rounded-full" />
      </div>
    );
  }

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

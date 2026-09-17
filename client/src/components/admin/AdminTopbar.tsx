'use client';

import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import { LogOut, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserProfile } from '@/types/models';

export default function AdminTopbar() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    adminApi.getProfile().then(setProfile).catch(console.error);
  }, []);

  const handleLogout = () => {
    adminApi.clearToken();
    router.push('/admin/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 relative">
      <div className="flex items-center md:hidden">
        <button className="text-slate-500 hover:text-slate-700">
          <Menu size={24} />
        </button>
      </div>
      
      <div className="hidden md:block">
        {/* Empty space for flex layout */}
      </div>

      <div className="flex items-center gap-4">
        {profile && (
          <div className="text-sm text-slate-600 font-medium hidden sm:block">
            Xin chào, {profile.username}
          </div>
        )}
        <button 
          onClick={handleLogout}
          className="flex items-center text-sm text-red-600 hover:text-red-700 font-medium bg-red-50 px-3 py-1.5 rounded-md transition"
        >
          <LogOut size={16} className="mr-1.5" /> Logout
        </button>
      </div>
    </header>
  );
}

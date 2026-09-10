'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { Users, UserCheck, ShieldAlert, TrendingUp } from 'lucide-react';

interface AdminStats {
  total: number;
  activeCount: number;
  byRole: { student: number; teacher: number };
  newToday: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) return <div className="animate-pulse flex space-x-4">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Tổng quan hệ thống</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium">Tổng người dùng</h3>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Users size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium">Tài khoản Active</h3>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.activeCount}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium">Phân loại</h3>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-slate-500">Student</p>
              <p className="text-xl font-bold text-slate-800">{stats.byRole.student}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Teacher</p>
              <p className="text-xl font-bold text-slate-800">{stats.byRole.teacher}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium">Đăng ký mới hôm nay</h3>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.newToday}</p>
        </div>
      </div>
    </div>
  );
}

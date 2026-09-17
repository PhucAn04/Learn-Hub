'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import type { UserProfile } from '@/types/models';

type AdminUserDetail = UserProfile & { isActive: boolean; lastLoginAt?: string; deactivatedAt?: string; roleChangedAt?: string };

export default function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    adminApi.getUser(resolvedParams.id)
      .then(setUser)
      .catch((err) => {
        console.error(err);
        alert('Không tìm thấy người dùng');
        router.push('/admin/users');
      })
      .finally(() => setLoading(false));
  }, [resolvedParams.id, router]);

  const handleChangeRole = async (newRole: string) => {
    if (!user) return;
    if (!confirm(`Bạn có chắc chắn muốn đổi vai trò của user này thành ${newRole}?`)) return;
    setActionLoading(true);
    try {
      const updated = await adminApi.changeRole(user.id, newRole);
      setUser(updated as AdminUserDetail);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message || 'Lỗi khi đổi vai trò');
      } else {
        alert('Lỗi khi đổi vai trò');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    const newStatus = !user.isActive;
    const actionName = newStatus ? 'Kích hoạt' : 'Vô hiệu hóa';
    if (!confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản này?`)) return;
    setActionLoading(true);
    try {
      const updated = await adminApi.toggleStatus(user.id, newStatus);
      setUser(updated as AdminUserDetail);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message || 'Lỗi khi cập nhật trạng thái');
      } else {
        alert('Lỗi khi cập nhật trạng thái');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !user) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button 
        onClick={() => router.push('/admin/users')}
        className="flex items-center text-slate-500 hover:text-indigo-600 transition"
      >
        <ArrowLeft size={20} className="mr-2" /> Quay lại danh sách
      </button>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="text-6xl bg-slate-100 w-24 h-24 flex items-center justify-center rounded-full">
            {user.avatar || '🦁'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">{user.username}</h1>
            <p className="text-slate-500 mt-1">{user.email}</p>
            <div className="mt-3 flex gap-2">
              <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                user.role === 'admin' ? 'bg-red-100 text-red-800' :
                user.role === 'teacher' ? 'bg-purple-100 text-purple-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                Role: {user.role}
              </span>
              <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                user.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'
              }`}>
                Status: {user.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-100 rounded-lg p-5 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4">Thông tin hệ thống</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span className="text-slate-500">ID:</span>
                <span className="font-mono text-slate-800 text-xs mt-0.5">{user.id}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-500">Ngày đăng ký:</span>
                <span className="text-slate-800">{user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : ''}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-500">Đăng nhập lần cuối:</span>
                <span className="text-slate-800">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Chưa có'}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-500">Đổi role lần cuối:</span>
                <span className="text-slate-800">{user.roleChangedAt ? new Date(user.roleChangedAt).toLocaleString('vi-VN') : 'Chưa có'}</span>
              </li>
            </ul>
          </div>

          <div className="border border-slate-100 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4">Hành động quản trị</h3>
            
            {user.role !== 'admin' && (
              <div className="space-y-4">
                <div className="p-4 border border-indigo-100 bg-indigo-50/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="text-indigo-600 mt-0.5" size={20} />
                    <div>
                      <h4 className="font-medium text-slate-800 text-sm">Phân quyền vai trò</h4>
                      <p className="text-xs text-slate-500 mt-1 mb-3">Thay đổi quyền truy cập của người dùng trên hệ thống Learn-Hub.</p>
                      <div className="flex gap-2">
                        {user.role === 'student' ? (
                          <button onClick={() => handleChangeRole('teacher')} disabled={actionLoading} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                            Nâng cấp lên Teacher
                          </button>
                        ) : (
                          <button onClick={() => handleChangeRole('student')} disabled={actionLoading} className="text-xs px-3 py-1.5 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50">
                            Hạ cấp xuống Student
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 border rounded-lg ${user.isActive ? 'border-red-100 bg-red-50/50' : 'border-green-100 bg-green-50/50'}`}>
                  <div className="flex items-start gap-3">
                    {user.isActive ? <AlertTriangle className="text-red-600 mt-0.5" size={20} /> : <CheckCircle className="text-green-600 mt-0.5" size={20} />}
                    <div>
                      <h4 className="font-medium text-slate-800 text-sm">{user.isActive ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt lại tài khoản'}</h4>
                      <p className="text-xs text-slate-500 mt-1 mb-3">
                        {user.isActive ? 'Người dùng sẽ bị đăng xuất và không thể đăng nhập lại.' : 'Người dùng có thể đăng nhập và sử dụng hệ thống bình thường.'}
                      </p>
                      <button 
                        onClick={handleToggleStatus} 
                        disabled={actionLoading}
                        className={`text-xs px-3 py-1.5 text-white rounded disabled:opacity-50 ${user.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                        {user.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {user.role === 'admin' && (
              <p className="text-sm text-slate-500 italic">Không thể thay đổi quyền hoặc trạng thái của tài khoản admin khác từ giao diện này.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

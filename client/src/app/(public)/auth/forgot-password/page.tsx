'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại sau.');
      } else {
        setError('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Quên mật khẩu?</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Nhập email của bạn và chúng tôi sẽ gửi đường dẫn để thiết lập lại mật khẩu.
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg text-sm text-center">
            <p className="font-semibold mb-2">Đã gửi email thành công!</p>
            <p>Vui lòng kiểm tra hộp thư đến (và thư mục Spam) của bạn.</p>
            <Link href="/login" className="block mt-4 text-indigo-600 hover:underline font-medium">
              Quay lại trang Đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-100">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="Ví dụ: student@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 font-medium transition disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'Gửi đường dẫn Đặt lại'}
            </button>

            <div className="text-center mt-4 text-sm">
              <Link href="/login" className="text-slate-500 hover:text-indigo-600 transition">
                Quay lại trang Đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

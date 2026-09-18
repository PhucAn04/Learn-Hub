'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound, playSuccessSound } from '@/lib/audio';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    setError('');

    if (!email || !password) {
      setError('Bé hãy nhập đầy đủ Email và Mật khẩu nhé!');
      return;
    }

    setLoading(true);
    try {
      const response = await api.login(email, password);
      playSuccessSound();
      api.setToken(response.accessToken);
      if (response.user?.role === 'teacher') {
        router.push('/teacher');
      } else {
        router.push('/home');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email hoặc mật khẩu không chính xác rồi bé ơi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-purple-50 to-pink-100 flex items-center justify-center px-4 py-12 select-none">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border-4 border-purple-300 shadow-2xl relative overflow-hidden">
        {/* Floating background decorative bubbles */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-100 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-pink-100 rounded-full blur-xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-3 border-2 border-purple-200 shadow-inner transform rotate-3 hover:rotate-0 transition-transform">
            <Sparkles className="w-8 h-8 text-yellow-400 fill-yellow-300" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 leading-tight">Đăng Nhập</h2>
          <p className="text-xs font-semibold text-gray-500 mt-1">
            Chào mừng bé quay lại Học Viện AI Nhí! 🎈
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-2xl border border-red-200 mb-6 text-center animate-bounce">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-extrabold text-gray-700 mb-2">Địa Chỉ Email:</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                placeholder="vd: beyeuai@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none font-bold text-sm transition-colors shadow-inner"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-gray-700 mb-2">Mật Khẩu:</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none font-bold text-sm transition-colors shadow-inner"
                required
              />
            </div>
            <div className="flex justify-end mt-1">
              <Link 
                href="/auth/forgot-password" 
                onClick={playClickSound}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-base rounded-2xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg border-b-4 border-purple-700 active:border-b-0 active:translate-y-[4px] flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Vào học ngay nào! 🚀
              </>
            )}
          </button>
        </form>

        <div className="relative my-6 z-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-400 font-semibold">Hoặc</span>
          </div>
        </div>

        <button
          onClick={() => {
            playClickSound();
            window.location.href = '/api/auth/google';
          }}
          className="w-full py-4 bg-white text-gray-700 font-black text-base rounded-2xl hover:bg-gray-50 transition shadow-md border-2 border-gray-200 active:border-b-0 active:translate-y-[2px] flex items-center justify-center gap-3 cursor-pointer z-10 relative"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
          Đăng nhập với Google
        </button>

        <div className="mt-8 text-center border-t border-gray-100 pt-6 relative z-10">
          <p className="text-xs font-semibold text-gray-500">
            Bé chưa có tài khoản học tập?{' '}
            <Link
              href="/register"
              onClick={playClickSound}
              className="text-purple-600 hover:underline font-extrabold"
            >
              Đăng ký ngay tại đây 🚀
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

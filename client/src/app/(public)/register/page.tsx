'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Lock, User, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound, playSuccessSound } from '@/lib/audio';

const AVATAR_PRESETS = [
  { emoji: '🦁', label: 'Sư Tử' },
  { emoji: '🐼', label: 'Gấu Trúc' },
  { emoji: '🦊', label: 'Cáo Nhỏ' },
  { emoji: '🐰', label: 'Thỏ Ngọc' },
  { emoji: '🐨', label: 'Gấu Koala' },
  { emoji: '🐯', label: 'Hổ Nhỏ' },
  { emoji: '🐸', label: 'Ếch Xanh' },
  { emoji: '🦄', label: 'Kỳ Lân' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦁');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    setError('');

    if (!username || !email || !password) {
      setError('Bé hãy điền đầy đủ các thông tin nhé!');
      return;
    }

    setLoading(true);
    try {
      const response = await api.register(username, email, password, selectedAvatar);
      playSuccessSound();
      // Auto login by setting token
      api.setToken(response.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo tài khoản rồi bé ơi.');
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

        <div className="flex flex-col items-center mb-6 relative z-10">
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-3 border-2 border-purple-200 shadow-inner transform -rotate-3 hover:rotate-0 transition-transform">
            <Sparkles className="w-8 h-8 text-yellow-400 fill-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 leading-tight">Đăng Ký</h2>
          <p className="text-xs font-semibold text-gray-500 mt-1">
            Tạo tài khoản học tập siêu dễ thương cho bé! 🐼
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-2xl border border-red-200 mb-6 text-center animate-bounce">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {/* Avatar Picker */}
          <div>
            <label className="block text-xs font-extrabold text-gray-700 mb-2">Chọn Linh Vật Đại Diện Của Bé:</label>
            <div className="grid grid-cols-4 gap-2 bg-purple-50/50 p-3 rounded-2xl border-2 border-purple-100">
              {AVATAR_PRESETS.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  onClick={() => { playClickSound(); setSelectedAvatar(item.emoji); }}
                  className={`w-12 h-12 text-2xl rounded-full bg-white flex items-center justify-center border-2 shadow-sm transition-all hover:scale-110 cursor-pointer ${
                    selectedAvatar === item.emoji
                      ? 'border-purple-500 ring-2 ring-purple-300 bg-purple-100 scale-105'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  title={item.label}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-gray-700 mb-2">Tên Của Bé (Hoặc Biệt Danh):</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="vd: Tôm, Tép, Bông..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none font-bold text-sm transition-colors shadow-inner"
                required
              />
            </div>
          </div>

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
                placeholder="Tạo mật khẩu học tập..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none font-bold text-sm transition-colors shadow-inner"
                required
              />
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
                <UserPlus className="w-5 h-5" />
                Bắt đầu học ngay! 🚀
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6 relative z-10">
          <p className="text-xs font-semibold text-gray-500">
            Bé đã có tài khoản học tập rồi?{' '}
            <Link
              href="/login"
              onClick={playClickSound}
              className="text-purple-600 hover:underline font-extrabold"
            >
              Đăng nhập tại đây 🚀
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

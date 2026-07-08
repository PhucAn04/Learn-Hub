'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles, LogIn, UserPlus, User, LogOut, Home, Brain } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Load user profile on mount & when pathname changes
  useEffect(() => {
    const fetchUser = async () => {
      const token = api.getToken();
      if (!token) {
        setCurrentUser(null);
        return;
      }
      try {
        const profile = await api.getProfile();
        setCurrentUser(profile);
      } catch (err) {
        console.error('Failed to load user profile, clearing token.', err);
        api.clearToken();
        setCurrentUser(null);
      }
    };
    fetchUser();
  }, [pathname]);

  const handleLogout = () => {
    playClickSound();
    api.clearToken();
    setCurrentUser(null);
    router.push('/');
  };

  // Hide Navbar inside active game challenges to maximize screen space
  if (pathname.startsWith('/challenge/')) {
    return null;
  }

  return (
    <nav className="w-full bg-white/70 backdrop-blur-md border-b-4 border-purple-200 sticky top-0 z-50 px-6 py-4 shadow-sm select-none">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link
          href="/"
          onClick={playClickSound}
          className="flex items-center gap-2 font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:scale-105 transition-transform duration-300"
        >
          <Sparkles className="w-6 h-6 text-yellow-400 fill-yellow-300 animate-bounce" />
          <span>LEARN-HUB 🚀</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-6 font-extrabold text-sm text-gray-700">
          <Link
            href={currentUser ? '/dashboard' : '/'}
            onClick={playClickSound}
            className={`flex items-center gap-1 px-4 py-2 rounded-full transition-all ${
              pathname === '/' || pathname === '/dashboard' ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-100'
            }`}
          >
            <Home className="w-4 h-4 text-purple-500" />
            Trang Chủ
          </Link>
        </div>

        {/* Auth / User actions */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                onClick={playClickSound}
                className={`flex items-center gap-2 bg-purple-50 border-2 border-purple-200 pl-3 pr-4 py-1.5 rounded-full hover:bg-purple-100 transition-all ${
                  pathname === '/profile' ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                <span className="text-xl bg-white w-8 h-8 rounded-full border border-purple-100 flex items-center justify-center shadow-inner">
                  {currentUser.avatar || '🐼'}
                </span>
                <span className="font-extrabold text-sm text-purple-700 hidden sm:inline">
                  {currentUser.username}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-4 py-2.5 rounded-full bg-red-100 text-red-700 font-extrabold text-xs hover:bg-red-200 border-2 border-red-200 transition shadow-sm cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Đăng Xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                onClick={playClickSound}
                className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-full bg-white text-purple-700 border-2 border-purple-300 font-extrabold text-xs hover:bg-purple-50 transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                Đăng Nhập
              </Link>
              <Link
                href="/register"
                onClick={playClickSound}
                className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-extrabold text-xs hover:from-purple-600 hover:to-pink-600 transition shadow-md border-b-4 border-purple-700 hover:border-b-2 hover:translate-y-[2px]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Đăng Ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

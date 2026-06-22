'use client';

import Link from 'next/link';
import { Sparkles, Brain, Gamepad2, Hand, Smile, Star } from 'lucide-react';
import { playClickSound } from '@/lib/audio';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-purple-50 to-pink-100 text-gray-800 font-sans pb-20 selection:bg-pink-200">
      {/* Playful Floating Background Bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
        <div className="absolute top-20 left-10 w-32 h-32 bg-yellow-200 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-48 h-48 bg-pink-200 rounded-full blur-2xl animate-bounce duration-5000"></div>
        <div className="absolute bottom-20 left-1/3 w-40 h-40 bg-blue-200 rounded-full blur-xl animate-pulse"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 relative z-10 pt-12 md:pt-20 text-center">
        {/* Kid-Friendly Floating Badge */}
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/80 border-2 border-pink-300 text-pink-600 font-extrabold text-sm md:text-base shadow-md transform hover:rotate-2 transition-transform duration-300 mb-8 cursor-pointer select-none">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-spin" />
          <span>HỌC VIỆN AI NHÍ • BÉ KHÁM PHÁ CÔNG NGHỆ</span>
        </div>

        {/* Big Bold Headline */}
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight select-none">
          Khám Phá <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500">Trí Tuệ Nhân Tạo (AI)</span> <br />
          Cực Kỳ <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.1)]">Vui Nhộn! 🎈</span>
        </h1>

        <p className="mt-4 max-w-2xl mx-auto text-lg md:text-xl font-medium text-gray-600 leading-relaxed px-4">
          Chào mừng các bạn nhỏ đến với thế giới AI! Hãy dùng chiếc camera thần kỳ để chơi đùa, đếm ngón tay, và biến hình cùng AI nhé!
        </p>

        {/* ── MAIN SECTIONS ── */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-4">
          
          {/* Card 0: Lớp Học AI */}
          <Link
            href="/concepts"
            onClick={playClickSound}
            className="group relative bg-white/80 backdrop-blur-md rounded-3xl p-8 border-4 border-yellow-300 hover:border-yellow-400 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-100 rounded-bl-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-400" />
            </div>
            <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center mb-6 border-2 border-yellow-200 shadow-inner group-hover:rotate-6 transition-transform">
              <Brain className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-yellow-700 mb-2">1. Lớp Học AI</h3>
            <p className="text-gray-600 text-sm font-semibold">
              Cùng tìm hiểu xem AI nhìn thế giới xung quanh qua camera như thế nào nhé!
            </p>
            <div className="mt-6 px-4 py-2 bg-yellow-400 text-white font-extrabold rounded-full group-hover:bg-yellow-500 shadow-md">
              HỌC NGAY 🚀
            </div>
          </Link>

          {/* Card 1: Thử Thách Đếm Ngón Tay */}
          <Link
            href="/challenge/fingers"
            onClick={playClickSound}
            className="group relative bg-white/80 backdrop-blur-md rounded-3xl p-8 border-4 border-blue-300 hover:border-blue-400 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-bl-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-6 h-6 text-blue-500 fill-blue-400" />
            </div>
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 border-2 border-blue-200 shadow-inner group-hover:rotate-6 transition-transform">
              <Hand className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-blue-700 mb-2">2. Đếm Ngón Tay</h3>
            <p className="text-gray-600 text-sm font-semibold">
              Giơ ngón tay trước camera và xem AI thông minh đếm số ngón tay siêu nhanh nhé!
            </p>
            <div className="mt-6 px-4 py-2 bg-blue-500 text-white font-extrabold rounded-full group-hover:bg-blue-600 shadow-md">
              BẮT ĐẦU ✋
            </div>
          </Link>

          {/* Card 2: Ảo Thuật Cử Chỉ */}
          <Link
            href="/challenge/gestures"
            onClick={playClickSound}
            className="group relative bg-white/80 backdrop-blur-md rounded-3xl p-8 border-4 border-pink-300 hover:border-pink-400 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-pink-100 rounded-bl-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-6 h-6 text-pink-500 fill-pink-400" />
            </div>
            <div className="w-20 h-20 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mb-6 border-2 border-pink-200 shadow-inner group-hover:rotate-6 transition-transform">
              <Gamepad2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-pink-700 mb-2">3. Ảo Thuật Tay</h3>
            <p className="text-gray-600 text-sm font-semibold">
              Bé tạo các dáng tay như: Thumbs Up 👍, Peace ✌️ để mở khóa các sticker thần kỳ!
            </p>
            <div className="mt-6 px-4 py-2 bg-pink-500 text-white font-extrabold rounded-full group-hover:bg-pink-600 shadow-md">
              CHƠI NÀO ✨
            </div>
          </Link>

          {/* Card 3: Thám Tử Khuôn Mặt */}
          <Link
            href="/challenge/face"
            onClick={playClickSound}
            className="group relative bg-white/80 backdrop-blur-md rounded-3xl p-8 border-4 border-emerald-300 hover:border-emerald-400 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-bl-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-6 h-6 text-emerald-500 fill-emerald-400" />
            </div>
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 border-2 border-emerald-200 shadow-inner group-hover:rotate-6 transition-transform">
              <Smile className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-emerald-700 mb-2">4. Thám Tử Mặt</h3>
            <p className="text-gray-600 text-sm font-semibold">
              AI sẽ đeo kính mát, vương miện cho bé và đếm xem có bao nhiêu bạn trong camera!
            </p>
            <div className="mt-6 px-4 py-2 bg-emerald-500 text-white font-extrabold rounded-full group-hover:bg-emerald-600 shadow-md">
              THỬ SỨC 🕵️‍♂️
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}

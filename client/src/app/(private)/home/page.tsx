'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight, Brain, Camera } from 'lucide-react';
import { playClickSound } from '@/lib/audio';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-yellow-200">
      
      {/* ── HERO SECTION: AI LÀ GÌ? ── */}
      <section className="relative pt-20 pb-16 px-4 bg-gradient-to-b from-sky-100 to-[#f8fafc] overflow-hidden text-center">
        <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-300 rounded-full blur-xl opacity-60 animate-pulse" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-pink-300 rounded-full blur-2xl opacity-40" />
        
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/80 border-2 border-pink-300 text-pink-600 font-extrabold text-sm md:text-base shadow-md transform hover:rotate-2 transition-transform duration-300 mb-8 cursor-pointer select-none">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-spin" />
          <span>HỌC VIỆN AI NHÍ • BÉ KHÁM PHÁ CÔNG NGHỆ</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-800 tracking-tight">
          Trí Tuệ Nhân Tạo (AI) <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            Là Gì Nhỉ?
          </span> 🤔
        </h1>
        
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 font-medium leading-relaxed mb-12">
          AI giống như một bạn Robot vô hình cực kỳ thông minh sống trong máy tính. Bạn ấy có thể học vẽ tranh, tự lái xe, trò chuyện và giúp đỡ con người làm rất nhiều việc đó!
        </p>

        <div className="flex flex-col md:flex-row gap-6 justify-center items-center max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-100 flex-1 text-left relative overflow-hidden group">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Camera className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI nhìn thế nào?</h3>
            <p className="text-slate-600">Bé nhìn bằng đôi mắt xinh xắn, còn AI nhìn bằng chiếc Camera của máy tính! Cứ mở Camera là AI thấy bé ngay.</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-100 flex-1 text-left relative overflow-hidden group">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI học ra sao?</h3>
            <p className="text-slate-600">AI không tự nhiên thông minh đâu. Chúng ta phải dạy AI bằng cách cho xem thật nhiều ví dụ thì bạn ấy mới giỏi được!</p>
          </div>
        </div>
      </section>

      {/* ── STORY SECTION ── */}
      <section className="py-16 px-4 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black mb-4">Cùng Bé Dạy Trí Tuệ Nhân Tạo 🚀</h2>
          <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto">
            Hôm nay, bé hãy trở thành một người thầy giáo tí hon để hướng dẫn bạn AI nhận biết thế giới nhé. Chọn một câu chuyện dưới đây để bắt đầu nào!
          </p>
        </div>

        <div className="space-y-8">
          {/* STORY 1: Fingers */}
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border-4 border-blue-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden hover:border-blue-300 transition-colors">
            <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 bg-blue-50 rounded-full flex items-center justify-center border-4 border-white shadow-inner z-10">
              <span className="text-7xl">🖐️</span>
            </div>
            <div className="flex-1 text-center md:text-left z-10">
              <div className="inline-block px-4 py-1.5 bg-blue-100 text-blue-800 font-bold rounded-xl text-sm mb-3">
                Khám phá: Phân biệt ảnh đơn giản (Image Classification)
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">
                Chương 1: Câu Chuyện Đếm Ngón Tay
              </h3>
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                Bạn AI của chúng ta đang học đếm, nhưng trí nhớ bạn ấy hơi "cá vàng" một chút! Bé hãy dùng camera làm mắt cho AI, giơ tay lên để dạy bạn ấy biết đâu là 1 ngón, đâu là 2 ngón nhé. Khi AI học xong, chúng ta sẽ có một trò đếm số siêu nhanh đấy!
              </p>
              <Link
                href="/concepts/fingers"
                onClick={playClickSound}
                className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
              >
                Khám Phá Ngay <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-bl from-blue-100 to-transparent rounded-bl-full opacity-50 pointer-events-none" />
          </div>

          {/* STORY 2: Gestures */}
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border-4 border-pink-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden hover:border-pink-300 transition-colors">
            <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 bg-pink-50 rounded-full flex items-center justify-center border-4 border-white shadow-inner z-10 md:order-last">
              <span className="text-7xl">✌️</span>
            </div>
            <div className="flex-1 text-center md:text-right z-10">
              <div className="inline-block px-4 py-1.5 bg-pink-100 text-pink-800 font-bold rounded-xl text-sm mb-3">
                Khám phá: Nhận diện cử chỉ (Gesture Recognition)
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">
                Chương 2: Ngôn Ngữ Ký Hiệu Bí Mật
              </h3>
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                Bàn tay của bé không chỉ để cầm nắm, mà còn có thể làm phép thuật nữa cơ! Máy tính có thể "hiểu" được bé đang làm dấu Thích (👍) hay Chiến Thắng (✌️). Bé hãy làm ảo thuật gia, dạy cho AI những mật mã thú vị này nhé!
              </p>
              <Link
                href="/concepts/gestures"
                onClick={playClickSound}
                className="inline-flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-pink-500/30"
              >
                Khám Phá Ngay <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="absolute left-0 top-0 w-64 h-64 bg-gradient-to-br from-pink-100 to-transparent rounded-br-full opacity-50 pointer-events-none" />
          </div>

          {/* STORY 3: Emotions */}
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border-4 border-emerald-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden hover:border-emerald-300 transition-colors">
            <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 bg-emerald-50 rounded-full flex items-center justify-center border-4 border-white shadow-inner z-10">
              <span className="text-7xl">🥰</span>
            </div>
            <div className="flex-1 text-center md:text-left z-10">
              <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-sm mb-3">
                Khám phá: Nhận diện cảm xúc (Emotion Recognition)
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">
                Chương 3: Thám Tử Đọc Cảm Xúc
              </h3>
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                Hôm nay bé vui hay buồn? Mắt thường nhìn là biết ngay, nhưng AI thì cần phải học cách làm thám tử! Bằng cách đo đạc các điểm trên khuôn mặt, AI sẽ phân tích nụ cười rạng rỡ hay cái mếu máo của bé. Hãy biến hóa thật nhiều biểu cảm nào!
              </p>
              <Link
                href="/concepts/emotions"
                onClick={playClickSound}
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/30"
              >
                Khám Phá Ngay <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-tl from-emerald-100 to-transparent rounded-tl-full opacity-50 pointer-events-none" />
          </div>
          {/* STORY 4: Body Exercises */}
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border-4 border-amber-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden hover:border-amber-300 transition-colors">
            <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 bg-amber-50 rounded-full flex items-center justify-center border-4 border-white shadow-inner z-10 md:order-last">
              <span className="text-7xl">🤸</span>
            </div>
            <div className="flex-1 text-center md:text-right z-10">
              <div className="inline-block px-4 py-1.5 bg-amber-100 text-amber-800 font-bold rounded-xl text-sm mb-3">
                Khám phá: Nhận diện tư thế (Body Pose Detection)
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">
                Chương 4: Bé Tập Thể Dục Cùng AI
              </h3>
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                Máy tính không chỉ nhìn được khuôn mặt hay bàn tay, mà còn có thể nhìn thấy toàn bộ cơ thể của bé chuyển động như thế nào! Hôm nay, hãy cùng AI khởi động ngày mới bằng một bài tập thể dục vươn vai thật khỏe khoắn nhé!
              </p>
              <Link
                href="/concepts/body-exercises"
                onClick={playClickSound}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/30"
              >
                Khám Phá Ngay <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="absolute left-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-amber-100 to-transparent rounded-tr-full opacity-50 pointer-events-none" />
          </div>

          {/* STORY 5: Free Label Classification */}
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border-4 border-teal-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden hover:border-teal-300 transition-colors">
            <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 bg-teal-50 rounded-full flex items-center justify-center border-4 border-white shadow-inner z-10">
              <span className="text-7xl">🧪</span>
            </div>
            <div className="flex-1 text-center md:text-left z-10">
              <div className="inline-block px-4 py-1.5 bg-teal-100 text-teal-800 font-bold rounded-xl text-sm mb-3">
                Khám phá: Phân loại ảnh bằng Transfer Learning
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">
                Chương 5: Nhà Khoa Học Ảnh Nhí
              </h3>
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                Bé đã biết dạy AI nhận biết bàn tay và khuôn mặt rồi, giờ hãy thử thách AI với bất cứ thứ gì! Chó hay mèo? Táo hay lê? Bé hãy chụp ảnh và dạy AI phân biệt mọi thứ xung quanh nhé. Công nghệ Transfer Learning sẽ giúp AI học nhanh lắm đấy!
              </p>
              <Link
                href="/concepts/free-label"
                onClick={playClickSound}
                className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-teal-500/30"
              >
                Khám Phá Ngay <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-tl from-teal-100 to-transparent rounded-tl-full opacity-50 pointer-events-none" />
          </div>
        </div>
        
      </section>
    </div>
  );
}

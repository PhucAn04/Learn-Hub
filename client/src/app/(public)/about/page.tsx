'use client';

import { Sparkles, Brain, Camera, Gamepad2, Rocket, Smile, Info } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-white shadow-lg mb-4">
            <span className="text-6xl">🤖</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 uppercase">
            AI Exploration Website for Primary School Students
          </h1>
          <p className="text-xl text-gray-600 font-bold max-w-2xl mx-auto">
            Website Khám Phá Trí Tuệ Nhân Tạo Cho Học Sinh Tiểu Học
          </p>
        </div>

        {/* Intro */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-indigo-100 transform hover:-translate-y-1 transition-transform">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">AI Exploration Website for Primary School Students là gì?</h2>
          </div>
          <p className="text-gray-700 font-medium leading-relaxed text-lg">
            Đây là một nền tảng học tập trực tuyến, được thiết kế đặc biệt để giúp các bạn học sinh tiểu học làm quen với <strong>Trí Tuệ Nhân Tạo (AI)</strong> và <strong>Học Máy (Machine Learning)</strong>. Tại đây, AI không còn là những lý thuyết phức tạp, mà là những mô hình học máy sinh động, có thể nhận diện hình ảnh và hành động của các bạn nhỏ ngay trên trình duyệt web.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-gray-800">Hành trình khám phá AI</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-pink-100 hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 mb-4">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">1. Thu thập dữ liệu</h3>
              <p className="text-gray-600 font-medium">
                Sử dụng camera để tạo ra những dữ liệu của riêng bạn, dạy cho máy tính cách nhận biết các hình ảnh và hành động.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-purple-100 hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">2. Huấn luyện AI</h3>
              <p className="text-gray-600 font-medium">
                Quan sát quá trình máy tính học hỏi từ dữ liệu của bạn để nhận diện và phân loại một cách thông minh.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-yellow-100 hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600 mb-4">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">3. Ứng dụng & Trải nghiệm</h3>
              <p className="text-gray-600 font-medium">
                Sử dụng chính mô hình AI bạn vừa tạo ra để trải nghiệm, đánh giá và ứng dụng vào các hoạt động thú vị!
              </p>
            </div>
          </div>
        </div>

        {/* Goal */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-cyan-100 transform hover:-translate-y-1 transition-transform">
           <div className="flex items-center gap-4 mb-4">
             <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600">
               <Smile className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-bold text-gray-800">Mục tiêu phát triển</h2>
           </div>
           <p className="text-gray-700 font-medium leading-relaxed text-lg">
             Website được xây dựng với mong muốn mang lại một không gian thực hành AI an toàn, khép kín và trực quan. Bằng cách biến việc học thành những trải nghiệm tự tay khám phá, mục tiêu là khơi dậy niềm đam mê khoa học, công nghệ và nuôi dưỡng tư duy sáng tạo cho thế hệ tương lai.
           </p>
        </div>

        {/* Call to action */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4 flex-wrap">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black text-lg hover:shadow-lg hover:scale-105 transition-all"
          >
            <Rocket className="w-6 h-6" />
            Bắt Đầu Ngay
          </Link>
          <Link
            href="/author"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white text-indigo-600 border-2 border-indigo-200 font-black text-lg hover:bg-indigo-50 hover:scale-105 transition-all shadow-sm"
          >
            <Info className="w-6 h-6" />
            Về Tác Giả & Đồ Án
          </Link>
        </div>
      </div>
    </div>
  );
}

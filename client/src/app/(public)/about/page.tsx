'use client';

import { GraduationCap, Heart, BookOpen, Cpu, Lightbulb, Target } from 'lucide-react';
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

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Author Card */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-indigo-100 transform hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Tác Giả</h2>
                <p className="text-indigo-600 font-semibold">Sinh viên thực hiện</p>
              </div>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <p className="flex items-center gap-3">
                <span className="font-bold w-24">Họ và tên:</span>
                <span className="text-lg">Phạm Nguyễn Phúc Ân</span>
              </p>
              <p className="flex items-center gap-3">
                <span className="font-bold w-24">MSSV:</span>
                <span className="bg-gray-100 px-3 py-1 rounded-lg font-mono">2200004202</span>
              </p>
              <p className="flex items-center gap-3">
                <span className="font-bold w-24">Trường:</span>
                <span>Đại học Nguyễn Tất Thành (NIIE)</span>
              </p>
              <p className="flex items-center gap-3">
                <span className="font-bold w-24">Ngành:</span>
                <span>Công nghệ thông tin</span>
              </p>
              <p className="flex items-center gap-3">
                <span className="font-bold w-24">Năm:</span>
                <span>2026</span>
              </p>
            </div>
          </div>

          {/* Project Details Card */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-pink-100 transform hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-600">
                <Cpu className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Thông Tin Đồ Án</h2>
                <p className="text-pink-600 font-semibold">Khóa luận tốt nghiệp</p>
              </div>
            </div>

            <div className="space-y-4 text-gray-700">
              <p className="flex gap-3">
                <span className="font-bold min-w-max">GV Hướng dẫn:</span>
                <span className="text-lg font-semibold text-gray-800">ThS. Phan Thị Nam Anh</span>
              </p>
              <div className="pt-2">
                <p className="font-bold flex items-center gap-2 mb-2"><Target className="w-5 h-5 text-pink-500" /> Mục tiêu dự án:</p>
                <p className="text-gray-600 font-medium leading-relaxed bg-pink-50 p-4 rounded-xl">
                  Xây dựng một hệ thống web học tập giúp học sinh tiểu học tiếp cận và thực hành quy trình học máy (Machine Learning) trực tiếp trên trình duyệt một cách trực quan và sinh động.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rationale and Inspiration */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-yellow-100">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600">
                <Lightbulb className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-bold text-gray-800">Lý Do Chọn Đề Tài & Ý Tưởng</h2>
          </div>
          <div className="space-y-4 text-gray-700 font-medium leading-relaxed">
            <p>
              Thực tế hiện nay cho thấy học sinh tiểu học được tiếp xúc từ rất sớm với các thiết bị thông minh và phần mềm tích hợp Trí tuệ Nhân tạo (AI). Tuy nhiên, các em hầu hết chỉ dừng lại ở mức độ hưởng thụ của người dùng cuối. Các tài liệu giáo dục AI hiện tại lại thường đi quá sâu vào thuật toán phức tạp và lý thuyết khô khan, không phù hợp với nhận thức của lứa tuổi tiểu học.
            </p>
            <p className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              Tham khảo một số công nghệ như Teachable Machine, dự án ra đời với mong muốn mang lại một không gian thực hành AI khép kín, trực quan và tính tương tác cao ngay trên trình duyệt. Thay vì chỉ chơi các game AI có sẵn, học sinh sẽ được tự tay trải nghiệm quy trình thu thập dữ liệu qua camera, quan sát máy tính phân tích, và ứng dụng chính mô hình các em vừa huấn luyện vào các trò chơi tương tác.
            </p>
          </div>
        </div>

        {/* Acknowledgments */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-purple-100 text-center">
          <Heart className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Lời Cảm Ơn</h2>
          <p className="text-gray-600 leading-relaxed max-w-3xl mx-auto italic font-medium">
            &quot;Em xin gửi lời cảm ơn chân thành nhất đến ThS. Phan Thị Nam Anh đã tận tình hướng dẫn, chỉ bảo và tạo điều kiện tốt nhất để em hoàn thành đồ án này. Em cũng xin cảm ơn quý Thầy Cô khoa CNTT trường ĐH Nguyễn Tất Thành đã truyền đạt những kiến thức quý báu trong suốt quá trình học tập. Cuối cùng, xin cảm ơn gia đình và bạn bè đã luôn động viên, đồng hành cùng em.&quot;
          </p>
        </div>
        
        {/* Call to action */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black text-lg hover:shadow-lg hover:scale-105 transition-all"
          >
            <BookOpen className="w-6 h-6" />
            Khám Phá
          </Link>

          <Link
            href="/tech-stack"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white text-indigo-600 border-2 border-indigo-200 font-black text-lg hover:bg-indigo-50 hover:scale-105 transition-all shadow-sm"
          >
            <Cpu className="w-6 h-6" />
            Công Nghệ
          </Link>

          <Link
            href="/user-guide"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white text-cyan-600 border-2 border-cyan-200 font-black text-lg hover:bg-cyan-50 hover:scale-105 transition-all shadow-sm"
          >
            <BookOpen className="w-6 h-6" />
            Hướng Dẫn Sử Dụng
          </Link>
        </div>
      </div>
    </div>
  );
}

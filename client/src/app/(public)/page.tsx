'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const SLIDES = [
  {
    id: 0,
    title: 'Trí Tuệ Nhân Tạo (AI) là gì nhỉ? 🤔',
    content: 'AI (viết tắt của Artificial Intelligence) giống như một bạn Robot vô hình cực kỳ thông minh sống trong máy tính. Bạn ấy có thể học vẽ tranh, tự lái xe, trò chuyện và giúp đỡ con người làm rất nhiều việc đó!',
    image: '🤖',
    voice: 'Trí Tuệ Nhân Tạo giống như một bạn Robot vô hình cực kỳ thông minh sống trong máy tính. Bạn ấy có thể học vẽ tranh, tự lái xe và giúp đỡ con người làm rất nhiều việc đó!',
    color: 'from-amber-400 to-orange-500',
    borderColor: 'border-yellow-400',
  },
  {
    id: 1,
    title: 'AI nhìn thế giới như thế nào? 📷',
    content: 'Bé nhìn bằng đôi mắt xinh xắn, còn bạn AI thì nhìn bằng chiếc Camera (máy ảnh) của máy tính đấy! AI sẽ phân tích hình ảnh nhận được từ camera để nhận biết bạn đang vui hay buồn, hoặc đếm xem bé đang giơ mấy ngón tay!',
    image: '👁️‍🗨️',
    voice: 'Bé nhìn bằng đôi mắt xinh xắn, còn bạn AI thì nhìn bằng chiếc Camera của máy tính đấy! AI sẽ phân tích hình ảnh để nhận biết bé đang vui hay buồn, hoặc đếm ngón tay!',
    color: 'from-blue-400 to-indigo-500',
    borderColor: 'border-blue-400',
  },
  {
    id: 2,
    title: 'AI học hỏi bằng cách nào? 📚',
    content: 'AI không tự nhiên thông minh đâu! Chúng ta dạy AI bằng cách cho xem thật nhiều hình ảnh hoặc ví dụ. Ví dụ, cho AI xem hàng ngàn bức ảnh chú mèo dễ thương, AI sẽ tự học được cách nhận biết đâu là chú mèo thật!',
    image: '🧠',
    voice: 'AI không tự nhiên thông minh đâu! Chúng ta dạy AI bằng cách cho xem thật nhiều ví dụ. Ví dụ như xem hàng ngàn bức ảnh chú mèo để AI học được cách nhận diện chú mèo thật!',
    color: 'from-purple-400 to-pink-500',
    borderColor: 'border-purple-400',
  },
];

export default function ConceptsPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState<number | null>(null);

  const handleNext = () => {
    if (currentStep < SLIDES.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setQuizAnswered(null);
    }
  };

  const handleAnswer = (index: number) => {
    if (quizAnswered !== null) return;
    setQuizAnswered(index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-purple-50 to-pink-100 py-12 px-4 select-none">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center mt-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 tracking-tight uppercase leading-tight">
            AI EXPLORATION WEBSITE <br className="hidden md:block" /> FOR PRIMARY SCHOOL STUDENTS
          </h1>
          <p className="text-lg text-slate-500 font-bold mt-3">Hành trình phiêu lưu khám phá Trí tuệ Nhân tạo dành cho các bé! 🌟</p>
        </div>

        {/* ── SLIDES ── */}
        {currentStep < SLIDES.length ? (
          <div className={`bg-white rounded-3xl p-8 md:p-10 border-4 ${SLIDES[currentStep].borderColor} shadow-2xl transition-all duration-500`}>
            {/* Visual Icon Box */}
            <div className="flex justify-center mb-8">
              <div className={`w-28 h-28 bg-gradient-to-tr ${SLIDES[currentStep].color} text-white rounded-3xl flex items-center justify-center text-6xl shadow-lg transform rotate-3 hover:rotate-0 transition-all duration-300`}>
                {SLIDES[currentStep].image}
              </div>
            </div>

            {/* Slide Title */}
            <h2 className="text-2xl md:text-3xl font-black text-gray-800 text-center mb-6 flex items-center justify-center gap-2">
              {SLIDES[currentStep].title}
            </h2>

            {/* Slide Description */}
            <p className="text-gray-600 text-lg md:text-xl font-medium leading-relaxed text-center px-4 bg-gray-50/50 py-6 rounded-2xl border border-gray-100">
              {SLIDES[currentStep].content}
            </p>

            {/* Navigation Indicators */}
            <div className="flex justify-center gap-2 mt-8">
              {SLIDES.map((slide, idx) => (
                <div
                  key={idx}
                  className={`h-3 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-10 bg-yellow-500' : 'w-3 bg-gray-300'}`}
                />
              ))}
              <div className={`h-3 w-3 rounded-full bg-gray-300 ${currentStep === SLIDES.length ? 'bg-yellow-500' : ''}`} />
            </div>
          </div>
        ) : (
          /* ── QUIZ SECTION ── */
          <div className="bg-white rounded-3xl p-8 md:p-10 border-4 border-pink-400 shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-5xl shadow-md">
                ❓
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-gray-800 text-center mb-8">
              Câu hỏi thử thách tài năng! 🌟
            </h2>

            <p className="text-gray-700 text-lg font-bold text-center mb-8 bg-pink-50 p-4 rounded-xl border border-pink-100">
              AI dùng bộ phận nào để quan sát thế giới xung quanh?
            </p>

            {/* Options */}
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: 'A. Bàn phím máy tính ⌨️', isCorrect: false },
                { label: 'B. Chiếc Camera (máy ảnh) 📷', isCorrect: true },
                { label: 'C. Chuột máy tính 🖱️', isCorrect: false },
              ].map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className={`w-full text-left px-6 py-4 rounded-2xl text-lg font-extrabold border-2 transition-all duration-200 ${
                    quizAnswered === null
                      ? 'border-gray-200 hover:border-pink-300 hover:bg-pink-50'
                      : opt.isCorrect
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : quizAnswered === idx
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{opt.label}</span>
                    {quizAnswered !== null && opt.isCorrect && (
                      <span className="text-green-600 text-xl">✅ Chính xác!</span>
                    )}
                    {quizAnswered === idx && !opt.isCorrect && (
                      <span className="text-red-600 text-xl">❌ Chưa đúng</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Answer feedback message */}
            {quizAnswered !== null && (
              <div className="mt-8 text-center animate-bounce">
                {quizAnswered === 1 ? (
                  <div className="text-green-600 font-extrabold text-xl">
                    🎉 Chúc mừng bé đã xuất sắc hoàn thành bài học mở đầu!<br/>
                    <span className="text-base text-gray-600 mt-3 block font-bold">Để khám phá nhiều hơn, bé hãy đăng nhập hoặc đăng ký vào hệ thống vừa học vừa chơi này nhé! 🚀</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setQuizAnswered(null)}
                    className="px-6 py-3 bg-pink-500 text-white rounded-full font-black hover:bg-pink-600 shadow-md transition"
                  >
                    Thử lại câu hỏi 🔄
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step controls */}
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-6 py-3 rounded-full bg-white border-2 border-gray-300 font-extrabold text-gray-700 hover:bg-gray-50 transition shadow-md disabled:opacity-40 disabled:pointer-events-none"
          >
            Quay Lại
          </button>

          {currentStep < SLIDES.length ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-500 text-white font-extrabold hover:bg-blue-600 transition shadow-md"
            >
              Tiếp Tục
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : quizAnswered === 1 ? (
            <div className="flex gap-4">
              <Link
                href="/login"
                className="flex items-center gap-2 px-8 py-4 rounded-full bg-blue-500 text-white font-black text-lg hover:bg-blue-600 hover:scale-105 transition-all shadow-lg"
              >
                Đăng Nhập
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-2 px-8 py-4 rounded-full bg-pink-500 text-white font-black text-lg hover:bg-pink-600 hover:scale-105 transition-all shadow-lg animate-pulse"
              >
                Đăng Ký
                <ArrowRight className="w-6 h-6" />
              </Link>
            </div>
          ) : (
            <div className="w-32" />
          )}
        </div>
      </div>
    </div>
  );
}

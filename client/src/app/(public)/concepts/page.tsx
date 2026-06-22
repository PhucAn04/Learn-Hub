'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Star, Volume2 } from 'lucide-react';

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
  const [quizScore, setQuizScore] = useState(0);
  const speakVietnamese = (_text: string) => {
    void _text;
  };

  /*
    if (currentStep < SLIDES.length) {
      speakVietnamese(SLIDES[currentStep].voice);
    } else if (currentStep === SLIDES.length) {
      speakVietnamese('Bây giờ chúng ta cùng làm một câu đố nhỏ nhé! AI dùng bộ phận nào để quan sát thế giới xung quanh?');
    }
  */

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
    if (index === 1) { // Option B is correct
      setQuizScore(1);
      speakVietnamese('Hoàn toàn chính xác! Bé giỏi quá! Ting tinh!');
    } else {
      speakVietnamese('Ồ! Chưa đúng rồi, bé hãy thử lại xem sao nhé!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-purple-50 to-pink-100 py-12 px-4 select-none">
      <div className="max-w-3xl mx-auto">
        {/* Header navigation */}
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 border-yellow-300 font-extrabold text-yellow-700 hover:bg-yellow-50 transition shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            Trang Chủ
          </Link>
          <div className="flex items-center gap-1 bg-yellow-200 border-2 border-yellow-400 px-4 py-2 rounded-full font-black text-yellow-800">
            <Star className="w-5 h-5 text-yellow-600 fill-yellow-500 animate-spin" />
            <span>ĐIỂM: {quizScore * 10}</span>
          </div>
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
              <button
                onClick={() => speakVietnamese(SLIDES[currentStep].voice)}
                className="p-2 hover:bg-gray-100 rounded-full text-blue-500 transition-colors"
                title="Nghe lại"
              >
                <Volume2 className="w-6 h-6 animate-bounce" />
              </button>
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
                  <p className="text-green-600 font-extrabold text-xl">🎉 Chúc mừng bé! Bé đã xuất sắc hoàn thành bài học!</p>
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
            <Link
              href="/challenge/fingers"
              className="flex items-center gap-2 px-8 py-4 rounded-full bg-green-500 text-white font-black text-lg hover:bg-green-600 hover:scale-105 transition-all shadow-lg animate-pulse"
            >
              Vào Game Đếm Ngón Tay! ✋
              <ArrowRight className="w-6 h-6" />
            </Link>
          ) : (
            <div className="w-32" />
          )}
        </div>
      </div>
    </div>
  );
}

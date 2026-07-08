'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { playClickSound, playSuccessSound } from '@/lib/audio';

const CONCEPTS_DATA = {
  fingers: {
    slides: [
      {
        title: 'Phân Biệt Ảnh Đơn Giản (Image Classification)',
        content: 'Bé có biết AI học nhận biết hình ảnh giống như em bé học chữ không? Chúng ta cần cho AI xem thật nhiều ảnh bàn tay. AI sẽ tự động tìm ra đặc điểm chung của 1 ngón tay và 2 ngón tay. Việc phân nhóm các hình ảnh này gọi là "Phân Biệt Ảnh Đơn Giản" đấy!',
        image: '🖐️',
        color: 'from-blue-400 to-cyan-500',
        borderColor: 'border-blue-400',
      },
    ],
    quiz: {
      question: 'Theo bé, AI cần bao nhiêu hình ảnh để học thuộc 1 ngón tay?',
      options: ['Chỉ 1 hình ảnh là đủ', 'Thật nhiều hình ảnh'],
      correct: 1,
      successMsg: 'Hoàn toàn chính xác! AI cần xem thật nhiều ảnh để học.',
      failMsg: 'Chưa đúng rồi, bé hãy nghĩ lại xem AI có giống bạn nhỏ cần ôn bài nhiều lần không?',
      nextUrl: '/challenge/teach',
      btnText: 'Vào Sandbox Dạy Đếm',
    }
  },
  gestures: {
    slides: [
      {
        title: 'Nhận Diện Cử Chỉ (Gesture Recognition)',
        content: 'Thay vì dùng chuột hay bàn phím, bé hoàn toàn có thể ra lệnh cho máy tính bằng cử chỉ tay! AI sẽ xác định bộ khung xương bàn tay của bé qua camera để xem các ngón tay đang gập hay duỗi. Kỹ thuật đọc ngôn ngữ cơ thể này gọi là "Nhận Diện Cử Chỉ".',
        image: '✌️',
        color: 'from-pink-400 to-rose-500',
        borderColor: 'border-pink-400',
      },
    ],
    quiz: {
      question: 'Bộ phận nào giúp AI nhìn thấy tay bé làm ảo thuật?',
      options: ['Màn hình máy tính', 'Camera (Máy ảnh)'],
      correct: 1,
      successMsg: 'Đúng rồi! Cứ mở Camera là AI thấy bé ngay.',
      failMsg: 'Ồ không phải đâu, màn hình chỉ để bé nhìn thôi. Bạn AI nhìn bằng gì nhỉ?',
      nextUrl: '/challenge/teach-gestures',
      btnText: 'Vào Sandbox Ảo Thuật',
    }
  },
  emotions: {
    slides: [
      {
        title: 'Nhận Diện Cảm Xúc (Emotion Recognition)',
        content: 'Mỗi khi bé cười, khoé miệng sẽ cong lên, mắt sẽ híp lại. AI sẽ dùng một tấm lưới tàng hình đắp lên mặt bé để đo đạc sự di chuyển của các điểm này! Kỹ thuật phân tích khuôn mặt để biết buồn vui được gọi là "Nhận Diện Cảm Xúc".',
        image: '🥰',
        color: 'from-emerald-400 to-teal-500',
        borderColor: 'border-emerald-400',
      },
    ],
    quiz: {
      question: 'Khi bé cười, AI sẽ chú ý đến sự thay đổi của bộ phận nào nhất?',
      options: ['Đôi tai', 'Đôi môi (Miệng)'],
      correct: 1,
      successMsg: 'Chính xác! Đôi môi của bé sẽ cong lên rất tươi khi cười.',
      failMsg: 'Khi cười đôi tai đâu có thay đổi mấy đâu nhỉ? Bé đoán lại xem!',
      nextUrl: '/challenge/teach-face',
      btnText: 'Vào Sandbox Cảm Xúc',
    }
  }
};

export default function ConceptSlugPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const data = CONCEPTS_DATA[slug as keyof typeof CONCEPTS_DATA];
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Không tìm thấy bài học!</h1>
        <Link href="/dashboard" className="text-blue-500 underline">Quay lại trang chủ</Link>
      </div>
    );
  }

  const isQuizStep = currentStep === data.slides.length;
  const currentSlide = !isQuizStep ? data.slides[currentStep] : null;

  const handleNext = () => {
    playClickSound();
    if (currentStep <= data.slides.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    playClickSound();
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setSelectedOption(null);
      setIsCorrect(null);
    }
  };

  const handleSelectOption = (idx: number, correctIdx: number) => {
    if (isCorrect) return; // lock if already correct
    setSelectedOption(idx);
    const correct = idx === correctIdx;
    setIsCorrect(correct);
    if (correct) {
      playSuccessSound();
    } else {
      playClickSound();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-purple-50 to-pink-100 py-12 px-4 select-none">
      <div className="max-w-3xl mx-auto">
        {/* Header navigation */}
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/dashboard"
            onClick={playClickSound}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 border-yellow-300 font-extrabold text-yellow-700 hover:bg-yellow-50 transition shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            Trang Chủ
          </Link>
          <div className="flex items-center gap-1 bg-yellow-200 border-2 border-yellow-400 px-4 py-2 rounded-full font-black text-yellow-800">
            <span>📖 Lớp Học AI</span>
          </div>
        </div>

        {/* Content Box */}
        <div className={`bg-white rounded-3xl p-8 md:p-10 border-4 ${currentSlide ? currentSlide.borderColor : 'border-yellow-400'} shadow-2xl transition-all duration-500 min-h-[400px] flex flex-col`}>
          
          {/* SLIDE */}
          {!isQuizStep && currentSlide && (
            <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-center mb-8">
                <div className={`w-28 h-28 bg-gradient-to-tr ${currentSlide.color} text-white rounded-3xl flex items-center justify-center text-6xl shadow-lg transform rotate-3 transition-all duration-300`}>
                  {currentSlide.image}
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-center text-gray-800 mb-6 px-4">
                {currentSlide.title}
              </h2>
              <p className="text-lg md:text-xl text-gray-600 font-medium text-center leading-relaxed">
                {currentSlide.content}
              </p>
            </div>
          )}

          {/* QUIZ STEP */}
          {isQuizStep && (
            <div className="flex-1 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center mb-8">
                <div className="inline-block px-4 py-1 bg-yellow-100 text-yellow-800 font-bold rounded-full mb-4 border border-yellow-300">
                  Câu Đố 🧠
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-6">
                  {data.quiz.question}
                </h2>
              </div>
              
              <div className="space-y-4 max-w-lg mx-auto">
                {data.quiz.options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrectAnswer = idx === data.quiz.correct;
                  
                  let btnClass = "w-full text-left px-6 py-4 rounded-2xl border-2 font-bold text-lg transition-all ";
                  if (isSelected && isCorrectAnswer) {
                    btnClass += "bg-green-100 border-green-500 text-green-700 shadow-inner";
                  } else if (isSelected && !isCorrectAnswer) {
                    btnClass += "bg-red-50 border-red-300 text-red-600 opacity-80";
                  } else if (isCorrect && !isSelected) {
                    btnClass += "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
                  } else {
                    btnClass += "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx, data.quiz.correct)}
                      disabled={isCorrect === true}
                      className={btnClass}
                    >
                      <div className="flex justify-between items-center">
                        <span>{option}</span>
                        {isSelected && isCorrectAnswer && <CheckCircle className="w-6 h-6 text-green-600" />}
                        {isSelected && !isCorrectAnswer && <XCircle className="w-6 h-6 text-red-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedOption !== null && (
                <div className={`mt-6 p-4 rounded-2xl max-w-lg mx-auto text-center ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-600'} font-bold animate-in fade-in slide-in-from-bottom-2`}>
                  {isCorrect ? data.quiz.successMsg : data.quiz.failMsg}
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="mt-8 flex justify-between items-center pt-6 border-t-2 border-gray-100">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`p-3 rounded-full font-bold flex items-center justify-center transition-all ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              }`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            
            {/* Progress indicators */}
            <div className="flex gap-2">
              {data.slides.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${currentStep === idx ? 'bg-yellow-400 scale-125' : 'bg-gray-200'}`} 
                />
              ))}
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isQuizStep ? 'bg-yellow-400 scale-125' : 'bg-gray-200'}`} />
            </div>

            {isQuizStep && isCorrect ? (
              <Link
                href={data.quiz.nextUrl}
                onClick={playClickSound}
                className="bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 text-white px-6 py-3 rounded-full font-black shadow-lg shadow-green-500/30 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 animate-in zoom-in"
              >
                {data.quiz.btnText} <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <button
                onClick={handleNext}
                disabled={isQuizStep}
                className={`p-3 rounded-full font-bold flex items-center justify-center transition-all ${
                  isQuizStep
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-tr from-yellow-400 to-orange-400 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

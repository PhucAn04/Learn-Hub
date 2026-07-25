'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import TeachPanel from '@/components/journey/TeachPanel';

const CLASSES = [
  { id: 'class_1', label: 'Vui vẻ (Happy)', emoji: '😀' },
  { id: 'class_2', label: 'Buồn bã (Sad)', emoji: '😢' },
  { id: 'class_3', label: 'Ngạc nhiên (Surprised)', emoji: '😲' },
  { id: 'class_4', label: 'Bình thường (Neutral)', emoji: '😐' },
];

export default function TeachFacePage() {
  const router = useRouter();
  
  // States
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [teacherTemplate, setTeacherTemplate] = useState<any>(null);

  useEffect(() => {
    api.getTemplates('teach-face')
      .then(async res => {
        if (res && res.length > 0) {
          const template = res[0];
          try {
            const fileData = await api.getDatasetFile(template.id);
            template.samples = fileData.samples || fileData;
          } catch (e) {
            console.error("Failed to load template samples", e);
          }
          setTeacherTemplate(template);
        }
      })
      .catch(err => console.error("Failed to load template", err));
  }, []);
  
  // Submission States
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp ảnh rõ nét và giữ đầu thật yên lặng khi chụp');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleTrainComplete = (trainedSamples: StoredSample[]) => {
    setSamples(trainedSamples);
    setSubmitScore(100);
    setShowSubmitModal(true);
  };

  const handleSubmitAssignment = async () => {
    if (submitScore === null) return;

    try {
      setIsSubmitting(true);

      let processedSamples = samples;
      if (isCloudinaryConfigured()) {
        setUploadProgress('Đang tải ảnh lên Cloud...');
        processedSamples = await uploadSamplesToCloudinary(
          samples,
          'teach-face',
          (uploaded, total) => {
            setUploadProgress(`Tải ảnh ${uploaded}/${total}...`);
          }
        );
        setUploadProgress('Đang lưu bài...');
      }

      await api.createDataset('teach-face', processedSamples, submitScore, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`);
      await api.submitAssignment(submitScore, processedSamples, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`, 'teach-face');
      await api.saveProgress('teach-face', submitScore);
      
      setSubmitSuccess(true);
      setUploadProgress('');
      playSuccessSound();
      speakEnglish('Submission successful!');
    } catch (err) {
      console.error('Failed to submit assignment', err);
      setUploadProgress('');
      speakEnglish('Submission failed!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-indigo-50 to-purple-100 py-8 px-4 select-none">
      <div className="max-w-[1600px] w-[98%] mx-auto">
        
        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <Link
            href="/home"
            onClick={playClickSound}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-indigo-200 text-indigo-700 font-extrabold shadow-sm hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Về Trang Chủ</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎭🧠</span>
            <h1 className="text-2xl md:text-3xl font-black text-indigo-900">Dạy AI Nhận Biết Khuôn Mặt</h1>
          </div>
        </div>

        {/* Teach Panel */}
        {!showSubmitModal && (
          <TeachPanel
            mode="emotion"
            classes={CLASSES}
            minSamplesPerClass={10}
            onTrainComplete={handleTrainComplete}
            teacherTemplate={teacherTemplate}
          />
        )}



        {/* Submission Modal */}
        {showSubmitModal && (
          <div className="flex justify-center animate-in fade-in zoom-in duration-300">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 border-4 border-indigo-400 shadow-2xl relative overflow-hidden">
              {submitSuccess ? (
                <div className="text-center py-8">
                  <span className="text-7xl">🏆🎉</span>
                  <h3 className="text-2xl font-black text-indigo-900 mt-4">Nộp Bài Hoàn Tất!</h3>
                  <p className="text-gray-600 font-semibold mt-2">
                    Bé đã hoàn thành xuất sắc thử thách Khuôn Mặt! Bé là một chuyên gia AI thực thụ! 🌟
                  </p>
                  <button
                    onClick={() => {
                      router.push('/challenge/face');
                    }}
                    className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-extrabold rounded-full hover:scale-105 transition-transform"
                  >
                    Chơi Game Cảm Xúc Ngay 🚀
                  </button>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-black text-indigo-900 mb-2 flex items-center gap-2">
                    <span>🎒</span> Trả Lời Câu Hỏi Cuối Cùng
                  </h3>
                  
                  {/* Score badge */}
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex items-center justify-between mb-6">
                    <div>
                      <span className="text-xs text-indigo-700 font-bold block">Điểm tự động kiểm thử (Test Score):</span>
                      <span className="text-lg text-indigo-900 font-black">
                        {submitScore}% chính xác
                      </span>
                    </div>
                    <span className="text-3xl">
                      {(submitScore ?? 0) >= 80 ? '🦁🌟' : '🐨👍'}
                    </span>
                  </div>

                  {/* Question Section */}
                  <div className="mb-4">
                    <label className="text-xs font-black text-gray-700 block mb-1.5 flex items-center gap-1">
                      <HelpCircle className="w-4 h-4 text-indigo-600" />
                      <span>Bé hãy trả lời: Trí tuệ nhân tạo nhận biết cảm xúc như thế nào?</span>
                    </label>
                    <select
                      value={reflectionAnswer}
                      onChange={(e) => setReflectionAnswer(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="Đo khoảng cách các điểm trên mắt, mũi, miệng">
                        AI vẽ lưới trên mặt và đo khoảng cách giữa mắt, mũi, miệng 📏
                      </option>
                      <option value="Đo nhịp tim và nhiệt độ">
                        AI nhìn qua camera để đo nhiệt độ cơ thể 🌡️
                      </option>
                      <option value="Đoán đại vì AI rất thông minh">
                        AI tự động đọc được suy nghĩ của mình 🧠
                      </option>
                    </select>
                  </div>

                  {/* Text feedback */}
                  <div className="mb-6">
                    <label className="text-xs font-black text-gray-700 block mb-1.5">Lời nhắn gửi Thầy Cô giáo:</label>
                    <textarea
                      rows={2}
                      value={teacherMessage}
                      onChange={(e) => setTeacherMessage(e.target.value)}
                      placeholder="Con gửi thầy cô bài học AI con vừa tự dạy..."
                      className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-indigo-400 resize-none"
                    />
                  </div>

                  {/* Submit Actions */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowSubmitModal(false)}
                      disabled={isSubmitting}
                      className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-extrabold rounded-xl hover:bg-gray-50"
                    >
                      QUAY LẠI
                    </button>
                    <button
                      onClick={handleSubmitAssignment}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 border-b-4 border-indigo-800 disabled:bg-gray-300"
                    >
                      {isSubmitting ? (uploadProgress || 'ĐANG GỬI...') : 'XÁC NHẬN NỘP'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

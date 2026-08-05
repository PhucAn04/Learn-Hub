'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';
import { calculateAutoHyperparameters } from '@/lib/ml-classifier';
import { DatasetResponse } from '@/types/models';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import TeachPanel from '@/components/journey/TeachPanel';

const CLASSES = [
  { id: 'class_1', label: '1 Ngón Tay ☝️', emoji: '☝️' },
  { id: 'class_2', label: '2 Ngón Tay ✌️', emoji: '✌️' },
];

export default function TeachAiPage() {
  const router = useRouter();
  
  // States
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [teacherTemplate, setTeacherTemplate] = useState<DatasetResponse | null>(null);

  useEffect(() => {
    api.getTemplates('teach')
      .then(async res => {
        if (res && res.length > 0) {
          const template = res[0];
          try {
            const fileData = await api.getDatasetFile(template.id);
            template.samples = fileData.samples || (Array.isArray(fileData) ? fileData : []);
          } catch (e) {
            console.error("Failed to load template samples", e);
          }
          setTeacherTemplate(template);
        }
      })
      .catch(err => console.error("Failed to load template", err));
  }, []);
  
  // Submission States
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp ảnh rõ nét và giữ tay thật yên lặng khi chụp');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [getModelBlobsFn, setGetModelBlobsFn] = useState<(() => Promise<{ jsonBlob: Blob; weightsBlob: Blob } | null>) | null>(null);

  const handleTrainComplete = (
    trainedSamples: StoredSample[],
    getModelBlobs?: () => Promise<{ jsonBlob: Blob; weightsBlob: Blob } | null>,
    accuracyScore?: number
  ) => {
    setSamples(trainedSamples);
    setSubmitScore(accuracyScore !== undefined ? Math.round(accuracyScore) : 100);
    if (getModelBlobs) setGetModelBlobsFn(() => getModelBlobs);
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
          'teach',
          (uploaded, total) => {
            setUploadProgress(`Tải ảnh ${uploaded}/${total}...`);
          }
        );
        setUploadProgress('Đang lưu bài...');
      }

      const created = await api.createDataset('teach', processedSamples, submitScore, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`);
      if (created?.model?.id) {
        await api.updateModelArtifacts(created.model.id, {
          algorithm: 'mlp',
          testScore: submitScore,
          hyperparameters: calculateAutoHyperparameters(processedSamples.length),
        }).catch(() => {});

        // Upload blobs if available
        if (getModelBlobsFn) {
          setUploadProgress('Đang tải mô hình lên đám mây...');
          const blobs = await getModelBlobsFn();
          if (blobs) {
            const formData = new FormData();
            formData.append('files', blobs.jsonBlob, 'model.json');
            formData.append('files', blobs.weightsBlob, 'model.weights.bin');
            await api.uploadModelArtifactsFiles(created.model.id, formData).catch((e) => {
              console.error('Failed to upload model artifacts', e);
            });
          }
        }
      }

      await api.submitAssignment(submitScore, { samples: processedSamples }, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`, 'teach');
      await api.saveProgress('teach', submitScore);
      
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
            <span className="text-3xl">🧠👩‍🏫</span>
            <h1 className="text-2xl md:text-3xl font-black text-indigo-900">Bé Tập Làm Cô Giáo Dạy AI</h1>
          </div>
        </div>

        {/* Teach Panel */}
        {!showSubmitModal && (
          <TeachPanel
            mode="hand-1"
            classes={CLASSES}
            minSamplesPerClass={10}
            onTrainComplete={handleTrainComplete}
            teacherTemplate={teacherTemplate || undefined}
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
                    Bé đã hoàn thành tốt phần 1 bàn tay! Phần thưởng: Mở khóa thử thách 2 bàn tay 👐
                  </p>
                  <button
                    onClick={() => {
                      router.push('/challenge/fingers');
                    }}
                    className="mt-6 px-6 py-2.5 bg-blue-600 text-white font-extrabold rounded-full hover:scale-105 transition-transform"
                  >
                    Chơi Game Đếm Ngón Tay Ngay 🚀
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
                      <span>Bé hãy trả lời: Làm sao để AI học bài chuẩn nhất?</span>
                    </label>
                    <select
                      value={reflectionAnswer}
                      onChange={(e) => setReflectionAnswer(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-800 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="Chụp ảnh rõ nét và giữ tay thật yên lặng khi chụp">
                        Chụp hình đủ sáng, rõ nét tay và giữ tay đứng yên khi chụp ☝️
                      </option>
                      <option value="Chạy nhảy rung lắc camera thật mạnh">
                        Chạy nhảy đùa nghịch và lắc camera thật mạnh 🤪
                      </option>
                      <option value="Chụp nhiều vật thể lộn xộn trong phòng">
                        Chụp thật nhiều thứ đồ chơi lộn xộn đằng sau tay 🧸
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

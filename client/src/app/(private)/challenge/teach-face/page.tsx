'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';
import { calculateAutoHyperparameters } from '@/lib/ml-classifier';
import { DatasetResponse, ModelResponse } from '@/types/models';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import TeachPanel from '@/components/journey/TeachPanel';
import { GOLDEN_FACE_DATASET } from '@/lib/golden-face-dataset';
import ReportCard from '@/components/journey/ReportCard';
import { useModelEvaluation } from '@/hooks/useModelEvaluation';

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
  const [teacherTemplate, setTeacherTemplate] = useState<DatasetResponse | null>(null);
  const [showReportCard, setShowReportCard] = useState(false);
  const [createdModelId, setCreatedModelId] = useState<string | null>(null);

  useEffect(() => {
    api.getTemplates('teach-face')
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
  const [reflectionAnswer, setReflectionAnswer] = useState('Chụp ảnh rõ nét và giữ đầu thật yên lặng khi chụp');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [getModelBlobsFn, setGetModelBlobsFn] = useState<(() => Promise<{ jsonBlob: Blob; weightsBlob: Blob } | null>) | null>(null);

  const {
    evaluation,
    previousEvaluation,
    modelVersion,
    isEvaluating,
    runEvaluation,
  } = useModelEvaluation({
    challengeType: 'teach-face',
    classes: CLASSES,
    goldenDataset: GOLDEN_FACE_DATASET,
    teacherSamples: teacherTemplate?.samples,
  });

  const handleTrainComplete = useCallback((
    trainedSamples: StoredSample[],
    getModelBlobs?: () => Promise<{ jsonBlob: Blob; weightsBlob: Blob } | null>,
    accuracyScore?: number
  ) => {
    setSamples(trainedSamples);
    setSubmitScore(accuracyScore !== undefined ? Math.round(accuracyScore) : 100);
    if (getModelBlobs) setGetModelBlobsFn(() => getModelBlobs);
    setShowSubmitModal(true);
  }, []);

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

      const created = await api.createDataset('teach-face', processedSamples, submitScore, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`);
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

        setCreatedModelId(created.model.id);

        // Run evaluation
        setUploadProgress('Đang đánh giá AI...');
        await runEvaluation(processedSamples, created.model.id);
      }

      await api.submitAssignment(submitScore, { samples: processedSamples }, `${reflectionAnswer} | Lời nhắn: ${teacherMessage}`, 'teach-face');
      await api.saveProgress('teach-face', submitScore);
      
      setUploadProgress('');
      setShowSubmitModal(false);
      setShowReportCard(true);
      playSuccessSound();
    } catch (err) {
      console.error('Failed to submit assignment', err);
      setUploadProgress('');
      speakEnglish('Submission failed!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevise = () => {
    setShowReportCard(false);
    setShowSubmitModal(false);
    setSubmitSuccess(false);
    setCreatedModelId(null);
    playClickSound();
  };

  const handleFinalize = async () => {
    try {
      setUploadProgress('Đang tổng hợp điểm kỹ năng...');
      setIsSubmitting(true);
      setShowReportCard(false);
      setShowSubmitModal(true);

      const chain = await api.getModelChain('teach-face').catch(() => []);
      
      let dataCurationScore = 0;
      let debuggingScore = 0;
      let improvementScore = 0;
      let overallScore = 0;
      const strengths: string[] = [];
      const improvements: string[] = [];
      let summary = '';

      if (chain.length > 0) {
        const latest = chain[chain.length - 1];
        const eval_ = latest.evaluation;
        
        if (eval_?.datasetHealth) {
          const dh = eval_.datasetHealth;
          dataCurationScore = Math.round((dh.qualityScore + dh.balanceRatio * 100) / 2);
          if (dh.blurrySampleCount > 0) dataCurationScore -= dh.blurrySampleCount * 2;
          if (dh.darkSampleCount > 0) dataCurationScore -= dh.darkSampleCount * 2;
          dataCurationScore = Math.max(0, Math.min(100, dataCurationScore));
        }

        if (eval_?.confusionMatrix) {
          const cm = eval_.confusionMatrix;
          const minAcc = Math.min(...Object.values(cm.perClassAccuracy) as number[]);
          debuggingScore = minAcc;
        }

        if (chain.length > 1) {
          const first = chain[0];
          const improvement = latest.testScore - first.testScore;
          improvementScore = Math.max(0, Math.min(100, 50 + improvement));
        } else {
          improvementScore = dataCurationScore;
        }

        overallScore = Math.round((dataCurationScore + debuggingScore + improvementScore) / 3);

        if (overallScore >= 80) summary = 'Bé thể hiện kỹ năng dạy AI xuất sắc!';
        else if (overallScore >= 60) summary = 'Bé đã biết cách dạy AI, nhưng cần cẩn thận hơn một chút.';
        else summary = 'Bé cần chú ý chụp ảnh rõ nét và đủ số lượng cho các nhãn nhé.';

        if (dataCurationScore >= 80) strengths.push('Chụp ảnh rõ nét và dữ liệu cân bằng tốt.');
        else improvements.push('Cần chụp ảnh rõ nét hơn, tránh ảnh bị mờ hoặc tối.');

        if (debuggingScore >= 80) strengths.push('Không có nhãn nào bị yếu quá mức, AI học đều.');
        else improvements.push(`Cải thiện thêm cho nhãn "${eval_?.confusionMatrix?.weakestLabel || 'nhãn yếu nhất'}".`);

        const formattedChain = chain.map((m: ModelResponse) => ({
          modelId: m.id,
          version: m.version || 1,
          testScore: m.testScore,
          sampleCount: m.evaluation?.datasetHealth?.sampleCount || 0,
          classSummary: m.evaluation?.datasetHealth?.classSummary || {}
        }));

        await api.upsertAssessment({
          challengeType: 'teach-face',
          modelChain: formattedChain,
          dataCurationScore,
          debuggingScore,
          improvementScore,
          overallScore,
          narrative: {
            summary,
            strengths,
            improvements,
          }
        });
      }

      setSubmitSuccess(true);
      playSuccessSound();
      speakEnglish('Submission successful!');
    } catch (err) {
      console.error('Failed to finalize and create assessment', err);
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
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

        {/* Teach Panel — conditional render, dữ liệu được giữ qua initialSamples khi Sửa Bài */}
        {!showSubmitModal && !showReportCard && (
          <TeachPanel
            mode="emotion"
            classes={CLASSES}
            minSamplesPerClass={10}
            onTrainComplete={handleTrainComplete}
            teacherTemplate={teacherTemplate || undefined}
            initialSamples={samples}
          />
        )}

        {/* ReportCard Modal */}
        {showReportCard && evaluation && (
          <ReportCard
            isOpen={showReportCard}
            onClose={() => setShowReportCard(false)}
            onRevise={handleRevise}
            onFinalize={handleFinalize}
            evaluation={evaluation}
            version={modelVersion}
            previousEvaluation={previousEvaluation}
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
                  
                   {/* Score badge — thang 10 điểm thân thiện */}
                   <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex items-center justify-between mb-6">
                     <div>
                       <span className="text-xs text-indigo-700 font-bold block">Bạn AI đoán đúng bao nhiêu câu:</span>
                       <span className="text-lg text-indigo-900 font-black">
                         {Math.round((submitScore ?? 0) / 10)}/10 điểm
                       </span>
                       <span className="text-xs text-indigo-600 font-semibold block mt-0.5">
                         {(submitScore ?? 0) >= 90 ? 'Xuất sắc! AI đoán gần như đúng hết!' 
                          : (submitScore ?? 0) >= 70 ? 'Khá tốt! AI chỉ nhầm vài câu thôi.' 
                          : (submitScore ?? 0) >= 50 ? 'AI đoán đúng khoảng nửa số câu.' 
                          : 'AI còn nhầm nhiều lắm — cần dạy lại!'}
                       </span>
                     </div>
                     <span className="text-3xl">
                       {(submitScore ?? 0) >= 90 ? '🦁🌟' : (submitScore ?? 0) >= 70 ? '🐨👍' : '🐣💪'}
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

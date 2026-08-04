'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, X, Activity } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound, speakEnglish, playClickSound } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';
import { DatasetResponse } from '@/types/models';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import BodyTeachPanel from '@/components/journey/BodyTeachPanel';

import { BODY_EXERCISES } from '@/lib/body-exercises';

export default function StudentBodyExercisePage() {
  const router = useRouter();
  
  // Selection
  const [selectedExercise, setSelectedExercise] = useState(BODY_EXERCISES[0].id);

  // States
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [teacherTemplate, setTeacherTemplate] = useState<DatasetResponse | null>(null);
  const [dynamicClasses, setDynamicClasses] = useState<{ id: string; label: string; emoji?: string }[]>([]);

  useEffect(() => {
    let ignore = false;
    api.getTemplates('teach-body-' + selectedExercise)
      .then(async res => {
        if (ignore) return;
        if (res && res.length > 0) {
          const template = res[0];
          try {
            const fileData = await api.getDatasetFile(template.id);
            template.samples = fileData.samples || (Array.isArray(fileData) ? fileData : []);
          } catch (e) {
            console.error("Failed to load template samples", e);
          }
          if (ignore) return;
          setTeacherTemplate(template);
          setDynamicClasses(template.customClasses && template.customClasses.length > 0 ? template.customClasses : []);
          setSamples([]);
        } else {
          setTeacherTemplate(null);
          setDynamicClasses([]);
          setSamples([]);
        }
      })
      .catch(err => {
        if (ignore) return;
        console.error("Failed to load template", err);
        setTeacherTemplate(null);
        setDynamicClasses([]);
        setSamples([]);
      });

    return () => {
      ignore = true;
    };
  }, [selectedExercise]);
  
  // Submission States
  const [reflectionAnswer, setReflectionAnswer] = useState('AI dùng camera để vẽ khung xương cơ thể bé');
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [getModelBlobsFn, setGetModelBlobsFn] = useState<(() => Promise<{ jsonBlob: Blob; weightsBlob: Blob } | null>) | null>(null);

  const handleTrainComplete = (
    trainedSamples: StoredSample[],
    getModelBlobs?: () => Promise<{ jsonBlob: Blob; weightsBlob: Blob } | null>
  ) => {
    setSamples(trainedSamples);
    setSubmitScore(100);
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
          'teach-body-' + selectedExercise,
          (uploaded, total) => {
            setUploadProgress(`Tải ảnh ${uploaded}/${total}...`);
          }
        );
        setUploadProgress('Đang lưu bài...');
      }

      const created = await api.createDataset('teach-body-' + selectedExercise, processedSamples, submitScore, `${reflectionAnswer}`);
      if (created?.model?.id) {
        await api.updateModelArtifacts(created.model.id, {
          algorithm: 'mlp',
          testScore: submitScore,
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

      await api.submitAssignment(submitScore, { samples: processedSamples }, reflectionAnswer, 'teach-body-' + selectedExercise);
      await api.saveProgress('teach-body-' + selectedExercise, submitScore);
      
      setSubmitSuccess(true);
      playSuccessSound();
      speakEnglish('Great job!');
    } catch (err: unknown) {
      console.error(err);
      alert('Lỗi nộp bài: ' + (err instanceof Error ? err.message : 'Không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const exercise = BODY_EXERCISES.find(e => e.id === selectedExercise);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-[1600px] w-[98%] mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/home">
              <button className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-slate-500 hover:text-indigo-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">🤸</span>
                <h1 className="text-4xl font-black text-indigo-900 tracking-tight">Bé Tập Thể Dục</h1>
              </div>
              <p className="text-lg text-slate-600 font-medium mt-2">Dạy AI các tư thế của cơ thể con</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="bg-white p-2 rounded-2xl border-2 border-indigo-100 flex items-center gap-2 shadow-sm">
               <Activity className="text-indigo-500 ml-2 w-5 h-5" />
               <select 
                 value={selectedExercise}
                 onChange={(e) => setSelectedExercise(e.target.value)}
                 className="bg-transparent text-indigo-900 font-bold px-4 py-2 outline-none cursor-pointer"
               >
                 {BODY_EXERCISES.map(ex => (
                   <option key={ex.id} value={ex.id}>{ex.name}</option>
                 ))}
               </select>
            </div>
            <button className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl hover:bg-indigo-200 transition-colors font-bold flex items-center gap-2">
              <HelpCircle className="w-6 h-6" />
              <span className="hidden md:inline">Hướng dẫn</span>
            </button>
          </div>
        </div>

        {/* TEACH PANEL */}
        {dynamicClasses.length === 0 && !teacherTemplate ? (
          <div className="bg-white rounded-3xl p-12 shadow-xl border-4 border-indigo-100 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-slate-700">Đang chờ giáo viên giao bài</h2>
            <p className="text-slate-500 mt-2">Cô/Thầy chưa tạo dữ liệu mẫu cho bài tập <b>{exercise?.name}</b>. Bé quay lại sau nhé!</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-indigo-100">
            <BodyTeachPanel
              key={selectedExercise}
              mode="body-pose"
              classes={dynamicClasses}
              onTrainComplete={handleTrainComplete}
              teacherTemplate={teacherTemplate || undefined}
            />
          </div>
        )}
      </div>

      {/* SUBMIT MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border-4 border-white">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white relative">
              <button 
                onClick={() => !isSubmitting && !submitSuccess && setShowSubmitModal(false)}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
                disabled={isSubmitting || submitSuccess}
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-black flex items-center gap-2">
                <span className="text-3xl">🏆</span>
                Tuyệt Vời! Bé Đã Dạy Xong AI
              </h2>
              <p className="text-indigo-100 mt-2 font-medium">
                AI đã học được các tư thế cơ thể của bé!
              </p>
            </div>

            <div className="p-6 space-y-6">
              {!submitSuccess ? (
                <>
                  <div className="bg-white/10 rounded-2xl p-6 border border-white/20 bg-indigo-50">
                    <h3 className="font-bold text-indigo-900 mb-2">Lời nhắn từ Cô/Thầy</h3>
                    <div className="text-indigo-800 italic">
                      &quot;{teacherTemplate?.teacherNotes || 'Các em nhớ làm giống cô nhé!'}&quot;
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Bé nhận ra AI vẽ cơ thể bé bằng cách nào?</label>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 font-medium text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none"
                      rows={3}
                      value={reflectionAnswer}
                      onChange={e => setReflectionAnswer(e.target.value)}
                      placeholder="VD: AI dùng camera để..."
                    />
                  </div>

                  <button
                    onClick={handleSubmitAssignment}
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-xl font-extrabold text-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-300"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        {uploadProgress || 'Đang xử lý...'}
                      </>
                    ) : (
                      'Nộp Bài Ngay!'
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center py-8">
                  <span className="text-7xl animate-bounce inline-block">🎉</span>
                  <h3 className="text-2xl font-black text-indigo-900 mt-4">Nộp Bài Thành Công!</h3>
                  <p className="text-gray-600 font-semibold mt-2">Bé đã hoàn thành xuất sắc thử thách này.</p>
                  <button
                    onClick={() => router.push('/home')}
                    className="mt-6 font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Quay về trang chủ →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

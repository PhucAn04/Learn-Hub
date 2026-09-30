'use client';

import { useState } from 'react';
import { ArrowLeft, Save, X, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { playSuccessSound } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';
import { uploadSamplesToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import BodyTeachPanel from '@/components/journey/BodyTeachPanel';

import { BODY_EXERCISES } from '@/lib/body-exercises';

export default function TeacherBodyExercisePage() {
  const router = useRouter();
  
  // Selection
  const [selectedExercise, setSelectedExercise] = useState(BODY_EXERCISES[0].id);

  // States
  const [samples, setSamples] = useState<StoredSample[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; label: string; emoji?: string }[]>([]);
  
  // Submission States
  const [teacherNotes, setTeacherNotes] = useState('Cô đã thiết lập các tư thế mẫu cho bài này.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleTrainComplete = (trainedSamples: StoredSample[]) => {
    setSamples(trainedSamples);
    setShowSubmitModal(true);
  };

  const handleSubmitTemplate = async () => {
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
        setUploadProgress('Đang lưu bộ mẫu...');
      }

      await api.createDataset(
        'teach-body-' + selectedExercise,
        processedSamples,
        100, // Teacher sets standard
        '', 
        true, // isTemplate
        teacherNotes,
        true, // isPublished
        'camera',
        teacherClasses // Pass custom classes!
      );
      
      setSubmitSuccess(true);
      playSuccessSound();
    } catch (err: unknown) {
      console.error(err);
      alert('Lỗi lưu dữ liệu: ' + (err instanceof Error ? err.message : 'Không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const exercise = BODY_EXERCISES.find(e => e.id === selectedExercise);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] w-[98%] mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/teacher/training')}
              className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-slate-500 hover:text-indigo-600"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-indigo-900 flex items-center gap-2">
                Tạo Dữ Liệu Mẫu: Các Bài Thể Dục Cơ Thể
              </h1>
              <p className="text-slate-600 font-medium">Bạn có thể tự do thêm các nhãn (ví dụ: Bước 1, Bước 2) và thu ảnh mẫu.</p>
            </div>
          </div>
          
          <div className="bg-white p-2 rounded-2xl border-2 border-indigo-100 flex items-center gap-2 shadow-sm">
             <Activity className="text-indigo-500 ml-2 w-5 h-5" />
             <select 
               value={selectedExercise}
               onChange={(e) => {
                 setSelectedExercise(e.target.value);
                 // Reset state on change
                 setSamples([]);
                 setTeacherClasses([]);
               }}
               className="bg-transparent text-indigo-900 font-bold px-4 py-2 outline-none cursor-pointer"
             >
               {BODY_EXERCISES.map(ex => (
                 <option key={ex.id} value={ex.id}>{ex.name}</option>
               ))}
             </select>
          </div>
        </div>

        {/* TEACH PANEL */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-indigo-100">
          {/* Key trick: use key prop to remount panel when exercise changes */}
          <BodyTeachPanel
            key={selectedExercise} 
            mode="body-pose"
            classes={[]} // Initial classes empty
            allowCustomClasses={true}
            onClassesChange={setTeacherClasses}
            onTrainComplete={handleTrainComplete}
          />
        </div>
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
                <Save className="w-7 h-7" />
                Lưu Bộ Dữ Liệu Mẫu ({exercise?.name})
              </h2>
              <p className="text-indigo-100 mt-2 font-medium">
                Bạn đã thu thập mẫu thành công. Học sinh sẽ thấy các nhãn và ảnh mẫu này!
              </p>
            </div>

            <div className="p-6 space-y-6">
              {!submitSuccess ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Lời nhắn cho học sinh (Tuỳ chọn)</label>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 font-medium text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none"
                      rows={3}
                      value={teacherNotes}
                      onChange={e => setTeacherNotes(e.target.value)}
                      placeholder="VD: Các em nhớ làm giống cô nhé!"
                    />
                  </div>

                  <button
                    onClick={handleSubmitTemplate}
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-xl font-extrabold text-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-300"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        {uploadProgress || 'Đang xử lý...'}
                      </>
                    ) : (
                      'Xuất Bản Template'
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center py-8">
                  <span className="text-7xl">🎉🎓</span>
                  <h3 className="text-2xl font-black text-indigo-900 mt-4">Đã Lưu Template!</h3>
                  <button
                    onClick={() => router.push('/teacher/templates')}
                    className="mt-6 font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Xem thư viện template →
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

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePageData } from '@/hooks/usePageData';
import { ArrowLeft, Database, Clock, Eye, EyeOff, AlertTriangle, X, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';
import { DatasetResponse } from '@/types/models';

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const { data, loading, error: fetchErr } = usePageData(async () => {
    if (!id || id === 'undefined') return null;
    const [templateData, fileData] = await Promise.all([
      api.getDatasetById(id),
      api.getDatasetFile(id)
    ]);
    return { template: templateData as DatasetResponse, samples: (fileData.samples || []) as StoredSample[] };
  }, [id], Boolean(id && id !== 'undefined'));

  const template = data?.template || null;
  const samples = data?.samples || [];
  const error = fetchErr ? fetchErr.message : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center bg-white rounded-3xl mt-10 border-2 border-red-100">
        <h2 className="text-xl font-bold text-red-600 mb-4">Lỗi: {error}</h2>
        <button onClick={() => router.back()} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <Link href="/teacher/templates" onClick={playClickSound} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-extrabold text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại thư viện</span>
        </Link>
      </div>

      <div className="bg-white rounded-3xl p-8 border-2 border-indigo-50 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-black uppercase tracking-wider mb-3 inline-block">
              {template.challengeType}
            </span>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <Database className="w-8 h-8 text-indigo-500" /> Chi Tiết Bộ Dữ Liệu Mẫu
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 font-bold bg-slate-50 px-4 py-2 rounded-xl">
            <Clock className="w-4 h-4" />
            {new Date(template.createdAt).toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tóm tắt nhãn</h3>
              <div className="flex flex-wrap gap-2">
                {template.classSummary && Object.entries(template.classSummary).map(([label, count]) => (
                  <span key={label} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                    {label}: <span className="text-indigo-600">{count as React.ReactNode} ảnh</span>
                  </span>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Thông tin chung</h3>
              <p className="text-sm font-bold text-slate-700">Tổng số mẫu: <span className="text-indigo-600">{template.sampleCount}</span></p>
              <p className="text-sm font-bold text-slate-700 mt-1">Loại thu thập: {template.dataSourceType || 'Camera'}</p>
            </div>
          </div>

          <div>
            <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-100 h-full">
              <h3 className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2">Ghi chú của giáo viên</h3>
              <p className="text-sm font-medium text-yellow-900 whitespace-pre-wrap">
                {template.teacherNotes || 'Không có ghi chú.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Eye className="w-6 h-6 text-indigo-500" /> Thư viện ảnh mẫu ({samples.length})
          </h2>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {samples.map((sample: StoredSample, idx: number) => (
            <div 
              key={idx} 
              onClick={() => { playClickSound(); setPreviewIndex(idx); }}
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-indigo-50 bg-slate-800 cursor-pointer group hover:scale-105 hover:border-indigo-400 transition-all shadow-sm"
            >
              {sample.thumbnail ? (
                <img src={sample.thumbnail} alt={`Mẫu ${idx + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-[10px]">📷</div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] font-bold text-center py-1 truncate px-1">
                {sample.label || sample.sourceId || '—'}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Eye className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-screen preview modal */}
      {previewIndex !== null && samples[previewIndex] && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setPreviewIndex(null)}>
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 border-4 border-indigo-400 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setPreviewIndex(null)}
              className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-indigo-900 mb-3 flex items-center gap-2">
              📸 Ảnh mẫu #{previewIndex + 1}
            </h3>

            {samples[previewIndex].rawThumbnail && (
              <button
                onClick={() => setShowSkeleton(!showSkeleton)}
                className="absolute top-16 right-4 p-2 bg-white hover:bg-gray-100 rounded-full text-indigo-600 shadow-md border border-indigo-200 transition-colors z-10 flex items-center gap-2"
                title={showSkeleton ? "Ẩn nét vẽ AI" : "Hiện nét vẽ AI"}
              >
                {showSkeleton ? <Eye className="w-5 h-5 text-indigo-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
              </button>
            )}

            <div className={`relative rounded-2xl overflow-hidden border-4 ${samples[previewIndex].isValid === false ? 'border-red-400' : 'border-gray-200'} mb-4 bg-slate-900`}>
              {samples[previewIndex].thumbnail ? (
                <img 
                  src={(showSkeleton || !samples[previewIndex].rawThumbnail) ? samples[previewIndex].thumbnail : samples[previewIndex].rawThumbnail} 
                  alt="Preview" 
                  className="w-full aspect-[4/3] object-cover" 
                />
              ) : (
                <div className="w-full aspect-[4/3] flex items-center justify-center text-gray-500">Không có ảnh</div>
              )}

              {samples[previewIndex].isValid === false && (
                <div className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg animate-pulse">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                disabled={previewIndex <= 0}
                className="p-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded-xl transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              
              <div className="flex-1 flex items-center justify-center bg-indigo-50 rounded-xl">
                 <span className="font-extrabold text-indigo-700">
                   Ảnh {previewIndex + 1} / {samples.length} 
                   <span className="ml-2 text-xs opacity-70">({samples[previewIndex].label})</span>
                 </span>
              </div>

              <button
                onClick={() => setPreviewIndex(Math.min(samples.length - 1, previewIndex + 1))}
                disabled={previewIndex >= samples.length - 1}
                className="p-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded-xl transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

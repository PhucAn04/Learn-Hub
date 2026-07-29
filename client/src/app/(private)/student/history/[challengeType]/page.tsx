'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Calendar, TrendingUp, Eye, EyeOff, MessageSquare, ChevronDown, ChevronUp, X, AlertTriangle, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';
import { StoredSample } from '@/lib/knn-classifier';

const CHALLENGE_LABELS: Record<string, string> = {
  'teach': 'Dạy AI nhận diện ngón tay ✋',
  'teach-face': 'Dạy AI nhận biết cảm xúc 😀',
  'teach-gestures': 'Dạy AI nhận biết cử chỉ 🤟',
  'teach-two-hands': 'Dạy AI nhận diện 2 bàn tay 👐',
};

interface DatasetRecord {
  id: string;
  challengeType: string;
  sampleCount: number;
  classSummary?: Record<string, number>;
  dataFileUrl?: string;
  createdAt: string;
  model?: {
    id: string;
    testScore: number;
    teacherFeedback?: string;
  } | null;
}

export default function StudentHistoryPage() {
  const params = useParams();
  const challengeType = params.challengeType as string;
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSamples, setExpandedSamples] = useState<StoredSample[] | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const challengeLabel = CHALLENGE_LABELS[challengeType] || challengeType;

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getMyDatasets(challengeType);
      setDatasets(data);
    } catch (err) {
      console.error('Failed to load dataset history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [challengeType]);

  const toggleExpand = async (datasetId: string) => {
    if (expandedId === datasetId) {
      setExpandedId(null);
      setExpandedSamples(null);
      return;
    }

    try {
      setLoadingFile(true);
      setExpandedId(datasetId);
      const fileData = await api.getDatasetFile(datasetId);
      setExpandedSamples(fileData.samples || []);
    } catch (err) {
      console.error('Failed to load dataset file', err);
      setExpandedSamples([]);
    } finally {
      setLoadingFile(false);
    }
  };

  // Calculate score improvement
  const getScoreImprovement = (index: number) => {
    if (index >= datasets.length - 1) return null;
    const current = datasets[index]?.model?.testScore || 0;
    const previous = datasets[index + 1]?.model?.testScore || 0;
    return current - previous;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-indigo-50 to-purple-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              onClick={playClickSound}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-indigo-200 text-indigo-700 font-extrabold shadow-sm hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Về Trang Chủ</span>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-indigo-900">📊 Lịch Sử Bộ Dữ Liệu</h1>
              <p className="text-sm font-semibold text-indigo-600">{challengeLabel}</p>
            </div>
          </div>
          <button
            onClick={() => { playClickSound(); fetchHistory(); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>TẢI LẠI</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-indigo-600 rounded-full" />
            <p className="text-sm font-semibold text-slate-500 mt-2">Đang tải lịch sử...</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-inner">
            <span className="text-5xl">📭</span>
            <h3 className="text-lg font-bold text-slate-700 mt-4">Chưa có bộ dữ liệu nào</h3>
            <p className="text-slate-500 text-xs font-semibold mt-1">Bé hãy vào bài tập để thu thập dữ liệu và nộp bài nhé!</p>
            <Link
              href={`/challenge/${challengeType}`}
              className="mt-4 inline-block px-6 py-2 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-colors"
            >
              Bắt đầu bài tập →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score trend summary */}
            {datasets.length >= 2 && (() => {
              const latest = datasets[0]?.model?.testScore || 0;
              const first = datasets[datasets.length - 1]?.model?.testScore || 0;
              const diff = latest - first;
              return (
                <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${
                  diff > 0 ? 'bg-green-50 border-green-200' : diff < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <TrendingUp className={`w-6 h-6 ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600 rotate-180' : 'text-gray-500'}`} />
                  <div>
                    <span className="text-sm font-extrabold text-slate-800">
                      {diff > 0 ? `📈 Tiến bộ +${diff}% so với lần đầu!` : diff < 0 ? `📉 Giảm ${Math.abs(diff)}% so với lần đầu` : '➡️ Điểm giữ nguyên'}
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Lần đầu: {first}% → Lần gần nhất: {latest}% ({datasets.length} lần nộp)
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Dataset timeline */}
            {datasets.map((ds, index) => {
              const isExpanded = expandedId === ds.id;
              const improvement = getScoreImprovement(index);
              const dateStr = new Date(ds.createdAt).toLocaleDateString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              });

              return (
                <div key={ds.id} className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm overflow-hidden">
                  {/* Summary row */}
                  <div
                    className="p-5 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                    onClick={() => { playClickSound(); toggleExpand(ds.id); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-3 rounded-2xl">
                          <span className="text-2xl">📦</span>
                        </div>
                        <div>
                          <div className="font-extrabold text-indigo-900">
                            Lần nộp #{datasets.length - index}
                          </div>
                          <div className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>{dateStr}</span>
                            <span className="mx-1">•</span>
                            <span>{ds.sampleCount} mẫu</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Score badge */}
                        <div className="text-right">
                          <span className={`inline-block px-3 py-1 text-sm font-black rounded-full ${
                            (ds.model?.testScore || 0) >= 80 ? 'bg-green-100 text-green-700'
                            : (ds.model?.testScore || 0) >= 50 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {ds.model?.testScore || 0}%
                          </span>
                          {improvement !== null && improvement !== 0 && (
                            <span className={`block text-[10px] font-bold mt-0.5 ${improvement > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {improvement > 0 ? `↑ +${improvement}%` : `↓ ${improvement}%`}
                            </span>
                          )}
                        </div>

                        {/* Teacher feedback indicator */}
                        {ds.model?.teacherFeedback && (
                          <div className="bg-amber-100 p-1.5 rounded-lg" title="Giáo viên đã nhận xét">
                            <MessageSquare className="w-4 h-4 text-amber-600" />
                          </div>
                        )}

                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>

                    {/* Class summary pills */}
                    {ds.classSummary && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {Object.entries(ds.classSummary).map(([label, count]) => (
                          <span key={label} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                            {label}: {count as number} ảnh
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-indigo-100 p-5 bg-slate-50/50">
                      {/* Teacher feedback */}
                      {ds.model?.teacherFeedback && (
                        <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl">
                          <div className="text-xs font-extrabold text-amber-800 mb-1 flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            Nhận xét từ Giáo viên:
                          </div>
                          <p className="text-sm font-semibold text-amber-900">{ds.model.teacherFeedback}</p>
                        </div>
                      )}

                      {/* Sample gallery */}
                      {loadingFile ? (
                        <div className="text-center py-8">
                          <div className="animate-spin inline-block w-6 h-6 border-3 border-current border-t-transparent text-indigo-600 rounded-full" />
                          <p className="text-xs font-semibold text-slate-400 mt-2">Đang tải ảnh mẫu...</p>
                        </div>
                      ) : expandedSamples && expandedSamples.length > 0 ? (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Eye className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-extrabold text-indigo-700">Ảnh mẫu đã thu ({expandedSamples.length})</span>
                          </div>
                          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {expandedSamples.map((sample: StoredSample, idx: number) => (
                              <div 
                                key={idx} 
                                onClick={() => setPreviewIndex(idx)}
                                className="relative aspect-square rounded-xl overflow-hidden border-2 border-indigo-100 bg-slate-800 cursor-pointer group hover:scale-105 hover:border-indigo-400 transition-all"
                              >
                                {sample.thumbnail ? (
                                  <img src={sample.thumbnail} alt={`Mẫu ${idx + 1}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-[10px]">📷</div>
                                )}
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5 truncate px-0.5">
                                  {sample.label || sample.sourceId || '—'}
                                </div>
                                {sample.isValid === false && (
                                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold px-1 rounded-bl-lg">⚠️</div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                  <Eye className="w-5 h-5" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-semibold text-center py-4">Không có dữ liệu ảnh mẫu.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-screen preview modal */}
      {previewIndex !== null && expandedSamples && expandedSamples[previewIndex] && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewIndex(null)}>
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 border-4 border-indigo-400 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setPreviewIndex(null)}
              className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-indigo-900 mb-3 flex items-center gap-2">
              📸 Ảnh mẫu #{previewIndex + 1}
            </h3>

            {/* Toggle button */}
            {expandedSamples[previewIndex].rawThumbnail && (
              <button
                onClick={() => setShowSkeleton(!showSkeleton)}
                className="absolute top-16 right-4 p-2 bg-white hover:bg-gray-100 rounded-full text-indigo-600 shadow-md border border-indigo-200 transition-colors z-10 flex items-center gap-2"
                title={showSkeleton ? "Ẩn nét vẽ AI" : "Hiện nét vẽ AI"}
              >
                {showSkeleton ? <Eye className="w-5 h-5 text-indigo-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
              </button>
            )}

            {/* Large image preview */}
            <div className={`relative rounded-2xl overflow-hidden border-4 ${expandedSamples[previewIndex].isValid === false ? 'border-red-400' : 'border-gray-200'} mb-4 bg-slate-900`}>
              {expandedSamples[previewIndex].thumbnail ? (
                <img 
                  src={(showSkeleton || !expandedSamples[previewIndex].rawThumbnail) ? expandedSamples[previewIndex].thumbnail : expandedSamples[previewIndex].rawThumbnail} 
                  alt="Preview" 
                  className="w-full aspect-square object-cover" 
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center text-gray-500">Không có ảnh</div>
              )}

              {expandedSamples[previewIndex].isValid === false && (
                <div className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg animate-pulse">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                disabled={previewIndex <= 0}
                className="p-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded-xl transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              
              <div className="flex-1 flex items-center justify-center bg-indigo-50 rounded-xl">
                 <span className="font-extrabold text-indigo-700">Ảnh {previewIndex + 1} / {expandedSamples.length}</span>
              </div>

              <button
                onClick={() => setPreviewIndex(Math.min(expandedSamples.length - 1, previewIndex + 1))}
                disabled={previewIndex >= expandedSamples.length - 1}
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

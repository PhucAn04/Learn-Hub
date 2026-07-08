'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Calendar, TrendingUp, Eye, MessageSquare, ChevronDown, ChevronUp, Send, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { playClickSound, playSuccessSound } from '@/lib/audio';

const CHALLENGE_LABELS: Record<string, string> = {
  'teach': 'Dạy AI nhận diện ngón tay ✋',
  'teach-face': 'Dạy AI nhận biết cảm xúc 😀',
  'teach-gestures': 'Dạy AI nhận biết cử chỉ 🤟',
};

interface DatasetRecord {
  id: string;
  userId: string;
  challengeType: string;
  sampleCount: number;
  classSummary: Record<string, number>;
  dataFileUrl: string;
  createdAt: string;
  user: { id: string; username: string; avatar: string; email: string };
  model?: {
    id: string;
    testScore: number;
    teacherFeedback: string | null;
  };
}

interface StudentGroup {
  user: { id: string; username: string; avatar: string; email: string };
  datasets: DatasetRecord[];
  latestScore: number;
  bestScore: number;
  totalSubmissions: number;
}

export default function TeacherDatasetsByChallengePage() {
  const params = useParams();
  const challengeType = params.challengeType as string;
  const [allDatasets, setAllDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentGroup | null>(null);
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);
  const [expandedSamples, setExpandedSamples] = useState<any[] | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackModelId, setFeedbackModelId] = useState<string | null>(null);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const challengeLabel = CHALLENGE_LABELS[challengeType] || challengeType;

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getDatasetsByChallenge(challengeType);
      setAllDatasets(data);
    } catch (err) {
      console.error('Failed to load datasets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [challengeType]);

  // Group datasets by student
  const studentGroups: StudentGroup[] = (() => {
    const map = new Map<string, StudentGroup>();
    allDatasets.forEach(ds => {
      if (!ds.user) return;
      const existing = map.get(ds.userId);
      if (existing) {
        existing.datasets.push(ds);
        existing.totalSubmissions++;
        const score = ds.model?.testScore || 0;
        if (score > existing.bestScore) existing.bestScore = score;
      } else {
        map.set(ds.userId, {
          user: ds.user,
          datasets: [ds],
          latestScore: ds.model?.testScore || 0,
          bestScore: ds.model?.testScore || 0,
          totalSubmissions: 1,
        });
      }
    });
    // Sort datasets within each group by date DESC
    map.forEach(group => {
      group.datasets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      group.latestScore = group.datasets[0]?.model?.testScore || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.latestScore - a.latestScore);
  })();

  // Auto-select first student
  useEffect(() => {
    if (studentGroups.length > 0 && !selectedStudent) {
      setSelectedStudent(studentGroups[0]);
    }
  }, [studentGroups.length]);

  const toggleExpand = async (datasetId: string) => {
    if (expandedDatasetId === datasetId) {
      setExpandedDatasetId(null);
      setExpandedSamples(null);
      return;
    }
    try {
      setLoadingFile(true);
      setExpandedDatasetId(datasetId);
      const fileData = await api.getDatasetFile(datasetId);
      setExpandedSamples(fileData.samples || fileData);
    } catch (err) {
      console.error('Failed to load dataset file', err);
      setExpandedSamples([]);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSendFeedback = async (modelId: string) => {
    if (!feedbackText.trim()) return;
    try {
      setSendingFeedback(true);
      await api.addTeacherFeedback(modelId, feedbackText.trim());
      playSuccessSound();
      setFeedbackText('');
      setFeedbackModelId(null);
      // Refresh data
      await fetchData();
      // Re-select the same student
      if (selectedStudent) {
        const updated = studentGroups.find(g => g.user.id === selectedStudent.user.id);
        if (updated) setSelectedStudent(updated);
      }
    } catch (err) {
      console.error('Failed to send feedback', err);
    } finally {
      setSendingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-4 px-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/teacher" onClick={playClickSound} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-extrabold text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </Link>
          <span className="h-4 w-[2px] bg-slate-200" />
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>📊</span> Bộ dữ liệu: {challengeLabel}
          </h1>
        </div>
        <button
          onClick={() => { playClickSound(); fetchData(); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>TẢI LẠI</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-indigo-600 rounded-full" />
            <p className="text-sm font-semibold text-slate-500 mt-2">Đang tải dữ liệu...</p>
          </div>
        ) : studentGroups.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-inner">
            <span className="text-5xl">📭</span>
            <h3 className="text-lg font-bold text-slate-700 mt-4">Chưa có học sinh nào nộp bài</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* LEFT: Student list */}
            <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Danh sách học sinh ({studentGroups.length})
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {studentGroups.map(group => {
                  const isSelected = selectedStudent?.user.id === group.user.id;
                  return (
                    <div
                      key={group.user.id}
                      onClick={() => { playClickSound(); setSelectedStudent(group); setExpandedDatasetId(null); }}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex items-center justify-between ${
                        isSelected ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{group.user.avatar}</span>
                        <div>
                          <div className="font-extrabold text-slate-800 text-sm">{group.user.username}</div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {group.totalSubmissions} lần nộp • Cao nhất: {group.bestScore}%
                          </div>
                        </div>
                      </div>
                      <span className={`inline-block px-2.5 py-1 text-xs font-black rounded-full ${
                        group.latestScore >= 80 ? 'bg-green-100 text-green-700'
                        : group.latestScore >= 50 ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {group.latestScore}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Selected student's timeline */}
            <div className="lg:col-span-2 space-y-6">
              {selectedStudent && (
                <>
                  {/* Student header */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-4">
                      <span className="text-5xl">{selectedStudent.user.avatar}</span>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">{selectedStudent.user.username}</h2>
                        <p className="text-xs text-slate-400 font-semibold">{selectedStudent.user.email}</p>
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                            {selectedStudent.totalSubmissions} lần nộp
                          </span>
                          <span className="text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded-full">
                            Điểm cao nhất: {selectedStudent.bestScore}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Score trend */}
                  {selectedStudent.datasets.length >= 2 && (() => {
                    const latest = selectedStudent.datasets[0]?.model?.testScore || 0;
                    const first = selectedStudent.datasets[selectedStudent.datasets.length - 1]?.model?.testScore || 0;
                    const diff = latest - first;
                    return (
                      <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${
                        diff > 0 ? 'bg-green-50 border-green-200' : diff < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <TrendingUp className={`w-6 h-6 ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600 rotate-180' : 'text-gray-500'}`} />
                        <span className="text-sm font-extrabold text-slate-800">
                          {diff > 0 ? `📈 Tiến bộ +${diff}%` : diff < 0 ? `📉 Giảm ${Math.abs(diff)}%` : '➡️ Giữ nguyên'}
                          <span className="text-xs text-slate-500 ml-2">({first}% → {latest}%)</span>
                        </span>
                      </div>
                    );
                  })()}

                  {/* Dataset timeline */}
                  {selectedStudent.datasets.map((ds, index) => {
                    const isExpanded = expandedDatasetId === ds.id;
                    const dateStr = new Date(ds.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    });
                    const prevScore = index < selectedStudent.datasets.length - 1
                      ? selectedStudent.datasets[index + 1]?.model?.testScore || 0 : null;
                    const improvement = prevScore !== null ? (ds.model?.testScore || 0) - prevScore : null;

                    return (
                      <div key={ds.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Summary */}
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
                                  Lần nộp #{selectedStudent.datasets.length - index}
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
                              {ds.model?.teacherFeedback && (
                                <div className="bg-amber-100 p-1.5 rounded-lg" title="Đã nhận xét">
                                  <MessageSquare className="w-4 h-4 text-amber-600" />
                                </div>
                              )}
                              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                            </div>
                          </div>

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

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="border-t border-indigo-100 p-5 bg-slate-50/50 space-y-4">

                            {/* Existing feedback */}
                            {ds.model?.teacherFeedback && (
                              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl">
                                <div className="text-xs font-extrabold text-amber-800 mb-1 flex items-center gap-1">
                                  <MessageSquare className="w-4 h-4" />
                                  Nhận xét đã gửi:
                                </div>
                                <p className="text-sm font-semibold text-amber-900">{ds.model.teacherFeedback}</p>
                              </div>
                            )}

                            {/* Feedback input */}
                            {ds.model && (
                              <div className="p-4 bg-white border-2 border-indigo-200 rounded-2xl">
                                <label className="text-xs font-extrabold text-indigo-800 mb-2 block flex items-center gap-1">
                                  <MessageSquare className="w-4 h-4" />
                                  {ds.model.teacherFeedback ? 'Cập nhật nhận xét:' : 'Thêm nhận xét cho học sinh:'}
                                </label>
                                <div className="flex gap-2">
                                  <textarea
                                    rows={2}
                                    value={feedbackModelId === ds.model.id ? feedbackText : ''}
                                    onFocus={() => {
                                      setFeedbackModelId(ds.model!.id);
                                      if (feedbackModelId !== ds.model!.id) setFeedbackText(ds.model!.teacherFeedback || '');
                                    }}
                                    onChange={(e) => { setFeedbackModelId(ds.model!.id); setFeedbackText(e.target.value); }}
                                    placeholder="Vd: Bé chụp rất tốt, cần chụp thêm mẫu buồn bã..."
                                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 focus:outline-none focus:border-indigo-400 resize-none"
                                  />
                                  <button
                                    onClick={() => handleSendFeedback(ds.model!.id)}
                                    disabled={sendingFeedback || feedbackModelId !== ds.model.id || !feedbackText.trim()}
                                    className="px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 transition-colors flex items-center gap-1 self-end"
                                  >
                                    <Send className="w-4 h-4" />
                                    <span className="text-xs">Gửi</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Sample gallery */}
                            {loadingFile && expandedDatasetId === ds.id ? (
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
                                  {expandedSamples.map((sample: any, idx: number) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-indigo-100 bg-slate-800">
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
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : expandedDatasetId === ds.id ? (
                              <p className="text-xs text-slate-400 font-semibold text-center py-4">Không có dữ liệu ảnh mẫu.</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

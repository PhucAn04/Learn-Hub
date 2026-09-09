'use client';

import { usePageData } from '@/hooks/usePageData';
import { ArrowLeft, RefreshCw, Users, FileCheck, Target, CheckCircle2, XCircle, Eye } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';

interface DatasetRecord {
  id: string;
  userId: string;
  challengeType: string;
  createdAt: string;
  user?: { id: string; username: string; avatar?: string; email: string };
  model?: {
    testScore: number;
    algorithm?: string;
  };
}

interface StudentProgress {
  user: { id: string; username: string; avatar?: string; email: string };
  teach: { completed: boolean; bestScore: number };
  teachFace: { completed: boolean; bestScore: number };
  teachGestures: { completed: boolean; bestScore: number };
  teachTwoHands: { completed: boolean; bestScore: number };
  teachFree: { completed: boolean; bestScore: number };
}

export default function TeacherDashboard() {
  const { data, loading, refetch: fetchDashboardData } = usePageData(async () => {
    const userProfile = await api.getProfile().catch(() => null);

    // Fetch all four challenges
    const [teachRes, faceRes, gesturesRes, twoHandsRes, freeRes] = await Promise.all([
      api.getDatasetsByChallenge('teach').catch(() => [] as DatasetRecord[]),
      api.getDatasetsByChallenge('teach-face').catch(() => [] as DatasetRecord[]),
      api.getDatasetsByChallenge('teach-gestures').catch(() => [] as DatasetRecord[]),
      api.getDatasetsByChallenge('teach-two-hands').catch(() => [] as DatasetRecord[]),
      api.getDatasetsByChallenge('teach-free').catch(() => [] as DatasetRecord[])
    ]);

    const allDatasets = [...teachRes, ...faceRes, ...gesturesRes, ...twoHandsRes, ...freeRes];
    const studentMap = new Map<string, StudentProgress>();
    
    let sumAccuracy = 0;
    let countAccuracy = 0;

    allDatasets.forEach(ds => {
      if (!ds.user) return;
      if (!studentMap.has(ds.userId)) {
        studentMap.set(ds.userId, {
          user: ds.user,
          teach: { completed: false, bestScore: 0 },
          teachFace: { completed: false, bestScore: 0 },
          teachGestures: { completed: false, bestScore: 0 },
          teachTwoHands: { completed: false, bestScore: 0 },
          teachFree: { completed: false, bestScore: 0 },
        });
      }
      
      const st = studentMap.get(ds.userId)!;
      const score = ds.model?.testScore || 0;
      
      if (score > 0) {
        sumAccuracy += score;
        countAccuracy++;
      }

      if (ds.challengeType === 'teach') {
        st.teach.completed = true;
        if (score > st.teach.bestScore) st.teach.bestScore = score;
      } else if (ds.challengeType === 'teach-face') {
        st.teachFace.completed = true;
        if (score > st.teachFace.bestScore) st.teachFace.bestScore = score;
      } else if (ds.challengeType === 'teach-gestures') {
        st.teachGestures.completed = true;
        if (score > st.teachGestures.bestScore) st.teachGestures.bestScore = score;
      } else if (ds.challengeType === 'teach-two-hands') {
        st.teachTwoHands.completed = true;
        if (score > st.teachTwoHands.bestScore) st.teachTwoHands.bestScore = score;
      } else if (ds.challengeType === 'teach-free') {
        st.teachFree.completed = true;
        if (score > st.teachFree.bestScore) st.teachFree.bestScore = score;
      }
    });

    // Sort students by average score descending
    const sortedStudents = Array.from(studentMap.values()).sort((a, b) => {
      const avgA = (a.teach.bestScore + a.teachFace.bestScore + a.teachGestures.bestScore + a.teachTwoHands.bestScore + a.teachFree.bestScore) / 5;
      const avgB = (b.teach.bestScore + b.teachFace.bestScore + b.teachGestures.bestScore + b.teachTwoHands.bestScore + b.teachFree.bestScore) / 5;
      return avgB - avgA;
    });

    return {
      profile: userProfile,
      students: sortedStudents,
      stats: {
        totalStudents: studentMap.size,
        totalDatasets: allDatasets.length,
        averageAccuracy: countAccuracy > 0 ? Math.round(sumAccuracy / countAccuracy) : 0
      }
    };
  }, []);

  const profile = data?.profile || null;
  const students = data?.students || [];
  const stats = data?.stats || { totalStudents: 0, totalDatasets: 0, averageAccuracy: 0 };

  const handleRefresh = () => {
    playClickSound();
    fetchDashboardData();
  };

  const renderStatus = (challenge: { completed: boolean; bestScore: number }) => {
    if (!challenge.completed) {
      return (
        <div className="flex flex-col items-center justify-center text-slate-300">
          <XCircle className="w-5 h-5 mb-1 text-slate-300" />
          <span className="text-[10px] font-semibold">Chưa làm</span>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center">
        <CheckCircle2 className="w-5 h-5 mb-1 text-green-500" />
        <span className={`inline-block px-2 py-0.5 text-[10px] font-black rounded-full ${
          challenge.bestScore >= 80 ? 'bg-green-100 text-green-700' :
          challenge.bestScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {challenge.bestScore}%
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      
      {/* Navbar Header */}
      <div className="bg-white border-b border-slate-200 py-4 px-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={playClickSound}
            className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-extrabold text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thoát</span>
          </Link>
          <span className="h-4 w-[2px] bg-slate-200" />
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>👩‍🏫</span> Báo Cáo Thành Tích Học Tập
          </h1>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>TẢI LẠI</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        
        {/* Profile Card */}
        {profile && (
          <div className="mb-8 bg-white rounded-3xl border border-indigo-100 shadow-sm p-6 flex items-center gap-6">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-4xl shadow-inner border-4 border-white">
              {profile.avatar || '👩‍🏫'}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">{profile.username}</h2>
              <p className="text-slate-500 font-semibold">{profile.email}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tài khoản Giáo viên
              </div>
            </div>
          </div>
        )}
        
        {/* Teacher Actions */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <Link
            href="/teacher/training"
            onClick={playClickSound}
            className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-600 text-white p-6 rounded-3xl shadow-md hover:shadow-lg transition-all flex items-center gap-4 group hover:-translate-y-1"
          >
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
              <span className="text-3xl">🧠</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-1">Huấn Luyện AI (Dành cho GV)</h3>
              <p className="text-indigo-100 text-sm font-medium">Tạo các mô hình AI chuẩn để làm mẫu cho học sinh.</p>
            </div>
          </Link>

          <Link
            href="/teacher/templates"
            onClick={playClickSound}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-3xl shadow-md hover:shadow-lg transition-all flex items-center gap-4 group hover:-translate-y-1"
          >
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
              <span className="text-3xl">📋</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-1">Quản Lý Mẫu (Templates)</h3>
              <p className="text-emerald-100 text-sm font-medium">Xem, quản lý và xuất bản các mô hình mẫu.</p>
            </div>
          </Link>
        </div>

        {/* Dataset Management Quick Links */}
        <div className="mb-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            🔍 Truy cập Hình Ảnh Bộ Dữ Liệu
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/teacher/datasets/teach"
              onClick={playClickSound}
              className="p-4 rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 transition-all flex items-center gap-3"
            >
              <span className="text-3xl">✋</span>
              <div>
                <div className="font-extrabold text-indigo-900 text-sm">Dạy AI Ngón tay</div>
                <div className="text-[10px] text-slate-400 font-semibold">Xem hình ảnh xương tay</div>
              </div>
            </Link>
            <Link
              href="/teacher/datasets/teach-two-hands"
              onClick={playClickSound}
              className="p-4 rounded-2xl border-2 border-orange-100 hover:border-orange-400 bg-orange-50/50 hover:bg-orange-50 transition-all flex items-center gap-3"
            >
              <span className="text-3xl">👐</span>
              <div>
                <div className="font-extrabold text-orange-900 text-sm">Dạy AI 2 Bàn Tay</div>
                <div className="text-[10px] text-slate-400 font-semibold">Xem hình ảnh xương tay</div>
              </div>
            </Link>
            <Link
              href="/teacher/datasets/teach-face"
              onClick={playClickSound}
              className="p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 transition-all flex items-center gap-3"
            >
              <span className="text-3xl">😀</span>
              <div>
                <div className="font-extrabold text-purple-900 text-sm">Dạy AI Cảm xúc</div>
                <div className="text-[10px] text-slate-400 font-semibold">Xem hình ảnh khung mặt</div>
              </div>
            </Link>
            <Link
              href="/teacher/datasets/teach-gestures"
              onClick={playClickSound}
              className="p-4 rounded-2xl border-2 border-teal-100 hover:border-teal-400 bg-teal-50/50 hover:bg-teal-50 transition-all flex items-center gap-3"
            >
              <span className="text-3xl">🤟</span>
              <div>
                <div className="font-extrabold text-teal-900 text-sm">Dạy AI Cử chỉ</div>
                <div className="text-[10px] text-slate-400 font-semibold">Xem hình ảnh xương tay</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Học sinh tham gia</p>
              <h4 className="text-3xl font-black text-slate-800">{loading ? '-' : stats.totalStudents}</h4>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl">
              <FileCheck className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Bài nộp (Bộ dữ liệu)</p>
              <h4 className="text-3xl font-black text-slate-800">{loading ? '-' : stats.totalDatasets}</h4>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-purple-100 text-purple-600 rounded-2xl">
              <Target className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Độ chính xác TB</p>
              <h4 className="text-3xl font-black text-slate-800">{loading ? '-' : `${stats.averageAccuracy}%`}</h4>
            </div>
          </div>
        </div>

        {/* Performance Report Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-extrabold text-slate-700 text-lg">Bảng Theo Dõi Quá Trình Học Tập</h3>
            <span className="text-xs font-semibold text-slate-400">Được sắp xếp theo điểm trung bình tốt nhất</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-1/4">Học sinh</th>
                  <th className="px-6 py-4 text-center border-l border-slate-100">🖐️ Ngón tay</th>
                  <th className="px-6 py-4 text-center border-l border-slate-100">👐 2 Bàn tay</th>
                  <th className="px-6 py-4 text-center border-l border-slate-100">😀 Cảm xúc</th>
                  <th className="px-6 py-4 text-center border-l border-slate-100">🤟 Cử chỉ</th>
                  <th className="px-6 py-4 text-center border-l border-slate-100 bg-indigo-50/30 text-indigo-600">Trung bình</th>
                  <th className="px-6 py-4 text-center border-l border-slate-100">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="inline-block animate-spin w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
                      <p className="text-sm font-semibold text-slate-500">Đang tổng hợp dữ liệu...</p>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-semibold italic">
                      Chưa có học sinh nào nộp bài.
                    </td>
                  </tr>
                ) : (
                  students.map(st => {
                    let totalScore = 0;
                    let completedTasks = 0;
                    if (st.teach.completed) { totalScore += st.teach.bestScore; completedTasks++; }
                    if (st.teachTwoHands.completed) { totalScore += st.teachTwoHands.bestScore; completedTasks++; }
                    if (st.teachFace.completed) { totalScore += st.teachFace.bestScore; completedTasks++; }
                    if (st.teachGestures.completed) { totalScore += st.teachGestures.bestScore; completedTasks++; }
                    
                    const avgScore = completedTasks > 0 ? Math.round(totalScore / 4) : 0;

                    return (
                      <tr key={st.user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{st.user.avatar || '🎓'}</span>
                            <div>
                              <div className="font-extrabold text-slate-800">{st.user.username}</div>
                              <div className="text-xs text-slate-400 font-semibold">{st.user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center border-l border-slate-100">
                          {renderStatus(st.teach)}
                        </td>
                        <td className="px-6 py-4 text-center border-l border-slate-100">
                          {renderStatus(st.teachTwoHands)}
                        </td>
                        <td className="px-6 py-4 text-center border-l border-slate-100">
                          {renderStatus(st.teachFace)}
                        </td>
                        <td className="px-6 py-4 text-center border-l border-slate-100">
                          {renderStatus(st.teachGestures)}
                        </td>
                        <td className="px-6 py-4 text-center border-l border-slate-100 bg-indigo-50/20">
                          {completedTasks === 0 ? (
                            <span className="text-xs text-slate-400 font-bold">-</span>
                          ) : (
                            <span className={`inline-block px-3 py-1 text-sm font-black rounded-xl ${
                              avgScore >= 80 ? 'bg-green-100 text-green-700' :
                              avgScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {avgScore}%
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center border-l border-slate-100">
                          <Link
                            href={`/teacher/students/${st.user?.id || 'unknown'}`}
                            onClick={playClickSound}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Xem
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

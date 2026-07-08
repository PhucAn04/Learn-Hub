'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowLeft, RefreshCw, Eye, Calendar, Award } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';

// Helper component to render mini hand skeletons from the 42-number normalized array
function HandMiniSkeleton({ features }: { features: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !features || features.length < 42) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Canvas dimensions are 80x80
    const cx = canvas.width / 2; // 40
    const cy = canvas.height / 2; // 40
    const scale = 25; // fit in canvas

    // Parse the 42 features back into {x, y} keypoints
    const kps: { x: number; y: number }[] = [];
    for (let i = 0; i < features.length; i += 2) {
      // Invert y axis so fingers point upwards properly
      kps.push({
        x: cx + features[i] * scale,
        y: cy - features[i + 1] * scale // inverted Y for screen space coordinate
      });
    }

    // Drawing connections helper
    const drawJointLine = (indices: number[]) => {
      ctx.beginPath();
      ctx.moveTo(kps[indices[0]].x, kps[indices[0]].y);
      for (let i = 1; i < indices.length; i++) {
        const p = kps[indices[i]];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };

    // Draw lines
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 5 fingers skeletons
    drawJointLine([0, 1, 2, 3, 4]); // thumb
    drawJointLine([0, 5, 6, 7, 8]); // index
    drawJointLine([0, 9, 10, 11, 12]); // middle
    drawJointLine([0, 13, 14, 15, 16]); // ring
    drawJointLine([0, 17, 18, 19, 20]); // pinky

    // Palm base connections
    drawJointLine([5, 9, 13, 17]);

    // Draw dots
    ctx.fillStyle = '#db2777';
    kps.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

  }, [features]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={80}
      className="bg-slate-50 border border-slate-200 rounded-xl"
      title="Khung xương tay mẫu"
    />
  );
}

export default function TeacherDashboard() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const data = await api.getSubmissions();
      setSubmissions(data);
      if (data.length > 0 && !selectedSubmission) {
        setSelectedSubmission(data[0]);
      }
    } catch (err) {
      console.error('Failed to load submissions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleRefresh = () => {
    playClickSound();
    fetchSubmissions();
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
            <span>👩‍🏫</span> Cổng Đánh Giá Của Giáo Viên
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

        {/* Dataset Management Navigation */}
        <div className="mb-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            📊 Quản lý Bộ Dữ Liệu theo Bài Tập
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/teacher/datasets/teach"
              onClick={playClickSound}
              className="p-4 rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 transition-all flex items-center gap-3"
            >
              <span className="text-3xl">✋</span>
              <div>
                <div className="font-extrabold text-indigo-900 text-sm">Ngón tay</div>
                <div className="text-[10px] text-slate-400 font-semibold">Xem bộ dữ liệu & timeline</div>
              </div>
            </Link>
            <Link
              href="/teacher/datasets/teach-face"
              onClick={playClickSound}
              className="p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 transition-all flex items-center gap-3"
            >
              <span className="text-3xl">😀</span>
              <div>
                <div className="font-extrabold text-purple-900 text-sm">Cảm xúc</div>
                <div className="text-[10px] text-slate-400 font-semibold">Xem bộ dữ liệu & timeline</div>
              </div>
            </Link>
            <Link
              href="/teacher/datasets/teach-gestures"
              onClick={playClickSound}
              className="p-4 rounded-2xl border-2 border-teal-100 hover:border-teal-400 bg-teal-50/50 hover:bg-teal-50 transition-all flex items-center gap-3"
            >
              <span className="text-3xl">🤟</span>
              <div>
                <div className="font-extrabold text-teal-900 text-sm">Cử chỉ</div>
                <div className="text-[10px] text-slate-400 font-semibold">Xem bộ dữ liệu & timeline</div>
              </div>
            </Link>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-indigo-600 rounded-full" role="status" />
            <p className="text-sm font-semibold text-slate-500 mt-2">Đang tải danh sách bài làm...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-inner">
            <span className="text-5xl">📭</span>
            <h3 className="text-lg font-bold text-slate-700 mt-4">Chưa có bài nộp nào</h3>
            <p className="text-slate-500 text-xs font-semibold mt-1">Học sinh chưa hoàn thành bài tập Dạy AI nhận diện ngón tay.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT: Student Submissions list */}
            <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider">Danh sách học sinh ({submissions.length})</h3>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {submissions.map(sub => {
                  const isSelected = selectedSubmission?.id === sub.id;
                  const dateString = new Date(sub.createdAt).toLocaleDateString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const userAvatar = sub.user?.avatar || '🐨';
                  const username = sub.user?.username || 'Học sinh ẩn danh';
                  
                  return (
                    <div
                      key={sub.id}
                      onClick={() => {
                        playClickSound();
                        setSelectedSubmission(sub);
                      }}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{userAvatar}</span>
                        <div>
                          <div className="font-extrabold text-slate-800 text-sm">{username}</div>
                          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>{dateString}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-1 text-xs font-black rounded-full ${
                          sub.accuracy >= 80
                            ? 'bg-green-100 text-green-700'
                            : sub.accuracy >= 50
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}>
                          {sub.accuracy}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Detailed view & dataset reconstruction */}
            <div className="lg:col-span-2 space-y-6">
              {selectedSubmission && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                  
                  {/* Student Title */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{selectedSubmission.user?.avatar}</span>
                      <div>
                        <h2 className="text-xl font-black text-slate-800">{selectedSubmission.user?.username}</h2>
                        <span className="text-xs text-slate-400 font-semibold">Tên đăng nhập: {selectedSubmission.user?.email}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2">
                      <Award className="w-5 h-5 text-indigo-600" />
                      <div>
                        <span className="text-[9px] text-indigo-700 font-bold block uppercase leading-none">Chấm tự động</span>
                        <span className="text-base font-black text-indigo-900 leading-none">{selectedSubmission.accuracy}% Đạt</span>
                      </div>
                    </div>
                  </div>

                  {/* Reflection Question Answer */}
                  <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                    <h4 className="text-xs font-black text-indigo-800 uppercase tracking-wide mb-1">
                      Câu trả lời phản tư và lời nhắn của học sinh:
                    </h4>
                    <p className="text-sm font-semibold text-slate-700 italic">
                      "{selectedSubmission.reflectionAnswer || 'Không để lại lời nhắn.'}"
                    </p>
                  </div>

                  {/* Dataset Analysis & Reconstruction */}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-indigo-500" />
                      <span>Chi tiết các tư thế tay học sinh đã chụp dạy AI ({selectedSubmission.dataset?.length || 0} mẫu)</span>
                    </h3>

                    {!selectedSubmission.dataset || selectedSubmission.dataset.length === 0 ? (
                      <p className="text-sm text-slate-400 font-semibold italic">Không tìm thấy tập dữ liệu đính kèm.</p>
                    ) : (
                      <div className="space-y-6">
                        {/* Group samples by label */}
                        {['1 Ngón Tay ☝️', '2 Ngón Tay ✌️'].map(label => {
                          const labelSamples = selectedSubmission.dataset.filter((s: any) => s.label === label);
                          
                          return (
                            <div key={label} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                              <h4 className="font-extrabold text-xs text-slate-600 mb-3 flex items-center justify-between">
                                <span>Nhãn: {label}</span>
                                <span className="bg-slate-200/80 px-2 py-0.5 rounded text-[10px] text-slate-600">
                                  {labelSamples.length} mẫu dữ liệu
                                </span>
                              </h4>
                              
                              {labelSamples.length === 0 ? (
                                <p className="text-xs text-slate-400 font-semibold italic">Học sinh chưa chụp mẫu cho nhóm này.</p>
                              ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                                  {labelSamples.map((sample: any, index: number) => (
                                    <div key={index} className="flex flex-col items-center gap-1">
                                      <HandMiniSkeleton features={sample.features} />
                                      <span className="text-[9px] text-slate-400 font-bold">Mẫu {index + 1}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usePageData } from '@/hooks/usePageData';
import { ArrowLeft, RefreshCw, BarChart3, Eye, AlertTriangle, Clock } from 'lucide-react';
import ProgressChart, { ChartPoint } from '@/components/teacher/ProgressChart';
import SkillSummary from '@/components/teacher/SkillSummary';
import { api } from '@/lib/api';
import { playClickSound } from '@/lib/audio';
import type { ModelEvaluation, AssessmentResponse } from '@/types/models';

interface DatasetWithModel {
  id: string;
  userId: string;
  challengeType: string;
  sampleCount: number;
  classSummary?: Record<string, number>;
  createdAt: string;
  user?: { id: string; username: string; avatar?: string; email: string };
  model?: {
    id: string;
    testScore: number;
    version?: number;
    evaluation?: ModelEvaluation;
    teacherFeedback?: string;
  } | null;
}

interface ChallengeData {
  challengeType: string;
  label: string;
  emoji: string;
  datasets: DatasetWithModel[];
  bestScore: number;
  latestVersion: number;
}

const CHALLENGES = [
  { type: 'teach', label: '1 Ngón tay', emoji: '☝️' },
  { type: 'teach-two-hands', label: '2 Bàn tay', emoji: '👐' },
  { type: 'teach-face', label: 'Cảm xúc', emoji: '😀' },
  { type: 'teach-gestures', label: 'Cử chỉ', emoji: '🤟' },
];

export default function TeacherStudentDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [selectedChallenge, setSelectedChallenge] = useState<string>('teach');

  const { data, loading, refetch: fetchData } = usePageData(async () => {
    if (!userId || userId === 'undefined') return null;

    let sName = '';
    let sAvatar = '🎓';

    const assessments = (await api.getAssessmentsByUser(userId).catch(() => [])) as AssessmentResponse[];

    const results = await Promise.all(
      CHALLENGES.map(async (ch) => {
        const datasets: DatasetWithModel[] = await api.getDatasetsByChallenge(ch.type).catch(() => []);
        const userDatasets = datasets.filter(ds => ds.userId === userId);

        userDatasets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        let bestScore = 0;
        let latestVersion = 0;
        userDatasets.forEach(ds => {
          const score = ds.model?.testScore || 0;
          if (score > bestScore) bestScore = score;
          const ver = ds.model?.version || 0;
          if (ver > latestVersion) latestVersion = ver;
        });

        if (userDatasets.length > 0 && userDatasets[0].user) {
          sName = userDatasets[0].user.username;
          sAvatar = userDatasets[0].user.avatar || '🎓';
        }

        const assessment = assessments.find((a: AssessmentResponse) => a.challengeType === ch.type);

        return {
          challengeType: ch.type,
          label: ch.label,
          emoji: ch.emoji,
          datasets: userDatasets,
          bestScore,
          latestVersion,
          assessment,
        };
      })
    );

    return { studentName: sName, studentAvatar: sAvatar, challengeData: results };
  }, [userId], Boolean(userId && userId !== 'undefined'));

  const studentName = data?.studentName || '';
  const studentAvatar = data?.studentAvatar || '🎓';
  const challengeData = data?.challengeData || [];

  const current = challengeData.find(c => c.challengeType === selectedChallenge);
  const datasets = current?.datasets || [];

  // Build chart data points
  const chartPoints = datasets.map((ds, i) => ({
    version: ds.model?.version || i + 1,
    score: ds.model?.testScore || 0,
    date: new Date(ds.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    modelId: ds.model?.id,
    sampleCount: ds.sampleCount,
    weakestLabel: ds.model?.evaluation?.confusionMatrix?.weakestLabel,
  }));

  // Simple SVG chart
  const chartWidth = 480;
  const chartHeight = 200;
  const padding = { top: 20, right: 30, bottom: 40, left: 40 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-4 px-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/teacher" onClick={playClickSound} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-extrabold text-sm">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Link>
          <span className="h-4 w-[2px] bg-slate-200" />
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-3xl">{studentAvatar}</span> {studentName || 'Học sinh'}
          </h1>
        </div>
        <button onClick={() => { playClickSound(); fetchData(); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> TẢI LẠI
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8">
        {/* Challenge Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {CHALLENGES.map(ch => {
            const data = challengeData.find(c => c.challengeType === ch.type);
            const hasData = (data?.datasets.length || 0) > 0;
            return (
              <button
                key={ch.type}
                onClick={() => { playClickSound(); setSelectedChallenge(ch.type); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold whitespace-nowrap transition-all ${
                  selectedChallenge === ch.type
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : hasData
                      ? 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
                      : 'bg-slate-100 text-slate-400 cursor-default'
                }`}
              >
                <span className="text-lg">{ch.emoji}</span> {ch.label}
                {data && data.latestVersion > 0 && (
                  <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">V{data.latestVersion}</span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 font-semibold italic">Học sinh chưa nộp bài cho challenge này.</p>
          </div>
        ) : (
          <>
            {/* Skill Summary */}
            {current?.assessment && <SkillSummary assessment={current.assessment} />}

            {/* Progress Chart */}
            <ProgressChart points={chartPoints} />

            {/* Version List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-extrabold text-slate-700 text-lg flex items-center gap-1.5">
                  <BarChart3 className="w-5 h-5 text-indigo-500" /> Danh Sách Các Lần Nộp Bài
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {[...datasets].reverse().map((ds, i) => {
                  const score = ds.model?.testScore || 0;
                  const ver = ds.model?.version || datasets.length - i;
                  const eval_ = ds.model?.evaluation;
                  const date = new Date(ds.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={ds.id} className="px-6 py-4 hover:bg-slate-50/80 transition-colors flex items-center gap-4">
                      {/* Version Badge */}
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-indigo-700 font-black text-sm">V{ver}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-block px-2 py-0.5 text-xs font-black rounded-full ${
                            score >= 80 ? 'bg-green-100 text-green-700' :
                            score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{score}%</span>
                          <span className="text-xs text-slate-400 font-medium">{ds.sampleCount} ảnh</span>
                          {eval_?.datasetHealth && (
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                              eval_.datasetHealth.phase === 'PHASE_B' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {eval_.datasetHealth.phase === 'PHASE_B' ? '✅ Hoàn hảo' : '⚠️ Cần cải thiện'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {date}</span>
                          {eval_?.confusionMatrix?.weakestLabel && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <AlertTriangle className="w-3 h-3" /> Yếu: {eval_.confusionMatrix.weakestLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      {ds.model?.id && (
                        <Link
                          href={`/teacher/students/${userId}/models/${ds.model.id}`}
                          onClick={playClickSound}
                          className="flex items-center gap-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" /> Chi tiết
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

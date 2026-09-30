'use client';

import React from 'react';
import { Award, Target, Zap, Activity } from 'lucide-react';
import type { AssessmentResponse } from '@/types/models';

interface SkillSummaryProps {
  assessment: AssessmentResponse;
}

export default function SkillSummary({ assessment }: SkillSummaryProps) {
  if (!assessment) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-extrabold text-slate-700 text-lg flex items-center gap-1.5">
          <Award className="w-5 h-5 text-amber-500" /> Kỹ Năng Tổng Kết
        </h3>
      </div>
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
          <div className="flex-shrink-0 relative">
            <svg viewBox="0 0 100 100" className="w-24 h-24">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="#6366f1" 
                strokeWidth="8" 
                strokeDasharray={`${(assessment.overallScore / 100) * 283} 283`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-800">{assessment.overallScore}</span>
              <span className="text-[10px] font-bold text-slate-400">/100</span>
            </div>
          </div>
          <div className="flex-1 space-y-4 w-full">
            {[
              { label: 'Tinh lọc dữ liệu', score: assessment.dataCurationScore, icon: <Target className="w-4 h-4 text-emerald-500" />, color: 'bg-emerald-500' },
              { label: 'Sửa lỗi thông minh', score: assessment.debuggingScore, icon: <Activity className="w-4 h-4 text-blue-500" />, color: 'bg-blue-500' },
              { label: 'Mức cải thiện', score: assessment.improvementScore, icon: <Zap className="w-4 h-4 text-purple-500" />, color: 'bg-purple-500' },
            ].map(skill => (
              <div key={skill.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {skill.icon}
                    <span className="text-sm font-bold text-slate-700">{skill.label}</span>
                  </div>
                  <span className="text-sm font-black text-slate-700">{skill.score}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${skill.color}`} style={{ width: `${skill.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {assessment.narrative && (
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <p className="text-sm text-indigo-900 font-medium mb-3">{assessment.narrative.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-emerald-700 mb-1">Điểm mạnh:</h4>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                  {assessment.narrative.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-700 mb-1">Cần cải thiện:</h4>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                  {assessment.narrative.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

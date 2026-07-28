'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DatasetResponse } from '@/types/models';
import { Database, Plus, Search, BookOpen, Clock, Users } from 'lucide-react';
import Link from 'next/link';

export default function TeacherTemplatesPage() {
  const [templates, setTemplates] = useState<DatasetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await api.getTemplates(filter === 'all' ? undefined : filter);
        setTemplates(data);
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      } finally {
        setLoading(false);
      }
    };
    
    setLoading(true);
    fetchTemplates();
  }, [filter]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header section */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
            <Database className="w-10 h-10" /> Thư Viện Dữ Liệu Mẫu
          </h1>
          <p className="text-indigo-100 font-medium text-lg">
            Quản lý và chia sẻ các bộ dữ liệu chuẩn (Templates) để học sinh học tập và tham khảo.
          </p>
        </div>
        <Link 
          href="/teacher/training"
          className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all border-b-4 border-indigo-200 active:border-b-0 active:translate-y-1 flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Tạo Template Mới
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-2 sm:pb-0">
          {['all', 'teach', 'teach-two-hands', 'teach-face', 'teach-gestures'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${
                filter === type 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm mẫu..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white h-64 rounded-3xl border-2 border-gray-100"></div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">Chưa có bộ dữ liệu mẫu nào</h3>
          <p className="text-gray-500 mb-6">Hãy tạo bộ dữ liệu đầu tiên để hướng dẫn học sinh nhé!</p>
          <Link 
            href="/teacher/training"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" /> Bắt đầu tạo ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates
            .filter(t => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                t.challengeType?.toLowerCase().includes(q) ||
                t.teacherNotes?.toLowerCase().includes(q) ||
                Object.keys(t.classSummary || {}).some((l: string) => l.toLowerCase().includes(q))
              );
            })
            .map(template => (
            <div key={template.id} className="bg-white rounded-3xl p-5 border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black uppercase tracking-wider">
                  {template.challengeType}
                </span>
                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3" /> Public
                </span>
              </div>
              
              <h3 className="text-lg font-black text-gray-800 mb-2">
                Bộ mẫu: {template.challengeType}
              </h3>
              
              <div className="flex-1 space-y-3 mb-6">
                <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Tổng số ảnh</span>
                  <span className="text-sm font-black text-indigo-600">{template.sampleCount}</span>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-3">
                  <span className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Phân bố nhãn</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(template.classSummary || {}).map(([label, count]) => (
                      <span key={label} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-700">
                        {label}: <span className="text-indigo-500">{count as React.ReactNode}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {template.teacherNotes && (
                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl text-xs font-medium">
                    <strong>Ghi chú:</strong> {template.teacherNotes}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(template.createdAt).toLocaleDateString('vi-VN')}
                </div>
                <Link 
                  href={`/teacher/templates/${template.id}`}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors"
                >
                  Xem chi tiết
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

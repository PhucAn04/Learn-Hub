'use client';

import React, { useEffect, useState } from 'react';
import { X, BookOpen, Database, Eye, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';

interface TemplateViewerProps {
  template: {
    id: string;
    challengeType: string;
    sampleCount: number;
    classSummary: Record<string, number>;
    teacherNotes?: string;
    createdAt: string;
    user?: { displayName?: string; email?: string };
  };
  onClose: () => void;
}

interface SampleData {
  label: string;
  thumbnail?: string;
  rawThumbnail?: string;
  features?: number[];
}

export default function TemplateViewer({ template, onClose }: TemplateViewerProps) {
  const [samples, setSamples] = useState<SampleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchSamples = async () => {
      try {
        const data = await api.getDatasetFile(template.id);
        setSamples(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load template data:', err);
        setError('Không thể tải dữ liệu mẫu. Hãy thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    fetchSamples();
  }, [template.id]);

  const labels = Object.keys(template.classSummary || {});
  const filteredSamples = selectedLabel
    ? samples.filter(s => s.label === selectedLabel)
    : samples;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <Eye className="w-6 h-6" />
              Xem Mẫu: {template.challengeType}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-indigo-200">
              {template.user?.displayName && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> {template.user.displayName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {new Date(template.createdAt).toLocaleDateString('vi-VN')}
              </span>
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> {template.sampleCount} mẫu
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Teacher Notes */}
        {template.teacherNotes && (
          <div className="mx-6 mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl">
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-black text-yellow-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Ghi Chú Từ Giáo Viên
              </span>
              {showDetails ? <ChevronUp className="w-4 h-4 text-yellow-700" /> : <ChevronDown className="w-4 h-4 text-yellow-700" />}
            </button>
            {showDetails && (
              <p className="mt-2 text-sm text-yellow-800 font-medium leading-relaxed">
                {template.teacherNotes}
              </p>
            )}
          </div>
        )}

        {/* Label Tabs */}
        <div className="px-6 pt-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedLabel(null)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              selectedLabel === null
                ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Tất cả ({samples.length})
          </button>
          {labels.map(label => (
            <button
              key={label}
              onClick={() => setSelectedLabel(label)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                selectedLabel === label
                  ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label} ({template.classSummary[label] || 0})
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-600 font-bold">{error}</p>
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="text-center py-16">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-bold">Không có mẫu nào.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filteredSamples.map((sample, idx) => (
                <div
                  key={idx}
                  className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-indigo-300 transition-colors bg-gray-50"
                >
                  {(sample.thumbnail || sample.rawThumbnail) ? (
                    <img
                      src={sample.thumbnail || sample.rawThumbnail}
                      alt={`Mẫu ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Database className="w-8 h-8" />
                    </div>
                  )}
                  {/* Label overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-white text-[10px] font-bold leading-tight line-clamp-2">
                      {sample.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

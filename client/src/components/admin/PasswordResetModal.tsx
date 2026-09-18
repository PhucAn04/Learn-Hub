'use client';

import React, { useState } from 'react';
import { X, Mail, Link as LinkIcon, Check, Copy } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
}

export default function PasswordResetModal({
  isOpen,
  onClose,
  userId,
  userName,
  userEmail
}: PasswordResetModalProps) {
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    setLoadingEmail(true);
    try {
      await adminApi.sendResetEmail(userId);
      setEmailSent(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(error.message || 'Lỗi khi gửi email');
      } else {
        alert('Lỗi khi gửi email');
      }
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoadingLink(true);
    try {
      const { resetLink } = await adminApi.generateResetLink(userId);
      setResetLink(resetLink);
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(error.message || 'Lỗi khi tạo link');
      } else {
        alert('Lỗi khi tạo link');
      }
    } finally {
      setLoadingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-800">Cấp lại mật khẩu</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-slate-600 mb-6 text-sm">
            Bạn đang thao tác cấp lại mật khẩu cho tài khoản <strong>{userName}</strong> ({userEmail}).
            Hãy chọn một trong hai phương thức dưới đây.
          </p>

          <div className="space-y-6">
            {/* Option A: Gửi Email */}
            <div className="border border-indigo-100 bg-indigo-50/30 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                  <Mail size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-slate-800 text-sm">Phương thức 1: Gửi Email Tự Động</h4>
                  <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">
                    Hệ thống sẽ gửi một đường dẫn an toàn vào hòm thư <strong>{userEmail}</strong>. 
                    Người dùng sẽ tự bấm vào email để đặt lại mật khẩu.
                  </p>
                  
                  {emailSent ? (
                    <div className="flex items-center text-green-600 text-sm font-medium">
                      <Check size={16} className="mr-1" /> Đã gửi email thành công
                    </div>
                  ) : (
                    <button 
                      onClick={handleSendEmail} 
                      disabled={loadingEmail || loadingLink}
                      className="text-xs px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center"
                    >
                      {loadingEmail ? 'Đang gửi...' : 'Gửi link qua Email'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium">HOẶC</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Option B: Copy Link */}
            <div className="border border-slate-200 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 p-2 rounded-full text-slate-600">
                  <LinkIcon size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-slate-800 text-sm">Phương thức 2: Copy Link Thủ Công</h4>
                  <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">
                    Tạo đường dẫn đặt lại mật khẩu và gửi trực tiếp cho người dùng qua Zalo/Teams.
                  </p>
                  
                  {!resetLink ? (
                    <button 
                      onClick={handleGenerateLink} 
                      disabled={loadingEmail || loadingLink}
                      className="text-xs px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded font-medium hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      {loadingLink ? 'Đang tạo...' : 'Tạo link (Thủ công)'}
                    </button>
                  ) : (
                    <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center">
                        <input 
                          type="text" 
                          readOnly 
                          value={resetLink} 
                          className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-l focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 font-mono"
                        />
                        <button 
                          onClick={handleCopyLink}
                          className="px-3 py-2 bg-slate-800 text-white rounded-r text-xs font-medium hover:bg-slate-700 transition flex items-center"
                        >
                          {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                          {copied ? 'Đã copy' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-600 font-medium">
                        ⚠️ Lời khuyên: Link này chỉ có hiệu lực 15 phút. Tuyệt đối không gửi vào nhóm chat chung.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

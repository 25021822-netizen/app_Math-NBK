import React, { useState, useMemo } from 'react';
import {
  AdminBroadcastMessage,
  BroadcastTargetAudience,
  getBroadcastAudienceLabel,
} from '../../types/math';
import {
  Megaphone,
  Send,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Search,
  Users,
  ShieldCheck,
  Clock,
  GraduationCap,
  BookOpen,
} from 'lucide-react';

interface AdminBroadcastViewProps {
  adminBroadcasts: AdminBroadcastMessage[];
  totalRecipientsCount?: number;
  teacherRecipientsCount?: number;
  studentRecipientsCount?: number;
  onSendBroadcast: (payload: {
    title: string;
    content: string;
    priority: 'normal' | 'important';
    targetAudience: BroadcastTargetAudience;
  }) => void | Promise<void>;
  onDeleteBroadcastGlobally: (broadcastId: string) => void | Promise<void>;
}

function formatDateTimeSafe(iso: string): string {
  if (!iso) return 'Vừa xong';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Vừa xong';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const AdminBroadcastView: React.FC<AdminBroadcastViewProps> = ({
  adminBroadcasts,
  totalRecipientsCount = 0,
  teacherRecipientsCount = 0,
  studentRecipientsCount = 0,
  onSendBroadcast,
  onDeleteBroadcastGlobally,
}) => {
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'important'>('normal');
  const [targetAudience, setTargetAudience] = useState<BroadcastTargetAudience>('all');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'normal' | 'important'>('all');
  const [audienceFilter, setAudienceFilter] = useState<'all_filter' | BroadcastTargetAudience>('all_filter');
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const selectedRecipientCount =
    targetAudience === 'teacher'
      ? teacherRecipientsCount
      : targetAudience === 'student'
      ? studentRecipientsCount
      : totalRecipientsCount;

  const submitButtonLabel =
    targetAudience === 'teacher'
      ? 'Gửi Thông Báo Tới Giáo Viên'
      : targetAudience === 'student'
      ? 'Gửi Thông Báo Tới Học Sinh'
      : 'Gửi Thông Báo Tới Tất Cả Mọi Người';

  const handleSendBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastError(null);
    const cleanTitle = broadcastTitle.trim();
    const cleanContent = broadcastContent.trim();
    if (!cleanTitle || !cleanContent) {
      setBroadcastError('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo!');
      return;
    }

    const sentTarget = targetAudience;
    setIsSendingBroadcast(true);
    try {
      await onSendBroadcast({
        title: cleanTitle,
        content: cleanContent,
        priority: broadcastPriority,
        targetAudience: sentTarget,
      });
      setBroadcastTitle('');
      setBroadcastContent('');
      setBroadcastPriority('normal');
      setTargetAudience('all');
      setBroadcastFeedback(
        `Đã gửi thông báo thành công tới nhóm "${getBroadcastAudienceLabel(sentTarget)}" và hiển thị trực tiếp trong mục Nhóm Lớp!`
      );
      setTimeout(() => setBroadcastFeedback(null), 4500);
    } catch (err: any) {
      setBroadcastError(err?.message || 'Không thể gửi thông báo lúc này. Vui lòng thử lại!');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleConfirmRevoke = async (broadcastId: string) => {
    setRevokingId(broadcastId);
    try {
      await onDeleteBroadcastGlobally(broadcastId);
      setConfirmRevokeId(null);
    } finally {
      setRevokingId(null);
    }
  };

  const filteredBroadcasts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (adminBroadcasts || []).filter((item) => {
      if (!item || !item.id) return false;
      const itemAudience: BroadcastTargetAudience =
        item.targetAudience === 'teacher' || item.targetAudience === 'student' ? item.targetAudience : 'all';
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesAudience = audienceFilter === 'all_filter' || itemAudience === audienceFilter;
      const matchesQuery =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.content || '').toLowerCase().includes(q);
      return matchesPriority && matchesAudience && matchesQuery;
    });
  }, [adminBroadcasts, searchTerm, priorityFilter, audienceFilter]);

  const importantCount = useMemo(
    () => (adminBroadcasts || []).filter((b) => b.priority === 'important').length,
    [adminBroadcasts]
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
            <ShieldCheck size={16} />
            <span>Chức Năng Riêng Của Quản Trị Viên</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Thông Báo Chung Hệ Thống</h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Gửi tin nhắn thông báo đến tất cả mọi người, chỉ Giáo viên hoặc chỉ Học sinh. Nội dung sẽ hiển thị tại mục Nhóm Lớp của đúng đối tượng nhận.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-xs border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-5 w-full sm:w-auto">
          <div>
            <span className="text-slate-400 font-semibold block">Đã phát</span>
            <span className="text-xl font-black text-slate-900 font-mono tabular-nums">
              {adminBroadcasts.length}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-slate-400 font-semibold block">Quan trọng</span>
            <span className="text-xl font-black text-rose-600 font-mono tabular-nums">
              {importantCount}
            </span>
          </div>
          {totalRecipientsCount > 0 && (
            <>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 font-semibold block">Tài khoản nhận</span>
                <span className="text-xl font-black text-blue-600 font-mono tabular-nums flex items-center gap-1">
                  <Users size={15} />
                  <span>{selectedRecipientCount}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compose Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Megaphone size={20} />
          </div>
          <div>
            <h2 className="font-extrabold text-base text-slate-900">Soạn Thông Báo Mới</h2>
            <p className="text-xs text-slate-500">
              Chọn nhóm người nhận phù hợp; thông báo sau khi gửi sẽ đồng bộ tức thời đến đúng đối tượng.
            </p>
          </div>
        </div>

        {broadcastFeedback && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{broadcastFeedback}</span>
          </div>
        )}

        {broadcastError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{broadcastError}</span>
          </div>
        )}

        <form onSubmit={handleSendBroadcastSubmit} className="space-y-4 text-xs">
          {/* Đối tượng nhận thông báo */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">Đối tượng nhận thông báo *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTargetAudience('all')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  targetAudience === 'all'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    targetAudience === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-xs">Tất cả mọi người</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    Giáo viên & Học sinh ({totalRecipientsCount})
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('teacher')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  targetAudience === 'teacher'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    targetAudience === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  <BookOpen size={16} />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-xs">Chỉ Giáo viên</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    Tài khoản giáo viên ({teacherRecipientsCount})
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('student')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  targetAudience === 'student'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    targetAudience === 'student' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  <GraduationCap size={16} />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-xs">Chỉ Học sinh</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    Tài khoản học sinh ({studentRecipientsCount})
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">Tiêu đề thông báo *</label>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {broadcastTitle.length}/140
                </span>
              </div>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="VD: Thông báo lịch thi thử THPT / Lịch họp chuyên môn giáo viên..."
                required
                maxLength={140}
                className="w-full h-11 px-3.5 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Mức độ ưu tiên</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 h-11">
                <button
                  type="button"
                  onClick={() => setBroadcastPriority('normal')}
                  className={`rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    broadcastPriority === 'normal'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Thông thường
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastPriority('important')}
                  className={`rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    broadcastPriority === 'important'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Quan trọng
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700">Nội dung tin nhắn thông báo *</label>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {broadcastContent.length} ký tự
              </span>
            </div>
            <textarea
              value={broadcastContent}
              onChange={(e) => setBroadcastContent(e.target.value)}
              placeholder={`Nhập nội dung chi tiết cần gửi tới ${getBroadcastAudienceLabel(targetAudience).toLowerCase()}...`}
              rows={4}
              required
              className="w-full p-3.5 rounded-2xl border border-slate-300 text-xs text-slate-900 focus:border-blue-600 focus:outline-none resize-y leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSendingBroadcast || !broadcastTitle.trim() || !broadcastContent.trim()}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Send size={15} />
              <span>{isSendingBroadcast ? 'Đang gửi thông báo...' : submitButtonLabel}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast History */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BellRing size={18} className="text-blue-600" />
            <h2 className="font-extrabold text-sm text-slate-900">
              Lịch Sử Thông Báo Đã Phát ({filteredBroadcasts.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setAudienceFilter('all_filter')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  audienceFilter === 'all_filter' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Mọi nhóm
              </button>
              <button
                type="button"
                onClick={() => setAudienceFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  audienceFilter === 'all' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Tất cả mọi người
              </button>
              <button
                type="button"
                onClick={() => setAudienceFilter('teacher')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  audienceFilter === 'teacher' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Giáo viên
              </button>
              <button
                type="button"
                onClick={() => setAudienceFilter('student')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  audienceFilter === 'student' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Học sinh
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPriorityFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  priorityFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter('normal')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  priorityFilter === 'normal' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Thông thường
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter('important')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  priorityFilter === 'important' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Quan trọng
              </button>
            </div>

            <div className="relative flex-1 sm:flex-initial">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tiêu đề, nội dung..."
                className="h-9 pl-8 pr-3 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none w-full sm:w-48"
              />
            </div>
          </div>
        </div>

        {filteredBroadcasts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
            {adminBroadcasts.length === 0
              ? 'Chưa có thông báo hệ thống nào được gửi. Hãy soạn thông báo ở khung phía trên.'
              : 'Không tìm thấy thông báo nào phù hợp với bộ lọc hiện tại.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBroadcasts.map((item) => {
              const deletedCount = Array.isArray(item.deletedByUserIds) ? item.deletedByUserIds.length : 0;
              const isImportant = item.priority === 'important';
              const audience: BroadcastTargetAudience =
                item.targetAudience === 'teacher' || item.targetAudience === 'student' ? item.targetAudience : 'all';
              const audienceColor =
                audience === 'teacher'
                  ? 'text-indigo-700'
                  : audience === 'student'
                  ? 'text-emerald-700'
                  : 'text-slate-600';
              const isConfirming = confirmRevokeId === item.id;
              const isRevoking = revokingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs ${
                    isImportant ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-bold ${isImportant ? 'text-rose-700' : 'text-blue-700'}`}>
                        {isImportant ? 'Quan trọng' : 'Thông báo chung'}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className={`font-bold ${audienceColor}`}>
                        Gửi tới: {getBroadcastAudienceLabel(audience)}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-500 font-mono tabular-nums inline-flex items-center gap-1">
                        <Clock size={12} />
                        {formatDateTimeSafe(item.createdAt)}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-slate-900">{item.title}</h3>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>

                    <div className="text-[11px] text-slate-500 pt-1 tabular-nums">
                      Đã có <strong className="text-slate-800">{deletedCount}</strong> tài khoản xóa hẳn thông báo này khỏi hộp thư cá nhân.
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-start">
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(null)}
                          disabled={isRevoking}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmRevoke(item.id)}
                          disabled={isRevoking}
                          className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          {isRevoking ? 'Đang thu hồi...' : 'Xác Nhận Thu Hồi'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeId(item.id)}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 size={14} />
                        <span>Thu hồi tất cả</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

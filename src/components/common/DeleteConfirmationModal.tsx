import React from 'react';
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  itemType: 'exam' | 'lesson' | 'custom';
  title: string;
  itemName: string;
  itemSubtitle?: string;
  impactDetails?: string[];
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  itemType,
  title,
  itemName,
  itemSubtitle,
  impactDetails,
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const defaultExamImpact = [
    'Toàn bộ câu hỏi, cấu trúc và đáp án chi tiết của đề thi',
    'Tất cả bài thi đã nộp, bảng điểm và lịch sử làm bài của học sinh đối với đề này',
    'Mọi nhật ký cảnh báo vi phạm quy chế thi (cheat logs) liên quan',
    'Gỡ đề thi khỏi danh sách giao của tất cả các nhóm lớp',
    'Dữ liệu sẽ bị xóa vĩnh viễn trên cơ sở dữ liệu Firestore và máy chủ, không thể khôi phục',
  ];

  const defaultLessonImpact = [
    'Nội dung lý thuyết (Ô Bài học) và hệ thống bài tập rèn luyện (Ô Luyện tập)',
    'Tất cả các tệp PDF tài liệu đính kèm (PDF bài học & PDF luyện tập)',
    'Dữ liệu tiến độ học tập và lịch sử đánh dấu đã học của học sinh trong lớp',
    'Dữ liệu sẽ bị xóa vĩnh viễn trên cơ sở dữ liệu Firestore và máy chủ, không thể khôi phục',
  ];

  const details = impactDetails || (itemType === 'exam' ? defaultExamImpact : defaultLessonImpact);

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-150 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-amber-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 shadow-xs">
              <AlertTriangle size={24} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-wider text-rose-600 block">
                Cảnh Báo Thao Tác Nguy Hiểm
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Item Info Card */}
        <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-1">
          <span className="text-[10px] font-bold uppercase text-rose-700 block">
            {itemType === 'exam' ? 'Đề thi được chọn để xóa:' : itemType === 'lesson' ? 'Bài học được chọn để xóa:' : 'Mục được chọn để xóa:'}
          </span>
          <h4 className="font-extrabold text-sm text-slate-900 break-words">
            {itemName}
          </h4>
          {itemSubtitle && (
            <p className="text-xs text-slate-600 font-medium">
              {itemSubtitle}
            </p>
          )}
        </div>

        {/* Data Loss Warning Box */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <ShieldAlert size={15} className="text-rose-600" />
            <span>Mọi dữ liệu liên quan sau đây sẽ bị xóa hoàn toàn:</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            {details.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-700">
                <span className="text-rose-500 font-bold leading-none mt-1">✕</span>
                <span className="leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirmation Question */}
        <p className="text-xs text-slate-600 text-center font-semibold">
          Bạn có chắc chắn muốn tiếp tục? Thao tác này <strong className="text-rose-600 font-bold">không thể hoàn tác</strong>!
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors disabled:opacity-40"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang Xóa Dữ Liệu...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Xác Nhận Xóa Vĩnh Viễn</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

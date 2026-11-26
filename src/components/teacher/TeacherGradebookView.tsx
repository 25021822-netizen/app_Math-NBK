import React, { useState, useMemo, lazy, Suspense } from 'react';
import { Classroom, StudentExamSubmission, Exam, UserRole } from '../../types/math';
import { MathView } from '../MathView';
import { ExamImage } from '../common/ExamImage';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';
import {
  classifyScoreByScale,
  computeExamQuestionStats,
  computeGradebookAnalytics,
  formatPointsNumber,
  getExamScaleInfo,
  getSubmissionScalePoints,
  isAnswerEquivalent,
  type ScoreRankKey,
} from '../../lib/scoringEngine';
import {
  Award,
  Users,
  Search,
  BarChart3,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowUpDown,
  X,
  FileText,
  Trash2,
  ClipboardList,
  RotateCcw,
  Calendar,
  ExternalLink,
  XCircle,
  MinusCircle,
} from 'lucide-react';

const GradebookPdfReportModal = lazy(() =>
  import('./GradebookPdfReportModal').then((m) => ({ default: m.GradebookPdfReportModal }))
);

interface TeacherGradebookViewProps {
  classrooms: Classroom[];
  submissions: StudentExamSubmission[];
  examsList: Exam[];
  userRole?: UserRole;
  onSelectClassroom?: (classId: string) => void;
  onPreviewExam?: (examId: string) => void;
  onDeleteExam?: (examId: string) => void;
  onDeleteSubmission?: (submissionId: string) => Promise<void> | void;
  onDeleteMultipleSubmissions?: (submissionIds: string[]) => Promise<void> | void;
}

const formatSubmissionDateTime = (iso: string) => {
  const dateObj = new Date(iso);
  if (Number.isNaN(dateObj.getTime())) {
    return { time: '--:--:--', date: 'Không rõ', full: 'Không rõ' };
  }
  const time = dateObj.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const date = dateObj.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return { time, date, full: `${time} · ${date}` };
};

const formatDurationSpent = (seconds: number) => {
  const safeSec = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  if (mins === 0) return `${secs} giây`;
  if (secs === 0) return `${mins} phút`;
  return `${mins}p ${secs}s`;
};

const RANK_STYLE_MAP: Record<
  ScoreRankKey,
  { shortLabel: string; textClass: string; barClass: string; dotBgClass: string }
> = {
  excellent: {
    shortLabel: 'Giỏi',
    textClass: 'text-emerald-700',
    barClass: 'bg-emerald-500',
    dotBgClass: 'bg-emerald-600',
  },
  good: {
    shortLabel: 'Khá',
    textClass: 'text-blue-700',
    barClass: 'bg-blue-500',
    dotBgClass: 'bg-blue-600',
  },
  average: {
    shortLabel: 'TB',
    textClass: 'text-amber-700',
    barClass: 'bg-amber-500',
    dotBgClass: 'bg-amber-600',
  },
  below: {
    shortLabel: 'Yếu',
    textClass: 'text-rose-700',
    barClass: 'bg-rose-500',
    dotBgClass: 'bg-rose-600',
  },
};

export const TeacherGradebookView: React.FC<TeacherGradebookViewProps> = ({
  classrooms,
  submissions,
  examsList,
  userRole = 'teacher',
  onPreviewExam,
  onDeleteSubmission,
  onDeleteMultipleSubmissions,
}) => {
  // Bộ lọc & Điều hướng tab
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [searchStudentTerm, setSearchStudentTerm] = useState<string>('');
  const [sortField, setSortField] = useState<'score' | 'time' | 'date'>('score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [scoreRangeFilter, setScoreRangeFilter] = useState<'all' | ScoreRankKey>('all');
  const [activeSection, setActiveSection] = useState<'table' | 'distribution' | 'questions'>('table');

  // Modal xem chi tiết bài làm của 1 học sinh
  const [viewingSubmission, setViewingSubmission] = useState<StudentExamSubmission | null>(null);

  // Thông báo trạng thái xuất file / xóa
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Modal xuất báo cáo PDF / Excel / Word
  const [showPdfExportModal, setShowPdfExportModal] = useState<boolean>(false);
  const [pdfPreselectedStudent, setPdfPreselectedStudent] = useState<StudentExamSubmission | null>(null);

  // Quyền xóa bài nộp của học sinh
  const canDeleteSubmissions = (userRole === 'teacher' || userRole === 'admin') && Boolean(onDeleteSubmission);
  const [submissionToDelete, setSubmissionToDelete] = useState<StudentExamSubmission | null>(null);
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(() => new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [isDeletingSubmission, setIsDeletingSubmission] = useState<boolean>(false);

  // Bộ lọc bảng thống kê từng câu hỏi
  const [questionStatsFilter, setQuestionStatsFilter] = useState<
    'all' | 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' | 'has_wrong'
  >('all');

  const hasActiveFilters =
    selectedClassId !== 'all' ||
    selectedExamId !== 'all' ||
    scoreRangeFilter !== 'all' ||
    searchStudentTerm.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedClassId('all');
    setSelectedExamId('all');
    setScoreRangeFilter('all');
    setSearchStudentTerm('');
  };

  // Lọc và sắp xếp danh sách bài nộp
  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((sub) => {
        if (selectedClassId !== 'all' && sub.classId !== selectedClassId) {
          return false;
        }
        if (selectedExamId !== 'all' && sub.examId !== selectedExamId) {
          return false;
        }
        if (scoreRangeFilter !== 'all') {
          const subScale = getSubmissionScalePoints(sub, examsList);
          const rankKey = classifyScoreByScale(sub.score, subScale).key;
          if (rankKey !== scoreRangeFilter) return false;
        }
        if (searchStudentTerm.trim()) {
          const query = searchStudentTerm.toLowerCase();
          return (
            sub.studentName.toLowerCase().includes(query) ||
            sub.studentEmail.toLowerCase().includes(query) ||
            sub.examTitle.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'score') {
          const ratioA = a.score / (getSubmissionScalePoints(a, examsList) || 10);
          const ratioB = b.score / (getSubmissionScalePoints(b, examsList) || 10);
          if (Math.abs(ratioA - ratioB) > 1e-6) {
            return sortOrder === 'desc' ? ratioB - ratioA : ratioA - ratioB;
          }
          return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
        }
        if (sortField === 'time') {
          return sortOrder === 'desc'
            ? b.timeSpentSeconds - a.timeSpentSeconds
            : a.timeSpentSeconds - b.timeSpentSeconds;
        }
        return sortOrder === 'desc'
          ? new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          : new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });
  }, [submissions, examsList, selectedClassId, selectedExamId, scoreRangeFilter, searchStudentTerm, sortField, sortOrder]);

  // Thống kê tổng quan
  const analytics = useMemo(
    () => computeGradebookAnalytics(filteredSubmissions, examsList, selectedExamId),
    [filteredSubmissions, examsList, selectedExamId]
  );

  // Thống kê câu hỏi
  const questionStatGroups = useMemo(
    () => computeExamQuestionStats(filteredSubmissions, examsList),
    [filteredSubmissions, examsList]
  );

  const totalQuestionStatCount = useMemo(
    () => questionStatGroups.reduce((sum, g) => sum + g.questions.length, 0),
    [questionStatGroups]
  );

  // Phân tích hiệu suất theo 3 phần thi (Phần I, II, III)
  const partPerformance = useMemo(() => {
    if (filteredSubmissions.length === 0) {
      return { part1Avg: 0, part1Max: 0, part1Pct: 0, part2Avg: 0, part2Max: 0, part2Pct: 0, part3Avg: 0, part3Max: 0, part3Pct: 0 };
    }
    let p1Earned = 0;
    let p1MaxSum = 0;
    let p2Earned = 0;
    let p2MaxSum = 0;
    let p3Earned = 0;
    let p3MaxSum = 0;

    filteredSubmissions.forEach((sub) => {
      const ex = examsList.find((e) => e.id === sub.examId) || null;
      const scale = getExamScaleInfo(ex, sub.score);
      p1Earned += sub.partScores.part1 || 0;
      p1MaxSum += scale.part1Max;
      p2Earned += sub.partScores.part2 || 0;
      p2MaxSum += scale.part2Max;
      p3Earned += sub.partScores.part3 || 0;
      p3MaxSum += scale.part3Max;
    });

    const n = filteredSubmissions.length;
    const part1Avg = p1Earned / n;
    const part1Max = p1MaxSum / n;
    const part2Avg = p2Earned / n;
    const part2Max = p2MaxSum / n;
    const part3Avg = p3Earned / n;
    const part3Max = p3MaxSum / n;

    return {
      part1Avg,
      part1Max,
      part1Pct: part1Max > 0 ? Math.min(100, (part1Avg / part1Max) * 100) : 0,
      part2Avg,
      part2Max,
      part2Pct: part2Max > 0 ? Math.min(100, (part2Avg / part2Max) * 100) : 0,
      part3Avg,
      part3Max,
      part3Pct: part3Max > 0 ? Math.min(100, (part3Avg / part3Max) * 100) : 0,
    };
  }, [filteredSubmissions, examsList]);

  // Học sinh nổi bật & Học sinh cần lưu ý
  const spotlightStudents = useMemo(() => {
    const byRatioDesc = [...filteredSubmissions].sort((a, b) => {
      const rA = a.score / (getSubmissionScalePoints(a, examsList) || 10);
      const rB = b.score / (getSubmissionScalePoints(b, examsList) || 10);
      return rB - rA;
    });
    const topPerformers = byRatioDesc.slice(0, 3);
    const attentionNeeded = filteredSubmissions
      .filter((s) => {
        const scale = getSubmissionScalePoints(s, examsList);
        const rank = classifyScoreByScale(s.score, scale).key;
        return s.isDisqualified || s.infractionCount > 0 || rank === 'below';
      })
      .sort((a, b) => {
        const flagA = a.isDisqualified ? 2 : a.infractionCount > 0 ? 1 : 0;
        const flagB = b.isDisqualified ? 2 : b.infractionCount > 0 ? 1 : 0;
        if (flagA !== flagB) return flagB - flagA;
        return a.score - b.score;
      })
      .slice(0, 4);

    return { topPerformers, attentionNeeded };
  }, [filteredSubmissions, examsList]);

  // Thông tin đề thi đang xem chi tiết
  const currentViewingExam = useMemo(() => {
    if (!viewingSubmission) return null;
    return examsList.find((e) => e.id === viewingSubmission.examId) || null;
  }, [viewingSubmission, examsList]);

  const currentViewingScaleInfo = useMemo(() => {
    if (!viewingSubmission) return getExamScaleInfo(null);
    return getExamScaleInfo(currentViewingExam, viewingSubmission.score);
  }, [viewingSubmission, currentViewingExam]);

  // Context text cho tiêu đề
  const selectedClassName =
    selectedClassId === 'all'
      ? `Tất cả lớp (${classrooms.length})`
      : classrooms.find((c) => c.id === selectedClassId)?.name || 'Lớp đã chọn';
  const selectedExamObj = selectedExamId === 'all' ? null : examsList.find((e) => e.id === selectedExamId) || null;

  // Xuất CSV
  const handleExportCSV = () => {
    const headers =
      'Hạng,Họ và tên,Email,Lớp,Đề thi,Điểm tổng,Thang điểm đề,Tỷ lệ (%),Phần 1,Phần 2,Phần 3,Thời gian làm bài,Thời gian nộp bài,Vi phạm\n';
    const rows = filteredSubmissions
      .map((sub, idx) => {
        const cls = classrooms.find((c) => c.id === sub.classId)?.name || 'Tự luyện / Lớp đã xóa';
        const subScale = getSubmissionScalePoints(sub, examsList);
        const pct = subScale > 0 ? ((sub.score / subScale) * 100).toFixed(1) : '0.0';
        const durationText = formatDurationSpent(sub.timeSpentSeconds);
        const submittedText = formatSubmissionDateTime(sub.submittedAt).full;
        return `${idx + 1},"${sub.studentName}","${sub.studentEmail}","${cls}","${sub.examTitle}",${sub.score},${subScale},${pct}%,${sub.partScores.part1},${sub.partScores.part2},${sub.partScores.part3},"${durationText}","${submittedText}",${sub.infractionCount}`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_Diem_MathNBK_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice('Đã xuất file bảng điểm CSV thành công.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Multi-select xóa bài nộp
  const selectedVisibleIds = useMemo(() => {
    return filteredSubmissions.filter((s) => selectedSubIds.has(s.id)).map((s) => s.id);
  }, [filteredSubmissions, selectedSubIds]);

  const isAllFilteredSelected =
    filteredSubmissions.length > 0 && selectedVisibleIds.length === filteredSubmissions.length;

  const toggleSelectAllFiltered = () => {
    setSelectedSubIds((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        filteredSubmissions.forEach((s) => next.delete(s.id));
      } else {
        filteredSubmissions.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const toggleSelectSubmission = (subId: string) => {
    setSelectedSubIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  };

  const handleConfirmDeleteSingleSubmission = async () => {
    if (!submissionToDelete || !onDeleteSubmission) return;
    setIsDeletingSubmission(true);
    try {
      const targetId = submissionToDelete.id;
      const targetName = submissionToDelete.studentName;
      await onDeleteSubmission(targetId);
      setSelectedSubIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      if (viewingSubmission?.id === targetId) {
        setViewingSubmission(null);
      }
      setSubmissionToDelete(null);
      setExportNotice(`Đã xóa bài nộp của học sinh "${targetName}".`);
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setIsDeletingSubmission(false);
    }
  };

  const handleConfirmDeleteBulkSubmissions = async () => {
    if (selectedVisibleIds.length === 0) return;
    setIsDeletingSubmission(true);
    try {
      const count = selectedVisibleIds.length;
      if (onDeleteMultipleSubmissions) {
        await onDeleteMultipleSubmissions(selectedVisibleIds);
      } else if (onDeleteSubmission) {
        for (const id of selectedVisibleIds) {
          await onDeleteSubmission(id);
        }
      }
      if (viewingSubmission && selectedVisibleIds.includes(viewingSubmission.id)) {
        setViewingSubmission(null);
      }
      setSelectedSubIds(new Set());
      setShowBulkDeleteModal(false);
      setExportNotice(`Đã xóa ${count} bài nộp đã chọn.`);
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setIsDeletingSubmission(false);
    }
  };

  const toggleSort = (field: 'score' | 'time' | 'date') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const excellentRate =
    analytics.total > 0 ? Math.round((analytics.excellentCount / analytics.total) * 100) : 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-5 animate-in fade-in duration-200">
      {/* 1. HEADER & EXPORT ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            Tổng Hợp Điểm Thi
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5 tracking-tight">
            Bảng Điểm &amp; Phân Tích Kết Quả
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {selectedClassName} · {selectedExamObj ? selectedExamObj.title : 'Tất cả đề thi'} ·{' '}
            <span className="font-mono font-semibold text-slate-700 tabular-nums">
              {filteredSubmissions.length} bài nộp
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPdfPreselectedStudent(null);
              setShowPdfExportModal(true);
            }}
            disabled={filteredSubmissions.length === 0}
            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-bold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText size={15} />
            <span>Xuất Báo Cáo (PDF / Excel / Word)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredSubmissions.length === 0}
            className="h-10 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-45 text-slate-800 font-bold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download size={15} />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* Notice banner */}
      {exportNotice && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. FILTER & SEARCH BAR (NGAY DƯỚI TIÊU ĐỀ ĐỂ QUAN SÁT TỨC THÌ KHI ĐỔI LỚP / ĐỀ) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[165px] flex-1 sm:flex-initial">
          <label className="text-[11px] font-semibold text-slate-500 block">Nhóm lớp</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="all">Tất cả lớp ({classrooms.length})</option>
            {classrooms.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} (#{cls.code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 min-w-[200px] flex-1 sm:flex-initial">
          <label className="text-[11px] font-semibold text-slate-500 block">Đề thi</label>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-600 max-w-[240px]"
            >
              <option value="all">Tất cả đề thi ({examsList.length})</option>
              {examsList.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({formatPointsNumber(getExamScaleInfo(ex).totalPoints)}đ)
                </option>
              ))}
            </select>
            {selectedExamId !== 'all' && onPreviewExam && (
              <button
                type="button"
                onClick={() => onPreviewExam(selectedExamId)}
                title="Xem nội dung đề thi đang lọc"
                className="h-9 px-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ExternalLink size={13} />
                <span>Xem đề</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1 min-w-[165px] flex-1 sm:flex-initial">
          <label className="text-[11px] font-semibold text-slate-500 block">Xếp loại</label>
          <select
            value={scoreRangeFilter}
            onChange={(e) => setScoreRangeFilter(e.target.value as 'all' | ScoreRankKey)}
            className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="all">Tất cả mức điểm</option>
            <option value="excellent">
              {analytics.isUniformScale
                ? `Giỏi (≥ ${formatPointsNumber(analytics.thresholds.excellentMin)}đ)`
                : 'Giỏi (≥ 80%)'}
            </option>
            <option value="good">
              {analytics.isUniformScale
                ? `Khá (${formatPointsNumber(analytics.thresholds.goodMin)} - <${formatPointsNumber(
                    analytics.thresholds.excellentMin
                  )}đ)`
                : 'Khá (65% - 79.9%)'}
            </option>
            <option value="average">
              {analytics.isUniformScale
                ? `Trung bình (${formatPointsNumber(analytics.thresholds.averageMin)} - <${formatPointsNumber(
                    analytics.thresholds.goodMin
                  )}đ)`
                : 'Trung bình (50% - 64.9%)'}
            </option>
            <option value="below">
              {analytics.isUniformScale
                ? `Dưới trung bình (< ${formatPointsNumber(analytics.thresholds.averageMin)}đ)`
                : 'Dưới trung bình (< 50%)'}
            </option>
          </select>
        </div>

        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold text-slate-500 block">Tìm học sinh</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchStudentTerm}
              onChange={(e) => setSearchStudentTerm(e.target.value)}
              placeholder="Tên, email hoặc tên đề thi..."
              className="w-full h-9 pl-8 pr-8 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-600"
            />
            {searchStudentTerm && (
              <button
                type="button"
                onClick={() => setSearchStudentTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      {/* 3. UNIFIED 5-METRIC SUMMARY STRIP */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* Metric 1: Số bài */}
          <div className="p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-slate-500 block">Bài Đã Nộp</span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
              {analytics.total}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {hasActiveFilters ? `trên ${submissions.length} bài toàn bộ` : 'tổng lượt nộp hợp lệ'}
            </span>
          </div>

          {/* Metric 2: Điểm TB */}
          <div className="p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-slate-500 block">Điểm Trung Bình</span>
            <div className="text-2xl font-extrabold text-blue-700 font-mono tabular-nums mt-1">
              {analytics.isUniformScale ? (
                <>
                  {analytics.average.toFixed(2)}
                  <span className="text-sm font-semibold text-slate-400">
                    /{formatPointsNumber(analytics.scalePoints)}
                  </span>
                </>
              ) : (
                `${analytics.averagePercent.toFixed(1)}%`
              )}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block tabular-nums">
              {analytics.isUniformScale
                ? `Đạt ${analytics.averagePercent.toFixed(1)}% thang điểm`
                : `Quy đổi ${analytics.average.toFixed(2)}/10`}
            </span>
          </div>

          {/* Metric 3: Cao nhất / Thấp nhất */}
          <div className="p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-slate-500 block">Cao Nhất / Thấp Nhất</span>
            <div className="text-2xl font-extrabold text-emerald-700 font-mono tabular-nums mt-1">
              {analytics.max.toFixed(2)}
              <span className="text-sm font-semibold text-slate-400">
                /{formatPointsNumber(analytics.maxSubmissionScale)}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block font-mono tabular-nums">
              Thấp nhất: {analytics.min.toFixed(2)}/{formatPointsNumber(analytics.minSubmissionScale)}đ
            </span>
          </div>

          {/* Metric 4: Tỉ lệ Giỏi */}
          <div className="p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Tỉ Lệ Đạt Giỏi ({analytics.isUniformScale ? `≥ ${formatPointsNumber(analytics.thresholds.excellentMin)}đ` : '≥ 80%'})
            </span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
              {excellentRate}%
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block tabular-nums">
              {analytics.excellentCount}/{analytics.total} học sinh
            </span>
          </div>

          {/* Metric 5: Giám sát thi */}
          <div className="p-4 sm:p-5 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-slate-500 block">Giám Sát Thi</span>
            <div
              className={`text-2xl font-extrabold font-mono tabular-nums mt-1 flex items-center gap-2 ${
                analytics.cheatingCount > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {analytics.cheatingCount > 0 ? (
                <ShieldAlert size={20} className="shrink-0" />
              ) : (
                <CheckCircle2 size={20} className="shrink-0" />
              )}
              <span>{analytics.cheatingCount}</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {analytics.cheatingCount > 0 ? 'bài có cảnh báo rời tab' : 'Không ghi nhận vi phạm'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. SECTION SWITCHER TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('table')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'table'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={15} />
            <span>Bảng Điểm Học Sinh</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 tabular-nums">
              {filteredSubmissions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('distribution')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'distribution'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={15} />
            <span>Phổ Điểm &amp; 3 Phần Thi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('questions')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'questions'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList size={15} />
            <span>Phân Tích Từng Câu</span>
            {totalQuestionStatCount > 0 && (
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 tabular-nums">
                {totalQuestionStatCount}
              </span>
            )}
          </button>
        </div>

        {/* Sort & Bulk Delete Controls (Hiển thị ngay trên thanh tab khi đang ở Tab 1) */}
        {activeSection === 'table' && (
          <div className="flex flex-wrap items-center gap-2 pb-2">
            {canDeleteSubmissions && selectedVisibleIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xóa đã chọn ({selectedVisibleIds.length})</span>
              </button>
            )}

            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => toggleSort('score')}
                className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  sortField === 'score' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpDown size={12} />
                <span>Điểm {sortField === 'score' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSort('time')}
                className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  sortField === 'time' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock size={12} />
                <span>Thời lượng {sortField === 'time' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSort('date')}
                className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  sortField === 'date' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar size={12} />
                <span>Ngày nộp {sortField === 'date' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: BẢNG ĐIỂM HỌC SINH                                             */}
      {/* ===================================================================== */}
      {activeSection === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {filteredSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                    {canDeleteSubmissions && (
                      <th className="py-3 pl-4 pr-2 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          title="Chọn tất cả bài nộp đang hiển thị"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-4">Học Sinh</th>
                    <th className="py-3 px-4">Lớp · Đề Thi</th>
                    <th className="py-3 px-4 text-right">Điểm Tổng</th>
                    <th className="py-3 px-3 text-right hidden lg:table-cell">P.I</th>
                    <th className="py-3 px-3 text-right hidden lg:table-cell">P.II</th>
                    <th className="py-3 px-3 text-right hidden lg:table-cell">P.III</th>
                    <th className="py-3 px-4 hidden md:table-cell">Thời Gian Nộp</th>
                    <th className="py-3 px-4">Giám Sát</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.map((sub, idx) => {
                    const cls = classrooms.find((c) => c.id === sub.classId);
                    const subScale = getSubmissionScalePoints(sub, examsList);
                    const rankInfo = classifyScoreByScale(sub.score, subScale);
                    const rankStyle = RANK_STYLE_MAP[rankInfo.key];
                    const submittedFormatted = formatSubmissionDateTime(sub.submittedAt);
                    const isChecked = selectedSubIds.has(sub.id);
                    const isTop3 = idx < 3 && sortField === 'score' && sortOrder === 'desc';

                    return (
                      <tr
                        key={sub.id}
                        className={`transition-colors ${
                          isChecked ? 'bg-rose-50/50 hover:bg-rose-50/75' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {canDeleteSubmissions && (
                          <td className="py-3 pl-4 pr-2 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectSubmission(sub.id)}
                              title={`Chọn bài nộp của ${sub.studentName}`}
                              className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          </td>
                        )}

                        {/* Thứ hạng */}
                        <td className="py-3 px-3 text-center font-mono font-bold tabular-nums">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] ${
                              isTop3
                                ? idx === 0
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : idx === 1
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'bg-orange-100 text-orange-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        {/* Học sinh */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 border border-slate-200">
                              {sub.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                                {sub.studentName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono block truncate max-w-[180px]">
                                {sub.studentEmail}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Lớp & Đề thi */}
                        <td className="py-3 px-4 max-w-[230px]">
                          <span className="font-semibold text-slate-800 block truncate" title={sub.examTitle}>
                            {sub.examTitle}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {cls ? `${cls.name} (#${cls.code})` : 'Tự luyện'} · {formatDurationSpent(sub.timeSpentSeconds)}
                          </span>
                        </td>

                        {/* Điểm tổng + thanh tỉ lệ + xếp loại */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end">
                            <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                              <span className={`text-sm font-extrabold ${rankStyle.textClass}`}>
                                {sub.score.toFixed(2)}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                /{formatPointsNumber(subScale)}
                              </span>
                              <span className={`text-[11px] font-bold ${rankStyle.textClass}`}>
                                · {rankStyle.shortLabel}
                              </span>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-sm overflow-hidden mt-1">
                              <div
                                className={`h-full ${rankStyle.barClass}`}
                                style={{ width: `${Math.min(100, rankInfo.percent)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Điểm 3 phần */}
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700 tabular-nums hidden lg:table-cell">
                          {sub.partScores.part1.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700 tabular-nums hidden lg:table-cell">
                          {sub.partScores.part2.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700 tabular-nums hidden lg:table-cell">
                          {sub.partScores.part3.toFixed(2)}
                        </td>

                        {/* Thời gian nộp */}
                        <td className="py-3 px-4 whitespace-nowrap hidden md:table-cell">
                          <span className="font-mono font-semibold text-slate-800 block tabular-nums">
                            {submittedFormatted.time}
                          </span>
                          <span className="text-[11px] text-slate-500 block tabular-nums">
                            {submittedFormatted.date}
                          </span>
                        </td>

                        {/* Giám sát */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {sub.isDisqualified ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px]">
                              <XCircle size={13} className="shrink-0" />
                              <span>Hủy bài</span>
                            </span>
                          ) : sub.infractionCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px]">
                              <AlertTriangle size={13} className="shrink-0" />
                              <span className="tabular-nums">{sub.infractionCount} vi phạm</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 size={13} className="shrink-0" />
                              <span>Chuẩn mực</span>
                            </span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPdfPreselectedStudent(sub);
                                setShowPdfExportModal(true);
                              }}
                              title="Xuất phiếu điểm PDF / Excel / Word"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewingSubmission(sub)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Eye size={13} />
                              <span>Xem bài</span>
                            </button>
                            {canDeleteSubmissions && (
                              <button
                                type="button"
                                onClick={() => setSubmissionToDelete(sub)}
                                title={`Xóa bài nộp của ${sub.studentName}`}
                                className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 px-4 text-center space-y-3">
              <Users size={36} className="mx-auto text-slate-300" />
              <div className="space-y-1">
                <p className="font-bold text-slate-700 text-sm">
                  {submissions.length === 0
                    ? 'Chưa có bài nộp nào được ghi nhận'
                    : 'Không tìm thấy bài thi phù hợp với bộ lọc'}
                </p>
                <p className="text-xs text-slate-500">
                  {submissions.length === 0
                    ? 'Khi học sinh hoàn thành và nộp bài thi, kết quả sẽ hiển thị tại đây.'
                    : 'Hãy thử đổi lớp, chọn đề thi khác hoặc đặt lại bộ lọc để xem toàn bộ danh sách.'}
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Đặt lại bộ lọc</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PHỔ ĐIỂM & HIỆU SUẤT 3 PHẦN THI                                */}
      {/* ===================================================================== */}
      {activeSection === 'distribution' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Cột trái: Phân bố 4 mức xếp loại (có thể nhấp để lọc nhanh học sinh) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Phân Bố Xếp Loại Lớp Học</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Nhấp vào một mức điểm để xem danh sách học sinh thuộc nhóm đó ·{' '}
                  {analytics.isUniformScale
                    ? `Thang ${formatPointsNumber(analytics.scalePoints)}đ`
                    : 'Quy đổi theo % từng đề'}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 tabular-nums shrink-0">
                {analytics.total} bài
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              {(
                [
                  {
                    key: 'excellent' as ScoreRankKey,
                    title: analytics.isUniformScale
                      ? `Giỏi (${formatPointsNumber(analytics.thresholds.excellentMin)} – ${formatPointsNumber(
                          analytics.scalePoints
                        )}đ · ≥ 80%)`
                      : 'Giỏi (≥ 80% thang đề)',
                    count: analytics.excellentCount,
                    bar: 'bg-emerald-500',
                    text: 'text-emerald-700',
                  },
                  {
                    key: 'good' as ScoreRankKey,
                    title: analytics.isUniformScale
                      ? `Khá (${formatPointsNumber(analytics.thresholds.goodMin)} – <${formatPointsNumber(
                          analytics.thresholds.excellentMin
                        )}đ · 65–79.9%)`
                      : 'Khá (65% – 79.9%)',
                    count: analytics.goodCount,
                    bar: 'bg-blue-500',
                    text: 'text-blue-700',
                  },
                  {
                    key: 'average' as ScoreRankKey,
                    title: analytics.isUniformScale
                      ? `Trung bình (${formatPointsNumber(analytics.thresholds.averageMin)} – <${formatPointsNumber(
                          analytics.thresholds.goodMin
                        )}đ · 50–64.9%)`
                      : 'Trung bình (50% – 64.9%)',
                    count: analytics.averageCount,
                    bar: 'bg-amber-500',
                    text: 'text-amber-700',
                  },
                  {
                    key: 'below' as ScoreRankKey,
                    title: analytics.isUniformScale
                      ? `Dưới trung bình (< ${formatPointsNumber(analytics.thresholds.averageMin)}đ · < 50%)`
                      : 'Dưới trung bình (< 50%)',
                    count: analytics.belowCount,
                    bar: 'bg-rose-500',
                    text: 'text-rose-700',
                  },
                ]
              ).map((tier) => {
                const pct = analytics.total > 0 ? Math.round((tier.count / analytics.total) * 100) : 0;
                return (
                  <button
                    key={tier.key}
                    type="button"
                    onClick={() => {
                      setScoreRangeFilter(tier.key);
                      setActiveSection('table');
                    }}
                    className="w-full text-left p-2.5 -mx-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between font-bold mb-1.5">
                      <span className={`${tier.text} group-hover:underline`}>{tier.title}</span>
                      <span className="font-mono tabular-nums text-slate-800">
                        {tier.count} HS ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-md overflow-hidden">
                      <div
                        className={`h-full ${tier.bar} transition-all duration-300`}
                        style={{ width: `${analytics.total > 0 ? (tier.count / analytics.total) * 100 : 0}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cột phải: Hiệu suất 3 phần thi + Điểm nổi bật / Cần chú ý */}
          <div className="space-y-5">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Điểm Trung Bình Theo 3 Phần Thi</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  So sánh mức độ hoàn thành trung bình trên từng cấu phần đề thi
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    label: 'Phần I · Trắc nghiệm (MCQ)',
                    avg: partPerformance.part1Avg,
                    max: partPerformance.part1Max,
                    pct: partPerformance.part1Pct,
                    bar: 'bg-blue-600',
                  },
                  {
                    label: 'Phần II · Đúng / Sai (4 ý)',
                    avg: partPerformance.part2Avg,
                    max: partPerformance.part2Max,
                    pct: partPerformance.part2Pct,
                    bar: 'bg-indigo-600',
                  },
                  {
                    label: 'Phần III · Trả lời ngắn',
                    avg: partPerformance.part3Avg,
                    max: partPerformance.part3Max,
                    pct: partPerformance.part3Pct,
                    bar: 'bg-amber-500',
                  },
                ].map((part) => (
                  <div key={part.label} className="space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-700">
                      <span>{part.label}</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {part.avg.toFixed(2)}/{formatPointsNumber(part.max)}đ ({part.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-md overflow-hidden">
                      <div className={`h-full ${part.bar}`} style={{ width: `${part.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Top điểm cao */}
              <div className="space-y-2.5">
                <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <Award size={15} className="text-amber-500" />
                  <span>Điểm Cao Nhất</span>
                </h4>
                {spotlightStudents.topPerformers.length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có dữ liệu.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {spotlightStudents.topPerformers.map((sub, i) => {
                      const scale = getSubmissionScalePoints(sub, examsList);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setViewingSubmission(sub)}
                          className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {i + 1}. {sub.studentName}
                          </span>
                          <span className="font-mono font-bold text-xs text-emerald-700 tabular-nums shrink-0">
                            {sub.score.toFixed(2)}/{formatPointsNumber(scale)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cần lưu ý */}
              <div className="space-y-2.5">
                <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-rose-600" />
                  <span>Cần Lưu Ý</span>
                </h4>
                {spotlightStudents.attentionNeeded.length === 0 ? (
                  <p className="text-xs text-emerald-700 font-medium">
                    Không có học sinh vi phạm hoặc dưới trung bình.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {spotlightStudents.attentionNeeded.map((sub) => {
                      const scale = getSubmissionScalePoints(sub, examsList);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setViewingSubmission(sub)}
                          className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 block truncate">
                              {sub.studentName}
                            </span>
                            <span className="text-[10px] text-rose-700 block">
                              {sub.isDisqualified
                                ? 'Hủy bài'
                                : sub.infractionCount > 0
                                ? `${sub.infractionCount} lần rời tab`
                                : 'Điểm dưới TB'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-xs text-slate-700 tabular-nums shrink-0">
                            {sub.score.toFixed(2)}/{formatPointsNumber(scale)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PHÂN TÍCH TỪNG CÂU HỎI                                         */}
      {/* ===================================================================== */}
      {activeSection === 'questions' && (
        <div className="space-y-5">
          {questionStatGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-14 px-4 text-center space-y-2">
              <ClipboardList size={36} className="mx-auto text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">Chưa có dữ liệu thống kê từng câu</p>
              <p className="text-xs text-slate-500">
                Chọn lớp hoặc đề thi có ít nhất 1 bài nộp để xem tỉ lệ đúng/sai chi tiết theo câu.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  Tỉ lệ học sinh chọn đúng, chọn sai hoặc bỏ trống trên từng câu hỏi.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  {(
                    [
                      { id: 'all', label: 'Tất cả câu' },
                      { id: 'part_1_mcq', label: 'Phần I (MCQ)' },
                      { id: 'part_2_true_false', label: 'Phần II (Đ/S)' },
                      { id: 'part_3_short_answer', label: 'Phần III (Ngắn)' },
                      { id: 'has_wrong', label: 'Có HS làm sai' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setQuestionStatsFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        questionStatsFilter === tab.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {questionStatGroups.map((group) => {
                const visibleQuestions = group.questions.filter((q) => {
                  if (questionStatsFilter === 'all') return true;
                  if (questionStatsFilter === 'has_wrong') return q.wrongCount > 0 || q.partialCount > 0;
                  return q.part === questionStatsFilter;
                });

                const sortedByWrong = group.hasExamDefinition
                  ? [...group.questions].sort(
                      (a, b) => b.wrongCount + b.unansweredCount - (a.wrongCount + a.unansweredCount)
                    )
                  : [];
                const hardestQuestion = sortedByWrong[0];
                const easiestQuestion = group.hasExamDefinition
                  ? [...group.questions].sort((a, b) => b.correctRate - a.correctRate)[0]
                  : undefined;

                return (
                  <div key={group.examId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-900">{group.examTitle}</span>
                        <span className="text-slate-500 font-medium tabular-nums">
                          · Thang {formatPointsNumber(group.totalPoints)}đ · {group.submissionCount} bài ·{' '}
                          {group.questions.length} câu
                        </span>
                      </div>

                      {group.hasExamDefinition && hardestQuestion && easiestQuestion && (
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                          <span className="text-emerald-700 inline-flex items-center gap-1 tabular-nums">
                            <CheckCircle2 size={13} />
                            <span>
                              Đúng nhiều: Câu {easiestQuestion.questionNumber} ({easiestQuestion.correctCount}/
                              {easiestQuestion.totalSubmissions})
                            </span>
                          </span>
                          {hardestQuestion.wrongCount + hardestQuestion.unansweredCount > 0 && (
                            <span className="text-rose-700 inline-flex items-center gap-1 tabular-nums">
                              <AlertTriangle size={13} />
                              <span>
                                Sai nhiều: Câu {hardestQuestion.questionNumber} (
                                {hardestQuestion.wrongCount + hardestQuestion.unansweredCount} HS)
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {visibleQuestions.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Không có câu hỏi nào thuộc bộ lọc hiện tại.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                              <th className="py-2.5 px-3 w-20 text-center">Câu</th>
                              <th className="py-2.5 px-3 w-24">Phần</th>
                              <th className="py-2.5 px-3 w-36">Đáp Án Đúng</th>
                              <th className="py-2.5 px-3 min-w-[240px]">Phân Bố Chọn Đáp Án</th>
                              <th className="py-2.5 px-3 w-20 text-right text-emerald-700">Đúng</th>
                              <th className="py-2.5 px-3 w-20 text-right text-rose-700">Sai</th>
                              <th className="py-2.5 px-3 w-20 text-right text-slate-500">Trống</th>
                              <th className="py-2.5 px-3 w-32 text-right">Tỉ Lệ Đúng</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {visibleQuestions.map((qStat) => {
                              const correctPct =
                                qStat.totalSubmissions > 0 ? (qStat.correctCount / qStat.totalSubmissions) * 100 : 0;
                              const partialPct =
                                qStat.totalSubmissions > 0 ? (qStat.partialCount / qStat.totalSubmissions) * 100 : 0;
                              const wrongPct =
                                qStat.totalSubmissions > 0 ? (qStat.wrongCount / qStat.totalSubmissions) * 100 : 0;

                              return (
                                <tr key={qStat.questionId} className="hover:bg-slate-50/70 align-top">
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="font-bold font-mono text-slate-900 block tabular-nums">
                                      Câu {qStat.questionNumber}
                                    </span>
                                    {qStat.points > 0 && (
                                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                                        {formatPointsNumber(qStat.points)}đ
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                                    {qStat.partLabel}
                                  </td>

                                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 text-[11px]">
                                    {qStat.correctAnswerDisplay}
                                  </td>

                                  <td className="py-2.5 px-3">
                                    {qStat.part === 'part_2_true_false' && qStat.tfSubItems ? (
                                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono tabular-nums">
                                        {qStat.tfSubItems.map((subIt) => (
                                          <div
                                            key={subIt.subKey}
                                            className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-1"
                                          >
                                            <span className="font-bold text-slate-700">
                                              {subIt.subKey} ({subIt.expected}):
                                            </span>
                                            <span>
                                              <strong className="text-emerald-700">✓{subIt.correctCount}</strong>{' '}
                                              <span className="text-slate-300">|</span>{' '}
                                              <strong className="text-rose-600">✗{subIt.wrongCount}</strong>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-1.5 text-[10px] font-mono tabular-nums">
                                        {qStat.optionStats.map((opt) => (
                                          <span
                                            key={opt.key}
                                            className={`px-2 py-0.5 rounded-md border font-semibold ${
                                              opt.key === '__blank__'
                                                ? 'bg-slate-100 border-slate-200 text-slate-500'
                                                : opt.isCorrect
                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                                : opt.count > 0
                                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                                : 'bg-slate-50 border-slate-200 text-slate-400'
                                            }`}
                                          >
                                            {opt.label}: {opt.count} ({opt.percent}%)
                                            {opt.isCorrect ? ' ✓' : ''}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                                    {qStat.correctCount}
                                    {qStat.partialCount > 0 && (
                                      <span className="block text-[10px] text-amber-700 font-semibold">
                                        +{qStat.partialCount} bán phần
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                                    {qStat.wrongCount}
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono text-slate-500 tabular-nums">
                                    {qStat.unansweredCount}
                                  </td>

                                  <td className="py-2.5 px-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between font-mono text-[10px] font-bold tabular-nums">
                                        <span className="text-emerald-700">{qStat.correctRate}%</span>
                                        <span className="text-slate-400">
                                          {qStat.correctCount}/{qStat.totalSubmissions}
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-100 rounded-sm overflow-hidden flex">
                                        <div className="h-full bg-emerald-500" style={{ width: `${correctPct}%` }} />
                                        {partialPct > 0 && (
                                          <div className="h-full bg-amber-400" style={{ width: `${partialPct}%` }} />
                                        )}
                                        {wrongPct > 0 && (
                                          <div className="h-full bg-rose-500" style={{ width: `${wrongPct}%` }} />
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: XEM CHI TIẾT BÀI THI CỦA HỌC SINH                              */}
      {/* ===================================================================== */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Chi Tiết Bài Nộp
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {viewingSubmission.studentName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewingSubmission.examTitle} ·{' '}
                  {classrooms.find((c) => c.id === viewingSubmission.classId)?.name || 'Tự luyện / Lớp đã xóa'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 font-semibold block">Tổng điểm</span>
                  <span className="text-2xl font-extrabold font-mono text-blue-700 tabular-nums">
                    {viewingSubmission.score.toFixed(2)}
                    <span className="text-sm text-slate-400">
                      /{formatPointsNumber(currentViewingScaleInfo.totalPoints)}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPdfPreselectedStudent(viewingSubmission);
                    setShowPdfExportModal(true);
                  }}
                  className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Xuất Phiếu Điểm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSubmission(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  aria-label="Đóng cửa sổ chi tiết"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Score Breakdown Strip */}
            <div className="rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 text-center">
              <div className="p-3">
                <span className="text-[11px] font-semibold text-slate-500 block">Phần I (MCQ)</span>
                <span className="text-lg font-extrabold font-mono text-slate-900 tabular-nums">
                  {viewingSubmission.partScores.part1}đ
                  {currentViewingExam && (
                    <span className="text-xs font-semibold text-slate-400">
                      /{formatPointsNumber(currentViewingScaleInfo.part1Max)}đ
                    </span>
                  )}
                </span>
              </div>
              <div className="p-3">
                <span className="text-[11px] font-semibold text-slate-500 block">Phần II (Đúng/Sai)</span>
                <span className="text-lg font-extrabold font-mono text-slate-900 tabular-nums">
                  {viewingSubmission.partScores.part2}đ
                  {currentViewingExam && (
                    <span className="text-xs font-semibold text-slate-400">
                      /{formatPointsNumber(currentViewingScaleInfo.part2Max)}đ
                    </span>
                  )}
                </span>
              </div>
              <div className="p-3">
                <span className="text-[11px] font-semibold text-slate-500 block">Phần III (Ngắn)</span>
                <span className="text-lg font-extrabold font-mono text-slate-900 tabular-nums">
                  {viewingSubmission.partScores.part3}đ
                  {currentViewingExam && (
                    <span className="text-xs font-semibold text-slate-400">
                      /{formatPointsNumber(currentViewingScaleInfo.part3Max)}đ
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Metadata strip */}
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                Nộp lúc:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">
                  {formatSubmissionDateTime(viewingSubmission.submittedAt).full}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} className="text-slate-500" />
                Thời gian làm: <strong>{formatDurationSpent(viewingSubmission.timeSpentSeconds)}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert
                  size={14}
                  className={viewingSubmission.infractionCount > 0 ? 'text-rose-600' : 'text-emerald-600'}
                />
                Giám sát:{' '}
                <strong className={viewingSubmission.infractionCount > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                  {viewingSubmission.infractionCount > 0
                    ? `${viewingSubmission.infractionCount} lần rời tab`
                    : 'Chuẩn mực'}
                </strong>
              </span>
            </div>

            {/* Detailed Question Review */}
            {!currentViewingExam ? (
              <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center space-y-1">
                <p className="font-bold">Đề thi gốc đã bị xóa hoặc gỡ khỏi hệ thống</p>
                <p className="text-amber-800">Không thể hiển thị danh sách câu hỏi chi tiết của bài nộp này.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900">Chi Tiết Từng Câu Hỏi</h4>

                {currentViewingExam.questions.map((q) => {
                  let status: 'correct' | 'partial' | 'wrong' | 'unanswered' = 'wrong';
                  let studentDisplayAns = '';
                  let correctDisplayAns = '';

                  if (q.part === 'part_1_mcq') {
                    const raw = viewingSubmission.answers[q.id];
                    const clean = raw !== undefined && raw !== null ? String(raw).trim() : '';
                    studentDisplayAns = clean || 'Chưa trả lời';
                    correctDisplayAns = q.correctAnswer;
                    status = !clean
                      ? 'unanswered'
                      : clean.toUpperCase() === q.correctAnswer.trim().toUpperCase()
                      ? 'correct'
                      : 'wrong';
                  } else if (q.part === 'part_2_true_false') {
                    const subItems = q.items || [];
                    const fmtTF = (v: unknown) =>
                      v === undefined || v === null || v === '' ? '—' : v === true || v === 'true' ? 'Đ' : 'S';
                    let answered = 0;
                    let matched = 0;
                    const sParts: string[] = [];
                    subItems.forEach((it) => {
                      const val = fmtTF(viewingSubmission.answers[`${q.id}_${it.subKey}`]);
                      const expected = it.isCorrect ? 'Đ' : 'S';
                      sParts.push(`${it.subKey}:${val}`);
                      if (val !== '—') {
                        answered += 1;
                        if (val === expected) matched += 1;
                      }
                    });
                    studentDisplayAns = sParts.join(', ');
                    correctDisplayAns = subItems.map((it) => `${it.subKey}:${it.isCorrect ? 'Đ' : 'S'}`).join(', ');
                    status =
                      answered === 0
                        ? 'unanswered'
                        : matched === subItems.length
                        ? 'correct'
                        : matched > 0
                        ? 'partial'
                        : 'wrong';
                  } else if (q.part === 'part_3_short_answer') {
                    const raw = viewingSubmission.answers[q.id];
                    const clean = raw !== undefined && raw !== null ? String(raw).trim() : '';
                    studentDisplayAns = clean || 'Chưa trả lời';
                    correctDisplayAns = q.correctAnswer;
                    status = !clean
                      ? 'unanswered'
                      : isAnswerEquivalent(clean, q.correctAnswer)
                      ? 'correct'
                      : 'wrong';
                  }

                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[11px]">
                            Câu {q.questionNumber}
                          </span>
                          <span className="font-semibold text-slate-600">
                            {q.part === 'part_1_mcq'
                              ? 'Trắc nghiệm 4 lựa chọn'
                              : q.part === 'part_2_true_false'
                              ? 'Đúng / Sai 4 ý'
                              : 'Trả lời ngắn'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-500 tabular-nums">{q.points}đ</span>
                          {status === 'correct' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 size={13} />
                              <span>Đúng</span>
                            </span>
                          ) : status === 'partial' ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                              <AlertTriangle size={13} />
                              <span>Đúng 1 phần</span>
                            </span>
                          ) : status === 'unanswered' ? (
                            <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
                              <MinusCircle size={13} />
                              <span>Bỏ trống</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                              <XCircle size={13} />
                              <span>Sai</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="font-semibold text-slate-900">{q.prompt}</p>

                      {(q.pdfAttachmentUrl || q.imageAttachment) && (
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 inline-block max-w-full">
                          <ExamImage
                            src={q.pdfAttachmentUrl || q.imageAttachment}
                            alt="Ảnh đề bài"
                            className="max-h-40 max-w-full w-auto rounded object-contain bg-white"
                          />
                        </div>
                      )}

                      {q.latex && (
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <MathView math={q.latex} block />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Học sinh chọn:</span>
                          <strong className="text-slate-900">{studentDisplayAns}</strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <span className="text-emerald-700 block text-[10px]">Đáp án chuẩn:</span>
                          <strong className="text-emerald-900">{correctDisplayAns}</strong>
                        </div>
                      </div>

                      {q.explanation && (
                        <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-slate-700 text-[11px]">
                          <span className="font-bold text-blue-700 block mb-0.5">Lời giải:</span>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPdfPreselectedStudent(viewingSubmission);
                  setShowPdfExportModal(true);
                }}
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileText size={15} />
                <span>Xuất Phiếu Điểm (PDF / Word / Excel)</span>
              </button>
              {canDeleteSubmissions && (
                <button
                  type="button"
                  onClick={() => setSubmissionToDelete(viewingSubmission)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Xóa Bài Nộp</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA 1 BÀI NỘP */}
      <DeleteConfirmationModal
        isOpen={Boolean(submissionToDelete)}
        itemType="custom"
        title="Xóa Bài Thi Đã Nộp Của Học Sinh"
        itemName={
          submissionToDelete
            ? `${submissionToDelete.studentName} — ${submissionToDelete.examTitle}`
            : ''
        }
        itemSubtitle={
          submissionToDelete
            ? `Điểm: ${submissionToDelete.score.toFixed(2)}/${formatPointsNumber(
                getSubmissionScalePoints(submissionToDelete, examsList)
              )} · Nộp lúc: ${formatSubmissionDateTime(submissionToDelete.submittedAt).full}`
            : undefined
        }
        impactDetails={[
          'Bài làm, đáp án chi tiết và kết quả điểm của lượt nộp này sẽ bị xóa khỏi bảng tổng hợp điểm thi',
          'Học sinh sẽ không còn thấy lượt nộp này trong lịch sử làm bài (và có thể làm lại nếu đề giới hạn số lượt)',
          'Dữ liệu bị xóa đồng bộ trên toàn bộ thiết bị và không thể khôi phục',
        ]}
        isDeleting={isDeletingSubmission}
        onConfirm={handleConfirmDeleteSingleSubmission}
        onCancel={() => {
          if (!isDeletingSubmission) setSubmissionToDelete(null);
        }}
      />

      {/* MODAL XÓA NHIỀU BÀI NỘP */}
      <DeleteConfirmationModal
        isOpen={showBulkDeleteModal}
        itemType="custom"
        title={`Xóa ${selectedVisibleIds.length} Bài Nộp Đã Chọn`}
        itemName={`${selectedVisibleIds.length} bài làm của học sinh trong danh sách`}
        itemSubtitle="Các bài được đánh dấu tích chọn trong bảng tổng hợp điểm"
        impactDetails={[
          `Toàn bộ ${selectedVisibleIds.length} bài nộp đã chọn sẽ bị xóa khỏi bảng điểm và thống kê`,
          'Lịch sử làm bài tương ứng trên thiết bị học sinh cũng được cập nhật theo',
          'Thao tác này có hiệu lực đồng bộ trên hệ thống và không thể hoàn tác',
        ]}
        isDeleting={isDeletingSubmission}
        onConfirm={handleConfirmDeleteBulkSubmissions}
        onCancel={() => {
          if (!isDeletingSubmission) setShowBulkDeleteModal(false);
        }}
      />

      {/* MODAL XUẤT BÁO CÁO PDF / WORD / EXCEL */}
      {showPdfExportModal && (
        <Suspense fallback={null}>
          <GradebookPdfReportModal
            isOpen={showPdfExportModal}
            onClose={() => {
              setShowPdfExportModal(false);
              setPdfPreselectedStudent(null);
            }}
            classrooms={classrooms}
            selectedClassId={selectedClassId}
            selectedExamId={selectedExamId}
            examsList={examsList}
            submissions={filteredSubmissions}
            analytics={analytics}
            initialStudentSubmission={pdfPreselectedStudent}
          />
        </Suspense>
      )}
    </div>
  );
};

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
} from '../../lib/scoringEngine';
import {
  Award,
  Users,
  Search,
  BarChart3,
  TrendingUp,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Calendar,
  Clock,
  ShieldAlert,
  ArrowUpDown,
  X,
  FileText,
  Trash2,
  ClipboardList,
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
  return { time, date, full: `${time} - ${date}` };
};

const formatDurationSpent = (seconds: number) => {
  const safeSec = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  if (mins === 0) return `${secs} giây`;
  if (secs === 0) return `${mins} phút`;
  return `${mins} phút ${secs} giây`;
};

export const TeacherGradebookView: React.FC<TeacherGradebookViewProps> = ({
  classrooms,
  submissions,
  examsList,
  userRole = 'teacher',
  onDeleteSubmission,
  onDeleteMultipleSubmissions,
}) => {
  // Bộ lọc
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [searchStudentTerm, setSearchStudentTerm] = useState<string>('');
  const [sortField, setSortField] = useState<'score' | 'time' | 'date'>('score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [scoreRangeFilter, setScoreRangeFilter] = useState<'all' | 'excellent' | 'good' | 'average' | 'below'>('all');

  // Modal xem chi tiết bài làm của 1 học sinh
  const [viewingSubmission, setViewingSubmission] = useState<StudentExamSubmission | null>(null);

  // Thông báo xuất file
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Modal xuất báo cáo PDF (Cả lớp hoặc từng học sinh)
  const [showPdfExportModal, setShowPdfExportModal] = useState<boolean>(false);
  const [pdfPreselectedStudent, setPdfPreselectedStudent] = useState<StudentExamSubmission | null>(null);

  // Quyền xóa bài nộp của học sinh (Giáo viên / Quản trị viên)
  const canDeleteSubmissions = (userRole === 'teacher' || userRole === 'admin') && Boolean(onDeleteSubmission);
  const [submissionToDelete, setSubmissionToDelete] = useState<StudentExamSubmission | null>(null);
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(() => new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [isDeletingSubmission, setIsDeletingSubmission] = useState<boolean>(false);

  // Bộ lọc bảng thống kê từng câu hỏi
  const [questionStatsFilter, setQuestionStatsFilter] = useState<
    'all' | 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' | 'has_wrong'
  >('all');

  // Lọc danh sách bài nộp theo bộ lọc
  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((sub) => {
        // Lọc theo lớp
        if (selectedClassId !== 'all' && sub.classId !== selectedClassId) {
          return false;
        }
        // Lọc theo đề thi
        if (selectedExamId !== 'all' && sub.examId !== selectedExamId) {
          return false;
        }
        // Lọc theo khoảng điểm dựa trên thang điểm thực tế của đề thi
        if (scoreRangeFilter !== 'all') {
          const subScale = getSubmissionScalePoints(sub, examsList);
          const rankKey = classifyScoreByScale(sub.score, subScale).key;
          if (rankKey !== scoreRangeFilter) return false;
        }

        // Lọc theo từ khóa tìm kiếm học sinh
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
        } else if (sortField === 'time') {
          return sortOrder === 'desc'
            ? b.timeSpentSeconds - a.timeSpentSeconds
            : a.timeSpentSeconds - b.timeSpentSeconds;
        } else {
          return sortOrder === 'desc'
            ? new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
            : new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        }
      });
  }, [submissions, examsList, selectedClassId, selectedExamId, scoreRangeFilter, searchStudentTerm, sortField, sortOrder]);

  // Thống kê phân tích theo thang điểm thực tế của đề thi
  const analytics = useMemo(
    () => computeGradebookAnalytics(filteredSubmissions, examsList, selectedExamId),
    [filteredSubmissions, examsList, selectedExamId]
  );

  // Thống kê đáp án đưa ra, số bạn làm đúng / làm sai của từng câu
  const questionStatGroups = useMemo(
    () => computeExamQuestionStats(filteredSubmissions, examsList),
    [filteredSubmissions, examsList]
  );

  // Tìm thông tin đề thi của bài nộp đang xem
  const currentViewingExam = useMemo(() => {
    if (!viewingSubmission) return null;
    return examsList.find((e) => e.id === viewingSubmission.examId) || null;
  }, [viewingSubmission, examsList]);

  const currentViewingScaleInfo = useMemo(() => {
    if (!viewingSubmission) return getExamScaleInfo(null);
    return getExamScaleInfo(currentViewingExam, viewingSubmission.score);
  }, [viewingSubmission, currentViewingExam]);

  // Xuất bảng điểm CSV (In-browser download)
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

    setExportNotice('Đã xuất file bảng điểm CSV thành công!');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Xử lý chọn / bỏ chọn bài nộp để xóa hàng loạt
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">
            Cổng Tổng Hợp Điểm Giáo Viên
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Bảng Điểm & Thống Kê Năng Lực Học Sinh
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setPdfPreselectedStudent(null);
              setShowPdfExportModal(true);
            }}
            disabled={filteredSubmissions.length === 0}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all shrink-0"
          >
            <FileText size={16} />
            <span>Xuất Báo Cáo (PDF / Excel / Word)</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredSubmissions.length === 0}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition-all shrink-0"
          >
            <Download size={16} />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* Export notification */}
      {exportNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* KPI Cards: Phân tích & Thống kê điểm số */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Sĩ số nộp bài */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Bài Đã Nộp</span>
            <Users size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {analytics.total}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            trên tổng số học sinh
          </span>
        </div>

        {/* Điểm trung bình */}
        <div className="p-5 rounded-3xl bg-blue-50/70 border border-blue-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-bold">Điểm Trung Bình</span>
            <TrendingUp size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-900 font-mono">
            {analytics.isUniformScale ? (
              <>
                {analytics.average.toFixed(2)}
                <span className="text-sm font-bold text-blue-600">/{formatPointsNumber(analytics.scalePoints)}</span>
              </>
            ) : (
              `${analytics.averagePercent.toFixed(1)}%`
            )}
          </div>
          <span className="text-[11px] text-blue-700 font-semibold mt-1 block">
            {analytics.isUniformScale
              ? `Thang điểm ${formatPointsNumber(analytics.scalePoints)} (${analytics.averagePercent.toFixed(1)}%)`
              : `Quy đổi ${analytics.average.toFixed(2)}/10 · Nhiều thang (${analytics.distinctScales
                  .map((s) => `${formatPointsNumber(s)}đ`)
                  .join(', ')})`}
          </span>
        </div>

        {/* Điểm cao nhất / Thấp nhất */}
        <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-bold">Điểm Cao Nhất</span>
            <Award size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono">
            {analytics.max.toFixed(2)}
            <span className="text-sm font-bold text-emerald-700">
              /{formatPointsNumber(analytics.maxSubmissionScale)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
            Thấp nhất: {analytics.min.toFixed(2)}/{formatPointsNumber(analytics.minSubmissionScale)}đ
            {!analytics.isUniformScale ? ` (${analytics.minPercent.toFixed(1)}%)` : ''}
          </span>
        </div>

        {/* Tỉ lệ Giỏi (>= 80% thang đề) */}
        <div className="p-5 rounded-3xl bg-purple-50/70 border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-bold">
              Tỉ Lệ Giỏi (
              {analytics.isUniformScale
                ? `≥ ${formatPointsNumber(analytics.thresholds.excellentMin)}đ`
                : '≥ 80%'}
              )
            </span>
            <GraduationCap size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-900 font-mono">
            {analytics.total > 0 ? Math.round((analytics.excellentCount / analytics.total) * 100) : 0}%
          </div>
          <span className="text-[11px] text-purple-700 font-semibold mt-1 block">
            {analytics.excellentCount} học sinh đạt giỏi
          </span>
        </div>

        {/* Vi phạm Anti-cheat */}
        <div className="p-5 rounded-3xl bg-rose-50/70 border border-rose-200 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-bold">Cảnh Báo Gian Lận</span>
            <ShieldAlert size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-900 font-mono">
            {analytics.cheatingCount}
          </div>
          <span className="text-[11px] text-rose-700 font-semibold mt-1 block">
            {analytics.cheatingCount > 0 ? 'Có học sinh vi phạm tab' : 'Kỳ thi diễn ra an toàn'}
          </span>
        </div>
      </div>

      {/* Phổ điểm trực quan (Score distribution bars) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            <span>Phân Bố Phổ Điểm Lớp Học</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Thống kê trên {analytics.total} bài nộp ·{' '}
            {analytics.isUniformScale
              ? `Thang điểm ${formatPointsNumber(analytics.scalePoints)}`
              : `Xếp loại theo % thang điểm từng đề`}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {/* Giỏi */}
          <div>
            <div className="flex justify-between font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>
                  {analytics.isUniformScale
                    ? `Giỏi (${formatPointsNumber(analytics.thresholds.excellentMin)} - ${formatPointsNumber(
                        analytics.scalePoints
                      )} điểm · ≥ 80%)`
                    : 'Giỏi (≥ 80% thang điểm đề)'}
                </span>
              </span>
              <span>
                {analytics.excellentCount} HS (
                {analytics.total > 0 ? Math.round((analytics.excellentCount / analytics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${analytics.total > 0 ? (analytics.excellentCount / analytics.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Khá */}
          <div>
            <div className="flex justify-between font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1.5 text-blue-700">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>
                  {analytics.isUniformScale
                    ? `Khá (${formatPointsNumber(analytics.thresholds.goodMin)} - dưới ${formatPointsNumber(
                        analytics.thresholds.excellentMin
                      )} điểm · 65% - 79.9%)`
                    : 'Khá (65% - 79.9% thang điểm đề)'}
                </span>
              </span>
              <span>
                {analytics.goodCount} HS (
                {analytics.total > 0 ? Math.round((analytics.goodCount / analytics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${analytics.total > 0 ? (analytics.goodCount / analytics.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Trung bình */}
          <div>
            <div className="flex justify-between font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>
                  {analytics.isUniformScale
                    ? `Trung bình (${formatPointsNumber(analytics.thresholds.averageMin)} - dưới ${formatPointsNumber(
                        analytics.thresholds.goodMin
                      )} điểm · 50% - 64.9%)`
                    : 'Trung bình (50% - 64.9% thang điểm đề)'}
                </span>
              </span>
              <span>
                {analytics.averageCount} HS (
                {analytics.total > 0 ? Math.round((analytics.averageCount / analytics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${analytics.total > 0 ? (analytics.averageCount / analytics.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Dưới trung bình */}
          <div>
            <div className="flex justify-between font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>
                  {analytics.isUniformScale
                    ? `Dưới trung bình (< ${formatPointsNumber(analytics.thresholds.averageMin)} điểm · < 50%)`
                    : 'Dưới trung bình (< 50% thang điểm đề)'}
                </span>
              </span>
              <span>
                {analytics.belowCount} HS (
                {analytics.total > 0 ? Math.round((analytics.belowCount / analytics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${analytics.total > 0 ? (analytics.belowCount / analytics.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Thống kê đáp án đưa ra của từng câu: Số bạn làm đúng / làm sai */}
      {questionStatGroups.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-indigo-600" />
                <span>Thống Kê Đáp Án Từng Câu (Số Bạn Làm Đúng / Làm Sai)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Phân tích số học sinh trả lời đúng, trả lời sai, bỏ trống và phân bố các đáp án thí sinh đã chọn theo từng câu.
              </p>
            </div>

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
                  className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                    questionStatsFilter === tab.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {questionStatGroups.map((group) => {
              const visibleQuestions = group.questions.filter((q) => {
                if (questionStatsFilter === 'all') return true;
                if (questionStatsFilter === 'has_wrong') return q.wrongCount > 0 || q.partialCount > 0;
                return q.part === questionStatsFilter;
              });

              const sortedByWrong = group.hasExamDefinition
                ? [...group.questions].sort((a, b) => b.wrongCount + b.unansweredCount - (a.wrongCount + a.unansweredCount))
                : [];
              const hardestQuestion = sortedByWrong[0];
              const easiestQuestion = group.hasExamDefinition
                ? [...group.questions].sort((a, b) => b.correctRate - a.correctRate)[0]
                : undefined;

              return (
                <div key={group.examId} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900">{group.examTitle}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-mono font-bold text-[11px]">
                        Thang {formatPointsNumber(group.totalPoints)} điểm
                      </span>
                      <span className="text-slate-500 font-semibold">
                        · {group.submissionCount} bài nộp · {group.questions.length} câu
                      </span>
                    </div>

                    {group.hasExamDefinition && hardestQuestion && easiestQuestion && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          Đúng nhiều nhất: Câu {easiestQuestion.questionNumber} ({easiestQuestion.correctCount}/
                          {easiestQuestion.totalSubmissions} HS)
                        </span>
                        {hardestQuestion.wrongCount + hardestQuestion.unansweredCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                            Sai/Chưa đúng nhiều: Câu {hardestQuestion.questionNumber} (
                            {hardestQuestion.wrongCount + hardestQuestion.unansweredCount} HS)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {visibleQuestions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Không có câu hỏi nào thuộc bộ lọc hiện tại.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                            <th className="py-2.5 px-3 w-20 text-center">Câu</th>
                            <th className="py-2.5 px-3 w-24 text-center">Phần</th>
                            <th className="py-2.5 px-3 w-36">Đáp Án Đúng</th>
                            <th className="py-2.5 px-3 min-w-[240px]">Thống Kê Đáp Án Thí Sinh Đưa Ra</th>
                            <th className="py-2.5 px-3 w-24 text-center text-emerald-700">Làm Đúng</th>
                            <th className="py-2.5 px-3 w-24 text-center text-rose-700">Làm Sai</th>
                            <th className="py-2.5 px-3 w-20 text-center text-slate-500">Bỏ Trống</th>
                            <th className="py-2.5 px-3 w-32 text-center">Tỷ Lệ Đúng</th>
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
                                  <span className="font-black font-mono text-slate-900 block">
                                    Câu {qStat.questionNumber}
                                  </span>
                                  {qStat.points > 0 && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ({formatPointsNumber(qStat.points)}đ)
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      qStat.part === 'part_1_mcq'
                                        ? 'bg-blue-50 text-blue-700'
                                        : qStat.part === 'part_2_true_false'
                                        ? 'bg-purple-50 text-purple-700'
                                        : qStat.part === 'part_3_short_answer'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {qStat.partLabel}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 text-[11px]">
                                  {qStat.correctAnswerDisplay}
                                </td>

                                <td className="py-2.5 px-3">
                                  {qStat.part === 'part_2_true_false' && qStat.tfSubItems ? (
                                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                                      {qStat.tfSubItems.map((subIt) => (
                                        <div
                                          key={subIt.subKey}
                                          className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-1"
                                        >
                                          <span className="font-bold text-slate-700">
                                            Ý {subIt.subKey} ({subIt.expected}):
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
                                    <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                                      {qStat.optionStats.map((opt) => (
                                        <span
                                          key={opt.key}
                                          className={`px-2 py-0.5 rounded-lg border font-bold ${
                                            opt.key === '__blank__'
                                              ? 'bg-slate-100 border-slate-200 text-slate-500'
                                              : opt.isCorrect
                                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                              : opt.count > 0
                                              ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                                              : 'bg-slate-50 border-slate-200 text-slate-400'
                                          }`}
                                        >
                                          {opt.label}: {opt.count} HS ({opt.percent}%)
                                          {opt.isCorrect ? ' ✓' : ''}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-black font-mono">
                                    {qStat.correctCount}
                                  </span>
                                  {qStat.partialCount > 0 && (
                                    <span className="block text-[10px] text-amber-700 font-semibold mt-0.5">
                                      +1 phần: {qStat.partialCount}
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-lg font-black font-mono ${
                                      qStat.wrongCount > 0
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    {qStat.wrongCount}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                  {qStat.unansweredCount}
                                </td>

                                <td className="py-2.5 px-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                                      <span className="text-emerald-700">{qStat.correctRate}%</span>
                                      <span className="text-slate-400">
                                        {qStat.correctCount}/{qStat.totalSubmissions}
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                      <div
                                        className="h-full bg-emerald-500"
                                        style={{ width: `${correctPct}%` }}
                                        title={`Đúng: ${qStat.correctCount}`}
                                      />
                                      {partialPct > 0 && (
                                        <div
                                          className="h-full bg-amber-400"
                                          style={{ width: `${partialPct}%` }}
                                          title={`Đúng 1 phần: ${qStat.partialCount}`}
                                        />
                                      )}
                                      {wrongPct > 0 && (
                                        <div
                                          className="h-full bg-rose-500"
                                          style={{ width: `${wrongPct}%` }}
                                          title={`Sai: ${qStat.wrongCount}`}
                                        />
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
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Lọc theo lớp */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">Nhóm Lớp:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="all">Tất cả các lớp ({classrooms.length})</option>
              {classrooms.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} (#{cls.code})
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo đề thi */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">Đề Thi:</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:border-blue-600 max-w-[220px] truncate"
            >
              <option value="all">Tất cả đề thi</option>
              {examsList.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({formatPointsNumber(getExamScaleInfo(ex).totalPoints)}đ)
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo xếp loại điểm */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">Xếp Loại:</label>
            <select
              value={scoreRangeFilter}
              onChange={(e) => setScoreRangeFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="all">Tất cả mức điểm</option>
              <option value="excellent">
                {analytics.isUniformScale
                  ? `Giỏi (≥ ${formatPointsNumber(analytics.thresholds.excellentMin)}đ · ≥80%)`
                  : 'Giỏi (≥ 80% thang đề)'}
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
        </div>

        {/* Ô tìm kiếm học sinh */}
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchStudentTerm}
            onChange={(e) => setSearchStudentTerm(e.target.value)}
            placeholder="Tìm tên, email học sinh..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Gradebook Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Award size={18} className="text-blue-600" />
            <h3 className="font-extrabold text-base text-slate-900">
              Danh Sách Điểm Chi Tiết ({filteredSubmissions.length} bài nộp)
            </h3>
            {canDeleteSubmissions && selectedVisibleIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xóa đã chọn ({selectedVisibleIds.length})</span>
              </button>
            )}
          </div>

          {/* Sắp xếp */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold hidden sm:inline">Sắp xếp:</span>
            <button
              onClick={() => {
                if (sortField === 'score') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                else { setSortField('score'); setSortOrder('desc'); }
              }}
              className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                sortField === 'score' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              <ArrowUpDown size={13} />
              <span>Điểm {sortField === 'score' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}</span>
            </button>
            <button
              onClick={() => {
                if (sortField === 'date') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                else { setSortField('date'); setSortOrder('desc'); }
              }}
              className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                sortField === 'date' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              <Clock size={13} />
              <span>Thời gian nộp {sortField === 'date' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  {canDeleteSubmissions && (
                    <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        title="Chọn tất cả bài nộp đang hiển thị"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3.5 px-4 w-12 text-center">Hạng</th>
                  <th className="py-3.5 px-4">Học Sinh</th>
                  <th className="py-3.5 px-4">Lớp Học</th>
                  <th className="py-3.5 px-4">Đề Thi Đã Làm</th>
                  <th className="py-3.5 px-4">Thời Gian Nộp</th>
                  <th className="py-3.5 px-4 text-center">Điểm Tổng</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">P.I (MCQ)</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">P.II (Đ/S)</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">P.III (Ngắn)</th>
                  <th className="py-3.5 px-4 text-center">Giám Sát</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub, idx) => {
                  const cls = classrooms.find((c) => c.id === sub.classId);
                  const isTop3 = idx < 3 && sortField === 'score' && sortOrder === 'desc';
                  const submittedFormatted = formatSubmissionDateTime(sub.submittedAt);
                  const isChecked = selectedSubIds.has(sub.id);
                  return (
                    <tr
                      key={sub.id}
                      className={`transition-colors ${
                        isChecked ? 'bg-rose-50/50 hover:bg-rose-50/80' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {canDeleteSubmissions && (
                        <td className="py-3.5 pl-4 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectSubmission(sub.id)}
                            title={`Chọn bài nộp của ${sub.studentName}`}
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </td>
                      )}
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center font-black">
                        {isTop3 ? (
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-white text-[11px] ${
                              idx === 0
                                ? 'bg-amber-500 shadow-xs'
                                : idx === 1
                                ? 'bg-slate-400'
                                : 'bg-amber-700'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">{idx + 1}</span>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                            {sub.studentName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{sub.studentName}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{sub.studentEmail}</span>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 block">{cls?.name || 'Tự luyện / Lớp đã xóa'}</span>
                        <span className="text-[10px] font-mono text-slate-400">{cls?.code ? `#${cls.code}` : 'Tự do'}</span>
                      </td>

                      {/* Exam Title */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <span className="font-semibold text-slate-800 line-clamp-1">{sub.examTitle}</span>
                        <span className="text-[10px] text-slate-400">
                          Thời lượng làm: {formatDurationSpent(sub.timeSpentSeconds)}
                        </span>
                      </td>

                      {/* Submission Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 text-[11px]">
                          <Clock size={12} className="text-blue-600 shrink-0" />
                          <span>{submittedFormatted.time}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5 pl-4.5">
                          {submittedFormatted.date}
                        </span>
                      </td>

                      {/* Total Score */}
                      <td className="py-3.5 px-4 text-center">
                        {(() => {
                          const subScale = getSubmissionScalePoints(sub, examsList);
                          const rankInfo = classifyScoreByScale(sub.score, subScale);
                          return (
                            <span
                              className={`inline-block px-3 py-1 rounded-xl font-black font-mono text-sm whitespace-nowrap ${
                                rankInfo.key === 'excellent'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : rankInfo.key === 'good'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : rankInfo.key === 'average'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {sub.score.toFixed(2)}
                              <span className="text-[10px] font-semibold opacity-75">
                                /{formatPointsNumber(subScale)}
                              </span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Part Scores */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-700 hidden md:table-cell">
                        {sub.partScores.part1.toFixed(2)}đ
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-purple-700 hidden md:table-cell">
                        {sub.partScores.part2.toFixed(2)}đ
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-700 hidden md:table-cell">
                        {sub.partScores.part3.toFixed(2)}đ
                      </td>

                      {/* Anti-cheat status */}
                      <td className="py-3.5 px-4 text-center">
                        {sub.isDisqualified ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                            Hủy bài (Gian lận)
                          </span>
                        ) : sub.infractionCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center gap-1">
                            <AlertTriangle size={11} />
                            <span>{sub.infractionCount} lần vi phạm</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px] flex items-center justify-center gap-1">
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            <span>Chuẩn mực</span>
                          </span>
                        )}
                      </td>

                      {/* View, PDF & Delete Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPdfPreselectedStudent(sub);
                              setShowPdfExportModal(true);
                            }}
                            title="Xuất phiếu điểm PDF / Excel / Word cho học sinh này"
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingSubmission(sub)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>Xem Bài</span>
                          </button>
                          {canDeleteSubmissions && (
                            <button
                              type="button"
                              onClick={() => setSubmissionToDelete(sub)}
                              title={`Xóa bài nộp của ${sub.studentName}`}
                              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200/80 transition-colors cursor-pointer"
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
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Users size={40} className="mx-auto text-slate-300" />
            <p className="font-bold text-slate-600 text-sm">Không tìm thấy bài thi nào phù hợp</p>
            <p className="text-xs text-slate-400">Hãy thử thay đổi điều kiện lọc hoặc từ khóa tìm kiếm</p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: XEM CHI TIẾT BÀI THI CỦA HỌC SINH                                  */}
      {/* ========================================================================= */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
                  Chi Tiết Bài Nộp Của Học Sinh
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {viewingSubmission.studentName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewingSubmission.examTitle} · Lớp:{' '}
                  {classrooms.find((c) => c.id === viewingSubmission.classId)?.name || 'Tự luyện / Lớp đã xóa'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPdfPreselectedStudent(viewingSubmission);
                    setShowPdfExportModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  title="Xuất phiếu kết quả học sinh dạng PDF / Excel / Word"
                >
                  <FileText size={14} />
                  <span>Xuất Phiếu Điểm (PDF / Word / Excel)</span>
                </button>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-semibold block">Tổng Điểm:</span>
                  <span className="text-2xl font-black font-mono text-blue-600">
                    {viewingSubmission.score.toFixed(2)}/{formatPointsNumber(currentViewingScaleInfo.totalPoints)}
                  </span>
                </div>
                <button
                  onClick={() => setViewingSubmission(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Score Breakdown Pills (3 phần theo thang điểm của đề) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                <span className="text-[10px] font-bold text-blue-600 block">Phần I (MCQ)</span>
                <span className="text-lg font-black font-mono text-blue-900">
                  {viewingSubmission.partScores.part1}đ
                  {currentViewingExam && (
                    <span className="text-xs font-semibold text-blue-600">
                      /{formatPointsNumber(currentViewingScaleInfo.part1Max)}đ
                    </span>
                  )}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200">
                <span className="text-[10px] font-bold text-purple-600 block">Phần II (Đúng/Sai)</span>
                <span className="text-lg font-black font-mono text-purple-900">
                  {viewingSubmission.partScores.part2}đ
                  {currentViewingExam && (
                    <span className="text-xs font-semibold text-purple-600">
                      /{formatPointsNumber(currentViewingScaleInfo.part2Max)}đ
                    </span>
                  )}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold text-amber-600 block">Phần III (Ngắn)</span>
                <span className="text-lg font-black font-mono text-amber-900">
                  {viewingSubmission.partScores.part3}đ
                  {currentViewingExam && (
                    <span className="text-xs font-semibold text-amber-600">
                      /{formatPointsNumber(currentViewingScaleInfo.part3Max)}đ
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Anti-cheat and Time Spent Notes */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-blue-600" />
                <span>
                  Thời gian nộp bài:{' '}
                  <strong className="font-mono text-slate-900">
                    {formatSubmissionDateTime(viewingSubmission.submittedAt).full}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-slate-500" />
                <span>
                  Thời gian làm bài: <strong>{formatDurationSpent(viewingSubmission.timeSpentSeconds)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className={viewingSubmission.infractionCount > 0 ? 'text-rose-500' : 'text-emerald-500'} />
                <span>
                  Giám sát: <strong>{viewingSubmission.infractionCount} lần cảnh báo rời tab</strong>
                </span>
              </div>
            </div>

            {/* Questions Detailed Review */}
            {!currentViewingExam ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center space-y-1">
                <p className="font-bold">Đề thi gốc đã bị xóa hoặc gỡ khỏi hệ thống</p>
                <p className="text-amber-800">Không thể hiển thị danh sách câu hỏi chi tiết của bài nộp này.</p>
              </div>
            ) : (
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900">Chi Tiết Từng Câu Hỏi:</h4>

              {currentViewingExam.questions.map((q) => {
                let isQuestionCorrect = false;
                let studentDisplayAns = '';
                let correctDisplayAns = '';

                if (q.part === 'part_1_mcq') {
                  studentDisplayAns = viewingSubmission.answers[q.id] || 'Chưa trả lời';
                  correctDisplayAns = q.correctAnswer;
                  isQuestionCorrect = studentDisplayAns === correctDisplayAns;
                } else if (q.part === 'part_2_true_false') {
                  const aAns = viewingSubmission.answers[`${q.id}_a`];
                  const bAns = viewingSubmission.answers[`${q.id}_b`];
                  const cAns = viewingSubmission.answers[`${q.id}_c`];
                  const dAns = viewingSubmission.answers[`${q.id}_d`];
                  const fmtTF = (v: unknown) => (v === undefined || v === null ? '—' : v ? 'Đ' : 'S');
                  studentDisplayAns = `a:${fmtTF(aAns)}, b:${fmtTF(bAns)}, c:${fmtTF(cAns)}, d:${fmtTF(dAns)}`;
                  correctDisplayAns = q.items.map((it) => `${it.subKey}:${it.isCorrect ? 'Đ' : 'S'}`).join(', ');
                } else if (q.part === 'part_3_short_answer') {
                  studentDisplayAns = viewingSubmission.answers[q.id] || 'Chưa trả lời';
                  correctDisplayAns = q.correctAnswer;
                  isQuestionCorrect = studentDisplayAns.toString().trim() === correctDisplayAns.toString().trim();
                }

                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-[11px]">
                          {q.questionNumber}
                        </span>
                        <span className="font-bold text-slate-700">
                          {q.part === 'part_1_mcq'
                            ? 'Trắc nghiệm 4 lựa chọn'
                            : q.part === 'part_2_true_false'
                            ? 'Đúng/Sai 4 ý'
                            : 'Trả lời ngắn'}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-500">Thang điểm: {q.points}đ</span>
                    </div>

                    <p className="font-semibold text-slate-900">{q.prompt}</p>

                    {/* Ảnh đính kèm nếu có */}
                    {(q.pdfAttachmentUrl || q.imageAttachment) && (
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block max-w-full">
                        <ExamImage src={q.pdfAttachmentUrl || q.imageAttachment} alt="Ảnh đề bài" className="max-h-40 max-w-full w-auto rounded-lg object-contain bg-white" />
                      </div>
                    )}

                    {q.latex && (
                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <MathView math={q.latex} block />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Học sinh đã chọn:</span>
                        <strong className="text-slate-900">{studentDisplayAns}</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-emerald-700 block text-[10px]">Đáp án chính xác:</span>
                        <strong className="text-emerald-900">{correctDisplayAns}</strong>
                      </div>
                    </div>

                    {q.explanation && (
                      <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-slate-700 text-[11px]">
                        <span className="font-bold text-blue-700 block mb-0.5">Lời giải hướng dẫn:</span>
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            {/* Footer action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPdfPreselectedStudent(viewingSubmission);
                  setShowPdfExportModal(true);
                }}
                className="w-full sm:flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <FileText size={16} />
                <span>Xuất Phiếu Điểm (PDF / Word / Excel)</span>
              </button>
              {canDeleteSubmissions && (
                <button
                  type="button"
                  onClick={() => setSubmissionToDelete(viewingSubmission)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Xóa Bài Nộp</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="w-full sm:flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng Cửa Sổ Chi Tiết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN XÓA 1 BÀI NỘP CỦA HỌC SINH                               */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN XÓA NHIỀU BÀI NỘP ĐÃ CHỌN                                */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODAL: XUẤT BÁO CÁO KẾT QUẢ / PHIẾU ĐIỂM DẠNG PDF                         */}
      {/* ========================================================================= */}
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

import React, { useState, useMemo } from 'react';
import { StudentExamSubmission, Exam, Classroom, canStudentViewExamScore } from '../../types/math';
import {
  classifyScoreByScale,
  computeGradebookAnalytics,
  formatPointsNumber,
  getExamScaleInfo,
  getSubmissionScalePoints,
  isAnswerEquivalent,
} from '../../lib/scoringEngine';
import { MathView } from '../MathView';
import { ExamImage } from '../common/ExamImage';
import {
  FileCheck,
  Award,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  EyeOff,
  Filter,
  Search,
  BookOpen,
  TrendingUp,
  X,
  ShieldCheck,
  ChevronRight,
  Flame,
  Zap,
  Lock,
} from 'lucide-react';

interface StudentHistoryViewProps {
  currentStudentId: string;
  submissions: StudentExamSubmission[];
  examsList: Exam[];
  classrooms: Classroom[];
  onRetakeExam: (examId: string) => void;
  onOpenExamHub: () => void;
}

export const StudentHistoryView: React.FC<StudentHistoryViewProps> = ({
  currentStudentId,
  submissions,
  examsList,
  classrooms,
  onRetakeExam,
  onOpenExamHub,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<StudentExamSubmission | null>(null);
  const [showAnswersInHistory, setShowAnswersInHistory] = useState<boolean>(true);

  const examById = useMemo(() => {
    const map = new Map<string, Exam>();
    examsList.forEach((e) => map.set(e.id, e));
    return map;
  }, [examsList]);

  const canViewSubmissionScore = (sub: StudentExamSubmission): boolean => {
    const examObj = examById.get(sub.examId);
    return examObj ? canStudentViewExamScore(examObj) : true;
  };

  // Lọc danh sách bài đã làm của riêng học sinh hiện tại
  const studentSubmissions = useMemo(() => {
    return submissions.filter((s) => s.studentId === currentStudentId);
  }, [submissions, currentStudentId]);

  // Bộ lọc tìm kiếm và mức điểm (theo % thang điểm thực của đề)
  const filteredSubmissions = useMemo(() => {
    return studentSubmissions.filter((sub) => {
      const canView = canViewSubmissionScore(sub);
      if (scoreFilter !== 'all' && !canView) return false;

      if (scoreFilter !== 'all') {
        const subScale = getSubmissionScalePoints(sub, examsList);
        const rank = classifyScoreByScale(sub.score, subScale);
        if (scoreFilter === 'high' && rank.key !== 'excellent') return false;
        if (scoreFilter === 'medium' && rank.key !== 'good' && rank.key !== 'average') return false;
        if (scoreFilter === 'low' && rank.key !== 'below') return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return sub.examTitle.toLowerCase().includes(query);
      }
      return true;
    }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [studentSubmissions, scoreFilter, searchTerm, examById, examsList]);

  // Thống kê cá nhân (tính theo thang điểm thực của từng đề)
  const stats = useMemo(() => {
    if (studentSubmissions.length === 0) {
      return {
        total: 0,
        visibleCount: 0,
        avg: 0,
        max: 0,
        totalHours: '0.0',
        highCount: 0,
        isUniformScale: true,
        scalePoints: 10,
        averagePercent: 0,
        maxSubmissionScale: 10,
      };
    }
    const visibleSubs = studentSubmissions.filter((s) => canViewSubmissionScore(s));
    const analytics = computeGradebookAnalytics(visibleSubs, examsList);
    const totalSec = studentSubmissions.reduce((a, b) => a + b.timeSpentSeconds, 0);
    const totalHours = (totalSec / 3600).toFixed(1);

    return {
      total: studentSubmissions.length,
      visibleCount: visibleSubs.length,
      avg: analytics.average,
      max: analytics.max,
      totalHours,
      highCount: analytics.excellentCount,
      isUniformScale: analytics.isUniformScale,
      scalePoints: analytics.scalePoints,
      averagePercent: analytics.averagePercent,
      maxSubmissionScale: analytics.maxSubmissionScale,
    };
  }, [studentSubmissions, examById, examsList]);

  // Đề thi của bài nộp đang xem
  const activeExam = useMemo(() => {
    if (!selectedSubmission) return null;
    return examById.get(selectedSubmission.examId) || null;
  }, [selectedSubmission, examById]);

  const canViewActiveScore = activeExam ? canStudentViewExamScore(activeExam) : true;
  const canRevealActiveAnswers = Boolean(
    activeExam && canViewActiveScore && activeExam.allowViewAnswersAfterSubmit !== false && showAnswersInHistory
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">
            Hồ Sơ Học Tập Cá Nhân
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Tổng Hợp Các Bài Thi Đã Làm
          </h1>
        </div>

        <button
          onClick={onOpenExamHub}
          className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition-all shrink-0"
        >
          <BookOpen size={16} />
          <span>Vào Thi Đề Mới</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Đề Đã Hoàn Thành</span>
            <FileCheck size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {stats.total}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Bài kiểm tra & khảo sát
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-blue-50/70 border border-blue-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-bold">Điểm Trung Bình</span>
            <TrendingUp size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-900 font-mono">
            {stats.visibleCount > 0 ? stats.avg.toFixed(2) : '--'}
            {stats.visibleCount > 0 && (
              <span className="text-xs font-sans font-bold text-blue-600 ml-1">
                /{formatPointsNumber(stats.scalePoints)}đ
              </span>
            )}
          </div>
          <span className="text-[11px] text-blue-700 font-semibold mt-1 block">
            {stats.visibleCount > 0
              ? stats.isUniformScale
                ? `Thang ${formatPointsNumber(stats.scalePoints)}đ · Đạt ${stats.averagePercent}%`
                : `Quy đổi thang 10 · Đạt ${stats.averagePercent}%`
              : 'Chưa có bài công bố điểm'}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-bold">Điểm Kỷ Lục</span>
            <Award size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono">
            {stats.visibleCount > 0 ? stats.max.toFixed(2) : '--'}
            {stats.visibleCount > 0 && (
              <span className="text-xs font-sans font-bold text-emerald-600 ml-1">
                /{formatPointsNumber(stats.maxSubmissionScale)}đ
              </span>
            )}
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
            {stats.visibleCount > 0 ? `${stats.highCount} bài đạt loại Giỏi (≥80%)` : 'Chờ giáo viên mở điểm'}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-purple-50/70 border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-bold">Thời Gian Luyện</span>
            <Clock size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-900 font-mono">
            {stats.totalHours}h
          </div>
          <span className="text-[11px] text-purple-700 font-semibold mt-1 block">
            Rèn luyện nghiêm túc
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Mức điểm:</span>
          {(['all', 'high', 'medium', 'low'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setScoreFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scoreFilter === filter
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter === 'all'
                ? 'Tất cả'
                : filter === 'high'
                ? 'Giỏi (≥80%)'
                : filter === 'medium'
                ? 'TB - Khá (50-79%)'
                : 'Cần ôn lại (<50%)'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên đề thi..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length > 0 ? (
        <div className="space-y-4">
          {filteredSubmissions.map((sub) => {
            const cls = classrooms.find((c) => c.id === sub.classId);
            const examObj = examById.get(sub.examId);
            const canViewScore = canViewSubmissionScore(sub);
            const subScale = getExamScaleInfo(examObj, sub.score).totalPoints;
            const rankInfo = classifyScoreByScale(sub.score, subScale);

            return (
              <div
                key={sub.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {cls?.name || 'Đề Thi Thử Tự Luyện'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={13} />
                      <span>{new Date(sub.submittedAt).toLocaleString('vi-VN')}</span>
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={13} />
                      <span>{Math.round(sub.timeSpentSeconds / 60)} phút</span>
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">{sub.examTitle}</h3>

                  {/* Part scores summary */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    {canViewScore ? (
                      <>
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
                          P.I: <strong>{sub.partScores.part1}đ</strong>
                        </span>
                        <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg">
                          P.II: <strong>{sub.partScores.part2}đ</strong>
                        </span>
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">
                          P.III: <strong>{sub.partScores.part3}đ</strong>
                        </span>
                      </>
                    ) : (
                      <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg font-sans font-bold flex items-center gap-1">
                        <Lock size={12} />
                        <span>
                          {examObj?.scoreVisibility === 'after_close'
                            ? 'Điểm chi tiết sẽ công bố sau khi đóng đề'
                            : 'Giáo viên đang ẩn điểm bài thi này'}
                        </span>
                      </span>
                    )}

                    {sub.infractionCount > 0 ? (
                      <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg font-sans font-bold flex items-center gap-1">
                        <AlertTriangle size={12} />
                        <span>{sub.infractionCount} lần vi phạm</span>
                      </span>
                    ) : (
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg font-sans font-bold flex items-center gap-1">
                        <ShieldCheck size={12} />
                        <span>Không vi phạm</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Score badge & Actions */}
                <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-center md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Kết quả</span>
                    {canViewScore ? (
                      <div>
                        <span
                          className={`text-2xl font-black font-mono block ${
                            rankInfo.key === 'excellent'
                              ? 'text-emerald-600'
                              : rankInfo.key === 'good'
                              ? 'text-blue-600'
                              : rankInfo.key === 'average'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {sub.score.toFixed(2)}
                          <span className="text-xs text-slate-400 font-sans font-normal">
                            /{formatPointsNumber(subScale)}đ
                          </span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {rankInfo.percent}% · {rankInfo.label}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold mt-0.5">
                        <Lock size={12} />
                        <span>{examObj?.scoreVisibility === 'after_close' ? 'Chờ công bố' : 'Đã ẩn điểm'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSubmission(sub)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Eye size={15} />
                      <span>Xem Lại</span>
                    </button>
                    <button
                      onClick={() => {
                        try {
                          if (document.documentElement.requestFullscreen) {
                            document.documentElement.requestFullscreen().catch(() => {});
                          }
                        } catch (e) {}
                        onRetakeExam(sub.examId);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <RotateCcw size={15} />
                      <span>Làm Lại</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3 shadow-xs">
          <BookOpen size={48} className="mx-auto text-slate-300" />
          <h3 className="font-extrabold text-slate-700 text-base">Chưa có bài thi nào được ghi nhận</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Bạn chưa hoàn thành bài tập hoặc bài kiểm tra nào. Hãy vào Nhóm lớp để làm các bài tập do thầy cô giao nhé!
          </p>
          <div className="pt-2">
            <button
              onClick={onOpenExamHub}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
            >
              Vào Nhóm Lớp
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XEM LẠI BÀI LÀM CHI TIẾT (STUDENT REVIEW ATTEMPT)                  */}
      {/* ========================================================================= */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
                  Xem Lại Lời Giải & Đáp Án Bài Thi
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {selectedSubmission.examTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nộp lúc: {new Date(selectedSubmission.submittedAt).toLocaleString('vi-VN')} · Thời gian: {Math.round(selectedSubmission.timeSpentSeconds / 60)} phút
                </p>
              </div>

              <div className="flex items-center gap-3">
                {activeExam && canViewActiveScore && activeExam.allowViewAnswersAfterSubmit !== false && (
                  <button
                    type="button"
                    onClick={() => setShowAnswersInHistory(!showAnswersInHistory)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                      showAnswersInHistory
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                    title="Bật/Tắt hiển thị đáp án đúng để học sinh có thể tự suy ngẫm giải lại"
                  >
                    {showAnswersInHistory ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{showAnswersInHistory ? 'Tắt Xem Đáp Án' : 'Bật Xem Đáp Án'}</span>
                  </button>
                )}

                <div className="text-right">
                  <span className="text-xs text-slate-400 font-semibold block">Điểm số:</span>
                  {canViewActiveScore ? (
                    <span className="text-2xl font-black font-mono text-blue-600">
                      {selectedSubmission.score.toFixed(2)} /{' '}
                      {formatPointsNumber(
                        getExamScaleInfo(activeExam, selectedSubmission.score).totalPoints
                      )}{' '}
                      điểm
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold">
                      <Lock size={12} />
                      <span>{activeExam?.scoreVisibility === 'after_close' ? 'Chờ công bố' : 'Đã ẩn điểm'}</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Questions Detailed List */}
            {!activeExam ? (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 text-center">
                <AlertTriangle size={28} className="mx-auto text-amber-600" />
                <h4 className="font-extrabold text-sm">Đề thi gốc đã bị xóa hoặc gỡ khỏi hệ thống</h4>
                <p className="text-amber-800">
                  Kết quả điểm số của bạn vẫn được lưu lại (Phần I: {selectedSubmission.partScores.part1}đ · Phần II: {selectedSubmission.partScores.part2}đ · Phần III: {selectedSubmission.partScores.part3}đ), tuy nhiên nội dung từng câu hỏi không còn khả dụng.
                </p>
              </div>
            ) : (
            <div className="space-y-4">
              {activeExam.questions.map((q) => {
                let isQuestionCorrect = false;
                let studentDisplayAns = '';
                let correctDisplayAns = '';

                if (q.part === 'part_1_mcq') {
                  studentDisplayAns = selectedSubmission.answers[q.id] || 'Chưa trả lời';
                  correctDisplayAns = q.correctAnswer;
                  isQuestionCorrect = studentDisplayAns === correctDisplayAns;
                } else if (q.part === 'part_2_true_false') {
                  const aAns = selectedSubmission.answers[`${q.id}_a`];
                  const bAns = selectedSubmission.answers[`${q.id}_b`];
                  const cAns = selectedSubmission.answers[`${q.id}_c`];
                  const dAns = selectedSubmission.answers[`${q.id}_d`];
                  const fmtTF = (v: unknown) => (v === undefined || v === null ? '—' : v ? 'Đ' : 'S');
                  studentDisplayAns = `a:${fmtTF(aAns)}, b:${fmtTF(bAns)}, c:${fmtTF(cAns)}, d:${fmtTF(dAns)}`;
                  correctDisplayAns = q.items.map((it) => `${it.subKey}:${it.isCorrect ? 'Đ' : 'S'}`).join(', ');
                } else if (q.part === 'part_3_short_answer') {
                  studentDisplayAns = selectedSubmission.answers[q.id] || 'Chưa trả lời';
                  correctDisplayAns = q.correctAnswer;
                  isQuestionCorrect =
                    Boolean(selectedSubmission.answers[q.id]) &&
                    isAnswerEquivalent(String(studentDisplayAns), String(correctDisplayAns));
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

                    {/* Ảnh khối đáp án nếu có */}
                    {q.optionsAttachmentUrl && (
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block max-w-full">
                        <ExamImage src={q.optionsAttachmentUrl} alt="Khối đáp án" className="max-h-40 max-w-full w-auto rounded-lg object-contain bg-white" />
                      </div>
                    )}

                    {q.latex && (
                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <MathView math={q.latex} block />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                      <div
                        className={`p-2.5 rounded-xl border ${
                          !canRevealActiveAnswers
                            ? 'bg-slate-50 border-slate-200 text-slate-800'
                            : isQuestionCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-rose-50 border-rose-300 text-rose-900'
                        }`}
                      >
                        <span className="block text-[10px] font-sans font-bold opacity-75">Bạn đã chọn:</span>
                        <strong>{studentDisplayAns}</strong>
                      </div>
                      {canRevealActiveAnswers ? (
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                          <span className="block text-[10px] font-sans font-bold text-blue-700">Đáp án chính xác:</span>
                          <strong>{correctDisplayAns}</strong>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 italic flex items-center justify-center font-sans">
                          <span>{!canViewActiveScore ? 'Đáp án & điểm đang chờ công bố' : 'Đáp án đúng đã được ẩn'}</span>
                        </div>
                      )}
                    </div>

                    {canRevealActiveAnswers && q.explanation && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] space-y-1">
                        <span className="font-bold text-slate-900 block">Lời giải chi tiết:</span>
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="flex-1 py-3 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              {activeExam && (
                <button
                  onClick={() => {
                    const examId = selectedSubmission.examId;
                    setSelectedSubmission(null);
                    onRetakeExam(examId);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={15} />
                  <span>Làm Lại Đề Này Ngay</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Exam, Question, CheatLog, StudentExamSubmission } from '../../types/math';
import { gradePart2TrueFalse, validatePart3ShortAnswerFormat, isAnswerEquivalent } from '../../lib/scoringEngine';
import { MathView } from '../MathView';
import { ExamImage } from '../common/ExamImage';
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  Save,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  Send,
  FileCheck,
  History,
  Calendar,
  Lock,
  BookOpen,
  Users,
  Paperclip,
  ZoomIn,
  X,
  Sparkles,
  Maximize,
  Minimize,
  ArrowLeft,
  Eye,
  EyeOff,
  Flag,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExamEngineViewProps {
  onRecordCheatLog: (log: CheatLog) => void;
  examsList?: Exam[];
  activeExamId?: string;
  onSelectExamId?: (id: string) => void;
  onSubmitExam?: (submission: StudentExamSubmission) => void;
  onViewHistory?: () => void;
  onExitExam?: () => void;
  studentProfile?: { id: string; name: string; email: string };
  defaultClassId?: string;
  submissions?: StudentExamSubmission[];
}

const DUMMY_EMPTY_EXAM: Exam = {
  id: '',
  title: 'Chưa có đề thi',
  grade: 12,
  year: 2025,
  durationMinutes: 90,
  totalPoints: 10,
  status: 'draft',
  createdBy: '',
  createdAt: '',
  questions: [],
};

export const ExamEngineView: React.FC<ExamEngineViewProps> = ({
  onRecordCheatLog,
  examsList = [],
  activeExamId,
  onSelectExamId,
  onSubmitExam,
  onViewHistory,
  onExitExam,
  studentProfile,
  defaultClassId = 'cls_12a1',
  submissions = [],
}) => {
  const currentExam = examsList.find((e) => e.id === activeExamId) || examsList[0] || DUMMY_EMPTY_EXAM;
  const [exam, setExam] = useState<Exam>(currentExam);
  const [timeLeft, setTimeLeft] = useState<number>((currentExam.durationMinutes || 90) * 60);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [infractionCount, setInfractionCount] = useState<number>(0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [scoreReport, setScoreReport] = useState<any | null>(null);
  const [lastAutoSaved, setLastAutoSaved] = useState<string>('');
  // Bật / tắt xem đáp án chi tiết khi nộp bài xong
  const [showDetailedAnswers, setShowDetailedAnswers] = useState<boolean>(true);
  // Danh sách ID các câu hỏi được đánh dấu xem lại
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(() => new Set());
  // Bộ lọc bảng câu hỏi (Tất cả / Chưa làm / Đã làm / Đánh dấu)
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'unanswered' | 'answered' | 'flagged'>('all');
  // Thu gọn/mở rộng bảng câu hỏi trên màn hình nhỏ
  const [isPaletteExpandedMobile, setIsPaletteExpandedMobile] = useState<boolean>(true);
  // Highlight tạm thời câu hỏi vừa nhảy tới
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);

  // Trạng thái chế độ toàn màn hình
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' && !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
  });

  const enterFullscreen = () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
    } catch (e) {}
  };

  const exitFullscreen = () => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement) {
        (document as any).webkitExitFullscreen();
      }
    } catch (e) {}
  };

  // Bộ lọc danh mục đề thi (Giao theo lớp / Kho đề tổng hợp)
  const [examFilterType, setExamFilterType] = useState<'all' | 'classroom' | 'repository'>('all');

  // Modal xem phóng to ảnh đính kèm câu hỏi
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // Refs giữ trạng thái mới nhất cho timer, auto-submit và chống đếm trùng vi phạm
  const answersRef = useRef<Record<string, any>>(answers);
  const infractionCountRef = useRef<number>(infractionCount);
  const timeLeftRef = useRef<number>(timeLeft);
  const isSubmittedRef = useRef<boolean>(isSubmitted);
  const isDisqualifiedRef = useRef<boolean>(isDisqualified);
  const lastInfractionAtRef = useRef<number>(0);
  const handleSubmitExamRef = useRef<(disqualifyReason?: string) => void>(() => {});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Kiểm tra trạng thái đã làm của từng câu hỏi
  const isQuestionAnswered = (q: Question): boolean => {
    if (q.part === 'part_1_mcq') {
      return Boolean(answers[q.id]);
    }
    if (q.part === 'part_2_true_false') {
      const hasA = answers[`${q.id}_a`] !== undefined;
      const hasB = answers[`${q.id}_b`] !== undefined;
      const hasC = answers[`${q.id}_c`] !== undefined;
      const hasD = answers[`${q.id}_d`] !== undefined;
      return hasA || hasB || hasC || hasD;
    }
    if (q.part === 'part_3_short_answer') {
      return Boolean(answers[q.id] && String(answers[q.id]).trim().length > 0);
    }
    return false;
  };

  const getPart2AnsweredSubCount = (q: Question): number => {
    if (q.part !== 'part_2_true_false') return 0;
    return (['a', 'b', 'c', 'd'] as const).filter((k) => answers[`${q.id}_${k}`] !== undefined).length;
  };

  // Thống kê tiến độ câu hỏi đã làm & đánh dấu
  const totalQuestionCount = exam.questions.length;
  const answeredQuestionCount = useMemo(() => {
    return exam.questions.filter((q) => isQuestionAnswered(q)).length;
  }, [exam.questions, answers]);
  const unansweredQuestionCount = Math.max(0, totalQuestionCount - answeredQuestionCount);
  const flaggedQuestionCount = useMemo(() => {
    return exam.questions.filter((q) => flaggedQuestionIds.has(q.id)).length;
  }, [exam.questions, flaggedQuestionIds]);

  const toggleFlagQuestion = (qId: string) => {
    if (isSubmitted || isMaxAttemptsReached || !isExamTimeActive) return;
    setFlaggedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      if (exam.id) {
        try {
          localStorage.setItem(`math_flags_${studentId}_${exam.id}`, JSON.stringify(Array.from(next)));
        } catch {}
      }
      return next;
    });
  };

  const scrollToQuestion = (qId: string) => {
    const el = document.getElementById(`question-card-${qId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightedQuestionId(qId);
      setTimeout(() => {
        setHighlightedQuestionId((curr) => (curr === qId ? null : curr));
      }, 1500);
    }
  };

  // Số lượt làm bài đã thực hiện của học sinh đối với đề thi này
  const studentId = studentProfile?.id || 'usr_student_01';
  const examSubmissions = submissions.filter((s) => s.examId === exam.id && s.studentId === studentId);
  const currentAttemptCount = examSubmissions.length;
  const maxAttemptsAllowed = exam.maxAttempts && exam.maxAttempts > 0 ? exam.maxAttempts : 0;
  const isMaxAttemptsReached = maxAttemptsAllowed > 0 && currentAttemptCount >= maxAttemptsAllowed;

  // Kiểm tra thời gian mở / đóng đề thi
  const currentTime = new Date();
  const isOpenStarted = !exam.openTime || new Date(exam.openTime) <= currentTime;
  const isCloseTimePassed = exam.closeTime ? new Date(exam.closeTime) < currentTime : false;
  const isExamTimeActive = isOpenStarted && !isCloseTimePassed;

  // Cập nhật khi chọn đề thi khác HOẶC khi đề thi hiện tại được đồng bộ bản mới (ví dụ cập nhật link ảnh đám mây)
  useEffect(() => {
    if (currentExam.id !== exam.id) {
      setExam(currentExam);
      const nextDuration = (currentExam.durationMinutes || 90) * 60;
      setTimeLeft(nextDuration);
      timeLeftRef.current = nextDuration;
      setAnswers({});
      answersRef.current = {};
      setFlaggedQuestionIds(new Set());
      setPaletteFilter('all');
      setIsSubmitted(false);
      isSubmittedRef.current = false;
      setIsDisqualified(false);
      isDisqualifiedRef.current = false;
      setInfractionCount(0);
      infractionCountRef.current = 0;
      lastInfractionAtRef.current = 0;
      setScoreReport(null);
    } else if (currentExam !== exam) {
      setExam(currentExam);
    }
  }, [currentExam, exam]);

  // 1. Khởi tạo & nạp bản nháp từ LocalStorage (Auto-Save Restore theo từng học sinh)
  useEffect(() => {
    if (!exam.id) return;
    try {
      const draftKey = `math_draft_${studentId}_${exam.id}`;
      const draft = localStorage.getItem(draftKey);
      if (draft && !isMaxAttemptsReached && isExamTimeActive) {
        const parsedDraft = JSON.parse(draft);
        setAnswers(parsedDraft);
        answersRef.current = parsedDraft;
        setLastAutoSaved('Đã khôi phục bản nháp trước đó');
      }
      const flagsRaw = localStorage.getItem(`math_flags_${studentId}_${exam.id}`);
      if (flagsRaw && !isMaxAttemptsReached && isExamTimeActive) {
        const parsedFlags = JSON.parse(flagsRaw);
        if (Array.isArray(parsedFlags)) {
          setFlaggedQuestionIds(new Set(parsedFlags));
        }
      }
    } catch (e) {
      // ignore
    }
  }, [exam.id, studentId, isMaxAttemptsReached, isExamTimeActive]);

  // 2. Bộ đếm ngược thời gian làm bài
  useEffect(() => {
    if (isSubmitted || isDisqualified || isMaxAttemptsReached || !isExamTimeActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          timeLeftRef.current = 0;
          clearInterval(interval);
          handleSubmitExamRef.current('Hết giờ làm bài!');
          return 0;
        }
        const next = prev - 1;
        timeLeftRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted, isDisqualified, isMaxAttemptsReached, isExamTimeActive]);

  // 3. Tự động lưu bản nháp mỗi 10 giây vào LocalStorage
  useEffect(() => {
    if (!exam.id || isSubmitted || isDisqualified || isMaxAttemptsReached || !isExamTimeActive) return;

    const saveTimer = setInterval(() => {
      if (Object.keys(answersRef.current).length > 0) {
        localStorage.setItem(`math_draft_${studentId}_${exam.id}`, JSON.stringify(answersRef.current));
        setLastAutoSaved(`Đã lưu nháp lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      }
    }, 10000);

    return () => clearInterval(saveTimer);
  }, [exam.id, studentId, isSubmitted, isDisqualified, isMaxAttemptsReached, isExamTimeActive]);

  // Cấu hình kiểm soát màn hình từ đề thi (mặc định bật trừ khi giáo viên chọn Tắt)
  const isScreenMonitoringEnabled = exam.enableScreenMonitoring !== false;
  const maxAllowedInfractions = exam.maxInfractions && exam.maxInfractions > 0 ? exam.maxInfractions : 3;

  // 4. Cơ chế chống gian lận đa tầng: Bắt sự kiện rời màn hình / đổi tab (chỉ khi BẬT kiểm soát màn hình)
  useEffect(() => {
    if (!isScreenMonitoringEnabled || isSubmitted || isDisqualified || isMaxAttemptsReached || !isExamTimeActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        registerInfraction('Chuyển tab trình duyệt hoặc ẩn cửa sổ làm bài');
      }
    };

    const handleWindowBlur = () => {
      registerInfraction('Mất tiêu điểm màn hình bài thi (Alt+Tab hoặc bấm ra ngoài)');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isScreenMonitoringEnabled, isSubmitted, isDisqualified, isMaxAttemptsReached, isExamTimeActive]);

  const registerInfraction = (reason: string) => {
    if (!isScreenMonitoringEnabled || isSubmittedRef.current || isDisqualifiedRef.current) return;

    // Chống đếm trùng khi 1 thao tác rời tab kích hoạt đồng thời visibilitychange, blur và fullscreenchange
    const now = Date.now();
    if (now - lastInfractionAtRef.current < 1000) return;
    lastInfractionAtRef.current = now;

    const nextCount = infractionCountRef.current + 1;
    infractionCountRef.current = nextCount;
    setInfractionCount(nextCount);

    const newLog: CheatLog = {
      id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      examId: exam.id,
      examTitle: exam.title,
      studentId: studentId,
      studentName: studentProfile?.name || 'Học sinh',
      timestamp: new Date().toISOString(),
      infractionNumber: Math.min(nextCount, maxAllowedInfractions),
      event: 'window_unfocus',
      reason,
      actionTaken:
        nextCount >= maxAllowedInfractions
          ? 'auto_submitted_disqualified'
          : nextCount === 1
          ? 'warning_1'
          : 'warning_2',
    };

    onRecordCheatLog(newLog);

    if (nextCount < maxAllowedInfractions) {
      setWarningMessage(
        `Cảnh báo lần ${nextCount}: Hệ thống phát hiện bạn vừa rời khỏi màn hình bài thi (${nextCount}/${maxAllowedInfractions}). Vui lòng tập trung làm bài thi!`
      );
      setShowWarningModal(true);
    } else {
      isDisqualifiedRef.current = true;
      setIsDisqualified(true);
      setShowWarningModal(false);
      handleSubmitExamRef.current(`Đình chỉ bài thi: Vi phạm quy chế thi quá ${maxAllowedInfractions} lần!`);
    }
  };

  // 5. Tự động yêu cầu vào chế độ toàn màn hình khi làm bài & dọn dẹp khi unmount (chỉ khi BẬT kiểm soát)
  useEffect(() => {
    if (isScreenMonitoringEnabled && !isSubmitted && !isDisqualified && isExamTimeActive && !isMaxAttemptsReached) {
      enterFullscreen();
    }

    return () => {
      exitFullscreen();
    };
  }, [isScreenMonitoringEnabled, exam.id, isSubmitted, isDisqualified, isExamTimeActive, isMaxAttemptsReached]);

  // 6. Theo dõi sự kiện thay đổi toàn màn hình & phát hiện học sinh thoát toàn màn hình (chống gian lận)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);
      if (isScreenMonitoringEnabled && !isFull && !isSubmittedRef.current && !isDisqualifiedRef.current && isExamTimeActive && !isMaxAttemptsReached) {
        registerInfraction('Thoát khỏi chế độ toàn màn hình khi đang làm bài thi');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isScreenMonitoringEnabled, isSubmitted, isDisqualified, isExamTimeActive, isMaxAttemptsReached]);

  // 7. Chấm điểm bài thi tự động (CHỈ 3 PHẦN: MCQ, Đúng/Sai, Trả lời ngắn - KHÔNG CÓ TỰ LUẬN)
  // Tổng điểm bài thi dựa hoàn toàn trên tổng điểm từng câu hỏi của bài
  const handleSubmitExam = (disqualifyReason?: string) => {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;

    const latestAnswers = answersRef.current;
    const latestInfractionCount = infractionCountRef.current;
    const latestTimeLeft = timeLeftRef.current;

    let part1Score = 0;
    let part2Score = 0;
    let part3Score = 0;

    let part1Max = 0;
    let part2Max = 0;
    let part3Max = 0;

    const details: Record<string, any> = {};

    exam.questions.forEach((q) => {
      if (q.part === 'part_1_mcq') {
        const qPoints = q.points || 0.25;
        part1Max += qPoints;
        const studentAns = latestAnswers[q.id];
        const isCorrect = studentAns === q.correctAnswer;
        const earned = isCorrect ? qPoints : 0;
        part1Score += earned;
        details[q.id] = { isCorrect, earned, maxPoints: qPoints, studentAns, correctAnswer: q.correctAnswer };
      } else if (q.part === 'part_2_true_false') {
        const qPoints = q.points || 1.0;
        part2Max += qPoints;
        const studentTF = {
          a: latestAnswers[`${q.id}_a`],
          b: latestAnswers[`${q.id}_b`],
          c: latestAnswers[`${q.id}_c`],
          d: latestAnswers[`${q.id}_d`],
        };
        const correctTF = {
          a: q.items.find((i) => i.subKey === 'a')?.isCorrect || false,
          b: q.items.find((i) => i.subKey === 'b')?.isCorrect || false,
          c: q.items.find((i) => i.subKey === 'c')?.isCorrect || false,
          d: q.items.find((i) => i.subKey === 'd')?.isCorrect || false,
        };
        const rawResult = gradePart2TrueFalse(studentTF, correctTF);
        // Tỷ lệ điểm theo cấu hình q.points của giáo viên
        const scaledEarned = Number(((rawResult.earnedPoints / 1.0) * qPoints).toFixed(2));
        part2Score += scaledEarned;
        details[q.id] = { ...rawResult, earned: scaledEarned, maxPoints: qPoints, studentTF, correctTF };
      } else if (q.part === 'part_3_short_answer') {
        const qPoints = q.points || 0.5;
        part3Max += qPoints;
        const rawAns = latestAnswers[q.id] || '';
        const validation = validatePart3ShortAnswerFormat(rawAns);
        const isCorrect = validation.isValidFormat && isAnswerEquivalent(validation.sanitized, q.correctAnswer);
        const earned = isCorrect ? qPoints : 0;
        part3Score += earned;
        details[q.id] = { isCorrect, earned, maxPoints: qPoints, studentAns: rawAns, correctAnswer: q.correctAnswer };
      }
    });

    const totalCalculated = Number((part1Score + part2Score + part3Score).toFixed(2));
    const examTotalPoints = Number((part1Max + part2Max + part3Max).toFixed(2)) || exam.totalPoints || 10;

    setScoreReport({
      totalScore: totalCalculated,
      examTotalPoints,
      part1Score: Number(part1Score.toFixed(2)),
      part1Max: Number(part1Max.toFixed(2)),
      part2Score: Number(part2Score.toFixed(2)),
      part2Max: Number(part2Max.toFixed(2)),
      part3Score: Number(part3Score.toFixed(2)),
      part3Max: Number(part3Max.toFixed(2)),
      details,
      disqualifyReason,
    });

    const timeSpent = exam.durationMinutes * 60 - latestTimeLeft;

    if (onSubmitExam) {
      const submission: StudentExamSubmission = {
        id: `sub_${Date.now()}`,
        examId: exam.id,
        examTitle: exam.title,
        studentId: studentProfile?.id || 'usr_student_01',
        studentName: studentProfile?.name || 'Học sinh',
        studentEmail: studentProfile?.email || 'student@thpt-nbk.edu.vn',
        classId: defaultClassId,
        submittedAt: new Date().toISOString(),
        score: totalCalculated,
        partScores: {
          part1: Number(part1Score.toFixed(2)),
          part2: Number(part2Score.toFixed(2)),
          part3: Number(part3Score.toFixed(2)),
        },
        answers: latestAnswers,
        infractionCount: latestInfractionCount,
        isDisqualified: !!disqualifyReason,
        timeSpentSeconds: timeSpent > 0 ? timeSpent : 60,
      };
      onSubmitExam(submission);
    }

    setIsSubmitted(true);
    localStorage.removeItem(`math_draft_${studentId}_${exam.id}`);
    localStorage.removeItem(`math_flags_${studentId}_${exam.id}`);
    exitFullscreen();
  };

  handleSubmitExamRef.current = handleSubmitExam;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoString;
    }
  };

  // Lọc danh sách đề thi theo phân loại
  const filteredExamsList = examsList.filter((e) => {
    if (examFilterType === 'classroom') {
      return e.distributionType === 'classroom' || e.distributionType === 'both';
    }
    if (examFilterType === 'repository') {
      return e.distributionType === 'repository' || e.distributionType === 'both' || !e.distributionType;
    }
    return true;
  });

  if (examsList.length === 0 || !exam.id) {
    return (
      <div className="w-full min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Chưa có đề thi nào trong hệ thống</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Dữ liệu các đề thi cũ đã được làm sạch hoàn toàn. Thầy cô giáo vui lòng tạo và xuất bản đề thi mới từ mục Tạo Đề Thi hoặc giao đề trong nhóm lớp.
          </p>
          {onExitExam && (
            <button
              onClick={onExitExam}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Quay lại danh sách lớp học
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 pb-16">
      {/* Top Countdown & Anti-Cheat Sticky Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Exam Title & Details */}
          <div className="flex items-center gap-3">
            {onExitExam && (
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitted && isExamTimeActive && !isMaxAttemptsReached) {
                    setShowExitModal(true);
                  } else {
                    exitFullscreen();
                    onExitExam();
                  }
                }}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
                title="Rời phòng thi"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                  Phòng Thi Trực Tuyến
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-semibold text-slate-500">
                  {exam.durationMinutes} phút · {exam.totalPoints} điểm · {exam.questions.length} câu hỏi
                </span>
              </div>
              <div className="flex items-center gap-2">
                {examsList && examsList.length > 1 && onSelectExamId ? (
                  <select
                    value={exam.id}
                    onChange={(e) => onSelectExamId(e.target.value)}
                    className="text-sm sm:text-base font-black text-slate-900 bg-white border border-slate-300 rounded-xl px-2.5 py-1 focus:outline-none focus:border-blue-600 shadow-2xs max-w-[280px] sm:max-w-[420px] truncate cursor-pointer"
                    title="Chọn đề thi để làm bài"
                  >
                    {examsList.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.durationMinutes} phút · {ex.totalPoints}đ)
                      </option>
                    ))}
                  </select>
                ) : (
                  <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    {exam.title}
                  </h1>
                )}
              </div>
            </div>
          </div>

          {/* Status Indicators & Submission Action */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Countdown Clock */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700">
              <Clock size={16} />
              <span className="font-mono font-black text-base tabular-nums">{formatTimer(timeLeft)}</span>
            </div>

            {/* Anti-Cheat Infraction Indicator or Free Practice Badge */}
            {isScreenMonitoringEnabled ? (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold ${
                  infractionCount === 0
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : infractionCount < maxAllowedInfractions - 1
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                }`}
              >
                <ShieldAlert size={15} />
                <span>Giám sát màn hình: {infractionCount}/{maxAllowedInfractions}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-slate-200 bg-slate-100 text-slate-600 text-xs font-bold">
                <BookOpen size={15} className="text-slate-500" />
                <span>Luyện tập tự do</span>
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Mở toàn màn hình'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all shadow-2xs ${
                isFullscreen
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100'
              }`}
            >
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Toàn màn hình: Bật' : 'Toàn màn hình'}</span>
            </button>

            {/* Submit Button */}
            {!isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="px-5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all"
              >
                Nộp Bài Thi
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner nhắc nhở & chuyển nhanh sang Toàn Màn Hình (Chỉ khi BẬT kiểm soát màn hình) */}
        {!isFullscreen && isScreenMonitoringEnabled && !isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Maximize size={18} className="text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold block">Chế độ thi yêu cầu Toàn Màn Hình</span>
              </div>
            </div>
            <button
              type="button"
              onClick={enterFullscreen}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs whitespace-nowrap flex items-center gap-1.5 transition-colors"
            >
              <Maximize size={14} />
              <span>Bật Toàn Màn Hình Ngay</span>
            </button>
          </div>
        )}

      {/* CẢNH BÁO: ĐÃ ĐẠT GIỚI HẠN SỐ LƯỢT LÀM BÀI */}
      {isMaxAttemptsReached && !isSubmitted && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Lock size={18} className="text-amber-600" />
            <span>Đã đạt giới hạn số lượt làm bài thi!</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Đề thi này được giáo viên cấu hình giới hạn tối đa <strong>{maxAttemptsAllowed} lượt</strong>. Bạn đã hoàn thành{' '}
            <strong>{currentAttemptCount}/{maxAttemptsAllowed} lượt</strong>. Bạn không thể làm lại đề thi này.
          </p>
          <div className="pt-2 flex gap-2">
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
              >
                <History size={14} />
                <span>Xem Kết Quả Bài Thi Đã Làm</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* CẢNH BÁO: NGOÀI THỜI GIAN MỞ / ĐÓNG ĐỀ THI */}
      {!isExamTimeActive && (
        <div className="p-5 rounded-3xl bg-slate-50 border border-slate-300 text-slate-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Calendar size={18} className="text-blue-600" />
            <span>
              {!isOpenStarted
                ? `Đề thi chưa mở (Mở lúc: ${formatDateTime(exam.openTime)})`
                : `Đề thi đã đóng (Hết hạn lúc: ${formatDateTime(exam.closeTime)})`}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {!isOpenStarted
              ? 'Phòng thi trực tuyến hiện chưa mở. Vui lòng quay lại đúng khung giờ đã được giáo viên thông báo.'
              : 'Thời hạn làm bài của đề thi này đã kết thúc. Bạn chỉ có thể xem lại tài liệu và lịch sử làm bài trước đó.'}
          </p>
        </div>
      )}

      {/* Auto-Save Draft Status Pill */}
      {lastAutoSaved && !isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
        <div className="flex items-center text-xs text-slate-500 px-4">
          <span className="flex items-center gap-1.5">
            <Save size={13} className="text-emerald-600" />
            <span>{lastAutoSaved}</span>
          </span>
        </div>
      )}

      {/* Score Report (When Submitted) */}
      {isSubmitted && scoreReport && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Award size={24} className="text-amber-500" />
                <h3 className="text-2xl font-black text-slate-900">Báo Cáo Kết Quả Bài Thi</h3>
              </div>
              {scoreReport.disqualifyReason ? (
                <p className="text-xs text-red-600 font-bold mt-1">{scoreReport.disqualifyReason}</p>
              ) : (
                <p className="text-xs text-emerald-600 font-bold mt-1">
                  Đã nộp bài hợp lệ · Tuân thủ quy chế thi trực tuyến THPT 2025
                </p>
              )}
            </div>

            {/* Total Score Badge - Tính toán hoàn toàn dựa trên tổng điểm của bài */}
            <div className="text-center bg-blue-50 border border-blue-200 px-6 py-3 rounded-2xl">
              <span className="text-xs font-bold text-blue-600 block uppercase tracking-wider">Tổng Điểm Đạt Được</span>
              <span className="text-3xl font-black text-blue-900 font-mono tabular-nums">
                {scoreReport.totalScore} / {scoreReport.examTotalPoints} điểm
              </span>
            </div>
          </div>

          {/* Part Scores Breakdown (CHỈ 3 PHẦN THI TRẮC NGHIỆM CHUẨN BGD) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-xs font-bold text-blue-700 block">Phần I: Trắc Nghiệm 4 Lựa Chọn</span>
              <span className="text-xl font-black text-blue-900 font-mono mt-0.5 block">
                {scoreReport.part1Score} / {scoreReport.part1Max} điểm
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
              <span className="text-xs font-bold text-purple-700 block">Phần II: Đúng / Sai 4 Ý</span>
              <span className="text-xl font-black text-purple-900 font-mono mt-0.5 block">
                {scoreReport.part2Score} / {scoreReport.part2Max} điểm
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-xs font-bold text-amber-700 block">Phần III: Trả Lời Ngắn</span>
              <span className="text-xl font-black text-amber-900 font-mono mt-0.5 block">
                {scoreReport.part3Score} / {scoreReport.part3Max} điểm
              </span>
            </div>
          </div>

          {/* Toggle Bật/Tắt Xem Đáp Án & Lời Giải Chi Tiết */}
          {exam.allowViewAnswersAfterSubmit !== false ? (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                  <Eye size={18} />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-blue-900 block">
                    Chế Độ Xem Đáp Án & Lời Giải Chi Tiết
                  </span>
                  <span className="text-[11px] text-blue-700">
                    {showDetailedAnswers
                      ? 'Đang bật: Hiển thị phương án đúng, tô màu kết quả và bài giải từng câu'
                      : 'Đang tắt: Đang ẩn đáp án đúng để học sinh có thể tự suy ngẫm giải lại'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDetailedAnswers(!showDetailedAnswers)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs whitespace-nowrap ${
                  showDetailedAnswers
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                {showDetailedAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showDetailedAnswers ? 'Tắt Xem Đáp Án' : 'Bật Xem Đáp Án'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <Lock size={16} className="text-amber-600 shrink-0" />
              <span>Thầy cô đã tắt tính năng xem đáp án cho đề thi này để bảo mật phòng thi.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            {!isMaxAttemptsReached && (
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setIsDisqualified(false);
                  setInfractionCount(0);
                  setTimeLeft(exam.durationMinutes * 60);
                  setAnswers({});
                  setFlaggedQuestionIds(new Set());
                  setPaletteFilter('all');
                  try {
                    localStorage.removeItem(`math_flags_${studentId}_${exam.id}`);
                  } catch {}
                }}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw size={15} />
                <span>Làm Lại Đề Thi Này</span>
              </button>
            )}
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                <History size={15} />
                <span>Xem Tổng Hợp Bài Đã Làm</span>
              </button>
            )}
            {onExitExam && (
              <button
                onClick={() => {
                  exitFullscreen();
                  onExitExam();
                }}
                className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft size={15} />
                <span>Rời Phòng Thi & Về Lớp</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bố cục 2 cột: Danh sách câu hỏi & Bảng trạng thái câu hỏi */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
      <div className="space-y-8">
        {/* PHẦN 1: TRẮC NGHIỆM 4 PHƯƠNG ÁN */}
        {exam.questions.some((q) => q.part === 'part_1_mcq') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-extrabold text-xs">Phần I</span>
                <h3 className="font-extrabold text-base text-slate-900">
                  Câu Hỏi Trắc Nghiệm Nhiều Lựa Chọn (4 Chọn 1)
                </h3>
              </div>
              <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-full">
                Tổng:{' '}
                {exam.questions
                  .filter((q) => q.part === 'part_1_mcq')
                  .reduce((sum, q) => sum + (q.points || 0), 0)
                  .toFixed(2)}
                đ
              </span>
            </div>

            {exam.questions
              .filter((q) => q.part === 'part_1_mcq')
              .map((q) => {
                const result = scoreReport?.details[q.id];
                const isFlagged = flaggedQuestionIds.has(q.id);
                const isHighlighted = highlightedQuestionId === q.id;
                return (
                  <div
                    key={q.id}
                    id={`question-card-${q.id}`}
                    className={`bg-white p-6 rounded-3xl border space-y-4 shadow-xs scroll-mt-24 transition-all ${
                      isHighlighted
                        ? 'border-blue-500 ring-2 ring-blue-300'
                        : isFlagged
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-blue-600">Câu {q.questionNumber}:</span>
                        <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                          <MathView math={q.prompt} />
                        </div>
                        {q.latex && <MathView math={q.latex} block />}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
                          <button
                            type="button"
                            onClick={() => toggleFlagQuestion(q.id)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                              isFlagged
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                            }`}
                            title={isFlagged ? 'Bỏ đánh dấu câu này' : 'Đánh dấu câu này để xem lại'}
                          >
                            <Flag size={12} className={isFlagged ? 'fill-amber-500 text-amber-600' : ''} />
                            <span className="hidden sm:inline">{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                          </button>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-400">({q.points}đ)</span>
                        {isSubmitted && result && (
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              result.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {result.isCorrect ? `+${q.points}đ` : '0đ'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ảnh đính kèm câu hỏi nếu có */}
                    {(q.pdfAttachmentUrl || q.imageAttachment) && (
                      <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full">
                        <div className="relative group cursor-pointer" onClick={() => setZoomedImage((q.pdfAttachmentUrl || q.imageAttachment)!)}>
                          <ExamImage
                            src={q.pdfAttachmentUrl || q.imageAttachment}
                            alt="Hình vẽ đính kèm đề bài"
                            className="max-h-56 max-w-full w-auto rounded-xl object-contain bg-white"
                          />
                          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            <ZoomIn size={16} className="mr-1" /> Phóng to hình ảnh
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tài liệu PDF đính kèm nếu có */}
                    {q.pdfAttachmentName && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-xs">
                        <Paperclip size={13} />
                        <span>Tài liệu đính kèm: {q.pdfAttachmentName}</span>
                      </div>
                    )}

                    {/* Ảnh khối đáp án đính kèm nếu có */}
                    {q.optionsAttachmentUrl && (
                      <div
                        className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full my-2 cursor-pointer relative group"
                        onClick={() => setZoomedImage(q.optionsAttachmentUrl!)}
                      >
                        <ExamImage src={q.optionsAttachmentUrl} alt="Bảng 4 phương án lựa chọn" className="max-h-56 max-w-full w-auto rounded-xl object-contain bg-white" />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <ZoomIn size={16} className="mr-1" /> Phóng to bảng đáp án
                        </div>
                      </div>
                    )}

                    {/* Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {q.options.map((opt) => {
                        const isSelected = answers[q.id] === opt.key;
                        const isCorrect = q.correctAnswer === opt.key;
                        const canViewAnswer = isSubmitted && (exam.allowViewAnswersAfterSubmit !== false) && showDetailedAnswers;

                        let borderClass = 'border-slate-200 hover:border-slate-300';
                        if (isSelected) borderClass = 'border-blue-600 bg-blue-50/60 font-bold';

                        if (canViewAnswer) {
                          if (isCorrect) borderClass = 'border-emerald-500 bg-emerald-50 font-bold ring-2 ring-emerald-300';
                          else if (isSelected) borderClass = 'border-rose-400 bg-rose-50';
                        }

                        return (
                          <button
                            key={opt.key}
                            type="button"
                            disabled={isSubmitted || isMaxAttemptsReached || !isExamTimeActive}
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.key }))}
                            className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${borderClass}`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                                canViewAnswer && isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {opt.key}
                            </span>
                            <div className="text-xs sm:text-sm text-slate-800 flex-1 min-w-0 leading-relaxed">
                              {opt.text && <MathView math={opt.text} />}
                              {opt.latex && <MathView math={opt.latex} block />}
                              {opt.imageUrl && (
                                <ExamImage
                                  src={opt.imageUrl}
                                  alt={`Phương án ${opt.key}`}
                                  className="block max-h-28 max-w-full w-auto h-auto object-contain rounded-lg border border-slate-200 mt-1 bg-white cursor-pointer hover:opacity-90"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedImage(opt.imageUrl!);
                                  }}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {isSubmitted && (exam.allowViewAnswersAfterSubmit !== false) && showDetailedAnswers && q.explanation && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                          <BookOpen size={14} className="text-blue-600" />
                          <span>Lời giải chi tiết:</span>
                        </span>
                        <div className="leading-relaxed">
                          <MathView math={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* PHẦN 2: TRẮC NGHIỆM ĐÚNG / SAI 4 Ý */}
        {exam.questions.some((q) => q.part === 'part_2_true_false') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-extrabold text-xs">Phần II</span>
                <h3 className="font-extrabold text-base text-slate-900">
                  Câu Hỏi Trắc Nghiệm Đúng / Sai (Mỗi câu gồm 4 ý độc lập)
                </h3>
              </div>
              <span className="text-xs text-purple-600 font-bold bg-purple-50 px-2.5 py-1 rounded-full">
                Tổng:{' '}
                {exam.questions
                  .filter((q) => q.part === 'part_2_true_false')
                  .reduce((sum, q) => sum + (q.points || 0), 0)
                  .toFixed(2)}
                đ
              </span>
            </div>

            {exam.questions
              .filter((q) => q.part === 'part_2_true_false')
              .map((q) => {
                const result = scoreReport?.details[q.id];
                const isFlagged = flaggedQuestionIds.has(q.id);
                const isHighlighted = highlightedQuestionId === q.id;
                return (
                  <div
                    key={q.id}
                    id={`question-card-${q.id}`}
                    className={`bg-white p-6 rounded-3xl border space-y-4 shadow-xs scroll-mt-24 transition-all ${
                      isHighlighted
                        ? 'border-purple-500 ring-2 ring-purple-300'
                        : isFlagged
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-purple-600">Câu {q.questionNumber}:</span>
                        <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                          <MathView math={q.prompt} />
                        </div>
                        {q.latex && <MathView math={q.latex} block />}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
                          <button
                            type="button"
                            onClick={() => toggleFlagQuestion(q.id)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                              isFlagged
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                            }`}
                            title={isFlagged ? 'Bỏ đánh dấu câu này' : 'Đánh dấu câu này để xem lại'}
                          >
                            <Flag size={12} className={isFlagged ? 'fill-amber-500 text-amber-600' : ''} />
                            <span className="hidden sm:inline">{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                          </button>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-400">({q.points}đ)</span>
                        {isSubmitted && result && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800">
                            +{result.earned}đ ({result.correctCount}/4 ý)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ảnh đính kèm */}
                    {(q.pdfAttachmentUrl || q.imageAttachment) && (
                      <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full">
                        <div className="relative group cursor-pointer" onClick={() => setZoomedImage((q.pdfAttachmentUrl || q.imageAttachment)!)}>
                          <ExamImage
                            src={q.pdfAttachmentUrl || q.imageAttachment}
                            alt="Hình vẽ đính kèm đề bài"
                            className="max-h-56 max-w-full w-auto rounded-xl object-contain bg-white"
                          />
                          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            <ZoomIn size={16} className="mr-1" /> Phóng to hình ảnh
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ảnh khối 4 ý a, b, c, d nếu có */}
                    {q.optionsAttachmentUrl && (
                      <div
                        className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full my-2 cursor-pointer relative group"
                        onClick={() => setZoomedImage(q.optionsAttachmentUrl!)}
                      >
                        <ExamImage src={q.optionsAttachmentUrl} alt="Bảng 4 ý đúng sai" className="max-h-56 max-w-full w-auto rounded-xl object-contain bg-white" />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <ZoomIn size={16} className="mr-1" /> Phóng to bảng ý
                        </div>
                      </div>
                    )}

                    {/* Bảng 4 ý a, b, c, d */}
                    <div className="space-y-2 pt-2">
                      {q.items.map((item) => {
                        const answerKey = `${q.id}_${item.subKey}`;
                        const currentVal = answers[answerKey];

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="text-xs sm:text-sm text-slate-800 flex-1 min-w-0 leading-relaxed">
                              <span className="font-bold text-purple-700 mr-2">{item.subKey})</span>
                              {item.text && <MathView math={item.text} />}
                              {item.latex && <MathView math={item.latex} block />}
                              {item.imageUrl && (
                                <ExamImage
                                  src={item.imageUrl}
                                  alt={`Ý ${item.subKey}`}
                                  className="block max-h-28 max-w-full w-auto h-auto object-contain rounded-lg border border-slate-200 mt-1 bg-white cursor-pointer hover:opacity-90"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedImage(item.imageUrl!);
                                  }}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isSubmitted || isMaxAttemptsReached || !isExamTimeActive}
                                onClick={() => setAnswers((prev) => ({ ...prev, [answerKey]: true }))}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  currentVal === true
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                ĐÚNG
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitted || isMaxAttemptsReached || !isExamTimeActive}
                                onClick={() => setAnswers((prev) => ({ ...prev, [answerKey]: false }))}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  currentVal === false
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                SAI
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {isSubmitted && q.explanation && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                        <span className="font-bold text-slate-900 block">Lời giải chi tiết:</span>
                        <div className="leading-relaxed">
                          <MathView math={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* PHẦN 3: CÂU TRẢ LỜI NGẮN (≤ 4 KÝ TỰ) */}
        {exam.questions.some((q) => q.part === 'part_3_short_answer') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-extrabold text-xs">Phần III</span>
                <h3 className="font-extrabold text-base text-slate-900">
                  Câu Hỏi Trả Lời Ngắn (Điền kết quả tối đa 4 ký tự)
                </h3>
              </div>
              <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-full">
                Tổng:{' '}
                {exam.questions
                  .filter((q) => q.part === 'part_3_short_answer')
                  .reduce((sum, q) => sum + (q.points || 0), 0)
                  .toFixed(2)}
                đ
              </span>
            </div>

            {exam.questions
              .filter((q) => q.part === 'part_3_short_answer')
              .map((q) => {
                const result = scoreReport?.details[q.id];
                const isFlagged = flaggedQuestionIds.has(q.id);
                const isHighlighted = highlightedQuestionId === q.id;
                return (
                  <div
                    key={q.id}
                    id={`question-card-${q.id}`}
                    className={`bg-white p-6 rounded-3xl border space-y-4 shadow-xs scroll-mt-24 transition-all ${
                      isHighlighted
                        ? 'border-amber-500 ring-2 ring-amber-300'
                        : isFlagged
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-amber-600">Câu {q.questionNumber}:</span>
                        <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                          <MathView math={q.prompt} />
                        </div>
                        {q.latex && <MathView math={q.latex} block />}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
                          <button
                            type="button"
                            onClick={() => toggleFlagQuestion(q.id)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                              isFlagged
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                            }`}
                            title={isFlagged ? 'Bỏ đánh dấu câu này' : 'Đánh dấu câu này để xem lại'}
                          >
                            <Flag size={12} className={isFlagged ? 'fill-amber-500 text-amber-600' : ''} />
                            <span className="hidden sm:inline">{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                          </button>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-400">({q.points}đ)</span>
                        {isSubmitted && result && (
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              result.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {result.isCorrect ? `+${q.points}đ` : '0đ'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ảnh đính kèm */}
                    {(q.pdfAttachmentUrl || q.imageAttachment) && (
                      <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full">
                        <div className="relative group cursor-pointer" onClick={() => setZoomedImage((q.pdfAttachmentUrl || q.imageAttachment)!)}>
                          <ExamImage
                            src={q.pdfAttachmentUrl || q.imageAttachment}
                            alt="Hình vẽ đính kèm đề bài"
                            className="max-h-56 max-w-full w-auto rounded-xl object-contain bg-white"
                          />
                          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            <ZoomIn size={16} className="mr-1" /> Phóng to hình ảnh
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ảnh khối đáp án / lời giải nếu có */}
                    {q.optionsAttachmentUrl && (
                      <div
                        className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full my-2 cursor-pointer relative group"
                        onClick={() => setZoomedImage(q.optionsAttachmentUrl!)}
                      >
                        <ExamImage src={q.optionsAttachmentUrl} alt="Đáp án/lời giải đính kèm" className="max-h-56 max-w-full w-auto rounded-xl object-contain bg-white" />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <ZoomIn size={16} className="mr-1" /> Phóng to hình ảnh
                        </div>
                      </div>
                    )}

                    {/* Tài liệu đính kèm */}
                    {q.pdfAttachmentName && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-xs">
                        <Paperclip size={13} />
                        <span>Tài liệu đính kèm: {q.pdfAttachmentName}</span>
                      </div>
                    )}

                    {/* Input trả lời ngắn */}
                    <div className="pt-2">
                      <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                        Đáp án của bạn (Tối đa 4 ký tự: số, dấu âm, dấu phẩy, phân số):
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        disabled={isSubmitted || isMaxAttemptsReached || !isExamTimeActive}
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="VD: 4, -0.5, 2/3"
                        className="w-full sm:w-64 h-11 px-4 rounded-xl border border-slate-300 font-mono font-bold text-base focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {isSubmitted && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                        <span className="font-bold text-amber-700 block">
                          Đáp án chuẩn: <span className="font-mono">{q.correctAnswer}</span>
                        </span>
                        {q.explanation && (
                          <div className="leading-relaxed mt-1">
                            <MathView math={q.explanation} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Bottom Submission Action Bar */}
      {!isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Bạn đã làm xong bài kiểm tra?</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Đã trả lời <strong className="text-blue-600 font-bold">{answeredQuestionCount}/{totalQuestionCount}</strong> câu hỏi
              {flaggedQuestionCount > 0 ? (
                <> · Đang đánh dấu <strong className="text-amber-600 font-bold">{flaggedQuestionCount}</strong> câu</>
              ) : null}. Hãy kiểm tra lại trước khi nộp bài.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all"
          >
            <Send size={15} />
            <span>Nộp Bài Thi Ngay</span>
          </button>
        </div>
      )}
      </div>

      {/* Bảng Câu Hỏi (Chưa làm / Đã làm / Đánh dấu) */}
      <aside className="order-first lg:order-last lg:sticky lg:top-24 bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <LayoutGrid size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">Bảng Câu Hỏi</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Đã làm <strong className="text-emerald-600">{answeredQuestionCount}/{totalQuestionCount}</strong> câu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPaletteExpandedMobile((prev) => !prev)}
            className="lg:hidden px-2.5 py-1 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1"
          >
            <span>{isPaletteExpandedMobile ? 'Thu gọn' : 'Mở bảng'}</span>
            {isPaletteExpandedMobile ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <div className={`${isPaletteExpandedMobile ? 'block' : 'hidden'} lg:block space-y-3.5`}>
          {/* Thanh lọc trạng thái */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setPaletteFilter('all')}
              className={`px-2.5 py-1.5 rounded-xl font-bold border text-left flex items-center justify-between transition-colors cursor-pointer ${
                paletteFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Tất cả</span>
              <span className="font-mono">{totalQuestionCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setPaletteFilter('unanswered')}
              className={`px-2.5 py-1.5 rounded-xl font-bold border text-left flex items-center justify-between transition-colors cursor-pointer ${
                paletteFilter === 'unanswered'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Chưa làm</span>
              <span className="font-mono">{unansweredQuestionCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setPaletteFilter('answered')}
              className={`px-2.5 py-1.5 rounded-xl font-bold border text-left flex items-center justify-between transition-colors cursor-pointer ${
                paletteFilter === 'answered'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span>Đã làm</span>
              <span className="font-mono">{answeredQuestionCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setPaletteFilter('flagged')}
              className={`px-2.5 py-1.5 rounded-xl font-bold border text-left flex items-center justify-between transition-colors cursor-pointer ${
                paletteFilter === 'flagged'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="flex items-center gap-1">
                <Flag size={11} className={paletteFilter === 'flagged' ? 'fill-white' : 'fill-amber-500 text-amber-600'} />
                <span>Đánh dấu</span>
              </span>
              <span className="font-mono">{flaggedQuestionCount}</span>
            </button>
          </div>

          {/* Chú thích màu sắc */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 px-0.5">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-white border border-slate-300 inline-block" />
              <span>Chưa làm</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
              <span>Đã làm</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 border border-amber-500 inline-block" />
              <span>Đánh dấu</span>
            </span>
          </div>

          {/* Lưới các câu hỏi theo từng phần */}
          <div className="space-y-3 max-h-[340px] lg:max-h-[420px] overflow-y-auto pr-1">
            {(
              [
                { part: 'part_1_mcq', label: 'Phần I · Trắc nghiệm' },
                { part: 'part_2_true_false', label: 'Phần II · Đúng / Sai' },
                { part: 'part_3_short_answer', label: 'Phần III · Trả lời ngắn' },
              ] as const
            ).map(({ part, label }) => {
              const partQuestions = exam.questions.filter((q) => {
                if (q.part !== part) return false;
                const answered = isQuestionAnswered(q);
                const flagged = flaggedQuestionIds.has(q.id);
                if (paletteFilter === 'unanswered') return !answered;
                if (paletteFilter === 'answered') return answered;
                if (paletteFilter === 'flagged') return flagged;
                return true;
              });

              if (partQuestions.length === 0) return null;

              return (
                <div key={part} className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    {label}
                  </span>
                  <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-1.5">
                    {partQuestions.map((q) => {
                      const answered = isQuestionAnswered(q);
                      const flagged = flaggedQuestionIds.has(q.id);
                      const subCount = part === 'part_2_true_false' ? getPart2AnsweredSubCount(q) : 0;
                      const result = scoreReport?.details[q.id];

                      let btnStyle = 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50';
                      if (isSubmitted && result) {
                        const isFull =
                          part === 'part_2_true_false' ? result.correctCount === 4 : Boolean(result.isCorrect);
                        const isPartial =
                          part === 'part_2_true_false' && result.correctCount > 0 && result.correctCount < 4;
                        if (isFull) {
                          btnStyle = 'bg-emerald-600 text-white border-emerald-600';
                        } else if (isPartial) {
                          btnStyle = 'bg-amber-500 text-white border-amber-500';
                        } else {
                          btnStyle = 'bg-rose-500 text-white border-rose-500';
                        }
                      } else if (answered && flagged) {
                        btnStyle = 'bg-emerald-600 text-white border-amber-400 ring-2 ring-amber-300';
                      } else if (answered) {
                        btnStyle = 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700';
                      } else if (flagged) {
                        btnStyle = 'bg-amber-100 text-amber-900 border-amber-500 ring-1 ring-amber-300 hover:bg-amber-200';
                      }

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => scrollToQuestion(q.id)}
                          title={`Câu ${q.questionNumber}${answered ? (part === 'part_2_true_false' && subCount < 4 ? ` (Đã làm ${subCount}/4 ý)` : ' (Đã làm)') : ' (Chưa làm)'}${flagged ? ' · Đã đánh dấu' : ''}`}
                          className={`relative h-9 rounded-xl border text-xs font-extrabold flex items-center justify-center transition-all cursor-pointer ${btnStyle}`}
                        >
                          <span>{q.questionNumber}</span>
                          {flagged && (
                            <span
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 border border-white flex items-center justify-center shadow-2xs"
                              aria-label="Đã đánh dấu"
                            >
                              <Flag size={8} className="text-white fill-white" />
                            </span>
                          )}
                          {!isSubmitted && part === 'part_2_true_false' && answered && subCount < 4 && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded bg-white text-[8px] leading-tight font-black text-purple-700 border border-purple-200">
                              {subCount}/4
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {exam.questions.filter((q) => {
              const answered = isQuestionAnswered(q);
              const flagged = flaggedQuestionIds.has(q.id);
              if (paletteFilter === 'unanswered') return !answered;
              if (paletteFilter === 'answered') return answered;
              if (paletteFilter === 'flagged') return flagged;
              return true;
            }).length === 0 && (
              <div className="py-5 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Không có câu hỏi nào trong mục này
              </div>
            )}
          </div>

          {/* Nút thao tác nhanh */}
          {!isSubmitted && isExamTimeActive && !isMaxAttemptsReached && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {unansweredQuestionCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextUnanswered = exam.questions.find((q) => !isQuestionAnswered(q));
                    if (nextUnanswered) scrollToQuestion(nextUnanswered.id);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Tới câu chưa làm tiếp theo
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send size={14} />
                <span>Nộp Bài Thi ({answeredQuestionCount}/{totalQuestionCount})</span>
              </button>
            </div>
          )}
        </div>
      </aside>
      </div>

      {/* Modal Phóng To Hình Ảnh Đính Kèm */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white p-3 rounded-3xl shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition-colors"
            >
              <X size={18} />
            </button>
            <ExamImage src={zoomedImage} alt="Hình vẽ phóng to" className="max-h-[85vh] max-w-full w-auto rounded-2xl object-contain" />
          </div>
        </div>
      )}

      {/* Anti-Cheat Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl border-2 border-red-500 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-lg font-black text-slate-900">CẢNH BÁO VI PHẠM QUY CHẾ</h4>
              <p className="text-xs font-bold text-red-600">Số lần vi phạm: {infractionCount}/3</p>
            </div>
            <p className="text-sm text-slate-600 text-center leading-relaxed">{warningMessage}</p>
            <button
              onClick={() => setShowWarningModal(false)}
              className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              Tôi Đã Hiểu Và Quay Lại Làm Bài
            </button>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Thoát Khỏi Phòng Thi */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-base font-black text-slate-900">Rời Khỏi Phòng Thi?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bạn đang trong thời gian làm bài. Bản nháp bài làm của bạn đã được tự động lưu. Bạn có chắc chắn muốn thoát về Nhóm Lớp không?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tiếp Tục Làm Bài
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  exitFullscreen();
                  if (onExitExam) onExitExam();
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
              >
                Thoát Phòng Thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Nộp Bài Thi */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Send size={26} />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-lg font-black text-slate-900">Xác Nhận Nộp Bài Thi?</h4>
              <p className="text-xs text-slate-500">
                Hệ thống sẽ ghi nhận và chấm điểm tự động toàn bộ bài thi của bạn.
              </p>
            </div>

            {/* Thống kê câu hỏi đã làm & thời gian còn lại */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Đã trả lời</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {answeredQuestionCount} / {totalQuestionCount}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Thời gian còn</span>
                <span className="text-base font-black text-blue-600 font-mono">
                  {formatTimer(timeLeft)}
                </span>
              </div>
            </div>

            {/* Cảnh báo nếu còn câu chưa trả lời hoặc đang đánh dấu */}
            {unansweredQuestionCount > 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>Bạn còn {unansweredQuestionCount} câu hỏi chưa làm!</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Các câu hỏi bỏ trống sẽ nhận 0 điểm.{flaggedQuestionCount > 0 ? ` Ngoài ra bạn đang đánh dấu ${flaggedQuestionCount} câu cần xem lại.` : ''} Bạn có chắc chắn muốn nộp bài bây giờ không?
                </p>
              </div>
            ) : flaggedQuestionCount > 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <Flag size={16} className="text-amber-600 fill-amber-500 shrink-0" />
                <div>
                  <span className="font-bold block">Bạn đang đánh dấu {flaggedQuestionCount} câu cần xem lại!</span>
                  <span className="text-amber-700 text-[11px]">Bạn đã trả lời đủ {totalQuestionCount} câu, có muốn kiểm tra lại các câu đã đánh dấu trước khi nộp không?</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block">Đã hoàn thành toàn bộ câu hỏi!</span>
                  <span className="text-emerald-700 text-[11px]">Bạn đã trả lời đầy đủ {totalQuestionCount}/{totalQuestionCount} câu.</span>
                </div>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Kiểm Tra Lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitModal(false);
                  handleSubmitExam();
                }}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Xác Nhận Nộp Bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};

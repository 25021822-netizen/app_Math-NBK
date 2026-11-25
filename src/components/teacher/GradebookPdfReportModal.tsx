import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
} from 'docx';
import {
  X,
  Download,
  Printer,
  FileText,
  FileSpreadsheet,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Check,
  Loader2,
  Info,
} from 'lucide-react';
import { Classroom, StudentExamSubmission, Exam } from '../../types/math';
import {
  GradebookAnalytics,
  classifyScoreByScale,
  computeExamQuestionStats,
  formatPointsNumber,
  getExamScaleInfo,
  getSubmissionScalePoints,
  isAnswerEquivalent,
} from '../../lib/scoringEngine';

export type ReportFileFormat = 'pdf' | 'excel' | 'word';
export type ReportType = 'class_summary' | 'individual_student';

interface ExtractedAnswerRow {
  key: string;
  questionNumber: number | null;
  label: string;
  partType: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' | 'unknown';
  partShort: string;
  studentAnswer: string;
  correctAnswer: string;
  status: 'correct' | 'partial' | 'wrong' | 'unanswered' | 'unknown';
}

const formatDurationSpent = (seconds?: number): string => {
  const safeSec = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  if (mins === 0) return `${secs} giây`;
  if (secs === 0) return `${mins} phút`;
  return `${mins} phút ${secs.toString().padStart(2, '0')} giây`;
};

const formatTFValue = (val: unknown): string => {
  if (val === undefined || val === null || val === '') return '—';
  if (val === true || val === 'true' || val === 'Đ') return 'Đ';
  if (val === false || val === 'false' || val === 'S') return 'S';
  return String(val);
};

const extractStudentQuestionAnswers = (
  sub: StudentExamSubmission,
  examsList: Exam[]
): ExtractedAnswerRow[] => {
  const ansMap = sub.answers || {};
  const exam = examsList.find((e) => e.id === sub.examId) || null;

  if (exam && Array.isArray(exam.questions) && exam.questions.length > 0) {
    const sortedQuestions = [...exam.questions].sort((a, b) => a.questionNumber - b.questionNumber);
    return sortedQuestions.map((q) => {
      if (q.part === 'part_1_mcq') {
        const raw = ansMap[q.id];
        const hasVal = raw !== undefined && raw !== null && String(raw).trim() !== '';
        const studentAnswer = hasVal ? String(raw).trim() : 'Bỏ trống';
        const correctAnswer = q.correctAnswer || '—';
        const status: ExtractedAnswerRow['status'] = !hasVal
          ? 'unanswered'
          : studentAnswer === correctAnswer
          ? 'correct'
          : 'wrong';
        return {
          key: q.id,
          questionNumber: q.questionNumber,
          label: `Câu ${q.questionNumber}`,
          partType: 'part_1_mcq',
          partShort: 'P.I (MCQ)',
          studentAnswer,
          correctAnswer,
          status,
        };
      }

      if (q.part === 'part_2_true_false') {
        const items = Array.isArray(q.items) && q.items.length > 0 ? q.items : [];
        const subKeys: ('a' | 'b' | 'c' | 'd')[] =
          items.length > 0 ? items.map((it) => it.subKey) : ['a', 'b', 'c', 'd'];

        let answeredCount = 0;
        let matchedCount = 0;

        const studentParts = subKeys.map((sk) => {
          const rawVal = ansMap[`${q.id}_${sk}`];
          const fmt = formatTFValue(rawVal);
          if (fmt !== '—') answeredCount += 1;
          const itemDef = items.find((it) => it.subKey === sk);
          if (itemDef) {
            const expected = itemDef.isCorrect ? 'Đ' : 'S';
            if (fmt === expected) matchedCount += 1;
          }
          return `${sk}:${fmt}`;
        });

        const correctParts = items.map((it) => `${it.subKey}:${it.isCorrect ? 'Đ' : 'S'}`);
        const status: ExtractedAnswerRow['status'] =
          answeredCount === 0
            ? 'unanswered'
            : items.length > 0 && matchedCount === items.length
            ? 'correct'
            : matchedCount > 0
            ? 'partial'
            : 'wrong';

        return {
          key: q.id,
          questionNumber: q.questionNumber,
          label: `Câu ${q.questionNumber}`,
          partType: 'part_2_true_false',
          partShort: 'P.II (Đ/S)',
          studentAnswer: studentParts.join(' '),
          correctAnswer: correctParts.length > 0 ? correctParts.join(' ') : '—',
          status,
        };
      }

      const raw = ansMap[q.id];
      const hasVal = raw !== undefined && raw !== null && String(raw).trim() !== '';
      const studentAnswer = hasVal ? String(raw).trim() : 'Bỏ trống';
      const correctAnswer = (q.correctAnswer ?? '—').toString().trim();
      const isMatch = hasVal && isAnswerEquivalent(studentAnswer, correctAnswer);
      const status: ExtractedAnswerRow['status'] = !hasVal
        ? 'unanswered'
        : isMatch
        ? 'correct'
        : 'wrong';

      return {
        key: q.id,
        questionNumber: q.questionNumber,
        label: `Câu ${q.questionNumber}`,
        partType: 'part_3_short_answer',
        partShort: 'P.III (Ngắn)',
        studentAnswer,
        correctAnswer,
        status,
      };
    });
  }

  // Fallback khi đề thi gốc không còn trong hệ thống: nhóm theo key trong sub.answers
  const entries = Object.entries(ansMap);
  if (entries.length === 0) return [];

  const groupedTF = new Map<string, Record<string, unknown>>();
  const plainRows: ExtractedAnswerRow[] = [];

  entries.forEach(([key, val]) => {
    const tfMatch = key.match(/^(.+)_([abcd])$/);
    if (tfMatch) {
      const baseId = tfMatch[1];
      const subKey = tfMatch[2];
      if (!groupedTF.has(baseId)) groupedTF.set(baseId, {});
      groupedTF.get(baseId)![subKey] = val;
    } else {
      const numMatch = key.match(/(\d+)$/);
      const qNum = numMatch ? Number(numMatch[1]) : null;
      const hasVal = val !== undefined && val !== null && String(val).trim() !== '';
      plainRows.push({
        key,
        questionNumber: qNum,
        label: qNum ? `Câu ${qNum}` : `Câu (${key.slice(0, 8)})`,
        partType: 'unknown',
        partShort: 'Đáp án',
        studentAnswer: hasVal ? String(val).trim() : 'Bỏ trống',
        correctAnswer: 'Không có đề gốc',
        status: hasVal ? 'unknown' : 'unanswered',
      });
    }
  });

  groupedTF.forEach((subObj, baseId) => {
    const numMatch = baseId.match(/(\d+)$/);
    const qNum = numMatch ? Number(numMatch[1]) : null;
    const tfText = (['a', 'b', 'c', 'd'] as const)
      .map((sk) => `${sk}:${formatTFValue(subObj[sk])}`)
      .join(' ');
    plainRows.push({
      key: baseId,
      questionNumber: qNum,
      label: qNum ? `Câu ${qNum}` : `Câu Đ/S (${baseId.slice(0, 6)})`,
      partType: 'part_2_true_false',
      partShort: 'P.II (Đ/S)',
      studentAnswer: tfText,
      correctAnswer: 'Không có đề gốc',
      status: 'unknown',
    });
  });

  return plainRows.sort((a, b) => (a.questionNumber ?? 9999) - (b.questionNumber ?? 9999));
};

interface GradebookPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classrooms: Classroom[];
  selectedClassId: string;
  selectedExamId: string;
  examsList: Exam[];
  submissions: StudentExamSubmission[];
  analytics: GradebookAnalytics;
  initialStudentSubmission?: StudentExamSubmission | null;
}

export const GradebookPdfReportModal: React.FC<GradebookPdfReportModalProps> = ({
  isOpen,
  onClose,
  classrooms,
  selectedClassId,
  selectedExamId,
  examsList,
  submissions,
  analytics,
  initialStudentSubmission,
}) => {
  // Định dạng file xuất: PDF, Excel, hoặc Word
  const [fileFormat, setFileFormat] = useState<ReportFileFormat>('pdf');

  // Chế độ báo cáo: "class_summary" (Báo cáo tổng hợp cả lớp) hoặc "individual_student" (Phiếu điểm học sinh)
  const [reportType, setReportType] = useState<ReportType>(
    initialStudentSubmission ? 'individual_student' : 'class_summary'
  );

  // Học sinh được chọn cho báo cáo cá nhân
  const [selectedStudentSubId, setSelectedStudentSubId] = useState<string>(
    initialStudentSubmission?.id || (submissions[0]?.id ?? '')
  );

  // Chiều giấy in PDF: 'landscape' cho bảng điểm nhiều cột, 'portrait' cho phiếu cá nhân
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    initialStudentSubmission ? 'portrait' : 'landscape'
  );

  // Các tùy chọn bổ sung
  const [includeAnalyticsChart, setIncludeAnalyticsChart] = useState(true);
  const [includeQuestionStats, setIncludeQuestionStats] = useState(true);
  const [includeQuestionAnswers, setIncludeQuestionAnswers] = useState(true);
  const [includeTeacherSignature, setIncludeTeacherSignature] = useState(true);
  const [teacherCustomNotes, setTeacherCustomNotes] = useState(
    'Học sinh nắm vững các dạng toán cơ bản và vận dụng tốt ở Phần I và Phần II. Cần rèn luyện thêm kỹ năng tính toán nhanh ở Phần III (Trả lời ngắn).'
  );

  // Trạng thái đang xuất file
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const reportPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialStudentSubmission) {
      setReportType('individual_student');
      setSelectedStudentSubId(initialStudentSubmission.id);
      setOrientation('portrait');
    } else {
      setReportType('class_summary');
      setSelectedStudentSubId((prev) => prev || submissions[0]?.id || '');
      setOrientation('landscape');
    }
  }, [isOpen, initialStudentSubmission, submissions]);

  if (!isOpen) return null;

  // Dữ liệu lớp và đề thi
  const currentClass = classrooms.find((c) => c.id === selectedClassId);
  const currentExam = examsList.find((e) => e.id === selectedExamId);

  const selectedIndividualSub = submissions.find((s) => s.id === selectedStudentSubId) || submissions[0];
  const individualExam = selectedIndividualSub
    ? examsList.find((e) => e.id === selectedIndividualSub.examId) || null
    : null;
  const individualScaleInfo = getExamScaleInfo(individualExam, selectedIndividualSub?.score);
  const individualAnswerRows = selectedIndividualSub
    ? extractStudentQuestionAnswers(selectedIndividualSub, examsList)
    : [];
  const questionStatGroups = computeExamQuestionStats(submissions, examsList);

  const classNameDisplay = currentClass ? currentClass.name : 'Tất Cả Các Lớp';
  const examTitleDisplay = currentExam ? currentExam.title : 'Tổng Hợp Tất Cả Đề Thi';
  const currentDateDisplay = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Kích hoạt tải blob trong trình duyệt
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // =========================================================================
  // 1. XUẤT FILE PDF (.pdf)
  // =========================================================================
  const handleDownloadPdf = async () => {
    const reportElement = reportPrintRef.current;
    if (!reportElement) return;

    try {
      setIsExporting(true);

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: orientation === 'landscape' ? 1200 : 850,
      });

      const imgData = canvas.toDataURL('image/png');
      const isLandscape = orientation === 'landscape';
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Trang 1
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Các trang sau
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const fileSafeName =
        reportType === 'class_summary'
          ? `Bao_Cao_Diem_${classNameDisplay.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
          : `Phieu_Diem_${selectedIndividualSub?.studentName?.replace(/\s+/g, '_') || 'Hoc_Sinh'}.pdf`;

      pdf.save(fileSafeName);
      setExportMessage('Đã tải xuống file PDF thành công!');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (error) {
      console.error('Lỗi xuất PDF:', error);
      setExportError('Có lỗi xảy ra khi tạo file PDF. Vui lòng thử lại!');
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // 2. XUẤT FILE EXCEL (.xlsx)
  // =========================================================================
  const handleDownloadExcel = () => {
    try {
      setIsExporting(true);
      const wb = XLSX.utils.book_new();

      if (reportType === 'class_summary') {
        const scaleLabel = analytics.isUniformScale
          ? `Thang điểm ${formatPointsNumber(analytics.scalePoints)}`
          : `Nhiều thang điểm (${analytics.distinctScales.map((s) => `${formatPointsNumber(s)}đ`).join(', ')})`;

        // Sheet 1: Bảng điểm cả lớp
        const wsData: (string | number)[][] = [
          ['SỞ GIÁO DỤC VÀ ĐÀO TẠO', '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
          ['HỆ THỐNG TOÁN THẦY NGUYỄN BÁ KỲ (MATH&NBK)', '', '', '', 'Độc lập - Tự do - Hạnh phúc'],
          ['TỔ CHUYÊN MÔN TOÁN - TIN', '', '', '', '-------------------'],
          [''],
          ['BÁO CÁO TỔNG HỢP ĐIỂM THI VÀ NĂNG LỰC TOÁN HỌC (GDPT 2018)'],
          [`Lớp: ${classNameDisplay}`, `Đề thi: ${examTitleDisplay}`, `Thang điểm: ${scaleLabel}`, `Ngày xuất: ${currentDateDisplay}`],
          [''],
          ['--- I. THỐNG KÊ TỔNG QUAN & PHỔ ĐIỂM ---'],
          ['Chỉ số thống kê', 'Giá trị', '', 'Phân loại phổ điểm', 'Số lượng (HS)', 'Tỷ lệ (%)'],
          [
            'Tổng số bài nộp',
            analytics.total,
            '',
            analytics.isUniformScale ? `Giỏi (>= ${formatPointsNumber(analytics.thresholds.excellentMin)}đ · >=80%)` : 'Giỏi (>= 80%)',
            analytics.excellentCount,
            `${analytics.total ? ((analytics.excellentCount / analytics.total) * 100).toFixed(1) : 0}%`,
          ],
          [
            analytics.isUniformScale ? `Điểm trung bình (/${formatPointsNumber(analytics.scalePoints)}đ)` : 'Tỷ lệ đạt trung bình (%)',
            analytics.isUniformScale ? Number(analytics.average.toFixed(2)) : `${analytics.averagePercent.toFixed(1)}%`,
            '',
            analytics.isUniformScale
              ? `Khá (${formatPointsNumber(analytics.thresholds.goodMin)} - <${formatPointsNumber(analytics.thresholds.excellentMin)}đ)`
              : 'Khá (65% - 79.9%)',
            analytics.goodCount,
            `${analytics.total ? ((analytics.goodCount / analytics.total) * 100).toFixed(1) : 0}%`,
          ],
          [
            `Điểm cao nhất (/${formatPointsNumber(analytics.maxSubmissionScale)}đ)`,
            Number(analytics.max.toFixed(2)),
            '',
            analytics.isUniformScale
              ? `Trung bình (${formatPointsNumber(analytics.thresholds.averageMin)} - <${formatPointsNumber(analytics.thresholds.goodMin)}đ)`
              : 'Trung bình (50% - 64.9%)',
            analytics.averageCount,
            `${analytics.total ? ((analytics.averageCount / analytics.total) * 100).toFixed(1) : 0}%`,
          ],
          [
            `Điểm thấp nhất (/${formatPointsNumber(analytics.minSubmissionScale)}đ)`,
            Number(analytics.min.toFixed(2)),
            '',
            analytics.isUniformScale ? `Dưới trung bình (< ${formatPointsNumber(analytics.thresholds.averageMin)}đ)` : 'Dưới trung bình (< 50%)',
            analytics.belowCount,
            `${analytics.total ? ((analytics.belowCount / analytics.total) * 100).toFixed(1) : 0}%`,
          ],
          ['Học sinh có vi phạm chuyển tab', analytics.cheatingCount, '', '', '', ''],
          [''],
          ['--- II. DANH SÁCH CHI TIẾT BÀI NỘP HỌC SINH ---'],
          [
            'STT',
            'Mã Học Sinh',
            'Họ Và Tên',
            'Email',
            'Lớp',
            'Điểm Tổng',
            'Thang Điểm Đề',
            'Tỷ Lệ (%)',
            'Phần I (MCQ)',
            'Phần II (Đ/S)',
            'Phần III (Ngắn)',
            'Tổng Thời Gian Đã Làm',
            'Thời Gian Nộp Bài',
            'Vi Phạm Tab',
            'Xếp Loại',
            'Chi Tiết Đáp Án Đã Chọn',
          ],
        ];

        submissions.forEach((sub, idx) => {
          const subScale = getSubmissionScalePoints(sub, examsList);
          const rankInfo = classifyScoreByScale(sub.score, subScale);
          const submittedStr = new Date(sub.submittedAt).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour12: false,
          });
          const ansSummary = extractStudentQuestionAnswers(sub, examsList)
            .map((r) => `${r.label}: ${r.studentAnswer}`)
            .join(' | ');
          wsData.push([
            idx + 1,
            sub.studentId,
            sub.studentName,
            sub.studentEmail,
            classrooms.find((c) => c.id === sub.classId)?.name || 'Tự luyện / Lớp đã xóa',
            Number(sub.score.toFixed(2)),
            subScale,
            `${rankInfo.percent}%`,
            Number(sub.partScores.part1.toFixed(2)),
            Number(sub.partScores.part2.toFixed(2)),
            Number(sub.partScores.part3.toFixed(2)),
            formatDurationSpent(sub.timeSpentSeconds),
            submittedStr,
            sub.infractionCount,
            rankInfo.label,
            ansSummary || 'Không có dữ liệu',
          ]);
        });

        // Chân trang chữ ký
        wsData.push(['']);
        wsData.push(['', '', '', '', '', '', '', '', '', `Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`]);
        wsData.push(['', 'BAN GIÁM HIỆU', '', '', '', '', '', '', '', 'GIÁO VIÊN BỘ MÔN']);
        wsData.push(['', '(Ký và đóng dấu)', '', '', '', '', '', '', '', '(Ký và ghi rõ họ tên)']);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Định dạng độ rộng cột
        ws['!cols'] = [
          { wch: 6 },  // STT
          { wch: 14 }, // Mã HS
          { wch: 24 }, // Họ tên
          { wch: 26 }, // Email
          { wch: 12 }, // Lớp
          { wch: 14 }, // Điểm tổng
          { wch: 14 }, // Thang điểm
          { wch: 12 }, // Tỷ lệ
          { wch: 14 }, // Phần I
          { wch: 14 }, // Phần II
          { wch: 14 }, // Phần III
          { wch: 22 }, // Tổng thời gian làm
          { wch: 22 }, // Thời gian nộp
          { wch: 14 }, // Vi phạm
          { wch: 14 }, // Xếp loại
          { wch: 64 }, // Chi tiết đáp án
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Bang_Diem_Lop');

        // Sheet 2: Thống kê đáp án từng câu (số bạn đúng / sai)
        if (questionStatGroups.length > 0) {
          const qWsData: (string | number)[][] = [
            ['THỐNG KÊ ĐÁP ÁN TỪNG CÂU (SỐ HỌC SINH LÀM ĐÚNG / LÀM SAI)'],
            [''],
            [
              'Đề Thi',
              'Câu',
              'Phần',
              'Đáp Án Đúng',
              'Thống Kê Đáp Án Thí Sinh Đưa Ra',
              'Số HS Đúng',
              'Đúng 1 Phần (Đ/S)',
              'Số HS Sai',
              'Bỏ Trống',
              'Tỷ Lệ Đúng (%)',
            ],
          ];
          questionStatGroups.forEach((group) => {
            group.questions.forEach((qStat) => {
              const distText =
                qStat.part === 'part_2_true_false' && qStat.tfSubItems
                  ? qStat.tfSubItems
                      .map((it) => `Ý ${it.subKey}(${it.expected}): ✓${it.correctCount} / ✗${it.wrongCount}`)
                      .join(' | ')
                  : qStat.optionStats.map((o) => `${o.label}: ${o.count} HS (${o.percent}%)`).join(' | ');
              qWsData.push([
                `${group.examTitle} (${formatPointsNumber(group.totalPoints)}đ)`,
                `Câu ${qStat.questionNumber}`,
                qStat.partLabel,
                qStat.correctAnswerDisplay,
                distText,
                qStat.correctCount,
                qStat.partialCount,
                qStat.wrongCount,
                qStat.unansweredCount,
                `${qStat.correctRate}%`,
              ]);
            });
          });
          const qWs = XLSX.utils.aoa_to_sheet(qWsData);
          qWs['!cols'] = [
            { wch: 28 },
            { wch: 10 },
            { wch: 14 },
            { wch: 22 },
            { wch: 52 },
            { wch: 12 },
            { wch: 16 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
          ];
          XLSX.utils.book_append_sheet(wb, qWs, 'Thong_Ke_Tung_Cau');
        }
      } else {
        // Sheet cá nhân học sinh
        const sub = selectedIndividualSub;
        const rankInfo = classifyScoreByScale(sub.score, individualScaleInfo.totalPoints);
        const ansRows = extractStudentQuestionAnswers(sub, examsList);
        const wsData: (string | number)[][] = [
          ['HỆ THỐNG TOÁN THẦY NGUYỄN BÁ KỲ (MATH&NBK)', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
          ['TỔ TOÁN - TIN', '', 'Độc lập - Tự do - Hạnh phúc'],
          [''],
          ['PHIẾU BÁO ĐIỂM VÀ ĐÁNH GIÁ NĂNG LỰC TOÁN HỌC'],
          [''],
          ['THÔNG TIN HỌC SINH', ''],
          ['Họ và Tên:', sub.studentName, 'Mã Học Sinh:', sub.studentId],
          ['Lớp:', classrooms.find((c) => c.id === sub.classId)?.name || 'Tự luyện / Lớp đã xóa', 'Email:', sub.studentEmail],
          ['Bài Kiểm Tra:', sub.examTitle, 'Ngày Nộp:', new Date(sub.submittedAt).toLocaleString('vi-VN')],
          ['Tổng Thời Gian Đã Làm:', formatDurationSpent(sub.timeSpentSeconds), 'Cảnh Báo Vi Phạm Tab:', `${sub.infractionCount} lần`],
          [''],
          ['KẾT QUẢ ĐÁNH GIÁ', ''],
          [
            'ĐIỂM TỔNG KẾT:',
            `${sub.score.toFixed(2)} / ${formatPointsNumber(individualScaleInfo.totalPoints)} (${rankInfo.percent}%)`,
            'XẾP LOẠI:',
            rankInfo.label,
          ],
          [
            'Phần I (Trắc nghiệm 4 lựa chọn):',
            `${sub.partScores.part1.toFixed(2)} / ${formatPointsNumber(individualScaleInfo.part1Max)} điểm`,
          ],
          [
            'Phần II (Đúng/Sai 4 ý):',
            `${sub.partScores.part2.toFixed(2)} / ${formatPointsNumber(individualScaleInfo.part2Max)} điểm`,
          ],
          [
            'Phần III (Trả lời ngắn):',
            `${sub.partScores.part3.toFixed(2)} / ${formatPointsNumber(individualScaleInfo.part3Max)} điểm`,
          ],
          [''],
          ['CHI TIẾT ĐÁP ÁN TỪNG CÂU ĐÃ CHỌN', '', '', ''],
          ['Câu', 'Phần', 'Đáp Án Thí Sinh Chọn', 'Đáp Án Đúng'],
          ...ansRows.map((r) => [r.label, r.partShort, r.studentAnswer, r.correctAnswer]),
          [''],
          ['NHẬN XÉT CỦA GIÁO VIÊN BỘ MÔN:'],
          [teacherCustomNotes],
          [''],
          ['XÁC NHẬN CỦA PHỤ HUYNH', '', '', 'GIÁO VIÊN BỘ MÔN'],
          ['(Ký và ghi rõ họ tên)', '', '', '(Ký và ghi rõ họ tên)'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 32 }, { wch: 35 }, { wch: 28 }, { wch: 28 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Phieu_Diem_Ca_Nhan');
      }

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const fileSafeName =
        reportType === 'class_summary'
          ? `Bang_Diem_${classNameDisplay.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
          : `Phieu_Diem_${selectedIndividualSub?.studentName?.replace(/\s+/g, '_') || 'HocSinh'}.xlsx`;

      triggerDownload(blob, fileSafeName);
      setExportMessage('Đã tải xuống file Excel (.xlsx) thành công!');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (error) {
      console.error('Lỗi xuất Excel:', error);
      setExportError('Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại!');
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // 3. XUẤT FILE WORD (.docx)
  // =========================================================================
  const handleDownloadWord = async () => {
    try {
      setIsExporting(true);

      const borderConfig = {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      };

      if (reportType === 'class_summary') {
        // Bảng thống kê KPI trong Word
        const kpiTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Chỉ Số', bold: true })] })],
                  shading: { fill: 'F1F5F9' },
                  borders: borderConfig,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Số Liệu', bold: true })] })],
                  shading: { fill: 'F1F5F9' },
                  borders: borderConfig,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Phổ Điểm Học Lực', bold: true })] })],
                  shading: { fill: 'F1F5F9' },
                  borders: borderConfig,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Tỷ Lệ', bold: true })] })],
                  shading: { fill: 'F1F5F9' },
                  borders: borderConfig,
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Tổng số bài nộp')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${analytics.total} học sinh`)], borders: borderConfig }),
                new TableCell({
                  children: [
                    new Paragraph(
                      analytics.isUniformScale
                        ? `Giỏi (>= ${formatPointsNumber(analytics.thresholds.excellentMin)}đ · >=80%)`
                        : 'Giỏi (>= 80% thang đề)'
                    ),
                  ],
                  borders: borderConfig,
                }),
                new TableCell({
                  children: [
                    new Paragraph(
                      `${analytics.excellentCount} HS (${analytics.total ? ((analytics.excellentCount / analytics.total) * 100).toFixed(1) : 0}%)`
                    ),
                  ],
                  borders: borderConfig,
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph(
                      analytics.isUniformScale
                        ? `Điểm trung bình (thang ${formatPointsNumber(analytics.scalePoints)}đ)`
                        : 'Tỷ lệ đạt trung bình'
                    ),
                  ],
                  borders: borderConfig,
                }),
                new TableCell({
                  children: [
                    new Paragraph(
                      analytics.isUniformScale
                        ? `${analytics.average.toFixed(2)} / ${formatPointsNumber(analytics.scalePoints)}đ (${analytics.averagePercent.toFixed(1)}%)`
                        : `${analytics.averagePercent.toFixed(1)}% (Quy đổi ${analytics.average.toFixed(2)}/10)`
                    ),
                  ],
                  borders: borderConfig,
                }),
                new TableCell({
                  children: [
                    new Paragraph(
                      analytics.isUniformScale
                        ? `Khá (${formatPointsNumber(analytics.thresholds.goodMin)} - <${formatPointsNumber(analytics.thresholds.excellentMin)}đ)`
                        : 'Khá (65% - 79.9%)'
                    ),
                  ],
                  borders: borderConfig,
                }),
                new TableCell({
                  children: [
                    new Paragraph(
                      `${analytics.goodCount} HS (${analytics.total ? ((analytics.goodCount / analytics.total) * 100).toFixed(1) : 0}%)`
                    ),
                  ],
                  borders: borderConfig,
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Điểm cao nhất / thấp nhất')], borders: borderConfig }),
                new TableCell({
                  children: [
                    new Paragraph(
                      `${analytics.max.toFixed(2)}/${formatPointsNumber(analytics.maxSubmissionScale)}đ | ${analytics.min.toFixed(2)}/${formatPointsNumber(analytics.minSubmissionScale)}đ`
                    ),
                  ],
                  borders: borderConfig,
                }),
                new TableCell({ children: [new Paragraph('Trung bình & Dưới TB')], borders: borderConfig }),
                new TableCell({
                  children: [
                    new Paragraph(
                      `TB: ${analytics.averageCount} HS | Yếu: ${analytics.belowCount} HS`
                    ),
                  ],
                  borders: borderConfig,
                }),
              ],
            }),
          ],
        });

        // Bảng chi tiết danh sách học sinh
        const studentTableRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Họ Và Tên', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lớp', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Điểm Tổng', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Phần I (MCQ)', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Phần II (Đ/S)', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Phần III (Ngắn)', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tổng TG Làm', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Thời Gian Nộp', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Xếp Loại', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
            ],
          }),
        ];

        submissions.forEach((sub, idx) => {
          const subScale = getSubmissionScalePoints(sub, examsList);
          const rankInfo = classifyScoreByScale(sub.score, subScale);
          const submittedStr = new Date(sub.submittedAt).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour12: false,
          });
          studentTableRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(`${idx + 1}`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(sub.studentName)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(classrooms.find((c) => c.id === sub.classId)?.name || 'Tự luyện / Lớp đã xóa')], borders: borderConfig }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: `${sub.score.toFixed(2)}/${formatPointsNumber(subScale)}đ`, bold: true })] })],
                  borders: borderConfig,
                }),
                new TableCell({ children: [new Paragraph(`${sub.partScores.part1.toFixed(2)}đ`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${sub.partScores.part2.toFixed(2)}đ`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${sub.partScores.part3.toFixed(2)}đ`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(formatDurationSpent(sub.timeSpentSeconds))], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(submittedStr)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(rankInfo.label)], borders: borderConfig }),
              ],
            })
          );
        });

        const studentTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: studentTableRows,
        });

        // Bảng chữ ký
        const signatureTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'BAN GIÁM HIỆU', bold: true })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: '(Ký và đóng dấu)', italics: true })], alignment: AlignmentType.CENTER }),
                    new Paragraph(''),
                    new Paragraph(''),
                    new Paragraph(''),
                  ],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: `Hà Nội, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`, italics: true })],
                      alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({ children: [new TextRun({ text: 'GIÁO VIÊN BỘ MÔN', bold: true })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true })], alignment: AlignmentType.CENTER }),
                    new Paragraph(''),
                    new Paragraph(''),
                    new Paragraph(''),
                  ],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
              ],
            }),
          ],
        });

        const questionStatParagraphs: (Paragraph | Table)[] = [];
        if (questionStatGroups.length > 0) {
          questionStatParagraphs.push(
            new Paragraph(''),
            new Paragraph({
              text: 'III. THỐNG KÊ ĐÁP ÁN TỪNG CÂU (SỐ BẠN LÀM ĐÚNG / SAI)',
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph('')
          );

          questionStatGroups.forEach((group) => {
            questionStatParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${group.examTitle} (Thang ${formatPointsNumber(group.totalPoints)} điểm · ${group.submissionCount} bài nộp)`,
                    bold: true,
                  }),
                ],
              })
            );
            const qRows = [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Câu', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Phần', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đáp án đúng', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đáp án thí sinh đưa ra', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đúng', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Sai', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Bỏ trống', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
                ],
              }),
              ...group.questions.map((qStat) => {
                const distText =
                  qStat.part === 'part_2_true_false' && qStat.tfSubItems
                    ? qStat.tfSubItems
                        .map((it) => `${it.subKey}(${it.expected}): ✓${it.correctCount}/✗${it.wrongCount}`)
                        .join(' | ')
                    : qStat.optionStats.map((o) => `${o.label}: ${o.count}`).join(', ');
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(`Câu ${qStat.questionNumber}`)], borders: borderConfig }),
                    new TableCell({ children: [new Paragraph(qStat.partLabel)], borders: borderConfig }),
                    new TableCell({ children: [new Paragraph(qStat.correctAnswerDisplay)], borders: borderConfig }),
                    new TableCell({ children: [new Paragraph(distText)], borders: borderConfig }),
                    new TableCell({
                      children: [
                        new Paragraph(
                          qStat.partialCount > 0
                            ? `${qStat.correctCount} (+${qStat.partialCount} 1 phần)`
                            : `${qStat.correctCount}`
                        ),
                      ],
                      borders: borderConfig,
                    }),
                    new TableCell({ children: [new Paragraph(`${qStat.wrongCount}`)], borders: borderConfig }),
                    new TableCell({ children: [new Paragraph(`${qStat.unansweredCount}`)], borders: borderConfig }),
                  ],
                });
              }),
            ];
            questionStatParagraphs.push(
              new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: qRows }),
              new Paragraph('')
            );
          });
        }

        const doc = new Document({
          sections: [
            {
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO HÀ NỘI\n', bold: true }),
                    new TextRun({ text: 'HỆ THỐNG TOÁN THẦY NGUYỄN BÁ KỲ (MATH&NBK)\n', bold: true }),
                    new TextRun({ text: 'TỔ TOÁN - TIN\n\n' }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'BÁO CÁO TỔNG HỢP ĐIỂM THI VÀ NĂNG LỰC TOÁN HỌC\n',
                      bold: true,
                      size: 28,
                    }),
                    new TextRun({
                      text: `(Chuẩn Chương Trình GDPT 2018 - Đề thi: ${examTitleDisplay})\n\n`,
                      italics: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `Lớp áp dụng: `, bold: true }),
                    new TextRun({ text: `${classNameDisplay}   |   ` }),
                    new TextRun({ text: `Ngày lập: `, bold: true }),
                    new TextRun({ text: `${currentDateDisplay}\n\n` }),
                  ],
                }),
                new Paragraph({
                  text: 'I. THỐNG KÊ TỔNG QUAN & PHỔ ĐIỂM',
                  heading: HeadingLevel.HEADING_2,
                }),
                new Paragraph(''),
                kpiTable,
                new Paragraph(''),
                new Paragraph({
                  text: 'II. DANH SÁCH CHI TIẾT ĐIỂM HỌC SINH',
                  heading: HeadingLevel.HEADING_2,
                }),
                new Paragraph(''),
                studentTable,
                ...questionStatParagraphs,
                new Paragraph(''),
                new Paragraph({
                  text: 'IV. NHẬN XÉT CỦA GIÁO VIÊN BỘ MÔN',
                  heading: HeadingLevel.HEADING_2,
                }),
                new Paragraph({
                  children: [new TextRun({ text: teacherCustomNotes, italics: true })],
                }),
                new Paragraph(''),
                signatureTable,
              ],
            },
          ],
        });

        const blob = await Packer.toBlob(doc);
        const fileSafeName = `Bao_Cao_${classNameDisplay.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
        triggerDownload(blob, fileSafeName);
      } else {
        // Tài liệu Word cho học sinh cá nhân
        const sub = selectedIndividualSub;
        const rankInfo = classifyScoreByScale(sub.score, individualScaleInfo.totalPoints);

        const studentInfoTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Họ và tên:', bold: true })] })], borders: borderConfig, shading: { fill: 'F8FAFC' } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sub.studentName, bold: true })] })], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Mã học sinh:', bold: true })] })], borders: borderConfig, shading: { fill: 'F8FAFC' } }),
                new TableCell({ children: [new Paragraph(sub.studentId)], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lớp học:', bold: true })] })], borders: borderConfig, shading: { fill: 'F8FAFC' } }),
                new TableCell({ children: [new Paragraph(classrooms.find((c) => c.id === sub.classId)?.name || 'Tự luyện / Lớp đã xóa')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tổng thời gian làm:', bold: true })] })], borders: borderConfig, shading: { fill: 'F8FAFC' } }),
                new TableCell({ children: [new Paragraph(formatDurationSpent(sub.timeSpentSeconds))], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Bài kiểm tra:', bold: true })] })], borders: borderConfig, shading: { fill: 'F8FAFC' } }),
                new TableCell({ children: [new Paragraph(sub.examTitle)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Giám sát tab:', bold: true })] })], borders: borderConfig, shading: { fill: 'F8FAFC' } }),
                new TableCell({ children: [new Paragraph(`${sub.infractionCount} lần vi phạm`)], borders: borderConfig }),
              ],
            }),
          ],
        });

        const scoreTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Phần Thi', bold: true })] })], shading: { fill: 'F1F5F9' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Dạng Câu Hỏi', bold: true })] })], shading: { fill: 'F1F5F9' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Thang Điểm', bold: true })] })], shading: { fill: 'F1F5F9' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Điểm Đạt Được', bold: true })] })], shading: { fill: 'F1F5F9' }, borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Phần I')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('Trắc nghiệm 4 lựa chọn')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${formatPointsNumber(individualScaleInfo.part1Max)} điểm`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.partScores.part1.toFixed(2)}đ`, bold: true })] })], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Phần II')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('Đúng / Sai 4 ý')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${formatPointsNumber(individualScaleInfo.part2Max)} điểm`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.partScores.part2.toFixed(2)}đ`, bold: true })] })], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Phần III')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('Trả lời ngắn')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${formatPointsNumber(individualScaleInfo.part3Max)} điểm`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.partScores.part3.toFixed(2)}đ`, bold: true })] })], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'TỔNG CỘNG', bold: true })] })], shading: { fill: 'EFF6FF' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Xếp loại: ${rankInfo.label} (${rankInfo.percent}%)`, bold: true })] })], shading: { fill: 'EFF6FF' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${formatPointsNumber(individualScaleInfo.totalPoints)} điểm`, bold: true })] })], shading: { fill: 'EFF6FF' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.score.toFixed(2)}đ`, bold: true, color: '1D4ED8' })] })], shading: { fill: 'EFF6FF' }, borders: borderConfig }),
              ],
            }),
          ],
        });

        const doc = new Document({
          sections: [
            {
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'HỆ THỐNG TOÁN THẦY NGUYỄN BÁ KỲ (MATH&NBK)\n', bold: true }),
                    new TextRun({ text: 'TỔ TOÁN - TIN\n\n' }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'PHIẾU BÁO ĐIỂM VÀ ĐÁNH GIÁ NĂNG LỰC HỌC SINH\n',
                      bold: true,
                      size: 28,
                    }),
                    new TextRun({ text: `Năm học 2026 - 2027\n\n`, italics: true }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                studentInfoTable,
                new Paragraph(''),
                new Paragraph({
                  text: 'KẾT QUẢ ĐIỂM SỐ CHI TIẾT',
                  heading: HeadingLevel.HEADING_2,
                }),
                new Paragraph(''),
                scoreTable,
                new Paragraph(''),
                new Paragraph({
                  text: 'NHẬN XÉT CỦA GIÁO VIÊN BỘ MÔN',
                  heading: HeadingLevel.HEADING_2,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: teacherCustomNotes,
                      italics: true,
                    }),
                  ],
                }),
                new Paragraph(''),
                new Paragraph(''),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Hà Nội, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}\n`,
                      italics: true,
                    }),
                    new TextRun({ text: 'GIÁO VIÊN BỘ MÔN TOÁN\n\n\n\n', bold: true }),
                    new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            },
          ],
        });

        const blob = await Packer.toBlob(doc);
        const fileSafeName = `Phieu_Diem_${sub.studentName.replace(/\s+/g, '_')}.docx`;
        triggerDownload(blob, fileSafeName);
      }

      setExportMessage('Đã tải xuống file Word (.docx) thành công!');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (error) {
      console.error('Lỗi xuất Word:', error);
      setExportError('Có lỗi xảy ra khi tạo file Word. Vui lòng thử lại!');
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // Điều hướng xuất theo định dạng đang chọn
  const handleDownloadSelectedFormat = () => {
    if (fileFormat === 'pdf') {
      handleDownloadPdf();
    } else if (fileFormat === 'excel') {
      handleDownloadExcel();
    } else {
      handleDownloadWord();
    }
  };

  // Mở cửa sổ in hệ thống (Print to PDF) với cơ chế dự phòng iframe ẩn khi popup bị chặn (trong iFrame)
  const handlePrintSystem = () => {
    const reportElement = reportPrintRef.current;
    if (!reportElement) return;

    const baseHeadCss = `
      <title>Báo Cáo Điểm Số - Toán Học LIKI</title>
      <meta charset="utf-8" />
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page {
          size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
          margin: 12mm;
        }
        body {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          color: #0f172a;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      </style>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const popupHtml = `
        <!DOCTYPE html>
        <html>
          <head>${baseHeadCss}</head>
          <body class="p-4">
            ${reportElement.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(popupHtml);
      printWindow.document.close();
      return;
    }

    // Fallback in ngay qua iframe ẩn nếu trình duyệt/iFrame chặn window.open
    try {
      const existingFrame = document.getElementById('liki-hidden-print-frame');
      if (existingFrame && existingFrame.parentNode) {
        existingFrame.parentNode.removeChild(existingFrame);
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'liki-hidden-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        document.body.removeChild(iframe);
        setExportError('Không thể khởi tạo khung in. Vui lòng nhấn "Tải Về PDF"!');
        setTimeout(() => setExportError(null), 4500);
        return;
      }

      const clonedStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => el.outerHTML)
        .join('\n');

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Báo Cáo Điểm Số - Toán Học LIKI</title>
            <meta charset="utf-8" />
            ${clonedStyles}
            <style>
              @page {
                size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
                margin: 12mm;
              }
              body {
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
                color: #0f172a;
                background: #ffffff;
                padding: 16px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            </style>
          </head>
          <body>${reportElement.innerHTML}</body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Lỗi in từ iframe ẩn:', err);
          setExportError('Trình duyệt không hỗ trợ in trực tiếp. Vui lòng nhấn "Tải Về PDF"!');
          setTimeout(() => setExportError(null), 4500);
        }
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      }, 350);
    } catch (err) {
      console.error('Lỗi fallback in hệ thống:', err);
      setExportError('Không thể mở hộp thoại in. Vui lòng nhấn "Tải Về PDF"!');
      setTimeout(() => setExportError(null), 4500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ========================================================= */}
        {/* MODAL HEADER                                              */}
        {/* ========================================================= */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Download size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>Xuất Báo Cáo & Bảng Điểm Học Sinh</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Đa Định Dạng: PDF · Excel · Word
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Lựa chọn xuất ra file PDF in ấn, bảng tính Excel (.xlsx) hoặc văn bản Word (.docx) chuẩn GDPT 2018.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fileFormat === 'pdf' && (
              <button
                onClick={handlePrintSystem}
                type="button"
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                title="Mở hộp thoại In / Lưu PDF của trình duyệt"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">In / Bản In A4</span>
              </button>
            )}

            <button
              onClick={handleDownloadSelectedFormat}
              disabled={isExporting}
              type="button"
              className={`px-4 py-2 rounded-xl text-white font-extrabold text-xs flex items-center gap-2 shadow-xs transition-all ${
                fileFormat === 'excel'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : fileFormat === 'word'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50`}
            >
              {isExporting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang Xuất File...</span>
                </>
              ) : exportMessage ? (
                <>
                  <Check size={15} className="text-white" />
                  <span>Hoàn Tất!</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>
                    Tải Về {fileFormat === 'pdf' ? 'PDF' : fileFormat === 'excel' ? 'Excel (.xlsx)' : 'Word (.docx)'}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Thông báo thành công / lỗi */}
        {exportMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{exportMessage}</span>
          </div>
        )}
        {exportError && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* FORMAT SELECTOR & CONFIGURATION BAR                       */}
        {/* ========================================================= */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-white space-y-3 text-xs">
          {/* HÀNG 1: CHỌN ĐỊNH DẠNG FILE (PDF / EXCEL / WORD) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Định Dạng File:</span>
              <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                {/* Lựa chọn PDF */}
                <button
                  type="button"
                  onClick={() => setFileFormat('pdf')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                    fileFormat === 'pdf'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-rose-600'
                  }`}
                >
                  <FileText size={14} />
                  <span>PDF (.pdf)</span>
                </button>

                {/* Lựa chọn Excel */}
                <button
                  type="button"
                  onClick={() => setFileFormat('excel')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                    fileFormat === 'excel'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-emerald-600'
                  }`}
                >
                  <FileSpreadsheet size={14} />
                  <span>Excel (.xlsx)</span>
                </button>

                {/* Lựa chọn Word */}
                <button
                  type="button"
                  onClick={() => setFileFormat('word')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                    fileFormat === 'word'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  <FileCheck size={14} />
                  <span>Word (.docx)</span>
                </button>
              </div>
            </div>

            {/* Quick 1-click Download pills */}
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <span className="text-[11px]">Tải nhanh:</span>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                title="Tải ngay file PDF"
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono font-bold text-[11px] border border-rose-200 transition-colors"
              >
                .PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={isExporting}
                title="Tải ngay bảng tính Excel"
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-mono font-bold text-[11px] border border-emerald-200 transition-colors"
              >
                .XLSX
              </button>
              <button
                type="button"
                onClick={handleDownloadWord}
                disabled={isExporting}
                title="Tải ngay văn bản Word"
                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono font-bold text-[11px] border border-blue-200 transition-colors"
              >
                .DOCX
              </button>
            </div>
          </div>

          {/* HÀNG 2: CHẾ ĐỘ BÁO CÁO & THIẾT LẬP */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Mode switch: Cả lớp vs Học sinh */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">Mẫu Báo Cáo:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setReportType('class_summary');
                    setOrientation('landscape');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    reportType === 'class_summary'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Báo Cáo Cả Lớp (Tổng hợp)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportType('individual_student');
                    setOrientation('portrait');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    reportType === 'individual_student'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Phiếu Điểm Từng Học Sinh
                </button>
              </div>
            </div>

            {/* Student picker if individual mode */}
            {reportType === 'individual_student' && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">Học Sinh:</span>
                <select
                  value={selectedStudentSubId}
                  onChange={(e) => setSelectedStudentSubId(e.target.value)}
                  className="h-8 px-3 rounded-xl border border-slate-300 font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  {submissions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentName} ({s.score.toFixed(2)}đ - {s.studentEmail})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tùy chọn in ấn & chữ ký */}
            <div className="flex items-center gap-3">
              {fileFormat === 'pdf' && (
                <div className="flex items-center gap-1 font-semibold text-slate-600">
                  <span>Khổ:</span>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 font-bold"
                  >
                    <option value="landscape">Ngang (A4 Landscape)</option>
                    <option value="portrait">Dọc (A4 Portrait)</option>
                  </select>
                </div>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeAnalyticsChart}
                  onChange={(e) => setIncludeAnalyticsChart(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Phổ Điểm</span>
              </label>

              {reportType === 'class_summary' && (
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeQuestionStats}
                    onChange={(e) => setIncludeQuestionStats(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Thống Kê Câu Hỏi</span>
                </label>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeQuestionAnswers}
                  onChange={(e) => setIncludeQuestionAnswers(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Đáp Án Từng Câu</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeTeacherSignature}
                  onChange={(e) => setIncludeTeacherSignature(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Chữ Ký GV</span>
              </label>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* FORMAT PREVIEW BADGE BANNER                               */}
        {/* ========================================================= */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Xem trước văn bản:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full ${
                fileFormat === 'excel'
                  ? 'bg-emerald-100 text-emerald-800'
                  : fileFormat === 'word'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {fileFormat === 'pdf'
                ? 'Định dạng PDF (A4 Chuẩn In Ấn)'
                : fileFormat === 'excel'
                ? 'Định dạng Excel (.xlsx - Tự động tính toán & Lập bảng)'
                : 'Định dạng Word (.docx - Văn bản sư phạm hoàn chỉnh)'}
            </span>
          </div>

          <span className="text-[11px] text-slate-400">
            Nội dung báo cáo cập nhật trực tiếp theo bộ lọc hiện tại
          </span>
        </div>

        {/* ========================================================= */}
        {/* REPORT PREVIEW CANVAS AREA (A4 CONTAINER)                 */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center">
          <div
            ref={reportPrintRef}
            className={`bg-white shadow-xl border border-slate-300 p-8 sm:p-10 text-slate-900 transition-all ${
              orientation === 'landscape' ? 'w-[1020px] min-h-[720px]' : 'w-[780px] min-h-[960px]'
            }`}
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          >
            {/* 1. TIÊU NGỮ & TÊN TRƯỜNG CHUẨN BGD */}
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
              <div className="text-center sm:text-left">
                <span className="text-[11px] font-bold tracking-wider text-slate-700 block uppercase">
                  SỞ GIÁO DỤC VÀ ĐÀO TẠO HÀ NỘI
                </span>
                <strong className="text-xs font-black tracking-wide text-slate-900 block uppercase mt-0.5">
                  HỆ THỐNG TOÁN THẦY NGUYỄN BÁ KỲ (MATH&NBK)
                </strong>
                <span className="text-[10px] text-slate-500 block italic">Tổ Chuyên Môn Toán Học - Tin Học</span>
              </div>

              <div className="text-center hidden sm:block">
                <span className="text-[11px] font-bold text-slate-900 block uppercase">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </span>
                <span className="text-[11px] font-bold text-slate-800 block underline underline-offset-4 decoration-1 mt-0.5">
                  Độc lập - Tự do - Hạnh phúc
                </span>
                <span className="text-[10px] text-slate-500 block italic mt-1">
                  Hà Nội, ngày {currentDateDisplay}
                </span>
              </div>
            </div>

            {/* 2. TIÊU ĐỀ BÁO CÁO */}
            <div className="text-center my-6 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 block">
                CHƯƠNG TRÌNH GIÁO DỤC PHỔ THÔNG 2018
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                {reportType === 'class_summary'
                  ? 'BÁO CÁO TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC TOÁN HỌC'
                  : 'PHIẾU BÁO ĐIỂM VÀ ĐÁNH GIÁ NĂNG LỰC HỌC SINH'}
              </h2>
              <p className="text-xs text-slate-600 font-semibold">
                Đề kiểm tra: <span className="text-blue-700 font-bold">{examTitleDisplay}</span> · Lớp:{' '}
                <span className="text-blue-700 font-bold">{classNameDisplay}</span>
              </p>
            </div>

            {/* ========================================================= */}
            {/* TRƯỜNG HỢP A: BÁO CÁO CẢ LỚP (CLASS SUMMARY)              */}
            {/* ========================================================= */}
            {reportType === 'class_summary' && (
              <div className="space-y-6">
                {/* 3. BẢNG THỐNG KÊ KPI & PHỔ ĐIỂM */}
                {includeAnalyticsChart && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3.5 rounded-2xl border border-slate-300 bg-slate-50">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Tổng Bài Nộp</span>
                      <strong className="text-2xl font-black font-mono text-slate-900">{analytics.total}</strong>
                      <span className="text-[10px] text-slate-400 block mt-0.5">học sinh</span>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/70">
                      <span className="text-[10px] font-bold uppercase text-blue-600 block">Điểm Trung Bình</span>
                      <strong className="text-2xl font-black font-mono text-blue-700">
                        {analytics.isUniformScale
                          ? `${analytics.average.toFixed(2)}/${formatPointsNumber(analytics.scalePoints)}`
                          : `${analytics.averagePercent.toFixed(1)}%`}
                      </strong>
                      <span className="text-[10px] text-blue-500 block mt-0.5">
                        {analytics.isUniformScale
                          ? `Thang ${formatPointsNumber(analytics.scalePoints)}đ (${analytics.averagePercent.toFixed(1)}%)`
                          : `Quy đổi ${analytics.average.toFixed(2)}/10`}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 block">Điểm Cao Nhất</span>
                      <strong className="text-2xl font-black font-mono text-emerald-800">
                        {analytics.max.toFixed(2)}/{formatPointsNumber(analytics.maxSubmissionScale)}
                      </strong>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">
                        Đạt {analytics.maxPercent.toFixed(1)}% thang đề
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70">
                      <span className="text-[10px] font-bold uppercase text-amber-700 block">Điểm Thấp Nhất</span>
                      <strong className="text-2xl font-black font-mono text-amber-800">
                        {analytics.min.toFixed(2)}/{formatPointsNumber(analytics.minSubmissionScale)}
                      </strong>
                      <span className="text-[10px] text-amber-600 block mt-0.5">
                        Đạt {analytics.minPercent.toFixed(1)}% · Cần bồi dưỡng
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. PHÂN TÍCH PHỔ ĐIỂM (THEO THANG ĐIỂM CỦA ĐỀ) */}
                {includeAnalyticsChart && (
                  <div className="p-4 rounded-2xl border border-slate-300 bg-slate-50 space-y-2 text-xs">
                    <span className="font-extrabold text-slate-800 block text-[11px] uppercase">
                      Phân Bố Xếp Loại Học Lực (
                      {analytics.isUniformScale
                        ? `Theo Thang ${formatPointsNumber(analytics.scalePoints)} Điểm`
                        : `Theo Tỷ Lệ % Thang Điểm Từng Đề`}
                      )
                    </span>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white border border-emerald-200">
                        <span className="text-emerald-700 font-bold block text-[11px]">
                          {analytics.isUniformScale
                            ? `Giỏi (≥ ${formatPointsNumber(analytics.thresholds.excellentMin)}đ)`
                            : 'Giỏi (≥ 80%)'}
                        </span>
                        <strong className="text-lg font-black font-mono text-emerald-900">
                          {analytics.excellentCount}
                        </strong>
                        <span className="text-[10px] text-slate-400 block">
                          ({analytics.total ? ((analytics.excellentCount / analytics.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-blue-200">
                        <span className="text-blue-700 font-bold block text-[11px]">
                          {analytics.isUniformScale
                            ? `Khá (${formatPointsNumber(analytics.thresholds.goodMin)} - <${formatPointsNumber(
                                analytics.thresholds.excellentMin
                              )}đ)`
                            : 'Khá (65% - 79.9%)'}
                        </span>
                        <strong className="text-lg font-black font-mono text-blue-900">{analytics.goodCount}</strong>
                        <span className="text-[10px] text-slate-400 block">
                          ({analytics.total ? ((analytics.goodCount / analytics.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-amber-200">
                        <span className="text-amber-700 font-bold block text-[11px]">
                          {analytics.isUniformScale
                            ? `TB (${formatPointsNumber(analytics.thresholds.averageMin)} - <${formatPointsNumber(
                                analytics.thresholds.goodMin
                              )}đ)`
                            : 'Trung bình (50% - 64.9%)'}
                        </span>
                        <strong className="text-lg font-black font-mono text-amber-900">
                          {analytics.averageCount}
                        </strong>
                        <span className="text-[10px] text-slate-400 block">
                          ({analytics.total ? ((analytics.averageCount / analytics.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-rose-200">
                        <span className="text-rose-700 font-bold block text-[11px]">
                          {analytics.isUniformScale
                            ? `Dưới TB (< ${formatPointsNumber(analytics.thresholds.averageMin)}đ)`
                            : 'Dưới TB (< 50%)'}
                        </span>
                        <strong className="text-lg font-black font-mono text-rose-900">{analytics.belowCount}</strong>
                        <span className="text-[10px] text-slate-400 block">
                          ({analytics.total ? ((analytics.belowCount / analytics.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. BẢNG CHI TIẾT DANH SÁCH BÀI LÀM */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-2">
                    <span className="font-extrabold uppercase text-xs text-slate-800">
                      Bảng Chi Tiết Kết Quả Đánh Giá Từng Học Sinh ({submissions.length} bài)
                    </span>
                    <span className="text-[11px] text-slate-500 italic">
                      {analytics.isUniformScale
                        ? `Thang điểm ${formatPointsNumber(analytics.scalePoints)}`
                        : 'Hiển thị theo thang điểm từng đề'}
                    </span>
                  </div>

                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-300">
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center w-10">STT</th>
                        <th className="py-2 px-3 border-r border-slate-300">Mã HS</th>
                        <th className="py-2 px-3 border-r border-slate-300">Họ và Tên Học Sinh</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center">Lớp</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center font-bold text-blue-800">
                          Tổng Điểm
                        </th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center text-[11px]">P.I (MCQ)</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center text-[11px]">P.II (Đ/S)</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center text-[11px]">P.III (Ngắn)</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center text-[11px] whitespace-nowrap">Tổng TG Làm</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center text-[11px]">Thời Gian Nộp</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center text-[11px]">Giám Sát</th>
                        <th className="py-2 px-2.5 text-center text-[11px]">Xếp Loại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub, idx) => {
                        const subScale = getSubmissionScalePoints(sub, examsList);
                        const rankInfo = classifyScoreByScale(sub.score, subScale);
                        const rank = rankInfo.label;
                        const submittedStr = new Date(sub.submittedAt).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour12: false,
                        });
                        return (
                          <tr
                            key={sub.id}
                            className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          >
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-300 font-mono text-slate-600 text-[11px]">
                              {sub.studentId}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-300 font-bold text-slate-900">
                              {sub.studentName}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-center text-slate-600 text-[11px]">
                              {classrooms.find((c) => c.id === sub.classId)?.name || 'Tự luyện / Lớp đã xóa'}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-black font-mono text-sm text-blue-700 whitespace-nowrap">
                              {sub.score.toFixed(2)}
                              <span className="text-[10px] font-semibold text-slate-500">
                                /{formatPointsNumber(subScale)}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-[11px]">
                              {sub.partScores.part1.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-[11px]">
                              {sub.partScores.part2.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-[11px]">
                              {sub.partScores.part3.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-[10px] font-bold text-slate-800 whitespace-nowrap">
                              {formatDurationSpent(sub.timeSpentSeconds)}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-mono text-[10px] text-slate-600 whitespace-nowrap">
                              {submittedStr}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-center text-[10px]">
                              {sub.infractionCount > 0 ? (
                                <span className="font-bold text-rose-600">{sub.infractionCount} lần tab</span>
                              ) : (
                                <span className="text-slate-400">Chuẩn mực</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-bold text-[11px]">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  rankInfo.key === 'excellent'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rankInfo.key === 'good'
                                    ? 'bg-blue-100 text-blue-800'
                                    : rankInfo.key === 'average'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {rank}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 5A. THỐNG KÊ ĐÁP ÁN TỪNG CÂU (SỐ BẠN LÀM ĐÚNG / LÀM SAI) */}
                {includeQuestionStats && questionStatGroups.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-300">
                      <span className="font-extrabold uppercase text-xs text-slate-800">
                        Thống Kê Đáp Án Từng Câu (Số Bạn Làm Đúng / Làm Sai & Đáp Án Đưa Ra)
                      </span>
                      <span className="text-[11px] text-slate-500 italic">
                        Tổng hợp theo từng câu hỏi trong đề thi
                      </span>
                    </div>

                    <div className="space-y-4">
                      {questionStatGroups.map((group) => (
                        <div key={`pdf-qstat-${group.examId}`} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300">
                            <span>{group.examTitle}</span>
                            <span className="font-mono text-blue-800">
                              Thang {formatPointsNumber(group.totalPoints)} điểm · {group.submissionCount} bài nộp
                            </span>
                          </div>

                          <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-800 font-extrabold border-b border-slate-300">
                                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-14">Câu</th>
                                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-20">Phần</th>
                                <th className="py-1.5 px-2 border-r border-slate-300 w-28">Đáp Án Đúng</th>
                                <th className="py-1.5 px-2 border-r border-slate-300">Đáp Án Thí Sinh Đưa Ra</th>
                                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-16 text-emerald-800">Đúng</th>
                                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-14 text-rose-800">Sai</th>
                                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-16">Bỏ Trống</th>
                                <th className="py-1.5 px-2 text-center w-16">Tỷ Lệ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.questions.map((qStat, qIdx) => (
                                <tr
                                  key={`pdf-q-${qStat.questionId}`}
                                  className={`border-b border-slate-200 ${qIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                >
                                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold font-mono">
                                    Câu {qStat.questionNumber}
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-600">
                                    {qStat.partLabel}
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 font-mono font-bold text-emerald-800">
                                    {qStat.correctAnswerDisplay}
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 font-mono">
                                    {qStat.part === 'part_2_true_false' && qStat.tfSubItems ? (
                                      <span>
                                        {qStat.tfSubItems
                                          .map(
                                            (it) =>
                                              `${it.subKey}(${it.expected}): ✓${it.correctCount}/✗${it.wrongCount}`
                                          )
                                          .join(' · ')}
                                      </span>
                                    ) : (
                                      <span>
                                        {qStat.optionStats
                                          .map(
                                            (opt) =>
                                              `${opt.label}: ${opt.count} (${opt.percent}%)${opt.isCorrect ? '✓' : ''}`
                                          )
                                          .join(' · ')}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-bold text-emerald-800">
                                    {qStat.correctCount}
                                    {qStat.partialCount > 0 ? ` (+${qStat.partialCount})` : ''}
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-bold text-rose-700">
                                    {qStat.wrongCount}
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-slate-500">
                                    {qStat.unansweredCount}
                                  </td>
                                  <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-800">
                                    {qStat.correctRate}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5B. CHI TIẾT TỔNG THỜI GIAN LÀM & ĐÁP ÁN TỪNG CÂU CỦA MỖI THÍ SINH */}
                {includeQuestionAnswers && submissions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-300">
                      <span className="font-extrabold uppercase text-xs text-slate-800">
                        Chi Tiết Tổng Thời Gian Đã Làm & Đáp Án Từng Câu Của Mỗi Thí Sinh
                      </span>
                      <span className="text-[11px] text-slate-500 italic">
                        Ký hiệu: ✓ Đúng · ~ Đúng 1 phần · ✗ Sai · — Bỏ trống
                      </span>
                    </div>

                    <div className="space-y-3">
                      {submissions.map((sub, idx) => {
                        const subScale = getSubmissionScalePoints(sub, examsList);
                        const answerRows = extractStudentQuestionAnswers(sub, examsList);
                        const correctCount = answerRows.filter((r) => r.status === 'correct').length;
                        const submittedStr = new Date(sub.submittedAt).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour12: false,
                        });

                        return (
                          <div
                            key={`ans-${sub.id}`}
                            className="rounded-xl border border-slate-300 bg-white overflow-hidden"
                          >
                            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono font-bold text-[10px]">
                                  #{idx + 1}
                                </span>
                                <strong className="text-slate-900 font-extrabold">{sub.studentName}</strong>
                                <span className="text-slate-500 font-mono">({sub.studentId})</span>
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold">
                                  {sub.score.toFixed(2)}/{formatPointsNumber(subScale)}đ
                                </span>
                                {answerRows.length > 0 && (
                                  <span className="text-slate-600 font-semibold">
                                    · Đúng {correctCount}/{answerRows.length} câu
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
                                <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900 font-bold">
                                  Tổng TG đã làm: {formatDurationSpent(sub.timeSpentSeconds)}
                                </span>
                                <span className="text-slate-500">Nộp: {submittedStr}</span>
                              </div>
                            </div>

                            <div className="p-2.5">
                              {answerRows.length === 0 ? (
                                <p className="text-[11px] text-slate-500 italic">
                                  Không có dữ liệu đáp án từng câu cho bài nộp này.
                                </p>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 text-[10px]">
                                  {answerRows.map((row) => {
                                    const cardTone =
                                      row.status === 'correct'
                                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                        : row.status === 'partial'
                                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                                        : row.status === 'wrong'
                                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                                        : 'bg-slate-50 border-slate-200 text-slate-700';

                                    const badgeSymbol =
                                      row.status === 'correct'
                                        ? '✓'
                                        : row.status === 'partial'
                                        ? '~'
                                        : row.status === 'wrong'
                                        ? '✗'
                                        : row.status === 'unanswered'
                                        ? '—'
                                        : '•';

                                    const badgeColor =
                                      row.status === 'correct'
                                        ? 'text-emerald-700'
                                        : row.status === 'partial'
                                        ? 'text-amber-700'
                                        : row.status === 'wrong'
                                        ? 'text-rose-700'
                                        : 'text-slate-400';

                                    return (
                                      <div
                                        key={row.key}
                                        className={`px-2 py-1 rounded-lg border font-mono ${cardTone} ${
                                          row.partType === 'part_2_true_false' ? 'col-span-2' : ''
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-bold text-[9px] text-slate-500 uppercase">
                                            {row.label}
                                          </span>
                                          <span className={`font-black text-[10px] ${badgeColor}`}>{badgeSymbol}</span>
                                        </div>
                                        <div className="font-extrabold text-[10px] leading-tight mt-0.5 break-all">
                                          {row.studentAnswer}
                                        </div>
                                        {(row.status === 'wrong' ||
                                          row.status === 'unanswered' ||
                                          row.status === 'partial') &&
                                          row.correctAnswer !== '—' &&
                                          row.correctAnswer !== 'Không có đề gốc' && (
                                            <div className="text-[9px] text-slate-500 mt-0.5">
                                              Đúng: <strong className="text-slate-700">{row.correctAnswer}</strong>
                                            </div>
                                          )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 6. GHI CHÚ NHẬN XÉT CỦA GIÁO VIÊN */}
                {teacherCustomNotes && (
                  <div className="p-3.5 rounded-2xl border border-slate-300 bg-slate-50 space-y-1 text-xs">
                    <span className="font-extrabold uppercase text-[11px] text-slate-800 block">
                      Đánh Giá & Đề Xuất Của Giáo Viên Bộ Môn:
                    </span>
                    <p className="text-slate-700 leading-relaxed italic">{teacherCustomNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TRƯỜNG HỢP B: PHIẾU BÁO ĐIỂM CÁ NHÂN (INDIVIDUAL)          */}
            {/* ========================================================= */}
            {reportType === 'individual_student' && selectedIndividualSub && (
              <div className="space-y-6">
                {/* Thông tin học sinh */}
                <div className="p-5 rounded-2xl border border-slate-300 bg-blue-50/40 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block text-[10px] uppercase">Họ và Tên Học Sinh:</span>
                    <strong className="text-base text-slate-900 block mt-0.5 font-bold">
                      {selectedIndividualSub.studentName}
                    </strong>
                    <span className="text-slate-500 font-mono">
                      Mã HS: {selectedIndividualSub.studentId} · {selectedIndividualSub.studentEmail}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold block text-[10px] uppercase">Lớp Học & Thời Gian Làm Bài:</span>
                    <strong className="text-base text-slate-900 block mt-0.5 font-bold">
                      {classrooms.find((c) => c.id === selectedIndividualSub.classId)?.name || 'Tự luyện / Lớp đã xóa'}
                    </strong>
                    <span className="text-slate-800 font-semibold block mt-0.5">
                      Tổng thời gian đã làm:{' '}
                      <strong className="font-mono text-blue-700">
                        {formatDurationSpent(selectedIndividualSub.timeSpentSeconds)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Tổng điểm và phân bố 3 phần */}
                <div className="p-6 rounded-2xl border-2 border-blue-600 bg-white text-center space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                    Kết Quả Đánh Giá Tổng Hợp
                  </span>
                  <div className="text-4xl font-black font-mono text-blue-700">
                    {selectedIndividualSub.score.toFixed(2)}{' '}
                    <span className="text-lg text-slate-400">
                      / {formatPointsNumber(individualScaleInfo.totalPoints)} điểm
                    </span>
                  </div>
                  {(() => {
                    const indRank = classifyScoreByScale(
                      selectedIndividualSub.score,
                      individualScaleInfo.totalPoints
                    );
                    return (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800">
                        Xếp loại: {indRank.label === 'Giỏi' ? 'Giỏi (Xuất Sắc)' : indRank.label} ({indRank.percent}%)
                      </span>
                    );
                  })()}

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-700 block">Phần I: Trắc Nghiệm 4 Lựa Chọn</span>
                      <strong className="text-base font-black font-mono text-blue-900">
                        {selectedIndividualSub.partScores.part1.toFixed(2)}/
                        {formatPointsNumber(individualScaleInfo.part1Max)}đ
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                      <span className="text-[10px] font-bold text-purple-700 block">Phần II: Đúng / Sai 4 Ý</span>
                      <strong className="text-base font-black font-mono text-purple-900">
                        {selectedIndividualSub.partScores.part2.toFixed(2)}/
                        {formatPointsNumber(individualScaleInfo.part2Max)}đ
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-700 block">Phần III: Trả Lời Ngắn</span>
                      <strong className="text-base font-black font-mono text-amber-900">
                        {selectedIndividualSub.partScores.part3.toFixed(2)}/
                        {formatPointsNumber(individualScaleInfo.part3Max)}đ
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Giám sát an toàn thi cử */}
                <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    <span>
                      Tình trạng giám sát:{' '}
                      <strong>
                        {selectedIndividualSub.infractionCount === 0
                          ? 'Trung thực, không vi phạm chuyển tab'
                          : `${selectedIndividualSub.infractionCount} lần cảnh báo`}
                      </strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-600">
                    <span>
                      Tổng TG làm: <strong className="text-slate-900">{formatDurationSpent(selectedIndividualSub.timeSpentSeconds)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Nộp bài: {new Date(selectedIndividualSub.submittedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* Chi tiết đáp án từng câu đã chọn của thí sinh */}
                {includeQuestionAnswers && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
                      <span className="font-extrabold uppercase text-xs text-slate-800">
                        Chi Tiết Đáp Án Từng Câu Đã Chọn
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Tổng {individualAnswerRows.length} câu · Đúng hoàn toàn:{' '}
                        {individualAnswerRows.filter((r) => r.status === 'correct').length}
                      </span>
                    </div>

                    {individualAnswerRows.length === 0 ? (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 italic text-center">
                        Không có dữ liệu đáp án từng câu cho bài nộp này.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-300 text-[11px]">
                            <th className="py-2 px-2.5 border-r border-slate-300 text-center w-20">Câu</th>
                            <th className="py-2 px-2.5 border-r border-slate-300 text-center w-28">Phần</th>
                            <th className="py-2 px-3 border-r border-slate-300">Đáp Án Thí Sinh Chọn</th>
                            <th className="py-2 px-3 border-r border-slate-300">Đáp Án Đúng</th>
                            <th className="py-2 px-2.5 text-center w-28">Kết Quả</th>
                          </tr>
                        </thead>
                        <tbody>
                          {individualAnswerRows.map((row, rIdx) => {
                            const statusLabel =
                              row.status === 'correct'
                                ? 'Đúng ✓'
                                : row.status === 'partial'
                                ? 'Đúng 1 phần'
                                : row.status === 'wrong'
                                ? 'Sai ✗'
                                : row.status === 'unanswered'
                                ? 'Bỏ trống'
                                : 'Đã chọn';
                            const statusTone =
                              row.status === 'correct'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.status === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : row.status === 'wrong'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600';

                            return (
                              <tr
                                key={row.key}
                                className={`border-b border-slate-200 ${rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                              >
                                <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-bold font-mono text-slate-900">
                                  {row.label}
                                </td>
                                <td className="py-1.5 px-2.5 border-r border-slate-300 text-center text-[11px] text-slate-600">
                                  {row.partShort}
                                </td>
                                <td className="py-1.5 px-3 border-r border-slate-300 font-mono font-bold text-slate-900">
                                  {row.studentAnswer}
                                </td>
                                <td className="py-1.5 px-3 border-r border-slate-300 font-mono text-slate-700">
                                  {row.correctAnswer}
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusTone}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Nhận xét của giáo viên */}
                <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-1.5 text-xs">
                  <span className="font-extrabold uppercase text-slate-800 block text-[11px]">
                    Nhận Xét & Khuyến Nghị Của Giáo Viên Bộ Môn:
                  </span>
                  <p className="text-slate-700 italic leading-relaxed">
                    Em {selectedIndividualSub.studentName} đã hoàn thành tốt bài kiểm tra năng lực. Nắm chắc kiến thức
                    trọng tâm của chương trình. Cần tiếp tục duy trì phương pháp ôn luyện và củng cố thêm phần câu hỏi
                    phân hóa cao.
                  </p>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* SIGNATURE BLOCK (CHỮ KÝ XÁC NHẬN CHUẨN VĂN BẢN SƯ PHẠM)    */}
            {/* ========================================================= */}
            {includeTeacherSignature && (
              <div className="pt-8 mt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs text-center font-bold">
                <div>
                  <span className="block uppercase text-[11px] text-slate-600">XÁC NHẬN CỦA PHỤ HUYNH</span>
                  <span className="block text-[10px] text-slate-400 font-normal italic">(Ký và ghi rõ họ tên)</span>
                  <div className="h-16" />
                  <span className="block text-slate-400 font-normal">...................................................</span>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 italic font-normal">
                    Hà Nội, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm{' '}
                    {new Date().getFullYear()}
                  </span>
                  <span className="block uppercase text-[11px] text-slate-800 mt-1">GIÁO VIÊN BỘ MÔN TOÁN</span>
                  <span className="block text-[10px] text-slate-400 font-normal italic">(Ký và ghi rõ họ tên)</span>
                  <div className="h-16" />
                  <span className="block text-slate-900 font-bold">ThS. Nguyễn Văn Toàn</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL BOTTOM BAR                                          */}
        {/* ========================================================= */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Info size={15} />
            <span>
              Đang chọn xuất:{' '}
              <strong className="text-slate-800 uppercase">
                {fileFormat === 'pdf' ? 'Tài liệu PDF (.pdf)' : fileFormat === 'excel' ? 'Bảng tính Excel (.xlsx)' : 'Văn bản Word (.docx)'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold transition-colors"
            >
              Đóng Cửa Sổ
            </button>

            <button
              type="button"
              onClick={handleDownloadSelectedFormat}
              disabled={isExporting}
              className={`px-6 py-2.5 rounded-xl text-white font-extrabold shadow-sm flex items-center gap-2 transition-all ${
                fileFormat === 'excel'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : fileFormat === 'word'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50`}
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang Khởi Tạo...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>
                    Tải File {fileFormat === 'pdf' ? '.PDF' : fileFormat === 'excel' ? '.XLSX (Excel)' : '.DOCX (Word)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

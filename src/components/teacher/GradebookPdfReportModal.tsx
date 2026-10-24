import React, { useState, useRef } from 'react';
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
  Award,
  Users,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Calendar,
  Clock,
  ShieldCheck,
  Check,
  Loader2,
  Settings,
  Sparkles,
  Info,
} from 'lucide-react';
import { Classroom, StudentExamSubmission, Exam } from '../../types/math';

export type ReportFileFormat = 'pdf' | 'excel' | 'word';
export type ReportType = 'class_summary' | 'individual_student';

interface GradebookPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classrooms: Classroom[];
  selectedClassId: string;
  selectedExamId: string;
  examsList: Exam[];
  submissions: StudentExamSubmission[];
  analytics: {
    total: number;
    average: number;
    max: number;
    min: number;
    excellentCount: number;
    goodCount: number;
    averageCount: number;
    belowCount: number;
    cheatingCount: number;
  };
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
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');

  // Các tùy chọn bổ sung
  const [includeAnalyticsChart, setIncludeAnalyticsChart] = useState(true);
  const [includeTeacherSignature, setIncludeTeacherSignature] = useState(true);
  const [teacherCustomNotes, setTeacherCustomNotes] = useState(
    'Học sinh nắm vững các dạng toán cơ bản và vận dụng tốt ở Phần I và Phần II. Cần rèn luyện thêm kỹ năng tính toán nhanh ở Phần III (Trả lời ngắn).'
  );

  // Trạng thái đang xuất file
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const reportPrintRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Dữ liệu lớp và đề thi
  const currentClass = classrooms.find((c) => c.id === selectedClassId);
  const currentExam = examsList.find((e) => e.id === selectedExamId);

  const selectedIndividualSub = submissions.find((s) => s.id === selectedStudentSubId) || submissions[0];
  const individualExam = selectedIndividualSub
    ? examsList.find((e) => e.id === selectedIndividualSub.examId) || examsList[0]
    : null;

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
      alert('Có lỗi xảy ra khi tạo file PDF. Vui lòng thử lại!');
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
        // Sheet 1: Bảng điểm cả lớp
        const wsData: (string | number)[][] = [
          ['SỞ GIÁO DỤC VÀ ĐÀO TẠO', '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
          ['HỆ THỐNG TOÁN THẦY NGUYỄN BÁ KỲ (MATH&NBK)', '', '', '', 'Độc lập - Tự do - Hạnh phúc'],
          ['TỔ CHUYÊN MÔN TOÁN - TIN', '', '', '', '-------------------'],
          [''],
          ['BÁO CÁO TỔNG HỢP ĐIỂM THI VÀ NĂNG LỰC TOÁN HỌC (GDPT 2018)'],
          [`Lớp: ${classNameDisplay}`, `Đề thi: ${examTitleDisplay}`, `Ngày xuất: ${currentDateDisplay}`],
          [''],
          ['--- I. THỐNG KÊ TỔNG QUAN & PHỔ ĐIỂM ---'],
          ['Chỉ số thống kê', 'Giá trị', '', 'Phân loại phổ điểm', 'Số lượng (HS)', 'Tỷ lệ (%)'],
          ['Tổng số bài nộp', analytics.total, '', 'Giỏi (>= 8.0đ)', analytics.excellentCount, `${analytics.total ? ((analytics.excellentCount / analytics.total) * 100).toFixed(1) : 0}%`],
          ['Điểm trung bình', Number(analytics.average.toFixed(2)), '', 'Khá (6.5 - 7.9đ)', analytics.goodCount, `${analytics.total ? ((analytics.goodCount / analytics.total) * 100).toFixed(1) : 0}%`],
          ['Điểm cao nhất', Number(analytics.max.toFixed(2)), '', 'Trung bình (5.0 - 6.4đ)', analytics.averageCount, `${analytics.total ? ((analytics.averageCount / analytics.total) * 100).toFixed(1) : 0}%`],
          ['Điểm thấp nhất', Number(analytics.min.toFixed(2)), '', 'Dưới trung bình (< 5.0đ)', analytics.belowCount, `${analytics.total ? ((analytics.belowCount / analytics.total) * 100).toFixed(1) : 0}%`],
          ['Học sinh có vi phạm chuyển tab', analytics.cheatingCount, '', '', '', ''],
          [''],
          ['--- II. DANH SÁCH CHI TIẾT BÀI NỘP HỌC SINH ---'],
          [
            'STT',
            'Mã Học Sinh',
            'Họ Và Tên',
            'Email',
            'Lớp',
            'Điểm Tổng (/10)',
            'Phần I (MCQ 3đ)',
            'Phần II (Đ/S 4đ)',
            'Phần III (Ngắn 3đ)',
            'Thời Gian (phút)',
            'Vi Phạm Tab',
            'Xếp Loại',
          ],
        ];

        submissions.forEach((sub, idx) => {
          const rank =
            sub.score >= 8.0 ? 'Giỏi' : sub.score >= 6.5 ? 'Khá' : sub.score >= 5.0 ? 'Trung bình' : 'Yếu';
          wsData.push([
            idx + 1,
            sub.studentId,
            sub.studentName,
            sub.studentEmail,
            classrooms.find((c) => c.id === sub.classId)?.name || '12A1',
            Number(sub.score.toFixed(2)),
            Number(sub.partScores.part1.toFixed(2)),
            Number(sub.partScores.part2.toFixed(2)),
            Number(sub.partScores.part3.toFixed(2)),
            Math.round(sub.timeSpentSeconds / 60),
            sub.infractionCount,
            rank,
          ]);
        });

        // Chân trang chữ ký
        wsData.push(['']);
        wsData.push(['', '', '', '', '', '', '', '', `Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`]);
        wsData.push(['', 'BAN GIÁM HIỆU', '', '', '', '', '', '', 'GIÁO VIÊN BỘ MÔN']);
        wsData.push(['', '(Ký và đóng dấu)', '', '', '', '', '', '', '(Ký và ghi rõ họ tên)']);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Định dạng độ rộng cột
        ws['!cols'] = [
          { wch: 6 },  // STT
          { wch: 14 }, // Mã HS
          { wch: 24 }, // Họ tên
          { wch: 26 }, // Email
          { wch: 12 }, // Lớp
          { wch: 16 }, // Điểm tổng
          { wch: 16 }, // Phần I
          { wch: 16 }, // Phần II
          { wch: 16 }, // Phần III
          { wch: 16 }, // Thời gian
          { wch: 14 }, // Vi phạm
          { wch: 14 }, // Xếp loại
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Bang_Diem_Lop');
      } else {
        // Sheet cá nhân học sinh
        const sub = selectedIndividualSub;
        const rank = sub.score >= 8.0 ? 'Giỏi' : sub.score >= 6.5 ? 'Khá' : sub.score >= 5.0 ? 'Trung bình' : 'Yếu';
        const wsData: (string | number)[][] = [
          ['HỆ THỐNG TOÁN THẦY NGUYỄN BÁ KỲ (MATH&NBK)', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
          ['TỔ TOÁN - TIN', '', 'Độc lập - Tự do - Hạnh phúc'],
          [''],
          ['PHIẾU BÁO ĐIỂM VÀ ĐÁNH GIÁ NĂNG LỰC TOÁN HỌC'],
          [''],
          ['THÔNG TIN HỌC SINH', ''],
          ['Họ và Tên:', sub.studentName, 'Mã Học Sinh:', sub.studentId],
          ['Lớp:', classrooms.find((c) => c.id === sub.classId)?.name || '12A1', 'Email:', sub.studentEmail],
          ['Bài Kiểm Tra:', sub.examTitle, 'Ngày Nộp:', new Date(sub.submittedAt).toLocaleString('vi-VN')],
          ['Thời Gian Làm Bài:', `${Math.round(sub.timeSpentSeconds / 60)} phút`, 'Cảnh Báo Vi Phạm Tab:', `${sub.infractionCount} lần`],
          [''],
          ['KẾT QUẢ ĐÁNH GIÁ', ''],
          ['ĐIỂM TỔNG KẾT:', `${sub.score.toFixed(2)} / 10.0`, 'XẾP LOẠI:', rank],
          ['Phần I (Trắc nghiệm 4 lựa chọn):', `${sub.partScores.part1.toFixed(2)} / 3.0 điểm`],
          ['Phần II (Đúng/Sai 4 ý):', `${sub.partScores.part2.toFixed(2)} / 4.0 điểm`],
          ['Phần III (Trả lời ngắn):', `${sub.partScores.part3.toFixed(2)} / 3.0 điểm`],
          [''],
          ['NHẬN XÉT CỦA GIÁO VIÊN BỘ MÔN:'],
          [teacherCustomNotes],
          [''],
          ['XÁC NHẬN CỦA PHỤ HUYNH', '', '', 'GIÁO VIÊN BỘ MÔN'],
          ['(Ký và ghi rõ họ tên)', '', '', '(Ký và ghi rõ họ tên)'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 32 }, { wch: 35 }, { wch: 25 }, { wch: 25 }];
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
      alert('Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại!');
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
                new TableCell({ children: [new Paragraph('Giỏi (>= 8.0đ)')], borders: borderConfig }),
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
                new TableCell({ children: [new Paragraph('Điểm trung bình')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${analytics.average.toFixed(2)} / 10`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('Khá (6.5 - 7.9đ)')], borders: borderConfig }),
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
                new TableCell({ children: [new Paragraph(`${analytics.max.toFixed(2)}đ / ${analytics.min.toFixed(2)}đ`)], borders: borderConfig }),
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
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Xếp Loại', bold: true })] })], shading: { fill: 'E2E8F0' }, borders: borderConfig }),
            ],
          }),
        ];

        submissions.forEach((sub, idx) => {
          const rank =
            sub.score >= 8.0 ? 'Giỏi' : sub.score >= 6.5 ? 'Khá' : sub.score >= 5.0 ? 'Trung bình' : 'Yếu';
          studentTableRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(`${idx + 1}`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(sub.studentName)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(classrooms.find((c) => c.id === sub.classId)?.name || '12A1')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.score.toFixed(2)}đ`, bold: true })] })], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${sub.partScores.part1.toFixed(2)}đ`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${sub.partScores.part2.toFixed(2)}đ`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(`${sub.partScores.part3.toFixed(2)}đ`)], borders: borderConfig }),
                new TableCell({ children: [new Paragraph(rank)], borders: borderConfig }),
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
                new Paragraph(''),
                new Paragraph({
                  text: 'III. NHẬN XÉT CỦA GIÁO VIÊN BỘ MÔN',
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
        const rank = sub.score >= 8.0 ? 'Giỏi' : sub.score >= 6.5 ? 'Khá' : sub.score >= 5.0 ? 'Trung bình' : 'Yếu';

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
                new TableCell({ children: [new Paragraph(classrooms.find((c) => c.id === sub.classId)?.name || '12A1')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Thời gian làm:', bold: true })] })], borders: borderConfig, shading: { fill: 'F8FAFC' } }),
                new TableCell({ children: [new Paragraph(`${Math.round(sub.timeSpentSeconds / 60)} phút`)], borders: borderConfig }),
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
                new TableCell({ children: [new Paragraph('Trắc nghiệm 4 lựa chọn (12 câu)')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('3.0 điểm')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.partScores.part1.toFixed(2)}đ`, bold: true })] })], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Phần II')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('Đúng / Sai 4 ý (4 câu)')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('4.0 điểm')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.partScores.part2.toFixed(2)}đ`, bold: true })] })], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Phần III')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('Trả lời ngắn (6 câu)')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph('3.0 điểm')], borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${sub.partScores.part3.toFixed(2)}đ`, bold: true })] })], borders: borderConfig }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'TỔNG CỘNG', bold: true })] })], shading: { fill: 'EFF6FF' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Xếp loại: ${rank}`, bold: true })] })], shading: { fill: 'EFF6FF' }, borders: borderConfig }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '10.0 điểm', bold: true })] })], shading: { fill: 'EFF6FF' }, borders: borderConfig }),
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
      alert('Có lỗi xảy ra khi tạo file Word. Vui lòng thử lại!');
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

  // Mở cửa sổ in hệ thống (Print to PDF)
  const handlePrintSystem = () => {
    const reportElement = reportPrintRef.current;
    if (!reportElement) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Vui lòng cho phép popup để mở bản in!');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Báo Cáo Điểm Số - Toán Thầy Nguyễn Bá Kỳ</title>
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
        </head>
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

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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

        {/* Thông báo thành công */}
        {exportMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{exportMessage}</span>
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
                        {analytics.average.toFixed(2)}
                      </strong>
                      <span className="text-[10px] text-blue-500 block mt-0.5">Thang 10</span>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 block">Điểm Cao Nhất</span>
                      <strong className="text-2xl font-black font-mono text-emerald-800">
                        {analytics.max.toFixed(2)}
                      </strong>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">Điểm tuyệt đối</span>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70">
                      <span className="text-[10px] font-bold uppercase text-amber-700 block">Điểm Thấp Nhất</span>
                      <strong className="text-2xl font-black font-mono text-amber-800">
                        {analytics.min.toFixed(2)}
                      </strong>
                      <span className="text-[10px] text-amber-600 block mt-0.5">Cần bồi dưỡng</span>
                    </div>
                  </div>
                )}

                {/* 4. PHÂN TÍCH PHỔ ĐIỂM (XẾP LOẠI GDPT 2018) */}
                {includeAnalyticsChart && (
                  <div className="p-4 rounded-2xl border border-slate-300 bg-slate-50 space-y-2 text-xs">
                    <span className="font-extrabold text-slate-800 block text-[11px] uppercase">
                      Phân Bố Xếp Loại Học Lực (Theo Thang Điểm 10 Chuẩn)
                    </span>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white border border-emerald-200">
                        <span className="text-emerald-700 font-bold block text-[11px]">Giỏi (&ge; 8.0)</span>
                        <strong className="text-lg font-black font-mono text-emerald-900">
                          {analytics.excellentCount}
                        </strong>
                        <span className="text-[10px] text-slate-400 block">
                          ({analytics.total ? ((analytics.excellentCount / analytics.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-blue-200">
                        <span className="text-blue-700 font-bold block text-[11px]">Khá (6.5 - 7.9)</span>
                        <strong className="text-lg font-black font-mono text-blue-900">{analytics.goodCount}</strong>
                        <span className="text-[10px] text-slate-400 block">
                          ({analytics.total ? ((analytics.goodCount / analytics.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-amber-200">
                        <span className="text-amber-700 font-bold block text-[11px]">Trung bình (5.0 - 6.4)</span>
                        <strong className="text-lg font-black font-mono text-amber-900">
                          {analytics.averageCount}
                        </strong>
                        <span className="text-[10px] text-slate-400 block">
                          ({analytics.total ? ((analytics.averageCount / analytics.total) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-rose-200">
                        <span className="text-rose-700 font-bold block text-[11px]">Dưới TB (&lt; 5.0)</span>
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
                    <span className="text-[11px] text-slate-500 italic">Thang điểm 10 chuẩn GDPT</span>
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
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center text-[11px]">Giám Sát</th>
                        <th className="py-2 px-2.5 text-center text-[11px]">Xếp Loại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub, idx) => {
                        const rank =
                          sub.score >= 8.0
                            ? 'Giỏi'
                            : sub.score >= 6.5
                            ? 'Khá'
                            : sub.score >= 5.0
                            ? 'Trung bình'
                            : 'Yếu';
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
                              {classrooms.find((c) => c.id === sub.classId)?.name || '12A1'}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-black font-mono text-sm text-blue-700">
                              {sub.score.toFixed(2)}
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
                                  rank === 'Giỏi'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rank === 'Khá'
                                    ? 'bg-blue-100 text-blue-800'
                                    : rank === 'Trung bình'
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
                    <span className="text-slate-500 font-mono">{selectedIndividualSub.studentEmail}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold block text-[10px] uppercase">Lớp Học & Khối:</span>
                    <strong className="text-base text-slate-900 block mt-0.5 font-bold">
                      {classrooms.find((c) => c.id === selectedIndividualSub.classId)?.name || 'Lớp 12A1'}
                    </strong>
                    <span className="text-slate-500">
                      Thời gian làm: {Math.round(selectedIndividualSub.timeSpentSeconds / 60)} phút
                    </span>
                  </div>
                </div>

                {/* Tổng điểm và phân bố 3 phần */}
                <div className="p-6 rounded-2xl border-2 border-blue-600 bg-white text-center space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                    Kết Quả Đánh Giá Tổng Hợp
                  </span>
                  <div className="text-4xl font-black font-mono text-blue-700">
                    {selectedIndividualSub.score.toFixed(2)} <span className="text-lg text-slate-400">/ 10 điểm</span>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800">
                    Xếp loại:{' '}
                    {selectedIndividualSub.score >= 8
                      ? 'Giỏi (Xuất Sắc)'
                      : selectedIndividualSub.score >= 6.5
                      ? 'Khá'
                      : 'Đạt Chuẩn'}
                  </span>

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-700 block">Phần I: Trắc Nghiệm 4 Lựa Chọn</span>
                      <strong className="text-base font-black font-mono text-blue-900">
                        {selectedIndividualSub.partScores.part1.toFixed(2)}đ
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                      <span className="text-[10px] font-bold text-purple-700 block">Phần II: Đúng / Sai 4 Ý</span>
                      <strong className="text-base font-black font-mono text-purple-900">
                        {selectedIndividualSub.partScores.part2.toFixed(2)}đ
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-700 block">Phần III: Trả Lời Ngắn</span>
                      <strong className="text-base font-black font-mono text-amber-900">
                        {selectedIndividualSub.partScores.part3.toFixed(2)}đ
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Giám sát an toàn thi cử */}
                <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-between text-xs">
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
                  <span className="text-slate-500 font-mono text-[11px]">
                    Nộp bài: {new Date(selectedIndividualSub.submittedAt).toLocaleString('vi-VN')}
                  </span>
                </div>

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

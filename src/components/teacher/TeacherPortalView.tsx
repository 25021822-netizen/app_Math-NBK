import React, { useState, useRef, useEffect } from 'react';
import { Exam, Question, ExamPartType, Classroom, ScoreVisibilityMode, getExamScoreVisibilityLabel } from '../../types/math';
import { SAMPLE_CLASSROOMS } from '../../data/mockData';
import { MathView } from '../MathView';
import { ExamImage } from '../common/ExamImage';
import { ParsedExamSchema } from '../../lib/pdfParserSchema';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileUp,
  Download,
  Code2,
  Eye,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  HelpCircle,
  Save,
  BookOpen,
  X,
  SlidersHorizontal,
  Clock,
  Calendar,
  Users,
  Image as ImageIcon,
  Paperclip,
  Check,
  Compass,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Monitor,
  ClipboardPaste,
  Scissors,
} from 'lucide-react';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';
import { parseExamFromLatexOrText } from '../../lib/latexExamParser';
import { QuestionCropStudioView } from './QuestionCropStudioView';
import { examNeedsImageCloudSync, persistExamImagesEverywhere } from '../../services/examImageService';

interface TeacherPortalViewProps {
  onPublishExam?: (newExam: Exam) => Promise<boolean> | void;
  onPreviewExam?: (exam: Exam) => void;
  classrooms?: Classroom[];
  currentUserName?: string;
  currentUserId?: string;
  currentUserEmail?: string;
  examsList?: Exam[];
  onDeleteExam?: (examId: string) => void;
  initialMode?: 'manual' | 'ai_pdf' | 'crop_studio' | 'manage_exams';
  onAssignExamToClasses?: (
    examId: string,
    targetClassIds: string[],
    distributionType: 'classroom' | 'repository' | 'both',
    maxAttempts?: number,
    openTime?: string,
    closeTime?: string,
    enableScreenMonitoring?: boolean,
    maxInfractions?: number,
    scoreVisibility?: ScoreVisibilityMode
  ) => void;
  onSaveSingleExam?: (updatedExam: Exam) => void;
}

export const TeacherPortalView: React.FC<TeacherPortalViewProps> = ({
  onPublishExam,
  onPreviewExam,
  classrooms = SAMPLE_CLASSROOMS,
  currentUserName = '',
  currentUserId,
  currentUserEmail,
  examsList = [],
  onDeleteExam,
  initialMode,
  onAssignExamToClasses,
  onSaveSingleExam,
}) => {
  // Chế độ: 'manual' (Tạo đề thủ công), 'ai_pdf' (AI Bóc Tách PDF), 'crop_studio' (Phòng cắt câu đề thi) hoặc 'manage_exams' (Quản lý kho đề thi)
  const [creationMode, setCreationMode] = useState<'manual' | 'ai_pdf' | 'crop_studio' | 'manage_exams'>(initialMode || 'manual');

  useEffect(() => {
    if (initialMode) {
      setCreationMode(initialMode);
    }
  }, [initialMode]);

  // Modal xác nhận xóa đề thi vĩnh viễn kèm dữ liệu liên quan
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState<boolean>(false);

  // Modal & State Giao Đề Cho Các Nhóm Lớp
  const [examToAssign, setExamToAssign] = useState<Exam | null>(null);
  const [assignTargetClassIds, setAssignTargetClassIds] = useState<string[]>([]);
  const [assignDistributionType, setAssignDistributionType] = useState<'classroom' | 'repository' | 'both'>('classroom');
  const [assignMaxAttempts, setAssignMaxAttempts] = useState<number>(1);
  const [assignHasTimeWindow, setAssignHasTimeWindow] = useState<boolean>(true);
  const [assignOpenTime, setAssignOpenTime] = useState<string>('');
  const [assignCloseTime, setAssignCloseTime] = useState<string>('');
  const [assignScreenMonitoring, setAssignScreenMonitoring] = useState<boolean>(true);
  const [assignMaxInfractions, setAssignMaxInfractions] = useState<number>(3);
  const [assignScoreVisibility, setAssignScoreVisibility] = useState<ScoreVisibilityMode>('immediate');
  const [isSavingAssignment, setIsSavingAssignment] = useState<boolean>(false);
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);

  // ================= STATE DÀNH CHO TẠO ĐỀ THỦ CÔNG =================
  const [manualTitle, setManualTitle] = useState('');
  const [manualGrade, setManualGrade] = useState<10 | 11 | 12>(12);
  const [manualYear, setManualYear] = useState<number>(new Date().getFullYear());
  const [manualDuration, setManualDuration] = useState<number>(90);
  const [manualCreatedBy, setManualCreatedBy] = useState(currentUserName || '');

  // 1. Giới hạn số lượt làm bài (0 = Không giới hạn, 1 = Thi chính thức, 2, 3...)
  const [manualMaxAttempts, setManualMaxAttempts] = useState<number>(1);

  // 2. Thời gian mở đề thi và đóng đề thi
  const [manualHasTimeWindow, setManualHasTimeWindow] = useState<boolean>(true);
  const [manualOpenTime, setManualOpenTime] = useState<string>(
    new Date(Date.now() - 3600 * 1000).toISOString().slice(0, 16)
  );
  const [manualCloseTime, setManualCloseTime] = useState<string>(
    new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 16)
  );

  // 3. Giao đề cho nhóm lớp hoặc đưa vào kho tổng hợp
  const [manualDistributionType, setManualDistributionType] = useState<'classroom' | 'repository' | 'both'>('classroom');
  const [manualTargetClassIds, setManualTargetClassIds] = useState<string[]>(() => classrooms.map((c) => c.id));

  // Tự động chọn tất cả nhóm lớp nếu có lớp mới hoặc danh sách được tải về
  useEffect(() => {
    if (manualTargetClassIds.length === 0 && classrooms.length > 0) {
      setManualTargetClassIds(classrooms.map((c) => c.id));
    }
  }, [classrooms]);

  // 4. Cho phép học sinh xem đáp án & lời giải chi tiết khi làm xong + chế độ hiển thị điểm
  const [manualAllowViewAnswers, setManualAllowViewAnswers] = useState<boolean>(true);
  const [manualScoreVisibility, setManualScoreVisibility] = useState<ScoreVisibilityMode>('immediate');

  // 5. Ô kiểm soát màn hình & Chống gian lận khi thi (bắt buộc toàn màn hình, cấm chuyển tab)
  const [manualScreenMonitoring, setManualScreenMonitoring] = useState<boolean>(true);
  const [manualMaxInfractions, setManualMaxInfractions] = useState<number>(3);

  // Danh sách câu hỏi trong đề thi (Khởi tạo rỗng, không chứa câu hỏi mẫu)
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);

  // 4. Tổng điểm tính toán tự động dựa trên tổng điểm từng câu hỏi của bài
  const dynamicTotalPoints = manualQuestions.reduce((sum, q) => sum + (q.points || 0), 0);

  // Modal thêm/sửa câu hỏi
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionModalError, setQuestionModalError] = useState<string | null>(null);

  // Form state cho câu hỏi đang tạo/sửa (CHỈ GỒM: part_1_mcq, part_2_true_false, part_3_short_answer)
  const [modalPart, setModalPart] = useState<'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer'>('part_1_mcq');
  const [modalPrompt, setModalPrompt] = useState('');
  const [modalLatex, setModalLatex] = useState('');
  const [modalExplanation, setModalExplanation] = useState('');
  const [modalPoints, setModalPoints] = useState<number>(0.25);

  // File đính kèm ảnh hoặc PDF cho câu hỏi (hỗ trợ dán clipboard Ctrl+V)
  const [modalImageAttachment, setModalImageAttachment] = useState<string | null>(null);
  const [modalOptionsAttachmentUrl, setModalOptionsAttachmentUrl] = useState<string | null>(null);
  const [modalPdfName, setModalPdfName] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // State riêng cho Phần 1 (MCQ)
  const [modalOptA, setModalOptA] = useState('');
  const [modalOptB, setModalOptB] = useState('');
  const [modalOptC, setModalOptC] = useState('');
  const [modalOptD, setModalOptD] = useState('');
  const [modalCorrectMcq, setModalCorrectMcq] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // State riêng cho Phần 2 (Đúng/Sai)
  const [modalTfA, setModalTfA] = useState({ text: '', isCorrect: true });
  const [modalTfB, setModalTfB] = useState({ text: '', isCorrect: false });
  const [modalTfC, setModalTfC] = useState({ text: '', isCorrect: true });
  const [modalTfD, setModalTfD] = useState({ text: '', isCorrect: true });

  // State riêng cho Phần 3 (Trả lời ngắn <= 4 ký tự)
  const [modalShortAnswer, setModalShortAnswer] = useState('');

  // Thông báo xuất bản & xóa
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);
  const [manualValidationErrors, setManualValidationErrors] = useState<string[]>([]);
  const [questionToDelete, setQuestionToDelete] = useState<{ id: string; questionNumber: number; prompt: string } | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState<boolean>(false);

  // ================= STATE DÀNH CHO AI PDF / WORD & LATEX SCANNER =================
  const [aiInputMethod, setAiInputMethod] = useState<'pdf' | 'latex'>('pdf');
  const [aiPdfFile, setAiPdfFile] = useState<{
    fileName: string;
    fileSize: string;
    fileBase64: string;
    fileType: 'pdf' | 'word' | 'image';
    extractedText?: string;
    pageImages?: string[];
  } | null>(null);
  const [isConvertingDocument, setIsConvertingDocument] = useState<boolean>(false);
  const [aiLatexText, setAiLatexText] = useState<string>('');
  const [aiExamTitle, setAiExamTitle] = useState<string>('Đề Thi Khảo Sát Toán THPT Chuẩn Bộ GD&ĐT 2025');
  const [aiGrade, setAiGrade] = useState<10 | 11 | 12>(12);
  const [aiDuration, setAiDuration] = useState<number>(90);
  const [isAiScanning, setIsAiScanning] = useState<boolean>(false);
  const [aiScanError, setAiScanError] = useState<string | null>(null);
  const [aiParsedExam, setAiParsedExam] = useState<Exam | null>(null);
  const [aiScanStatusText, setAiScanStatusText] = useState<string>('');
  const [aiScanSource, setAiScanSource] = useState<string | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState<boolean>(false);
  const pdfExamInputRef = useRef<HTMLInputElement>(null);

  // Cấu hình phân phối đề thi khi xuất bản trực tiếp từ AI / PDF / LaTeX
  const [aiDistributionType, setAiDistributionType] = useState<'classroom' | 'repository' | 'both'>('repository');
  const [aiTargetClassIds, setAiTargetClassIds] = useState<string[]>(() => classrooms.map((c) => c.id));
  const [aiMaxAttempts, setAiMaxAttempts] = useState<number>(1);
  const [aiScreenMonitoring, setAiScreenMonitoring] = useState<boolean>(true);
  const [aiMaxInfractions, setAiMaxInfractions] = useState<number>(3);
  const [aiScoreVisibility, setAiScoreVisibility] = useState<ScoreVisibilityMode>('immediate');

  useEffect(() => {
    if (aiTargetClassIds.length === 0 && classrooms.length > 0) {
      setAiTargetClassIds(classrooms.map((c) => c.id));
    }
  }, [classrooms]);

  // Mẫu mã nguồn LaTeX chuẩn Bộ Giáo dục & Đào tạo 2025 có câu đầu đề, trích dẫn nguồn và lời dẫn chung
  const SAMPLE_LATEX_BGD_EXAM = `% BỘ GIÁO DỤC VÀ ĐÀO TẠO - KỲ THI THAM KHẢO TỐT NGHIỆP THPT 2025
% Bài thi môn: TOÁN HỌC - Thời gian làm bài: 90 phút

\\section*{PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh trả lời từ câu 1 đến câu 12. Mỗi câu chỉ chọn một phương án)}

\\begin{ex}[Đề tham khảo Bộ GD&ĐT 2025]
Câu 1. Cho hàm số $y = f(x)$ liên tục trên $\\mathbb{R}$ và có bảng xét dấu đạo hàm $f'(x)$ như sau: $f'(x) > 0$ trên $(-\\infty; 1)$ và $f'(x) < 0$ trên $(1; +\\infty)$. Hàm số $y = f(x)$ đồng biến trên khoảng nào dưới đây?
\\choice
{\\True $(-\\infty; 1)$}
{$(1; +\\infty)$}
{$(0; 2)$}
{$(-\\infty; +\\infty)$}
\\loigiai{Hàm số đồng biến trên khoảng $(-\\infty; 1)$ do đạo hàm $f'(x) > 0$.}
\\end{ex}

\\begin{ex}[Chuyên Lam Sơn 2025]
Câu 2. Trong không gian $Oxyz$, cho mặt cầu $(S): (x-2)^2 + (y+1)^2 + (z-3)^2 = 25$. Tọa độ tâm $I$ và bán kính $R$ của mặt cầu $(S)$ là:
\\choice
{\\True $I(2; -1; 3), R = 5$}
{$I(-2; 1; -3), R = 5$}
{$I(2; -1; 3), R = 25$}
{$I(-2; 1; -3), R = 25$}
\\loigiai{Phương trình chính tắc $(x-a)^2 + (y-b)^2 + (z-c)^2 = R^2 \\implies I(2; -1; 3), R = \\sqrt{25} = 5$.}
\\end{ex}

\\section*{PHẦN II. Câu trắc nghiệm đúng sai (Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a, b, c, d, chọn Đúng hoặc Sai)}

\\begin{ex}[Đề thi thử THPT Quốc gia]
Câu 3. Cho hàm số bậc ba $y = f(x) = x^3 - 3x^2 + 2$ có đồ thị là $(C)$.
a) Đạo hàm của hàm số là $f'(x) = 3x^2 - 6x$. (Đúng)
b) Đồ thị hàm số có điểm cực đại là $M(0; 2)$. (Đúng)
c) Giá trị cực tiểu của hàm số bằng $-2$ đạt tại $x = 2$. (Đúng)
d) Hàm số luôn đồng biến trên toàn khoảng $(0; 2)$. (Sai)
\\loigiai{Trên khoảng $(0; 2)$, ta có $f'(x) = 3x(x - 2) < 0$ nên hàm số nghịch biến, do đó mệnh đề d là Sai.}
\\end{ex}

\\section*{PHẦN III. Câu trắc nghiệm trả lời ngắn (Thí sinh điền kết quả vào ô trống)}

Dữ kiện sau đây dùng cho Câu 4 và Câu 5:
Một doanh nghiệp sản xuất đồ thị thực nghiệm mô hình chuyển động của vật thể với gia tốc $a(t) = 3t^2 + 2t$ (m/s$^2$), vận tốc ban đầu $v(0) = 5$ m/s.

\\begin{ex}
Câu 4. Vận tốc của vật thể tại thời điểm $t = 2$ giây bằng bao nhiêu m/s?
Đáp số: 17
\\loigiai{Ta có $v(t) = \\int (3t^2 + 2t) dt = t^3 + t^2 + C$. Với $v(0) = 5 \\implies C = 5$. Suy ra $v(2) = 2^3 + 2^2 + 5 = 17$ m/s.}
\\end{ex}

\\begin{ex}
Câu 5. Quãng đường vật thể đi được trong khoảng thời gian từ $t = 0$ đến $t = 3$ giây bằng bao nhiêu mét?
Đáp số: 44
\\loigiai{Quãng đường $s = \\int_0^3 (t^3 + t^2 + 5) dt = [\\frac{t^4}{4} + \\frac{t^3}{3} + 5t]_0^3 = \\frac{81}{4} + 9 + 15 = 44.25$ mét.}
\\end{ex}`;

  // Xử lý nạp mã LaTeX mẫu
  const handleLoadSampleLatex = () => {
    setAiLatexText(SAMPLE_LATEX_BGD_EXAM);
    setAiExamTitle('Đề Thi Thử Tốt Nghiệp THPT 2025 (Mã LaTeX Chuẩn BGD)');
    setAiScanError(null);
  };

  // Xử lý dán mã nguồn LaTeX nhanh từ bộ nhớ tạm (Clipboard)
  const handlePasteClipboardToLatex = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setAiLatexText(text);
          setAiScanError(null);
          setPublishSuccessMessage(`Đã dán thành công ${text.length} ký tự mã LaTeX từ clipboard!`);
          setTimeout(() => setPublishSuccessMessage(null), 3500);
          return;
        }
      }
      setAiScanError('Không tìm thấy nội dung văn bản trong clipboard. Bạn có thể nhấn Ctrl + V vào ô văn bản bên dưới!');
    } catch {
      setAiScanError('Vui lòng click vào ô văn bản bên dưới và bấm tổ hợp phím Ctrl + V để dán mã LaTeX!');
    }
  };

  // Xử lý dán tệp hoặc dán mã LaTeX (Ctrl + V) trên toàn vùng quét đề
  const handleAiTabPaste = (e: React.ClipboardEvent) => {
    // 1. Nếu dán file từ clipboard (ví dụ copy file PDF, file .tex hoặc ảnh)
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      handleProcessPdfFile(file);
      return;
    }
    // 2. Nếu đang focus trong textarea hoặc input thông thường thì để phần tử tự xử lý
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'textarea' || targetTag === 'input') {
      return;
    }
    // 3. Nếu dán chuỗi văn bản (ví dụ copy mã LaTeX từ trang web khác)
    const text = e.clipboardData?.getData('text');
    if (text && text.trim()) {
      setAiLatexText(text);
      setAiInputMethod('latex');
      setAiScanError(null);
      setPublishSuccessMessage(`Đã dán thành công ${text.length} ký tự mã LaTeX từ clipboard và chuyển sang tab LaTeX!`);
      setTimeout(() => setPublishSuccessMessage(null), 3500);
    }
  };

  // Xử lý tải file (Hỗ trợ PDF, Word .docx/.doc, Ảnh đề thi, TEX, TXT, LaTeX)
  const handleProcessPdfFile = async (file: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
    const isDocx =
      lowerName.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isLegacyDoc = lowerName.endsWith('.doc') || file.type === 'application/msword';
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName);
    const isTexOrTxt = lowerName.endsWith('.tex') || lowerName.endsWith('.txt') || lowerName.endsWith('.latex') || file.type.startsWith('text/');

    if (!isPdf && !isDocx && !isLegacyDoc && !isImage && !isTexOrTxt) {
      setAiScanError('Vui lòng chọn tệp định dạng PDF (.pdf), Word (.docx, .doc), ảnh đề thi hoặc mã nguồn LaTeX (.tex, .txt)!');
      return;
    }

    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_SIZE) {
      setAiScanError(`Tệp quá lớn (${(file.size / (1024 * 1024)).toFixed(2)} MB). Vui lòng chọn tệp nhỏ hơn 25MB!`);
      return;
    }

    setAiScanError(null);

    // Nếu là file mã nguồn LaTeX (.tex hoặc .txt) -> đọc dạng text và chuyển sang tab LaTeX
    if (isTexOrTxt) {
      const reader = new FileReader();
      reader.onload = () => {
        const textContent = (reader.result as string) || '';
        setAiLatexText(textContent);
        setAiInputMethod('latex');
        const cleanTitle = file.name.replace(/\.(tex|txt|latex)$/i, '').replace(/[-_]/g, ' ');
        setAiExamTitle(`Đề Thi: ${cleanTitle}`);
        setPublishSuccessMessage(`Đã nạp thành công mã nguồn LaTeX từ tệp "${file.name}"!`);
        setTimeout(() => setPublishSuccessMessage(null), 3500);
      };
      reader.readAsText(file, 'UTF-8');
      return;
    }

    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    // Nếu là file Word (.docx hoặc .doc) -> kết xuất thành từng trang ảnh sắc nét & trích xuất nội dung cho Phòng Cắt Câu
    if (isDocx || isLegacyDoc) {
      setIsConvertingDocument(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => reject(new Error('Không thể đọc tệp Word.'));
          reader.readAsDataURL(file);
        });

        const cleanTitle = file.name.replace(/\.(docx|doc)$/i, '').replace(/[-_]/g, ' ');
        let pageImages: string[] = [];
        let extractedText = '';

        if (isDocx) {
          const arrayBuffer = await file.arrayBuffer();
          const { renderWordDocxToPageImages } = await import('../../lib/wordExamUtils');
          const rendered = await renderWordDocxToPageImages(arrayBuffer);
          pageImages = rendered.pageDataUrls;
          extractedText = rendered.extractedText;
        }

        // Bổ sung hoặc xử lý file .doc cũ qua server
        if (!extractedText || (isLegacyDoc && pageImages.length === 0)) {
          try {
            const resp = await fetch('/api/word/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.success && data.text) {
                extractedText = extractedText || data.text;
              }
            }
          } catch (extractErr) {
            console.warn('Không thể trích xuất nội dung Word từ máy chủ:', extractErr);
          }
        }

        if (pageImages.length === 0 && extractedText) {
          const { renderPlainTextToPageImages } = await import('../../lib/wordExamUtils');
          pageImages = await renderPlainTextToPageImages(extractedText, cleanTitle);
        }

        if (pageImages.length === 0) {
          setAiScanError('Không thể hiển thị nội dung tệp Word này. Nếu là file .doc đời cũ bị khóa định dạng, vui lòng lưu lại dưới dạng .docx hoặc .pdf rồi tải lên.');
          return;
        }

        setAiPdfFile({
          fileName: file.name,
          fileSize: sizeStr,
          fileBase64: base64,
          fileType: 'word',
          extractedText,
          pageImages,
        });
        setAiInputMethod('pdf');
        setAiExamTitle(`Đề Thi: ${cleanTitle}`);
        setCreationMode('crop_studio');
        setPublishSuccessMessage(
          `Đã nạp file Word "${file.name}" (${pageImages.length} trang) và chuyển sang Phòng Cắt Câu Đề Thi!`
        );
        setTimeout(() => setPublishSuccessMessage(null), 5000);
      } catch (err: any) {
        console.error('Lỗi khi nạp tệp Word:', err);
        setAiScanError(err?.message || 'Có lỗi xảy ra khi xử lý tệp Word. Thầy/Cô vui lòng kiểm tra lại định dạng tệp.');
      } finally {
        setIsConvertingDocument(false);
      }
      return;
    }

    // Nếu là file PDF hoặc Ảnh đề thi
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAiPdfFile({
        fileName: file.name,
        fileSize: sizeStr,
        fileBase64: base64,
        fileType: isImage ? 'image' : 'pdf',
      });
      setAiInputMethod('pdf');
      const cleanTitle = file.name.replace(/\.(pdf|png|jpe?g|webp|gif|bmp)$/i, '').replace(/[-_]/g, ' ');
      setAiExamTitle(`Đề Thi: ${cleanTitle}`);
      // Tự động chuyển ngay sang Phòng Cắt Câu Đề Thi để cắt từng câu vào đề
      setCreationMode('crop_studio');
      setPublishSuccessMessage(`Đã nạp file "${file.name}" và chuyển sang Phòng Cắt Câu Đề Thi! Thầy/Cô có thể khoanh vùng câu hỏi hoặc dùng "AI Cắt Tự Động Toàn Đề".`);
      setTimeout(() => setPublishSuccessMessage(null), 5000);
    };
    reader.readAsDataURL(file);
  };

  // Quét & Bóc tách đề thi bằng AI hoặc Bộ phân tích cú pháp LaTeX
  const handleScanExamWithAi = async () => {
    if (aiInputMethod === 'pdf' && !aiPdfFile) {
      setAiScanError('Vui lòng chọn hoặc kéo thả tệp PDF hoặc Word đề thi!');
      return;
    }
    if (aiInputMethod === 'latex' && !aiLatexText.trim()) {
      setAiScanError('Vui lòng dán mã nguồn LaTeX hoặc nhấn "Nạp Mẫu Đề LaTeX Chuẩn" để bắt đầu!');
      return;
    }

    setIsAiScanning(true);
    setAiScanError(null);
    setAiScanStatusText('Đang nạp dữ liệu đề thi và phân tích...');

    try {
      setAiScanStatusText('Đang phân tích cấu trúc 3 phần và định dạng công thức...');

      let parsed: any = null;
      let scanSource = '';

      const safeAiDuration = Math.max(1, Number(aiDuration) || 90);
      // Bước 1: Gửi yêu cầu lên Server Gemini API
      try {
        const response = await fetch('/api/gemini/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64: aiInputMethod === 'pdf' && aiPdfFile?.fileType === 'pdf' ? aiPdfFile?.fileBase64 : undefined,
            wordText: aiInputMethod === 'pdf' && aiPdfFile?.fileType === 'word' ? aiPdfFile?.extractedText : undefined,
            wordBase64: aiInputMethod === 'pdf' && aiPdfFile?.fileType === 'word' ? aiPdfFile?.fileBase64 : undefined,
            latexText: aiInputMethod === 'latex' ? aiLatexText : undefined,
            grade: aiGrade,
            durationMinutes: safeAiDuration,
            examTitle: aiExamTitle.trim() || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.parsedExam && Array.isArray(data.parsedExam.questions) && data.parsedExam.questions.length > 0) {
            parsed = data.parsedExam;
            scanSource = data.source === 'gemini' ? 'Trình Phân Tích AI' : 'Bộ Phân Tích Cú Pháp LaTeX';
          }
        }
      } catch (serverErr) {
        console.warn('Lỗi kết nối máy chủ phân tích đề thi, sử dụng bộ giải mã cục bộ:', serverErr);
      }

      // Bước 2: Dự phòng thông minh - Nếu server chưa trả về câu hỏi, chạy bộ giải mã trực tiếp trên trình duyệt
      if (!parsed || !parsed.questions || parsed.questions.length === 0) {
        const textToFallback = aiInputMethod === 'latex'
          ? (aiLatexText || '')
          : (aiPdfFile?.extractedText || aiPdfFile?.fileName || 'Đề Thi Toán THPT');
        const localParsed = parseExamFromLatexOrText(textToFallback, aiGrade, safeAiDuration, aiExamTitle || aiPdfFile?.fileName);
        if (localParsed && localParsed.questions && localParsed.questions.length > 0) {
          parsed = localParsed;
          scanSource = 'Bộ Phân Tích Cú Pháp Nội Bộ';
        }
      }

      if (!parsed || !parsed.questions || parsed.questions.length === 0) {
        throw new Error('Không thể nhận diện câu hỏi từ tệp đề thi hoặc mã LaTeX đã nhập. Vui lòng kiểm tra lại cấu trúc câu hỏi (Câu 1, \\begin{ex}, \\choice)!');
      }

      const questions: Question[] = parsed.questions;

      const createdExam: Exam = {
        id: `exam_ai_${Date.now()}`,
        title: aiExamTitle.trim() || parsed.metadata?.title || 'Đề Thi Quét AI',
        grade: (parsed.metadata?.grade || aiGrade) as 10 | 11 | 12,
        year: parsed.metadata?.year || new Date().getFullYear(),
        durationMinutes: parsed.metadata?.durationMinutes || safeAiDuration,
        totalPoints: parsed.metadata?.totalPoints || Number(questions.reduce((sum, q) => sum + (q.points || 0), 0).toFixed(2)),
        status: 'approved',
        createdBy: manualCreatedBy || currentUserName || 'Giáo viên',
        teacherId: currentUserId || undefined,
        createdById: currentUserId || undefined,
        createdByEmail: currentUserEmail || undefined,
        createdAt: new Date().toISOString(),
        questions,
        maxAttempts: aiMaxAttempts > 0 ? aiMaxAttempts : undefined,
        openTime: manualHasTimeWindow && manualOpenTime ? manualOpenTime : undefined,
        closeTime: manualHasTimeWindow && manualCloseTime ? manualCloseTime : undefined,
        distributionType: aiDistributionType,
        targetClassIds: aiDistributionType === 'repository' ? undefined : (aiTargetClassIds.length > 0 ? aiTargetClassIds : classrooms.map((c) => c.id)),
        allowViewAnswersAfterSubmit: true,
        scoreVisibility: aiScoreVisibility,
        enableScreenMonitoring: aiScreenMonitoring,
        maxInfractions: aiMaxInfractions,
      };

      setAiParsedExam(createdExam);
      setAiScanSource(scanSource || 'Đã Bóc Tách Thành Công');
      setAiScanStatusText('');
    } catch (err: any) {
      console.error('Lỗi khi quét đề thi:', err);
      setAiScanError(err.message || 'Có lỗi xảy ra khi bóc tách đề thi.');
    } finally {
      setIsAiScanning(false);
    }
  };

  // Chuyển toàn bộ câu hỏi quét được sang Trình tạo đề thủ công để giáo viên chỉnh sửa từng câu
  const handleTransferToManualEditor = () => {
    if (!aiParsedExam) return;
    setManualTitle(aiParsedExam.title);
    setManualGrade(aiParsedExam.grade);
    setManualDuration(aiParsedExam.durationMinutes);
    setManualQuestions(aiParsedExam.questions);
    setManualDistributionType(aiDistributionType);
    setManualTargetClassIds(aiTargetClassIds);
    setManualMaxAttempts(aiMaxAttempts);
    setManualScreenMonitoring(aiScreenMonitoring);
    setManualMaxInfractions(aiMaxInfractions);
    setManualScoreVisibility(aiScoreVisibility);
    setCreationMode('manual');
    setPublishSuccessMessage(`Đã chuyển ${aiParsedExam.questions.length} câu hỏi sang Trình Tạo Đề Thủ Công để chỉnh sửa chi tiết!`);
    setTimeout(() => setPublishSuccessMessage(null), 4000);
  };

  // Xuất bản trực tiếp đề thi vừa quét
  const handleDirectPublishAiExam = async () => {
    if (!aiParsedExam) return;

    const effectiveTargetIds =
      aiDistributionType === 'repository'
        ? undefined
        : aiTargetClassIds.length > 0
        ? aiTargetClassIds
        : classrooms.map((c) => c.id);

    const publishedExam: Exam = {
      ...aiParsedExam,
      teacherId: aiParsedExam.teacherId || currentUserId || undefined,
      createdById: aiParsedExam.createdById || currentUserId || undefined,
      createdByEmail: aiParsedExam.createdByEmail || currentUserEmail || undefined,
      distributionType: aiDistributionType,
      targetClassIds: effectiveTargetIds,
      maxAttempts: aiMaxAttempts > 0 ? aiMaxAttempts : undefined,
      scoreVisibility: aiScoreVisibility,
      enableScreenMonitoring: aiScreenMonitoring,
      maxInfractions: aiMaxInfractions,
    };

    if (onPublishExam) {
      await onPublishExam(publishedExam);
    }

    const targetDesc =
      aiDistributionType === 'classroom'
        ? `cho ${effectiveTargetIds?.length || 0} lớp học`
        : aiDistributionType === 'repository'
        ? 'vào Kho Đề Thi'
        : `cho ${effectiveTargetIds?.length || 0} lớp học và Kho Đề Thi`;

    setPublishSuccessMessage(`Đã xuất bản thành công đề thi "${publishedExam.title}" ${targetDesc} (${publishedExam.questions.length} câu - ${publishedExam.totalPoints} điểm)!`);
    setTimeout(() => setPublishSuccessMessage(null), 5000);
    setCreationMode('manage_exams');
  };

  // Xóa 1 câu hỏi trong danh sách preview của AI
  const handleDeleteAiQuestion = (questionId: string) => {
    if (!aiParsedExam) return;
    const remaining = aiParsedExam.questions.filter((q) => q.id !== questionId);
    // Đánh lại số thứ tự
    const renumbered = remaining.map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
    const newTotal = Number(renumbered.reduce((s, q) => s + (q.points || 0), 0).toFixed(2));
    setAiParsedExam({
      ...aiParsedExam,
      questions: renumbered,
      totalPoints: newTotal,
    });
  };

  // Mở modal để tạo câu hỏi mới
  const handleOpenAddQuestion = (partType: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq') => {
    setEditingQuestionId(null);
    setModalPart(partType);
    setModalPrompt('');
    setModalLatex('');
    setModalExplanation('');
    setModalImageAttachment(null);
    setModalOptionsAttachmentUrl(null);
    setModalPdfName(null);

    if (partType === 'part_1_mcq') {
      setModalPoints(0.25);
      setModalOptA('');
      setModalOptB('');
      setModalOptC('');
      setModalOptD('');
      setModalCorrectMcq('A');
    } else if (partType === 'part_2_true_false') {
      setModalPoints(1.0);
      setModalTfA({ text: '', isCorrect: true });
      setModalTfB({ text: '', isCorrect: false });
      setModalTfC({ text: '', isCorrect: true });
      setModalTfD({ text: '', isCorrect: false });
    } else if (partType === 'part_3_short_answer') {
      setModalPoints(0.5);
      setModalShortAnswer('');
    }

    setQuestionModalError(null);
    setShowQuestionModal(true);
  };

  // Xóa hết toàn bộ ô nhập trong modal câu hỏi
  const handleClearQuestionModalFields = () => {
    setQuestionModalError(null);
    setModalPrompt('');
    setModalLatex('');
    setModalExplanation('');
    setModalImageAttachment(null);
    setModalOptionsAttachmentUrl(null);
    setModalPdfName(null);
    if (modalPart === 'part_1_mcq') {
      setModalOptA('');
      setModalOptB('');
      setModalOptC('');
      setModalOptD('');
      setModalCorrectMcq('A');
    } else if (modalPart === 'part_2_true_false') {
      setModalTfA({ text: '', isCorrect: true });
      setModalTfB({ text: '', isCorrect: false });
      setModalTfC({ text: '', isCorrect: true });
      setModalTfD({ text: '', isCorrect: false });
    } else {
      setModalShortAnswer('');
    }
  };

  // Mở modal để chỉnh sửa câu hỏi
  const handleOpenEditQuestion = (q: Question) => {
    setQuestionModalError(null);
    const safePart = q.part;
    setEditingQuestionId(q.id);
    setModalPart(safePart);
    setModalPrompt(q.prompt);
    setModalLatex(q.latex || '');
    setModalExplanation(q.explanation || '');
    setModalPoints(q.points);
    setModalImageAttachment(q.imageAttachment || q.pdfAttachmentUrl || null);
    setModalOptionsAttachmentUrl(q.optionsAttachmentUrl || null);
    setModalPdfName(q.pdfAttachmentName || null);

    if (q.part === 'part_1_mcq') {
      setModalOptA(q.options.find((o) => o.key === 'A')?.text || '');
      setModalOptB(q.options.find((o) => o.key === 'B')?.text || '');
      setModalOptC(q.options.find((o) => o.key === 'C')?.text || '');
      setModalOptD(q.options.find((o) => o.key === 'D')?.text || '');
      setModalCorrectMcq(q.correctAnswer);
    } else if (q.part === 'part_2_true_false') {
      const a = q.items.find((i) => i.subKey === 'a');
      const b = q.items.find((i) => i.subKey === 'b');
      const c = q.items.find((i) => i.subKey === 'c');
      const d = q.items.find((i) => i.subKey === 'd');
      setModalTfA({ text: a?.text || '', isCorrect: a?.isCorrect ?? true });
      setModalTfB({ text: b?.text || '', isCorrect: b?.isCorrect ?? false });
      setModalTfC({ text: c?.text || '', isCorrect: c?.isCorrect ?? true });
      setModalTfD({ text: d?.text || '', isCorrect: d?.isCorrect ?? false });
    } else if (q.part === 'part_3_short_answer') {
      setModalShortAnswer(q.correctAnswer);
    }

    setShowQuestionModal(true);
  };

  // Xử lý dán ảnh từ clipboard (Ctrl + V)
  const handlePasteImageFromClipboard = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setModalImageAttachment(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Xử lý tải ảnh từ máy tính (Tối đa 10MB)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setQuestionModalError(null);
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setQuestionModalError('Dung lượng ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn 10MB!');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setModalImageAttachment(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Xử lý tải file PDF đính kèm (Tối đa 10MB)
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setQuestionModalError(null);
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setQuestionModalError('Dung lượng file PDF vượt quá 10MB. Vui lòng chọn file PDF nhỏ hơn 10MB!');
        return;
      }
      setModalPdfName(file.name);
    }
  };

  // Lưu câu hỏi vào danh sách (đảm bảo không còn Phần 4 tự luận)
  const handleSaveQuestion = () => {
    setQuestionModalError(null);
    if (!modalPrompt.trim() && !modalImageAttachment) {
      setQuestionModalError('Vui lòng nhập nội dung đề bài hoặc dán/đính kèm file ảnh!');
      return;
    }

    const questionNumber = editingQuestionId
      ? manualQuestions.find((q) => q.id === editingQuestionId)?.questionNumber || 1
      : manualQuestions.length + 1;

    const existingQ = editingQuestionId
      ? manualQuestions.find((q) => q.id === editingQuestionId)
      : null;

    let newQuestion: Question;

    if (modalPart === 'part_1_mcq') {
      if (!modalOptA.trim() && !modalOptB.trim() && !modalOptC.trim() && !modalOptD.trim() && !modalImageAttachment && !modalOptionsAttachmentUrl && !existingQ?.optionsAttachmentUrl) {
        setQuestionModalError('Vui lòng nhập nội dung cho các phương án A, B, C, D hoặc đính kèm ảnh cắt!');
        return;
      }

      const mergedOptions = [
        { key: 'A' as const, text: modalOptA.trim(), imageUrl: existingQ?.part === 'part_1_mcq' ? existingQ.options.find((o) => o.key === 'A')?.imageUrl : undefined },
        { key: 'B' as const, text: modalOptB.trim(), imageUrl: existingQ?.part === 'part_1_mcq' ? existingQ.options.find((o) => o.key === 'B')?.imageUrl : undefined },
        { key: 'C' as const, text: modalOptC.trim(), imageUrl: existingQ?.part === 'part_1_mcq' ? existingQ.options.find((o) => o.key === 'C')?.imageUrl : undefined },
        { key: 'D' as const, text: modalOptD.trim(), imageUrl: existingQ?.part === 'part_1_mcq' ? existingQ.options.find((o) => o.key === 'D')?.imageUrl : undefined },
      ];

      newQuestion = {
        id: editingQuestionId || `q_${Date.now()}`,
        part: 'part_1_mcq',
        questionNumber,
        prompt: modalPrompt.trim() || `Câu ${questionNumber}. Chọn một phương án đúng nhất:`,
        latex: modalLatex.trim() || undefined,
        options: mergedOptions,
        correctAnswer: modalCorrectMcq,
        explanation: modalExplanation.trim(),
        points: modalPoints || 0.25,
        imageAttachment: modalImageAttachment || existingQ?.imageAttachment || existingQ?.pdfAttachmentUrl || undefined,
        pdfAttachmentUrl: modalImageAttachment || existingQ?.pdfAttachmentUrl || existingQ?.imageAttachment || undefined,
        optionsAttachmentUrl: modalOptionsAttachmentUrl || existingQ?.optionsAttachmentUrl || undefined,
        pdfAttachmentName: modalPdfName || existingQ?.pdfAttachmentName || undefined,
      };
    } else if (modalPart === 'part_2_true_false') {
      if (!modalTfA.text.trim() && !modalTfB.text.trim() && !modalTfC.text.trim() && !modalTfD.text.trim() && !modalImageAttachment && !modalOptionsAttachmentUrl && !existingQ?.optionsAttachmentUrl) {
        setQuestionModalError('Vui lòng nhập nội dung cho 4 ý mệnh đề a, b, c, d hoặc đính kèm ảnh cắt!');
        return;
      }

      const mergedItems = [
        { id: `tf_a_${Date.now()}`, subKey: 'a' as const, text: modalTfA.text.trim(), isCorrect: modalTfA.isCorrect, imageUrl: existingQ?.part === 'part_2_true_false' ? existingQ.items.find((i) => i.subKey === 'a')?.imageUrl : undefined },
        { id: `tf_b_${Date.now()}`, subKey: 'b' as const, text: modalTfB.text.trim(), isCorrect: modalTfB.isCorrect, imageUrl: existingQ?.part === 'part_2_true_false' ? existingQ.items.find((i) => i.subKey === 'b')?.imageUrl : undefined },
        { id: `tf_c_${Date.now()}`, subKey: 'c' as const, text: modalTfC.text.trim(), isCorrect: modalTfC.isCorrect, imageUrl: existingQ?.part === 'part_2_true_false' ? existingQ.items.find((i) => i.subKey === 'c')?.imageUrl : undefined },
        { id: `tf_d_${Date.now()}`, subKey: 'd' as const, text: modalTfD.text.trim(), isCorrect: modalTfD.isCorrect, imageUrl: existingQ?.part === 'part_2_true_false' ? existingQ.items.find((i) => i.subKey === 'd')?.imageUrl : undefined },
      ];

      newQuestion = {
        id: editingQuestionId || `q_${Date.now()}`,
        part: 'part_2_true_false',
        questionNumber,
        prompt: modalPrompt.trim() || `Câu ${questionNumber}. Xét tính đúng/sai của các mệnh đề sau:`,
        latex: modalLatex.trim() || undefined,
        items: mergedItems,
        explanation: modalExplanation.trim(),
        points: modalPoints || 1.0,
        imageAttachment: modalImageAttachment || existingQ?.imageAttachment || existingQ?.pdfAttachmentUrl || undefined,
        pdfAttachmentUrl: modalImageAttachment || existingQ?.pdfAttachmentUrl || existingQ?.imageAttachment || undefined,
        optionsAttachmentUrl: modalOptionsAttachmentUrl || existingQ?.optionsAttachmentUrl || undefined,
        pdfAttachmentName: modalPdfName || existingQ?.pdfAttachmentName || undefined,
      };
    } else {
      const sanitized = modalShortAnswer.trim().replace(/\s+/g, '');
      if (!sanitized) {
        setQuestionModalError('Vui lòng nhập đáp án cho câu hỏi trả lời ngắn!');
        return;
      }
      if (sanitized.length > 4) {
        setQuestionModalError('Quy chế BGD Phần 3: Đáp án không được vượt quá 4 ký tự!');
        return;
      }
      newQuestion = {
        id: editingQuestionId || `q_${Date.now()}`,
        part: 'part_3_short_answer',
        questionNumber,
        prompt: modalPrompt.trim() || `Câu ${questionNumber}. Điền đáp số của bài toán:`,
        latex: modalLatex.trim() || undefined,
        correctAnswer: sanitized,
        explanation: modalExplanation.trim(),
        points: modalPoints || 0.5,
        imageAttachment: modalImageAttachment || existingQ?.imageAttachment || existingQ?.pdfAttachmentUrl || undefined,
        pdfAttachmentUrl: modalImageAttachment || existingQ?.pdfAttachmentUrl || existingQ?.imageAttachment || undefined,
        optionsAttachmentUrl: modalOptionsAttachmentUrl || existingQ?.optionsAttachmentUrl || undefined,
        pdfAttachmentName: modalPdfName || existingQ?.pdfAttachmentName || undefined,
      };
    }

    if (editingQuestionId) {
      setManualQuestions((prev) => prev.map((q) => (q.id === editingQuestionId ? newQuestion : q)));
    } else {
      setManualQuestions((prev) => [...prev, newQuestion]);
    }

    setQuestionModalError(null);
    setShowQuestionModal(false);
  };

  // Xác nhận xóa 1 câu hỏi
  const handleConfirmDeleteQuestion = () => {
    if (!questionToDelete) return;
    const qNum = questionToDelete.questionNumber;
    const updated = manualQuestions.filter((q) => q.id !== questionToDelete.id);
    const renumbered = updated.map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
    setManualQuestions(renumbered);
    setQuestionToDelete(null);
    setPublishSuccessMessage(`Đã xóa câu hỏi số ${qNum} thành công.`);
    setTimeout(() => setPublishSuccessMessage(null), 3000);
  };

  // Xác nhận xóa vĩnh viễn đề thi và TOÀN BỘ dữ liệu liên quan (Bài nộp, Bảng điểm, Cheat Logs, Giao đề)
  const handleConfirmDeleteExam = async () => {
    if (!examToDelete) return;
    setIsDeletingExam(true);
    try {
      if (onDeleteExam) {
        await onDeleteExam(examToDelete.id);
      }
      setPublishSuccessMessage(`Đã xóa vĩnh viễn đề thi "${examToDelete.title}" cùng toàn bộ kết quả nộp bài của học sinh!`);
      setTimeout(() => setPublishSuccessMessage(null), 4000);
      setExamToDelete(null);
    } catch (err) {
      console.error('Lỗi khi xóa đề thi:', err);
    } finally {
      setIsDeletingExam(false);
    }
  };

  // Mở modal giao đề thi cho các nhóm lớp
  const handleOpenAssignModal = (exam: Exam) => {
    setExamToAssign(exam);
    setAssignTargetClassIds(exam.targetClassIds || classrooms.map((c) => c.id));
    setAssignDistributionType(exam.distributionType || 'classroom');
    setAssignMaxAttempts(exam.maxAttempts ?? 1);
    setAssignHasTimeWindow(Boolean(exam.openTime || exam.closeTime));
    setAssignOpenTime(exam.openTime || new Date(Date.now() - 3600 * 1000).toISOString().slice(0, 16));
    setAssignCloseTime(exam.closeTime || new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 16));
    setAssignScreenMonitoring(exam.enableScreenMonitoring !== false);
    setAssignMaxInfractions(exam.maxInfractions || 3);
    setAssignScoreVisibility(exam.scoreVisibility || 'immediate');
  };

  // Xác nhận lưu giao đề thi cho các nhóm lớp
  const handleConfirmAssignExam = async () => {
    if (!examToAssign) return;
    setIsSavingAssignment(true);
    try {
      if (onAssignExamToClasses) {
        await onAssignExamToClasses(
          examToAssign.id,
          assignDistributionType === 'repository' ? [] : assignTargetClassIds,
          assignDistributionType,
          assignMaxAttempts,
          assignHasTimeWindow ? assignOpenTime : undefined,
          assignHasTimeWindow ? assignCloseTime : undefined,
          assignScreenMonitoring,
          assignMaxInfractions,
          assignScoreVisibility
        );
      }
      setPublishSuccessMessage(`Đã cập nhật giao đề thi "${examToAssign.title}" cho các nhóm lớp thành công!`);
      setTimeout(() => setPublishSuccessMessage(null), 4000);
      setExamToAssign(null);
    } catch (err) {
      console.error('Lỗi khi giao đề:', err);
    } finally {
      setIsSavingAssignment(false);
    }
  };

  // Tự động phân bổ lại điểm số chuẩn 10.0đ của Bộ GD&ĐT
  const handleAutoNormalizePoints = () => {
    const updated = manualQuestions.map((q) => {
      if (q.part === 'part_1_mcq') return { ...q, points: 0.25 };
      if (q.part === 'part_2_true_false') return { ...q, points: 1.0 };
      return { ...q, points: 0.5 };
    });
    setManualQuestions(updated);
    setPublishSuccessMessage('Đã phân bổ lại điểm số chuẩn Bộ GD: Phần 1 (0.25đ), Phần 2 (1.0đ), Phần 3 (0.5đ)!');
    setTimeout(() => setPublishSuccessMessage(null), 3000);
  };

  // Bấm nút Xuất bản -> Kiểm tra hợp lệ và Mở hộp thoại thông báo xác nhận
  const handleRequestPublishExam = () => {
    setManualValidationErrors([]);
    const errors: string[] = [];

    if (manualQuestions.length === 0) {
      errors.push('Đề thi chưa có câu hỏi nào. Vui lòng thêm ít nhất 1 câu hỏi vào đề thi trước khi xuất bản!');
    }
    if (!manualDuration || manualDuration < 1) {
      errors.push('Thời lượng làm bài phải từ 1 phút trở lên!');
    }

    if (errors.length > 0) {
      setManualValidationErrors(errors);
      return;
    }

    // Tự động phân bổ nhóm lớp nếu giáo viên chưa chọn riêng
    if (manualDistributionType !== 'repository' && manualTargetClassIds.length === 0) {
      if (classrooms.length > 0) {
        setManualTargetClassIds(classrooms.map((c) => c.id));
      } else {
        setManualDistributionType('repository');
      }
    }

    // Mở bước xác nhận xuất bản
    setShowPublishConfirmModal(true);
  };

  // Xác nhận xuất bản chính thức trong modal
  const handleConfirmPublishExam = async () => {
    const calculatedTotalPoints = Number(dynamicTotalPoints.toFixed(2));
    const safeManualDuration = Math.max(1, Number(manualDuration) || 90);
    const effectiveTargetIds =
      manualDistributionType !== 'repository'
        ? manualTargetClassIds.length > 0
          ? manualTargetClassIds
          : classrooms.map((c) => c.id)
        : undefined;

    const newExam: Exam = {
      id: `exam_manual_${Date.now()}`,
      title: manualTitle.trim() || 'Đề Thi Toán Mới',
      grade: manualGrade,
      year: manualYear,
      durationMinutes: safeManualDuration,
      totalPoints: calculatedTotalPoints,
      status: 'approved',
      createdBy: manualCreatedBy,
      teacherId: currentUserId || undefined,
      createdById: currentUserId || undefined,
      createdByEmail: currentUserEmail || undefined,
      createdAt: new Date().toISOString(),
      questions: manualQuestions,
      maxAttempts: manualMaxAttempts > 0 ? manualMaxAttempts : undefined,
      openTime: manualHasTimeWindow && manualOpenTime ? manualOpenTime : undefined,
      closeTime: manualHasTimeWindow && manualCloseTime ? manualCloseTime : undefined,
      distributionType: manualDistributionType,
      targetClassIds: effectiveTargetIds,
      allowViewAnswersAfterSubmit: manualAllowViewAnswers,
      scoreVisibility: manualScoreVisibility,
      enableScreenMonitoring: manualScreenMonitoring,
      maxInfractions: manualMaxInfractions,
    };

    if (onPublishExam) {
      await onPublishExam(newExam);
    }

    setShowPublishConfirmModal(false);

    const targetDesc =
      manualDistributionType === 'classroom'
        ? `cho ${effectiveTargetIds?.length || 0} nhóm lớp`
        : manualDistributionType === 'repository'
        ? 'vào Kho đề cá nhân'
        : 'cho các nhóm lớp và Kho đề cá nhân';

    setPublishSuccessMessage(
      `Đã xuất bản thành công "${newExam.title}" với tổng ${calculatedTotalPoints} điểm (${targetDesc})!`
    );
    setTimeout(() => setPublishSuccessMessage(null), 5000);
  };

  const partCounts = {
    part1: manualQuestions.filter((q) => q.part === 'part_1_mcq').length,
    part2: manualQuestions.filter((q) => q.part === 'part_2_true_false').length,
    part3: manualQuestions.filter((q) => q.part === 'part_3_short_answer').length,
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">
            Cổng Soạn Đề Thi Giáo Viên
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Biên Soạn & Xuất Bản Đề Thi THPT
          </h1>
        </div>

        {/* Chế độ tạo đề */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-full md:w-auto flex-wrap gap-1">
          <button
            onClick={() => setCreationMode('manual')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              creationMode === 'manual' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit2 size={15} />
            <span>Tự Tạo Đề Thủ Công</span>
          </button>
          <button
            onClick={() => setCreationMode('ai_pdf')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              creationMode === 'ai_pdf' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileUp size={15} />
            <span>Tải File Đề (PDF/Word)</span>
          </button>
          <button
            onClick={() => setCreationMode('crop_studio')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              creationMode === 'crop_studio' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scissors size={15} />
            <span>Phòng Cắt Câu Đề Thi</span>
            {aiPdfFile && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse ml-0.5"></span>
            )}
          </button>
          <button
            onClick={() => setCreationMode('manage_exams')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              creationMode === 'manage_exams' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={15} />
            <span>Kho Đề Thi ({examsList.length})</span>
          </button>
        </div>
      </div>

      {/* Thông báo xuất bản thành công */}
      {publishSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={18} />
          <span>{publishSuccessMessage}</span>
        </div>
      )}

      {/* Thông báo lỗi validation */}
      {manualValidationErrors.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle size={16} />
            <span>Vui lòng kiểm tra lại cấu hình đề thi:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            {manualValidationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: TỰ TẠO ĐỀ THI THỦ CÔNG                                            */}
      {/* ========================================================================= */}
      {creationMode === 'manual' && (
        <div className="space-y-6">
          {/* Metadata & Advanced Exam Settings Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <SlidersHorizontal size={18} className="text-blue-600" />
                <span>Cấu Hình Đề Thi & Quản Lý Phân Phối</span>
              </div>
              <span className="text-xs text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full">
                Tổng Điểm: {dynamicTotalPoints.toFixed(2)} điểm
              </span>
            </div>

            {/* Hàng 1: Tên đề thi & Giáo viên biên soạn */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
              <div className="md:col-span-7 space-y-1">
                <label className="font-bold text-slate-700">Tên Đề Thi *</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Nhập tên đề thi (VD: Đề khảo sát chất lượng, Đề thi học kỳ...)"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 font-semibold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-5 space-y-1">
                <label className="font-bold text-slate-700">Giáo Viên / Tổ Bộ Môn Biên Soạn</label>
                <input
                  type="text"
                  value={manualCreatedBy}
                  onChange={(e) => setManualCreatedBy(e.target.value)}
                  placeholder="Nhập tên giáo viên hoặc tổ bộ môn..."
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 font-semibold focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Hàng 2: Khối lớp, năm học, thời lượng, số lượt làm bài */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Khối Lớp</label>
                <select
                  value={manualGrade}
                  onChange={(e) => setManualGrade(Number(e.target.value) as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value={12}>Lớp 12</option>
                  <option value={11}>Lớp 11</option>
                  <option value={10}>Lớp 10</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Năm Học</label>
                <input
                  type="number"
                  value={manualYear}
                  onChange={(e) => setManualYear(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Thời Lượng (phút)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={manualDuration > 0 ? manualDuration : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setManualDuration(0);
                        return;
                      }
                      const num = Math.min(600, Math.max(0, parseInt(val, 10) || 0));
                      setManualDuration(num);
                    }}
                    onBlur={() => {
                      if (!manualDuration || manualDuration < 1) {
                        setManualDuration(90);
                      }
                    }}
                    placeholder="VD: 45, 90..."
                    className="w-full h-10 pl-3 pr-12 rounded-xl border border-slate-300 font-semibold bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
                    phút
                  </span>
                </div>
              </div>

              {/* 1. GIỚI HẠN SỐ LƯỢT LÀM BÀI */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Số Lượt Làm Bài</label>
                <select
                  value={manualMaxAttempts}
                  onChange={(e) => setManualMaxAttempts(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value={0}>Không giới hạn</option>
                  <option value={1}>1 lượt (Thi chính thức)</option>
                  <option value={2}>2 lượt</option>
                  <option value={3}>3 lượt</option>
                </select>
              </div>
            </div>

            {/* Hàng 2: 2. THỜI GIAN MỞ VÀ ĐÓNG ĐỀ THI */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualHasTimeWindow}
                    onChange={(e) => setManualHasTimeWindow(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <Calendar size={15} className="text-blue-600" />
                  <span>Kích hoạt khung thời gian mở và đóng đề thi</span>
                </label>
                {manualHasTimeWindow && (
                  <span className="text-[11px] text-slate-500">
                    Học sinh chỉ được vào phòng thi trong khoảng thời gian này
                  </span>
                )}
              </div>

              {manualHasTimeWindow && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Thời Gian Mở Đề:</label>
                    <input
                      type="datetime-local"
                      value={manualOpenTime}
                      onChange={(e) => setManualOpenTime(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Thời Gian Đóng Đề:</label>
                    <input
                      type="datetime-local"
                      value={manualCloseTime}
                      onChange={(e) => setManualCloseTime(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hàng 3: 3. GIAO ĐỀ CHO NHÓM LỚP HOẶC CHO ĐỀ VÀO KHO TỔNG HỢP */}
            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-3 text-xs">
              <span className="font-bold text-blue-900 block">Hình thức phân phối đề thi:</span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setManualDistributionType('classroom')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    manualDistributionType === 'classroom'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Users size={14} />
                  <span>Giao Cho Nhóm Lớp Cụ Thể</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManualDistributionType('repository')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    manualDistributionType === 'repository'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>Kho Đề Cá Nhân (Chưa Giao Lớp)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManualDistributionType('both')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    manualDistributionType === 'both'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Sparkles size={14} />
                  <span>Cả Lớp & Kho Cá Nhân</span>
                </button>
              </div>

              {/* Danh sách nhóm lớp được giao */}
              {manualDistributionType !== 'repository' && (
                <div className="pt-2 border-t border-blue-200/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Đánh dấu các nhóm lớp nhận đề thi này:
                    </span>
                    {classrooms.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setManualTargetClassIds(classrooms.map((c) => c.id))}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline"
                        >
                          Chọn tất cả ({classrooms.length})
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => setManualTargetClassIds([])}
                          className="text-[11px] text-slate-500 hover:text-slate-700 font-bold hover:underline"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    )}
                  </div>

                  {classrooms.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs">
                      Chưa có nhóm lớp nào trên hệ thống. Đề thi sẽ được lưu vào <strong>Kho Đề Thi</strong>.
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {classrooms.map((cls) => (
                        <label
                          key={cls.id}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold cursor-pointer hover:border-blue-300 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={manualTargetClassIds.includes(cls.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setManualTargetClassIds((prev) => [...prev, cls.id]);
                              } else {
                                setManualTargetClassIds((prev) => prev.filter((id) => id !== cls.id));
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{cls.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({cls.code})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hàng 4: 4. BẬT/TẮT XEM ĐÁP ÁN & CHẾ ĐỘ HIỂN THỊ ĐIỂM KHI LÀM XONG */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualAllowViewAnswers}
                  onChange={(e) => setManualAllowViewAnswers(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <Eye size={16} className="text-blue-600" />
                <span>Cho phép học sinh xem đáp án & lời giải chi tiết sau khi nộp bài</span>
              </label>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${manualAllowViewAnswers ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                {manualAllowViewAnswers ? 'Đang Bật' : 'Đang Tắt'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 block">Chế độ cho học sinh biết điểm sau khi nộp bài</span>
                  <span className="text-[11px] text-slate-500">
                    {manualScoreVisibility === 'immediate'
                      ? 'Học sinh xem được tổng điểm và điểm từng phần ngay sau khi nộp bài.'
                      : manualScoreVisibility === 'after_close'
                      ? 'Điểm sẽ tạm ẩn, chỉ hiển thị sau khi hết giờ đóng đề hoặc giáo viên bấm công bố.'
                      : 'Ẩn hoàn toàn điểm số với học sinh (chỉ giáo viên xem được trong Bảng Điểm).'}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg self-start sm:self-auto ${
                    manualScoreVisibility === 'hidden'
                      ? 'bg-rose-100 text-rose-800'
                      : manualScoreVisibility === 'after_close'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {getExamScoreVisibilityLabel(manualScoreVisibility)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { mode: 'immediate', label: 'Biết điểm ngay (Trước)', desc: 'Hiện ngay sau khi nộp' },
                    { mode: 'after_close', label: 'Biết điểm sau', desc: 'Sau khi đóng đề / GV mở' },
                    { mode: 'hidden', label: 'Không cho biết điểm', desc: 'Ẩn hoàn toàn với HS' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setManualScoreVisibility(opt.mode)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      manualScoreVisibility === opt.mode
                        ? opt.mode === 'hidden'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : opt.mode === 'after_close'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs block">{opt.label}</span>
                    <span className={`text-[10px] block mt-0.5 ${manualScoreVisibility === opt.mode ? 'text-white/90' : 'text-slate-500'}`}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hàng 5: Ô KIỂM SOÁT MÀN HÌNH & CHỐNG GIAN LẬN */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border-2 border-indigo-200/80 space-y-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2.5 font-bold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualScreenMonitoring}
                    onChange={(e) => setManualScreenMonitoring(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldAlert size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-black text-indigo-950 block">Ô Kiểm Soát Màn Hình & Chống Gian Lận</span>
                    <span className="text-[11px] font-normal text-indigo-800">
                      Bắt buộc toàn màn hình, giám sát chuyển tab và ghi nhật ký vi phạm
                    </span>
                  </div>
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    manualScreenMonitoring ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {manualScreenMonitoring ? 'ĐANG BẬT GIÁM SÁT' : 'LUYỆN TẬP TỰ DO'}
                  </span>
                </div>
              </div>

              {manualScreenMonitoring && (
                <div className="pt-2 border-t border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-semibold text-[11px]">
                    <Monitor size={14} className="text-indigo-600 shrink-0" />
                    <span>Số lần rời màn hình tối đa trước khi tự động nộp bài:</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[1, 2, 3, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setManualMaxInfractions(cnt)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                          manualMaxInfractions === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-105'
                            : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {cnt} lần
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Statistics Bar: Chỉ hiển thị 3 phần (Phần 4 tự luận đã xóa) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold block uppercase">Tổng Câu Hỏi</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                {manualQuestions.length}
              </span>
              <span className="text-[11px] text-blue-600 font-bold">
                {dynamicTotalPoints.toFixed(2)} điểm
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center shadow-xs">
              <span className="text-[11px] text-blue-700 font-semibold block uppercase">Phần 1: MCQ (4 chọn 1)</span>
              <span className="text-2xl font-black text-blue-900 font-mono mt-0.5 block">
                {partCounts.part1}
              </span>
              <span className="text-[10px] text-blue-600 font-bold">4 phương án</span>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-center shadow-xs">
              <span className="text-[11px] text-purple-700 font-semibold block uppercase">Phần 2: Đúng / Sai</span>
              <span className="text-2xl font-black text-purple-900 font-mono mt-0.5 block">
                {partCounts.part2}
              </span>
              <span className="text-[10px] text-purple-600 font-bold">4 ý độc lập</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center shadow-xs">
              <span className="text-[11px] text-amber-700 font-semibold block uppercase">Phần 3: Trả Lời Ngắn</span>
              <span className="text-2xl font-black text-amber-900 font-mono mt-0.5 block">
                {partCounts.part3}
              </span>
              <span className="text-[10px] text-amber-600 font-bold">≤ 4 ký tự</span>
            </div>
          </div>

          {/* Quick Action Strip (Bỏ Phần 4 Tự Luận) */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Thêm câu hỏi:</span>
              <button
                onClick={() => handleOpenAddQuestion('part_1_mcq')}
                className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>+ Phần 1 (MCQ)</span>
              </button>
              <button
                onClick={() => handleOpenAddQuestion('part_2_true_false')}
                className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>+ Phần 2 (Đúng/Sai)</span>
              </button>
              <button
                onClick={() => handleOpenAddQuestion('part_3_short_answer')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>+ Phần 3 (Trả lời ngắn)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center gap-1.5"
                title="Xóa toàn bộ câu hỏi để làm lại từ đầu"
              >
                <Trash2 size={14} />
                <span>Xóa Hết Câu Hỏi</span>
              </button>

              <button
                type="button"
                onClick={handleAutoNormalizePoints}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
              >
                Chuẩn Hóa Điểm Bộ GD
              </button>

              <button
                onClick={handleRequestPublishExam}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 size={16} />
                <span>Xuất Bản Đề Thi ({dynamicTotalPoints.toFixed(2)}đ)</span>
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {manualQuestions.length === 0 ? (
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                  <FileText size={28} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-base text-slate-900">
                    Chưa có câu hỏi nào trong đề thi
                  </h4>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddQuestion('part_1_mcq')}
                    className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>+ Phần 1: Trắc Nghiệm 4 Chọn 1 (0.25đ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddQuestion('part_2_true_false')}
                    className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>+ Phần 2: Đúng / Sai 4 Ý (1.0đ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddQuestion('part_3_short_answer')}
                    className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>+ Phần 3: Trả Lời Ngắn (0.5đ)</span>
                  </button>
                </div>
              </div>
            ) : (
              manualQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs relative"
                >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        q.part === 'part_1_mcq'
                          ? 'bg-blue-100 text-blue-700'
                          : q.part === 'part_2_true_false'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {q.part === 'part_1_mcq'
                        ? 'Phần 1: Trắc Nghiệm'
                        : q.part === 'part_2_true_false'
                        ? 'Phần 2: Đúng / Sai'
                        : 'Phần 3: Trả Lời Ngắn'}
                    </span>
                    <span className="text-slate-400 font-mono">({q.points} điểm)</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditQuestion(q)}
                      title="Sửa câu hỏi"
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() =>
                        setQuestionToDelete({ id: q.id, questionNumber: idx + 1, prompt: q.prompt })
                      }
                      title="Xóa câu hỏi"
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="font-bold text-slate-900 text-sm leading-relaxed">
                  <MathView math={q.prompt} />
                </div>

                {/* Công thức LaTeX nếu có */}
                {q.latex && (
                  <div className="p-3 bg-slate-50 rounded-xl overflow-x-auto">
                    <MathView latex={q.latex} block />
                  </div>
                )}

                {/* File ảnh đề bài đính kèm / cắt từ PDF */}
                {(q.pdfAttachmentUrl || q.imageAttachment) && (
                  <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full">
                    <ExamImage
                      src={q.pdfAttachmentUrl || q.imageAttachment}
                      alt="Ảnh đính kèm đề bài"
                      className="max-h-48 max-w-full w-auto rounded-xl object-contain bg-white"
                    />
                  </div>
                )}

                {/* Khối đáp án cắt cả khối */}
                {q.optionsAttachmentUrl && (
                  <div className="p-2 bg-teal-50 rounded-2xl border border-teal-200 inline-block max-w-full">
                    <ExamImage
                      src={q.optionsAttachmentUrl}
                      alt="Khối đáp án đã cắt"
                      className="max-h-44 max-w-full w-auto rounded-xl object-contain bg-white"
                    />
                  </div>
                )}

                {/* Tên file PDF đính kèm nếu có */}
                {q.pdfAttachmentName && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-xs">
                    <Paperclip size={13} />
                    <span>Tài liệu đính kèm: {q.pdfAttachmentName}</span>
                  </div>
                )}

                {/* Render Options for Part 1 */}
                {q.part === 'part_1_mcq' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt) => (
                      <div
                        key={opt.key}
                        className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
                          opt.key === q.correctAnswer
                            ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-white border border-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {opt.key}
                          </span>
                          {opt.text && (
                            <div className="flex-1 min-w-0 text-xs">
                              <MathView math={opt.text} />
                            </div>
                          )}
                        </div>
                        {opt.imageUrl && (
                          <div className="rounded border border-slate-200 bg-white p-1">
                            <ExamImage src={opt.imageUrl} alt={`Đáp án ${opt.key}`} className="max-h-20 max-w-full w-auto object-contain mx-auto" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Render Items for Part 2 */}
                {q.part === 'part_2_true_false' && (
                  <div className="space-y-1.5 pt-1">
                    {q.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0 text-xs">
                            <span className="font-bold text-purple-700 shrink-0">{item.subKey})</span>
                            {item.text && (
                              <div className="flex-1 min-w-0">
                                <MathView math={item.text} />
                              </div>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                              item.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.isCorrect ? 'ĐÚNG' : 'SAI'}
                          </span>
                        </div>
                        {item.imageUrl && (
                          <div className="rounded border border-slate-200 bg-white p-1">
                            <ExamImage src={item.imageUrl} alt={`Ý ${item.subKey}`} className="max-h-20 max-w-full w-auto object-contain mx-auto" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Render Answer for Part 3 */}
                {q.part === 'part_3_short_answer' && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                    <span className="font-bold text-amber-900 text-xs">Đáp án ngắn:</span>
                    <span className="font-mono font-black text-amber-800 text-sm bg-white px-3 py-1 rounded-lg border border-amber-300">
                      {q.correctAnswer}
                    </span>
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                    <span className="font-bold text-slate-700">Lời giải chi tiết: </span>
                    <MathView math={q.explanation} />
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: QUÉT ĐỀ BẰNG TỆP PDF HOẶC DÙNG NGÔN NGỮ LATEX BẰNG AI            */}
      {/* ========================================================================= */}
      {creationMode === 'ai_pdf' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Hộp cấu hình Nguồn Đề Thi & Bộ Bóc Tách */}
          <div
            onPaste={handleAiTabPaste}
            className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-blue-600" />
                  <span>Quét & Nhận Diện Đề Thi Tự Động (AI Vision & LaTeX)</span>
                </h3>
              </div>

              {/* Chuyển đổi phương thức: File PDF hoặc Mã LaTeX */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAiInputMethod('pdf')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    aiInputMethod === 'pdf' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileUp size={14} />
                  <span>File PDF / Word / LaTeX</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiInputMethod('latex')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    aiInputMethod === 'latex' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 size={14} />
                  <span>Mã LaTeX</span>
                </button>
              </div>
            </div>

            {/* VÙNG NHẬP 1: TẢI FILE PDF, WORD HOẶC LATEX (HỖ TRỢ DRAG & DROP & PASTE) */}
            {aiInputMethod === 'pdf' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Tệp tài liệu đề thi PDF, Word hoặc Mã nguồn LaTeX *</span>
                  <span className="text-[11px] font-normal text-slate-400">Định dạng .pdf, .docx, .doc, .tex, .txt (Tối đa 25MB)</span>
                </label>

                {!aiPdfFile ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleProcessPdfFile(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => !isConvertingDocument && pdfExamInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                      isDraggingPdf
                        ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                        : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={pdfExamInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.tex,.txt,.latex,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleProcessPdfFile(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                      {isConvertingDocument ? <Loader2 size={28} className="animate-spin" /> : <FileUp size={28} />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">
                        {isConvertingDocument
                          ? 'Đang chuyển đổi tài liệu Word sang từng trang cắt câu hỏi...'
                          : 'Kéo thả file PDF, Word (.docx, .doc) hoặc mã nguồn LaTeX vào đây'}
                      </h4>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                          aiPdfFile.fileType === 'word'
                            ? 'bg-indigo-100 text-indigo-700'
                            : aiPdfFile.fileType === 'image'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-600'
                        }`}
                      >
                        {aiPdfFile.fileType === 'word' ? 'WORD' : aiPdfFile.fileType === 'image' ? 'ẢNH' : 'PDF'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-slate-900 truncate">
                          {aiPdfFile.fileName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Dung lượng: {aiPdfFile.fileSize}
                          {aiPdfFile.pageImages && aiPdfFile.pageImages.length > 0 ? ` · ${aiPdfFile.pageImages.length} trang` : ''} · Đã nạp thành công
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCreationMode('crop_studio')}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <Scissors size={14} />
                        <span>Mở Phòng Cắt Câu</span>
                      </button>
                      <button
                        type="button"
                        disabled={isConvertingDocument}
                        onClick={() => pdfExamInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {isConvertingDocument ? 'Đang xử lý...' : 'Đổi Tệp Khác'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAiPdfFile(null);
                          if (pdfExamInputRef.current) pdfExamInputRef.current.value = '';
                        }}
                        className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-100 transition-colors"
                        title="Xóa tệp này"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <input
                      ref={pdfExamInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.tex,.txt,.latex,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleProcessPdfFile(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* VÙNG NHẬP 2: NHẬP MÃ NGUỒN LATEX */}
            {aiInputMethod === 'latex' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Code2 size={15} className="text-indigo-600" />
                    <span>Mã nguồn LaTeX của đề thi (hỗ trợ \begin&#123;ex&#125;, \choice, $...$) *</span>
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePasteClipboardToLatex}
                      className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Dán nhanh mã LaTeX từ bộ nhớ tạm (Clipboard)"
                    >
                      <ClipboardPaste size={13} className="text-indigo-600" />
                      <span>Dán Từ Bộ Nhớ Tạm</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSampleLatex}
                      className="px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Sparkles size={13} className="text-amber-600" />
                      <span>Nạp Mã LaTeX Mẫu BGD 2025</span>
                    </button>
                    {aiLatexText && (
                      <button
                        type="button"
                        onClick={() => setAiLatexText('')}
                        className="px-2.5 py-1 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                      >
                        Xóa Trắng
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={12}
                    value={aiLatexText}
                    onChange={(e) => setAiLatexText(e.target.value)}
                    placeholder={`% Dán mã nguồn LaTeX đề thi của bạn vào đây. Ví dụ:\n\\section*{PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn}\n\\begin{ex}\nCâu 1. Cho hàm số $y = f(x)$ đồng biến trên khoảng nào?\n\\choice\n{\\True $(-\\infty; 1)$}\n{$(1; 3)$}\n{$(3; +\\infty)$}\n{$(0; 2)$}\n\\end{ex}`}
                    className="w-full p-4 rounded-2xl border border-slate-300 font-mono text-xs text-slate-800 bg-slate-900/5 focus:bg-white focus:border-blue-600 focus:outline-none leading-relaxed transition-all"
                  />
                </div>
              </div>
            )}

            {/* CẤU HÌNH THÔNG SỐ ĐỀ THI QUÉT ĐƯỢC */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs pt-2 border-t border-slate-100">
              <div className="md:col-span-6 space-y-1">
                <label className="font-bold text-slate-700">Tên Đề Thi *</label>
                <input
                  type="text"
                  value={aiExamTitle}
                  onChange={(e) => setAiExamTitle(e.target.value)}
                  placeholder="Nhập tên đề thi hiển thị..."
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 font-semibold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700">Khối Lớp *</label>
                <select
                  value={aiGrade}
                  onChange={(e) => setAiGrade(Number(e.target.value) as 10 | 11 | 12)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-bold focus:border-blue-600 focus:outline-none bg-white cursor-pointer"
                >
                  <option value={10}>Lớp 10 (Chương trình mới)</option>
                  <option value={11}>Lớp 11 (Chương trình mới)</option>
                  <option value={12}>Lớp 12 (Tốt Nghiệp THPT)</option>
                </select>
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="font-bold text-slate-700">Thời Gian Làm Bài *</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={aiDuration > 0 ? aiDuration : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setAiDuration(0);
                        return;
                      }
                      const num = Math.min(600, Math.max(0, parseInt(val, 10) || 0));
                      setAiDuration(num);
                    }}
                    onBlur={() => {
                      if (!aiDuration || aiDuration < 1) {
                        setAiDuration(90);
                      }
                    }}
                    placeholder="VD: 45, 90..."
                    className="w-full h-10 pl-3 pr-12 rounded-xl border border-slate-300 font-bold bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
                    phút
                  </span>
                </div>
              </div>
            </div>

            {/* Ô KIỂM SOÁT MÀN HÌNH & CHỐNG GIAN LẬN (QUÉT ĐỀ) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border-2 border-indigo-200/80 space-y-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2.5 font-bold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiScreenMonitoring}
                    onChange={(e) => setAiScreenMonitoring(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldAlert size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-black text-indigo-950 block">Ô Kiểm Soát Màn Hình & Chống Gian Lận</span>
                    <span className="text-[11px] font-normal text-indigo-800">
                      Bắt buộc toàn màn hình, giám sát chuyển tab và ghi nhật ký vi phạm
                    </span>
                  </div>
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    aiScreenMonitoring ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {aiScreenMonitoring ? 'ĐANG BẬT GIÁM SÁT' : 'LUYỆN TẬP TỰ DO'}
                  </span>
                </div>
              </div>

              {aiScreenMonitoring && (
                <div className="pt-2 border-t border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-semibold text-[11px]">
                    <Monitor size={14} className="text-indigo-600 shrink-0" />
                    <span>Số lần rời màn hình tối đa trước khi tự động nộp bài:</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[1, 2, 3, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setAiMaxInfractions(cnt)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                          aiMaxInfractions === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-105'
                            : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {cnt} lần
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* THÔNG BÁO LỖI NẾU CÓ */}
            {aiScanError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle size={18} className="shrink-0 text-rose-600" />
                <span>{aiScanError}</span>
              </div>
            )}

            {/* TRẠNG THÁI ĐANG QUÉT */}
            {isAiScanning && (
              <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs space-y-2 animate-pulse">
                <div className="font-bold flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  <span>Đang phân tích nội dung đề thi...</span>
                </div>
                <p className="text-slate-600 text-[11px]">{aiScanStatusText}</p>
              </div>
            )}

            {/* NÚT THỰC THI QUÉT ĐỀ */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isAiScanning}
                onClick={handleScanExamWithAi}
                className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                  isAiScanning
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 hover:scale-[1.01]'
                }`}
              >
                {isAiScanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang Phân Tích Đề Thi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Quét & Bóc Tách Đề Bằng AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* HIỂN THỊ KẾT QUẢ ĐÃ BÓC TÁCH & XEM TRƯỚC BỘ CÂU HỎI                       */}
          {/* ========================================================================= */}
          {aiParsedExam && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-300">
              {/* Thanh tiêu đề kết quả */}
              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white shadow-xs">
                      {aiScanSource || 'Đã Bóc Tách Thành Công'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-emerald-800 border border-emerald-200">
                      Khối {aiParsedExam.grade} · {aiParsedExam.durationMinutes} phút
                    </span>
                  </div>
                  <h4 className="font-black text-base sm:text-lg text-emerald-950">
                    {aiParsedExam.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold flex-wrap">
                    <span>Tổng: <strong>{aiParsedExam.questions.length} câu</strong></span>
                    <span>·</span>
                    <span>Phần I: <strong>{aiParsedExam.questions.filter(q => q.part === 'part_1_mcq').length} câu</strong></span>
                    <span>·</span>
                    <span>Phần II: <strong>{aiParsedExam.questions.filter(q => q.part === 'part_2_true_false').length} câu</strong></span>
                    <span>·</span>
                    <span>Phần III: <strong>{aiParsedExam.questions.filter(q => q.part === 'part_3_short_answer').length} câu</strong></span>
                    <span>·</span>
                    <span className="font-mono text-emerald-900 font-extrabold text-sm">
                      Tổng điểm: {aiParsedExam.totalPoints.toFixed(2)}đ
                    </span>
                  </div>
                </div>

                {/* Các nút hành động chính */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleTransferToManualEditor}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    title="Chuyển sang trình tạo đề thủ công để thêm, sửa, xóa chi tiết từng câu"
                  >
                    <Edit2 size={14} />
                    <span>Chỉnh Sửa Chi Tiết</span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectPublishAiExam}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    title="Xuất bản đề thi trực tiếp vào hệ thống"
                  >
                    <CheckCircle2 size={15} />
                    <span>Xuất Bản Ngay</span>
                  </button>
                </div>
              </div>

              {/* HỘP CẤU HÌNH PHÂN PHỐI & LƯU TRỮ ĐỀ THI */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <SlidersHorizontal size={16} className="text-blue-600" />
                    <span>Cấu Hình Nơi Lưu Trữ & Phân Phối Đề Thi</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Chọn nơi lưu để học sinh có thể truy cập làm bài
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Phạm vi phân phối */}
                  <div className="md:col-span-8 space-y-2">
                    <label className="font-bold text-slate-700 block">Phạm vi phân phối đề thi:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAiDistributionType('repository')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                          aiDistributionType === 'repository'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Layers size={13} />
                        <span>Kho Đề Thi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAiDistributionType('classroom')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                          aiDistributionType === 'classroom'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Users size={13} />
                        <span>Giao Cho Lớp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAiDistributionType('both')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                          aiDistributionType === 'both'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>Cả Hai</span>
                      </button>
                    </div>
                  </div>

                  {/* Số lượt làm bài */}
                  <div className="md:col-span-4 space-y-2">
                    <label className="font-bold text-slate-700 block">Số lượt làm bài tối đa:</label>
                    <select
                      value={aiMaxAttempts}
                      onChange={(e) => setAiMaxAttempts(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white font-semibold focus:border-blue-600 focus:outline-none"
                    >
                      <option value={1}>1 lượt (Thi chính thức)</option>
                      <option value={2}>2 lượt thi</option>
                      <option value={3}>3 lượt thi</option>
                      <option value={0}>Không giới hạn lượt làm</option>
                    </select>
                  </div>
                </div>

                {/* Chọn danh sách lớp nếu phân phối theo lớp */}
                {aiDistributionType !== 'repository' && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700">Chọn nhóm lớp nhận đề thi:</label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setAiTargetClassIds(classrooms.map((c) => c.id))}
                          className="text-blue-600 font-semibold hover:underline"
                        >
                          Chọn tất cả
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => setAiTargetClassIds([])}
                          className="text-slate-500 font-semibold hover:underline"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-white border border-slate-200">
                      {classrooms.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">
                          Chưa có nhóm lớp nào. Hệ thống sẽ lưu đề vào Kho Đề Thi.
                        </p>
                      ) : (
                        classrooms.map((cls) => {
                          const isChecked = aiTargetClassIds.includes(cls.id);
                          return (
                            <label
                              key={cls.id}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                                isChecked
                                  ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAiTargetClassIds((prev) => [...prev, cls.id]);
                                    } else {
                                      setAiTargetClassIds((prev) => prev.filter((id) => id !== cls.id));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                <span className="font-bold text-xs">{cls.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">#{cls.code}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Chế độ hiển thị điểm khi học sinh nộp bài */}
                <div className="pt-2 border-t border-slate-200/60 space-y-2">
                  <label className="font-bold text-slate-700 block">
                    Chế độ cho học sinh biết điểm sau khi nộp bài:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { mode: 'immediate', label: 'Biết điểm ngay' },
                        { mode: 'after_close', label: 'Biết điểm sau' },
                        { mode: 'hidden', label: 'Không cho biết điểm' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => setAiScoreVisibility(opt.mode)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          aiScoreVisibility === opt.mode
                            ? opt.mode === 'hidden'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : opt.mode === 'after_close'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Danh sách các câu hỏi xem trước */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-extrabold text-sm text-slate-800">
                    Xem Trước Danh Sách Câu Hỏi Đã Quét ({aiParsedExam.questions.length} câu)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Công thức toán học hiển thị trực tiếp qua KaTeX
                  </span>
                </div>

                <div className="space-y-4">
                  {aiParsedExam.questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-all space-y-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-100 text-blue-800">
                            Câu {question.questionNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                            {question.part === 'part_1_mcq'
                              ? 'Phần I: 4 Lựa chọn'
                              : question.part === 'part_2_true_false'
                              ? 'Phần II: Đúng / Sai'
                              : 'Phần III: Trả lời ngắn'}
                          </span>
                          <span className="text-[11px] font-bold text-blue-600">
                            +{question.points} điểm
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteAiQuestion(question.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Xóa câu hỏi này khỏi đề thi"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Lời dẫn câu hỏi */}
                      <div className="text-xs text-slate-900 leading-relaxed font-medium">
                        <MathView latex={question.prompt} block={false} />
                      </div>

                      {/* File ảnh đề bài đính kèm / cắt từ PDF */}
                      {(question.pdfAttachmentUrl || question.imageAttachment) && (
                        <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full">
                          <ExamImage
                            src={question.pdfAttachmentUrl || question.imageAttachment}
                            alt={`Ảnh đề bài câu ${question.questionNumber}`}
                            className="max-h-52 max-w-full w-auto rounded-xl object-contain bg-white"
                          />
                        </div>
                      )}

                      {/* Khối đáp án cắt cả khối */}
                      {question.optionsAttachmentUrl && (
                        <div className="p-2 bg-teal-50 rounded-2xl border border-teal-200 inline-block max-w-full">
                          <ExamImage
                            src={question.optionsAttachmentUrl}
                            alt={`Khối đáp án câu ${question.questionNumber}`}
                            className="max-h-48 max-w-full w-auto rounded-xl object-contain bg-white"
                          />
                        </div>
                      )}

                      {/* PHẦN 1: 4 LỰA CHỌN */}
                      {question.part === 'part_1_mcq' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                          {question.options.map((opt) => {
                            const isCorrect = opt.key === question.correctAnswer;
                            return (
                              <div
                                key={opt.key}
                                className={`p-2.5 rounded-xl border flex flex-col gap-1.5 text-xs transition-colors ${
                                  isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {opt.key}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <MathView latex={opt.text} block={false} />
                                  </div>
                                  {isCorrect && (
                                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-md font-bold uppercase shrink-0">
                                      Đáp án đúng
                                    </span>
                                  )}
                                </div>
                                {opt.imageUrl && (
                                  <div className="rounded border border-slate-200 bg-white p-1 mt-1">
                                    <ExamImage src={opt.imageUrl} alt={`Đáp án ${opt.key}`} className="max-h-20 max-w-full w-auto object-contain mx-auto" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* PHẦN 2: ĐÚNG / SAI 4 Ý */}
                      {question.part === 'part_2_true_false' && (
                        <div className="space-y-1.5 pt-1 text-xs">
                          {question.items.map((item) => (
                            <div
                              key={item.id || item.subKey}
                              className="p-2.5 rounded-xl border border-slate-200 bg-white flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="font-extrabold text-blue-700 text-xs shrink-0 uppercase">
                                    {item.subKey})
                                  </span>
                                  <div className="min-w-0 text-slate-800">
                                    <MathView latex={item.text} block={false} />
                                  </div>
                                </div>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                                    item.isCorrect
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {item.isCorrect ? 'ĐÚNG' : 'SAI'}
                                </span>
                              </div>
                              {item.imageUrl && (
                                <div className="rounded border border-slate-200 bg-white p-1 mt-1">
                                  <ExamImage src={item.imageUrl} alt={`Ý ${item.subKey}`} className="max-h-20 max-w-full w-auto object-contain mx-auto" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* PHẦN 3: TRẢ LỜI NGẮN */}
                      {question.part === 'part_3_short_answer' && (
                        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs flex items-center justify-between gap-2">
                          <span className="text-slate-600 font-semibold">Đáp số chuẩn xác:</span>
                          <span className="font-mono font-black text-sm bg-white px-3 py-1 rounded-lg border border-blue-200 text-blue-700 shadow-2xs">
                            {question.correctAnswer}
                          </span>
                        </div>
                      )}

                      {/* Lời giải chi tiết nếu có */}
                      {question.explanation && (
                        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                          <strong>Lời giải chi tiết: </strong>
                          <MathView latex={question.explanation} block={false} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Thanh nút cuối trang */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setAiParsedExam(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  Quét Lại Đề Khác
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTransferToManualEditor}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Edit2 size={14} />
                    <span>Chuyển Sang Trình Soạn Đề Thủ Công</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectPublishAiExam}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <CheckCircle2 size={15} />
                    <span>Xuất Bản Đề Thi Ngay</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL THÊM / SỬA CÂU HỎI (HỖ TRỢ DÁN ẢNH CLIPBOARD & FILE PDF)            */}
      {/* ========================================================================= */}
      {showQuestionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onPaste={handlePasteImageFromClipboard}
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingQuestionId ? 'Chỉnh Sửa Câu Hỏi' : 'Thêm Câu Hỏi Mới Vào Đề Thi'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearQuestionModalFields}
                  className="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Xóa hết toàn bộ nội dung ô nhập để làm lại"
                >
                  <Trash2 size={13} />
                  <span>Xóa Hết Ô Nhập</span>
                </button>
                <button
                  onClick={() => setShowQuestionModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Chọn Loại Câu Hỏi (ĐÃ LOẠI BỎ PHẦN 4 TỰ LUẬN) */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Chọn cấu trúc phần thi:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setModalPart('part_1_mcq')}
                  className={`p-2.5 rounded-xl border font-bold text-xs transition-all ${
                    modalPart === 'part_1_mcq'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Phần 1: MCQ (0.25đ)
                </button>
                <button
                  type="button"
                  onClick={() => setModalPart('part_2_true_false')}
                  className={`p-2.5 rounded-xl border font-bold text-xs transition-all ${
                    modalPart === 'part_2_true_false'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Phần 2: Đúng / Sai (1.0đ)
                </button>
                <button
                  type="button"
                  onClick={() => setModalPart('part_3_short_answer')}
                  className={`p-2.5 rounded-xl border font-bold text-xs transition-all ${
                    modalPart === 'part_3_short_answer'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Phần 3: Trả Lời Ngắn (0.5đ)
                </button>
              </div>
            </div>

            {/* Điểm số */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Điểm số cho câu hỏi này:</label>
              <input
                type="number"
                step="0.05"
                value={modalPoints}
                onChange={(e) => setModalPoints(parseFloat(e.target.value) || 0.25)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono font-bold"
              />
            </div>

            {/* Nội dung đề bài & Hỗ trợ Dán ảnh clipboard */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700 block">Nội dung câu hỏi (Prompt) *</label>
              <textarea
                rows={3}
                value={modalPrompt}
                onChange={(e) => setModalPrompt(e.target.value)}
                onPaste={handlePasteImageFromClipboard}
                placeholder="Nhập nội dung đề bài..."
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* ĐÍNH KÈM / DÁN FILE ẢNH & FILE PDF */}
            <div className="space-y-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block">Đính kèm ảnh minh họa hoặc file tài liệu:</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold flex items-center gap-1.5"
                >
                  <ImageIcon size={14} className="text-blue-600" />
                  <span>Tải Ảnh Lên (PNG/JPG)</span>
                </button>

                <input
                  type="file"
                  ref={pdfInputRef}
                  onChange={handlePdfFileChange}
                  accept=".pdf"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold flex items-center gap-1.5"
                >
                  <Paperclip size={14} className="text-amber-600" />
                  <span>Đính Kèm File PDF</span>
                </button>

                {/* Preset hình học mẫu */}
                <button
                  type="button"
                  onClick={() =>
                    setModalImageAttachment(
                      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80'
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold flex items-center gap-1.5"
                >
                  <Compass size={14} />
                  <span>Lấy Hình 3D Oxyz Mẫu</span>
                </button>
              </div>

              {/* Preview ảnh đính kèm */}
              {modalImageAttachment && (
                <div className="relative inline-block mt-2">
                  <ExamImage
                    src={modalImageAttachment}
                    alt="Preview ảnh đính kèm"
                    className="max-h-36 rounded-xl border border-slate-200 object-contain bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setModalImageAttachment(null)}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-rose-600 text-white shadow-xs"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Preview ảnh khối đáp án đã cắt */}
              {modalOptionsAttachmentUrl && (
                <div className="relative inline-block mt-2 ml-2">
                  <div className="p-1 rounded-xl border border-teal-200 bg-teal-50 inline-block">
                    <ExamImage
                      src={modalOptionsAttachmentUrl}
                      alt="Preview khối đáp án"
                      className="max-h-36 rounded-lg object-contain bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOptionsAttachmentUrl(null)}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-rose-600 text-white shadow-xs"
                    title="Xóa khối đáp án"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {modalPdfName && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 mt-2">
                  <div className="flex items-center gap-2">
                    <Paperclip size={14} className="text-amber-600" />
                    <span className="font-semibold text-slate-800">{modalPdfName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalPdfName(null)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Công thức LaTeX */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Công thức LaTeX (Tùy chọn)</label>
              <input
                type="text"
                value={modalLatex}
                onChange={(e) => setModalLatex(e.target.value)}
                placeholder="VD: f'(x) = 3x^2 - 6x"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono"
              />
            </div>

            {/* Form riêng theo từng phần */}
            {modalPart === 'part_1_mcq' && (
              <div className="space-y-2 p-3 rounded-2xl bg-blue-50/50 border border-blue-200 text-xs">
                <span className="font-bold text-blue-900 block">4 Phương án (A, B, C, D):</span>
                {[
                  { key: 'A', val: modalOptA, set: setModalOptA },
                  { key: 'B', val: modalOptB, set: setModalOptB },
                  { key: 'C', val: modalOptC, set: setModalOptC },
                  { key: 'D', val: modalOptD, set: setModalOptD },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalCorrectMcq(item.key as any)}
                      className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                        modalCorrectMcq === item.key
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      {item.key}
                    </button>
                    <input
                      type="text"
                      value={item.val}
                      onChange={(e) => item.set(e.target.value)}
                      placeholder={`Phương án ${item.key}`}
                      className="flex-1 h-9 px-3 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                ))}
              </div>
            )}

            {modalPart === 'part_2_true_false' && (
              <div className="space-y-2 p-3 rounded-2xl bg-purple-50/50 border border-purple-200 text-xs">
                <span className="font-bold text-purple-900 block">4 Mệnh đề Đúng / Sai (a, b, c, d):</span>
                {[
                  { key: 'a', st: modalTfA, set: setModalTfA },
                  { key: 'b', st: modalTfB, set: setModalTfB },
                  { key: 'c', st: modalTfC, set: setModalTfC },
                  { key: 'd', st: modalTfD, set: setModalTfD },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <span className="font-bold text-purple-800 w-4">{item.key})</span>
                    <input
                      type="text"
                      value={item.st.text}
                      onChange={(e) => item.set({ ...item.st, text: e.target.value })}
                      placeholder={`Mệnh đề ${item.key}`}
                      className="flex-1 h-9 px-3 rounded-xl border border-slate-300 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => item.set({ ...item.st, isCorrect: !item.st.isCorrect })}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
                        item.st.isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {item.st.isCorrect ? 'ĐÚNG' : 'SAI'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {modalPart === 'part_3_short_answer' && (
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-700">Đáp án ngắn (Tối đa 4 ký tự) *</label>
                <input
                  type="text"
                  maxLength={4}
                  value={modalShortAnswer}
                  onChange={(e) => setModalShortAnswer(e.target.value.trim())}
                  placeholder="VD: 4 hoặc 1/2 hoặc -3.5"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>
            )}

            {/* Lời giải chi tiết */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Lời giải chi tiết</label>
              <textarea
                rows={2}
                value={modalExplanation}
                onChange={(e) => setModalExplanation(e.target.value)}
                placeholder="Lời giải chi tiết (tùy chọn)..."
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {questionModalError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                <span>{questionModalError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClearQuestionModalFields}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                title="Xóa hết toàn bộ nội dung câu hỏi đang nhập để làm lại"
              >
                <Trash2 size={14} />
                <span>Xóa Hết (Làm Mới)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Lưu Câu Hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA TẤT CẢ CÂU HỎI */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">Xóa Toàn Bộ Câu Hỏi?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Thao tác này sẽ xóa toàn bộ {manualQuestions.length} câu hỏi hiện có trong đề thi để bắt đầu lại từ đầu. Thao tác không thể hoàn tác.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowClearAllModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={() => {
                  setManualQuestions([]);
                  setShowClearAllModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Xóa Hết ({manualQuestions.length} câu)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA 1 CÂU HỎI */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">Xóa Câu Hỏi Này?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa câu hỏi số {questionToDelete.questionNumber} khỏi đề thi không?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setQuestionToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmDeleteQuestion}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XÁC NHẬN XUẤT BẢN ĐỀ THI                                            */}
      {/* ========================================================================= */}
      {showPublishConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Xác Nhận Xuất Bản Đề Thi</h4>
              </div>
            </div>

            {/* Bảng tóm tắt thông số đề thi */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200/70">
                <span className="text-slate-500 font-semibold">Tên đề thi:</span>
                <span className="font-extrabold text-slate-900 text-right">{manualTitle}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-semibold">Khối lớp & Thời gian:</span>
                <span className="font-bold text-slate-800">
                  Khối {manualGrade} · {manualDuration} phút ({manualYear})
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-semibold">Số lượng câu hỏi:</span>
                <span className="font-bold text-slate-800">
                  {manualQuestions.length} câu (P1: {partCounts.part1}, P2: {partCounts.part2}, P3: {partCounts.part3})
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-semibold">Tổng điểm bài thi:</span>
                <span className="font-mono font-black text-blue-700 text-sm">
                  {dynamicTotalPoints.toFixed(2)} điểm
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-200/70">
                <span className="text-slate-500 font-semibold">Phạm vi giao đề:</span>
                <span className="font-bold text-indigo-700 text-right">
                  {manualDistributionType === 'classroom'
                    ? `Chỉ định ${manualTargetClassIds.length} nhóm lớp: ${classrooms
                        .filter((c) => manualTargetClassIds.includes(c.id))
                        .map((c) => c.name)
                        .join(', ')}`
                    : manualDistributionType === 'repository'
                    ? 'Kho đề cá nhân (chưa giao lớp)'
                    : `Cả lớp (${classrooms
                        .filter((c) => manualTargetClassIds.includes(c.id))
                        .map((c) => c.name)
                        .join(', ')}) & Kho cá nhân`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-semibold">Giới hạn số lượt làm:</span>
                <span className="font-bold text-amber-700">
                  {manualMaxAttempts > 0 ? `Tối đa ${manualMaxAttempts} lượt thi` : 'Không giới hạn lượt làm'}
                </span>
              </div>

              {manualHasTimeWindow && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Thời hạn mở/đóng:</span>
                  <span className="font-bold text-rose-700 text-right">
                    {manualOpenTime ? `Mở: ${manualOpenTime}` : ''}
                    {manualCloseTime ? ` · Đóng: ${manualCloseTime}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
              ℹ️ <strong>Thông báo:</strong> Sau khi xác nhận, đề thi sẽ ngay lập tức được xuất bản và hiển thị trong danh sách đề thi của học sinh theo đúng phạm vi đã cài đặt. Thầy/Cô có thể quản lý hoặc gỡ đề bất cứ lúc nào.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmPublishExam}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>Xác Nhận & Xuất Bản</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE CROP STUDIO: PHÒNG CẮT CÁC CÂU VÀO ĐỀ THI                          */}
      {/* ========================================================================= */}
      {creationMode === 'crop_studio' && (
        <QuestionCropStudioView
          documentData={
            aiPdfFile
              ? {
                  fileName: aiPdfFile.fileName,
                  fileSize: aiPdfFile.fileSize,
                  fileBase64: aiPdfFile.fileBase64,
                  extractedText: aiPdfFile.extractedText,
                  isPdf: aiPdfFile.fileType === 'pdf',
                  isWord: aiPdfFile.fileType === 'word',
                  pageImages: aiPdfFile.pageImages,
                }
              : aiLatexText
              ? {
                  fileName: 'Ma_Nguon_Latex.tex',
                  fileSize: `${Math.round(aiLatexText.length / 1024)} KB`,
                  extractedText: aiLatexText,
                  isPdf: false,
                }
              : null
          }
          initialQuestions={aiParsedExam?.questions || []}
          initialTitle={aiExamTitle || 'Đề Thi Phân Đoạn Mới'}
          initialGrade={aiGrade}
          initialDuration={aiDuration}
          classrooms={classrooms}
          currentUserName={currentUserName}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          onUploadFile={handleProcessPdfFile}
          isUploadingDocument={isConvertingDocument}
          onPublishExam={async (newExam) => {
            const res = await onPublishExam?.(newExam);
            setPublishSuccessMessage(`Đã xuất bản đề thi "${newExam.title}" và đồng bộ ảnh lên đám mây thành công!`);
            setCreationMode('manage_exams');
            setTimeout(() => setPublishSuccessMessage(null), 5000);
            return typeof res === 'boolean' ? res : true;
          }}
          onTransferToManualEditor={(questions, meta) => {
            setManualQuestions(questions);
            setManualTitle(meta.title);
            setManualGrade(meta.grade);
            setManualDuration(meta.duration);
            setCreationMode('manual');
            setPublishSuccessMessage(`Đã chuyển ${questions.length} câu hỏi sang giao diện biên tập thủ công!`);
            setTimeout(() => setPublishSuccessMessage(null), 4000);
          }}
          onBackToUpload={() => setCreationMode('ai_pdf')}
        />
      )}

      {/* ========================================================================= */}
      {/* MODE 3: QUẢN LÝ KHO ĐỀ THI ĐÃ XUẤT BẢN                                   */}
      {/* ========================================================================= */}
      {creationMode === 'manage_exams' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                  <Layers size={20} className="text-blue-600" />
                  <span>Danh Sách Đề Thi Đã Xuất Bản ({examsList.length})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreationMode('manual')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
              >
                <Plus size={15} />
                <span>Tạo Đề Thi Mới</span>
              </button>
            </div>

            {examsList.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <FileText size={40} className="mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-sm">Chưa có đề thi nào trong kho!</h4>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {examsList.map((exam) => {
                  const needsImageSync = examNeedsImageCloudSync(exam);
                  return (
                  <div
                    key={exam.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                          Khối {exam.grade}
                        </span>
                        <h4 className="font-extrabold text-sm text-slate-900 truncate">
                          {exam.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {exam.totalPoints} điểm
                        </span>
                        {exam.maxAttempts && exam.maxAttempts > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                            Tối đa {exam.maxAttempts} lượt thi
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span>{exam.questions.length} câu hỏi</span>
                        <span>·</span>
                        <span>{exam.durationMinutes} phút</span>
                        <span>·</span>
                        <span>Người soạn: <strong className="text-slate-700">{exam.createdBy || 'Giáo viên'}</strong></span>
                        {exam.year && <span>· Năm {exam.year}</span>}
                      </div>

                      {/* Thông tin phân phối */}
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="font-semibold text-slate-600">Phạm vi giao:</span>
                        {exam.targetClassIds && exam.targetClassIds.length > 0 && exam.distributionType !== 'repository' ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                            Giao cho {exam.targetClassIds.length} lớp (
                            {classrooms
                              .filter((c) => exam.targetClassIds?.includes(c.id))
                              .map((c) => c.name)
                              .join(', ')}
                            )
                          </span>
                        ) : exam.distributionType === 'repository' ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                            Kho đề riêng (chưa giao lớp)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                            Chưa gán nhóm lớp
                          </span>
                        )}
                      </div>

                      {/* Nút chuyển nhanh chế độ cho biết điểm (Trước / Sau / Không cho biết) */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                        <span className="text-[11px] font-semibold text-slate-600">Biết điểm khi nộp xong:</span>
                        {(
                          [
                            { mode: 'immediate', label: 'Biết ngay' },
                            { mode: 'after_close', label: 'Biết sau' },
                            { mode: 'hidden', label: 'Không cho biết' },
                          ] as const
                        ).map((opt) => {
                          const currentMode = exam.scoreVisibility || 'immediate';
                          const isActive = currentMode === opt.mode;
                          return (
                            <button
                              key={opt.mode}
                              type="button"
                              onClick={() => {
                                if (currentMode === opt.mode) return;
                                const updatedExam: Exam = { ...exam, scoreVisibility: opt.mode };
                                if (onSaveSingleExam) {
                                  onSaveSingleExam(updatedExam);
                                } else if (onAssignExamToClasses) {
                                  onAssignExamToClasses(
                                    exam.id,
                                    exam.targetClassIds || [],
                                    exam.distributionType || 'classroom',
                                    exam.maxAttempts,
                                    exam.openTime,
                                    exam.closeTime,
                                    exam.enableScreenMonitoring,
                                    exam.maxInfractions,
                                    opt.mode
                                  );
                                }
                                setPublishSuccessMessage(
                                  `Đã chuyển "${exam.title}" sang chế độ: ${getExamScoreVisibilityLabel(opt.mode)}.`
                                );
                                setTimeout(() => setPublishSuccessMessage(null), 3500);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                isActive
                                  ? opt.mode === 'hidden'
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                    : opt.mode === 'after_close'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                    : 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto flex-wrap">
                      {needsImageSync && onPublishExam && (
                        <button
                          type="button"
                          disabled={syncingExamId === exam.id}
                          onClick={async () => {
                            setSyncingExamId(exam.id);
                            try {
                              const migrated = await persistExamImagesEverywhere(exam);
                              await onPublishExam(migrated.exam);
                              if (!examNeedsImageCloudSync(migrated.exam)) {
                                setPublishSuccessMessage(`Đã đồng bộ toàn bộ ảnh đề "${exam.title}" lên đám mây!`);
                              } else {
                                setPublishSuccessMessage(
                                  `Đề "${exam.title}" vẫn còn ảnh cũ chưa có trên đám mây (tệp ảnh tạm cũ đã bị xóa khi máy chủ khởi động lại). Vui lòng cắt hoặc tải lại các ảnh bị thiếu rồi xuất bản lại.`
                                );
                              }
                              setTimeout(() => setPublishSuccessMessage(null), 7000);
                            } finally {
                              setSyncingExamId(null);
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                          title="Đồng bộ ảnh cắt đề thi lên đám mây để điện thoại xem được"
                        >
                          {syncingExamId === exam.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          <span>{syncingExamId === exam.id ? 'Đang đồng bộ...' : 'Đồng Bộ Ảnh'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenAssignModal(exam)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                        title="Giao đề thi này cho các nhóm lớp học"
                      >
                        <Users size={14} />
                        <span>Giao Cho Lớp</span>
                      </button>
                      {onPreviewExam && (
                        <button
                          type="button"
                          onClick={() => onPreviewExam(exam)}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                          <Eye size={14} />
                          <span>Xem Thử Đề</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExamToDelete(exam)}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                        title="Xóa đề thi này và toàn bộ dữ liệu liên quan"
                      >
                        <Trash2 size={14} />
                        <span>Xóa Đề</span>
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL GIAO ĐỀ CHO CÁC NHÓM LỚP KHÁC NHAU */}
      {examToAssign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 block">
                  Phân Phối & Giao Đề Thi
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  Giao Đề Cho Các Nhóm Lớp
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                  Đề: <strong className="text-slate-800">{examToAssign.title}</strong> ({examToAssign.questions.length} câu · {examToAssign.durationMinutes} phút)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExamToAssign(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Phạm vi giao đề */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Phạm vi giao đề thi:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignDistributionType('classroom')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    assignDistributionType === 'classroom'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Chỉ nhóm lớp
                </button>
                <button
                  type="button"
                  onClick={() => setAssignDistributionType('repository')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    assignDistributionType === 'repository'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Kho đề cá nhân
                </button>
                <button
                  type="button"
                  onClick={() => setAssignDistributionType('both')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    assignDistributionType === 'both'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Cả hai
                </button>
              </div>
            </div>

            {/* Danh sách các nhóm lớp để tích chọn */}
            {assignDistributionType !== 'repository' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Chọn nhóm lớp nhận đề thi ({assignTargetClassIds.length}/{classrooms.length}):
                  </label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAssignTargetClassIds(classrooms.map((c) => c.id))}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setAssignTargetClassIds([])}
                      className="text-slate-500 font-semibold hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200">
                  {classrooms.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Chưa có nhóm lớp nào. Vui lòng tạo lớp học trước.</p>
                  ) : (
                    classrooms.map((cls) => {
                      const isChecked = assignTargetClassIds.includes(cls.id);
                      return (
                        <label
                          key={cls.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                            isChecked
                              ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignTargetClassIds((prev) => [...prev, cls.id]);
                                } else {
                                  setAssignTargetClassIds((prev) => prev.filter((id) => id !== cls.id));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <div>
                              <span className="font-extrabold text-xs block">{cls.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">#{cls.code} · Khối {cls.grade}</span>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 rounded-full bg-slate-100">
                            {cls.studentIds?.length || 0} học sinh
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Cài đặt số lượt làm & thời gian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Số lượt làm bài tối đa</label>
                <select
                  value={assignMaxAttempts}
                  onChange={(e) => setAssignMaxAttempts(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-semibold focus:border-blue-600 focus:outline-none"
                >
                  <option value={1}>1 lượt (Thi chính thức)</option>
                  <option value={2}>2 lượt thi</option>
                  <option value={3}>3 lượt thi</option>
                  <option value={5}>5 lượt thi</option>
                  <option value={0}>Không giới hạn lượt làm</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Khung giờ mở/đóng</label>
                  <button
                    type="button"
                    onClick={() => setAssignHasTimeWindow(!assignHasTimeWindow)}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    {assignHasTimeWindow ? 'Tắt hẹn giờ' : 'Bật hẹn giờ'}
                  </button>
                </div>
                {assignHasTimeWindow ? (
                  <div className="space-y-1.5">
                    <input
                      type="datetime-local"
                      value={assignOpenTime}
                      onChange={(e) => setAssignOpenTime(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-slate-300 font-mono text-[11px]"
                    />
                    <input
                      type="datetime-local"
                      value={assignCloseTime}
                      onChange={(e) => setAssignCloseTime(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-slate-300 font-mono text-[11px]"
                    />
                  </div>
                ) : (
                  <div className="h-10 flex items-center px-3 rounded-xl bg-slate-100 text-slate-400 font-medium text-[11px]">
                    Đề thi luôn mở không giới hạn giờ
                  </div>
                )}
              </div>
            </div>

            {/* Ô KIỂM SOÁT MÀN HÌNH & CHỐNG GIAN LẬN TRONG MODAL GIAO ĐỀ */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 font-bold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignScreenMonitoring}
                    onChange={(e) => setAssignScreenMonitoring(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <ShieldAlert size={16} className="text-indigo-600 shrink-0" />
                  <span>Ô Kiểm Soát Màn Hình & Chống Gian Lận</span>
                </label>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  assignScreenMonitoring ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {assignScreenMonitoring ? 'Đang Bật' : 'Tắt'}
                </span>
              </div>

              {assignScreenMonitoring && (
                <div className="pt-2 border-t border-indigo-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-indigo-900 font-semibold flex items-center gap-1.5">
                    <Monitor size={13} className="text-indigo-600" />
                    <span>Rời màn hình tối đa:</span>
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setAssignMaxInfractions(cnt)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border transition-all ${
                          assignMaxInfractions === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {cnt} lần
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chế độ cho biết điểm sau khi nộp bài trong Modal Giao Đề */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-700 block">
                Hiển thị điểm khi học sinh làm bài xong:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { mode: 'immediate', label: 'Biết điểm ngay' },
                    { mode: 'after_close', label: 'Biết điểm sau' },
                    { mode: 'hidden', label: 'Không cho biết điểm' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setAssignScoreVisibility(opt.mode)}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      assignScoreVisibility === opt.mode
                        ? opt.mode === 'hidden'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : opt.mode === 'after_close'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                {assignScoreVisibility === 'immediate'
                  ? 'Học sinh xem điểm ngay sau khi nhấn nộp bài.'
                  : assignScoreVisibility === 'after_close'
                  ? 'Điểm tạm ẩn cho tới khi hết hạn đóng đề hoặc thầy/cô bấm chuyển sang "Biết ngay".'
                  : 'Ẩn hoàn toàn điểm số với học sinh (chỉ giáo viên xem được).'}
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setExamToAssign(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignExam}
                disabled={isSavingAssignment}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 size={16} />
                <span>{isSavingAssignment ? 'Đang Lưu...' : 'Lưu & Giao Đề Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỎI LẠI KHI XÓA ĐỀ THI VÀ TOÀN BỘ DỮ LIỆU LIÊN QUAN */}
      <DeleteConfirmationModal
        isOpen={Boolean(examToDelete)}
        itemType="exam"
        title="Xác Nhận Xóa Đề Thi Vĩnh Viễn"
        itemName={examToDelete?.title || ''}
        itemSubtitle={`Khối ${examToDelete?.grade || 12} · ${examToDelete?.durationMinutes || 90} phút · ${examToDelete?.questions?.length || 0} câu hỏi`}
        isDeleting={isDeletingExam}
        onConfirm={handleConfirmDeleteExam}
        onCancel={() => setExamToDelete(null)}
      />
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Question, Exam, MathTopic } from '../../types/math';
import { MathView } from '../MathView';
import { parseExamFromLatexOrText } from '../../lib/latexExamParser';
import { cleanPdfNoiseAndOcr } from '../../lib/ocrNoiseCleaner';
import {
  Scissors,
  Crop,
  Sparkles,
  CheckCircle2,
  Trash2,
  Plus,
  MoveUp,
  MoveDown,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Image as ImageIcon,
  Check,
  Eye,
  Save,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Sliders,
  Layers,
  HelpCircle,
  X,
  RefreshCw,
  Copy,
} from 'lucide-react';

export interface CropDocumentData {
  fileName: string;
  fileSize: string;
  fileBase64?: string;
  fileUrl?: string;
  extractedText?: string;
  isPdf?: boolean;
}

interface QuestionCropStudioViewProps {
  documentData?: CropDocumentData | null;
  initialQuestions?: Question[];
  initialTitle?: string;
  initialGrade?: 10 | 11 | 12;
  initialDuration?: number;
  onPublishExam: (exam: Exam) => void;
  onTransferToManualEditor: (questions: Question[], examMeta: { title: string; grade: 10 | 11 | 12; duration: number }) => void;
  onBackToUpload: () => void;
  currentUserName?: string;
}

export const QuestionCropStudioView: React.FC<QuestionCropStudioViewProps> = ({
  documentData,
  initialQuestions = [],
  initialTitle = '',
  initialGrade = 12,
  initialDuration = 90,
  onPublishExam,
  onTransferToManualEditor,
  onBackToUpload,
  currentUserName = 'Giáo viên',
}) => {
  // Metadata của đề thi đang cắt
  const [examTitle, setExamTitle] = useState(
    initialTitle || (documentData ? `Đề Thi: ${documentData.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}` : 'Đề Thi Cắt Câu Hỏi Chuẩn BGD 2025')
  );
  const [examGrade, setExamGrade] = useState<10 | 11 | 12>(initialGrade);
  const [examDuration, setExamDuration] = useState<number>(initialDuration);
  const [enableScreenMonitoring, setEnableScreenMonitoring] = useState<boolean>(true);
  const [maxInfractions, setMaxInfractions] = useState<number>(3);

  // Danh sách câu hỏi đã cắt vào đề
  const [questions, setQuestions] = useState<Question[]>(() => {
    if (initialQuestions.length > 0) return initialQuestions;
    return [];
  });

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isAiCroppingAll, setIsAiCroppingAll] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Canvas & tương tác cắt khung
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isDrawingCrop, setIsDrawingCrop] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [lastCroppedSnippetUrl, setLastCroppedSnippetUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);

  // Nếu chưa có câu hỏi nào và có tài liệu, tự động bóc tách ban đầu
  useEffect(() => {
    if (questions.length === 0 && documentData?.extractedText) {
      handleAutoCropAllQuestions();
    }
  }, [documentData]);

  // Bắt đầu vẽ khung cắt
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    setIsDrawingCrop(true);
    setCropStart({ x, y });
    setCropBox({ x, y, w: 0, h: 0 });
  };

  // Kéo chuột để mở rộng khung cắt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingCrop || !cropStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / zoomLevel;
    const currentY = (e.clientY - rect.top) / zoomLevel;

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const w = Math.abs(currentX - cropStart.x);
    const h = Math.abs(currentY - cropStart.y);

    setCropBox({ x, y, w, h });
  };

  // Thả chuột kết thúc khung cắt
  const handleMouseUp = () => {
    setIsDrawingCrop(false);
  };

  // Thực hiện cắt khung hiện tại và tạo câu hỏi mới vào danh sách
  const handleCommitCropToQuestion = (part: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq') => {
    const newQNumber = questions.length + 1;
    let snippetDataUrl = '';

    // Nếu có ảnh hiển thị, trích xuất vùng cắt sang canvas
    if (imageElementRef.current && cropBox && cropBox.w > 20 && cropBox.h > 20) {
      try {
        const img = imageElementRef.current;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropBox.w;
        cropCanvas.height = cropBox.h;
        const ctx = cropCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, cropBox.x, cropBox.y, cropBox.w, cropBox.h, 0, 0, cropBox.w, cropBox.h);
          snippetDataUrl = cropCanvas.toDataURL('image/png');
          setLastCroppedSnippetUrl(snippetDataUrl);
        }
      } catch (err) {
        console.warn('Lỗi trích xuất ảnh cắt từ canvas:', err);
      }
    }

    let newQuestion: Question;

    if (part === 'part_2_true_false') {
      newQuestion = {
        id: `q_crop_${Date.now()}_${newQNumber}`,
        part: 'part_2_true_false',
        questionNumber: newQNumber,
        prompt: `Câu ${newQNumber}. Cho giả thiết bài toán. Xét tính đúng/sai của các mệnh đề sau:`,
        pdfAttachmentUrl: snippetDataUrl || undefined,
        items: [
          { id: `tf_a_${Date.now()}`, subKey: 'a', text: 'Mệnh đề a liên quan đến câu hỏi.', isCorrect: true },
          { id: `tf_b_${Date.now()}`, subKey: 'b', text: 'Mệnh đề b liên quan đến câu hỏi.', isCorrect: true },
          { id: `tf_c_${Date.now()}`, subKey: 'c', text: 'Mệnh đề c liên quan đến câu hỏi.', isCorrect: false },
          { id: `tf_d_${Date.now()}`, subKey: 'd', text: 'Mệnh đề d liên quan đến câu hỏi.', isCorrect: true },
        ],
        explanation: 'Lời giải chi tiết cho 4 ý đúng/sai.',
        points: 1.0,
      };
    } else if (part === 'part_3_short_answer') {
      newQuestion = {
        id: `q_crop_${Date.now()}_${newQNumber}`,
        part: 'part_3_short_answer',
        questionNumber: newQNumber,
        prompt: `Câu ${newQNumber}. Tính giá trị của bài toán (điền kết quả ngắn):`,
        pdfAttachmentUrl: snippetDataUrl || undefined,
        correctAnswer: '15',
        explanation: 'Lời giải chi tiết tìm ra đáp số.',
        points: 0.5,
      };
    } else {
      newQuestion = {
        id: `q_crop_${Date.now()}_${newQNumber}`,
        part: 'part_1_mcq',
        questionNumber: newQNumber,
        prompt: `Câu ${newQNumber}. Chọn một phương án đúng nhất trong các phương án sau:`,
        pdfAttachmentUrl: snippetDataUrl || undefined,
        options: [
          { key: 'A', text: 'Phương án A' },
          { key: 'B', text: 'Phương án B' },
          { key: 'C', text: 'Phương án C' },
          { key: 'D', text: 'Phương án D' },
        ],
        correctAnswer: 'A',
        explanation: 'Lời giải chi tiết câu hỏi trắc nghiệm.',
        points: 0.25,
      };
    }

    setQuestions((prev) => [...prev, newQuestion]);
    setActiveQuestionId(newQuestion.id);
    setCropBox(null);
    setStatusMessage(`Đã cắt thành công Câu ${newQNumber} vào đề thi!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Tự động nhận diện và bóc tách toàn bộ câu hỏi (AI Auto Crop)
  const handleAutoCropAllQuestions = () => {
    setIsAiCroppingAll(true);
    setStatusMessage('AI đang làm sạch nhiễu header/footer và tự động bóc tách các câu hỏi...');

    setTimeout(() => {
      try {
        const textToParse = documentData?.extractedText || '';
        // Làm sạch nhiễu PDF trước khi bóc tách
        const cleaned = cleanPdfNoiseAndOcr(textToParse);
        const parsed = parseExamFromLatexOrText(cleaned.cleanedText || textToParse, examGrade, examDuration, examTitle);

        if (parsed && parsed.questions && parsed.questions.length > 0) {
          setQuestions(parsed.questions);
          if (parsed.metadata?.title) setExamTitle(parsed.metadata.title);
          if (parsed.metadata?.durationMinutes) setExamDuration(parsed.metadata.durationMinutes);
          setActiveQuestionId(parsed.questions[0].id);
          setStatusMessage(`AI đã tự động nhận diện và cắt ${parsed.questions.length} câu hỏi vào đề!`);
        } else {
          // Thêm 3 câu hỏi mẫu chuẩn BGD nếu chưa có nội dung
          handleCommitCropToQuestion('part_1_mcq');
          handleCommitCropToQuestion('part_2_true_false');
          handleCommitCropToQuestion('part_3_short_answer');
          setStatusMessage('Đã tạo khung câu hỏi mẫu 3 phần chuẩn BGD 2025!');
        }
      } catch (err) {
        console.warn('Lỗi auto crop:', err);
      } finally {
        setIsAiCroppingAll(false);
        setTimeout(() => setStatusMessage(null), 3500);
      }
    }, 600);
  };

  // Cập nhật thông tin câu hỏi đang chỉnh sửa
  const handleUpdateQuestion = (qId: string, updates: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? ({ ...q, ...updates } as Question) : q)));
  };

  // Xóa câu hỏi khỏi đề
  const handleDeleteQuestion = (qId: string) => {
    setQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== qId);
      return filtered.map((q, idx) => ({ ...q, questionNumber: idx + 1 } as Question));
    });
    if (activeQuestionId === qId) {
      setActiveQuestionId(null);
    }
  };

  // Đổi thứ tự câu hỏi lên/xuống
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const copy = [...questions];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    // Đánh lại số câu hỏi
    const reindexed = copy.map((q, i) => ({ ...q, questionNumber: i + 1 } as Question));
    setQuestions(reindexed);
  };

  // Tính tổng điểm đề thi
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // Xuất bản đề thi trực tiếp
  const handlePublishDirectly = () => {
    if (questions.length === 0) {
      alert('Vui lòng cắt ít nhất 1 câu hỏi vào đề thi trước khi xuất bản!');
      return;
    }

    const newExam: Exam = {
      id: `exam_crop_${Date.now()}`,
      title: examTitle.trim() || 'Đề Thi Biên Soạn Từ Phòng Cắt Câu',
      grade: examGrade,
      year: 2025,
      durationMinutes: examDuration,
      totalPoints: Number(totalPoints.toFixed(2)),
      status: 'approved',
      createdBy: currentUserName || 'Giáo viên',
      createdAt: new Date().toISOString(),
      questions,
      distributionType: 'repository',
      allowViewAnswersAfterSubmit: true,
      enableScreenMonitoring,
      maxInfractions,
    };

    onPublishExam(newExam);
  };

  // Chuyển sang trình soạn thảo chi tiết
  const handleTransfer = () => {
    onTransferToManualEditor(questions, {
      title: examTitle,
      grade: examGrade,
      duration: examDuration,
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-16">
      {/* ========================================================= */}
      // TOP HEADER & THANH ĐIỀU KHIỂN PHÒNG CẮT CÂU
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Scissors size={14} className="text-indigo-600" />
                <span>Phòng Cắt Câu Đề Thi (Crop Studio)</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                Giao Diện Riêng Biệt Cắt Đề BGD 2025
              </span>
              {documentData && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-bold">
                  {documentData.fileName} ({documentData.fileSize})
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-2">
              Khu Vực Cắt Câu Hỏi Vào Đề Thi
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Kéo chuột trên tài liệu để khoanh vùng cắt từng câu, hoặc nhấn bóc tách AI để tự động đưa toàn bộ câu hỏi vào đề.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <button
              type="button"
              onClick={onBackToUpload}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Đổi Tệp Khác</span>
            </button>

            <button
              type="button"
              onClick={handleAutoCropAllQuestions}
              disabled={isAiCroppingAll}
              className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={14} className={isAiCroppingAll ? 'animate-spin' : ''} />
              <span>{isAiCroppingAll ? 'Đang Nhận Diện...' : 'AI Cắt Tự Động Toàn Đề'}</span>
            </button>

            <button
              type="button"
              onClick={handleTransfer}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders size={14} />
              <span>Sang Soạn Thảo Chi Tiết</span>
            </button>

            <button
              type="button"
              onClick={handlePublishDirectly}
              disabled={questions.length === 0}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Xuất Bản Đề Thi ({questions.length} câu)</span>
            </button>
          </div>
        </div>

        {/* Thông báo trạng thái nhanh */}
        {statusMessage && (
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-indigo-600 hover:text-indigo-900"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* THANH CẤU HÌNH THÔNG SỐ ĐỀ THI */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs pt-1">
          <div className="sm:col-span-6 space-y-1">
            <label className="font-bold text-slate-700">Tên Đề Thi *</label>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 font-semibold focus:border-indigo-600 focus:outline-none"
              placeholder="Nhập tên đề thi hiển thị..."
            />
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="font-bold text-slate-700">Khối Lớp *</label>
            <select
              value={examGrade}
              onChange={(e) => setExamGrade(Number(e.target.value) as 10 | 11 | 12)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 font-bold focus:border-indigo-600 focus:outline-none bg-white cursor-pointer"
            >
              <option value={10}>Lớp 10 (Chương trình mới)</option>
              <option value={11}>Lớp 11 (Chương trình mới)</option>
              <option value={12}>Lớp 12 (Tốt Nghiệp THPT)</option>
            </select>
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="font-bold text-slate-700">Thời Gian Làm Bài *</label>
            <select
              value={examDuration}
              onChange={(e) => setExamDuration(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 font-bold focus:border-indigo-600 focus:outline-none bg-white cursor-pointer"
            >
              <option value={45}>45 Phút (1 tiết)</option>
              <option value={60}>60 Phút (Giữa kỳ)</option>
              <option value={90}>90 Phút (Chuẩn BGD)</option>
              <option value={120}>120 Phút (Khảo sát)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* KHÔNG GIAN LÀM VIỆC CHÍNH: 2 CỘT (CẮT TÀI LIỆU | DANH SÁCH CÂU HỎI) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* CỘT TRÁI (6 COLS): BÀN CẮT TÀI LIỆU VÀ KHUNG VẼ CẮT */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Crop size={18} className="text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Bàn Cắt Tài Liệu Trực Quan</h3>
              </div>

              {/* Các công cụ zoom và xoay */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                  className="p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="px-1 text-[11px] font-mono">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
                  className="p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  title="Vừa màn hình"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRotationAngle((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  title="Xoay 90 độ"
                >
                  <RotateCw size={14} />
                </button>
              </div>
            </div>

            {/* VÙNG HIỂN THỊ TÀI LIỆU & CẮT KHUNG */}
            <div className="relative rounded-2xl bg-slate-900 overflow-hidden border border-slate-800 min-h-[460px] max-h-[640px] flex items-center justify-center select-none overflow-auto">
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotationAngle}deg)`,
                  transformOrigin: 'center center',
                  transition: isDrawingCrop ? 'none' : 'transform 0.15s ease',
                }}
                className="relative cursor-crosshair max-w-full"
              >
                {documentData?.fileBase64 && !documentData.isPdf ? (
                  <img
                    ref={imageElementRef}
                    src={documentData.fileBase64}
                    alt="Tài liệu đề thi"
                    className="max-w-full h-auto object-contain pointer-events-none"
                  />
                ) : (
                  // Giả lập giao diện trang đề thi để giáo viên kéo thả cắt câu hỏi trực tiếp
                  <div className="w-[520px] min-h-[700px] bg-white text-slate-800 p-8 shadow-2xl font-serif text-xs space-y-4">
                    <div className="text-center border-b pb-3 border-slate-200">
                      <p className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                        {documentData?.fileName || 'ĐỀ THI TOÁN THPT NĂM HỌC 2024 - 2025'}
                      </p>
                      <h4 className="font-extrabold text-sm text-slate-900 mt-0.5">
                        {examTitle}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Thời gian: {examDuration} phút | Môn: Toán học | Khối {examGrade}
                      </p>
                    </div>

                    <div className="space-y-4 font-sans text-xs leading-relaxed text-slate-700">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-indigo-700">PHẦN I. TRẮC NGHIỆM 4 PHƯƠNG ÁN</span>
                        <div className="mt-1 font-semibold text-slate-800">
                          <MathView math="Câu 1: Cho hàm số $y = x^3 - 3x + 1$. Điểm cực tiểu của đồ thị hàm số là:" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
                          <div><MathView math="A. $M(1; -1)$" /></div>
                          <div><MathView math="B. $N(-1; 3)$" /></div>
                          <div><MathView math="C. $P(0; 1)$" /></div>
                          <div><MathView math="D. $Q(2; 3)$" /></div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-indigo-700">PHẦN II. TRẮC NGHIỆM ĐÚNG / SAI</span>
                        <div className="mt-1 font-semibold text-slate-800">
                          <MathView math="Câu 2: Cho khối chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$, $SA \perp (ABCD)$." />
                        </div>
                        <div className="space-y-1 mt-1.5 pl-2 text-[11px]">
                          <div><MathView math="a) $SA \perp BC$" /></div>
                          <div><MathView math={'b) Thể tích $V = \\frac{a^3\\sqrt{3}}{3}$'} /></div>
                          <div><MathView math="c) $BD \perp (SAC)$" /></div>
                          <div><MathView math={'d) Góc giữa $SC$ và đáy bằng $45^\\circ$'} /></div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-indigo-700">PHẦN III. TRẢ LỜI NGẮN</span>
                        <div className="mt-1 font-semibold text-slate-800">
                          <MathView math={'Câu 3: Một hình chữ nhật có chu vi $40\\text{ m}$. Diện tích lớn nhất của hình chữ nhật bằng bao nhiêu mét vuông?'} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* KHUNG CẮT ĐANG KÉO (CROP BOUNDING BOX) */}
                {cropBox && cropBox.w > 5 && cropBox.h > 5 && (
                  <div
                    style={{
                      left: cropBox.x,
                      top: cropBox.y,
                      width: cropBox.w,
                      height: cropBox.h,
                    }}
                    className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/20 pointer-events-none z-20 flex items-start justify-end p-1.5"
                  >
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shadow-md">
                      Vùng Câu {questions.length + 1} ({Math.round(cropBox.w)} × {Math.round(cropBox.h)})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* BẢNG HÀNH ĐỘNG CẮT CÂU */}
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Scissors size={14} className="text-indigo-600" />
                  <span>Cắt Vùng Đã Khoanh Vào Đề Thành:</span>
                </span>
                {cropBox && cropBox.w > 20 && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Sẵn sàng cắt ({Math.round(cropBox.w)} × {Math.round(cropBox.h)} px)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleCommitCropToQuestion('part_1_mcq')}
                  className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                >
                  + Cắt Câu Phần I (MCQ)
                </button>
                <button
                  type="button"
                  onClick={() => handleCommitCropToQuestion('part_2_true_false')}
                  className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                >
                  + Cắt Câu Phần II (Đúng/Sai)
                </button>
                <button
                  type="button"
                  onClick={() => handleCommitCropToQuestion('part_3_short_answer')}
                  className="py-2.5 px-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                >
                  + Cắt Câu Phần III (Điền Số)
                </button>
              </div>

              <p className="text-[11px] text-indigo-900/70">
                💡 Mẹo: Dùng chuột khoanh vùng đề bài hoặc hình vẽ trên bàn cắt bên trên, sau đó bấm một trong 3 nút để phân loại thẳng vào đề thi.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CỘT PHẢI (6 COLS): DANH SÁCH CÂU HỎI ĐÃ CẮT VÀO ĐỀ */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  {questions.length}
                </span>
                <h3 className="font-extrabold text-sm text-slate-900">Danh Sách Câu Hỏi Trong Đề</h3>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-slate-500">Tổng điểm:</span>
                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
                  {totalPoints.toFixed(2)} / 10.0 đ
                </span>
                <button
                  type="button"
                  onClick={() => handleCommitCropToQuestion('part_1_mcq')}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Thêm câu hỏi trống"
                >
                  <Plus size={13} />
                  <span>Thêm Câu</span>
                </button>
              </div>
            </div>

            {/* DANH SÁCH CÁC THẺ CÂU HỎI */}
            {questions.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Scissors size={26} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Chưa có câu hỏi nào được cắt vào đề</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Hãy kéo chuột trên tài liệu bên trái để cắt câu, hoặc nhấn "AI Cắt Tự Động Toàn Đề" ở thanh công cụ phía trên.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isExpanded = activeQuestionId === q.id || activeQuestionId === null;

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        activeQuestionId === q.id
                          ? 'border-indigo-400 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Tiêu đề câu hỏi & Nút điều khiển */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                            {q.questionNumber || idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            Câu {q.questionNumber || idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              q.part === 'part_1_mcq'
                                ? 'bg-blue-100 text-blue-800'
                                : q.part === 'part_2_true_false'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {q.part === 'part_1_mcq' ? 'Phần I (MCQ)' : q.part === 'part_2_true_false' ? 'Phần II (Đúng/Sai)' : 'Phần III (Điền số)'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {q.points || (q.part === 'part_2_true_false' ? 1.0 : q.part === 'part_3_short_answer' ? 0.5 : 0.25)} đ
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            title="Di chuyển lên"
                          >
                            <MoveUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            disabled={idx === questions.length - 1}
                            className="p-1 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            title="Di chuyển xuống"
                          >
                            <MoveDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 hover:text-rose-600 transition-colors cursor-pointer ml-1"
                            title="Xóa câu này"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Ảnh trích xuất từ khung cắt (nếu có) */}
                      {q.pdfAttachmentUrl && (
                        <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-1">
                          <img
                            src={q.pdfAttachmentUrl}
                            alt={`Hình ảnh câu ${q.questionNumber}`}
                            className="max-h-36 object-contain mx-auto"
                          />
                        </div>
                      )}

                      {/* Nội dung đề bài & KaTeX live preview */}
                      <div className="mt-3 space-y-2">
                        <textarea
                          rows={2}
                          value={q.prompt}
                          onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs focus:border-indigo-600 focus:outline-none"
                          placeholder="Nhập nội dung câu hỏi (hỗ trợ công thức $...$)"
                        />
                        {q.prompt.includes('$') && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold">
                            <MathView math={q.prompt} />
                          </div>
                        )}
                      </div>

                      {/* ===================================== */}
                      {/* PHẦN 1: MCQ 4 PHƯƠNG ÁN A, B, C, D */}
                      {/* ===================================== */}
                      {q.part === 'part_1_mcq' && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500 block">
                            Các phương án & Chọn đáp án đúng:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['A', 'B', 'C', 'D'] as const).map((key) => {
                              const opt = q.options?.find((o) => o.key === key) || { key, text: '' };
                              const isCorrect = q.correctAnswer === key;

                              return (
                                <div
                                  key={key}
                                  onClick={() => handleUpdateQuestion(q.id, { correctAnswer: key })}
                                  className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <span
                                    className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {key}
                                  </span>
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const newOptions = (q.options || []).map((o) => (o.key === key ? { ...o, text: e.target.value } : o));
                                      handleUpdateQuestion(q.id, { options: newOptions });
                                    }}
                                    className="w-full bg-transparent text-xs focus:outline-none"
                                    placeholder={`Nội dung ${key}...`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ===================================== */}
                      {/* PHẦN 2: TRẮC NGHIỆM ĐÚNG / SAI 4 Ý a, b, c, d */}
                      {/* ===================================== */}
                      {q.part === 'part_2_true_false' && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500 block">
                            Mệnh đề & Đánh giá tính Đúng / Sai:
                          </span>
                          <div className="space-y-1.5">
                            {q.items?.map((item, itemIdx) => (
                              <div
                                key={item.id || itemIdx}
                                className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="font-bold text-indigo-700 uppercase">{item.subKey})</span>
                                  <input
                                    type="text"
                                    value={item.text}
                                    onChange={(e) => {
                                      const newItems = [...(q.items || [])];
                                      newItems[itemIdx] = { ...newItems[itemIdx], text: e.target.value };
                                      handleUpdateQuestion(q.id, { items: newItems });
                                    }}
                                    className="w-full bg-transparent focus:outline-none font-medium text-slate-800"
                                    placeholder={`Mệnh đề ${item.subKey.toUpperCase()}...`}
                                  />
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...(q.items || [])];
                                      newItems[itemIdx] = { ...newItems[itemIdx], isCorrect: true };
                                      handleUpdateQuestion(q.id, { items: newItems });
                                    }}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                      item.isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                    }`}
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...(q.items || [])];
                                      newItems[itemIdx] = { ...newItems[itemIdx], isCorrect: false };
                                      handleUpdateQuestion(q.id, { items: newItems });
                                    }}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                      !item.isCorrect
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                    }`}
                                  >
                                    Sai
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ===================================== */}
                      {/* PHẦN 3: ĐIỀN ĐÁP SỐ NGẮN */}
                      {/* ===================================== */}
                      {q.part === 'part_3_short_answer' && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                          <label className="font-bold text-slate-700">Đáp án điền số:</label>
                          <input
                            type="text"
                            value={q.correctAnswer || ''}
                            onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value.slice(0, 4) })}
                            className="w-32 h-8 px-2.5 rounded-lg border border-slate-300 font-mono font-bold text-indigo-700 text-center focus:border-indigo-600 focus:outline-none"
                            placeholder="Ví dụ: 15 hoặc -3.5"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

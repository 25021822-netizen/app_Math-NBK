import React, { useState, useRef, useEffect } from 'react';
import { Question, Exam, QuestionPart1MCQ, QuestionPart2TrueFalse, QuestionPart3ShortAnswer, Classroom } from '../../types/math';
import { MathView } from '../MathView';
import { ExamImage } from '../common/ExamImage';
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
  Minimize2,
  FileText,
  Image as ImageIcon,
  Check,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Crosshair,
  ArrowLeft,
  Layers,
  UploadCloud,
  X,
  Target,
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
  classrooms?: Classroom[];
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
  classrooms = [],
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
  const [distributionType, setDistributionType] = useState<'classroom' | 'repository' | 'both'>('classroom');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() =>
    classrooms && classrooms.length > 0 ? classrooms.map((c) => c.id) : []
  );

  // Danh sách câu hỏi đã cắt vào đề (KHÔNG chứa câu hỏi mẫu mặc định)
  const [questions, setQuestions] = useState<Question[]>(() => {
    if (initialQuestions.length > 0) return initialQuestions;
    return [];
  });

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isAiCroppingAll, setIsAiCroppingAll] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'pdf_document'>('canvas');

  useEffect(() => {
    if (selectedClassIds.length === 0 && classrooms && classrooms.length > 0) {
      setSelectedClassIds(classrooms.map((c) => c.id));
    }
  }, [classrooms]);

  // Phân loại câu hỏi đang thao tác / tạo mới
  const [selectedPartType, setSelectedPartType] = useState<'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer'>('part_1_mcq');
  // Bộ lọc hiển thị danh sách câu hỏi bên phải
  const [filterPart, setFilterPart] = useState<'all' | 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer'>('all');

  // Phân biệt lần cắt: Cắt Đề bài (question_prompt) hay Cắt Đáp án (question_answers)
  const [cuttingTargetMode, setCuttingTargetMode] = useState<'question_prompt' | 'question_answers'>('question_prompt');

  // Điều khiển trang PDF
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);

  // Canvas & tương tác cắt khung
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isExpandedView, setIsExpandedView] = useState<boolean>(false);
  const [isDrawingCrop, setIsDrawingCrop] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const pdfDocRef = useRef<any>(null);

  const updateZoom = (updater: number | ((prev: number) => number)) => {
    setZoomLevel((prev) => {
      const rawNext = typeof updater === 'function' ? updater(prev) : updater;
      const next = Math.max(0.5, Math.min(3.5, Number(rawNext.toFixed(2))));
      if (next !== prev) {
        const ratio = next / prev;
        setCropBox((box) =>
          box ? { x: box.x * ratio, y: box.y * ratio, w: box.w * ratio, h: box.h * ratio } : null
        );
      }
      return next;
    });
  };

  // Hỗ trợ Ctrl/Cmd + Cuộn chuột để phóng to/thu nhỏ trực tiếp trên bàn cắt
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        updateZoom((z) => z + delta);
      }
    };
    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [viewMode, isExpandedView]);

  // Khởi tạo tài liệu PDF qua PDF.js khi có documentData
  useEffect(() => {
    if (!documentData?.isPdf || !documentData?.fileBase64) return;
    let isMounted = true;

    const loadPdfDoc = async () => {
      try {
        setIsRenderingPdf(true);
        setPdfRenderError(null);

        let pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
          let attempts = 0;
          while (!pdfjs && attempts < 30) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            pdfjs = (window as any).pdfjsLib;
            attempts++;
          }
        }

        if (!pdfjs) {
          if (isMounted) {
            setPdfRenderError('Đang khởi tạo trình hiển thị PDF...');
            setIsRenderingPdf(false);
          }
          return;
        }

        const rawBase64 = documentData?.fileBase64 || '';
        const cleanB64 = rawBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
        if (!cleanB64) {
          setIsRenderingPdf(false);
          return;
        }
        const binaryString = atob(cleanB64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err: any) {
        console.warn('Lỗi phân giải tệp PDF trên canvas:', err);
        if (isMounted) {
          setPdfRenderError('Không thể nạp trực tiếp PDF lên canvas. Thầy/Cô có thể bấm xem "File PDF Gốc".');
        }
      } finally {
        if (isMounted) setIsRenderingPdf(false);
      }
    };

    loadPdfDoc();

    return () => {
      isMounted = false;
    };
  }, [documentData?.fileBase64, documentData?.isPdf]);

  // Render trang PDF hiện tại lên Canvas khi trang hoặc tài liệu thay đổi
  useEffect(() => {
    if (!pdfDocRef.current) return;
    let isMounted = true;

    const renderCurrentPdfPage = async () => {
      try {
        setIsRenderingPdf(true);
        const page = await pdfDocRef.current.getPage(currentPage);
        if (!isMounted) return;

        const canvas = pageCanvasRef.current;
        if (!canvas) return;

        // Render ở độ nét cao (scale 2.5) để công thức toán siêu nét khi phóng to đến 350%
        const viewport = page.getViewport({ scale: 2.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err: any) {
        console.warn('Lỗi vẽ trang PDF lên canvas:', err);
      } finally {
        if (isMounted) setIsRenderingPdf(false);
      }
    };

    renderCurrentPdfPage();

    return () => {
      isMounted = false;
    };
  }, [currentPage, totalPages, viewMode]);

  // Tự động chọn câu đầu tiên khi danh sách câu hỏi thay đổi nếu chưa có câu nào active
  useEffect(() => {
    if (!activeQuestionId && questions.length > 0) {
      setActiveQuestionId(questions[0].id);
    }
  }, [questions, activeQuestionId]);

  // Bắt đầu vẽ khung cắt với tính toán tọa độ chính xác tuyệt đối
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scaleX = container.offsetWidth / rect.width;
    const scaleY = container.offsetHeight / rect.height;

    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    const x = Math.max(0, Math.min(container.offsetWidth, rawX));
    const y = Math.max(0, Math.min(container.offsetHeight, rawY));

    setIsDrawingCrop(true);
    setCropStart({ x, y });
    setCropBox({ x, y, w: 0, h: 0 });
    setMousePos({ x, y });
  };

  // Kéo chuột để mở rộng khung cắt và cập nhật con trỏ crosshair trực tiếp
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scaleX = container.offsetWidth / rect.width;
    const scaleY = container.offsetHeight / rect.height;

    const currentX = Math.max(0, Math.min(container.offsetWidth, (e.clientX - rect.left) * scaleX));
    const currentY = Math.max(0, Math.min(container.offsetHeight, (e.clientY - rect.top) * scaleY));

    setMousePos({ x: currentX, y: currentY });

    if (!isDrawingCrop || !cropStart) return;

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

  // Khi chuột rời bàn cắt
  const handleMouseLeave = () => {
    setMousePos(null);
    if (isDrawingCrop) {
      setIsDrawingCrop(false);
    }
  };

  // Trích xuất ảnh cắt chất lượng cao từ canvas hoặc hình ảnh thực tế (nén nhẹ JPEG 0.88 để giữ độ nét nhưng không làm phình dung lượng đề thi)
  const getCroppedDataUrl = (): string => {
    const source = pageCanvasRef.current || imageElementRef.current;
    const container = containerRef.current;
    if (!source || !cropBox || cropBox.w < 10 || cropBox.h < 10 || !container) {
      return '';
    }

    try {
      const actualWidth = 'naturalWidth' in source ? (source as HTMLImageElement).naturalWidth : (source as HTMLCanvasElement).width;
      const actualHeight = 'naturalHeight' in source ? (source as HTMLImageElement).naturalHeight : (source as HTMLCanvasElement).height;

      const scaleX = actualWidth / container.offsetWidth;
      const scaleY = actualHeight / container.offsetHeight;

      const srcX = Math.max(0, Math.round(cropBox.x * scaleX));
      const srcY = Math.max(0, Math.round(cropBox.y * scaleY));
      const srcW = Math.min(actualWidth - srcX, Math.round(cropBox.w * scaleX));
      const srcH = Math.min(actualHeight - srcY, Math.round(cropBox.h * scaleY));

      if (srcW <= 0 || srcH <= 0) return '';

      // Tối ưu hóa kích thước tối đa 1200px để giữ nguyên tỉ lệ và độ phân giải cao cho công thức toán
      let outW = srcW;
      let outH = srcH;
      const MAX_WIDTH = 1200;
      if (outW > MAX_WIDTH) {
        outH = Math.round((outH * MAX_WIDTH) / outW);
        outW = MAX_WIDTH;
      }

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = outW;
      cropCanvas.height = outH;
      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        // Dùng JPEG 0.88 để ảnh siêu nét cho KaTeX và đồ thị mà dung lượng chỉ ~15-30KB, không bị mất khi giao vào lớp
        return cropCanvas.toDataURL('image/jpeg', 0.88);
      }
    } catch (err) {
      console.warn('Lỗi cắt ảnh từ tài liệu:', err);
    }
    return '';
  };

  // =========================================================
  // LẦN 1: CẮT ĐỀ BÀI (TẠO CÂU MỚI HOẶC GẮN VÀO CÂU ĐANG CHỌN)
  // =========================================================
  const handleCropNewQuestion = (part: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = selectedPartType) => {
    const snippetDataUrl = getCroppedDataUrl();
    const newQNumber = questions.length + 1;

    let newQuestion: Question;

    if (part === 'part_2_true_false') {
      newQuestion = {
        id: `q_crop_${Date.now()}_${newQNumber}`,
        part: 'part_2_true_false',
        questionNumber: newQNumber,
        prompt: `Câu ${newQNumber}. Xét tính đúng/sai của các mệnh đề sau:`,
        pdfAttachmentUrl: snippetDataUrl || undefined,
        imageAttachment: snippetDataUrl || undefined,
        items: [
          { id: `tf_a_${Date.now()}`, subKey: 'a', text: '', isCorrect: true },
          { id: `tf_b_${Date.now()}`, subKey: 'b', text: '', isCorrect: true },
          { id: `tf_c_${Date.now()}`, subKey: 'c', text: '', isCorrect: false },
          { id: `tf_d_${Date.now()}`, subKey: 'd', text: '', isCorrect: true },
        ],
        explanation: '',
        points: 1.0,
      };
    } else if (part === 'part_3_short_answer') {
      newQuestion = {
        id: `q_crop_${Date.now()}_${newQNumber}`,
        part: 'part_3_short_answer',
        questionNumber: newQNumber,
        prompt: `Câu ${newQNumber}. Điền đáp số của bài toán:`,
        pdfAttachmentUrl: snippetDataUrl || undefined,
        imageAttachment: snippetDataUrl || undefined,
        correctAnswer: '',
        explanation: '',
        points: 0.5,
      };
    } else {
      newQuestion = {
        id: `q_crop_${Date.now()}_${newQNumber}`,
        part: 'part_1_mcq',
        questionNumber: newQNumber,
        prompt: `Câu ${newQNumber}. Chọn một phương án đúng nhất:`,
        pdfAttachmentUrl: snippetDataUrl || undefined,
        imageAttachment: snippetDataUrl || undefined,
        options: [
          { key: 'A', text: '' },
          { key: 'B', text: '' },
          { key: 'C', text: '' },
          { key: 'D', text: '' },
        ],
        correctAnswer: 'A',
        explanation: '',
        points: 0.25,
      };
    }

    setQuestions((prev) => [...prev, newQuestion]);
    setActiveQuestionId(newQuestion.id);
    setCropBox(null);
    setStatusMessage(`Đã cắt Đề Bài thành công và tạo Câu ${newQNumber}! Thầy/Cô có thể tiếp tục cắt đáp án cho câu này.`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Cắt và cập nhật lại đề bài cho câu đang chọn
  const handleUpdatePromptImageForActiveQuestion = () => {
    if (!activeQuestionId) {
      setStatusMessage('Vui lòng chọn một câu hỏi ở cột bên phải để gắn đề bài!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    const snippetDataUrl = getCroppedDataUrl();
    if (!snippetDataUrl) {
      setStatusMessage('Vui lòng khoanh vùng khu vực đề bài trên bàn cắt trước khi bấm!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    handleUpdateQuestion(activeQuestionId, {
      pdfAttachmentUrl: snippetDataUrl,
      imageAttachment: snippetDataUrl,
    });
    const targetQ = questions.find((q) => q.id === activeQuestionId);
    setStatusMessage(`Đã cập nhật ảnh đề bài cho Câu ${targetQ?.questionNumber || ''}!`);
    setCropBox(null);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // =========================================================
  // LẦN 2: CẮT ĐÁP ÁN (PHẦN TRẮC NGHIỆM VÀ PHẦN ĐÚNG SAI)
  // =========================================================

  // Cắt riêng từng phương án A, B, C, D (Phần I - MCQ)
  const handleCropOptionForActiveQuestion = (optKey: 'A' | 'B' | 'C' | 'D') => {
    if (!activeQuestionId) {
      setStatusMessage('Vui lòng chọn một câu trắc nghiệm ở cột bên phải trước khi cắt đáp án!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    const snippet = getCroppedDataUrl();
    if (!snippet) {
      setStatusMessage(`Vui lòng khoanh vùng phương án ${optKey} trên tài liệu trước khi bấm cắt!`);
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== activeQuestionId || q.part !== 'part_1_mcq') return q;
        const currentOpts = q.options || [
          { key: 'A', text: '' },
          { key: 'B', text: '' },
          { key: 'C', text: '' },
          { key: 'D', text: '' },
        ];
        const newOpts = currentOpts.map((opt) => (opt.key === optKey ? { ...opt, imageUrl: snippet } : opt));
        return { ...q, options: newOpts } as QuestionPart1MCQ;
      })
    );
    setCropBox(null);
    const targetQ = questions.find((q) => q.id === activeQuestionId);
    setStatusMessage(`Đã cắt thành công phương án [${optKey}] cho Câu ${targetQ?.questionNumber || ''}!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Cắt riêng từng ý a, b, c, d (Phần II - Đúng / Sai)
  const handleCropItemForActiveQuestion = (subKey: 'a' | 'b' | 'c' | 'd') => {
    if (!activeQuestionId) {
      setStatusMessage('Vui lòng chọn một câu Đúng/Sai ở cột bên phải trước khi cắt ý!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    const snippet = getCroppedDataUrl();
    if (!snippet) {
      setStatusMessage(`Vui lòng khoanh vùng mệnh đề ${subKey}) trên tài liệu trước khi bấm cắt!`);
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== activeQuestionId || q.part !== 'part_2_true_false') return q;
        const currentItems = q.items || [
          { id: `tf_a_${Date.now()}`, subKey: 'a', text: '', isCorrect: true },
          { id: `tf_b_${Date.now()}`, subKey: 'b', text: '', isCorrect: true },
          { id: `tf_c_${Date.now()}`, subKey: 'c', text: '', isCorrect: false },
          { id: `tf_d_${Date.now()}`, subKey: 'd', text: '', isCorrect: true },
        ];
        const newItems = currentItems.map((item) => (item.subKey === subKey ? { ...item, imageUrl: snippet } : item));
        return { ...q, items: newItems } as QuestionPart2TrueFalse;
      })
    );
    setCropBox(null);
    const targetQ = questions.find((q) => q.id === activeQuestionId);
    setStatusMessage(`Đã cắt thành công mệnh đề [${subKey})] cho Câu ${targetQ?.questionNumber || ''}!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Cắt khối cả 4 đáp án (A-B-C-D hoặc a-b-c-d liền nhau)
  const handleCropOptionsBlockForActiveQuestion = () => {
    if (!activeQuestionId) {
      setStatusMessage('Vui lòng chọn câu hỏi ở cột bên phải để gắn khối đáp án!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    const snippet = getCroppedDataUrl();
    if (!snippet) {
      setStatusMessage('Vui lòng khoanh vùng khối các đáp án trên tài liệu trước khi bấm!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    handleUpdateQuestion(activeQuestionId, { optionsAttachmentUrl: snippet });
    setCropBox(null);
    const targetQ = questions.find((q) => q.id === activeQuestionId);
    setStatusMessage(`Đã gắn khối đáp án vào Câu ${targetQ?.questionNumber || ''}!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Cắt đáp số / lời giải ngắn (Phần III)
  const handleCropShortAnswerForActiveQuestion = () => {
    if (!activeQuestionId) {
      setStatusMessage('Vui lòng chọn câu hỏi ở cột bên phải!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    const snippet = getCroppedDataUrl();
    if (!snippet) {
      setStatusMessage('Vui lòng khoanh vùng đáp số / lời giải trên tài liệu!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    handleUpdateQuestion(activeQuestionId, { optionsAttachmentUrl: snippet });
    setCropBox(null);
    const targetQ = questions.find((q) => q.id === activeQuestionId);
    setStatusMessage(`Đã gắn ảnh đáp số/lời giải vào Câu ${targetQ?.questionNumber || ''}!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Xóa ảnh phương án riêng
  const handleRemoveOptionImage = (qId: string, optKey: 'A' | 'B' | 'C' | 'D') => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId || q.part !== 'part_1_mcq') return q;
        const newOpts = (q.options || []).map((opt) => (opt.key === optKey ? { ...opt, imageUrl: undefined } : opt));
        return { ...q, options: newOpts } as QuestionPart1MCQ;
      })
    );
  };

  // Xóa ảnh ý Đúng/Sai riêng
  const handleRemoveItemImage = (qId: string, subKey: 'a' | 'b' | 'c' | 'd') => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId || q.part !== 'part_2_true_false') return q;
        const newItems = (q.items || []).map((item) => (item.subKey === subKey ? { ...item, imageUrl: undefined } : item));
        return { ...q, items: newItems } as QuestionPart2TrueFalse;
      })
    );
  };

  // Tự động nhận diện và bóc tách toàn bộ câu hỏi (KHÔNG tạo câu hỏi mẫu rác khi không tìm thấy)
  const handleAutoCropAllQuestions = async () => {
    setIsAiCroppingAll(true);
    setStatusMessage('AI Gemini đang quét tài liệu và bóc tách các câu hỏi chuẩn BGD 2025...');

    try {
      let parsed: any = null;

      // 1. Thử gọi API Gemini bóc tách từ file PDF base64 hoặc văn bản LaTeX
      if (documentData?.fileBase64 || documentData?.extractedText) {
        try {
          const resp = await fetch('/api/gemini/parse-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfBase64: documentData?.isPdf ? documentData.fileBase64 : undefined,
              latexText: !documentData?.isPdf ? documentData.extractedText : undefined,
              grade: examGrade,
              durationMinutes: examDuration,
              examTitle: examTitle,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.parsedExam && Array.isArray(data.parsedExam.questions) && data.parsedExam.questions.length > 0) {
              parsed = data.parsedExam;
            }
          }
        } catch (serverErr) {
          console.warn('[QuestionCropStudio] Lỗi gọi Gemini parse-pdf:', serverErr);
        }
      }

      // 2. Dự phòng bằng bộ giải mã thông minh nội bộ
      if (!parsed || !parsed.questions || parsed.questions.length === 0) {
        const textToParse = documentData?.extractedText || documentData?.fileName || '';
        const cleaned = cleanPdfNoiseAndOcr(textToParse);
        parsed = parseExamFromLatexOrText(cleaned.cleanedText || textToParse, examGrade, examDuration, examTitle);
      }

      if (parsed && parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.metadata?.title) setExamTitle(parsed.metadata.title);
        if (parsed.metadata?.durationMinutes) setExamDuration(parsed.metadata.durationMinutes);
        if (parsed.metadata?.grade) setExamGrade(parsed.metadata.grade);
        setActiveQuestionId(parsed.questions[0].id);
        setStatusMessage(`AI đã tự động bóc tách thành công ${parsed.questions.length} câu hỏi vào đề thi!`);
      } else {
        // KHÔNG TẠO CÂU HỎI MẪU RÁC: Chỉ thông báo để người dùng khoanh vùng cắt trực tiếp
        setStatusMessage('Chưa tìm thấy câu hỏi tự động. Thầy/Cô hãy kéo chuột khoanh vùng để cắt câu hỏi và đáp án trực tiếp từ đề.');
      }
    } catch (err) {
      console.warn('Lỗi auto crop:', err);
      setStatusMessage('Thầy/Cô hãy kéo chuột khoanh vùng để cắt câu hỏi trực tiếp từ đề.');
    } finally {
      setIsAiCroppingAll(false);
      setTimeout(() => setStatusMessage(null), 4500);
    }
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
    const reindexed = copy.map((q, i) => ({ ...q, questionNumber: i + 1 } as Question));
    setQuestions(reindexed);
  };

  // Tính tổng điểm đề thi
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // Thống kê số lượng câu từng phần
  const p1Count = questions.filter((q) => q.part === 'part_1_mcq').length;
  const p2Count = questions.filter((q) => q.part === 'part_2_true_false').length;
  const p3Count = questions.filter((q) => q.part === 'part_3_short_answer').length;

  // Lọc câu hỏi theo tab
  const filteredQuestions = questions.filter((q) => {
    if (filterPart === 'all') return true;
    return q.part === filterPart;
  });

  const activeQuestion = questions.find((q) => q.id === activeQuestionId);

  // Xuất bản đề thi trực tiếp
  const handlePublishDirectly = () => {
    setCropError(null);
    if (questions.length === 0) {
      setCropError('Vui lòng cắt ít nhất 1 câu hỏi vào đề thi trước khi xuất bản!');
      return;
    }

    const finalTargetClassIds =
      distributionType === 'repository'
        ? undefined
        : selectedClassIds.length > 0
        ? selectedClassIds
        : classrooms && classrooms.length > 0
        ? classrooms.map((c) => c.id)
        : undefined;

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
      distributionType,
      targetClassIds: finalTargetClassIds,
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
      {/* TOP HEADER & THANH ĐIỀU KHIỂN PHÒNG CẮT CÂU */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Scissors size={14} className="text-indigo-600" />
                <span>Bàn Cắt Trực Quan</span>
              </span>
              {documentData && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-bold">
                  {documentData.fileName} ({documentData.fileSize})
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              Khu Vực Cắt Câu Hỏi & Đáp Án Từ Đề Thi
            </h1>
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

        {cropError && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <span>{cropError}</span>
            <button
              type="button"
              onClick={() => setCropError(null)}
              className="text-rose-600 hover:text-rose-900"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* THANH CẤU HÌNH THÔNG SỐ ĐỀ THI & GIAO LỚP */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs pt-1">
          <div className="sm:col-span-5 space-y-1">
            <label className="font-bold text-slate-700">Tên Đề Thi *</label>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 font-semibold focus:border-indigo-600 focus:outline-none"
              placeholder="Nhập tên đề thi hiển thị..."
            />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="font-bold text-slate-700">Khối Lớp *</label>
            <select
              value={examGrade}
              onChange={(e) => setExamGrade(Number(e.target.value) as 10 | 11 | 12)}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 font-bold focus:border-indigo-600 focus:outline-none bg-white cursor-pointer"
            >
              <option value={10}>Lớp 10</option>
              <option value={11}>Lớp 11</option>
              <option value={12}>Lớp 12</option>
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="font-bold text-slate-700">Thời Gian *</label>
            <select
              value={examDuration}
              onChange={(e) => setExamDuration(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl border border-slate-300 font-bold focus:border-indigo-600 focus:outline-none bg-white cursor-pointer"
            >
              <option value={45}>45 Phút</option>
              <option value={60}>60 Phút</option>
              <option value={90}>90 Phút</option>
              <option value={120}>120 Phút</option>
            </select>
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="font-bold text-slate-700">Phân Phối / Giao Đề *</label>
            <select
              value={distributionType}
              onChange={(e) => setDistributionType(e.target.value as any)}
              className="w-full h-9 px-3 rounded-xl border border-indigo-300 font-bold text-indigo-900 bg-indigo-50/60 focus:outline-none cursor-pointer"
            >
              <option value="classroom">Giao trực tiếp cho Nhóm Lớp</option>
              <option value="both">Cả hai (Kho Đề & Nhóm Lớp)</option>
              <option value="repository">Chỉ lưu vào Kho Đề</option>
            </select>
          </div>
        </div>

        {/* Danh sách nhóm lớp được giao nếu chọn classroom / both */}
        {distributionType !== 'repository' && classrooms && classrooms.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-slate-100">
            <span className="font-bold text-slate-600 text-[11px]">Nhóm lớp nhận đề thi:</span>
            {classrooms.map((cls) => {
              const isSelected = selectedClassIds.includes(cls.id);
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => {
                    setSelectedClassIds((prev) =>
                      prev.includes(cls.id) ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {cls.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* KHÔNG GIAN LÀM VIỆC CHÍNH: 2 CỘT (CẮT TÀI LIỆU | DANH SÁCH CÂU HỎI) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* CỘT TRÁI: BÀN CẮT TÀI LIỆU VỚI CON TRỎ BẮN TỌA ĐỘ */}
        {/* ========================================================= */}
        <div className={`${isExpandedView ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4 transition-all`}>
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            {/* Thanh công cụ Bàn Cắt */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Crosshair size={18} className="text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Bàn Cắt Laser Trực Quan</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                  {mousePos ? `X: ${Math.round(mousePos.x)} | Y: ${Math.round(mousePos.y)}` : 'Sẵn sàng'}
                </span>
              </div>

              {/* Chuyển trang PDF */}
              {documentData?.isPdf && totalPages > 1 && (
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 p-1 rounded-xl text-xs font-bold text-indigo-950">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || isRenderingPdf}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      setCropBox(null);
                    }}
                    className="p-1 rounded-lg hover:bg-indigo-100 disabled:opacity-40 transition-colors cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="px-1 text-[11px] font-mono">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages || isRenderingPdf}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      setCropBox(null);
                    }}
                    className="p-1 rounded-lg hover:bg-indigo-100 disabled:opacity-40 transition-colors cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}

              {/* Chuyển đổi giữa Xem PDF gốc và Bàn Cắt Khung */}
              {documentData?.isPdf && documentData?.fileBase64 && (
                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setViewMode('canvas')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      viewMode === 'canvas' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Scissors size={13} />
                    <span>Bàn Cắt Khung</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('pdf_document')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      viewMode === 'pdf_document' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText size={13} />
                    <span>File PDF Gốc</span>
                  </button>
                </div>
              )}

              {/* Các công cụ zoom, phóng to bàn cắt và xoay */}
              {viewMode === 'canvas' && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 flex-wrap">
                  <button
                    type="button"
                    onClick={() => updateZoom((z) => z - 0.25)}
                    className="p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                    title="Thu nhỏ (-25%)"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <select
                    value={String(Math.round(zoomLevel * 100))}
                    onChange={(e) => updateZoom(Number(e.target.value) / 100)}
                    className="px-1.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono font-bold text-slate-800 cursor-pointer focus:outline-none"
                    title="Chọn mức thu phóng đề"
                  >
                    {[50, 75, 100, 125, 150, 175, 200, 250, 300, 350].map((pct) => (
                      <option key={pct} value={String(pct)}>
                        {pct}%
                      </option>
                    ))}
                    {![50, 75, 100, 125, 150, 175, 200, 250, 300, 350].includes(Math.round(zoomLevel * 100)) && (
                      <option value={String(Math.round(zoomLevel * 100))}>
                        {Math.round(zoomLevel * 100)}%
                      </option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateZoom((z) => z + 0.25)}
                    className="p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                    title="Phóng to (+25%)"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateZoom(1)}
                    className={`px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                      Math.round(zoomLevel * 100) === 100 ? 'bg-white text-indigo-700 shadow-2xs' : 'hover:bg-white'
                    }`}
                    title="Khớp vừa khung (100%)"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => updateZoom(2)}
                    className={`px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                      Math.round(zoomLevel * 100) === 200 ? 'bg-white text-indigo-700 shadow-2xs' : 'hover:bg-white'
                    }`}
                    title="Phóng to 200% để cắt chi tiết"
                  >
                    200%
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotationAngle((r) => (r + 90) % 360)}
                    className="p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                    title="Xoay 90 độ"
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExpandedView((v) => !v)}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${
                      isExpandedView ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-white text-indigo-700'
                    }`}
                    title={isExpandedView ? 'Thu gọn bàn cắt về 2 cột' : 'Mở rộng bàn cắt toàn chiều ngang'}
                  >
                    {isExpandedView ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isExpandedView ? 'Thu gọn' : 'Mở rộng'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* VÙNG HIỂN THỊ TÀI LIỆU & CON TRỎ BẮN TỌA ĐỘ TRỰC TIẾP */}
            {viewMode === 'pdf_document' && documentData?.fileBase64 ? (
              <div className={`relative rounded-2xl bg-slate-900 overflow-hidden border border-slate-800 min-h-[520px] ${isExpandedView ? 'h-[78vh]' : 'h-[680px]'} flex items-center justify-center`}>
                <object
                  data={documentData.fileBase64}
                  type="application/pdf"
                  className="w-full h-full rounded-2xl"
                  title="Tài liệu PDF đề thi"
                >
                  <iframe src={documentData.fileBase64} className="w-full h-full rounded-2xl" title="PDF Frame" />
                </object>
              </div>
            ) : (
              <div
                ref={viewportRef}
                className={`relative rounded-2xl bg-slate-900 border border-slate-800 min-h-[480px] ${isExpandedView ? 'max-h-[78vh]' : 'max-h-[680px]'} select-none overflow-auto p-4`}
              >
                {isRenderingPdf && (
                  <div className="absolute inset-0 bg-slate-950/70 z-30 flex flex-col items-center justify-center gap-2 text-white">
                    <Loader2 size={28} className="animate-spin text-indigo-400" />
                    <span className="text-xs font-bold">Đang tải và hiển thị Trang {currentPage}...</span>
                  </div>
                )}

                {pdfRenderError && (
                  <div className="p-3 mb-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 z-20 w-full max-w-md mx-auto">
                    <span>{pdfRenderError}</span>
                    <button
                      type="button"
                      onClick={() => setViewMode('pdf_document')}
                      className="px-2 py-1 rounded bg-amber-400 text-slate-900 font-bold text-[10px]"
                    >
                      Mở PDF Gốc
                    </button>
                  </div>
                )}

                <div
                  ref={containerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    width: `${Math.round(zoomLevel * 100)}%`,
                    transform: rotationAngle !== 0 ? `rotate(${rotationAngle}deg)` : undefined,
                    transformOrigin: 'center center',
                    transition: isDrawingCrop ? 'none' : 'width 0.12s ease, transform 0.15s ease',
                  }}
                  className="relative cursor-crosshair block mx-auto shadow-2xl rounded-lg overflow-hidden bg-white"
                >
                  {documentData?.isPdf && documentData?.fileBase64 ? (
                    <canvas
                      ref={pageCanvasRef}
                      className="w-full h-auto block pointer-events-none"
                    />
                  ) : documentData?.fileBase64 && !documentData.isPdf ? (
                    <img
                      ref={imageElementRef}
                      src={documentData.fileBase64}
                      alt="Tài liệu đề thi"
                      className="w-full h-auto block pointer-events-none"
                    />
                  ) : (
                    // Khi chưa có file PDF / Hình ảnh tải lên: Hiển thị hướng dẫn kéo thả sạch sẽ, không có câu hỏi mẫu giả
                    <div className="w-full min-h-[520px] bg-slate-50 text-slate-800 p-8 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-slate-300 rounded-lg">
                      <div className="w-16 h-16 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                        <UploadCloud size={32} />
                      </div>
                      <div className="max-w-xs space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-800">Chưa có tệp đề thi tải lên</h4>
                      </div>
                      <button
                        type="button"
                        onClick={onBackToUpload}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        Quay lại chọn tệp đề thi
                      </button>
                    </div>
                  )}

                  {/* TIA LASER CON TRỎ CẮT BẮN TỌA ĐỘ TRỰC TIẾP TỪ ĐỀ (CROSSHAIR GUIDELINES) */}
                  {mousePos && (
                    <>
                      {/* Đường laser ngang */}
                      <div
                        className="absolute left-0 right-0 pointer-events-none z-20 border-t border-dashed border-red-500/70"
                        style={{ top: `${mousePos.y}px` }}
                      />
                      {/* Đường laser dọc */}
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none z-20 border-l border-dashed border-red-500/70"
                        style={{ left: `${mousePos.x}px` }}
                      />
                      {/* Tâm ngắm (Reticle) */}
                      <div
                        className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
                      >
                        <div className="w-5 h-5 rounded-full border border-red-500 bg-red-500/10 flex items-center justify-center shadow-xs">
                          <div className="w-1 h-1 rounded-full bg-red-600" />
                        </div>
                        {/* Thẻ chỉ dẫn tọa độ bám sát con trỏ */}
                        <div className="absolute left-3.5 top-3.5 px-2 py-0.5 rounded-md bg-slate-900/90 text-white font-mono text-[9px] whitespace-nowrap shadow-lg border border-slate-700 pointer-events-none flex items-center gap-1">
                          <Target size={10} className="text-red-400" />
                          <span>
                            {Math.round(mousePos.x)}, {Math.round(mousePos.y)}
                            {isDrawingCrop && cropBox ? ` (${Math.round(cropBox.w)}×${Math.round(cropBox.h)})` : ''}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* KHUNG CẮT ĐANG KÉO (CROP BOUNDING BOX) VỚI ĐIỂM NEO */}
                  {cropBox && cropBox.w > 5 && cropBox.h > 5 && (
                    <div
                      style={{
                        left: cropBox.x,
                        top: cropBox.y,
                        width: cropBox.w,
                        height: cropBox.h,
                      }}
                      className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/20 pointer-events-none z-20 flex items-start justify-end p-1.5 shadow-lg"
                    >
                      {/* 4 Điểm neo góc định vị */}
                      <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-xs shadow-xs" />
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-xs shadow-xs" />
                      <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-xs shadow-xs" />
                      <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-xs shadow-xs" />

                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shadow-md">
                        {Math.round(cropBox.w)} × {Math.round(cropBox.h)} px
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* BẢNG ĐIỀU KHIỂN CẮT PHÂN BIỆT: ĐỀ BÀI vs ĐÁP ÁN */}
            {/* ========================================================= */}
            <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
              {/* Tab chuyển đổi mục tiêu: Cắt Đề Bài vs Cắt Đáp Án */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex bg-slate-200 p-1 rounded-2xl text-xs font-bold w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setCuttingTargetMode('question_prompt')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      cuttingTargetMode === 'question_prompt'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Scissors size={14} />
                    <span>Lần Cắt 1: Cắt Đề Bài</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCuttingTargetMode('question_answers')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      cuttingTargetMode === 'question_answers'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>Lần Cắt 2: Cắt Đáp Án</span>
                  </button>
                </div>

                {cropBox && cropBox.w > 20 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      Đã khoanh: {Math.round(cropBox.w)} × {Math.round(cropBox.h)} px
                    </span>
                    <button
                      type="button"
                      onClick={() => setCropBox(null)}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                    >
                      Hủy khung
                    </button>
                  </div>
                )}
              </div>

              {/* ===================================== */}
              {/* NỘI DUNG LẦN CẮT 1: CẮT ĐỀ BÀI */}
              {/* ===================================== */}
              {cuttingTargetMode === 'question_prompt' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Layers size={14} className="text-indigo-600" />
                      <span>Chọn Loại Câu Hỏi Cần Tạo Từ Vùng Cắt:</span>
                    </span>
                    {activeQuestion && (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                        Đang chọn: Câu {activeQuestion.questionNumber}
                      </span>
                    )}
                  </div>

                  {/* Nút phân loại câu hỏi (Phần I, II, III) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPartType('part_1_mcq')}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPartType === 'part_1_mcq'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-black text-xs text-blue-900 block">Phần I. Trắc Nghiệm</span>
                      <span className="text-[10px] text-blue-700 block mt-0.5">4 Lựa chọn (A, B, C, D) • 0.25đ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPartType('part_2_true_false')}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPartType === 'part_2_true_false'
                          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-black text-xs text-indigo-900 block">Phần II. Đúng / Sai</span>
                      <span className="text-[10px] text-indigo-700 block mt-0.5">4 Ý (a, b, c, d) • Tối đa 1.0đ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPartType('part_3_short_answer')}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPartType === 'part_3_short_answer'
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-black text-xs text-purple-900 block">Phần III. Điền Số</span>
                      <span className="text-[10px] text-purple-700 block mt-0.5">Trả lời ngắn • 0.5đ/câu</span>
                    </button>
                  </div>

                  {/* Hành động cắt đề bài */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCropNewQuestion(selectedPartType)}
                      className="py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Plus size={15} />
                      <span>
                        Cắt Vùng Đề Bài & Tạo Câu Mới ({selectedPartType === 'part_1_mcq' ? 'Phần I' : selectedPartType === 'part_2_true_false' ? 'Phần II' : 'Phần III'})
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!activeQuestionId}
                      onClick={handleUpdatePromptImageForActiveQuestion}
                      className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ImageIcon size={15} />
                      <span>
                        Gắn Làm Đề Bài Cho Câu {activeQuestion ? activeQuestion.questionNumber : 'Đang Chọn'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* NỘI DUNG LẦN CẮT 2: CẮT ĐÁP ÁN (MCQ & ĐÚNG/SAI) */}
              {/* ===================================== */}
              {cuttingTargetMode === 'question_answers' && (
                <div className="space-y-3 animate-in fade-in">
                  {!activeQuestion ? (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold text-center">
                      Thầy/Cô vui lòng nhấp chọn một câu hỏi ở cột bên phải để bắt đầu cắt đáp án cho câu đó!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>
                            Cắt Đáp Án Cho: Câu {activeQuestion.questionNumber} (
                            {activeQuestion.part === 'part_1_mcq'
                              ? 'Trắc Nghiệm 4 Lựa Chọn'
                              : activeQuestion.part === 'part_2_true_false'
                              ? 'Đúng / Sai 4 Ý'
                              : 'Trả Lời Ngắn'}
                            )
                          </span>
                        </span>
                      </div>

                      {/* 1. Nếu là Phần I: Trắc nghiệm 4 lựa chọn (A, B, C, D) */}
                      {activeQuestion.part === 'part_1_mcq' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['A', 'B', 'C', 'D'] as const).map((key) => {
                              const hasImg = activeQuestion.options?.find((o) => o.key === key)?.imageUrl;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleCropOptionForActiveQuestion(key)}
                                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                    hasImg
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-black'
                                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 font-bold'
                                  }`}
                                >
                                  <span className="block text-xs">✂️ Cắt Phương Án [{key}]</span>
                                  <span className="block text-[10px] text-slate-500 mt-0.5">
                                    {hasImg ? 'Đã có ảnh (Bấm để cắt lại)' : 'Chưa có ảnh'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={handleCropOptionsBlockForActiveQuestion}
                              className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Crop size={14} />
                              <span>Cắt Khối Cả 4 Đáp Án (A, B, C, D liền nhau)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. Nếu là Phần II: Đúng / Sai 4 ý (a, b, c, d) */}
                      {activeQuestion.part === 'part_2_true_false' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['a', 'b', 'c', 'd'] as const).map((subKey) => {
                              const hasImg = activeQuestion.items?.find((it) => it.subKey === subKey)?.imageUrl;
                              return (
                                <button
                                  key={subKey}
                                  type="button"
                                  onClick={() => handleCropItemForActiveQuestion(subKey)}
                                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                    hasImg
                                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-black'
                                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 font-bold'
                                  }`}
                                >
                                  <span className="block text-xs">✂️ Cắt Ý [{subKey})]</span>
                                  <span className="block text-[10px] text-slate-500 mt-0.5">
                                    {hasImg ? 'Đã có ảnh (Cắt lại)' : 'Chưa có ảnh'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={handleCropOptionsBlockForActiveQuestion}
                              className="w-full py-2.5 px-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Crop size={14} />
                              <span>Cắt Khối Cả 4 Mệnh Đề (a, b, c, d liền nhau)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 3. Nếu là Phần III: Trả lời ngắn */}
                      {activeQuestion.part === 'part_3_short_answer' && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={handleCropShortAnswerForActiveQuestion}
                            className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Crop size={14} />
                            <span>Cắt Vùng Đáp Số / Hướng Dẫn Giải Ngắn</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CỘT PHẢI: DANH SÁCH CÂU HỎI ĐÃ CẮT VÀO ĐỀ */}
        {/* ========================================================= */}
        <div className={`${isExpandedView ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4 transition-all`}>
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            {/* Header danh sách & Điểm */}
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
                  onClick={() => handleCropNewQuestion(selectedPartType)}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Thêm câu hỏi mới"
                >
                  <Plus size={13} />
                  <span>Thêm Câu</span>
                </button>
              </div>
            </div>

            {/* BỘ LỌC CÂU HỎI THEO PHẦN */}
            <div className="flex items-center gap-1.5 flex-wrap bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterPart('all')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  filterPart === 'all' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterPart('part_1_mcq')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  filterPart === 'part_1_mcq' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Phần I ({p1Count})
              </button>
              <button
                type="button"
                onClick={() => setFilterPart('part_2_true_false')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  filterPart === 'part_2_true_false' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Phần II ({p2Count})
              </button>
              <button
                type="button"
                onClick={() => setFilterPart('part_3_short_answer')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  filterPart === 'part_3_short_answer' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Phần III ({p3Count})
              </button>
            </div>

            {/* DANH SÁCH CÁC THẺ CÂU HỎI */}
            {filteredQuestions.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Scissors size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Chưa có câu hỏi nào trong đề</h4>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[720px] overflow-y-auto pr-1">
                {filteredQuestions.map((q, idx) => {
                  const isActive = activeQuestionId === q.id;

                  return (
                    <div
                      key={q.id}
                      onClick={() => setActiveQuestionId(q.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50/20 shadow-md ring-2 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Tiêu đề thẻ câu hỏi & Nút điều khiển */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-xs ${
                              isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {q.questionNumber || idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
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

                        <div className="flex items-center gap-1 text-slate-400" onClick={(e) => e.stopPropagation()}>
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

                      {/* ẢNH ĐỀ BÀI ĐÃ CẮT (LẦN 1) */}
                      {(q.pdfAttachmentUrl || q.imageAttachment) && (
                        <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 relative group">
                          <div className="flex items-center justify-between pb-1 text-[10px] font-bold text-slate-500">
                            <span>🖼️ Ảnh Đề Bài Đã Cắt:</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateQuestion(q.id, { pdfAttachmentUrl: undefined, imageAttachment: undefined });
                              }}
                              className="text-rose-600 hover:text-rose-800 underline cursor-pointer"
                            >
                              Xóa ảnh
                            </button>
                          </div>
                          <ExamImage
                            src={q.pdfAttachmentUrl || q.imageAttachment}
                            alt={`Đề bài câu ${q.questionNumber}`}
                            className="max-h-36 max-w-full w-auto object-contain mx-auto rounded"
                          />
                        </div>
                      )}

                      {/* ẢNH KHỐI CẢ 4 ĐÁP ÁN (NẾU CẮT NGUYÊN KHỐI) */}
                      {q.optionsAttachmentUrl && (
                        <div className="mt-2.5 rounded-xl overflow-hidden border border-teal-200 bg-teal-50/50 p-2 relative group">
                          <div className="flex items-center justify-between pb-1 text-[10px] font-bold text-teal-800">
                            <span>📑 Khối Đáp Án Đã Cắt:</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateQuestion(q.id, { optionsAttachmentUrl: undefined });
                              }}
                              className="text-rose-600 hover:text-rose-800 underline cursor-pointer"
                            >
                              Xóa khối đáp án
                            </button>
                          </div>
                          <ExamImage
                            src={q.optionsAttachmentUrl}
                            alt={`Khối đáp án câu ${q.questionNumber}`}
                            className="max-h-32 max-w-full w-auto object-contain mx-auto rounded"
                          />
                        </div>
                      )}

                      {/* Nội dung đề bài dạng text / LaTeX */}
                      <div className="mt-3 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          rows={2}
                          value={q.prompt}
                          onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                          className="w-full p-2 rounded-xl border border-slate-200 font-mono text-xs focus:border-indigo-600 focus:outline-none"
                          placeholder="Nhập nội dung đề bài (tùy chọn nếu đã cắt ảnh)..."
                        />
                        {q.prompt && q.prompt.includes('$') && (
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold">
                            <MathView math={q.prompt} />
                          </div>
                        )}
                      </div>

                      {/* ===================================== */}
                      {/* PHẦN 1: MCQ 4 PHƯƠNG ÁN A, B, C, D */}
                      {/* ===================================== */}
                      {q.part === 'part_1_mcq' && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-600">
                              Các Phương Án (Nhấp chọn đáp án đúng):
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Đáp án đúng: <strong className="text-emerald-700">{q.correctAnswer}</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['A', 'B', 'C', 'D'] as const).map((key) => {
                              const opt = q.options?.find((o) => o.key === key) || { key, text: '' };
                              const isCorrect = q.correctAnswer === key;

                              return (
                                <div
                                  key={key}
                                  onClick={() => handleUpdateQuestion(q.id, { correctAnswer: key })}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-300'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`w-5 h-5 rounded-md text-[11px] font-black flex items-center justify-center shrink-0 ${
                                          isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                                        }`}
                                      >
                                        {key}
                                      </span>
                                      <span className="text-[11px]">
                                        {isCorrect ? 'Đáp Án Đúng' : `Phương Án ${key}`}
                                      </span>
                                    </div>

                                    {opt.imageUrl && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveOptionImage(q.id, key);
                                        }}
                                        className="text-[10px] text-rose-500 hover:text-rose-700 underline"
                                      >
                                        Xóa ảnh
                                      </button>
                                    )}
                                  </div>

                                  {/* Hiển thị ảnh phương án nếu đã cắt */}
                                  {opt.imageUrl ? (
                                    <div className="rounded border border-slate-200 bg-white p-1 my-1">
                                      <ExamImage
                                        src={opt.imageUrl}
                                        alt={`Phương án ${key}`}
                                        className="max-h-16 max-w-full w-auto object-contain mx-auto"
                                      />
                                    </div>
                                  ) : null}

                                  <input
                                    type="text"
                                    value={opt.text}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const newOptions = (q.options || []).map((o) => (o.key === key ? { ...o, text: e.target.value } : o));
                                      handleUpdateQuestion(q.id, { options: newOptions });
                                    }}
                                    className="w-full bg-white/70 px-2 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                                    placeholder={opt.imageUrl ? 'Công thức (tùy chọn)...' : `Nhập nội dung ${key}...`}
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
                        <div className="mt-3 space-y-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] font-black text-slate-600 block">
                            4 Mệnh Đề Độc Lập (Đánh giá tính Đúng / Sai):
                          </span>

                          <div className="space-y-2">
                            {q.items?.map((item, itemIdx) => (
                              <div
                                key={item.id || itemIdx}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-black flex items-center justify-center shrink-0 uppercase">
                                      {item.subKey}
                                    </span>
                                    <input
                                      type="text"
                                      value={item.text}
                                      onChange={(e) => {
                                        const newItems = [...(q.items || [])];
                                        newItems[itemIdx] = { ...newItems[itemIdx], text: e.target.value };
                                        handleUpdateQuestion(q.id, { items: newItems });
                                      }}
                                      className="w-full bg-transparent text-xs focus:outline-none font-medium text-slate-800"
                                      placeholder={item.imageUrl ? 'Đã cắt ảnh mệnh đề...' : `Nội dung mệnh đề ${item.subKey.toUpperCase()}...`}
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
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                        item.isCorrect
                                          ? 'bg-emerald-600 text-white shadow-xs'
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
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                        !item.isCorrect
                                          ? 'bg-rose-600 text-white shadow-xs'
                                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                      }`}
                                    >
                                      Sai
                                    </button>
                                  </div>
                                </div>

                                {/* Hiển thị ảnh của ý nếu có */}
                                {item.imageUrl && (
                                  <div className="rounded border border-slate-200 bg-white p-1 relative">
                                    <div className="flex justify-between items-center pb-0.5 text-[9px] text-slate-400">
                                      <span>Ảnh ý {item.subKey})</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveItemImage(q.id, item.subKey)}
                                        className="text-rose-500 hover:text-rose-700 underline"
                                      >
                                        Xóa ảnh
                                      </button>
                                    </div>
                                    <ExamImage
                                      src={item.imageUrl}
                                      alt={`Mệnh đề ${item.subKey}`}
                                      className="max-h-16 max-w-full w-auto object-contain mx-auto"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ===================================== */}
                      {/* PHẦN 3: ĐIỀN ĐÁP SỐ NGẮN */}
                      {/* ===================================== */}
                      {q.part === 'part_3_short_answer' && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
                          <label className="font-bold text-slate-700">Đáp án điền số (Tối đa 4 ký tự):</label>
                          <input
                            type="text"
                            value={q.correctAnswer || ''}
                            onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value.slice(0, 4) })}
                            className="w-32 h-8 px-2.5 rounded-lg border border-slate-300 font-mono font-bold text-indigo-700 text-center focus:border-indigo-600 focus:outline-none"
                            placeholder="VD: 15 hoặc -3.5"
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

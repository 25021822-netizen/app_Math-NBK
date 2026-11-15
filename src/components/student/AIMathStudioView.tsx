import React, { useState, useRef } from 'react';
import { MathTopic, ScanResult, SocraticMessage, Exam, Question } from '../../types/math';
import { SAMPLE_SCAN_RESULTS } from '../../data/mockData';
import { MathView } from '../MathView';
import { Three3DSceneView } from '../geometry/Three3DSceneView';
import { LikiImageStudioView } from '../image/LikiImageStudioView';
import { cleanOcrTextAndConvertToLatex, cleanPdfNoiseAndOcr, OcrCleanResult } from '../../lib/ocrNoiseCleaner';
import { validatePdfFile, PdfValidationResult } from '../../lib/pdfValidator';
import { dbSaveExam } from '../../services/dbSyncService';
import { QuestionCropStudioView } from '../teacher/QuestionCropStudioView';
import {
  Camera,
  MessageSquare,
  Sparkles,
  Zap,
  CheckCircle2,
  RefreshCw,
  Send,
  HelpCircle,
  Lightbulb,
  Upload,
  Image as ImageIcon,
  ChevronRight,
  BrainCircuit,
  ArrowRight,
  Bot,
  User,
  History,
  Search,
  ExternalLink,
  Globe,
  Box,
  Wand2,
  Trash2,
  Layers,
  Compass,
  FileCheck2,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Filter,
  X,
  FileText,
  AlertTriangle,
  FileWarning,
  ShieldAlert,
  Scissors,
} from 'lucide-react';

export type StudioSubTab = 'tutor' | 'three_3d' | 'image_studio' | 'scanner';

interface AIMathStudioViewProps {
  initialTab?: StudioSubTab;
  dailyScanCount?: number;
  onIncrementScan: () => void;
  onStartExam?: (exam?: Exam) => void;
  onOpenCropStudio?: (fileData: { fileName: string; fileSize: string; fileBase64?: string; isPdf?: boolean; extractedText?: string }) => void;
}

export const AIMathStudioView: React.FC<AIMathStudioViewProps> = ({
  initialTab = 'tutor',
  onIncrementScan,
  onStartExam,
  onOpenCropStudio,
}) => {
  // Chế độ tích hợp trực tiếp trong Liki:
  // 'tutor' (Gia sư Liki), 'three_3d' (Không gian 3D Three.js), 'image_studio' (Tạo ảnh AI), 'scanner' (Quét OCR)
  const [activeStudioTab, setActiveStudioTab] = useState<StudioSubTab>(initialTab);

  // ==========================================
  // STATE MÁY QUÉT BÀI TẬP AI & LỌC NOISE OCR
  // ==========================================
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [customProblemText, setCustomProblemText] = useState('');
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);
  const [enableOcrNoiseCleaning, setEnableOcrNoiseCleaning] = useState<boolean>(true);
  const [ocrNoiseResult, setOcrNoiseResult] = useState<OcrCleanResult | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
  const [copiedLatex, setCopiedLatex] = useState<boolean>(false);
  const [isCreatingExam, setIsCreatingExam] = useState<boolean>(false);
  const [createdExamNotice, setCreatedExamNotice] = useState<string | null>(null);
  const [showCropStudioModal, setShowCropStudioModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // STATE XÁC THỰC FILE PDF TRƯỚC KHI QUÉT OCR
  // ==========================================
  const [pdfValidationInfo, setPdfValidationInfo] = useState<PdfValidationResult | null>(null);
  const [pdfValidationError, setPdfValidationError] = useState<string | null>(null);
  const [isValidatingPdf, setIsValidatingPdf] = useState<boolean>(false);
  const [customPdfFile, setCustomPdfFile] = useState<{
    file: File;
    dataUrl: string;
    info: PdfValidationResult;
  } | null>(null);

  // ==========================================
  // STATE GIA SƯ TOÁN LIKI & GOOGLE SEARCH GROUNDING (KHỞI TẠO HOÀN TOÀN TRẮNG - KHÔNG TIN NHẮN MẪU)
  // ==========================================
  const [messages, setMessages] = useState<SocraticMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [tutorMode, setTutorMode] = useState<'solve' | 'socratic'>('solve');
  const [tutorAttachedImage, setTutorAttachedImage] = useState<string | null>(null);
  const tutorFileInputRef = useRef<HTMLInputElement>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Xử lý nạp tệp ảnh chụp, tệp PDF hoặc tài liệu toán học có xác thực định dạng trước khi quét
  const handleIncomingFile = async (file: File) => {
    if (!file) return;

    // Reset các thông báo lỗi PDF và thông báo cũ
    setPdfValidationError(null);
    setCreatedExamNotice(null);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      setIsValidatingPdf(true);
      try {
        // Thực hiện quy trình kiểm tra chữ ký nhị phân %PDF-, mã kết thúc %%EOF và phát hiện tệp giả mạo
        const validation = await validatePdfFile(file);

        if (!validation.isValid) {
          // Tệp PDF hỏng hoặc không đúng định dạng: Ngăn chặn quy trình quét OCR ngay lập tức
          setPdfValidationError(validation.errorMessage || 'Tệp PDF bị hỏng hoặc không đúng định dạng chuẩn ISO 32000.');
          setPdfValidationInfo(validation);
          setCustomPdfFile(null);
          setCustomImagePreview(null);
          setIsValidatingPdf(false);
          return;
        }

        // Tệp PDF hợp lệ
        setPdfValidationInfo(validation);
        setPdfValidationError(null);

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setCustomPdfFile({
            file,
            dataUrl,
            info: validation,
          });
          setCustomImagePreview(dataUrl);
          if (!customProblemText) {
            setCustomProblemText(`[Tệp PDF đề thi: ${file.name} - ${validation.fileSizeFormatted} - ${validation.version || 'PDF chuẩn'}]`);
          }
          setIsValidatingPdf(false);
        };
        reader.onerror = () => {
          setPdfValidationError('Lỗi khi đọc dữ liệu tệp PDF từ bộ nhớ trình duyệt.');
          setIsValidatingPdf(false);
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        setPdfValidationError(`Lỗi xác thực tệp PDF: ${err?.message || 'Không thể kiểm tra tệp'}`);
        setIsValidatingPdf(false);
      }
      return;
    }

    // Nếu người dùng tải ảnh bình thường
    if (file.type.startsWith('image/')) {
      setPdfValidationInfo(null);
      setPdfValidationError(null);
      setCustomPdfFile(null);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setCustomImagePreview(base64);
      };
      reader.readAsDataURL(file);
    } else if (file.name.endsWith('.txt') || file.name.endsWith('.tex')) {
      setPdfValidationInfo(null);
      setPdfValidationError(null);
      setCustomPdfFile(null);
      const reader = new FileReader();
      reader.onload = () => {
        const txt = (reader.result as string) || '';
        setCustomProblemText(txt);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      setPdfValidationError(`Định dạng tệp "${file.name}" không hợp lệ. Vui lòng chọn tệp PDF chuẩn (.pdf), ảnh chụp (.jpg, .png) hoặc văn bản LaTeX (.tex, .txt).`);
    }
  };

  // Xóa tệp hiện tại (ảnh hoặc PDF)
  const handleClearCurrentFile = () => {
    setCustomImagePreview(null);
    setCustomPdfFile(null);
    setPdfValidationInfo(null);
    setPdfValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Xử lý quét bài tập và tự động làm sạch ký tự rác (Noise) trước khi chuyển sang LaTeX
  const handlePerformScan = async () => {
    // 0. XÁC THỰC ĐỊNH DẠNG FILE PDF TRƯỚC KHI BẮT ĐẦU QUY TRÌNH QUÉT OCR
    if (isValidatingPdf) {
      setPdfValidationError('Hệ thống đang kiểm tra định dạng và tính toàn vẹn của tệp PDF. Vui lòng chờ...');
      return;
    }

    if (pdfValidationError) {
      return; // Chặn quy trình quét OCR khi phát hiện tệp bị lỗi hoặc hỏng
    }

    if (customPdfFile && !customPdfFile.info.isValid) {
      setPdfValidationError('Tệp PDF đang nạp không hợp lệ. Vui lòng kiểm tra lại tệp nguồn.');
      return;
    }

    setIsScanning(true);
    setCreatedExamNotice(null);
    setScanError(null);

    // 1. Xác định nội dung đề bài thô cần phân tích
    const rawInput = customProblemText.trim() || SAMPLE_SCAN_RESULTS[selectedPresetIndex % SAMPLE_SCAN_RESULTS.length].problemText;

    // 2. Chạy logic lọc ký tự rác (Noise Cleaner), khử header/footer, số trang PDF trước khi gửi AI
    let cleanedOutput: OcrCleanResult;
    if (enableOcrNoiseCleaning) {
      cleanedOutput = cleanPdfNoiseAndOcr(rawInput);
      setOcrNoiseResult(cleanedOutput);
    } else {
      cleanedOutput = {
        cleanedText: rawInput,
        latexFormula: '',
        removedNoiseCount: 0,
        detectedArtifacts: [],
        suggestedPrompt: rawInput,
      };
      setOcrNoiseResult(null);
    }

    try {
      // 3. Gửi yêu cầu phân tích tới Server API /api/gemini/scan kèm ảnh Base64 nếu có
      const res = await fetch('/api/gemini/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemText: cleanedOutput.suggestedPrompt || rawInput,
          latex: cleanedOutput.latexFormula || undefined,
          imageBase64: customImagePreview || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.result) {
        const finalResult: ScanResult = {
          ...data.result,
          problemText: data.result.problemText || cleanedOutput.suggestedPrompt,
          latexFormula: data.result.latexFormula || cleanedOutput.latexFormula,
        };
        setScanResult(finalResult);
        setIsScanning(false);
        onIncrementScan();
        return;
      }

      setScanError(data?.error || 'Không thể phân tích bài toán lúc này. Vui lòng kiểm tra kết nối và thử lại.');
    } catch (err: any) {
      console.warn('Lỗi gọi API /api/gemini/scan:', err);
      setScanError('Không thể kết nối tới máy chủ AI. Vui lòng thử lại sau.');
    } finally {
      setIsScanning(false);
    }
  };

  // Tạo đề thi tự động từ bài toán đã quét và lọc sạch noise
  const handleCreateAutoExamFromScan = async () => {
    if (!scanResult) return;

    setIsCreatingExam(true);

    try {
      const examTitle = `Đề Luyện Tập: ${scanResult.problemText.slice(0, 45)}...`;
      const cleanPrompt = scanResult.problemText;
      const cleanFormula = scanResult.latexFormula;

      let questionItem: Question;

      // Nếu bài quét có trích xuất phương án A, B, C, D từ OCR
      if (ocrNoiseResult?.extractedOptions && ocrNoiseResult.extractedOptions.length >= 4) {
        questionItem = {
          id: `q_ocr_mcq_${Date.now()}`,
          part: 'part_1_mcq',
          questionNumber: 1,
          prompt: cleanPrompt,
          latex: cleanFormula || undefined,
          options: ocrNoiseResult.extractedOptions,
          correctAnswer: ocrNoiseResult.detectedCorrectAnswer as any || 'A',
          explanation: scanResult.stepByStepSolution.map(s => `${s.stepNumber}. ${s.title}: ${s.description}`).join('\n'),
          points: 0.25,
        };
      } else {
        // Mặc định tạo câu hỏi Trắc nghiệm trả lời ngắn (Part 3) hoặc Trắc nghiệm 4 lựa chọn chuẩn
        questionItem = {
          id: `q_ocr_part3_${Date.now()}`,
          part: 'part_3_short_answer',
          questionNumber: 1,
          prompt: cleanPrompt,
          latex: cleanFormula || undefined,
          correctAnswer: scanResult.finalAnswer.replace(/[^\d\.,\/\-]/g, '').slice(0, 4) || '1',
          explanation: scanResult.stepByStepSolution.map(s => `${s.stepNumber}. ${s.title}: ${s.description}`).join('\n'),
          points: 1.0,
        };
      }

      const generatedExam: Exam = {
        id: `exam_ocr_${Date.now()}`,
        title: examTitle,
        grade: 12,
        year: 2025,
        durationMinutes: 15,
        totalPoints: questionItem.points,
        status: 'approved',
        createdBy: 'Máy Quét OCR Liki',
        createdAt: new Date().toISOString(),
        questions: [questionItem],
        distributionType: 'repository',
        allowViewAnswersAfterSubmit: true,
        enableScreenMonitoring: true,
        maxInfractions: 3,
      };

      // 1. Lưu ngay vào localStorage
      try {
        const raw = localStorage.getItem('math_liki_exams');
        const list: Exam[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem('math_liki_exams', JSON.stringify([generatedExam, ...list.filter(e => e.id !== generatedExam.id)]));
      } catch {}

      // 2. Đồng bộ lên Server Database
      await dbSaveExam(generatedExam).catch(console.error);

      setCreatedExamNotice(`Đã tạo thành công đề thi "${examTitle}"! Đang chuyển vào phòng thi...`);

      // 3. Chuyển học sinh vào phòng thi làm bài ngay lập tức
      setTimeout(() => {
        if (onStartExam) {
          onStartExam(generatedExam);
        }
      }, 900);
    } catch (err: any) {
      console.error('Lỗi tạo đề thi tự động từ bài quét:', err);
    } finally {
      setIsCreatingExam(false);
    }
  };

  // Sao chép mã nguồn LaTeX đã lọc sạch
  const handleCopyLatex = (latex: string) => {
    if (!latex) return;
    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  // Chuyển bài toán đã quét sang Gia Sư Liki để đàm thoại gợi mở
  const handleTransferToSocraticTutor = () => {
    if (!scanResult) return;

    const newSystemPrompt: SocraticMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `Liki đã nhận được bài toán bạn vừa quét: "${scanResult.problemText}". Thay vì đưa ngay đáp án, Liki sẽ gợi ý từng bước để bạn tự tin giải quyết. Theo bạn, điều kiện xác định hoặc bước biến đổi đầu tiên của bài toán này là gì?`,
      latex: scanResult.latexFormula,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newSystemPrompt]);
    setActiveStudioTab('tutor');
  };

  // Đọc ảnh đính kèm cho khung chat Hỏi Đáp Liki
  const handleTutorImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setTutorAttachedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Gửi tin nhắn cho Gia sư Liki
  const handleSendTutorMessage = async (customText?: string, overrideMode?: 'solve' | 'socratic') => {
    const textToSend = customText !== undefined ? customText : inputText;
    const attachedImg = customText !== undefined ? null : tutorAttachedImage;
    if (!textToSend.trim() && !attachedImg) return;

    const queryText = textToSend.trim() || 'Hãy đọc đề bài trong ảnh đính kèm và giải chi tiết giúp mình.';
    const userMsg: SocraticMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: queryText,
      imageUrl: attachedImg || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    if (customText === undefined) {
      setInputText('');
      setTutorAttachedImage(null);
      if (tutorFileInputRef.current) tutorFileInputRef.current.value = '';
    }
    setIsAiThinking(true);

    try {
      const res = await fetch('/api/gemini/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          query: queryText,
          useSearchGrounding,
          mode: overrideMode || tutorMode,
          imageBase64: attachedImg || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        const aiMsg: SocraticMessage = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          latex: data.latex,
          groundingChunks: data.groundingChunks,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsAiThinking(false);
        return;
      }

      const errorMsg: SocraticMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: data?.error || 'AI không thể trả lời lúc này. Vui lòng kiểm tra cấu hình khóa API và thử lại.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } catch (err) {
      console.warn('Lỗi kết nối Liki Tutor API:', err);
      const errorMsg: SocraticMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: 'Không thể kết nối tới máy chủ AI. Vui lòng kiểm tra mạng và thử gửi lại câu hỏi.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Yêu cầu gợi ý thông minh theo đúng ngữ cảnh bài toán hiện tại
  const handleRequestHint = async () => {
    if (hintsRemaining <= 0 || messages.length === 0 || isAiThinking) return;
    setHintsRemaining((prev) => prev - 1);
    await handleSendTutorMessage(
      'Hãy cho mình một gợi ý trọng tâm về hướng giải tiếp theo cho bài toán đang trao đổi (chỉ gợi ý phương pháp và công thức mấu chốt).',
      'socratic'
    );
  };

  // Xóa lịch sử cuộc trò chuyện
  const handleClearChat = () => {
    setMessages([]);
    setHintsRemaining(3);
    setTutorAttachedImage(null);
  };

  // Nếu người dùng yêu cầu chuyển sang phòng riêng biệt để cắt các câu vào đề
  if (showCropStudioModal) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in">
        <QuestionCropStudioView
          documentData={{
            fileName: customPdfFile?.file.name || 'Tai_Lieu_Toan_Scan.png',
            fileSize: customPdfFile?.info.fileSizeFormatted || '1.8 MB',
            fileBase64: customImagePreview || undefined,
            isPdf: Boolean(customPdfFile),
            extractedText: customProblemText || undefined,
          }}
          initialTitle={customPdfFile ? `Đề Thi: ${customPdfFile.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}` : undefined}
          onPublishExam={(exam) => {
            if (onStartExam) onStartExam(exam);
            setShowCropStudioModal(false);
          }}
          onTransferToManualEditor={() => {
            setShowCropStudioModal(false);
          }}
          onBackToUpload={() => setShowCropStudioModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner Liki AI Studio */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-600" />
              <span>Trợ Lý & Gia Sư Toán AI Liki</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              Toán Học LIKI
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            Không Gian Trợ Lý Học Toán Liki
          </h1>
        </div>

        {/* Unified Liki Mode Switcher: 4 Chức năng tích hợp trực tiếp (2x2 trên mobile, flex trên desktop) */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-full md:w-auto gap-1.5">
          <button
            onClick={() => setActiveStudioTab('tutor')}
            className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center ${
              activeStudioTab === 'tutor'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MessageSquare size={16} className="shrink-0" />
            <span className="truncate">Hỏi Đáp Liki</span>
          </button>

          <button
            onClick={() => setActiveStudioTab('three_3d')}
            className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center ${
              activeStudioTab === 'three_3d'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Box size={16} className="shrink-0" />
            <span className="truncate">Không Gian 3D</span>
          </button>

          <button
            onClick={() => setActiveStudioTab('image_studio')}
            className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center ${
              activeStudioTab === 'image_studio'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Wand2 size={16} className="shrink-0" />
            <span className="truncate">Tạo Ảnh AI</span>
          </button>

          <button
            onClick={() => setActiveStudioTab('scanner')}
            className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center ${
              activeStudioTab === 'scanner'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Camera size={16} className="shrink-0" />
            <span className="truncate">Quét Đề Bài</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PHÂN HỆ 1: GIA SƯ TOÁN LIKI & CHAT ĐÀM THOẠI             */}
      {/* ========================================================= */}
      {activeStudioTab === 'tutor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cột chính: Khung Chat Liki (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 space-y-5 shadow-xs flex flex-col min-h-[580px]">
            {/* Header Chat Liki */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                  <Bot size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900">Trợ Lý & Gia Sư Toán Liki</h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-200">
                      AI Trực Tuyến
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {tutorMode === 'solve'
                      ? 'Suy luận chuyên sâu · Giải chi tiết & trả lời trực tiếp'
                      : 'Chế độ Gia sư · Dẫn dắt & kiểm tra từng bước'}
                  </span>
                </div>
              </div>

              {/* Action tools inside Liki chat header */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTutorMode('solve')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      tutorMode === 'solve'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Giải chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => setTutorMode('socratic')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      tutorMode === 'socratic'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Gợi mở từng bước
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStudioTab('three_3d')}
                  title="Mở mô phỏng không gian Three.js 3D trực tiếp trong Liki"
                  className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Box size={14} className="text-cyan-600" />
                  <span className="hidden sm:inline">Mở 3D</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStudioTab('image_studio')}
                  title="Mở xưởng tạo ảnh bài toán Liki Image Studio"
                  className="px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wand2 size={14} className="text-pink-600" />
                  <span className="hidden sm:inline">Tạo Ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={handleRequestHint}
                  disabled={hintsRemaining <= 0 || messages.length === 0 || isAiThinking}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Lightbulb size={14} className="text-amber-600" />
                  <span>Gợi ý ({hintsRemaining})</span>
                </button>

                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    title="Xóa lịch sử cuộc trò chuyện để bắt đầu bài mới"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Stream tin nhắn đối thoại: KHÔNG CÓ CUỘC TRÒ CHUYỆN MẪU NÀO */}
            <div className="flex-1 overflow-y-auto space-y-4 max-h-[460px] pr-2 text-xs">
              {messages.length === 0 ? (
                /* Empty State sạch sẽ khi bắt đầu phiên học */
                <div className="py-8 px-4 text-center space-y-5 animate-in fade-in">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-500/10 via-indigo-500/15 to-cyan-500/10 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                    <Sparkles size={32} />
                  </div>

                  <div className="space-y-1 max-w-lg mx-auto">
                    <h4 className="text-lg font-black text-slate-900">
                      Chào bạn! Mình là Liki - Trợ lý & Gia sư Toán AI
                    </h4>
                  </div>

                  {/* 3 Quick Action Shortcuts directly into Liki features */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 max-w-xl mx-auto text-left">
                    <button
                      type="button"
                      onClick={() => setActiveStudioTab('three_3d')}
                      className="p-3.5 rounded-2xl bg-cyan-50/70 hover:bg-cyan-50 border border-cyan-200 transition-all text-left group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <Box size={16} />
                      </div>
                      <div className="font-extrabold text-xs text-cyan-950">Không Gian 3D</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveStudioTab('image_studio')}
                      className="p-3.5 rounded-2xl bg-pink-50/70 hover:bg-pink-50 border border-pink-200 transition-all text-left group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-pink-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <Wand2 size={16} />
                      </div>
                      <div className="font-extrabold text-xs text-pink-950">Tạo Ảnh AI</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUseSearchGrounding(!useSearchGrounding)}
                      className={`p-3.5 rounded-2xl border transition-all text-left group cursor-pointer ${
                        useSearchGrounding
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 group-hover:scale-105 transition-transform ${
                        useSearchGrounding ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                      }`}>
                        <Globe size={16} />
                      </div>
                      <div className={`font-extrabold text-xs ${useSearchGrounding ? 'text-white' : 'text-slate-900'}`}>
                        Google Search
                      </div>
                      <p className={`text-[11px] mt-0.5 ${useSearchGrounding ? 'text-blue-100' : 'text-slate-500'}`}>
                        {useSearchGrounding ? 'Đã bật tra cứu thực tế' : 'Bật tra cứu thi cử & STEM'}
                      </p>
                    </button>
                  </div>

                  {/* Starter Suggestion Pills */}
                  <div className="space-y-2 pt-2 max-w-xl mx-auto">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                      Hoặc chọn một câu hỏi mẫu để bắt đầu ngay:
                    </span>
                    <div className="flex flex-col gap-1.5 text-left">
                      {[
                        'Hướng dẫn mình các bước xét tính đơn điệu và tìm cực trị của hàm số bậc ba y = ax³ + bx² + cx + d',
                        'Cách xác định góc giữa đường thẳng và mặt phẳng trong khối chóp S.ABCD đáy hình vuông',
                        'Tra cứu cấu trúc đề thi tốt nghiệp THPT 2025 môn Toán và những điểm mới cần lưu ý',
                      ].map((promptText, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => handleSendTutorMessage(promptText)}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs font-semibold text-left transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <span className="line-clamp-1">{promptText}</span>
                          <ArrowRight size={14} className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                          isUser ? 'bg-blue-600 text-white' : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {isUser ? <User size={16} /> : <Bot size={16} />}
                      </div>

                      <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`p-4 rounded-2xl leading-relaxed ${
                            isUser
                              ? 'bg-blue-600 text-white rounded-tr-xs'
                              : m.isError
                              ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-tl-xs'
                              : 'bg-slate-100 text-slate-900 rounded-tl-xs'
                          }`}
                        >
                          {m.imageUrl && (
                            <img
                              src={m.imageUrl}
                              alt="Ảnh bài toán đính kèm"
                              className="max-h-52 w-auto rounded-xl border border-white/20 mb-2 object-contain bg-white"
                            />
                          )}

                          <div className="text-xs sm:text-[13px] leading-relaxed break-words">
                            <MathView math={m.content} />
                          </div>

                          {m.latex && (
                            <div className="mt-2 pt-2 border-t border-black/10 overflow-x-auto">
                              <MathView math={m.latex} block />
                            </div>
                          )}

                          {/* Search Grounding Web Sources Citations */}
                          {m.groundingChunks && m.groundingChunks.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] space-y-1.5 bg-white/70 p-2.5 rounded-xl">
                              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                                <Search size={13} className="text-blue-600" />
                                <span>Nguồn dữ liệu thực tế (Google Search Grounding):</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {m.groundingChunks.map((chunk, cIdx) => {
                                  if (!chunk.web?.uri) return null;
                                  return (
                                    <a
                                      key={cIdx}
                                      href={chunk.web.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold transition-colors shadow-2xs"
                                    >
                                      <Globe size={11} />
                                      <span className="line-clamp-1 max-w-[200px]">{chunk.web.title || chunk.web.uri}</span>
                                      <ExternalLink size={10} className="shrink-0" />
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block px-1">{m.timestamp}</span>
                      </div>
                    </div>
                  );
                })
              )}

              {isAiThinking && (
                <div className="flex gap-3 items-center text-xs text-slate-400 italic">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Bot size={16} />
                  </div>
                  <span>{useSearchGrounding ? 'Liki đang tra cứu Google Search và phân tích chi tiết...' : 'Liki đang suy luận và giải chi tiết câu hỏi của bạn...'}</span>
                </div>
              )}
            </div>

            {/* Search Grounding Toggle */}
            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                <input
                  type="checkbox"
                  checked={useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <Globe size={14} className={useSearchGrounding ? 'text-blue-600 animate-pulse' : 'text-slate-400'} />
                  <span>Tra cứu Google Search thực tế (Đề thi & Tuyển sinh mới nhất)</span>
                </span>
              </label>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                Suy luận cao
              </span>
            </div>

            {tutorAttachedImage && (
              <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={tutorAttachedImage}
                    alt="Ảnh câu hỏi chuẩn bị gửi"
                    className="w-12 h-12 rounded-xl object-cover border border-blue-300 bg-white shrink-0"
                  />
                  <div className="text-xs text-blue-900 font-semibold truncate">
                    Đã đính kèm ảnh bài toán · Liki sẽ đọc ảnh và giải chi tiết
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTutorAttachedImage(null);
                    if (tutorFileInputRef.current) tutorFileInputRef.current.value = '';
                  }}
                  className="p-1.5 rounded-lg bg-white text-slate-500 hover:text-rose-600 border border-slate-200 cursor-pointer shrink-0"
                  title="Bỏ ảnh đính kèm"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Input Form gửi tin nhắn */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendTutorMessage(); }} className="pt-2 border-t border-slate-100 flex gap-2 items-center">
              <input
                ref={tutorFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleTutorImageFile(e.target.files[0]);
                }}
              />
              <button
                type="button"
                onClick={() => tutorFileInputRef.current?.click()}
                title="Đính kèm ảnh chụp đề bài (hoặc Ctrl+V để dán ảnh trực tiếp)"
                className="h-11 w-11 rounded-xl border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-blue-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <ImageIcon size={17} />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                      const file = items[i].getAsFile();
                      if (file) {
                        e.preventDefault();
                        handleTutorImageFile(file);
                        break;
                      }
                    }
                  }
                }}
                placeholder={
                  useSearchGrounding
                    ? 'Hỏi về dạng đề thi, thông tin tuyển sinh hoặc dán (Ctrl+V) ảnh bài tập...'
                    : 'Nhập bài toán, câu hỏi bất kỳ hoặc dán (Ctrl+V) ảnh đề bài...'
                }
                className="flex-1 h-11 px-4 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={(!inputText.trim() && !tutorAttachedImage) || isAiThinking}
                className="px-5 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <Send size={15} />
                <span>Gửi</span>
              </button>
            </form>
          </div>

          {/* Cột phải: Công cụ học tập nhanh (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Phím tắt mở nhanh tính năng 3D và Tạo ảnh của Liki */}
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-3xl p-6 text-white space-y-3 shadow-md">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-wider">
                <Sparkles size={14} />
                <span>Không Gian Toán Học Liki</span>
              </div>
              <h4 className="font-extrabold text-base text-white">Cần hình ảnh hoặc mô hình 3D?</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Liki tích hợp sẵn phòng chiếu hình học 3D Three.js và xưởng vẽ hình vector toán học.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStudioTab('three_3d')}
                  className="py-2.5 px-3 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Box size={14} />
                  <span>Mở 3D Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStudioTab('image_studio')}
                  className="py-2.5 px-3 rounded-xl bg-pink-600/30 hover:bg-pink-600/50 border border-pink-400/40 text-pink-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Wand2 size={14} />
                  <span>Xưởng Tạo Ảnh</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHÂN HỆ 2: KHÔNG GIAN 3D THREE.JS TÍCH HỢP TRỰC TIẾP LIKI  */}
      {/* ========================================================= */}
      {activeStudioTab === 'three_3d' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200">
                  Tính Năng Tích Hợp Liki · Three.js
                </span>
                <span className="text-xs text-slate-400 font-mono">60 FPS · Studio PBR Lighting</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Không Gian 3D (Three.js 3D Studio)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mô phỏng 3D đa diện chuẩn PBR: Khối chóp S.ABCD, khối nón, khối trụ tròn xoay, thiết diện cắt và mặt cong giải tích Oxyz.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveStudioTab('tutor')}
              className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Quay Lại Hỏi Liki</span>
            </button>
          </div>

          <Three3DSceneView />
        </div>
      )}

      {/* ========================================================= */}
      {/* PHÂN HỆ 3: XƯỞNG TẠO ẢNH AI LIKI TÍCH HỢP TRỰC TIẾP       */}
      {/* ========================================================= */}
      {activeStudioTab === 'image_studio' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200">
                  Tính Năng Tích Hợp Liki · Image Studio
                </span>
                <span className="text-xs text-slate-400 font-mono">Vector Math Engine & Visual Generator</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Xưởng Tạo Ảnh Toán Học Liki
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập câu lệnh để Liki tự động vẽ sơ đồ toán học, khối hình nón/trụ/chóp, thiết diện không gian hoặc đồ thị hàm số.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveStudioTab('tutor')}
              className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Quay Lại Hỏi Liki</span>
            </button>
          </div>

          <LikiImageStudioView />
        </div>
      )}

      {/* ========================================================= */}
      {/* PHÂN HỆ 4: MÁY QUÉT BÀI TẬP AI (CAMERA OCR & LỌC NOISE)    */}
      {/* ========================================================= */}
      {activeStudioTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cột trái: Khung quét ảnh & Lọc ký tự rác OCR (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Camera size={20} className="text-blue-600" />
                  <h3 className="font-extrabold text-base text-slate-900">Khung Quét Camera</h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400">OCR & Lọc Noise Thông Minh</span>
              </div>

              {/* Viewport máy ảnh & Vùng tải ảnh kéo thả */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleIncomingFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => !customImagePreview && !isValidatingPdf && fileInputRef.current?.click()}
                className={`relative rounded-2xl overflow-hidden aspect-4/3 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed transition-all ${
                  pdfValidationError
                    ? 'bg-rose-950/20 border-rose-500/60 text-rose-900'
                    : customPdfFile
                    ? 'bg-slate-900 border-indigo-500/80'
                    : customImagePreview
                    ? 'bg-slate-900 border-slate-700'
                    : isDraggingImage
                    ? 'border-blue-500 bg-blue-50 text-blue-900 cursor-pointer'
                    : 'bg-slate-900 border-slate-700 text-white cursor-pointer hover:border-blue-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf,.txt,.tex"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleIncomingFile(e.target.files[0]);
                    }
                  }}
                />

                {isValidatingPdf ? (
                  <div className="flex flex-col items-center justify-center p-4 text-center space-y-3 animate-pulse">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-400/30">
                      <RefreshCw size={26} className="animate-spin text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-indigo-200">
                        Đang xác thực định dạng & tính toàn vẹn PDF...
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Kiểm tra chữ ký nhị phân %PDF-, mã kết thúc %%EOF theo chuẩn ISO 32000
                      </p>
                    </div>
                  </div>
                ) : customPdfFile ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 mb-3">
                      <FileText size={32} />
                    </div>

                    <h4 className="font-extrabold text-sm text-white max-w-xs truncate" title={customPdfFile.file.name}>
                      {customPdfFile.file.name}
                    </h4>

                    <div className="flex items-center gap-1.5 flex-wrap justify-center mt-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                        {customPdfFile.info.version || 'PDF Chuẩn'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                        {customPdfFile.info.fileSizeFormatted}
                      </span>
                      {customPdfFile.info.estimatedPages && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                          {customPdfFile.info.estimatedPages} trang
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-500/30">
                      <CheckCircle2 size={13} />
                      <span>Xác thực tính toàn vẹn thành công (%PDF- & %%EOF)</span>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearCurrentFile();
                        }}
                        className="p-1.5 rounded-xl bg-black/60 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                        title="Đổi tệp khác"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : customImagePreview ? (
                  <>
                    <img
                      src={customImagePreview}
                      alt="Xem trước ảnh bài toán"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearCurrentFile();
                        }}
                        className="p-1.5 rounded-xl bg-black/60 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                        title="Xóa ảnh này"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3">
                      <Upload size={28} className="text-blue-400" />
                    </div>
                    <p className="font-bold text-sm text-slate-200">
                      Bấm để chọn tệp hoặc kéo thả vào đây
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Hỗ trợ tệp đề thi PDF (.pdf), ảnh chụp bài thi (.jpg, .png) hoặc mã LaTeX (.tex, .txt)
                    </p>
                    <div className="flex items-center gap-1.5 mt-2.5 text-[10px] font-bold text-slate-400">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-rose-300">PDF Chuẩn BGD</span>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-cyan-300">Ảnh Chụp OCR</span>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-300">LaTeX KaTeX</span>
                    </div>
                  </>
                )}

                {/* Khung ngắm OCR quang học */}
                <div className="absolute inset-4 border-2 border-blue-400/30 rounded-xl pointer-events-none" />
              </div>

              {/* THÔNG BÁO LỖI XÁC THỰC FILE PDF (NẾU PHÁT HIỆN FILE HỎNG HOẶC SAI ĐỊNH DẠNG) */}
              {pdfValidationError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2 animate-in fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-black text-xs text-rose-700">
                      <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                      <span>CẢNH BÁO: TỆP PDF KHÔNG HỢP LỆ HOẶC BỊ HỎNG</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-black uppercase">
                      Đã chặn quét OCR
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed font-medium">
                    {pdfValidationError}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-rose-600">
                      Hệ thống tự động ngăn chặn quy trình quét để tránh lỗi xử lý.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleClearCurrentFile();
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Chọn tệp PDF khác
                    </button>
                  </div>
                </div>
              )}

              {/* CẢNH BÁO BẢO MẬT HOẶC MÃ HÓA CỦA TỆP PDF HỢP LỆ (NẾU CÓ) */}
              {customPdfFile?.info.warnings && customPdfFile.info.warnings.length > 0 && !pdfValidationError && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <ShieldAlert size={14} className="text-amber-600 shrink-0" />
                    <span>Thông tin tệp:</span>
                  </div>
                  {customPdfFile.info.warnings.map((warn, wIdx) => (
                    <p key={wIdx} className="text-[11px] text-amber-700 pl-4">• {warn}</p>
                  ))}
                </div>
              )}

              {/* BỘ LỌC KÝ TỰ RÁC (NOISE CLEANER) & CHUẨN HÓA LATEX */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-950">
                    <input
                      type="checkbox"
                      checked={enableOcrNoiseCleaning}
                      onChange={(e) => setEnableOcrNoiseCleaning(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Filter size={13} />
                    </div>
                    <span>Lọc ký tự rác (Noise) & Chuẩn hóa LaTeX</span>
                  </label>

                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    enableOcrNoiseCleaning ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {enableOcrNoiseCleaning ? 'ĐANG BẬT' : 'TẮT'}
                  </span>
                </div>

                {ocrNoiseResult && ocrNoiseResult.removedNoiseCount > 0 && (
                  <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <ShieldCheck size={14} />
                      <span>Đã làm sạch {ocrNoiseResult.removedNoiseCount} ký tự rác quang học thành công!</span>
                    </div>
                    {ocrNoiseResult.detectedArtifacts.length > 0 && (
                      <div className="text-[10px] text-slate-500 pl-4 list-disc space-y-0.5">
                        {ocrNoiseResult.detectedArtifacts.slice(0, 3).map((art, idx) => (
                          <div key={idx}>• {art}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tải ảnh hoặc chọn đề toán mẫu */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">Chọn đề toán mẫu thực tế:</label>
                <div className="space-y-1.5">
                  {SAMPLE_SCAN_RESULTS.map((res: ScanResult, index: number) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setSelectedPresetIndex(index);
                        setCustomProblemText('');
                        handleClearCurrentFile();
                        setOcrNoiseResult(null);
                      }}
                      className={`w-full text-left p-3 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        selectedPresetIndex === index && !customProblemText && !customPdfFile
                          ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="line-clamp-1">{res.problemText}</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white border shrink-0 ml-2">
                        {res.topic}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nhập đề bài bằng văn bản */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">Hoặc dán văn bản đề bài toán:</label>
                  {customProblemText && (
                    <button
                      type="button"
                      onClick={() => setCustomProblemText('')}
                      className="text-[11px] text-slate-400 hover:text-slate-600 font-medium"
                    >
                      Xóa nội dung
                    </button>
                  )}
                </div>
                <textarea
                  value={customProblemText}
                  onChange={(e) => setCustomProblemText(e.target.value)}
                  placeholder="Nhập hoặc dán văn bản đề bài toán THPT (hỗ trợ cả văn bản dính ký tự rác, hệ phương trình, tích phân, vector...)"
                  className="w-full h-24 p-3 rounded-2xl border border-slate-200 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Nút hành động Quét bài */}
              <button
                type="button"
                onClick={handlePerformScan}
                disabled={isScanning || isValidatingPdf || !!pdfValidationError}
                className={`w-full py-3.5 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  pdfValidationError
                    ? 'bg-rose-200 text-rose-800 cursor-not-allowed opacity-80'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md shadow-blue-500/25'
                }`}
              >
                {isValidatingPdf ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Đang kiểm tra tính hợp lệ file PDF...</span>
                  </>
                ) : pdfValidationError ? (
                  <>
                    <AlertTriangle size={16} className="text-rose-600" />
                    <span>Tệp PDF bị hỏng/sai định dạng - Đã chặn quét OCR</span>
                  </>
                ) : isScanning ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Đang lọc sạch ký tự rác & Chuyển đổi LaTeX...</span>
                  </>
                ) : customPdfFile ? (
                  <>
                    <Sparkles size={16} />
                    <span>Bắt Đầu Quét OCR Tệp PDF Đã Xác Thực</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Quét OCR & Lọc Sạch Noise Tự Động</span>
                  </>
                )}
              </button>

              {/* NÚT CHUYỂN SANG GIAO DIỆN PHÒNG CẮT CÁC CÂU VÀO ĐỀ */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenCropStudio) {
                    onOpenCropStudio({
                      fileName: customPdfFile?.file.name || 'Tai_Lieu_Toan.png',
                      fileSize: customPdfFile?.info.fileSizeFormatted || '1.5 MB',
                      fileBase64: customImagePreview || undefined,
                      isPdf: Boolean(customPdfFile),
                      extractedText: customProblemText || undefined,
                    });
                  } else {
                    setShowCropStudioModal(true);
                  }
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-900 border-2 border-indigo-200 text-xs font-black shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Scissors size={15} className="text-indigo-600" />
                <span>✂️ Chuyển Sang Phòng Cắt Các Câu Vào Đề</span>
              </button>
            </div>
          </div>

          {/* Cột phải: Kết quả bóc tách lời giải & Tạo đề thi (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {scanError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2.5 shadow-xs">
                <AlertTriangle size={17} className="text-rose-600 shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}
            {scanResult ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in">
                {createdExamNotice && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{createdExamNotice}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                      Đã Bóc Tách Thành Công
                    </span>
                    <span className="text-xs font-mono text-slate-400">{scanResult.processingTimeMs} ms</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {enableOcrNoiseCleaning && (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                        <Filter size={12} />
                        <span>Đã Lọc Sạch Noise</span>
                      </span>
                    )}
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                      {scanResult.difficulty}
                    </span>
                  </div>
                </div>

                {/* Đề bài nhận diện & làm sạch */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Đề Bài Đã Làm Sạch Ký Tự Rác & Định Dạng LaTeX
                  </h4>
                  <div className="text-sm font-bold text-slate-800 leading-relaxed p-3 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                    <MathView math={scanResult.problemText} />
                  </div>
                </div>

                {/* Khối công thức LaTeX chuẩn hóa */}
                {scanResult.latexFormula && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Công Thức LaTeX Chuẩn Hóa
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleCopyLatex(scanResult.latexFormula)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedLatex ? (
                          <>
                            <Check size={13} className="text-emerald-600" />
                            <span className="text-emerald-600">Đã sao chép!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Sao chép mã LaTeX</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3.5 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs overflow-x-auto shadow-inner">
                      <code>{scanResult.latexFormula}</code>
                    </div>
                  </div>
                )}

                {/* Từng bước giải chi tiết */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Các Bước Giải Chi Tiết</h4>
                  <div className="space-y-3">
                    {scanResult.stepByStepSolution.map((step) => (
                      <div key={step.stepNumber} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                            {step.stepNumber}
                          </span>
                          <span>{step.title}</span>
                        </div>
                        <div className="text-xs text-slate-600 pl-7 leading-relaxed">
                          <MathView math={step.description} />
                        </div>
                        {step.latex && (
                          <div className="pl-7 overflow-x-auto">
                            <MathView latex={step.latex} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kết luận cuối cùng */}
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Đáp Số Cuối Cùng</span>
                    <span className="font-extrabold text-base text-emerald-950">
                      <MathView math={scanResult.finalAnswer} />
                    </span>
                  </div>
                  <CheckCircle2 size={24} className="text-emerald-600" />
                </div>

                {/* THANH HÀNH ĐỘNG: TẠO ĐỀ THI TỰ ĐỘNG & HỎI GIA SƯ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Nút Tạo đề thi tự động từ bài toán đã làm sạch */}
                  <button
                    type="button"
                    onClick={handleCreateAutoExamFromScan}
                    disabled={isCreatingExam}
                    className="p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-left transition-all shadow-md shadow-indigo-500/20 cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-black text-xs">
                        <FileCheck2 size={16} className="text-indigo-200" />
                        <span>Tạo Đề Thi Tự Động</span>
                      </div>
                      <p className="text-[11px] text-indigo-100 mt-1">
                        Chuyển ngay bài toán sạch này vào phòng luyện thi chuẩn BGD!
                      </p>
                    </div>
                    <ArrowRight size={18} className="shrink-0 transition-transform group-hover:translate-x-1 ml-2" />
                  </button>

                  {/* Nút Đàm thoại với Gia sư Liki */}
                  <button
                    type="button"
                    onClick={handleTransferToSocraticTutor}
                    className="p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-left transition-all border border-slate-200 cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                        <Bot size={16} className="text-blue-600" />
                        <span>Hỏi Gia Sư Liki</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Đàm thoại gợi mở từng bước nếu chưa hiểu rõ bài toán.
                      </p>
                    </div>
                    <ArrowRight size={18} className="shrink-0 transition-transform group-hover:translate-x-1 ml-2 text-slate-400" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3 shadow-xs">
                <Camera size={48} className="mx-auto text-slate-300" />
                <h4 className="font-bold text-base text-slate-700">Chưa có kết quả quét nào</h4>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

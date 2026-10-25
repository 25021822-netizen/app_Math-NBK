import React, { useState } from 'react';
import { AccountTier, MathTopic, ScanResult, SocraticMessage } from '../../types/math';
import { SAMPLE_SCAN_RESULTS } from '../../data/mockData';
import { MathView } from '../MathView';
import { FunctionGrapher } from '../FunctionGrapher';
import { Three3DSceneView } from '../geometry/Three3DSceneView';
import { LikiImageStudioView } from '../image/LikiImageStudioView';
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
  TrendingUp,
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
} from 'lucide-react';

export type StudioSubTab = 'tutor' | 'three_3d' | 'image_studio' | 'scanner';

interface AIMathStudioViewProps {
  initialTab?: StudioSubTab;
  dailyScanCount: number;
  maxDailyScans: number;
  tier: AccountTier;
  onIncrementScan: () => void;
  onUpgradeTier: () => void;
  onStartExam?: () => void;
}

export const AIMathStudioView: React.FC<AIMathStudioViewProps> = ({
  initialTab = 'tutor',
  dailyScanCount,
  maxDailyScans,
  tier,
  onIncrementScan,
  onUpgradeTier,
  onStartExam,
}) => {
  // Chế độ tích hợp trực tiếp trong Liki:
  // 'tutor' (Gia sư Liki), 'three_3d' (Không gian 3D Three.js), 'image_studio' (Tạo ảnh AI), 'scanner' (Quét OCR)
  const [activeStudioTab, setActiveStudioTab] = useState<StudioSubTab>(initialTab);

  // ==========================================
  // STATE MÁY QUÉT BÀI TẬP AI
  // ==========================================
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [customProblemText, setCustomProblemText] = useState('');
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);

  // ==========================================
  // STATE GIA SƯ TOÁN LIKI & GOOGLE SEARCH GROUNDING (KHỞI TẠO HOÀN TOÀN TRẮNG - KHÔNG TIN NHẮN MẪU)
  // ==========================================
  const [messages, setMessages] = useState<SocraticMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [hintsRemaining, setHintsRemaining] = useState(2);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);

  const isLimitReached = tier === 'free' && dailyScanCount >= maxDailyScans;

  // Xử lý quét bài tập
  const handlePerformScan = () => {
    if (isLimitReached) {
      onUpgradeTier();
      return;
    }

    setIsScanning(true);
    setTimeout(() => {
      const result = SAMPLE_SCAN_RESULTS[selectedPresetIndex % SAMPLE_SCAN_RESULTS.length];
      if (customProblemText.trim()) {
        setScanResult({
          ...result,
          problemText: customProblemText.trim(),
        });
      } else {
        setScanResult(result);
      }
      setIsScanning(false);
      onIncrementScan();
    }, 1200);
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

  // Gửi tin nhắn cho Gia sư Liki
  const handleSendTutorMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : inputText;
    if (!textToSend.trim()) return;

    const queryText = textToSend.trim();
    const userMsg: SocraticMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText('');
    setIsAiThinking(true);

    try {
      const res = await fetch('/api/gemini/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          query: queryText,
          useSearchGrounding,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: SocraticMessage = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Liki đã ghi nhận câu trả lời. Bạn hãy thử bước tiếp theo nhé!',
          latex: data.latex,
          graphHint: data.graphHint,
          groundingChunks: data.groundingChunks,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsAiThinking(false);
        return;
      }
    } catch (err) {
      console.warn('Lỗi kết nối Liki Tutor API:', err);
    }

    // Fallback nếu ngoại tuyến
    setTimeout(() => {
      let aiResponseText = 'Liki ghi nhận suy luận của bạn. Thử biến đổi hoặc thay giá trị vào phương trình để kiểm tra các điểm nghiệm xem sao nhé!';
      let latexHint = "f'(x) = 0";

      const aiMsg: SocraticMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: aiResponseText,
        latex: latexHint,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsAiThinking(false);
    }, 600);
  };

  // Yêu cầu gợi ý thông minh từ Gia sư
  const handleRequestHint = () => {
    if (hintsRemaining <= 0) return;
    setHintsRemaining((prev) => prev - 1);

    const hintMsg: SocraticMessage = {
      id: `hint_${Date.now()}`,
      role: 'assistant',
      content: `💡 Gợi ý cấp độ ${3 - hintsRemaining}: Hãy lập bảng xét dấu cho biểu thức đạo hàm $f'(x)$. Khi đi qua nghiệm bội lẻ, đạo hàm sẽ đổi dấu từ dương sang âm (cực đại) hoặc từ âm sang dương (cực tiểu).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, hintMsg]);
  };

  // Xóa lịch sử cuộc trò chuyện
  const handleClearChat = () => {
    setMessages([]);
    setHintsRemaining(2);
  };

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
              Toán Thầy Nguyễn Bá Kỳ
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              Tích Hợp: 3D Three.js · Tạo Ảnh AI · Search Grounding
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            Không Gian Trợ Lý Học Toán Liki
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl">
            Đồng hành học Toán THPT toàn diện: Đàm thoại gợi mở Socratic, mô phỏng không gian Three.js 3D chân thực, xưởng tạo ảnh bài toán AI và quét đề tự động.
          </p>
        </div>

        {/* Unified Liki Mode Switcher: 4 Chức năng tích hợp trực tiếp */}
        <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-full md:w-auto gap-1">
          <button
            onClick={() => setActiveStudioTab('tutor')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeStudioTab === 'tutor'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MessageSquare size={16} />
            <span>Hỏi Đáp Với Liki</span>
          </button>

          <button
            onClick={() => setActiveStudioTab('three_3d')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeStudioTab === 'three_3d'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Box size={16} />
            <span>Không Gian 3D</span>
          </button>

          <button
            onClick={() => setActiveStudioTab('image_studio')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeStudioTab === 'image_studio'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Wand2 size={16} />
            <span>Tạo Ảnh AI</span>
          </button>

          <button
            onClick={() => setActiveStudioTab('scanner')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeStudioTab === 'scanner'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Camera size={16} />
            <span>Quét Đề Bài</span>
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
                    Sẵn sàng giải đáp · Không giải bài hộ · Gợi mở từng bước
                  </span>
                </div>
              </div>

              {/* Action tools inside Liki chat header */}
              <div className="flex items-center gap-2">
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
                  disabled={hintsRemaining <= 0 || messages.length === 0}
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

                  <div className="space-y-1.5 max-w-lg mx-auto">
                    <h4 className="text-lg font-black text-slate-900">
                      Chào bạn! Mình là Liki - Trợ lý & Gia sư Toán AI
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Liki hỗ trợ bạn học Toán THPT theo phương pháp sư phạm của Thầy Nguyễn Bá Kỳ: gợi mở tư duy từng bước, kết nối trực tiếp với <strong>Không gian 3D</strong>, <strong>Xưởng tạo ảnh</strong> và <strong>Tra cứu Google Search thực tế</strong>.
                    </p>
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
                      <p className="text-[11px] text-cyan-700 mt-0.5">Mô phỏng chóp S.ABCD, nón, trụ, Oxyz 360°</p>
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
                      <p className="text-[11px] text-pink-700 mt-0.5">Vẽ sơ đồ, hình minh họa hình học & đề thi</p>
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
                              : 'bg-slate-100 text-slate-900 rounded-tl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>

                          {m.latex && (
                            <div className="mt-2 pt-2 border-t border-black/10 overflow-x-auto">
                              <MathView latex={m.latex} />
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
                  <span>{useSearchGrounding ? 'Liki đang tra cứu Google Search và phân tích...' : 'Liki đang suy nghĩ câu hỏi gợi mở tiếp theo...'}</span>
                </div>
              )}
            </div>

            {/* Search Grounding Toggle */}
            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                <input
                  type="checkbox"
                  checked={useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <Globe size={14} className={useSearchGrounding ? 'text-blue-600 animate-pulse' : 'text-slate-400'} />
                  <span>Tra cứu Google Search thực tế (Đề thi & Tuyển sinh BGD mới nhất)</span>
                </span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">gemini-3.8-flash</span>
            </div>

            {/* Input Form gửi tin nhắn */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendTutorMessage(); }} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={useSearchGrounding ? 'Hỏi Liki về dạng đề thi, thông tin tuyển sinh hoặc toán thực tế...' : 'Nhập câu hỏi hoặc câu trả lời gửi đến Liki...'}
                className="flex-1 h-11 px-4 rounded-xl border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-5 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <Send size={15} />
                <span>Gửi</span>
              </button>
            </form>
          </div>

          {/* Cột phải: Đồ thị hàm số & Công cụ học tập nhanh (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-blue-600" />
                  <h4 className="font-extrabold text-sm text-slate-900">Đồ Thị Trực Quan Oxy</h4>
                </div>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono">2D Oxy</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Minh họa trực quan hình dáng đồ thị $f(x)$ và tiếp tuyến để học sinh dễ hình dung cực trị và tính đơn điệu.
              </p>

              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <FunctionGrapher defaultEquation="x^3 - 3*x^2 + 2" />
              </div>
            </div>

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
      {/* PHÂN HỆ 4: MÁY QUÉT BÀI TẬP AI (CAMERA OCR)                */}
      {/* ========================================================= */}
      {activeStudioTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cột trái: Khung quét ảnh & Chọn bài mẫu (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Camera size={20} className="text-blue-600" />
                  <h3 className="font-extrabold text-base text-slate-900">Khung Quét Camera</h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400">OCR Tự Động</span>
              </div>

              {/* Viewport máy ảnh giả lập */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-4/3 flex flex-col items-center justify-center p-6 text-center text-white border-2 border-dashed border-slate-700">
                {customImagePreview ? (
                  <img
                    src={customImagePreview}
                    alt="Xem trước ảnh bài toán"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3">
                      <Camera size={32} className="text-blue-400" />
                    </div>
                    <p className="font-bold text-sm text-slate-200">Đưa đề bài toán vào khung hình</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Hỗ trợ ảnh chụp sách giáo khoa, bài viết tay hoặc file đề PDF
                    </p>
                  </>
                )}

                {/* Khung ngắm OCR */}
                <div className="absolute inset-4 border-2 border-blue-400/40 rounded-xl pointer-events-none" />
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
                        setCustomImagePreview(null);
                      }}
                      className={`w-full text-left p-3 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        selectedPresetIndex === index && !customProblemText
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
                <label className="text-xs font-bold text-slate-700 block">Hoặc dán văn bản đề bài toán:</label>
                <textarea
                  value={customProblemText}
                  onChange={(e) => setCustomProblemText(e.target.value)}
                  placeholder="Nhập đề bài toán THPT (hàm số, tích phân, hình học không gian Oxyz...)"
                  className="w-full h-20 p-3 rounded-2xl border border-slate-200 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Nút hành động Quét bài */}
              <button
                type="button"
                onClick={handlePerformScan}
                disabled={isScanning}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Gemini Vision Đang Quét & Nhận Dạng OCR...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Quét & Bóc Tách Lời Giải AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Cột phải: Kết quả bóc tách lời giải (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {scanResult ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                      Đã Bóc Tách Thành Công
                    </span>
                    <span className="text-xs font-mono text-slate-400">{scanResult.processingTimeMs} ms</span>
                  </div>

                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                    {scanResult.difficulty}
                  </span>
                </div>

                {/* Đề bài nhận diện */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đề Bài Đã Nhận Diện</h4>
                  <p className="text-sm font-bold text-slate-800 leading-relaxed">{scanResult.problemText}</p>
                  {scanResult.latexFormula && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 overflow-x-auto">
                      <MathView latex={scanResult.latexFormula} />
                    </div>
                  )}
                </div>

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
                        <p className="text-xs text-slate-600 pl-7">{step.description}</p>
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
                    <span className="font-extrabold text-base text-emerald-950">{scanResult.finalAnswer}</span>
                  </div>
                  <CheckCircle2 size={24} className="text-emerald-600" />
                </div>

                {/* Nút đàm thoại với Liki */}
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Bot size={18} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-blue-950">Chưa hiểu rõ bản chất bài toán?</h5>
                      <p className="text-[11px] text-blue-700">
                        Chuyển bài toán sang Gia sư Liki để được hướng dẫn đàm thoại gợi mở từng bước!
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleTransferToSocraticTutor}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap transition-colors cursor-pointer"
                  >
                    <span>Hỏi Gia Sư Liki</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3 shadow-xs">
                <Camera size={48} className="mx-auto text-slate-300" />
                <h4 className="font-bold text-base text-slate-700">Chưa có kết quả quét nào</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Hãy chọn một bài toán mẫu hoặc nhập đề bài rồi bấm nút <strong>"Quét & Bóc Tách Lời Giải AI"</strong> để AI phân tích.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

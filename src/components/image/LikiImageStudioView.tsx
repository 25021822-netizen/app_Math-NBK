import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Wand2,
  Download,
  Upload,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  Maximize2,
  Copy,
  Layers,
  ArrowRight,
  Sliders,
  FileQuestion,
} from 'lucide-react';

interface LikiImageStudioViewProps {
  onInsertToExam?: (imageUrl: string, promptTitle: string) => void;
}

export const LikiImageStudioView: React.FC<LikiImageStudioViewProps> = ({ onInsertToExam }) => {
  const [prompt, setPrompt] = useState<string>(
    'Vẽ sơ đồ hình học không gian 3D khối chóp S.ABCD đáy hình vuông, có đường cao SO vuông góc với đáy, hiển thị thiết diện mặt phẳng SAC màu hồng dạ quang trên nền phòng thí nghiệm hiện đại.'
  );
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageSize, setImageSize] = useState<string>('1K');
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Math Diagram Templates
  const templates = [
    {
      title: 'Khối Chóp S.ABCD Thiết Diện',
      prompt: 'Minh họa hình học không gian 3D khối chóp tứ giác đều S.ABCD, đường cao SH vuông góc đáy, mặt cắt thiết diện qua trục màu hồng neon chuẩn sách giáo khoa Toán 12.',
      ratio: '1:1',
    },
    {
      title: 'Đồ Thị Hàm Số & Tiếp Tuyến',
      prompt: 'Đồ thị hàm số bậc ba y = x^3 - 3x + 1 có hai điểm cực trị và đường tiếp tuyến tại điểm uốn, hệ trục tọa độ Oxy rõ nét, phong cách toán học kỹ thuật số.',
      ratio: '16:9',
    },
    {
      title: 'Khối Tròn Xoay Nón & Trụ',
      prompt: 'Mô hình 3D cắt lớp khối nón tròn xoay nội tiếp trong khối trụ, thể hiện bán kính đáy R và chiều cao h bằng các đường kích thước chuẩn kỹ thuật.',
      ratio: '4:3',
    },
    {
      title: 'Sơ Đồ Tư Duy Tích Phân & Ứng Dụng',
      prompt: 'Sơ đồ tư duy toán học tóm tắt toàn bộ công thức tích phân từng phần, tính diện tích hình phẳng và thể tích khối tròn xoay, infographic hiện đại.',
      ratio: '16:9',
    },
  ];

  const handleSelectTemplate = (t: typeof templates[0]) => {
    setPrompt(t.prompt);
    setAspectRatio(t.ratio);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setInputImage(event.target?.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateOrEdit = async () => {
    if (!prompt.trim()) {
      setErrorMsg('Vui lòng nhập mô tả yêu cầu tạo hoặc chỉnh sửa ảnh!');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          imageSize,
          inputImage: inputImage || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Không thể tạo hình ảnh.');
      }

      setGeneratedImage(data.imageUrl);
      setImageDescription(data.description || '');
    } catch (err: any) {
      console.error('Lỗi tạo ảnh:', err);
      setErrorMsg(err.message || 'Đã xảy ra lỗi khi gọi AI tạo ảnh. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `Liki_Math_Diagram_${Date.now()}.png`;
    a.click();
  };

  const handleCopy = () => {
    if (!generatedImage) return;
    navigator.clipboard.writeText(generatedImage);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900/40 border border-purple-500/30 p-6 rounded-3xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-400 p-0.5 shadow-lg shadow-purple-600/30 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-pink-400">
                <Wand2 size={26} className="animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-pink-400">
                  Liki Visual Studio
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30 font-mono">
                  gemini-nano-banana-2.1
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mt-0.5">Xưởng Tạo & Chỉnh Sửa Ảnh Toán Học AI</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Tạo hình minh họa hình học không gian, đồ thị hàm số, infographic chuyên đề hoặc tải lên bản phác thảo bài tập để Liki AI chỉnh sửa và nâng cấp tự động.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form & Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sliders size={16} className="text-pink-400" />
              <span>Yêu Cầu & Tham Số Tạo Ảnh</span>
            </h3>

            {/* Template Buttons */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Mẫu Gợi Ý Nhanh:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-pink-500/40 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-200 group-hover:text-pink-300 line-clamp-1">
                      {t.title}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Tỉ lệ {t.ratio}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Mô tả chi tiết hình ảnh (Prompt) *
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Nhập mô tả chi tiết: hình khối gì, màu sắc, góc nhìn, chú thích công thức..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 focus:border-pink-500 focus:outline-none text-xs text-slate-200 resize-none leading-relaxed"
              />
            </div>

            {/* Aspect Ratio & Image Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Tỉ lệ khung hình:
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-pink-500 focus:outline-none cursor-pointer"
                >
                  <option value="1:1">1:1 (Vuông - Mặc định)</option>
                  <option value="16:9">16:9 (Ngang chuẩn HD)</option>
                  <option value="4:3">4:3 (Đồ thị học tập)</option>
                  <option value="9:16">9:16 (Dọc điện thoại)</option>
                  <option value="3:4">3:4 (Trang tài liệu)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Độ phân giải:
                </label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-pink-500 focus:outline-none cursor-pointer"
                >
                  <option value="1K">1K (Tiêu chuẩn)</option>
                  <option value="2K">2K (Sắc nét cao)</option>
                  <option value="4K">4K (Siêu nét Ultra HD)</option>
                </select>
              </div>
            </div>

            {/* Image-to-Image Input (Optional Editing) */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Chỉnh Sửa Từ Ảnh Có Sẵn (Tùy chọn):
                </label>
                {inputImage && (
                  <button
                    type="button"
                    onClick={() => setInputImage(null)}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Gỡ ảnh
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {inputImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 p-2 flex items-center gap-3">
                  <img src={inputImage} alt="Input" className="w-16 h-16 object-cover rounded-xl" />
                  <div className="text-xs text-slate-300">
                    <p className="font-bold text-white">Đã tải ảnh tham chiếu</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Liki AI sẽ sửa đổi dựa trên ảnh này.</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-2xl border border-dashed border-slate-700 hover:border-pink-500/50 bg-slate-950 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload size={15} />
                  <span>Tải ảnh đề thi / sơ đồ để AI chỉnh sửa</span>
                </button>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerateOrEdit}
              className={`w-full py-3.5 rounded-2xl font-black text-xs text-white shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isLoading
                  ? 'bg-slate-700 cursor-not-allowed opacity-75'
                  : 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30 hover:scale-[1.01]'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Đang tạo hình ảnh...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{inputImage ? 'Chỉnh Sửa Hình Ảnh Với Liki' : 'Tạo Hình Ảnh Mới Ngay'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Canvas Result & Actions (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-pink-400" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Kết Quả Hình Ảnh Kết Xuất
                  </span>
                </div>
                {generatedImage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Sao chép Data URL"
                    >
                      {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copiedLink ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-3 py-1 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-extrabold transition-all flex items-center gap-1 shadow cursor-pointer"
                      title="Tải ảnh về máy"
                    >
                      <Download size={13} />
                      <span>Tải PNG</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Image Preview Canvas */}
              <div className="mt-4 w-full min-h-[380px] bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center p-3 overflow-hidden relative group">
                {generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Liki AI Generated"
                    className="max-h-[460px] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-transform"
                  />
                ) : (
                  <div className="text-center p-8 max-w-sm">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mx-auto mb-3">
                      <ImageIcon size={32} />
                    </div>
                    <h4 className="text-sm font-black text-slate-300">Chưa có hình ảnh nào được tạo</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Chọn mẫu gợi ý bên trái hoặc nhập mô tả hình ảnh cần tạo.
                    </p>
                  </div>
                )}
              </div>

              {imageDescription && (
                <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  {imageDescription}
                </div>
              )}
            </div>

            {/* Bottom Exam Insertion integration */}
            {generatedImage && onInsertToExam && (
              <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Sử dụng ảnh này cho phòng thi hoặc ngân hàng đề bài tập?
                </span>
                <button
                  type="button"
                  onClick={() => onInsertToExam(generatedImage, prompt)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileQuestion size={14} />
                  <span>Đưa Vào Đề Thi Math&NBK</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

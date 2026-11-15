import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LineChart,
  Sparkles,
  Download,
  Check,
  Table,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Split,
  Maximize2,
} from 'lucide-react';
import { MathView } from './MathView';
import { parseMathFunction, ParsedFunctionResult } from '../utils/functionParser';

interface FunctionGrapherProps {
  initialFormula?: string;
  defaultEquation?: string;
  initialFunctionId?: string;
  showControls?: boolean;
  onExportImage?: (dataUrl: string, title: string) => void;
}

export const FunctionGrapher: React.FC<FunctionGrapherProps> = ({
  initialFormula,
  defaultEquation,
  initialFunctionId,
  showControls = true,
  onExportImage,
}) => {
  const resolvedInitialFormula =
    initialFormula ||
    defaultEquation ||
    (initialFunctionId === 'quadratic_1'
      ? 'y = -x^2 + 2x + 3'
      : initialFunctionId === 'rational_1'
      ? 'y = (2x + 1)/(x - 1)'
      : initialFunctionId === 'trig_sin'
      ? 'y = 2*sin(x)'
      : 'y = 3x - 2');

  // Input formula state (người dùng tự do nhập bất kỳ hàm số nào)
  const [formulaInput, setFormulaInput] = useState<string>(resolvedInitialFormula);
  const [activeFormula, setActiveFormula] = useState<string>(resolvedInitialFormula);

  // Viewport / Coordinate plane state
  const [scale, setScale] = useState<number>(45); // Pixels per unit
  const [offsetX, setOffsetX] = useState<number>(0); // Center offset X
  const [offsetY, setOffsetY] = useState<number>(0); // Center offset Y
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Inspection & Display Options
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showKeyPoints, setShowKeyPoints] = useState<boolean>(true);
  const [showAsymptotes, setShowAsymptotes] = useState<boolean>(true); // Bật/tắt hiển thị tiệm cận
  const [showTangent, setShowTangent] = useState<boolean>(false);
  const [tangentX, setTangentX] = useState<number>(1);
  const [hoverCoord, setHoverCoord] = useState<{ mathX: number; mathY: number; px: number; py: number } | null>(null);
  const [showTable, setShowTable] = useState<boolean>(true);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Phân tích hàm số toán học và tính toán tiệm cận
  const parsed: ParsedFunctionResult = useMemo(() => {
    return parseMathFunction(activeFormula);
  }, [activeFormula]);

  // Cập nhật khi nhấn nút "Vẽ đồ thị"
  const handleApplyFormula = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (formulaInput.trim()) {
      setActiveFormula(formulaInput.trim());
    }
  };

  // Vẽ đồ thị trên Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const originX = width / 2 + offsetX;
    const originY = height / 2 + offsetY;

    // 1. Xóa toàn bộ canvas và vẽ nền
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 2. Vẽ lưới ô vuông tọa độ (Grid)
    if (showGrid) {
      ctx.lineWidth = 1;
      // Lưới phụ (nửa đơn vị nếu scale lớn)
      if (scale >= 50) {
        const subStep = scale / 2;
        ctx.strokeStyle = '#F8FAFC';
        ctx.beginPath();
        for (let x = originX % subStep; x < width; x += subStep) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = originY % subStep; y < height; y += subStep) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      }

      // Lưới chính
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      for (let x = originX % scale; x < width; x += scale) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = originY % scale; y < height; y += scale) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // 3. Vẽ hai trục tọa độ Ox và Oy
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#334155'; // Slate-700
    // Trục Ox
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Mũi tên Ox
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(width - 2, originY);
    ctx.lineTo(width - 12, originY - 5);
    ctx.lineTo(width - 12, originY + 5);
    ctx.closePath();
    ctx.fill();

    // Trục Oy
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Mũi tên Oy
    ctx.beginPath();
    ctx.moveTo(originX, 2);
    ctx.lineTo(originX - 5, 12);
    ctx.lineTo(originX + 5, 12);
    ctx.closePath();
    ctx.fill();

    // Nhãn trục: O, x, y
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('x', width - 18, originY - 10);
    ctx.fillText('y', originX + 10, 18);
    ctx.fillText('O', originX - 16, originY + 16);

    // Đánh số trên các trục tọa độ
    ctx.fillStyle = '#64748B';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';

    const minX = Math.floor(-originX / scale) - 2;
    const maxX = Math.ceil((width - originX) / scale) + 2;
    const minY = Math.floor((originY - height) / scale) - 2;
    const maxY = Math.ceil(originY / scale) + 2;

    // Số trên Ox
    for (let i = minX; i <= maxX; i++) {
      if (i === 0) continue;
      const px = originX + i * scale;
      if (px > 25 && px < width - 25) {
        ctx.beginPath();
        ctx.moveTo(px, originY - 3);
        ctx.lineTo(px, originY + 3);
        ctx.strokeStyle = '#475569';
        ctx.stroke();
        ctx.fillText(i.toString(), px, originY + 16);
      }
    }

    // Số trên Oy
    ctx.textAlign = 'right';
    for (let j = minY; j <= maxY; j++) {
      if (j === 0) continue;
      const py = originY - j * scale;
      if (py > 25 && py < height - 25) {
        ctx.beginPath();
        ctx.moveTo(originX - 3, py);
        ctx.lineTo(originX + 3, py);
        ctx.strokeStyle = '#475569';
        ctx.stroke();
        ctx.fillText(j.toString(), originX - 6, py + 4);
      }
    }

    // =========================================================================
    // 4. VẼ CÁC ĐƯỜNG TIỆM CẬN (ĐỨNG, NGANG, XIÊN)
    // =========================================================================
    if (showAsymptotes && parsed.asymptotes) {
      // A. Tiệm cận đứng (Vertical: x = x0) - Nét đứt màu đỏ / rose
      parsed.asymptotes.vertical.forEach((v) => {
        const vPx = originX + v.x * scale;
        if (vPx >= -20 && vPx <= width + 20) {
          ctx.strokeStyle = '#E11D48'; // Rose-600
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);

          ctx.beginPath();
          ctx.moveTo(vPx, 0);
          ctx.lineTo(vPx, height);
          ctx.stroke();
          ctx.setLineDash([]); // Reset

          // Nhãn TCĐ nổi bật ở cạnh trên
          const tagLabel = `TCĐ: x = ${v.x}`;
          ctx.font = 'bold 11px monospace';
          const tagWidth = ctx.measureText(tagLabel).width + 12;
          const tagX = Math.min(Math.max(vPx - tagWidth / 2, 8), width - tagWidth - 8);
          const tagY = 28;

          ctx.fillStyle = '#FFF1F2'; // Rose-50
          ctx.strokeStyle = '#FDA4AF'; // Rose-300
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY - 14, tagWidth, 20, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#BE123C'; // Rose-700
          ctx.textAlign = 'center';
          ctx.fillText(tagLabel, tagX + tagWidth / 2, tagY);
        }
      });

      // B. Tiệm cận ngang (Horizontal: y = y0) - Nét đứt màu ngọc bích / teal
      if (parsed.asymptotes.horizontal) {
        const h = parsed.asymptotes.horizontal;
        const hPy = originY - h.y * scale;
        if (hPy >= -20 && hPy <= height + 20) {
          ctx.strokeStyle = '#0D9488'; // Teal-600
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);

          ctx.beginPath();
          ctx.moveTo(0, hPy);
          ctx.lineTo(width, hPy);
          ctx.stroke();
          ctx.setLineDash([]);

          // Nhãn TCN nổi bật ở góc phải
          const tagLabel = `TCN: y = ${h.y}`;
          ctx.font = 'bold 11px monospace';
          const tagWidth = ctx.measureText(tagLabel).width + 12;
          const tagX = width - tagWidth - 14;
          const tagY = Math.min(Math.max(hPy - 6, 20), height - 20);

          ctx.fillStyle = '#F0FDFA'; // Teal-50
          ctx.strokeStyle = '#5EEAD4'; // Teal-300
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY - 14, tagWidth, 20, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0F766E'; // Teal-700
          ctx.textAlign = 'center';
          ctx.fillText(tagLabel, tagX + tagWidth / 2, tagY);
        }
      }

      // C. Tiệm cận xiên (Slant: y = ax + b) - Nét đứt màu tím / violet
      if (parsed.asymptotes.slant) {
        const s = parsed.asymptotes.slant;
        ctx.strokeStyle = '#7C3AED'; // Violet-600
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        const startX = minX;
        const endX = maxX;
        const startY = s.a * startX + s.b;
        const endY = s.a * endX + s.b;

        ctx.beginPath();
        ctx.moveTo(originX + startX * scale, originY - startY * scale);
        ctx.lineTo(originX + endX * scale, originY - endY * scale);
        ctx.stroke();
        ctx.setLineDash([]);

        // Nhãn TCX nổi bật
        const tagLabel = `TCX: ${s.equation}`;
        ctx.font = 'bold 11px monospace';
        const tagWidth = ctx.measureText(tagLabel).width + 12;
        const midX = 2;
        const midY = s.a * midX + s.b;
        const tagPx = Math.min(Math.max(originX + midX * scale - tagWidth / 2, 10), width - tagWidth - 10);
        const tagPy = Math.min(Math.max(originY - midY * scale - 10, 30), height - 25);

        ctx.fillStyle = '#F5F3FF'; // Violet-50
        ctx.strokeStyle = '#C4B5FD'; // Violet-300
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tagPx, tagPy - 14, tagWidth, 20, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#6D28D9'; // Violet-700
        ctx.textAlign = 'center';
        ctx.fillText(tagLabel, tagPx + tagWidth / 2, tagPy);
      }
    }

    // =========================================================================
    // 5. VẼ ĐƯỜNG CONG HÀM SỐ f(x)
    // =========================================================================
    if (!parsed.error && typeof parsed.evaluate === 'function') {
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#2563EB'; // Blue-600
      ctx.beginPath();

      let isDrawing = false;
      let prevMathY = NaN;

      const pxStep = 1;
      for (let px = 0; px <= width; px += pxStep) {
        const mathX = (px - originX) / scale;
        const mathY = parsed.evaluate(mathX);

        if (isNaN(mathY) || !isFinite(mathY)) {
          isDrawing = false;
          prevMathY = NaN;
          continue;
        }

        // Phát hiện nhảy qua tiệm cận đứng
        if (!isNaN(prevMathY) && Math.abs(mathY - prevMathY) * scale > height * 0.7) {
          isDrawing = false;
          prevMathY = mathY;
          continue;
        }
        prevMathY = mathY;

        const py = originY - mathY * scale;

        if (py < -height * 1.5 || py > height * 2.5) {
          isDrawing = false;
          continue;
        }

        if (!isDrawing) {
          ctx.moveTo(px, py);
          isDrawing = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // 6. Điểm đặc biệt: Giao điểm Oy, Ox, Đỉnh Parabol
      if (showKeyPoints) {
        // Giao điểm với Oy (x = 0)
        if (parsed.yIntercept) {
          const oyX = originX;
          const oyY = originY - parsed.yIntercept.y * scale;
          if (oyY >= 0 && oyY <= height) {
            ctx.fillStyle = '#059669'; // Emerald-600
            ctx.beginPath();
            ctx.arc(oyX, oyY, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#065F46';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(` Oy(0; ${parsed.yIntercept.y})`, oyX + 8, oyY - 6);
          }
        }

        // Giao điểm với Ox (y = 0)
        parsed.xIntercepts.forEach((pt) => {
          const oxX = originX + pt.x * scale;
          const oxY = originY;
          if (oxX >= 0 && oxX <= width) {
            ctx.fillStyle = '#D97706'; // Amber-600
            ctx.beginPath();
            ctx.arc(oxX, oxY, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#92400E';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`Ox(${pt.x}; 0)`, oxX, oxY - 10);
          }
        });

        // Đỉnh Parabol
        if (parsed.vertex) {
          const vx = originX + parsed.vertex.x * scale;
          const vy = originY - parsed.vertex.y * scale;
          if (vx >= 0 && vx <= width && vy >= 0 && vy <= height) {
            ctx.fillStyle = '#9333EA'; // Purple-600
            ctx.beginPath();
            ctx.arc(vx, vy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#6B21A8';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`Đỉnh I(${parsed.vertex.x}; ${parsed.vertex.y})`, vx, vy - 12);
          }
        }
      }

      // 7. Tiếp tuyến tại x0 (nếu bật)
      if (showTangent) {
        const x0 = tangentX;
        const y0 = parsed.evaluate(x0);
        const k = parsed.derivative(x0);

        if (!isNaN(y0) && !isNaN(k) && isFinite(y0) && isFinite(k)) {
          const ptX = originX + x0 * scale;
          const ptY = originY - y0 * scale;

          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#DC2626'; // Red-600
          ctx.beginPath();
          const startX = minX;
          const endX = maxX;
          const startY = y0 + k * (startX - x0);
          const endY = y0 + k * (endX - x0);

          ctx.moveTo(originX + startX * scale, originY - startY * scale);
          ctx.lineTo(originX + endX * scale, originY - endY * scale);
          ctx.stroke();

          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          ctx.arc(ptX, ptY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#991B1B';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(` M(${x0.toFixed(2)}; ${y0.toFixed(2)})`, ptX + 8, ptY - 8);
        }
      }

      // 8. Rê chuột kiểm tra tọa độ
      if (hoverCoord && !isPanning) {
        const { mathX, mathY, px, py } = hoverCoord;

        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, originY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(originX, py);
        ctx.stroke();

        ctx.setLineDash([]);

        ctx.fillStyle = '#2563EB';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        const textLabel = `(${mathX.toFixed(2)}; ${mathY.toFixed(2)})`;
        ctx.font = 'bold 11px monospace';
        const textWidth = ctx.measureText(textLabel).width;
        const boxWidth = textWidth + 14;
        const boxHeight = 22;
        const boxX = px + 10 + boxWidth > width ? px - boxWidth - 10 : px + 10;
        const boxY = py - 25 < 0 ? py + 10 : py - 25;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(textLabel, boxX + 7, boxY + 15);
      }
    }
  }, [parsed, scale, offsetX, offsetY, showGrid, showKeyPoints, showAsymptotes, showTangent, tangentX, hoverCoord, isPanning]);

  // Xử lý kéo rê canvas (Pan)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanning) {
      setOffsetX(e.clientX - panStart.x);
      setOffsetY(e.clientY - panStart.y);
      setHoverCoord(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mousePx = e.clientX - rect.left;
    const mousePy = e.clientY - rect.top;

    const originX = canvas.width / 2 + offsetX;
    const originY = canvas.height / 2 + offsetY;

    const mathX = (mousePx - originX) / scale;
    const mathY = parsed.evaluate(mathX);

    if (!isNaN(mathY) && isFinite(mathY)) {
      const snapPy = originY - mathY * scale;
      if (Math.abs(mousePy - snapPy) < 40) {
        setHoverCoord({
          mathX,
          mathY,
          px: mousePx,
          py: snapPy,
        });
        return;
      }
    }
    setHoverCoord(null);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetView = () => {
    setScale(45);
    setOffsetX(0);
    setOffsetY(0);
    setTangentX(1);
    setHoverCoord(null);
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    if (onExportImage) {
      onExportImage(dataUrl, `Đồ thị hàm số ${activeFormula}`);
    } else {
      const link = document.createElement('a');
      link.download = `do-thi-${activeFormula.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    }

    setCopiedImage(true);
    setTimeout(() => setCopiedImage(false), 2500);
  };

  // Đếm tổng số đường tiệm cận tìm được
  const totalAsymptotesCount =
    (parsed.asymptotes?.vertical?.length || 0) +
    (parsed.asymptotes?.horizontal ? 1 : 0) +
    (parsed.asymptotes?.slant ? 1 : 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
      {/* 1. Header & Thanh Nhập Hàm Số Tự Do (ĐÃ LOẠI BỎ TOÀN BỘ DANH SÁCH GỢI Ý) */}
      <div className="p-5 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border-b border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <LineChart size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>Vẽ Đồ Thị Hàm Số & Xác Định Tiệm Cận</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Tự Động Phân Tích
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Nhập phương trình hàm số bất kỳ để tự động vẽ đồ thị, xác định tiệm cận đứng, tiệm cận ngang và tiệm cận xiên.
              </p>
            </div>
          </div>
        </div>

        {/* Ô Nhập Hàm Số Chính & Nút Vẽ */}
        <form onSubmit={handleApplyFormula} className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-xs font-black text-blue-700 font-mono">
              y =
            </span>
            <input
              type="text"
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              placeholder="Nhập hàm số: Ví dụ: 3x - 2, (2x + 1)/(x - 1), (x^2 + 2x - 1)/(x - 1)..."
              className="w-full h-11 pl-12 pr-4 rounded-2xl border-2 border-blue-500/80 bg-white font-mono text-sm font-extrabold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100 transition-all shadow-xs"
            />
          </div>

          <button
            type="submit"
            className="h-11 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all whitespace-nowrap"
          >
            <Sparkles size={16} />
            <span>Vẽ Đồ Thị & Tìm Tiệm Cận</span>
          </button>
        </form>

        {parsed.error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{parsed.error}</span>
          </div>
        )}
      </div>

      {/* 2. KHẢO SÁT TIỆM CẬN: TIỆM CẬN ĐỨNG, TIỆM CẬN NGANG, TIỆM CẬN XIÊN */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-xs text-slate-800">
            <Split size={16} className="text-indigo-600" />
            <span>Kết Quả Xác Định Đường Tiệm Cận Của Đồ Thị:</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              totalAsymptotesCount > 0
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {totalAsymptotesCount > 0 ? `Có ${totalAsymptotesCount} đường tiệm cận` : 'Không có tiệm cận'}
          </span>
        </div>

        {/* Grid 3 thẻ Tiệm Cận: Đứng - Ngang - Xiên */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Tiệm Cận Đứng (TCĐ) */}
          <div
            className={`p-3 rounded-2xl border transition-all ${
              parsed.asymptotes.vertical.length > 0
                ? 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
                1. Tiệm Cận Đứng (TCĐ)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            </div>
            {parsed.asymptotes.vertical.length > 0 ? (
              <div className="space-y-1">
                <div className="font-mono text-base font-black text-rose-700">
                  {parsed.asymptotes.vertical.map((v) => v.equation).join(', ')}
                </div>
                <p className="text-[10px] text-rose-800/80 leading-tight">
                  {parsed.asymptotes.vertical.map((v) => `lim y khi x → ${v.x} = ∞`).join('; ')}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-slate-600">Không có TCĐ</span>
                <p className="text-[10px] text-slate-400">Không có điểm làm mẫu số bằng 0</p>
              </div>
            )}
          </div>

          {/* Card 2: Tiệm Cận Ngang (TCN) */}
          <div
            className={`p-3 rounded-2xl border transition-all ${
              parsed.asymptotes.horizontal
                ? 'bg-teal-50/80 border-teal-200 text-teal-950 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">
                2. Tiệm Cận Ngang (TCN)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
            </div>
            {parsed.asymptotes.horizontal ? (
              <div className="space-y-1">
                <div className="font-mono text-base font-black text-teal-700">
                  {parsed.asymptotes.horizontal.equation}
                </div>
                <p className="text-[10px] text-teal-800/80 leading-tight">
                  lim y khi x → ±∞ = {parsed.asymptotes.horizontal.y}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-slate-600">Không có TCN</span>
                <p className="text-[10px] text-slate-400">lim y khi x → ±∞ tiến ra vô cùng (∞)</p>
              </div>
            )}
          </div>

          {/* Card 3: Tiệm Cận Xiên (TCX) */}
          <div
            className={`p-3 rounded-2xl border transition-all ${
              parsed.asymptotes.slant
                ? 'bg-purple-50/80 border-purple-200 text-purple-950 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
                3. Tiệm Cận Xiên (TCX)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
            </div>
            {parsed.asymptotes.slant ? (
              <div className="space-y-1">
                <div className="font-mono text-base font-black text-purple-700">
                  {parsed.asymptotes.slant.equation}
                </div>
                <p className="text-[10px] text-purple-800/80 leading-tight">
                  a = lim [y/x] = {parsed.asymptotes.slant.a}; b = lim [y - ax] = {parsed.asymptotes.slant.b}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-slate-600">Không có TCX</span>
                <p className="text-[10px] text-slate-400">Bậc tử không lớn hơn bậc mẫu 1 bậc</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Sub-Bar: Thông Tin Chi Tiết Điểm Tọa Độ */}
      <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-slate-500">Đồ thị:</span>
          <div className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 font-bold text-blue-700 flex items-center gap-1.5">
            <MathView math={parsed.displayLatex} />
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
            {parsed.functionTypeLabel}
          </span>
        </div>

        {/* Điểm đặc biệt: Giao điểm Ox, Oy */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {parsed.yIntercept && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold" title="Giao điểm với trục tung Oy">
              Oy: (0; {parsed.yIntercept.y})
            </span>
          )}
          {parsed.xIntercepts.length > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-semibold" title="Giao điểm với trục hoành Ox">
              Ox: {parsed.xIntercepts.map((pt) => `(${pt.x}; 0)`).join(', ')}
            </span>
          )}
          {parsed.vertex && (
            <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-semibold" title="Đỉnh Parabol">
              Đỉnh I: ({parsed.vertex.x}; {parsed.vertex.y})
            </span>
          )}
        </div>
      </div>

      {/* 4. Canvas Viewport Trực Quan */}
      <div className="relative w-full bg-slate-100 flex flex-col items-center justify-center p-3 select-none">
        {/* Top-right Floating Control Toolbar */}
        <div className="absolute top-5 right-5 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1 rounded-2xl border border-slate-200 shadow-md text-xs">
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(s + 10, 100))}
            title="Phóng to lưới (Zoom In)"
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(s - 10, 20))}
            title="Thu nhỏ lưới (Zoom Out)"
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            title="Đặt lại góc nhìn chuẩn (Tâm O ở giữa)"
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors"
          >
            <RotateCcw size={16} />
          </button>
          <div className="h-5 w-px bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={handleExportPNG}
            title="Tải ảnh đồ thị PNG về máy"
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold flex items-center gap-1 transition-colors"
          >
            {copiedImage ? <Check size={14} className="text-emerald-600" /> : <Download size={14} />}
            <span>{copiedImage ? 'Đã lưu' : 'Tải Ảnh'}</span>
          </button>
        </div>

        {/* Top-left Options Toolbar */}
        <div className="absolute top-5 left-5 z-10 hidden sm:flex items-center gap-1.5 bg-white/95 backdrop-blur-xs p-1.5 rounded-2xl border border-slate-200 shadow-md text-[11px] font-semibold text-slate-700">
          <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={showAsymptotes}
              onChange={(e) => setShowAsymptotes(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            <span className="font-bold text-rose-700">Đường tiệm cận ({totalAsymptotesCount})</span>
          </label>
          <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={showKeyPoints}
              onChange={(e) => setShowKeyPoints(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Giao điểm Ox, Oy</span>
          </label>
          <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Lưới ô vuông</span>
          </label>
          <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={showTangent}
              onChange={(e) => setShowTangent(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span>Tiếp tuyến</span>
          </label>
        </div>

        {/* Canvas Display */}
        <canvas
          ref={canvasRef}
          width={760}
          height={440}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full max-w-[760px] h-[340px] sm:h-[440px] bg-white rounded-2xl border border-slate-300 shadow-sm transition-all ${
            isPanning ? 'cursor-grabbing' : 'cursor-crosshair'
          }`}
        />

        <div className="mt-2 text-center text-[11px] text-slate-500">
          Tiệm cận: <strong className="text-rose-600">TCĐ</strong> (đỏ) · <strong className="text-teal-600">TCN</strong> (ngọc) · <strong className="text-purple-600">TCX</strong> (tím)
        </div>
      </div>

      {/* 5. Tiếp tuyến & Bảng giá trị điểm mẫu (x, y) */}
      {showControls && (
        <div className="p-5 bg-white border-t border-slate-200 space-y-4 text-xs">
          {/* Thanh trượt tiếp tuyến (Tangent Slider) */}
          {showTangent && (
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-purple-900">Tiếp Tuyến Tại Điểm M(x₀; y₀)</span>
                <div className="flex items-center gap-3 font-mono text-[11px] text-purple-900 bg-white px-3 py-1 rounded-xl border border-purple-200">
                  <span>x₀ = <strong className="text-purple-700">{tangentX.toFixed(2)}</strong></span>
                  <span>y₀ = <strong className="text-blue-600">{parsed.evaluate(tangentX).toFixed(2)}</strong></span>
                  <span>Hệ số góc k = f'(x₀) = <strong className="text-emerald-600">{parsed.derivative(tangentX).toFixed(2)}</strong></span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>x₀ = -5</span>
                  <span className="text-purple-700 font-bold">Kéo để di chuyển tiếp điểm M</span>
                  <span>x₀ = +5</span>
                </div>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={tangentX}
                  onChange={(e) => setTangentX(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Bảng giá trị mẫu (x, y) để học sinh vẽ đồ thị vào vở */}
          {parsed.sampleTable.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <Table size={15} className="text-blue-600" />
                  <span>Bảng Giá Trị Điểm Tọa Độ Mẫu (Hỗ trợ học sinh vẽ vào vở):</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowTable((v) => !v)}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  {showTable ? 'Thu gọn' : 'Xem bảng giá trị'}
                </button>
              </div>

              {showTable && (
                <div className="overflow-x-auto">
                  <table className="w-full border border-slate-200 text-center text-xs font-mono rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2 border-r border-slate-200 w-16 bg-blue-50 text-blue-800">x</th>
                        {parsed.sampleTable.map((pt, i) => (
                          <th key={i} className="p-2 border-r border-slate-200">
                            {pt.x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr>
                        <td className="p-2 border-r border-slate-200 font-bold bg-blue-50 text-blue-800">y</td>
                        {parsed.sampleTable.map((pt, i) => (
                          <td
                            key={i}
                            className={`p-2 border-r border-slate-200 ${
                              pt.x === 0 ? 'bg-emerald-50 text-emerald-800 font-bold' : ''
                            } ${pt.y === 0 ? 'bg-amber-50 text-amber-800 font-bold' : ''}`}
                          >
                            {pt.y}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LineChart,
  Download,
  Check,
  Table,
  AlertCircle,
  Split,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Maximize2,
  Play,
  Pause,
  Crosshair,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MathView } from './MathView';
import {
  parseMathFunction,
  parseBoundExpression,
  computeIntersections,
  computeDefiniteIntegral,
  ParsedFunctionResult,
  DomainRange,
} from '../utils/functionParser';

interface FunctionGrapherProps {
  initialFormula?: string;
  defaultEquation?: string;
  initialFunctionId?: string;
  showControls?: boolean;
  onExportImage?: (dataUrl: string, title: string) => void;
}

interface GraphFunctionItem {
  id: string;
  formula: string;
  color: string;
  visible: boolean;
  useRange: boolean;
  rangeA: string;
  rangeB: string;
  includeA: boolean;
  includeB: boolean;
}

interface EvaluatedFunctionItem extends GraphFunctionItem {
  index: number;
  label: string;
  parsed: ParsedFunctionResult;
  effectiveDomain: DomainRange | null;
  boundError?: string;
}

interface IntersectionPoint {
  x: number;
  y: number;
  labelA: string;
  labelB: string;
  colorA: string;
  colorB: string;
}

const FUNCTION_PALETTE = [
  '#2563EB', // Blue
  '#E11D48', // Rose
  '#059669', // Emerald
  '#7C3AED', // Violet
  '#D97706', // Amber
  '#0D9488', // Teal
  '#4F46E5', // Indigo
  '#DB2777', // Pink
];

function formatNumberCompact(val: number): string {
  if (!isFinite(val)) return '—';
  const rounded = Math.round(val * 1000) / 1000;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
}

const PRESET_CONFIGS: {
  id: string;
  label: string;
  useGlobalRange: boolean;
  globalA: string;
  globalB: string;
  items: Omit<GraphFunctionItem, 'id'>[];
}[] = [
  {
    id: 'parabola_line',
    label: 'Parabol & Đường thẳng',
    useGlobalRange: false,
    globalA: '-2',
    globalB: '3',
    items: [
      {
        formula: 'y = x^2 - 2x',
        color: FUNCTION_PALETTE[0],
        visible: true,
        useRange: true,
        rangeA: '-1',
        rangeB: '3',
        includeA: true,
        includeB: true,
      },
      {
        formula: 'y = x + 2',
        color: FUNCTION_PALETTE[1],
        visible: true,
        useRange: true,
        rangeA: '-2',
        rangeB: '4',
        includeA: true,
        includeB: true,
      },
    ],
  },
  {
    id: 'trig_interval',
    label: 'Lượng giác [-π; π]',
    useGlobalRange: true,
    globalA: '-pi',
    globalB: 'pi',
    items: [
      {
        formula: 'y = 2*sin(x)',
        color: FUNCTION_PALETTE[0],
        visible: true,
        useRange: true,
        rangeA: '-pi',
        rangeB: 'pi',
        includeA: true,
        includeB: true,
      },
      {
        formula: 'y = cos(2*x)',
        color: FUNCTION_PALETTE[2],
        visible: true,
        useRange: true,
        rangeA: '-pi',
        rangeB: 'pi',
        includeA: true,
        includeB: true,
      },
    ],
  },
  {
    id: 'cubic_pair',
    label: 'Bậc ba & Tương giao',
    useGlobalRange: false,
    globalA: '-2.5',
    globalB: '2.5',
    items: [
      {
        formula: 'y = x^3 - 3x + 1',
        color: FUNCTION_PALETTE[3],
        visible: true,
        useRange: true,
        rangeA: '-2.2',
        rangeB: '2.2',
        includeA: true,
        includeB: true,
      },
      {
        formula: 'y = x + 1',
        color: FUNCTION_PALETTE[4],
        visible: true,
        useRange: false,
        rangeA: '-3',
        rangeB: '3',
        includeA: true,
        includeB: true,
      },
    ],
  },
  {
    id: 'rational_asymptote',
    label: 'Phân thức (Tiệm cận)',
    useGlobalRange: false,
    globalA: '-5',
    globalB: '6',
    items: [
      {
        formula: 'y = (2x + 1)/(x - 1)',
        color: FUNCTION_PALETTE[0],
        visible: true,
        useRange: false,
        rangeA: '-5',
        rangeB: '6',
        includeA: true,
        includeB: true,
      },
      {
        formula: 'y = -x + 3',
        color: FUNCTION_PALETTE[1],
        visible: true,
        useRange: true,
        rangeA: '-2',
        rangeB: '5',
        includeA: true,
        includeB: true,
      },
    ],
  },
];

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
      : initialFunctionId === 'cubic_1'
      ? 'y = x^3 - 3x + 1'
      : 'y = 3x - 2');

  // Danh sách nhiều hàm số 2D
  const [functions, setFunctions] = useState<GraphFunctionItem[]>(() => {
    const primary: GraphFunctionItem = {
      id: 'fn-1',
      formula: resolvedInitialFormula,
      color: FUNCTION_PALETTE[0],
      visible: true,
      useRange: false,
      rangeA: '-2',
      rangeB: '3',
      includeA: true,
      includeB: true,
    };

    if (initialFunctionId) {
      return [primary];
    }

    return [
      primary,
      {
        id: 'fn-2',
        formula: 'y = x^2 - 2x',
        color: FUNCTION_PALETTE[1],
        visible: true,
        useRange: true,
        rangeA: '-1',
        rangeB: '3',
        includeA: true,
        includeB: true,
      },
    ];
  });

  const [selectedId, setSelectedId] = useState<string>('fn-1');

  // Miền chung [a; b] và thanh trượt điểm chạy x ∈ [a; b]
  const [useGlobalRange, setUseGlobalRange] = useState<boolean>(false);
  const [globalRangeA, setGlobalRangeA] = useState<string>('-2');
  const [globalRangeB, setGlobalRangeB] = useState<string>('3');

  const [showTraceSlider, setShowTraceSlider] = useState<boolean>(false);
  const [traceX, setTraceX] = useState<number>(0.5);
  const [isAnimatingTrace, setIsAnimatingTrace] = useState<boolean>(false);
  const [showAreaIntegral, setShowAreaIntegral] = useState<boolean>(false);

  // Viewport / Coordinate plane state
  const [scale, setScale] = useState<number>(48);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Inspection & Display Options
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showKeyPoints, setShowKeyPoints] = useState<boolean>(true);
  const [showIntersections, setShowIntersections] = useState<boolean>(true);
  const [showAsymptotes, setShowAsymptotes] = useState<boolean>(true);
  const [showTangent, setShowTangent] = useState<boolean>(false);
  const [tangentX, setTangentX] = useState<number>(1);
  const [hoverCoord, setHoverCoord] = useState<{
    mathX: number;
    mathY: number;
    px: number;
    py: number;
    fnLabel: string;
    color: string;
  } | null>(null);
  const [showTable, setShowTable] = useState<boolean>(true);
  const [showAsymptotePanel, setShowAsymptotePanel] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Phân tích miền chung [a; b]
  const parsedGlobalRange = useMemo<{ domain: DomainRange | null; error?: string }>(() => {
    if (!useGlobalRange) return { domain: null };
    const a = parseBoundExpression(globalRangeA);
    const b = parseBoundExpression(globalRangeB);
    if (a === null || b === null) {
      return { domain: null, error: 'Cận a, b không hợp lệ (ví dụ: -2, 3, -pi, pi/2).' };
    }
    if (a >= b) {
      return { domain: null, error: 'Cần nhập cận a nhỏ hơn cận b (a < b).' };
    }
    return { domain: { a, b } };
  }, [useGlobalRange, globalRangeA, globalRangeB]);

  // Phân tích tất cả các hàm số trong danh sách
  const evaluatedFunctions: EvaluatedFunctionItem[] = useMemo(() => {
    return functions.map((item, idx) => {
      let effectiveDomain: DomainRange | null = null;
      let boundError: string | undefined;

      if (useGlobalRange) {
        effectiveDomain = parsedGlobalRange.domain;
        boundError = parsedGlobalRange.error;
      } else if (item.useRange) {
        const a = parseBoundExpression(item.rangeA);
        const b = parseBoundExpression(item.rangeB);
        if (a === null || b === null) {
          boundError = 'Cận a hoặc b không hợp lệ';
        } else if (a >= b) {
          boundError = 'Cần điều kiện a < b';
        } else {
          effectiveDomain = { a, b };
        }
      }

      const parsed = parseMathFunction(item.formula, effectiveDomain);
      return {
        ...item,
        index: idx,
        label: `f${idx + 1}(x)`,
        parsed,
        effectiveDomain,
        boundError,
      };
    });
  }, [functions, useGlobalRange, parsedGlobalRange]);

  const activeFn = useMemo(() => {
    return evaluatedFunctions.find((f) => f.id === selectedId) || evaluatedFunctions[0];
  }, [evaluatedFunctions, selectedId]);

  const visibleValidFunctions = useMemo(() => {
    return evaluatedFunctions.filter((f) => f.visible && !f.parsed.error && !f.boundError);
  }, [evaluatedFunctions]);

  // Miền chạy cho thanh trượt x₀ ∈ [a; b]
  const sweepRange = useMemo<DomainRange>(() => {
    if (useGlobalRange && parsedGlobalRange.domain) {
      return parsedGlobalRange.domain;
    }
    if (activeFn?.effectiveDomain) {
      return activeFn.effectiveDomain;
    }
    const bounded = visibleValidFunctions.find((f) => f.effectiveDomain !== null);
    if (bounded?.effectiveDomain) return bounded.effectiveDomain;
    return { a: -5, b: 5 };
  }, [useGlobalRange, parsedGlobalRange, activeFn, visibleValidFunctions]);

  // Đồng bộ traceX nằm gọn trong sweepRange khi đổi cận
  useEffect(() => {
    setTraceX((prev) => {
      if (prev < sweepRange.a || prev > sweepRange.b) {
        return Math.round(((sweepRange.a + sweepRange.b) / 2) * 100) / 100;
      }
      return prev;
    });
  }, [sweepRange.a, sweepRange.b]);

  // Chạy animation x₀ từ a đến b
  useEffect(() => {
    if (!isAnimatingTrace || !showTraceSlider) return;
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const span = sweepRange.b - sweepRange.a;
      const speed = span / 4.5; // full sweep in 4.5 seconds
      setTraceX((prev) => {
        const next = prev + speed * dt;
        return next > sweepRange.b ? sweepRange.a : next;
      });
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isAnimatingTrace, showTraceSlider, sweepRange.a, sweepRange.b]);

  // Tìm giao điểm giữa các cặp hàm đang hiển thị
  const intersections: IntersectionPoint[] = useMemo(() => {
    const pts: IntersectionPoint[] = [];
    for (let i = 0; i < visibleValidFunctions.length; i++) {
      for (let j = i + 1; j < visibleValidFunctions.length; j++) {
        const fA = visibleValidFunctions[i];
        const fB = visibleValidFunctions[j];

        const minA = fA.effectiveDomain ? fA.effectiveDomain.a : -12;
        const maxA = fA.effectiveDomain ? fA.effectiveDomain.b : 12;
        const minB = fB.effectiveDomain ? fB.effectiveDomain.a : -12;
        const maxB = fB.effectiveDomain ? fB.effectiveDomain.b : 12;

        const overlapMin = Math.max(minA, minB);
        const overlapMax = Math.min(maxA, maxB);
        if (overlapMin >= overlapMax) continue;

        const found = computeIntersections(
          fA.parsed.evaluate,
          fB.parsed.evaluate,
          overlapMin,
          overlapMax
        );
        found.forEach((pt) => {
          pts.push({
            x: pt.x,
            y: pt.y,
            labelA: fA.label,
            labelB: fB.label,
            colorA: fA.color,
            colorB: fB.color,
          });
        });
      }
    }
    return pts.slice(0, 12);
  }, [visibleValidFunctions]);

  // Tích phân xác định / diện tích trên miền [a; b]
  const integralSummary = useMemo(() => {
    if (!showAreaIntegral) return null;
    const domain = sweepRange;
    if (visibleValidFunctions.length >= 2) {
      const f1 = visibleValidFunctions[0];
      const f2 = visibleValidFunctions[1];
      const areaBetween = computeDefiniteIntegral(
        (x) => f1.parsed.evaluate(x) - f2.parsed.evaluate(x),
        domain.a,
        domain.b,
        true
      );
      const signedDiff = computeDefiniteIntegral(
        (x) => f1.parsed.evaluate(x) - f2.parsed.evaluate(x),
        domain.a,
        domain.b,
        false
      );
      return {
        mode: 'between' as const,
        label: `S(${f1.label}, ${f2.label})`,
        domain,
        area: areaBetween,
        signed: signedDiff,
      };
    } else if (activeFn && activeFn.visible && !activeFn.parsed.error) {
      const signed = computeDefiniteIntegral(activeFn.parsed.evaluate, domain.a, domain.b, false);
      const area = computeDefiniteIntegral(activeFn.parsed.evaluate, domain.a, domain.b, true);
      return {
        mode: 'single' as const,
        label: activeFn.label,
        domain,
        area,
        signed,
      };
    }
    return null;
  }, [showAreaIntegral, sweepRange, visibleValidFunctions, activeFn]);

  // Các hàm thao tác danh sách hàm số
  const handleAddFunction = () => {
    const nextIdx = functions.length;
    const defaultFormulas = ['y = x^2 - 1', 'y = -x + 2', 'y = sin(x)', 'y = 0.5*x^3 - 2x'];
    const newId = `fn-${Date.now()}`;
    const newItem: GraphFunctionItem = {
      id: newId,
      formula: defaultFormulas[nextIdx % defaultFormulas.length],
      color: FUNCTION_PALETTE[nextIdx % FUNCTION_PALETTE.length],
      visible: true,
      useRange: false,
      rangeA: '-2',
      rangeB: '3',
      includeA: true,
      includeB: true,
    };
    setFunctions((prev) => [...prev, newItem]);
    setSelectedId(newId);
  };

  const handleUpdateFunction = (id: string, patch: Partial<GraphFunctionItem>) => {
    setFunctions((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleRemoveFunction = (id: string) => {
    setFunctions((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((f) => f.id !== id);
      if (selectedId === id && filtered.length > 0) {
        setSelectedId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleCycleColor = (id: string) => {
    setFunctions((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const currIdx = FUNCTION_PALETTE.indexOf(f.color);
        const nextColor = FUNCTION_PALETTE[(currIdx + 1) % FUNCTION_PALETTE.length];
        return { ...f, color: nextColor };
      })
    );
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = PRESET_CONFIGS.find((p) => p.id === presetId);
    if (!preset) return;
    const ts = Date.now();
    const nextItems: GraphFunctionItem[] = preset.items.map((item, idx) => ({
      ...item,
      id: `fn-${ts}-${idx}`,
    }));
    setFunctions(nextItems);
    setSelectedId(nextItems[0].id);
    setUseGlobalRange(preset.useGlobalRange);
    setGlobalRangeA(preset.globalA);
    setGlobalRangeB(preset.globalB);
    setHoverCoord(null);
  };

  // Tự động căn khung nhìn vừa vặn miền [a; b] và giá trị y tương ứng
  const handleFitDomain = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;

    const a = sweepRange.a;
    const b = sweepRange.b;
    if (!(a < b)) return;

    let minY = 0;
    let maxY = 0;
    let hasSample = false;
    const samples = 60;

    visibleValidFunctions.forEach((fn) => {
      const domA = fn.effectiveDomain ? fn.effectiveDomain.a : a;
      const domB = fn.effectiveDomain ? fn.effectiveDomain.b : b;
      const start = Math.max(a, domA);
      const end = Math.min(b, domB);
      if (start >= end) return;
      for (let i = 0; i <= samples; i++) {
        const x = start + ((end - start) * i) / samples;
        const y = fn.parsed.evaluate(x);
        if (!isNaN(y) && isFinite(y) && Math.abs(y) < 100) {
          if (!hasSample) {
            minY = y;
            maxY = y;
            hasSample = true;
          } else {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
    });

    if (!hasSample) {
      minY = -4;
      maxY = 4;
    }

    const spanX = Math.max(b - a, 1);
    const spanY = Math.max(maxY - minY, 2);
    const targetScaleX = (width * 0.72) / spanX;
    const targetScaleY = (height * 0.7) / spanY;
    const nextScale = Math.min(Math.max(Math.min(targetScaleX, targetScaleY), 22), 110);

    const midX = (a + b) / 2;
    const midY = (minY + maxY) / 2;

    setScale(Math.round(nextScale));
    setOffsetX(Math.round(-midX * nextScale));
    setOffsetY(Math.round(midY * nextScale));
  }, [sweepRange, visibleValidFunctions]);

  // Vẽ đồ thị đa hàm & miền [a; b] trên Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const originX = width / 2 + offsetX;
    const originY = height / 2 + offsetY;

    // 1. Nền trắng sạch
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const minX = Math.floor(-originX / scale) - 2;
    const maxX = Math.ceil((width - originX) / scale) + 2;
    const minY = Math.floor((originY - height) / scale) - 2;
    const maxY = Math.ceil(originY / scale) + 2;

    // 2. Nền dải miền [a; b] nếu bật miền chung hoặc có điểm chạy/tích phân
    const bandDomain =
      useGlobalRange && parsedGlobalRange.domain
        ? parsedGlobalRange.domain
        : showTraceSlider || showAreaIntegral
        ? sweepRange
        : null;

    if (bandDomain && bandDomain.a < bandDomain.b) {
      const bandLeftPx = originX + bandDomain.a * scale;
      const bandRightPx = originX + bandDomain.b * scale;
      ctx.fillStyle = 'rgba(37, 99, 235, 0.045)';
      ctx.fillRect(bandLeftPx, 0, bandRightPx - bandLeftPx, height);

      // Đường biên x = a và x = b
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(bandLeftPx, 0);
      ctx.lineTo(bandLeftPx, height);
      ctx.moveTo(bandRightPx, 0);
      ctx.lineTo(bandRightPx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Nhãn x = a, x = b ở cạnh dưới
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#1D4ED8';
      ctx.textAlign = 'center';
      if (bandLeftPx > 24 && bandLeftPx < width - 24) {
        ctx.fillText(`a=${formatNumberCompact(bandDomain.a)}`, bandLeftPx, height - 10);
      }
      if (bandRightPx > 24 && bandRightPx < width - 24) {
        ctx.fillText(`b=${formatNumberCompact(bandDomain.b)}`, bandRightPx, height - 10);
      }
    }

    // 3. Lưới ô vuông tọa độ
    if (showGrid) {
      ctx.lineWidth = 1;
      if (scale >= 50) {
        const subStep = scale / 2;
        ctx.strokeStyle = '#F8FAFC';
        ctx.beginPath();
        for (let x = ((originX % subStep) + subStep) % subStep; x < width; x += subStep) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = ((originY % subStep) + subStep) % subStep; y < height; y += subStep) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      for (let x = ((originX % scale) + scale) % scale; x < width; x += scale) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = ((originY % scale) + scale) % scale; y < height; y += scale) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // 4. Tô miền diện tích / tích phân trên [a; b] (nếu bật)
    if (showAreaIntegral && sweepRange.a < sweepRange.b) {
      const startPx = Math.max(0, originX + sweepRange.a * scale);
      const endPx = Math.min(width, originX + sweepRange.b * scale);

      if (visibleValidFunctions.length >= 2) {
        const f1 = visibleValidFunctions[0];
        const f2 = visibleValidFunctions[1];
        ctx.fillStyle = 'rgba(37, 99, 235, 0.14)';
        ctx.beginPath();
        const ptsTop: { px: number; py: number }[] = [];
        const ptsBot: { px: number; py: number }[] = [];

        for (let px = startPx; px <= endPx; px += 2) {
          const x = (px - originX) / scale;
          const y1 = f1.parsed.evaluate(x);
          const y2 = f2.parsed.evaluate(x);
          if (isNaN(y1) || isNaN(y2) || !isFinite(y1) || !isFinite(y2)) continue;
          ptsTop.push({ px, py: originY - y1 * scale });
          ptsBot.push({ px, py: originY - y2 * scale });
        }

        if (ptsTop.length > 1) {
          ctx.moveTo(ptsTop[0].px, ptsTop[0].py);
          for (let i = 1; i < ptsTop.length; i++) ctx.lineTo(ptsTop[i].px, ptsTop[i].py);
          for (let i = ptsBot.length - 1; i >= 0; i--) ctx.lineTo(ptsBot[i].px, ptsBot[i].py);
          ctx.closePath();
          ctx.fill();
        }
      } else if (activeFn && activeFn.visible && !activeFn.parsed.error) {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.14)';
        ctx.beginPath();
        let started = false;
        let firstPx = startPx;
        let lastPx = startPx;

        for (let px = startPx; px <= endPx; px += 2) {
          const x = (px - originX) / scale;
          const y = activeFn.parsed.evaluate(x);
          if (isNaN(y) || !isFinite(y)) continue;
          const py = originY - y * scale;
          if (!started) {
            ctx.moveTo(px, originY);
            ctx.lineTo(px, py);
            firstPx = px;
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
          lastPx = px;
        }
        if (started && lastPx > firstPx) {
          ctx.lineTo(lastPx, originY);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // 5. Hai trục tọa độ Ox và Oy
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(width - 2, originY);
    ctx.lineTo(width - 11, originY - 4.5);
    ctx.lineTo(width - 11, originY + 4.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, 2);
    ctx.lineTo(originX - 4.5, 11);
    ctx.lineTo(originX + 4.5, 11);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('x', width - 18, originY - 10);
    ctx.fillText('y', originX + 10, 16);
    ctx.fillText('O', originX - 16, originY + 16);

    // Đánh số trục tọa độ
    const unitStep = scale < 28 ? 2 : 1;
    ctx.fillStyle = '#64748B';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (let i = minX; i <= maxX; i++) {
      if (i === 0 || i % unitStep !== 0) continue;
      const px = originX + i * scale;
      if (px > 25 && px < width - 25) {
        ctx.beginPath();
        ctx.moveTo(px, originY - 3);
        ctx.lineTo(px, originY + 3);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillText(i.toString(), px, originY + 15);
      }
    }

    ctx.textAlign = 'right';
    for (let j = minY; j <= maxY; j++) {
      if (j === 0 || j % unitStep !== 0) continue;
      const py = originY - j * scale;
      if (py > 25 && py < height - 25) {
        ctx.beginPath();
        ctx.moveTo(originX - 3, py);
        ctx.lineTo(originX + 3, py);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillText(j.toString(), originX - 6, py + 4);
      }
    }

    // 6. Vẽ đường tiệm cận của hàm đang chọn (nếu bật)
    if (showAsymptotes && activeFn && activeFn.visible && !activeFn.parsed.error) {
      const asym = activeFn.parsed.asymptotes;
      asym.vertical.forEach((v) => {
        const vPx = originX + v.x * scale;
        if (vPx >= -20 && vPx <= width + 20) {
          ctx.strokeStyle = '#E11D48';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(vPx, 0);
          ctx.lineTo(vPx, height);
          ctx.stroke();
          ctx.setLineDash([]);

          const tagLabel = `TCĐ: x=${v.x}`;
          ctx.font = 'bold 10px monospace';
          const tagWidth = ctx.measureText(tagLabel).width + 10;
          const tagX = Math.min(Math.max(vPx - tagWidth / 2, 8), width - tagWidth - 8);
          ctx.fillStyle = '#FFF1F2';
          ctx.strokeStyle = '#FDA4AF';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tagX, 12, tagWidth, 18, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#BE123C';
          ctx.textAlign = 'center';
          ctx.fillText(tagLabel, tagX + tagWidth / 2, 24);
        }
      });

      if (asym.horizontal) {
        const hPy = originY - asym.horizontal.y * scale;
        if (hPy >= -20 && hPy <= height + 20) {
          ctx.strokeStyle = '#0D9488';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(0, hPy);
          ctx.lineTo(width, hPy);
          ctx.stroke();
          ctx.setLineDash([]);

          const tagLabel = `TCN: y=${asym.horizontal.y}`;
          ctx.font = 'bold 10px monospace';
          const tagWidth = ctx.measureText(tagLabel).width + 10;
          const tagX = width - tagWidth - 12;
          const tagY = Math.min(Math.max(hPy - 6, 20), height - 20);
          ctx.fillStyle = '#F0FDFA';
          ctx.strokeStyle = '#5EEAD4';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY - 13, tagWidth, 18, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#0F766E';
          ctx.textAlign = 'center';
          ctx.fillText(tagLabel, tagX + tagWidth / 2, tagY);
        }
      }

      if (asym.slant) {
        const s = asym.slant;
        ctx.strokeStyle = '#7C3AED';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        const startY = s.a * minX + s.b;
        const endY = s.a * maxX + s.b;
        ctx.beginPath();
        ctx.moveTo(originX + minX * scale, originY - startY * scale);
        ctx.lineTo(originX + maxX * scale, originY - endY * scale);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 7. VẼ TẤT CẢ CÁC ĐƯỜNG CONG HÀM SỐ (HỖ TRỢ ĐA HÀM & MIỀN [a; b])
    visibleValidFunctions.forEach((fn) => {
      const isSelected = activeFn?.id === fn.id;
      const domain = fn.effectiveDomain;

      const leftMathX = -originX / scale;
      const rightMathX = (width - originX) / scale;
      const drawMinX = domain ? Math.max(domain.a, leftMathX) : leftMathX;
      const drawMaxX = domain ? Math.min(domain.b, rightMathX) : rightMathX;

      if (drawMinX < drawMaxX) {
        ctx.lineWidth = isSelected ? 3 : 2.2;
        ctx.strokeStyle = fn.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        let isDrawing = false;
        let prevMathY = NaN;
        const stepX = 1 / scale; // ~1 pixel horizontal resolution

        // Đảm bảo lấy mẫu chính xác tại drawMinX và drawMaxX
        const totalSteps = Math.max(1, Math.ceil((drawMaxX - drawMinX) / stepX));
        for (let s = 0; s <= totalSteps; s++) {
          const mathX = s === totalSteps ? drawMaxX : drawMinX + s * stepX;
          const mathY = fn.parsed.evaluate(mathX);
          const px = originX + mathX * scale;

          if (isNaN(mathY) || !isFinite(mathY)) {
            isDrawing = false;
            prevMathY = NaN;
            continue;
          }

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
      }

      // Vẽ hai đầu mút [a; b] hoặc (a; b) nếu hàm có giới hạn miền
      if (domain) {
        const endpoints = [
          { x: domain.a, included: useGlobalRange ? true : fn.includeA },
          { x: domain.b, included: useGlobalRange ? true : fn.includeB },
        ];

        endpoints.forEach((ep) => {
          const y = fn.parsed.evaluate(ep.x);
          if (isNaN(y) || !isFinite(y)) return;
          const px = originX + ep.x * scale;
          const py = originY - y * scale;
          if (px < -10 || px > width + 10 || py < -10 || py > height + 10) return;

          // Đường gióng nét đứt xuống trục Ox cho hàm đang chọn
          if (isSelected) {
            ctx.save();
            ctx.strokeStyle = fn.color;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, originY);
            ctx.stroke();
            ctx.restore();
          }

          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          if (ep.included) {
            ctx.fillStyle = fn.color;
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          } else {
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = fn.color;
            ctx.lineWidth = 2.2;
            ctx.stroke();
          }

          if (showKeyPoints && isSelected) {
            const label = `(${formatNumberCompact(ep.x)}; ${formatNumberCompact(y)})`;
            ctx.font = 'bold 10px monospace';
            ctx.fillStyle = fn.color;
            ctx.textAlign = ep.x === domain.a ? 'right' : 'left';
            const offsetLabelX = ep.x === domain.a ? -8 : 8;
            ctx.fillText(label, px + offsetLabelX, py - 8);
          }
        });
      }
    });

    // 8. Điểm đặc biệt (Ox, Oy, Đỉnh) của hàm đang chọn
    if (showKeyPoints && activeFn && activeFn.visible && !activeFn.parsed.error) {
      const p = activeFn.parsed;
      if (p.yIntercept) {
        const oyX = originX;
        const oyY = originY - p.yIntercept.y * scale;
        if (oyY >= 8 && oyY <= height - 8) {
          ctx.fillStyle = '#059669';
          ctx.beginPath();
          ctx.arc(oyX, oyY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      p.xIntercepts.forEach((pt) => {
        const oxX = originX + pt.x * scale;
        const oxY = originY;
        if (oxX >= 8 && oxX <= width - 8) {
          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.arc(oxX, oxY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      if (p.vertex) {
        const vx = originX + p.vertex.x * scale;
        const vy = originY - p.vertex.y * scale;
        if (vx >= 8 && vx <= width - 8 && vy >= 8 && vy <= height - 8) {
          ctx.fillStyle = '#7C3AED';
          ctx.beginPath();
          ctx.arc(vx, vy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#5B21B6';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`I(${p.vertex.x}; ${p.vertex.y})`, vx, vy - 10);
        }
      }
    }

    // 9. Giao điểm giữa các hàm số (fᵢ ∩ fⱼ)
    if (showIntersections && intersections.length > 0) {
      intersections.forEach((pt) => {
        const px = originX + pt.x * scale;
        const py = originY - pt.y * scale;
        if (px < 6 || px > width - 6 || py < 6 || py > height - 6) return;

        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        const label = `(${formatNumberCompact(pt.x)}; ${formatNumberCompact(pt.y)})`;
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(label).width;
        const bx = Math.min(Math.max(px + 7, 4), width - tw - 12);
        const by = Math.max(py - 20, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + 8, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'left';
        ctx.fillText(label, bx + 4, by + 11.5);
      });
    }

    // 10. Tiếp tuyến tại x₀ cho hàm đang chọn
    if (showTangent && activeFn && activeFn.visible && !activeFn.parsed.error) {
      const x0 = tangentX;
      const y0 = activeFn.parsed.evaluate(x0);
      const k = activeFn.parsed.derivative(x0);
      if (!isNaN(y0) && !isNaN(k) && isFinite(y0) && isFinite(k)) {
        const ptX = originX + x0 * scale;
        const ptY = originY - y0 * scale;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(originX + minX * scale, originY - (y0 + k * (minX - x0)) * scale);
        ctx.lineTo(originX + maxX * scale, originY - (y0 + k * (maxX - x0)) * scale);
        ctx.stroke();

        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(ptX, ptY, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // 11. Đường quét điểm chạy x₀ ∈ [a; b] trên tất cả các hàm
    if (showTraceSlider) {
      const tracePx = originX + traceX * scale;
      if (tracePx >= 0 && tracePx <= width) {
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(tracePx, 0);
        ctx.lineTo(tracePx, height);
        ctx.stroke();
        ctx.setLineDash([]);

        visibleValidFunctions.forEach((fn) => {
          if (fn.effectiveDomain && (traceX < fn.effectiveDomain.a - 1e-6 || traceX > fn.effectiveDomain.b + 1e-6)) {
            return;
          }
          const yVal = fn.parsed.evaluate(traceX);
          if (isNaN(yVal) || !isFinite(yVal)) return;
          const py = originY - yVal * scale;
          if (py < -20 || py > height + 20) return;

          ctx.fillStyle = fn.color;
          ctx.beginPath();
          ctx.arc(tracePx, py, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    }

    // 12. Rê chuột kiểm tra tọa độ trên đường cong gần nhất
    if (hoverCoord && !isPanning) {
      const { mathX, mathY, px, py, fnLabel, color } = hoverCoord;

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, originY);
      ctx.moveTo(px, py);
      ctx.lineTo(originX, py);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      const textLabel = `${fnLabel}: (${mathX.toFixed(2)}; ${mathY.toFixed(2)})`;
      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(textLabel).width;
      const boxWidth = textWidth + 14;
      const boxHeight = 22;
      const boxX = px + 10 + boxWidth > width ? px - boxWidth - 10 : px + 10;
      const boxY = py - 26 < 4 ? py + 10 : py - 26;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(textLabel, boxX + 7, boxY + 15);
    }

    // 13. Chú thích danh sách hàm số góc dưới trái (hiển thị đẹp cả khi xuất ảnh PNG)
    if (visibleValidFunctions.length > 0) {
      const legendItems = visibleValidFunctions.slice(0, 6);
      ctx.font = 'bold 11px monospace';
      const rowHeight = 18;
      const lines = legendItems.map((fn) => {
        const domainTxt = fn.effectiveDomain
          ? `  [${formatNumberCompact(fn.effectiveDomain.a)}; ${formatNumberCompact(fn.effectiveDomain.b)}]`
          : '';
        return {
          color: fn.color,
          text: `${fn.label} = ${fn.parsed.cleanedFormula}${domainTxt}`,
        };
      });
      const maxTextW = Math.max(...lines.map((l) => ctx.measureText(l.text).width), 80);
      const boxW = Math.min(maxTextW + 30, width - 24);
      const boxH = lines.length * rowHeight + 12;
      const lx = 12;
      const ly = height - boxH - 12;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();

      lines.forEach((line, idx) => {
        const cy = ly + 15 + idx * rowHeight;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lx + 10, cy - 3.5);
        ctx.lineTo(lx + 22, cy - 3.5);
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'left';
        ctx.fillText(line.text, lx + 28, cy, boxW - 36);
      });
    }
  }, [
    visibleValidFunctions,
    activeFn,
    useGlobalRange,
    parsedGlobalRange,
    sweepRange,
    showTraceSlider,
    traceX,
    showAreaIntegral,
    intersections,
    scale,
    offsetX,
    offsetY,
    showGrid,
    showKeyPoints,
    showIntersections,
    showAsymptotes,
    showTangent,
    tangentX,
    hoverCoord,
    isPanning,
  ]);

  // Kéo rê canvas (Pan)
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mousePx = (e.clientX - rect.left) * scaleX;
    const mousePy = (e.clientY - rect.top) * scaleY;

    const originX = canvas.width / 2 + offsetX;
    const originY = canvas.height / 2 + offsetY;
    const mathX = (mousePx - originX) / scale;

    let closest: {
      dist: number;
      mathY: number;
      snapPy: number;
      fnLabel: string;
      color: string;
    } | null = null;

    visibleValidFunctions.forEach((fn) => {
      if (fn.effectiveDomain && (mathX < fn.effectiveDomain.a || mathX > fn.effectiveDomain.b)) {
        return;
      }
      const mathY = fn.parsed.evaluate(mathX);
      if (isNaN(mathY) || !isFinite(mathY)) return;
      const snapPy = originY - mathY * scale;
      const dist = Math.abs(mousePy - snapPy);
      if (dist < 36 && (!closest || dist < closest.dist)) {
        closest = {
          dist,
          mathY,
          snapPy,
          fnLabel: fn.label,
          color: fn.color,
        };
      }
    });

    if (closest) {
      const hit = closest as { mathY: number; snapPy: number; fnLabel: string; color: string };
      setHoverCoord({
        mathX,
        mathY: hit.mathY,
        px: mousePx,
        py: hit.snapPy,
        fnLabel: hit.fnLabel,
        color: hit.color,
      });
    } else {
      setHoverCoord(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetView = () => {
    setScale(48);
    setOffsetX(0);
    setOffsetY(0);
    setTangentX(1);
    setHoverCoord(null);
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const summaryTitle = visibleValidFunctions
      .map((f) => `${f.label} = ${f.parsed.cleanedFormula}`)
      .join('; ');

    if (onExportImage) {
      onExportImage(dataUrl, `Đồ thị 2D: ${summaryTitle || 'Hàm số'}`);
    } else {
      const link = document.createElement('a');
      link.download = `do-thi-2d-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }

    setCopiedImage(true);
    setTimeout(() => setCopiedImage(false), 2500);
  };

  const totalAsymptotesCount = activeFn
    ? (activeFn.parsed.asymptotes?.vertical?.length || 0) +
      (activeFn.parsed.asymptotes?.horizontal ? 1 : 0) +
      (activeFn.parsed.asymptotes?.slant ? 1 : 0)
    : 0;

  // Bảng giá trị đa hàm theo các mốc x
  const multiTableXValues = useMemo(() => {
    if (useGlobalRange && parsedGlobalRange.domain) {
      const { a, b } = parsedGlobalRange.domain;
      const arr: number[] = [];
      for (let i = 0; i <= 6; i++) {
        arr.push(Math.round((a + ((b - a) * i) / 6) * 100) / 100);
      }
      return Array.from(new Set(arr));
    }
    if (activeFn?.effectiveDomain) {
      const { a, b } = activeFn.effectiveDomain;
      const arr: number[] = [];
      for (let i = 0; i <= 6; i++) {
        arr.push(Math.round((a + ((b - a) * i) / 6) * 100) / 100);
      }
      return Array.from(new Set(arr));
    }
    return [-3, -2, -1, 0, 1, 2, 3];
  }, [useGlobalRange, parsedGlobalRange, activeFn]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Header Toolbar */}
      <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <LineChart size={20} />
          </div>
          <div>
            <h2 className="font-extrabold text-base text-slate-900">
              Vẽ Đồ Thị Đa Hàm Số 2D Theo Miền x ∈ [a; b]
            </h2>
            <p className="text-xs text-slate-500">
              Vẽ nhiều hàm số cùng lúc · Tùy chỉnh khoảng giá trị x chạy từ a đến b · Tìm giao điểm và tích phân
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_CONFIGS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-Zone Studio: Left Control Deck + Right Canvas Stage */}
      <div className="grid grid-cols-1 xl:grid-cols-12 items-start">
        {/* LEFT COLUMN (5 cols): Function List & Domain [a, b] Controls */}
        <div className="xl:col-span-5 border-b xl:border-b-0 xl:border-r border-slate-200 p-4 space-y-4 bg-slate-50/40">
          {/* Section Header + Add Function Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Layers size={15} className="text-blue-600" />
              <span>Danh sách hàm số ({functions.length})</span>
            </div>
            <button
              type="button"
              onClick={handleAddFunction}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm hàm số</span>
            </button>
          </div>

          {/* Multi-Function Cards Stack */}
          <div className="space-y-2.5">
            {evaluatedFunctions.map((fn) => {
              const isSelected = activeFn?.id === fn.id;
              return (
                <div
                  key={fn.id}
                  onClick={() => setSelectedId(fn.id)}
                  className={`p-3 rounded-2xl border transition-all bg-white space-y-2.5 ${
                    isSelected
                      ? 'border-blue-400 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${!fn.visible ? 'opacity-65' : ''}`}
                >
                  {/* Formula Input Row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCycleColor(fn.id);
                      }}
                      title="Đổi màu đường đồ thị"
                      className="w-6 h-6 rounded-lg shrink-0 border border-slate-200 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                      style={{ backgroundColor: fn.color }}
                      aria-label={`Đổi màu ${fn.label}`}
                    />

                    <span className="font-mono text-xs font-extrabold text-slate-700 shrink-0 tabular-nums">
                      {fn.label} =
                    </span>

                    <input
                      type="text"
                      value={fn.formula.replace(/^(y\d*|f\d*\(x\)|g\d*\(x\)|h\d*\(x\))\s*=\s*/i, '')}
                      onChange={(e) => handleUpdateFunction(fn.id, { formula: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="VD: x^2 - 2x, 2*sin(x)..."
                      className="flex-1 min-w-0 h-9 px-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none font-mono text-xs font-bold text-slate-900 bg-slate-50/70 focus:bg-white"
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateFunction(fn.id, { visible: !fn.visible });
                      }}
                      title={fn.visible ? 'Ẩn đồ thị hàm này' : 'Hiện đồ thị hàm này'}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                    >
                      {fn.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFunction(fn.id);
                      }}
                      disabled={functions.length <= 1}
                      title="Xóa hàm số"
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Per-Function Domain x ∈ [a; b] Row */}
                  {!useGlobalRange && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex flex-wrap items-center gap-2 pt-1 text-[11px]"
                    >
                      <label className="flex items-center gap-1.5 font-semibold text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={fn.useRange}
                          onChange={(e) => handleUpdateFunction(fn.id, { useRange: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Giới hạn x ∈</span>
                      </label>

                      {fn.useRange ? (
                        <div className="flex items-center gap-1 font-mono tabular-nums">
                          <button
                            type="button"
                            onClick={() => handleUpdateFunction(fn.id, { includeA: !fn.includeA })}
                            title={fn.includeA ? 'Đoạn đóng [a (lấy cả x = a)' : 'Khoảng mở (a (không lấy x = a)'}
                            className="w-6 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                          >
                            {fn.includeA ? '[' : '('}
                          </button>
                          <input
                            type="text"
                            value={fn.rangeA}
                            onChange={(e) => handleUpdateFunction(fn.id, { rangeA: e.target.value })}
                            placeholder="a"
                            aria-label="Cận dưới a"
                            className="w-16 h-7 px-2 rounded-lg border border-slate-200 text-center font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400 font-bold">;</span>
                          <input
                            type="text"
                            value={fn.rangeB}
                            onChange={(e) => handleUpdateFunction(fn.id, { rangeB: e.target.value })}
                            placeholder="b"
                            aria-label="Cận trên b"
                            className="w-16 h-7 px-2 rounded-lg border border-slate-200 text-center font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateFunction(fn.id, { includeB: !fn.includeB })}
                            title={fn.includeB ? 'Đoạn đóng b] (lấy cả x = b)' : 'Khoảng mở b) (không lấy x = b)'}
                            className="w-6 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                          >
                            {fn.includeB ? ']' : ')'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">ℝ (toàn trục số)</span>
                      )}
                    </div>
                  )}

                  {/* Unboxed Metadata / Errors */}
                  {(fn.parsed.error || fn.boundError) ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>{fn.boundError || fn.parsed.error}</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{fn.parsed.functionTypeLabel}</span>
                      {fn.effectiveDomain && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-slate-700">
                            f({formatNumberCompact(fn.effectiveDomain.a)}) ={' '}
                            {formatNumberCompact(fn.parsed.evaluate(fn.effectiveDomain.a))}
                            {' · '}
                            f({formatNumberCompact(fn.effectiveDomain.b)}) ={' '}
                            {formatNumberCompact(fn.parsed.evaluate(fn.effectiveDomain.b))}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global Domain & Trace Sweep Panel (x chạy từ a đến b) */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-extrabold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useGlobalRange}
                  onChange={(e) => setUseGlobalRange(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Áp dụng chung miền x ∈ [a; b] cho tất cả hàm</span>
              </label>

              <button
                type="button"
                onClick={handleFitDomain}
                title="Tự động thu phóng khung nhìn vừa vặn miền [a; b]"
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Maximize2 size={12} />
                <span>Khớp [a; b]</span>
              </button>
            </div>

            {useGlobalRange && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Giá trị đầu a
                    </label>
                    <input
                      type="text"
                      value={globalRangeA}
                      onChange={(e) => setGlobalRangeA(e.target.value)}
                      placeholder="VD: -2, -pi"
                      className="w-full h-8 px-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Giá trị cuối b
                    </label>
                    <input
                      type="text"
                      value={globalRangeB}
                      onChange={(e) => setGlobalRangeB(e.target.value)}
                      placeholder="VD: 3, pi"
                      className="w-full h-8 px-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>
                {parsedGlobalRange.error && (
                  <p className="text-[11px] font-semibold text-rose-600">{parsedGlobalRange.error}</p>
                )}
              </div>
            )}

            {/* Sweep x0 slider + Area/Integral toggles */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTraceSlider}
                  onChange={(e) => {
                    setShowTraceSlider(e.target.checked);
                    if (!e.target.checked) setIsAnimatingTrace(false);
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <Crosshair size={14} className="text-blue-600" />
                <span>Điểm chạy x ∈ [a; b]</span>
              </label>

              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAreaIntegral}
                  onChange={(e) => setShowAreaIntegral(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Tô diện tích / Tích phân</span>
              </label>
            </div>

            {/* Interactive Trace Slider x0 running from a to b */}
            {showTraceSlider && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                    x₀ = {traceX.toFixed(2)} ∈ [{formatNumberCompact(sweepRange.a)};{' '}
                    {formatNumberCompact(sweepRange.b)}]
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAnimatingTrace((v) => !v)}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {isAnimatingTrace ? <Pause size={12} /> : <Play size={12} />}
                    <span>{isAnimatingTrace ? 'Dừng' : 'Chạy x'}</span>
                  </button>
                </div>

                <input
                  type="range"
                  min={sweepRange.a}
                  max={sweepRange.b}
                  step={Math.max((sweepRange.b - sweepRange.a) / 200, 0.01)}
                  value={traceX}
                  onChange={(e) => {
                    setIsAnimatingTrace(false);
                    setTraceX(parseFloat(e.target.value));
                  }}
                  aria-label="Thanh trượt biến x từ a đến b"
                  className="w-full accent-blue-600 cursor-pointer"
                />

                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
                  {visibleValidFunctions.map((fn) => {
                    const outOfRange =
                      fn.effectiveDomain &&
                      (traceX < fn.effectiveDomain.a - 1e-6 || traceX > fn.effectiveDomain.b + 1e-6);
                    const y = outOfRange ? NaN : fn.parsed.evaluate(traceX);
                    return (
                      <span key={fn.id} className="font-bold" style={{ color: fn.color }}>
                        {fn.label.replace('(x)', '')}({traceX.toFixed(2)}) ={' '}
                        {isNaN(y) ? 'ngoài miền' : formatNumberCompact(y)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Definite Integral / Area Readout */}
            {showAreaIntegral && integralSummary && (
              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] font-mono tabular-nums space-y-0.5 text-slate-800">
                <div className="font-bold text-blue-900">
                  Miền [{formatNumberCompact(integralSummary.domain.a)};{' '}
                  {formatNumberCompact(integralSummary.domain.b)}] · {integralSummary.label}
                </div>
                <div className="flex flex-wrap gap-x-4">
                  <span>
                    Diện tích S ≈{' '}
                    <strong>
                      {integralSummary.area !== null ? integralSummary.area.toFixed(3) : 'Không xác định'}
                    </strong>
                  </span>
                  {integralSummary.mode === 'single' && (
                    <span>
                      ∫f(x)dx ≈{' '}
                      <strong>
                        {integralSummary.signed !== null ? integralSummary.signed.toFixed(3) : '—'}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols): Canvas Stage + Inspections */}
        <div className="xl:col-span-7 flex flex-col">
          {/* Canvas Viewport */}
          <div className="relative w-full bg-slate-100 flex flex-col items-center justify-center p-3 select-none">
            {/* Top-left Options Bar */}
            <div className="w-full max-w-[780px] flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex flex-wrap items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700">
                <label className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showIntersections}
                    onChange={(e) => setShowIntersections(e.target.checked)}
                    className="rounded text-slate-800"
                  />
                  <span>Giao điểm ({intersections.length})</span>
                </label>
                <label className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showKeyPoints}
                    onChange={(e) => setShowKeyPoints(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Ox, Oy, Đầu mút</span>
                </label>
                <label className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAsymptotes}
                    onChange={(e) => setShowAsymptotes(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Tiệm cận ({totalAsymptotesCount})</span>
                </label>
                <label className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Lưới</span>
                </label>
                <label className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTangent}
                    onChange={(e) => setShowTangent(e.target.checked)}
                    className="rounded text-purple-600"
                  />
                  <span>Tiếp tuyến</span>
                </label>
              </div>

              {/* Zoom & Export Controls */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.min(s + 10, 120))}
                  title="Phóng to"
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(s - 10, 18))}
                  title="Thu nhỏ"
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  title="Đặt lại tâm O"
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} />
                </button>
                <div className="h-4 w-px bg-slate-200 mx-0.5" />
                <button
                  type="button"
                  onClick={handleExportPNG}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedImage ? <Check size={14} className="text-emerald-600" /> : <Download size={14} />}
                  <span>{copiedImage ? 'Đã lưu' : onExportImage ? 'Chèn Ảnh' : 'Tải PNG'}</span>
                </button>
              </div>
            </div>

            {/* Canvas Element */}
            <canvas
              ref={canvasRef}
              width={780}
              height={460}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`w-full max-w-[780px] h-[340px] sm:h-[460px] bg-white rounded-2xl border border-slate-300 shadow-xs ${
                isPanning ? 'cursor-grabbing' : 'cursor-crosshair'
              }`}
            />

            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Kéo chuột để di chuyển hệ trục Oxy · Rê chuột lên đường cong để xem tọa độ · Đầu mút{' '}
              <span className="font-mono font-bold text-slate-700">●</span> lấy cận,{' '}
              <span className="font-mono font-bold text-slate-700">○</span> bỏ cận
            </p>
          </div>

          {/* Inspection Strip below Canvas */}
          {showControls && (
            <div className="p-4 bg-white border-t border-slate-200 space-y-4 text-xs">
              {/* Active Function Formula + Intersections */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">Hàm đang chọn:</span>
                  {activeFn && (
                    <div
                      className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 font-bold flex items-center gap-2"
                      style={{ color: activeFn.color }}
                    >
                      <span>{activeFn.label.replace('(x)', '')}:</span>
                      <MathView math={activeFn.parsed.displayLatex} />
                    </div>
                  )}
                </div>

                {intersections.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums text-slate-700">
                    <span className="font-sans font-bold text-slate-500">Giao điểm:</span>
                    {intersections.slice(0, 4).map((pt, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-slate-100 font-semibold">
                        ({formatNumberCompact(pt.x)}; {formatNumberCompact(pt.y)})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tangent Slider for Selected Function */}
              {showTangent && activeFn && !activeFn.parsed.error && (
                <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-purple-900">
                      Tiếp tuyến của {activeFn.label} tại M(x₀; y₀)
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-purple-900 bg-white px-2.5 py-1 rounded-xl border border-purple-200">
                      <span>x₀ = {tangentX.toFixed(2)}</span>
                      <span>y₀ = {formatNumberCompact(activeFn.parsed.evaluate(tangentX))}</span>
                      <span>k = {formatNumberCompact(activeFn.parsed.derivative(tangentX))}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={sweepRange.a}
                    max={sweepRange.b}
                    step={0.1}
                    value={tangentX}
                    onChange={(e) => setTangentX(parseFloat(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>
              )}

              {/* Collapsible Asymptote Breakdown for Selected Function */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAsymptotePanel((v) => !v)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 flex items-center justify-between text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Split size={15} className="text-indigo-600" />
                    <span>
                      Khảo sát tiệm cận của {activeFn?.label} ·{' '}
                      <span className="font-normal text-slate-500">
                        {totalAsymptotesCount > 0
                          ? `Tìm thấy ${totalAsymptotesCount} đường tiệm cận`
                          : 'Không có đường tiệm cận'}
                      </span>
                    </span>
                  </span>
                  {showAsymptotePanel ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showAsymptotePanel && activeFn && (
                  <div className="p-3 bg-white border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-bold text-rose-700 mb-0.5">Tiệm Cận Đứng (TCĐ)</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {activeFn.parsed.asymptotes.vertical.length > 0
                          ? activeFn.parsed.asymptotes.vertical.map((v) => v.equation).join(', ')
                          : 'Không có'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-bold text-teal-700 mb-0.5">Tiệm Cận Ngang (TCN)</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {activeFn.parsed.asymptotes.horizontal
                          ? activeFn.parsed.asymptotes.horizontal.equation
                          : 'Không có'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-bold text-purple-700 mb-0.5">Tiệm Cận Xiên (TCX)</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {activeFn.parsed.asymptotes.slant
                          ? activeFn.parsed.asymptotes.slant.equation
                          : 'Không có'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-Function Sample Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                    <Table size={15} className="text-blue-600" />
                    <span>Bảng giá trị các hàm số</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTable((v) => !v)}
                    className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    {showTable ? 'Thu gọn' : 'Xem bảng'}
                  </button>
                </div>

                {showTable && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-center text-xs font-mono tabular-nums">
                      <thead className="bg-slate-100 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2 border-r border-slate-200 bg-slate-50 text-slate-800 w-20">
                            x
                          </th>
                          {multiTableXValues.map((xVal, i) => (
                            <th key={i} className="p-2 border-r last:border-r-0 border-slate-200">
                              {formatNumberCompact(xVal)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {visibleValidFunctions.map((fn) => (
                          <tr key={fn.id}>
                            <td
                              className="p-2 border-r border-slate-200 font-bold bg-slate-50"
                              style={{ color: fn.color }}
                            >
                              {fn.label}
                            </td>
                            {multiTableXValues.map((xVal, i) => {
                              const outOfDomain =
                                fn.effectiveDomain &&
                                (xVal < fn.effectiveDomain.a - 1e-6 ||
                                  xVal > fn.effectiveDomain.b + 1e-6);
                              const yVal = outOfDomain ? NaN : fn.parsed.evaluate(xVal);
                              return (
                                <td
                                  key={i}
                                  className={`p-2 border-r last:border-r-0 border-slate-200 ${
                                    outOfDomain ? 'text-slate-300 bg-slate-50/40' : 'text-slate-800'
                                  }`}
                                >
                                  {outOfDomain || isNaN(yVal) ? '—' : formatNumberCompact(yVal)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

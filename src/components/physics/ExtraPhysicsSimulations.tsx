import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { Play, Pause, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { IdealGasSimulation } from './IdealGasSimulation';

export type ExtraPhysicsModuleId =
  | 'standingWave'
  | 'optics'
  | 'dcCircuit'
  | 'photoelectric'
  | 'idealGas';

function renderLatex(tex: string, displayMode = false): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode });
  } catch {
    return tex;
  }
}

interface SliderControlProps {
  label: string;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (val: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  valueDisplay,
  min,
  max,
  step,
  value,
  disabled = false,
  onChange,
}) => (
  <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <div className="flex items-center justify-between text-xs">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="font-mono tabular-nums font-bold text-sky-700">{valueDisplay}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-sky-600 cursor-pointer"
    />
  </div>
);

interface ExtraPhysicsSimulationsProps {
  moduleId: ExtraPhysicsModuleId;
}

// =============================================================================
// METALS DATA FOR PHOTOELECTRIC EFFECT
// =============================================================================
const CATHODE_METALS = [
  { id: 'Cs', name: 'Xesi (Cs)', workFnEv: 1.88 },
  { id: 'K', name: 'Kali (K)', workFnEv: 2.15 },
  { id: 'Na', name: 'Natri (Na)', workFnEv: 2.48 },
  { id: 'Zn', name: 'Kẽm (Zn)', workFnEv: 3.55 },
  { id: 'Cu', name: 'Đồng (Cu)', workFnEv: 4.47 },
];

function nmToPhotonColor(nm: number): string {
  if (nm < 380) return '#8B5CF6'; // UV indicator
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm >= 440 && nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm >= 490 && nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm >= 580 && nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else {
    r = 1;
  }
  return `rgb(${Math.round(r * 235)}, ${Math.round(g * 210)}, ${Math.round(b * 245)})`;
}

export const ExtraPhysicsSimulations: React.FC<ExtraPhysicsSimulationsProps> = ({ moduleId }) => {
  if (moduleId === 'idealGas') {
    return <IdealGasSimulation />;
  }
  return <ExtraPhysicsSimulationsInner moduleId={moduleId} />;
};

const ExtraPhysicsSimulationsInner: React.FC<{
  moduleId: Exclude<ExtraPhysicsModuleId, 'idealGas'>;
}> = ({ moduleId }) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ===========================================================================
  // 5. SÓNG DỪNG TRÊN DÂY (STANDING WAVES)
  // ===========================================================================
  const [swBoundary, setSwBoundary] = useState<'bothFixed' | 'oneFree'>('bothFixed');
  const [swLengthM, setSwLengthM] = useState<number>(1.2);
  const [swSpeedMs, setSwSpeedMs] = useState<number>(24);
  const [swFreqHz, setSwFreqHz] = useState<number>(30); // k=3 for L=1.2, v=24 -> f=30Hz
  const [swAmpCm, setSwAmpCm] = useState<number>(3.0);
  const swPhaseRef = useRef<number>(0);

  const swCalc = useMemo(() => {
    const lambda = swSpeedMs / swFreqHz;
    const f1 = swBoundary === 'bothFixed' ? swSpeedMs / (2 * swLengthM) : swSpeedMs / (4 * swLengthM);
    const ratio = swBoundary === 'bothFixed' ? (2 * swLengthM * swFreqHz) / swSpeedMs : (4 * swLengthM * swFreqHz) / swSpeedMs;

    let nearestK = 1;
    if (swBoundary === 'bothFixed') {
      nearestK = Math.max(1, Math.round(ratio));
    } else {
      const oddIdx = Math.max(0, Math.round((ratio - 1) / 2));
      nearestK = 2 * oddIdx + 1;
    }

    const diff = Math.abs(ratio - nearestK);
    const isResonant = diff < 0.08;
    const resonanceFactor = Math.max(0.22, Math.exp(-Math.pow(diff / 0.14, 2)));

    const loops = swBoundary === 'bothFixed' ? nearestK : Math.floor(nearestK / 2);
    const nodesCount = swBoundary === 'bothFixed' ? nearestK + 1 : (nearestK + 1) / 2;
    const antinodesCount = swBoundary === 'bothFixed' ? nearestK : (nearestK + 1) / 2;

    return {
      lambda,
      f1,
      nearestK,
      isResonant,
      resonanceFactor,
      loops,
      nodesCount,
      antinodesCount,
    };
  }, [swBoundary, swLengthM, swSpeedMs, swFreqHz]);

  // ===========================================================================
  // 6. QUANG HÌNH: THẤU KÍNH HỘI TỤ & PHÂN KỲ (OPTICS)
  // ===========================================================================
  const [lensType, setLensType] = useState<'converging' | 'diverging'>('converging');
  const [lensFocalAbsCm, setLensFocalAbsCm] = useState<number>(20);
  const [lensObjDistCm, setLensObjDistCm] = useState<number>(35);
  const [lensObjHeightCm, setLensObjHeightCm] = useState<number>(10);

  const opticsCalc = useMemo(() => {
    const f = lensType === 'converging' ? lensFocalAbsCm : -lensFocalAbsCm;
    const d = lensObjDistCm;
    const atFocus = lensType === 'converging' && Math.abs(d - f) < 0.35;
    const dPrime = atFocus ? Infinity : (d * f) / (d - f);
    const k = atFocus ? Infinity : -dPrime / d;
    const hPrime = atFocus ? Infinity : k * lensObjHeightCm;
    const isReal = !atFocus && dPrime > 0;

    let natureText = 'Ảnh ở vô cực (chùm tia ló song song)';
    if (!atFocus) {
      const typeStr = isReal ? 'Ảnh thật' : 'Ảnh ảo';
      const dirStr = k < 0 ? 'ngược chiều' : 'cùng chiều';
      const sizeStr =
        Math.abs(Math.abs(k) - 1) < 0.04
          ? 'bằng vật'
          : Math.abs(k) > 1
          ? 'lớn hơn vật'
          : 'nhỏ hơn vật';
      natureText = `${typeStr}, ${dirStr}, ${sizeStr}`;
    }

    return { f, d, dPrime, k, hPrime, atFocus, isReal, natureText };
  }, [lensType, lensFocalAbsCm, lensObjDistCm, lensObjHeightCm]);

  // ===========================================================================
  // 7. ĐỊNH LUẬT ÔM TOÀN MẠCH & GHÉP NGUỒN (DC CIRCUIT)
  // ===========================================================================
  const [dcGrouping, setDcGrouping] = useState<'series' | 'parallel'>('series');
  const [dcCellCount, setDcCellCount] = useState<number>(2);
  const [dcEmfCell, setDcEmfCell] = useState<number>(6);
  const [dcRIntCell, setDcRIntCell] = useState<number>(1.5);
  const [dcROut, setDcROut] = useState<number>(4.5);
  const [dcSwitchClosed, setDcSwitchClosed] = useState<boolean>(true);
  const dcChargePhaseRef = useRef<number>(0);

  const dcCalc = useMemo(() => {
    const eb = dcGrouping === 'series' ? dcCellCount * dcEmfCell : dcEmfCell;
    const rb = dcGrouping === 'series' ? dcCellCount * dcRIntCell : dcRIntCell / dcCellCount;
    const iCircuit = dcSwitchClosed ? eb / (dcROut + rb) : 0;
    const uExt = dcSwitchClosed ? iCircuit * dcROut : eb;
    const pExt = dcSwitchClosed ? iCircuit * iCircuit * dcROut : 0;
    const pSource = dcSwitchClosed ? eb * iCircuit : 0;
    const efficiency = dcSwitchClosed ? (dcROut / (dcROut + rb)) * 100 : 100;
    const pMax = (eb * eb) / (4 * rb);
    const isMaxPower = dcSwitchClosed && Math.abs(dcROut - rb) < 0.25;

    return { eb, rb, iCircuit, uExt, pExt, pSource, efficiency, pMax, isMaxPower };
  }, [dcGrouping, dcCellCount, dcEmfCell, dcRIntCell, dcROut, dcSwitchClosed]);

  // ===========================================================================
  // 8. HIỆU ỨNG QUANG ĐIỆN NGOÀI (PHOTOELECTRIC EFFECT)
  // ===========================================================================
  const [peMetalId, setPeMetalId] = useState<string>('K');
  const [peLambdaNm, setPeLambdaNm] = useState<number>(400);
  const [peIntensityPct, setPeIntensityPct] = useState<number>(70);
  const [peVoltageV, setPeVoltageV] = useState<number>(1.5);

  const peParticlesRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);
  const pePhotonPhaseRef = useRef<number>(0);

  const peCalc = useMemo(() => {
    const metal = CATHODE_METALS.find((m) => m.id === peMetalId) || CATHODE_METALS[1];
    const hcEvNm = 1240.8;
    const photonEv = hcEvNm / peLambdaNm;
    const lambda0Nm = hcEvNm / metal.workFnEv;
    const occurs = peLambdaNm <= lambda0Nm;
    const kMaxEv = occurs ? photonEv - metal.workFnEv : 0;
    const stoppingVoltageUh = kMaxEv; // U_h in Volts numerically equals K_max in eV
    const vMaxKmS = occurs ? Math.sqrt((2 * kMaxEv * 1.602e-19) / 9.109e-31) / 1000 : 0;

    // Saturation photocurrent in mA scaled by intensity
    const iSatMa = occurs ? (peIntensityPct / 100) * 8.0 : 0;
    let currentMa = 0;
    if (occurs) {
      if (peVoltageV <= -stoppingVoltageUh) {
        currentMa = 0;
      } else if (peVoltageV >= 3.0) {
        currentMa = iSatMa;
      } else {
        const span = 3.0 + stoppingVoltageUh;
        const norm = (peVoltageV + stoppingVoltageUh) / Math.max(0.2, span);
        currentMa = iSatMa * (1 - Math.exp(-3.8 * norm)) / (1 - Math.exp(-3.8));
      }
    }

    return {
      metal,
      photonEv,
      lambda0Nm,
      occurs,
      kMaxEv,
      stoppingVoltageUh,
      vMaxKmS,
      iSatMa,
      currentMa,
    };
  }, [peMetalId, peLambdaNm, peIntensityPct, peVoltageV]);

  // ===========================================================================
  // 60FPS ANIMATION LOOP FOR EXTRA MODULES
  // ===========================================================================
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const dt = isRunning ? rawDt * timeScale : 0;

      const canvas = canvasRef.current;
      if (canvas) {
        if (moduleId === 'standingWave') {
          if (dt > 0) swPhaseRef.current += dt * Math.min(28, swFreqHz * 0.55);
          drawStandingWaveCanvas(canvas);
        } else if (moduleId === 'optics') {
          drawOpticsCanvas(canvas);
        } else if (moduleId === 'dcCircuit') {
          if (dt > 0 && dcCalc.iCircuit > 0) {
            dcChargePhaseRef.current = (dcChargePhaseRef.current + dt * dcCalc.iCircuit * 0.18) % 1;
          }
          drawDcCircuitCanvas(canvas);
        } else if (moduleId === 'photoelectric') {
          if (dt > 0) {
            pePhotonPhaseRef.current = (pePhotonPhaseRef.current + dt * 1.3) % 1;
            updatePhotoelectricParticles(dt);
          }
          drawPhotoelectricCanvas(canvas);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  // ---------------------------------------------------------------------------
  // CANVAS DRAWERS
  // ---------------------------------------------------------------------------
  const setupCanvasDpr = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(340, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  const drawStandingWaveCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupCanvasDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const leftX = 64;
    const rightX = w - 64;
    const stringW = rightX - leftX;
    const midY = h * 0.48;
    const maxAmpPx = Math.min(95, h * 0.25) * (swAmpCm / 4) * swCalc.resonanceFactor;
    const kWave = (2 * Math.PI) / swCalc.lambda;
    const cosTime = Math.cos(swPhaseRef.current);

    // Status Banner at top
    ctx.fillStyle = swCalc.isResonant ? '#ECFDF5' : '#FFFBEB';
    ctx.strokeStyle = swCalc.isResonant ? '#A7F3D0' : '#FDE68A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(16, 14, w - 32, 34, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = swCalc.isResonant ? '#065F46' : '#92400E';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      swCalc.isResonant
        ? `Cộng hưởng sóng dừng (bậc k = ${swCalc.nearestK}) · Số nút: ${swCalc.nodesCount} · Số bụng: ${swCalc.antinodesCount}`
        : `Chưa cộng hưởng (tần số cơ bản f₁ = ${swCalc.f1.toFixed(1)} Hz) — chỉnh f hoặc bấm chọn họa âm bên phải`,
      28,
      35
    );

    // Equilibrium axis
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(leftX, midY);
    ctx.lineTo(rightX, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Upper & lower standing wave envelopes
    [-1, 1].forEach((sign) => {
      ctx.strokeStyle = swCalc.isResonant ? 'rgba(2, 132, 199, 0.28)' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const frac = i / 180;
        const xMeters = frac * swLengthM;
        const px = leftX + frac * stringW;
        const env = Math.abs(Math.sin(kWave * xMeters)) * maxAmpPx;
        const py = midY + sign * env;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Instantaneous vibrating string
    ctx.strokeStyle = swCalc.isResonant ? '#0284C7' : '#D97706';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i <= 220; i++) {
      const frac = i / 220;
      const xMeters = frac * swLengthM;
      const px = leftX + frac * stringW;
      const yOffset = Math.sin(kWave * xMeters) * cosTime * maxAmpPx;
      const py = midY - yOffset;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Vibrator motor at left end
    ctx.fillStyle = '#334155';
    ctx.fillRect(leftX - 18, midY - 22, 18, 44);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(leftX, midY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Right boundary: fixed clamp OR free sliding ring on pole
    if (swBoundary === 'bothFixed') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(rightX, midY - 26, 14, 52);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(rightX, midY, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rightX, midY - 105);
      ctx.lineTo(rightX, midY + 105);
      ctx.stroke();
      const endY = midY - Math.sin(kWave * swLengthM) * cosTime * maxAmpPx;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rightX, endY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Node & Antinode dots when resonant
    if (swCalc.isResonant) {
      const halfLambda = swCalc.lambda / 2;
      for (let m = 0; m * halfLambda <= swLengthM + 0.02; m++) {
        const nx = leftX + ((m * halfLambda) / swLengthM) * stringW;
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(nx, midY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#991B1B';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('N', nx, midY + 18);
      }
      for (let m = 0; (m + 0.5) * halfLambda <= swLengthM + 0.02; m++) {
        const ax = leftX + (((m + 0.5) * halfLambda) / swLengthM) * stringW;
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(ax, midY - maxAmpPx, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#065F46';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('B', ax, midY - maxAmpPx - 8);
      }
    }

    // Bottom length dimension L and wavelength lambda
    const dimY = h - 38;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(leftX, dimY);
    ctx.lineTo(rightX, dimY);
    ctx.moveTo(leftX, dimY - 5);
    ctx.lineTo(leftX, dimY + 5);
    ctx.moveTo(rightX, dimY - 5);
    ctx.lineTo(rightX, dimY + 5);
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Chiều dài dây l = ${swLengthM.toFixed(2)} m · Bước sóng λ = ${swCalc.lambda.toFixed(2)} m`, w / 2, dimY + 18);
  };

  const drawOpticsCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupCanvasDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const ox = w * 0.5;
    const oy = h * 0.54;
    const pxPerCm = Math.min(
      4.8,
      (w * 0.42) /
        Math.max(
          45,
          lensObjDistCm,
          isFinite(opticsCalc.dPrime) ? Math.min(90, Math.abs(opticsCalc.dPrime)) : 60,
          lensFocalAbsCm * 2.3
        )
    );

    // Grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    const gridCm = 10;
    const gridPx = gridCm * pxPerCm;
    for (let gx = ox % gridPx; gx < w; gx += gridPx) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = oy % gridPx; gy < h; gy += gridPx) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Principal axis
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(16, oy);
    ctx.lineTo(w - 16, oy);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText('Δ', w - 26, oy - 8);

    // Lens drawing at (ox, oy)
    const lensHalfH = Math.min(155, h * 0.38);
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox, oy - lensHalfH);
    ctx.lineTo(ox, oy + lensHalfH);
    ctx.stroke();

    // Lens arrowheads
    const dir = lensType === 'converging' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(ox - 8, oy - lensHalfH + 10 * dir);
    ctx.lineTo(ox, oy - lensHalfH);
    ctx.lineTo(ox + 8, oy - lensHalfH + 10 * dir);
    ctx.moveTo(ox - 8, oy + lensHalfH - 10 * dir);
    ctx.lineTo(ox, oy + lensHalfH);
    ctx.lineTo(ox + 8, oy + lensHalfH - 10 * dir);
    ctx.stroke();

    // Focal points
    const fSigned = opticsCalc.f;
    const fObjX = ox - fSigned * pxPerCm; // F for converging is left; for diverging is right
    const fImgX = ox + fSigned * pxPerCm; // F' for converging is right; for diverging is left
    [
      { x: fObjX, label: 'F' },
      { x: fImgX, label: "F'" },
      { x: ox - 2 * lensFocalAbsCm * pxPerCm, label: '2F' },
      { x: ox + 2 * lensFocalAbsCm * pxPerCm, label: "2F'" },
    ].forEach((pt) => {
      if (pt.x > 16 && pt.x < w - 16) {
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(pt.x, oy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pt.label, pt.x, oy + 16);
      }
    });
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('O', ox + 5, oy + 15);

    // Object AB
    const ax = ox - lensObjDistCm * pxPerCm;
    const bx = ax;
    const by = oy - lensObjHeightCm * pxPerCm;

    // Draw Rays
    const drawSegment = (x1: number, y1: number, x2: number, y2: number, color: string, dashed = false) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = dashed ? 1.4 : 2;
      if (dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    // Ray 1: Parallel from B to lens (ox, by), then through F'
    drawSegment(bx, by, ox, by, '#D97706', false);
    const slope1 = (oy - by) / (fImgX - ox);
    const farRightX = w - 12;
    drawSegment(ox, by, farRightX, by + slope1 * (farRightX - ox), '#D97706', false);
    if (!opticsCalc.isReal && !opticsCalc.atFocus) {
      const farLeftX = 12;
      drawSegment(ox, by, farLeftX, by + slope1 * (farLeftX - ox), '#D97706', true);
    }

    // Ray 2: Through optical center O
    const slope2 = (oy - by) / (ox - bx);
    drawSegment(bx, by, farRightX, by + slope2 * (farRightX - bx), '#059669', false);
    if (!opticsCalc.isReal && !opticsCalc.atFocus) {
      drawSegment(bx, by, 12, by + slope2 * (12 - bx), '#059669', true);
    }

    // Draw Object arrow AB
    drawArrowVec(ctx, ax, oy, bx, by, '#0284C7', 2.8);
    ctx.fillStyle = '#0369A1';
    ctx.font = 'bold 11px ui-sans-serif, sans-serif';
    ctx.fillText('A', ax - 5, oy + 16);
    ctx.fillText('B', bx - 5, by - 8);

    // Draw Image A'B'
    if (!opticsCalc.atFocus && isFinite(opticsCalc.dPrime) && isFinite(opticsCalc.hPrime)) {
      const aPrimeX = ox + opticsCalc.dPrime * pxPerCm;
      const bPrimeY = oy - opticsCalc.hPrime * pxPerCm;
      if (aPrimeX > -400 && aPrimeX < w + 400) {
        drawArrowVec(ctx, aPrimeX, oy, aPrimeX, bPrimeY, '#E11D48', 2.8, !opticsCalc.isReal);
        ctx.fillStyle = '#BE123C';
        ctx.font = 'bold 11px ui-sans-serif, sans-serif';
        ctx.fillText("A'", aPrimeX + 4, oy + (opticsCalc.hPrime > 0 ? 15 : -8));
        ctx.fillText("B'", aPrimeX + 4, bPrimeY + (opticsCalc.hPrime > 0 ? -8 : 15));
      }
    }

    // Top nature callout
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(14, 14, Math.min(w - 28, 360), 30, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText(`Tính chất ảnh: ${opticsCalc.natureText}`, 24, 33);
  };

  const drawDcCircuitCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupCanvasDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const splitX = Math.floor(w * 0.54);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 16);
    ctx.lineTo(splitX, h - 16);
    ctx.stroke();

    // Left: Schematic DC Circuit
    const left = 54;
    const right = splitX - 44;
    const topY = 74;
    const botY = h - 78;
    const midX = (left + right) / 2;

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Sơ đồ mạch điện kín (Định luật Ôm toàn mạch)', 20, 28);

    // Circuit loop wire
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(left, topY);
    ctx.lineTo(midX - 24, topY);
    // Switch K gap
    if (dcSwitchClosed) {
      ctx.lineTo(midX + 24, topY);
    }
    ctx.moveTo(midX + 24, topY);
    ctx.lineTo(right, topY);
    ctx.lineTo(right, botY);
    ctx.lineTo(left, botY);
    ctx.lineTo(left, topY);
    ctx.stroke();

    // Switch blade if open
    if (!dcSwitchClosed) {
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(midX - 24, topY);
      ctx.lineTo(midX + 18, topY - 22);
      ctx.stroke();
    }
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px ui-sans-serif, sans-serif';
    ctx.fillText(dcSwitchClosed ? 'Khóa K (Đóng)' : 'Khóa K (Mở)', midX - 34, topY - 28);

    // Battery source on left vertical branch
    const batY = (topY + botY) / 2;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(left - 22, batY - 26, 44, 52);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left - 18, batY - 10);
    ctx.lineTo(left + 18, batY - 10); // long + plate
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(left - 10, batY + 10);
    ctx.lineTo(left + 10, batY + 10); // short - plate
    ctx.stroke();

    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`Eb=${dcCalc.eb.toFixed(1)}V`, left + 24, batY - 4);
    ctx.fillText(`rb=${dcCalc.rb.toFixed(2)}Ω`, left + 24, batY + 12);

    // External Resistor R on right vertical branch
    const resY = (topY + botY) / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2.4;
    ctx.fillRect(right - 14, resY - 36, 28, 72);
    ctx.strokeRect(right - 14, resY - 36, 28, 72);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`R = ${dcROut.toFixed(1)}Ω`, right - 68, resY + 4);

    // Ammeter (A) on top right
    const ampX = right - 54;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ampX, topY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 12px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', ampX, topY + 4);
    ctx.textAlign = 'left';

    // Voltmeter (V) on bottom branch
    const voltY = botY;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(midX, voltY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7C3AED';
    ctx.font = 'bold 12px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('V', midX, voltY + 4);
    ctx.textAlign = 'left';

    // Animated current charge dots along perimeter when closed
    if (dcSwitchClosed && dcCalc.iCircuit > 0) {
      const wLoop = right - left;
      const hLoop = botY - topY;
      const perim = 2 * (wLoop + hLoop);
      const count = 14;
      ctx.fillStyle = '#059669';
      for (let i = 0; i < count; i++) {
        const s = ((i / count + dcChargePhaseRef.current) % 1) * perim;
        let cx = left;
        let cy = topY;
        if (s < wLoop) {
          cx = left + s;
          cy = topY;
        } else if (s < wLoop + hLoop) {
          cx = right;
          cy = topY + (s - wLoop);
        } else if (s < 2 * wLoop + hLoop) {
          cx = right - (s - wLoop - hLoop);
          cy = botY;
        } else {
          cx = left;
          cy = botY - (s - 2 * wLoop - hLoop);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Right: Power P_N(R) Curve
    const gx = splitX + 34;
    const gw = w - gx - 24;
    const gyTop = 64;
    const gyBot = h - 54;
    const gh = gyBot - gyTop;

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Đồ thị Công suất mạch ngoài P(R)', splitX + 20, 28);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, gyTop);
    ctx.lineTo(gx, gyBot);
    ctx.lineTo(gx + gw, gyBot);
    ctx.stroke();

    const maxRPlot = 20;
    const pPeak = Math.max(dcCalc.pMax, 1);

    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const rVal = (i / 100) * maxRPlot;
      const pVal = (dcCalc.eb * dcCalc.eb * rVal) / Math.pow(rVal + dcCalc.rb, 2);
      const px = gx + (rVal / maxRPlot) * gw;
      const py = gyBot - (pVal / (pPeak * 1.15)) * gh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Peak marker at R = rb
    if (dcCalc.rb <= maxRPlot) {
      const peakPx = gx + (dcCalc.rb / maxRPlot) * gw;
      const peakPy = gyBot - (dcCalc.pMax / (pPeak * 1.15)) * gh;
      ctx.strokeStyle = '#94A3B8';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(peakPx, peakPy);
      ctx.lineTo(peakPx, gyBot);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.fillText(`Pmax=${dcCalc.pMax.toFixed(1)}W`, Math.min(gx + gw - 76, peakPx + 6), peakPy - 6);
    }

    // Current operating point
    if (dcSwitchClosed) {
      const curPx = gx + (dcROut / maxRPlot) * gw;
      const curPy = gyBot - (dcCalc.pExt / (pPeak * 1.15)) * gh;
      ctx.fillStyle = '#E11D48';
      ctx.beginPath();
      ctx.arc(curPx, curPy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText('R (Ω)', gx + gw - 28, gyBot + 16);
    ctx.fillText('P (W)', gx - 26, gyTop - 8);
  };

  const updatePhotoelectricParticles = (dt: number) => {
    const arr = peParticlesRef.current;
    if (peCalc.occurs) {
      const spawnRate = (peIntensityPct / 100) * 26;
      if (Math.random() < spawnRate * dt * 2.5 && arr.length < 48) {
        const speedNorm = 0.25 + 0.35 * Math.min(2, peCalc.kMaxEv / 2.5);
        arr.push({
          x: 0.05,
          y: 0.22 + Math.random() * 0.56,
          vx: speedNorm * (0.65 + 0.35 * Math.random()),
          vy: (Math.random() - 0.5) * 0.08,
        });
      }
    }

    // Acceleration proportional to U_AK
    // Roughly calibrate so if U_AK < -U_h, electrons cannot reach x=1
    const kNorm = Math.max(0.05, peCalc.kMaxEv);
    const accel = (peVoltageV / Math.max(0.5, kNorm)) * 0.22;

    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.vx += accel * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x > 0.96 || p.x < 0.02 || p.y < 0.1 || p.y > 0.9) {
        arr.splice(i, 1);
      }
    }
  };

  const drawPhotoelectricCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupCanvasDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const splitX = Math.floor(w * 0.57);

    // Left: Vacuum Tube Chamber
    const tubeLeft = 36;
    const tubeRight = splitX - 28;
    const tubeTop = 74;
    const tubeBot = h - 54;
    const tubeW = tubeRight - tubeLeft;
    const tubeH = tubeBot - tubeTop;

    // Status Header
    ctx.fillStyle = peCalc.occurs ? 'rgba(5, 150, 105, 0.2)' : 'rgba(225, 29, 72, 0.2)';
    ctx.strokeStyle = peCalc.occurs ? '#10B981' : '#F43F5E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(16, 14, splitX - 32, 34, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = peCalc.occurs ? '#A7F3D0' : '#FECDD3';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText(
      peCalc.occurs
        ? `Quang điện XẢY RA (λ = ${peLambdaNm} nm ≤ λ₀ = ${peCalc.lambda0Nm.toFixed(0)} nm)`
        : `KHÔNG xảy ra quang điện (λ = ${peLambdaNm} nm > λ₀ = ${peCalc.lambda0Nm.toFixed(0)} nm)`,
      26,
      35
    );

    // Quartz tube outline
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tubeLeft, tubeTop, tubeW, tubeH, 28);
    ctx.stroke();

    // Cathode (K) & Anode (A) plates
    const catX = tubeLeft + 26;
    const anoX = tubeRight - 26;
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(catX - 5, tubeTop + 34, 10, tubeH - 68);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(anoX - 4, tubeTop + 34, 8, tubeH - 68);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`Catôt K (${peCalc.metal.id})`, catX - 10, tubeBot + 18);
    ctx.fillText('Anôt A', anoX - 24, tubeBot + 18);

    // Incoming photon wave packets striking Cathode K
    const photonCol = nmToPhotonColor(peLambdaNm);
    const beamCount = Math.max(2, Math.round((peIntensityPct / 100) * 6));
    for (let b = 0; b < beamCount; b++) {
      const tProg = (pePhotonPhaseRef.current + b / beamCount) % 1;
      const startX = tubeLeft + tubeW * 0.55;
      const startY = tubeTop - 22;
      const targetX = catX + 6;
      const targetY = tubeTop + 54 + (b / beamCount) * (tubeH - 108);
      const px = startX + (targetX - startX) * tProg;
      const py = startY + (targetY - startY) * tProg;

      ctx.strokeStyle = photonCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 10, py + 7);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = photonCol;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ejected photoelectrons
    ctx.fillStyle = '#38BDF8';
    peParticlesRef.current.forEach((p) => {
      const px = catX + p.x * (anoX - catX);
      const py = tubeTop + p.y * tubeH;
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Right: I - U_AK Characteristic Curve
    const gx = splitX + 34;
    const gw = w - gx - 24;
    const gyTop = 58;
    const gyBot = h - 54;
    const gh = gyBot - gyTop;
    const uMin = -5;
    const uMax = 8;
    const zeroX = gx + ((0 - uMin) / (uMax - uMin)) * gw;

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Đặc tuyến Vôn - Ampe I(U_AK)', splitX + 20, 32);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(gx, gyBot);
    ctx.lineTo(gx + gw, gyBot);
    ctx.moveTo(zeroX, gyTop);
    ctx.lineTo(zeroX, gyBot);
    ctx.stroke();

    const maxIMa = 8.5;
    if (peCalc.occurs) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const u = uMin + (i / 100) * (uMax - uMin);
        let cur = 0;
        if (u > -peCalc.stoppingVoltageUh) {
          if (u >= 3.0) cur = peCalc.iSatMa;
          else {
            const span = 3.0 + peCalc.stoppingVoltageUh;
            const norm = (u + peCalc.stoppingVoltageUh) / Math.max(0.2, span);
            cur = peCalc.iSatMa * (1 - Math.exp(-3.8 * norm)) / (1 - Math.exp(-3.8));
          }
        }
        const px = gx + ((u - uMin) / (uMax - uMin)) * gw;
        const py = gyBot - (cur / maxIMa) * gh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Stopping voltage marker
      const uhX = gx + ((-peCalc.stoppingVoltageUh - uMin) / (uMax - uMin)) * gw;
      if (uhX >= gx) {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(uhX, gyBot, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillText(`-Uh=-${peCalc.stoppingVoltageUh.toFixed(1)}V`, uhX - 24, gyBot + 16);
      }
    }

    // Current point
    const curX = gx + ((peVoltageV - uMin) / (uMax - uMin)) * gw;
    const curY = gyBot - (peCalc.currentMa / maxIMa) * gh;
    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(curX, curY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText('U_AK (V)', gx + gw - 42, gyBot + 16);
    ctx.fillText('I (mA)', zeroX + 6, gyTop + 10);
  };

  // ---------------------------------------------------------------------------
  // RENDER TWO-ZONE SANDBOX FOR EXTRA MODULES
  // ---------------------------------------------------------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT ZONE: INTERACTIVE CANVAS STAGE + TELEMETRY */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
        {/* Playback Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isRunning
                  ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{isRunning ? 'Tạm dừng' : 'Tiếp tục'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                swPhaseRef.current = 0;
                dcChargePhaseRef.current = 0;
                peParticlesRef.current = [];
                setIsRunning(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Đặt lại</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Tốc độ:</span>
            {[0.5, 1, 1.5].map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setTimeScale(sp)}
                className={`px-2 py-1 rounded-md font-mono tabular-nums font-bold text-[11px] border cursor-pointer ${
                  timeScale === sp
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sp}×
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Viewport */}
        <div className="relative w-full h-[430px] sm:h-[490px] bg-slate-50">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* 4-Column Tabular Telemetry Strip */}
        <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {moduleId === 'standingWave' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Bước sóng λ</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {swCalc.lambda.toFixed(2)} m
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tần số cơ bản f₁</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {swCalc.f1.toFixed(1)} Hz
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Số nút / Số bụng</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {swCalc.nodesCount} nút · {swCalc.antinodesCount} bụng
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Trạng thái</span>
                <span className={`font-bold mt-0.5 block ${swCalc.isResonant ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {swCalc.isResonant ? `Cộng hưởng k=${swCalc.nearestK}` : 'Chưa cộng hưởng'}
                </span>
              </div>
            </>
          )}

          {moduleId === 'optics' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tiêu cự f / Độ tụ D</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {opticsCalc.f} cm · {(100 / opticsCalc.f).toFixed(2)} dp
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Vị trí ảnh d'</span>
                <span className="font-mono tabular-nums font-bold text-rose-700 mt-0.5 block">
                  {opticsCalc.atFocus ? '∞ (Vô cực)' : `${opticsCalc.dPrime.toFixed(1)} cm`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Độ phóng đại k</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {opticsCalc.atFocus ? '∞' : opticsCalc.k.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Chiều cao ảnh h'</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {opticsCalc.atFocus ? '∞' : `${Math.abs(opticsCalc.hPrime).toFixed(1)} cm`}
                </span>
              </div>
            </>
          )}

          {moduleId === 'dcCircuit' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Bộ nguồn (Eb, rb)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {dcCalc.eb.toFixed(1)} V · {dcCalc.rb.toFixed(2)} Ω
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Cường độ dòng I</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {dcCalc.iCircuit.toFixed(2)} A
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Hiệu điện thế mạch ngoài</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {dcCalc.uExt.toFixed(2)} V
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Công suất P / Hiệu suất H</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {dcCalc.pExt.toFixed(1)} W · {dcCalc.efficiency.toFixed(0)}%
                </span>
              </div>
            </>
          )}

          {moduleId === 'photoelectric' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Giới hạn quang điện λ₀</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {peCalc.lambda0Nm.toFixed(0)} nm (A={peCalc.metal.workFnEv} eV)
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Năng lượng phôtôn ε</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {peCalc.photonEv.toFixed(2)} eV
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Động năng cực đại / Uh</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {peCalc.kMaxEv.toFixed(2)} eV · {peCalc.stoppingVoltageUh.toFixed(2)} V
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Dòng quang điện I</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {peCalc.currentMa.toFixed(2)} mA (v₀≈{peCalc.vMaxKmS.toFixed(0)} km/s)
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT ZONE: CONTROLS + PHYSICS FORMULAS */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <SlidersHorizontal size={16} className="text-sky-600" />
            <h2 className="text-sm font-extrabold text-slate-900">Bảng Tham Số Thí Nghiệm</h2>
          </div>

          {moduleId === 'standingWave' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSwBoundary('bothFixed')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    swBoundary === 'bothFixed' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  2 đầu cố định
                </button>
                <button
                  type="button"
                  onClick={() => setSwBoundary('oneFree')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    swBoundary === 'oneFree' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  1 đầu tự do
                </button>
              </div>

              <SliderControl
                label="Chiều dài dây l"
                valueDisplay={`${swLengthM.toFixed(2)} m`}
                min={0.6}
                max={2.4}
                step={0.1}
                value={swLengthM}
                onChange={setSwLengthM}
              />
              <SliderControl
                label="Tốc độ truyền sóng v"
                valueDisplay={`${swSpeedMs} m/s`}
                min={12}
                max={60}
                step={2}
                value={swSpeedMs}
                onChange={setSwSpeedMs}
              />
              <SliderControl
                label="Tần số rung f"
                valueDisplay={`${swFreqHz.toFixed(1)} Hz`}
                min={5}
                max={80}
                step={0.5}
                value={swFreqHz}
                onChange={setSwFreqHz}
              />
              <SliderControl
                label="Biên độ bụng sóng"
                valueDisplay={`${swAmpCm.toFixed(1)} cm`}
                min={1}
                max={5}
                step={0.5}
                value={swAmpCm}
                onChange={setSwAmpCm}
              />

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 block">
                  Đặt nhanh tần số cộng hưởng sóng dừng
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(swBoundary === 'bothFixed' ? [1, 2, 3, 4, 5] : [1, 3, 5, 7]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSwFreqHz(Number((k * swCalc.f1).toFixed(1)))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 font-mono font-bold text-[11px] cursor-pointer"
                    >
                      {swBoundary === 'bothFixed' ? `${k} bó` : `k=${k}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {moduleId === 'optics' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLensType('converging')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    lensType === 'converging' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Thấu kính hội tụ
                </button>
                <button
                  type="button"
                  onClick={() => setLensType('diverging')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    lensType === 'diverging' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Thấu kính phân kỳ
                </button>
              </div>

              <SliderControl
                label="Độ lớn tiêu cự |f|"
                valueDisplay={`${lensFocalAbsCm} cm`}
                min={10}
                max={40}
                step={2}
                value={lensFocalAbsCm}
                onChange={setLensFocalAbsCm}
              />
              <SliderControl
                label="Khoảng cách từ vật tới kính d"
                valueDisplay={`${lensObjDistCm} cm`}
                min={6}
                max={80}
                step={1}
                value={lensObjDistCm}
                onChange={setLensObjDistCm}
              />
              <SliderControl
                label="Chiều cao vật AB"
                valueDisplay={`${lensObjHeightCm} cm`}
                min={4}
                max={16}
                step={1}
                value={lensObjHeightCm}
                onChange={setLensObjHeightCm}
              />

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 block">Các trường hợp đặc biệt</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLensType('converging');
                      setLensObjDistCm(lensFocalAbsCm * 2);
                    }}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-[11px] cursor-pointer"
                  >
                    d = 2f (Ảnh = vật)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLensType('converging');
                      setLensObjDistCm(Math.round(lensFocalAbsCm * 0.6));
                    }}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-[11px] cursor-pointer"
                  >
                    d &lt; f (Kính lúp)
                  </button>
                </div>
              </div>
            </div>
          )}

          {moduleId === 'dcCircuit' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDcGrouping('series')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    dcGrouping === 'series' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Ghép nối tiếp
                </button>
                <button
                  type="button"
                  onClick={() => setDcGrouping('parallel')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    dcGrouping === 'parallel' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Ghép song song
                </button>
              </div>

              <SliderControl
                label="Số nguồn điện ghép n"
                valueDisplay={`${dcCellCount} nguồn`}
                min={1}
                max={4}
                step={1}
                value={dcCellCount}
                onChange={setDcCellCount}
              />
              <SliderControl
                label="Suất điện động mỗi nguồn E"
                valueDisplay={`${dcEmfCell} V`}
                min={3}
                max={24}
                step={1}
                value={dcEmfCell}
                onChange={setDcEmfCell}
              />
              <SliderControl
                label="Điện trở trong mỗi nguồn r"
                valueDisplay={`${dcRIntCell.toFixed(1)} Ω`}
                min={0.5}
                max={5.0}
                step={0.5}
                value={dcRIntCell}
                onChange={setDcRIntCell}
              />
              <SliderControl
                label="Biến trở mạch ngoài R"
                valueDisplay={`${dcROut.toFixed(1)} Ω`}
                min={0.5}
                max={20.0}
                step={0.5}
                value={dcROut}
                onChange={setDcROut}
              />

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dcSwitchClosed}
                  onChange={(e) => setDcSwitchClosed(e.target.checked)}
                  className="rounded accent-sky-600"
                />
                <span className="font-semibold text-slate-700">Đóng khóa K (cho dòng điện chạy)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setDcSwitchClosed(true);
                  setDcROut(Math.min(20, Math.max(0.5, Number(dcCalc.rb.toFixed(1)))));
                }}
                className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Đặt R = rb = {dcCalc.rb.toFixed(2)} Ω (Công suất cực đại)
              </button>
            </div>
          )}

          {moduleId === 'photoelectric' && (
            <div className="space-y-4 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1.5">Kim loại làm Catôt (K)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATHODE_METALS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPeMetalId(m.id)}
                      className={`py-1.5 px-2 rounded-lg border font-bold text-[11px] cursor-pointer ${
                        peMetalId === m.id
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m.id} ({m.workFnEv}eV)
                    </button>
                  ))}
                </div>
              </div>

              <SliderControl
                label="Bước sóng kích thích λ"
                valueDisplay={`${peLambdaNm} nm${peLambdaNm < 380 ? ' (Tử ngoại)' : ''}`}
                min={200}
                max={740}
                step={5}
                value={peLambdaNm}
                onChange={setPeLambdaNm}
              />
              <SliderControl
                label="Cường độ chùm sáng"
                valueDisplay={`${peIntensityPct}%`}
                min={10}
                max={100}
                step={10}
                value={peIntensityPct}
                onChange={setPeIntensityPct}
              />
              <SliderControl
                label="Hiệu điện thế U_AK"
                valueDisplay={`${peVoltageV >= 0 ? '+' : ''}${peVoltageV.toFixed(1)} V`}
                min={-4.5}
                max={8.0}
                step={0.1}
                value={peVoltageV}
                onChange={setPeVoltageV}
              />

              <button
                type="button"
                onClick={() => setPeVoltageV(Number((-peCalc.stoppingVoltageUh).toFixed(1)))}
                disabled={!peCalc.occurs}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-45 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
              >
                Đặt U_AK = -Uh (Triệt tiêu dòng quang điện)
              </button>
            </div>
          )}
        </div>

        {/* Formula Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <h3 className="font-extrabold text-slate-900">Công Thức Trọng Tâm</h3>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto text-slate-800 space-y-2">
            {moduleId === 'standingWave' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    swBoundary === 'bothFixed'
                      ? String.raw`l = k\frac{\lambda}{2} = k\frac{v}{2f}\quad (k = 1, 2, 3\dots)`
                      : String.raw`l = \left(2k + 1\right)\frac{\lambda}{4}\quad (\text{1 đầu tự do})`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'optics' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`\frac{1}{f} = \frac{1}{d} + \frac{1}{d'},\quad k = -\frac{d'}{d} = \frac{\overline{A'B'}}{\overline{AB}}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'dcCircuit' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`I = \frac{\mathcal{E}_b}{R + r_b},\quad P_N = I^2 R \le \frac{\mathcal{E}_b^2}{4r_b}\text{ (khi }R = r_b\text{)}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'photoelectric' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`\varepsilon = \frac{hc}{\lambda} = A + \frac{1}{2}m_e v_{0\max}^2 = A + eU_h`,
                    false
                  ),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function drawArrowVec(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth = 2.4,
  dashed = false
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  const head = 8;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

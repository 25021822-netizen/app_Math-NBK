import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Zap,
} from 'lucide-react';

export type AdditionalChemModuleId =
  | 'electrolysis'
  | 'galvanic_cell'
  | 'ester_lab';

interface ChemSliderProps {
  label: string;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (val: number) => void;
}

const ChemSlider: React.FC<ChemSliderProps> = ({
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
      <span className="font-mono tabular-nums font-bold text-emerald-700">{valueDisplay}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-emerald-600 cursor-pointer"
    />
  </div>
);

function drawPillBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  bg = '#FFFFFF',
  border = '#CBD5E1',
  textColor = '#0F172A',
  font = '700 11px ui-sans-serif, system-ui, sans-serif'
) {
  ctx.save();
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const padX = 10;
  const bw = tw + padX * 2;
  const bh = 22;
  const rx = cx - bw / 2;
  const ry = cy - bh / 2;
  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(rx, ry, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  label?: string
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 3) return;
  const ang = Math.atan2(dy, dx);
  const head = Math.min(9, Math.max(5, len * 0.24));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = '800 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, (x1 + x2) / 2, y1 - 8);
  }
  ctx.restore();
}

interface ElectrodeMetal {
  symbol: string;
  ion: string;
  n: number;
  e0: number; // V
  molarMass: number;
  color: string;
  coatColor: string;
  solColor: string;
}

const ELECTRODE_METALS: ElectrodeMetal[] = [
  { symbol: 'Mg', ion: 'Mg²⁺', n: 2, e0: -2.37, molarMass: 24, color: '#CBD5E1', coatColor: '#E2E8F0', solColor: 'rgba(226,232,240,0.45)' },
  { symbol: 'Al', ion: 'Al³⁺', n: 3, e0: -1.66, molarMass: 27, color: '#D1D5DB', coatColor: '#E5E7EB', solColor: 'rgba(226,232,240,0.45)' },
  { symbol: 'Zn', ion: 'Zn²⁺', n: 2, e0: -0.76, molarMass: 65, color: '#94A3B8', coatColor: '#CBD5E1', solColor: 'rgba(226,232,240,0.50)' },
  { symbol: 'Fe', ion: 'Fe²⁺', n: 2, e0: -0.44, molarMass: 56, color: '#64748B', coatColor: '#94A3B8', solColor: 'rgba(134,239,172,0.36)' },
  { symbol: 'Ni', ion: 'Ni²⁺', n: 2, e0: -0.25, molarMass: 58.7, color: '#A3A3A3', coatColor: '#D4D4D8', solColor: 'rgba(52,211,153,0.34)' },
  { symbol: 'Pb', ion: 'Pb²⁺', n: 2, e0: -0.13, molarMass: 207, color: '#475569', coatColor: '#64748B', solColor: 'rgba(226,232,240,0.42)' },
  { symbol: 'Cu', ion: 'Cu²⁺', n: 2, e0: +0.34, molarMass: 64, color: '#D97706', coatColor: '#EA580C', solColor: 'rgba(56,189,248,0.45)' },
  { symbol: 'Ag', ion: 'Ag⁺', n: 1, e0: +0.80, molarMass: 108, color: '#E2E8F0', coatColor: '#F8FAFC', solColor: 'rgba(241,245,249,0.55)' },
];

type ElectrolysisSystem =
  | 'cuso4_refine'
  | 'plating_cu'
  | 'plating_ag'
  | 'plating_ni'
  | 'cuso4_inert'
  | 'agno3_inert';

type EsterPresetId = 'ethyl_acetate' | 'isoamyl_acetate' | 'propyl_acetate' | 'ethyl_butyrate';
type SaponificationSubstrateId = 'tristearin' | 'triolein' | 'ethyl_acetate_hydro';

interface EsterPreset {
  id: EsterPresetId;
  name: string;
  formula: string;
  equation: string;
  aroma: string;
  tint: string;
}

const ESTER_PRESETS: EsterPreset[] = [
  {
    id: 'ethyl_acetate',
    name: 'Ethyl Acetate',
    formula: 'CH₃COOC₂H₅',
    equation: 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O   (H₂SO₄ đặc, t°)',
    aroma: 'Mùi táo chín / sơn móng tay',
    tint: 'rgba(250, 204, 21, 0.85)',
  },
  {
    id: 'isoamyl_acetate',
    name: 'Isoamyl Acetate',
    formula: 'CH₃COOC₅H₁₁',
    equation: 'CH₃COOH + (CH₃)₂CHCH₂CH₂OH ⇌ CH₃COOC₅H₁₁ + H₂O',
    aroma: 'Mùi chuối chín đặc trưng (Dầu chuối)',
    tint: 'rgba(253, 224, 71, 0.88)',
  },
  {
    id: 'propyl_acetate',
    name: 'Propyl Acetate',
    formula: 'CH₃COOC₃H₇',
    equation: 'CH₃COOH + CH₃CH₂CH₂OH ⇌ CH₃COOC₃H₇ + H₂O',
    aroma: 'Mùi quả lê chín',
    tint: 'rgba(251, 191, 36, 0.84)',
  },
  {
    id: 'ethyl_butyrate',
    name: 'Ethyl Butyrate',
    formula: 'C₃H₇COOC₂H₅',
    equation: 'CH₃CH₂CH₂COOH + C₂H₅OH ⇌ C₃H₇COOC₂H₅ + H₂O',
    aroma: 'Mùi quả dứa (thơm)',
    tint: 'rgba(245, 158, 11, 0.82)',
  },
];

interface AdditionalChemistrySimulationsProps {
  moduleId: AdditionalChemModuleId;
}

export const AdditionalChemistrySimulations: React.FC<AdditionalChemistrySimulationsProps> = ({
  moduleId,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ===========================================================================
  // 1. TINH CHẾ KIM LOẠI, MẠ ĐIỆN & ĐIỆN PHÂN DUNG DỊCH (ĐIỆN CỰC TAN / TRƠ)
  // ===========================================================================
  const [elecSystem, setElecSystem] = useState<ElectrolysisSystem>('cuso4_refine');
  const [elecCurrentA, setElecCurrentA] = useState<number>(5.0); // A
  const [elecTimeMin, setElecTimeMin] = useState<number>(0); // 0..45 min
  const elecStateRef = useRef({ elapsedMin: 0, t: 0 });

  const elecCalc = useMemo(() => {
    const tSec = elecTimeMin * 60;
    const F = 96500;
    const nMolE = (elecCurrentA * tSec) / F;
    let cathodeMassG = 0;
    let anodeDissolvedG = 0;
    let anodeGasL = 0;
    let isSolubleAnode = true;
    let cathodeEq = '';
    let anodeEq = '';
    let overallEq = '';
    let phenomenon = '';
    let anodeLabel = 'Anot (+)';
    let cathodeLabel = 'Catot (−)';
    let ionSymbol = 'Cu²⁺';
    let ionColor = '#0284C7';
    let depositColor = '#EA580C';
    let anodeColor = '#B45309';

    if (elecSystem === 'cuso4_refine') {
      cathodeMassG = (64 * nMolE) / 2;
      anodeDissolvedG = (64 * nMolE) / 2;
      isSolubleAnode = true;
      anodeLabel = 'Anot (+) Cu thô (tan)';
      cathodeLabel = 'Catot (−) Cu tinh khiết';
      ionSymbol = 'Cu²⁺';
      ionColor = '#0284C7';
      depositColor = '#EA580C';
      anodeColor = '#9A3412';
      cathodeEq = 'Cu²⁺ + 2e → Cu ↓ (bám đồng 99,99% lên Catot)';
      anodeEq = 'Cu (thô) → Cu²⁺ + 2e (Anot Cu tan, tạp chất Ag/Au lắng bùn)';
      overallEq = 'Tinh chế đồng: Cu (Anot thô) —(đpdd CuSO₄)→ Cu (Catot tinh khiết)';
      phenomenon =
        'Thanh Anot Cu thô mòn dần để lại bùn anot (Ag, Au) ở đáy; Cu²⁺ di chuyển về Catot bồi đắp lớp đồng tinh khiết.';
    } else if (elecSystem === 'plating_cu') {
      cathodeMassG = (64 * nMolE) / 2;
      anodeDissolvedG = (64 * nMolE) / 2;
      isSolubleAnode = true;
      anodeLabel = 'Anot (+) Thanh Cu (tan)';
      cathodeLabel = 'Catot (−) Vật cần mạ';
      ionSymbol = 'Cu²⁺';
      ionColor = '#0284C7';
      depositColor = '#EA580C';
      anodeColor = '#C2410C';
      cathodeEq = 'Cu²⁺ + 2e → Cu ↓ (lớp đồng đỏ mịn phủ lên vật)';
      anodeEq = 'Cu → Cu²⁺ + 2e (Anot Cu tan bù lượng ion Cu²⁺)';
      overallEq = 'Mạ đồng: Cu (Anot tan) —(đpdd CuSO₄)→ Cu (lớp mạ Catot)';
      phenomenon =
        'Thanh đồng Anot tan dần giữ nồng độ Cu²⁺ ổn định; vật nối với cực âm (Catot) được mạ lớp đồng đỏ bám chắc.';
    } else if (elecSystem === 'plating_ag') {
      cathodeMassG = 108 * nMolE;
      anodeDissolvedG = 108 * nMolE;
      isSolubleAnode = true;
      anodeLabel = 'Anot (+) Thanh Ag (tan)';
      cathodeLabel = 'Catot (−) Vật cần mạ';
      ionSymbol = 'Ag⁺';
      ionColor = '#475569';
      depositColor = '#F1F5F9';
      anodeColor = '#CBD5E1';
      cathodeEq = 'Ag⁺ + 1e → Ag ↓ (lớp mạ bạc trắng bóng bám lên vật)';
      anodeEq = 'Ag → Ag⁺ + 1e (Anot Ag tan dần bù lượng Ag⁺ đã điện phân)';
      overallEq = 'Mạ bạc: Ag (Anot tan) —(đpdd muối Ag⁺)→ Ag (bám bề mặt Catot)';
      phenomenon =
        'Thanh Anot Ag tan dần giúp duy trì nồng độ Ag⁺; bề mặt vật ở Catot phủ lớp bạc trắng sáng bóng.';
    } else if (elecSystem === 'plating_ni') {
      cathodeMassG = (58.7 * nMolE) / 2;
      anodeDissolvedG = (58.7 * nMolE) / 2;
      isSolubleAnode = true;
      anodeLabel = 'Anot (+) Thanh Ni (tan)';
      cathodeLabel = 'Catot (−) Vật thép cần mạ';
      ionSymbol = 'Ni²⁺';
      ionColor = '#059669';
      depositColor = '#D4D4D8';
      anodeColor = '#94A3B8';
      cathodeEq = 'Ni²⁺ + 2e → Ni ↓ (phủ lớp niken chống ăn mòn lên thép)';
      anodeEq = 'Ni → Ni²⁺ + 2e (Anot Ni tan dần bổ sung ion Ni²⁺)';
      overallEq = 'Mạ niken: Ni (Anot tan) —(đpdd NiSO₄)→ Ni (lớp phủ bảo vệ Catot)';
      phenomenon =
        'Anot niken tan dần theo định luật Faraday; vật thép ở Catot được phủ lớp niken sáng mịn chống gỉ.';
    } else if (elecSystem === 'agno3_inert') {
      cathodeMassG = 108 * nMolE;
      anodeDissolvedG = 0;
      anodeGasL = (nMolE / 4) * 24.79;
      isSolubleAnode = false;
      anodeLabel = 'Anot (+) Graphit (trơ)';
      cathodeLabel = 'Catot (−) Ag bám cực';
      ionSymbol = 'Ag⁺';
      ionColor = '#475569';
      depositColor = '#F1F5F9';
      anodeColor = '#334155';
      cathodeEq = 'Ag⁺ + 1e → Ag ↓ (bạc trắng bám dày lên Catot)';
      anodeEq = '2H₂O → O₂ ↑ + 4H⁺ + 4e (khí O₂ thoát ra ở Anot trơ)';
      overallEq = '4AgNO₃ + 2H₂O —(đpdd, cực trơ)→ 4Ag ↓ + O₂ ↑ + 4HNO₃';
      phenomenon =
        'Anot graphit trơ không tan mà sủi bọt khí O₂; Ag bám lên Catot (−); dung dịch tạo thành HNO₃ có pH giảm mạnh.';
    } else {
      cathodeMassG = (64 * nMolE) / 2;
      anodeDissolvedG = 0;
      anodeGasL = (nMolE / 4) * 24.79;
      isSolubleAnode = false;
      anodeLabel = 'Anot (+) Graphit (trơ)';
      cathodeLabel = 'Catot (−) Cu bám cực';
      ionSymbol = 'Cu²⁺';
      ionColor = '#0284C7';
      depositColor = '#EA580C';
      anodeColor = '#334155';
      cathodeEq = 'Cu²⁺ + 2e → Cu ↓ (bám đỏ lên Catot)';
      anodeEq = '2H₂O → O₂ ↑ + 4H⁺ + 4e (điện cực trơ không tan)';
      overallEq = '2CuSO₄ + 2H₂O —(đpdd, cực trơ)→ 2Cu ↓ + O₂ ↑ + 2H₂SO₄';
      phenomenon =
        'Anot than chì trơ không tan và sủi bọt khí O₂; Catot có Cu đỏ bám dày lên; dung dịch CuSO₄ nhạt màu xanh dần.';
    }

    return {
      nMolE,
      cathodeMassG,
      anodeDissolvedG,
      anodeGasL,
      isSolubleAnode,
      cathodeEq,
      anodeEq,
      overallEq,
      phenomenon,
      anodeLabel,
      cathodeLabel,
      ionSymbol,
      ionColor,
      depositColor,
      anodeColor,
    };
  }, [elecSystem, elecCurrentA, elecTimeMin]);

  // ===========================================================================
  // 2. PIN GALVANI (PIN ĐIỆN HÓA — ĐIỆN CỰC ANOT TAN & CATOT BỒI ĐẮP)
  // ===========================================================================
  const [galvLeftIdx, setGalvLeftIdx] = useState<number>(2); // Zn (index 2)
  const [galvRightIdx, setGalvRightIdx] = useState<number>(6); // Cu (index 6)
  const [galvConcLeft, setGalvConcLeft] = useState<number>(1.0); // M
  const [galvConcRight, setGalvConcRight] = useState<number>(1.0); // M
  const [galvTimeMin, setGalvTimeMin] = useState<number>(0); // 0..60 min discharge
  const galvStateRef = useRef({ t: 0, elapsedMin: 0 });

  const galvCalc = useMemo(() => {
    const leftM = ELECTRODE_METALS[galvLeftIdx];
    const rightM = ELECTRODE_METALS[galvRightIdx];
    const eLeft = leftM.e0 + (0.0592 / leftM.n) * Math.log10(galvConcLeft);
    const eRight = rightM.e0 + (0.0592 / rightM.n) * Math.log10(galvConcRight);
    const leftIsAnode = eLeft <= eRight;
    const anode = leftIsAnode ? leftM : rightM;
    const cathode = leftIsAnode ? rightM : leftM;
    const eCell = Math.abs(eRight - eLeft);

    const F = 96500;
    const nominalCurrentA = eCell > 0.01 ? Math.max(0.5, 2.2 * eCell) : 0;
    const nMolE = (nominalCurrentA * galvTimeMin * 60) / F;
    const anodeLostG = (anode.molarMass * nMolE) / anode.n;
    const cathodeGainedG = (cathode.molarMass * nMolE) / cathode.n;
    const wearFrac = eCell > 0.01 ? Math.min(1, galvTimeMin / 60) : 0;

    return {
      leftM,
      rightM,
      eLeft,
      eRight,
      leftIsAnode,
      anode,
      cathode,
      eCell,
      nMolE,
      anodeLostG,
      cathodeGainedG,
      wearFrac,
    };
  }, [galvLeftIdx, galvRightIdx, galvConcLeft, galvConcRight, galvTimeMin]);

  useEffect(() => {
    galvStateRef.current.elapsedMin = 0;
    setGalvTimeMin(0);
  }, [galvLeftIdx, galvRightIdx]);

  // ===========================================================================
  // 3. ĐIỀU CHẾ ESTER & XÀ PHÒNG HÓA (ESTER LAB)
  // ===========================================================================
  const [esterMode, setEsterMode] = useState<'esterification' | 'saponification'>('esterification');
  const [esterPresetId, setEsterPresetId] = useState<EsterPresetId>('ethyl_acetate');
  const [saponSubstrate, setSaponSubstrate] = useState<SaponificationSubstrateId>('tristearin');
  const [esterTempC, setEsterTempC] = useState<number>(75); // C
  const [esterCatH2SO4, setEsterCatH2SO4] = useState<boolean>(true);
  const [esterMoleRatio, setEsterMoleRatio] = useState<number>(1.5);
  const [soapAlkali, setSoapAlkali] = useState<'NaOH' | 'KOH'>('NaOH');
  const [soapSaltOut, setSoapSaltOut] = useState<boolean>(true);
  const esterStateRef = useRef({ t: 0, yieldFrac: 0 });
  const [esterReadout, setEsterReadout] = useState({ yieldPct: 0 });

  const activeEsterPreset = useMemo(
    () => ESTER_PRESETS.find((e) => e.id === esterPresetId) || ESTER_PRESETS[0],
    [esterPresetId]
  );

  const esterMaxYield = useMemo(() => {
    if (esterMode === 'esterification') {
      const k = 4.0;
      const r = esterMoleRatio;
      const a = k - 1;
      const b = -k * (1 + r);
      const c = k * r;
      const disc = Math.sqrt(Math.max(0, b * b - 4 * a * c));
      const x = (-b - disc) / (2 * a);
      return Math.min(96, Math.max(20, x * 100));
    }
    return 95;
  }, [esterMode, esterMoleRatio]);

  // ===========================================================================
  // MAIN ANIMATION LOOP
  // ===========================================================================
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let uiTimer = 0;

    const setupCanvas = (canvas: HTMLCanvasElement) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(340, Math.floor(rect.width));
      const h = Math.max(380, Math.floor(rect.height));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w, h };
    };

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, (now - lastTs) / 1000);
      lastTs = now;
      const dt = isRunning ? rawDt : 0;

      // 1. ELECTROLYSIS / REFINING / PLATING
      if (moduleId === 'electrolysis' && canvasRef.current) {
        const st = elecStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (st.elapsedMin < 45) {
            st.elapsedMin = Math.min(45, st.elapsedMin + dt * 1.15);
          }
          uiTimer += rawDt;
          if (uiTimer >= 0.08) {
            uiTimer = 0;
            setElecTimeMin(Number(st.elapsedMin.toFixed(1)));
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawElectrolysis(setup.ctx, setup.w, setup.h, st.t);
      }

      // 2. GALVANIC CELL
      if (moduleId === 'galvanic_cell' && canvasRef.current) {
        const st = galvStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (galvCalc.eCell > 0.01 && st.elapsedMin < 60) {
            st.elapsedMin = Math.min(60, st.elapsedMin + dt * 1.35);
            uiTimer += rawDt;
            if (uiTimer >= 0.08) {
              uiTimer = 0;
              setGalvTimeMin(Number(st.elapsedMin.toFixed(1)));
            }
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawGalvanicCell(setup.ctx, setup.w, setup.h, st.t);
      }

      // 3. ESTER LAB
      if (moduleId === 'ester_lab' && canvasRef.current) {
        const st = esterStateRef.current;
        if (dt > 0) {
          st.t += dt;
          const speed =
            esterMode === 'esterification'
              ? (esterCatH2SO4 ? 0.14 : 0.025) * Math.max(0.25, (esterTempC - 25) / 50)
              : 0.16 * Math.max(0.3, (esterTempC - 25) / 50);
          const target = esterMaxYield / 100;
          st.yieldFrac += (target - st.yieldFrac) * Math.min(1, dt * speed * 2.2);
          uiTimer += rawDt;
          if (uiTimer >= 0.08) {
            uiTimer = 0;
            setEsterReadout({ yieldPct: st.yieldFrac * 100 });
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawEsterLab(setup.ctx, setup.w, setup.h, st);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  // ===========================================================================
  // CANVAS RENDERERS
  // ===========================================================================
  const drawElectrolysis = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const bx = w * 0.5;
    const bBottom = h * 0.83;
    const bW = Math.min(370, w * 0.62);
    const bH = h * 0.52;
    const liqH = bH * 0.78;
    const progress = Math.min(1, elecStateRef.current.elapsedMin / 45);

    // Electrolyte solution color
    let liqColor = 'rgba(56, 189, 248, 0.44)';
    if (elecSystem === 'cuso4_inert') {
      const alpha = Math.max(0.08, 0.48 * (1 - progress * 0.82));
      liqColor = `rgba(56, 189, 248, ${alpha})`;
    } else if (elecSystem === 'plating_ag' || elecSystem === 'agno3_inert') {
      liqColor = 'rgba(226, 232, 240, 0.48)';
    } else if (elecSystem === 'plating_ni') {
      liqColor = 'rgba(52, 211, 153, 0.36)';
    }

    ctx.fillStyle = liqColor;
    ctx.fillRect(bx - bW / 2, bBottom - liqH, bW, liqH);

    // Cathode (left, -) and Anode (right, +)
    const catX = bx - bW * 0.28;
    const anoX = bx + bW * 0.28;
    const elecTop = bBottom - bH + 10;
    const elecBot = bBottom - 24;
    const liqTop = bBottom - liqH;

    // 1. Anode with ghost initial outline when soluble
    const origAnoW = 24;
    const curAnoW = elecCalc.isSolubleAnode ? Math.max(6, origAnoW - progress * 15) : 18;
    if (elecCalc.isSolubleAnode && progress > 0.04) {
      ctx.save();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(anoX - origAnoW / 2, liqTop + 4, origAnoW, elecBot - (liqTop + 4));
      ctx.restore();
    }
    // Top dry part stays original width; submerged part thins cleanly!
    ctx.fillStyle = elecCalc.anodeColor;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.4;
    ctx.fillRect(anoX - origAnoW / 2, elecTop, origAnoW, liqTop - elecTop + 4);
    ctx.strokeRect(anoX - origAnoW / 2, elecTop, origAnoW, liqTop - elecTop + 4);
    ctx.fillRect(anoX - curAnoW / 2, liqTop + 4, curAnoW, elecBot - (liqTop + 4));
    ctx.strokeRect(anoX - curAnoW / 2, liqTop + 4, curAnoW, elecBot - (liqTop + 4));

    // Anode mud (bùn anot: Ag, Au) settling below crude Cu anode during refining
    if (elecSystem === 'cuso4_refine' && progress > 0.04) {
      ctx.fillStyle = '#334155';
      const mudCount = Math.round(progress * 22);
      for (let i = 0; i < mudCount; i++) {
        const mx = anoX - 24 + ((i * 11) % 48);
        const my = bBottom - 5 - (i % 4) * 2.5;
        ctx.beginPath();
        ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      drawPillBadge(ctx, anoX, bBottom - 16, 'Bùn anot (Ag, Au)', '#F1F5F9', '#94A3B8', '#334155', '700 10px ui-sans-serif, sans-serif');
    }

    // 2. Cathode core + bright newly plated rim
    ctx.fillStyle = '#475569';
    ctx.fillRect(catX - 9, elecTop, 18, elecBot - elecTop);
    const coatW = progress * 10;
    if (coatW > 0.4) {
      ctx.fillStyle = elecCalc.depositColor;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.2;
      ctx.fillRect(catX - 9 - coatW, liqTop + 4, 18 + coatW * 2, elecBot - (liqTop + 4));
      ctx.strokeRect(catX - 9 - coatW, liqTop + 4, 18 + coatW * 2, elecBot - (liqTop + 4));
    }

    // Animated cations migrating Anode -> Cathode OR O2 gas on inert anode
    for (let i = 0; i < 6; i++) {
      const frac = (t * 0.42 + i / 6) % 1;
      const ix = (elecCalc.isSolubleAnode ? anoX : bx + 20) - frac * ((elecCalc.isSolubleAnode ? anoX : bx + 20) - catX);
      const iy = liqTop + 34 + ((i * 29) % Math.max(40, liqH - 64));
      ctx.fillStyle = elecCalc.ionColor;
      ctx.beginPath();
      ctx.arc(ix, iy, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    drawArrow(
      ctx,
      anoX - 24,
      liqTop + 20,
      catX + 24,
      liqTop + 20,
      elecCalc.ionColor,
      `${elecCalc.ionSymbol} → Catot`
    );

    if (!elecCalc.isSolubleAnode) {
      const bubbleCount = Math.min(18, Math.round(elecCurrentA * 1.8));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1;
      for (let i = 0; i < bubbleCount; i++) {
        const yOff = (t * 55 + i * 27) % (liqH - 30);
        const by = bBottom - 26 - yOff;
        const bxPos = anoX + Math.sin(t * 4 + i) * 16;
        ctx.beginPath();
        ctx.arc(bxPos, by, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      drawPillBadge(ctx, anoX + 46, liqTop + 38, 'Khí O₂ ↑', '#ECFDF5', '#10B981', '#065F46', '700 10px ui-sans-serif, sans-serif');
    }

    // DC Power source & wires at top
    const topWireY = 44;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(catX, elecTop);
    ctx.lineTo(catX, topWireY);
    ctx.lineTo(bx - 36, topWireY);
    ctx.moveTo(anoX, elecTop);
    ctx.lineTo(anoX, topWireY);
    ctx.lineTo(bx + 36, topWireY);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(bx - 38, topWireY - 15, 76, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`− DC ${elecCurrentA.toFixed(0)}A +`, bx, topWireY + 4);

    drawArrow(ctx, bx - 44, topWireY - 16, catX + 10, topWireY - 16, '#0284C7', 'e⁻');
    drawArrow(ctx, anoX - 10, topWireY - 16, bx + 44, topWireY - 16, '#0284C7', 'e⁻');

    // Beaker outline
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.6;
    ctx.strokeRect(bx - bW / 2, bBottom - bH, bW, bH);

    // Clean centered pill labels below electrodes (zero collision)
    drawPillBadge(
      ctx,
      catX,
      bBottom + 24,
      `${elecCalc.cathodeLabel} (+${elecCalc.cathodeMassG.toFixed(2)}g)`,
      '#EFF6FF',
      '#93C5FD',
      '#1E3A8A'
    );
    drawPillBadge(
      ctx,
      anoX,
      bBottom + 24,
      elecCalc.isSolubleAnode
        ? `${elecCalc.anodeLabel} (−${elecCalc.anodeDissolvedG.toFixed(2)}g)`
        : elecCalc.anodeLabel,
      '#FFF1F2',
      '#FDA4AF',
      '#9F1239'
    );
  };

  const drawGalvanicCell = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const b1x = w * 0.27;
    const b2x = w * 0.73;
    const bBottom = h * 0.80;
    const bW = Math.min(176, w * 0.29);
    const bH = h * 0.45;
    const liqH = bH * 0.75;
    const wf = galvCalc.wearFrac;

    // Left & Right Half-Cells
    [
      { x: b1x, m: galvCalc.leftM, conc: galvConcLeft, isAnode: galvCalc.leftIsAnode },
      { x: b2x, m: galvCalc.rightM, conc: galvConcRight, isAnode: !galvCalc.leftIsAnode },
    ].forEach((cell) => {
      const liqTop = bBottom - liqH;
      ctx.fillStyle = cell.m.solColor;
      ctx.fillRect(cell.x - bW / 2, liqTop, bW, liqH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(cell.x - bW / 2, bBottom - bH, bW, bH);

      // Electrode bar: top stays full width; immersed part dissolves (Anode) or plates thicker (Cathode)
      const baseW = 24;
      const immersedBot = bBottom - 16;
      const elecTop = bBottom - bH - 12;

      // Original outline dashed on dissolving Anode so thickness loss is crystal clear!
      if (cell.isAnode && wf > 0.04) {
        ctx.save();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(cell.x - baseW / 2, liqTop + 3, baseW, immersedBot - (liqTop + 3));
        ctx.restore();
      }

      const immersedW = cell.isAnode ? Math.max(7, baseW - wf * 15) : baseW;
      ctx.fillStyle = cell.m.color;
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.fillRect(cell.x - baseW / 2, elecTop, baseW, liqTop - elecTop + 3);
      ctx.strokeRect(cell.x - baseW / 2, elecTop, baseW, liqTop - elecTop + 3);
      ctx.fillRect(cell.x - immersedW / 2, liqTop + 3, immersedW, immersedBot - (liqTop + 3));
      ctx.strokeRect(cell.x - immersedW / 2, liqTop + 3, immersedW, immersedBot - (liqTop + 3));

      // Bright newly plated metallic deposit layer on Cathode
      if (!cell.isAnode && wf > 0.02) {
        const plateThick = wf * 7.5;
        ctx.fillStyle = cell.m.coatColor;
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.2;
        ctx.fillRect(
          cell.x - baseW / 2 - plateThick,
          liqTop + 4,
          baseW + plateThick * 2,
          immersedBot - (liqTop + 4)
        );
        ctx.strokeRect(
          cell.x - baseW / 2 - plateThick,
          liqTop + 4,
          baseW + plateThick * 2,
          immersedBot - (liqTop + 4)
        );
      }

      // Micro ion release / deposition dots + crisp reaction arrow
      if (galvCalc.eCell > 0.01) {
        for (let i = 0; i < 4; i++) {
          const frac = (t * 0.55 + i * 0.25) % 1;
          const ix = cell.isAnode
            ? cell.x + immersedW / 2 + 4 + frac * 34
            : cell.x - 44 + frac * (44 - immersedW / 2 - 4);
          const iy = liqTop + 26 + i * 22;
          ctx.fillStyle = cell.isAnode ? '#E11D48' : '#0284C7';
          ctx.beginPath();
          ctx.arc(ix, iy, 3.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Centered Pill Badges below each beaker (non-overlapping!)
      drawPillBadge(
        ctx,
        cell.x,
        bBottom + 22,
        cell.isAnode
          ? `${cell.m.symbol} · Anot (−) tan dần`
          : `${cell.m.symbol} · Catot (+) dày lên`,
        cell.isAnode ? '#FFF1F2' : '#EFF6FF',
        cell.isAnode ? '#FDA4AF' : '#93C5FD',
        cell.isAnode ? '#9F1239' : '#1E3A8A'
      );
      ctx.fillStyle = '#475569';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `[${cell.m.ion}] = ${cell.conc.toFixed(2)}M  ·  Δm = ${
          cell.isAnode
            ? `−${galvCalc.anodeLostG.toFixed(2)}g`
            : `+${galvCalc.cathodeGainedG.toFixed(2)}g`
        }`,
        cell.x,
        bBottom + 46
      );
    });

    // Salt bridge (KNO3 U-tube) with animated K+ -> Cathode & NO3- -> Anode!
    const sbLeft = b1x + 34;
    const sbRight = b2x - 34;
    const sbTopY = bBottom - bH - 14;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sbLeft, bBottom - liqH + 42);
    ctx.lineTo(sbLeft, sbTopY);
    ctx.lineTo(sbRight, sbTopY);
    ctx.lineTo(sbRight, bBottom - liqH + 42);
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sbLeft - 10, bBottom - liqH + 42);
    ctx.lineTo(sbLeft - 10, sbTopY - 10);
    ctx.lineTo(sbRight + 10, sbTopY - 10);
    ctx.lineTo(sbRight + 10, bBottom - liqH + 42);
    ctx.stroke();

    if (galvCalc.eCell > 0.01) {
      const kDir = galvCalc.leftIsAnode ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const frac = (t * 0.35 + i / 3) % 1;
        const kx = kDir > 0 ? sbLeft + frac * (sbRight - sbLeft) : sbRight - frac * (sbRight - sbLeft);
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(kx, sbTopY - 3, 3.2, 0, Math.PI * 2);
        ctx.fill();

        const nx = kDir > 0 ? sbRight - frac * (sbRight - sbLeft) : sbLeft + frac * (sbRight - sbLeft);
        ctx.fillStyle = '#E11D48';
        ctx.beginPath();
        ctx.arc(nx, sbTopY + 4, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawPillBadge(
      ctx,
      w * 0.5,
      sbTopY - 24,
      galvCalc.leftIsAnode ? 'Cầu muối KNO₃ (← NO₃⁻ · K⁺ →)' : 'Cầu muối KNO₃ (← K⁺ · NO₃⁻ →)',
      '#FFFFFF',
      '#94A3B8',
      '#334155',
      '700 10px ui-sans-serif, sans-serif'
    );

    // Top wire + Voltmeter
    const topY = 48;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b1x, bBottom - bH - 12);
    ctx.lineTo(b1x, topY);
    ctx.lineTo(w * 0.5 - 36, topY);
    ctx.moveTo(b2x, bBottom - bH - 12);
    ctx.lineTo(b2x, topY);
    ctx.lineTo(w * 0.5 + 36, topY);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(w * 0.5, topY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#059669';
    ctx.font = '800 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${galvCalc.eCell.toFixed(2)} V`, w * 0.5, topY + 5);

    if (galvCalc.eCell > 0.01) {
      const dir = galvCalc.leftIsAnode ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        const frac = (t * 0.45 + i / 6) % 1;
        const ex = dir > 0 ? b1x + frac * (b2x - b1x) : b2x - frac * (b2x - b1x);
        if (Math.abs(ex - w * 0.5) < 36) continue;
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(ex, topY, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
      drawArrow(
        ctx,
        galvCalc.leftIsAnode ? b1x + 28 : b2x - 28,
        topY - 18,
        galvCalc.leftIsAnode ? b1x + 96 : b2x - 96,
        topY - 18,
        '#0284C7',
        'Dòng e⁻'
      );
    }
  };

  const drawEsterLab = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    st: typeof esterStateRef.current
  ) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    if (esterMode === 'esterification') {
      const fX = w * 0.29;
      const fY = h * 0.62;

      // Hot water bath beaker
      ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.fillRect(fX - 80, fY - 38, 160, 96);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(fX - 80, fY - 38, 160, 96);

      // Tripod & Flame
      ctx.fillStyle = '#F97316';
      const flicker = Math.sin(st.t * 14) * 3;
      ctx.beginPath();
      ctx.moveTo(fX - 12, fY + 90);
      ctx.quadraticCurveTo(fX + flicker * 0.5, fY + 56 + flicker, fX + 12, fY + 90);
      ctx.fill();
      drawPillBadge(ctx, fX, fY + 112, `Đun cách thủy ${esterTempC}°C`, '#FFF7ED', '#FDBA74', '#9A3412');

      // Round-bottom flask body + neck + reacting mixture
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(fX, fY + 4, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fX - 11, fY - 58, 22, 28);
      ctx.strokeRect(fX - 11, fY - 58, 22, 28);
      // Rubber stopper
      ctx.fillStyle = '#334155';
      ctx.fillRect(fX - 13, fY - 66, 26, 10);

      // Gentle boiling bubbles inside reaction flask
      if (esterTempC >= 55) {
        for (let b = 0; b < 5; b++) {
          const by = fY + 24 - ((st.t * 36 + b * 11) % 34);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(fX - 14 + b * 7, by, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Delivery tube angled down into receiving test tube
      const rX = w * 0.72;
      const rY = h * 0.76;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(fX, fY - 66);
      ctx.lineTo(fX, 56);
      ctx.lineTo(rX, 56);
      ctx.lineTo(rX, rY - 90);
      ctx.stroke();

      // Animated ester vapor droplets flowing to receiver
      if (esterTempC > 45) {
        for (let i = 0; i < 4; i++) {
          const frac = (st.t * 0.45 + i * 0.25) % 1;
          const vx = fX + frac * (rX - fX);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.beginPath();
          ctx.arc(vx, 56, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Cold water cooling bath around receiver!
      ctx.fillStyle = 'rgba(125, 211, 252, 0.26)';
      ctx.fillRect(rX - 66, rY - 82, 132, 92);
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(rX - 66, rY - 82, 132, 92);
      drawPillBadge(ctx, rX, rY + 26, 'Cốc nước lạnh + Ống hứng NaCl bão hòa', '#EFF6FF', '#93C5FD', '#1E3A8A');

      // Receiving test tube with NaCl saturated layer & Floating Ester layer
      const esterLayerH = Math.max(5, st.yieldFrac * 44);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
      ctx.fillRect(rX - 30, rY - 68, 60, 68);
      ctx.fillStyle = activeEsterPreset.tint;
      ctx.fillRect(rX - 30, rY - 68 - esterLayerH, 60, esterLayerH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(rX - 30, rY - 126, 60, 126);

      drawPillBadge(
        ctx,
        rX,
        rY - 86 - esterLayerH,
        `Lớp ${activeEsterPreset.name} nổi trên`,
        '#FEF3C7',
        '#F59E0B',
        '#92400E'
      );
      drawPillBadge(
        ctx,
        w * 0.5,
        28,
        `${activeEsterPreset.formula} · ${activeEsterPreset.aroma}`,
        '#FFFFFF',
        '#CBD5E1',
        '#0F172A'
      );
    } else {
      // Saponification visual: clearly shows reaction beaker + stirring rod + floating soap cake after NaCl salting-out!
      const bX = w * 0.42;
      const bBot = h * 0.72;
      const bW = 148;
      const bH = 142;

      // Water bath
      ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
      ctx.fillRect(bX - 102, bBot - 80, 204, 92);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(bX - 102, bBot - 80, 204, 92);

      // Flame
      const flicker = Math.sin(st.t * 14) * 3;
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.moveTo(bX - 12, bBot + 42);
      ctx.quadraticCurveTo(bX + flicker * 0.5, bBot + 10 + flicker, bX + 12, bBot + 42);
      ctx.fill();
      drawPillBadge(ctx, bX, bBot + 64, `Đun khuấy hỗn hợp ở ${esterTempC}°C`, '#FFF7ED', '#FDBA74', '#9A3412');

      // Reaction beaker layers
      const isSimpleEster = saponSubstrate === 'ethyl_acetate_hydro';
      const liqBaseH = 74;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.fillRect(bX - bW / 2, bBot - liqBaseH, bW, liqBaseH);

      if (!isSimpleEster) {
        const soapThick = soapSaltOut ? Math.max(8, st.yieldFrac * 36) : Math.max(4, (1 - st.yieldFrac) * 14 + 4);
        ctx.fillStyle = soapSaltOut
          ? soapAlkali === 'NaOH'
            ? '#FEF3C7'
            : '#FFEDD5'
          : 'rgba(253, 224, 71, 0.55)';
        ctx.fillRect(bX - bW / 2, bBot - liqBaseH - soapThick, bW, soapThick);
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bX - bW / 2, bBot - liqBaseH - soapThick, bW, soapThick);
      }

      // Glass stirring rod
      const stirX = bX + Math.sin(st.t * 5) * 18;
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(stirX - 12, bBot - bH - 22);
      ctx.lineTo(stirX + 16, bBot - 16);
      ctx.stroke();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.6;
      ctx.strokeRect(bX - bW / 2, bBot - bH, bW, bH);

      // Right-hand observational callouts
      const infoX = w * 0.76;
      if (isSimpleEster) {
        drawPillBadge(
          ctx,
          infoX,
          h * 0.38,
          'Lớp ester biến mất → Dung dịch đồng nhất',
          '#ECFDF5',
          '#6EE7B7',
          '#065F46'
        );
      } else if (soapSaltOut) {
        drawPillBadge(
          ctx,
          infoX,
          h * 0.34,
          `Bánh xà phòng (${soapAlkali === 'NaOH' ? 'rắn' : 'mềm'}) nổi lên trên`,
          '#FEF3C7',
          '#F59E0B',
          '#92400E'
        );
        drawPillBadge(
          ctx,
          infoX,
          h * 0.52,
          'Lớp dưới: Glycerol + NaCl bão hòa',
          '#EFF6FF',
          '#93C5FD',
          '#1E3A8A'
        );
      } else {
        drawPillBadge(
          ctx,
          infoX,
          h * 0.42,
          `Đang xà phòng hóa trong kiềm ${soapAlkali} nóng`,
          '#FFFFFF',
          '#CBD5E1',
          '#0F172A'
        );
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT STAGE */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                isRunning
                  ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{isRunning ? 'Tạm dừng' : 'Tiếp tục'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (moduleId === 'electrolysis') {
                  elecStateRef.current.elapsedMin = 0;
                  setElecTimeMin(0);
                } else if (moduleId === 'galvanic_cell') {
                  galvStateRef.current.elapsedMin = 0;
                  setGalvTimeMin(0);
                } else if (moduleId === 'ester_lab') {
                  esterStateRef.current.yieldFrac = 0;
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Làm lại</span>
            </button>
          </div>

          <span className="text-[11px] font-semibold text-slate-500">
            {moduleId === 'galvanic_cell'
              ? 'Nét đứt xám: kích thước Anot ban đầu · Viền đậm: lớp kim loại mới bám Catot'
              : moduleId === 'electrolysis'
              ? elecCalc.isSolubleAnode
                ? 'Nét đứt xám: kích thước Anot ban đầu'
                : 'Điện cực trơ Graphit (không tan)'
              : 'Quan sát trực tiếp các pha chất lỏng phân tách'}
          </span>
        </div>

        <div className="relative w-full h-[430px] sm:h-[470px]">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* Readout strip */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {moduleId === 'electrolysis' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Thời gian t</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {elecTimeMin.toFixed(1)} phút ({Math.round(elecTimeMin * 60)} s)
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Anot (+) {elecCalc.isSolubleAnode ? 'bị hòa tan' : '(trơ)'}</div>
                <div className="font-mono tabular-nums font-bold text-rose-700 mt-0.5">
                  {elecCalc.isSolubleAnode
                    ? `−${elecCalc.anodeDissolvedG.toFixed(2)} g`
                    : `0.00 g (${elecCalc.anodeGasL.toFixed(2)} L O₂)`}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Kim loại bám Catot (−)</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  +{elecCalc.cathodeMassG.toFixed(2)} g
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Mol electron trao đổi</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {elecCalc.nMolE.toFixed(4)} mol
                </div>
              </div>
            </>
          )}

          {moduleId === 'galvanic_cell' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Anot (−) tan dần</div>
                <div className="font-mono font-bold text-rose-700 mt-0.5">
                  {galvCalc.anode.symbol} (−{galvCalc.anodeLostG.toFixed(2)} g)
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Catot (+) bồi đắp</div>
                <div className="font-mono font-bold text-sky-700 mt-0.5">
                  {galvCalc.cathode.symbol} (+{galvCalc.cathodeGainedG.toFixed(2)} g)
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Sức điện động E_pin</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {galvCalc.eCell.toFixed(3)} V
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Ký hiệu pin chuẩn</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  (−) {galvCalc.anode.symbol} | {galvCalc.anode.ion} || {galvCalc.cathode.ion} | {galvCalc.cathode.symbol} (+)
                </div>
              </div>
            </>
          )}

          {moduleId === 'ester_lab' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Hiệu suất hiện tại</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {esterReadout.yieldPct.toFixed(1)} %
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Hiệu suất cân bằng</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {esterMaxYield.toFixed(1)} %
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 col-span-2">
                <div className="text-slate-500">Hiện tượng chính</div>
                <div className="font-bold text-slate-800 mt-0.5">
                  {esterMode === 'esterification'
                    ? `${activeEsterPreset.name} không tan, nhẹ hơn nước nên nổi thành lớp riêng trên NaCl bão hòa (${activeEsterPreset.aroma}).`
                    : saponSubstrate === 'ethyl_acetate_hydro'
                    ? 'Ester bị thủy phân hoàn toàn tạo CH₃COONa và C₂H₅OH tan tốt nên dung dịch đồng nhất.'
                    : 'NaCl bão hòa làm muối sodium/potassium của acid béo kết tinh nổi lên thành bánh xà phòng.'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT CONTROLS & EQUATIONS */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm">
            <SlidersHorizontal size={16} className="text-emerald-600" />
            <span>Điều Chỉnh Hóa Chất &amp; Điều Kiện</span>
          </div>

          {moduleId === 'electrolysis' && (
            <>
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Chọn phản ứng điện phân / tinh chế / mạ điện</label>
                {[
                  { id: 'cuso4_refine', label: 'Tinh chế Cu thô (Anot Cu bẩn tan → Catot Cu sạch)' },
                  { id: 'plating_cu', label: 'Mạ Đồng lên vật kim loại (Anot Cu tan)' },
                  { id: 'plating_ag', label: 'Mạ Bạc lên vật kim loại (Anot Ag tan)' },
                  { id: 'plating_ni', label: 'Mạ Niken chống gỉ (Anot Ni tan)' },
                  { id: 'cuso4_inert', label: 'Điện phân CuSO₄ (Anot Graphit trơ)' },
                  { id: 'agno3_inert', label: 'Điện phân AgNO₃ (Anot Graphit trơ)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setElecSystem(opt.id as ElectrolysisSystem);
                      elecStateRef.current.elapsedMin = 0;
                      setElecTimeMin(0);
                    }}
                    className={`w-full px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                      elecSystem === opt.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <ChemSlider
                label="Cường độ dòng điện I"
                valueDisplay={`${elecCurrentA.toFixed(1)} A`}
                min={1}
                max={12}
                step={0.5}
                value={elecCurrentA}
                onChange={setElecCurrentA}
              />
            </>
          )}

          {moduleId === 'galvanic_cell' && (
            <>
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Pin chuẩn thường gặp THPT</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Pin Daniell Zn–Cu', l: 2, r: 6 },
                    { label: 'Pin Al–Cu', l: 1, r: 6 },
                    { label: 'Pin Fe–Ag', l: 3, r: 7 },
                    { label: 'Pin Mg–Cu', l: 0, r: 6 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setGalvLeftIdx(p.l);
                        setGalvRightIdx(p.r);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 font-bold text-slate-700 hover:text-emerald-800 cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Bán pin trái (Điện cực 1)</label>
                <div className="grid grid-cols-4 gap-1">
                  {ELECTRODE_METALS.map((m, idx) => (
                    <button
                      key={m.symbol}
                      type="button"
                      onClick={() => setGalvLeftIdx(idx)}
                      className={`py-1.5 rounded-lg border font-bold text-[11px] cursor-pointer ${
                        galvLeftIdx === idx
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {m.symbol} ({m.e0 > 0 ? `+${m.e0}` : m.e0})
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Bán pin phải (Điện cực 2)</label>
                <div className="grid grid-cols-4 gap-1">
                  {ELECTRODE_METALS.map((m, idx) => (
                    <button
                      key={m.symbol}
                      type="button"
                      onClick={() => setGalvRightIdx(idx)}
                      className={`py-1.5 rounded-lg border font-bold text-[11px] cursor-pointer ${
                        galvRightIdx === idx
                          ? 'bg-sky-50 border-sky-300 text-sky-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {m.symbol} ({m.e0 > 0 ? `+${m.e0}` : m.e0})
                    </button>
                  ))}
                </div>
              </div>
              <ChemSlider
                label={`Nồng độ [${galvCalc.leftM.ion}] trái`}
                valueDisplay={`${galvConcLeft.toFixed(2)} M`}
                min={0.05}
                max={2.0}
                step={0.05}
                value={galvConcLeft}
                onChange={setGalvConcLeft}
              />
              <ChemSlider
                label={`Nồng độ [${galvCalc.rightM.ion}] phải`}
                valueDisplay={`${galvConcRight.toFixed(2)} M`}
                min={0.05}
                max={2.0}
                step={0.05}
                value={galvConcRight}
                onChange={setGalvConcRight}
              />
            </>
          )}

          {moduleId === 'ester_lab' && (
            <>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setEsterMode('esterification');
                    esterStateRef.current.yieldFrac = 0;
                  }}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    esterMode === 'esterification' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Điều chế Ester
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEsterMode('saponification');
                    esterStateRef.current.yieldFrac = 0;
                  }}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    esterMode === 'saponification' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Xà phòng hóa
                </button>
              </div>

              {esterMode === 'esterification' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 block">Chọn Ester điều chế (THPT)</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ESTER_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setEsterPresetId(p.id);
                            esterStateRef.current.yieldFrac = 0;
                          }}
                          className={`px-2.5 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                            esterPresetId === p.id
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="truncate">{p.name}</div>
                          <div className="text-[10px] font-medium text-slate-500 truncate">{p.aroma}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <ChemSlider
                    label="Nhiệt độ đun cách thủy"
                    valueDisplay={`${esterTempC} °C`}
                    min={30}
                    max={95}
                    step={5}
                    value={esterTempC}
                    onChange={setEsterTempC}
                  />
                  <ChemSlider
                    label="Tỉ lệ mol Alcohol / Acid"
                    valueDisplay={`${esterMoleRatio.toFixed(1)} : 1`}
                    min={1.0}
                    max={4.0}
                    step={0.5}
                    value={esterMoleRatio}
                    onChange={setEsterMoleRatio}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={esterCatH2SO4}
                      onChange={(e) => setEsterCatH2SO4(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span className="font-semibold text-slate-700">Dùng H₂SO₄ đặc (xúc tác + hút nước)</span>
                  </label>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 block">Chọn chất tham gia xà phòng hóa</label>
                    {[
                      { id: 'tristearin', label: 'Tristearin (C₁₇H₃₅COO)₃C₃H₅ (chất béo no)' },
                      { id: 'triolein', label: 'Triolein (C₁₇H₃₃COO)₃C₃H₅ (chất béo lỏng)' },
                      { id: 'ethyl_acetate_hydro', label: 'Ethyl Acetate CH₃COOC₂H₅ (thủy phân ester)' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSaponSubstrate(s.id as SaponificationSubstrateId);
                          esterStateRef.current.yieldFrac = 0;
                        }}
                        className={`w-full px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                          saponSubstrate === s.id
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <ChemSlider
                    label="Nhiệt độ đun cách thủy"
                    valueDisplay={`${esterTempC} °C`}
                    min={30}
                    max={95}
                    step={5}
                    value={esterTempC}
                    onChange={setEsterTempC}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['NaOH', 'KOH'] as const).map((alk) => (
                      <button
                        key={alk}
                        type="button"
                        onClick={() => setSoapAlkali(alk)}
                        className={`py-2 rounded-xl border font-bold cursor-pointer ${
                          soapAlkali === alk
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        Kiềm {alk}
                      </button>
                    ))}
                  </div>
                  {saponSubstrate !== 'ethyl_acetate_hydro' && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={soapSaltOut}
                        onChange={(e) => setSoapSaltOut(e.target.checked)}
                        className="rounded accent-emerald-600"
                      />
                      <span className="font-semibold text-slate-700">Thêm dung dịch NaCl bão hòa (tách bánh xà phòng)</span>
                    </label>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Equation Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <h3 className="font-extrabold text-slate-900">Phương Trình &amp; Giải Thích</h3>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-slate-800">
            {moduleId === 'electrolysis' && (
              <>
                <p className="font-semibold text-sky-800">Catot (−, sự khử): {elecCalc.cathodeEq}</p>
                <p className="font-semibold text-rose-800">Anot (+, sự oxi hóa): {elecCalc.anodeEq}</p>
                <p className="font-mono font-bold text-slate-900 pt-1 border-t border-slate-200">{elecCalc.overallEq}</p>
                <p className="text-slate-600">{elecCalc.phenomenon}</p>
                <p className="text-[11px] font-mono text-slate-500">
                  Faraday (Hóa 12): Δm = (A · I · t) / (n · F), F = 96 500 C/mol.
                </p>
              </>
            )}
            {moduleId === 'galvanic_cell' && (
              <>
                <p className="font-mono font-bold text-slate-900">
                  {galvCalc.anode.symbol} (Anot tan) + {galvCalc.cathode.ion} → {galvCalc.anode.ion} + {galvCalc.cathode.symbol} ↓ (bám Catot)
                </p>
                <p className="font-mono text-[11px] text-emerald-700 font-semibold">
                  E°_pin = E°_cathode − E°_anode = ({galvCalc.cathode.e0 > 0 ? `+${galvCalc.cathode.e0}` : galvCalc.cathode.e0}) − ({galvCalc.anode.e0 > 0 ? `+${galvCalc.anode.e0}` : galvCalc.anode.e0}) = {(galvCalc.cathode.e0 - galvCalc.anode.e0).toFixed(2)} V
                </p>
                <p className="text-slate-600 flex items-start gap-1.5">
                  <Zap size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    Điện cực {galvCalc.anode.symbol} có E° nhỏ hơn đóng vai trò Anot (−) nên bị oxi hóa và tan dần vào dung dịch; đồng thời ion {galvCalc.cathode.ion} nhận e bám dày lên Catot {galvCalc.cathode.symbol}.
                  </span>
                </p>
              </>
            )}
            {moduleId === 'ester_lab' && (
              <>
                <p className="font-mono font-bold text-slate-900">
                  {esterMode === 'esterification'
                    ? activeEsterPreset.equation
                    : saponSubstrate === 'tristearin'
                    ? `(C₁₇H₃₅COO)₃C₃H₅ + 3${soapAlkali} —(t°)→ 3C₁₇H₃₅COO${soapAlkali.replace('OH', '')} + C₃H₅(OH)₃`
                    : saponSubstrate === 'triolein'
                    ? `(C₁₇H₃₃COO)₃C₃H₅ + 3${soapAlkali} —(t°)→ 3C₁₇H₃₃COO${soapAlkali.replace('OH', '')} + C₃H₅(OH)₃`
                    : `CH₃COOC₂H₅ + ${soapAlkali} —(t°)→ CH₃COO${soapAlkali.replace('OH', '')} + C₂H₅OH`}
                </p>
                <p className="text-slate-600 flex items-start gap-1.5">
                  <Info size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    {esterMode === 'esterification'
                      ? 'Phản ứng ester hóa (Hóa 12) thuận nghịch. H₂SO₄ đặc xúc tác + hút nước và ống hứng ngâm nước lạnh chứa NaCl bão hòa giúp ngưng tụ và tách lớp ester nổi lên trên rõ rệt.'
                      : 'Phản ứng xà phòng hóa xảy ra một chiều khi đun nóng với kiềm. Thêm NaCl bão hòa giúp muối của acid béo giảm độ tan và nổi lên thành lớp bánh xà phòng.'}
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

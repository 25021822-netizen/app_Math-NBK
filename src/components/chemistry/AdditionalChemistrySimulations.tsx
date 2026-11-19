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
  ctx.lineWidth = 2;
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
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(label, x2 + 5, y2 - 4);
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
  solColor: string;
}

const ELECTRODE_METALS: ElectrodeMetal[] = [
  { symbol: 'Mg', ion: 'Mg²⁺', n: 2, e0: -2.37, molarMass: 24, color: '#CBD5E1', solColor: 'rgba(226,232,240,0.4)' },
  { symbol: 'Zn', ion: 'Zn²⁺', n: 2, e0: -0.76, molarMass: 65, color: '#94A3B8', solColor: 'rgba(226,232,240,0.45)' },
  { symbol: 'Fe', ion: 'Fe²⁺', n: 2, e0: -0.44, molarMass: 56, color: '#64748B', solColor: 'rgba(134,239,172,0.35)' },
  { symbol: 'Pb', ion: 'Pb²⁺', n: 2, e0: -0.13, molarMass: 207, color: '#475569', solColor: 'rgba(226,232,240,0.4)' },
  { symbol: 'Cu', ion: 'Cu²⁺', n: 2, e0: +0.34, molarMass: 64, color: '#D97706', solColor: 'rgba(56,189,248,0.42)' },
  { symbol: 'Ag', ion: 'Ag⁺', n: 1, e0: +0.80, molarMass: 108, color: '#E2E8F0', solColor: 'rgba(241,245,249,0.5)' },
];

type ElectrolysisSystem = 'cuso4_refine' | 'plating_ag' | 'plating_ni' | 'cuso4_inert';

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
    const F = 96500; // Hằng số Faraday SGK Hóa 12
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

    if (elecSystem === 'cuso4_refine') {
      cathodeMassG = (64 * nMolE) / 2;
      anodeDissolvedG = (64 * nMolE) / 2;
      isSolubleAnode = true;
      anodeLabel = 'Anot (+) Cu thô (tan)';
      cathodeLabel = 'Catot (−) Cu tinh khiết';
      cathodeEq = 'Cu²⁺ + 2e → Cu ↓ (bám đồng 99,99% lên Catot)';
      anodeEq = 'Cu (thô) → Cu²⁺ + 2e (Anot Cu tan, tạp chất Ag/Au lắng bùn)';
      overallEq = 'Tinh chế đồng: Cu (Anot thô) —(đpdd CuSO₄)→ Cu (Catot tinh khiết)';
      phenomenon =
        'Điện cực Anot đồng thô tan dần để lại bùn anot (Ag, Au); ion Cu²⁺ di chuyển về Catot tạo lớp đồng tinh khiết dày lên.';
    } else if (elecSystem === 'plating_ag') {
      cathodeMassG = 108 * nMolE;
      anodeDissolvedG = 108 * nMolE;
      isSolubleAnode = true;
      anodeLabel = 'Anot (+) Thanh Ag (tan)';
      cathodeLabel = 'Catot (−) Vật cần mạ';
      cathodeEq = 'Ag⁺ + 1e → Ag ↓ (lớp mạ bạc trắng bóng bám lên vật)';
      anodeEq = 'Ag → Ag⁺ + 1e (Anot Ag tan dần bù lượng Ag⁺ đã điện phân)';
      overallEq = 'Mạ bạc: Ag (Anot tan) —(đpdd muối Ag⁺)→ Ag (bám bề mặt Catot)';
      phenomenon =
        'Thanh Anot Ag tan dần giúp duy trì ổn định nồng độ ion Ag⁺; bề mặt vật ở Catot được phủ lớp bạc trắng sáng bóng.';
    } else if (elecSystem === 'plating_ni') {
      cathodeMassG = (58.7 * nMolE) / 2;
      anodeDissolvedG = (58.7 * nMolE) / 2;
      isSolubleAnode = true;
      anodeLabel = 'Anot (+) Thanh Ni (tan)';
      cathodeLabel = 'Catot (−) Vật thép cần mạ';
      cathodeEq = 'Ni²⁺ + 2e → Ni ↓ (phủ lớp niken chống ăn mòn lên thép)';
      anodeEq = 'Ni → Ni²⁺ + 2e (Anot Ni tan dần bổ sung ion Ni²⁺)';
      overallEq = 'Mạ niken: Ni (Anot tan) —(đpdd NiSO₄)→ Ni (lớp phủ bảo vệ Catot)';
      phenomenon =
        'Anot niken tan dần theo định luật Faraday; Catot bằng thép được mạ lớp niken sáng mịn bảo vệ chống gỉ sét.';
    } else {
      cathodeMassG = (64 * nMolE) / 2;
      anodeDissolvedG = 0;
      anodeGasL = (nMolE / 4) * 24.79;
      isSolubleAnode = false;
      anodeLabel = 'Anot (+) Graphit (trơ)';
      cathodeLabel = 'Catot (−) Đồng bám';
      cathodeEq = 'Cu²⁺ + 2e → Cu ↓ (bám đỏ lên Catot)';
      anodeEq = '2H₂O → O₂ ↑ + 4H⁺ + 4e (điện cực trơ không tan)';
      overallEq = '2CuSO₄ + 2H₂O —(đpdd, cực trơ)→ 2Cu ↓ + O₂ ↑ + 2H₂SO₄';
      phenomenon =
        'Anot than chì trơ không tan và sủi bọt khí O₂; Catot có Cu bám vào; nồng độ Cu²⁺ giảm làm dung dịch nhạt màu xanh và pH giảm.';
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
    };
  }, [elecSystem, elecCurrentA, elecTimeMin]);

  // ===========================================================================
  // 2. PIN GALVANI (PIN ĐIỆN HÓA — ĐIỆN CỰC ANOT TAN & CATOT BỒI ĐẮP)
  // ===========================================================================
  const [galvLeftIdx, setGalvLeftIdx] = useState<number>(1); // Zn
  const [galvRightIdx, setGalvRightIdx] = useState<number>(4); // Cu
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

    // Simulate continuous discharge at nominal current proportional to E_cell (e.g. I = 2.0 * E_cell A)
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

  // Reset discharge time when changing electrode metals
  useEffect(() => {
    galvStateRef.current.elapsedMin = 0;
    setGalvTimeMin(0);
  }, [galvLeftIdx, galvRightIdx]);

  // ===========================================================================
  // 3. ĐIỀU CHẾ ESTER & XÀ PHÒNG HÓA (ESTER LAB)
  // ===========================================================================
  const [esterMode, setEsterMode] = useState<'esterification' | 'saponification'>('esterification');
  const [esterTempC, setEsterTempC] = useState<number>(70); // C
  const [esterCatH2SO4, setEsterCatH2SO4] = useState<boolean>(true);
  const [esterMoleRatio, setEsterMoleRatio] = useState<number>(1.5); // Ethanol / Acetic acid
  const [soapAlkali, setSoapAlkali] = useState<'NaOH' | 'KOH'>('NaOH');
  const [soapSaltOut, setSoapSaltOut] = useState<boolean>(false);
  const esterStateRef = useRef({ t: 0, yieldFrac: 0 });
  const [esterReadout, setEsterReadout] = useState({ yieldPct: 0 });

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
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(360, Math.floor(rect.height));
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
            st.elapsedMin = Math.min(45, st.elapsedMin + dt * 1.45);
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

      // 2. GALVANIC CELL (DISSOLVING ANODE & DEPOSITING CATHODE)
      if (moduleId === 'galvanic_cell' && canvasRef.current) {
        const st = galvStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (galvCalc.eCell > 0.01 && st.elapsedMin < 60) {
            st.elapsedMin = Math.min(60, st.elapsedMin + dt * 1.8);
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
    const bBottom = h * 0.85;
    const bW = Math.min(350, w * 0.58);
    const bH = h * 0.54;
    const liqH = bH * 0.78;
    const progress = Math.min(1, elecStateRef.current.elapsedMin / 45);

    // Electrolyte solution color
    let liqColor = 'rgba(56, 189, 248, 0.44)';
    if (elecSystem === 'cuso4_inert') {
      const alpha = Math.max(0.08, 0.48 * (1 - progress * 0.8));
      liqColor = `rgba(56, 189, 248, ${alpha})`;
    } else if (elecSystem === 'plating_ag') {
      liqColor = 'rgba(226, 232, 240, 0.45)';
    } else if (elecSystem === 'plating_ni') {
      liqColor = 'rgba(52, 211, 153, 0.36)';
    }

    ctx.fillStyle = liqColor;
    ctx.fillRect(bx - bW / 2, bBottom - liqH, bW, liqH);

    // Cathode (left, -) and Anode (right, +)
    const catX = bx - bW * 0.27;
    const anoX = bx + bW * 0.27;
    const elecTop = bBottom - bH + 10;
    const elecBot = bBottom - 22;

    // Anode thickness (soluble anodes shrink cleanly!)
    const anoThick = elecCalc.isSolubleAnode ? Math.max(6, 22 - progress * 14) : 16;
    ctx.fillStyle =
      elecSystem === 'cuso4_refine'
        ? '#B45309'
        : elecSystem === 'plating_ag'
        ? '#CBD5E1'
        : elecSystem === 'plating_ni'
        ? '#94A3B8'
        : '#334155';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.4;
    ctx.fillRect(anoX - anoThick / 2, elecTop, anoThick, elecBot - elecTop);
    ctx.strokeRect(anoX - anoThick / 2, elecTop, anoThick, elecBot - elecTop);

    // Anode mud (bùn anot: Ag, Au) settling below crude Cu anode during refining
    if (elecSystem === 'cuso4_refine' && progress > 0.05) {
      ctx.fillStyle = '#475569';
      const mudCount = Math.round(progress * 18);
      for (let i = 0; i < mudCount; i++) {
        const mx = anoX - 18 + ((i * 7) % 36);
        const my = bBottom - 5 - (i % 3) * 2.5;
        ctx.beginPath();
        ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#475569';
      ctx.font = '600 10px ui-sans-serif, sans-serif';
      ctx.fillText('Bùn anot (Ag, Au)', anoX - 38, bBottom - 12);
    }

    // Cathode core + plating deposit layer
    ctx.fillStyle = '#475569';
    ctx.fillRect(catX - 8, elecTop, 16, elecBot - elecTop);
    const coatW = progress * 9;
    if (coatW > 0.3) {
      ctx.fillStyle =
        elecSystem === 'plating_ag'
          ? '#F1F5F9'
          : elecSystem === 'plating_ni'
          ? '#CBD5E1'
          : '#D97706';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.fillRect(catX - 8 - coatW, elecTop + 34, 16 + coatW * 2, elecBot - elecTop - 34);
      ctx.strokeRect(catX - 8 - coatW, elecTop + 34, 16 + coatW * 2, elecBot - elecTop - 34);
    }

    // Animated cations migrating Anode -> Cathode for soluble-anode processes
    if (elecCalc.isSolubleAnode) {
      const ionLabel = elecSystem === 'plating_ag' ? 'Ag⁺' : elecSystem === 'plating_ni' ? 'Ni²⁺' : 'Cu²⁺';
      const ionColor = elecSystem === 'plating_ag' ? '#64748B' : elecSystem === 'plating_ni' ? '#059669' : '#0284C7';
      for (let i = 0; i < 6; i++) {
        const frac = (t * 0.42 + i / 6) % 1;
        const ix = anoX - frac * (anoX - catX);
        const iy = bBottom - liqH + 35 + ((i * 29) % (liqH - 60));
        ctx.fillStyle = ionColor;
        ctx.beginPath();
        ctx.arc(ix, iy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      drawArrow(ctx, anoX - 24, bBottom - liqH + 20, catX + 24, bBottom - liqH + 20, ionColor, ionLabel);
    } else {
      // Bubbles O2 on inert Graphite Anode
      const bubbleCount = Math.min(18, Math.round(elecCurrentA * 1.8));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < bubbleCount; i++) {
        const yOff = (t * 55 + i * 27) % (liqH - 30);
        const by = bBottom - 26 - yOff;
        const bxPos = anoX + Math.sin(t * 4 + i) * 14;
        ctx.beginPath();
        ctx.arc(bxPos, by, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // DC Power source & wires at top
    const topWireY = 44;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(catX, elecTop);
    ctx.lineTo(catX, topWireY);
    ctx.lineTo(bx - 26, topWireY);
    ctx.moveTo(anoX, elecTop);
    ctx.lineTo(anoX, topWireY);
    ctx.lineTo(bx + 26, topWireY);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(bx - 34, topWireY - 14, 68, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText('− DC +', bx - 22, topWireY + 4);

    drawArrow(ctx, bx - 68, topWireY - 14, catX + 18, topWireY - 14, '#0284C7', 'e⁻');

    // Beaker outline
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx - bW / 2, bBottom - bH, bW, bH);

    // Labels
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText(elecCalc.cathodeLabel, catX - 58, bBottom + 20);
    ctx.fillText(elecCalc.anodeLabel, anoX - 54, bBottom + 20);
  };

  const drawGalvanicCell = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const b1x = w * 0.28;
    const b2x = w * 0.72;
    const bBottom = h * 0.85;
    const bW = Math.min(165, w * 0.27);
    const bH = h * 0.48;
    const liqH = bH * 0.74;
    const wf = galvCalc.wearFrac;

    // Left & Right Beakers
    [
      { x: b1x, m: galvCalc.leftM, conc: galvConcLeft, isAnode: galvCalc.leftIsAnode },
      { x: b2x, m: galvCalc.rightM, conc: galvConcRight, isAnode: !galvCalc.leftIsAnode },
    ].forEach((cell) => {
      ctx.fillStyle = cell.m.solColor;
      ctx.fillRect(cell.x - bW / 2, bBottom - liqH, bW, liqH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(cell.x - bW / 2, bBottom - bH, bW, bH);

      // Soluble Anode dissolves thinner; Cathode thickens with plated deposit
      const baseHalfW = 12;
      const barW = cell.isAnode
        ? Math.max(7, baseHalfW * 2 - wf * 14)
        : baseHalfW * 2;
      ctx.fillStyle = cell.m.color;
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.fillRect(cell.x - barW / 2, bBottom - bH - 12, barW, bH - 8);
      ctx.strokeRect(cell.x - barW / 2, bBottom - bH - 12, barW, bH - 8);

      // Plated metallic deposit sleeve on immersed Cathode portion
      if (!cell.isAnode && wf > 0.02) {
        const plateThick = wf * 6.5;
        const immersedTop = bBottom - liqH + 4;
        ctx.fillStyle = cell.m.color;
        ctx.fillRect(cell.x - barW / 2 - plateThick, immersedTop, barW + plateThick * 2, liqH - 24);
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.1;
        ctx.strokeRect(cell.x - barW / 2 - plateThick, immersedTop, barW + plateThick * 2, liqH - 24);
      }

      // Dissolving ions off Anode vs Depositing ions onto Cathode
      if (galvCalc.eCell > 0.01) {
        for (let i = 0; i < 4; i++) {
          const frac = (t * 0.55 + i * 0.25) % 1;
          const ix = cell.isAnode
            ? cell.x + barW / 2 + frac * 34
            : cell.x - 42 + frac * (42 - barW / 2);
          const iy = bBottom - liqH + 25 + i * 24;
          ctx.fillStyle = cell.isAnode ? '#E11D48' : '#0284C7';
          ctx.beginPath();
          ctx.arc(ix, iy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = '800 12px ui-sans-serif, sans-serif';
      ctx.fillText(
        `${cell.m.symbol} (${cell.isAnode ? 'Anot − · Tan dần' : 'Catot + · Dày lên'})`,
        cell.x - 58,
        bBottom + 20
      );
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`[${cell.m.ion}] = ${cell.conc.toFixed(2)}M`, cell.x - 44, bBottom + 36);
    });

    // Salt bridge (KNO3 U-tube)
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b1x + 28, bBottom - liqH + 45);
    ctx.lineTo(b1x + 28, bBottom - bH - 14);
    ctx.lineTo(b2x - 28, bBottom - bH - 14);
    ctx.lineTo(b2x - 28, bBottom - liqH + 45);
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b1x + 19, bBottom - liqH + 45);
    ctx.lineTo(b1x + 19, bBottom - bH - 23);
    ctx.lineTo(b2x - 19, bBottom - bH - 23);
    ctx.lineTo(b2x - 19, bBottom - liqH + 45);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText('Cầu muối KNO₃', w * 0.5 - 38, bBottom - bH - 28);

    // Top wire + Voltmeter
    const topY = 48;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(b1x, bBottom - bH - 12);
    ctx.lineTo(b1x, topY);
    ctx.lineTo(w * 0.5 - 32, topY);
    ctx.moveTo(b2x, bBottom - bH - 12);
    ctx.lineTo(b2x, topY);
    ctx.lineTo(w * 0.5 + 32, topY);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w * 0.5, topY, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#059669';
    ctx.font = '800 13px ui-monospace, monospace';
    ctx.fillText(`${galvCalc.eCell.toFixed(2)}V`, w * 0.5 - 20, topY + 5);

    // Moving electrons along wire from Anode -> Cathode
    if (galvCalc.eCell > 0.01) {
      const dir = galvCalc.leftIsAnode ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        const frac = (t * 0.45 + i / 6) % 1;
        const ex = dir > 0 ? b1x + frac * (b2x - b1x) : b2x - frac * (b2x - b1x);
        if (Math.abs(ex - w * 0.5) < 34) continue;
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(ex, topY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      drawArrow(
        ctx,
        galvCalc.leftIsAnode ? b1x + 25 : b2x - 25,
        topY - 16,
        galvCalc.leftIsAnode ? b1x + 85 : b2x - 85,
        topY - 16,
        '#0284C7',
        'e⁻'
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

    const fX = w * 0.34;
    const fY = h * 0.62;

    // Hot water bath beaker
    ctx.fillStyle = 'rgba(186, 230, 253, 0.4)';
    ctx.fillRect(fX - 75, fY - 35, 150, 95);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(fX - 75, fY - 35, 150, 95);

    // Alcohol burner flame below bath
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(fX - 10, fY + 86);
    ctx.quadraticCurveTo(fX, fY + 56, fX + 10, fY + 86);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText(`Đun cách thủy ${esterTempC}°C`, fX - 52, fY + 106);

    if (esterMode === 'esterification') {
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(fX, fY + 6, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const rX = w * 0.72;
      const rY = h * 0.74;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fX, fY - 30);
      ctx.lineTo(fX, fY - 105);
      ctx.lineTo(rX, fY - 105);
      ctx.lineTo(rX, rY - 95);
      ctx.stroke();

      if (esterTempC > 50) {
        for (let i = 0; i < 4; i++) {
          const frac = (st.t * 0.5 + i * 0.25) % 1;
          const vx = fX + frac * (rX - fX);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
          ctx.beginPath();
          ctx.arc(vx, fY - 105, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const esterLayerH = Math.max(4, st.yieldFrac * 42);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.fillRect(rX - 32, rY - 70, 64, 70);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.82)';
      ctx.fillRect(rX - 32, rY - 70 - esterLayerH, 64, esterLayerH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(rX - 32, rY - 120, 64, 120);

      ctx.fillStyle = '#B45309';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('Lớp Ester nổi (nhẹ hơn H₂O)', rX - 58, rY - 78 - esterLayerH);
      ctx.fillStyle = '#0369A1';
      ctx.fillText('Dung dịch NaCl bão hòa', rX - 56, rY + 22);
    } else {
      const soapLayerH = Math.max(4, st.yieldFrac * (soapSaltOut ? 36 : 16));
      ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
      ctx.fillRect(fX - 42, fY - 22, 84, 62);
      ctx.fillStyle = soapAlkali === 'NaOH' ? '#FDE68A' : '#FED7AA';
      ctx.fillRect(fX - 42, fY - 22 - soapLayerH, 84, soapLayerH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(fX - 42, fY - 62, 84, 102);

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(
        soapSaltOut
          ? `Tạo bánh xà phòng (${soapAlkali === 'NaOH' ? 'rắn' : 'mềm'}) tách lớp rõ rệt nhờ thêm NaCl`
          : `Đang thủy phân chất béo trong kiềm ${soapAlkali} nóng`,
        w * 0.54,
        h * 0.45
      );
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
        </div>

        <div className="relative w-full h-[400px] sm:h-[440px]">
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
                <div className="text-slate-500">Anot (+) {elecCalc.isSolubleAnode ? 'bị hòa tan' : '(điện cực trơ)'}</div>
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
                <div className="text-slate-500">Sơ đồ pin chuẩn</div>
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
                <div className="text-slate-500">Vai trò hóa chất</div>
                <div className="font-bold text-slate-800 mt-0.5">
                  {esterMode === 'esterification'
                    ? 'H₂SO₄ đặc vừa xúc tác vừa hút nước làm chuyển dịch cân bằng theo chiều thuận.'
                    : 'NaCl bão hòa làm tăng khối lượng riêng lớp nước, giảm độ tan giúp xà phòng tách nổi lên trên.'}
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
                <label className="font-semibold text-slate-700 block">Quy trình tinh chế / mạ điện</label>
                {[
                  { id: 'cuso4_refine', label: 'Tinh chế Cu thô (Anot Cu bẩn tan → Catot Cu sạch)' },
                  { id: 'plating_ag', label: 'Mạ Bạc lên vật kim loại (Anot Ag tan)' },
                  { id: 'plating_ni', label: 'Mạ Niken chống gỉ (Anot Ni tan)' },
                  { id: 'cuso4_inert', label: 'Điện phân CuSO₄ (Anot Graphit trơ)' },
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
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Bán pin trái (Điện cực 1)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ELECTRODE_METALS.map((m, idx) => (
                    <button
                      key={m.symbol}
                      type="button"
                      onClick={() => setGalvLeftIdx(idx)}
                      className={`py-1.5 rounded-lg border font-bold cursor-pointer ${
                        galvLeftIdx === idx
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {m.symbol} ({m.e0 > 0 ? `+${m.e0}` : m.e0}V)
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Bán pin phải (Điện cực 2)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ELECTRODE_METALS.map((m, idx) => (
                    <button
                      key={m.symbol}
                      type="button"
                      onClick={() => setGalvRightIdx(idx)}
                      className={`py-1.5 rounded-lg border font-bold cursor-pointer ${
                        galvRightIdx === idx
                          ? 'bg-sky-50 border-sky-300 text-sky-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {m.symbol} ({m.e0 > 0 ? `+${m.e0}` : m.e0}V)
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
              <ChemSlider
                label="Nhiệt độ đun cách thủy"
                valueDisplay={`${esterTempC} °C`}
                min={30}
                max={95}
                step={5}
                value={esterTempC}
                onChange={setEsterTempC}
              />
              {esterMode === 'esterification' ? (
                <>
                  <ChemSlider
                    label="Tỉ lệ mol Ethanol / Acetic acid"
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
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={soapSaltOut}
                      onChange={(e) => setSoapSaltOut(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span className="font-semibold text-slate-700">Thêm dung dịch NaCl bão hòa (tách lớp)</span>
                  </label>
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
                    ? 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O   (H₂SO₄ đặc, t°)'
                    : '(RCOO)₃C₃H₅ + 3NaOH → 3RCOONa + C₃H₅(OH)₃   (t°)'}
                </p>
                <p className="text-slate-600 flex items-start gap-1.5">
                  <Info size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    {esterMode === 'esterification'
                      ? 'Phản ứng ester hóa (Hóa 12) là thuận nghịch. Dùng H₂SO₄ đặc xúc tác + hút nước và lấy dư ethanol giúp tăng hiệu suất; hứng vào NaCl bão hòa để tách lớp ethyl acetate.'
                      : 'Phản ứng xà phòng hóa xảy ra một chiều trong kiềm nóng. Thêm NaCl bão hòa làm muối sodium/potassium của acid béo tách nổi lên thành lớp xà phòng.'}
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Flame,
  Zap,
  Thermometer,
} from 'lucide-react';

export type AdditionalChemModuleId =
  | 'electrolysis'
  | 'galvanic_cell'
  | 'reaction_rate'
  | 'redox_flame'
  | 'ester_lab'
  | 'thermochemistry'
  | 'oxygen_prep';

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

// Data for Galvanic Cell
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

// Data for Flame Test
interface FlameIon {
  id: string;
  ion: string;
  salt: string;
  flameColor: string;
  glowColor: string;
  wavelengthNm: string;
  colorName: string;
}

const FLAME_IONS: FlameIon[] = [
  { id: 'Li', ion: 'Li⁺', salt: 'LiCl', flameColor: '#E11D48', glowColor: 'rgba(225, 29, 72, 0.55)', wavelengthNm: '671 nm', colorName: 'Đỏ tía (Crimson)' },
  { id: 'Na', ion: 'Na⁺', salt: 'NaCl', flameColor: '#FACC15', glowColor: 'rgba(250, 204, 21, 0.65)', wavelengthNm: '589 nm', colorName: 'Vàng rực' },
  { id: 'K', ion: 'K⁺', salt: 'KCl', flameColor: '#C084FC', glowColor: 'rgba(192, 132, 252, 0.55)', wavelengthNm: '766 / 404 nm', colorName: 'Tím hoa cà' },
  { id: 'Ca', ion: 'Ca²⁺', salt: 'CaCl₂', flameColor: '#FB923C', glowColor: 'rgba(251, 146, 60, 0.60)', wavelengthNm: '622 nm', colorName: 'Đỏ cam' },
  { id: 'Cu', ion: 'Cu²⁺', salt: 'CuCl₂', flameColor: '#10B981', glowColor: 'rgba(16, 185, 129, 0.58)', wavelengthNm: '510 nm', colorName: 'Xanh lục lam' },
  { id: 'Ba', ion: 'Ba²⁺', salt: 'BaCl₂', flameColor: '#A3E635', glowColor: 'rgba(163, 230, 53, 0.58)', wavelengthNm: '524 nm', colorName: 'Vàng lục' },
];

// Data for Redox test-tube experiments
interface RedoxReaction {
  id: string;
  title: string;
  reagents: string;
  initialLiquid: string;
  finalLiquid: string;
  gasColor: string | null;
  gasFormula: string | null;
  depositColor: string | null;
  phenomenon: string;
  equation: string;
}

const REDOX_REACTIONS: RedoxReaction[] = [
  {
    id: 'fe_cuso4',
    title: 'Fe + CuSO₄',
    reagents: 'Đinh sắt vào dung dịch CuSO₄ (xanh lam)',
    initialLiquid: 'rgba(56, 189, 248, 0.55)',
    finalLiquid: 'rgba(134, 239, 172, 0.45)',
    gasColor: null,
    gasFormula: null,
    depositColor: '#B45309',
    phenomenon: 'Lớp đồng đỏ bám ngoài đinh sắt; màu xanh lam của CuSO₄ nhạt dần chuyển sang lục nhạt (FeSO₄).',
    equation: 'Fe + CuSO₄ → FeSO₄ + Cu ↓',
  },
  {
    id: 'cu_hno3',
    title: 'Cu + HNO₃ đặc',
    reagents: 'Mảnh đồng vào dung dịch HNO₃ đặc',
    initialLiquid: 'rgba(226, 232, 240, 0.45)',
    finalLiquid: 'rgba(14, 165, 233, 0.62)',
    gasColor: 'rgba(180, 83, 9, 0.72)',
    gasFormula: 'NO₂ ↑ (nâu đỏ)',
    depositColor: null,
    phenomenon: 'Đồng tan nhanh, dung dịch hóa xanh lam Cu(NO₃)₂ và sủi bọt khí NO₂ màu nâu đỏ bay ra mạnh.',
    equation: 'Cu + 4HNO₃ (đặc) → Cu(NO₃)₂ + 2NO₂ ↑ + 2H₂O',
  },
  {
    id: 'kmno4_hcl',
    title: 'KMnO₄ + HCl đặc',
    reagents: 'Tinh thể KMnO₄ tím đen + HCl đặc',
    initialLiquid: 'rgba(147, 51, 234, 0.68)',
    finalLiquid: 'rgba(254, 243, 199, 0.45)',
    gasColor: 'rgba(163, 230, 53, 0.65)',
    gasFormula: 'Cl₂ ↑ (vàng lục)',
    depositColor: null,
    phenomenon: 'Dung dịch mất màu tím chuyển gần như không màu (MnCl₂) và giải phóng khí Cl₂ màu vàng lục mùi hắc.',
    equation: '2KMnO₄ + 16HCl (đặc) → 2KCl + 2MnCl₂ + 5Cl₂ ↑ + 8H₂O',
  },
  {
    id: 'kmno4_feso4',
    title: 'KMnO₄ + FeSO₄ + H₂SO₄',
    reagents: 'Nhỏ KMnO₄ vào hỗn hợp FeSO₄ / H₂SO₄ loãng',
    initialLiquid: 'rgba(168, 85, 247, 0.65)',
    finalLiquid: 'rgba(254, 240, 138, 0.35)',
    gasColor: null,
    gasFormula: null,
    depositColor: null,
    phenomenon: 'Màu tím của MnO₄⁻ bị khử hoàn toàn mất màu ngay lập tức, dung dịch có màu vàng nhạt của Fe³⁺.',
    equation: '10FeSO₄ + 2KMnO₄ + 8H₂SO₄ → 5Fe₂(SO₄)₃ + K₂SO₄ + 2MnSO₄ + 8H₂O',
  },
];

// Data for Thermochemistry
interface ThermoReaction {
  id: string;
  label: string;
  type: 'exo' | 'endo';
  deltaH: number; // kJ/mol
  targetTempC: number;
  liquidColor: string;
  equation: string;
  explanation: string;
}

const THERMO_REACTIONS: ThermoReaction[] = [
  {
    id: 'neutralization',
    label: 'HCl + NaOH (Trung hòa)',
    type: 'exo',
    deltaH: -57.3,
    targetTempC: 39.5,
    liquidColor: 'rgba(251, 146, 60, 0.25)',
    equation: 'HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)   ΔH° = -57,3 kJ',
    explanation: 'Phản ứng trung hòa giải phóng nhiệt lượng ra môi trường làm nhiệt độ dung dịch tăng lên rõ rệt.',
  },
  {
    id: 'cao_water',
    label: 'CaO + H₂O (Tôi vôi)',
    type: 'exo',
    deltaH: -65.2,
    targetTempC: 68.0,
    liquidColor: 'rgba(226, 232, 240, 0.72)',
    equation: 'CaO(s) + H₂O(l) → Ca(OH)₂(aq)   ΔH° = -65,2 kJ',
    explanation: 'Quá trình tôi vôi tỏa nhiệt cực mạnh, nước trong nhiệt lượng kế nóng bốc hơi nhanh chóng.',
  },
  {
    id: 'nh4no3_dissolve',
    label: 'Hòa tan NH₄NO₃ trong H₂O',
    type: 'endo',
    deltaH: +25.7,
    targetTempC: 7.5,
    liquidColor: 'rgba(186, 230, 253, 0.48)',
    equation: 'NH₄NO₃(s) + aq → NH₄⁺(aq) + NO₃⁻(aq)   ΔH° = +25,7 kJ',
    explanation: 'Quá trình phá vỡ mạng tinh thể hấp thụ nhiệt từ nước làm dung dịch lạnh đi nhanh (ứng dụng túi chườm lạnh).',
  },
  {
    id: 'baoh2_nh4cl',
    label: 'Ba(OH)₂·8H₂O + 2NH₄Cl',
    type: 'endo',
    deltaH: +80.3,
    targetTempC: -6.0,
    liquidColor: 'rgba(125, 211, 252, 0.55)',
    equation: 'Ba(OH)₂·8H₂O + 2NH₄Cl → BaCl₂ + 2NH₃ ↑ + 10H₂O   ΔH° > 0',
    explanation: 'Phản ứng thu nhiệt rất mạnh khiến nhiệt độ hỗn hợp giảm xuống dưới 0°C, có thể làm đóng băng giọt nước dưới đáy cốc!',
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
  // 1. ĐIỆN PHÂN DUNG DỊCH & MẠ ĐIỆN (ELECTROLYSIS)
  // ===========================================================================
  const [elecSystem, setElecSystem] = useState<'cuso4_inert' | 'cuso4_cu' | 'nacl_membrane' | 'agno3_inert'>('cuso4_inert');
  const [elecCurrentA, setElecCurrentA] = useState<number>(4.0); // A
  const [elecTimeMin, setElecTimeMin] = useState<number>(0); // 0..60 min animated
  const elecStateRef = useRef({ elapsedMin: 0, t: 0 });

  const elecCalc = useMemo(() => {
    const tSec = elecTimeMin * 60;
    const F = 96485;
    const nMolE = (elecCurrentA * tSec) / F;
    let cathodeMassG = 0;
    let anodeGasL = 0;
    let cathodeGasL = 0;
    let cathodeEq = '';
    let anodeEq = '';
    let overallEq = '';
    let phenomenon = '';

    if (elecSystem === 'cuso4_inert') {
      cathodeMassG = (64 * nMolE) / 2;
      anodeGasL = (nMolE / 4) * 24.79;
      cathodeEq = 'Cu²⁺ + 2e → Cu ↓ (bám đỏ lên Catot)';
      anodeEq = '2H₂O → O₂ ↑ + 4H⁺ + 4e (sủi bọt khí)';
      overallEq = '2CuSO₄ + 2H₂O → 2Cu ↓ + O₂ ↑ + 2H₂SO₄';
      phenomenon = 'Catot có lớp đồng đỏ bám vào; Anot sủi bọt khí O₂; màu xanh dung dịch nhạt dần và pH giảm.';
    } else if (elecSystem === 'cuso4_cu') {
      cathodeMassG = (64 * nMolE) / 2;
      cathodeEq = 'Cu²⁺ + 2e → Cu ↓ (mạ đồng lên Catot)';
      anodeEq = 'Cu → Cu²⁺ + 2e (Anot đồng tan dần)';
      overallEq = 'Anot Cu tan → Ion Cu²⁺ di chuyển sang Catot (nồng độ không đổi)';
      phenomenon = 'Ứng dụng mạ đồng / tinh chế đồng: khối lượng Catot tăng đúng bằng khối lượng Anot bị hòa tan.';
    } else if (elecSystem === 'nacl_membrane') {
      cathodeGasL = (nMolE / 2) * 24.79;
      anodeGasL = (nMolE / 2) * 24.79;
      cathodeEq = '2H₂O + 2e → H₂ ↑ + 2OH⁻ (hóa hồng phenolphtalein)';
      anodeEq = '2Cl⁻ → Cl₂ ↑ + 2e (khí vàng lục)';
      overallEq = '2NaCl + 2H₂O —(đpmn)→ 2NaOH + H₂ ↑ + Cl₂ ↑';
      phenomenon = 'Catot sủi khí H₂ và dung dịch chuyển hồng (sinh NaOH); Anot sủi khí Cl₂ vàng lục.';
    } else {
      cathodeMassG = 108 * nMolE;
      anodeGasL = (nMolE / 4) * 24.79;
      cathodeEq = 'Ag⁺ + 1e → Ag ↓ (mạ bạc trắng sáng)';
      anodeEq = '2H₂O → O₂ ↑ + 4H⁺ + 4e';
      overallEq = '4AgNO₃ + 2H₂O → 4Ag ↓ + O₂ ↑ + 4HNO₃';
      phenomenon = 'Lớp bạc trắng bóng bám lên Catot; Anot than chì sủi bọt khí O₂ không màu.';
    }
    return { nMolE, cathodeMassG, anodeGasL, cathodeGasL, cathodeEq, anodeEq, overallEq, phenomenon };
  }, [elecSystem, elecCurrentA, elecTimeMin]);

  // ===========================================================================
  // 2. PIN ĐIỆN HÓA (GALVANIC CELL)
  // ===========================================================================
  const [galvLeftIdx, setGalvLeftIdx] = useState<number>(1); // Zn
  const [galvRightIdx, setGalvRightIdx] = useState<number>(4); // Cu
  const [galvConcLeft, setGalvConcLeft] = useState<number>(1.0); // M
  const [galvConcRight, setGalvConcRight] = useState<number>(1.0); // M
  const galvStateRef = useRef({ t: 0 });

  const galvCalc = useMemo(() => {
    const leftM = ELECTRODE_METALS[galvLeftIdx];
    const rightM = ELECTRODE_METALS[galvRightIdx];
    const eLeft = leftM.e0 + (0.0592 / leftM.n) * Math.log10(galvConcLeft);
    const eRight = rightM.e0 + (0.0592 / rightM.n) * Math.log10(galvConcRight);
    const leftIsAnode = eLeft <= eRight;
    const anode = leftIsAnode ? leftM : rightM;
    const cathode = leftIsAnode ? rightM : leftM;
    const eCell = Math.abs(eRight - eLeft);
    return { leftM, rightM, eLeft, eRight, leftIsAnode, anode, cathode, eCell };
  }, [galvLeftIdx, galvRightIdx, galvConcLeft, galvConcRight]);

  // ===========================================================================
  // 3. TỐC ĐỘ PHẢN ỨNG & XÚC TÁC (REACTION RATE)
  // ===========================================================================
  const [rateSubMode, setRateSubMode] = useState<'cross_x' | 'collision'>('cross_x');
  const [rateConcM, setRateConcM] = useState<number>(0.4); // M
  const [rateTempC, setRateTempC] = useState<number>(25); // C
  const [rateCatalyst, setRateCatalyst] = useState<boolean>(false);
  const [rateSurfaceFine, setRateSurfaceFine] = useState<boolean>(false);
  const rateStateRef = useRef({
    t: 0,
    turbidity: 0, // 0..1
    finished: false,
    crossTimeS: 0,
    particles: Array.from({ length: 32 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      reacted: false,
    })),
  });
  const [rateReadout, setRateReadout] = useState({ turbidityPct: 0, elapsedS: 0, done: false });

  const rateFactor = useMemo(() => {
    const tempFactor = Math.pow(2.0, (rateTempC - 25) / 10);
    const concFactor = rateConcM / 0.4;
    const catFactor = rateCatalyst ? 2.1 : 1.0;
    const surfFactor = rateSurfaceFine && rateSubMode === 'collision' ? 1.5 : 1.0;
    return tempFactor * concFactor * catFactor * surfFactor;
  }, [rateTempC, rateConcM, rateCatalyst, rateSurfaceFine, rateSubMode]);

  const resetRate = () => {
    rateStateRef.current = {
      t: 0,
      turbidity: 0,
      finished: false,
      crossTimeS: 0,
      particles: Array.from({ length: 32 }, () => ({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        reacted: false,
      })),
    };
    setRateReadout({ turbidityPct: 0, elapsedS: 0, done: false });
  };

  useEffect(() => {
    resetRate();
  }, [rateSubMode, rateConcM, rateTempC, rateCatalyst, rateSurfaceFine]);

  // ===========================================================================
  // 4. THỬ NGỌN LỬA & OXI HÓA - KHỬ (REDOX & FLAME)
  // ===========================================================================
  const [redoxSubMode, setRedoxSubMode] = useState<'flame' | 'test_tube'>('flame');
  const [flameIonId, setFlameIonId] = useState<string>('Na');
  const [redoxRxnId, setRedoxRxnId] = useState<string>('fe_cuso4');
  const [redoxDropped, setRedoxDropped] = useState<boolean>(false);
  const redoxStateRef = useRef({ t: 0, progress: 0 });

  const activeFlameIon = useMemo(
    () => FLAME_IONS.find((f) => f.id === flameIonId) || FLAME_IONS[1],
    [flameIonId]
  );
  const activeRedox = useMemo(
    () => REDOX_REACTIONS.find((r) => r.id === redoxRxnId) || REDOX_REACTIONS[0],
    [redoxRxnId]
  );

  // ===========================================================================
  // 5. ESTE HÓA & XÀ PHÒNG HÓA (ESTER LAB)
  // ===========================================================================
  const [esterMode, setEsterMode] = useState<'esterification' | 'saponification'>('esterification');
  const [esterTempC, setEsterTempC] = useState<number>(70); // C
  const [esterCatH2SO4, setEsterCatH2SO4] = useState<boolean>(true);
  const [esterMoleRatio, setEsterMoleRatio] = useState<number>(1.5); // Ancol / Acid
  const [soapAlkali, setSoapAlkali] = useState<'NaOH' | 'KOH'>('NaOH');
  const [soapSaltOut, setSoapSaltOut] = useState<boolean>(false);
  const esterStateRef = useRef({ t: 0, yieldFrac: 0 });
  const [esterReadout, setEsterReadout] = useState({ yieldPct: 0 });

  const esterMaxYield = useMemo(() => {
    if (esterMode === 'esterification') {
      // Equilibrium K=4 for CH3COOH + C2H5OH <-> Ester + H2O
      const k = 4.0;
      const r = esterMoleRatio;
      // (k-1)x^2 - k(1+r)x + kr = 0
      const a = k - 1;
      const b = -k * (1 + r);
      const c = k * r;
      const disc = Math.sqrt(Math.max(0, b * b - 4 * a * c));
      const x = ( -b - disc ) / (2 * a);
      return Math.min(96, Math.max(20, x * 100));
    }
    return 95;
  }, [esterMode, esterMoleRatio]);

  // ===========================================================================
  // 6. NHIỆT HÓA HỌC (THERMOCHEMISTRY)
  // ===========================================================================
  const [thermoId, setThermoId] = useState<string>('neutralization');
  const [thermoStarted, setThermoStarted] = useState<boolean>(false);
  const thermoStateRef = useRef({
    t: 0,
    tempC: 25.0,
    history: [{ t: 0, tempC: 25.0 }] as { t: number; tempC: number }[],
  });
  const [thermoReadout, setThermoReadout] = useState({ tempC: 25.0, qKj: 0 });

  const activeThermo = useMemo(
    () => THERMO_REACTIONS.find((x) => x.id === thermoId) || THERMO_REACTIONS[0],
    [thermoId]
  );

  const resetThermo = () => {
    setThermoStarted(false);
    thermoStateRef.current = { t: 0, tempC: 25.0, history: [{ t: 0, tempC: 25.0 }] };
    setThermoReadout({ tempC: 25.0, qKj: 0 });
  };

  useEffect(() => {
    resetThermo();
  }, [thermoId]);

  // ===========================================================================
  // 7. ĐIỀU CHẾ KHÍ OXI (O2) TRONG PHÒNG THÍ NGHIỆM
  // ===========================================================================
  const [o2Method, setO2Method] = useState<'kmno4' | 'kclo3' | 'h2o2'>('kmno4');
  const [o2CollectMethod, setO2CollectMethod] = useState<'water' | 'air'>('water');
  const [o2BurnerOn, setO2BurnerOn] = useState<boolean>(true);
  const [o2CatalystMnO2, setO2CatalystMnO2] = useState<boolean>(true);
  const [o2ReactantMassG, setO2ReactantMassG] = useState<number>(15.8); // g (hoặc g chất tan)
  const [o2TestSplint, setO2TestSplint] = useState<boolean>(false);

  const o2Calc = useMemo(() => {
    let nO2Max = 0;
    let eq = '';
    let note = '';
    let rateMul = 1.0;

    if (o2Method === 'kmno4') {
      // 2 KMnO4 (158) -> K2MnO4 + MnO2 + O2
      nO2Max = (o2ReactantMassG / 158) * 0.5;
      eq = '2KMnO₄ —(t°)→ K₂MnO₄ + MnO₂ + O₂ ↑';
      note = 'Ống nghiệm hơi chúc miệng xuống để tránh hơi nước đọng làm vỡ ống; bông gòn ngăn bụi KMnO₄.';
      rateMul = o2BurnerOn ? 1.0 : 0;
    } else if (o2Method === 'kclo3') {
      // 2 KClO3 (122.5) -> 2 KCl + 3 O2
      nO2Max = (o2ReactantMassG / 122.5) * 1.5;
      eq = o2CatalystMnO2
        ? '2KClO₃ —(MnO₂, t°)→ 2KCl + 3O₂ ↑'
        : '2KClO₃ —(t° cao)→ 2KCl + 3O₂ ↑';
      note = o2CatalystMnO2
        ? 'Xúc tác MnO₂ hạ nhiệt độ phân hủy KClO₃ từ ~400°C xuống ~200°C, khí O₂ thoát ra rất nhanh.'
        : 'Không có xúc tác MnO₂, KClO₃ phân hủy rất chậm và cần nhiệt độ cao hơn.';
      rateMul = o2BurnerOn ? (o2CatalystMnO2 ? 1.45 : 0.35) : 0;
    } else {
      // 2 H2O2 (34) -> 2 H2O + O2
      nO2Max = (o2ReactantMassG / 34) * 0.5;
      eq = '2H₂O₂ —(MnO₂)→ 2H₂O + O₂ ↑';
      note = 'Không cần đun nóng! Nhỏ dung dịch H₂O₂ lên bột xúc tác MnO₂, khí O₂ thoát ra ngay ở nhiệt độ phòng.';
      rateMul = o2CatalystMnO2 ? 1.3 : 0.08;
    }

    const vO2MaxL = nO2Max * 24.79; // đkc
    return { nO2Max, vO2MaxL, eq, note, rateMul };
  }, [o2Method, o2ReactantMassG, o2BurnerOn, o2CatalystMnO2]);

  const o2StateRef = useRef({
    t: 0,
    progress: 0, // 0..1
  });
  const [o2Readout, setO2Readout] = useState({ progressPct: 0, collectedL: 0 });

  const resetOxygenPrep = () => {
    setO2TestSplint(false);
    o2StateRef.current = { t: 0, progress: 0 };
    setO2Readout({ progressPct: 0, collectedL: 0 });
  };

  useEffect(() => {
    resetOxygenPrep();
  }, [o2Method, o2CollectMethod, o2ReactantMassG]);

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

      // 1. ELECTROLYSIS
      if (moduleId === 'electrolysis' && canvasRef.current) {
        const st = elecStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (st.elapsedMin < 45) {
            st.elapsedMin = Math.min(45, st.elapsedMin + dt * 1.4);
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
        if (dt > 0) st.t += dt;
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawGalvanicCell(setup.ctx, setup.w, setup.h, st.t);
      }

      // 3. REACTION RATE
      if (moduleId === 'reaction_rate' && canvasRef.current) {
        const st = rateStateRef.current;
        if (dt > 0) {
          if (rateSubMode === 'cross_x') {
            if (!st.finished) {
              st.t += dt;
              st.turbidity = Math.min(1, st.turbidity + dt * 0.095 * rateFactor);
              if (st.turbidity >= 1) {
                st.finished = true;
                st.crossTimeS = st.t;
              }
            }
          } else {
            st.t += dt;
            const spd = 0.025 * (1 + (rateTempC - 10) / 30);
            const activeCount = Math.max(8, Math.min(32, Math.round((rateConcM / 1.0) * 32)));
            st.particles.slice(0, activeCount).forEach((p) => {
              p.x += p.vx * spd;
              p.y += p.vy * spd;
              if (p.x < 0.04 || p.x > 0.96) p.vx *= -1;
              if (p.y < 0.06 || p.y > 0.94) p.vy *= -1;
              p.x = Math.max(0.04, Math.min(0.96, p.x));
              p.y = Math.max(0.06, Math.min(0.94, p.y));
            });
          }
          uiTimer += rawDt;
          if (uiTimer >= 0.08) {
            uiTimer = 0;
            setRateReadout({
              turbidityPct: Math.round(st.turbidity * 100),
              elapsedS: st.finished ? st.crossTimeS : st.t,
              done: st.finished,
            });
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawReactionRate(setup.ctx, setup.w, setup.h, st);
      }

      // 4. REDOX & FLAME
      if (moduleId === 'redox_flame' && canvasRef.current) {
        const st = redoxStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (redoxSubMode === 'test_tube' && redoxDropped) {
            st.progress = Math.min(1, st.progress + dt * 0.28);
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawRedoxFlame(setup.ctx, setup.w, setup.h, st);
      }

      // 5. ESTER LAB
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

      // 6. THERMOCHEMISTRY
      if (moduleId === 'thermochemistry' && canvasRef.current) {
        const st = thermoStateRef.current;
        if (dt > 0 && thermoStarted) {
          st.t += dt;
          st.tempC += (activeThermo.targetTempC - st.tempC) * Math.min(1, dt * 0.65);
          if (st.history.length === 0 || st.t - st.history[st.history.length - 1].t > 0.15) {
            st.history.push({ t: st.t, tempC: st.tempC });
            if (st.history.length > 160) st.history.shift();
          }
          uiTimer += rawDt;
          if (uiTimer >= 0.08) {
            uiTimer = 0;
            // Q = m * c * dT (for 100g aqueous solution, c = 4.18 J/g.K)
            const qKj = (100 * 4.18 * (st.tempC - 25.0)) / 1000;
            setThermoReadout({ tempC: st.tempC, qKj });
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawThermoCanvas(setup.ctx, setup.w, setup.h, st);
      }

      // 7. OXYGEN LAB PREPARATION
      if (moduleId === 'oxygen_prep' && canvasRef.current) {
        const st = o2StateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (o2Calc.rateMul > 0 && st.progress < 1) {
            st.progress = Math.min(1, st.progress + dt * 0.095 * o2Calc.rateMul);
          }
          uiTimer += rawDt;
          if (uiTimer >= 0.08) {
            uiTimer = 0;
            setO2Readout({
              progressPct: Math.round(st.progress * 100),
              collectedL: o2Calc.vO2MaxL * st.progress,
            });
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawOxygenPrep(setup.ctx, setup.w, setup.h, st);
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
    const bW = Math.min(340, w * 0.56);
    const bH = h * 0.54;
    const liqH = bH * 0.78;
    const progress = Math.min(1, elecStateRef.current.elapsedMin / 45);

    // Electrolyte solution color
    let liqColor = 'rgba(56, 189, 248, 0.42)';
    if (elecSystem === 'cuso4_inert') {
      const alpha = Math.max(0.08, 0.48 * (1 - progress * 0.8));
      liqColor = `rgba(56, 189, 248, ${alpha})`;
    } else if (elecSystem === 'cuso4_cu') {
      liqColor = 'rgba(56, 189, 248, 0.44)';
    } else if (elecSystem === 'nacl_membrane') {
      liqColor = 'rgba(226, 232, 240, 0.45)';
    } else {
      liqColor = 'rgba(241, 245, 249, 0.5)';
    }

    ctx.fillStyle = liqColor;
    ctx.fillRect(bx - bW / 2, bBottom - liqH, bW, liqH);

    // In NaCl with membrane: pink phenolphthalein halo near Cathode (left) & green Cl2 tint near Anode (right)
    if (elecSystem === 'nacl_membrane') {
      ctx.fillStyle = `rgba(219, 39, 119, ${Math.min(0.42, 0.08 + progress * 0.36)})`;
      ctx.fillRect(bx - bW / 2, bBottom - liqH, bW / 2, liqH);
      // Membrane dashed divider
      ctx.strokeStyle = '#64748B';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, bBottom - liqH);
      ctx.lineTo(bx, bBottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cathode (left, -) and Anode (right, +)
    const catX = bx - bW * 0.27;
    const anoX = bx + bW * 0.27;
    const elecTop = bBottom - bH + 10;
    const elecBot = bBottom - 22;

    // Anode thickness (shrinks if Cu dissolving!)
    const anoThick = elecSystem === 'cuso4_cu' ? Math.max(6, 18 - progress * 10) : 16;
    ctx.fillStyle = elecSystem === 'cuso4_cu' ? '#B45309' : '#334155';
    ctx.fillRect(anoX - anoThick / 2, elecTop, anoThick, elecBot - elecTop);

    // Cathode core + plating layer
    ctx.fillStyle = '#334155';
    ctx.fillRect(catX - 8, elecTop, 16, elecBot - elecTop);
    if (elecSystem === 'cuso4_inert' || elecSystem === 'cuso4_cu' || elecSystem === 'agno3_inert') {
      const coatW = progress * 8;
      if (coatW > 0.3) {
        ctx.fillStyle = elecSystem === 'agno3_inert' ? '#E2E8F0' : '#D97706';
        ctx.fillRect(catX - 8 - coatW, elecTop + 36, 16 + coatW * 2, elecBot - elecTop - 36);
      }
    }

    // Bubbles on Anode (O2 or Cl2) and Cathode (H2 for NaCl)
    const bubbleCount = Math.min(18, Math.round(elecCurrentA * 1.8));
    if (elecSystem !== 'cuso4_cu') {
      const gasColor = elecSystem === 'nacl_membrane' ? 'rgba(163, 230, 53, 0.85)' : 'rgba(255, 255, 255, 0.85)';
      ctx.fillStyle = gasColor;
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < bubbleCount; i++) {
        const yOff = ((t * 55 + i * 27) % (liqH - 30));
        const by = bBottom - 26 - yOff;
        const bxPos = anoX + Math.sin(t * 4 + i) * 14;
        ctx.beginPath();
        ctx.arc(bxPos, by, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (elecSystem === 'nacl_membrane') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.strokeStyle = '#64748B';
      for (let i = 0; i < bubbleCount; i++) {
        const yOff = ((t * 62 + i * 23) % (liqH - 30));
        const by = bBottom - 26 - yOff;
        const bxPos = catX + Math.cos(t * 4 + i) * 14;
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

    // DC box
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(bx - 34, topWireY - 14, 68, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(`− DC +`, bx - 22, topWireY + 4);

    // Electron arrow
    drawArrow(ctx, bx - 68, topWireY - 14, catX + 18, topWireY - 14, '#0284C7', 'e⁻');

    // Beaker outline
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx - bW / 2, bBottom - bH, bW, bH);

    // Labels
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText('Catot (−)', catX - 24, bBottom + 20);
    ctx.fillText('Anot (+)', anoX - 22, bBottom + 20);
  };

  const drawGalvanicCell = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const b1x = w * 0.28;
    const b2x = w * 0.72;
    const bBottom = h * 0.85;
    const bW = Math.min(160, w * 0.26);
    const bH = h * 0.48;
    const liqH = bH * 0.74;

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

      // Electrode bar
      ctx.fillStyle = cell.m.color;
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.fillRect(cell.x - 12, bBottom - bH - 12, 24, bH - 8);
      ctx.strokeRect(cell.x - 12, bBottom - bH - 12, 24, bH - 8);

      ctx.fillStyle = '#0F172A';
      ctx.font = '800 12px ui-sans-serif, sans-serif';
      ctx.fillText(`${cell.m.symbol} (${cell.isAnode ? 'Anot −' : 'Catot +'})`, cell.x - 36, bBottom + 20);
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`[${cell.m.ion}] = ${cell.conc.toFixed(2)}M`, cell.x - 42, bBottom + 36);
    });

    // Salt bridge (U-tube connecting both beakers)
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
        const frac = ((t * 0.45 + i / 6) % 1);
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

  const drawReactionRate = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    st: typeof rateStateRef.current
  ) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    if (rateSubMode === 'cross_x') {
      // Top-down / angled view of flask over X mark
      const cx = w * 0.34;
      const cy = h * 0.52;
      const r = Math.min(w * 0.22, h * 0.32);

      // White paper under flask with bold black X
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw X mark underneath
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.45, cy + r * 0.45);
      ctx.moveTo(cx + r * 0.45, cy - r * 0.45);
      ctx.lineTo(cx - r * 0.45, cy + r * 0.45);
      ctx.stroke();

      // Sulfur turbidity overlay progressively obscures X
      ctx.fillStyle = `rgba(254, 240, 138, ${Math.min(0.97, st.turbidity * 0.98)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText('Nhìn từ trên xuống đáy bình tam giác', cx - 102, cy + r + 38);

      // Right side: Reaction progress bar + Ea energy profile
      const gx = w * 0.62;
      const gy = 54;
      const gw = w * 0.32;
      const gh = h * 0.54;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeRect(gx, gy, gw, gh);

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('Giản đồ năng lượng hoạt hóa Ea', gx + 10, gy + 20);

      // Uncatalyzed curve
      ctx.strokeStyle = '#94A3B8';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx + 16, gy + gh * 0.52);
      ctx.bezierCurveTo(gx + gw * 0.35, gy + gh * 0.52, gx + gw * 0.42, gy + gh * 0.16, gx + gw * 0.55, gy + gh * 0.16);
      ctx.bezierCurveTo(gx + gw * 0.68, gy + gh * 0.16, gx + gw * 0.75, gy + gh * 0.72, gx + gw - 16, gy + gh * 0.72);
      ctx.stroke();
      ctx.setLineDash([]);

      // Catalyzed curve if active
      if (rateCatalyst) {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(gx + 16, gy + gh * 0.52);
        ctx.bezierCurveTo(gx + gw * 0.35, gy + gh * 0.52, gx + gw * 0.42, gy + gh * 0.34, gx + gw * 0.55, gy + gh * 0.34);
        ctx.bezierCurveTo(gx + gw * 0.68, gy + gh * 0.34, gx + gw * 0.75, gy + gh * 0.72, gx + gw - 16, gy + gh * 0.72);
        ctx.stroke();
        ctx.fillStyle = '#059669';
        ctx.font = '700 10px ui-sans-serif, sans-serif';
        ctx.fillText('Có xúc tác (hạ thấp Ea)', gx + 14, gy + gh - 14);
      }
    } else {
      // Molecular collision box
      const boxX = 32;
      const boxY = 44;
      const boxW = w - 64;
      const boxH = h - 90;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      const activeCount = Math.max(8, Math.min(32, Math.round((rateConcM / 1.0) * 32)));
      st.particles.slice(0, activeCount).forEach((p, idx) => {
        const px = boxX + p.x * boxW;
        const py = boxY + p.y * boxH;
        const isA = idx % 2 === 0;
        ctx.fillStyle = isA ? '#0284C7' : '#D97706';
        ctx.beginPath();
        ctx.arc(px, py, rateSurfaceFine ? 5 : 8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(
        `Số phân tử: ${activeCount} · Nhiệt độ: ${rateTempC}°C · Tốc độ phản ứng tương đối: ×${rateFactor.toFixed(2)}`,
        boxX,
        28
      );
      ctx.fillStyle = '#475569';
      ctx.font = '600 11px ui-sans-serif, sans-serif';
      ctx.fillText(
        'Tăng nhiệt độ, nồng độ, chia nhỏ hạt hoặc thêm xúc tác làm tăng số va chạm hiệu quả/giây.',
        boxX,
        boxY + boxH + 22
      );
    }
  };

  const drawRedoxFlame = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    st: typeof redoxStateRef.current
  ) => {
    if (redoxSubMode === 'flame') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const burnerY = h * 0.84;

      // Bunsen burner tube & base
      ctx.fillStyle = '#475569';
      ctx.fillRect(cx - 46, burnerY, 92, 14);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(cx - 12, burnerY - 96, 24, 96);

      // Flame inner blue cone + outer ion colored flame
      const flicker = Math.sin(st.t * 14) * 5;
      const topY = burnerY - 235 + flicker;
      const grad = ctx.createRadialGradient(cx, burnerY - 150, 8, cx, burnerY - 150, 95);
      grad.addColorStop(0, activeFlameIon.flameColor);
      grad.addColorStop(0.55, activeFlameIon.glowColor);
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, burnerY - 155, 95, 0, Math.PI * 2);
      ctx.fill();

      // Flame teardrop shape
      ctx.fillStyle = activeFlameIon.flameColor;
      ctx.beginPath();
      ctx.moveTo(cx - 16, burnerY - 96);
      ctx.quadraticCurveTo(cx - 34, burnerY - 150, cx, topY);
      ctx.quadraticCurveTo(cx + 34, burnerY - 150, cx + 16, burnerY - 96);
      ctx.closePath();
      ctx.fill();

      // Hot blue inner core
      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.beginPath();
      ctx.moveTo(cx - 8, burnerY - 96);
      ctx.quadraticCurveTo(cx - 14, burnerY - 125, cx, burnerY - 152);
      ctx.quadraticCurveTo(cx + 14, burnerY - 125, cx + 8, burnerY - 96);
      ctx.closePath();
      ctx.fill();

      // Platinum wire loop held into flame
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + 115, burnerY - 110);
      ctx.lineTo(cx + 8, burnerY - 146);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 2, burnerY - 148, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 14px ui-sans-serif, sans-serif';
      ctx.fillText(`Thử màu ngọn lửa muối ${activeFlameIon.salt} (${activeFlameIon.ion})`, 20, 30);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '600 12px ui-sans-serif, sans-serif';
      ctx.fillText(`Màu đặc trưng: ${activeFlameIon.colorName} · Bước sóng trội λ ≈ ${activeFlameIon.wavelengthNm}`, 20, 52);
    } else {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const bBottom = h * 0.86;
      const tubeW = 76;
      const tubeH = h * 0.56;
      const liqH = tubeH * 0.65;
      const p = redoxDropped ? st.progress : 0;

      // Liquid color transition
      ctx.fillStyle = p > 0.25 ? activeRedox.finalLiquid : activeRedox.initialLiquid;
      ctx.beginPath();
      ctx.roundRect(cx - tubeW / 2, bBottom - liqH, tubeW, liqH, [0, 0, 38, 38]);
      ctx.fill();

      // Deposit / metal strip if Fe + CuSO4
      if (activeRedox.id === 'fe_cuso4' && redoxDropped) {
        ctx.fillStyle = p > 0.3 ? '#B45309' : '#64748B';
        ctx.save();
        ctx.translate(cx, bBottom - 56);
        ctx.rotate(-0.2);
        ctx.fillRect(-5, -55, 10, 110);
        ctx.restore();
      } else if (activeRedox.id === 'cu_hno3' && redoxDropped) {
        ctx.fillStyle = '#D97706';
        ctx.fillRect(cx - 12, bBottom - 26, Math.max(4, 24 * (1 - p * 0.7)), 10);
      }

      // Gas plume & bubbles if gas produced
      if (redoxDropped && activeRedox.gasColor) {
        ctx.fillStyle = activeRedox.gasColor;
        ctx.beginPath();
        ctx.roundRect(cx - tubeW / 2 + 2, bBottom - tubeH + 8, tubeW - 4, tubeH - liqH, [6, 6, 0, 0]);
        ctx.fill();

        for (let i = 0; i < 12; i++) {
          const yOff = ((st.t * 60 + i * 24) % (liqH - 20));
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(cx + Math.sin(st.t * 5 + i) * 18, bBottom - 18 - yOff, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#991B1B';
        ctx.font = '700 12px ui-sans-serif, sans-serif';
        ctx.fillText(`Khí thoát ra: ${activeRedox.gasFormula}`, cx + tubeW / 2 + 18, bBottom - tubeH + 45);
      }

      // Test tube glass outline
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect(cx - tubeW / 2, bBottom - tubeH, tubeW, tubeH, [4, 4, 38, 38]);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(activeRedox.reagents, 20, 28);
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
      // Reaction flask inside bath
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(fX, fY + 6, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Delivery tube to receiving tube on right
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

      // Animated vapor bubbles traveling
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

      // Receiving test tube with NaCl saturated water (bottom) & floating Ester layer (top)
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
      ctx.fillText('Lớp Este nổi (nhẹ hơn H₂O)', rX - 58, rY - 78 - esterLayerH);
      ctx.fillStyle = '#0369A1';
      ctx.fillText('Dung dịch NaCl bão hòa', rX - 56, rY + 22);
    } else {
      // Saponification beaker
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

  const drawThermoCanvas = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    st: typeof thermoStateRef.current
  ) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    // Left: Calorimeter cup + Thermometer
    const cx = w * 0.25;
    const bBottom = h * 0.84;
    const cupW = 128;
    const cupH = 160;

    // Insulated jacket
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.4;
    ctx.fillRect(cx - cupW / 2 - 10, bBottom - cupH, cupW + 20, cupH + 10);
    ctx.strokeRect(cx - cupW / 2 - 10, bBottom - cupH, cupW + 20, cupH + 10);

    // Liquid inside calorimeter
    ctx.fillStyle = activeThermo.liquidColor;
    ctx.fillRect(cx - cupW / 2, bBottom - cupH + 42, cupW, cupH - 42);

    // Frost / Heat waves
    if (thermoStarted && st.tempC < 12) {
      ctx.fillStyle = '#0284C7';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('❄ Cốc lạnh buốt (Thu nhiệt)', cx - 64, bBottom + 24);
    } else if (thermoStarted && st.tempC > 32) {
      ctx.fillStyle = '#DC2626';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('🔥 Thành cốc nóng lên (Tỏa nhiệt)', cx - 72, bBottom + 24);
    }

    // Thermometer stem
    const tx = cx;
    const tTop = 34;
    const tBot = bBottom - 26;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(tx - 6, tTop, 12, tBot - tTop);
    ctx.strokeRect(tx - 6, tTop, 12, tBot - tTop);

    const tempNorm = Math.max(0.05, Math.min(0.95, (st.tempC + 15) / 95));
    const fillH = tempNorm * (tBot - tTop - 10);
    ctx.fillStyle = st.tempC < 20 ? '#0284C7' : '#DC2626';
    ctx.fillRect(tx - 3.5, tBot - fillH, 7, fillH);
    ctx.beginPath();
    ctx.arc(tx, tBot + 4, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 12px ui-monospace, monospace';
    ctx.fillText(`${st.tempC.toFixed(1)} °C`, tx + 16, tBot - fillH + 4);

    // Right: T(t) temperature graph
    const gx = w * 0.48;
    const gy = 48;
    const gw = w * 0.47;
    const gh = h - 100;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Đồ thị nhiệt độ dung dịch T(t) theo thời gian', gx, 32);

    // 25C baseline
    const y25 = gy + gh - ((25 + 15) / 95) * gh;
    ctx.strokeStyle = '#E2E8F0';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(gx, y25);
    ctx.lineTo(gx + gw, y25);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#64748B';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText('25°C', gx + 4, y25 - 4);

    if (st.history.length > 1) {
      ctx.strokeStyle = activeThermo.type === 'exo' ? '#DC2626' : '#0284C7';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      st.history.forEach((pt, idx) => {
        const px = gx + (idx / Math.max(1, st.history.length - 1)) * gw;
        const py = gy + gh - Math.max(0.02, Math.min(0.98, (pt.tempC + 15) / 95)) * gh;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  };

  const drawOxygenPrep = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    st: typeof o2StateRef.current
  ) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const genX = w * 0.28;
    const genY = h * 0.46;
    const isActive = o2Calc.rateMul > 0.1 && st.progress < 1;

    if (o2Method === 'h2o2') {
      // Conical flask with MnO2 + Dropping funnel for H2O2
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(genX - 18, genY - 25);
      ctx.lineTo(genX - 54, genY + 75);
      ctx.lineTo(genX + 54, genY + 75);
      ctx.lineTo(genX + 18, genY - 25);
      ctx.closePath();
      ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
      ctx.fill();
      ctx.stroke();

      // MnO2 black powder at bottom
      if (o2CatalystMnO2) {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(genX - 36, genY + 62, 72, 11);
      }

      // Effervescing O2 bubbles inside H2O2 flask
      if (isActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const by = genY + 60 - ((st.t * 48 + i * 14) % 58);
          ctx.beginPath();
          ctx.arc(genX - 18 + (i % 4) * 12, by, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Dropping funnel & stem above flask
      ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(genX - 14, genY - 96, 28, 42);
      ctx.strokeRect(genX - 14, genY - 96, 28, 42);
      ctx.beginPath();
      ctx.moveTo(genX, genY - 54);
      ctx.lineTo(genX, genY - 10);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('H₂O₂', genX - 16, genY - 102);
      ctx.fillText(o2CatalystMnO2 ? 'MnO₂ (xúc tác)' : 'Không MnO₂', genX - 36, genY + 95);
    } else {
      // Tilted hard-glass test tube + alcohol burner for KMnO4 / KClO3
      ctx.save();
      ctx.translate(genX, genY);
      ctx.rotate(0.18); // mouth slightly tilted down

      // Test tube body
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-84, -18, 140, 36, [18, 4, 4, 18]);
      ctx.fill();
      ctx.stroke();

      // Solid reagent at closed end (-76..-25)
      ctx.fillStyle = o2Method === 'kmno4' ? '#581C87' : o2CatalystMnO2 ? '#475569' : '#F1F5F9';
      ctx.beginPath();
      ctx.roundRect(-80, -4, 58, 19, [10, 4, 4, 10]);
      ctx.fill();

      // Cotton plug at mouth for KMnO4
      if (o2Method === 'kmno4') {
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(30, -14, 14, 28);
      }

      // Rubber stopper
      ctx.fillStyle = '#334155';
      ctx.fillRect(50, -16, 12, 32);
      ctx.restore();

      // Lab clamp stand
      ctx.fillStyle = '#475569';
      ctx.fillRect(genX - 115, genY + 95, 70, 8);
      ctx.fillRect(genX - 102, genY - 60, 6, 155);
      ctx.fillRect(genX - 96, genY - 8, 60, 5);

      // Alcohol burner under closed end of tube
      const bX = genX - 48;
      const bY = genY + 62;
      ctx.fillStyle = '#CBD5E1';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.8;
      ctx.fillRect(bX - 20, bY, 40, 32);
      ctx.strokeRect(bX - 20, bY, 40, 32);
      if (o2BurnerOn) {
        const flick = Math.sin(st.t * 14) * 3;
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.moveTo(bX - 9, bY);
        ctx.quadraticCurveTo(bX, bY - 38 + flick, bX + 9, bY);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(bX - 4, bY);
        ctx.quadraticCurveTo(bX, bY - 18, bX + 4, bY);
        ctx.fill();
      }
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText(
        o2Method === 'kmno4' ? 'Tinh thể KMnO₄' : o2CatalystMnO2 ? 'KClO₃ + MnO₂' : 'KClO₃ nguyên chất',
        genX - 78,
        genY - 32
      );
    }

    // Collection side (Right)
    const colX = w * 0.72;
    const tubeOutX = o2Method === 'h2o2' ? genX + 14 : genX + 56;
    const tubeOutY = o2Method === 'h2o2' ? genY - 12 : genY + 10;

    if (o2CollectMethod === 'water') {
      // Water trough + inverted gas jar
      const troughTop = h * 0.62;
      const troughH = h * 0.26;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.fillRect(colX - 88, troughTop, 176, troughH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(colX - 88, troughTop, 176, troughH);

      const jarW = 68;
      const jarH = 178;
      const jarTop = troughTop - jarH + 34;
      const gasH = st.progress * (jarH - 36);

      // Water inside jar (pushed down as O2 collects)
      ctx.fillStyle = 'rgba(125, 211, 252, 0.65)';
      ctx.fillRect(colX - jarW / 2, jarTop + gasH, jarW, jarH - gasH);
      // O2 gas pocket at top
      ctx.fillStyle = 'rgba(241, 245, 249, 0.94)';
      ctx.fillRect(colX - jarW / 2, jarTop, jarW, gasH);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(colX - jarW / 2, jarTop, jarW, jarH);

      // Delivery tube routing into jar mouth under water
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tubeOutX, tubeOutY);
      ctx.lineTo(colX - 110, tubeOutY - 10);
      ctx.lineTo(colX - 110, troughTop + 44);
      ctx.lineTo(colX, troughTop + 44);
      ctx.lineTo(colX, troughTop + 26);
      ctx.stroke();

      // Rising O2 bubbles inside jar
      if (isActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const yPos = troughTop + 20 - ((st.t * 75 + i * 28) % Math.max(24, jarH - 25));
          ctx.beginPath();
          ctx.arc(colX + Math.sin(st.t * 4 + i) * 12, yPos, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(`Thu khí O₂ đẩy nước (${Math.round(st.progress * 100)}%)`, colX - 80, jarTop - 12);
    } else {
      // Upward air displacement (upright jar because O2 M=32 > Air M=29)
      const jarW = 74;
      const jarH = 175;
      const jarTop = h * 0.34;
      const fillH = st.progress * (jarH - 12);

      ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
      ctx.fillRect(colX - jarW / 2, jarTop + jarH - fillH, jarW, fillH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(colX - jarW / 2, jarTop, jarW, jarH);

      // Delivery tube dipping near bottom of upright jar
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tubeOutX, tubeOutY);
      ctx.lineTo(colX, jarTop - 28);
      ctx.lineTo(colX, jarTop + jarH - 16);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(`Đặt ngửa bình (M_O₂ = 32 > 29)`, colX - 88, jarTop + jarH + 22);
    }

    // Glowing splint test at jar mouth
    if (o2TestSplint) {
      const spX = o2CollectMethod === 'water' ? colX : colX + 18;
      const spY = o2CollectMethod === 'water' ? h * 0.22 : h * 0.34;
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(spX + 52, spY - 38);
      ctx.lineTo(spX + 4, spY + 4);
      ctx.stroke();

      if (st.progress > 0.25) {
        // Bright re-ignited flame!
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(spX + 2, spY + 4, 14 + Math.sin(st.t * 16) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.arc(spX + 2, spY + 4, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#059669';
        ctx.font = '800 12px ui-sans-serif, sans-serif';
        ctx.fillText('🔥 Tàn đóm bùng cháy sáng rực! (Xác nhận khí O₂)', colX - 135, 32);
      } else {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(spX + 2, spY + 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#64748B';
        ctx.font = '700 12px ui-sans-serif, sans-serif';
        ctx.fillText('Chưa đủ khí O₂ — tiếp tục thu khí để thử tàn đóm!', colX - 135, 32);
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
                } else if (moduleId === 'reaction_rate') resetRate();
                else if (moduleId === 'redox_flame') {
                  setRedoxDropped(false);
                  redoxStateRef.current.progress = 0;
                } else if (moduleId === 'ester_lab') esterStateRef.current.yieldFrac = 0;
                else if (moduleId === 'thermochemistry') resetThermo();
                else if (moduleId === 'oxygen_prep') resetOxygenPrep();
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Làm lại</span>
            </button>

            {moduleId === 'redox_flame' && redoxSubMode === 'test_tube' && (
              <button
                type="button"
                onClick={() => {
                  redoxStateRef.current.progress = 0;
                  setRedoxDropped(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Flame size={14} />
                <span>Tiến hành phản ứng</span>
              </button>
            )}

            {moduleId === 'thermochemistry' && (
              <button
                type="button"
                onClick={() => setThermoStarted(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Thermometer size={14} />
                <span>{thermoStarted ? 'Đang đo nhiệt...' : 'Trộn chất & Bấm đo'}</span>
              </button>
            )}

            {moduleId === 'oxygen_prep' && (
              <button
                type="button"
                onClick={() => setO2TestSplint((v) => !v)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  o2TestSplint
                    ? 'bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Flame size={14} />
                <span>{o2TestSplint ? 'Rút que đóm ra' : 'Thử bằng tàn đóm đỏ'}</span>
              </button>
            )}
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
                <div className="text-slate-500">Mol electron trao đổi</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {elecCalc.nMolE.toFixed(4)} mol
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Kim loại bám Catot</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {elecCalc.cathodeMassG.toFixed(2)} g
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Tổng khí thoát (đkc)</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {(elecCalc.anodeGasL + elecCalc.cathodeGasL).toFixed(3)} L
                </div>
              </div>
            </>
          )}

          {moduleId === 'galvanic_cell' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Cực Anot (−)</div>
                <div className="font-mono font-bold text-rose-700 mt-0.5">
                  {galvCalc.anode.symbol} → {galvCalc.anode.ion} + {galvCalc.anode.n}e
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Cực Catot (+)</div>
                <div className="font-mono font-bold text-sky-700 mt-0.5">
                  {galvCalc.cathode.ion} + {galvCalc.cathode.n}e → {galvCalc.cathode.symbol}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Suất điện động E_pin</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {galvCalc.eCell.toFixed(3)} V
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Ký hiệu pin</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {galvCalc.anode.symbol}|{galvCalc.anode.ion} || {galvCalc.cathode.ion}|{galvCalc.cathode.symbol}
                </div>
              </div>
            </>
          )}

          {moduleId === 'reaction_rate' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Thời gian đồng hồ</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {rateReadout.elapsedS.toFixed(1)} s
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Độ đục kết tủa S</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {rateReadout.turbidityPct} %
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Hệ số tốc độ v/v₀</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  ×{rateFactor.toFixed(2)}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Trạng thái dấu X</div>
                <div className="font-bold text-slate-800 mt-0.5">
                  {rateReadout.done ? 'Đã khuất hoàn toàn' : 'Còn nhìn thấy'}
                </div>
              </div>
            </>
          )}

          {moduleId === 'redox_flame' && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 col-span-2 sm:col-span-4">
              <span className="font-bold text-slate-900 block">
                {redoxSubMode === 'flame'
                  ? `Ion ${activeFlameIon.ion} cho ngọn lửa màu ${activeFlameIon.colorName} (λ ≈ ${activeFlameIon.wavelengthNm}).`
                  : activeRedox.phenomenon}
              </span>
            </div>
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
                    ? 'H₂SO₄ đặc vừa xúc tác vừa hút nước chuyển dịch cân bằng.'
                    : 'NaCl bão hòa làm giảm độ tan để xà phòng tách nổi lên trên.'}
                </div>
              </div>
            </>
          )}

          {moduleId === 'thermochemistry' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Nhiệt độ hiện tại</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {thermoReadout.tempC.toFixed(1)} °C
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Độ biến thiên ΔT</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {(thermoReadout.tempC - 25.0) >= 0 ? '+' : ''}
                  {(thermoReadout.tempC - 25.0).toFixed(1)} °C
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Phân loại</div>
                <div className={`font-bold mt-0.5 ${activeThermo.type === 'exo' ? 'text-rose-700' : 'text-sky-700'}`}>
                  {activeThermo.type === 'exo' ? 'Tỏa nhiệt (ΔH < 0)' : 'Thu nhiệt (ΔH > 0)'}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Nhiệt lượng Q (100g dd)</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {Math.abs(thermoReadout.qKj).toFixed(2)} kJ
                </div>
              </div>
            </>
          )}

          {moduleId === 'oxygen_prep' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Số mol O₂ tối đa</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {o2Calc.nO2Max.toFixed(3)} mol
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Thể tích O₂ đã thu (đkc)</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {o2Readout.collectedL.toFixed(2)} / {o2Calc.vO2MaxL.toFixed(2)} L
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Mức đầy bình thu</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {o2Readout.progressPct} %
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Cách thu khí</div>
                <div className="font-bold text-slate-800 mt-0.5">
                  {o2CollectMethod === 'water' ? 'Đẩy nước (ít tan)' : 'Đẩy không khí (nặng hơn KK)'}
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
            <span>Điều Chỉnh Hóa Chất & Điều Kiện</span>
          </div>

          {moduleId === 'electrolysis' && (
            <>
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Hệ điện phân</label>
                {[
                  { id: 'cuso4_inert', label: 'CuSO₄ (điện cực trơ Graphit)' },
                  { id: 'cuso4_cu', label: 'CuSO₄ (Anot Cu tan — Mạ đồng)' },
                  { id: 'nacl_membrane', label: 'NaCl bão hòa (có màng ngăn)' },
                  { id: 'agno3_inert', label: 'AgNO₃ (Mạ bạc điện cực)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setElecSystem(opt.id as typeof elecSystem);
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
                max={10}
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

          {moduleId === 'reaction_rate' && (
            <>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRateSubMode('cross_x')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    rateSubMode === 'cross_x' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Dấu X (Na₂S₂O₃)
                </button>
                <button
                  type="button"
                  onClick={() => setRateSubMode('collision')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    rateSubMode === 'collision' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Va chạm phân tử
                </button>
              </div>
              <ChemSlider
                label="Nồng độ chất phản ứng"
                valueDisplay={`${rateConcM.toFixed(2)} M`}
                min={0.1}
                max={1.0}
                step={0.05}
                value={rateConcM}
                onChange={setRateConcM}
              />
              <ChemSlider
                label="Nhiệt độ phản ứng"
                valueDisplay={`${rateTempC} °C`}
                min={10}
                max={65}
                step={5}
                value={rateTempC}
                onChange={setRateTempC}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rateCatalyst}
                  onChange={(e) => setRateCatalyst(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <span className="font-semibold text-slate-700">Thêm chất xúc tác (hạ Ea)</span>
              </label>
              {rateSubMode === 'collision' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rateSurfaceFine}
                    onChange={(e) => setRateSurfaceFine(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Nghiền nhỏ tăng diện tích tiếp xúc</span>
                </label>
              )}
            </>
          )}

          {moduleId === 'redox_flame' && (
            <>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRedoxSubMode('flame')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    redoxSubMode === 'flame' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Thử màu ngọn lửa
                </button>
                <button
                  type="button"
                  onClick={() => setRedoxSubMode('test_tube')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    redoxSubMode === 'test_tube' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Oxi hóa – Khử
                </button>
              </div>
              {redoxSubMode === 'flame' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {FLAME_IONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFlameIonId(item.id)}
                      className={`px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                        flameIonId === item.id
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {item.ion} ({item.salt})
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {REDOX_REACTIONS.map((rxn) => (
                    <button
                      key={rxn.id}
                      type="button"
                      onClick={() => {
                        setRedoxRxnId(rxn.id);
                        setRedoxDropped(false);
                        redoxStateRef.current.progress = 0;
                      }}
                      className={`w-full px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                        redoxRxnId === rxn.id
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {rxn.title}
                    </button>
                  ))}
                </div>
              )}
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
                  Điều chế Este
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
                    label="Tỉ lệ mol Ancol / Acid"
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

          {moduleId === 'thermochemistry' && (
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Chọn phản ứng nhiệt hóa học</label>
              {THERMO_REACTIONS.map((rxn) => (
                <button
                  key={rxn.id}
                  type="button"
                  onClick={() => setThermoId(rxn.id)}
                  className={`w-full px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                    thermoId === rxn.id
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {rxn.label}
                </button>
              ))}
            </div>
          )}

          {moduleId === 'oxygen_prep' && (
            <>
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Phương pháp điều chế O₂</label>
                {[
                  { id: 'kmno4', label: 'Nhiệt phân KMnO₄ (Thuốc tím)' },
                  { id: 'kclo3', label: 'Nhiệt phân KClO₃ (có/không MnO₂)' },
                  { id: 'h2o2', label: 'Phân hủy H₂O₂ (xúc tác MnO₂, không đun)' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setO2Method(m.id as 'kmno4' | 'kclo3' | 'h2o2')}
                    className={`w-full px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                      o2Method === m.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Cách thu khí O₂</label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setO2CollectMethod('water')}
                    className={`py-1.5 rounded-md font-bold cursor-pointer ${
                      o2CollectMethod === 'water' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Đẩy nước
                  </button>
                  <button
                    type="button"
                    onClick={() => setO2CollectMethod('air')}
                    className={`py-1.5 rounded-md font-bold cursor-pointer ${
                      o2CollectMethod === 'air' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Đẩy không khí
                  </button>
                </div>
              </div>

              <ChemSlider
                label="Khối lượng hóa chất ban đầu"
                valueDisplay={`${o2ReactantMassG.toFixed(1)} g`}
                min={5}
                max={35}
                step={0.5}
                value={o2ReactantMassG}
                onChange={setO2ReactantMassG}
              />

              {o2Method !== 'h2o2' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={o2BurnerOn}
                    onChange={(e) => setO2BurnerOn(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Đốt đèn cồn cung cấp nhiệt</span>
                </label>
              )}

              {(o2Method === 'kclo3' || o2Method === 'h2o2') && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={o2CatalystMnO2}
                    onChange={(e) => setO2CatalystMnO2(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Dùng chất xúc tác bột MnO₂</span>
                </label>
              )}
            </>
          )}
        </div>

        {/* Equation Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <h3 className="font-extrabold text-slate-900">Phương Trình & Giải Thích</h3>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-slate-800">
            {moduleId === 'electrolysis' && (
              <>
                <p className="font-semibold text-sky-800">Catot (−): {elecCalc.cathodeEq}</p>
                <p className="font-semibold text-rose-800">Anot (+): {elecCalc.anodeEq}</p>
                <p className="font-mono font-bold text-slate-900 pt-1 border-t border-slate-200">{elecCalc.overallEq}</p>
                <p className="text-slate-600">{elecCalc.phenomenon}</p>
              </>
            )}
            {moduleId === 'galvanic_cell' && (
              <>
                <p className="font-mono font-bold text-slate-900">
                  {galvCalc.anode.symbol} + {galvCalc.cathode.ion} → {galvCalc.anode.ion} + {galvCalc.cathode.symbol}
                </p>
                <p className="text-slate-600 flex items-start gap-1.5">
                  <Zap size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    Kim loại có thế điện cực chuẩn E° nhỏ hơn đóng vai trò Anot (bị oxi hóa, giải phóng electron chạy sang Catot).
                  </span>
                </p>
              </>
            )}
            {moduleId === 'reaction_rate' && (
              <>
                <p className="font-mono font-bold text-slate-900">
                  Na₂S₂O₃ + H₂SO₄ → Na₂SO₄ + S ↓ (vàng đục) + SO₂ ↑ + H₂O
                </p>
                <p className="text-slate-600">
                  Quy tắc Van 't Hoff: Khi nhiệt độ tăng thêm 10°C, tốc độ phản ứng tăng khoảng 2–4 lần.
                </p>
              </>
            )}
            {moduleId === 'redox_flame' && (
              <p className="font-mono font-bold text-slate-900">
                {redoxSubMode === 'flame'
                  ? `Cấu hình electron vỏ ion ${activeFlameIon.ion} phát xạ vạch quang phổ ${activeFlameIon.wavelengthNm}`
                  : activeRedox.equation}
              </p>
            )}
            {moduleId === 'ester_lab' && (
              <>
                <p className="font-mono font-bold text-slate-900">
                  {esterMode === 'esterification'
                    ? 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O'
                    : '(RCOO)₃C₃H₅ + 3NaOH → 3RCOONa + C₃H₅(OH)₃'}
                </p>
                <p className="text-slate-600 flex items-start gap-1.5">
                  <Info size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    {esterMode === 'esterification'
                      ? 'Phản ứng este hóa là thuận nghịch. Tăng dư ancol hoặc dùng H₂SO₄ đặc hút nước làm tăng hiệu suất tạo este.'
                      : 'Phản ứng xà phòng hóa xảy ra một chiều trong môi trường kiềm nóng.'}
                  </span>
                </p>
              </>
            )}
            {moduleId === 'thermochemistry' && (
              <>
                <p className="font-mono font-bold text-slate-900">{activeThermo.equation}</p>
                <p className="text-slate-600">{activeThermo.explanation}</p>
              </>
            )}
            {moduleId === 'oxygen_prep' && (
              <>
                <p className="font-mono font-bold text-slate-900">{o2Calc.eq}</p>
                <p className="text-slate-600">{o2Calc.note}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

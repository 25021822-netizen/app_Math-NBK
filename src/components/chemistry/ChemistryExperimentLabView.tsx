import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import {
  FlaskConical,
  Droplets,
  Flame,
  Atom,
  Beaker,
  RotateCcw,
  Play,
  Pause,
  Plus,
  SlidersHorizontal,
  Info,
  ArrowLeft,
  ArrowRight,
  Zap,
  Thermometer,
  Gauge,
} from 'lucide-react';
import type { AdditionalChemModuleId } from './AdditionalChemistrySimulations';

const AdditionalChemistrySimulations = lazy(() =>
  import('./AdditionalChemistrySimulations').then((m) => ({ default: m.AdditionalChemistrySimulations }))
);

type ChemModuleId =
  | 'titration'
  | 'metal_acid'
  | 'precipitate'
  | 'equilibrium'
  | AdditionalChemModuleId;
type ChemCategoryId = 'general' | 'solution' | 'electrochem' | 'organic';

interface ChemCategoryMeta {
  id: ChemCategoryId;
  title: string;
  grades: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CHEM_CATEGORIES: ChemCategoryMeta[] = [
  {
    id: 'general',
    title: 'Hóa Đại Cương & Nhiệt Hóa',
    grades: 'Lớp 10 · 11',
    description: 'Tốc độ phản ứng & xúc tác, cân bằng hóa học Le Chatelier, phản ứng tỏa nhiệt & thu nhiệt.',
    icon: Gauge,
  },
  {
    id: 'solution',
    title: 'Dung Dịch, Acid – Base & Kết Tủa',
    grades: 'Lớp 11',
    description: 'Chuẩn độ Acid – Base với đường cong pH, phản ứng trao đổi ion tạo kết tủa và tạo phức.',
    icon: Droplets,
  },
  {
    id: 'electrochem',
    title: 'Điện Hóa & Oxi Hóa – Khử',
    grades: 'Lớp 10 · 12',
    description: 'Pin điện hóa Galvani, điện phân dung dịch & mạ điện, kim loại tác dụng acid và thử ngọn lửa.',
    icon: Zap,
  },
  {
    id: 'organic',
    title: 'Hóa Học Hữu Cơ',
    grades: 'Lớp 12',
    description: 'Tổng hợp Etyl Axetat (phản ứng este hóa thuận nghịch) và phản ứng xà phòng hóa chất béo.',
    icon: FlaskConical,
  },
];

interface ChemExperimentMeta {
  id: ChemModuleId;
  title: string;
  category: ChemCategoryId;
  categoryLabel: string;
  grade: string;
  summary: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CHEM_EXPERIMENTS: ChemExperimentMeta[] = [
  {
    id: 'reaction_rate',
    title: 'Tốc Độ Phản Ứng & Chất Xúc Tác',
    category: 'general',
    categoryLabel: 'Hóa đại cương',
    grade: 'Lớp 10',
    summary: 'Thí nghiệm dấu chữ X với Na₂S₂O₃ + H₂SO₄, mô hình va chạm phân tử và giản đồ năng lượng hoạt hóa Ea.',
    icon: Gauge,
  },
  {
    id: 'equilibrium',
    title: 'Cân Bằng Hóa Học Le Chatelier',
    category: 'general',
    categoryLabel: 'Hóa đại cương',
    grade: 'Lớp 11',
    summary: 'Hệ khí 2NO₂ (nâu đỏ) ⇌ N₂O₄ (không màu) dịch chuyển cân bằng khi thay đổi nhiệt độ và áp suất.',
    icon: Atom,
  },
  {
    id: 'thermochemistry',
    title: 'Nhiệt Hóa Học: Tỏa Nhiệt & Thu Nhiệt',
    category: 'general',
    categoryLabel: 'Nhiệt hóa học',
    grade: 'Lớp 10',
    summary: 'Nhiệt lượng kế đo biến thiên nhiệt độ ΔT và nhiệt lượng Q của các phản ứng trung hòa, tôi vôi, hòa tan muối.',
    icon: Thermometer,
  },
  {
    id: 'titration',
    title: 'Chuẩn Độ Acid – Base (HCl + NaOH)',
    category: 'solution',
    categoryLabel: 'Dung dịch',
    grade: 'Lớp 11',
    summary: 'Ống buret chuẩn độ từng giọt, đổi màu chất chỉ thị Phenolphtalein/Quỳ tím và đồ thị pH trực tiếp.',
    icon: Droplets,
  },
  {
    id: 'precipitate',
    title: 'Phản Ứng Kết Tủa & Tạo Phức Chất',
    category: 'solution',
    categoryLabel: 'Dung dịch',
    grade: 'Lớp 11',
    summary: 'Nhận biết ion Ag⁺, Cu²⁺, Fe³⁺, Fe²⁺, Ba²⁺ qua màu sắc kết tủa đặc trưng và phức [Cu(NH₃)₄]²⁺.',
    icon: Beaker,
  },
  {
    id: 'galvanic_cell',
    title: 'Pin Điện Hóa (Pin Galvani & Thế Điện Cực)',
    category: 'electrochem',
    categoryLabel: 'Điện hóa học',
    grade: 'Lớp 12',
    summary: 'Ghép cặp kim loại Mg, Zn, Fe, Pb, Cu, Ag nối cầu muối, đo suất điện động E_pin theo nồng độ ion.',
    icon: Zap,
  },
  {
    id: 'electrolysis',
    title: 'Điện Phân Dung Dịch & Mạ Điện',
    category: 'electrochem',
    categoryLabel: 'Điện hóa học',
    grade: 'Lớp 12',
    summary: 'Điện phân CuSO₄ (điện cực trơ / Anot tan), NaCl có màng ngăn, AgNO₃ và định luật Faraday.',
    icon: Zap,
  },
  {
    id: 'metal_acid',
    title: 'Kim Loại Tác Dụng Với Acid (HCl / H₂SO₄)',
    category: 'electrochem',
    categoryLabel: 'Vô cơ',
    grade: 'Lớp 10 · 12',
    summary: 'So sánh tốc độ sủi bọt khí H₂ của Mg, Zn, Fe, Cu theo nồng độ acid và nhiệt độ, tính thể tích khí đkc.',
    icon: Flame,
  },
  {
    id: 'redox_flame',
    title: 'Thử Màu Ngọn Lửa & Oxi Hóa – Khử',
    category: 'electrochem',
    categoryLabel: 'Nhận biết & Khử',
    grade: 'Lớp 10 · 12',
    summary: 'Đốt muối Li⁺, Na⁺, K⁺, Ca²⁺, Cu²⁺, Ba²⁺ trên đèn Bunsen và thí nghiệm Fe + CuSO₄, Cu + HNO₃, KMnO₄.',
    icon: Flame,
  },
  {
    id: 'ester_lab',
    title: 'Tổng Hợp Este & Phản Ứng Xà Phòng Hóa',
    category: 'organic',
    categoryLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    summary: 'Điều chế Etyl Axetat cách thủy với H₂SO₄ đặc, tách lớp este và xà phòng hóa chất béo trong kiềm.',
    icon: FlaskConical,
  },
];

type IndicatorType = 'phenolphthalein' | 'litmus';
type MetalType = 'Mg' | 'Zn' | 'Fe' | 'Cu';
type AcidType = 'HCl' | 'H2SO4';

interface PrecipitateReaction {
  id: string;
  label: string;
  reagentA: string;
  reagentB: string;
  solutionBaseColor: string;
  precipitateColor: string;
  finalLiquidColor: string;
  hasPrecipitate: boolean;
  dissolvesInExcess?: boolean;
  phenomenon: string;
  molecularEq: string;
  ionicEq: string;
}

const PRECIPITATE_REACTIONS: PrecipitateReaction[] = [
  {
    id: 'agcl',
    label: 'AgNO₃ + NaCl',
    reagentA: 'Dung dịch AgNO₃ (trong suốt)',
    reagentB: 'Dung dịch NaCl',
    solutionBaseColor: 'rgba(226, 232, 240, 0.35)',
    precipitateColor: '#F8FAFC',
    finalLiquidColor: 'rgba(226, 232, 240, 0.45)',
    hasPrecipitate: true,
    phenomenon: 'Xuất hiện kết tủa trắng bạc clorua (AgCl ↓) lắng xuống đáy bình.',
    molecularEq: 'AgNO₃ + NaCl → AgCl ↓ (trắng) + NaNO₃',
    ionicEq: 'Ag⁺ + Cl⁻ → AgCl ↓',
  },
  {
    id: 'cuoh2',
    label: 'CuSO₄ + NaOH',
    reagentA: 'Dung dịch CuSO₄ (xanh lam nhạt)',
    reagentB: 'Dung dịch NaOH',
    solutionBaseColor: 'rgba(56, 189, 248, 0.38)',
    precipitateColor: '#0284C7',
    finalLiquidColor: 'rgba(186, 230, 253, 0.35)',
    hasPrecipitate: true,
    phenomenon: 'Xuất hiện kết tủa keo xanh lam đồng(II) hiđroxit Cu(OH)₂ ↓ không tan trong kiềm.',
    molecularEq: 'CuSO₄ + 2NaOH → Cu(OH)₂ ↓ (xanh lam) + Na₂SO₄',
    ionicEq: 'Cu²⁺ + 2OH⁻ → Cu(OH)₂ ↓',
  },
  {
    id: 'feoh3',
    label: 'FeCl₃ + NaOH',
    reagentA: 'Dung dịch FeCl₃ (vàng nâu)',
    reagentB: 'Dung dịch NaOH',
    solutionBaseColor: 'rgba(251, 191, 36, 0.38)',
    precipitateColor: '#991B1B',
    finalLiquidColor: 'rgba(254, 243, 199, 0.3)',
    hasPrecipitate: true,
    phenomenon: 'Xuất hiện kết tủa nâu đỏ sắt(III) hiđroxit Fe(OH)₃ ↓ lắng dần xuống đáy.',
    molecularEq: 'FeCl₃ + 3NaOH → Fe(OH)₃ ↓ (nâu đỏ) + 3NaCl',
    ionicEq: 'Fe³⁺ + 3OH⁻ → Fe(OH)₃ ↓',
  },
  {
    id: 'feoh2',
    label: 'FeSO₄ + NaOH',
    reagentA: 'Dung dịch FeSO₄ (lục nhạt)',
    reagentB: 'Dung dịch NaOH',
    solutionBaseColor: 'rgba(134, 239, 172, 0.36)',
    precipitateColor: '#6EE7B7',
    finalLiquidColor: 'rgba(209, 250, 229, 0.3)',
    hasPrecipitate: true,
    phenomenon: 'Xuất hiện kết tủa trắng hơi xanh Fe(OH)₂ ↓ (trong không khí lâu sẽ hóa nâu đỏ dần).',
    molecularEq: 'FeSO₄ + 2NaOH → Fe(OH)₂ ↓ (trắng xanh) + Na₂SO₄',
    ionicEq: 'Fe²⁺ + 2OH⁻ → Fe(OH)₂ ↓',
  },
  {
    id: 'baso4',
    label: 'BaCl₂ + Na₂SO₄',
    reagentA: 'Dung dịch BaCl₂ (không màu)',
    reagentB: 'Dung dịch Na₂SO₄',
    solutionBaseColor: 'rgba(226, 232, 240, 0.32)',
    precipitateColor: '#FFFFFF',
    finalLiquidColor: 'rgba(241, 245, 249, 0.45)',
    hasPrecipitate: true,
    phenomenon: 'Xuất hiện kết tủa trắng mịn bari sunfat BaSO₄ ↓ bền trong acid và kiềm.',
    molecularEq: 'BaCl₂ + Na₂SO₄ → BaSO₄ ↓ (trắng) + 2NaCl',
    ionicEq: 'Ba²⁺ + SO₄²⁻ → BaSO₄ ↓',
  },
  {
    id: 'cu_complex',
    label: 'CuSO₄ + NH₃ dư',
    reagentA: 'Dung dịch CuSO₄ (xanh lam nhạt)',
    reagentB: 'Dung dịch NH₃ dư',
    solutionBaseColor: 'rgba(56, 189, 248, 0.38)',
    precipitateColor: '#0284C7',
    finalLiquidColor: 'rgba(30, 58, 138, 0.85)',
    hasPrecipitate: true,
    dissolvesInExcess: true,
    phenomenon: 'Ban đầu tạo kết tủa xanh Cu(OH)₂ ↓, sau đó tan tạo dung dịch phức chất [Cu(NH₃)₄](OH)₂ màu xanh thẫm.',
    molecularEq: 'Cu(OH)₂ + 4NH₃ → [Cu(NH₃)₄](OH)₂ (phức xanh thẫm)',
    ionicEq: 'Cu²⁺ + 4NH₃ → [Cu(NH₃)₄]²⁺',
  },
  {
    id: 'no_rxn',
    label: 'NaCl + KNO₃',
    reagentA: 'Dung dịch NaCl (không màu)',
    reagentB: 'Dung dịch KNO₃',
    solutionBaseColor: 'rgba(226, 232, 240, 0.3)',
    precipitateColor: '#E2E8F0',
    finalLiquidColor: 'rgba(226, 232, 240, 0.3)',
    hasPrecipitate: false,
    phenomenon: 'Không có hiện tượng kết tủa hay bay hơi — các ion cùng tồn tại trong dung dịch.',
    molecularEq: 'NaCl + KNO₃ → Không xảy ra phản ứng',
    ionicEq: 'Không có phương trình ion thu gọn',
  },
];

export const ChemistryExperimentLabView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ChemCategoryId | null>(null);
  const [activeModule, setActiveModule] = useState<ChemModuleId | null>(null);

  // ===========================================================================
  // 1. CHUẨN ĐỘ ACID - BASE (HCl + NaOH)
  // ===========================================================================
  const [acidConc, setAcidConc] = useState<number>(0.1); // M
  const [acidVolMl, setAcidVolMl] = useState<number>(25); // mL
  const [baseConc, setBaseConc] = useState<number>(0.1); // M
  const [addedBaseMl, setAddedBaseMl] = useState<number>(0); // mL (0..50)
  const [indicator, setIndicator] = useState<IndicatorType>('phenolphthalein');
  const [isDripping, setIsDripping] = useState<boolean>(false);
  const [stirAngle, setStirAngle] = useState<number>(0);

  // Exact strong-acid / strong-base pH solver
  const titrationState = useMemo(() => {
    const nH = acidConc * acidVolMl; // mmol
    const nOH = baseConc * addedBaseMl; // mmol
    const vTotal = Math.max(1, acidVolMl + addedBaseMl);
    const diff = nH - nOH;
    let pH = 7.0;
    if (Math.abs(diff) < 1e-6) {
      pH = 7.0;
    } else if (diff > 0) {
      const cH = diff / vTotal;
      pH = -Math.log10(cH + 1e-7);
    } else {
      const cOH = -diff / vTotal;
      pH = 14 + Math.log10(cOH + 1e-7);
    }
    pH = Math.max(0.2, Math.min(13.8, pH));

    const equivVolMl = (acidConc * acidVolMl) / baseConc;

    let liquidColor = 'rgba(224, 242, 254, 0.55)';
    let colorLabel = 'Không màu (acid dư)';

    if (indicator === 'phenolphthalein') {
      if (pH < 8.0) {
        liquidColor = 'rgba(224, 242, 254, 0.55)';
        colorLabel = 'Không màu (pH < 8.2 · Acid dư)';
      } else if (pH <= 9.2) {
        liquidColor = 'rgba(249, 168, 212, 0.65)';
        colorLabel = 'Hồng nhạt (Gần / Tại điểm tương đương)';
      } else {
        liquidColor = 'rgba(219, 39, 119, 0.78)';
        colorLabel = 'Hồng cánh sen đậm (Base NaOH dư)';
      }
    } else {
      if (pH < 5.5) {
        liquidColor = 'rgba(239, 68, 68, 0.68)';
        colorLabel = 'Đỏ (Môi trường Acid dư)';
      } else if (pH <= 8.0) {
        liquidColor = 'rgba(139, 92, 246, 0.68)';
        colorLabel = 'Tím trung tính (Quanh điểm tương đương)';
      } else {
        liquidColor = 'rgba(37, 99, 235, 0.72)';
        colorLabel = 'Xanh lam (Môi trường Base dư)';
      }
    }

    const regimeText =
      addedBaseMl < equivVolMl - 0.15
        ? 'Môi trường Acid dư'
        : Math.abs(addedBaseMl - equivVolMl) <= 0.15
        ? 'Đạt điểm tương đương'
        : 'Môi trường Base (NaOH) dư';

    return { pH, equivVolMl, liquidColor, colorLabel, regimeText };
  }, [acidConc, acidVolMl, baseConc, addedBaseMl, indicator]);

  useEffect(() => {
    if (!isDripping || activeModule !== 'titration') return;
    const timer = setInterval(() => {
      setAddedBaseMl((prev) => {
        if (prev >= 50) {
          setIsDripping(false);
          return 50;
        }
        return Number((prev + 0.2).toFixed(2));
      });
    }, 120);
    return () => clearInterval(timer);
  }, [isDripping, activeModule]);

  useEffect(() => {
    if (activeModule !== 'titration') return;
    const timer = setInterval(() => {
      setStirAngle((a) => (a + 35) % 360);
    }, 60);
    return () => clearInterval(timer);
  }, [activeModule]);

  // ===========================================================================
  // 2. PHẢN ỨNG KIM LOẠI VỚI ACID
  // ===========================================================================
  const [selectedMetal, setSelectedMetal] = useState<MetalType>('Zn');
  const [selectedAcid, setSelectedAcid] = useState<AcidType>('HCl');
  const [metalMassG, setMetalMassG] = useState<number>(2.0);
  const [acidConcMetal, setAcidConcMetal] = useState<number>(1.0); // M (in 100 mL = 0.1 L)
  const [rxnTempC, setRxnTempC] = useState<number>(25);
  const [metalRunning, setMetalRunning] = useState<boolean>(true);
  const [rxnProgress, setRxnProgress] = useState<number>(0); // 0 -> 1

  const metalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const metalBubblesRef = useRef<{ x: number; y: number; r: number; speed: number }[]>([]);

  const metalStoich = useMemo(() => {
    const molarMass: Record<MetalType, number> = { Mg: 24, Zn: 65, Fe: 56, Cu: 64 };
    const reactivity: Record<MetalType, number> = { Mg: 2.2, Zn: 1.0, Fe: 0.6, Cu: 0 };
    const reacts = selectedMetal !== 'Cu';
    const nMetal = metalMassG / molarMass[selectedMetal];
    const nHPlus = acidConcMetal * 0.1 * (selectedAcid === 'H2SO4' ? 2 : 1);
    const nH2Max = reacts ? Math.min(nMetal, nHPlus / 2) : 0;
    const vH2Liters = nH2Max * 24.79; // đkc 25°C, 1 bar
    const rate =
      reactivity[selectedMetal] *
      Math.max(0.2, acidConcMetal) *
      Math.exp((rxnTempC - 25) / 30);

    const limiting = !reacts
      ? 'Cu đứng sau H trong dãy hoạt động hóa học (không phản ứng)'
      : nMetal <= nHPlus / 2
      ? `Kim loại ${selectedMetal} hết hoàn toàn`
      : `Acid ${selectedAcid} hết trước, còn dư kim loại ${selectedMetal}`;

    const eqText =
      !reacts
        ? `Cu + ${selectedAcid} (loãng) → Không xảy ra phản ứng`
        : selectedAcid === 'HCl'
        ? `${selectedMetal} + 2HCl → ${selectedMetal}Cl₂ + H₂ ↑`
        : `${selectedMetal} + H₂SO₄ (loãng) → ${selectedMetal}SO₄ + H₂ ↑`;

    return { reacts, nMetal, nHPlus, nH2Max, vH2Liters, rate, limiting, eqText };
  }, [selectedMetal, selectedAcid, metalMassG, acidConcMetal, rxnTempC]);

  useEffect(() => {
    setRxnProgress(0);
    metalBubblesRef.current = [];
  }, [selectedMetal, selectedAcid, metalMassG, acidConcMetal]);

  useEffect(() => {
    if (activeModule !== 'metal_acid') return;
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (metalRunning && metalStoich.reacts) {
        setRxnProgress((prev) => {
          if (prev >= 1) return 1;
          return Math.min(1, prev + dt * 0.085 * metalStoich.rate);
        });
      }

      const canvas = metalCanvasRef.current;
      if (canvas) {
        drawMetalAcidCanvas(canvas);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });

  const drawMetalAcidCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    // Flask on left
    const flaskCx = w * 0.33;
    const flaskBottom = h - 46;
    const flaskR = 74;

    // Solution color shifts slightly to pale green for FeCl2/FeSO4
    const feTint = selectedMetal === 'Fe' ? rxnProgress * 0.45 : 0;
    ctx.fillStyle =
      selectedMetal === 'Fe'
        ? `rgba(${Math.round(210 - feTint * 90)}, ${Math.round(240 - feTint * 10)}, ${Math.round(252 - feTint * 70)}, 0.72)`
        : 'rgba(224, 242, 254, 0.65)';
    ctx.beginPath();
    ctx.roundRect(flaskCx - flaskR, flaskBottom - 125, flaskR * 2, 125, [8, 8, 22, 22]);
    ctx.fill();

    // Metal bar at bottom
    const dissolveScale = metalStoich.reacts ? Math.max(0.18, 1 - rxnProgress * 0.78) : 1;
    const barW = 54 * dissolveScale;
    const barH = 16 * dissolveScale;
    ctx.fillStyle =
      selectedMetal === 'Cu'
        ? '#C2410C'
        : selectedMetal === 'Fe'
        ? '#475569'
        : '#94A3B8';
    ctx.fillRect(flaskCx - barW / 2, flaskBottom - barH - 6, barW, barH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(flaskCx - barW / 2, flaskBottom - barH - 6, barW, barH);

    // Spawn & animate H2 bubbles
    const bubbles = metalBubblesRef.current;
    if (metalRunning && metalStoich.reacts && rxnProgress < 0.99) {
      const spawnChance = Math.min(0.85, 0.14 * metalStoich.rate);
      if (Math.random() < spawnChance) {
        bubbles.push({
          x: flaskCx + (Math.random() - 0.5) * barW,
          y: flaskBottom - barH - 8,
          r: 2 + Math.random() * 3.2,
          speed: 45 + Math.random() * 45 + rxnTempC * 0.6,
        });
      }
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (metalRunning) b.y -= b.speed * 0.016;
      if (b.y < flaskBottom - 125) {
        bubbles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Beaker outline & labels
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(flaskCx - flaskR, flaskBottom - 175);
    ctx.lineTo(flaskCx - flaskR, flaskBottom - 20);
    ctx.quadraticCurveTo(flaskCx - flaskR, flaskBottom, flaskCx - flaskR + 20, flaskBottom);
    ctx.lineTo(flaskCx + flaskR - 20, flaskBottom);
    ctx.quadraticCurveTo(flaskCx + flaskR, flaskBottom, flaskCx + flaskR, flaskBottom - 20);
    ctx.lineTo(flaskCx + flaskR, flaskBottom - 175);
    ctx.stroke();

    // Rubber stopper + delivery tube to inverted gas cylinder
    ctx.fillStyle = '#475569';
    ctx.fillRect(flaskCx - flaskR + 4, flaskBottom - 186, (flaskR - 4) * 2, 14);

    const cylX = w * 0.72;
    const cylTop = 64;
    const cylH = 220;
    const cylW = 64;

    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(flaskCx + 10, flaskBottom - 186);
    ctx.lineTo(flaskCx + 10, 44);
    ctx.lineTo(cylX, 44);
    ctx.lineTo(cylX, cylTop + cylH - 10);
    ctx.stroke();

    // Inverted cylinder water bath
    ctx.fillStyle = 'rgba(186, 230, 253, 0.4)';
    ctx.fillRect(cylX - 58, cylTop + cylH - 36, 116, 48);

    const gasCollectedL = metalStoich.vH2Liters * rxnProgress;
    const fillRatio = Math.min(0.92, gasCollectedL / 3.2);
    const gasPx = cylH * fillRatio;

    // Water inside cylinder
    ctx.fillStyle = 'rgba(125, 211, 252, 0.5)';
    ctx.fillRect(cylX - cylW / 2, cylTop + gasPx, cylW, cylH - gasPx);
    // H2 Gas pocket at top
    ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
    ctx.fillRect(cylX - cylW / 2, cylTop, cylW, gasPx);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(cylX - cylW / 2, cylTop, cylW, cylH);

    // Graduations
    ctx.fillStyle = '#475569';
    ctx.font = '600 10px ui-monospace, monospace';
    for (let tick = 1; tick <= 5; tick++) {
      const ty = cylTop + (cylH * tick) / 6;
      ctx.beginPath();
      ctx.moveTo(cylX - cylW / 2, ty);
      ctx.lineTo(cylX - cylW / 2 + 10, ty);
      ctx.stroke();
    }

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(`Bình phản ứng (${selectedMetal} + ${selectedAcid})`, flaskCx - 74, flaskBottom + 24);
    ctx.fillText(`Ống thu khí H₂ (${gasCollectedL.toFixed(2)} L)`, cylX - 66, cylTop - 14);
  };

  // ===========================================================================
  // 3. PHẢN ỨNG KẾT TỦA & TẠO PHỨC
  // ===========================================================================
  const [selectedRxnId, setSelectedRxnId] = useState<string>('agcl');
  const [dropCount, setDropCount] = useState<number>(0); // 0 -> 10
  const precipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const precipParticlesRef = useRef<{ x: number; y: number; vy: number; vx: number; r: number }[]>([]);

  const activeRxn = useMemo(
    () => PRECIPITATE_REACTIONS.find((r) => r.id === selectedRxnId) || PRECIPITATE_REACTIONS[0],
    [selectedRxnId]
  );

  useEffect(() => {
    setDropCount(0);
    precipParticlesRef.current = [];
  }, [selectedRxnId]);

  const handleAddPrecipDrop = (count = 2) => {
    setDropCount((prev) => {
      const next = Math.min(10, prev + count);
      if (activeRxn.hasPrecipitate && (!activeRxn.dissolvesInExcess || next <= 5)) {
        for (let i = 0; i < 18 * count; i++) {
          precipParticlesRef.current.push({
            x: (Math.random() - 0.5) * 110,
            y: -45 - Math.random() * 25,
            vx: (Math.random() - 0.5) * 16,
            vy: 14 + Math.random() * 22,
            r: 2.2 + Math.random() * 3,
          });
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (activeModule !== 'precipitate') return;
    let raf = 0;
    const render = () => {
      const canvas = precipCanvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(320, Math.floor(rect.width));
        const h = Math.max(360, Math.floor(rect.height));
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(0, 0, w, h);

          const bx = w * 0.5;
          const bBottom = h - 48;
          const bW = 160;
          const bH = 190;
          const liqH = 120 + dropCount * 2.5;

          // Pipette dropper above beaker
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.roundRect(bx - 12, 24, 24, 38, 12);
          ctx.fill();
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.moveTo(bx - 6, 62);
          ctx.lineTo(bx + 6, 62);
          ctx.lineTo(bx + 2, 112);
          ctx.lineTo(bx - 2, 112);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#475569';
          ctx.stroke();

          ctx.fillStyle = '#0F172A';
          ctx.font = '600 11px ui-sans-serif, sans-serif';
          ctx.fillText(`Ống nhỏ giọt: ${activeRxn.reagentB}`, bx + 20, 52);

          // Solution tint
          const useFinalLiquid =
            dropCount > 0 && (!activeRxn.dissolvesInExcess || dropCount > 5);
          ctx.fillStyle = useFinalLiquid ? activeRxn.finalLiquidColor : activeRxn.solutionBaseColor;
          ctx.fillRect(bx - bW / 2, bBottom - liqH, bW, liqH);

          // Animate precipitate settling (or dissolving in excess NH3!)
          const parts = precipParticlesRef.current;
          const dissolved = Boolean(activeRxn.dissolvesInExcess && dropCount > 6);
          if (!dissolved && activeRxn.hasPrecipitate) {
            ctx.fillStyle = activeRxn.precipitateColor;
            parts.forEach((p, idx) => {
              const targetFloor = bBottom - 8 - (idx % 5) * 2.5;
              const rawPy = bBottom - liqH + 45 + (p.y + 45) * 1.35;
              if (rawPy < targetFloor) {
                p.x += p.vx * 0.016;
                p.y += p.vy * 0.025 + 0.35;
              }
              const px = bx + Math.max(-bW / 2 + 8, Math.min(bW / 2 - 8, p.x));
              const py = Math.min(targetFloor, rawPy);
              ctx.beginPath();
              ctx.arc(px, py, p.r, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
              ctx.lineWidth = 0.6;
              ctx.stroke();
            });
          }

          // Beaker outline
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(bx - bW / 2 - 8, bBottom - bH);
          ctx.lineTo(bx - bW / 2, bBottom - bH + 14);
          ctx.lineTo(bx - bW / 2, bBottom);
          ctx.lineTo(bx + bW / 2, bBottom);
          ctx.lineTo(bx + bW / 2, bBottom - bH + 14);
          ctx.lineTo(bx + bW / 2 + 8, bBottom - bH);
          ctx.stroke();

          ctx.fillStyle = '#0F172A';
          ctx.font = '700 12px ui-sans-serif, sans-serif';
          ctx.fillText(activeRxn.reagentA, bx - 90, bBottom + 24);
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [activeModule, activeRxn, dropCount]);

  // ===========================================================================
  // 4. CÂN BẰNG HÓA HỌC (2NO2 <-> N2O4)
  // ===========================================================================
  const [eqTempC, setEqTempC] = useState<number>(25); // -10 .. 90 C
  const [eqPressureAtm, setEqPressureAtm] = useState<number>(1.0); // 0.5 .. 3.0 atm
  const eqCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const eqState = useMemo(() => {
    const tempK = eqTempC + 273.15;
    // Van 't Hoff thermodynamic Kp for 2NO2 (g) <-> N2O4 (g), dH = -57.2 kJ/mol, dS = -175.8 J/(mol*K)
    const dH = -57200;
    const dS = -175.8;
    const R = 8.314;
    const kp = Math.exp(-dH / (R * tempK) + dS / R);
    // Degree of dissociation alpha for N2O4 <-> 2NO2: Kp_diss = 1/Kp = 4*alpha^2*P / (1 - alpha^2)
    const kDiss = 1 / kp;
    const alpha = Math.sqrt(kDiss / (kDiss + 4 * eqPressureAtm)); // fraction of N2O4 dissociated into NO2
    const nNO2 = 2 * alpha;
    const nN2O4 = 1 - alpha;
    const totalMoles = nNO2 + nN2O4;
    const pctNO2 = (nNO2 / totalMoles) * 100;
    const pctN2O4 = (nN2O4 / totalMoles) * 100;
    const shiftText =
      pctNO2 > 58
        ? 'Cân bằng chuyển dịch mạnh sang chiều nghịch (tạo NO₂ nâu đỏ)'
        : pctN2O4 > 65
        ? 'Cân bằng chuyển dịch mạnh sang chiều thuận (tạo N₂O₄ không màu)'
        : 'Trạng thái cân bằng động trung gian giữa NO₂ và N₂O₄';
    return { kp, pctNO2, pctN2O4, shiftText };
  }, [eqTempC, eqPressureAtm]);

  useEffect(() => {
    if (activeModule !== 'equilibrium') return;
    let raf = 0;
    const particles = Array.from({ length: 40 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      id: i,
    }));

    const render = () => {
      const canvas = eqCanvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(320, Math.floor(rect.width));
        const h = Math.max(360, Math.floor(rect.height));
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(0, 0, w, h);

          // Syringe piston volume inversely proportional to pressure
          const chamberLeft = w * 0.14;
          const chamberTop = 58;
          const maxChamberW = w * 0.72;
          const chamberH = h - 130;
          const volFrac = Math.max(0.35, Math.min(1, 1 / Math.pow(eqPressureAtm, 0.75)));
          const activeW = maxChamberW * volFrac;

          // Reddish-brown gas tint proportional to NO2 concentration & density
          const brownAlpha = Math.min(0.86, 0.1 + (eqState.pctNO2 / 100) * 0.72 * Math.sqrt(eqPressureAtm));
          ctx.fillStyle = `rgba(154, 52, 18, ${brownAlpha})`;
          ctx.fillRect(chamberLeft, chamberTop, activeW, chamberH);

          // Animated molecules: reddish NO2 monomers vs paired N2O4 dimers
          const speedScale = 0.012 * (1 + (eqTempC + 20) / 70);
          const no2Count = Math.round((eqState.pctNO2 / 100) * particles.length);
          particles.forEach((p, idx) => {
            p.x += p.vx * speedScale;
            p.y += p.vy * speedScale;
            if (p.x < 0.03 || p.x > 0.97) p.vx *= -1;
            if (p.y < 0.05 || p.y > 0.95) p.vy *= -1;
            p.x = Math.max(0.03, Math.min(0.97, p.x));
            p.y = Math.max(0.05, Math.min(0.95, p.y));

            const px = chamberLeft + p.x * activeW;
            const py = chamberTop + p.y * chamberH;
            if (idx < no2Count) {
              // NO2 monomer (amber-red)
              ctx.fillStyle = '#DC2626';
              ctx.beginPath();
              ctx.arc(px, py, 5, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // N2O4 dimer (pair of cool-slate spheres)
              ctx.fillStyle = '#334155';
              ctx.beginPath();
              ctx.arc(px - 4, py, 4.5, 0, Math.PI * 2);
              ctx.arc(px + 4, py, 4.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Syringe cylinder wall & piston
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3;
          ctx.strokeRect(chamberLeft, chamberTop, maxChamberW, chamberH);

          ctx.fillStyle = '#475569';
          ctx.fillRect(chamberLeft + activeW, chamberTop + 2, 16, chamberH - 4);
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(chamberLeft + activeW + 16, chamberTop + chamberH / 2 - 8, maxChamberW - activeW + 18, 16);

          ctx.fillStyle = '#0F172A';
          ctx.font = '700 12px ui-sans-serif, sans-serif';
          ctx.fillText(
            `Xi-lanh chứa hỗn hợp khí cân bằng: 2NO₂ (đỏ nâu) ⇌ N₂O₄ (không màu)`,
            chamberLeft,
            38
          );
          ctx.font = '600 11px ui-sans-serif, sans-serif';
          ctx.fillStyle = '#475569';
          ctx.fillText(
            `Chấm đỏ: phân tử NO₂ (${eqState.pctNO2.toFixed(1)}%) · Cặp xám: phân tử N₂O₄ (${eqState.pctN2O4.toFixed(1)}%)`,
            chamberLeft,
            chamberTop + chamberH + 26
          );
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [activeModule, eqState, eqTempC, eqPressureAtm]);

  const filteredExperiments = useMemo(
    () =>
      selectedCategory === null
        ? []
        : CHEM_EXPERIMENTS.filter((exp) => exp.category === selectedCategory),
    [selectedCategory]
  );

  const activeCategoryMeta = useMemo(
    () => CHEM_CATEGORIES.find((cat) => cat.id === selectedCategory) || null,
    [selectedCategory]
  );

  const activeExperimentMeta = useMemo(
    () => CHEM_EXPERIMENTS.find((exp) => exp.id === activeModule) || null,
    [activeModule]
  );

  // CẤP 1: CHỈ HIỆN CÁC MỤC THÍ NGHIỆM HÓA HỌC
  if (activeModule === null && selectedCategory === null) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-emerald-700">
              Phòng Thí Nghiệm Hóa Học · Lớp 10 · 11 · 12
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              Chọn Mục Thí Nghiệm Hóa Học
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Nhấn vào từng mục bên dưới để xem danh sách các thí nghiệm mô phỏng bên trong.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
            {CHEM_CATEGORIES.length} mục · {CHEM_EXPERIMENTS.length} thí nghiệm
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CHEM_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = CHEM_EXPERIMENTS.filter((e) => e.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className="group text-left bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-sm rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {cat.grades} · {count} thí nghiệm
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 group-hover:bg-emerald-50 group-hover:border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 transition-colors">
                      <Icon size={20} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {cat.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                  <span>Xem các thí nghiệm</span>
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // CẤP 2: HIỆN CÁC THÍ NGHIỆM TRONG MỤC ĐÃ CHỌN
  if (activeModule === null && selectedCategory !== null) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Các mục thí nghiệm</span>
            </button>

            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {activeCategoryMeta?.grades} · {filteredExperiments.length} thí nghiệm
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                {activeCategoryMeta?.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExperiments.map((exp) => {
            const Icon = exp.icon;
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() => setActiveModule(exp.id)}
                className="group text-left bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-sm rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {exp.grade} · {exp.categoryLabel}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 group-hover:bg-emerald-50 group-hover:border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 transition-colors">
                      <Icon size={18} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {exp.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {exp.summary}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                  <span>Mở mô phỏng</span>
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-5">
      {/* Focused Experiment Top Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(activeExperimentMeta?.category || selectedCategory);
              setActiveModule(null);
            }}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Quay lại mục</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveModule(null);
              setSelectedCategory(null);
            }}
            className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            Tất cả mục
          </button>

          <div className="min-w-0 pl-1">
            <div className="text-[11px] font-medium text-slate-500 truncate">
              {activeExperimentMeta?.grade} · {activeExperimentMeta?.categoryLabel}
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
              {activeExperimentMeta?.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="quick-chem-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Chuyển nhanh:
          </label>
          <select
            id="quick-chem-select"
            value={activeModule || ''}
            onChange={(e) => {
              const nextId = e.target.value as ChemModuleId;
              const nextMeta = CHEM_EXPERIMENTS.find((x) => x.id === nextId);
              if (nextMeta) setSelectedCategory(nextMeta.category);
              setActiveModule(nextId);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {CHEM_CATEGORIES.map((cat) => (
              <optgroup key={cat.id} label={cat.title}>
                {CHEM_EXPERIMENTS.filter((exp) => exp.category === cat.id).map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {activeModule === 'electrolysis' ||
      activeModule === 'galvanic_cell' ||
      activeModule === 'reaction_rate' ||
      activeModule === 'redox_flame' ||
      activeModule === 'ester_lab' ||
      activeModule === 'thermochemistry' ? (
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm font-semibold text-slate-600">
              Đang tải mô phỏng thí nghiệm hóa học...
            </div>
          }
        >
          <AdditionalChemistrySimulations moduleId={activeModule} />
        </Suspense>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT STAGE: VISUAL APPARATUS */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          {activeModule === 'titration' && (
            <div className="p-4 sm:p-6 bg-slate-50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddedBaseMl((v) => Math.min(50, Number((v + 0.05).toFixed(2))))}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Nhỏ 1 giọt (+0.05 mL)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddedBaseMl((v) => Math.min(50, Number((v + 1).toFixed(2))))}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs cursor-pointer"
                  >
                    +1.0 mL
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDripping((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer ${
                      isDripping
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                  >
                    {isDripping ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isDripping ? 'Khóa van' : 'Mở van chảy'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsDripping(false);
                    setAddedBaseMl(0);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Làm lại</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                {/* Burette & Erlenmeyer Flask SVG */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center">
                  <svg viewBox="0 0 260 360" className="w-full max-w-[260px] h-[340px]">
                    {/* Stand base & rod */}
                    <rect x="28" y="330" width="204" height="10" rx="3" fill="#334155" />
                    <rect x="44" y="24" width="8" height="308" fill="#64748B" />
                    <rect x="48" y="88" width="70" height="6" fill="#475569" />

                    {/* Burette tube (0..50 mL) */}
                    <rect x="118" y="22" width="24" height="168" fill="#F8FAFC" stroke="#334155" strokeWidth="2" />
                    {/* NaOH solution inside burette */}
                    {(() => {
                      const remainRatio = Math.max(0, (50 - addedBaseMl) / 50);
                      const h = 156 * remainRatio;
                      return (
                        <rect
                          x="120"
                          y={188 - h}
                          width="20"
                          height={h}
                          fill="rgba(186, 230, 253, 0.72)"
                        />
                      );
                    })()}
                    {/* Graduation ticks */}
                    {[0, 10, 20, 30, 40, 50].map((v, idx) => (
                      <g key={v}>
                        <line x1="118" y1={34 + idx * 30} x2="127" y2={34 + idx * 30} stroke="#475569" strokeWidth="1" />
                        <text x="96" y={38 + idx * 30} fontSize="9" fill="#64748B" fontFamily="monospace">
                          {v}
                        </text>
                      </g>
                    ))}
                    {/* Stopcock & Tip */}
                    <rect x="126" y="190" width="8" height="28" fill="#E2E8F0" stroke="#334155" strokeWidth="1.5" />
                    <rect
                      x={isDripping ? 123 : 114}
                      y={isDripping ? 196 : 200}
                      width={isDripping ? 14 : 32}
                      height={isDripping ? 18 : 8}
                      rx="2"
                      fill="#0284C7"
                    />

                    {/* Falling droplet when dripping */}
                    {isDripping && addedBaseMl < 50 && (
                      <circle cx="130" cy="234" r="3.5" fill="#38BDF8" />
                    )}

                    {/* Magnetic Stirrer Plate */}
                    <rect x="76" y="308" width="108" height="22" rx="4" fill="#475569" />

                    {/* Conical Erlenmeyer Flask */}
                    <path
                      d="M112 224 L112 246 L82 302 Q80 308 88 308 L172 308 Q180 308 178 302 L148 246 L148 224 Z"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="2.2"
                    />
                    {/* Solution inside flask with indicator color */}
                    <path
                      d="M99 272 L84 301 Q83 306 90 306 L170 306 Q177 306 176 301 L161 272 Z"
                      fill={titrationState.liquidColor}
                    />
                    {/* Spinning PTFE stir bar */}
                    <rect
                      x={130 - Math.max(4, Math.abs(Math.cos((stirAngle * Math.PI) / 180)) * 12)}
                      y="299"
                      width={Math.max(8, Math.abs(Math.cos((stirAngle * Math.PI) / 180)) * 24)}
                      height="4"
                      rx="2"
                      fill="#FFFFFF"
                      stroke="#64748B"
                      strokeWidth="0.8"
                    />
                  </svg>
                  <p className="text-xs font-bold text-slate-800 mt-1 text-center">
                    Màu chỉ thị: {titrationState.colorLabel}
                  </p>
                </div>

                {/* Live Titration pH Curve SVG */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Đường cong chuẩn độ pH theo V(NaOH)</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-700">
                      pH = {titrationState.pH.toFixed(2)}
                    </span>
                  </div>
                  <TitrationCurveSvg
                    acidConc={acidConc}
                    acidVolMl={acidVolMl}
                    baseConc={baseConc}
                    addedBaseMl={addedBaseMl}
                    currentPh={titrationState.pH}
                    equivVolMl={titrationState.equivVolMl}
                  />
                </div>
              </div>
            </div>
          )}

          {activeModule === 'metal_acid' && (
            <div className="bg-slate-50">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMetalRunning((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      metalRunning
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {metalRunning ? <Pause size={14} /> : <Play size={14} />}
                    <span>{metalRunning ? 'Tạm dừng' : 'Tiếp tục'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRxnProgress(0);
                      metalBubblesRef.current = [];
                      setMetalRunning(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Làm lại phản ứng</span>
                  </button>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-700">
                  Tiến độ: {Math.round(rxnProgress * 100)}%
                </span>
              </div>
              <div className="h-[390px] w-full">
                <canvas ref={metalCanvasRef} className="w-full h-full block" />
              </div>
            </div>
          )}

          {activeModule === 'precipitate' && (
            <div className="bg-slate-50">
              <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddPrecipDrop(2)}
                    disabled={dropCount >= 10}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Droplets size={14} />
                    <span>Nhỏ thêm thuốc thử ({dropCount}/10 giọt)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDropCount(0);
                      precipParticlesRef.current = [];
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Rửa ống nghiệm</span>
                  </button>
                </div>
              </div>
              <div className="h-[390px] w-full">
                <canvas ref={precipCanvasRef} className="w-full h-full block" />
              </div>
            </div>
          )}

          {activeModule === 'equilibrium' && (
            <div className="bg-slate-50">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{eqState.shiftText}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEqTempC(25);
                    setEqPressureAtm(1.0);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Điều kiện chuẩn (25°C · 1 atm)</span>
                </button>
              </div>
              <div className="h-[390px] w-full">
                <canvas ref={eqCanvasRef} className="w-full h-full block" />
              </div>
            </div>
          )}

          {/* Quantitative Telemetry Strip */}
          <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {activeModule === 'titration' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">V(NaOH) đã nhỏ</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {addedBaseMl.toFixed(2)} mL
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Độ pH dung dịch</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                    {titrationState.pH.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">V(NaOH) tương đương</span>
                  <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                    {titrationState.equivVolMl.toFixed(2)} mL
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Trạng thái dung dịch</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {titrationState.regimeText}
                  </span>
                </div>
              </>
            )}

            {activeModule === 'metal_acid' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Số mol kim loại</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {metalStoich.nMetal.toFixed(3)} mol
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Số mol H⁺ (100 mL)</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {metalStoich.nHPlus.toFixed(3)} mol
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Thể tích H₂ thu (đkc)</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                    {(metalStoich.vH2Liters * rxnProgress).toFixed(2)} / {metalStoich.vH2Liters.toFixed(2)} L
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Kết luận tỉ lệ mol</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {metalStoich.limiting}
                  </span>
                </div>
              </>
            )}

            {activeModule === 'precipitate' && (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 col-span-2 sm:col-span-4 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 block">Hiện tượng quan sát</span>
                <p className="font-bold text-slate-900">
                  {dropCount === 0
                    ? `Trong cốc đang chứa sẵn ${activeRxn.reagentA}. Nhấn nút "Nhỏ thêm thuốc thử" để tiến hành thí nghiệm.`
                    : activeRxn.phenomenon}
                </p>
              </div>
            )}

            {activeModule === 'equilibrium' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Hằng số Kp(T)</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {eqState.kp.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Tỉ lệ khí NO₂ (nâu đỏ)</span>
                  <span className="font-mono tabular-nums font-bold text-rose-700 mt-0.5 block">
                    {eqState.pctNO2.toFixed(1)}%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Tỉ lệ khí N₂O₄ (không màu)</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {eqState.pctN2O4.toFixed(1)}%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Nhiệt độ · Áp suất</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                    {eqTempC}°C · {eqPressureAtm.toFixed(1)} atm
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT ZONE: CONTROLS & CHEMICAL EQUATION */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <SlidersHorizontal size={16} className="text-emerald-600" />
              <h2 className="text-sm font-extrabold text-slate-900">Điều Chỉnh Hóa Chất &amp; Điều Kiện</h2>
            </div>

            {activeModule === 'titration' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block">Chất chỉ thị màu</span>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setIndicator('phenolphthalein')}
                      className={`py-1.5 rounded-md font-bold cursor-pointer ${
                        indicator === 'phenolphthalein'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Phenolphthalein
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndicator('litmus')}
                      className={`py-1.5 rounded-md font-bold cursor-pointer ${
                        indicator === 'litmus'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Quỳ Tím
                    </button>
                  </div>
                </div>

                <ChemSlider
                  label="Thể tích HCl ban đầu"
                  valueDisplay={`${acidVolMl} mL`}
                  min={10}
                  max={40}
                  step={5}
                  value={acidVolMl}
                  onChange={(v) => {
                    setAcidVolMl(v);
                    setAddedBaseMl(0);
                  }}
                />
                <ChemSlider
                  label="Nồng độ HCl"
                  valueDisplay={`${acidConc.toFixed(2)} M`}
                  min={0.05}
                  max={0.2}
                  step={0.01}
                  value={acidConc}
                  onChange={(v) => {
                    setAcidConc(v);
                    setAddedBaseMl(0);
                  }}
                />
                <ChemSlider
                  label="Nồng độ NaOH chuẩn (trên buret)"
                  valueDisplay={`${baseConc.toFixed(2)} M`}
                  min={0.05}
                  max={0.2}
                  step={0.01}
                  value={baseConc}
                  onChange={(v) => {
                    setBaseConc(v);
                    setAddedBaseMl(0);
                  }}
                />
                <ChemSlider
                  label="Điều chỉnh nhanh V(NaOH)"
                  valueDisplay={`${addedBaseMl.toFixed(2)} mL`}
                  min={0}
                  max={50}
                  step={0.1}
                  value={addedBaseMl}
                  onChange={setAddedBaseMl}
                />
              </div>
            )}

            {activeModule === 'metal_acid' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block">Chọn kim loại</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Mg', 'Zn', 'Fe', 'Cu'] as MetalType[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMetal(m)}
                        className={`py-2 rounded-lg border font-bold cursor-pointer ${
                          selectedMetal === m
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block">Chọn dung dịch acid (100 mL)</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedAcid('HCl')}
                      className={`py-2 rounded-lg border font-bold cursor-pointer ${
                        selectedAcid === 'HCl'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      HCl
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAcid('H2SO4')}
                      className={`py-2 rounded-lg border font-bold cursor-pointer ${
                        selectedAcid === 'H2SO4'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      H₂SO₄ loãng
                    </button>
                  </div>
                </div>

                <ChemSlider
                  label={`Khối lượng ${selectedMetal}`}
                  valueDisplay={`${metalMassG.toFixed(1)} g`}
                  min={0.5}
                  max={5.0}
                  step={0.5}
                  value={metalMassG}
                  onChange={setMetalMassG}
                />
                <ChemSlider
                  label="Nồng độ acid"
                  valueDisplay={`${acidConcMetal.toFixed(1)} M`}
                  min={0.2}
                  max={2.4}
                  step={0.2}
                  value={acidConcMetal}
                  onChange={setAcidConcMetal}
                />
                <ChemSlider
                  label="Nhiệt độ phản ứng"
                  valueDisplay={`${rxnTempC} °C`}
                  min={20}
                  max={80}
                  step={5}
                  value={rxnTempC}
                  onChange={setRxnTempC}
                />
              </div>
            )}

            {activeModule === 'precipitate' && (
              <div className="space-y-2.5 text-xs">
                <span className="font-bold text-slate-700 block">Chọn cặp thuốc thử khảo sát</span>
                <div className="space-y-1.5">
                  {PRECIPITATE_REACTIONS.map((rxn) => (
                    <button
                      key={rxn.id}
                      type="button"
                      onClick={() => setSelectedRxnId(rxn.id)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-left font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        selectedRxnId === rxn.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{rxn.label}</span>
                      <span className="text-[11px] font-medium text-slate-500">
                        {rxn.hasPrecipitate ? 'Có hiện tượng' : 'Không PƯ'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeModule === 'equilibrium' && (
              <div className="space-y-4 text-xs">
                <ChemSlider
                  label="Nhiệt độ T"
                  valueDisplay={`${eqTempC} °C`}
                  min={-10}
                  max={90}
                  step={1}
                  value={eqTempC}
                  onChange={setEqTempC}
                />
                <ChemSlider
                  label="Áp suất nén P"
                  valueDisplay={`${eqPressureAtm.toFixed(2)} atm`}
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={eqPressureAtm}
                  onChange={setEqPressureAtm}
                />

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEqTempC(0)}
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-[11px] cursor-pointer"
                  >
                    Ngâm nước đá (0°C)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEqTempC(80)}
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] cursor-pointer"
                  >
                    Ngâm nước nóng (80°C)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chemical Equation & Mechanism Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
              <FlaskConical size={15} className="text-emerald-600" />
              <span>Phương Trình &amp; Giải Thích Hóa Học</span>
            </div>

            {activeModule === 'titration' && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-mono font-bold text-slate-900">HCl + NaOH → NaCl + H₂O</p>
                <p className="text-slate-600 leading-relaxed">
                  Tại điểm tương đương: n(H⁺) = n(OH⁻) nên pH = 7.00. Phenolphthalein đổi màu rõ sang hồng nhạt ở khoảng pH ≈ 8.2 ngay khi dư 1 giọt NaOH.
                </p>
              </div>
            )}

            {activeModule === 'metal_acid' && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-mono font-bold text-slate-900">{metalStoich.eqText}</p>
                <p className="text-slate-600 leading-relaxed">
                  Tốc độ thoát khí H₂ tăng khi tăng nồng độ acid, tăng nhiệt độ hoặc dùng kim loại có tính khử mạnh hơn (Mg &gt; Zn &gt; Fe).
                </p>
              </div>
            )}

            {activeModule === 'precipitate' && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-mono font-bold text-slate-900">{activeRxn.molecularEq}</p>
                <p className="font-mono text-[11px] text-emerald-700 font-semibold">
                  Ion thu gọn: {activeRxn.ionicEq}
                </p>
              </div>
            )}

            {activeModule === 'equilibrium' && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-mono font-bold text-slate-900">
                  2NO₂ (nâu đỏ) ⇌ N₂O₄ (không màu) · ΔH = -57.2 kJ
                </p>
                <p className="text-slate-600 leading-relaxed flex items-start gap-1.5">
                  <Info size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    Phản ứng thuận tỏa nhiệt và làm giảm số mol khí. Khi tăng áp suất hoặc hạ nhiệt độ, cân bằng dịch chuyển theo chiều thuận (màu nhạt dần).
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

interface ChemSliderProps {
  label: string;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
}

const ChemSlider: React.FC<ChemSliderProps> = ({
  label,
  valueDisplay,
  min,
  max,
  step,
  value,
  onChange,
}) => (
  <div className="space-y-1">
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
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-emerald-600 cursor-pointer"
    />
  </div>
);

interface TitrationCurveProps {
  acidConc: number;
  acidVolMl: number;
  baseConc: number;
  addedBaseMl: number;
  currentPh: number;
  equivVolMl: number;
}

const TitrationCurveSvg: React.FC<TitrationCurveProps> = ({
  acidConc,
  acidVolMl,
  baseConc,
  addedBaseMl,
  currentPh,
  equivVolMl,
}) => {
  const w = 320;
  const h = 230;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const pw = w - padL - padR;
  const phH = h - padT - padB;

  const toX = (vMl: number) => padL + (Math.min(50, Math.max(0, vMl)) / 50) * pw;
  const toY = (phVal: number) => padT + ((14 - Math.min(14, Math.max(0, phVal))) / 14) * phH;

  const points: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const v = (50 * i) / 100;
    const diff = acidConc * acidVolMl - baseConc * v;
    const vTotal = acidVolMl + v;
    let p = 7;
    if (Math.abs(diff) < 1e-6) p = 7;
    else if (diff > 0) p = -Math.log10(diff / vTotal + 1e-7);
    else p = 14 + Math.log10(-diff / vTotal + 1e-7);
    p = Math.max(0.2, Math.min(13.8, p));
    points.push(`${toX(v).toFixed(1)},${toY(p).toFixed(1)}`);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px] bg-slate-50 rounded-lg border border-slate-200">
      {/* Grid */}
      {[0, 7, 14].map((pVal) => (
        <g key={pVal}>
          <line
            x1={padL}
            y1={toY(pVal)}
            x2={w - padR}
            y2={toY(pVal)}
            stroke={pVal === 7 ? '#94A3B8' : '#CBD5E1'}
            strokeDasharray={pVal === 7 ? '4 4' : undefined}
          />
          <text x="6" y={toY(pVal) + 3} fontSize="9" fill="#64748B" fontFamily="monospace">
            {pVal}
          </text>
        </g>
      ))}
      {[0, 10, 20, 30, 40, 50].map((vVal) => (
        <text
          key={vVal}
          x={toX(vVal) - 6}
          y={h - 8}
          fontSize="9"
          fill="#64748B"
          fontFamily="monospace"
        >
          {vVal}
        </text>
      ))}

      {/* Equivalence crosshair */}
      {equivVolMl <= 50 && (
        <line
          x1={toX(equivVolMl)}
          y1={padT}
          x2={toX(equivVolMl)}
          y2={h - padB}
          stroke="#059669"
          strokeDasharray="3 3"
          strokeWidth="1.2"
        />
      )}

      {/* Curve polyline */}
      <polyline fill="none" stroke="#0284C7" strokeWidth="2.2" points={points.join(' ')} />

      {/* Current operating point */}
      <circle cx={toX(addedBaseMl)} cy={toY(currentPh)} r="4.5" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
};

import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  FlaskConical,
  Droplets,
  RotateCcw,
  Play,
  Pause,
  Plus,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  Zap,
  Factory,
  Scale,
} from 'lucide-react';
import type { AdditionalChemModuleId } from './AdditionalChemistrySimulations';
import type { IndustrialModuleId } from './IndustrialChemistrySimulations';

const AdditionalChemistrySimulations = lazy(() =>
  import('./AdditionalChemistrySimulations').then((m) => ({ default: m.AdditionalChemistrySimulations }))
);
const IndustrialChemistrySimulations = lazy(() =>
  import('./IndustrialChemistrySimulations').then((m) => ({ default: m.IndustrialChemistrySimulations }))
);
const ChemicalEquationStudio = lazy(() =>
  import('./ChemicalEquationStudio').then((m) => ({ default: m.ChemicalEquationStudio }))
);

type ChemModuleId =
  | 'titration'
  | 'equation_writer'
  | AdditionalChemModuleId
  | IndustrialModuleId;

type ChemCategoryId = 'electrochem' | 'industrial' | 'organic_titration';

interface ChemCategoryMeta {
  id: ChemCategoryId;
  title: string;
  grades: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CHEM_CATEGORIES: ChemCategoryMeta[] = [
  {
    id: 'electrochem',
    title: 'Pin Điện Hóa, Tinh Chế & Mạ Kim Loại',
    grades: 'Hóa 12 · Điện hóa học',
    description:
      'Pin Galvani với điện cực Anot tan dần – Catot bồi đắp dày lên; điện phân tinh chế đồng thô (bùn anot Ag, Au), mạ bạc, mạ niken với điện cực tan.',
    icon: Zap,
  },
  {
    id: 'industrial',
    title: 'Mô Hình Sản Xuất Công Nghiệp',
    grades: 'Hóa 10 · 11 · 12 · Vô cơ',
    description:
      'Điện phân nóng chảy Al₂O₃ + Criolit sản xuất Nhôm (Hall–Héroult) và các dây chuyền sản xuất H₂SO₄ (tiếp xúc), NH₃ (Haber–Bosch), Xút – Clo và luyện gang lò cao.',
    icon: Factory,
  },
  {
    id: 'organic_titration',
    title: 'Điều Chế Ester & Chuẩn Độ Acid – Base',
    grades: 'Hóa 11 · Hóa 12',
    description:
      'Điều chế Ethyl Acetate (H₂SO₄ đặc, tách lớp NaCl bão hòa), xà phòng hóa chất béo và chuẩn độ dung dịch acid (HCl / CH₃COOH) bằng dung dịch chuẩn NaOH.',
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
    id: 'galvanic_cell',
    title: 'Pin Galvani (Điện Cực Tan & Thế Điện Cực Chuẩn)',
    category: 'electrochem',
    categoryLabel: 'Hóa 12 · Pin điện hóa',
    grade: 'Lớp 12',
    summary:
      'Ghép cặp Mg, Zn, Fe, Pb, Cu, Ag nối cầu muối KNO₃; quan sát điện cực Anot (−) tan dần (Δm < 0), Catot (+) bồi đắp kim loại dày lên (Δm > 0) và sức điện động Nernst.',
    icon: Zap,
  },
  {
    id: 'electrolysis',
    title: 'Tinh Chế Kim Loại, Mạ Điện & Điện Phân (Điện Cực Tan)',
    category: 'electrochem',
    categoryLabel: 'Hóa 12 · Điện phân & Tinh chế',
    grade: 'Lớp 12',
    summary:
      'Tinh chế đồng thô (Anot Cu bẩn tan dần, bùn Ag/Au lắng đáy, Catot Cu tinh khiết dày lên), mạ bạc (Anot Ag tan), mạ niken (Anot Ni tan) và điện phân CuSO₄ điện cực trơ.',
    icon: Zap,
  },
  {
    id: 'aluminum_prod',
    title: 'Mô Hình Sản Xuất Nhôm (Điện Phân Nóng Chảy Al₂O₃)',
    category: 'industrial',
    categoryLabel: 'Hóa 12 · Luyện kim & Al',
    grade: 'Lớp 12',
    summary:
      'Quy trình Hall–Héroult ở 950°C với chất chảy Criolit (Na₃AlF₆), bể lót graphit Catot (−) thu Al lỏng lắng đáy và các khối Anot (+) than chì bị đốt cháy mòn dần.',
    icon: Factory,
  },
  {
    id: 'industrial_prod',
    title: 'Mô Hình Sản Xuất H₂SO₄, NH₃, Xút–Clo & Luyện Gang',
    category: 'industrial',
    categoryLabel: 'Hóa 10 · 11 · 12 · Công nghiệp hóa chất',
    grade: 'Lớp 10 · 11 · 12',
    summary:
      '4 dây chuyền trọng tâm THPT: Sản xuất H₂SO₄ (tiếp xúc V₂O₅ tạo Oleum), NH₃ (Haber–Bosch tuần hoàn khí), điện phân NaCl màng ngăn (NaOH/Cl₂/Javel) và Lò cao luyện gang.',
    icon: Factory,
  },
  {
    id: 'ester_lab',
    title: 'Mô Hình Điều Chế Ester & Xà Phòng Hóa',
    category: 'organic_titration',
    categoryLabel: 'Hóa 12 · Ester – Lipid',
    grade: 'Lớp 12',
    summary:
      'Đun cách thủy CH₃COOH + C₂H₅OH xúc tác H₂SO₄ đặc, ngưng tụ hơi vào dung dịch NaCl bão hòa để tách lớp Ethyl Acetate nổi lên trên; mô phỏng xà phòng hóa chất béo.',
    icon: FlaskConical,
  },
  {
    id: 'titration',
    title: 'Chuẩn Độ Acid – Base (HCl / CH₃COOH + NaOH)',
    category: 'organic_titration',
    categoryLabel: 'Hóa 11 · Chuẩn độ & pH',
    grade: 'Lớp 11',
    summary:
      'Chuẩn độ acid mạnh (HCl) hoặc acid yếu (CH₃COOH) bằng dung dịch chuẩn NaOH trên buret, theo dõi máy khuấy từ, đường cong pH trực tiếp và đổi màu Phenolphthalein/Quỳ tím.',
    icon: Droplets,
  },
];

type IndicatorType = 'phenolphthalein' | 'litmus';
type AnalyteAcidType = 'HCl' | 'CH3COOH';

function computeTitrationPh(
  analyteAcid: AnalyteAcidType,
  acidConc: number,
  acidVolMl: number,
  baseConc: number,
  addedBaseMl: number
): number {
  const vTotal = Math.max(0.001, acidVolMl + addedBaseMl);
  const ca = (acidConc * acidVolMl) / vTotal;
  const cb = (baseConc * addedBaseMl) / vTotal;
  const kw = 1e-14;

  let ph = 7.0;
  if (analyteAcid === 'HCl') {
    const delta = ca - cb;
    const hPlus = (delta + Math.sqrt(delta * delta + 4 * kw)) / 2;
    ph = -Math.log10(Math.max(1e-14, hPlus));
  } else {
    // Exact charge balance for CH3COOH (Ka = 1.8e-5) + NaOH:
    // f(pH) = [H+] + cb - Kw/[H+] - ca * Ka / (Ka + [H+]) = 0 (strictly decreasing on [0, 14])
    const ka = 1.8e-5;
    let lo = 0.0;
    let hi = 14.0;
    for (let iter = 0; iter < 42; iter++) {
      const mid = (lo + hi) * 0.5;
      const h = Math.pow(10, -mid);
      const f = h + cb - kw / h - (ca * ka) / (ka + h);
      if (f > 0) lo = mid;
      else hi = mid;
    }
    ph = (lo + hi) * 0.5;
  }
  return Math.max(0.2, Math.min(13.8, ph));
}

export const ChemistryExperimentLabView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ChemCategoryId | null>(null);
  const [activeModule, setActiveModule] = useState<ChemModuleId | null>(null);

  // ===========================================================================
  // CHUẨN ĐỘ ACID - BASE (HCl / CH3COOH + NaOH)
  // ===========================================================================
  const [analyteAcid, setAnalyteAcid] = useState<AnalyteAcidType>('HCl');
  const [acidConc, setAcidConc] = useState<number>(0.1); // M
  const [acidVolMl, setAcidVolMl] = useState<number>(25); // mL
  const [baseConc, setBaseConc] = useState<number>(0.1); // M
  const [addedBaseMl, setAddedBaseMl] = useState<number>(0); // mL (0..50)
  const [indicator, setIndicator] = useState<IndicatorType>('phenolphthalein');
  const [isDripping, setIsDripping] = useState<boolean>(false);
  const [stirAngle, setStirAngle] = useState<number>(0);

  const titrationState = useMemo(() => {
    const pH = computeTitrationPh(analyteAcid, acidConc, acidVolMl, baseConc, addedBaseMl);
    const equivVolMl = (acidConc * acidVolMl) / baseConc;
    const equivPh = computeTitrationPh(analyteAcid, acidConc, acidVolMl, baseConc, equivVolMl);

    let liquidColor = 'rgba(224, 242, 254, 0.55)';
    let colorLabel = 'Không màu (acid dư)';

    if (indicator === 'phenolphthalein') {
      if (pH < 8.0) {
        liquidColor = 'rgba(224, 242, 254, 0.55)';
        colorLabel = 'Không màu (pH < 8,2 · Acid dư)';
      } else if (pH <= 9.2) {
        liquidColor = 'rgba(249, 168, 212, 0.65)';
        colorLabel = 'Hồng nhạt (Tại / Gần điểm tương đương)';
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
        colorLabel = 'Tím trung tính (Quanh pH ≈ 7)';
      } else {
        liquidColor = 'rgba(37, 99, 235, 0.72)';
        colorLabel = 'Xanh lam (Môi trường Base dư)';
      }
    }

    const regimeText =
      addedBaseMl < equivVolMl - 0.15
        ? analyteAcid === 'CH3COOH' && addedBaseMl > 0.5
          ? 'Dung dịch đệm CH₃COOH / CH₃COO⁻'
          : 'Môi trường Acid dư'
        : Math.abs(addedBaseMl - equivVolMl) <= 0.15
        ? 'Đạt điểm tương đương'
        : 'Môi trường Base (NaOH) dư';

    return { pH, equivVolMl, equivPh, liquidColor, colorLabel, regimeText };
  }, [analyteAcid, acidConc, acidVolMl, baseConc, addedBaseMl, indicator]);

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

  // CẤP 1: CHỈ HIỆN CÁC MỤC THÍ NGHIỆM HÓA HỌC TRỌNG TÂM THPT
  if (activeModule === null && selectedCategory === null) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-emerald-700">
              Phòng Thí Nghiệm Hóa Học THPT (GDPT 2018) · Lớp 10 · 11 · 12
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              Chọn Mục Thí Nghiệm Hóa Học
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Tập trung vào điện hóa học (điện cực tan, tinh chế kim loại, mạ điện), mô hình sản xuất công nghiệp, điều chế ester và chuẩn độ acid – base.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {CHEM_CATEGORIES.length} mục · {CHEM_EXPERIMENTS.length} mô hình thí nghiệm
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveModule('equation_writer')}
          className="w-full group text-left bg-white border border-emerald-300 hover:border-emerald-500 hover:shadow-sm rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all cursor-pointer"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Scale size={22} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-700">
                Công cụ chuyên sâu THPT · Lớp 10 – 11 – 12
              </div>
              <h2 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Viết, Tự Sinh Sản Phẩm &amp; Cân Bằng Mọi Phương Trình Hóa Học
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập cả 2 vế để cân bằng chính xác, chỉ nhập chất tham gia để tự viết sản phẩm, hoặc tra cứu kho phương trình chuẩn THPT.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 shrink-0">
            <span>Mở trình viết PTHH</span>
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      {cat.grades} · {count} mô hình
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
                  <span>Xem mô hình</span>
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
                {activeCategoryMeta?.grades} · {filteredExperiments.length} mô hình
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                {activeCategoryMeta?.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              if (activeModule === 'equation_writer') {
                setActiveModule(null);
                setSelectedCategory(null);
              } else {
                setSelectedCategory(activeExperimentMeta?.category || selectedCategory);
                setActiveModule(null);
              }
            }}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>{activeModule === 'equation_writer' ? 'Trang chính Hóa' : 'Quay lại mục'}</span>
          </button>

          {activeModule !== 'equation_writer' && (
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
          )}

          <div className="min-w-0 pl-1">
            <div className="text-[11px] font-medium text-slate-500 truncate">
              {activeModule === 'equation_writer'
                ? 'THPT · Lớp 10 · 11 · 12 · Công cụ PTHH'
                : `${activeExperimentMeta?.grade} · ${activeExperimentMeta?.categoryLabel}`}
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
              {activeModule === 'equation_writer'
                ? 'Viết & Cân Bằng Tất Cả Phương Trình Hóa Học'
                : activeExperimentMeta?.title}
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
              else setSelectedCategory(null);
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
            <optgroup label="Công cụ bổ trợ">
              <option value="equation_writer">Viết &amp; Cân Bằng PTHH</option>
            </optgroup>
          </select>
        </div>
      </div>

      {activeModule === 'equation_writer' ? (
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm font-semibold text-slate-600">
              Đang tải trình viết &amp; cân bằng phương trình hóa học...
            </div>
          }
        >
          <ChemicalEquationStudio />
        </Suspense>
      ) : activeModule === 'aluminum_prod' || activeModule === 'industrial_prod' ? (
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm font-semibold text-slate-600">
              Đang tải mô hình sản xuất công nghiệp...
            </div>
          }
        >
          <IndustrialChemistrySimulations moduleId={activeModule} />
        </Suspense>
      ) : activeModule === 'electrolysis' ||
        activeModule === 'galvanic_cell' ||
        activeModule === 'ester_lab' ? (
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
          {/* LEFT STAGE: VISUAL APPARATUS FOR TITRATION */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
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
                    analyteAcid={analyteAcid}
                    acidConc={acidConc}
                    acidVolMl={acidVolMl}
                    baseConc={baseConc}
                    addedBaseMl={addedBaseMl}
                    currentPh={titrationState.pH}
                    equivVolMl={titrationState.equivVolMl}
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>pH tương đương: {titrationState.equivPh.toFixed(2)}</span>
                    <span>V_tđ = {titrationState.equivVolMl.toFixed(1)} mL</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quantitative Telemetry Strip */}
            <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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
            </div>
          </div>

          {/* RIGHT ZONE: CONTROLS & CHEMICAL EQUATION */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <SlidersHorizontal size={16} className="text-emerald-600" />
                <h2 className="text-sm font-extrabold text-slate-900">Điều Chỉnh Hóa Chất &amp; Điều Kiện</h2>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block">Dung dịch acid cần chuẩn độ (trong bình tam giác)</span>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setAnalyteAcid('HCl');
                        setIsDripping(false);
                        setAddedBaseMl(0);
                      }}
                      className={`py-1.5 rounded-md font-bold cursor-pointer ${
                        analyteAcid === 'HCl'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      HCl (Acid mạnh)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnalyteAcid('CH3COOH');
                        setIndicator('phenolphthalein');
                        setIsDripping(false);
                        setAddedBaseMl(0);
                      }}
                      className={`py-1.5 rounded-md font-bold cursor-pointer ${
                        analyteAcid === 'CH3COOH'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      CH₃COOH (Acid yếu)
                    </button>
                  </div>
                </div>

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
                  label={`Thể tích ${analyteAcid === 'HCl' ? 'HCl' : 'CH₃COOH'} ban đầu`}
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
                  label={`Nồng độ ${analyteAcid === 'HCl' ? 'HCl' : 'CH₃COOH'}`}
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
            </div>

            {/* Chemical Equation & Mechanism Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                <FlaskConical size={15} className="text-emerald-600" />
                <span>Phương Trình &amp; Nguyên Tắc Chuẩn Độ</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                {analyteAcid === 'HCl' ? (
                  <>
                    <p className="font-mono font-bold text-slate-900">HCl + NaOH → NaCl + H₂O   (H⁺ + OH⁻ → H₂O)</p>
                    <p className="text-slate-600 leading-relaxed">
                      Chuẩn độ acid mạnh bằng base mạnh (Hóa 11): tại điểm tương đương{' '}
                      <span className="font-mono font-semibold">C_A·V_A = C_B·V_B</span> nên pH = 7,00. Bước nhảy pH rất dài (từ ≈ 3 đến 11), nên chọn Phenolphthalein (đổi màu ở pH 8,2–10) chuyển hồng nhạt bền trong 30 giây là dừng chuẩn độ.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-mono font-bold text-slate-900">
                      CH₃COOH + NaOH → CH₃COONa + H₂O
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      Chuẩn độ acid yếu (K_a = 1,8·10⁻⁵) bằng base mạnh: ban đầu tạo dung dịch đệm CH₃COOH / CH₃COO⁻ làm pH tăng chậm. Tại điểm tương đương tạo muối CH₃COONa thủy phân cho môi trường kiềm nhẹ (pH ≈ {titrationState.equivPh.toFixed(2)}), do đó bắt buộc dùng chỉ thị <span className="font-semibold">Phenolphthalein</span>.
                    </p>
                  </>
                )}
              </div>
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
  analyteAcid: AnalyteAcidType;
  acidConc: number;
  acidVolMl: number;
  baseConc: number;
  addedBaseMl: number;
  currentPh: number;
  equivVolMl: number;
}

const TitrationCurveSvg: React.FC<TitrationCurveProps> = ({
  analyteAcid,
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

  // Sample densely around equivalence volume so the sharp vertical jump renders accurately
  const sampleVolumes = new Set<number>();
  for (let i = 0; i <= 100; i++) sampleVolumes.add((50 * i) / 100);
  for (let delta = -1.5; delta <= 1.5; delta += 0.1) {
    const v = equivVolMl + delta;
    if (v >= 0 && v <= 50) sampleVolumes.add(Number(v.toFixed(3)));
  }
  const sortedVolumes = Array.from(sampleVolumes).sort((a, b) => a - b);
  const points = sortedVolumes.map((v) => {
    const p = computeTitrationPh(analyteAcid, acidConc, acidVolMl, baseConc, v);
    return `${toX(v).toFixed(1)},${toY(p).toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px] bg-slate-50 rounded-lg border border-slate-200">
      {/* Phenolphthalein color-change band (pH 8.2 - 10.0) */}
      <rect
        x={padL}
        y={toY(10.0)}
        width={pw}
        height={toY(8.2) - toY(10.0)}
        fill="rgba(236, 72, 153, 0.10)"
      />

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

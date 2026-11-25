import React, { useMemo, useState } from 'react';
import {
  FlaskConical,
  Search,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Scale,
  BookOpen,
  ArrowRight,
  ListChecks,
} from 'lucide-react';
import {
  balanceChemicalEquation,
  CHEM_REACTIONS_DB,
  predictReactionsFromLHS,
  toUnicodeSubscripts,
  type ChemReactionEntry,
} from '../../utils/chemistryEquationEngine';

type StudioTab = 'balancer' | 'predictor' | 'library';

interface SavedEquationItem {
  id: string;
  formatted: string;
  latex: string;
  condition?: string;
}

const BALANCER_EXAMPLES = [
  { label: 'Cu + HNO₃ → NO', eq: 'Cu + HNO3 -> Cu(NO3)2 + NO↑ + H2O' },
  { label: 'KMnO₄ + HCl đ', eq: 'KMnO4 + HCl -> KCl + MnCl2 + Cl2↑ + H2O' },
  { label: 'Đốt quặng Pirit FeS₂', eq: 'FeS2 + O2 -> Fe2O3 + SO2↑' },
  { label: 'K₂Cr₂O₇ + FeSO₄', eq: 'K2Cr2O7 + FeSO4 + H2SO4 -> Fe2(SO4)3 + Cr2(SO4)3 + K2SO4 + H2O' },
  { label: 'Fe₃O₄ + HNO₃', eq: 'Fe3O4 + HNO3 -> Fe(NO3)3 + NO↑ + H2O' },
  { label: 'Sản xuất Nhôm Al₂O₃', eq: 'Al2O3 -> Al + O2↑' },
  { label: 'Xà phòng hóa Tristearin', eq: '(C17H35COO)3C3H5 + NaOH -> C17H35COONa + C3H5(OH)3' },
  { label: 'Tráng bạc Glucose', eq: 'C6H12O6 + AgNO3 + NH3 + H2O -> C6H11O7NH4 + Ag↓ + NH4NO3' },
  { label: 'Tổng hợp NH₃', eq: 'N2 + H2 <-> NH3' },
];

const QUICK_TOKENS = [
  '+',
  '->',
  '<->',
  '(',
  ')',
  'H2O',
  'O2',
  'H2',
  'CO2',
  'HCl',
  'H2SO4',
  'HNO3',
  'NaOH',
  'Ba(OH)2',
  'KMnO4',
  'Fe',
  'Al',
  'Cu',
  'Zn',
  'AgNO3',
  'BaCl2',
];

const TOPIC_FILTERS: { id: 'all' | ChemReactionEntry['topic']; label: string }[] = [
  { id: 'all', label: 'Tất cả chủ đề' },
  { id: 'metal_acid', label: 'Kim loại & Acid' },
  { id: 'exchange', label: 'Trao đổi ion' },
  { id: 'redox_gas', label: 'Oxi hóa – Khử & Điều chế' },
  { id: 'oxide_base_salt', label: 'Oxide · Base · Muối' },
  { id: 'organic', label: 'Hóa hữu cơ THPT' },
];

const GRADE_FILTERS = [
  { id: 'all', label: 'Tất cả THPT (10–12)' },
  { id: 'Lớp 10', label: 'Hóa học 10' },
  { id: 'Lớp 11', label: 'Hóa học 11' },
  { id: 'Lớp 12', label: 'Hóa học 12' },
];

export const ChemicalEquationStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<StudioTab>('balancer');

  // 1. Universal Balancer state
  const [eqInput, setEqInput] = useState<string>('KMnO4 + HCl -> KCl + MnCl2 + Cl2↑ + H2O');
  const [eqCondition, setEqCondition] = useState<string>('đặc');

  // 2. Reactant Predictor state
  const [lhsInput, setLhsInput] = useState<string>('Fe + HNO3');

  // 3. Reaction Library state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topicFilter, setTopicFilter] = useState<'all' | ChemReactionEntry['topic']>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // Shared Equation Notebook & Copy feedback
  const [savedList, setSavedList] = useState<SavedEquationItem[]>([
    {
      id: 'init_1',
      formatted: '2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂↑ + 8H₂O',
      latex: '2KMnO_{4} + 16HCl \\rightarrow 2KCl + 2MnCl_{2} + 5Cl_{2}\\uparrow + 8H_{2}O',
      condition: 'đặc',
    },
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const balanceResult = useMemo(() => balanceChemicalEquation(eqInput), [eqInput]);
  const predictionResult = useMemo(() => predictReactionsFromLHS(lhsInput), [lhsInput]);

  const balancedLibrary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CHEM_REACTIONS_DB.filter((entry) => {
      if (topicFilter !== 'all' && entry.topic !== topicFilter) return false;
      if (gradeFilter !== 'all') {
        const num = gradeFilter.replace('Lớp ', '');
        if (!entry.grade.includes(num)) return false;
      }
      if (!q) return true;
      const haystack = [
        ...entry.reactants,
        ...entry.products,
        entry.phenomenon,
        entry.topicLabel,
        entry.condition || '',
        entry.grade,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    }).map((entry) => {
      const raw = `${entry.reactants.join(' + ')} ${entry.arrow} ${entry.products.join(' + ')}`;
      return {
        entry,
        balanced: balanceChemicalEquation(raw),
      };
    });
  }, [searchQuery, topicFilter, gradeFilter]);

  const copyText = (text: string, tag: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(tag);
    setTimeout(() => {
      setCopiedId((prev) => (prev === tag ? null : prev));
    }, 1500);
  };

  const addToNotebook = (formatted: string, latex: string, condition?: string) => {
    setSavedList((prev) => [
      ...prev,
      {
        id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        formatted,
        latex,
        condition,
      },
    ]);
  };

  const insertToken = (tok: string) => {
    setEqInput((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return tok;
      if (tok === '(' || tok === ')') return `${trimmed}${tok}`;
      return `${trimmed} ${tok} `;
    });
  };

  const formatWithCond = (formatted: string, cond?: string) =>
    cond ? `${formatted}   (đk: ${cond})` : formatted;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT MAIN STUDIO */}
      <div className="lg:col-span-8 space-y-4">
        {/* Mode Switcher */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('balancer')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'balancer'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Scale size={15} />
            <span>Cân Bằng Mọi PTHH</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('predictor')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'predictor'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={15} />
            <span>Nhập Vế Trái → Tự Viết</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'library'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={15} />
            <span>Kho Phương Trình ({CHEM_REACTIONS_DB.length})</span>
          </button>
        </div>

        {/* TAB 1: UNIVERSAL BALANCER */}
        {activeTab === 'balancer' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Trình Viết &amp; Cân Bằng Mọi Phương Trình Hóa Học
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập bất kỳ phương trình vô cơ, hữu cơ hay oxi hóa – khử (có ngoặc đơn, mũi tên -&gt;, = hoặc &lt;-&gt;). Hỗ trợ tự sửa chữ hoa/thường.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-9">
                <label htmlFor="chem-eq-input" className="text-[11px] font-bold text-slate-600 block mb-1">
                  Phương trình hóa học cần viết &amp; cân bằng
                </label>
                <input
                  id="chem-eq-input"
                  type="text"
                  value={eqInput}
                  onChange={(e) => setEqInput(e.target.value)}
                  placeholder="Ví dụ: Fe + H2SO4 -> Fe2(SO4)3 + SO2 + H2O"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none font-mono text-sm text-slate-900 bg-slate-50"
                />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="chem-eq-cond" className="text-[11px] font-bold text-slate-600 block mb-1">
                  Điều kiện (tuỳ chọn)
                </label>
                <input
                  id="chem-eq-cond"
                  type="text"
                  value={eqCondition}
                  onChange={(e) => setEqCondition(e.target.value)}
                  placeholder="t°, xt, đặc..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none text-sm text-slate-900 bg-slate-50"
                />
              </div>
            </div>

            {/* Quick Keyboard */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 block">
                Chèn nhanh công thức &amp; ký hiệu:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TOKENS.map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => insertToken(tok)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-xs font-mono font-semibold text-slate-700 cursor-pointer transition-colors"
                  >
                    {tok === '->' ? '→' : tok === '<->' ? '⇌' : toUnicodeSubscripts(tok)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setEqInput('');
                    setEqCondition('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 cursor-pointer"
                >
                  Xóa trắng
                </button>
              </div>
            </div>

            {/* Result Card */}
            {balanceResult.ok ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-800">
                    Phương trình đã cân bằng chính xác
                  </span>
                  {balanceResult.hasMultipleSolutions && (
                    <span className="text-[11px] font-semibold text-amber-700">
                      Hiển thị bộ hệ số nguyên nhỏ nhất.
                    </span>
                  )}
                </div>

                {/* Large rendered chemical equation */}
                <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center overflow-x-auto">
                  <div className="text-base sm:text-xl font-bold text-slate-900 font-mono tracking-tight whitespace-nowrap inline-flex items-center flex-wrap justify-center gap-1.5">
                    {balanceResult.leftTerms.map((term, i) => (
                      <React.Fragment key={`L_${i}`}>
                        {i > 0 && <span className="text-slate-400 mx-0.5">+</span>}
                        <span>
                          {term.coeff > 1 && (
                            <span className="text-emerald-700 font-black mr-0.5">{term.coeff}</span>
                          )}
                          <span>{toUnicodeSubscripts(term.formula)}</span>
                        </span>
                      </React.Fragment>
                    ))}
                    <span className="mx-2 inline-flex flex-col items-center leading-none">
                      {eqCondition.trim() && (
                        <span className="text-[10px] font-sans font-bold text-rose-700 mb-0.5">
                          {eqCondition.trim()}
                        </span>
                      )}
                      <span className="text-emerald-700 font-black">{balanceResult.arrow}</span>
                    </span>
                    {balanceResult.rightTerms.map((term, i) => (
                      <React.Fragment key={`R_${i}`}>
                        {i > 0 && <span className="text-slate-400 mx-0.5">+</span>}
                        <span>
                          {term.coeff > 1 && (
                            <span className="text-emerald-700 font-black mr-0.5">{term.coeff}</span>
                          )}
                          <span>{toUnicodeSubscripts(term.formula)}</span>
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Element conservation check */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Kiểm tra bảo toàn nguyên tố (Vế trái = Vế phải):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {balanceResult.elementBalance.map((chk) => (
                      <div
                        key={chk.element}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-slate-800">{chk.element}</span>
                        <span className="font-mono tabular-nums font-bold text-emerald-700">
                          {chk.leftCount} = {chk.rightCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      copyText(formatWithCond(balanceResult.formattedEquation, eqCondition.trim()), 'bal_txt')
                    }
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === 'bal_txt' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedId === 'bal_txt' ? 'Đã chép' : 'Sao chép chữ'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(`$${balanceResult.latexEquation}$`, 'bal_tex')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === 'bal_tex' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedId === 'bal_tex' ? 'Đã chép LaTeX' : 'Sao chép LaTeX'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addToNotebook(
                        balanceResult.formattedEquation,
                        balanceResult.latexEquation,
                        eqCondition.trim() || undefined
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Lưu vào bảng ghi chép</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900">
                {balanceResult.error}
              </div>
            )}

            {/* Presets */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 block">
                Ví dụ phương trình hay dùng (nhấn để thử):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {BALANCER_EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => {
                      setEqInput(ex.eq);
                      setEqCondition('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 cursor-pointer transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PREDICT FROM REACTANTS */}
        {activeTab === 'predictor' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Nhập Chất Tham Gia → Tự Viết Sản Phẩm &amp; Cân Bằng
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉ cần nhập các chất ở vế trái (ví dụ: Fe + HNO3, Al + NaOH + H2O, BaCl2 + H2SO4, KMnO4). Hệ thống tự tra cứu đa điều kiện và áp dụng quy tắc hóa vô cơ.
              </p>
            </div>

            <div>
              <label htmlFor="chem-lhs-input" className="text-[11px] font-bold text-slate-600 block mb-1">
                Chất tham gia (Vế trái)
              </label>
              <input
                id="chem-lhs-input"
                type="text"
                value={lhsInput}
                onChange={(e) => setLhsInput(e.target.value)}
                placeholder="Ví dụ: Fe + HNO3 hoặc Na2CO3 + HCl"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none font-mono text-sm text-slate-900 bg-slate-50"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                'Fe + HNO3',
                'Cu + H2SO4',
                'Al + NaOH + H2O',
                'Na2CO3 + HCl',
                'Fe2O3 + HCl',
                'Zn + CuSO4',
                'Al2O3',
                'Ca(HCO3)2',
                'CH3COOH + C2H5OH',
                '(C17H35COO)3C3H5 + NaOH',
                'C6H5NH2 + Br2',
                'C4H10 + O2',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setLhsInput(sample)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-200 text-xs font-mono font-semibold text-slate-700 hover:text-emerald-800 cursor-pointer"
                >
                  {toUnicodeSubscripts(sample)}
                </button>
              ))}
            </div>

            {predictionResult.results.length > 0 ? (
              <div className="space-y-3">
                {predictionResult.results.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-emerald-800">{item.sourceLabel}</span>
                      {item.condition && (
                        <span className="font-bold text-rose-700">Điều kiện: {item.condition}</span>
                      )}
                    </div>
                    <div className="bg-white border border-emerald-200 rounded-lg p-3 font-mono text-sm sm:text-base font-bold text-slate-900 overflow-x-auto">
                      {item.balanced.formattedEquation}
                    </div>
                    <p className="text-xs text-slate-600">{item.phenomenon}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            formatWithCond(item.balanced.formattedEquation, item.condition),
                            item.id
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === item.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copiedId === item.id ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          addToNotebook(
                            item.balanced.formattedEquation,
                            item.balanced.latexEquation,
                            item.condition
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Lưu phương trình</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900">
                {predictionResult.error}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SEARCHABLE REACTION LIBRARY */}
        {activeTab === 'library' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo chất (Fe, KMnO4, AlCl3, Ester...) hoặc hiện tượng..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none text-xs sm:text-sm text-slate-900 bg-slate-50"
                />
              </div>
              <div className="sm:col-span-4">
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value as 'all' | ChemReactionEntry['topic'])}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none text-xs sm:text-sm font-semibold text-slate-800 bg-slate-50 cursor-pointer"
                >
                  {TOPIC_FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none text-xs sm:text-sm font-semibold text-slate-800 bg-slate-50 cursor-pointer"
                >
                  {GRADE_FILTERS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {balancedLibrary.map(({ entry, balanced }) => (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-emerald-300 transition-colors space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-semibold">
                    <span>
                      {entry.grade} · {entry.topicLabel}
                    </span>
                    {entry.condition && (
                      <span className="text-rose-700 font-bold">Điều kiện: {entry.condition}</span>
                    )}
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 break-words">
                    {balanced.ok ? balanced.formattedEquation : `${entry.reactants.join(' + ')} ${entry.arrow} ${entry.products.join(' + ')}`}
                  </div>
                  <p className="text-xs text-slate-600">{entry.phenomenon}</p>
                  {balanced.ok && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            formatWithCond(balanced.formattedEquation, entry.condition),
                            `lib_${entry.id}`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === `lib_${entry.id}` ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>{copiedId === `lib_${entry.id}` ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          addToNotebook(balanced.formattedEquation, balanced.latexEquation, entry.condition)
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Lưu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEqInput(
                            `${entry.reactants.join(' + ')} ${entry.arrow === '⇌' ? '<->' : '->'} ${entry.products.join(' + ')}`
                          );
                          setEqCondition(entry.condition || '');
                          setActiveTab('balancer');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Kiểm tra cân bằng</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {balancedLibrary.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  Không tìm thấy phương trình khớp từ khóa "{searchQuery}". Bạn có thể chuyển sang tab "Cân Bằng Mọi PTHH" để tự viết và cân bằng trực tiếp!
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: EQUATION CHAIN NOTEBOOK */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ListChecks size={16} className="text-emerald-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Bảng Ghi Chép Chuỗi PTHH
              </h3>
            </div>
            <span className="font-mono tabular-nums text-xs font-bold text-slate-500">
              {savedList.length} PT
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Lưu các phương trình từ bộ cân bằng hoặc kho tra cứu thành chuỗi phản ứng để sao chép vào bài làm hoặc giáo án.
          </p>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {savedList.map((item, idx) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-emerald-700 font-mono">
                    ({idx + 1}){item.condition ? ` [${item.condition}]` : ''}
                  </div>
                  <div className="font-mono font-bold text-slate-900 break-words mt-0.5">
                    {item.formatted}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSavedList((prev) => prev.filter((x) => x.id !== item.id))}
                  aria-label="Xóa phương trình khỏi danh sách"
                  className="p-1 text-slate-400 hover:text-rose-600 shrink-0 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {savedList.length === 0 && (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Chưa có phương trình nào được lưu.
              </div>
            )}
          </div>

          {savedList.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const allTxt = savedList
                    .map(
                      (item, idx) =>
                        `(${idx + 1}) ${formatWithCond(item.formatted, item.condition)}`
                    )
                    .join('\n');
                  copyText(allTxt, 'all_txt');
                }}
                className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedId === 'all_txt' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedId === 'all_txt' ? 'Đã chép' : 'Chép tất cả'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const allTex = savedList
                    .map((item, idx) => `(${idx + 1})\\; ${item.latex}`)
                    .join(' \\\\\n');
                  copyText(allTex, 'all_tex');
                }}
                className="py-2 px-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedId === 'all_tex' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copiedId === 'all_tex' ? 'Đã chép TeX' : 'Chép LaTeX'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
            <FlaskConical size={15} className="text-emerald-600" />
            <span>Quy Ước Nhập Phương Trình</span>
          </div>
          <ul className="space-y-1 list-disc list-inside leading-relaxed">
            <li>Có thể viết thường hoặc viết liền không chỉ số (ví dụ: <code className="font-mono text-slate-800">fe + hno3 -&gt; fe(no3)3 + no + h2o</code>).</li>
            <li>Dùng <code className="font-mono text-slate-800">&lt;-&gt;</code> cho phản ứng thuận nghịch (<code className="font-mono">⇌</code>).</li>
            <li>Hỗ trợ dấu ngoặc nhóm ion như <code className="font-mono text-slate-800">Fe2(SO4)3</code>, <code className="font-mono text-slate-800">Ca3(PO4)2</code> và muối ngậm nước <code className="font-mono text-slate-800">CuSO4·5H2O</code>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

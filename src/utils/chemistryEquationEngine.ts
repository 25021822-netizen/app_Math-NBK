// ============================================================================
// ĐỘNG CƠ VIẾT, DỰ ĐOÁN & CÂN BẰNG PHƯƠNG TRÌNH HÓA HỌC (EXACT RATIONAL SOLVER)
// ============================================================================

export interface ChemTerm {
  coeff: number;
  formula: string;
  formatted: string;
  latex: string;
}

export interface ElementBalanceCheck {
  element: string;
  leftCount: number;
  rightCount: number;
}

export interface BalanceResult {
  ok: boolean;
  error?: string;
  arrow: '→' | '⇌';
  leftTerms: ChemTerm[];
  rightTerms: ChemTerm[];
  formattedEquation: string;
  plainTextEquation: string;
  latexEquation: string;
  elementBalance: ElementBalanceCheck[];
  hasMultipleSolutions?: boolean;
}

export interface ChemReactionEntry {
  id: string;
  reactants: string[];
  products: string[];
  arrow: '→' | '⇌';
  condition?: string;
  topic: 'metal_acid' | 'exchange' | 'redox_gas' | 'oxide_base_salt' | 'organic';
  topicLabel: string;
  grade: string;
  phenomenon: string;
}

const VALID_ELEMENTS = new Set<string>([
  'H', 'He',
  'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe',
  'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn',
  'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu',
]);

const LOWERCASE_FORMULA_ALIASES: Record<string, string> = {
  h2: 'H2', o2: 'O2', n2: 'N2', cl2: 'Cl2', br2: 'Br2', i2: 'I2', f2: 'F2', s: 'S', p: 'P', c: 'C', si: 'Si',
  h2o: 'H2O', h2o2: 'H2O2', nh3: 'NH3', hcl: 'HCl', hbr: 'HBr', hi: 'HI', hf: 'HF', h2s: 'H2S',
  h2so4: 'H2SO4', hno3: 'HNO3', h3po4: 'H3PO4', h2co3: 'H2CO3', h2so3: 'H2SO3', hclo: 'HClO',
  naoh: 'NaOH', koh: 'KOH', caoh2: 'Ca(OH)2', baoh2: 'Ba(OH)2', mgoh2: 'Mg(OH)2',
  aloh3: 'Al(OH)3', feoh2: 'Fe(OH)2', feoh3: 'Fe(OH)3', cuoh2: 'Cu(OH)2', znoh2: 'Zn(OH)2',
  co: 'CO', co2: 'CO2', so2: 'SO2', so3: 'SO3', no: 'NO', no2: 'NO2', n2o: 'N2O', n2o5: 'N2O5', p2o5: 'P2O5',
  sio2: 'SiO2', na2o: 'Na2O', k2o: 'K2O', cao: 'CaO', bao: 'BaO', mgo: 'MgO', al2o3: 'Al2O3',
  zno: 'ZnO', cuo: 'CuO', cu2o: 'Cu2O', feo: 'FeO', fe2o3: 'Fe2O3', fe3o4: 'Fe3O4', mno2: 'MnO2', cr2o3: 'Cr2O3',
  nacl: 'NaCl', kcl: 'KCl', cacl2: 'CaCl2', bacl2: 'BaCl2', mgcl2: 'MgCl2', alcl3: 'AlCl3',
  zncl2: 'ZnCl2', fecl2: 'FeCl2', fecl3: 'FeCl3', cucl2: 'CuCl2', agcl: 'AgCl', nh4cl: 'NH4Cl',
  na2so4: 'Na2SO4', k2so4: 'K2SO4', baso4: 'BaSO4', caso4: 'CaSO4', mgso4: 'MgSO4',
  al2so43: 'Al2(SO4)3', znso4: 'ZnSO4', feso4: 'FeSO4', fe2so43: 'Fe2(SO4)3', cuso4: 'CuSO4',
  agno3: 'AgNO3', nano3: 'NaNO3', kno3: 'KNO3', nh4no3: 'NH4NO3', cano32: 'Ca(NO3)2',
  bano32: 'Ba(NO3)2', mgno32: 'Mg(NO3)2', alno33: 'Al(NO3)3', znno32: 'Zn(NO3)2',
  feno32: 'Fe(NO3)2', feno33: 'Fe(NO3)3', cuno32: 'Cu(NO3)2',
  na2co3: 'Na2CO3', nahco3: 'NaHCO3', k2co3: 'K2CO3', caco3: 'CaCO3', baco3: 'BaCO3', mgco3: 'MgCO3',
  kmno4: 'KMnO4', k2mno4: 'K2MnO4', kclo3: 'KClO3', k2cr2o7: 'K2Cr2O7', naclo: 'NaClO', caocl2: 'CaOCl2',
  ki: 'KI', nabr: 'NaBr', agbr: 'AgBr', agi: 'AgI', casio3: 'CaSiO3', nahso3: 'NaHSO3', na2so3: 'Na2SO3',
  fes: 'FeS', fes2: 'FeS2', cus: 'CuS', ag2s: 'Ag2S', pbs: 'PbS', naalo2: 'NaAlO2', na2zno2: 'Na2ZnO2',
  cahco32: 'Ca(HCO3)2', mghco32: 'Mg(HCO3)2', khco3: 'KHCO3', nh4hco3: 'NH4HCO3',
  ch4: 'CH4', c2h6: 'C2H6', c3h8: 'C3H8', c4h10: 'C4H10', c2h4: 'C2H4', c2h2: 'C2H2', c6h6: 'C6H6', cac2: 'CaC2',
  ch3oh: 'CH3OH', c2h5oh: 'C2H5OH', c3h5oh3: 'C3H5(OH)3', hcho: 'HCHO', ch3cho: 'CH3CHO', ch3cooh: 'CH3COOH', hcooh: 'HCOOH',
  ch3cooc2h5: 'CH3COOC2H5', ch3coona: 'CH3COONa', hcoona: 'HCOONa', c6h5oh: 'C6H5OH', c6h5ona: 'C6H5ONa',
  c6h5nh2: 'C6H5NH2', ch3nh2: 'CH3NH2', c6h12o6: 'C6H12O6', c12h22o11: 'C12H22O11',
  fe: 'Fe', cu: 'Cu', al: 'Al', mg: 'Mg', zn: 'Zn', na: 'Na', k: 'K', ca: 'Ca', ba: 'Ba', ag: 'Ag', pb: 'Pb', cr: 'Cr', mn: 'Mn', ni: 'Ni',
};

const SUB_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

export function toUnicodeSubscripts(s: string): string {
  return s.replace(/([A-Za-z\)\]])(\d+)/g, (_, prefix: string, digits: string) => {
    const sub = digits
      .split('')
      .map((d) => SUB_DIGITS[Number(d)] ?? d)
      .join('');
    return `${prefix}${sub}`;
  });
}

export function fromUnicodeSubscripts(s: string): string {
  const map: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  };
  return s.replace(/[₀-₉]/g, (ch) => map[ch] ?? ch);
}

export function toLatexFormula(formula: string): string {
  const clean = fromUnicodeSubscripts(formula).replace(/[↑↓]/g, '').trim();
  const base = clean.replace(/([A-Za-z\)\]])(\d+)/g, '$1_{$2}');
  if (formula.includes('↑')) return `${base}\\uparrow`;
  if (formula.includes('↓')) return `${base}\\downarrow`;
  return base;
}

/**
 * Chuẩn hóa công thức người dùng nhập (cho phép viết thường như "fecl3", "h2so4", "kmno4")
 */
export function normalizeUserFormula(raw: string): string {
  let s = fromUnicodeSubscripts(raw).trim();
  // Remove leading stoichiometric coefficient if user pasted an already balanced term,
  // e.g. "2HCl" -> keep coefficient outside or handle in parser. Here just strip state markers (g),(l),(s),(aq), ↑, ↓
  s = s.replace(/\((aq|s|l|g|r|k|dd)\)/gi, '').replace(/[↑↓]/g, '').trim();
  if (!s) return '';

  // Try exact parse first
  if (parseFormulaCounts(s)) return s;

  // Lookup common formula aliases case-insensitively
  const lower = s.toLowerCase();
  if (LOWERCASE_FORMULA_ALIASES[lower]) return LOWERCASE_FORMULA_ALIASES[lower];

  // Attempt segmenting lowercase string into valid chemical elements via backtracking
  const repaired = repairFormulaCase(s);
  if (repaired && parseFormulaCounts(repaired)) return repaired;

  return s;
}

function repairFormulaCase(input: string): string | null {
  const n = input.length;
  const memo = new Map<number, string | null>();

  const dfs = (idx: number): string | null => {
    if (idx === n) return '';
    if (memo.has(idx)) return memo.get(idx) ?? null;

    const ch = input[idx];
    if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '·' || ch === '*') {
      const rest = dfs(idx + 1);
      const ans = rest !== null ? ch + rest : null;
      memo.set(idx, ans);
      return ans;
    }
    if (/\d/.test(ch)) {
      let j = idx;
      while (j < n && /\d/.test(input[j])) j++;
      const rest = dfs(j);
      const ans = rest !== null ? input.slice(idx, j) + rest : null;
      memo.set(idx, ans);
      return ans;
    }
    // Try 1-letter element first, or 2-letter element (prefer exact case or common 1-letter like C+O vs Co)
    const candidates: string[] = [];
    if (idx + 1 < n && /[a-zA-Z]/.test(input[idx + 1])) {
      const two = input[idx].toUpperCase() + input[idx + 1].toLowerCase();
      if (VALID_ELEMENTS.has(two)) candidates.push(two);
    }
    const one = input[idx].toUpperCase();
    if (VALID_ELEMENTS.has(one)) {
      // If lowercase "co", prefer C + O unless it's at start or Co makes sense; actually 1-letter common H,C,N,O,S,P first if 2-letter is uncommon
      if (['C', 'H', 'N', 'O', 'S', 'P', 'K', 'I', 'F', 'B'].includes(one)) {
        candidates.unshift(one);
      } else {
        candidates.push(one);
      }
    }

    for (const el of candidates) {
      const rest = dfs(idx + el.length);
      if (rest !== null) {
        const ans = el + rest;
        memo.set(idx, ans);
        return ans;
      }
    }
    memo.set(idx, null);
    return null;
  };

  return dfs(0);
}

/**
 * Phân tích số nguyên tử từng nguyên tố trong công thức hóa học (hỗ trợ ngoặc () [] và ngậm nước ·)
 */
export function parseFormulaCounts(formula: string): Record<string, number> | null {
  const clean = fromUnicodeSubscripts(formula)
    .replace(/\((aq|s|l|g|r|k|dd)\)/gi, '')
    .replace(/[↑↓]/g, '')
    .replace(/\s+/g, '');

  if (!clean) return null;

  // Handle hydrate parts separated by · or *
  const hydrateParts = clean.split(/[·*]/);
  const totalCounts: Record<string, number> = {};

  for (const part of hydrateParts) {
    if (!part) return null;
    let i = 0;
    let partMult = 1;
    const multMatch = part.match(/^(\d+)/);
    if (multMatch) {
      partMult = Number(multMatch[1]);
      i = multMatch[1].length;
    }

    const stack: Record<string, number>[] = [{}];
    while (i < part.length) {
      const ch = part[i];
      if (ch === '(' || ch === '[') {
        stack.push({});
        i++;
      } else if (ch === ')' || ch === ']') {
        if (stack.length < 2) return null;
        i++;
        let numStr = '';
        while (i < part.length && /\d/.test(part[i])) {
          numStr += part[i++];
        }
        const mult = numStr ? Number(numStr) : 1;
        const group = stack.pop()!;
        const top = stack[stack.length - 1];
        for (const [el, cnt] of Object.entries(group)) {
          top[el] = (top[el] || 0) + cnt * mult;
        }
      } else if (/[A-Z]/.test(ch)) {
        let el = ch;
        i++;
        while (i < part.length && /[a-z]/.test(part[i])) {
          el += part[i++];
        }
        if (!VALID_ELEMENTS.has(el)) return null;
        let numStr = '';
        while (i < part.length && /\d/.test(part[i])) {
          numStr += part[i++];
        }
        const cnt = numStr ? Number(numStr) : 1;
        const top = stack[stack.length - 1];
        top[el] = (top[el] || 0) + cnt;
      } else {
        return null;
      }
    }

    if (stack.length !== 1) return null;
    for (const [el, cnt] of Object.entries(stack[0])) {
      totalCounts[el] = (totalCounts[el] || 0) + cnt * partMult;
    }
  }

  return Object.keys(totalCounts).length > 0 ? totalCounts : null;
}

// ============================================================================
// EXACT BIGINT RATIONAL ARITHMETIC FOR MATRIX NULLSPACE
// ============================================================================
interface Frac {
  n: bigint;
  d: bigint;
}

function absBig(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function gcdBig(a: bigint, b: bigint): bigint {
  a = absBig(a);
  b = absBig(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a === 0n ? 1n : a;
}

function lcmBig(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 1n;
  return absBig((a / gcdBig(a, b)) * b);
}

function frac(n: bigint, d: bigint = 1n): Frac {
  if (d === 0n) throw new Error('Division by zero');
  if (n === 0n) return { n: 0n, d: 1n };
  const sign = d < 0n ? -1n : 1n;
  const g = gcdBig(n, d);
  return { n: (n * sign) / g, d: (d * sign) / g };
}

const fAdd = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
const fDiv = (a: Frac, b: Frac): Frac => frac(a.n * b.d, a.d * b.n);

function toSmallestPositiveIntegers(vec: Frac[]): number[] | null {
  let lcmDen = 1n;
  for (const v of vec) {
    lcmDen = lcmBig(lcmDen, v.d);
  }
  let ints = vec.map((v) => v.n * (lcmDen / v.d));
  if (ints.every((x) => x < 0n)) {
    ints = ints.map((x) => -x);
  }
  if (ints.some((x) => x <= 0n)) return null;

  let g = ints[0];
  for (let i = 1; i < ints.length; i++) {
    g = gcdBig(g, ints[i]);
  }
  return ints.map((x) => Number(x / g));
}

function stripLeadingCoeff(term: string): { formula: string; marker: string } {
  const marker = term.includes('↑') ? '↑' : term.includes('↓') ? '↓' : '';
  const cleaned = term.replace(/[↑↓]/g, '').trim();
  const m = cleaned.match(/^(\d+)\s*([A-Za-z(\[].*)$/);
  const rawFormula = m ? m[2] : cleaned;
  const normalized = normalizeUserFormula(rawFormula);
  return { formula: normalized, marker };
}

/**
 * Cân bằng mọi phương trình hóa học đầu vào bằng giải thuật khử Gauss trên trường hữu tỉ chính xác.
 */
export function balanceChemicalEquation(rawInput: string): BalanceResult {
  const trimmed = rawInput.trim();
  const isReversible = /⇌|<->|<=>/.test(trimmed);
  const arrow: '→' | '⇌' = isReversible ? '⇌' : '→';

  const sides = trimmed.split(/->|=>|→|⇌|<->|<=>|=/);
  if (sides.length !== 2) {
    return {
      ok: false,
      error: 'Hãy nhập đúng dạng: Chất tham gia → Sản phẩm (ví dụ: Fe + HCl -> FeCl2 + H2).',
      arrow,
      leftTerms: [],
      rightTerms: [],
      formattedEquation: '',
      plainTextEquation: '',
      latexEquation: '',
      elementBalance: [],
    };
  }

  const splitSide = (s: string) =>
    s
      .split(/\s*\+\s*/)
      .map((x) => x.trim())
      .filter(Boolean);

  const rawLeft = splitSide(sides[0]);
  const rawRight = splitSide(sides[1]);

  if (rawLeft.length === 0 || rawRight.length === 0) {
    return {
      ok: false,
      error: 'Cần có ít nhất 1 chất ở vế trái và 1 chất ở vế phải.',
      arrow,
      leftTerms: [],
      rightTerms: [],
      formattedEquation: '',
      plainTextEquation: '',
      latexEquation: '',
      elementBalance: [],
    };
  }

  const leftParsed = rawLeft.map(stripLeadingCoeff);
  const rightParsed = rawRight.map(stripLeadingCoeff);
  const allTerms = [...leftParsed, ...rightParsed];
  const countsList: Record<string, number>[] = [];
  const leftElems = new Set<string>();
  const rightElems = new Set<string>();

  for (let idx = 0; idx < allTerms.length; idx++) {
    const t = allTerms[idx];
    const parsed = parseFormulaCounts(t.formula);
    if (!parsed) {
      return {
        ok: false,
        error: `Không nhận diện được công thức hóa học "${t.formula || rawLeft[idx] || rawRight[idx - leftParsed.length]}". Kiểm tra chữ hoa/thường nguyên tố (ví dụ: Cl, Na, Fe, Cu).`,
        arrow,
        leftTerms: [],
        rightTerms: [],
        formattedEquation: '',
        plainTextEquation: '',
        latexEquation: '',
        elementBalance: [],
      };
    }
    countsList.push(parsed);
    for (const el of Object.keys(parsed)) {
      if (idx < leftParsed.length) leftElems.add(el);
      else rightElems.add(el);
    }
  }

  // Check missing elements between sides
  const missingOnRight = [...leftElems].filter((e) => !rightElems.has(e));
  const missingOnLeft = [...rightElems].filter((e) => !leftElems.has(e));
  if (missingOnRight.length > 0 || missingOnLeft.length > 0) {
    const parts: string[] = [];
    if (missingOnRight.length > 0) parts.push(`vế phải thiếu nguyên tố ${missingOnRight.join(', ')}`);
    if (missingOnLeft.length > 0) parts.push(`vế trái thiếu nguyên tố ${missingOnLeft.join(', ')}`);
    return {
      ok: false,
      error: `Không thể cân bằng vì ${parts.join('; ')}.`,
      arrow,
      leftTerms: [],
      rightTerms: [],
      formattedEquation: '',
      plainTextEquation: '',
      latexEquation: '',
      elementBalance: [],
    };
  }

  const elements = [...leftElems];
  const rows = elements.length;
  const cols = allTerms.length;

  // Build rational matrix A (rows x cols)
  const mat: Frac[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cnt = countsList[c][elements[r]] || 0;
      const signed = c < leftParsed.length ? BigInt(cnt) : BigInt(-cnt);
      return frac(signed, 1n);
    })
  );

  // RREF
  let pivotRow = 0;
  const pivotCols: number[] = [];
  for (let c = 0; c < cols && pivotRow < rows; c++) {
    let sel = -1;
    for (let r = pivotRow; r < rows; r++) {
      if (mat[r][c].n !== 0n) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;
    [mat[pivotRow], mat[sel]] = [mat[sel], mat[pivotRow]];

    const piv = mat[pivotRow][c];
    for (let j = c; j < cols; j++) {
      mat[pivotRow][j] = fDiv(mat[pivotRow][j], piv);
    }
    for (let r = 0; r < rows; r++) {
      if (r !== pivotRow && mat[r][c].n !== 0n) {
        const factor = mat[r][c];
        for (let j = c; j < cols; j++) {
          mat[r][j] = fSub(mat[r][j], fMul(factor, mat[pivotRow][j]));
        }
      }
    }
    pivotCols.push(c);
    pivotRow++;
  }

  const freeCols: number[] = [];
  for (let c = 0; c < cols; c++) {
    if (!pivotCols.includes(c)) freeCols.push(c);
  }

  if (freeCols.length === 0) {
    return {
      ok: false,
      error: 'Phương trình chỉ có nghiệm tầm thường (hệ số bằng 0) — kiểm tra lại các chất tham gia hoặc sản phẩm.',
      arrow,
      leftTerms: [],
      rightTerms: [],
      formattedEquation: '',
      plainTextEquation: '',
      latexEquation: '',
      elementBalance: [],
    };
  }

  // Basis vectors of nullspace
  const basis: Frac[][] = freeCols.map((fc) => {
    const vec: Frac[] = Array.from({ length: cols }, () => frac(0n));
    vec[fc] = frac(1n);
    for (let r = 0; r < pivotCols.length; r++) {
      const pc = pivotCols[r];
      vec[pc] = frac(-mat[r][fc].n, mat[r][fc].d);
    }
    return vec;
  });

  let coeffs: number[] | null = null;
  let hasMultipleSolutions = false;

  if (basis.length === 1) {
    coeffs = toSmallestPositiveIntegers(basis[0]);
  } else {
    hasMultipleSolutions = true;
    // Search small positive linear combinations of nullspace basis vectors
    const combineBasis = (weights: number[]): Frac[] =>
      Array.from({ length: cols }, (_, c) => {
        let sum = frac(0n);
        for (let b = 0; b < basis.length; b++) {
          sum = fAdd(sum, fMul(frac(BigInt(weights[b])), basis[b][c]));
        }
        return sum;
      });

    if (basis.length === 2) {
      let bestSum = Infinity;
      for (let w1 = 1; w1 <= 8; w1++) {
        for (let w2 = 1; w2 <= 8; w2++) {
          const cand = toSmallestPositiveIntegers(combineBasis([w1, w2]));
          if (cand) {
            const sum = cand.reduce((a, b) => a + b, 0);
            if (sum < bestSum) {
              bestSum = sum;
              coeffs = cand;
            }
          }
        }
      }
      if (!coeffs) {
        // Also try negative w2 in case basis vectors oppose on one variable
        for (let w1 = 1; w1 <= 8; w1++) {
          for (let w2 = -8; w2 <= -1; w2++) {
            const cand = toSmallestPositiveIntegers(combineBasis([w1, w2]));
            if (cand) {
              coeffs = cand;
              break;
            }
          }
          if (coeffs) break;
        }
      }
    } else {
      coeffs = toSmallestPositiveIntegers(combineBasis(basis.map(() => 1)));
    }
  }

  if (!coeffs) {
    return {
      ok: false,
      error: 'Không tồn tại bộ hệ số nguyên dương để cân bằng phương trình này (có thể thiếu hoặc thừa chất ở một vế).',
      arrow,
      leftTerms: [],
      rightTerms: [],
      formattedEquation: '',
      plainTextEquation: '',
      latexEquation: '',
      elementBalance: [],
    };
  }

  const leftTerms: ChemTerm[] = leftParsed.map((t, idx) => {
    const coeff = coeffs![idx];
    const fullPlain = `${t.formula}${t.marker}`;
    const formattedFormula = toUnicodeSubscripts(fullPlain);
    return {
      coeff,
      formula: fullPlain,
      formatted: `${coeff > 1 ? coeff : ''}${formattedFormula}`,
      latex: `${coeff > 1 ? coeff : ''}${toLatexFormula(fullPlain)}`,
    };
  });

  const rightTerms: ChemTerm[] = rightParsed.map((t, idx) => {
    const coeff = coeffs![leftParsed.length + idx];
    const fullPlain = `${t.formula}${t.marker}`;
    const formattedFormula = toUnicodeSubscripts(fullPlain);
    return {
      coeff,
      formula: fullPlain,
      formatted: `${coeff > 1 ? coeff : ''}${formattedFormula}`,
      latex: `${coeff > 1 ? coeff : ''}${toLatexFormula(fullPlain)}`,
    };
  });

  const formattedEquation = `${leftTerms.map((x) => x.formatted).join(' + ')} ${arrow} ${rightTerms.map((x) => x.formatted).join(' + ')}`;
  const plainTextEquation = `${leftTerms.map((x) => `${x.coeff > 1 ? x.coeff : ''}${x.formula}`).join(' + ')} ${arrow} ${rightTerms.map((x) => `${x.coeff > 1 ? x.coeff : ''}${x.formula}`).join(' + ')}`;
  const latexArrow = arrow === '⇌' ? '\\rightleftharpoons' : '\\rightarrow';
  const latexEquation = `${leftTerms.map((x) => x.latex).join(' + ')} ${latexArrow} ${rightTerms.map((x) => x.latex).join(' + ')}`;

  const elementBalance: ElementBalanceCheck[] = elements.map((el) => {
    let leftCount = 0;
    let rightCount = 0;
    for (let i = 0; i < leftParsed.length; i++) {
      leftCount += (countsList[i][el] || 0) * coeffs![i];
    }
    for (let i = 0; i < rightParsed.length; i++) {
      rightCount += (countsList[leftParsed.length + i][el] || 0) * coeffs![leftParsed.length + i];
    }
    return { element: el, leftCount, rightCount };
  });

  return {
    ok: true,
    arrow,
    leftTerms,
    rightTerms,
    formattedEquation,
    plainTextEquation,
    latexEquation,
    elementBalance,
    hasMultipleSolutions,
  };
}

// ============================================================================
// KHO PHƯƠNG TRÌNH HÓA HỌC CHUẨN CHƯƠNG TRÌNH THPT GDPT 2018 (LỚP 10 · 11 · 12)
// ============================================================================
export const CHEM_REACTIONS_DB: ChemReactionEntry[] = [
  // 1. KIM LOẠI + ACID / NƯỚC / KIỀM / PHI KIM / MUỐI
  {
    id: 'mg_hcl',
    reactants: ['Mg', 'HCl'],
    products: ['MgCl2', 'H2↑'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Magie tan nhanh, sủi bọt khí H₂ không màu mạnh.',
  },
  {
    id: 'al_hcl',
    reactants: ['Al', 'HCl'],
    products: ['AlCl3', 'H2↑'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Nhôm tan dần, giải phóng khí hiđro.',
  },
  {
    id: 'zn_hcl',
    reactants: ['Zn', 'HCl'],
    products: ['ZnCl2', 'H2↑'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Kẽm tan, sủi bọt khí H₂ đều (dùng điều chế H₂ trong phòng thí nghiệm).',
  },
  {
    id: 'fe_hcl',
    reactants: ['Fe', 'HCl'],
    products: ['FeCl2', 'H2↑'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Sắt tan tạo dung dịch muối Fe(II) lục nhạt và giải phóng khí H₂.',
  },
  {
    id: 'fe_h2so4_dil',
    reactants: ['Fe', 'H2SO4'],
    products: ['FeSO4', 'H2↑'],
    arrow: '→',
    condition: 'loãng',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Dung dịch chuyển màu xanh lục nhạt FeSO₄, sủi bọt khí H₂.',
  },
  {
    id: 'al_h2so4_dil',
    reactants: ['Al', 'H2SO4'],
    products: ['Al2(SO4)3', 'H2↑'],
    arrow: '→',
    condition: 'loãng',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Nhôm tan, sủi bọt khí H₂.',
  },
  {
    id: 'cu_hno3_conc',
    reactants: ['Cu', 'HNO3'],
    products: ['Cu(NO3)2', 'NO2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Đồng tan, dung dịch hóa xanh lam và thoát khí NO₂ màu nâu đỏ.',
  },
  {
    id: 'cu_hno3_dil',
    reactants: ['Cu', 'HNO3'],
    products: ['Cu(NO3)2', 'NO↑', 'H2O'],
    arrow: '→',
    condition: 'loãng',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Dung dịch xanh lam, thoát khí NO không màu hóa nâu ngoài không khí.',
  },
  {
    id: 'fe_hno3_dil',
    reactants: ['Fe', 'HNO3'],
    products: ['Fe(NO3)3', 'NO↑', 'H2O'],
    arrow: '→',
    condition: 'loãng, dư HNO₃',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Sắt tan tạo muối Fe(III) vàng nâu và khí NO không màu hóa nâu trong không khí.',
  },
  {
    id: 'fe_hno3_conc_hot',
    reactants: ['Fe', 'HNO3'],
    products: ['Fe(NO3)3', 'NO2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc, t°',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Đun nóng phá vỡ lớp thụ động, thoát khí NO₂ nâu đỏ mạnh.',
  },
  {
    id: 'al_hno3_dil_n2o',
    reactants: ['Al', 'HNO3'],
    products: ['Al(NO3)3', 'N2O↑', 'H2O'],
    arrow: '→',
    condition: 'loãng',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Nhôm tan, thoát khí N₂O không màu.',
  },
  {
    id: 'cu_h2so4_conc',
    reactants: ['Cu', 'H2SO4'],
    products: ['CuSO4', 'SO2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc, t°',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Dung dịch hóa xanh lam CuSO₄ và giải phóng khí SO₂ mùi hắc.',
  },
  {
    id: 'fe_h2so4_conc',
    reactants: ['Fe', 'H2SO4'],
    products: ['Fe2(SO4)3', 'SO2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc, t°',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Sắt tan khi đun nóng, thu được muối Fe(III) và khí SO₂.',
  },
  {
    id: 'na_h2o',
    reactants: ['Na', 'H2O'],
    products: ['NaOH', 'H2↑'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Natri nóng chảy thành giọt tròn chạy trên mặt nước, sủi bọt khí H₂.',
  },
  {
    id: 'ca_h2o',
    reactants: ['Ca', 'H2O'],
    products: ['Ca(OH)2', 'H2↑'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Canxi tan, dung dịch hơi đục Ca(OH)₂ và thoát khí H₂.',
  },
  {
    id: 'al_naoh_h2o',
    reactants: ['Al', 'NaOH', 'H2O'],
    products: ['NaAlO2', 'H2↑'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Nhôm tan trong dung dịch kiềm giải phóng khí H₂ (tạo phức [Al(OH)₄]⁻ / NaAlO₂).',
  },
  {
    id: 'fe_cuso4',
    reactants: ['Fe', 'CuSO4'],
    products: ['FeSO4', 'Cu↓'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Đồng màu đỏ bám lên thanh sắt, dung dịch xanh lam nhạt dần sang lục nhạt.',
  },
  {
    id: 'cu_agno3',
    reactants: ['Cu', 'AgNO3'],
    products: ['Cu(NO3)2', 'Ag↓'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Bạc trắng xám bám ngoài dây đồng, dung dịch dần chuyển xanh lam.',
  },
  {
    id: 'fe_cl2',
    reactants: ['Fe', 'Cl2'],
    products: ['FeCl3'],
    arrow: '→',
    condition: 't°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Sắt cháy sáng trong khí Clo tạo khói nâu đỏ FeCl₃.',
  },
  {
    id: 'fe_o2',
    reactants: ['Fe', 'O2'],
    products: ['Fe3O4'],
    arrow: '→',
    condition: 't°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Sắt cháy mạnh bắn ra tia sáng chói tạo hạt oxit sắt từ Fe₃O₄.',
  },
  {
    id: 'al_fe2o3',
    reactants: ['Al', 'Fe2O3'],
    products: ['Al2O3', 'Fe'],
    arrow: '→',
    condition: 't° (nhiệt nhôm)',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Phản ứng nhiệt nhôm tỏa nhiệt rất lớn làm sắt nóng chảy (dùng hàn đường ray).',
  },
  {
    id: 'al2o3_dpnc',
    reactants: ['Al2O3'],
    products: ['Al', 'O2↑'],
    arrow: '→',
    condition: 'đpnc, criolit 950°C',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Sản xuất nhôm trong công nghiệp theo quy trình Hall–Héroult; Anot than chì bị đốt cháy dần.',
  },
  {
    id: 'nacl_dpnc',
    reactants: ['NaCl'],
    products: ['Na', 'Cl2↑'],
    arrow: '→',
    condition: 'đpnc',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Điều chế kim loại kiềm Na ở Catot (−) và khí Cl₂ vàng lục ở Anot (+).',
  },
  {
    id: 'mgcl2_dpnc',
    reactants: ['MgCl2'],
    products: ['Mg', 'Cl2↑'],
    arrow: '→',
    condition: 'đpnc',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Điều chế kim loại Magie bằng phương pháp điện phân muối nóng chảy.',
  },
  {
    id: 'nacl_h2o_dpdd',
    reactants: ['NaCl', 'H2O'],
    products: ['NaOH', 'Cl2↑', 'H2↑'],
    arrow: '→',
    condition: 'đpdd có màng ngăn',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Công nghiệp Xút – Clo: thu được NaOH ở Catot, khí H₂ ở Catot và khí Cl₂ ở Anot.',
  },
  {
    id: 'nacl_h2o_javel',
    reactants: ['NaCl', 'H2O'],
    products: ['NaClO', 'H2↑'],
    arrow: '→',
    condition: 'đpdd không màng ngăn',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Cl₂ sinh ra phản ứng ngay với NaOH tạo nước Javel (NaCl + NaClO) tẩy rửa, sát khuẩn.',
  },
  {
    id: 'cuso4_h2o_dpdd',
    reactants: ['CuSO4', 'H2O'],
    products: ['Cu↓', 'O2↑', 'H2SO4'],
    arrow: '→',
    condition: 'đpdd cực trơ',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Đồng đỏ bám lên Catot, khí O₂ thoát ra ở Anot trơ và dung dịch nhạt màu xanh.',
  },
  {
    id: 'agno3_h2o_dpdd',
    reactants: ['AgNO3', 'H2O'],
    products: ['Ag↓', 'O2↑', 'HNO3'],
    arrow: '→',
    condition: 'đpdd cực trơ',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Bạc kim loại bám lên Catot (−), khí O₂ thoát ra tại Anot (+), pH dung dịch giảm.',
  },
  {
    id: 'zn_cuso4',
    reactants: ['Zn', 'CuSO4'],
    products: ['ZnSO4', 'Cu↓'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Phản ứng gốc trong Pin Galvani Zn–Cu (E° = 1,10 V): Zn tan, Cu đỏ bám lên điện cực.',
  },
  {
    id: 'fe_fecl3',
    reactants: ['Fe', 'FeCl3'],
    products: ['FeCl2'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Sắt khử ion Fe³⁺ màu vàng nâu về Fe²⁺ màu lục nhạt.',
  },
  {
    id: 'cu_fecl3',
    reactants: ['Cu', 'FeCl3'],
    products: ['CuCl2', 'FeCl2'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Đồng tan dần trong dung dịch muối sắt(III) (E°(Fe³⁺/Fe²⁺) = +0,77 V > +0,34 V).',
  },
  {
    id: 'feno32_agno3',
    reactants: ['Fe(NO3)2', 'AgNO3'],
    products: ['Fe(NO3)3', 'Ag↓'],
    arrow: '→',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Ion Ag⁺ oxi hóa Fe²⁺ lên Fe³⁺, tạo kết tủa bạc kim loại trắng xám.',
  },
  {
    id: 'zn_naoh_h2o',
    reactants: ['Zn', 'NaOH'],
    products: ['Na2ZnO2', 'H2↑'],
    arrow: '→',
    condition: 'dd NaOH',
    topic: 'metal_acid',
    topicLabel: 'Kim loại & Acid',
    grade: 'Lớp 12',
    phenomenon: 'Kẽm tan trong dung dịch kiềm mạnh tạo muối zincat và giải phóng khí H₂.',
  },
  {
    id: 'cuo_co',
    reactants: ['CuO', 'CO'],
    products: ['Cu', 'CO2↑'],
    arrow: '→',
    condition: 't°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Bột CuO đen chuyển thành đồng kim loại màu đỏ (phương pháp nhiệt luyện).',
  },
  {
    id: 'cuo_h2',
    reactants: ['CuO', 'H2'],
    products: ['Cu', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Khử CuO đen bằng dòng khí H₂ nóng thu được Cu đỏ và hơi nước ngưng tụ.',
  },
  {
    id: 'fe3o4_co',
    reactants: ['Fe3O4', 'CO'],
    products: ['Fe', 'CO2↑'],
    arrow: '→',
    condition: 't°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Khử oxide sắt từ bằng khí CO trong công nghiệp luyện gang.',
  },

  // 2. TRAO ĐỔI ION TRONG DUNG DỊCH
  {
    id: 'agno3_nacl',
    reactants: ['AgNO3', 'NaCl'],
    products: ['AgCl↓', 'NaNO3'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 10 · 11',
    phenomenon: 'Xuất hiện kết tủa trắng AgCl bền trong acid.',
  },
  {
    id: 'bacl2_na2so4',
    reactants: ['BaCl2', 'Na2SO4'],
    products: ['BaSO4↓', 'NaCl'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 11',
    phenomenon: 'Xuất hiện kết tủa trắng BaSO₄ không tan trong acid và kiềm.',
  },
  {
    id: 'bacl2_h2so4',
    reactants: ['BaCl2', 'H2SO4'],
    products: ['BaSO4↓', 'HCl'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 11',
    phenomenon: 'Tạo kết tủa trắng BaSO₄ nhận biết ion sulfate SO₄²⁻.',
  },
  {
    id: 'cuso4_naoh',
    reactants: ['CuSO4', 'NaOH'],
    products: ['Cu(OH)2↓', 'Na2SO4'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Xuất hiện kết tủa keo màu xanh lam Cu(OH)₂.',
  },
  {
    id: 'alcl3_naoh',
    reactants: ['AlCl3', 'NaOH'],
    products: ['Al(OH)3↓', 'NaCl'],
    arrow: '→',
    condition: 'vừa đủ NaOH',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Xuất hiện kết tủa keo trắng Al(OH)₃ (nếu NaOH dư kết tủa sẽ tan dần).',
  },
  {
    id: 'fecl3_naoh',
    reactants: ['FeCl3', 'NaOH'],
    products: ['Fe(OH)3↓', 'NaCl'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Xuất hiện kết tủa nâu đỏ Fe(OH)₃.',
  },
  {
    id: 'feso4_naoh',
    reactants: ['FeSO4', 'NaOH'],
    products: ['Fe(OH)2↓', 'Na2SO4'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Kết tủa trắng xanh Fe(OH)₂ (nhanh chóng hóa nâu đỏ ngoài không khí).',
  },
  {
    id: 'na2co3_hcl',
    reactants: ['Na2CO3', 'HCl'],
    products: ['NaCl', 'CO2↑', 'H2O'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 11',
    phenomenon: 'Sủi bọt khí CO₂ không màu mạnh.',
  },
  {
    id: 'caco3_hcl',
    reactants: ['CaCO3', 'HCl'],
    products: ['CaCl2', 'CO2↑', 'H2O'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 10 · 11',
    phenomenon: 'Đá vôi tan dần và sủi bọt khí CO₂ mạnh.',
  },
  {
    id: 'nahco3_hcl',
    reactants: ['NaHCO3', 'HCl'],
    products: ['NaCl', 'CO2↑', 'H2O'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Sủi bọt khí CO₂ ngay lập tức.',
  },
  {
    id: 'nahco3_naoh',
    reactants: ['NaHCO3', 'NaOH'],
    products: ['Na2CO3', 'H2O'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Ion HCO₃⁻ lưỡng tính tác dụng với kiềm tạo muối trung hòa.',
  },
  {
    id: 'nh4cl_naoh',
    reactants: ['NH4Cl', 'NaOH'],
    products: ['NaCl', 'NH3↑', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 11',
    phenomenon: 'Thoát khí NH₃ mùi khai làm xanh giấy quỳ tím ẩm (nhận biết ion ammonium NH₄⁺).',
  },
  {
    id: 'naoh_hcl',
    reactants: ['NaOH', 'HCl'],
    products: ['NaCl', 'H2O'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 10 · 11',
    phenomenon: 'Phản ứng trung hòa tỏa nhiệt (ΔᵣH°₂₉₈ = -57,3 kJ), tạo chất điện li yếu H₂O.',
  },
  {
    id: 'feoh3_hcl',
    reactants: ['Fe(OH)3', 'HCl'],
    products: ['FeCl3', 'H2O'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Kết tủa nâu đỏ Fe(OH)₃ tan tạo dung dịch vàng nâu FeCl₃.',
  },
  {
    id: 'aloh3_naoh',
    reactants: ['Al(OH)3', 'NaOH'],
    products: ['NaAlO2', 'H2O'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Kết tủa keo trắng Al(OH)₃ lưỡng tính tan trong dung dịch NaOH.',
  },

  // 3. ĐIỀU CHẾ KHÍ, HALOGEN, NITROGEN–SULFUR & OXI HÓA - KHỬ
  {
    id: 'kmno4_heat',
    reactants: ['KMnO4'],
    products: ['K2MnO4', 'MnO2', 'O2↑'],
    arrow: '→',
    condition: 't°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Điều chế khí O₂ trong phòng thí nghiệm bằng nhiệt phân KMnO₄.',
  },
  {
    id: 'kclo3_heat',
    reactants: ['KClO3'],
    products: ['KCl', 'O2↑'],
    arrow: '→',
    condition: 'MnO₂, t°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'KClO₃ phân hủy nhanh nhờ xúc tác MnO₂ giải phóng khí O₂.',
  },
  {
    id: 'h2o2_decomp',
    reactants: ['H2O2'],
    products: ['H2O', 'O2↑'],
    arrow: '→',
    condition: 'xúc tác MnO₂',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Khảo sát xúc tác tốc độ phản ứng: H₂O₂ phân hủy mạnh ở nhiệt độ thường tạo bọt khí O₂.',
  },
  {
    id: 'kmno4_hcl_conc',
    reactants: ['KMnO4', 'HCl'],
    products: ['KCl', 'MnCl2', 'Cl2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Điều chế khí Cl₂ màu vàng lục mùi hắc trong phòng thí nghiệm.',
  },
  {
    id: 'mno2_hcl_conc',
    reactants: ['MnO2', 'HCl'],
    products: ['MnCl2', 'Cl2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc, t°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Đun nóng MnO₂ với HCl đặc giải phóng khí Cl₂ vàng lục.',
  },
  {
    id: 'cl2_naoh',
    reactants: ['Cl2', 'NaOH'],
    products: ['NaCl', 'NaClO', 'H2O'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Điều chế nước Javel có tính oxi hóa mạnh, tẩy màu và sát trùng.',
  },
  {
    id: 'cl2_nabr',
    reactants: ['Cl2', 'NaBr'],
    products: ['NaCl', 'Br2'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Dung dịch chuyển sang màu vàng nâu do Cl₂ oxi hóa Br⁻ thành Br₂ (tính oxi hóa Cl₂ > Br₂).',
  },
  {
    id: 'so2_br2_h2o',
    reactants: ['SO2', 'Br2', 'H2O'],
    products: ['H2SO4', 'HBr'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Khí SO₂ làm mất màu nâu đỏ của nước bromine (thể hiện tính khử của SO₂).',
  },
  {
    id: 'fes2_o2',
    reactants: ['FeS2', 'O2'],
    products: ['Fe2O3', 'SO2↑'],
    arrow: '→',
    condition: 't°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10 · 11',
    phenomenon: 'Đốt quặng pirit sắt (pyrite) trong công nghiệp sản xuất H₂SO₄.',
  },
  {
    id: 'n2_h2',
    reactants: ['N2', 'H2'],
    products: ['NH3'],
    arrow: '⇌',
    condition: 't°, p, xt Fe',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Tổng hợp ammonia thuận nghịch (quy trình Haber-Bosch, ΔᵣH°₂₉₈ = -91,8 kJ).',
  },
  {
    id: 'nh3_o2_pt',
    reactants: ['NH3', 'O2'],
    products: ['NO↑', 'H2O'],
    arrow: '→',
    condition: '850°C, xt Pt',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Giai đoạn đầu điều chế nitric acid HNO₃ trong công nghiệp.',
  },
  {
    id: 'no2_dimer',
    reactants: ['NO2'],
    products: ['N2O4'],
    arrow: '⇌',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Cân bằng chuyển dịch màu nâu đỏ (NO₂) sang không màu (N₂O₄), ΔᵣH°₂₉₈ = -57,2 kJ.',
  },
  {
    id: 'so2_o2',
    reactants: ['SO2', 'O2'],
    products: ['SO3'],
    arrow: '⇌',
    condition: '450°C, V₂O₅',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Oxi hóa sulfur dioxide tạo sulfur trioxide trong sản xuất H₂SO₄ (phương pháp tiếp xúc).',
  },
  {
    id: 'kmno4_feso4_h2so4',
    reactants: ['KMnO4', 'FeSO4', 'H2SO4'],
    products: ['Fe2(SO4)3', 'K2SO4', 'MnSO4', 'H2O'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Màu tím của KMnO₄ mất màu nhanh khi chuẩn độ dung dịch Fe²⁺ trong môi trường H₂SO₄ loãng.',
  },
  {
    id: 'k2cr2o7_feso4_h2so4',
    reactants: ['K2Cr2O7', 'FeSO4', 'H2SO4'],
    products: ['Fe2(SO4)3', 'Cr2(SO4)3', 'K2SO4', 'H2O'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 12',
    phenomenon: 'Dung dịch chuyển từ màu da cam (Cr₂O₇²⁻) sang xanh lục (Cr³⁺).',
  },
  {
    id: 'cl2_ki',
    reactants: ['Cl2', 'KI'],
    products: ['KCl', 'I2↓'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Cl₂ đẩy I₂ ra khỏi muối KI, làm xanh hồ tinh bột (tính oxi hóa Cl₂ > I₂).',
  },
  {
    id: 'cl2_koh_hot',
    reactants: ['Cl2', 'KOH'],
    products: ['KCl', 'KClO3', 'H2O'],
    arrow: '→',
    condition: 't° (80–100°C)',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Cl₂ tự oxi hóa – tự khử trong kiềm nóng tạo potassium chlorate KClO₃.',
  },
  {
    id: 'caoh2_cl2_bleach',
    reactants: ['Ca(OH)2', 'Cl2'],
    products: ['CaOCl2', 'H2O'],
    arrow: '→',
    condition: '30°C',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 10',
    phenomenon: 'Điều chế clorua vôi (chất tẩy trắng và khử trùng).',
  },
  {
    id: 'nh3_hcl_smoke',
    reactants: ['NH3', 'HCl'],
    products: ['NH4Cl'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Tạo đám khói trắng dày đặc các tinh thể NH₄Cl (nhận biết khí NH₃ / HCl).',
  },
  {
    id: 'no_o2_brown',
    reactants: ['NO', 'O2'],
    products: ['NO2↑'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Khí NO không màu hóa nâu đỏ ngay khi tiếp xúc với oxi không khí (giai đoạn sản xuất HNO₃).',
  },
  {
    id: 'no2_o2_h2o_hno3',
    reactants: ['NO2', 'O2', 'H2O'],
    products: ['HNO3'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Hấp thụ NO₂ cùng không khí vào nước trong tháp tổng hợp nitric acid HNO₃.',
  },
  {
    id: 'h2s_so2',
    reactants: ['H2S', 'SO2'],
    products: ['S↓', 'H2O'],
    arrow: '→',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'Khí H₂S khử SO₂ tạo kết tủa bột lưu huỳnh màu vàng.',
  },
  {
    id: 'c_h2so4_conc',
    reactants: ['C', 'H2SO4'],
    products: ['CO2↑', 'SO2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc, t°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'H₂SO₄ đặc nóng oxi hóa phi kim carbon tạo hỗn hợp khí CO₂ và SO₂.',
  },
  {
    id: 'c_hno3_conc',
    reactants: ['C', 'HNO3'],
    products: ['CO2↑', 'NO2↑', 'H2O'],
    arrow: '→',
    condition: 'đặc, t°',
    topic: 'redox_gas',
    topicLabel: 'Oxi hóa – Khử & Điều chế',
    grade: 'Lớp 11',
    phenomenon: 'HNO₃ đặc nóng oxi hóa than nóng đỏ giải phóng khí NO₂ màu nâu đỏ và CO₂.',
  },

  // 4. OXIT – BASE – MUỐI – NHIỆT PHÂN
  {
    id: 'cao_h2o',
    reactants: ['CaO', 'H2O'],
    products: ['Ca(OH)2'],
    arrow: '→',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Phản ứng tôi vôi tỏa nhiệt rất mạnh (ΔᵣH°₂₉₈ = -65,2 kJ).',
  },
  {
    id: 'co2_caoh2',
    reactants: ['CO2', 'Ca(OH)2'],
    products: ['CaCO3↓', 'H2O'],
    arrow: '→',
    condition: 'dư Ca(OH)₂',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Làm đục nước vôi trong do tạo kết tủa trắng CaCO₃.',
  },
  {
    id: 'caco3_heat',
    reactants: ['CaCO3'],
    products: ['CaO', 'CO2↑'],
    arrow: '→',
    condition: 't° (~900°C)',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 10 · 12',
    phenomenon: 'Phản ứng thu nhiệt (ΔᵣH°₂₉₈ = +179,2 kJ): nung đá vôi tạo CaO và khí CO₂.',
  },
  {
    id: 'cuoh2_heat',
    reactants: ['Cu(OH)2'],
    products: ['CuO', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Kết tủa xanh lam chuyển thành chất rắn màu đen CuO.',
  },
  {
    id: 'feoh3_heat',
    reactants: ['Fe(OH)3'],
    products: ['Fe2O3', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Nhiệt phân hydroxide nâu đỏ tạo oxide Fe₂O₃ màu đỏ nâu.',
  },
  {
    id: 'feoh2_o2_h2o',
    reactants: ['Fe(OH)2', 'O2', 'H2O'],
    products: ['Fe(OH)3↓'],
    arrow: '→',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Kết tủa trắng xanh Fe(OH)₂ bị oxi hóa nhanh ngoài không khí thành Fe(OH)₃ nâu đỏ.',
  },
  {
    id: 'fe2o3_co',
    reactants: ['Fe2O3', 'CO'],
    products: ['Fe', 'CO2↑'],
    arrow: '→',
    condition: 't°',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Khử iron(III) oxide trong lò cao luyện gang.',
  },
  {
    id: 'fe3o4_hcl',
    reactants: ['Fe3O4', 'HCl'],
    products: ['FeCl2', 'FeCl3', 'H2O'],
    arrow: '→',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Oxide sắt từ tan tạo hỗn hợp đồng thời cả muối Fe(II) và Fe(III).',
  },
  {
    id: 'al2o3_naoh',
    reactants: ['Al2O3', 'NaOH'],
    products: ['NaAlO2', 'H2O'],
    arrow: '→',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Oxide lưỡng tính Al₂O₃ tan trong dung dịch kiềm.',
  },
  {
    id: 'agno3_heat',
    reactants: ['AgNO3'],
    products: ['Ag', 'NO2↑', 'O2↑'],
    arrow: '→',
    condition: 't°',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Muối nitrate của kim loại sau Cu nhiệt phân tạo kim loại Ag, khí NO₂ nâu đỏ và O₂.',
  },
  {
    id: 'cu_no3_2_heat',
    reactants: ['Cu(NO3)2'],
    products: ['CuO', 'NO2↑', 'O2↑'],
    arrow: '→',
    condition: 't°',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Tinh thể xanh lam chuyển thành bột CuO đen, thoát khí NO₂ nâu đỏ.',
  },
  {
    id: 'cahco32_heat',
    reactants: ['Ca(HCO3)2'],
    products: ['CaCO3↓', 'CO2↑', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Đun sôi làm mất tính cứng tạm thời của nước (tạo cặn trắng CaCO₃ trong ấm đun).',
  },
  {
    id: 'caco3_co2_h2o',
    reactants: ['CaCO3', 'CO2', 'H2O'],
    products: ['Ca(HCO3)2'],
    arrow: '→',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Giải thích sự xâm thực đá vôi tạo hang động và hiện tượng tạo thạch nhũ.',
  },
  {
    id: 'cacl2_na2co3_soften',
    reactants: ['CaCl2', 'Na2CO3'],
    products: ['CaCO3↓', 'NaCl'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Làm mềm nước cứng vĩnh cửu và nước cứng toàn phần bằng soda Na₂CO₃.',
  },
  {
    id: 'naalo2_co2_h2o',
    reactants: ['NaAlO2', 'CO2', 'H2O'],
    products: ['Al(OH)3↓', 'NaHCO3'],
    arrow: '→',
    condition: 'dư CO₂',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Sục khí CO₂ dư tạo kết tủa keo trắng Al(OH)₃ không bị hòa tan lại.',
  },
  {
    id: 'cao_sio2_slag',
    reactants: ['CaO', 'SiO2'],
    products: ['CaSiO3'],
    arrow: '→',
    condition: 't° (lò cao)',
    topic: 'oxide_base_salt',
    topicLabel: 'Oxide · Base · Muối',
    grade: 'Lớp 12',
    phenomenon: 'Tạo xỉ CaSiO₃ nhẹ nổi trên gang lỏng trong lò cao luyện gang.',
  },
  {
    id: 'cuoh2_nh3_complex',
    reactants: ['Cu(OH)2', 'NH3'],
    products: ['[Cu(NH3)4](OH)2'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Kết tủa xanh lam Cu(OH)₂ tan trong NH₃ dư tạo dung dịch phức chất màu xanh thẫm.',
  },
  {
    id: 'agcl_nh3_complex',
    reactants: ['AgCl', 'NH3'],
    products: ['[Ag(NH3)2]Cl'],
    arrow: '→',
    topic: 'exchange',
    topicLabel: 'Trao đổi ion',
    grade: 'Lớp 12',
    phenomenon: 'Kết tủa trắng AgCl tan trong dung dịch NH₃ tạo phức bạc diamine.',
  },

  // 5. HÓA HỌC HỮU CƠ THPT (Lớp 11 · 12)
  {
    id: 'ch4_o2',
    reactants: ['CH4', 'O2'],
    products: ['CO2↑', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 10 · 11',
    phenomenon: 'Đốt cháy hoàn toàn methane bằng ngọn lửa xanh nhạt, tỏa nhiều nhiệt (ΔᵣH°₂₉₈ = -890 kJ).',
  },
  {
    id: 'c2h4_br2',
    reactants: ['C2H4', 'Br2'],
    products: ['C2H4Br2'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Ethylene làm mất màu nâu đỏ của dung dịch bromine (phản ứng cộng alkene).',
  },
  {
    id: 'c2h2_o2',
    reactants: ['C2H2', 'O2'],
    products: ['CO2↑', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Acetylene cháy tỏa nhiệt cực cao (dùng trong đèn xì oxygen–acetylene).',
  },
  {
    id: 'c2h5oh_na',
    reactants: ['C2H5OH', 'Na'],
    products: ['C2H5ONa', 'H2↑'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Natri chìm xuống, tan dần và sủi bọt khí H₂ êm dịu.',
  },
  {
    id: 'ch3cho_tollens',
    reactants: ['CH3CHO', 'AgNO3', 'NH3', 'H2O'],
    products: ['CH3COONH4', 'Ag↓', 'NH4NO3'],
    arrow: '→',
    condition: 't° nhẹ',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Phản ứng tráng bạc (thuốc thử Tollens): tạo lớp bạc trắng sáng bám lên thành ống nghiệm.',
  },
  {
    id: 'esterification',
    reactants: ['CH3COOH', 'C2H5OH'],
    products: ['CH3COOC2H5', 'H2O'],
    arrow: '⇌',
    condition: 'H₂SO₄ đặc, t°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Phản ứng ester hóa tạo ethyl acetate mùi thơm hoa quả nổi thành lớp chất lỏng phía trên.',
  },
  {
    id: 'ester_naoh',
    reactants: ['CH3COOC2H5', 'NaOH'],
    products: ['CH3COONa', 'C2H5OH'],
    arrow: '→',
    condition: 't°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Thủy phân ester trong môi trường kiềm (xà phòng hóa) tạo hỗn hợp đồng nhất.',
  },
  {
    id: 'glucose_o2_ferment',
    reactants: ['C6H12O6'],
    products: ['C2H5OH', 'CO2↑'],
    arrow: '→',
    condition: 'enzyme, 30–35°C',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Lên men glucose tạo ethanol và sủi bọt khí CO₂.',
  },
  {
    id: 'glucose_burn',
    reactants: ['C6H12O6', 'O2'],
    products: ['CO2↑', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Oxi hóa hoàn toàn glucose cung cấp năng lượng.',
  },
  {
    id: 'acetic_na2co3',
    reactants: ['CH3COOH', 'Na2CO3'],
    products: ['CH3COONa', 'CO2↑', 'H2O'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Acetic acid đẩy H₂CO₃ ra khỏi muối carbonate, sủi bọt khí CO₂.',
  },
  {
    id: 'cac2_h2o',
    reactants: ['CaC2', 'H2O'],
    products: ['C2H2↑', 'Ca(OH)2'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Điều chế khí acetylene từ đất đèn (calcium carbide) trong phòng thí nghiệm.',
  },
  {
    id: 'c2h4_h2o',
    reactants: ['C2H4', 'H2O'],
    products: ['C2H5OH'],
    arrow: '→',
    condition: 'H⁺, t°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Hiđrat hóa ethylene tạo ethanol trong công nghiệp.',
  },
  {
    id: 'c6h6_br2',
    reactants: ['C6H6', 'Br2'],
    products: ['C6H5Br', 'HBr↑'],
    arrow: '→',
    condition: 'bột Fe hoặc FeBr₃, t°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Phản ứng thế bromine vào vòng benzene tạo bromobenzene lỏng nặng hơn nước.',
  },
  {
    id: 'c6h6_hno3',
    reactants: ['C6H6', 'HNO3'],
    products: ['C6H5NO2', 'H2O'],
    arrow: '→',
    condition: 'H₂SO₄ đặc, t°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Nitro hóa benzene tạo nitrobenzene màu vàng nhạt, mùi hạnh nhân chìm xuống đáy.',
  },
  {
    id: 'c2h5oh_cuo',
    reactants: ['C2H5OH', 'CuO'],
    products: ['CH3CHO', 'Cu', 'H2O'],
    arrow: '→',
    condition: 't°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Oxi hóa không hoàn toàn ancol bậc I bằng CuO đen thành aldehyde CH₃CHO và Cu đỏ.',
  },
  {
    id: 'c2h5oh_o2_vinegar',
    reactants: ['C2H5OH', 'O2'],
    products: ['CH3COOH', 'H2O'],
    arrow: '→',
    condition: 'men giấm, 25–30°C',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Lên men giấm dung dịch rượu etylic loãng tạo acetic acid.',
  },
  {
    id: 'phenol_br2',
    reactants: ['C6H5OH', 'Br2'],
    products: ['C6H2Br3OH↓', 'HBr'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Nước bromine mất màu nhanh và xuất hiện kết tủa trắng 2,4,6-tribromophenol.',
  },
  {
    id: 'phenol_naoh',
    reactants: ['C6H5OH', 'NaOH'],
    products: ['C6H5ONa', 'H2O'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11',
    phenomenon: 'Phenol ít tan tách lớp trở nên trong suốt khi phản ứng với dung dịch NaOH.',
  },
  {
    id: 'ch3cooh_naoh',
    reactants: ['CH3COOH', 'NaOH'],
    products: ['CH3COONa', 'H2O'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 11 · 12',
    phenomenon: 'Phản ứng chuẩn độ acid yếu CH₃COOH bằng NaOH (điểm tương đương pH > 7).',
  },
  {
    id: 'tristearin_naoh',
    reactants: ['(C17H35COO)3C3H5', 'NaOH'],
    products: ['C17H35COONa', 'C3H5(OH)3'],
    arrow: '→',
    condition: 't° (xà phòng hóa)',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Xà phòng hóa chất béo tạo muối natri stearate (xà phòng) và glycerol.',
  },
  {
    id: 'triolein_h2',
    reactants: ['(C17H33COO)3C3H5', 'H2'],
    products: ['(C17H35COO)3C3H5'],
    arrow: '→',
    condition: 'Ni, t°, p',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Hiđro hóa chuyển hóa chất béo lỏng (triolein) thành chất béo rắn (tristearin — bơ thực vật).',
  },
  {
    id: 'saccharose_hydrolysis',
    reactants: ['C12H22O11', 'H2O'],
    products: ['2C6H12O6'],
    arrow: '→',
    condition: 'H⁺, t°',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Thủy phân saccharose thu được hỗn hợp glucose và fructose (tỉ lệ 1:1).',
  },
  {
    id: 'glucose_tollens',
    reactants: ['C6H12O6', 'AgNO3', 'NH3', 'H2O'],
    products: ['C6H11O7NH4', 'Ag↓', 'NH4NO3'],
    arrow: '→',
    condition: 't° nhẹ',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Tráng bạc từ glucose: kết tủa bạc trắng sáng bám đều lên thành ống nghiệm.',
  },
  {
    id: 'aniline_br2',
    reactants: ['C6H5NH2', 'Br2'],
    products: ['C6H2Br3NH2↓', 'HBr'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Xuất hiện kết tủa trắng 2,4,6-tribromoaniline ngay khi nhỏ nước bromine vào aniline.',
  },
  {
    id: 'glycine_hcl',
    reactants: ['H2NCH2COOH', 'HCl'],
    products: ['ClH3NCH2COOH'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Amino acid thể hiện tính base khi tác dụng với acid mạnh HCl.',
  },
  {
    id: 'glycine_naoh',
    reactants: ['H2NCH2COOH', 'NaOH'],
    products: ['H2NCH2COONa', 'H2O'],
    arrow: '→',
    topic: 'organic',
    topicLabel: 'Hóa hữu cơ',
    grade: 'Lớp 12',
    phenomenon: 'Amino acid thể hiện tính acid khi tác dụng với kiềm NaOH.',
  },
];

export interface PredictedReaction {
  id: string;
  balanced: BalanceResult;
  condition?: string;
  phenomenon: string;
  sourceLabel: string;
}

const REACTIVITY_ORDER = [
  'K', 'Na', 'Ba', 'Ca', 'Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb', 'H', 'Cu', 'Hg', 'Ag', 'Pt', 'Au',
];

const METAL_VALENCE: Record<string, number> = {
  K: 1, Na: 1, Ag: 1,
  Ba: 2, Ca: 2, Mg: 2, Zn: 2, Fe: 2, Cu: 2, Pb: 2, Ni: 2,
  Al: 3, Cr: 3,
};

function makeSaltFormula(metal: string, valence: number, anion: string, anionCharge: number): string {
  const g = Number(gcdBig(BigInt(valence), BigInt(anionCharge)));
  const mSub = anionCharge / g;
  const aSub = valence / g;
  const mPart = `${metal}${mSub > 1 ? mSub : ''}`;
  const isPoly = /[A-Z].*[A-Z]|\d/.test(anion);
  const aPart = aSub > 1 ? (isPoly ? `(${anion})${aSub}` : `${anion}${aSub}`) : anion;
  return `${mPart}${aPart}`;
}

function makeHydroxideFormula(metal: string, valence: number): string {
  return valence > 1 ? `${metal}(OH)${valence}` : `${metal}OH`;
}

/**
 * Tìm kiếm và tự động dự đoán phương trình hóa học chỉ từ Vế Trái (các chất tham gia)
 */
export function predictReactionsFromLHS(lhsInput: string): {
  results: PredictedReaction[];
  normalizedInputs: string[];
  error?: string;
} {
  const rawTerms = lhsInput
    .split(/\s*\+\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (rawTerms.length === 0) {
    return { results: [], normalizedInputs: [], error: 'Hãy nhập ít nhất 1 chất tham gia (ví dụ: Fe + HCl hoặc KMnO4).' };
  }

  const normalizedInputs = rawTerms.map((t) => stripLeadingCoeff(t).formula);
  for (let i = 0; i < normalizedInputs.length; i++) {
    if (!parseFormulaCounts(normalizedInputs[i])) {
      return {
        results: [],
        normalizedInputs,
        error: `Không nhận diện được công thức "${rawTerms[i]}". Hãy kiểm tra ký hiệu hóa học (ví dụ: Fe, NaOH, H2SO4).`,
      };
    }
  }

  const inputSorted = [...normalizedInputs].sort().join('+');
  const results: PredictedReaction[] = [];

  // 1. Exact reactant-set matches in curated DB (can return multiple e.g. Fe + HNO3 dilute vs conc)
  for (const entry of CHEM_REACTIONS_DB) {
    const dbSorted = [...entry.reactants].sort().join('+');
    if (dbSorted === inputSorted) {
      const eqStr = `${entry.reactants.join(' + ')} ${entry.arrow} ${entry.products.join(' + ')}`;
      const balanced = balanceChemicalEquation(eqStr);
      if (balanced.ok) {
        results.push({
          id: entry.id,
          balanced,
          condition: entry.condition,
          phenomenon: entry.phenomenon,
          sourceLabel: entry.topicLabel,
        });
      }
    }
  }

  if (results.length > 0) {
    return { results, normalizedInputs };
  }

  // 2. General Inorganic Rule-Based Generator for 2 reactants
  if (normalizedInputs.length === 2) {
    const [a, b] = normalizedInputs;
    const tryRule = (lhsA: string, lhsB: string): PredictedReaction | null => {
      // Rule A: Metal + Dilute Acid (HCl, HBr, H2SO4)
      if (METAL_VALENCE[lhsA] && (lhsB === 'HCl' || lhsB === 'HBr' || lhsB === 'H2SO4')) {
        const idxM = REACTIVITY_ORDER.indexOf(lhsA);
        const idxH = REACTIVITY_ORDER.indexOf('H');
        if (idxM !== -1 && idxM < idxH) {
          const val = METAL_VALENCE[lhsA];
          const anion = lhsB === 'HCl' ? 'Cl' : lhsB === 'HBr' ? 'Br' : 'SO4';
          const chg = lhsB === 'H2SO4' ? 2 : 1;
          const salt = makeSaltFormula(lhsA, val, anion, chg);
          const bal = balanceChemicalEquation(`${lhsA} + ${lhsB} -> ${salt} + H2↑`);
          if (bal.ok) {
            return {
              id: `rule_metal_acid_${lhsA}_${lhsB}`,
              balanced: bal,
              condition: lhsB === 'H2SO4' ? 'loãng' : undefined,
              phenomenon: `Kim loại ${lhsA} đứng trước H trong dãy hoạt động nên tan và giải phóng khí H₂.`,
              sourceLabel: 'Quy tắc Kim loại + Axit',
            };
          }
        }
      }

      // Rule B: Acid + Base neutralization -> Salt + H2O
      const baseMatch = lhsB.match(/^([A-Z][a-z]?)(?:\(OH\)(\d+)|OH)$/);
      const acidMatch =
        lhsA === 'HCl'
          ? { anion: 'Cl', chg: 1 }
          : lhsA === 'HNO3'
          ? { anion: 'NO3', chg: 1 }
          : lhsA === 'H2SO4'
          ? { anion: 'SO4', chg: 2 }
          : lhsA === 'H3PO4'
          ? { anion: 'PO4', chg: 3 }
          : null;
      if (acidMatch && baseMatch) {
        const metal = baseMatch[1];
        const val = baseMatch[2] ? Number(baseMatch[2]) : 1;
        const salt = makeSaltFormula(metal, val, acidMatch.anion, acidMatch.chg);
        const bal = balanceChemicalEquation(`${lhsA} + ${lhsB} -> ${salt} + H2O`);
        if (bal.ok) {
          return {
            id: `rule_neutral_${lhsA}_${lhsB}`,
            balanced: bal,
            phenomenon: 'Phản ứng trao đổi axit – bazơ tạo muối và chất điện li yếu H₂O.',
            sourceLabel: 'Quy tắc Trung hòa',
          };
        }
      }

      // Rule C: Metal + Oxygen -> Oxide
      if (METAL_VALENCE[lhsA] && lhsB === 'O2') {
        const val = METAL_VALENCE[lhsA];
        const oxide = makeSaltFormula(lhsA, val, 'O', 2);
        const bal = balanceChemicalEquation(`${lhsA} + O2 -> ${oxide}`);
        if (bal.ok) {
          return {
            id: `rule_metal_o2_${lhsA}`,
            balanced: bal,
            condition: 't°',
            phenomenon: `Kim loại ${lhsA} bị oxi hóa bởi khí oxi tạo oxit kim loại tương ứng.`,
            sourceLabel: 'Quy tắc Oxi hóa kim loại',
          };
        }
      }

      // Rule D: Metal + Halogen (Cl2, Br2) -> Salt
      if (METAL_VALENCE[lhsA] && (lhsB === 'Cl2' || lhsB === 'Br2')) {
        const hal = lhsB === 'Cl2' ? 'Cl' : 'Br';
        const val = lhsA === 'Fe' ? 3 : METAL_VALENCE[lhsA];
        const salt = makeSaltFormula(lhsA, val, hal, 1);
        const bal = balanceChemicalEquation(`${lhsA} + ${lhsB} -> ${salt}`);
        if (bal.ok) {
          return {
            id: `rule_metal_hal_${lhsA}_${lhsB}`,
            balanced: bal,
            condition: 't°',
            phenomenon: `${lhsA} tác dụng với ${lhsB} tạo muối halogenua (lưu ý Fe lên hóa trị III với Cl₂).`,
            sourceLabel: 'Quy tắc Kim loại + Halogen',
          };
        }
      }

      // Rule E: Salt + Strong Alkali (NaOH / KOH) -> Hydroxide ↓ + New Salt
      const saltMatch = lhsA.match(/^([A-Z][a-z]?)(\d*)\(?([A-Za-z0-9]+)\)?(\d*)$/);
      if (
        (lhsB === 'NaOH' || lhsB === 'KOH') &&
        saltMatch &&
        !['Na', 'K', 'Ba', 'Ca'].includes(saltMatch[1]) &&
        METAL_VALENCE[saltMatch[1]]
      ) {
        const metal = saltMatch[1];
        const alkMetal = lhsB === 'NaOH' ? 'Na' : 'K';
        const mVal = lhsA.includes('FeCl3') || lhsA.includes('Fe(NO3)3') || lhsA.includes('Fe2(SO4)3') ? 3 : METAL_VALENCE[metal];
        const anion = lhsA.includes('SO4') ? 'SO4' : lhsA.includes('NO3') ? 'NO3' : lhsA.includes('Cl') ? 'Cl' : '';
        if (anion) {
          const aChg = anion === 'SO4' ? 2 : 1;
          const hyd = makeHydroxideFormula(metal, mVal) + '↓';
          const newSalt = makeSaltFormula(alkMetal, 1, anion, aChg);
          const bal = balanceChemicalEquation(`${lhsA} + ${lhsB} -> ${hyd} + ${newSalt}`);
          if (bal.ok) {
            return {
              id: `rule_precip_${lhsA}_${lhsB}`,
              balanced: bal,
              phenomenon: `Tạo kết tủa hiđroxit không tan ${toUnicodeSubscripts(hyd)}.`,
              sourceLabel: 'Quy tắc Trao đổi ion',
            };
          }
        }
      }

      // Rule F: Metal + Salt displacement (M1 + M2Salt -> M1Salt + M2↓)
      const dispSaltMatch = lhsB.match(/^([A-Z][a-z]?)(\d*)\(?([A-Za-z0-9]+)\)?(\d*)$/);
      if (
        METAL_VALENCE[lhsA] &&
        !['K', 'Na', 'Ba', 'Ca'].includes(lhsA) &&
        dispSaltMatch &&
        REACTIVITY_ORDER.includes(dispSaltMatch[1])
      ) {
        const m1 = lhsA;
        const m2 = dispSaltMatch[1];
        const i1 = REACTIVITY_ORDER.indexOf(m1);
        const i2 = REACTIVITY_ORDER.indexOf(m2);
        if (i1 !== -1 && i2 !== -1 && i1 < i2 && i2 > REACTIVITY_ORDER.indexOf('H')) {
          const anion = lhsB.includes('SO4') ? 'SO4' : lhsB.includes('NO3') ? 'NO3' : lhsB.includes('Cl') ? 'Cl' : '';
          if (anion) {
            const aChg = anion === 'SO4' ? 2 : 1;
            const newSalt = makeSaltFormula(m1, METAL_VALENCE[m1], anion, aChg);
            const bal = balanceChemicalEquation(`${lhsA} + ${lhsB} -> ${newSalt} + ${m2}↓`);
            if (bal.ok) {
              return {
                id: `rule_disp_${lhsA}_${lhsB}`,
                balanced: bal,
                phenomenon: `Kim loại ${m1} khử ion ${m2} đứng sau trong dãy điện hóa tạo kim loại ${m2} bám vào điện cực.`,
                sourceLabel: 'Quy tắc Pin & Dãy điện hóa',
              };
            }
          }
        }
      }

      // Rule G: Basic Oxide + Strong Acid -> Salt + H2O
      const oxideMap: Record<string, { metal: string; val: number }> = {
        CuO: { metal: 'Cu', val: 2 },
        FeO: { metal: 'Fe', val: 2 },
        Fe2O3: { metal: 'Fe', val: 3 },
        Al2O3: { metal: 'Al', val: 3 },
        MgO: { metal: 'Mg', val: 2 },
        ZnO: { metal: 'Zn', val: 2 },
        CaO: { metal: 'Ca', val: 2 },
        Na2O: { metal: 'Na', val: 1 },
        K2O: { metal: 'K', val: 1 },
        BaO: { metal: 'Ba', val: 2 },
      };
      const acidMatchB =
        lhsB === 'HCl'
          ? { anion: 'Cl', chg: 1 }
          : lhsB === 'HBr'
          ? { anion: 'Br', chg: 1 }
          : lhsB === 'HNO3'
          ? { anion: 'NO3', chg: 1 }
          : lhsB === 'H2SO4'
          ? { anion: 'SO4', chg: 2 }
          : lhsB === 'H3PO4'
          ? { anion: 'PO4', chg: 3 }
          : null;
      if (oxideMap[lhsA] && acidMatchB) {
        const { metal, val } = oxideMap[lhsA];
        const salt = makeSaltFormula(metal, val, acidMatchB.anion, acidMatchB.chg);
        const bal = balanceChemicalEquation(`${lhsA} + ${lhsB} -> ${salt} + H2O`);
        if (bal.ok) {
          return {
            id: `rule_oxide_acid_${lhsA}_${lhsB}`,
            balanced: bal,
            phenomenon: `Oxide bazơ/lưỡng tính ${toUnicodeSubscripts(lhsA)} tan trong dung dịch acid tạo muối và nước.`,
            sourceLabel: 'Quy tắc Oxide + Acid',
          };
        }
      }

      // Rule H: Complete Combustion of Organic Compounds (CxHy or CxHyOz + O2 -> CO2 + H2O)
      if (lhsB === 'O2') {
        const counts = parseFormulaCounts(lhsA);
        if (counts && counts.C && counts.H) {
          const keys = Object.keys(counts);
          if (keys.every((k) => k === 'C' || k === 'H' || k === 'O')) {
            const bal = balanceChemicalEquation(`${lhsA} + O2 -> CO2↑ + H2O`);
            if (bal.ok) {
              return {
                id: `rule_combust_${lhsA}`,
                balanced: bal,
                condition: 't°',
                phenomenon: `Đốt cháy hoàn toàn hợp chất hữu cơ ${toUnicodeSubscripts(lhsA)} tạo CO₂ và H₂O.`,
                sourceLabel: 'Quy tắc Đốt cháy Hữu cơ',
              };
            }
          }
        }
      }

      return null;
    };

    const r1 = tryRule(a, b) || tryRule(b, a);
    if (r1) {
      results.push(r1);
      return { results, normalizedInputs };
    }
  }

  // 3. Single-reactant thermal decomposition rules
  if (normalizedInputs.length === 1) {
    const x = normalizedInputs[0];
    const decompOxides: Record<string, string> = {
      'Cu(OH)2': 'CuO + H2O',
      'Mg(OH)2': 'MgO + H2O',
      'Zn(OH)2': 'ZnO + H2O',
      'Fe(OH)3': 'Fe2O3 + H2O',
      'Al(OH)3': 'Al2O3 + H2O',
      BaCO3: 'BaO + CO2↑',
      MgCO3: 'MgO + CO2↑',
      CaCO3: 'CaO + CO2↑',
      NH4HCO3: 'NH3↑ + CO2↑ + H2O',
      NH4NO3: 'N2O↑ + H2O',
    };
    if (decompOxides[x]) {
      const bal = balanceChemicalEquation(`${x} -> ${decompOxides[x]}`);
      if (bal.ok) {
        results.push({
          id: `rule_decomp_${x}`,
          balanced: bal,
          condition: 't°',
          phenomenon: `Nhiệt phân hợp chất ${toUnicodeSubscripts(x)} thu được sản phẩm bền hơn ở nhiệt độ cao.`,
          sourceLabel: 'Quy tắc Nhiệt phân',
        });
        return { results, normalizedInputs };
      }
    }
  }

  return {
    results: [],
    normalizedInputs,
    error: `Chưa có quy tắc tự sinh sản phẩm cho tổ hợp "${normalizedInputs.join(' + ')}". Hãy chuyển sang tab "Cân bằng mọi PTHH" để nhập cả 2 vế và cân bằng tức thì, hoặc tìm từng chất trong Kho phương trình!`,
  };
}

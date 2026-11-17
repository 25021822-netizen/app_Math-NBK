/**
 * Utility for parsing and evaluating 1-variable mathematical functions f(x).
 * Supports linear equations (e.g., y = 3x - 2), polynomials, rational, trig, etc.
 * Features rigorous determination of Vertical, Horizontal, and Slant/Oblique Asymptotes.
 */

export interface VerticalAsymptote {
  x: number;
  equation: string; // e.g. "x = 1"
  latex: string;
}

export interface HorizontalAsymptote {
  y: number;
  equation: string; // e.g. "y = 2"
  latex: string;
  limitPosInf: number;
  limitNegInf: number;
}

export interface SlantAsymptote {
  a: number;
  b: number;
  equation: string; // e.g. "y = x + 3"
  latex: string;
}

export interface AsymptotesData {
  vertical: VerticalAsymptote[];
  horizontal?: HorizontalAsymptote;
  slant?: SlantAsymptote;
  hasAny: boolean;
  details: string[];
}

export interface ParsedFunctionResult {
  rawInput: string;
  cleanedFormula: string;
  displayLatex: string;
  evaluate: (x: number) => number;
  derivative: (x: number) => number;
  functionType: 'linear' | 'quadratic' | 'cubic' | 'rational' | 'trig' | 'general';
  functionTypeLabel: string;
  yIntercept?: { x: number; y: number };
  xIntercepts: { x: number; y: number }[];
  vertex?: { x: number; y: number }; // For quadratic functions
  asymptotes: AsymptotesData;
  sampleTable: { x: number; y: number }[];
  error?: string;
}

function detectAsymptotes(
  evaluateFn: (x: number) => number,
  functionType: ParsedFunctionResult['functionType'],
  rawExpr: string
): AsymptotesData {
  const vertical: VerticalAsymptote[] = [];
  let horizontal: HorizontalAsymptote | undefined;
  let slant: SlantAsymptote | undefined;
  const details: string[] = [];

  // Đa thức thuần túy (không có mẫu chia) không có bất kỳ đường tiệm cận nào
  const hasDivision = rawExpr.includes('/');
  const isPurePolynomial =
    (functionType === 'linear' || functionType === 'quadratic' || functionType === 'cubic') && !hasDivision;

  if (isPurePolynomial) {
    return {
      vertical: [],
      hasAny: false,
      details: ['Hàm số đa thức xác định trên ℝ nên không có tiệm cận đứng, tiệm cận ngang hay tiệm cận xiên.'],
    };
  }

  // 1. TÌM TIỆM CẬN ĐỨNG (TCĐ: x = x₀)
  // Quét các điểm chia mẫu số bằng 0 hoặc hàm số bùng nổ vô cùng trong [-15, 15]
  const vCandidates: number[] = [];
  const scanStep = 0.05;

  for (let x = -15; x <= 15; x += scanStep) {
    const y1 = evaluateFn(x);
    const y2 = evaluateFn(x + scanStep);

    const isHuge1 = isNaN(y1) || Math.abs(y1) > 60;
    const isHuge2 = isNaN(y2) || Math.abs(y2) > 60;
    const signChangeHuge = !isNaN(y1) && !isNaN(y2) && y1 * y2 < 0 && Math.abs(y1 - y2) > 100;

    if (isHuge1 || isHuge2 || signChangeHuge) {
      let left = x - scanStep;
      let right = x + scanStep * 2;
      let candidateX = (left + right) / 2;

      for (let iter = 0; iter < 24; iter++) {
        const mid = (left + right) / 2;
        const yLeft = evaluateFn(mid - 0.0001);
        const yRight = evaluateFn(mid + 0.0001);

        if (isNaN(yLeft) || isNaN(yRight) || (Math.abs(yLeft) > 1000 && Math.abs(yRight) > 1000)) {
          candidateX = mid;
          break;
        }

        if (Math.abs(yLeft) > Math.abs(yRight)) {
          right = mid;
        } else {
          left = mid;
        }
        candidateX = (left + right) / 2;
      }

      const roundedX = Math.round(candidateX * 100) / 100;
      const testEps = 0.0005;
      const yLeftTest = evaluateFn(roundedX - testEps);
      const yRightTest = evaluateFn(roundedX + testEps);

      if (
        (isNaN(evaluateFn(roundedX)) || Math.abs(evaluateFn(roundedX)) > 100) &&
        (Math.abs(yLeftTest) > 50 || Math.abs(yRightTest) > 50 || isNaN(yLeftTest) || isNaN(yRightTest))
      ) {
        if (!vCandidates.some((c) => Math.abs(c - roundedX) < 0.25)) {
          vCandidates.push(roundedX);
        }
      }
    }
  }

  vCandidates.sort((a, b) => a - b).forEach((x0) => {
    vertical.push({
      x: x0,
      equation: `x = ${x0}`,
      latex: `x = ${x0}`,
    });
    details.push(`Tiệm cận đứng (TCĐ): x = ${x0}`);
  });

  // 2. TÌM TIỆM CẬN NGANG (TCN: y = y₀) VÀ TIỆM CẬN XIÊN (TCX: y = ax + b)
  const bigX = 50000;
  const bigX2 = 100000;

  const yPos1 = evaluateFn(bigX);
  const yPos2 = evaluateFn(bigX2);

  const yNeg1 = evaluateFn(-bigX);
  const yNeg2 = evaluateFn(-bigX2);

  // A. Kiểm tra Tiệm Cận Ngang: lim f(x) = y₀ khi x → ±∞
  let foundHoriz = false;
  if (!isNaN(yPos1) && !isNaN(yPos2) && Math.abs(yPos1 - yPos2) < 0.02 && Math.abs(yPos1) < 2000) {
    const rawY = Math.round(yPos2 * 1000) / 1000;
    const roundedY = Math.round(rawY * 100) / 100;
    horizontal = {
      y: roundedY,
      equation: `y = ${roundedY}`,
      latex: `y = ${roundedY}`,
      limitPosInf: roundedY,
      limitNegInf: !isNaN(yNeg2) ? Math.round(yNeg2 * 100) / 100 : roundedY,
    };
    details.push(`Tiệm cận ngang (TCN): y = ${roundedY}`);
    foundHoriz = true;
  } else if (!isNaN(yNeg1) && !isNaN(yNeg2) && Math.abs(yNeg1 - yNeg2) < 0.02 && Math.abs(yNeg1) < 2000) {
    const rawY = Math.round(yNeg2 * 1000) / 1000;
    const roundedY = Math.round(rawY * 100) / 100;
    horizontal = {
      y: roundedY,
      equation: `y = ${roundedY}`,
      latex: `y = ${roundedY}`,
      limitPosInf: !isNaN(yPos2) ? Math.round(yPos2 * 100) / 100 : roundedY,
      limitNegInf: roundedY,
    };
    details.push(`Tiệm cận ngang (TCN): y = ${roundedY}`);
    foundHoriz = true;
  }

  // B. Kiểm tra Tiệm Cận Xiên: y = ax + b (a ≠ 0)
  // Chỉ tìm TCX khi bậc tử > bậc mẫu 1 bậc và không có TCN
  if (!foundHoriz) {
    if (!isNaN(yPos1) && !isNaN(yPos2) && isFinite(yPos1) && isFinite(yPos2)) {
      const a1 = yPos1 / bigX;
      const a2 = yPos2 / bigX2;

      if (Math.abs(a1 - a2) < 0.005 && Math.abs(a2) > 0.01 && Math.abs(a2) < 50) {
        const rawA = Math.round(a2 * 100) / 100;
        const b1 = yPos1 - rawA * bigX;
        const b2 = yPos2 - rawA * bigX2;

        if (Math.abs(b1 - b2) < 0.15 && Math.abs(b2) < 500) {
          const rawB = Math.round(b2 * 100) / 100;

          const diffTest = Math.abs(yPos2 - (rawA * bigX2 + rawB));
          if (diffTest < 0.6) {
            let eq = 'y = ';
            if (rawA === 1) eq += 'x';
            else if (rawA === -1) eq += '-x';
            else eq += `${rawA}x`;

            if (rawB > 0) eq += ` + ${rawB}`;
            else if (rawB < 0) eq += ` - ${Math.abs(rawB)}`;

            slant = {
              a: rawA,
              b: rawB,
              equation: eq,
              latex: eq,
            };
            details.push(`Tiệm cận xiên (TCX): ${eq}`);
          }
        }
      }
    }
  }

  const hasAny = vertical.length > 0 || horizontal !== undefined || slant !== undefined;
  if (!hasAny) {
    details.push('Hàm số không có đường tiệm cận đứng, ngang hay xiên.');
  }

  return {
    vertical,
    horizontal,
    slant,
    hasAny,
    details,
  };
}

export interface DomainRange {
  a: number;
  b: number;
}

/**
 * Parses a numeric or mathematical constant bound expression such as:
 * "-2", "3.5", "-pi", "pi/2", "2pi", "-2*pi", "e", "sqrt(2)", "1/3"
 */
export function parseBoundExpression(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let expr = trimmed
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[\u00D7\u22C5]/g, '*')
    .replace(/[\u00F7:]/g, '/')
    .replace(/π/g, 'pi')
    .replace(/,/g, '.');

  // Implicit multiplication before pi, e, sqrt, (
  expr = expr
    .replace(/(\d+(\.\d+)?)\s*(pi|e|sqrt|\()/gi, '$1*$3')
    .replace(/\)\s*(\d+(\.\d+)?|pi|e|sqrt|\()/gi, ')*$1')
    .replace(/\^/g, '**');

  const safePattern = /^[0-9\s\+\-\*\/\(\)\.pieEsqrt]+$/;
  if (!safePattern.test(expr)) return null;

  try {
    const fn = new Function(
      `const pi = Math.PI, PI = Math.PI, e = Math.E, E = Math.E, sqrt = Math.sqrt;
       const val = (${expr});
       return (typeof val === 'number' && !isNaN(val) && isFinite(val)) ? val : null;`
    );
    const result = fn();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export function computeIntersections(
  fn1: (x: number) => number,
  fn2: (x: number) => number,
  minX: number,
  maxX: number
): { x: number; y: number }[] {
  if (!(minX < maxX)) return [];
  const results: { x: number; y: number }[] = [];
  const span = maxX - minX;
  const steps = Math.min(800, Math.max(200, Math.round(span * 40)));
  const dx = span / steps;

  const diff = (x: number) => {
    const y1 = fn1(x);
    const y2 = fn2(x);
    if (isNaN(y1) || isNaN(y2) || !isFinite(y1) || !isFinite(y2)) return NaN;
    return y1 - y2;
  };

  for (let i = 0; i < steps; i++) {
    const x1 = minX + i * dx;
    const x2 = x1 + dx;
    const d1 = diff(x1);
    const d2 = diff(x2);
    if (isNaN(d1) || isNaN(d2)) continue;

    // Skip asymptote jumps
    if (Math.abs(d1 - d2) > 50 && d1 * d2 < 0) continue;

    let rootX: number | null = null;
    if (Math.abs(d1) < 1e-4) {
      rootX = x1;
    } else if (d1 * d2 < 0) {
      let lo = x1;
      let hi = x2;
      let fLo = d1;
      for (let iter = 0; iter < 18; iter++) {
        const mid = (lo + hi) / 2;
        const fMid = diff(mid);
        if (isNaN(fMid)) break;
        if (Math.abs(fMid) < 1e-6) {
          lo = mid;
          hi = mid;
          break;
        }
        if (fLo * fMid <= 0) {
          hi = mid;
        } else {
          lo = mid;
          fLo = fMid;
        }
      }
      rootX = (lo + hi) / 2;
    }

    if (rootX !== null) {
      const yVal = fn1(rootX);
      const yCheck = fn2(rootX);
      if (!isNaN(yVal) && !isNaN(yCheck) && Math.abs(yVal - yCheck) < 0.05 && Math.abs(yVal) < 500) {
        const rx = Math.round(rootX * 1000) / 1000;
        const ry = Math.round(yVal * 1000) / 1000;
        if (!results.some((pt) => Math.abs(pt.x - rx) < 0.08)) {
          results.push({ x: rx, y: ry });
        }
      }
    }
  }

  return results.slice(0, 8);
}

export function computeDefiniteIntegral(
  fn: (x: number) => number,
  a: number,
  b: number,
  absolute = false
): number | null {
  if (!isFinite(a) || !isFinite(b) || Math.abs(b - a) < 1e-9) return 0;
  const sign = a <= b ? 1 : -1;
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  const n = 400; // even number for Simpson's rule
  const h = (end - start) / n;

  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const x = start + i * h;
    let y = fn(x);
    if (isNaN(y) || !isFinite(y) || Math.abs(y) > 1e5) {
      return null;
    }
    if (absolute) y = Math.abs(y);
    const weight = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight * y;
  }

  const res = (sign * h * sum) / 3;
  return isFinite(res) ? res : null;
}

export function parseMathFunction(input: string, domain?: DomainRange | null): ParsedFunctionResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      rawInput: input,
      cleanedFormula: '',
      displayLatex: '',
      evaluate: () => NaN,
      derivative: () => NaN,
      functionType: 'general',
      functionTypeLabel: 'Chưa nhập hàm số',
      xIntercepts: [],
      asymptotes: { vertical: [], hasAny: false, details: [] },
      sampleTable: [],
      error: 'Vui lòng nhập hàm số (ví dụ: y = 3x - 2 hoặc y = (2x+1)/(x-1))',
    };
  }

  // 1. Chuẩn hóa chuỗi đầu vào: bỏ "y =", "f(x) =", "f1(x) =", "g(x) ="
  const expr = trimmed
    .replace(/^(y\d*|f\d*\(x\)|g\d*\(x\)|h\d*\(x\))\s*=\s*/i, '')
    .trim();

  // Chuẩn hóa dấu và biến X hoa -> x thường
  let processed = expr
    .replace(/[\u2212\u2013\u2014]/g, '-') // unicode minus
    .replace(/[\u00D7\u22C5]/g, '*') // multiplication symbol
    .replace(/[\u00F7:]/g, '/') // division symbol
    .replace(/π/g, 'pi')
    .replace(/\bX\b/g, 'x')
    .replace(/(\d)X/g, '$1x')
    .replace(/X(\d|\()/g, 'x$1');

  // Xử lý nhân ẩn: 3x -> 3*x, 2(x+1) -> 2*(x+1), x(x-1) -> x*(x-1), 2pi -> 2*pi
  processed = processed.replace(/(\d+(\.\d+)?)\s*(x|pi|e(?![a-zA-Z0-9_]))/gi, '$1*$3');
  processed = processed.replace(/(\d+(\.\d+)?)\s*\(/g, '$1*(');
  processed = processed.replace(/\bx\s*\(/gi, 'x*(');
  processed = processed.replace(/\)\s*(\d+(\.\d+)?)/g, ')*$1');
  processed = processed.replace(/\)\s*(x|pi)/gi, ')*$1');
  processed = processed.replace(/\)\s*\(/g, ')*(');
  processed = processed.replace(/(\d+(\.\d+)?)\s*(sin|cos|tan|cot|sqrt|abs|log|ln|exp)/gi, '$1*$3');
  processed = processed.replace(/\bx\s*(sin|cos|tan|cot|sqrt|abs|log|ln|exp)/gi, 'x*$1');
  processed = processed.replace(/\)\s*(sin|cos|tan|cot|sqrt|abs|log|ln|exp)/gi, ')*$1');
  processed = processed.replace(/\^/g, '**');

  const safeRegex = /^[0-9xX\s\+\-\*\/\(\)\.\,sincotaqrblgexpiPIE]+$/;
  if (!safeRegex.test(processed)) {
    return {
      rawInput: input,
      cleanedFormula: expr,
      displayLatex: expr,
      evaluate: () => NaN,
      derivative: () => NaN,
      functionType: 'general',
      functionTypeLabel: 'Hàm số không hợp lệ',
      xIntercepts: [],
      asymptotes: { vertical: [], hasAny: false, details: [] },
      sampleTable: [],
      error: 'Biểu thức chứa ký tự không được hỗ trợ!',
    };
  }

  // Biên dịch hàm f(x) với các hàm toán học chuẩn trong scope
  let evaluateFn: (x: number) => number;
  try {
    const compiled = new Function(
      'x',
      `const sin = Math.sin, cos = Math.cos, tan = Math.tan,
             cot = (v) => 1 / Math.tan(v),
             sqrt = Math.sqrt, abs = Math.abs,
             ln = Math.log, log = Math.log10, exp = Math.exp,
             pi = Math.PI, PI = Math.PI, e = Math.E, E = Math.E;
      try {
        const val = (${processed});
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
          return val;
        }
        return NaN;
      } catch (err) {
        return NaN;
      }`
    );
    evaluateFn = (xVal: number) => compiled(xVal);
    evaluateFn(1);
  } catch {
    return {
      rawInput: input,
      cleanedFormula: expr,
      displayLatex: expr,
      evaluate: () => NaN,
      derivative: () => NaN,
      functionType: 'general',
      functionTypeLabel: 'Lỗi cú pháp',
      xIntercepts: [],
      asymptotes: { vertical: [], hasAny: false, details: [] },
      sampleTable: [],
      error: `Không thể phân tích cú pháp biểu thức "${input}". Hãy kiểm tra lại dấu ngoặc hoặc phép toán.`,
    };
  }

  // Đạo hàm số học f'(x)
  const derivativeFn = (x: number) => {
    const h = 0.0001;
    const yPlus = evaluateFn(x + h);
    const yMinus = evaluateFn(x - h);
    if (isNaN(yPlus) || isNaN(yMinus)) return NaN;
    return (yPlus - yMinus) / (2 * h);
  };

  // Xác định dạng hàm số (Type Detection)
  let functionType: ParsedFunctionResult['functionType'] = 'general';
  let functionTypeLabel = 'Đồ thị tổng quát';

  const simplified = expr.replace(/\s+/g, '').toLowerCase();

  const linearMatch =
    simplified.match(/^([+-]?\d*(\.\d+)?)x([+-]\d+(\.\d+)?)?$/i) ||
    simplified.match(/^([+-]?\d+(\.\d+)?)([+-]\d*(\.\d+)?)x$/i);

  if (linearMatch && !simplified.includes('^') && !simplified.includes('/')) {
    functionType = 'linear';
    functionTypeLabel = 'Hàm bậc nhất (y = ax + b)';
  } else if (/x\^2|x\*\*2/.test(simplified) && !/x\^3|x\^4|\//.test(simplified)) {
    functionType = 'quadratic';
    functionTypeLabel = 'Hàm bậc hai (Parabol)';
  } else if (/x\^3|x\*\*3/.test(simplified) && !/\//.test(simplified)) {
    functionType = 'cubic';
    functionTypeLabel = 'Hàm bậc ba';
  } else if (simplified.includes('/') && simplified.includes('x')) {
    functionType = 'rational';
    functionTypeLabel = 'Hàm phân thức hữu tỉ';
  } else if (/sin|cos|tan|cot/.test(simplified)) {
    functionType = 'trig';
    functionTypeLabel = 'Hàm lượng giác';
  }

  const scanStart = domain ? domain.a : -10;
  const scanEnd = domain ? domain.b : 10;

  // Tính giao điểm trục tung Oy (x = 0 nếu nằm trong miền)
  const zeroInDomain = !domain || (0 >= domain.a - 1e-6 && 0 <= domain.b + 1e-6);
  const y0 = zeroInDomain ? evaluateFn(0) : NaN;
  const yIntercept = !isNaN(y0) ? { x: 0, y: Math.round(y0 * 1000) / 1000 } : undefined;

  // Tìm giao điểm trục hoành Ox (f(x) = 0)
  const xIntercepts: { x: number; y: number }[] = [];

  if (functionType === 'linear' && !domain) {
    const d0 = derivativeFn(0);
    if (!isNaN(d0) && Math.abs(d0) > 0.0001 && yIntercept) {
      const rootX = -yIntercept.y / d0;
      if (isFinite(rootX)) {
        xIntercepts.push({ x: Math.round(rootX * 1000) / 1000, y: 0 });
      }
    }
  } else if (scanStart < scanEnd) {
    const scanStep = Math.max(0.01, (scanEnd - scanStart) / 300);
    for (let x = scanStart; x < scanEnd; x += scanStep) {
      const nextX = Math.min(x + scanStep, scanEnd);
      const y1 = evaluateFn(x);
      const y2 = evaluateFn(nextX);
      if (isNaN(y1) || isNaN(y2)) continue;

      if (Math.abs(y1) < 0.001) {
        const roundedX = Math.round(x * 100) / 100;
        if (!xIntercepts.some((pt) => Math.abs(pt.x - roundedX) < 0.08)) {
          xIntercepts.push({ x: roundedX, y: 0 });
        }
      } else if (y1 * y2 < 0 && Math.abs(y1 - y2) < 50) {
        let low = x;
        let high = nextX;
        for (let iter = 0; iter < 14; iter++) {
          const mid = (low + high) / 2;
          const yMid = evaluateFn(mid);
          if (Math.abs(yMid) < 0.0001) {
            low = mid;
            high = mid;
            break;
          }
          if (yMid * evaluateFn(low) < 0) {
            high = mid;
          } else {
            low = mid;
          }
        }
        const exactRoot = Math.round(((low + high) / 2) * 1000) / 1000;
        if (!xIntercepts.some((pt) => Math.abs(pt.x - exactRoot) < 0.1)) {
          xIntercepts.push({ x: exactRoot, y: 0 });
        }
      }
    }
  }

  // Đỉnh Parabol
  let vertex: { x: number; y: number } | undefined;
  if (functionType === 'quadratic') {
    for (let x = -10; x <= 10; x += 0.1) {
      const d1 = derivativeFn(x);
      const d2 = derivativeFn(x + 0.1);
      if (!isNaN(d1) && !isNaN(d2) && d1 * d2 <= 0) {
        const vX = Math.round((x + 0.05) * 100) / 100;
        const vY = Math.round(evaluateFn(vX) * 100) / 100;
        if (!isNaN(vY) && (!domain || (vX >= domain.a - 1e-6 && vX <= domain.b + 1e-6))) {
          vertex = { x: vX, y: vY };
          break;
        }
      }
    }
  }

  // Khảo sát các đường tiệm cận (Đứng, Ngang, Xiên)
  const asymptotes = detectAsymptotes(evaluateFn, functionType, expr);

  // Bảng giá trị mẫu (x, y) — ưu tiên chia đều trên [a, b] nếu có giới hạn miền
  const sampleTable: { x: number; y: number }[] = [];
  let samplePointsX: number[] = [];

  if (domain && domain.a < domain.b) {
    const count = 6;
    for (let i = 0; i <= count; i++) {
      const val = domain.a + ((domain.b - domain.a) * i) / count;
      samplePointsX.push(Math.round(val * 100) / 100);
    }
  } else {
    samplePointsX = [-3, -2, -1, 0, 1, 2, 3];
    if (xIntercepts.length > 0) {
      xIntercepts.forEach((pt) => {
        if (!samplePointsX.includes(pt.x) && Math.abs(pt.x) <= 5) {
          samplePointsX.push(pt.x);
        }
      });
    }
  }
  samplePointsX = Array.from(new Set(samplePointsX)).sort((a, b) => a - b);

  samplePointsX.forEach((xVal) => {
    if (asymptotes.vertical.some((v) => Math.abs(v.x - xVal) < 0.01)) return;
    const yVal = evaluateFn(xVal);
    if (!isNaN(yVal) && Math.abs(yVal) < 1000) {
      sampleTable.push({
        x: Math.round(xVal * 100) / 100,
        y: Math.round(yVal * 100) / 100,
      });
    }
  });

  return {
    rawInput: input,
    cleanedFormula: expr,
    displayLatex: `y = ${expr}`,
    evaluate: evaluateFn,
    derivative: derivativeFn,
    functionType,
    functionTypeLabel,
    yIntercept,
    xIntercepts: xIntercepts.slice(0, 4),
    vertex,
    asymptotes,
    sampleTable: sampleTable.slice(0, 7),
  };
}

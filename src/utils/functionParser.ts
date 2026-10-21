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

export function parseMathFunction(input: string): ParsedFunctionResult {
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

  // 1. Chuẩn hóa chuỗi đầu vào: bỏ "y =", "f(x) =", "g(x) ="
  let expr = trimmed
    .replace(/^(y|f\(x\)|g\(x\)|h\(x\))\s*=\s*/i, '')
    .trim();

  // Chuẩn hóa dấu
  expr = expr
    .replace(/[\u2212\u2013\u2014]/g, '-') // unicode minus
    .replace(/[\u00D7\u22C5]/g, '*') // multiplication symbol
    .replace(/[\u00F7:]/g, '/') // division symbol
    .replace(/π/g, 'Math.PI');

  // Xử lý nhân ẩn: 3x -> 3*x, 2(x+1) -> 2*(x+1), x(x-1) -> x*(x-1)
  let processed = expr;

  // Tách biến x với số: 3x -> 3*x, 0.5x -> 0.5*x
  processed = processed.replace(/(\d+(\.\d+)?)\s*x/gi, '$1*x');

  // Số liền kề dấu mở ngoặc: 2( -> 2*(
  processed = processed.replace(/(\d+(\.\d+)?)\s*\(/g, '$1*(');

  // x liền kề dấu mở ngoặc: x( -> x*(
  processed = processed.replace(/x\s*\(/gi, 'x*(');

  // Đóng ngoặc liền kề số hoặc x hoặc mở ngoặc: )2 -> )*2, )x -> )*x, )( -> )*(
  processed = processed.replace(/\)\s*(\d+(\.\d+)?)/g, ')*$1');
  processed = processed.replace(/\)\s*x/gi, ')*x');
  processed = processed.replace(/\)\s*\(/g, ')*(');

  // Số liền kề hàm số: 2sin -> 2*sin
  processed = processed.replace(/(\d+(\.\d+)?)\s*(sin|cos|tan|cot|sqrt|abs|log|ln|exp)/gi, '$1*$3');

  // x liền kề hàm số: xsin -> x*sin
  processed = processed.replace(/x\s*(sin|cos|tan|cot|sqrt|abs|log|ln|exp)/gi, 'x*$1');

  // Đóng ngoặc liền kề hàm số: )sin -> )*sin
  processed = processed.replace(/\)\s*(sin|cos|tan|cot|sqrt|abs|log|ln|exp)/gi, ')*$1');

  // Lũy thừa: ^ -> **
  processed = processed.replace(/\^/g, '**');

  // Thay thế hàm toán học
  let jsExpr = processed
    .replace(/\bsin\b/gi, 'Math.sin')
    .replace(/\bcos\b/gi, 'Math.cos')
    .replace(/\btan\b/gi, 'Math.tan')
    .replace(/\bcot\b/gi, '(1/Math.tan')
    .replace(/\bsqrt\b/gi, 'Math.sqrt')
    .replace(/\babs\b/gi, 'Math.abs')
    .replace(/\bln\b/gi, 'Math.log')
    .replace(/\blog\b/gi, 'Math.log10')
    .replace(/\bexp\b/gi, 'Math.exp');

  // Kiểm tra an toàn: chỉ cho phép các ký tự và từ khóa hợp lệ
  const safeRegex = /^[0-9xX\s\+\-\*\/\(\)\.\,MathsincotanqrblogexpPIE]+$/;
  if (!safeRegex.test(jsExpr)) {
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

  // Biên dịch hàm f(x)
  let evaluateFn: (x: number) => number;
  try {
    const compiled = new Function(
      'x',
      `try {
        const val = ${jsExpr};
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
          return val;
        }
        return NaN;
      } catch (e) {
        return NaN;
      }`
    );
    evaluateFn = (xVal: number) => compiled(xVal);

    evaluateFn(1);
  } catch (err: any) {
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
    functionTypeLabel = 'Hàm số bậc nhất (Đường thẳng y = ax + b)';
  } else if (/x\^2|x\*\*2/.test(simplified) && !/x\^3|x\^4|\//.test(simplified)) {
    functionType = 'quadratic';
    functionTypeLabel = 'Hàm số bậc hai (Parabol y = ax² + bx + c)';
  } else if (/x\^3|x\*\*3/.test(simplified) && !/\//.test(simplified)) {
    functionType = 'cubic';
    functionTypeLabel = 'Hàm số bậc ba (y = ax³ + bx² + cx + d)';
  } else if (simplified.includes('/') && simplified.includes('x')) {
    functionType = 'rational';
    functionTypeLabel = 'Hàm phân thức hữu tỉ y = P(x)/Q(x)';
  } else if (/sin|cos|tan/.test(simplified)) {
    functionType = 'trig';
    functionTypeLabel = 'Hàm số lượng giác tuần hoàn';
  }

  // Tính giao điểm trục tung Oy (x = 0)
  const y0 = evaluateFn(0);
  const yIntercept = !isNaN(y0) ? { x: 0, y: Math.round(y0 * 1000) / 1000 } : undefined;

  // Tìm giao điểm trục hoành Ox (f(x) = 0)
  const xIntercepts: { x: number; y: number }[] = [];

  if (functionType === 'linear') {
    const d0 = derivativeFn(0);
    if (!isNaN(d0) && Math.abs(d0) > 0.0001 && yIntercept) {
      const rootX = -yIntercept.y / d0;
      if (isFinite(rootX)) {
        xIntercepts.push({ x: Math.round(rootX * 1000) / 1000, y: 0 });
      }
    }
  } else {
    const scanStep = 0.05;
    for (let x = -10; x <= 10; x += scanStep) {
      const y1 = evaluateFn(x);
      const y2 = evaluateFn(x + scanStep);
      if (isNaN(y1) || isNaN(y2)) continue;

      if (Math.abs(y1) < 0.001) {
        const roundedX = Math.round(x * 100) / 100;
        if (!xIntercepts.some((pt) => Math.abs(pt.x - roundedX) < 0.1)) {
          xIntercepts.push({ x: roundedX, y: 0 });
        }
      } else if (y1 * y2 < 0) {
        let low = x;
        let high = x + scanStep;
        for (let iter = 0; iter < 12; iter++) {
          const mid = (low + high) / 2;
          const yMid = evaluateFn(mid);
          if (Math.abs(yMid) < 0.0001) {
            low = mid;
            break;
          }
          if (yMid * evaluateFn(low) < 0) {
            high = mid;
          } else {
            low = mid;
          }
        }
        const exactRoot = Math.round(((low + high) / 2) * 1000) / 1000;
        if (!xIntercepts.some((pt) => Math.abs(pt.x - exactRoot) < 0.15)) {
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
        if (!isNaN(vY)) {
          vertex = { x: vX, y: vY };
          break;
        }
      }
    }
  }

  // Khảo sát các đường tiệm cận (Đứng, Ngang, Xiên)
  const asymptotes = detectAsymptotes(evaluateFn, functionType, expr);

  // Bảng giá trị mẫu (x, y)
  const sampleTable: { x: number; y: number }[] = [];
  const samplePointsX = [-3, -2, -1, 0, 1, 2, 3];
  if (xIntercepts.length > 0) {
    xIntercepts.forEach((pt) => {
      if (!samplePointsX.includes(pt.x) && Math.abs(pt.x) <= 5) {
        samplePointsX.push(pt.x);
      }
    });
  }
  samplePointsX.sort((a, b) => a - b);

  samplePointsX.forEach((xVal) => {
    // Không tính giá trị tại điểm tiệm cận đứng
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

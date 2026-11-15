import React, { useMemo } from 'react';
import katex from 'katex';

interface MathViewProps {
  math?: string;
  latex?: string;
  block?: boolean;
  className?: string;
}

// Hàm mã hóa an toàn các ký tự HTML trong văn bản thường
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Kiểm tra xem chuỗi có phải là công thức LaTeX thuần túy (không bọc trong $)
function isPureLatexFormula(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;

  // Chứa các lệnh LaTeX toán học đặc trưng
  const mathCommandRegex = /\\(?:frac|sqrt|int|iint|iiint|oint|sum|prod|lim|vec|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|tau|phi|omega|Delta|Omega|Phi|Pi|Sigma|infty|in|notin|subset|subseteq|cup|cap|emptyset|forall|exists|partial|nabla|to|rightarrow|Rightarrow|leftarrow|Leftarrow|leftrightarrow|iff|implies|equiv|neq|le|ge|leq|geq|approx|sim|cdot|times|div|pm|mp|perp|parallel|angle|triangle|cong|sim|left|right|begin|matrix|pmatrix|bmatrix|cases|text|mathbf|mathit|mathrm|mathbb|mathcal)/;

  if (mathCommandRegex.test(trimmed)) {
    // Nếu có chứa từ tiếng Việt có dấu ngoài lệnh \text{...}, thì đó là văn bản hỗn hợp
    const withoutTextCmds = trimmed.replace(/\\text\{[^\}]*\}/g, '');
    const hasVietnameseWords = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(withoutTextCmds);
    if (!hasVietnameseWords) {
      return true;
    }
  }

  return false;
}

// Bổ sung các Macro toán học đặc thù của giáo viên Việt Nam (Hệ phương trình \heva, \hoac, vi phân, vector...)
const VIETNAMESE_MATH_MACROS: Record<string, string> = {
  '\\dd': '\\mathrm{d}',
  '\\dx': '\\mathrm{d}x',
  '\\dy': '\\mathrm{d}y',
  '\\dt': '\\mathrm{d}t',
  '\\dz': '\\mathrm{d}z',
  '\\ds': '\\displaystyle',
  '\\True': '',
  '\\False': '',
  '\\TrueTF': '',
  '\\FalseTF': '',
  '\\degree': '^\\circ',
  '\\deg': '^\\circ',
  '\\arctg': '\\arctan',
  '\\tg': '\\tan',
  '\\cotg': '\\cot',
  '\\arcsin': '\\arcsin',
  '\\arccos': '\\arccos',
};

export function cleanMathFormula(f: string): string {
  if (!f) return '';
  return f
    // Khử các macro đánh dấu đáp án của gói test/ex_test
    .replace(/\\True(?![a-zA-Z])/g, '')
    .replace(/\\False(?![a-zA-Z])/g, '')
    .replace(/\\TrueTF(?![a-zA-Z])/g, '')
    .replace(/\\FalseTF(?![a-zA-Z])/g, '')
    // Chuyển đổi hệ phương trình \heva thành \begin{cases} ... \end{cases}
    .replace(/\\heva\*?\{([\s\S]*?)\}/g, '\\begin{cases}$1\\end{cases}')
    // Chuyển đổi tuyển chọn \hoac thành ngoặc vuông hệ phương trình
    .replace(/\\hoac\*?\{([\s\S]*?)\}/g, '\\left[\\begin{array}{l}$1\\end{array}\\right.')
    // Chuẩn hóa phân số và nhị thức
    .replace(/\\dfrac(?![a-zA-Z])/g, '\\frac')
    .replace(/\\tbinom(?![a-zA-Z])/g, '\\binom')
    .replace(/\\dbinom(?![a-zA-Z])/g, '\\binom')
    // Chuẩn hóa bất đẳng thức
    .replace(/\\leqslant(?![a-zA-Z])/g, '\\leq')
    .replace(/\\geqslant(?![a-zA-Z])/g, '\\geq')
    // Chuẩn hóa vector: \vect, \vt, \vv -> \vec
    .replace(/\\(?:vect|vt|vv)\{/g, '\\vec{')
    // Chuẩn hóa tập số thực, số tự nhiên, nguyên, hữu tỉ, phức
    .replace(/\\R(?![a-zA-Z])/g, '\\mathbb{R}')
    .replace(/\\N(?![a-zA-Z])/g, '\\mathbb{N}')
    .replace(/\\Z(?![a-zA-Z])/g, '\\mathbb{Z}')
    .replace(/\\Q(?![a-zA-Z])/g, '\\mathbb{Q}')
    .replace(/\\C(?![a-zA-Z])/g, '\\mathbb{C}')
    // Chuẩn hóa độ góc: \degree, \deg -> ^\circ
    .replace(/\\degree(?![a-zA-Z])/g, '^\\circ')
    // Chuẩn hóa hàm số lượng giác kiểu cũ của SGK VN: \tg -> \tan, \cotg -> \cot
    .replace(/\\tg(?![a-zA-Z])/g, '\\tan')
    .replace(/\\cotg(?![a-zA-Z])/g, '\\cot')
    // Chuẩn hóa giới hạn, tích phân limits
    .replace(/\\lim\\limits/g, '\\lim')
    .replace(/\\int\\limits/g, '\\int')
    .replace(/\\sum\\limits/g, '\\sum')
    .replace(/\\prod\\limits/g, '\\prod')
    .replace(/\\min\\limits/g, '\\min')
    .replace(/\\max\\limits/g, '\\max')
    .replace(/\\inf\\limits/g, '\\inf')
    .replace(/\\sup\\limits/g, '\\sup')
    // Khử dấu phần trăm chưa escape gây cắt cụt công thức trong LaTeX
    .replace(/(^|[^\\])%/g, '$1\\%')
    // Khử các khối TikZ lọt vào công thức
    .replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '[Hình vẽ đồ thị]')
    .trim();
}

// Render an toàn hỗn hợp văn bản tiếng Việt và công thức toán học KaTeX
export function renderMixedMathAndText(rawInput: string, defaultBlock: boolean = false): string {
  if (!rawInput) return '';

  // 1. Chuẩn hóa font Unicode tiếng Việt (NFC) tránh lỗi phông chữ gõ kiểu cũ (TCVN3 / NFD)
  let normalized = rawInput.normalize('NFC').trim();

  // Tự động đóng dấu $ lẻ nếu bị thiếu ở cuối chuỗi
  const unescapedDollars = (normalized.match(/(^|[^\\])\$/g) || []).length;
  if (unescapedDollars % 2 !== 0) {
    normalized += '$';
  }

  // 2. Nếu chuỗi bắt đầu và kết thúc bằng $$...$$ hoặc \[...\]
  if (
    (normalized.startsWith('$$') && normalized.endsWith('$$') && normalized.length >= 4) ||
    (normalized.startsWith('\\[') && normalized.endsWith('\\]') && normalized.length >= 4)
  ) {
    const rawFormula = normalized.startsWith('$$')
      ? normalized.slice(2, -2).trim()
      : normalized.slice(2, -2).trim();
    const formula = cleanMathFormula(rawFormula);
    try {
      return katex.renderToString(formula, {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: VIETNAMESE_MATH_MACROS,
      });
    } catch {
      return `<div class="katex-fallback font-mono text-xs my-2">${escapeHtml(formula)}</div>`;
    }
  }

  // 3. Nếu chuỗi bắt đầu và kết thúc bằng $...$ hoặc \(...\) mà không có dấu $ nào ở giữa
  if (
    (normalized.startsWith('$') && normalized.endsWith('$') && normalized.length >= 2 && !normalized.slice(1, -1).includes('$')) ||
    (normalized.startsWith('\\(') && normalized.endsWith('\\)') && normalized.length >= 4)
  ) {
    const rawFormula = normalized.startsWith('$')
      ? normalized.slice(1, -1).trim()
      : normalized.slice(2, -2).trim();
    const formula = cleanMathFormula(rawFormula);
    try {
      return katex.renderToString(formula, {
        displayMode: defaultBlock,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: VIETNAMESE_MATH_MACROS,
      });
    } catch {
      return `<span class="katex-fallback font-mono text-xs">${escapeHtml(formula)}</span>`;
    }
  }

  // 4. Nếu là công thức thuần LaTeX không bọc $ (ví dụ: \frac{a}{b}, x^2 + y^2 = R^2)
  if (isPureLatexFormula(normalized)) {
    const formula = cleanMathFormula(normalized);
    try {
      return katex.renderToString(formula, {
        displayMode: defaultBlock,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: VIETNAMESE_MATH_MACROS,
      });
    } catch {
      return `<span class="katex-fallback font-mono text-xs">${escapeHtml(formula)}</span>`;
    }
  }

  // 5. Tách văn bản hỗn hợp chứa các khối $...$, $$...$$, \(...\), \[...\], và các môi trường toán không bọc $
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\begin\{(?:cases|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|aligned|align\*?|gather\*?|array)\}[\s\S]*?\\end\{(?:cases|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|aligned|align\*?|gather\*?|array)\}|\\(?:heva|hoac)\*?\{[\s\S]*?\}|\$[^\$]+?\$|\\\([\s\S]+?\\\))/g;

  const parts = normalized.split(mathRegex);
  let resultHtml = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // A. Khối toán Block: $$...$$ hoặc \[...\]
    if (
      (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) ||
      (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4)
    ) {
      const rawFormula = part.startsWith('$$') ? part.slice(2, -2).trim() : part.slice(2, -2).trim();
      const formula = cleanMathFormula(rawFormula);
      try {
        resultHtml += katex.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          strict: false,
          trust: true,
          macros: VIETNAMESE_MATH_MACROS,
        });
      } catch {
        resultHtml += `<div class="katex-fallback font-mono text-xs my-2">${escapeHtml(formula)}</div>`;
      }
    }
    // B. Môi trường toán đứng độc lập (như \begin{cases}...\end{cases}, \heva{...}, \hoac{...})
    else if (
      part.startsWith('\\begin{') ||
      part.startsWith('\\heva') ||
      part.startsWith('\\hoac')
    ) {
      const formula = cleanMathFormula(part);
      try {
        resultHtml += katex.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          strict: false,
          trust: true,
          macros: VIETNAMESE_MATH_MACROS,
        });
      } catch {
        resultHtml += `<span class="katex-fallback font-mono text-xs">${escapeHtml(formula)}</span>`;
      }
    }
    // C. Khối toán Inline: $...$ hoặc \(...\)
    else if (
      (part.startsWith('$') && part.endsWith('$') && part.length >= 2) ||
      (part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4)
    ) {
      const rawFormula = part.startsWith('$') ? part.slice(1, -1).trim() : part.slice(2, -2).trim();
      const formula = cleanMathFormula(rawFormula);
      try {
        resultHtml += katex.renderToString(formula, {
          displayMode: false,
          throwOnError: false,
          strict: false,
          trust: true,
          macros: VIETNAMESE_MATH_MACROS,
        });
      } catch {
        resultHtml += `<span class="katex-fallback font-mono text-xs">${escapeHtml(formula)}</span>`;
      }
    }
    // D. Văn bản tiếng Việt thông thường
    else {
      // Escape HTML, hỗ trợ **in đậm** an toàn và bảo lưu các ký tự xuống dòng
      const safeText = escapeHtml(part)
        .replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-bold">$1</strong>')
        .replace(/\r?\n/g, '<br />');
      resultHtml += safeText;
    }
  }

  return resultHtml;
}

export const MathView: React.FC<MathViewProps> = ({ math, latex, block = false, className = '' }) => {
  const content = math || latex || '';

  const html = useMemo(() => {
    return renderMixedMathAndText(content, block);
  }, [content, block]);

  return (
    <span
      className={`inline-block font-sans ${block ? 'my-2 overflow-x-auto max-w-full text-center block' : ''} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

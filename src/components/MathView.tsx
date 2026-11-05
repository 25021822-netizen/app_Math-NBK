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
const VIETNAMESE_MATH_MACROS = {
  '\\heva': '\\begin{cases}#1\\end{cases}',
  '\\hoac': '\\left[\\begin{array}{l}#1\\end{array}\\right.',
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
  '\\vt': '\\overrightarrow{#1}',
  '\\vect': '\\overrightarrow{#1}',
  '\\vv': '\\overrightarrow{#1}',
  '\\degree': '^\\circ',
  '\\deg': '^\\circ',
};

function cleanMathFormula(f: string): string {
  return f
    .replace(/\\True(?![a-zA-Z])/g, '')
    .replace(/\\False(?![a-zA-Z])/g, '')
    .replace(/\\TrueTF(?![a-zA-Z])/g, '')
    .replace(/\\FalseTF(?![a-zA-Z])/g, '')
    .trim();
}

// Render an toàn hỗn hợp văn bản tiếng Việt và công thức toán học KaTeX
export function renderMixedMathAndText(rawInput: string, defaultBlock: boolean = false): string {
  if (!rawInput) return '';

  // 1. Chuẩn hóa font Unicode tiếng Việt (NFC) tránh lỗi phông chữ gõ kiểu cũ (TCVN3 / NFD)
  let normalized = rawInput.normalize('NFC').trim();

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

  // 5. Tách văn bản hỗn hợp chứa các khối $...$, $$...$$, \(...\), \[...\]
  // Regex bắt các công thức toán:
  // - $$...$$ (Block)
  // - \[...\] (Block)
  // - $...$ (Inline)
  // - \(...\) (Inline)
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n\r]+?\$|\\\([\s\S]+?\\\))/g;

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
    // B. Khối toán Inline: $...$ hoặc \(...\)
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
    // C. Văn bản tiếng Việt thông thường
    else {
      // Escape HTML và bảo lưu các ký tự xuống dòng
      const safeText = escapeHtml(part).replace(/\r?\n/g, '<br />');
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

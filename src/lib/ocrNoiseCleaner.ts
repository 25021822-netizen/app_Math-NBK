/**
 * Bộ lọc làm sạch ký tự rác (Noise Cleaner) và chuẩn hóa sang định dạng LaTeX cho kết quả quét OCR
 * Tối ưu hóa cho tài liệu toán THPT Việt Nam (sách giáo khoa, ảnh chụp bài thi, viết tay, PDF scan)
 * Giúp tăng độ chính xác tuyệt đối khi bóc tách đề bài và tạo đề thi tự động.
 */

export interface OcrCleanResult {
  cleanedText: string;
  latexFormula: string;
  removedNoiseCount: number;
  detectedArtifacts: string[];
  suggestedPrompt: string;
  extractedOptions?: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  detectedCorrectAnswer?: 'A' | 'B' | 'C' | 'D' | string;
}

/**
 * 1. Làm sạch ký tự rác, watermark, đốm mực và lỗi font từ văn bản OCR thô
 */
export function cleanOcrNoise(raw: string): { text: string; noiseCount: number; artifacts: string[] } {
  if (!raw) return { text: '', noiseCount: 0, artifacts: [] };

  const artifacts: string[] = [];
  let noiseCount = 0;

  // 1. Chuẩn hóa font Unicode dựng sẵn NFC
  let cleaned = raw.normalize('NFC');

  // 2. Loại bỏ các ký tự vô hình, zero-width, non-breaking space, ký tự điều khiển
  const beforeInvisibleLen = cleaned.length;
  cleaned = cleaned
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00AD]/g, '') // Zero-width spaces & soft hyphens
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/\uFFFD/g, '') // Replacement character (lỗi font )
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Ký tự điều khiển ASCII
  if (cleaned.length < beforeInvisibleLen) {
    const diff = beforeInvisibleLen - cleaned.length;
    noiseCount += diff;
    artifacts.push(`${diff} ký tự ẩn / zero-width space`);
  }

  // 3. Chuẩn hóa các dấu nháy và gạch nối đặc thù của OCR
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[–—−]/g, '-');

  // 4. Loại bỏ các dòng tiêu đề rác của trang đề thi PDF/Scan (Header/Footer & Page Numbers noise)
  const headerFooterPatterns = [
    /^[ \t]*(?:Trang|Page)\s*\d+(?:\s*(?:\/|of|trên)\s*\d+)?[ \t]*$/gim, // Trang 1/4, Page 2 of 5
    /^[ \t]*[-–—]\s*\d+\s*[-–—][ \t]*$/gm, // - 1 -, — 2 —
    /^[ \t]*\d{1,2}\s*\/\s*\d{1,2}[ \t]*$/gm, // 1/4, 2/4 (số trang lẻ ở mép giấy)
    /^[ \t]*Mã\s+đề(?:\s+thi)?\s*[:\.]?\s*\w+[ \t]*$/gim,
    /^[ \t]*Họ,?\s*tên\s+thí\s+sinh\s*[:\.]?.*$/gim,
    /^[ \t]*Số\s+báo\s+danh\s*[:\.]?.*$/gim,
    /^[ \t]*Thời\s+gian\s+làm\s+bài\s*[:\.]?.*$/gim,
    /^[ \t]*\(?(?:Đề\s+thi\s+gồm\s+có|Đề\s+thi\s+có)\s+\d+\s+trang\)?.*$/gim,
    /^[ \t]*Thí\s+sinh\s+không\s+được\s+sử\s+dụng\s+tài\s+liệu.*$/gim,
    /^[ \t]*Cán\s+bộ\s+coi\s+thi\s+không\s+giải\s+thích\s+gì\s+thêm.*$/gim,
    /^[ \t]*(?:Chữ\s+ký|Giám\s+thị\s+\d).*$/gim,
    /^[ \t]*(?:BỘ|SỞ)\s+(?:GIÁO\s+DỤC\s+VÀ\s+ĐÀO\s+TẠO|GD\s*&\s*ĐT).*$/gim,
    /^[ \t]*KỲ\s+THI\s+(?:TỐT\s+NGHIỆP|THỬ|CHỌN|KHẢO\s+SÁT).*$/gim,
    /^[ \t]*(?:BẢN\s+QUYỀN|PHOTOCOPY|ĐỀ\s+DỰ\s+BỊ|LƯU\s+HÀNH\s+NỘI\s+BỘ|DO\s+NOT\s+COPY).*$/gim,
    /^[ \t]*(?:https?:\/\/|www\.|file:\/\/)[^\s]+[ \t]*$/gim, // URL footer tự động chèn khi in PDF
    /^[ \t]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?[ \t]*$/gm, // Dấu mốc thời gian in PDF
    /^[ \t]*(?:-{3,}|—{3,}|\*{3,})\s*(?:HẾT|HET)\s*(?:-{3,}|—{3,}|\*{3,})[ \t]*$/gim,
    /^[ \t]*\|\s*\d{1,2}\s*\|[ \t]*$/gm, // Đánh số lề trang scan
  ];

  headerFooterPatterns.forEach((p) => {
    const matches = cleaned.match(p);
    if (matches) {
      noiseCount += matches.length;
      artifacts.push(`Đầu/chân trang PDF: "${matches[0].trim().slice(0, 32)}..."`);
      cleaned = cleaned.replace(p, '');
    }
  });

  // 5. Loại bỏ đốm mực và ký tự rác quang học (speckles, watermarks)
  // Các ký tự lẻ đứng một mình trên một dòng: ~, ^, |, §, ©, ®, ™, •
  const specklesPattern = /^[ \t]*[~^|_•§©®™\\]+[ \t]*$/gm;
  const specklesMatches = cleaned.match(specklesPattern);
  if (specklesMatches) {
    noiseCount += specklesMatches.length;
    artifacts.push(`${specklesMatches.length} đốm ký tự rác quang học`);
    cleaned = cleaned.replace(specklesPattern, '');
  }

  // 6. Chuẩn hóa khoảng trắng dư thừa
  cleaned = cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: cleaned, noiseCount, artifacts };
}

/**
 * 2. Chuyển đổi các biểu thức toán dạng text OCR sang cú pháp LaTeX chuẩn
 */
export function convertOcrToStandardLatex(text: string): string {
  if (!text) return '';

  let converted = text;

  // Chuẩn hóa tiền tố câu: "câu 1.", "Câu 1:"
  converted = converted.replace(/^(?:câu|bài|question)\s*(\d+)[\.:\s\-]+/im, 'Câu $1: ');

  // 1. Phép toán quan hệ & toán tử logic
  converted = converted
    .replace(/<=\s*|<=\s*/g, ' \\le ')
    .replace(/>=\s*|>=\s*/g, ' \\ge ')
    .replace(/!=\s*|<>/g, ' \\neq ')
    .replace(/\+\s*-\s*|\+-\s*/g, ' \\pm ')
    .replace(/\s*(?:->|-->)\s*/g, ' \\to ')
    .replace(/\s*=>\s*/g, ' \\implies ');

  // 2. Ký hiệu hình học không gian THPT
  converted = converted
    .replace(/\bvecto\s+([A-Z]{1,2})\b/gi, ' \\vec{$1} ')
    .replace(/\bvectơ\s+([A-Z]{1,2})\b/gi, ' \\vec{$1} ')
    .replace(/\bvec\s+([A-Z]{1,2})\b/gi, ' \\vec{$1} ')
    .replace(/\s*\/\/\s*/g, ' \\parallel ')
    .replace(/\s*_\+_\s*|\s*_\|_\s*/g, ' \\perp ')
    .replace(/\btam\s+giác\s+([A-Z]{3})\b/gi, ' \\triangle $1 ')
    .replace(/\bgóc\s+([A-Z]{3})\b/gi, ' \\widehat{$1} ')
    .replace(/(\d+)\s*(?:độ|do)\b/gi, '$1^\\circ');

  // 3. Ký hiệu giải tích & đại số THPT
  converted = converted
    .replace(/\b(?:vo cung|vô cùng|vô cực)\b/gi, ' \\infty ')
    .replace(/\b(?:thuoc|thuộc)\b/g, ' \\in ')
    .replace(/\b(?:không thuộc|ko thuoc)\b/g, ' \\notin ')
    .replace(/\b(?:căn bậc hai của|căn của|can bac hai cua)\s*([a-zA-Z0-9\$\\]+)/gi, ' \\sqrt{$1} ')
    .replace(/\b(?:can|căn|sqrt)\s*\(([^)]+)\)/gi, ' \\sqrt{$1} ');

  // 4. Số mũ toán học thường bị OCR nhận diện rời rạc (ví dụ: x 2 -> x^2, x 3 -> x^3)
  converted = converted
    .replace(/([a-zA-Z\)])\s+([2-9])(?=\s|[,\.\+\-\*\/=]|$)/g, '$1^{$2}')
    .replace(/([a-zA-Z\)])\s*\^\s*([0-9a-zA-Z]+)/g, '$1^{$2}');

  // 5. Tích phân dạng text: "tích phân từ a đến b của f(x) dx"
  converted = converted.replace(
    /\btích\s+phân\s+từ\s+([a-zA-Z0-9\-\+\^\\]+)\s+đến\s+([a-zA-Z0-9\-\+\^\\]+)\s+của\s+([\s\S]+?)\s*d([xyzut])/gi,
    ' \\int_{$1}^{$2} $3 \\, \\mathrm{d}$4 '
  );

  // 6. Hệ phương trình có dấu ngoặc nhọn ở đầu dòng -> chuyển sang \heva
  if (converted.includes('{\n') || /\{\s*[a-zA-Z0-9]/.test(converted)) {
    converted = converted.replace(/\{\s*([^}]+?)(?:\}|$)/g, (_match, inner) => {
      const lines = inner.split(/[\n,;]+/).map((l: string) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        return `\\begin{cases} ${lines.join(' \\\\ ')} \\end{cases}`;
      }
      return inner;
    });
  }

  // 7. Tự động bao bọc các công thức toán trong $...$ nếu chúng đang đứng trần ngoài văn bản
  // Tìm các đoạn chứa các lệnh LaTeX: \frac, \sqrt, \int, \le, \ge, \neq, \parallel, \perp, \infty, \vec, \triangle
  converted = converted.replace(
    /(?<!\$)(?:\\(?:frac|sqrt|int|sum|lim|vec|parallel|perp|le|ge|neq|pm|to|implies|infty|in|notin|triangle|widehat|begin\{cases\}[\s\S]*?\\end\{cases\})[^\$\n\r]*?)(?!\$)/g,
    (match) => {
      const trimmed = match.trim();
      return trimmed.startsWith('$') ? trimmed : `$${trimmed}$`;
    }
  );

  // Khử các cặp dấu $$ dư thừa lồng nhau
  converted = converted
    .replace(/\$\$\$/g, '$')
    .replace(/\$\s*\$/g, '')
    .trim();

  return converted;
}

/**
 * 3. Trích xuất phương án trắc nghiệm A, B, C, D từ bài toán OCR đã làm sạch
 */
export function extractOptionsFromOcr(text: string): {
  prompt: string;
  options?: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctAnswer?: 'A' | 'B' | 'C' | 'D';
} {
  const parts = text.split(/(?=(?:^|\s{2,}|\n|\t)\s*(?:[A-D]\s*[\.\:\)]|\([A-D]\)|\[[A-D]\]))/);

  if (parts.length >= 5) {
    const prompt = parts[0].trim();
    const options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[] = [];
    let correct: 'A' | 'B' | 'C' | 'D' = 'A';

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].trim();
      const match = p.match(/^(?:([A-D])\s*[\.\:\)]|\(([A-D])\)|\[([A-D])\])\s*([\s\S]*)$/i);
      if (match) {
        const key = (match[1] || match[2] || match[3]).toUpperCase() as 'A' | 'B' | 'C' | 'D';
        let optText = match[4].trim();

        // Kiểm tra xem phương án có ký hiệu đúng không
        if (optText.includes('(Đúng)') || optText.includes('[Đúng]') || optText.includes('\\True') || optText.includes('*')) {
          correct = key;
          optText = optText.replace(/\((?:Đúng|Sai)\)|\[(?:Đúng|Sai)\]|\\True|\*/gi, '').trim();
        }

        options.push({ key, text: optText || `Phương án ${key}` });
      }
    }

    if (options.length >= 4) {
      return {
        prompt,
        options: options.slice(0, 4),
        correctAnswer: correct,
      };
    }
  }

  return { prompt: text.trim() };
}

/**
 * 4. Hàm điều phối chính: Làm sạch Noise OCR và chuẩn hóa sang định dạng LaTeX hoàn chỉnh
 */
export function cleanOcrTextAndConvertToLatex(rawInput: string): OcrCleanResult {
  if (!rawInput) {
    return {
      cleanedText: '',
      latexFormula: '',
      removedNoiseCount: 0,
      detectedArtifacts: [],
      suggestedPrompt: '',
    };
  }

  // Bước 1: Khử sạch noise và artifacts
  const { text: noiseCleaned, noiseCount, artifacts } = cleanOcrNoise(rawInput);

  // Bước 2: Chuyển đổi ký hiệu toán sang LaTeX chuẩn
  const latexNormalized = convertOcrToStandardLatex(noiseCleaned);

  // Bước 3: Trích xuất phương án A, B, C, D nếu có
  const { prompt, options, correctAnswer } = extractOptionsFromOcr(latexNormalized);

  // Trích xuất công thức toán học chính (nếu có)
  const mathFormulaMatch = latexNormalized.match(/\$([^$\n\r]{3,})\$/);
  const latexFormula = mathFormulaMatch ? mathFormulaMatch[1].trim() : '';

  return {
    cleanedText: latexNormalized,
    latexFormula,
    removedNoiseCount: noiseCount,
    detectedArtifacts: artifacts,
    suggestedPrompt: prompt || latexNormalized,
    extractedOptions: options,
    detectedCorrectAnswer: correctAnswer,
  };
}

/**
 * 5. Loại bỏ ký tự nhiễu thường gặp trong PDF (header/footer, số trang, mã đề) và chuẩn hóa OCR
 */
export function cleanPdfNoiseAndOcr(raw: string): OcrCleanResult {
  return cleanOcrTextAndConvertToLatex(raw);
}

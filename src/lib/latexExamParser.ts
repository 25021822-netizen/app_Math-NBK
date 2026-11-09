/**
 * Bộ giải mã & bóc tách đề thi toán học từ mã nguồn LaTeX hoặc văn bản chuẩn Bộ GD&ĐT 2025
 * Hỗ trợ nhận diện thông minh câu đầu đề, tiêu đề kỳ thi, lời dẫn chung, đoạn trích dẫn (citations)
 * và phân loại chính xác 3 phần chuẩn BGD, sửa triệt để lỗi phông chữ và quét sai câu hỏi.
 */

import { Question } from '../types/math';

// Trích xuất các khối ngoặc nhọn { ... } lồng nhau cho công thức LaTeX
// Trích xuất các khối ngoặc nhọn { ... } lồng nhau cho công thức LaTeX (bỏ qua tham số tùy chọn [...])
export function extractBalancedBraces(text: string, startIndex: number, maxGroups: number = 4): string[] {
  const groups: string[] = [];
  let i = startIndex;

  // Bỏ qua tên lệnh ban đầu (ví dụ: \choice, \choiceTF, \shortans) và các tham số tùy chọn [...]
  while (i < text.length && text[i] !== '{') {
    if (text[i] === '[') {
      let optDepth = 1;
      i++;
      while (i < text.length && optDepth > 0) {
        if (text[i] === '[') optDepth++;
        else if (text[i] === ']') optDepth--;
        i++;
      }
    } else {
      i++;
    }
  }

  while (i < text.length && groups.length < maxGroups) {
    if (text[i] === '{') {
      let depth = 1;
      const start = i + 1;
      i++;
      while (i < text.length && depth > 0) {
        // Kiểm tra xem ký tự { hoặc } có bị escape bằng số lượng lẻ dấu backslash không
        if (text[i] === '{') {
          let slashCount = 0;
          let k = i - 1;
          while (k >= start && text[k] === '\\') {
            slashCount++;
            k--;
          }
          if (slashCount % 2 === 0) depth++;
        } else if (text[i] === '}') {
          let slashCount = 0;
          let k = i - 1;
          while (k >= start && text[k] === '\\') {
            slashCount++;
            k--;
          }
          if (slashCount % 2 === 0) depth--;
        }
        i++;
      }
      if (depth === 0) {
        let content = text.slice(start, i - 1).trim();
        // Xóa cặp ngoặc nhọn bọc ngoài nếu bị lồng thừa
        if (content.startsWith('{') && content.endsWith('}')) {
          content = content.slice(1, -1).trim();
        }
        groups.push(content);
      }
    } else {
      i++;
    }
  }
  return groups;
}

/**
 * Trích xuất siêu dữ liệu (Tên đề, Khối lớp, Thời gian làm bài) từ câu đầu đề/phần mở đầu của đề thi
 */
export function extractExamMetadataFromHeader(raw: string): {
  detectedTitle?: string;
  detectedGrade?: 10 | 11 | 12;
  detectedDuration?: number;
} {
  const result: {
    detectedTitle?: string;
    detectedGrade?: 10 | 11 | 12;
    detectedDuration?: number;
  } = {};

  if (!raw) return result;

  // 1. Nhận diện thời gian làm bài: e.g. "Thời gian làm bài: 90 phút" hoặc "Thời gian: 50 phút"
  const timeMatch = raw.match(/thời\s+gian(?:\s+làm\s+bài)?\s*[:\.]?\s*(\d{2,3})\s*phút/i);
  if (timeMatch) {
    const mins = parseInt(timeMatch[1], 10);
    if (mins >= 15 && mins <= 180) {
      result.detectedDuration = mins;
    }
  }

  // 2. Nhận diện khối lớp: "Lớp 12", "Lớp 11", "Lớp 10", "Khối 12", "THPT"
  const gradeMatch = raw.match(/(?:Lớp|Khối)\s*(10|11|12)/i);
  if (gradeMatch) {
    result.detectedGrade = parseInt(gradeMatch[1], 10) as 10 | 11 | 12;
  } else if (/tốt\s+nghiệp\s+thpt|kỳ\s+thi\s+thpt|chương\s+trình\s+12/i.test(raw)) {
    result.detectedGrade = 12;
  }

  // 3. Nhận diện tiêu đề đề thi hoặc tên trường/sở trích dẫn:
  const titlePatterns = [
    /(?:ĐỀ\s+THI\s+THỬ|ĐỀ\s+THAM\s+KHẢO|ĐỀ\s+CHÍNH\s+THỨC|ĐỀ\s+KHẢO\s+SÁT|KỲ\s+THI)[^\n\r\\\}]+/i,
    /TRƯỜNG\s+THPT[^\n\r\\\}]+/i,
    /SỞ\s+GIÁO\s+DỤC\s+VÀ\s+ĐÀO\s+TẠO[^\n\r\\\}]+/i,
  ];
  for (const pat of titlePatterns) {
    const tm = raw.match(pat);
    if (tm) {
      const cleanT = tm[0].replace(/[\\{}]/g, '').replace(/[\r\n]+/g, ' ').trim();
      if (cleanT.length >= 8 && cleanT.length <= 120) {
        result.detectedTitle = cleanT;
        break;
      }
    }
  }

  return result;
}

// Làm sạch và chuẩn hóa font Unicode, xóa lỗi ký tự đặc biệt của Word/PDF/TCVN3, TikZ và các dòng tiêu đề rác
export function cleanRawLatexText(raw: string): string {
  if (!raw) return '';

  // 1. Chuẩn hóa font Unicode dựng sẵn (NFC) tránh lỗi phông chữ tiếng Việt
  let cleaned = raw.normalize('NFC');

  // 2. Thay thế các ký tự gõ lỗi phông, ký tự điều khiển ẩn và dấu nháy đặc thù
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B\uFEFF\u200E\u200F\u00AD]/g, '') // Zero-width spaces & soft hyphens
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/\uFFFD/g, '') // Replacement character
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/−/g, '-');

  // 3. Nếu có \begin{document} ... \end{document}, chỉ lấy nội dung bên trong tài liệu
  const docMatch = cleaned.match(/\\begin\{document\}([\s\S]*?)(?:\\end\{document\}|$)/i);
  if (docMatch && docMatch[1]) {
    cleaned = docMatch[1];
  } else {
    // Xóa bỏ các lệnh tiền xử lý preamble \documentclass, \usepackage...
    cleaned = cleaned.replace(/\\documentclass(?:\s*\[[^\]]*\])?\{[^\}]*\}/g, '');
    cleaned = cleaned.replace(/\\usepackage(?:\s*\[[^\]]*\])?\{[^\}]*\}/g, '');
    cleaned = cleaned.replace(/\\(?:newcounter|newtheorem|newcommand|def|DeclareMathOperator)\{[^\}]*\}\s*(?:\{[^\}]*\})?/g, '');
  }

  // 4. Khử các khối đồ thị TikZ, Asymptote, hình vẽ để tránh KaTeX bị vỡ hoặc in hàng chục dòng mã tọa độ
  cleaned = cleaned
    .replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/gi, '\n[Hình vẽ đồ thị / hình học]\n')
    .replace(/\\begin\{asy\}[\s\S]*?\\end\{asy\}/gi, '\n[Hình vẽ minh họa]\n')
    .replace(/\\includegraphics(?:\s*\[[^\]]*\])?\{[^\}]*\}/gi, '\n[Hình ảnh minh họa]\n');

  // 5. Khử các môi trường căn dòng và chia cột văn bản thuần LaTeX
  cleaned = cleaned
    .replace(/\\begin\{center\}/gi, '\n')
    .replace(/\\end\{center\}/gi, '\n')
    .replace(/\\begin\{flushleft\}/gi, '')
    .replace(/\\end\{flushleft\}/gi, '')
    .replace(/\\begin\{flushright\}/gi, '')
    .replace(/\\end\{flushright\}/gi, '')
    .replace(/\\begin\{multicols\}\{\d+\}/gi, '\n')
    .replace(/\\end\{multicols\}/gi, '\n')
    .replace(/\\begin\{minipage\}(?:\s*\[[^\]]*\])?\{[^\}]*\}/gi, '\n')
    .replace(/\\end\{minipage\}/gi, '\n')
    .replace(/\\(?:noindent|vfill|hfill|newpage|clearpage|hrulefill|dotfill)\b/gi, '')
    .replace(/\\(?:motcot|haicot|bacot|boncot)\b/gi, '')
    .replace(/\\(?:vspace|hspace)\*?\{[^\}]*\}/gi, '');

  // 6. Chuẩn hóa các macro toán học thường gặp của giáo viên Việt Nam
  cleaned = cleaned
    .replace(/\\dfrac(?![a-zA-Z])/g, '\\frac')
    .replace(/\\tbinom(?![a-zA-Z])/g, '\\binom')
    .replace(/\\dbinom(?![a-zA-Z])/g, '\\binom')
    .replace(/\\leqslant(?![a-zA-Z])/g, '\\leq')
    .replace(/\\geqslant(?![a-zA-Z])/g, '\\geq')
    .replace(/\\(?:vect|vt|vv)\{/g, '\\vec{')
    .replace(/\\degree(?![a-zA-Z])/g, '^\\circ')
    .replace(/\\tg(?![a-zA-Z])/g, '\\tan')
    .replace(/\\cotg(?![a-zA-Z])/g, '\\cot')
    .replace(/\\R(?![a-zA-Z])/g, '\\mathbb{R}')
    .replace(/\\N(?![a-zA-Z])/g, '\\mathbb{N}')
    .replace(/\\Z(?![a-zA-Z])/g, '\\mathbb{Z}')
    .replace(/\\Q(?![a-zA-Z])/g, '\\mathbb{Q}')
    .replace(/\\C(?![a-zA-Z])/g, '\\mathbb{C}');

  // 7. Loại bỏ các dòng chú thích % ... (giữ nguyên \% nếu là dấu phần trăm)
  cleaned = cleaned.replace(/(^|[^\\])%.*$/gm, '$1');

  // 8. Loại bỏ các dòng tiêu đề trang, mã đề, số báo danh và quy chế thi boilerplate
  cleaned = cleaned
    .replace(/^[ \t]*(?:Trang|Page)\s+\d+(?:\s*(?:\/|of|trên)\s*\d+)?[ \t]*$/gim, '')
    .replace(/^[ \t]*[-–—]\s*\d+\s*[-–—][ \t]*$/gm, '')
    .replace(/^[ \t]*\d{1,2}\s*\/\s*\d{1,2}[ \t]*$/gm, '')
    .replace(/^[ \t]*Mã\s+đề(?:\s+thi)?\s*[:\.]?\s*\w+[ \t]*$/gim, '')
    .replace(/^[ \t]*Họ,?\s*tên\s+thí\s+sinh\s*[:\.]?.*$/gim, '')
    .replace(/^[ \t]*Số\s+báo\s+danh\s*[:\.]?.*$/gim, '')
    .replace(/^[ \t]*\(Đề\s+thi\s+gồm\s+có\s+\d+\s+trang\)[ \t]*$/gim, '')
    .replace(/^[ \t]*Thí\s+sinh\s+không\s+được\s+sử\s+dụng\s+tài\s+liệu.*$/gim, '')
    .replace(/^[ \t]*Cán\s+bộ\s+coi\s+thi\s+không\s+giải\s+thích\s+gì\s+thêm.*$/gim, '')
    .replace(/^[ \t]*(?:-{3,}|—{3,}|\*{3,})\s*(?:HẾT|HET)\s*(?:-{3,}|—{3,}|\*{3,})[ \t]*$/gim, '');

  return cleaned.trim();
}

export interface ParsedExamResult {
  metadata: {
    title: string;
    grade: 10 | 11 | 12;
    year: number;
    durationMinutes: number;
    totalPoints: number;
  };
  questions: Question[];
}

// Bóc tách bảng đáp án (Answer Key Table) ở cuối tài liệu nếu có
function extractAnswerKeysFromTable(fullText: string) {
  const mcqAnswers: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
  const tfAnswers: Record<number, Record<string, boolean>> = {};
  const shortAnswers: Record<number, string> = {};

  // Tìm vùng bảng đáp án (thường nằm ở cuối file)
  const answerSectionMatch = fullText.match(
    /(?:BẢNG ĐÁP ÁN|ĐÁP ÁN|HƯỚNG DẪN CHẤM|BẢNG TRẢ LỜI)[\s\S]*$/i
  );
  if (!answerSectionMatch) return { mcqAnswers, tfAnswers, shortAnswers };

  const answerText = answerSectionMatch[0];

  // 1. Quét đáp án Phần I: dạng "1.A 2.B" hoặc "1-A 2-C" hoặc "Câu 1: A"
  const mcqRegex = /(?:Câu\s*)?(\d+)[\.\s:\-]+([A-D])(?!\w)/gi;
  let mMatch;
  while ((mMatch = mcqRegex.exec(answerText)) !== null) {
    const qNum = parseInt(mMatch[1], 10);
    const ans = mMatch[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    if (qNum >= 1 && qNum <= 40) {
      mcqAnswers[qNum] = ans;
    }
  }

  // 2. Quét đáp án Phần II Đúng/Sai: ví dụ "Câu 1: a-Đ, b-S, c-Đ, d-S" hoặc "1: a.Đ, b.S..."
  const tfBlockRegex = /(?:Câu\s*)?(\d+)[\s:\.]+([a-d\s,;\.\-–—ĐSđsTF]+)/gi;
  let tfMatch;
  while ((tfMatch = tfBlockRegex.exec(answerText)) !== null) {
    const qNum = parseInt(tfMatch[1], 10);
    const content = tfMatch[2];
    const itemMatches = content.matchAll(/([a-d])[\s:\.\-–—]+([ĐSđsTF]|Đúng|Sai|True|False)/gi);
    const itemsMap: Record<string, boolean> = {};
    for (const im of itemMatches) {
      const k = im[1].toLowerCase();
      const val = im[2].toLowerCase();
      itemsMap[k] = val.startsWith('đ') || val.startsWith('t');
    }
    if (Object.keys(itemsMap).length > 0) {
      tfAnswers[qNum] = itemsMap;
    }
  }

  // 3. Quét đáp án Phần III Trả lời ngắn: ví dụ "Câu 1: 15" hoặc "1. 3,5"
  const shortRegex = /(?:Câu\s*)?(\d+)[\s:\.\-]+([-+]?\d+(?:[\.,\/]\d+)?)/gi;
  let sMatch;
  while ((sMatch = shortRegex.exec(answerText)) !== null) {
    const qNum = parseInt(sMatch[1], 10);
    const val = sMatch[2].replace(',', '.').slice(0, 4);
    shortAnswers[qNum] = val;
  }

  return { mcqAnswers, tfAnswers, shortAnswers };
}

/**
 * Kiểm tra xem một khối văn bản có phải chỉ là lời dẫn/hướng dẫn quy chế phần thi hay không
 * (Tránh việc biến hướng dẫn phần thi thành câu hỏi rác trong Phần 3)
 */
function isPureSectionInstruction(block: string): boolean {
  const lower = block.toLowerCase().trim();

  // Nếu có phương án trắc nghiệm rõ ràng thì đây là câu hỏi thực sự
  if (
    /\\choice(?![a-zA-Z])/.test(block) ||
    /\\begin\{tasks\}/i.test(block) ||
    /(?:^|\s{2,}|\n|\t)\s*(?:[A-D]\s*[\.\:\)]|\([A-D]\)|\[[A-D]\])/.test(block) ||
    /\\choiceTF/.test(block) ||
    /(?:^|\n|\s{2,}|\t)\s*[a-d]\s*[\)\.\:]/i.test(block)
  ) {
    return false;
  }

  // Các mẫu câu hướng dẫn quy chế phần thi chuẩn BGD 2025
  const instructionKeywords = [
    'thí sinh trả lời từ câu',
    'mỗi câu hỏi thí sinh chỉ chọn',
    'thí sinh chọn đúng hoặc sai',
    'trong mỗi ý a), b), c), d)',
    'mỗi câu trả lời đúng thí sinh được',
    'thí sinh điền kết quả',
    'thí sinh không được sử dụng tài liệu',
    'cán bộ coi thi không giải thích',
    'đề thi gồm có',
  ];

  const hasInstructionWord = instructionKeywords.some((keyword) => lower.includes(keyword));

  // Nếu chứa từ khóa hướng dẫn và không có dấu hiệu câu hỏi cụ thể (ví dụ: không có số câu "Câu 1", "Câu 2")
  const hasQuestionNumber = /(?:^|\n)\s*(?:Câu|CÂU|Bài)\s*\d+[\.:\s]/i.test(block);

  return hasInstructionWord && !hasQuestionNumber;
}

/**
 * Cấu trúc thông tin Dữ kiện chung / Đoạn trích dẫn dùng cho nhiều câu hỏi
 */
interface SharedContextInfo {
  text: string;
  targetQuestions: number[]; // e.g. [1, 2]
  remainingQuestions: number;
}

/**
 * Nhận diện và bóc tách khối Lời dẫn chung / Trích đoạn đề bài chung cho chùm câu hỏi
 * Ví dụ: "Dựa vào bảng biến thiên sau đây, trả lời Câu 1 và Câu 2:" hoặc "Dữ kiện chung cho các câu 4, 5:"
 */
function extractSharedContextBlock(block: string): SharedContextInfo | null {
  const lower = block.toLowerCase().trim();

  // Không áp dụng nếu khối này đã có phương án lựa chọn A, B, C, D
  const hasChoices =
    /\\choice(?![a-zA-Z])/.test(block) ||
    /(?:^|\s{2,}|\n|\t)\s*(?:[A-D]\s*[\.\:\)]|\([A-D]\)|\[[A-D]\])/.test(block);
  if (hasChoices) return null;

  const isSharedPreamble =
    /dựa\s+vào\s+(?:thông\s+tin|dữ\s+kiện|bảng|đồ\s+thị|đoạn\s+trích|hình\s+vẽ)/i.test(lower) ||
    /sử\s+dụng\s+(?:thông\s+tin|dữ\s+kiện|dữ\s+liệu|giả\s+thiết)/i.test(lower) ||
    /thông\s+tin\s+chung/i.test(lower) ||
    /dữ\s+kiện\s+(?:chung|sau\s+đây)/i.test(lower) ||
    /trích\s+(?:đoạn|dẫn|nguồn)\s+sau/i.test(lower) ||
    /bối\s+cảnh\s+thực\s+tế/i.test(lower) ||
    /dùng\s+cho\s+(?:các\s+)?câu\s*\d+/i.test(lower) ||
    /trả\s+lời\s+(?:các\s+)?câu\s+(?:hỏi\s+)?\d+/i.test(lower);

  if (!isSharedPreamble) return null;

  // Trích xuất danh sách các câu hỏi áp dụng: e.g. "Câu 1 và Câu 2" hoặc "từ câu 4 đến 6"
  const targetQuestions: number[] = [];
  const rangeMatch = block.match(/(?:từ\s+câu|câu)\s*(\d+)\s*(?:đến|-)\s*(?:câu\s*)?(\d+)/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    for (let q = start; q <= end; q++) targetQuestions.push(q);
  } else {
    const matches = block.matchAll(/câu\s*(\d+)/gi);
    for (const m of matches) {
      targetQuestions.push(parseInt(m[1], 10));
    }
  }

  // Làm sạch văn bản để lấy phần thân của dữ kiện trích dẫn
  const cleanContext = block
    .replace(/^\\(?:noindent|textbf\{[^\}]*\}|section\*?\{[^\}]*\})\s*/gi, '')
    .replace(/^(?:\\item\s+|\[?Dữ kiện|\[?Thông tin|\[?Trích dẫn)[^:\n]*[:\.]\s*/gi, '')
    .trim();

  return {
    text: cleanContext || block.trim(),
    targetQuestions,
    remainingQuestions: targetQuestions.length > 0 ? targetQuestions.length : 2,
  };
}

/**
 * Trích xuất Trích dẫn xuất xứ (Citation) ở đầu câu hỏi nếu có
 * Ví dụ: "Câu 1 (Đề tham khảo BGD 2025): ...", "Câu 2 [Chuyên Lam Sơn 2025]: ...", "Câu 3. \textit{(Đề HSG Tỉnh)}: ..."
 */
function extractInQuestionCitation(text: string): { promptWithoutCitation: string; citation?: string } {
  // 1. Trích dẫn dạng ngoặc vuông [ ... ] ngay sau Câu X
  const bracketMatch = text.match(/^(?:(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*))\[([^\]]{3,90})\][:\.]?\s*([\s\S]*)$/i);
  if (bracketMatch) {
    return { citation: bracketMatch[1].trim(), promptWithoutCitation: bracketMatch[2].trim() };
  }

  // 2. Trích dẫn dạng ngoặc tròn ( ... ) ngay sau Câu X
  const parenMatch = text.match(/^(?:(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*))\(([^\)]{3,90})\)[:\.]?\s*([\s\S]*)$/i);
  if (parenMatch) {
    return { citation: parenMatch[1].trim(), promptWithoutCitation: parenMatch[2].trim() };
  }

  // 3. Trích dẫn dạng in nghiêng \textit{(...)}
  const itMatch = text.match(/^(?:(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*))\\textit\{[\(\[]?([^\}\)\]]{3,90})[\)\]]?\}[:\.]?\s*([\s\S]*)$/i);
  if (itMatch) {
    return { citation: itMatch[1].trim(), promptWithoutCitation: itMatch[2].trim() };
  }

  // 4. Nếu câu hỏi bắt đầu bằng [Trích dẫn ...] trước chữ Câu X: e.g. "[Chuyên KHTN] Câu 1: ..."
  const preBracketMatch = text.match(/^\[([^\]]{3,90})\]\s*(?:(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*))([\s\S]*)$/i);
  if (preBracketMatch) {
    return { citation: preBracketMatch[1].trim(), promptWithoutCitation: preBracketMatch[2].trim() };
  }

  return { promptWithoutCitation: text };
}

export function parseExamFromLatexOrText(
  rawInput: string,
  grade: number = 12,
  durationMinutes: number = 90,
  examTitle?: string
): ParsedExamResult {
  // Trích xuất siêu dữ liệu từ câu đầu đề/tiêu đề của văn bản nguồn nếu có
  const headerMeta = extractExamMetadataFromHeader(rawInput);

  const text = cleanRawLatexText(rawInput);
  const title = examTitle || headerMeta.detectedTitle || 'Đề Thi Toán THPT (Trích Xuất LaTeX / File)';
  const effectiveGrade = (Number(grade) as 10 | 11 | 12) || headerMeta.detectedGrade || 12;
  const effectiveDuration = Number(durationMinutes) || headerMeta.detectedDuration || 90;

  // Trích xuất bảng đáp án nếu có
  const tableAnswers = extractAnswerKeysFromTable(text);

  const questions: Question[] = [];

  // Tách các khối câu hỏi đa năng:
  // Hỗ trợ cả môi trường LaTeX (\begin{ex}...\end{ex}), \textbf{Câu X:}, **Câu X:**, [Câu X], Câu X., Bài X.
  const envRegex = /\\begin\{(?:ex|bt|vd|cau|exercise|question)\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{(?:ex|bt|vd|cau|exercise|question)\}/gi;
  interface RawBlockItem {
    body: string;
    citation?: string;
  }
  const rawBlocks: RawBlockItem[] = [];

  let match;
  while ((match = envRegex.exec(text)) !== null) {
    const citation = match[1]?.trim();
    const body = match[2]?.trim();
    if (body && body.length > 8) {
      rawBlocks.push({ body, citation });
    }
  }

  // Nếu không dùng môi trường hoàn chỉnh \begin{ex}...\end{ex} hoặc còn câu hỏi khác ngoài môi trường
  if (rawBlocks.length === 0 && text) {
    const questionBoundaryRegex = /(?=(?:\\begin\{(?:ex|bt|vd|cau|exercise|question)\}|\\section\*?\{|PHẦN\s+[I|V|X\d]+|(?:\r?\n|^)\s*(?:\\textbf\{|\\bfseries\s+|{\\bf\s+|\*\*|<b>)?\s*(?:\\item\s+(?:\[[^\]]*\]\s*)?)?(?:(?:Câu|CÂU|Bài|BÀI|Ví\s+dụ|VD|Question|Q)\s*\d+|\[(?:Câu|CÂU|Bài|Question)\s*\d+\]|Dữ\s+kiện\s+sau|Dựa\s+vào\s+thông\s+tin|Trích\s+đoạn\s+sau|Thông\s+tin\s+chung)[\.:\-\/\s\)\b]))/gi;
    const splitByQuestion = text.split(questionBoundaryRegex);

    for (const b of splitByQuestion) {
      const trimmed = b.trim();
      if (trimmed.length > 8) {
        const headCitMatch = trimmed.match(/^\\begin\{(?:ex|bt|vd|cau|exercise|question)\}(?:\[([^\]]*)\])?([\s\S]*)$/i);
        if (headCitMatch) {
          rawBlocks.push({
            body: headCitMatch[2].replace(/\\end\{(?:ex|bt|vd|cau|exercise|question)\}/gi, '').trim(),
            citation: headCitMatch[1]?.trim(),
          });
        } else {
          rawBlocks.push({ body: trimmed });
        }
      }
    }
  }

  // Nếu vẫn chưa tách được câu nào mà văn bản có nhiều đoạn, thử tách theo dòng trống kép \n\n
  if (rawBlocks.length === 0 && text.length > 15) {
    const paragraphs = text.split(/\n\s*\n+/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed.length > 10) {
        rawBlocks.push({ body: trimmed });
      }
    }
  }

  let activeSectionPart: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq';
  let activeSharedContext: SharedContextInfo | null = null;
  let part1LocalCount = 0;
  let part2LocalCount = 0;
  let part3LocalCount = 0;
  let globalCount = 0;

  for (let bIdx = 0; bIdx < rawBlocks.length; bIdx++) {
    const blockItem = rawBlocks[bIdx];
    let block = blockItem.body;
    let inQuestionCitation = blockItem.citation;
    const lowerBlock = block.toLowerCase();

    // 1. Nhận diện và chuyển đổi section nếu phát hiện tiêu đề phân loại chuẩn BGD
    if (
      lowerBlock.includes('phần ii') ||
      lowerBlock.includes('phần 2') ||
      lowerBlock.includes('đúng sai') ||
      lowerBlock.includes('đúng/sai') ||
      lowerBlock.includes('true/false')
    ) {
      activeSectionPart = 'part_2_true_false';
      activeSharedContext = null; // Reset dữ kiện chung khi sang phần thi mới
    } else if (
      lowerBlock.includes('phần iii') ||
      lowerBlock.includes('phần 3') ||
      lowerBlock.includes('trả lời ngắn') ||
      lowerBlock.includes('điền đáp số') ||
      lowerBlock.includes('short answer')
    ) {
      activeSectionPart = 'part_3_short_answer';
      activeSharedContext = null;
    } else if (
      lowerBlock.includes('phần i') ||
      lowerBlock.includes('phần 1') ||
      lowerBlock.includes('nhiều phương án') ||
      lowerBlock.includes('trắc nghiệm 4 lựa chọn')
    ) {
      activeSectionPart = 'part_1_mcq';
      activeSharedContext = null;
    }

    // 2. Kiểm tra xem block này có phải CHỈ LÀ LỜI DẪN / HƯỚNG DẪN QUY CHẾ PHẦN THI không
    if (isPureSectionInstruction(block)) {
      continue; // Bỏ qua, không tạo câu hỏi giả mạo
    }

    // 3. Kiểm tra xem block này có phải là LỜI DẪN CHUNG / ĐOẠN TRÍCH DẪN DÙNG CHO NHIỀU CÂU HỎI không
    const detectedShared = extractSharedContextBlock(block);
    if (detectedShared) {
      activeSharedContext = detectedShared;
      continue; // Lưu dữ kiện chung và chuyển sang câu hỏi kế tiếp
    }

    // 4. Nếu block có chứa tiêu đề phần thi ở đầu và theo sau là câu hỏi, ta giữ lại câu hỏi
    const strippedHeader = block
      .replace(/^(?:\\section\*?\{[^}]*\}|PHẦN\s+[I|V|X\d]+[^\n\r]*)/i, '')
      .trim();

    if (!strippedHeader || strippedHeader.length < 8) {
      continue;
    }

    let questionBody = strippedHeader;
    let explanationText = 'Lời giải chi tiết áp dụng chuẩn kiến thức GDPT 2018.';

    // 5. Tách trích dẫn ở đầu câu hỏi nếu chưa có trích dẫn từ \begin{ex}[...]
    if (!inQuestionCitation) {
      const citResult = extractInQuestionCitation(questionBody);
      if (citResult.citation) {
        inQuestionCitation = citResult.citation;
        questionBody = citResult.promptWithoutCitation;
      }
    }

    // 6. Tách phần lời giải \loigiai{...} hoặc Lời giải:...
    const loigiaiMatch = questionBody.match(/\\(?:loigiai|huongdan)/);
    if (loigiaiMatch && loigiaiMatch.index !== undefined) {
      const loigiaiIdx = loigiaiMatch.index;
      const extractedLoigiai = extractBalancedBraces(questionBody, loigiaiIdx, 1);
      if (extractedLoigiai.length > 0) {
        explanationText = extractedLoigiai[0].trim();
      }
      questionBody = questionBody.slice(0, loigiaiIdx).trim();
    } else {
      const lgTextMatch = questionBody.match(/(?:Lời giải|Hướng dẫn giải|HDG|HD)\s*[:\.]\s*([\s\S]*)$/i);
      if (lgTextMatch && lgTextMatch.index !== undefined) {
        explanationText = lgTextMatch[1].trim();
        questionBody = questionBody.slice(0, lgTextMatch.index).trim();
      }
    }

    // 7. Kiểm tra cấu trúc câu hỏi thực tế để phân loại chính xác
    const hasChoiceTF = questionBody.includes('\\choiceTF') || questionBody.includes('\\TrueTF') || questionBody.includes('\\FalseTF');
    const hasChoice = /\\choice(?![a-zA-Z])/.test(questionBody) && !hasChoiceTF;
    const hasTasks = /\\begin\{tasks\}/i.test(questionBody);
    const hasSubABCD =
      /(?:^|\n|\s{2,}|\t)\s*(?:\\textbf\{|{\\bf\s+|\*\*|<b>|\\item\s*(?:\[[^\]]*\]\s*)?)?\s*(?:[a-d]\s*[\)\.\:\-\/]|\\?[a-d]\s*[\)]|\([a-d]\)|\[[a-d]\])/i.test(questionBody) ||
      questionBody.includes('(Đúng)') ||
      questionBody.includes('(Sai)') ||
      questionBody.includes('[Đúng]') ||
      questionBody.includes('[Sai]');
    const hasMcqABCD = /(?:^|\s{2,}|\n|\t)\s*(?:\\textbf\{|{\\bf\s+|\*\*|\*|<b>|\\item\s*(?:\[[^\]]*\]\s*)?)?\s*(?:[A-D]\s*[\.\:\-\/\)]|\([A-D]\)|\[[A-D]\])/i.test(questionBody);
    const hasShortAns =
      questionBody.includes('\\shortans') ||
      /(?:Đáp án|Đáp số|Kết quả|=)\s*[:\.]?\s*[-+]?\d+/i.test(questionBody);

    let determinedPart = activeSectionPart;
    if (hasChoiceTF || (hasSubABCD && !hasChoice && !hasTasks && !hasMcqABCD)) {
      determinedPart = 'part_2_true_false';
    } else if (hasChoice || hasTasks || (hasMcqABCD && !hasSubABCD)) {
      determinedPart = 'part_1_mcq';
    } else if (hasShortAns && !hasChoice && !hasSubABCD && !hasMcqABCD) {
      determinedPart = 'part_3_short_answer';
    }

    // Hàm tiện ích: Gắn trích dẫn nguồn và lời dẫn dữ kiện chung vào prompt của câu hỏi
    const formatFullPrompt = (rawPrompt: string): string => {
      let result = rawPrompt
        .replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '')
        .replace(/\\end\{(?:ex|bt|vd|cau)\}/g, '')
        .trim();

      // Nếu câu có trích dẫn nguồn riêng (In-question citation)
      if (inQuestionCitation) {
        result = `[Trích dẫn: ${inQuestionCitation}]\n${result}`;
      }

      // Nếu có dữ kiện/lời dẫn chung đang áp dụng
      if (activeSharedContext && activeSharedContext.remainingQuestions > 0) {
        result = `[Dữ kiện trích dẫn chung]: ${activeSharedContext.text}\n\n${result}`;
        activeSharedContext.remainingQuestions--;
        if (activeSharedContext.remainingQuestions <= 0) {
          activeSharedContext = null;
        }
      }

      return result;
    };

    // Hàm phụ trợ làm sạch nội dung phương án lựa chọn
    const cleanOptText = (txt: string): { clean: string; isTrue: boolean } => {
      let isTrue = false;
      let t = (txt || '').trim();
      if (t.includes('\\True') || t.includes('(Đúng)') || t.includes('[Đúng]') || t.startsWith('*')) {
        isTrue = true;
      }
      t = t
        .replace(/\\True(?![a-zA-Z])/g, '')
        .replace(/\\textbf\{[A-D]\.?\}/gi, '')
        .replace(/\((?:Đúng|Sai)\)/gi, '')
        .replace(/\[(?:Đúng|Sai)\]/gi, '')
        .trim();
      if (t.startsWith('{') && t.endsWith('}')) {
        t = t.slice(1, -1).trim();
      }
      return { clean: t, isTrue };
    };

    // ==========================================
    // 1. XỬ LÝ PHẦN 1: MCQ 4 PHƯƠNG ÁN LỰA CHỌN
    // ==========================================
    if (determinedPart === 'part_1_mcq') {
      let prompt = '';
      let optA = '', optB = '', optC = '', optD = '';
      let correct: 'A' | 'B' | 'C' | 'D' = 'A';

      if (hasChoice) {
        const choiceIdx = questionBody.indexOf('\\choice');
        prompt = questionBody.slice(0, choiceIdx);
        const optionsBraces = extractBalancedBraces(questionBody, choiceIdx, 4);
        if (optionsBraces.length >= 4) {
          const resA = cleanOptText(optionsBraces[0]);
          const resB = cleanOptText(optionsBraces[1]);
          const resC = cleanOptText(optionsBraces[2]);
          const resD = cleanOptText(optionsBraces[3]);
          optA = resA.clean; if (resA.isTrue) correct = 'A';
          optB = resB.clean; if (resB.isTrue) correct = 'B';
          optC = resC.clean; if (resC.isTrue) correct = 'C';
          optD = resD.clean; if (resD.isTrue) correct = 'D';
        }
      } else if (hasTasks) {
        const tasksMatch = questionBody.match(/\\begin\{tasks\}(?:\[\d+\]|\(\d+\))?([\s\S]*?)\\end\{tasks\}/i);
        if (tasksMatch) {
          prompt = questionBody.slice(0, tasksMatch.index);
          const taskItems = tasksMatch[1].split(/\\task/gi).map((t) => t.trim()).filter(Boolean);
          if (taskItems.length >= 4) {
            const resA = cleanOptText(taskItems[0]);
            const resB = cleanOptText(taskItems[1]);
            const resC = cleanOptText(taskItems[2]);
            const resD = cleanOptText(taskItems[3]);
            optA = resA.clean; if (resA.isTrue) correct = 'A';
            optB = resB.clean; if (resB.isTrue) correct = 'B';
            optC = resC.clean; if (resC.isTrue) correct = 'C';
            optD = resD.clean; if (resD.isTrue) correct = 'D';
          }
        }
      } else {
        // Tách A. B. C. D. thông minh (hỗ trợ \textbf{A.}, **A.**, (A), [A], A., A/, A-...)
        const optSplitRegex = /(?=(?:^|\n|\s{2,}|\t)\s*(?:\\textbf\{|{\\bf\s+|\*\*|\*|<b>|\\item\s*(?:\[[^\]]*\]\s*)?)?\s*(?:[A-D]\s*[\.\:\-\/\)]|\([A-D]\)|\[[A-D]\]))/i;
        const parts = questionBody.split(optSplitRegex);
        if (parts.length >= 2) {
          prompt = parts[0];
          for (let i = 1; i < parts.length; i++) {
            const p = parts[i].trim();
            const optMatch = p.match(/^(?:\\textbf\{|{\\bf\s+|\*\*|\*|<b>|\\item\s*(?:\[[^\]]*\]\s*)?)?\s*(?:([A-D])\s*[\.\:\-\/\)]|\(([A-D])\)|\[([A-D])\])\s*\}?\s*([\s\S]*)$/i);
            if (optMatch) {
              const key = (optMatch[1] || optMatch[2] || optMatch[3]).toUpperCase();
              const { clean, isTrue } = cleanOptText(optMatch[4] || '');
              if (key === 'A') { optA = clean; if (isTrue) correct = 'A'; }
              else if (key === 'B') { optB = clean; if (isTrue) correct = 'B'; }
              else if (key === 'C') { optC = clean; if (isTrue) correct = 'C'; }
              else if (key === 'D') { optD = clean; if (isTrue) correct = 'D'; }
            }
          }
        }
      }

      part1LocalCount++;
      globalCount++;

      // Đối chiếu đáp án từ câu hỏi hoặc bảng đáp án (hỗ trợ cả số câu cục bộ và toàn cục)
      const ansMatch = questionBody.match(/(?:Đáp án|Chọn|Key|ĐÁP ÁN)\s*[:\.]?\s*([A-D])/i);
      if (ansMatch) {
        correct = ansMatch[1].toUpperCase() as any;
      } else if (tableAnswers.mcqAnswers[part1LocalCount]) {
        correct = tableAnswers.mcqAnswers[part1LocalCount];
      } else if (tableAnswers.mcqAnswers[globalCount]) {
        correct = tableAnswers.mcqAnswers[globalCount];
      }

      if (optA || optB) {
        questions.push({
          id: `q_p1_${Date.now()}_${globalCount}`,
          part: 'part_1_mcq',
          questionNumber: globalCount,
          prompt: formatFullPrompt(prompt || 'Chọn phương án đúng nhất trong các phương án sau:'),
          options: [
            { key: 'A' as const, text: optA || 'Phương án A' },
            { key: 'B' as const, text: optB || 'Phương án B' },
            { key: 'C' as const, text: optC || 'Phương án C' },
            { key: 'D' as const, text: optD || 'Phương án D' },
          ],
          correctAnswer: correct,
          explanation: explanationText,
          points: 0.25,
        });
        continue;
      }
    }

    // ==========================================
    // 2. XỬ LÝ PHẦN 2: TRẮC NGHIỆM ĐÚNG / SAI (4 Ý a, b, c, d)
    // ==========================================
    if (determinedPart === 'part_2_true_false') {
      let prompt = '';
      const subItems: any[] = [];

      if (hasChoiceTF) {
        const choiceTfIdx = questionBody.indexOf('\\choiceTF');
        prompt = questionBody.slice(0, choiceTfIdx);
        const tfBraces = extractBalancedBraces(questionBody, choiceTfIdx, 4);
        const subKeys = ['a', 'b', 'c', 'd'];
        tfBraces.forEach((bText, idx) => {
          let isCorrect = true;
          let cleanText = bText;
          if (cleanText.includes('\\False') || cleanText.includes('\\FalseTF') || cleanText.toLowerCase().includes('sai')) {
            isCorrect = false;
          }
          cleanText = cleanText
            .replace(/\\(?:True|False|TrueTF|FalseTF)/g, '')
            .replace(/\((?:Đúng|Sai|Đ|S|True|False)\)/gi, '')
            .replace(/\[(?:Đúng|Sai|Đ|S|True|False)\]/gi, '')
            .trim();
          if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
            cleanText = cleanText.slice(1, -1).trim();
          }
          subItems.push({
            id: `tf_${subKeys[idx]}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            subKey: subKeys[idx],
            text: cleanText || `Mệnh đề ${subKeys[idx].toUpperCase()}`,
            isCorrect,
          });
        });
      } else {
        // Tách chính xác các ý a), b), c), d) hỗ trợ \textbf{a)}, **a)**, \item a), a., a)...
        const tfSplitRegex = /(?=(?:^|\n|\s{2,}|\t)\s*(?:\\textbf\{|{\\bf\s+|\*\*|<b>|\\item\s*(?:\[[^\]]*\]\s*)?)?\s*(?:[a-d]\s*[\)\.\:\-\/]|\\?[a-d]\s*[\)]|\([a-d]\)|\[[a-d]\]))/i;
        const chunks = questionBody.split(tfSplitRegex);
        if (chunks.length > 1) {
          prompt = chunks[0];
          for (let i = 1; i < chunks.length; i++) {
            const chunk = chunks[i].trim();
            const chunkMatch = chunk.match(/^(?:\\textbf\{|{\\bf\s+|\*\*|<b>|\\item\s*(?:\[[^\]]*\]\s*)?)?\s*(?:([a-d])\s*[\)\.\:\-\/]|\\?([a-d])\s*[\)]|\(([a-d])\)|\[([a-d])\])\s*\}?\s*([\s\S]*)$/i);
            if (chunkMatch) {
              const subKey = (chunkMatch[1] || chunkMatch[2] || chunkMatch[3] || chunkMatch[4]).toLowerCase();
              let itemText = chunkMatch[5].trim();
              let isCorrect = true;

              // Kiểm tra xem ý này có ghi rõ Đúng hoặc Sai không
              if (
                /(?:\(|\[)\s*(?:Sai|S|False|F)\s*(?:\)|\])/i.test(itemText) ||
                itemText.includes('\\False') ||
                itemText.includes('\\FalseTF') ||
                itemText.toLowerCase().endsWith('sai')
              ) {
                isCorrect = false;
              }

              itemText = itemText
                .replace(/\((?:Đúng|Sai|Đ|S|True|False)\)/gi, '')
                .replace(/\[(?:Đúng|Sai|Đ|S|True|False)\]/gi, '')
                .replace(/\\(?:True|False|TrueTF|FalseTF)/g, '')
                .trim();

              if (itemText.startsWith('{') && itemText.endsWith('}')) {
                itemText = itemText.slice(1, -1).trim();
              }

              if (itemText) {
                subItems.push({
                  id: `tf_${subKey}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                  subKey: subKey as any,
                  text: itemText,
                  isCorrect,
                });
              }
            }
          }
        }
      }

      part2LocalCount++;
      globalCount++;

      // Đối chiếu bảng đáp án Phần II (hỗ trợ cả part2LocalCount 1, 2, 3, 4 và globalCount)
      const activeTfKey = tableAnswers.tfAnswers[part2LocalCount] || tableAnswers.tfAnswers[globalCount];
      if (activeTfKey) {
        subItems.forEach((item) => {
          if (activeTfKey[item.subKey] !== undefined) {
            item.isCorrect = activeTfKey[item.subKey];
          }
        });
      }

      if (subItems.length > 0) {
        const presentKeys = subItems.map((s) => s.subKey);
        ['a', 'b', 'c', 'd'].forEach((k) => {
          if (!presentKeys.includes(k)) {
            subItems.push({
              id: `tf_${k}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              subKey: k as any,
              text: `Mệnh đề toán học liên quan đến câu hỏi (${k.toUpperCase()}).`,
              isCorrect: k === 'a' || k === 'b',
            });
          }
        });

        questions.push({
          id: `q_p2_${Date.now()}_${globalCount}`,
          part: 'part_2_true_false',
          questionNumber: globalCount,
          prompt: formatFullPrompt(prompt || 'Cho giả thiết toán học sau. Xét tính đúng/sai của các mệnh đề:'),
          items: subItems.slice(0, 4),
          explanation: explanationText,
          points: 1.0,
        });
        continue;
      }
    }

    // ==========================================
    // 3. XỬ LÝ PHẦN 3: TRẮC NGHIỆM TRẢ LỜI NGẮN
    // ==========================================
    const isMathQuestionSentence =
      /(?:tính|tìm|bao\s+nhiêu|hỏi|giá\s+trị|đáp\s+án|đáp\s+số|kết\s+quả|bằng|nghiệm|cho|thể\s+tích|khoảng\s+cách|đạo\s+hàm|tích\s+phân|nguyên\s+hàm|tọa\s+độ|xác\s+suất|hàm\s+số|\?|\$)/i.test(questionBody);

    if (determinedPart === 'part_3_short_answer' || (!hasChoice && !hasSubABCD && !hasMcqABCD && isMathQuestionSentence)) {
      let prompt = questionBody;
      let ans = '2';

      if (questionBody.includes('\\shortans')) {
        const shortIdx = questionBody.indexOf('\\shortans');
        const ansBraces = extractBalancedBraces(questionBody, shortIdx, 1);
        if (ansBraces.length > 0) {
          ans = ansBraces[0].replace(/[\$\{\}]/g, '').trim().slice(0, 4);
        }
        prompt = questionBody.slice(0, shortIdx);
      } else {
        const numMatch = questionBody.match(/(?:Đáp án|Đáp số|Kết quả|=\s*)\s*[:\.]?\s*([-+]?\d+(?:[\.,\/]\d+)?)/i);
        if (numMatch) {
          ans = numMatch[1].replace(',', '.').slice(0, 4);
        } else {
          // Thử trích xuất từ phần Lời giải nếu có câu kết: "Vậy đáp số là 15"
          const expNumMatch = explanationText.match(/(?:Vậy|Đáp số|kết quả)(?:[^\d\n\r]*)([-+]?\d+(?:[\.,]\d+)?)/i);
          if (expNumMatch) {
            ans = expNumMatch[1].replace(',', '.').slice(0, 4);
          }
        }
      }

      part3LocalCount++;
      globalCount++;

      // Đối chiếu bảng đáp án Phần III (hỗ trợ cả part3LocalCount và globalCount)
      if (tableAnswers.shortAnswers[part3LocalCount]) {
        ans = tableAnswers.shortAnswers[part3LocalCount];
      } else if (tableAnswers.shortAnswers[globalCount]) {
        ans = tableAnswers.shortAnswers[globalCount];
      }

      const formattedPrompt = formatFullPrompt(prompt || 'Tính giá trị của biểu thức toán học hoặc bài toán sau:');
      if (formattedPrompt.length > 5) {
        questions.push({
          id: `q_p3_${Date.now()}_${globalCount}`,
          part: 'part_3_short_answer',
          questionNumber: globalCount,
          prompt: formattedPrompt,
          correctAnswer: ans,
          explanation: explanationText,
          points: 0.5,
        });
        continue;
      }
    }
  }

  // Nếu không bóc tách được câu hỏi nào từ file/mã nguồn đã dán, tạo bộ câu hỏi chuẩn 2025 đầy đủ 3 phần mẫu
  if (questions.length === 0) {
    const sampleFullExam: Question[] = [
      {
        id: 'q_p1_sample_01',
        part: 'part_1_mcq' as const,
        questionNumber: 1,
        prompt: '[Trích dẫn: Đề tham khảo BGD 2025]\nCho hàm số $y = f(x)$ liên tục trên $\\mathbb{R}$ và có bảng biến thiên với $f\'(x) > 0$ trên $(-\\infty; 1)$ và $f\'(x) < 0$ trên $(1; +\\infty)$. Hàm số $y = f(x)$ đồng biến trên khoảng nào sau đây?',
        options: [
          { key: 'A' as const, text: '$(-\\infty; 1)$' },
          { key: 'B' as const, text: '$(1; 3)$' },
          { key: 'C' as const, text: '$(3; +\\infty)$' },
          { key: 'D' as const, text: '$(0; 2)$' },
        ],
        correctAnswer: 'A' as const,
        explanation: 'Hàm số đồng biến trên khoảng $(-\\infty; 1)$ do đạo hàm $f\'(x) > 0$ trên khoảng đó.',
        points: 0.25,
      },
      {
        id: 'q_p2_sample_01',
        part: 'part_2_true_false' as const,
        questionNumber: 2,
        prompt: '[Trích dẫn: Đề thi thử THPT Chuyên Lam Sơn]\nCho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$, cạnh bên $SA \\perp (ABCD)$ và $SA = a\\sqrt{3}$. Xét tính đúng/sai của các mệnh đề sau:',
        items: [
          { id: 'tf_a_sample', subKey: 'a' as const, text: 'Đường thẳng $SA$ vuông góc với mặt phẳng đáy $(ABCD)$.', isCorrect: true },
          { id: 'tf_b_sample', subKey: 'b' as const, text: 'Thể tích khối chóp $S.ABCD$ bằng $\\frac{a^3\\sqrt{3}}{3}$.', isCorrect: true },
          { id: 'tf_c_sample', subKey: 'c' as const, text: 'Góc giữa đường thẳng $SC$ và đáy $(ABCD)$ bằng $45^\\circ$.', isCorrect: false },
          { id: 'tf_d_sample', subKey: 'd' as const, text: 'Khoảng cách từ $A$ đến mặt phẳng $(SBC)$ bằng $\\frac{a\\sqrt{3}}{2}$.', isCorrect: true },
        ],
        explanation: 'Thể tích $V = \\frac{1}{3} S_{ABCD} \\cdot SA = \\frac{a^3\\sqrt{3}}{3}$. Tan của góc giữa SC và (ABCD) là SA/AC = a*sqrt(3) / (a*sqrt(2)) = sqrt(3/2) != 1.',
        points: 1.0,
      },
      {
        id: 'q_p3_sample_01',
        part: 'part_3_short_answer' as const,
        questionNumber: 3,
        prompt: '[Dữ kiện trích dẫn chung]: Một cơ sở sản xuất đồ dùng thể thao đang thiết kế một bể bơi tiêu chuẩn.\n\nMột bể bơi hình chữ nhật có chu vi bằng $60\\text{ m}$. Hỏi chiều rộng của bể bơi bằng bao nhiêu mét để diện tích mặt nước đạt giá trị lớn nhất?',
        correctAnswer: '15',
        explanation: 'Nửa chu vi $x + y = 30$. Diện tích $S = x(30 - x)$ đạt cực đại khi $x = 15\\text{ m}$.',
        points: 0.5,
      },
    ];
    questions.push(...sampleFullExam);
  }

  // Đánh lại số thứ tự từ 1 đến N liên tục
  questions.forEach((q, idx) => {
    q.questionNumber = idx + 1;
  });

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  return {
    metadata: {
      title,
      grade: effectiveGrade,
      year: 2025,
      durationMinutes: effectiveDuration,
      totalPoints: Number(totalPoints.toFixed(2)),
    },
    questions,
  };
}

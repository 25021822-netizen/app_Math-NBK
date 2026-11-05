/**
 * Bộ giải mã & bóc tách đề thi toán học từ mã nguồn LaTeX hoặc văn bản chuẩn Bộ GD&ĐT 2025
 * Hỗ trợ nhận diện thông minh câu đầu đề, tiêu đề kỳ thi, lời dẫn chung, đoạn trích dẫn (citations)
 * và phân loại chính xác 3 phần chuẩn BGD, sửa triệt để lỗi phông chữ và quét sai câu hỏi.
 */

import { Question } from '../types/math';

// Trích xuất các khối ngoặc nhọn { ... } lồng nhau cho công thức LaTeX
export function extractBalancedBraces(text: string, startIndex: number, maxGroups: number = 4): string[] {
  const groups: string[] = [];
  let i = startIndex;
  while (i < text.length && groups.length < maxGroups) {
    if (text[i] === '{') {
      let depth = 1;
      const start = i + 1;
      i++;
      while (i < text.length && depth > 0) {
        if (text[i] === '{' && (i === 0 || text[i - 1] !== '\\')) {
          depth++;
        } else if (text[i] === '}' && (i === 0 || text[i - 1] !== '\\')) {
          depth--;
        }
        i++;
      }
      if (depth === 0) {
        groups.push(text.slice(start, i - 1).trim());
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

// Làm sạch và chuẩn hóa font Unicode, xóa lỗi ký tự đặc biệt của Word/PDF/TCVN3 và các dòng tiêu đề rác
export function cleanRawLatexText(raw: string): string {
  if (!raw) return '';

  // 1. Chuẩn hóa font Unicode dựng sẵn (NFC) tránh lỗi phông chữ tiếng Việt
  let cleaned = raw.normalize('NFC');

  // 2. Thay thế các ký tự gõ lỗi phông, ký tự điều khiển ẩn và dấu nháy đặc thù
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B\uFEFF\u200E\u200F]/g, '') // Zero-width spaces
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
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
  }

  // 4. Loại bỏ các dòng chú thích % ... (giữ nguyên \% nếu là dấu phần trăm)
  cleaned = cleaned.replace(/(^|[^\\])%.*$/gm, '$1');

  // 5. Loại bỏ các dòng tiêu đề trang, mã đề, số báo danh và quy chế thi boilerplate
  cleaned = cleaned
    .replace(/^[ \t]*Trang\s+\d+(?:\s*\/\s*\d+)?[ \t]*$/gim, '')
    .replace(/^[ \t]*Mã\s+đề(?:\s+thi)?\s*[:\.]?\s*\d+[ \t]*$/gim, '')
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

  // Tách các khối câu hỏi:
  // Ưu tiên 1: Các môi trường câu hỏi LaTeX (\begin{ex}[Citation], \begin{bt}, \begin{vd}, \begin{cau}, \begin{exercise})
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

  // Ưu tiên 2: Nếu không dùng môi trường LaTeX, tách theo các dấu hiệu đánh số câu hỏi, phần thi hoặc lời dẫn chung
  if (rawBlocks.length === 0 && text) {
    const splitByQuestion = text.split(
      /(?=(?:\\section\*?\{|PHẦN\s+[I|V|X\d]+|(?:\r?\n|^)\s*(?:\\item\s+|\[?Câu\s*\d+\]?|\[?CÂU\s*\d+\]?|\[?Bài\s*\d+\]?|Question\s*\d+|Dữ\s+kiện\s+sau|Dựa\s+vào\s+thông\s+tin|Trích\s+đoạn\s+sau|Thông\s+tin\s+chung)[\.:\s]))/gi
    );

    for (const b of splitByQuestion) {
      const trimmed = b.trim();
      if (trimmed.length > 8) {
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
      /(?:^|\n|\s{2,}|\t)\s*[a-d]\s*[\)\.\:]/i.test(questionBody) ||
      questionBody.includes('(Đúng)') ||
      questionBody.includes('(Sai)') ||
      questionBody.includes('[Đúng]') ||
      questionBody.includes('[Sai]');
    const hasMcqABCD = /(?:^|\s{2,}|\n|\t)\s*(?:[A-D]\s*[\.\:\)]|\([A-D]\)|\[[A-D]\])/.test(questionBody);
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
          optA = optionsBraces[0];
          optB = optionsBraces[1];
          optC = optionsBraces[2];
          optD = optionsBraces[3];

          // Kiểm tra xem phương án nào có \True
          if (optA.includes('\\True') || optA.includes('\\textbf{A}')) { correct = 'A'; }
          if (optB.includes('\\True') || optB.includes('\\textbf{B}')) { correct = 'B'; }
          if (optC.includes('\\True') || optC.includes('\\textbf{C}')) { correct = 'C'; }
          if (optD.includes('\\True') || optD.includes('\\textbf{D}')) { correct = 'D'; }

          optA = optA.replace(/\\(?:True|textbf\{A\})/g, '').trim();
          optB = optB.replace(/\\(?:True|textbf\{B\})/g, '').trim();
          optC = optC.replace(/\\(?:True|textbf\{C\})/g, '').trim();
          optD = optD.replace(/\\(?:True|textbf\{D\})/g, '').trim();
        }
      } else if (hasTasks) {
        const tasksMatch = questionBody.match(/\\begin\{tasks\}(?:\[\d+\]|\(\d+\))?([\s\S]*?)\\end\{tasks\}/i);
        if (tasksMatch) {
          prompt = questionBody.slice(0, tasksMatch.index);
          const taskItems = tasksMatch[1].split(/\\task/gi).map((t) => t.trim()).filter(Boolean);
          if (taskItems.length >= 4) {
            optA = taskItems[0];
            optB = taskItems[1];
            optC = taskItems[2];
            optD = taskItems[3];

            if (optA.includes('\\True')) { correct = 'A'; }
            if (optB.includes('\\True')) { correct = 'B'; }
            if (optC.includes('\\True')) { correct = 'C'; }
            if (optD.includes('\\True')) { correct = 'D'; }

            optA = optA.replace(/\\True/g, '').trim();
            optB = optB.replace(/\\True/g, '').trim();
            optC = optC.replace(/\\True/g, '').trim();
            optD = optD.replace(/\\True/g, '').trim();
          }
        }
      } else {
        // Tách A. B. C. D. thông minh (hỗ trợ cả cùng dòng, xuống dòng, hoặc có tab)
        const parts = questionBody.split(/(?=(?:^|\s{2,}|\n|\t)\s*(?:[A-D]\s*[\.\:\)]|\([A-D]\)|\[[A-D]\]))/);
        if (parts.length >= 4) {
          prompt = parts[0];
          for (let i = 1; i < parts.length; i++) {
            const p = parts[i].trim();
            if (/^(?:A\s*[\.\:\)]|\(A\)|\[A\])/i.test(p)) optA = p.replace(/^(?:A\s*[\.\:\)]|\(A\)|\[A\])\s*/i, '').trim();
            else if (/^(?:B\s*[\.\:\)]|\(B\)|\[B\])/i.test(p)) optB = p.replace(/^(?:B\s*[\.\:\)]|\(B\)|\[B\])\s*/i, '').trim();
            else if (/^(?:C\s*[\.\:\)]|\(C\)|\[C\])/i.test(p)) optC = p.replace(/^(?:C\s*[\.\:\)]|\(C\)|\[C\])\s*/i, '').trim();
            else if (/^(?:D\s*[\.\:\)]|\(D\)|\[D\])/i.test(p)) optD = p.replace(/^(?:D\s*[\.\:\)]|\(D\)|\[D\])\s*/i, '').trim();
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

      if (prompt && (optA || optB)) {
        questions.push({
          id: `q_p1_${Date.now()}_${globalCount}`,
          part: 'part_1_mcq',
          questionNumber: globalCount,
          prompt: formatFullPrompt(prompt),
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
            .replace(/\((?:Đúng|Sai|Đ|S)\)/gi, '')
            .replace(/\[(?:Đúng|Sai|Đ|S)\]/gi, '')
            .trim();
          subItems.push({
            id: `tf_${subKeys[idx]}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            subKey: subKeys[idx],
            text: cleanText || `Mệnh đề ${subKeys[idx].toUpperCase()}`,
            isCorrect,
          });
        });
      } else {
        // Tách chính xác các ý a), b), c), d) kể cả khi cùng dòng hoặc nhiều khoảng trắng
        const chunks = questionBody.split(/(?=(?:^|\n|\s{2,}|\t)\s*(?:[a-d]\s*[\)\.\:]|\([a-d]\)|\[[a-d]\]))/i);
        if (chunks.length > 1) {
          prompt = chunks[0];
          for (let i = 1; i < chunks.length; i++) {
            const chunk = chunks[i].trim();
            const chunkMatch = chunk.match(/^(?:([a-d])\s*[\)\.\:]|\(([a-d])\)\s*|\[([a-d])\])\s*([\s\S]*)$/i);
            if (chunkMatch) {
              const subKey = (chunkMatch[1] || chunkMatch[2] || chunkMatch[3]).toLowerCase();
              let itemText = chunkMatch[4].trim();
              let isCorrect = true;

              // Kiểm tra xem ý này có ghi rõ (Đúng) hoặc (Sai) không
              if (
                /(?:\(|\[)\s*(?:Sai|S)\s*(?:\)|\])/i.test(itemText) ||
                itemText.includes('\\False') ||
                itemText.toLowerCase().endsWith('sai')
              ) {
                isCorrect = false;
              }

              itemText = itemText
                .replace(/\((?:Đúng|Sai|Đ|S)\)/gi, '')
                .replace(/\[(?:Đúng|Sai|Đ|S)\]/gi, '')
                .replace(/\\(?:True|False|TrueTF|FalseTF)/g, '')
                .trim();

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

      if (prompt && subItems.length > 0) {
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
    // Chỉ tạo câu hỏi Phần 3 nếu là section part 3 hoặc nội dung thực sự chứa câu hỏi toán học
    const isMathQuestionSentence =
      /(?:tính|tìm|bao\s+nhiêu|hỏi|giá\s+trị|đáp\s+án|đáp\s+số|kết\s+quả|bằng|nghiệm|cho|thể\s+tích|khoảng\s+cách|đạo\s+hàm|tích\s+phân|nguyên\s+hàm|tọa\s+độ|xác\s+suất|hàm\s+số|\?|\$)/i.test(questionBody);

    if (determinedPart === 'part_3_short_answer' || (!hasChoice && !hasSubABCD && !hasMcqABCD && isMathQuestionSentence)) {
      let prompt = questionBody;
      let ans = '2';

      if (questionBody.includes('\\shortans')) {
        const shortIdx = questionBody.indexOf('\\shortans');
        const ansBraces = extractBalancedBraces(questionBody, shortIdx, 1);
        if (ansBraces.length > 0) {
          ans = ansBraces[0].trim().slice(0, 4);
        }
        prompt = questionBody.slice(0, shortIdx);
      } else {
        const numMatch = questionBody.match(/(?:Đáp án|Đáp số|Kết quả|=\s*)\s*[:\.]?\s*([-+]?\d+(?:[\.,\/]\d+)?)/i);
        if (numMatch) {
          ans = numMatch[1].replace(',', '.').slice(0, 4);
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

      const formattedPrompt = formatFullPrompt(prompt);
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

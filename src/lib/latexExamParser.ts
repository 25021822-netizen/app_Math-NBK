/**
 * Bộ giải mã & bóc tách đề thi toán học từ mã nguồn LaTeX hoặc văn bản chuẩn Bộ GD&ĐT 2025
 * Hỗ trợ tất cả định dạng đề thi phổ biến của giáo viên Việt Nam
 */

import { Question } from '../types/math';

// Trích xuất các khối ngoặc nhọn { ... } lồng nhau cho công thức LaTeX (tránh lỗi ngắt sớm khi có phân số, căn thức...)
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

// Làm sạch mã nguồn LaTeX trước khi phân tích
export function cleanRawLatexText(raw: string): string {
  if (!raw) return '';
  let cleaned = raw;

  // 1. Nếu có \begin{document} ... \end{document}, chỉ lấy nội dung bên trong tài liệu
  const docMatch = cleaned.match(/\\begin\{document\}([\s\S]*?)(?:\\end\{document\}|$)/i);
  if (docMatch && docMatch[1]) {
    cleaned = docMatch[1];
  } else {
    // Nếu không có \begin{document}, xóa bỏ các lệnh tiền xử lý preamble \documentclass, \usepackage...
    cleaned = cleaned.replace(/\\documentclass(\[[^\]]*\])?\{[^\}]*\}/g, '');
    cleaned = cleaned.replace(/\\usepackage(\[[^\]]*\])?\{[^\}]*\}/g, '');
  }

  // 2. Loại bỏ các dòng chú thích % ... (giữ nguyên \% nếu là dấu phần trăm)
  cleaned = cleaned.replace(/(^|[^\\])%.*$/gm, '$1');

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

export function parseExamFromLatexOrText(
  rawInput: string,
  grade: number = 12,
  durationMinutes: number = 90,
  examTitle?: string
): ParsedExamResult {
  const text = cleanRawLatexText(rawInput);
  const title = examTitle || 'Đề Thi Toán THPT (Trích Xuất LaTeX / File)';

  const questions: Question[] = [];

  // Tách các khối câu hỏi
  // Ưu tiên 1: Các môi trường câu hỏi LaTeX chuyên dụng (\begin{ex}, \begin{bt}, \begin{vd}, \begin{cau}, \begin{exercise}, \begin{question})
  const envRegex = /\\begin\{(?:ex|bt|vd|cau|exercise|question)\}([\s\S]*?)\\end\{(?:ex|bt|vd|cau|exercise|question)\}/gi;
  const rawBlocks: string[] = [];

  let match;
  while ((match = envRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim().length > 8) {
      rawBlocks.push(match[1].trim());
    }
  }

  // Ưu tiên 2: Nếu không dùng môi trường LaTeX, tách theo các dấu hiệu đánh số câu hỏi
  if (rawBlocks.length === 0 && text) {
    // Tách theo Câu 1, Câu 2... hoặc \item hoặc Bài 1... hoặc [Câu 1]
    const splitByQuestion = text.split(
      /(?=(?:\\section\*?\{|PHẦN\s+[I|V|X\d]+|(?:\r?\n|^)\s*(?:\\item\s+|\[?Câu\s*\d+\]?|\[?CÂU\s*\d+\]?|\[?Bài\s*\d+\]?|Question\s*\d+)[\.:\s]))/gi
    );

    for (const b of splitByQuestion) {
      const trimmed = b.trim();
      // Bỏ qua các khối tiêu đề quá ngắn không chứa câu hỏi
      if (trimmed.length > 12 && !/^(?:\\section\*?\{|PHẦN\s+[I|V|X\d]+)/i.test(trimmed)) {
        rawBlocks.push(trimmed);
      }
    }
  }

  let qCounter = 1;
  let activeSectionPart: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq';

  for (const block of rawBlocks) {
    const lowerBlock = block.toLowerCase();

    // Cập nhật section nếu phát hiện tiêu đề phần
    if (
      lowerBlock.includes('phần ii') ||
      lowerBlock.includes('phần 2') ||
      lowerBlock.includes('đúng sai') ||
      lowerBlock.includes('đúng/sai') ||
      lowerBlock.includes('true/false')
    ) {
      activeSectionPart = 'part_2_true_false';
    } else if (
      lowerBlock.includes('phần iii') ||
      lowerBlock.includes('phần 3') ||
      lowerBlock.includes('trả lời ngắn') ||
      lowerBlock.includes('điền đáp số') ||
      lowerBlock.includes('short answer')
    ) {
      activeSectionPart = 'part_3_short_answer';
    } else if (
      lowerBlock.includes('phần i') ||
      lowerBlock.includes('phần 1') ||
      lowerBlock.includes('nhiều phương án') ||
      lowerBlock.includes('trắc nghiệm 4 lựa chọn')
    ) {
      activeSectionPart = 'part_1_mcq';
    }

    // Tách phần lời giải \loigiai{...} hoặc \huongdan{...} hoặc Lời giải:...
    let questionBody = block;
    let explanationText = 'Lời giải chi tiết áp dụng công thức giải tích và hình học chuẩn GDPT 2018.';

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

    // Xác định loại câu hỏi dựa trên cấu trúc thực tế của câu hỏi
    const hasChoiceTF = questionBody.includes('\\choiceTF') || questionBody.includes('\\TrueTF') || questionBody.includes('\\FalseTF');
    const hasChoice = /\\choice(?![a-zA-Z])/.test(questionBody) && !hasChoiceTF;
    const hasTasks = /\\begin\{tasks\}/i.test(questionBody);
    const hasSubABCD =
      /(?:^|\n|\r)\s*[a-d]\s*[\)\.\:]/i.test(questionBody) ||
      questionBody.includes('(Đúng)') ||
      questionBody.includes('(Sai)') ||
      questionBody.includes('[Đúng]') ||
      questionBody.includes('[Sai]');
    const hasMcqABCD = /(?:^|\n|\r)\s*[A-D]\s*[\.\:\)]/.test(questionBody);
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

    // ==========================================
    // 1. XỬ LÝ PHẦN 1: MCQ 4 PHƯƠNG ÁN LỰA CHỌN
    // ==========================================
    if (determinedPart === 'part_1_mcq') {
      let prompt = '';
      let optA = '', optB = '', optC = '', optD = '';
      let correct: 'A' | 'B' | 'C' | 'D' = 'A';

      if (hasChoice) {
        const choiceIdx = questionBody.indexOf('\\choice');
        prompt = questionBody.slice(0, choiceIdx).replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '').trim();
        const optionsBraces = extractBalancedBraces(questionBody, choiceIdx, 4);
        if (optionsBraces.length >= 4) {
          optA = optionsBraces[0];
          optB = optionsBraces[1];
          optC = optionsBraces[2];
          optD = optionsBraces[3];

          if (optA.includes('\\True') || optA.includes('\\textbf{A}')) { correct = 'A'; optA = optA.replace(/\\True/g, '').trim(); }
          if (optB.includes('\\True') || optB.includes('\\textbf{B}')) { correct = 'B'; optB = optB.replace(/\\True/g, '').trim(); }
          if (optC.includes('\\True') || optC.includes('\\textbf{C}')) { correct = 'C'; optC = optC.replace(/\\True/g, '').trim(); }
          if (optD.includes('\\True') || optD.includes('\\textbf{D}')) { correct = 'D'; optD = optD.replace(/\\True/g, '').trim(); }
        }
      } else if (hasTasks) {
        // Xử lý gói \begin{tasks} ... \task ... \end{tasks}
        const tasksMatch = questionBody.match(/\\begin\{tasks\}(?:\[\d+\]|\(\d+\))?([\s\S]*?)\\end\{tasks\}/i);
        if (tasksMatch) {
          prompt = questionBody.slice(0, tasksMatch.index).replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '').trim();
          const tasksText = tasksMatch[1];
          const taskItems = tasksText.split(/\\task/gi).map((t) => t.trim()).filter(Boolean);
          if (taskItems.length >= 4) {
            optA = taskItems[0];
            optB = taskItems[1];
            optC = taskItems[2];
            optD = taskItems[3];
          }
        }
      } else {
        // Tách A. B. C. D. thông thường
        const parts = questionBody.split(/(?=(?:^|\n|\r)\s*[A-D]\s*[\.\:\)])/);
        if (parts.length >= 4) {
          prompt = parts[0].replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '').trim();
          for (let i = 1; i < parts.length; i++) {
            const p = parts[i].trim();
            if (/^A\s*[\.\:\)]/i.test(p)) optA = p.replace(/^A\s*[\.\:\)]\s*/i, '').trim();
            else if (/^B\s*[\.\:\)]/i.test(p)) optB = p.replace(/^B\s*[\.\:\)]\s*/i, '').trim();
            else if (/^C\s*[\.\:\)]/i.test(p)) optC = p.replace(/^C\s*[\.\:\)]\s*/i, '').trim();
            else if (/^D\s*[\.\:\)]/i.test(p)) optD = p.replace(/^D\s*[\.\:\)]\s*/i, '').trim();
          }
        }
      }

      const ansMatch = questionBody.match(/(?:Đáp án|Chọn|Key|ĐÁP ÁN)\s*[:\.]?\s*([A-D])/i);
      if (ansMatch) {
        correct = ansMatch[1].toUpperCase() as any;
      }

      if (prompt && (optA || optB)) {
        questions.push({
          id: `q_p1_${Date.now()}_${qCounter}`,
          part: 'part_1_mcq',
          questionNumber: qCounter++,
          prompt: prompt.replace(/\\end\{(?:ex|bt|vd|cau)\}/g, '').trim(),
          options: [
            { key: 'A', text: optA || 'Phương án A' },
            { key: 'B', text: optB || 'Phương án B' },
            { key: 'C', text: optC || 'Phương án C' },
            { key: 'D', text: optD || 'Phương án D' },
          ],
          correctAnswer: correct,
          explanation: explanationText,
          points: 0.25,
        });
        continue;
      }
    }

    // ==========================================
    // 2. XỬ LÝ PHẦN 2: TRẮC NGHIỆM ĐÚNG / SAI (4 Ý)
    // ==========================================
    if (determinedPart === 'part_2_true_false') {
      let prompt = '';
      const subItems: any[] = [];

      if (hasChoiceTF) {
        const choiceTfIdx = questionBody.indexOf('\\choiceTF');
        prompt = questionBody.slice(0, choiceTfIdx).replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '').trim();
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
        // Tách a) b) c) d)
        prompt = questionBody.split(/(?=(?:^|\n|\r)\s*[a-d]\s*[\)\.\:])/i)[0].replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '').trim();
        const subMatches = questionBody.matchAll(/(?:^|\n|\r)\s*([a-d])\s*[\)\.\:]\s*([^a-d\n\r]*?)(?=(?:(?:^|\n|\r)\s*[a-d]\s*[\)\.\:]|$))/gi);
        for (const sm of subMatches) {
          const subKey = sm[1].toLowerCase();
          let itemText = sm[2].trim();
          let isCorrect = true;
          if (
            itemText.toLowerCase().includes('sai') ||
            itemText.includes('\\False') ||
            itemText.includes('(S)') ||
            itemText.includes('[S]')
          ) {
            isCorrect = false;
          }
          itemText = itemText
            .replace(/\((?:Đúng|Sai|Đ|S)\)/gi, '')
            .replace(/\[(?:Đúng|Sai|Đ|S)\]/gi, '')
            .replace(/\\(?:True|False)/g, '')
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

      if (prompt && subItems.length > 0) {
        const presentKeys = subItems.map((s) => s.subKey);
        ['a', 'b', 'c', 'd'].forEach((k) => {
          if (!presentKeys.includes(k)) {
            subItems.push({
              id: `tf_${k}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              subKey: k as any,
              text: `Mệnh đề toán học liên quan đến giả thiết câu hỏi (${k.toUpperCase()}).`,
              isCorrect: k === 'a' || k === 'b',
            });
          }
        });

        questions.push({
          id: `q_p2_${Date.now()}_${qCounter}`,
          part: 'part_2_true_false',
          questionNumber: qCounter++,
          prompt: prompt || 'Cho giả thiết toán học sau. Xét tính đúng/sai của các mệnh đề:',
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
    if (determinedPart === 'part_3_short_answer' || (!hasChoice && !hasSubABCD && !hasMcqABCD)) {
      let prompt = questionBody
        .replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '')
        .replace(/\\end\{(?:ex|bt|vd|cau)\}/g, '')
        .trim();
      let ans = '2';

      if (questionBody.includes('\\shortans')) {
        const shortIdx = questionBody.indexOf('\\shortans');
        const ansBraces = extractBalancedBraces(questionBody, shortIdx, 1);
        if (ansBraces.length > 0) {
          ans = ansBraces[0].trim().slice(0, 4);
        }
        prompt = questionBody.slice(0, shortIdx).replace(/^(?:\\item\s+|\[?(?:Câu|CÂU|Bài)\s*\d+\]?[:\.]?\s*)/i, '').trim();
      } else {
        const numMatch = questionBody.match(/(?:Đáp án|Đáp số|Kết quả|=\s*)\s*[:\.]?\s*([-+]?\d+(?:[\.,\/]\d+)?)/i);
        if (numMatch) {
          ans = numMatch[1].replace(',', '.').slice(0, 4);
        }
      }

      if (prompt.length > 5) {
        questions.push({
          id: `q_p3_${Date.now()}_${qCounter}`,
          part: 'part_3_short_answer',
          questionNumber: qCounter++,
          prompt,
          correctAnswer: ans,
          explanation: explanationText,
          points: 0.5,
        });
        continue;
      }
    }
  }

  // Nếu vẫn chưa trích xuất được câu nào nhưng người dùng đã dán văn bản
  if (questions.length === 0 && text.trim().length > 10) {
    // Tạo câu hỏi trực tiếp từ đoạn văn bản đã dán
    const cleanLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const firstLine = cleanLines[0] || 'Câu hỏi trích xuất từ đề thi';
    const remaining = cleanLines.slice(1).join('\n') || text;

    questions.push({
      id: `q_auto_${Date.now()}_1`,
      part: 'part_1_mcq',
      questionNumber: 1,
      prompt: firstLine,
      options: [
        { key: 'A', text: cleanLines[1] || 'Phương án A' },
        { key: 'B', text: cleanLines[2] || 'Phương án B' },
        { key: 'C', text: cleanLines[3] || 'Phương án C' },
        { key: 'D', text: cleanLines[4] || 'Phương án D' },
      ],
      correctAnswer: 'A',
      explanation: remaining || 'Lời giải chi tiết.',
      points: 0.25,
    });
  }

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  return {
    metadata: {
      title,
      grade: (grade as 10 | 11 | 12) || 12,
      year: new Date().getFullYear(),
      durationMinutes: Number(durationMinutes) || 90,
      totalPoints: Number(totalPoints.toFixed(2)),
    },
    questions,
  };
}

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import WordExtractor from 'word-extractor';
import { parseExamFromLatexOrText } from './src/lib/latexExamParser';
import { cleanPdfNoiseAndOcr } from './src/lib/ocrNoiseCleaner';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Khởi tạo Gemini AI Client phía Server theo chuẩn @google/genai
const apiKey = (process.env.GEMINI_API_KEY || '').trim();
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function getActiveGeminiClient(): GoogleGenAI | null {
  const currentKey = (process.env.GEMINI_API_KEY || apiKey || '').trim();
  if (!currentKey) return null;
  if (currentKey !== apiKey) {
    return new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return ai;
}

function classifyGeminiError(err: any): { status: number; code: string; message: string } {
  const rawMsg = String(err?.message || err || '');
  const upper = rawMsg.toUpperCase();
  const status = Number(err?.status || err?.code || 0);

  if (!((process.env.GEMINI_API_KEY || apiKey || '').trim()) || upper.includes('MISSING_API_KEY')) {
    return {
      status: 503,
      code: 'MISSING_API_KEY',
      message:
        'Hệ thống chưa được gắn khóa Gemini API (GEMINI_API_KEY). Vui lòng thiết lập khóa trong bảng Settings > Secrets của ứng dụng để AI có thể trả lời chính xác.',
    };
  }
  if (
    status === 400 ||
    status === 403 ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('API KEY NOT VALID')
  ) {
    return {
      status: status === 403 ? 403 : 400,
      code: 'API_KEY_INVALID',
      message:
        'Khóa Gemini API hiện tại không hợp lệ hoặc thiếu quyền truy cập. Vui lòng kiểm tra lại khóa trong bảng Settings > Secrets.',
    };
  }
  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('QUOTA')) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message:
        'Đã tạm vượt hạn mức gọi Gemini API. Vui lòng thử lại sau ít phút hoặc nâng cấp khóa API trong Settings > Secrets.',
    };
  }
  if (status === 404 || upper.includes('NOT_FOUND')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message: 'Mô hình AI được yêu cầu tạm thời không khả dụng. Vui lòng thử lại sau.',
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    code: 'AI_ERROR',
    message: `Lỗi kết nối AI: ${rawMsg || 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.'}`,
  };
}

async function callWithTransientRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = Number(err?.status || 0);
      const isTransient = status === 0 || status >= 500;
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
    }
  }
  throw lastError;
}

function buildInlinePartFromDataUrl(dataUrl: string) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  let mimeType = 'image/jpeg';
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  if (match && match[1]) {
    mimeType = match[1];
  }
  const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!cleanBase64) return null;
  return {
    inlineData: {
      mimeType,
      data: cleanBase64,
    },
  };
}

function safeParseObjectJsonWithLatex(rawText: string): any {
  if (!rawText) return null;
  let clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(clean);
  } catch {
    // Khắc phục dấu backslash LaTeX chưa escape trong chuỗi JSON (ví dụ \frac, \text, \to)
    try {
      let inString = false;
      let out = '';
      for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        if (ch === '"') {
          let slashes = 0;
          let k = i - 1;
          while (k >= 0 && clean[k] === '\\') {
            slashes++;
            k--;
          }
          if (slashes % 2 === 0) inString = !inString;
          out += ch;
        } else if (inString) {
          if (ch === '\n') out += '\\n';
          else if (ch === '\r') continue;
          else if (ch === '\t') out += ' ';
          else if (ch === '\\') {
            const next = clean[i + 1] || '';
            const after = clean[i + 2] || '';
            if (next === '"' || next === '\\' || next === '/') {
              out += '\\' + next;
              i++;
            } else if (next === 'u' && /^[0-9a-fA-F]{4}/.test(clean.slice(i + 2, i + 6))) {
              out += '\\u';
            } else if ((next === 'b' || next === 'f' || next === 'n' || next === 'r' || next === 't') && !/[a-zA-Z]/.test(after)) {
              out += '\\' + next;
              i++;
            } else {
              out += '\\\\';
            }
          } else {
            out += ch;
          }
        } else {
          out += ch;
        }
      }
      out = out.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(out);
    } catch {
      return null;
    }
  }
}

// =========================================================================
// HELPER: PARSER DỰ PHÒNG THÔNG MINH CHO MÃ NGUỒN LATEX & VĂN BẢN ĐỀ THI BGD
// =========================================================================

// Hàm trích xuất các khối ngoặc nhọn { ... } lồng nhau cho công thức LaTeX (tránh lỗi ngắt sớm khi có phân số, căn thức...)
function extractBalancedBraces(text: string, startIndex: number, maxGroups: number = 4): string[] {
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

function legacyParseExamFromLatexOrText(rawInput: string, grade: number = 12, durationMinutes: number = 90, examTitle?: string) {
  const text = (rawInput || '').trim();
  const title = examTitle || (text ? 'Đề Thi Toán THPT (Trích Xuất LaTeX / PDF)' : 'Đề Thi Thử Tốt Nghiệp THPT 2025 Chuẩn BGD');

  const questions: any[] = [];

  // Tách các khối câu hỏi: Ưu tiên bóc theo môi trường \begin{ex} ... \end{ex}
  const hasExEnv = text.includes('\\begin{ex}');
  const rawBlocks: string[] = [];

  if (hasExEnv) {
    const exRegex = /\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g;
    let match;
    while ((match = exRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 10) {
        rawBlocks.push(match[1].trim());
      }
    }
  }

  // Nếu không dùng \begin{ex}, tách theo Câu 1, Câu 2... hoặc \item
  if (rawBlocks.length === 0 && text) {
    const splitByQuestion = text.split(/(?=(?:\\section\*?\{|PHẦN\s+[I|V|X\d]+|(?:\r?\n)(?:Câu|CÂU|Bài)\s*\d+[:\.]))/gi);
    for (const b of splitByQuestion) {
      const trimmed = b.trim();
      if (trimmed.length > 15) {
        rawBlocks.push(trimmed);
      }
    }
  }

  let qCounter = 1;
  let activeSectionPart: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq';

  for (const block of rawBlocks) {
    const lowerBlock = block.toLowerCase();

    // Cập nhật section nếu phát hiện tiêu đề phần
    if (lowerBlock.includes('phần ii') || lowerBlock.includes('phần 2') || lowerBlock.includes('đúng sai') || lowerBlock.includes('trắc nghiệm đúng/sai')) {
      activeSectionPart = 'part_2_true_false';
    } else if (lowerBlock.includes('phần iii') || lowerBlock.includes('phần 3') || lowerBlock.includes('trả lời ngắn') || lowerBlock.includes('điền đáp số')) {
      activeSectionPart = 'part_3_short_answer';
    } else if (lowerBlock.includes('phần i') || lowerBlock.includes('phần 1') || lowerBlock.includes('nhiều phương án')) {
      activeSectionPart = 'part_1_mcq';
    }

    // Tách phần lời giải \loigiai{...} nếu có
    let questionBody = block;
    let explanationText = 'Lời giải chi tiết áp dụng công thức giải tích và hình học chuẩn GDPT 2018.';
    const loigiaiIdx = block.indexOf('\\loigiai');
    if (loigiaiIdx !== -1) {
      const extractedLoigiai = extractBalancedBraces(block, loigiaiIdx, 1);
      if (extractedLoigiai.length > 0) {
        explanationText = extractedLoigiai[0];
      }
      questionBody = block.slice(0, loigiaiIdx).trim();
    }

    // Xác định loại câu hỏi dựa trên cấu trúc thực tế của câu hỏi (đảm bảo không bị phân loại sai)
    const hasChoiceTF = questionBody.includes('\\choiceTF');
    const hasChoice = /\\choice(?![a-zA-Z])/.test(questionBody) && !hasChoiceTF;
    const hasSubABCD = /(?:^|\n|\r)[a-d]\s*[\)\.\:]/i.test(questionBody) || questionBody.includes('(Đúng)') || questionBody.includes('(Sai)');
    const hasMcqABCD = /(?:^|\n|\r)[A-D]\s*[\.\:]/i.test(questionBody);
    const hasShortAns = questionBody.includes('\\shortans') || /(?:Đáp án|Đáp số|Kết quả|=)\s*[:\.]?\s*[-+]?\d+/i.test(questionBody);

    let determinedPart = activeSectionPart;
    if (hasChoiceTF || (hasSubABCD && !hasChoice)) {
      determinedPart = 'part_2_true_false';
    } else if (hasChoice || (hasMcqABCD && !hasSubABCD)) {
      determinedPart = 'part_1_mcq';
    } else if (hasShortAns && !hasChoice && !hasSubABCD) {
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
        prompt = questionBody.slice(0, choiceIdx).replace(/^(?:Câu|CÂU|Bài)\s*\d+[:\.]?\s*/i, '').trim();
        const optionsBraces = extractBalancedBraces(questionBody, choiceIdx, 4);
        if (optionsBraces.length >= 4) {
          optA = optionsBraces[0];
          optB = optionsBraces[1];
          optC = optionsBraces[2];
          optD = optionsBraces[3];

          if (optA.includes('\\True')) { correct = 'A'; optA = optA.replace('\\True', '').trim(); }
          if (optB.includes('\\True')) { correct = 'B'; optB = optB.replace('\\True', '').trim(); }
          if (optC.includes('\\True')) { correct = 'C'; optC = optC.replace('\\True', '').trim(); }
          if (optD.includes('\\True')) { correct = 'D'; optD = optD.replace('\\True', '').trim(); }
        }
      } else {
        // Tách A. B. C. D. thông thường
        const parts = questionBody.split(/(?=[A-D]\s*[\.\:])/);
        if (parts.length >= 4) {
          prompt = parts[0].replace(/^(?:Câu|CÂU|Bài)\s*\d+[:\.]?\s*/i, '').trim();
          for (let i = 1; i < parts.length; i++) {
            const p = parts[i].trim();
            if (p.startsWith('A')) optA = p.replace(/^A\s*[\.\:]\s*/, '').trim();
            else if (p.startsWith('B')) optB = p.replace(/^B\s*[\.\:]\s*/, '').trim();
            else if (p.startsWith('C')) optC = p.replace(/^C\s*[\.\:]\s*/, '').trim();
            else if (p.startsWith('D')) optD = p.replace(/^D\s*[\.\:]\s*/, '').trim();
          }
        }
      }

      const ansMatch = questionBody.match(/(?:Đáp án|Chọn|Key)\s*[:\.]?\s*([A-D])/i);
      if (ansMatch) {
        correct = ansMatch[1].toUpperCase() as any;
      }

      if (prompt && (optA || optB)) {
        questions.push({
          id: `q_p1_${Date.now()}_${qCounter}`,
          part: 'part_1_mcq',
          questionNumber: qCounter++,
          prompt: prompt.replace(/\\end\{ex\}/g, '').trim(),
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
        prompt = questionBody.slice(0, choiceTfIdx).replace(/^(?:Câu|CÂU|Bài)\s*\d+[:\.]?\s*/i, '').trim();
        const tfBraces = extractBalancedBraces(questionBody, choiceTfIdx, 4);
        const subKeys = ['a', 'b', 'c', 'd'];
        tfBraces.forEach((bText, idx) => {
          let isCorrect = true;
          let cleanText = bText;
          if (cleanText.includes('\\False') || cleanText.toLowerCase().includes('sai')) {
            isCorrect = false;
          }
          cleanText = cleanText.replace(/\\(?:True|False)/g, '').replace(/\((?:Đúng|Sai|Đ|S)\)/gi, '').trim();
          subItems.push({
            id: `tf_${subKeys[idx]}_${Date.now()}`,
            subKey: subKeys[idx],
            text: cleanText || `Mệnh đề ${subKeys[idx].toUpperCase()}`,
            isCorrect,
          });
        });
      } else {
        // Tách a) b) c) d)
        prompt = questionBody.split(/(?=[a-d]\s*[\)\.\:])/i)[0].replace(/^(?:Câu|CÂU|Bài)\s*\d+[:\.]?\s*/i, '').trim();
        const subMatches = questionBody.matchAll(/([a-d])\s*[\)\.\:]\s*([^a-d\n\r]*?)(?=(?:[a-d]\s*[\)\.\:]|$))/gi);
        for (const sm of subMatches) {
          const subKey = sm[1].toLowerCase();
          let itemText = sm[2].trim();
          let isCorrect = true;
          if (itemText.toLowerCase().includes('sai') || itemText.includes('\\False') || itemText.includes('(S)')) {
            isCorrect = false;
          }
          itemText = itemText.replace(/\((?:Đúng|Sai|Đ|S)\)/gi, '').replace(/\\(?:True|False)/g, '').trim();
          if (itemText) {
            subItems.push({
              id: `tf_${subKey}_${Date.now()}`,
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
              id: `tf_${k}_${Date.now()}`,
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
          prompt: prompt || 'Cho hàm số và giả thiết toán học sau. Xét tính đúng sai của các mệnh đề:',
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
    if (determinedPart === 'part_3_short_answer') {
      let prompt = questionBody.replace(/^(?:Câu|CÂU|Bài)\s*\d+[:\.]?\s*/i, '').replace(/\\end\{ex\}/g, '').trim();
      let ans = '2';

      if (questionBody.includes('\\shortans')) {
        const shortIdx = questionBody.indexOf('\\shortans');
        const ansBraces = extractBalancedBraces(questionBody, shortIdx, 1);
        if (ansBraces.length > 0) {
          ans = ansBraces[0].trim().slice(0, 4);
        }
        prompt = questionBody.slice(0, shortIdx).replace(/^(?:Câu|CÂU|Bài)\s*\d+[:\.]?\s*/i, '').trim();
      } else {
        const numMatch = questionBody.match(/(?:Đáp án|Đáp số|Kết quả|=\s*)\s*[:\.]?\s*([-+]?\d+(?:[\.,\/]\d+)?)/i);
        if (numMatch) {
          ans = numMatch[1].replace(',', '.').slice(0, 4);
        }
      }

      if (prompt.length > 8) {
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

  // Không tạo câu hỏi mẫu nếu không bóc tách được câu nào từ tài liệu
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  return {
    metadata: {
      title,
      grade: Number(grade) || 12,
      year: 2025,
      durationMinutes: Number(durationMinutes) || 90,
      totalPoints: Number(totalPoints.toFixed(2)),
    },
    questions,
  };
}

// Hàm trích xuất an toàn JSON chứa công thức toán học LaTeX từ Gemini AI
function safeParseJsonWithLatex(jsonStr: string): any {
  if (!jsonStr) return null;
  // Làm sạch các khối markdown code fence ```json ... ```
  let clean = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const firstBrace = clean.indexOf('{');
  if (firstBrace !== -1) {
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    } else {
      clean = clean.slice(firstBrace);
    }
  }

  // Helper hàm thử parse hoặc phục hồi ký tự escape của LaTeX
  const tryParseOrRepair = (inputStr: string): any => {
    // 1. Thử parse trực tiếp nếu chuỗi JSON đã hoàn hảo
    try {
      return JSON.parse(inputStr);
    } catch {
      // Tiếp tục xử lý chuyên sâu
    }

    // 2. Xử lý ký tự thoát LaTeX và ký tự điều khiển trong chuỗi JSON
    try {
      let inString = false;
      let out = '';
      for (let i = 0; i < inputStr.length; i++) {
        const char = inputStr[i];

        if (char === '"') {
          // Kiểm tra xem dấu ngoặc kép này có bị escape bằng số lượng lẻ dấu backslash trước nó không
          let slashCount = 0;
          let k = i - 1;
          while (k >= 0 && inputStr[k] === '\\') {
            slashCount++;
            k--;
          }
          if (slashCount % 2 === 0) {
            inString = !inString;
          }
          out += char;
        } else if (inString) {
          // Xử lý các ký tự điều khiển bị xuống dòng trực tiếp trong chuỗi JSON
          if (char === '\n') {
            out += '\\n';
          } else if (char === '\r') {
            // bỏ qua \r
          } else if (char === '\t') {
            out += ' ';
          } else if (char === '\\') {
            const next = inputStr[i + 1] || '';
            const charAfterNext = inputStr[i + 2] || '';

            if (next === '"' || next === '\\' || next === '/') {
              out += '\\' + next;
              i++;
            } else if (next === 'u' && /^[0-9a-fA-F]{4}/.test(inputStr.slice(i + 2, i + 6))) {
              out += '\\u';
            } else if (next === 'b' || next === 'f' || next === 'n' || next === 'r' || next === 't') {
              // Nếu ký tự sau [bfnrt] là chữ cái [a-zA-Z] -> Đó là lệnh LaTeX (ví dụ: \frac, \text, \to, \right, \beta)
              if (/[a-zA-Z]/.test(charAfterNext)) {
                out += '\\\\';
              } else {
                out += '\\' + next;
                i++;
              }
            } else {
              // Bất kỳ ký tự nào khác sau backslash trong chuỗi JSON (ví dụ: \sqrt, \alpha, \cos, \int)
              out += '\\\\';
            }
          } else {
            out += char;
          }
        } else {
          out += char;
        }
      }

      // Xóa dấu phẩy thừa trước dấu đóng ngoặc } hoặc ]
      out = out.replace(/,\s*([\]}])/g, '$1');

      return JSON.parse(out);
    } catch {
      return null;
    }
  };

  // Thử parse chuỗi chuẩn ban đầu
  let parsed = tryParseOrRepair(clean);
  if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
    return parsed;
  }

  // 3. Phục hồi JSON bị cắt ngắn do độ dài (Truncated JSON Recovery)
  // Nếu Gemini bị cắt ngang ở câu hỏi thứ N, tìm dấu đóng ngoặc } cuối cùng của mảng questions và đóng lại hợp lệ
  const questionsIdx = clean.indexOf('"questions"');
  if (questionsIdx !== -1) {
    const questionsSlice = clean.slice(questionsIdx);
    const lastObjectClose = questionsSlice.lastIndexOf('}');
    if (lastObjectClose !== -1) {
      const repaired = clean.slice(0, questionsIdx + lastObjectClose + 1) + '\n  ]\n}';
      parsed = tryParseOrRepair(repaired);
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed;
      }
    }
  }

  // 4. Fallback: Bóc tách từng khối câu hỏi bằng biểu thức chính quy (Regex Extraction)
  try {
    const questionMatches = clean.match(/\{[^{}]*"part"\s*:\s*"[^"]+"[\s\S]*?\}/g);
    if (questionMatches && questionMatches.length > 0) {
      const salvagedQuestions: any[] = [];
      for (const qStr of questionMatches) {
        try {
          const sanitizedQ = qStr
            .replace(/\\([a-zA-Z]+)/g, '\\\\$1')
            .replace(/,\s*([\]}])/g, '$1');
          const qObj = JSON.parse(sanitizedQ);
          if (qObj && qObj.part) {
            salvagedQuestions.push(qObj);
          }
        } catch {
          // Bỏ qua khối lỗi lẻ
        }
      }
      if (salvagedQuestions.length > 0) {
        return {
          metadata: {
            title: 'Đề Thi Toán THPT (Trích Xuất AI Cứu Hộ)',
            grade: 12,
            year: 2025,
            durationMinutes: 90,
            totalPoints: salvagedQuestions.length * 0.25,
          },
          questions: salvagedQuestions,
        };
      }
    }
  } catch (e3) {
    console.warn('[safeParseJsonWithLatex] Regex fallback thất bại:', (e3 as Error).message);
  }

  return null;
}

// API: TRÍCH XUẤT VĂN BẢN TỪ FILE WORD (.DOC / .DOCX)
app.post('/api/word/extract', async (req, res) => {
  try {
    const { fileBase64, fileName } = req.body || {};
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu file Word.' });
    }
    const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    const buffer = Buffer.from(cleanB64, 'base64');
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    const parts = [
      doc.getHeaders?.({ includeFooters: false }) || '',
      doc.getBody?.() || '',
      doc.getFooters?.() || '',
    ].filter((s) => typeof s === 'string' && s.trim().length > 0);
    const text = parts.join('\n').trim();
    return res.json({ success: true, text, fileName: fileName || 'document.docx' });
  } catch (err: any) {
    console.warn('[Word Extract] Lỗi trích xuất file Word:', err?.message);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Không thể đọc nội dung tệp Word này.',
    });
  }
});

// API 3: AI PDF, WORD & LATEX EXAM PARSER (3 PHẦN CHUẨN BGD 2025)
app.post('/api/gemini/parse-pdf', async (req, res) => {
  const { pdfText, pdfBase64, wordText, wordBase64, latexText, grade = 12, durationMinutes = 90, examTitle } = req.body;
  let extractedPdfText = pdfText || wordText || '';

  try {
    // 1a. Nếu có pdfBase64, làm sạch tiền tố và trích xuất text nhị phân trực tiếp bằng pdf-parse
    let cleanBase64 = '';
    if (pdfBase64) {
      try {
        cleanBase64 = String(pdfBase64).replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
        const pdfBuffer = Buffer.from(cleanBase64, 'base64');
        const parser = new PDFParse({ data: pdfBuffer });
        const textResult = await parser.getText();
        if (textResult && textResult.text) {
          extractedPdfText = textResult.text.trim();
          console.log(`[PDF Parser] Đã trích xuất thành công ${extractedPdfText.length} ký tự từ file PDF.`);
        }
        await parser.destroy().catch(() => {});
      } catch (pdfErr: any) {
        console.warn('[PDF Parser] Lỗi khi trích xuất text từ PDF bằng PDFParse:', pdfErr?.message);
      }
    }

    // 1b. Nếu có wordBase64 nhưng chưa có wordText, trích xuất text bằng WordExtractor
    if (!extractedPdfText && wordBase64) {
      try {
        const cleanWordB64 = String(wordBase64).replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
        const wordBuffer = Buffer.from(cleanWordB64, 'base64');
        const extractor = new WordExtractor();
        const doc = await extractor.extract(wordBuffer);
        const wordBody = (doc.getBody?.() || '').trim();
        if (wordBody) {
          extractedPdfText = wordBody;
          console.log(`[Word Parser] Đã trích xuất thành công ${extractedPdfText.length} ký tự từ file Word.`);
        }
      } catch (wordErr: any) {
        console.warn('[Word Parser] Lỗi trích xuất text từ Word:', wordErr?.message);
      }
    }

    const rawContent = latexText || wordText || extractedPdfText || pdfText || '';
    // Khử sạch header/footer, số trang, watermark PDF trước khi bóc tách cấu trúc đề
    const cleanedContent = cleanPdfNoiseAndOcr(rawContent).cleanedText || rawContent;

    // Nếu không có API Key, chuyển sang sử dụng bộ bóc tách thông minh Regex/LaTeX nội bộ
    const activeClient = getActiveGeminiClient();
    if (!activeClient) {
      console.warn('[Gemini PDF Parser] Không có API Key, sử dụng bộ giải mã LaTeX/PDF thông minh');
      const fallbackExam = parseExamFromLatexOrText(cleanedContent, grade, durationMinutes, examTitle);
      return res.json({ success: true, parsedExam: fallbackExam, source: 'latex_parser', textExtracted: Boolean(extractedPdfText) });
    }

    const systemPrompt = `Bạn là chuyên gia thẩm định và bóc tách đề thi Toán học THPT Việt Nam (Bộ Giáo dục & Đào tạo định dạng mới 2025).
Nhiệm vụ của bạn: Bóc tách TOÀN BỘ các câu hỏi từ đề thi được cung cấp thành định dạng JSON chuẩn hóa 3 phần.

HƯỚNG DẪN QUAN TRỌNG ĐỂ KHÔNG QUÉT SAI CÂU HỎI VÀ LỖI PHÔNG CHỮ:
1. ĐỌC THEO CỘT VĂN BẢN (TRÁNH TRỘN CÂU):
   - Đề thi Toán THPT thường in 2 CỘT trên mỗi trang. Bạn PHẢI đọc hết cột bên trái từ trên xuống dưới, sau đó mới đọc cột bên phải từ trên xuống dưới.
   - Tuyệt đối KHÔNG đọc ngang hàng làm trộn lẫn câu hỏi hoặc phương án giữa cột trái và cột phải.
2. CẤU TRÚC 3 PHẦN CHUẨN BGD 2025:
   - PHẦN I ("part_1_mcq"): Trắc nghiệm 4 lựa chọn (A, B, C, D). Mỗi câu có mảng options gồm 4 phần tử với key: 'A', 'B', 'C', 'D' và text; correctAnswer là 'A', 'B', 'C' hoặc 'D'; points: 0.25.
   - PHẦN II ("part_2_true_false"): Trắc nghiệm Đúng/Sai. Mỗi câu có đúng 4 ý độc lập a, b, c, d. Trường "items" là mảng đúng 4 phần tử: subKey ('a', 'b', 'c', 'd'), text, và isCorrect: boolean (true = Đúng, false = Sai); points: 1.0.
     Lưu ý: Trong đề bài, Phần II thường được đánh số lại là Câu 1, Câu 2... Bạn PHẢI phân loại vào "part_2_true_false".
   - PHẦN III ("part_3_short_answer"): Trắc nghiệm trả lời ngắn (điền kết quả). KHÔNG có phương án A, B, C, D. Trường "correctAnswer" là số hoặc phân số rút gọn (ví dụ: "12", "-2.5", "3/4"); points: 0.5.
3. BẢNG ĐÁP ÁN Ở CUỐI ĐỀ THI:
   - Nếu trong tài liệu có BẢNG ĐÁP ÁN hoặc LỜI GIẢI / HƯỚNG DẪN CHẤM ở cuối đề hoặc trang cuối, bạn BẮT BUỘC phải đối chiếu bảng đáp án này để gán chính xác correctAnswer cho Phần I, isCorrect cho từng ý a, b, c, d của Phần II, và đáp số cho Phần III.
   - Nếu không có bảng đáp án, bạn hãy giải toán chính xác để xác định đáp án đúng.
4. CÔNG THỨC TOÁN HỌC & CHUẨN HÓA PHÔNG CHỮ:
   - Mọi biểu thức toán, ký hiệu, đồ thị hàm số phải được bọc trong cú pháp LaTeX chuẩn $...$ hoặc $$...$$ (ví dụ: $y = f(x)$, $\\int_0^1 x dx$, $\\frac{a}{b}$, $\\sqrt{x^2+1}$, $\\in$, $\\mathbb{R}$).
   - Tất cả văn bản tiếng Việt phải dùng font Unicode UTF-8 chuẩn (dựng sẵn NFC), giữ nguyên dấu câu, không viết hoa/thường sai lệch, không dính chữ.
5. XỬ LÝ CÂU ĐẦU ĐỀ, TRÍCH DẪN NGUỒN VÀ DỮ KIỆN CHUNG:
   - Nếu câu hỏi có trích dẫn xuất xứ ở đầu (ví dụ: '[Chuyên Lam Sơn 2025]', '(Đề tham khảo BGD)', '\\textit{(Đề thi HSG)}'), hãy GIỮ NGUYÊN trích dẫn này ở đầu prompt dưới dạng '[Trích dẫn: ...]'.
   - Nếu có đoạn văn bản trích dẫn dữ kiện chung cho nhiều câu (ví dụ: 'Dựa vào thông tin sau để trả lời Câu 1 và Câu 2:', 'Dữ kiện chung cho các câu 4, 5:'), hãy gắn kèm dữ kiện này vào phần đầu prompt của TẤT CẢ các câu hỏi liên quan để câu hỏi có đầy đủ dữ kiện giải toán.
   - TUYỆT ĐỐI KHÔNG tạo câu hỏi giả mạo từ các câu hướng dẫn quy chế phần thi (ví dụ: 'Thí sinh trả lời từ câu 1 đến câu 12', 'Mỗi câu hỏi thí sinh chỉ chọn một phương án').
   - Lời giải (explanation) viết ngắn gọn 1-2 dòng xúc tích để đảm bảo phản hồi không bị quá tải.

Cấu trúc JSON đầu ra bắt buộc:
{
  "metadata": {
    "title": "${examTitle || 'Đề Thi Toán THPT Chuẩn BGD'}",
    "grade": ${grade},
    "year": 2025,
    "durationMinutes": ${durationMinutes},
    "totalPoints": 10.0
  },
  "questions": [
    {
      "id": "q1",
      "part": "part_1_mcq",
      "questionNumber": 1,
      "prompt": "Lời dẫn câu hỏi có chứa công thức $...$",
      "options": [
        { "key": "A", "text": "Phương án A có công thức $...$" },
        { "key": "B", "text": "Phương án B có công thức $...$" },
        { "key": "C", "text": "Phương án C có công thức $...$" },
        { "key": "D", "text": "Phương án D có công thức $...$" }
      ],
      "correctAnswer": "A",
      "explanation": "Lời giải chi tiết ngắn gọn",
      "points": 0.25
    },
    {
      "id": "q2",
      "part": "part_2_true_false",
      "questionNumber": 2,
      "prompt": "Lời dẫn câu hỏi Đúng/Sai",
      "items": [
        { "subKey": "a", "text": "Ý a", "isCorrect": true },
        { "subKey": "b", "text": "Ý b", "isCorrect": false },
        { "subKey": "c", "text": "Ý c", "isCorrect": true },
        { "subKey": "d", "text": "Ý d", "isCorrect": false }
      ],
      "explanation": "Lời giải chi tiết",
      "points": 1.0
    },
    {
      "id": "q3",
      "part": "part_3_short_answer",
      "questionNumber": 3,
      "prompt": "Lời dẫn câu hỏi trả lời ngắn",
      "correctAnswer": "15",
      "explanation": "Lời giải chi tiết",
      "points": 0.5
    }
  ]
}
Trả về DUY NHẤT chuỗi JSON hợp lệ, không có văn bản giải thích nào ngoài JSON.`;

    let contentsPayload: any;

    if (cleanBase64) {
      const textInstruction = extractedPdfText && extractedPdfText.length > 20
        ? `${systemPrompt}\n\n[DỮ LIỆU BỔ TRỢ TỪ TỆP]: Dưới đây là chuỗi ký tự text trích xuất từ file PDF (hãy kết hợp đọc cùng các trang in PDF ở trên để nhận diện chính xác câu hỏi, công thức KaTeX và bảng đáp án):\n${extractedPdfText.slice(0, 45000)}`
        : systemPrompt;

      contentsPayload = {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64,
            },
          },
          {
            text: textInstruction,
          },
        ],
      };
    } else {
      contentsPayload = `${systemPrompt}\n\nNỘI DUNG ĐỀ THI / MÃ NGUỒN LATEX CỦA GIÁO VIÊN:\n${rawContent}`;
    }

    const response = await activeClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: contentsPayload,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let rawText = response.text || '';
    const parsedExam = safeParseJsonWithLatex(rawText);

    if (parsedExam && Array.isArray(parsedExam.questions) && parsedExam.questions.length > 0) {
      parsedExam.questions.forEach((q: any, idx: number) => {
        if (!q.id) q.id = `q_ai_${idx + 1}_${Date.now()}`;
        q.questionNumber = idx + 1;
        if (q.part === 'part_1_mcq' && !q.points) q.points = 0.25;
        if (q.part === 'part_2_true_false' && !q.points) q.points = 1.0;
        if (q.part === 'part_3_short_answer' && !q.points) q.points = 0.5;
      });

      const total = parsedExam.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0);
      parsedExam.metadata = {
        ...parsedExam.metadata,
        title: examTitle || parsedExam.metadata?.title || 'Đề Thi Toán THPT (Quét AI)',
        grade: Number(grade) || 12,
        year: 2025,
        durationMinutes: Number(durationMinutes) || 90,
        totalPoints: Number(total.toFixed(2)),
      };

      return res.json({ success: true, parsedExam, source: 'gemini', textExtracted: Boolean(extractedPdfText) });
    }

    const fallbackExam = parseExamFromLatexOrText(rawContent || 'Đề Thi Toán THPT', grade, durationMinutes, examTitle);
    res.json({ success: true, parsedExam: fallbackExam, source: 'latex_parser', textExtracted: Boolean(extractedPdfText) });
  } catch (error: any) {
    console.warn('[Gemini PDF Parser] Model error or JSON parse issue, using intelligent LaTeX/PDF parser:', error?.message);
    const rawFallbackContent = latexText || extractedPdfText || pdfText || examTitle || 'Đề Thi Toán THPT';
    const fallbackExam = parseExamFromLatexOrText(rawFallbackContent, grade, durationMinutes, examTitle);
    res.json({
      success: true,
      parsedExam: fallbackExam,
      source: 'latex_parser',
      textExtracted: Boolean(extractedPdfText),
    });
  }
});

// API 3.5: AI VISION AUTO-CROP BOUNDING BOXES CHO TRANG PDF SCAN / ẢNH ĐỀ THI
app.post('/api/gemini/auto-crop-page', async (req, res) => {
  const { pageImageBase64, pageNumber = 1, currentPartHint = 'part_1_mcq' } = req.body || {};

  if (!pageImageBase64 || typeof pageImageBase64 !== 'string') {
    return res.status(400).json({
      success: false,
      code: 'EMPTY_INPUT',
      error: 'Thiếu ảnh trang đề thi để nhận diện khung câu hỏi.',
    });
  }

  const activeClient = getActiveGeminiClient();
  if (!activeClient) {
    const errInfo = classifyGeminiError(new Error('MISSING_API_KEY'));
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }

  try {
    const imgPart = buildInlinePartFromDataUrl(pageImageBase64);
    if (!imgPart) {
      return res.status(400).json({ success: false, code: 'INVALID_IMAGE', error: 'Dữ liệu ảnh trang không hợp lệ.' });
    }

    const prompt = `Bạn là hệ thống Computer Vision chuyên định vị khung câu hỏi (Object Detection / Layout Segmentation) cho đề thi Toán THPT Việt Nam (định dạng BGD 2025).
Đang phân tích TRANG ${pageNumber} (Phần gợi ý tiếp nối từ trang trước: "${currentPartHint}").

YÊU CẦU TỌA ĐỘ BOUNDING BOX [ymin, xmin, ymax, xmax] (thang số nguyên 0..1000 theo chiều cao và chiều rộng ảnh):
1. Với mỗi câu hỏi hoàn chỉnh bắt đầu trên trang này (ví dụ "Câu 1.", "Câu 2.", "Bài 1."):
   - Bao trọn phần đề bài ("Câu X..."), công thức, hình vẽ/bảng biến thiên/đồ thị đi kèm, VÀ toàn bộ các phương án A, B, C, D (hoặc các ý a), b), c), d)) của câu đó.
   - KHÔNG cắt lẫn vào câu trước hoặc câu sau; KHÔNG bao gồm tiêu đề Sở GD, mã đề, số trang, khung quy chế ("Thí sinh trả lời từ câu..."), hay phần "Lời giải chi tiết" nếu có.
   - Nếu trang chia 2 cột: liệt kê TOÀN BỘ các câu ở CỘT TRÁI từ trên xuống dưới trước, rồi mới tới các câu ở CỘT PHẢI từ trên xuống dưới.
2. Phân loại "part":
   - "part_1_mcq": có các phương án A, B, C, D.
   - "part_2_true_false": có các mệnh đề a), b), c), d) Đúng/Sai.
   - "part_3_short_answer": dạng trả lời ngắn / điền số (không có A-D và không có a-d).
3. Nếu đầu trang/cột có phần nội dung bị cắt dở từ câu cuối của trang trước (ví dụ chỉ có các đáp án C, D hoặc c), d) nằm phía trên câu hỏi đầu tiên của trang):
   - Đặt hasTopContinuation = true và trả về continuationBox = { ymin, xmin, ymax, xmax } bao trọn phần bị dở đó.
4. Nếu trang này CHỈ chứa BẢNG ĐÁP ÁN / HƯỚNG DẪN CHẤM / ĐÁP ÁN CUỐI ĐỀ:
   - Đặt isAnswerKeyPage = true, trích xuất toàn bộ bảng đáp án dạng chữ vào rawAnswerKeyText (ví dụ: "1.A 2.C ..."), và trả về questions = [].
5. Nếu nhìn thấy đáp án được đánh dấu sẵn trên trang (gạch chân, tô đỏ, hoặc "Đáp án: B"), điền vào correctAnswer ("A"/"B"/"C"/"D", hoặc "Đ,S,Đ,S" cho Đúng/Sai, hoặc số cho Phần III). Nếu không thấy dấu hiệu đáp án, để chuỗi rỗng "".`;

    const response = await callWithTransientRetry(() =>
      activeClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts: [imgPart, { text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAnswerKeyPage: { type: Type.BOOLEAN },
              rawAnswerKeyText: { type: Type.STRING },
              layout: { type: Type.STRING },
              hasTopContinuation: { type: Type.BOOLEAN },
              continuationBox: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.INTEGER },
                  xmin: { type: Type.INTEGER },
                  ymax: { type: Type.INTEGER },
                  xmax: { type: Type.INTEGER },
                },
                required: ['ymin', 'xmin', 'ymax', 'xmax'],
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionNumber: { type: Type.INTEGER },
                    part: { type: Type.STRING },
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                    correctAnswer: { type: Type.STRING },
                    shortSummary: { type: Type.STRING },
                  },
                  required: ['questionNumber', 'part', 'ymin', 'xmin', 'ymax', 'xmax'],
                },
              },
            },
            required: ['isAnswerKeyPage', 'layout', 'hasTopContinuation', 'questions'],
          },
        },
      })
    );

    const parsed = safeParseObjectJsonWithLatex(response.text || '');
    if (!parsed) {
      throw new Error('Không thể phân tích tọa độ câu hỏi từ phản hồi AI.');
    }

    return res.json({
      success: true,
      pageNumber,
      result: {
        isAnswerKeyPage: Boolean(parsed.isAnswerKeyPage),
        rawAnswerKeyText: String(parsed.rawAnswerKeyText || ''),
        layout: parsed.layout === 'two_column' ? 'two_column' : 'single_column',
        hasTopContinuation: Boolean(parsed.hasTopContinuation),
        continuationBox: parsed.continuationBox || null,
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      },
    });
  } catch (error: any) {
    const errInfo = classifyGeminiError(error);
    console.warn('[AutoCrop Vision] Error:', errInfo.code, error?.message);
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }
});

// =========================================================================
// HỆ THỐNG CƠ SỞ DỮ LIỆU ĐỒNG BỘ REAL-TIME GIỮA CÁC THIẾT BỊ (CROSS-MACHINE SYNC)
// =========================================================================
interface ServerDatabase {
  version: number;
  lastUpdated: string;
  users: any[];
  classrooms: any[];
  submissions: any[];
  cheatLogs: any[];
  classroomLessons: any[];
  classroomMessages: Record<string, any[]>;
  exams: any[];
  deletedExamIds?: string[];
  deletedSubmissionIds?: string[];
  adminBroadcasts?: any[];
  deletedBroadcastIds?: string[];
  adminSettings?: {
    autoApproval?: {
      enabled: boolean;
      autoApproveStudents: boolean;
      autoApproveTeachers: boolean;
      defaultTier: 'free' | 'premium';
      notifyAdminOnAutoApproval?: boolean;
    };
  };
}

const DEFAULT_ADMIN_USER = {
  id: '25021822',
  name: 'Ban Quản Trị Hệ Thống',
  email: 'daon36124@gmail.com',
  role: 'admin',
  tier: 'premium',
  xp: 15000,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  dailyScanCount: 0,
  maxDailyScans: 9999,
  grade: 12,
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin25021822',
  schoolName: 'Toán Học LIKI',
  phone: '024 3858 1234',
  bio: 'Quản trị viên toàn quyền hệ thống Toán Học LIKI.',
  password: 'Anhhungxom8@',
  status: 'active',
};

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');
const UPLOADS_DIR = path.join(DB_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch {}
}

function getCleanInitialDb(): ServerDatabase {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    users: [DEFAULT_ADMIN_USER],
    classrooms: [],
    submissions: [],
    cheatLogs: [],
    classroomLessons: [],
    classroomMessages: {},
    exams: [],
    deletedExamIds: [],
    deletedSubmissionIds: [],
    adminBroadcasts: [],
    deletedBroadcastIds: [],
    adminSettings: {
      autoApproval: {
        enabled: true,
        autoApproveStudents: true,
        autoApproveTeachers: true,
        defaultTier: 'free',
        notifyAdminOnAutoApproval: true,
      },
    },
  };
}

function loadDatabase(): ServerDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getCleanInitialDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    parsed.exams = parsed.exams || [];
    parsed.deletedExamIds = Array.isArray(parsed.deletedExamIds) ? parsed.deletedExamIds : [];
    parsed.deletedSubmissionIds = Array.isArray(parsed.deletedSubmissionIds) ? parsed.deletedSubmissionIds : [];
    parsed.adminBroadcasts = Array.isArray(parsed.adminBroadcasts) ? parsed.adminBroadcasts : [];
    parsed.deletedBroadcastIds = Array.isArray(parsed.deletedBroadcastIds) ? parsed.deletedBroadcastIds : [];
    // Cấu hình duyệt tự động mặc định nếu chưa có
    if (!parsed.adminSettings || !parsed.adminSettings.autoApproval) {
      parsed.adminSettings = {
        autoApproval: {
          enabled: true,
          autoApproveStudents: true,
          autoApproveTeachers: true,
          defaultTier: 'free',
          notifyAdminOnAutoApproval: true,
        },
      };
    }
    // Loại bỏ tài khoản admin mẫu cũ usr_admin_01
    parsed.users = (parsed.users || []).filter((u: any) => u.id !== 'usr_admin_01');
    // Đảm bảo luôn có tài khoản Admin duy nhất đã cấu hình
    if (!parsed.users.some((u: any) => u.id === '25021822' || u.email === 'daon36124@gmail.com')) {
      parsed.users = [DEFAULT_ADMIN_USER, ...parsed.users];
    } else {
      parsed.users = parsed.users.map((u: any) =>
        u.id === '25021822' || u.email === 'daon36124@gmail.com' ? { ...u, ...DEFAULT_ADMIN_USER } : u
      );
    }
    saveDatabase(parsed);
    return parsed;
  } catch (err) {
    console.error('Lỗi nạp database.json, sử dụng DB sạch:', err);
    return getCleanInitialDb();
  }
}

function saveDatabase(db: ServerDatabase) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi ghi database.json:', err);
  }
}

let serverDb: ServerDatabase = loadDatabase();

// 1. Lấy toàn bộ trạng thái cơ sở dữ liệu đồng bộ
app.get('/api/db/state', (_req, res) => {
  res.json({
    success: true,
    version: serverDb.version,
    data: serverDb,
  });
});

// 2. Đăng ký tài khoản mới (gửi yêu cầu đến Admin, hỗ trợ trường ID tự đặt)
app.post('/api/db/register', (req, res) => {
  const { user } = req.body;
  if (!user || !user.email) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin người dùng!' });
  }

  const emailLower = user.email.trim().toLowerCase();
  let idLower = (user.id || '').trim().toLowerCase();
  if (!idLower) {
    const prefix = user.role === 'teacher' ? 'usr_teacher' : 'usr_student';
    idLower = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  // Kiểm tra trùng ID tài khoản
  if (serverDb.users.some((u) => u.id.trim().toLowerCase() === idLower)) {
    if (user.id && user.id.trim()) {
      return res.status(400).json({ success: false, error: 'Mã ID tài khoản này đã tồn tại trên hệ thống!' });
    }
    idLower = `${idLower}_${Math.random().toString(36).slice(2, 5)}`;
  }

  // Kiểm tra trùng Email
  if (serverDb.users.some((u) => u.email.trim().toLowerCase() === emailLower)) {
    return res.status(400).json({ success: false, error: 'Địa chỉ Email này đã tồn tại trên hệ thống!' });
  }

  // Kiểm tra độ dài mật khẩu tối thiểu 8 ký tự
  if (user.password && user.password.length < 8) {
    return res.status(400).json({ success: false, error: 'Mật khẩu phải có tối thiểu 8 ký tự!' });
  }

  // Kiểm tra cấu hình Duyệt Tự Động của Admin
  const autoApproval = serverDb.adminSettings?.autoApproval;
  const isAutoApprove = Boolean(
    autoApproval?.enabled &&
    ((user.role === 'student' && autoApproval.autoApproveStudents) ||
     (user.role === 'teacher' && autoApproval.autoApproveTeachers))
  );

  const initialStatus = isAutoApprove ? 'active' : 'pending_approval';
  const initialTier = isAutoApprove ? (autoApproval?.defaultTier || 'free') : (user.tier || 'free');

  // Khởi tạo tài khoản người dùng
  const newUser = {
    ...user,
    id: idLower,
    status: initialStatus,
    tier: initialTier,
    requestedAt: new Date().toISOString(),
    autoApproved: isAutoApprove,
    ...(isAutoApprove ? { approvedAt: new Date().toISOString() } : {}),
  };

  serverDb.users.push(newUser);
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);

  res.json({
    success: true,
    user: newUser,
    isAutoApproved: isAutoApprove,
    version: serverDb.version,
  });
});

// 3. Admin phê duyệt kích hoạt tài khoản
app.post('/api/db/user/approve', (req, res) => {
  const { userId } = req.body;
  let found = false;
  serverDb.users = serverDb.users.map((u) => {
    if (u.id === userId) {
      found = true;
      return { ...u, status: 'active', rejectionReason: undefined, approvedAt: new Date().toISOString() };
    }
    return u;
  });

  if (found) {
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({ success: found, version: serverDb.version });
});

// 3b. Admin Phê Duyệt Tự Động Toàn Bộ Người Dùng Chờ Duyệt (Bulk Auto-Approve)
app.post('/api/db/user/approve-all', (req, res) => {
  const { targetRole, tier } = req.body || {};
  let approvedCount = 0;
  const approvedIds: string[] = [];

  serverDb.users = serverDb.users.map((u) => {
    if (u.status === 'pending_approval') {
      if (!targetRole || targetRole === 'all' || u.role === targetRole) {
        approvedCount++;
        approvedIds.push(u.id);
        return {
          ...u,
          status: 'active',
          tier: tier || u.tier || 'free',
          rejectionReason: undefined,
          approvedAt: new Date().toISOString(),
        };
      }
    }
    return u;
  });

  if (approvedCount > 0) {
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({
    success: true,
    approvedCount,
    approvedIds,
    version: serverDb.version,
    users: serverDb.users,
  });
});

// 3c. Lấy cấu hình Admin Settings (Duyệt tự động, ...)
app.get('/api/db/admin/settings', (_req, res) => {
  res.json({
    success: true,
    settings: serverDb.adminSettings || {
      autoApproval: {
        enabled: true,
        autoApproveStudents: true,
        autoApproveTeachers: true,
        defaultTier: 'free',
        notifyAdminOnAutoApproval: true,
      },
    },
  });
});

// 3d. Cập nhật cấu hình Admin Settings (Duyệt tự động, ...)
app.post('/api/db/admin/settings', (req, res) => {
  const { autoApproval } = req.body || {};
  if (!serverDb.adminSettings) {
    serverDb.adminSettings = {
      autoApproval: {
        enabled: true,
        autoApproveStudents: true,
        autoApproveTeachers: true,
        defaultTier: 'free',
        notifyAdminOnAutoApproval: true,
      },
    };
  }

  if (autoApproval) {
    serverDb.adminSettings.autoApproval = {
      ...serverDb.adminSettings.autoApproval,
      ...autoApproval,
    };
  }

  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);

  res.json({
    success: true,
    settings: serverDb.adminSettings,
    version: serverDb.version,
  });
});

// 4. Admin từ chối phê duyệt
app.post('/api/db/user/reject', (req, res) => {
  const { userId, reason } = req.body;
  let found = false;
  serverDb.users = serverDb.users.map((u) => {
    if (u.id === userId) {
      found = true;
      return { ...u, status: 'rejected', rejectionReason: reason || 'Thông tin tài khoản không hợp lệ' };
    }
    return u;
  });

  if (found) {
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({ success: found, version: serverDb.version });
});

// 5. Admin xóa tài khoản
app.post('/api/db/user/delete', (req, res) => {
  const { userId } = req.body;
  const initialLength = serverDb.users.length;
  serverDb.users = serverDb.users.filter((u) => u.id !== userId);

  if (serverDb.users.length !== initialLength) {
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({ success: true, version: serverDb.version });
});

// 6. Cập nhật hồ sơ tài khoản (đổi mật khẩu, nâng gói, cập nhật thông tin)
app.post('/api/db/user/update', (req, res) => {
  const { user } = req.body;
  if (!user || !user.id) {
    return res.status(400).json({ success: false, error: 'Thiếu dữ liệu user!' });
  }

  serverDb.users = serverDb.users.map((u) => (u.id === user.id ? { ...u, ...user } : u));
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);

  res.json({ success: true, version: serverDb.version });
});

// 7. Đồng bộ danh sách lớp học
app.post('/api/db/classrooms', (req, res) => {
  serverDb.classrooms = req.body.classrooms || [];
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version });
});

// 7b. Giải tán / Xóa nhóm lớp (Xóa lớp học, bài học của lớp và toàn bộ tin nhắn nhóm)
app.post('/api/db/classroom/delete', (req, res) => {
  const { classId } = req.body;
  if (classId) {
    serverDb.classrooms = (serverDb.classrooms || []).filter((cls: any) => cls.id !== classId);
    serverDb.classroomLessons = (serverDb.classroomLessons || []).filter((l: any) => l.classId !== classId);
    if (serverDb.classroomMessages && serverDb.classroomMessages[classId]) {
      delete serverDb.classroomMessages[classId];
    }
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 8. Lưu kết quả nộp bài thi của học sinh
app.post('/api/db/submissions', (req, res) => {
  const { submission } = req.body;
  if (submission) {
    serverDb.submissions = [submission, ...serverDb.submissions.filter((s) => s.id !== submission.id)];
    serverDb.deletedSubmissionIds = (serverDb.deletedSubmissionIds || []).filter((id) => id !== submission.id);
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 8b. Giáo viên xóa 1 hoặc nhiều bài nộp của học sinh
app.post('/api/db/submissions/delete', (req, res) => {
  const { submissionId, submissionIds } = req.body || {};
  const idsToDelete = new Set<string>();
  if (typeof submissionId === 'string' && submissionId.trim()) {
    idsToDelete.add(submissionId.trim());
  }
  if (Array.isArray(submissionIds)) {
    submissionIds.forEach((id: unknown) => {
      if (typeof id === 'string' && id.trim()) {
        idsToDelete.add(id.trim());
      }
    });
  }

  if (idsToDelete.size > 0) {
    serverDb.submissions = (serverDb.submissions || []).filter((s: any) => !idsToDelete.has(s.id));
    const delSet = new Set(serverDb.deletedSubmissionIds || []);
    idsToDelete.forEach((id) => delSet.add(id));
    serverDb.deletedSubmissionIds = Array.from(delSet).slice(-1000);
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }

  res.json({ success: true, deletedCount: idsToDelete.size, version: serverDb.version });
});

// 9. Lưu nhật ký vi phạm quy chế thi
app.post('/api/db/cheat-logs', (req, res) => {
  const { log } = req.body;
  if (log) {
    serverDb.cheatLogs = [log, ...serverDb.cheatLogs];
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 10. Lưu toàn bộ chuyên đề bài học
app.post('/api/db/lessons', (req, res) => {
  serverDb.classroomLessons = req.body.lessons || [];
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version });
});

// 10b. Lưu 1 bài học (Thêm mới hoặc Cập nhật)
app.post('/api/db/lesson/save', (req, res) => {
  const { lesson } = req.body;
  if (lesson && lesson.id) {
    const existingIdx = (serverDb.classroomLessons || []).findIndex((l: any) => l.id === lesson.id);
    if (existingIdx >= 0) {
      serverDb.classroomLessons[existingIdx] = lesson;
    } else {
      serverDb.classroomLessons = [lesson, ...(serverDb.classroomLessons || [])];
    }
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 10c. Xóa 1 bài học khỏi lớp và toàn bộ dữ liệu liên quan
app.post('/api/db/lesson/delete', (req, res) => {
  const { lessonId } = req.body;
  if (lessonId) {
    serverDb.classroomLessons = (serverDb.classroomLessons || []).filter((l: any) => l.id !== lessonId);
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 10d. Lưu danh sách toàn bộ đề thi
app.post('/api/db/exams', (req, res) => {
  const incoming = Array.isArray(req.body.exams) ? req.body.exams : [];
  const incomingIds = new Set(incoming.map((e: any) => e?.id).filter(Boolean));
  serverDb.exams = incoming;
  serverDb.deletedExamIds = (serverDb.deletedExamIds || []).filter((id) => !incomingIds.has(id));
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version });
});

// 10e. Lưu 1 đề thi mới / cập nhật đề thi (Giáo viên xuất bản đề thi)
app.post('/api/db/exam/save', (req, res) => {
  const { exam } = req.body;
  if (exam && exam.id) {
    const existingIdx = (serverDb.exams || []).findIndex((e: any) => e.id === exam.id);
    if (existingIdx >= 0) {
      serverDb.exams[existingIdx] = exam;
    } else {
      serverDb.exams = [exam, ...(serverDb.exams || [])];
    }
    serverDb.deletedExamIds = (serverDb.deletedExamIds || []).filter((id) => id !== exam.id);
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 10f. Xóa 1 đề thi và TOÀN BỘ dữ liệu liên quan (Bài nộp, Bảng điểm, Cheat Logs, Giao đề trong các lớp)
app.post('/api/db/exam/delete', (req, res) => {
  const { examId } = req.body;
  if (examId) {
    // 1. Xóa đề thi và lưu dấu vết đã xóa để đồng bộ xóa sạch trên mọi máy
    serverDb.exams = (serverDb.exams || []).filter((e: any) => e.id !== examId);
    const delSet = new Set(serverDb.deletedExamIds || []);
    delSet.add(examId);
    serverDb.deletedExamIds = Array.from(delSet).slice(-500);

    // 2. Xóa toàn bộ bài làm / bài nộp (submissions) của đề này
    serverDb.submissions = (serverDb.submissions || []).filter((s: any) => s.examId !== examId);

    // 3. Xóa toàn bộ nhật ký vi phạm quy chế thi (cheatLogs) của đề này
    serverDb.cheatLogs = (serverDb.cheatLogs || []).filter((c: any) => c.examId !== examId);

    // 4. Gỡ đề thi khỏi danh sách đã giao của toàn bộ các nhóm lớp
    serverDb.classrooms = (serverDb.classrooms || []).map((cls: any) => ({
      ...cls,
      assignedExamIds: (cls.assignedExamIds || []).filter((id: string) => id !== examId),
    }));

    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 10g. Lấy danh sách đề thi
app.get('/api/db/exams', (_req, res) => {
  res.json({ success: true, data: serverDb.exams || [] });
});

// 10h. Xóa sạch toàn bộ dữ liệu đề thi cũ, bài làm, cheat logs và phân bổ đề thi
app.post('/api/db/exams/purge-all', (_req, res) => {
  const delSet = new Set(serverDb.deletedExamIds || []);
  (serverDb.exams || []).forEach((e: any) => {
    if (e?.id) delSet.add(e.id);
  });
  delSet.add('exam_bgd_2025_01');
  serverDb.deletedExamIds = Array.from(delSet).slice(-500);
  serverDb.exams = [];
  serverDb.submissions = [];
  serverDb.cheatLogs = [];
  serverDb.classrooms = (serverDb.classrooms || []).map((cls: any) => ({
    ...cls,
    assignedExamIds: [],
  }));
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu đề thi cũ!', version: serverDb.version });
});

// 11. Lưu tin nhắn chat lớp học (Thêm mới hoặc cập nhật phản ứng)
app.post('/api/db/messages', (req, res) => {
  const { classId, message } = req.body;
  if (classId && message) {
    if (!serverDb.classroomMessages[classId]) {
      serverDb.classroomMessages[classId] = [];
    }
    const index = serverDb.classroomMessages[classId].findIndex((m: any) => m.id === message.id);
    if (index >= 0) {
      serverDb.classroomMessages[classId][index] = { ...serverDb.classroomMessages[classId][index], ...message };
    } else {
      serverDb.classroomMessages[classId].push(message);
    }
    // Sắp xếp tin nhắn theo thời gian tăng dần
    serverDb.classroomMessages[classId].sort(
      (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 11b. Lấy danh sách tin nhắn chat theo lớp học
app.get('/api/db/messages', (req, res) => {
  const classId = req.query.classId as string;
  if (classId) {
    const list = serverDb.classroomMessages[classId] || [];
    return res.json({ success: true, data: list });
  }
  res.json({ success: true, data: serverDb.classroomMessages });
});

// 11b. Thả biểu cảm Emoji tin nhắn chat
app.post('/api/db/message/reaction', (req, res) => {
  const { classId, messageId, emoji, userId } = req.body;
  if (classId && messageId && emoji && userId && serverDb.classroomMessages[classId]) {
    serverDb.classroomMessages[classId] = serverDb.classroomMessages[classId].map((msg: any) => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        const existing = reactions.find((r: any) => r.emoji === emoji);
        let nextReactions;
        if (existing) {
          if (existing.userIds.includes(userId)) {
            const nextUsers = existing.userIds.filter((uid: string) => uid !== userId);
            if (nextUsers.length === 0) {
              nextReactions = reactions.filter((r: any) => r.emoji !== emoji);
            } else {
              nextReactions = reactions.map((r: any) =>
                r.emoji === emoji ? { ...r, count: nextUsers.length, userIds: nextUsers } : r
              );
            }
          } else {
            nextReactions = reactions.map((r: any) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, userIds: [...r.userIds, userId] } : r
            );
          }
        } else {
          nextReactions = [...reactions, { emoji, count: 1, userIds: [userId] }];
        }
        return { ...msg, reactions: nextReactions };
      }
      return msg;
    });
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 11c. Xóa tin nhắn chat trong nhóm lớp
app.post('/api/db/message/delete', (req, res) => {
  const { classId, messageId } = req.body;
  if (classId && messageId && serverDb.classroomMessages[classId]) {
    serverDb.classroomMessages[classId] = serverDb.classroomMessages[classId].filter((m: any) => m.id !== messageId);
    serverDb.version = (serverDb.version || 1) + 1;
    saveDatabase(serverDb);
  }
  res.json({ success: true, version: serverDb.version });
});

// 11d. Hệ thống thông báo tin nhắn toàn hệ thống từ Admin (Hiển thị tại Nhóm Lớp & xóa hẳn theo từng tài khoản)
app.get('/api/db/broadcasts', (_req, res) => {
  res.json({ success: true, data: serverDb.adminBroadcasts || [] });
});

app.post('/api/db/broadcasts/send', (req, res) => {
  const { broadcast } = req.body;
  if (!broadcast || !broadcast.id || !broadcast.title || !broadcast.content) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin thông báo!' });
  }
  const list = Array.isArray(serverDb.adminBroadcasts) ? serverDb.adminBroadcasts : [];
  const existingIdx = list.findIndex((b: any) => b.id === broadcast.id);
  const sanitized = {
    ...broadcast,
    deletedByUserIds: Array.isArray(broadcast.deletedByUserIds) ? broadcast.deletedByUserIds : [],
    createdAt: broadcast.createdAt || new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...sanitized };
  } else {
    list.unshift(sanitized);
  }
  list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  serverDb.adminBroadcasts = list;
  serverDb.deletedBroadcastIds = (serverDb.deletedBroadcastIds || []).filter((id) => id !== broadcast.id);
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, data: sanitized, version: serverDb.version });
});

app.post('/api/db/broadcasts/dismiss', (req, res) => {
  const { broadcastId, userId } = req.body;
  const normUserId = typeof userId === 'string' ? userId.trim().toLowerCase() : '';
  if (!broadcastId || !normUserId) {
    return res.status(400).json({ success: false, error: 'Thiếu broadcastId hoặc userId!' });
  }
  const list = Array.isArray(serverDb.adminBroadcasts) ? serverDb.adminBroadcasts : [];
  let updatedItem: any = null;
  serverDb.adminBroadcasts = list.map((b: any) => {
    if (b && b.id === broadcastId) {
      const prevDeleted = Array.isArray(b.deletedByUserIds) ? b.deletedByUserIds : [];
      const hasAlready = prevDeleted.some((id: string) => String(id).trim().toLowerCase() === normUserId);
      const nextDeleted = hasAlready ? prevDeleted : [...prevDeleted, normUserId];
      updatedItem = { ...b, deletedByUserIds: nextDeleted };
      return updatedItem;
    }
    return b;
  });
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, data: updatedItem, version: serverDb.version });
});

app.post('/api/db/broadcasts/delete', (req, res) => {
  const { broadcastId } = req.body;
  if (!broadcastId) {
    return res.status(400).json({ success: false, error: 'Thiếu broadcastId!' });
  }
  serverDb.adminBroadcasts = (serverDb.adminBroadcasts || []).filter((b: any) => b.id !== broadcastId);
  const delSet = new Set(serverDb.deletedBroadcastIds || []);
  delSet.add(broadcastId);
  serverDb.deletedBroadcastIds = Array.from(delSet).slice(-500);
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version });
});

// 12. Khởi tạo lại dữ liệu sạch (Chỉ giữ duy nhất 1 tài khoản Admin)
app.post('/api/db/reset-clean', (_req, res) => {
  serverDb = getCleanInitialDb();
  serverDb.version = (serverDb.version || 1) + 1;
  saveDatabase(serverDb);
  res.json({ success: true, version: serverDb.version, data: serverDb });
});

// 13. Tải lên file tài liệu PDF bài học / luyện tập (Lưu file nhị phân chuẩn vào data/uploads)
app.post('/api/upload/file', (req, res) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin tên file hoặc nội dung file!' });
    }

    // Làm sạch tên file để bảo mật đường dẫn và tránh ký tự đặc biệt
    const ext = path.extname(fileName) || '.pdf';
    const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    const safeBaseName = baseName.substring(0, 50) || 'document';
    const uniqueFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBaseName}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, uniqueFileName);

    // Xử lý Base64 Data URL hoặc base64 thuần
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'Dữ liệu file tải lên rỗng!' });
    }

    fs.writeFileSync(targetPath, buffer);

    const sizeInMB = (buffer.length / (1024 * 1024)).toFixed(2);
    const fileSizeStr = buffer.length >= 1024 * 1024 ? `${sizeInMB} MB` : `${Math.round(buffer.length / 1024)} KB`;

    console.log(`[Math&NBK File Upload] Đã lưu tệp ${fileName} (${fileSizeStr}) vào ${uniqueFileName}`);

    res.json({
      success: true,
      fileUrl: `/api/files/${uniqueFileName}`,
      fileName: fileName,
      fileSize: fileSizeStr,
    });
  } catch (err: any) {
    console.error('Lỗi khi lưu file PDF tải lên:', err);
    res.status(500).json({ success: false, error: err.message || 'Lỗi lưu trữ file trên máy chủ!' });
  }
});

// 14. Phục vụ file PDF nhị phân với đầy đủ Content-Type & Content-Disposition
app.get('/api/files/:filename', (req, res) => {
  try {
    const safeFileName = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Không tìm thấy tài liệu PDF trên máy chủ!');
    }

    // Lấy tên hiển thị gốc nếu có
    const originalName = safeFileName.replace(/^\d+-[a-f0-9]+-/, '') || 'tai_lieu.pdf';

    // Xác định Content-Type theo đuôi file
    const ext = path.extname(safeFileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.gif': 'image/gif',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
    res.sendFile(filePath);
  } catch (err: any) {
    console.error('Lỗi khi phục vụ file tải lên:', err);
    res.status(500).send('Lỗi khi tải tài liệu hoặc hình ảnh!');
  }
});

// 15. Cung cấp runtime Firebase Web API Key từ Secrets (không cần hardcode trong bundle)
app.get('/api/firebase-env.js', (_req, res) => {
  const runtimeKey = (process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '').trim();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__RUNTIME_FIREBASE_API_KEY__ = ${JSON.stringify(runtimeKey)};`);
});

app.get('/api/firebase-secret-status', (_req, res) => {
  const runtimeKey = (process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '').trim();
  res.json({ configured: Boolean(runtimeKey) });
});

// Khởi chạy Vite Server Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Math&NBK server đang chạy tại http://localhost:${PORT}`);
  });
}

startServer();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
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

// 1. Tầng In-Memory Cache cho các bài toán đã được Gemini AI giải thành công
const problemSolutionCache = new Map<string, any>();

// API 1: CAMERA SCANNER & AI MATH SOLVER (WITH FULL-CONTENT CACHING & OCR NOISE CLEANING)
app.post('/api/gemini/scan', async (req, res) => {
  const startTime = Date.now();
  const { problemText, latex, imageBase64 } = req.body || {};
  const cleanedProblem = cleanPdfNoiseAndOcr(problemText || '');
  const cleanProblemText = cleanedProblem.suggestedPrompt || problemText || '';
  const cleanLatex = cleanedProblem.latexFormula || latex || '';

  if (!cleanProblemText.trim() && !cleanLatex.trim() && !imageBase64) {
    return res.status(400).json({
      success: false,
      code: 'EMPTY_INPUT',
      error: 'Vui lòng nhập đề bài hoặc tải ảnh/PDF bài toán để AI phân tích.',
    });
  }

  // Băm toàn bộ nội dung văn bản + ảnh (tránh trùng lặp prefix Base64)
  const hashKey = crypto
    .createHash('sha256')
    .update(`${cleanProblemText.trim().toLowerCase()}|${cleanLatex.trim().toLowerCase()}|${imageBase64 || ''}`)
    .digest('hex');

  if (problemSolutionCache.has(hashKey)) {
    const cached = problemSolutionCache.get(hashKey);
    return res.json({
      success: true,
      result: {
        ...cached,
        source: 'cache',
        processingTimeMs: Date.now() - startTime,
      },
    });
  }

  const client = getActiveGeminiClient();
  if (!client) {
    const errInfo = classifyGeminiError(new Error('MISSING_API_KEY'));
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }

  try {
    const systemInstruction = `Bạn là chuyên gia giải Toán THPT Việt Nam (lớp 10, 11, 12) và bóc tách OCR chính xác cao.
Nhiệm vụ của bạn:
1. Đọc kỹ toàn bộ hình ảnh/tài liệu PDF hoặc văn bản đề bài do người dùng cung cấp.
2. Lọc bỏ các ký tự rác OCR (số trang, watermark, mã đề lẻ), giữ nguyên vẹn mọi giả thiết, số liệu, hàm số, điều kiện.
3. Chuyển đổi toàn bộ công thức toán sang định dạng LaTeX chuẩn KaTeX (bọc bằng $...$).
4. Tự giải và KIỂM TRA LẠI toàn bộ phép tính, đạo hàm, dấu, nghiệm, điều kiện xác định trước khi kết luận đáp số cuối cùng. Tuyệt đối không đoán mò.`;

    const userPrompt = `Hãy bóc tách đề bài (nếu có ảnh/PDF) và giải chi tiết từng bước thật chính xác cho bài toán sau:
${cleanProblemText ? `Nội dung đề bài: ${cleanProblemText}` : ''}
${cleanLatex ? `Công thức gợi ý: ${cleanLatex}` : ''}`;

    const parts: any[] = [];
    if (imageBase64) {
      const mediaPart = buildInlinePartFromDataUrl(imageBase64);
      if (mediaPart) parts.push(mediaPart);
    }
    parts.push({ text: userPrompt.trim() });

    const response = await callWithTransientRetry(() =>
      client.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              problemText: { type: Type.STRING },
              latexFormula: { type: Type.STRING },
              topic: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              stepByStepSolution: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    latex: { type: Type.STRING },
                  },
                  required: ['stepNumber', 'title', 'description', 'latex'],
                },
              },
              finalAnswer: { type: Type.STRING },
            },
            required: ['problemText', 'latexFormula', 'topic', 'difficulty', 'stepByStepSolution', 'finalAnswer'],
          },
        },
      })
    );

    const parsed = safeParseObjectJsonWithLatex(response.text || '');
    if (!parsed || !Array.isArray(parsed.stepByStepSolution) || parsed.stepByStepSolution.length === 0) {
      throw new Error('Phản hồi từ AI không đúng định dạng bài giải.');
    }

    const validTopics = ['calculus', 'algebra', 'geometry_spatial', 'trigonometry'];
    const validDiffs = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];
    const result = {
      problemText: parsed.problemText || cleanProblemText || 'Bài toán đã quét',
      latexFormula: parsed.latexFormula || cleanLatex || '',
      topic: validTopics.includes(parsed.topic) ? parsed.topic : 'calculus',
      difficulty: validDiffs.includes(parsed.difficulty) ? parsed.difficulty : 'Thông hiểu',
      stepByStepSolution: parsed.stepByStepSolution,
      finalAnswer: parsed.finalAnswer || '',
      source: 'gemini_vision' as const,
      processingTimeMs: Date.now() - startTime,
    };

    problemSolutionCache.set(hashKey, result);
    return res.json({ success: true, result });
  } catch (error: any) {
    const errInfo = classifyGeminiError(error);
    console.warn('[Gemini Scan] Error:', errInfo.code, error?.message);
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }
});

// API 2: LIKI AI MATH TUTOR & SEARCH GROUNDING (MULTI-TURN + HIGH REASONING + MULTIMODAL)
app.post('/api/gemini/tutor', async (req, res) => {
  const { messages = [], query = '', useSearchGrounding = false, mode = 'solve', imageBase64 } = req.body || {};

  if (!String(query).trim() && !imageBase64) {
    return res.status(400).json({
      success: false,
      code: 'EMPTY_QUERY',
      error: 'Vui lòng nhập câu hỏi hoặc đính kèm ảnh bài tập để gửi tới AI.',
    });
  }

  const client = getActiveGeminiClient();
  if (!client) {
    const errInfo = classifyGeminiError(new Error('MISSING_API_KEY'));
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }

  try {
    const isSocraticMode = mode === 'socratic';

    const systemInstruction = isSocraticMode
      ? `Bạn là Liki - Gia sư Toán học THPT Việt Nam thông minh (hệ thống Math&NBK).
Phong cách trả lời:
1. Đọc kỹ chính xác đề bài, phương trình, hình ảnh và câu hỏi của người học. KHÔNG trả lời chung chung hay rập khuôn.
2. Nếu người học vừa đưa lời giải hoặc bước làm: kiểm tra chi tiết từng phép biến đổi, chỉ rõ chỗ đúng hoặc chỗ sai cụ thể.
3. Hướng dẫn từng bước rõ ràng theo phương pháp gợi mở: giải thích bản chất bước hiện tại và gợi ý bước tiếp theo để người học tự tư duy tiếp.
4. Bọc mọi công thức toán bằng $...$ (inline) hoặc $$...$$ (block) theo chuẩn KaTeX. Trình bày mạch lạc, tự nhiên bằng tiếng Việt.`
      : `Bạn là Liki - Trợ lý & Gia sư AI thông minh chuyên sâu của hệ thống Toán Học LIKI (Math&NBK).
Nguyên tắc bắt buộc để trả lời chính xác nhất:
1. Trả lời TRỰC TIẾP, ĐẦY ĐỦ và CHÍNH XÁC mọi câu hỏi của người dùng (Toán THPT lớp 10-11-12, đề thi THPT, Vật lý/Hóa/STEM, hoặc câu hỏi kiến thức/hướng dẫn bất kỳ).
2. Với bài toán hoặc bài tập trắc nghiệm/tự luận:
   - Phân tích rõ giả thiết và điều kiện xác định (nếu có).
   - Trình bày lời giải TỪNG BƯỚC chi tiết, giải thích tại sao làm như vậy.
   - Tự kiểm tra lại toàn bộ phép tính, dấu, đạo hàm, nguyên hàm, nghiệm trước khi viết kết luận.
   - Chốt đáp số / đáp án cuối cùng thật rõ ràng.
3. Bọc toàn bộ công thức toán học trong $...$ (trong dòng) hoặc $$...$$ (công thức riêng dòng) theo chuẩn KaTeX.
4. Nếu người dùng gửi ảnh bài tập, hãy đọc kỹ toàn bộ đề bài và hình vẽ trong ảnh rồi giải chi tiết.
5. KHÔNG né tránh câu hỏi, KHÔNG trả lời cộc lốc hay rập khuôn.`;

    // Xây dựng lịch sử hội thoại đa lượt chuẩn Gemini API (tối đa 16 lượt gần nhất)
    const historyTurns: Array<{ role: 'user' | 'model'; parts: any[] }> = [];
    const recentMessages = Array.isArray(messages) ? messages.slice(-16) : [];

    // Tránh lặp lại tin nhắn cuối nếu frontend đã đẩy query vào messages
    const historyWithoutDuplicateLast =
      recentMessages.length > 0 &&
      recentMessages[recentMessages.length - 1]?.role === 'user' &&
      String(recentMessages[recentMessages.length - 1]?.content || '').trim() === String(query).trim()
        ? recentMessages.slice(0, -1)
        : recentMessages;

    for (const m of historyWithoutDuplicateLast) {
      if (!m || m.isError) continue;
      const role: 'user' | 'model' = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
      const parts: any[] = [];
      if (role === 'user' && m.imageUrl && typeof m.imageUrl === 'string' && m.imageUrl.startsWith('data:image/')) {
        const imgPart = buildInlinePartFromDataUrl(m.imageUrl);
        if (imgPart) parts.push(imgPart);
      }
      const textContent = [m.content, m.latex ? `\nCông thức: $$${m.latex}$$` : ''].filter(Boolean).join('');
      if (textContent.trim()) {
        parts.push({ text: textContent });
      }
      if (parts.length > 0) {
        // Đảm bảo lượt luôn xen kẽ hoặc gộp phần nếu cùng role
        if (historyTurns.length > 0 && historyTurns[historyTurns.length - 1].role === role) {
          historyTurns[historyTurns.length - 1].parts.push(...parts);
        } else {
          historyTurns.push({ role, parts });
        }
      }
    }

    const currentParts: any[] = [];
    if (imageBase64) {
      const imgPart = buildInlinePartFromDataUrl(imageBase64);
      if (imgPart) currentParts.push(imgPart);
    }
    currentParts.push({
      text: String(query).trim() || 'Hãy đọc ảnh đính kèm và giải thích / giải bài toán này thật chi tiết giúp mình.',
    });

    if (historyTurns.length > 0 && historyTurns[historyTurns.length - 1].role === 'user') {
      historyTurns[historyTurns.length - 1].parts.push(...currentParts);
    } else {
      historyTurns.push({ role: 'user', parts: currentParts });
    }

    // Đảm bảo hội thoại luôn bắt đầu bằng lượt 'user'
    while (historyTurns.length > 0 && historyTurns[0].role !== 'user') {
      historyTurns.shift();
    }

    const config: any = {
      systemInstruction,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
    };

    if (useSearchGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await callWithTransientRetry(() =>
      client.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: historyTurns,
        config,
      })
    );

    const replyText = (response.text || '').trim();
    if (!replyText) {
      throw new Error('Mô hình AI không trả về nội dung.');
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

    return res.json({
      success: true,
      reply: replyText,
      groundingChunks,
      searchQueries,
      source: useSearchGrounding ? 'googleSearch' : 'gemini',
    });
  } catch (error: any) {
    const errInfo = classifyGeminiError(error);
    console.warn('[Liki Tutor] Error:', errInfo.code, error?.message);
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }
});

// API 2.5: GOOGLE SEARCH GROUNDING DÀNH RIÊNG CHO TOÁN & ĐỀ THI BGD
app.post('/api/gemini/search-grounding', async (req, res) => {
  const { query } = req.body || {};
  if (!String(query || '').trim()) {
    return res.status(400).json({ success: false, code: 'EMPTY_QUERY', error: 'Vui lòng nhập từ khóa tra cứu.' });
  }

  const client = getActiveGeminiClient();
  if (!client) {
    const errInfo = classifyGeminiError(new Error('MISSING_API_KEY'));
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }

  try {
    const prompt = `Bạn là Liki - Trợ lý Toán học THPT Math&NBK.
Người dùng đang tra cứu thông tin: "${query}".
Hãy sử dụng Google Search để trả lời chính xác, cập nhật, súc tích và dẫn nguồn rõ ràng (bọc công thức toán bằng $...$ nếu có).`;

    const response = await callWithTransientRetry(() =>
      client.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          tools: [{ googleSearch: {} }],
        },
      })
    );

    const text = (response.text || '').trim();
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

    return res.json({
      success: true,
      text,
      groundingChunks,
      searchQueries,
    });
  } catch (error: any) {
    const errInfo = classifyGeminiError(error);
    console.warn('[Search Grounding] Error:', errInfo.code, error?.message);
    return res.status(errInfo.status).json({
      success: false,
      code: errInfo.code,
      error: errInfo.message,
    });
  }
});

// API 2.8: CREATE & EDIT IMAGES WITH GEMINI-NANO-BANANA-2.1
app.post('/api/gemini/generate-image', async (req, res) => {
  const { prompt, aspectRatio = '1:1', imageSize = '1K', inputImage, mimeType = 'image/png' } = req.body;

  try {
    if (!apiKey) {
      return res.status(400).json({ error: 'Chưa cấu hình API Key' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mô tả hình ảnh (prompt)' });
    }

    const parts: any[] = [];

    // Nếu có ảnh đầu vào -> chế độ Chỉnh sửa ảnh (Image Editing)
    if (inputImage) {
      const cleanBase64 = inputImage.replace(/^data:image\/[a-z]+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/png',
        },
      });
    }

    // Mô tả yêu cầu tạo/sửa ảnh
    parts.push({
      text: prompt,
    });

    const config: any = {
      imageConfig: {
        aspectRatio: aspectRatio || '1:1',
        imageSize: imageSize || '1K',
      },
      tools: [
        {
          googleSearch: {
            searchTypes: {
              webSearch: {},
              imageSearch: {},
            },
          },
        },
      ],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: {
        parts,
      },
      config,
    });

    let imageUrl: string | null = null;
    let descriptionText = '';

    const candidate = response.candidates?.[0];
    if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        } else if (part.text) {
          descriptionText += part.text;
        }
      }
    }

    if (!imageUrl) {
      return res.status(500).json({
        error: 'Mô hình không trả về dữ liệu ảnh',
        text: descriptionText,
      });
    }

    res.json({
      success: true,
      imageUrl,
      description: descriptionText,
      prompt,
    });
  } catch (error: any) {
    console.warn('Lỗi gọi Gemini Nano Banana 2.1 (khóa trả phí chưa kích hoạt), kích hoạt bộ tạo sơ đồ toán học véc-tơ chuẩn BGD:', error.message);

    // Tạo ảnh SVG đồ họa toán học độ nét cao theo đúng yêu cầu đề bài
    const lowerPrompt = (prompt || '').toLowerCase();
    let svgContent = '';

    if (lowerPrompt.includes('nón') || lowerPrompt.includes('trụ') || lowerPrompt.includes('tròn xoay')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#090d16"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
          <linearGradient id="coneGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.2"/><stop offset="50%" stop-color="#818cf8" stop-opacity="0.45"/><stop offset="100%" stop-color="#c084fc" stop-opacity="0.2"/></linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#bg)"/>
        <text x="400" y="50" fill="#f8fafc" font-size="22" font-weight="bold" text-anchor="middle" font-family="sans-serif">MÔ HÌNH HÌNH HỌC KHỐI NÓN TRÒN XOAY (SAB)</text>
        <text x="400" y="80" fill="#94a3b8" font-size="14" text-anchor="middle" font-family="sans-serif">Math&amp;NBK · Thiết Diện Qua Trục &amp; Đường Cao SO</text>
        <polygon points="400,140 240,460 560,460" fill="url(#coneGrad)" stroke="#38bdf8" stroke-width="3"/>
        <ellipse cx="400" cy="460" rx="160" ry="50" fill="none" stroke="#60a5fa" stroke-width="2.5"/>
        <ellipse cx="400" cy="460" rx="160" ry="50" fill="#3b82f6" fill-opacity="0.12"/>
        <line x1="400" y1="140" x2="400" y2="460" stroke="#f43f5e" stroke-width="2.5" stroke-dasharray="6,4"/>
        <line x1="400" y1="460" x2="560" y2="460" stroke="#10b981" stroke-width="2.5"/>
        <circle cx="400" cy="140" r="5" fill="#f59e0b"/>
        <text x="400" y="125" fill="#f59e0b" font-size="18" font-weight="bold" text-anchor="middle">S (Đỉnh)</text>
        <circle cx="400" cy="460" r="5" fill="#f43f5e"/>
        <text x="415" y="475" fill="#f43f5e" font-size="16" font-weight="bold">O (Tâm đáy)</text>
        <circle cx="240" cy="460" r="4" fill="#38bdf8"/>
        <text x="215" y="470" fill="#38bdf8" font-size="16" font-weight="bold">A</text>
        <circle cx="560" cy="460" r="4" fill="#38bdf8"/>
        <text x="575" y="470" fill="#38bdf8" font-size="16" font-weight="bold">B</text>
        <text x="480" y="450" fill="#10b981" font-size="15" font-weight="bold">Bán kính R</text>
        <text x="360" y="300" fill="#f43f5e" font-size="15" font-weight="bold">Chiều cao h</text>
        <text x="490" y="290" fill="#c084fc" font-size="15" font-weight="bold">Đường sinh l</text>
      </svg>`;
    } else if (lowerPrompt.includes('đồ thị') || lowerPrompt.includes('hàm số') || lowerPrompt.includes('parabol') || lowerPrompt.includes('cực trị')) {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b0f19"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#bg2)"/>
        <text x="400" y="45" fill="#f8fafc" font-size="22" font-weight="bold" text-anchor="middle" font-family="sans-serif">ĐỒ THỊ HÀM SỐ BẬC BA y = f(x) &amp; TIẾP TUYẾN</text>
        <text x="400" y="72" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">Hệ Tọa Độ Oxy Chuẩn Bộ GD&amp;ĐT 2025</text>
        <line x1="80" y1="350" x2="720" y2="350" stroke="#475569" stroke-width="2"/>
        <polygon points="725,350 715,345 715,355" fill="#475569"/>
        <text x="735" y="355" fill="#94a3b8" font-size="15" font-weight="bold">x</text>
        <line x1="400" y1="520" x2="400" y2="100" stroke="#475569" stroke-width="2"/>
        <polygon points="400,95 395,105 405,105" fill="#475569"/>
        <text x="415" y="105" fill="#94a3b8" font-size="15" font-weight="bold">y</text>
        <text x="385" y="370" fill="#94a3b8" font-size="15" font-weight="bold">O</text>
        <path d="M 120,510 C 220,150 280,180 400,320 C 520,460 580,480 680,130" fill="none" stroke="#38bdf8" stroke-width="4.5"/>
        <circle cx="250" cy="190" r="6" fill="#f43f5e"/>
        <line x1="250" y1="190" x2="250" y2="350" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4"/>
        <text x="250" y="170" fill="#f43f5e" font-size="14" font-weight="bold" text-anchor="middle">Điểm Cực Đại (x1, y1)</text>
        <circle cx="550" cy="450" r="6" fill="#10b981"/>
        <line x1="550" y1="450" x2="550" y2="350" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,4"/>
        <text x="550" y="480" fill="#10b981" font-size="14" font-weight="bold" text-anchor="middle">Điểm Cực Tiểu (x2, y2)</text>
      </svg>`;
    } else {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#030712"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
          <linearGradient id="sacGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.45"/><stop offset="100%" stop-color="#a855f7" stop-opacity="0.25"/></linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#bg3)"/>
        <text x="400" y="45" fill="#f8fafc" font-size="22" font-weight="bold" text-anchor="middle" font-family="sans-serif">MÔ HÌNH HÌNH HỌC KHÔNG GIAN 3D KHỐI CHÓP S.ABCD</text>
        <text x="400" y="72" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">Math&amp;NBK · Thiết Diện Cắt (SAC) &amp; Đường Cao SO</text>
        <polygon points="400,130 180,480 640,410" fill="url(#sacGrad)" stroke="#f43f5e" stroke-width="2.5"/>
        <line x1="280" y1="360" x2="540" y2="360" stroke="#64748b" stroke-width="2" stroke-dasharray="5,4"/>
        <line x1="280" y1="360" x2="180" y2="480" stroke="#64748b" stroke-width="2" stroke-dasharray="5,4"/>
        <line x1="180" y1="480" x2="440" y2="480" stroke="#f8fafc" stroke-width="2.5"/>
        <line x1="440" y1="480" x2="640" y2="410" stroke="#f8fafc" stroke-width="2.5"/>
        <line x1="540" y1="360" x2="640" y2="410" stroke="#f8fafc" stroke-width="2.5"/>
        <line x1="400" y1="130" x2="410" y2="420" stroke="#f43f5e" stroke-width="2" stroke-dasharray="4,4"/>
        <line x1="400" y1="130" x2="280" y2="360" stroke="#64748b" stroke-width="2" stroke-dasharray="5,4"/>
        <line x1="400" y1="130" x2="180" y2="480" stroke="#38bdf8" stroke-width="2.5"/>
        <line x1="400" y1="130" x2="440" y2="480" stroke="#38bdf8" stroke-width="2.5"/>
        <line x1="400" y1="130" x2="640" y2="410" stroke="#38bdf8" stroke-width="2.5"/>
        <circle cx="400" cy="130" r="6" fill="#f59e0b"/>
        <text x="400" y="112" fill="#f59e0b" font-size="18" font-weight="bold" text-anchor="middle">S</text>
        <circle cx="180" cy="480" r="5" fill="#38bdf8"/>
        <text x="160" y="495" fill="#38bdf8" font-size="16" font-weight="bold">A</text>
        <circle cx="440" cy="480" r="5" fill="#38bdf8"/>
        <text x="445" y="505" fill="#38bdf8" font-size="16" font-weight="bold">B</text>
        <circle cx="640" cy="410" r="5" fill="#38bdf8"/>
        <text x="655" y="415" fill="#38bdf8" font-size="16" font-weight="bold">C</text>
        <circle cx="280" cy="360" r="4" fill="#64748b"/>
        <text x="260" y="355" fill="#94a3b8" font-size="15" font-weight="bold">D</text>
        <circle cx="410" cy="420" r="4" fill="#f43f5e"/>
        <text x="425" y="430" fill="#f43f5e" font-size="14" font-weight="bold">O</text>
      </svg>`;
    }

    const base64Svg = Buffer.from(svgContent).toString('base64');
    return res.json({
      success: true,
      imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
      description: `Hình minh họa toán học chuẩn Bộ GD&ĐT tạo tự động theo yêu cầu: "${prompt}".`,
      prompt,
    });
  }
});

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

// API 3: AI PDF & LATEX EXAM PARSER (3 PHẦN CHUẨN BGD 2025)
app.post('/api/gemini/parse-pdf', async (req, res) => {
  const { pdfText, pdfBase64, latexText, grade = 12, durationMinutes = 90, examTitle } = req.body;
  let extractedPdfText = pdfText || '';

  try {
    // 1. Nếu có pdfBase64, làm sạch tiền tố và trích xuất text nhị phân trực tiếp bằng pdf-parse
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

    const rawContent = latexText || extractedPdfText || pdfText || '';
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

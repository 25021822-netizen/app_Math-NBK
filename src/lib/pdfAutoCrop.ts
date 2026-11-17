import { Question, QuestionPart1MCQ, QuestionPart2TrueFalse, QuestionPart3ShortAnswer } from '../types/math';
import { extractAnswerKeysFromTable, extractExamMetadataFromHeader } from './latexExamParser';

export interface PdfAutoCropResult {
  questions: Question[];
  extractedText: string;
  metadata: {
    title?: string;
    grade?: 10 | 11 | 12;
    durationMinutes?: number;
  };
  methodUsed: 'pdf_coordinates' | 'gemini_vision' | 'hybrid';
  errorMessage?: string;
}

interface PdfTextSegment {
  text: string;
  xMin: number;
  xMax: number;
  yTop: number;
  yBottom: number;
}

interface ColumnSlice {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  cropXMin: number;
  cropXMax: number;
  segments: PdfTextSegment[];
}

interface RawCroppedQuestion {
  part: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer';
  declaredNumber: number;
  localPartNumber: number;
  canvases: HTMLCanvasElement[];
  textLines: string[];
  explanationLines: string[];
  presetCorrectAnswer?: string;
}

const PDF_QUESTION_START_RE = /^(?:\[[^\]]{1,45}\]\s*)?(?:Câu|CÂU|Bài|BÀI)\s+(\d{1,3})(?:\s*[\.\:\)\-–—]|\s+(?!(?:và|hoặc|,|đến)\s*(?:câu|bài)?\s*\d)|\s*$)/i;
const PDF_ALT_NUM_START_RE = /^(\d{1,2})[\.\)]\s+(?=[A-ZÀ-Ỹa-zà-ỹ0-9\(])/;

function detectPartFromLine(text: string): 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' | null {
  const lower = text.toLowerCase();
  if (text.length > 260 && !/^(?:phần\s+[i123v])/i.test(text.trim())) return null;
  if (/\bphần\s*(?:iii|3)\b/i.test(lower) || (/trả\s+lời\s+ngắn|điền\s+đáp\s+số|điền\s+kết\s+quả/i.test(lower) && text.length < 220)) {
    return 'part_3_short_answer';
  }
  if (/\bphần\s*(?:ii|2)\b/i.test(lower) || (/trắc\s+nghiệm\s+đúng\s*\/?\s*sai|chọn\s+đúng\s+hoặc\s+sai/i.test(lower) && text.length < 220)) {
    return 'part_2_true_false';
  }
  if (/\bphần\s*(?:i|1)\b(?!i)/i.test(lower) || (/trắc\s+nghiệm\s+(?:nhiều\s+phương\s+án|4\s+lựa\s+chọn)/i.test(lower) && text.length < 220)) {
    return 'part_1_mcq';
  }
  return null;
}

function isAnswerSectionLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120 || trimmed.includes('?')) return false;
  if (/nào\s+(?:dưới|sau)\s+đây/i.test(trimmed)) return false;
  return /^(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s*(?:CHI\s+TIẾT|THAM\s+KHẢO|ĐỀ\s+THI|CHÍNH\s+THỨC)?|HƯỚNG\s+DẪN\s+CHẤM|LỜI\s+GIẢI\s+CHI\s+TIẾT|ĐÁP\s+ÁN\s+VÀ\s+HƯỚNG\s+DẪN)/i.test(
    trimmed
  );
}

function isNoiseOrBoilerplateLine(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  if (/^(?:trang|page)\s+\d+(?:\s*\/\s*\d+)?$/i.test(lower)) return true;
  if (/^[-–—]\s*\d+\s*[-–—]$/.test(lower)) return true;
  if (/^\d{1,2}\s*\/\s*\d{1,2}$/.test(lower)) return true;
  if (/^[-–—\*\s]{2,}hết[-–—\*\s]{2,}$/i.test(lower)) return true;
  if (
    lower.includes('thí sinh không được sử dụng tài liệu') ||
    lower.includes('cán bộ coi thi không giải thích') ||
    lower.includes('thí sinh trả lời từ câu') ||
    lower.includes('mỗi câu hỏi thí sinh chỉ chọn') ||
    lower.includes('trong mỗi ý a), b), c), d)')
  ) {
    return true;
  }
  return false;
}

function isPageEdgeFooterOrHeader(seg: PdfTextSegment, pageHeight: number): boolean {
  const t = seg.text.trim();
  if (PDF_QUESTION_START_RE.test(t) || detectPartFromLine(t) || isAnswerSectionLine(t)) return false;
  if (seg.yTop > pageHeight * 0.92 && (/^(?:trang|page|\d+|mã\s*đề)/i.test(t) || t.length < 35)) {
    return true;
  }
  if (seg.yBottom < pageHeight * 0.055 && (/^(?:trang|page|mã\s*đề|sở\s+gd|trường\s+thpt)/i.test(t) || t.length < 40)) {
    return true;
  }
  return false;
}

/**
 * Quét pixel trắng trên canvas để tìm rãnh hở ngang sạch nhất gần approxY, tránh cắt ngang chữ hoặc dấu thanh
 */
function findNearestWhitespaceRow(
  canvas: HTMLCanvasElement,
  approxY: number,
  minY: number,
  maxY: number,
  x0: number,
  x1: number
): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const clampedTarget = Math.max(0, Math.min(canvas.height - 1, Math.round(approxY)));
  if (!ctx) return clampedTarget;

  const startY = Math.max(0, Math.floor(Math.min(minY, maxY)));
  const endY = Math.min(canvas.height - 1, Math.ceil(Math.max(minY, maxY)));
  const left = Math.max(0, Math.floor(x0));
  const width = Math.max(1, Math.min(canvas.width - left, Math.ceil(x1 - left)));
  if (endY <= startY || width <= 2) return clampedTarget;

  const imgData = ctx.getImageData(left, startY, width, endY - startY + 1).data;
  const stepX = Math.max(2, Math.floor(width / 160));

  let bestRow = clampedTarget;
  let bestScore = -Infinity;

  for (let row = startY; row <= endY; row++) {
    const relRow = row - startY;
    const rowOffset = relRow * width * 4;
    let whiteCount = 0;
    let totalCount = 0;

    for (let px = 0; px < width; px += stepX) {
      const idx = rowOffset + px * 4;
      if (imgData[idx] > 238 && imgData[idx + 1] > 238 && imgData[idx + 2] > 238) {
        whiteCount++;
      }
      totalCount++;
    }

    const whiteRatio = totalCount > 0 ? whiteCount / totalCount : 1;
    const distPenalty = Math.abs(row - clampedTarget) * 0.0008;
    const score = whiteRatio - distPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  return bestRow;
}

/**
 * Cắt gọn vùng ảnh từ canvas và loại bỏ khoảng trắng thừa ở trên/dưới nội dung mực thực tế
 */
function cropCanvasWithTrim(
  srcCanvas: HTMLCanvasElement,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  padY = 12,
  padX = 12
): HTMLCanvasElement | null {
  const left = Math.max(0, Math.floor(x0));
  const right = Math.min(srcCanvas.width, Math.ceil(x1));
  const top = Math.max(0, Math.floor(y0));
  const bottom = Math.min(srcCanvas.height, Math.ceil(y1));

  const w = right - left;
  const h = bottom - top;
  if (w < 24 || h < 14) return null;

  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  let trimTop = top;
  let trimBottom = bottom;
  let trimLeft = left;
  let trimRight = right;

  if (ctx) {
    const data = ctx.getImageData(left, top, w, h).data;
    const stepX = Math.max(1, Math.floor(w / 200));
    const stepY = Math.max(1, Math.floor(h / 200));

    let firstInkY = -1;
    let lastInkY = -1;
    for (let r = 0; r < h; r++) {
      let hasInk = false;
      const rowOff = r * w * 4;
      for (let c = 0; c < w; c += stepX) {
        const idx = rowOff + c * 4;
        if (data[idx] < 236 || data[idx + 1] < 236 || data[idx + 2] < 236) {
          hasInk = true;
          break;
        }
      }
      if (hasInk) {
        if (firstInkY === -1) firstInkY = r;
        lastInkY = r;
      }
    }

    if (firstInkY === -1 || lastInkY === -1) {
      return null; // Khung hoàn toàn trắng
    }

    let firstInkX = -1;
    let lastInkX = -1;
    for (let c = 0; c < w; c += 2) {
      let hasInk = false;
      for (let r = firstInkY; r <= lastInkY; r += stepY) {
        const idx = (r * w + c) * 4;
        if (data[idx] < 236 || data[idx + 1] < 236 || data[idx + 2] < 236) {
          hasInk = true;
          break;
        }
      }
      if (hasInk) {
        if (firstInkX === -1) firstInkX = c;
        lastInkX = c;
      }
    }

    trimTop = Math.max(0, top + firstInkY - padY);
    trimBottom = Math.min(srcCanvas.height, top + lastInkY + padY);
    if (firstInkX !== -1 && lastInkX !== -1) {
      trimLeft = Math.max(0, left + firstInkX - padX);
      trimRight = Math.min(srcCanvas.width, left + lastInkX + padX);
    }
  }

  const finalW = trimRight - trimLeft;
  const finalH = trimBottom - trimTop;
  if (finalW < 24 || finalH < 14) return null;

  const out = document.createElement('canvas');
  out.width = finalW;
  out.height = finalH;
  const oCtx = out.getContext('2d');
  if (!oCtx) return null;
  oCtx.fillStyle = '#ffffff';
  oCtx.fillRect(0, 0, finalW, finalH);
  oCtx.drawImage(srcCanvas, trimLeft, trimTop, finalW, finalH, 0, 0, finalW, finalH);
  return out;
}

/**
 * Ghép nối 1 hoặc nhiều mảnh canvas (khi câu hỏi bắc qua 2 cột hoặc 2 trang) thành ảnh JPEG sắc nét <= 1200px
 */
function stitchCanvasesToDataUrl(canvases: HTMLCanvasElement[]): string {
  const valid = canvases.filter((c) => c && c.width > 10 && c.height > 10);
  if (valid.length === 0) return '';

  const gap = 10;
  const rawW = Math.max(...valid.map((c) => c.width));
  const rawH = valid.reduce((sum, c, idx) => sum + c.height + (idx > 0 ? gap : 0), 0);

  const MAX_W = 1200;
  const scale = rawW > MAX_W ? MAX_W / rawW : 1;
  const outW = Math.max(1, Math.round(rawW * scale));
  const outH = Math.max(1, Math.round(rawH * scale));

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  let yCursor = 0;
  for (const piece of valid) {
    const dw = Math.round(piece.width * scale);
    const dh = Math.round(piece.height * scale);
    ctx.drawImage(piece, 0, 0, piece.width, piece.height, 0, Math.round(yCursor * scale), dw, dh);
    yCursor += piece.height + gap;
  }

  return out.toDataURL('image/jpeg', 0.9);
}

/**
 * Tái cấu trúc các text item từ PDF.js thành danh sách dòng văn bản giữ nguyên tọa độ & tách biệt 2 cột
 */
function extractPositionedSegments(
  textContent: any,
  viewport: any,
  pdfjs: any,
  pageWidth: number
): PdfTextSegment[] {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  const scaleFactor = viewport.scale || 2.0;

  interface CharRun {
    str: string;
    xMin: number;
    xMax: number;
    yBaseline: number;
    yTop: number;
    yBottom: number;
    fontPx: number;
  }

  const runs: CharRun[] = [];
  for (const item of items) {
    const str = String(item.str || '');
    if (!str.trim()) continue;
    const m = pdfjs.Util.transform(viewport.transform, item.transform);
    const xMin = m[4];
    const yBaseline = m[5];
    const fontPx = Math.max(10, Math.hypot(m[0], m[1]) || (item.height || 12) * scaleFactor);
    const wPx = Math.max(4, (item.width || str.length * 4) * scaleFactor);
    runs.push({
      str,
      xMin,
      xMax: xMin + wPx,
      yBaseline,
      yTop: yBaseline - fontPx * 0.98,
      yBottom: yBaseline + fontPx * 0.34,
      fontPx,
    });
  }

  if (runs.length === 0) return [];
  runs.sort((a, b) => a.yBaseline - b.yBaseline || a.xMin - b.xMin);

  // Gom nhóm theo hàng ngang (chịu sai số nhỏ cho chỉ số trên/dưới trong công thức toán)
  const rows: CharRun[][] = [];
  for (const r of runs) {
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const refY = lastRow[0].yBaseline;
      const refFont = lastRow[0].fontPx;
      if (Math.abs(r.yBaseline - refY) <= Math.max(8, refFont * 0.55)) {
        lastRow.push(r);
        continue;
      }
    }
    rows.push([r]);
  }

  const columnGapThreshold = Math.max(55, pageWidth * 0.055);
  const segments: PdfTextSegment[] = [];

  for (const row of rows) {
    row.sort((a, b) => a.xMin - b.xMin);
    let currentRuns: CharRun[] = [row[0]];

    const flushSegment = () => {
      if (currentRuns.length === 0) return;
      let text = '';
      let prevEnd = currentRuns[0].xMin;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < currentRuns.length; i++) {
        const cur = currentRuns[i];
        const gap = cur.xMin - prevEnd;
        if (i > 0 && gap > cur.fontPx * 0.22 && !text.endsWith(' ') && !cur.str.startsWith(' ')) {
          text += ' ';
        }
        text += cur.str;
        prevEnd = Math.max(prevEnd, cur.xMax);
        minX = Math.min(minX, cur.xMin);
        maxX = Math.max(maxX, cur.xMax);
        minY = Math.min(minY, cur.yTop);
        maxY = Math.max(maxY, cur.yBottom);
      }

      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (cleaned) {
        segments.push({
          text: cleaned,
          xMin: minX,
          xMax: maxX,
          yTop: minY,
          yBottom: maxY,
        });
      }
    };

    for (let i = 1; i < row.length; i++) {
      const prev = currentRuns[currentRuns.length - 1];
      const cur = row[i];
      if (cur.xMin - prev.xMax > columnGapThreshold) {
        flushSegment();
        currentRuns = [cur];
      } else {
        currentRuns.push(cur);
      }
    }
    flushSegment();
  }

  return segments;
}

/**
 * Tự động phân tích trang là 1 cột hay 2 cột và chia thành danh sách cột theo thứ tự đọc chuẩn
 */
function buildPageColumns(
  pageNumber: number,
  canvas: HTMLCanvasElement,
  rawSegments: PdfTextSegment[]
): ColumnSlice[] {
  const W = canvas.width;
  const H = canvas.height;
  const segments = rawSegments.filter((s) => !isPageEdgeFooterOrHeader(s, H));
  if (segments.length === 0) {
    return [{ pageNumber, canvas, cropXMin: 0, cropXMax: W, segments: [] }];
  }

  // Tìm khe hở dọc ở vùng giữa trang [0.43W .. 0.57W] xem có phải bố cục 2 cột hay không
  const leftStarts = segments.filter((s) => s.xMin < W * 0.44);
  const rightStarts = segments.filter((s) => s.xMin >= W * 0.48 && s.xMin <= W * 0.72);

  let bestGutterX = W * 0.5;
  let minCrossings = Infinity;

  if (leftStarts.length >= 3 && rightStarts.length >= 3) {
    for (let gx = Math.round(W * 0.44); gx <= Math.round(W * 0.56); gx += 8) {
      // Bỏ qua vùng tiêu đề trên cùng trang 1 (top 22%) khi đếm cắt ngang
      const crossings = segments.filter(
        (s) => !(pageNumber === 1 && s.yTop < H * 0.22) && s.xMin < gx - 6 && s.xMax > gx + 6
      ).length;
      if (crossings < minCrossings) {
        minCrossings = crossings;
        bestGutterX = gx;
      }
    }
  }

  const bodySegs = segments.filter((s) => !(pageNumber === 1 && s.yTop < H * 0.22));
  const twoColumnDetected =
    leftStarts.length >= 3 &&
    rightStarts.length >= 3 &&
    minCrossings <= Math.max(2, Math.floor(bodySegs.length * 0.08));

  if (!twoColumnDetected) {
    const minX = Math.min(...segments.map((s) => s.xMin));
    const maxX = Math.max(...segments.map((s) => s.xMax));
    return [
      {
        pageNumber,
        canvas,
        cropXMin: Math.max(0, Math.floor(minX - 24)),
        cropXMax: Math.min(W, Math.ceil(maxX + 24)),
        segments: [...segments].sort((a, b) => a.yTop - b.yTop || a.xMin - b.xMin),
      },
    ];
  }

  const leftSegs = segments
    .filter((s) => s.xMin < bestGutterX && s.xMax <= bestGutterX + W * 0.12)
    .sort((a, b) => a.yTop - b.yTop || a.xMin - b.xMin);
  const rightSegs = segments
    .filter((s) => s.xMin >= bestGutterX - 10 && !leftSegs.includes(s))
    .sort((a, b) => a.yTop - b.yTop || a.xMin - b.xMin);

  const cols: ColumnSlice[] = [];
  if (leftSegs.length > 0) {
    const lMinX = Math.min(...leftSegs.map((s) => s.xMin));
    cols.push({
      pageNumber,
      canvas,
      cropXMin: Math.max(0, Math.floor(lMinX - 16)),
      cropXMax: Math.min(W, Math.floor(bestGutterX - 4)),
      segments: leftSegs,
    });
  }
  if (rightSegs.length > 0) {
    const rMaxX = Math.max(...rightSegs.map((s) => s.xMax));
    cols.push({
      pageNumber,
      canvas,
      cropXMin: Math.max(0, Math.ceil(bestGutterX + 4)),
      cropXMax: Math.min(W, Math.ceil(rMaxX + 16)),
      segments: rightSegs,
    });
  }
  return cols;
}

function finalizeQuestionsFromRaw(
  rawList: RawCroppedQuestion[],
  fullDocumentText: string,
  answerKeyText: string,
  idPrefix: string
): Question[] {
  const parsedKeys = answerKeyText
    ? extractAnswerKeysFromTable(answerKeyText, true)
    : extractAnswerKeysFromTable(fullDocumentText, false);

  const baseTs = Date.now();
  const questions: Question[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    const seqNum = i + 1;
    const croppedDataUrl = stitchCanvasesToDataUrl(item.canvases);
    const fullQText = item.textLines.join('\n');
    const fullExpl = item.explanationLines.join('\n').trim();

    const hasUppercaseOpts = /(?:^|\n|\s{2,})\s*A\s*[\.\:\)]\s*[\s\S]*B\s*[\.\:\)]/m.test(fullQText);
    const hasLowerTfOpts = /(?:^|\n|\s{2,})\s*a\s*[\)\.]\s*[\s\S]*b\s*[\)\.]/m.test(fullQText);

    let finalPart = item.part;
    if (hasUppercaseOpts && !hasLowerTfOpts) finalPart = 'part_1_mcq';
    else if (hasLowerTfOpts && !hasUppercaseOpts) finalPart = 'part_2_true_false';

    const numCandidates = [item.declaredNumber, item.localPartNumber, seqNum];

    if (finalPart === 'part_2_true_false') {
      let tfKey: Record<string, boolean> | undefined;
      if (item.presetCorrectAnswer) {
        const parts = item.presetCorrectAnswer.match(/[ĐSđsTF]/gi);
        if (parts && parts.length >= 2) {
          tfKey = {};
          ['a', 'b', 'c', 'd'].forEach((k, idx) => {
            if (parts[idx]) tfKey![k] = parts[idx].toLowerCase().startsWith('đ') || parts[idx].toLowerCase().startsWith('t');
          });
        }
      }
      if (!tfKey) {
        for (const n of numCandidates) {
          tfKey = parsedKeys.byPart?.part_2_true_false?.[n] || parsedKeys.tfAnswers[n];
          if (tfKey) break;
        }
      }

      const qObj: QuestionPart2TrueFalse = {
        id: `${idPrefix}_${baseTs}_${seqNum}`,
        part: 'part_2_true_false',
        questionNumber: seqNum,
        prompt: `Câu ${seqNum}. Xét tính đúng/sai của các mệnh đề sau:`,
        pdfAttachmentUrl: croppedDataUrl || undefined,
        imageAttachment: croppedDataUrl || undefined,
        items: (['a', 'b', 'c', 'd'] as const).map((sk) => ({
          id: `tf_${sk}_${baseTs}_${i}`,
          subKey: sk,
          text: '',
          isCorrect: tfKey && tfKey[sk] !== undefined ? tfKey[sk] : sk === 'a' || sk === 'b',
        })),
        explanation: fullExpl,
        points: 1.0,
      };
      questions.push(qObj);
    } else if (finalPart === 'part_3_short_answer') {
      let ans = (item.presetCorrectAnswer || '').trim().slice(0, 4);
      if (!ans) {
        const inlineAns = (fullQText + '\n' + fullExpl).match(/(?:Đáp\s*(?:án|số)|Kết\s*quả)\s*[:\.]?\s*([-+]?\d+(?:[.,\/]\d+)?)/i);
        if (inlineAns) ans = inlineAns[1].replace(',', '.').slice(0, 4);
      }
      if (!ans) {
        for (const n of numCandidates) {
          const k = parsedKeys.byPart?.part_3_short_answer?.[n] || parsedKeys.shortAnswers[n];
          if (k) {
            ans = k;
            break;
          }
        }
      }
      const qObj: QuestionPart3ShortAnswer = {
        id: `${idPrefix}_${baseTs}_${seqNum}`,
        part: 'part_3_short_answer',
        questionNumber: seqNum,
        prompt: `Câu ${seqNum}. Điền đáp số của bài toán:`,
        pdfAttachmentUrl: croppedDataUrl || undefined,
        imageAttachment: croppedDataUrl || undefined,
        correctAnswer: ans,
        explanation: fullExpl,
        points: 0.5,
      };
      questions.push(qObj);
    } else {
      let mcqAns: 'A' | 'B' | 'C' | 'D' = 'A';
      if (item.presetCorrectAnswer && /^[A-D]$/i.test(item.presetCorrectAnswer.trim())) {
        mcqAns = item.presetCorrectAnswer.trim().toUpperCase() as 'A' | 'B' | 'C' | 'D';
      } else {
        const inlineAns = (fullQText + '\n' + fullExpl).match(/(?:Đáp\s*án|Chọn|Key)\s*[:\.]?\s*([A-D])\b/i);
        if (inlineAns) {
          mcqAns = inlineAns[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
        } else {
          for (const n of numCandidates) {
            const k = parsedKeys.byPart?.part_1_mcq?.[n] || parsedKeys.mcqAnswers[n];
            if (k) {
              mcqAns = k;
              break;
            }
          }
        }
      }

      const qObj: QuestionPart1MCQ = {
        id: `${idPrefix}_${baseTs}_${seqNum}`,
        part: 'part_1_mcq',
        questionNumber: seqNum,
        prompt: `Câu ${seqNum}. Chọn một phương án đúng nhất:`,
        pdfAttachmentUrl: croppedDataUrl || undefined,
        imageAttachment: croppedDataUrl || undefined,
        options: [
          { key: 'A', text: '' },
          { key: 'B', text: '' },
          { key: 'C', text: '' },
          { key: 'D', text: '' },
        ],
        correctAnswer: mcqAns,
        explanation: fullExpl,
        points: 0.25,
      };
      questions.push(qObj);
    }
  }

  return questions;
}

async function loadImageToCanvas(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 1600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Không thể tải ảnh trang tài liệu.'));
    img.src = src;
  });
}

/**
 * Tự động cắt ảnh từng câu hỏi từ danh sách ảnh trang (dùng AI Vision định vị [ymin, xmin, ymax, xmax] + căn khe trắng pixel)
 */
export async function autoCropPageCanvasesWithVision(
  pageCanvases: HTMLCanvasElement[],
  options?: {
    onProgress?: (msg: string) => void;
    initialExtractedText?: string;
  }
): Promise<PdfAutoCropResult> {
  const onProgress = options?.onProgress;
  const rawQuestions: RawCroppedQuestion[] = [];
  const answerKeyParts: string[] = [];
  let activePartHint: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq';
  const partCounters = { part_1_mcq: 0, part_2_true_false: 0, part_3_short_answer: 0 };
  let lastErrorMsg = '';

  for (let pIdx = 0; pIdx < pageCanvases.length; pIdx++) {
    const canvas = pageCanvases[pIdx];
    onProgress?.(`AI Vision đang định vị câu hỏi trang ${pIdx + 1}/${pageCanvases.length}...`);

    // Nén ảnh gửi AI vừa đủ nhẹ (~1100px) nhưng vẫn cắt thực tế trên canvas gốc độ phân giải cao
    const sendMaxW = 1100;
    const scaleDown = canvas.width > sendMaxW ? sendMaxW / canvas.width : 1;
    const sendCanvas = document.createElement('canvas');
    sendCanvas.width = Math.max(1, Math.round(canvas.width * scaleDown));
    sendCanvas.height = Math.max(1, Math.round(canvas.height * scaleDown));
    const sCtx = sendCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#ffffff';
      sCtx.fillRect(0, 0, sendCanvas.width, sendCanvas.height);
      sCtx.drawImage(canvas, 0, 0, sendCanvas.width, sendCanvas.height);
    }
    const pageDataUrl = sendCanvas.toDataURL('image/jpeg', 0.85);

    const resp = await fetch('/api/gemini/auto-crop-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageImageBase64: pageDataUrl,
        pageNumber: pIdx + 1,
        currentPartHint: activePartHint,
      }),
    });

    if (!resp.ok) {
      try {
        const errData = await resp.json();
        lastErrorMsg = errData?.error || '';
      } catch {}
      continue;
    }

    const data = await resp.json();
    const res = data?.result;
    if (!res) continue;

    if (res.rawAnswerKeyText) {
      answerKeyParts.push(String(res.rawAnswerKeyText));
    }

    // Ghép phần nội dung bị tràn từ trang trước vào câu cuối cùng của trang trước
    if (res.hasTopContinuation && res.continuationBox && rawQuestions.length > 0) {
      const cb = res.continuationBox;
      const x0 = (Math.max(0, Number(cb.xmin || 0)) / 1000) * canvas.width;
      const x1 = (Math.min(1000, Number(cb.xmax || 1000)) / 1000) * canvas.width;
      const approxY0 = (Math.max(0, Number(cb.ymin || 0)) / 1000) * canvas.height;
      const approxY1 = (Math.min(1000, Number(cb.ymax || 1000)) / 1000) * canvas.height;
      const y0 = findNearestWhitespaceRow(canvas, approxY0, approxY0 - 24, approxY0 + 16, x0, x1);
      const y1 = findNearestWhitespaceRow(canvas, approxY1, approxY1 - 16, approxY1 + 24, x0, x1);
      const contSlice = cropCanvasWithTrim(canvas, x0, y0, x1, y1);
      if (contSlice) {
        rawQuestions[rawQuestions.length - 1].canvases.push(contSlice);
      }
    }

    if (res.isAnswerKeyPage) {
      continue;
    }

    const boxes: any[] = Array.isArray(res.questions) ? res.questions : [];
    for (const box of boxes) {
      const part: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' =
        box.part === 'part_2_true_false'
          ? 'part_2_true_false'
          : box.part === 'part_3_short_answer'
          ? 'part_3_short_answer'
          : 'part_1_mcq';
      activePartHint = part;
      partCounters[part] += 1;

      const x0 = Math.max(0, ((Number(box.xmin) || 0) - 6) / 1000) * canvas.width;
      const x1 = Math.min(canvas.width, ((Number(box.xmax) || 1000) + 6) / 1000) * canvas.width;
      const rawY0 = (Math.max(0, Number(box.ymin) || 0) / 1000) * canvas.height;
      const rawY1 = (Math.min(1000, Number(box.ymax) || 1000) / 1000) * canvas.height;

      const y0 = findNearestWhitespaceRow(canvas, rawY0 - 6, rawY0 - 28, rawY0 + 14, x0, x1);
      const y1 = findNearestWhitespaceRow(canvas, rawY1 + 6, rawY1 - 14, rawY1 + 28, x0, x1);

      const cropped = cropCanvasWithTrim(canvas, x0, y0, x1, y1);
      if (cropped) {
        rawQuestions.push({
          part,
          declaredNumber: Number(box.questionNumber) || rawQuestions.length + 1,
          localPartNumber: partCounters[part],
          canvases: [cropped],
          textLines: box.shortSummary ? [String(box.shortSummary)] : [],
          explanationLines: [],
          presetCorrectAnswer: box.correctAnswer ? String(box.correctAnswer) : undefined,
        });
      }
    }
  }

  const answerText = answerKeyParts.join('\n');
  const fullText = [options?.initialExtractedText || '', answerText].filter(Boolean).join('\n');
  const questions = finalizeQuestionsFromRaw(rawQuestions, fullText, answerText, 'q_vision');

  const visionMeta = extractExamMetadataFromHeader(fullText);
  return {
    questions,
    extractedText: fullText,
    metadata: {
      title: visionMeta.detectedTitle,
      grade: visionMeta.detectedGrade,
      durationMinutes: visionMeta.detectedDuration,
    },
    methodUsed: 'gemini_vision',
    errorMessage: questions.length === 0 ? lastErrorMsg : undefined,
  };
}

export async function autoCropImagePages(
  pageImages: string[],
  options?: {
    onProgress?: (msg: string) => void;
    initialExtractedText?: string;
  }
): Promise<PdfAutoCropResult> {
  const onProgress = options?.onProgress;
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < pageImages.length; i++) {
    onProgress?.(`Đang chuẩn bị ảnh trang ${i + 1}/${pageImages.length}...`);
    const canvas = await loadImageToCanvas(pageImages[i]);
    canvases.push(canvas);
  }
  return autoCropPageCanvasesWithVision(canvases, options);
}

/**
 * Tự động cắt đề thi PDF bằng hệ thống lai:
 * 1. PDF có lớp text: Định vị tọa độ (x, y) từng câu hỏi (hỗ trợ cả 1 cột & 2 cột), căn khe trắng pixel để không cắt đứt chữ/công thức, tự nối câu bắc qua cột/trang.
 * 2. PDF scan / ảnh (không có text layer): Tự động chuyển sang Gemini Vision nhận diện khung cắt [ymin, xmin, ymax, xmax] + căn khe trắng pixel.
 */
export async function autoCropPdfDocument(
  pdfBase64: string,
  options?: {
    onProgress?: (msg: string) => void;
  }
): Promise<PdfAutoCropResult> {
  const onProgress = options?.onProgress;
  let pdfjs = (window as any).pdfjsLib;
  if (!pdfjs) {
    let attempts = 0;
    while (!pdfjs && attempts < 25) {
      await new Promise((r) => setTimeout(r, 120));
      pdfjs = (window as any).pdfjsLib;
      attempts++;
    }
  }
  if (!pdfjs) {
    throw new Error('Trình đọc PDF chưa sẵn sàng.');
  }

  const cleanB64 = pdfBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  const binary = atob(cleanB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const numPages = pdf.numPages || 0;
  if (numPages === 0) {
    return { questions: [], extractedText: '', metadata: {}, methodUsed: 'pdf_coordinates' };
  }

  const pageCanvases: HTMLCanvasElement[] = [];
  const pageSegmentsList: PdfTextSegment[][] = [];
  const allTextLines: string[] = [];

  for (let p = 1; p <= numPages; p++) {
    onProgress?.(`Đang đọc tọa độ & kết xuất trang ${p}/${numPages}...`);
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    const textContent = await page.getTextContent();
    const segs = extractPositionedSegments(textContent, viewport, pdfjs, canvas.width);

    pageCanvases.push(canvas);
    pageSegmentsList.push(segs);
    segs.forEach((s) => allTextLines.push(s.text));
  }

  const fullExtractedText = allTextLines.join('\n').trim();
  const cauHits = allTextLines.filter((t) => PDF_QUESTION_START_RE.test(t)).length;
  const totalChars = fullExtractedText.replace(/\s+/g, '').length;

  // Nếu PDF là bản scan / ảnh / ít ký tự text -> Dùng ngay Gemini Vision Cropper
  if (totalChars < numPages * 45 || (cauHits === 0 && numPages >= 1 && totalChars < 350)) {
    onProgress?.('Phát hiện PDF dạng ảnh/scan, đang chuyển sang AI Vision định vị khung cắt...');
    return autoCropPageCanvasesWithVision(pageCanvases, {
      onProgress,
      initialExtractedText: fullExtractedText,
    });
  }

  // Xây dựng các cột theo đúng thứ tự đọc từ tất cả các trang
  const allColumns: ColumnSlice[] = [];
  for (let p = 0; p < numPages; p++) {
    const cols = buildPageColumns(p + 1, pageCanvases[p], pageSegmentsList[p]);
    allColumns.push(...cols);
  }

  const useAltNumbering = cauHits < 2;
  const rawQuestions: RawCroppedQuestion[] = [];
  const answerKeyLines: string[] = [];
  let activePart: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq';
  let inAnswerSection = false;
  const partCounters = { part_1_mcq: 0, part_2_true_false: 0, part_3_short_answer: 0 };

  interface ColAnchor {
    kind: 'question' | 'part' | 'answer' | 'solution' | 'end_exam';
    segIdx: number;
    seg: PdfTextSegment;
    qNumber?: number;
    part?: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer';
  }

  for (let cIdx = 0; cIdx < allColumns.length; cIdx++) {
    const col = allColumns[cIdx];
    const segs = col.segments;
    if (segs.length === 0) continue;

    if (inAnswerSection) {
      segs.forEach((s) => answerKeyLines.push(s.text));
      continue;
    }

    // Xác định các mốc (anchor) trong cột hiện tại
    const anchors: ColAnchor[] = [];
    for (let sIdx = 0; sIdx < segs.length; sIdx++) {
      const seg = segs[sIdx];
      const txt = seg.text;

      if (isAnswerSectionLine(txt)) {
        anchors.push({ kind: 'answer', segIdx: sIdx, seg });
        continue;
      }

      if (/^[-–—\*\s]{2,}hết[-–—\*\s]{2,}$/i.test(txt)) {
        anchors.push({ kind: 'end_exam', segIdx: sIdx, seg });
        continue;
      }

      const detectedPart = detectPartFromLine(txt);
      const qMatch = txt.match(PDF_QUESTION_START_RE) || (useAltNumbering ? txt.match(PDF_ALT_NUM_START_RE) : null);

      if (qMatch) {
        anchors.push({
          kind: 'question',
          segIdx: sIdx,
          seg,
          qNumber: parseInt(qMatch[1], 10),
          part: detectedPart || undefined,
        });
        continue;
      }

      if (detectedPart) {
        anchors.push({ kind: 'part', segIdx: sIdx, seg, part: detectedPart });
        continue;
      }

      if (/^(?:Lời\s+giải|Hướng\s+dẫn\s+giải|HDG)\s*[:\.]/i.test(txt)) {
        anchors.push({ kind: 'solution', segIdx: sIdx, seg });
        continue;
      }
    }

    // Kiểm tra xem phần đầu cột hiện tại (phía trên anchor đầu tiên) có phải đoạn nối tiếp của câu hỏi trang/cột trước không
    const firstAnchorIdx = anchors.length > 0 ? anchors[0].segIdx : segs.length;
    if (rawQuestions.length > 0 && firstAnchorIdx > 0) {
      const leadingSegs = segs.slice(0, firstAnchorIdx).filter((s) => !isNoiseOrBoilerplateLine(s.text));
      if (leadingSegs.length > 0) {
        const contTopRaw = leadingSegs[0].yTop - 10;
        const contBotRaw =
          anchors.length > 0
            ? Math.min(anchors[0].seg.yTop - 6, leadingSegs[leadingSegs.length - 1].yBottom + 14)
            : leadingSegs[leadingSegs.length - 1].yBottom + 14;

        const y0 = findNearestWhitespaceRow(col.canvas, contTopRaw, contTopRaw - 18, leadingSegs[0].yTop - 2, col.cropXMin, col.cropXMax);
        const y1 = findNearestWhitespaceRow(col.canvas, contBotRaw, contBotRaw - 14, contBotRaw + 16, col.cropXMin, col.cropXMax);
        const contCanvas = cropCanvasWithTrim(col.canvas, col.cropXMin, y0, col.cropXMax, y1);
        if (contCanvas) {
          const lastQ = rawQuestions[rawQuestions.length - 1];
          lastQ.canvases.push(contCanvas);
          leadingSegs.forEach((ls) => lastQ.textLines.push(ls.text));
        }
      }
    }

    // Duyệt từng anchor để cắt chính xác vùng từng câu hỏi
    for (let aIdx = 0; aIdx < anchors.length; aIdx++) {
      const anchor = anchors[aIdx];

      if (anchor.kind === 'answer') {
        inAnswerSection = true;
        segs.slice(anchor.segIdx).forEach((s) => answerKeyLines.push(s.text));
        break;
      }

      if (anchor.kind === 'end_exam') {
        break;
      }

      if (anchor.kind === 'part' && anchor.part) {
        activePart = anchor.part;
        continue;
      }

      if (anchor.kind === 'solution') {
        if (rawQuestions.length > 0) {
          const nextA = anchors[aIdx + 1];
          const endIdx = nextA ? nextA.segIdx : segs.length;
          const solSegs = segs.slice(anchor.segIdx, endIdx);
          solSegs.forEach((ss) => rawQuestions[rawQuestions.length - 1].explanationLines.push(ss.text));
        }
        continue;
      }

      if (anchor.kind === 'question') {
        if (anchor.part) activePart = anchor.part;
        partCounters[activePart] += 1;

        const nextAnchor = anchors[aIdx + 1];
        const endSegIdx = nextAnchor ? nextAnchor.segIdx : segs.length;
        const qSegs = segs.slice(anchor.segIdx, endSegIdx).filter((s) => !isNoiseOrBoilerplateLine(s.text));

        onProgress?.(`Đang cắt ảnh Câu ${rawQuestions.length + 1} (Trang ${col.pageNumber})...`);

        const approxTop = anchor.seg.yTop - 10;
        const y0 = findNearestWhitespaceRow(
          col.canvas,
          approxTop,
          anchor.seg.yTop - 28,
          anchor.seg.yTop - 2,
          col.cropXMin,
          col.cropXMax
        );

        let rawBottom: number;
        if (nextAnchor) {
          rawBottom = nextAnchor.seg.yTop - 8;
        } else {
          // Lấy mép dưới cùng của các dòng text trong câu này, hoặc hết trang (trừ vùng footer)
          const lastTextY = qSegs.length > 0 ? Math.max(...qSegs.map((s) => s.yBottom)) : anchor.seg.yBottom;
          // Mở rộng thêm biên dưới phòng trường hợp hình vẽ/đồ thị nằm ngay bên dưới dòng chữ cuối của câu
          rawBottom = Math.min(col.canvas.height * 0.94, Math.max(lastTextY + 24, col.canvas.height * 0.92));
          if (!nextAnchor && cIdx + 1 < allColumns.length && allColumns[cIdx + 1].pageNumber === col.pageNumber) {
            // Cột trái cùng trang: lấy hết xuống cuối vùng nội dung vì có thể có hình ở cuối cột
            rawBottom = Math.min(col.canvas.height * 0.94, Math.max(lastTextY + 180, col.canvas.height * 0.92));
          }
          // Tuy nhiên với cropCanvasWithTrim sẽ tự động co gọn về sát mép mực dưới cùng thực sự!
        }

        const y1 = nextAnchor
          ? findNearestWhitespaceRow(
              col.canvas,
              rawBottom,
              Math.max(y0 + 20, nextAnchor.seg.yTop - 22),
              nextAnchor.seg.yTop - 2,
              col.cropXMin,
              col.cropXMax
            )
          : rawBottom;

        const cropped = cropCanvasWithTrim(col.canvas, col.cropXMin, y0, col.cropXMax, y1);
        const qLines = qSegs.map((s) => s.text);

        if (cropped) {
          rawQuestions.push({
            part: activePart,
            declaredNumber: anchor.qNumber || rawQuestions.length + 1,
            localPartNumber: partCounters[activePart],
            canvases: [cropped],
            textLines: qLines,
            explanationLines: [],
          });
        }
      }
    }
  }

  // Nếu phương pháp tọa độ không tách được ít nhất 2 câu (bị mã hóa font lạ), chuyển sang AI Vision
  if (rawQuestions.length < 2) {
    onProgress?.('Định dạng font PDF phức tạp, chuyển sang AI Vision định vị khung cắt...');
    return autoCropPageCanvasesWithVision(pageCanvases, {
      onProgress,
      initialExtractedText: fullExtractedText,
    });
  }

  const answerText = answerKeyLines.join('\n');
  const questions = finalizeQuestionsFromRaw(rawQuestions, fullExtractedText, answerText, 'q_pdfcrop');

  const coordMeta = extractExamMetadataFromHeader(fullExtractedText);
  return {
    questions,
    extractedText: fullExtractedText,
    metadata: {
      title: coordMeta.detectedTitle,
      grade: coordMeta.detectedGrade,
      durationMinutes: coordMeta.detectedDuration,
    },
    methodUsed: 'pdf_coordinates',
  };
}

import JSZip from 'jszip';
import { renderAsync } from 'docx-preview';
import * as mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import katex from 'katex';
import { Question, QuestionPart1MCQ, QuestionPart2TrueFalse, QuestionPart3ShortAnswer } from '../types/math';
import { extractAnswerKeysFromTable, extractExamMetadataFromHeader } from './latexExamParser';

/**
 * Chuyển đổi một node OMML (<m:oMath> / <m:oMathPara>) từ word/document.xml sang chuỗi LaTeX đọc được
 */
function ommlChildrenToLatex(node: Element): string {
  let out = '';
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      out += ommlNodeToLatex(child as Element);
    }
  }
  return out;
}

function findDirectChildByLocalName(parent: Element | null, localName: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === localName) {
      return child as Element;
    }
  }
  return null;
}

function getAttrVal(el: Element | null, attrName = 'val'): string {
  if (!el) return '';
  return (
    el.getAttribute(`m:${attrName}`) ||
    el.getAttribute(`w:${attrName}`) ||
    el.getAttribute(attrName) ||
    ''
  );
}

export function ommlNodeToLatex(node: Element): string {
  const name = node.localName;

  switch (name) {
    case 'oMathPara':
    case 'oMath':
    case 'e':
    case 'num':
    case 'den':
    case 'sub':
    case 'sup':
    case 'deg':
    case 'lim':
    case 'fName':
    case 'r': {
      return ommlChildrenToLatex(node);
    }
    case 't': {
      return node.textContent || '';
    }
    case 'f': {
      const fPr = findDirectChildByLocalName(node, 'fPr');
      const fType = getAttrVal(findDirectChildByLocalName(fPr, 'type'));
      const num = ommlChildrenToLatex(findDirectChildByLocalName(node, 'num') || node);
      const den = ommlChildrenToLatex(findDirectChildByLocalName(node, 'den') || node);
      const numEl = findDirectChildByLocalName(node, 'num');
      const denEl = findDirectChildByLocalName(node, 'den');
      const nStr = numEl ? ommlChildrenToLatex(numEl) : num;
      const dStr = denEl ? ommlChildrenToLatex(denEl) : den;
      if (fType === 'noBar') {
        return `\\binom{${nStr}}{${dStr}}`;
      }
      return `\\frac{${nStr}}{${dStr}}`;
    }
    case 'sSup': {
      const eEl = findDirectChildByLocalName(node, 'e');
      const supEl = findDirectChildByLocalName(node, 'sup');
      const base = eEl ? ommlChildrenToLatex(eEl) : '';
      const sup = supEl ? ommlChildrenToLatex(supEl) : '';
      return `{${base}}^{${sup}}`;
    }
    case 'sSub': {
      const eEl = findDirectChildByLocalName(node, 'e');
      const subEl = findDirectChildByLocalName(node, 'sub');
      const base = eEl ? ommlChildrenToLatex(eEl) : '';
      const sub = subEl ? ommlChildrenToLatex(subEl) : '';
      return `{${base}}_{${sub}}`;
    }
    case 'sSubSup': {
      const eEl = findDirectChildByLocalName(node, 'e');
      const subEl = findDirectChildByLocalName(node, 'sub');
      const supEl = findDirectChildByLocalName(node, 'sup');
      const base = eEl ? ommlChildrenToLatex(eEl) : '';
      const sub = subEl ? ommlChildrenToLatex(subEl) : '';
      const sup = supEl ? ommlChildrenToLatex(supEl) : '';
      return `{${base}}_{${sub}}^{${sup}}`;
    }
    case 'sPre': {
      const eEl = findDirectChildByLocalName(node, 'e');
      const subEl = findDirectChildByLocalName(node, 'sub');
      const supEl = findDirectChildByLocalName(node, 'sup');
      const base = eEl ? ommlChildrenToLatex(eEl) : '';
      const sub = subEl ? ommlChildrenToLatex(subEl) : '';
      const sup = supEl ? ommlChildrenToLatex(supEl) : '';
      return `_{${sub}}^{${sup}}{${base}}`;
    }
    case 'rad': {
      const degEl = findDirectChildByLocalName(node, 'deg');
      const eEl = findDirectChildByLocalName(node, 'e');
      const deg = degEl ? ommlChildrenToLatex(degEl).trim() : '';
      const expr = eEl ? ommlChildrenToLatex(eEl) : '';
      return deg ? `\\sqrt[${deg}]{${expr}}` : `\\sqrt{${expr}}`;
    }
    case 'nary': {
      const pr = findDirectChildByLocalName(node, 'naryPr');
      const chr = getAttrVal(findDirectChildByLocalName(pr, 'chr')) || '∫';
      let op = '\\int';
      if (chr === '∑') op = '\\sum';
      else if (chr === '∏') op = '\\prod';
      else if (chr === '∬') op = '\\iint';
      else if (chr === '∭') op = '\\iiint';
      else if (chr === '⋃') op = '\\bigcup';
      else if (chr === '⋂') op = '\\bigcap';
      const subEl = findDirectChildByLocalName(node, 'sub');
      const supEl = findDirectChildByLocalName(node, 'sup');
      const eEl = findDirectChildByLocalName(node, 'e');
      const sub = subEl ? ommlChildrenToLatex(subEl).trim() : '';
      const sup = supEl ? ommlChildrenToLatex(supEl).trim() : '';
      const expr = eEl ? ommlChildrenToLatex(eEl) : '';
      return `${op}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${expr}`;
    }
    case 'limLow': {
      const eEl = findDirectChildByLocalName(node, 'e');
      const limEl = findDirectChildByLocalName(node, 'lim');
      const base = eEl ? ommlChildrenToLatex(eEl).trim() : '';
      const lim = limEl ? ommlChildrenToLatex(limEl).trim() : '';
      const normalizedBase = base === 'lim' ? '\\lim' : base;
      return `${normalizedBase}_{${lim}}`;
    }
    case 'limUpp': {
      const eEl = findDirectChildByLocalName(node, 'e');
      const limEl = findDirectChildByLocalName(node, 'lim');
      const base = eEl ? ommlChildrenToLatex(eEl).trim() : '';
      const lim = limEl ? ommlChildrenToLatex(limEl).trim() : '';
      return `\\overset{${lim}}{${base}}`;
    }
    case 'd': {
      const pr = findDirectChildByLocalName(node, 'dPr');
      const beg = getAttrVal(findDirectChildByLocalName(pr, 'begChr')) || '(';
      const end = getAttrVal(findDirectChildByLocalName(pr, 'endChr')) || ')';
      const sep = getAttrVal(findDirectChildByLocalName(pr, 'sepChr')) || ',';
      const es: string[] = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        const c = node.childNodes[i];
        if (c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'e') {
          es.push(ommlChildrenToLatex(c as Element));
        }
      }
      const leftD = beg === '{' ? '\\{' : beg === '' ? '.' : beg;
      const rightD = end === '}' ? '\\}' : end === '' ? '.' : end;
      return `\\left${leftD} ${es.join(` ${sep} `)} \\right${rightD}`;
    }
    case 'm': {
      const rows: string[] = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        const r = node.childNodes[i];
        if (r.nodeType === Node.ELEMENT_NODE && (r as Element).localName === 'mr') {
          const cells: string[] = [];
          for (let j = 0; j < r.childNodes.length; j++) {
            const cell = r.childNodes[j];
            if (cell.nodeType === Node.ELEMENT_NODE && (cell as Element).localName === 'e') {
              cells.push(ommlChildrenToLatex(cell as Element));
            }
          }
          rows.push(cells.join(' & '));
        }
      }
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }
    case 'acc': {
      const pr = findDirectChildByLocalName(node, 'accPr');
      const chr = getAttrVal(findDirectChildByLocalName(pr, 'chr')) || '';
      const eEl = findDirectChildByLocalName(node, 'e');
      const expr = eEl ? ommlChildrenToLatex(eEl) : '';
      if (chr.includes('\u20D7') || chr === '→') return `\\overrightarrow{${expr}}`;
      if (chr === '^' || chr.includes('\u0302')) return `\\widehat{${expr}}`;
      return `\\overline{${expr}}`;
    }
    case 'bar': {
      const eEl = findDirectChildByLocalName(node, 'e');
      const expr = eEl ? ommlChildrenToLatex(eEl) : '';
      return `\\overline{${expr}}`;
    }
    case 'func': {
      const fNameEl = findDirectChildByLocalName(node, 'fName');
      const eEl = findDirectChildByLocalName(node, 'e');
      const fname = fNameEl ? ommlChildrenToLatex(fNameEl).trim() : '';
      const expr = eEl ? ommlChildrenToLatex(eEl) : '';
      const known = ['sin', 'cos', 'tan', 'cot', 'log', 'ln', 'lim', 'max', 'min'];
      const op = known.includes(fname) ? `\\${fname}` : fname;
      return `${op} ${expr}`;
    }
    case 'eqArr': {
      const lines: string[] = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        const c = node.childNodes[i];
        if (c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'e') {
          lines.push(ommlChildrenToLatex(c as Element));
        }
      }
      return lines.join(' \\\\ ');
    }
    case 'box':
    case 'borderBox':
    case 'groupChr':
    case 'phant': {
      const eEl = findDirectChildByLocalName(node, 'e');
      return eEl ? ommlChildrenToLatex(eEl) : ommlChildrenToLatex(node);
    }
    default: {
      if (
        name.endsWith('Pr') ||
        name === 'rPr' ||
        name === 'ctrlPr'
      ) {
        return '';
      }
      return ommlChildrenToLatex(node);
    }
  }
}

/**
 * Chuyển một node MathML (<math>) thành chuỗi LaTeX để hiển thị bằng KaTeX sắc nét
 */
function mathMlChildrenToLatex(node: Element): string {
  let out = '';
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      out += mathMlNodeToLatex(child as Element);
    }
  }
  return out;
}

export function mathMlNodeToLatex(node: Element): string {
  const tag = node.localName.toLowerCase();
  const children = Array.from(node.children);

  switch (tag) {
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'mphantom':
    case 'semantics':
      return mathMlChildrenToLatex(node);
    case 'mi':
    case 'mn':
    case 'mo':
    case 'mtext':
    case 'ms': {
      const txt = (node.textContent || '').trim();
      const opMap: Record<string, string> = {
        '≤': '\\le ',
        '≥': '\\ge ',
        '≠': '\\ne ',
        '≈': '\\approx ',
        '∞': '\\infty ',
        '∈': '\\in ',
        '∉': '\\notin ',
        '⊂': '\\subset ',
        '∪': '\\cup ',
        '∩': '\\cap ',
        '∅': '\\emptyset ',
        '∀': '\\forall ',
        '∃': '\\exists ',
        '⇒': '\\Rightarrow ',
        '⇔': '\\Leftrightarrow ',
        '→': '\\to ',
        '×': '\\times ',
        '·': '\\cdot ',
        '±': '\\pm ',
        'π': '\\pi ',
        'α': '\\alpha ',
        'β': '\\beta ',
        'γ': '\\gamma ',
        'Δ': '\\Delta ',
        'θ': '\\theta ',
        'φ': '\\varphi ',
        'ω': '\\omega ',
        '∫': '\\int ',
        '∑': '\\sum ',
        '∏': '\\prod ',
      };
      return opMap[txt] || txt;
    }
    case 'mfrac': {
      const a = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const b = children[1] ? mathMlNodeToLatex(children[1]) : '';
      return `\\frac{${a}}{${b}}`;
    }
    case 'msqrt': {
      return `\\sqrt{${mathMlChildrenToLatex(node)}}`;
    }
    case 'mroot': {
      const base = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const idx = children[1] ? mathMlNodeToLatex(children[1]) : '';
      return `\\sqrt[${idx}]{${base}}`;
    }
    case 'msup': {
      const base = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const sup = children[1] ? mathMlNodeToLatex(children[1]) : '';
      return `{${base}}^{${sup}}`;
    }
    case 'msub': {
      const base = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const sub = children[1] ? mathMlNodeToLatex(children[1]) : '';
      return `{${base}}_{${sub}}`;
    }
    case 'msubsup': {
      const base = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const sub = children[1] ? mathMlNodeToLatex(children[1]) : '';
      const sup = children[2] ? mathMlNodeToLatex(children[2]) : '';
      return `{${base}}_{${sub}}^{${sup}}`;
    }
    case 'mover': {
      const base = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const over = children[1] ? (children[1].textContent || '').trim() : '';
      if (over === '→' || over === '⃗') return `\\overrightarrow{${base}}`;
      if (over === '^' || over === '̂') return `\\widehat{${base}}`;
      if (over === '¯' || over === '−' || over === '-') return `\\overline{${base}}`;
      return `\\overset{${children[1] ? mathMlNodeToLatex(children[1]) : over}}{${base}}`;
    }
    case 'munder': {
      const base = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const under = children[1] ? mathMlNodeToLatex(children[1]) : '';
      if (base.trim() === 'lim') return `\\lim_{${under}}`;
      return `\\underset{${under}}{${base}}`;
    }
    case 'munderover': {
      const base = children[0] ? mathMlNodeToLatex(children[0]) : '';
      const under = children[1] ? mathMlNodeToLatex(children[1]) : '';
      const over = children[2] ? mathMlNodeToLatex(children[2]) : '';
      return `{${base}}_{${under}}^{${over}}`;
    }
    case 'mfenced': {
      const open = node.getAttribute('open') ?? '(';
      const close = node.getAttribute('close') ?? ')';
      const sep = node.getAttribute('separators') ?? ',';
      const inner = children.map((c) => mathMlNodeToLatex(c)).join(` ${sep} `);
      const l = open === '{' ? '\\{' : open || '.';
      const r = close === '}' ? '\\}' : close || '.';
      return `\\left${l} ${inner} \\right${r}`;
    }
    case 'mtable': {
      const rows = children.map((tr) => {
        const tds = Array.from(tr.children).map((td) => mathMlNodeToLatex(td));
        return tds.join(' & ');
      });
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }
    case 'mtr':
    case 'mtd':
      return mathMlChildrenToLatex(node);
    case 'annotation':
    case 'annotation-xml':
      return '';
    default:
      return mathMlChildrenToLatex(node);
  }
}

/**
 * Trích xuất toàn bộ văn bản kèm công thức toán LaTeX từ file .docx
 */
export async function extractWordTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      const xmlStr = await docXmlFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

      const lines: string[] = [];

      const extractParagraph = (pEl: Element): string => {
        let pText = '';
        const walk = (el: Element) => {
          const name = el.localName;
          if (name === 'oMathPara') {
            const latex = ommlNodeToLatex(el).trim();
            if (latex) pText += ` $$${latex}$$ `;
            return;
          }
          if (name === 'oMath') {
            const latex = ommlNodeToLatex(el).trim();
            if (latex) pText += ` $${latex}$ `;
            return;
          }
          if (name === 't') {
            pText += el.textContent || '';
            return;
          }
          if (name === 'tab') {
            pText += '\t';
            return;
          }
          if (name === 'br' || name === 'cr') {
            pText += '\n';
            return;
          }
          for (let i = 0; i < el.childNodes.length; i++) {
            const child = el.childNodes[i];
            if (child.nodeType === Node.ELEMENT_NODE) {
              walk(child as Element);
            }
          }
        };
        walk(pEl);
        return pText.replace(/\s+\$/g, ' $').replace(/\$\s+/g, '$ ').trim();
      };

      const body = xmlDoc.getElementsByTagNameNS('*', 'body')[0] || xmlDoc.documentElement;
      const walkBody = (container: Element) => {
        for (let i = 0; i < container.childNodes.length; i++) {
          const node = container.childNodes[i];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;
          if (el.localName === 'p') {
            const txt = extractParagraph(el);
            if (txt) lines.push(txt);
          } else if (el.localName === 'tbl') {
            const rows = Array.from(el.childNodes).filter(
              (c) => c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'tr'
            ) as Element[];
            for (const row of rows) {
              const cells = Array.from(row.childNodes).filter(
                (c) => c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'tc'
              ) as Element[];
              const cellTexts: string[] = [];
              for (const cell of cells) {
                const cellParas = Array.from(cell.childNodes).filter(
                  (c) => c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'p'
                ) as Element[];
                const cText = cellParas.map(extractParagraph).filter(Boolean).join(' ');
                if (cText) cellTexts.push(cText);
              }
              if (cellTexts.length > 0) lines.push(cellTexts.join('   '));
            }
          } else if (el.localName === 'sdt' || el.localName === 'sdtContent') {
            walkBody(el);
          }
        }
      };

      walkBody(body);
      const result = lines.join('\n').trim();
      if (result) return result;
    }
  } catch (err) {
    console.warn('[WordExtractor] Lỗi trích xuất XML từ .docx, chuyển sang mammoth:', err);
  }

  try {
    const res = await mammoth.extractRawText({ arrayBuffer });
    return (res.value || '').trim();
  } catch {
    return '';
  }
}

/**
 * Chia một canvas rất cao thành các trang A4 vừa khung cắt, tìm khe trắng giữa các dòng để không cắt đứt chữ
 */
export function sliceTallCanvasToPages(
  sourceCanvas: HTMLCanvasElement,
  targetPageHeightPx?: number
): string[] {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  if (width <= 0 || height <= 0) return [];

  const a4Height = targetPageHeightPx || Math.round(width * 1.4142);
  if (height <= a4Height * 1.12) {
    return [sourceCanvas.toDataURL('image/jpeg', 0.92)];
  }

  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const pages: string[] = [];
  let y = 0;

  while (y < height) {
    const remaining = height - y;
    if (remaining <= a4Height * 1.1) {
      const sliceH = remaining;
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = width;
      pageCanvas.height = sliceH;
      const pCtx = pageCanvas.getContext('2d');
      if (pCtx) {
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, width, sliceH);
        pCtx.drawImage(sourceCanvas, 0, y, width, sliceH, 0, 0, width, sliceH);
        pages.push(pageCanvas.toDataURL('image/jpeg', 0.92));
      }
      break;
    }

    let cutY = Math.min(height, y + a4Height);
    if (ctx) {
      // Tìm hàng pixel trắng nhất trong khoảng [cutY - 160, cutY + 40] để không cắt ngang dòng chữ
      const searchStart = Math.max(y + Math.round(a4Height * 0.55), cutY - 180);
      const searchEnd = Math.min(height - 1, cutY + 40);
      let bestRow = cutY;
      let bestWhitespaceScore = -1;

      const sampleStepX = Math.max(1, Math.floor(width / 120));
      for (let row = searchStart; row <= searchEnd; row += 2) {
        const rowData = ctx.getImageData(0, row, width, 1).data;
        let whitePixels = 0;
        let totalSamples = 0;
        for (let px = 0; px < width; px += sampleStepX) {
          const idx = px * 4;
          const r = rowData[idx];
          const g = rowData[idx + 1];
          const b = rowData[idx + 2];
          if (r > 242 && g > 242 && b > 242) {
            whitePixels++;
          }
          totalSamples++;
        }
        const ratio = totalSamples > 0 ? whitePixels / totalSamples : 0;
        if (ratio >= 0.995) {
          bestRow = row;
          bestWhitespaceScore = ratio;
          // Ưu tiên hàng gần cutY nhất
        } else if (ratio > bestWhitespaceScore) {
          bestWhitespaceScore = ratio;
          bestRow = row;
        }
      }
      if (bestWhitespaceScore > 0.9 && bestRow > y + 80) {
        cutY = bestRow;
      }
    }

    const sliceH = Math.max(1, cutY - y);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = width;
    pageCanvas.height = sliceH;
    const pCtx = pageCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#ffffff';
      pCtx.fillRect(0, 0, width, sliceH);
      pCtx.drawImage(sourceCanvas, 0, y, width, sliceH, 0, 0, width, sliceH);
      pages.push(pageCanvas.toDataURL('image/jpeg', 0.92));
    }
    y = cutY;
  }

  return pages;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderTextLineWithKatex(line: string): string {
  // Tách các đoạn $$...$$ và $...$ để render KaTeX mượt mà
  const parts = line.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const tex = part.slice(2, -2).trim();
        try {
          return katex.renderToString(tex, { throwOnError: false, displayMode: true });
        } catch {
          return escapeHtml(part);
        }
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        const tex = part.slice(1, -1).trim();
        try {
          return katex.renderToString(tex, { throwOnError: false, displayMode: false });
        } catch {
          return escapeHtml(part);
        }
      }
      return escapeHtml(part);
    })
    .join('');
}

async function waitForIframeAssets(iframeDoc: Document): Promise<void> {
  try {
    if ((iframeDoc as any).fonts?.ready) {
      await Promise.race([
        (iframeDoc as any).fonts.ready,
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
  } catch {}

  const imgs = Array.from(iframeDoc.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const timer = setTimeout(resolve, 1500);
          img.onload = () => {
            clearTimeout(timer);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
        })
    )
  );
  await new Promise((r) => setTimeout(r, 120));
}

function sanitizeStylesAgainstModernColorFunctions(doc: Document): void {
  const replaceModern = (css: string) =>
    css.replace(/(oklch|oklab|lch|lab|color-mix)\([^)]*\)/gi, '#0f172a');

  doc.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.textContent && /(oklch|oklab|lch|lab|color-mix)\(/i.test(styleEl.textContent)) {
      styleEl.textContent = replaceModern(styleEl.textContent);
    }
  });
  doc.querySelectorAll('[style]').forEach((el) => {
    const s = el.getAttribute('style');
    if (s && /(oklch|oklab|lch|lab|color-mix)\(/i.test(s)) {
      el.setAttribute('style', replaceModern(s));
    }
  });
}

function replaceMathMlWithKatex(doc: Document): void {
  const mathEls = Array.from(doc.querySelectorAll('math'));
  for (const mathEl of mathEls) {
    try {
      const latex = mathMlNodeToLatex(mathEl).trim();
      if (!latex) continue;
      const displayMode = mathEl.getAttribute('display') === 'block';
      const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode,
      });
      const wrapper = doc.createElement('span');
      wrapper.style.display = displayMode ? 'block' : 'inline-block';
      wrapper.style.verticalAlign = 'middle';
      wrapper.innerHTML = html;
      mathEl.replaceWith(wrapper);
    } catch {
      // Giữ nguyên nếu có lỗi
    }
  }
}

async function createCleanRenderIframe(): Promise<{
  iframe: HTMLIFrameElement;
  doc: Document;
}> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '960px';
  iframe.style.height = '1400px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error('Không thể khởi tạo khung kết xuất tài liệu.');
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: "Times New Roman", "Liberation Serif", Georgia, serif;
      -webkit-font-smoothing: antialiased;
    }
    .docx-wrapper {
      background: #ffffff !important;
      padding: 0 !important;
      display: block !important;
    }
    .docx-wrapper > section.docx {
      box-shadow: none !important;
      margin: 0 auto !important;
      background: #ffffff !important;
    }
    .word-fallback-page {
      width: 794px;
      padding: 52px 58px;
      background: #ffffff;
      color: #0f172a;
      font-size: 15px;
      line-height: 1.65;
    }
    .word-fallback-page p {
      margin: 0 0 8px 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .word-fallback-page table {
      border-collapse: collapse;
      width: 100%;
      margin: 10px 0;
    }
    .word-fallback-page td, .word-fallback-page th {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
    }
    .word-fallback-page img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div id="style-root"></div>
  <div id="doc-root"></div>
</body>
</html>`);
  doc.close();

  await new Promise((r) => setTimeout(r, 60));
  return { iframe, doc };
}

/**
 * Kết xuất file Word (.docx) thành danh sách ảnh từng trang sắc nét để giáo viên khoanh cắt trực tiếp trên Canvas
 */
export async function renderWordDocxToPageImages(
  arrayBuffer: ArrayBuffer
): Promise<{ pageDataUrls: string[]; extractedText: string }> {
  const extractedText = await extractWordTextFromDocx(arrayBuffer);
  const { iframe, doc } = await createCleanRenderIframe();

  try {
    const styleRoot = doc.getElementById('style-root')!;
    const docRoot = doc.getElementById('doc-root')!;

    let usedFallbackHtml = false;
    try {
      await renderAsync(arrayBuffer, docRoot, styleRoot, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: true,
        renderHeaders: true,
        renderFooters: true,
        experimental: true,
      });
    } catch (docxErr) {
      console.warn('[WordRenderer] docx-preview không kết xuất được, chuyển sang mammoth:', docxErr);
      usedFallbackHtml = true;
    }

    if (!usedFallbackHtml) {
      replaceMathMlWithKatex(doc);
    }

    let targets = Array.from(docRoot.querySelectorAll('section.docx')) as HTMLElement[];
    if (usedFallbackHtml || targets.length === 0) {
      docRoot.innerHTML = '';
      const pageDiv = doc.createElement('div');
      pageDiv.className = 'word-fallback-page';
      try {
        const mammothResult = await mammoth.convertToHtml({ arrayBuffer });
        if (mammothResult.value && mammothResult.value.trim()) {
          pageDiv.innerHTML = mammothResult.value;
        } else {
          pageDiv.innerHTML = extractedText
            .split('\n')
            .map((line) => `<p>${renderTextLineWithKatex(line)}</p>`)
            .join('');
        }
      } catch {
        pageDiv.innerHTML = extractedText
          .split('\n')
          .map((line) => `<p>${renderTextLineWithKatex(line)}</p>`)
          .join('');
      }
      docRoot.appendChild(pageDiv);
      targets = [pageDiv];
    }

    sanitizeStylesAgainstModernColorFunctions(doc);
    await waitForIframeAssets(doc);

    const allPages: string[] = [];
    for (const target of targets) {
      if (!target || target.offsetHeight < 10 || target.offsetWidth < 10) continue;
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const sliced = sliceTallCanvasToPages(canvas);
      allPages.push(...sliced);
    }

    // Nếu không thu được trang nào từ DOM Word (ví dụ chỉ có nội dung trong text/OMML), render từ extractedText
    if (allPages.length === 0 && extractedText) {
      const fallbackPages = await renderPlainTextToPageImages(extractedText);
      return { pageDataUrls: fallbackPages, extractedText };
    }

    return { pageDataUrls: allPages, extractedText };
  } finally {
    iframe.remove();
  }
}

/**
 * Kết xuất nội dung văn bản (file .doc cũ hoặc .tex/.txt) thành từng trang ảnh A4 để giáo viên cắt câu hỏi
 */
export async function renderPlainTextToPageImages(
  text: string,
  title?: string
): Promise<string[]> {
  const { iframe, doc } = await createCleanRenderIframe();
  try {
    const docRoot = doc.getElementById('doc-root')!;
    const pageDiv = doc.createElement('div');
    pageDiv.className = 'word-fallback-page';

    const titleHtml = title
      ? `<h2 style="margin:0 0 14px 0;font-size:18px;font-weight:700;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:8px;">${escapeHtml(title)}</h2>`
      : '';

    const bodyHtml = (text || 'Nội dung tài liệu trống.')
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '<div style="height:8px;"></div>';
        return `<p>${renderTextLineWithKatex(line)}</p>`;
      })
      .join('');

    pageDiv.innerHTML = `${titleHtml}${bodyHtml}`;
    docRoot.appendChild(pageDiv);

    sanitizeStylesAgainstModernColorFunctions(doc);
    await waitForIframeAssets(doc);

    const canvas = await html2canvas(pageDiv, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    return sliceTallCanvasToPages(canvas);
  } finally {
    iframe.remove();
  }
}

function getCleanElementText(el: Element): string {
  // Đọc text bỏ qua lớp .katex-html bị nhân đôi với .katex-mathml, hoặc bỏ .katex-mathml nếu giữ .katex-html
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const elem = node as Element;
    if (elem.classList?.contains('katex-mathml')) return '';
    const tag = elem.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'tr') {
      const cells = Array.from(elem.children).map((c) => walk(c).trim()).filter(Boolean);
      return cells.join(' | ') + '\n';
    }
    let out = '';
    for (let i = 0; i < node.childNodes.length; i++) {
      out += walk(node.childNodes[i]);
    }
    if (tag === 'p' || tag === 'div' || tag === 'li' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      out += '\n';
    }
    return out;
  };
  return walk(el)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isVisualContentEmpty(el: Element): boolean {
  const txt = getCleanElementText(el);
  if (txt.length > 0) return false;
  if (el.querySelector('img, svg, canvas, table, .katex, hr')) return false;
  return true;
}

const WORD_QUESTION_START_RE = /^(?:\[[^\]]{1,45}\]\s*)?(?:Câu|CÂU|Bài|BÀI)\s+(\d{1,3})(?:\s*[\.\:\)\-–—]|\s+(?!(?:và|hoặc|,|đến)\s*(?:câu|bài)?\s*\d)|\s*$)/i;
const WORD_ALT_NUM_START_RE = /^(\d{1,2})[\.\)]\s+(?=[A-ZÀ-Ỹa-zà-ỹ0-9\(])/;

function detectPartFromHeading(text: string): 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' | null {
  const lower = text.toLowerCase();
  // Tránh nhận nhầm khi chữ "phần" xuất hiện trong câu đề bài dài
  if (text.length > 260 && !/^(?:phần\s+[i123v])/i.test(text.trim())) return null;

  if (
    /\bphần\s*(?:iii|3)\b/i.test(lower) ||
    (/trả\s+lời\s+ngắn|điền\s+đáp\s+số|điền\s+kết\s+quả/i.test(lower) && text.length < 220)
  ) {
    return 'part_3_short_answer';
  }
  if (
    /\bphần\s*(?:ii|2)\b/i.test(lower) ||
    (/câu\s+trắc\s+nghiệm\s+đúng\s*\/?\s*sai|chọn\s+đúng\s+hoặc\s+sai/i.test(lower) && text.length < 220)
  ) {
    return 'part_2_true_false';
  }
  if (
    /\bphần\s*(?:i|1)\b(?!i)/i.test(lower) ||
    (/trắc\s+nghiệm\s+(?:nhiều\s+phương\s+án|4\s+lựa\s+chọn)/i.test(lower) && text.length < 220)
  ) {
    return 'part_1_mcq';
  }
  return null;
}

function isAnswerSectionHeadingText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120 || trimmed.includes('?')) return false;
  if (/nào\s+(?:dưới|sau)\s+đây/i.test(trimmed)) return false;
  return /^(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s*(?:CHI\s+TIẾT|THAM\s+KHẢO|ĐỀ\s+THI|CHÍNH\s+THỨC)?|HƯỚNG\s+DẪN\s+CHẤM|LỜI\s+GIẢI\s+CHI\s+TIẾT|ĐÁP\s+ÁN\s+VÀ\s+HƯỚNG\s+DẪN)/i.test(
    trimmed
  );
}

function isExamBoilerplateLine(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  if (/^(?:trang|page)\s+\d+(?:\s*\/\s*\d+)?$/i.test(lower)) return true;
  if (/^[-–—]\s*\d+\s*[-–—]$/.test(lower)) return true;
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

export interface WordAutoCropResult {
  questions: Question[];
  extractedText: string;
  metadata: {
    title?: string;
    grade?: 10 | 11 | 12;
    durationMinutes?: number;
  };
}

/**
 * Tự động nhận diện ranh giới từng câu hỏi trong file Word (.docx)
 * bằng cấu trúc DOM + KaTeX và kết xuất thành ảnh cắt riêng sắc nét cho từng câu
 */
export async function autoCropWordDocxToQuestions(
  arrayBuffer: ArrayBuffer,
  options?: {
    onProgress?: (msg: string) => void;
  }
): Promise<WordAutoCropResult> {
  const onProgress = options?.onProgress;
  onProgress?.('Đang phân tích cấu trúc tài liệu Word...');

  const extractedText = await extractWordTextFromDocx(arrayBuffer);
  const rawMeta = extractExamMetadataFromHeader(extractedText);
  const headerMeta = {
    title: rawMeta.detectedTitle,
    grade: rawMeta.detectedGrade,
    durationMinutes: rawMeta.detectedDuration,
  };

  const { iframe, doc } = await createCleanRenderIframe();
  try {
    const styleRoot = doc.getElementById('style-root')!;
    const docRoot = doc.getElementById('doc-root')!;

    let usedFallbackHtml = false;
    try {
      await renderAsync(arrayBuffer, docRoot, styleRoot, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: true,
        renderHeaders: false,
        renderFooters: false,
        experimental: true,
      });
    } catch {
      usedFallbackHtml = true;
    }

    if (!usedFallbackHtml) {
      replaceMathMlWithKatex(doc);
    }

    let sections = Array.from(docRoot.querySelectorAll('section.docx')) as HTMLElement[];
    if (usedFallbackHtml || sections.length === 0) {
      docRoot.innerHTML = '';
      const pageDiv = doc.createElement('div');
      pageDiv.className = 'word-fallback-page';
      try {
        const mammothResult = await mammoth.convertToHtml({ arrayBuffer });
        pageDiv.innerHTML = mammothResult.value?.trim()
          ? mammothResult.value
          : extractedText.split('\n').map((line) => `<p>${renderTextLineWithKatex(line)}</p>`).join('');
      } catch {
        pageDiv.innerHTML = extractedText.split('\n').map((line) => `<p>${renderTextLineWithKatex(line)}</p>`).join('');
      }
      docRoot.appendChild(pageDiv);
      sections = [pageDiv];
    }

    sanitizeStylesAgainstModernColorFunctions(doc);
    await waitForIframeAssets(doc);

    // Đo chiều rộng vùng nội dung chuẩn của trang Word
    let contentWidthPx = 680;
    const firstArticle = sections[0]?.querySelector('article') as HTMLElement | null;
    if (firstArticle && firstArticle.getBoundingClientRect().width > 300) {
      contentWidthPx = Math.round(firstArticle.getBoundingClientRect().width);
    } else if (sections[0] && sections[0].getBoundingClientRect().width > 300) {
      const cs = doc.defaultView?.getComputedStyle(sections[0]);
      const padL = parseFloat(cs?.paddingLeft || '0') || 0;
      const padR = parseFloat(cs?.paddingRight || '0') || 0;
      const innerW = sections[0].getBoundingClientRect().width - padL - padR;
      if (innerW > 300) contentWidthPx = Math.round(innerW);
    }
    contentWidthPx = Math.max(580, Math.min(760, contentWidthPx));

    // Thu thập tuần tự các block DOM từ tất cả các trang (bỏ header/footer)
    const rawBlocks: HTMLElement[] = [];
    const pushElementExpanded = (el: HTMLElement) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'header' || tag === 'footer') return;
      if (el.classList?.contains('docx-header') || el.classList?.contains('docx-footer')) return;

      // Nếu là bảng bố cục chứa nhiều câu hỏi (giáo viên xếp đề vào bảng), bung các ô theo cột/hàng
      if (tag === 'table') {
        const txt = getCleanElementText(el);
        const qHits = (txt.match(/(?:^|\n|\|)\s*(?:Câu|CÂU|Bài)\s+\d+/gi) || []).length;
        if (qHits >= 2 && !isAnswerSectionHeadingText(txt.split('\n')[0] || '')) {
          const rows = Array.from(el.querySelectorAll(':scope > tbody > tr, :scope > tr')) as HTMLTableRowElement[];
          const maxCols = rows.reduce((m, r) => Math.max(m, r.cells.length), 0);
          const col1HasQ =
            maxCols >= 2 &&
            rows.some((r) => r.cells[1] && WORD_QUESTION_START_RE.test(getCleanElementText(r.cells[1])));

          if (col1HasQ) {
            for (let colIdx = 0; colIdx < maxCols; colIdx++) {
              for (const row of rows) {
                const cell = row.cells[colIdx];
                if (!cell) continue;
                Array.from(cell.children).forEach((child) => pushElementExpanded(child as HTMLElement));
              }
            }
          } else {
            for (const row of rows) {
              for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
                const cell = row.cells[colIdx];
                Array.from(cell.children).forEach((child) => pushElementExpanded(child as HTMLElement));
              }
            }
          }
          return;
        }
      }

      rawBlocks.push(el);
    };

    for (const sec of sections) {
      const article = sec.querySelector('article') as HTMLElement | null;
      const container = article || sec;
      for (let i = 0; i < container.children.length; i++) {
        pushElementExpanded(container.children[i] as HTMLElement);
      }
    }

    // Kiểm tra xem tài liệu có sử dụng nhãn "Câu X" hay đánh số "1."
    const allBlockTexts = rawBlocks.map((b) => getCleanElementText(b));
    const cauMarkerCount = allBlockTexts.filter((t) => WORD_QUESTION_START_RE.test(t)).length;
    const useAltNumbering = cauMarkerCount < 2;

    interface GroupedWordQuestion {
      part: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer';
      declaredNumber: number;
      localPartNumber: number;
      nodes: HTMLElement[];
      textLines: string[];
      explanationLines: string[];
    }

    const grouped: GroupedWordQuestion[] = [];
    const answerKeyLines: string[] = [];
    let currentPart: 'part_1_mcq' | 'part_2_true_false' | 'part_3_short_answer' = 'part_1_mcq';
    let inAnswerSection = false;
    let inQuestionSolution = false;
    let currentGroup: GroupedWordQuestion | null = null;
    let pendingSharedNodes: HTMLElement[] = [];
    let pendingSharedLines: string[] = [];
    let sharedRemainingCount = 0;
    const partLocalCounters = { part_1_mcq: 0, part_2_true_false: 0, part_3_short_answer: 0 };

    const flushCurrentGroup = () => {
      if (!currentGroup) return;
      while (currentGroup.nodes.length > 0 && isVisualContentEmpty(currentGroup.nodes[currentGroup.nodes.length - 1])) {
        currentGroup.nodes.pop();
      }
      if (currentGroup.nodes.length > 0) {
        grouped.push(currentGroup);
      }
      currentGroup = null;
      inQuestionSolution = false;
    };

    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i];
      const text = allBlockTexts[i];

      if (inAnswerSection) {
        if (text) answerKeyLines.push(text);
        continue;
      }

      if (text && isAnswerSectionHeadingText(text)) {
        flushCurrentGroup();
        inAnswerSection = true;
        answerKeyLines.push(text);
        continue;
      }

      const detectedPart = detectPartFromHeading(text);
      if (detectedPart && !WORD_QUESTION_START_RE.test(text)) {
        flushCurrentGroup();
        currentPart = detectedPart;
        pendingSharedNodes = [];
        pendingSharedLines = [];
        sharedRemainingCount = 0;
        continue;
      }

      if (text && isExamBoilerplateLine(text)) {
        // Nếu gặp dòng "--- HẾT ---" ở cuối đề thì đóng câu cuối lại để không hút nội dung thừa phía sau
        if (/hết/i.test(text) && currentGroup) {
          flushCurrentGroup();
        }
        continue;
      }

      // Kiểm tra bắt đầu câu hỏi mới
      const qMatch = text.match(WORD_QUESTION_START_RE) || (useAltNumbering ? text.match(WORD_ALT_NUM_START_RE) : null);
      if (qMatch) {
        flushCurrentGroup();
        if (detectedPart) {
          currentPart = detectedPart;
        }
        const declaredNum = parseInt(qMatch[1], 10) || grouped.length + 1;
        partLocalCounters[currentPart] += 1;

        const initNodes: HTMLElement[] = [];
        const initLines: string[] = [];
        if (sharedRemainingCount > 0 && pendingSharedNodes.length > 0) {
          initNodes.push(...pendingSharedNodes);
          initLines.push(...pendingSharedLines);
          sharedRemainingCount--;
          if (sharedRemainingCount <= 0) {
            pendingSharedNodes = [];
            pendingSharedLines = [];
          }
        }
        initNodes.push(block);
        if (text) initLines.push(text);

        currentGroup = {
          part: currentPart,
          declaredNumber: declaredNum,
          localPartNumber: partLocalCounters[currentPart],
          nodes: initNodes,
          textLines: initLines,
          explanationLines: [],
        };
        continue;
      }

      // Nhận diện lời dẫn dữ kiện chung (nếu đứng giữa các câu hỏi)
      if (
        !currentGroup &&
        /(?:dựa\s+vào\s+(?:thông\s+tin|dữ\s+kiện|bảng|đồ\s+thị)|sử\s+dụng\s+(?:thông\s+tin|dữ\s+kiện)|dữ\s+kiện\s+chung|dùng\s+cho\s+(?:các\s+)?câu)/i.test(
          text
        )
      ) {
        pendingSharedNodes.push(block);
        pendingSharedLines.push(text);
        const rangeM = text.match(/câu\s*(\d+)\s*(?:đến|-|và)\s*(?:câu\s*)?(\d+)/i);
        sharedRemainingCount = rangeM ? Math.max(2, parseInt(rangeM[2], 10) - parseInt(rangeM[1], 10) + 1) : 2;
        continue;
      }

      if (!currentGroup) {
        // Bỏ qua phần tiêu đề trường/sở/họ tên trước Câu 1
        continue;
      }

      // Nếu trong cùng một câu có phần "Lời giải:" / "Hướng dẫn giải:" -> tách riêng sang explanation, không vẽ vào ảnh đề thi của học sinh
      if (/^(?:Lời\s+giải|Hướng\s+dẫn\s+giải|HDG)\s*[:\.]/i.test(text)) {
        inQuestionSolution = true;
      }

      if (inQuestionSolution) {
        if (text) currentGroup.explanationLines.push(text);
        continue;
      }

      currentGroup.nodes.push(block);
      if (text) currentGroup.textLines.push(text);
    }

    flushCurrentGroup();

    if (grouped.length === 0) {
      return { questions: [], extractedText, metadata: headerMeta };
    }

    // Tạo vùng staging chuẩn bề rộng để render từng câu hỏi thành ảnh sắc nét
    const staging = doc.createElement('div');
    staging.id = 'auto-crop-question-staging';
    staging.style.width = `${contentWidthPx}px`;
    staging.style.padding = '14px 18px';
    staging.style.background = '#ffffff';
    staging.style.color = '#0f172a';
    staging.style.boxSizing = 'content-box';
    staging.style.overflow = 'hidden';
    docRoot.innerHTML = '';
    docRoot.appendChild(staging);

    // Trích xuất đáp án từ bảng đáp án cuối file (hoặc toàn file)
    const answerText = answerKeyLines.join('\n');
    const parsedKeys = answerText
      ? extractAnswerKeysFromTable(answerText, true)
      : extractAnswerKeysFromTable(extractedText, false);

    const questions: Question[] = [];
    const baseTs = Date.now();

    for (let idx = 0; idx < grouped.length; idx++) {
      const grp = grouped[idx];
      onProgress?.(`Đang cắt ảnh câu ${idx + 1}/${grouped.length} từ file Word...`);

      staging.innerHTML = '';
      for (const origNode of grp.nodes) {
        const clone = origNode.cloneNode(true) as HTMLElement;
        // Chuẩn hóa nhẹ margin đầu/cuối để khung cắt cân đối
        clone.style.maxWidth = '100%';
        staging.appendChild(clone);
      }

      await waitForIframeAssets(doc);

      let croppedDataUrl = '';
      if (staging.offsetHeight >= 8 && staging.offsetWidth >= 20) {
        const rawCanvas = await html2canvas(staging, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        });

        const MAX_W = 1200;
        if (rawCanvas.width > MAX_W) {
          const outCanvas = doc.createElement('canvas');
          outCanvas.width = MAX_W;
          outCanvas.height = Math.max(1, Math.round((rawCanvas.height * MAX_W) / rawCanvas.width));
          const ctx = outCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            ctx.drawImage(rawCanvas, 0, 0, outCanvas.width, outCanvas.height);
            croppedDataUrl = outCanvas.toDataURL('image/jpeg', 0.9);
          } else {
            croppedDataUrl = rawCanvas.toDataURL('image/jpeg', 0.9);
          }
        } else {
          croppedDataUrl = rawCanvas.toDataURL('image/jpeg', 0.9);
        }
      }

      const fullQText = grp.textLines.join('\n');
      const fullExplText = grp.explanationLines.join('\n').trim();
      const seqNum = idx + 1;

      // Xác định lại loại câu hỏi nếu dấu hiệu thực tế trong nội dung rất rõ
      const hasUppercaseOpts = /(?:^|\n|\s{2,})\s*A\s*[\.\:\)]\s*[\s\S]*B\s*[\.\:\)]/m.test(fullQText);
      const hasLowerTfOpts = /(?:^|\n|\s{2,})\s*a\s*[\)\.]\s*[\s\S]*b\s*[\)\.]/m.test(fullQText);

      let finalPart = grp.part;
      if (hasUppercaseOpts && !hasLowerTfOpts) finalPart = 'part_1_mcq';
      else if (hasLowerTfOpts && !hasUppercaseOpts) finalPart = 'part_2_true_false';

      const numCandidates = [grp.declaredNumber, grp.localPartNumber, seqNum];

      if (finalPart === 'part_2_true_false') {
        let tfKey: Record<string, boolean> | undefined;
        for (const n of numCandidates) {
          tfKey = parsedKeys.byPart?.part_2_true_false?.[n] || parsedKeys.tfAnswers[n];
          if (tfKey) break;
        }
        const subKeys: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
        const items = subKeys.map((sk) => ({
          id: `tf_${sk}_${baseTs}_${idx}`,
          subKey: sk,
          text: '',
          isCorrect: tfKey && tfKey[sk] !== undefined ? tfKey[sk] : sk === 'a' || sk === 'b',
        }));

        const qObj: QuestionPart2TrueFalse = {
          id: `q_word_${baseTs}_${seqNum}`,
          part: 'part_2_true_false',
          questionNumber: seqNum,
          prompt: `Câu ${seqNum}. Xét tính đúng/sai của các mệnh đề sau:`,
          pdfAttachmentUrl: croppedDataUrl || undefined,
          imageAttachment: croppedDataUrl || undefined,
          items,
          explanation: fullExplText || '',
          points: 1.0,
        };
        questions.push(qObj);
      } else if (finalPart === 'part_3_short_answer') {
        let shortAns = '';
        const inlineAns = (fullQText + '\n' + fullExplText).match(/(?:Đáp\s*(?:án|số)|Kết\s*quả|Chọn)\s*[:\.]?\s*([-+]?\d+(?:[.,\/]\d+)?)/i);
        if (inlineAns) {
          shortAns = inlineAns[1].replace(',', '.').slice(0, 4);
        }
        if (!shortAns) {
          for (const n of numCandidates) {
            const k = parsedKeys.byPart?.part_3_short_answer?.[n] || parsedKeys.shortAnswers[n];
            if (k) {
              shortAns = k;
              break;
            }
          }
        }
        const qObj: QuestionPart3ShortAnswer = {
          id: `q_word_${baseTs}_${seqNum}`,
          part: 'part_3_short_answer',
          questionNumber: seqNum,
          prompt: `Câu ${seqNum}. Điền đáp số của bài toán:`,
          pdfAttachmentUrl: croppedDataUrl || undefined,
          imageAttachment: croppedDataUrl || undefined,
          correctAnswer: shortAns,
          explanation: fullExplText || '',
          points: 0.5,
        };
        questions.push(qObj);
      } else {
        let mcqAns: 'A' | 'B' | 'C' | 'D' = 'A';
        const inlineAns = (fullQText + '\n' + fullExplText).match(/(?:Đáp\s*án|Chọn|Key)\s*[:\.]?\s*([A-D])\b/i);
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
        const qObj: QuestionPart1MCQ = {
          id: `q_word_${baseTs}_${seqNum}`,
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
          explanation: fullExplText || '',
          points: 0.25,
        };
        questions.push(qObj);
      }
    }

    return {
      questions,
      extractedText,
      metadata: headerMeta,
    };
  } finally {
    iframe.remove();
  }
}

import {
  InkElement,
  InkImageItem,
  InkShape,
  InkStroke,
  InkTextItem,
  NotePage,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PAPER_THEME_META,
  PaperStyle,
  PaperTheme,
} from './types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function drawPaperBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paperStyle: PaperStyle,
  paperTheme: PaperTheme
) {
  const theme = PAPER_THEME_META[paperTheme] || PAPER_THEME_META.white;
  ctx.save();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  if (paperStyle === 'lined') {
    const step = 44;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let y = step; y < height; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();

    // Scrble Ink dual vertical left & right margin rules
    ctx.strokeStyle =
      paperTheme === 'slate' || paperTheme === 'chalkboard'
        ? 'rgba(244, 63, 94, 0.28)'
        : 'rgba(225, 29, 72, 0.34)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(76.5, 0);
    ctx.lineTo(76.5, height);
    ctx.moveTo(width - 76.5, 0);
    ctx.lineTo(width - 76.5, height);
    ctx.stroke();
  } else if (paperStyle === 'grid') {
    const minor = 28;
    const major = minor * 5;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = minor; x < width; x += minor) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = minor; y < height; y += minor) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle =
      paperTheme === 'slate' || paperTheme === 'chalkboard'
        ? 'rgba(148, 163, 184, 0.26)'
        : 'rgba(100, 116, 139, 0.28)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let x = major; x < width; x += major) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = major; y < height; y += major) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
  } else if (paperStyle === 'dots') {
    const step = 32;
    ctx.fillStyle = theme.dot;
    for (let x = step; x < width; x += step) {
      for (let y = step; y < height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

export function drawInkStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = stroke.opacity ?? 0.34;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'pencil') {
    ctx.globalAlpha = stroke.opacity ?? 0.88;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, Math.max(0.75, stroke.width / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Ink pen: pressure & velocity responsive quadratic segments
  ctx.globalAlpha = stroke.opacity ?? 1;
  if (pts.length === 1) {
    const r = Math.max(1, (stroke.width * (0.65 + pts[0].p * 0.55)) / 2);
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  let prevX = pts[0].x;
  let prevY = pts[0].y;
  let prevWidth = stroke.width * (0.65 + Math.min(1, Math.max(0.15, pts[0].p)) * 0.55);

  for (let i = 1; i < pts.length; i++) {
    const pCurr = pts[i];
    const pNext = pts[i + 1];
    const endX = pNext ? (pCurr.x + pNext.x) / 2 : pCurr.x;
    const endY = pNext ? (pCurr.y + pNext.y) / 2 : pCurr.y;

    const dx = pCurr.x - pts[i - 1].x;
    const dy = pCurr.y - pts[i - 1].y;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(1, pCurr.t - pts[i - 1].t);
    const speed = dist / dt; // px per ms
    const speedTapering = Math.max(0.72, Math.min(1.12, 1.08 - speed * 0.1));
    const pressureFactor = pCurr.p !== 0.5 ? 0.58 + pCurr.p * 0.68 : speedTapering;
    const targetWidth = Math.max(1, stroke.width * pressureFactor);
    const segWidth = prevWidth * 0.65 + targetWidth * 0.35;

    ctx.beginPath();
    ctx.lineWidth = segWidth;
    ctx.moveTo(prevX, prevY);
    ctx.quadraticCurveTo(pCurr.x, pCurr.y, endX, endY);
    ctx.stroke();

    prevX = endX;
    prevY = endY;
    prevWidth = segWidth;
  }

  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLen: number
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

export function drawInkShape(ctx: CanvasRenderingContext2D, shape: InkShape) {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const { x1, y1, x2, y2 } = shape;
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  if (shape.shape === 'line') {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (shape.shape === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const headLen = Math.max(12, shape.width * 4);
    drawArrowHead(ctx, x1, y1, x2, y2, headLen);
  } else if (shape.shape === 'rect') {
    ctx.strokeRect(minX, minY, w, h);
  } else if (shape.shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(minX + w / 2, minY + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.shape === 'axes') {
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const headLen = Math.max(10, shape.width * 3.5);

    // X axis
    ctx.beginPath();
    ctx.moveTo(minX, cy);
    ctx.lineTo(minX + w, cy);
    ctx.stroke();
    if (w > 24) drawArrowHead(ctx, minX, cy, minX + w, cy, headLen);

    // Y axis (pointing up)
    ctx.beginPath();
    ctx.moveTo(cx, minY + h);
    ctx.lineTo(cx, minY);
    ctx.stroke();
    if (h > 24) drawArrowHead(ctx, cx, minY + h, cx, minY, headLen);

    // Tick marks
    const tickStep = 36;
    ctx.lineWidth = Math.max(1, shape.width * 0.7);
    ctx.beginPath();
    for (let tx = cx + tickStep; tx < minX + w - 16; tx += tickStep) {
      ctx.moveTo(tx, cy - 4);
      ctx.lineTo(tx, cy + 4);
    }
    for (let tx = cx - tickStep; tx > minX + 10; tx -= tickStep) {
      ctx.moveTo(tx, cy - 4);
      ctx.lineTo(tx, cy + 4);
    }
    for (let ty = cy + tickStep; ty < minY + h - 10; ty += tickStep) {
      ctx.moveTo(cx - 4, ty);
      ctx.lineTo(cx + 4, ty);
    }
    for (let ty = cy - tickStep; ty > minY + 16; ty -= tickStep) {
      ctx.moveTo(cx - 4, ty);
      ctx.lineTo(cx + 4, ty);
    }
    ctx.stroke();

    // Axis labels
    ctx.font = 'italic 600 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('O', cx - 20, cy + 20);
    ctx.fillText('x', minX + w - 14, cy + 22);
    ctx.fillText('y', cx + 12, minY + 16);
  }

  ctx.restore();
}

export function drawInkText(ctx: CanvasRenderingContext2D, item: InkTextItem) {
  if (!item.text) return;
  ctx.save();
  ctx.fillStyle = item.color;
  const size = item.fontSize || 22;
  ctx.font = `600 ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const lines = item.text.split('\n');
  const lineHeight = size * 1.35;
  lines.forEach((line, idx) => {
    ctx.fillText(line, item.x, item.y + idx * lineHeight);
  });
  ctx.restore();
}

export function drawInkImage(
  ctx: CanvasRenderingContext2D,
  item: InkImageItem,
  imageCache: Map<string, HTMLImageElement>,
  onImageLoad?: () => void
) {
  let img = imageCache.get(item.id);
  if (!img) {
    img = new Image();
    img.onload = () => {
      onImageLoad?.();
    };
    img.onerror = () => {
      onImageLoad?.();
    };
    img.src = item.dataUrl;
    imageCache.set(item.id, img);
  }
  if (img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.drawImage(img, item.x, item.y, item.width, item.height);
    ctx.restore();
  } else {
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(item.x, item.y, item.width, item.height);
    ctx.restore();
  }
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  el: InkElement,
  imageCache: Map<string, HTMLImageElement>,
  onImageLoad?: () => void
) {
  if (el.kind === 'stroke') {
    drawInkStroke(ctx, el);
  } else if (el.kind === 'shape') {
    drawInkShape(ctx, el);
  } else if (el.kind === 'text') {
    drawInkText(ctx, el);
  } else if (el.kind === 'image') {
    drawInkImage(ctx, el, imageCache, onImageLoad);
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function getElementBounds(el: InkElement): Bounds {
  if (el.kind === 'stroke') {
    if (!Array.isArray(el.points) || el.points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(4, el.width / 2);
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  }
  if (el.kind === 'shape') {
    const pad = Math.max(4, el.width / 2);
    return {
      minX: Math.min(el.x1, el.x2) - pad,
      minY: Math.min(el.y1, el.y2) - pad,
      maxX: Math.max(el.x1, el.x2) + pad,
      maxY: Math.max(el.y1, el.y2) + pad,
    };
  }
  if (el.kind === 'text') {
    const lines = (el.text || '').split('\n');
    const size = el.fontSize || 22;
    const maxLen = lines.reduce((m, l) => Math.max(m, l.length), 1);
    const estWidth = Math.max(48, maxLen * size * 0.62 + 8);
    const estHeight = Math.max(size * 1.4, lines.length * size * 1.38);
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + estWidth,
      maxY: el.y + estHeight,
    };
  }
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + el.width,
    maxY: el.y + el.height,
  };
}

export function hitTestElement(el: InkElement, x: number, y: number, radius: number = 14): boolean {
  if (el.kind === 'stroke') {
    const threshold = radius + el.width * 0.55;
    const pts = el.points;
    if (pts.length === 0) return false;
    if (pts.length === 1) {
      return Math.hypot(x - pts[0].x, y - pts[0].y) <= threshold;
    }
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= threshold) {
        return true;
      }
    }
    return false;
  }

  if (el.kind === 'shape') {
    const threshold = radius + el.width * 0.5;
    if (el.shape === 'line' || el.shape === 'arrow') {
      return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= threshold;
    }
    const minX = Math.min(el.x1, el.x2);
    const maxX = Math.max(el.x1, el.x2);
    const minY = Math.min(el.y1, el.y2);
    const maxY = Math.max(el.y1, el.y2);
    if (el.shape === 'rect') {
      return (
        distToSegment(x, y, minX, minY, maxX, minY) <= threshold ||
        distToSegment(x, y, maxX, minY, maxX, maxY) <= threshold ||
        distToSegment(x, y, maxX, maxY, minX, maxY) <= threshold ||
        distToSegment(x, y, minX, maxY, minX, minY) <= threshold
      );
    }
    if (el.shape === 'axes') {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return (
        distToSegment(x, y, minX, cy, maxX, cy) <= threshold ||
        distToSegment(x, y, cx, minY, cx, maxY) <= threshold
      );
    }
    // Ellipse boundary approximation
    const rx = Math.max(1, (maxX - minX) / 2);
    const ry = Math.max(1, (maxY - minY) / 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const normDist = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return Math.abs(normDist - 1) * Math.min(rx, ry) <= threshold + 6;
  }

  const b = getElementBounds(el);
  return x >= b.minX - radius && x <= b.maxX + radius && y >= b.minY - radius && y <= b.maxY + radius;
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function translateElement(el: InkElement, dx: number, dy: number): InkElement {
  if (el.kind === 'stroke') {
    return {
      ...el,
      points: el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };
  }
  if (el.kind === 'shape') {
    return {
      ...el,
      x1: el.x1 + dx,
      y1: el.y1 + dy,
      x2: el.x2 + dx,
      y2: el.y2 + dy,
    };
  }
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
  };
}

export function recolorElement(el: InkElement, color: string): InkElement {
  if (el.kind === 'image') return el;
  return { ...el, color };
}

export async function renderPageToCanvas(
  page: NotePage,
  scale: number = 1.5
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_WIDTH * scale);
  canvas.height = Math.round(PAGE_HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);
  drawPaperBackground(ctx, PAGE_WIDTH, PAGE_HEIGHT, page.paperStyle, page.paperTheme);

  const imgCache = new Map<string, HTMLImageElement>();
  const imageElements = page.elements.filter((el): el is InkImageItem => el.kind === 'image');
  await Promise.all(
    imageElements.map(
      (imgEl) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            imgCache.set(imgEl.id, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = imgEl.dataUrl;
        })
    )
  );

  if (page.pageTitle && page.pageTitle.trim()) {
    ctx.save();
    ctx.fillStyle =
      page.paperTheme === 'slate' || page.paperTheme === 'chalkboard' ? '#f8fafc' : '#0f172a';
    ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(page.pageTitle.trim(), 96, 66);
    ctx.restore();
  }

  // Render images first, then shapes/strokes/text in natural order
  for (const el of page.elements) {
    if (el.kind === 'image') {
      drawInkImage(ctx, el, imgCache);
    }
  }
  for (const el of page.elements) {
    if (el.kind !== 'image') {
      drawElement(ctx, el, imgCache);
    }
  }

  return canvas;
}

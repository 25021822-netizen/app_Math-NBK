import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  InkElement,
  InkPoint,
  InkShape,
  InkStroke,
  InkTextItem,
  InkTool,
  MATH_QUICK_SYMBOLS,
  NotePage,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  isShapeTool,
} from './types';
import {
  Bounds,
  boundsIntersect,
  drawElement,
  drawInkShape,
  drawInkStroke,
  drawPaperBackground,
  getElementBounds,
  hitTestElement,
  translateElement,
} from './inkRenderer';

interface LaserPoint {
  x: number;
  y: number;
  t: number;
}

interface LaserStroke {
  points: LaserPoint[];
}

export interface InkPageCanvasProps {
  page: NotePage;
  pageIndex: number;
  totalPages: number;
  isActive: boolean;
  zoom: number;
  tool: InkTool;
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  highlighterWidth: number;
  stylusOnly: boolean;
  isSpacePressed: boolean;
  selectedIds: string[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onFocusPage: (pageIndex: number) => void;
  onSelectIds: (ids: string[]) => void;
  onCommitElements: (pageIndex: number, nextElements: InkElement[], recordHistory?: boolean) => void;
  onEraseElements: (pageIndex: number, erasedIds: Set<string>, pushHistoryOnce: boolean) => void;
  onUpdatePageTitle: (pageIndex: number, title: string) => void;
  onDismissPopovers: () => void;
  onNearBottomWrite?: (pageIndex: number) => void;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const InkPageCanvas: React.FC<InkPageCanvasProps> = ({
  page,
  pageIndex,
  totalPages,
  isActive,
  zoom,
  tool,
  penColor,
  penWidth,
  highlighterColor,
  highlighterWidth,
  stylusOnly,
  isSpacePressed,
  selectedIds,
  viewportRef,
  onFocusPage,
  onSelectIds,
  onCommitElements,
  onEraseElements,
  onUpdatePageTitle,
  onDismissPopovers,
  onNearBottomWrite,
}) => {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imageLoadTick, setImageLoadTick] = useState<number>(0);

  const [editingTitleBox, setEditingTitleBox] = useState<boolean>(false);
  const [pageTitleDraft, setPageTitleDraft] = useState<string>(page.pageTitle || '');

  useEffect(() => {
    setPageTitleDraft(page.pageTitle || '');
  }, [page.pageTitle]);

  const [editingText, setEditingText] = useState<{
    id: string | null;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
  } | null>(null);

  // Live drawing refs
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const activeShapeRef = useRef<InkShape | null>(null);
  const marqueeBoxRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const draggingSelectionRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    ids: Set<string>;
  } | null>(null);
  const panningRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const eraserHistoryPushedRef = useRef<boolean>(false);
  const erasedThisGestureRef = useRef<Set<string>>(new Set());
  const laserStrokesRef = useRef<LaserStroke[]>([]);
  const isDrawingLaserRef = useRef<boolean>(false);
  const overlayRafRef = useRef<number | null>(null);

  const pageSelectedIds = isActive ? selectedIds : [];

  const redrawBaseCanvas = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(PAGE_WIDTH * dpr);
    const targetH = Math.round(PAGE_HEIGHT * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPaperBackground(ctx, PAGE_WIDTH, PAGE_HEIGHT, page.paperStyle, page.paperTheme);

    const hiddenDuringDrag = draggingSelectionRef.current?.active
      ? draggingSelectionRef.current.ids
      : null;

    for (const el of page.elements) {
      if (el.kind === 'image' && (!hiddenDuringDrag || !hiddenDuringDrag.has(el.id))) {
        drawElement(ctx, el, imageCacheRef.current, () => setImageLoadTick((n) => n + 1));
      }
    }
    for (const el of page.elements) {
      if (el.kind !== 'image' && (!hiddenDuringDrag || !hiddenDuringDrag.has(el.id))) {
        drawElement(ctx, el, imageCacheRef.current, () => setImageLoadTick((n) => n + 1));
      }
    }
    ctx.restore();
  }, [page, imageLoadTick]);

  const redrawOverlayCanvas = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(PAGE_WIDTH * dpr);
    const targetH = Math.round(PAGE_HEIGHT * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Dragged elements preview
    const drag = draggingSelectionRef.current;
    if (drag?.active) {
      ctx.save();
      ctx.translate(drag.dx, drag.dy);
      for (const el of page.elements) {
        if (drag.ids.has(el.id)) {
          drawElement(ctx, el, imageCacheRef.current);
        }
      }
      ctx.restore();
    }

    // 2. Active stroke
    if (activeStrokeRef.current) {
      drawInkStroke(ctx, activeStrokeRef.current);
    }

    // 3. Active shape
    if (activeShapeRef.current) {
      drawInkShape(ctx, activeShapeRef.current);
    }

    // 4. Selection bounding box
    if (pageSelectedIds.length > 0) {
      const selSet = new Set(pageSelectedIds);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let found = false;
      const dx = drag?.active ? drag.dx : 0;
      const dy = drag?.active ? drag.dy : 0;

      for (const el of page.elements) {
        if (!selSet.has(el.id)) continue;
        const b = getElementBounds(el);
        minX = Math.min(minX, b.minX + dx);
        minY = Math.min(minY, b.minY + dy);
        maxX = Math.max(maxX, b.maxX + dx);
        maxY = Math.max(maxY, b.maxY + dy);
        found = true;
      }

      if (found) {
        const pad = 8;
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.75;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        const corners = [
          [minX - pad, minY - pad],
          [maxX + pad, minY - pad],
          [minX - pad, maxY + pad],
          [maxX + pad, maxY + pad],
        ];
        corners.forEach(([cx, cy]) => {
          ctx.fillRect(cx - 4, cy - 4, 8, 8);
          ctx.strokeRect(cx - 4, cy - 4, 8, 8);
        });
        ctx.restore();
      }
    }

    // 5. Marquee selection box
    if (marqueeBoxRef.current) {
      const m = marqueeBoxRef.current;
      const rx = Math.min(m.x1, m.x2);
      const ry = Math.min(m.y1, m.y2);
      const rw = Math.abs(m.x2 - m.x1);
      const rh = Math.abs(m.y2 - m.y1);
      ctx.save();
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    // 6. Laser trails
    if (laserStrokesRef.current.length > 0) {
      const now = performance.now();
      const maxAge = 1150;
      const nextLasers: LaserStroke[] = [];

      for (const ls of laserStrokesRef.current) {
        const freshPts = ls.points.filter((pt) => now - pt.t < maxAge);
        if (freshPts.length > 1) {
          nextLasers.push({ points: freshPts });
          for (let i = 1; i < freshPts.length; i++) {
            const p0 = freshPts[i - 1];
            const p1 = freshPts[i];
            const age = now - p1.t;
            const alpha = Math.max(0, 1 - age / maxAge);

            ctx.save();
            ctx.lineCap = 'round';
            ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.45})`;
            ctx.lineWidth = 14 * alpha + 2;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();

            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 4 * alpha + 1;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.restore();
          }
          const tip = freshPts[freshPts.length - 1];
          const tipAlpha = Math.max(0, 1 - (now - tip.t) / maxAge);
          if (tipAlpha > 0.05) {
            ctx.save();
            ctx.fillStyle = `rgba(239, 68, 68, ${tipAlpha})`;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 255, ${tipAlpha})`;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
      laserStrokesRef.current = nextLasers;
    }

    ctx.restore();
  }, [page.elements, pageSelectedIds]);

  const scheduleOverlayRedraw = useCallback(() => {
    if (overlayRafRef.current !== null) return;
    overlayRafRef.current = requestAnimationFrame(() => {
      overlayRafRef.current = null;
      redrawOverlayCanvas();
      if (laserStrokesRef.current.length > 0) {
        scheduleOverlayRedraw();
      }
    });
  }, [redrawOverlayCanvas]);

  useEffect(() => {
    redrawBaseCanvas();
    redrawOverlayCanvas();
  }, [redrawBaseCanvas, redrawOverlayCanvas]);

  useEffect(() => {
    return () => {
      if (overlayRafRef.current !== null) cancelAnimationFrame(overlayRafRef.current);
    };
  }, []);

  const handleCommitText = () => {
    if (!editingText) return;
    const trimmed = editingText.text.trim();
    if (editingText.id) {
      if (!trimmed) {
        onCommitElements(
          pageIndex,
          page.elements.filter((el) => el.id !== editingText.id)
        );
      } else {
        onCommitElements(
          pageIndex,
          page.elements.map((el) =>
            el.id === editingText.id && el.kind === 'text'
              ? { ...el, text: editingText.text, fontSize: editingText.fontSize, color: editingText.color }
              : el
          )
        );
      }
    } else if (trimmed) {
      const newText: InkTextItem = {
        id: createId('txt'),
        kind: 'text',
        x: editingText.x,
        y: editingText.y,
        text: editingText.text,
        color: editingText.color,
        fontSize: editingText.fontSize,
      };
      onCommitElements(pageIndex, [...page.elements, newText]);
    }
    setEditingText(null);
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): InkPoint | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = PAGE_HEIGHT / rect.height;
    const x = Math.max(0, Math.min(PAGE_WIDTH, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(PAGE_HEIGHT, (e.clientY - rect.top) * scaleY));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return { x, y, p, t: performance.now() };
  };

  const applyStrokeEraserAt = (x: number, y: number) => {
    const hit = page.elements.filter(
      (el) =>
        el.kind !== 'image' &&
        !erasedThisGestureRef.current.has(el.id) &&
        hitTestElement(el, x, y, 16)
    );
    if (hit.length === 0) return;
    hit.forEach((h) => erasedThisGestureRef.current.add(h.id));
    const pushHistoryOnce = !eraserHistoryPushedRef.current;
    eraserHistoryPushedRef.current = true;
    onEraseElements(pageIndex, new Set(erasedThisGestureRef.current), pushHistoryOnce);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    onFocusPage(pageIndex);
    onDismissPopovers();

    if (stylusOnly && e.pointerType === 'touch') {
      return;
    }

    if (editingText) {
      handleCommitText();
    }

    // Pan with hand tool, spacebar, or middle mouse button
    if (tool === 'hand' || isSpacePressed || e.button === 1) {
      const vp = viewportRef.current;
      if (!vp) return;
      isPointerDownRef.current = true;
      panningRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        scrollLeft: vp.scrollLeft,
        scrollTop: vp.scrollTop,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (e.button !== 0) return;

    const pt = getCanvasPoint(e);
    if (!pt) return;

    if (tool === 'text') {
      const hitText = [...page.elements]
        .reverse()
        .find((el): el is InkTextItem => el.kind === 'text' && hitTestElement(el, pt.x, pt.y, 12));
      if (hitText) {
        setEditingText({
          id: hitText.id,
          x: hitText.x,
          y: hitText.y,
          text: hitText.text,
          fontSize: hitText.fontSize || 24,
          color: hitText.color,
        });
      } else {
        setEditingText({
          id: null,
          x: Math.min(PAGE_WIDTH - 240, Math.max(16, pt.x)),
          y: Math.min(PAGE_HEIGHT - 90, Math.max(16, pt.y)),
          text: '',
          fontSize: 24,
          color: penColor,
        });
      }
      return;
    }

    isPointerDownRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    if (tool === 'laser') {
      isDrawingLaserRef.current = true;
      laserStrokesRef.current.push({ points: [{ x: pt.x, y: pt.y, t: pt.t }] });
      scheduleOverlayRedraw();
      return;
    }

    if (tool === 'eraser_stroke') {
      erasedThisGestureRef.current.clear();
      eraserHistoryPushedRef.current = false;
      applyStrokeEraserAt(pt.x, pt.y);
      return;
    }

    if (tool === 'select') {
      const selSet = new Set(pageSelectedIds);
      if (pageSelectedIds.length > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of page.elements) {
          if (!selSet.has(el.id)) continue;
          const b = getElementBounds(el);
          minX = Math.min(minX, b.minX);
          minY = Math.min(minY, b.minY);
          maxX = Math.max(maxX, b.maxX);
          maxY = Math.max(maxY, b.maxY);
        }
        if (pt.x >= minX - 10 && pt.x <= maxX + 10 && pt.y >= minY - 10 && pt.y <= maxY + 10) {
          draggingSelectionRef.current = {
            active: true,
            startX: pt.x,
            startY: pt.y,
            dx: 0,
            dy: 0,
            ids: selSet,
          };
          redrawBaseCanvas();
          scheduleOverlayRedraw();
          return;
        }
      }

      const hitEl = [...page.elements].reverse().find((el) => hitTestElement(el, pt.x, pt.y, 12));
      if (hitEl) {
        const nextSelected = e.shiftKey
          ? pageSelectedIds.includes(hitEl.id)
            ? pageSelectedIds.filter((id) => id !== hitEl.id)
            : [...pageSelectedIds, hitEl.id]
          : [hitEl.id];
        onSelectIds(nextSelected);
        draggingSelectionRef.current = {
          active: true,
          startX: pt.x,
          startY: pt.y,
          dx: 0,
          dy: 0,
          ids: new Set(nextSelected),
        };
        redrawBaseCanvas();
        scheduleOverlayRedraw();
      } else {
        onSelectIds([]);
        marqueeBoxRef.current = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
        scheduleOverlayRedraw();
      }
      return;
    }

    if (isShapeTool(tool)) {
      onSelectIds([]);
      activeShapeRef.current = {
        id: createId('shp'),
        kind: 'shape',
        shape: tool,
        color: penColor,
        width: Math.max(2, Math.min(8, penWidth)),
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
      };
      scheduleOverlayRedraw();
      return;
    }

    if (tool === 'pen' || tool === 'pencil' || tool === 'highlighter') {
      onSelectIds([]);
      const isHighlight = tool === 'highlighter';
      activeStrokeRef.current = {
        id: createId('str'),
        kind: 'stroke',
        tool,
        color: isHighlight ? highlighterColor : penColor,
        width: isHighlight ? highlighterWidth : penWidth,
        opacity: isHighlight ? 0.34 : tool === 'pencil' ? 0.88 : 1,
        points: [pt],
      };
      scheduleOverlayRedraw();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;

    if (panningRef.current?.active) {
      const vp = viewportRef.current;
      if (!vp) return;
      vp.scrollLeft = panningRef.current.scrollLeft - (e.clientX - panningRef.current.startClientX);
      vp.scrollTop = panningRef.current.scrollTop - (e.clientY - panningRef.current.startClientY);
      return;
    }

    const pt = getCanvasPoint(e);
    if (!pt) return;

    if (isDrawingLaserRef.current && laserStrokesRef.current.length > 0) {
      const currentLaser = laserStrokesRef.current[laserStrokesRef.current.length - 1];
      currentLaser.points.push({ x: pt.x, y: pt.y, t: pt.t });
      scheduleOverlayRedraw();
      return;
    }

    if (tool === 'eraser_stroke') {
      applyStrokeEraserAt(pt.x, pt.y);
      return;
    }

    if (draggingSelectionRef.current?.active) {
      draggingSelectionRef.current.dx = pt.x - draggingSelectionRef.current.startX;
      draggingSelectionRef.current.dy = pt.y - draggingSelectionRef.current.startY;
      scheduleOverlayRedraw();
      return;
    }

    if (marqueeBoxRef.current) {
      marqueeBoxRef.current.x2 = pt.x;
      marqueeBoxRef.current.y2 = pt.y;
      scheduleOverlayRedraw();
      return;
    }

    if (activeShapeRef.current) {
      let x2 = pt.x;
      let y2 = pt.y;
      if (e.shiftKey) {
        const dx = x2 - activeShapeRef.current.x1;
        const dy = y2 - activeShapeRef.current.y1;
        if (
          activeShapeRef.current.shape === 'line' ||
          activeShapeRef.current.shape === 'dashed_line' ||
          activeShapeRef.current.shape === 'dashdot_line' ||
          activeShapeRef.current.shape === 'arrow' ||
          activeShapeRef.current.shape === 'double_arrow' ||
          activeShapeRef.current.shape === 'ray'
        ) {
          const angle = Math.atan2(dy, dx);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const dist = Math.hypot(dx, dy);
          x2 = activeShapeRef.current.x1 + Math.cos(snapped) * dist;
          y2 = activeShapeRef.current.y1 + Math.sin(snapped) * dist;
        } else {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          x2 = activeShapeRef.current.x1 + Math.sign(dx || 1) * side;
          y2 = activeShapeRef.current.y1 + Math.sign(dy || 1) * side;
        }
      }
      activeShapeRef.current = { ...activeShapeRef.current, x2, y2 };
      scheduleOverlayRedraw();
      return;
    }

    if (activeStrokeRef.current) {
      const pts = activeStrokeRef.current.points;
      const last = pts[pts.length - 1];
      const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
      if (dist >= 1.5) {
        pts.push(pt);
        scheduleOverlayRedraw();
      }
    }
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    eraserHistoryPushedRef.current = false;
    erasedThisGestureRef.current.clear();

    if (panningRef.current?.active) {
      panningRef.current = null;
      return;
    }

    if (isDrawingLaserRef.current) {
      isDrawingLaserRef.current = false;
    }

    if (draggingSelectionRef.current?.active) {
      const drag = draggingSelectionRef.current;
      draggingSelectionRef.current = null;
      if (Math.abs(drag.dx) > 1 || Math.abs(drag.dy) > 1) {
        const nextElements = page.elements.map((el) =>
          drag.ids.has(el.id) ? translateElement(el, drag.dx, drag.dy) : el
        );
        onCommitElements(pageIndex, nextElements);
      } else {
        redrawBaseCanvas();
      }
      scheduleOverlayRedraw();
      return;
    }

    if (marqueeBoxRef.current) {
      const m = marqueeBoxRef.current;
      marqueeBoxRef.current = null;
      const box: Bounds = {
        minX: Math.min(m.x1, m.x2),
        minY: Math.min(m.y1, m.y2),
        maxX: Math.max(m.x1, m.x2),
        maxY: Math.max(m.y1, m.y2),
      };
      if (box.maxX - box.minX > 6 || box.maxY - box.minY > 6) {
        const hitIds = page.elements
          .filter((el) => boundsIntersect(getElementBounds(el), box))
          .map((el) => el.id);
        onSelectIds(hitIds);
      }
      scheduleOverlayRedraw();
      return;
    }

    if (activeShapeRef.current) {
      const shp = activeShapeRef.current;
      activeShapeRef.current = null;
      if (Math.hypot(shp.x2 - shp.x1, shp.y2 - shp.y1) > 4) {
        onCommitElements(pageIndex, [...page.elements, shp]);
        if (Math.max(shp.y1, shp.y2) > PAGE_HEIGHT - 120) {
          onNearBottomWrite?.(pageIndex);
        }
      }
      scheduleOverlayRedraw();
      return;
    }

    if (activeStrokeRef.current) {
      const str = activeStrokeRef.current;
      activeStrokeRef.current = null;
      if (str.points.length > 0) {
        onCommitElements(pageIndex, [...page.elements, str]);
        const maxY = str.points.reduce((m, p) => Math.max(m, p.y), 0);
        if (maxY > PAGE_HEIGHT - 120) {
          onNearBottomWrite?.(pageIndex);
        }
      }
      scheduleOverlayRedraw();
    }
  };

  // Standard pointer arrow cursor when writing/drawing (never crosshair '+')
  const canvasCursorClass =
    tool === 'hand' || isSpacePressed
      ? 'cursor-grab active:cursor-grabbing'
      : tool === 'text'
      ? 'cursor-text'
      : 'cursor-default';

  const scaledW = Math.round(PAGE_WIDTH * zoom);
  const scaledH = Math.round(PAGE_HEIGHT * zoom);
  const isDarkPaper = page.paperTheme === 'slate' || page.paperTheme === 'chalkboard';

  return (
    <div data-page-index={pageIndex} className="flex flex-col items-center shrink-0">
      {/* Subtle Page Separator for multi-page continuous scroll */}
      {pageIndex > 0 && (
        <div className="w-full flex items-center justify-center py-2.5 select-none">
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
            <span className="h-px w-16 bg-slate-300/80" />
            <span className="tabular-nums">
              Trang {pageIndex + 1} / {totalPages}
            </span>
            <span className="h-px w-16 bg-slate-300/80" />
          </div>
        </div>
      )}

      <div
        className={`relative shadow-sm shrink-0 border transition-shadow ${
          isActive && totalPages > 1
            ? 'border-blue-300/80'
            : 'border-slate-300/70'
        }`}
        style={{
          width: scaledW,
          height: scaledH,
        }}
      >
        {/* Layer 1: Static Paper + Committed Strokes/Images */}
        <canvas
          ref={baseCanvasRef}
          className="absolute inset-0 block pointer-events-none"
          style={{ width: scaledW, height: scaledH }}
        />

        {/* Layer 2: Active Ink Stroke, Selection, Laser Overlay */}
        <canvas
          ref={overlayCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => {
            const canvas = overlayCanvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const x = ((e.clientX - rect.left) * PAGE_WIDTH) / rect.width;
            const y = ((e.clientY - rect.top) * PAGE_HEIGHT) / rect.height;
            const hitText = [...page.elements]
              .reverse()
              .find(
                (el): el is InkTextItem =>
                  el.kind === 'text' && hitTestElement(el, x, y, 12)
              );
            if (hitText) {
              setEditingText({
                id: hitText.id,
                x: hitText.x,
                y: hitText.y,
                text: hitText.text,
                fontSize: hitText.fontSize || 24,
                color: hitText.color,
              });
            }
          }}
          className={`absolute inset-0 block ${canvasCursorClass}`}
          style={{
            width: scaledW,
            height: scaledH,
            touchAction: 'none',
          }}
        />

        {/* Scrble Ink signature dashed TITLE box on top of Page 1 (pointer-events-none so pen writes seamlessly inside it, click TITLE label to type) */}
        {pageIndex === 0 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${(76.5 / PAGE_WIDTH) * 100}%`,
              right: `${(76.5 / PAGE_WIDTH) * 100}%`,
              top: 0,
              height: `${(132 / PAGE_HEIGHT) * 100}%`,
              border: `1.5px dashed ${isDarkPaper ? 'rgba(148, 163, 184, 0.45)' : 'rgba(100, 116, 139, 0.55)'}`,
              borderTop: 'none',
            }}
          >
            {editingTitleBox ? (
              <div className="pointer-events-auto h-full flex items-center px-3">
                <input
                  type="text"
                  value={pageTitleDraft}
                  onChange={(e) => setPageTitleDraft(e.target.value)}
                  onBlur={() => {
                    onUpdatePageTitle(pageIndex, pageTitleDraft);
                    setEditingTitleBox(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      onUpdatePageTitle(pageIndex, pageTitleDraft);
                      setEditingTitleBox(false);
                    }
                  }}
                  placeholder="Nhập tiêu đề bài ghi chú..."
                  autoFocus
                  className={`w-full bg-transparent text-lg sm:text-2xl font-bold focus:outline-none ${
                    isDarkPaper ? 'text-white placeholder:text-slate-400' : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col justify-between px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onFocusPage(pageIndex);
                    setEditingTitleBox(true);
                  }}
                  title="Nhấn để nhập tiêu đề trang"
                  className={`pointer-events-auto self-start text-[10px] font-bold tracking-wider uppercase cursor-pointer hover:underline ${
                    isDarkPaper ? 'text-sky-300/80' : 'text-sky-600/80'
                  }`}
                >
                  TITLE
                </button>
                {page.pageTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      onFocusPage(pageIndex);
                      setEditingTitleBox(true);
                    }}
                    className={`pointer-events-auto text-left text-base sm:text-xl font-bold truncate cursor-pointer mb-2 ${
                      isDarkPaper ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    {page.pageTitle}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inline Text Editor Overlay */}
        {editingText && (
          <div
            className="absolute z-30 bg-white border border-blue-500 rounded-xl shadow-xl p-2.5 space-y-2 w-72 sm:w-80"
            style={{
              left: Math.max(
                8,
                Math.min(
                  Math.max(8, scaledW - 324),
                  Math.round(editingText.x * zoom)
                )
              ),
              top: Math.max(
                8,
                Math.min(
                  Math.max(8, scaledH - 190),
                  Math.round(editingText.y * zoom)
                )
              ),
            }}
          >
            <textarea
              value={editingText.text}
              onChange={(e) =>
                setEditingText((prev) => (prev ? { ...prev, text: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleCommitText();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingText(null);
                }
              }}
              placeholder="Nhập văn bản hoặc công thức..."
              rows={3}
              autoFocus
              className="w-full p-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500 resize-y"
            />
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {MATH_QUICK_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() =>
                    setEditingText((prev) =>
                      prev ? { ...prev, text: prev.text + sym } : null
                    )
                  }
                  className="w-6 h-6 rounded bg-slate-100 hover:bg-blue-100 text-slate-800 text-xs font-semibold flex items-center justify-center cursor-pointer"
                >
                  {sym}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {[18, 24, 32, 42].map((fs) => (
                  <button
                    key={fs}
                    type="button"
                    onClick={() =>
                      setEditingText((prev) => (prev ? { ...prev, fontSize: fs } : null))
                    }
                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums cursor-pointer ${
                      editingText.fontSize === fs
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {fs}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingText(null)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCommitText}
                  className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                >
                  Chèn
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

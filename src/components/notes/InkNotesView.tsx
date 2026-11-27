import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Eraser,
  FileDown,
  Grid3X3,
  Hand,
  Highlighter,
  ImagePlus,
  Lasso,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PenTool,
  Plus,
  Redo2,
  Search,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  Axis3D,
  Palette,
  AlignJustify,
} from 'lucide-react';
import {
  HIGHLIGHTER_COLOR_SWATCHES,
  INK_COLOR_SWATCHES,
  InkElement,
  InkImageItem,
  InkNoteBook,
  InkPoint,
  InkShape,
  InkStroke,
  InkTextItem,
  InkTool,
  MATH_QUICK_SYMBOLS,
  NotePage,
  NoteSubject,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PAPER_THEME_META,
  PaperStyle,
  PaperTheme,
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
  recolorElement,
  renderPageToCanvas,
  translateElement,
} from './inkRenderer';

interface InkNotesViewProps {
  currentUserId: string;
  currentUserName?: string;
}

interface LaserPoint {
  x: number;
  y: number;
  t: number;
}

interface LaserStroke {
  points: LaserPoint[];
}

interface PageHistory {
  past: InkElement[][];
  future: InkElement[][];
}

const NOTE_SUBJECTS: NoteSubject[] = ['Chung', 'Toán Học', 'Vật Lý', 'Hóa Học'];

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createBlankPage(
  paperStyle: PaperStyle = 'grid',
  paperTheme: PaperTheme = 'white'
): NotePage {
  return {
    id: createId('page'),
    paperStyle,
    paperTheme,
    elements: [],
  };
}

function createNewNotebook(
  title: string = 'Ghi chú mới',
  subject: NoteSubject = 'Toán Học',
  paperStyle: PaperStyle = 'grid',
  paperTheme: PaperTheme = 'white'
): InkNoteBook {
  const now = new Date().toISOString();
  return {
    id: createId('nb'),
    title,
    subject,
    createdAt: now,
    updatedAt: now,
    activePageIndex: 0,
    pages: [createBlankPage(paperStyle, paperTheme)],
  };
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const InkNotesView: React.FC<InkNotesViewProps> = ({
  currentUserId,
  currentUserName,
}) => {
  const storageKey = useMemo(
    () => `math_liki_ink_notes_${(currentUserId || 'guest').trim() || 'guest'}`,
    [currentUserId]
  );

  // ==========================================
  // NOTEBOOKS STATE & PERSISTENCE
  // ==========================================
  const [notebooks, setNotebooks] = useState<InkNoteBook[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [createNewNotebook('Nháp giải bài tập #1', 'Toán Học', 'grid', 'white')];
  });

  const [activeNotebookId, setActiveNotebookId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed[0]?.id) return parsed[0].id;
      }
    } catch {}
    return '';
  });

  // Ensure activeNotebookId points to a valid notebook
  useEffect(() => {
    if (!notebooks.some((n) => n.id === activeNotebookId) && notebooks[0]) {
      setActiveNotebookId(notebooks[0].id);
    }
  }, [notebooks, activeNotebookId]);

  // Reload notebooks if user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotebooks(parsed);
          setActiveNotebookId(parsed[0].id);
          return;
        }
      }
    } catch {}
    const starter = createNewNotebook('Nháp giải bài tập #1', 'Toán Học', 'grid', 'white');
    setNotebooks([starter]);
    setActiveNotebookId(starter.id);
  }, [storageKey]);

  const activeNotebook = useMemo(
    () => notebooks.find((n) => n.id === activeNotebookId) || notebooks[0],
    [notebooks, activeNotebookId]
  );

  const activePageIndex = Math.min(
    Math.max(0, activeNotebook?.activePageIndex ?? 0),
    Math.max(0, (activeNotebook?.pages?.length ?? 1) - 1)
  );
  const activePage: NotePage =
    activeNotebook?.pages?.[activePageIndex] || createBlankPage();

  // Debounced localStorage save + status notice
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(notebooks));
        setSaveWarning(null);
      } catch {
        setSaveWarning('Bộ nhớ trình duyệt gần đầy, hãy xuất PDF/PNG để lưu trữ bản sao.');
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [notebooks, storageKey]);

  // ==========================================
  // UI & TOOL STATES
  // ==========================================
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<'Tất cả' | NoteSubject>('Tất cả');
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>('');

  const [tool, setTool] = useState<InkTool>('pen');
  const [lastShapeTool, setLastShapeTool] = useState<'line' | 'arrow' | 'rect' | 'ellipse' | 'axes'>('line');
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const [showPaperMenu, setShowPaperMenu] = useState<boolean>(false);
  const [confirmClearPage, setConfirmClearPage] = useState<boolean>(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [confirmDeletePage, setConfirmDeletePage] = useState<boolean>(false);

  const [penColor, setPenColor] = useState<string>('#0f172a');
  const [penWidth, setPenWidth] = useState<number>(3.5);
  const [highlighterColor, setHighlighterColor] = useState<string>('#facc15');
  const [highlighterWidth, setHighlighterWidth] = useState<number>(22);
  const [stylusOnly, setStylusOnly] = useState<boolean>(false);

  const [zoom, setZoom] = useState<number>(0.78);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Selection & inline text editor
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingText, setEditingText] = useState<{
    id: string | null;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
  } | null>(null);

  // Undo / Redo history per page id
  const historyMapRef = useRef<Map<string, PageHistory>>(new Map());
  const [historyTick, setHistoryTick] = useState<number>(0);

  // Canvas & image cache refs
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageLoadTick, setImageLoadTick] = useState<number>(0);

  // Live drawing refs (not stored in React state during pointermove for 60-120fps)
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
  const erasedThisGestureRef = useRef<Set<string>>(new Set());
  const laserStrokesRef = useRef<LaserStroke[]>([]);
  const isDrawingLaserRef = useRef<boolean>(false);
  const overlayRafRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Auto-fit initial zoom to viewport width on mount
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const availW = Math.max(320, el.clientWidth - 48);
    const fit = Math.min(1, Math.max(0.45, Number((availW / PAGE_WIDTH).toFixed(2))));
    setZoom(fit);
  }, []);

  // ==========================================
  // PAGE MUTATION + UNDO / REDO HELPERS
  // ==========================================
  const getPageHistory = (pageId: string): PageHistory => {
    let h = historyMapRef.current.get(pageId);
    if (!h) {
      h = { past: [], future: [] };
      historyMapRef.current.set(pageId, h);
    }
    return h;
  };

  const commitPageElements = useCallback(
    (nextElements: InkElement[], recordHistory: boolean = true) => {
      if (!activeNotebook || !activePage) return;
      const pageId = activePage.id;

      if (recordHistory) {
        const h = getPageHistory(pageId);
        h.past.push(activePage.elements);
        if (h.past.length > 40) h.past.shift();
        h.future = [];
        setHistoryTick((t) => t + 1);
      }

      const now = new Date().toISOString();
      setNotebooks((prev) =>
        prev.map((nb) => {
          if (nb.id !== activeNotebook.id) return nb;
          const nextPages = nb.pages.map((p, idx) =>
            idx === activePageIndex ? { ...p, elements: nextElements } : p
          );
          return { ...nb, updatedAt: now, pages: nextPages };
        })
      );
    },
    [activeNotebook, activePage, activePageIndex]
  );

  const currentHistory = getPageHistory(activePage.id);
  const canUndo = currentHistory.past.length > 0;
  const canRedo = currentHistory.future.length > 0;
  void historyTick;

  const handleUndo = useCallback(() => {
    if (!activeNotebook || !activePage) return;
    const h = getPageHistory(activePage.id);
    if (h.past.length === 0) return;
    const prevElements = h.past.pop()!;
    h.future.push(activePage.elements);
    setSelectedIds([]);
    setHistoryTick((t) => t + 1);

    const now = new Date().toISOString();
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id !== activeNotebook.id
          ? nb
          : {
              ...nb,
              updatedAt: now,
              pages: nb.pages.map((p, idx) =>
                idx === activePageIndex ? { ...p, elements: prevElements } : p
              ),
            }
      )
    );
  }, [activeNotebook, activePage, activePageIndex]);

  const handleRedo = useCallback(() => {
    if (!activeNotebook || !activePage) return;
    const h = getPageHistory(activePage.id);
    if (h.future.length === 0) return;
    const nextElements = h.future.pop()!;
    h.past.push(activePage.elements);
    setSelectedIds([]);
    setHistoryTick((t) => t + 1);

    const now = new Date().toISOString();
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id !== activeNotebook.id
          ? nb
          : {
              ...nb,
              updatedAt: now,
              pages: nb.pages.map((p, idx) =>
                idx === activePageIndex ? { ...p, elements: nextElements } : p
              ),
            }
      )
    );
  }, [activeNotebook, activePage, activePageIndex]);

  // ==========================================
  // RENDERING: BASE CANVAS & OVERLAY CANVAS
  // ==========================================
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
    drawPaperBackground(ctx, PAGE_WIDTH, PAGE_HEIGHT, activePage.paperStyle, activePage.paperTheme);

    const hiddenDuringDrag = draggingSelectionRef.current?.active
      ? draggingSelectionRef.current.ids
      : null;

    // Draw images below strokes/shapes
    for (const el of activePage.elements) {
      if (el.kind === 'image' && (!hiddenDuringDrag || !hiddenDuringDrag.has(el.id))) {
        drawElement(ctx, el, imageCacheRef.current, () => setImageLoadTick((n) => n + 1));
      }
    }
    for (const el of activePage.elements) {
      if (el.kind !== 'image' && (!hiddenDuringDrag || !hiddenDuringDrag.has(el.id))) {
        drawElement(ctx, el, imageCacheRef.current, () => setImageLoadTick((n) => n + 1));
      }
    }
    ctx.restore();
  }, [activePage, imageLoadTick]);

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
      for (const el of activePage.elements) {
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
    if (selectedIds.length > 0) {
      const selSet = new Set(selectedIds);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let found = false;
      const dx = drag?.active ? drag.dx : 0;
      const dy = drag?.active ? drag.dy : 0;

      for (const el of activePage.elements) {
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
        // Corner handles
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
  }, [activePage.elements, selectedIds]);

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

  // ==========================================
  // KEYBOARD SHORTCUTS & PASTE IMAGE
  // ==========================================
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.code === 'Space' && !isTyping) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const delSet = new Set(selectedIds);
        commitPageElements(activePage.elements.filter((el) => !delSet.has(el.id)));
        setSelectedIds([]);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleUndo, handleRedo, selectedIds, activePage.elements, commitPageElements]);

  const insertImageDataUrl = useCallback(
    (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 680;
        const maxH = 520;
        let w = img.naturalWidth || 400;
        let h = img.naturalHeight || 300;
        const ratio = Math.min(1, maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);

        const newItem: InkImageItem = {
          id: createId('img'),
          kind: 'image',
          x: Math.round((PAGE_WIDTH - w) / 2),
          y: Math.round((PAGE_HEIGHT - h) / 2),
          width: w,
          height: h,
          dataUrl,
        };
        commitPageElements([...activePage.elements, newItem]);
        setSelectedIds([newItem.id]);
        setTool('select');
        showToast('Đã chèn ảnh vào trang ghi chú');
      };
      img.src = dataUrl;
    },
    [activePage.elements, commitPageElements, showToast]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                insertImageDataUrl(reader.result);
              }
            };
            reader.readAsDataURL(file);
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [insertImageDataUrl]);

  // ==========================================
  // POINTER INTERACTIONS ON CANVAS
  // ==========================================
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): InkPoint => {
    const canvas = overlayCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = PAGE_HEIGHT / rect.height;
    const x = Math.max(0, Math.min(PAGE_WIDTH, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(PAGE_HEIGHT, (e.clientY - rect.top) * scaleY));
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return { x, y, p, t: performance.now() };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setShowShapeMenu(false);
    setShowPaperMenu(false);
    setConfirmClearPage(false);
    setConfirmDeletePage(false);

    if (stylusOnly && e.pointerType === 'touch') {
      return;
    }

    // Pan with hand tool, spacebar, or middle mouse button
    if (tool === 'hand' || isSpacePressed || e.button === 1) {
      const vp = viewportRef.current;
      if (!vp) return;
      panningRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        scrollLeft: vp.scrollLeft,
        scrollTop: vp.scrollTop,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    const pt = getCanvasPoint(e);

    // Text tool
    if (tool === 'text') {
      // Check if clicking an existing text box to edit
      const hitText = [...activePage.elements]
        .reverse()
        .find((el): el is InkTextItem => el.kind === 'text' && hitTestElement(el, pt.x, pt.y, 10));
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

    e.currentTarget.setPointerCapture(e.pointerId);

    // Laser pointer
    if (tool === 'laser') {
      isDrawingLaserRef.current = true;
      laserStrokesRef.current.push({ points: [{ x: pt.x, y: pt.y, t: pt.t }] });
      scheduleOverlayRedraw();
      return;
    }

    // Stroke eraser (erases strokes, shapes, text; protects background images)
    if (tool === 'eraser_stroke') {
      erasedThisGestureRef.current.clear();
      const hit = [...activePage.elements]
        .reverse()
        .find((el) => el.kind !== 'image' && hitTestElement(el, pt.x, pt.y, 14));
      if (hit) {
        erasedThisGestureRef.current.add(hit.id);
        commitPageElements(activePage.elements.filter((el) => el.id !== hit.id));
      }
      return;
    }

    // Select & Move
    if (tool === 'select') {
      const selSet = new Set(selectedIds);
      // Check if clicking inside existing selection bounding box
      if (selectedIds.length > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of activePage.elements) {
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

      // Hit-test topmost element
      const hitEl = [...activePage.elements]
        .reverse()
        .find((el) => hitTestElement(el, pt.x, pt.y, 12));

      if (hitEl) {
        const nextSelected = e.shiftKey
          ? selectedIds.includes(hitEl.id)
            ? selectedIds.filter((id) => id !== hitEl.id)
            : [...selectedIds, hitEl.id]
          : [hitEl.id];
        setSelectedIds(nextSelected);
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
        setSelectedIds([]);
        marqueeBoxRef.current = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
        scheduleOverlayRedraw();
      }
      return;
    }

    // Shapes
    if (tool === 'line' || tool === 'arrow' || tool === 'rect' || tool === 'ellipse' || tool === 'axes') {
      setSelectedIds([]);
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

    // Ink Pen / Pencil / Highlighter
    if (tool === 'pen' || tool === 'pencil' || tool === 'highlighter') {
      setSelectedIds([]);
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
    if (panningRef.current?.active) {
      const vp = viewportRef.current;
      if (!vp) return;
      vp.scrollLeft = panningRef.current.scrollLeft - (e.clientX - panningRef.current.startClientX);
      vp.scrollTop = panningRef.current.scrollTop - (e.clientY - panningRef.current.startClientY);
      return;
    }

    const pt = getCanvasPoint(e);

    if (isDrawingLaserRef.current && laserStrokesRef.current.length > 0) {
      const currentLaser = laserStrokesRef.current[laserStrokesRef.current.length - 1];
      currentLaser.points.push({ x: pt.x, y: pt.y, t: pt.t });
      scheduleOverlayRedraw();
      return;
    }

    if (tool === 'eraser_stroke' && e.buttons === 1) {
      const hit = activePage.elements.filter(
        (el) =>
          el.kind !== 'image' &&
          !erasedThisGestureRef.current.has(el.id) &&
          hitTestElement(el, pt.x, pt.y, 14)
      );
      if (hit.length > 0) {
        const hitIds = new Set(hit.map((h) => h.id));
        hit.forEach((h) => erasedThisGestureRef.current.add(h.id));
        commitPageElements(activePage.elements.filter((el) => !hitIds.has(el.id)));
      }
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
        if (activeShapeRef.current.shape === 'line' || activeShapeRef.current.shape === 'arrow') {
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
    if (panningRef.current?.active) {
      panningRef.current = null;
      return;
    }

    if (isDrawingLaserRef.current) {
      isDrawingLaserRef.current = false;
    }

    erasedThisGestureRef.current.clear();

    if (draggingSelectionRef.current?.active) {
      const drag = draggingSelectionRef.current;
      draggingSelectionRef.current = null;
      if (Math.abs(drag.dx) > 1 || Math.abs(drag.dy) > 1) {
        const nextElements = activePage.elements.map((el) =>
          drag.ids.has(el.id) ? translateElement(el, drag.dx, drag.dy) : el
        );
        commitPageElements(nextElements);
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
        const hitIds = activePage.elements
          .filter((el) => boundsIntersect(getElementBounds(el), box))
          .map((el) => el.id);
        setSelectedIds(hitIds);
      }
      scheduleOverlayRedraw();
      return;
    }

    if (activeShapeRef.current) {
      const shp = activeShapeRef.current;
      activeShapeRef.current = null;
      if (Math.hypot(shp.x2 - shp.x1, shp.y2 - shp.y1) > 4) {
        commitPageElements([...activePage.elements, shp]);
      }
      scheduleOverlayRedraw();
      return;
    }

    if (activeStrokeRef.current) {
      const str = activeStrokeRef.current;
      activeStrokeRef.current = null;
      if (str.points.length > 0) {
        commitPageElements([...activePage.elements, str]);
      }
      scheduleOverlayRedraw();
    }
  };

  // ==========================================
  // TEXT EDIT COMMIT
  // ==========================================
  const handleCommitText = () => {
    if (!editingText) return;
    const trimmed = editingText.text.trim();
    if (editingText.id) {
      if (!trimmed) {
        commitPageElements(activePage.elements.filter((el) => el.id !== editingText.id));
      } else {
        commitPageElements(
          activePage.elements.map((el) =>
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
      commitPageElements([...activePage.elements, newText]);
    }
    setEditingText(null);
  };

  // ==========================================
  // NOTEBOOK & PAGE OPERATIONS
  // ==========================================
  const handleCreateNotebook = () => {
    const newNb = createNewNotebook(
      `Ghi chú ${notebooks.length + 1}`,
      filterSubject === 'Tất cả' ? 'Toán Học' : filterSubject,
      activePage.paperStyle,
      activePage.paperTheme
    );
    setNotebooks((prev) => [newNb, ...prev]);
    setActiveNotebookId(newNb.id);
    setSelectedIds([]);
    setEditingText(null);
    showToast('Đã tạo sổ ghi chú mới');
  };

  const handleDeleteNotebook = (nbId: string) => {
    if (notebooks.length <= 1) {
      const fresh = createNewNotebook('Nháp mới', 'Toán Học', 'grid', 'white');
      setNotebooks([fresh]);
      setActiveNotebookId(fresh.id);
      setConfirmDeleteNoteId(null);
      return;
    }
    const remaining = notebooks.filter((n) => n.id !== nbId);
    setNotebooks(remaining);
    if (activeNotebookId === nbId && remaining[0]) {
      setActiveNotebookId(remaining[0].id);
    }
    setConfirmDeleteNoteId(null);
    setSelectedIds([]);
    showToast('Đã xóa sổ ghi chú');
  };

  const handleSaveTitle = () => {
    if (!activeNotebook) return;
    const cleaned = titleDraft.trim() || 'Ghi chú chưa đặt tên';
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeNotebook.id
          ? { ...nb, title: cleaned, updatedAt: new Date().toISOString() }
          : nb
      )
    );
    setEditingTitle(false);
  };

  const handleChangeSubject = (subject: NoteSubject) => {
    if (!activeNotebook) return;
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeNotebook.id
          ? { ...nb, subject, updatedAt: new Date().toISOString() }
          : nb
      )
    );
  };

  const handleSetActivePageIndex = (nextIdx: number) => {
    if (!activeNotebook) return;
    const bounded = Math.max(0, Math.min(activeNotebook.pages.length - 1, nextIdx));
    setSelectedIds([]);
    setEditingText(null);
    setConfirmClearPage(false);
    setConfirmDeletePage(false);
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeNotebook.id ? { ...nb, activePageIndex: bounded } : nb
      )
    );
  };

  const handleAddPage = () => {
    if (!activeNotebook) return;
    const newPage = createBlankPage(activePage.paperStyle, activePage.paperTheme);
    const nextPages = [...activeNotebook.pages, newPage];
    setSelectedIds([]);
    setEditingText(null);
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeNotebook.id
          ? {
              ...nb,
              updatedAt: new Date().toISOString(),
              pages: nextPages,
              activePageIndex: nextPages.length - 1,
            }
          : nb
      )
    );
    showToast(`Đã thêm Trang ${nextPages.length}`);
  };

  const handleDuplicatePage = () => {
    if (!activeNotebook) return;
    const copyPage: NotePage = {
      ...activePage,
      id: createId('page'),
      elements: activePage.elements.map((el) => ({ ...el, id: createId(el.kind.slice(0, 3)) })),
    };
    const nextPages = [
      ...activeNotebook.pages.slice(0, activePageIndex + 1),
      copyPage,
      ...activeNotebook.pages.slice(activePageIndex + 1),
    ];
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeNotebook.id
          ? {
              ...nb,
              updatedAt: new Date().toISOString(),
              pages: nextPages,
              activePageIndex: activePageIndex + 1,
            }
          : nb
      )
    );
    showToast('Đã nhân bản trang hiện tại');
  };

  const handleDeleteCurrentPage = () => {
    if (!activeNotebook || activeNotebook.pages.length <= 1) return;
    const nextPages = activeNotebook.pages.filter((_, idx) => idx !== activePageIndex);
    const nextIndex = Math.min(activePageIndex, nextPages.length - 1);
    setSelectedIds([]);
    setConfirmDeletePage(false);
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeNotebook.id
          ? {
              ...nb,
              updatedAt: new Date().toISOString(),
              pages: nextPages,
              activePageIndex: nextIndex,
            }
          : nb
      )
    );
    showToast('Đã xóa trang');
  };

  const handleUpdatePaper = (style: PaperStyle, theme: PaperTheme) => {
    if (!activeNotebook) return;
    const prevTheme = activePage.paperTheme;
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id !== activeNotebook.id
          ? nb
          : {
              ...nb,
              updatedAt: new Date().toISOString(),
              pages: nb.pages.map((p, idx) =>
                idx === activePageIndex ? { ...p, paperStyle: style, paperTheme: theme } : p
              ),
            }
      )
    );
    // Automatically adapt default ink color when switching light <-> dark paper
    const wasDark = prevTheme === 'slate' || prevTheme === 'chalkboard';
    const isDark = theme === 'slate' || theme === 'chalkboard';
    if (!wasDark && isDark && penColor === '#0f172a') {
      setPenColor('#ffffff');
    } else if (wasDark && !isDark && penColor === '#ffffff') {
      setPenColor('#0f172a');
    }
  };

  // ==========================================
  // SELECTION ACTIONS
  // ==========================================
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const delSet = new Set(selectedIds);
    commitPageElements(activePage.elements.filter((el) => !delSet.has(el.id)));
    setSelectedIds([]);
  };

  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return;
    const selSet = new Set(selectedIds);
    const clones = activePage.elements
      .filter((el) => selSet.has(el.id))
      .map((el) => ({ ...translateElement(el, 28, 28), id: createId(el.kind.slice(0, 3)) }));
    commitPageElements([...activePage.elements, ...clones]);
    setSelectedIds(clones.map((c) => c.id));
  };

  const handleRecolorSelected = (color: string) => {
    if (selectedIds.length === 0) return;
    const selSet = new Set(selectedIds);
    commitPageElements(
      activePage.elements.map((el) => (selSet.has(el.id) ? recolorElement(el, color) : el))
    );
  };

  // ==========================================
  // EXPORT PNG & MULTI-PAGE PDF
  // ==========================================
  const handleExportPng = async () => {
    if (!activeNotebook) return;
    setIsExporting(true);
    try {
      const canvas = await renderPageToCanvas(activePage, 1.5);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeTitle = (activeNotebook.title || 'ghi-chu').replace(/[^a-zA-Z0-9\u00C0-\u1EF9_-]+/g, '_');
      link.download = `${safeTitle}_trang_${activePageIndex + 1}.png`;
      link.href = dataUrl;
      link.click();
      showToast(`Đã tải xuống ảnh PNG Trang ${activePageIndex + 1}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeNotebook) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [PAGE_WIDTH, PAGE_HEIGHT],
        hotfixes: ['px_scaling'],
      });
      for (let i = 0; i < activeNotebook.pages.length; i++) {
        if (i > 0) pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'landscape');
        const pageCanvas = await renderPageToCanvas(activeNotebook.pages[i], 1.25);
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      }
      const safeTitle = (activeNotebook.title || 'ghi-chu').replace(/[^a-zA-Z0-9\u00C0-\u1EF9_-]+/g, '_');
      pdf.save(`${safeTitle}.pdf`);
      showToast(`Đã xuất file PDF (${activeNotebook.pages.length} trang)`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        insertImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Filtered notebooks list
  const filteredNotebooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notebooks.filter((nb) => {
      if (filterSubject !== 'Tất cả' && nb.subject !== filterSubject) return false;
      if (q && !nb.title.toLowerCase().includes(q) && !nb.subject.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [notebooks, searchQuery, filterSubject]);

  const isShapeActive =
    tool === 'line' || tool === 'arrow' || tool === 'rect' || tool === 'ellipse' || tool === 'axes';

  const activeSwatches = tool === 'highlighter' ? HIGHLIGHTER_COLOR_SWATCHES : INK_COLOR_SWATCHES;
  const activeColor = tool === 'highlighter' ? highlighterColor : penColor;
  const activeWidth = tool === 'highlighter' ? highlighterWidth : penWidth;

  const canvasCursorClass =
    tool === 'hand' || isSpacePressed
      ? 'cursor-grab active:cursor-grabbing'
      : tool === 'select'
      ? 'cursor-default'
      : tool === 'text'
      ? 'cursor-text'
      : 'cursor-crosshair';

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-100 flex flex-col'
          : 'max-w-[1440px] mx-auto px-2 sm:px-4'
      }`}
    >
      <div
        className={`bg-white border border-slate-200 overflow-hidden flex flex-col shadow-sm ${
          isFullscreen ? 'flex-1 rounded-none border-0' : 'rounded-2xl h-[calc(100vh-7.5rem)] min-h-[620px]'
        }`}
      >
        {/* ============================================================ */}
        {/* ROW 1: STUDIO HEADER BAR (NOTEBOOK META, UNDO, ZOOM, EXPORT) */}
        {/* ============================================================ */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Left: Sidebar toggle + Title + Subject */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? 'Thu gọn danh sách sổ tay' : 'Mở danh sách sổ tay'}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <NotebookPen size={17} />
              </div>

              {editingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    autoFocus
                    className="h-8 px-2.5 rounded-lg border border-blue-400 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 w-44 sm:w-64"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer whitespace-nowrap"
                  >
                    Lưu
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(activeNotebook?.title || '');
                    setEditingTitle(true);
                  }}
                  title="Nhấn để đổi tên ghi chú"
                  className="text-left min-w-0 group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-[160px] sm:max-w-[260px] group-hover:text-blue-600 transition-colors">
                      {activeNotebook?.title}
                    </h1>
                    <Pencil size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                    <span>{activeNotebook?.subject}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{activeNotebook?.pages.length || 1} trang</span>
                    {currentUserName && (
                      <>
                        <span aria-hidden="true" className="hidden sm:inline">·</span>
                        <span className="hidden sm:inline truncate max-w-[120px]">{currentUserName}</span>
                      </>
                    )}
                  </div>
                </button>
              )}
            </div>

            <select
              value={activeNotebook?.subject || 'Toán Học'}
              onChange={(e) => handleChangeSubject(e.target.value as NoteSubject)}
              aria-label="Chọn môn học cho ghi chú"
              className="hidden md:block h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500"
            >
              {NOTE_SUBJECTS.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Undo/Redo, Zoom, Export, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Hoàn tác (Ctrl+Z)"
                className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Làm lại (Ctrl+Y)"
                className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Redo2 size={16} />
              </button>
            </div>

            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                title="Thu nhỏ"
                className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Đặt về 100%"
                className="h-8 px-2 rounded-md text-xs font-semibold tabular-nums text-slate-700 hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.1).toFixed(2))))}
                title="Phóng to"
                className="h-8 w-8 rounded-md flex items-center justify-center text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportPng}
              disabled={isExporting}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Download size={14} className="text-blue-600" />
              <span className="hidden sm:inline">Xuất PNG</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <FileDown size={14} />
              <span>Xuất PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              title={isFullscreen ? 'Thu nhỏ khung làm việc' : 'Toàn màn hình bảng vẽ'}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ROW 2: SCRBLE INK PEN, SHAPE, COLOR & PAPER TOOLBAR          */}
        {/* ============================================================ */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0 relative">
          {/* Tool Buttons Group */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setTool('select')}
              title="Chọn & di chuyển nét vẽ"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'select'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <Lasso size={15} />
              <span className="hidden xl:inline">Chọn</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('hand')}
              title="Kéo di chuyển trang (hoặc giữ phím Space)"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'hand'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <Hand size={15} />
              <span className="hidden xl:inline">Kéo</span>
            </button>

            <div className="w-px h-6 bg-slate-300/80 mx-1 shrink-0" />

            <button
              type="button"
              onClick={() => setTool('pen')}
              title="Bút mực viết tay (hỗ trợ lực nhấn)"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'pen'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <PenTool size={15} />
              <span>Bút mực</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('pencil')}
              title="Bút chì nét đều"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'pencil'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <Pencil size={15} />
              <span className="hidden lg:inline">Bút chì</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('highlighter')}
              title="Bút dạ quang đánh dấu"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'highlighter'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <Highlighter size={15} />
              <span className="hidden lg:inline">Dạ quang</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('eraser_stroke')}
              title="Tẩy theo nét (chạm hoặc quét qua nét cần xóa)"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'eraser_stroke'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <Eraser size={15} />
              <span>Tẩy nét</span>
            </button>

            <div className="w-px h-6 bg-slate-300/80 mx-1 shrink-0" />

            {/* Shape Selector */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!isShapeActive) {
                    setTool(lastShapeTool);
                  } else {
                    setShowShapeMenu((v) => !v);
                  }
                }}
                title="Vẽ hình học & Hệ trục Oxy (giữ Shift để căn thẳng/vuông)"
                className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  isShapeActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
                }`}
              >
                <Shapes size={15} />
                <span className="hidden sm:inline">Hình &amp; Oxy</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTool('text')}
              title="Chèn chữ đánh máy & ký hiệu Toán"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'text'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <Type size={15} />
              <span className="hidden lg:inline">Chữ</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Chèn ảnh đề bài hoặc hình minh họa (hoặc Ctrl+V để dán)"
              className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ImagePlus size={15} />
              <span className="hidden lg:inline">Ảnh</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setTool('laser')}
              title="Đèn chiếu Laser chỉ bài (tự mờ sau 1 giây)"
              className={`h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tool === 'laser'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
              }`}
            >
              <Sparkles size={15} />
              <span className="hidden xl:inline">Laser</span>
            </button>
          </div>

          {/* Color Swatches & Stroke Width */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
              {activeSwatches.map((sw) => {
                const isSelected = activeColor.toLowerCase() === sw.color.toLowerCase();
                return (
                  <button
                    key={sw.color}
                    type="button"
                    onClick={() => {
                      if (tool === 'highlighter') setHighlighterColor(sw.color);
                      else setPenColor(sw.color);
                    }}
                    title={sw.label}
                    className={`w-5 h-5 rounded-full border transition-transform cursor-pointer shrink-0 ${
                      isSelected
                        ? 'scale-115 ring-2 ring-blue-500 ring-offset-1 border-slate-400'
                        : 'border-slate-300 hover:scale-110'
                    }`}
                    style={{ backgroundColor: sw.color }}
                  />
                );
              })}
              <label
                title="Chọn màu tùy chỉnh"
                className="w-5 h-5 rounded-full border border-slate-300 overflow-hidden cursor-pointer flex items-center justify-center bg-slate-100 ml-0.5 shrink-0"
              >
                <Palette size={11} className="text-slate-600" />
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => {
                    if (tool === 'highlighter') setHighlighterColor(e.target.value);
                    else setPenColor(e.target.value);
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Stroke Width Presets */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
              {(tool === 'highlighter' ? [14, 22, 32, 44] : [2, 3.5, 6, 10]).map((w) => {
                const dotSize = tool === 'highlighter' ? Math.round(w / 3.2) : Math.round(w + 3);
                const selected = Math.abs(activeWidth - w) < 0.5;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      if (tool === 'highlighter') setHighlighterWidth(w);
                      else setPenWidth(w);
                    }}
                    title={`Cỡ nét ${w}px`}
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      selected ? 'bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="rounded-full block"
                      style={{
                        width: Math.min(16, Math.max(4, dotSize)),
                        height: Math.min(16, Math.max(4, dotSize)),
                        backgroundColor:
                          tool === 'highlighter' ? highlighterColor : penColor === '#ffffff' ? '#475569' : penColor,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Paper Style & Theme Trigger */}
            <button
              type="button"
              onClick={() => {
                setShowPaperMenu((v) => !v);
                setShowShapeMenu(false);
              }}
              className={`h-9 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showPaperMenu
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Grid3X3 size={14} />
              <span className="hidden sm:inline">Kiểu giấy</span>
            </button>

            {/* Palm Rejection / Stylus-only Toggle */}
            <button
              type="button"
              onClick={() => setStylusOnly((s) => !s)}
              title="Bật khi dùng máy tính bảng có bút cảm ứng để tránh chạm nhầm bằng tay"
              className={`h-9 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                stylusOnly
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <PenTool size={13} />
              <span className="hidden md:inline">{stylusOnly ? 'Chỉ bút: BẬT' : 'Chỉ bút'}</span>
            </button>
          </div>
        </div>

        {/* Shape Sub-toolbar when shape tool is active or menu opened */}
        {(isShapeActive || showShapeMenu) && (
          <div className="bg-blue-50/70 border-b border-blue-200/80 px-3 sm:px-4 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-semibold text-blue-900 whitespace-nowrap shrink-0">
              Chọn hình:
            </span>
            {(
              [
                { id: 'line', label: 'Đoạn thẳng', icon: Minus },
                { id: 'arrow', label: 'Mũi tên / Vectơ', icon: ArrowUpRight },
                { id: 'rect', label: 'Hình chữ nhật', icon: Square },
                { id: 'ellipse', label: 'Hình tròn / Elip', icon: Circle },
                { id: 'axes', label: 'Hệ trục Oxy', icon: Axis3D },
              ] as const
            ).map((shp) => {
              const Icon = shp.icon;
              const active = tool === shp.id;
              return (
                <button
                  key={shp.id}
                  type="button"
                  onClick={() => {
                    setTool(shp.id);
                    setLastShapeTool(shp.id);
                    setShowShapeMenu(false);
                  }}
                  className={`h-8 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
                  }`}
                >
                  <Icon size={14} />
                  <span>{shp.label}</span>
                </button>
              );
            })}
            <span className="text-[11px] text-blue-700 whitespace-nowrap ml-auto hidden md:inline">
              Mẹo: Giữ phím Shift khi kéo để vẽ thẳng hàng, vuông hoặc tròn đều
            </span>
          </div>
        )}

        {/* Paper Style & Theme Panel */}
        {showPaperMenu && (
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-600">Định dạng dòng kẻ:</span>
              {(
                [
                  { id: 'blank', label: 'Giấy trơn', icon: Square },
                  { id: 'lined', label: 'Kẻ ngang', icon: AlignJustify },
                  { id: 'grid', label: 'Ô ly vuông', icon: Grid3X3 },
                  { id: 'dots', label: 'Chấm bi', icon: MoreDotsIcon },
                ] as const
              ).map((ps) => {
                const Icon = ps.icon;
                const active = activePage.paperStyle === ps.id;
                return (
                  <button
                    key={ps.id}
                    type="button"
                    onClick={() => handleUpdatePaper(ps.id, activePage.paperTheme)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{ps.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-600">Màu nền giấy:</span>
              {(Object.keys(PAPER_THEME_META) as PaperTheme[]).map((themeKey) => {
                const meta = PAPER_THEME_META[themeKey];
                const active = activePage.paperTheme === themeKey;
                return (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => handleUpdatePaper(activePage.paperStyle, themeKey)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                      meta.swatchClass
                    } ${active ? 'ring-2 ring-blue-500 ring-offset-1' : 'opacity-85 hover:opacity-100'}`}
                  >
                    {active && <Check size={12} />}
                    <span>{meta.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowPaperMenu(false)}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MAIN BODY: COLLAPSIBLE NOTEBOOK SIDEBAR + INK CANVAS STAGE   */}
        {/* ============================================================ */}
        <div className="flex-1 flex min-h-0 relative">
          {/* Collapsible Left Notebook Drawer */}
          {sidebarOpen && (
            <aside className="w-64 sm:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20">
              <div className="p-3 border-b border-slate-200 space-y-2.5">
                <button
                  type="button"
                  onClick={handleCreateNotebook}
                  className="w-full h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Tạo Sổ Ghi Chú Mới</span>
                </button>

                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên sổ ghi chú..."
                    className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {(['Tất cả', ...NOTE_SUBJECTS] as const).map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setFilterSubject(subj)}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        filterSubject === subj
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notebooks List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredNotebooks.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8 px-3">
                    Không tìm thấy sổ ghi chú nào phù hợp.
                  </p>
                ) : (
                  filteredNotebooks.map((nb) => {
                    const isActive = nb.id === activeNotebook?.id;
                    const isConfirmingDel = confirmDeleteNoteId === nb.id;
                    return (
                      <div
                        key={nb.id}
                        className={`rounded-xl p-2.5 border transition-colors ${
                          isActive
                            ? 'bg-blue-50/80 border-blue-300'
                            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveNotebookId(nb.id);
                              setSelectedIds([]);
                              setEditingText(null);
                              setConfirmDeleteNoteId(null);
                            }}
                            className="flex-1 text-left min-w-0 cursor-pointer"
                          >
                            <div
                              className={`text-xs font-bold truncate ${
                                isActive ? 'text-blue-900' : 'text-slate-900'
                              }`}
                            >
                              {nb.title}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <span>{nb.subject}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{nb.pages.length} trang</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                              {formatShortDate(nb.updatedAt)}
                            </div>
                          </button>

                          {!isConfirmingDel ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteNoteId(nb.id)}
                              title="Xóa sổ ghi chú"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDeleteNotebook(nb.id)}
                                className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                              >
                                Xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteNoteId(null)}
                                className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold hover:bg-slate-300 cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {saveWarning && (
                <div className="p-2.5 border-t border-amber-200 bg-amber-50 text-[11px] text-amber-800">
                  {saveWarning}
                </div>
              )}
            </aside>
          )}

          {/* Canvas Interactive Stage */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-200/80 relative">
            {/* Floating Selection Bar */}
            {selectedIds.length > 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white border border-slate-200 shadow-lg rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                  Đã chọn {selectedIds.length} mục
                </span>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-1">
                  {INK_COLOR_SWATCHES.slice(0, 6).map((sw) => (
                    <button
                      key={sw.color}
                      type="button"
                      onClick={() => handleRecolorSelected(sw.color)}
                      title={`Đổi màu: ${sw.label}`}
                      className="w-4 h-4 rounded-full border border-slate-300 hover:scale-115 transition-transform cursor-pointer"
                      style={{ backgroundColor: sw.color }}
                    />
                  ))}
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <button
                  type="button"
                  onClick={handleDuplicateSelected}
                  className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Copy size={13} />
                  <span>Nhân bản</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-2 py-1 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 size={13} />
                  <span>Xóa</span>
                </button>
              </div>
            )}

            {/* Floating Toast Notification */}
            {toastMsg && (
              <div className="absolute top-3 right-3 z-30 bg-slate-900 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in">
                <Check size={14} className="text-emerald-400" />
                <span>{toastMsg}</span>
              </div>
            )}

            {/* Scrollable Desk Viewport */}
            <div
              ref={viewportRef}
              className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center"
            >
              <div
                className="relative shadow-xl rounded-sm shrink-0 border border-slate-300/70"
                style={{
                  width: Math.round(PAGE_WIDTH * zoom),
                  height: Math.round(PAGE_HEIGHT * zoom),
                }}
              >
                {/* Layer 1: Static Paper + Committed Strokes/Images */}
                <canvas
                  ref={baseCanvasRef}
                  className="absolute inset-0 block pointer-events-none"
                  style={{
                    width: Math.round(PAGE_WIDTH * zoom),
                    height: Math.round(PAGE_HEIGHT * zoom),
                  }}
                />

                {/* Layer 2: Active Ink Stroke, Selection, Laser Overlay */}
                <canvas
                  ref={overlayCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={`absolute inset-0 block ${canvasCursorClass}`}
                  style={{
                    width: Math.round(PAGE_WIDTH * zoom),
                    height: Math.round(PAGE_HEIGHT * zoom),
                    touchAction: 'none',
                  }}
                />

                {/* Inline Text Editor Overlay */}
                {editingText && (
                  <div
                    className="absolute z-30 bg-white border border-blue-500 rounded-xl shadow-xl p-2.5 space-y-2 w-72 sm:w-80"
                    style={{
                      left: Math.min(
                        Math.round(PAGE_WIDTH * zoom) - 290,
                        Math.max(8, Math.round(editingText.x * zoom))
                      ),
                      top: Math.min(
                        Math.round(PAGE_HEIGHT * zoom) - 180,
                        Math.max(8, Math.round(editingText.y * zoom))
                      ),
                    }}
                  >
                    <textarea
                      value={editingText.text}
                      onChange={(e) =>
                        setEditingText((prev) => (prev ? { ...prev, text: e.target.value } : null))
                      }
                      placeholder="Nhập văn bản hoặc công thức..."
                      rows={3}
                      autoFocus
                      className="w-full p-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500 resize-y"
                    />
                    {/* Quick Math Symbols */}
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

            {/* ============================================================ */}
            {/* BOTTOM PAGE NAVIGATOR STRIP                                  */}
            {/* ============================================================ */}
            <div className="bg-white border-t border-slate-200 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetActivePageIndex(activePageIndex - 1)}
                  disabled={activePageIndex === 0}
                  className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  title="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold text-slate-700 px-2 tabular-nums whitespace-nowrap">
                  Trang {activePageIndex + 1} / {activeNotebook?.pages.length || 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleSetActivePageIndex(activePageIndex + 1)}
                  disabled={activePageIndex >= (activeNotebook?.pages.length || 1) - 1}
                  className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  title="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleAddPage}
                  className="h-8 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ml-1"
                >
                  <Plus size={14} />
                  <span>Thêm trang</span>
                </button>

                <button
                  type="button"
                  onClick={handleDuplicatePage}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold hidden sm:flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Nhân bản</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {activeNotebook && activeNotebook.pages.length > 1 && (
                  !confirmDeletePage ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeletePage(true);
                        setConfirmClearPage(false);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Xóa trang này
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                      <span className="text-[11px] font-semibold text-rose-800 whitespace-nowrap">
                        Xóa trang {activePageIndex + 1}?
                      </span>
                      <button
                        type="button"
                        onClick={handleDeleteCurrentPage}
                        className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePage(false)}
                        className="px-2 py-0.5 rounded bg-white text-slate-700 text-[11px] font-semibold border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  )
                )}

                {activePage.elements.length > 0 && (
                  !confirmClearPage ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmClearPage(true);
                        setConfirmDeletePage(false);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Xóa sạch trang</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                      <span className="text-[11px] font-semibold text-rose-800 whitespace-nowrap">
                        Xóa toàn bộ nét vẽ?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          commitPageElements([]);
                          setSelectedIds([]);
                          setConfirmClearPage(false);
                        }}
                        className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Đồng ý
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearPage(false)}
                        className="px-2 py-0.5 rounded bg-white text-slate-700 text-[11px] font-semibold border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MoreDotsIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="3.5" cy="3.5" r="1.3" />
    <circle cx="8" cy="3.5" r="1.3" />
    <circle cx="12.5" cy="3.5" r="1.3" />
    <circle cx="3.5" cy="8" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="12.5" cy="8" r="1.3" />
    <circle cx="3.5" cy="12.5" r="1.3" />
    <circle cx="8" cy="12.5" r="1.3" />
    <circle cx="12.5" cy="12.5" r="1.3" />
  </svg>
);

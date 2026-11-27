import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eraser,
  FileDown,
  FilePlus2,
  FileUp,
  Grid3X3,
  Hand,
  ImagePlus,
  Lasso,
  Loader2,
  Maximize2,
  Menu,
  Minimize2,
  Palette,
  PenLine,
  PenTool,
  Pencil,
  Plus,
  Redo2,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  AlignJustify,
} from 'lucide-react';
import {
  HIGHLIGHTER_COLOR_SWATCHES,
  INK_COLOR_SWATCHES,
  InkElement,
  InkImageItem,
  InkNoteBook,
  InkShapeKind,
  InkStroke,
  InkTool,
  NotePage,
  NoteSubject,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PAPER_THEME_META,
  PaperStyle,
  PaperTheme,
  isShapeTool,
} from './types';
import {
  recolorElement,
  renderPageToCanvas,
  translateElement,
} from './inkRenderer';
import { InkPageCanvas } from './InkPageCanvas';

interface InkNotesViewProps {
  currentUserId: string;
  currentUserName?: string;
}

interface PageHistory {
  past: InkElement[][];
  future: InkElement[][];
}

const NOTE_SUBJECTS: NoteSubject[] = ['Chung', 'Toán Học', 'Vật Lý', 'Hóa Học'];

const SCRBLE_PEN_SWATCHES = [
  { color: '#dc2626', label: 'Đỏ' },
  { color: '#2563eb', label: 'Xanh dương' },
  { color: '#7c3aed', label: 'Tím' },
  { color: '#059669', label: 'Xanh lá' },
  { color: '#0f172a', label: 'Đen mực' },
];

const SCRBLE_HIGHLIGHTER_SWATCHES = HIGHLIGHTER_COLOR_SWATCHES.slice(0, 3);

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createBlankPage(
  paperStyle: PaperStyle = 'lined',
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
  paperStyle: PaperStyle = 'lined',
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

function sanitizeNotebooks(rawList: unknown): InkNoteBook[] {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];
  const cleaned: InkNoteBook[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const nb = item as Partial<InkNoteBook>;
    const rawPages = Array.isArray(nb.pages) && nb.pages.length > 0 ? nb.pages : [createBlankPage()];
    const pages: NotePage[] = rawPages.map((p) => ({
      id: typeof p?.id === 'string' && p.id ? p.id : createId('page'),
      paperStyle:
        p?.paperStyle === 'blank' ||
        p?.paperStyle === 'lined' ||
        p?.paperStyle === 'grid' ||
        p?.paperStyle === 'dots'
          ? p.paperStyle
          : 'lined',
      paperTheme:
        p?.paperTheme === 'white' ||
        p?.paperTheme === 'cream' ||
        p?.paperTheme === 'slate' ||
        p?.paperTheme === 'chalkboard'
          ? p.paperTheme
          : 'white',
      pageTitle: typeof p?.pageTitle === 'string' ? p.pageTitle : undefined,
      height:
        typeof p?.height === 'number' && Number.isFinite(p.height) && p.height >= 400
          ? p.height
          : undefined,
      backgroundDataUrl:
        typeof p?.backgroundDataUrl === 'string' && p.backgroundDataUrl.startsWith('data:image/')
          ? p.backgroundDataUrl
          : undefined,
      elements: Array.isArray(p?.elements)
        ? p.elements.filter((el): el is InkElement => {
            if (!el || typeof el !== 'object') return false;
            const kind = (el as InkElement).kind;
            if (kind === 'stroke') {
              return Array.isArray((el as InkStroke).points) && (el as InkStroke).points.length > 0;
            }
            return kind === 'shape' || kind === 'text' || kind === 'image';
          })
        : [],
    }));
    const idx =
      typeof nb.activePageIndex === 'number' && Number.isFinite(nb.activePageIndex)
        ? Math.max(0, Math.min(pages.length - 1, nb.activePageIndex))
        : 0;
    cleaned.push({
      id: typeof nb.id === 'string' && nb.id ? nb.id : createId('nb'),
      title: typeof nb.title === 'string' && nb.title.trim() ? nb.title : 'Ghi chú chưa đặt tên',
      subject:
        nb.subject === 'Chung' ||
        nb.subject === 'Toán Học' ||
        nb.subject === 'Vật Lý' ||
        nb.subject === 'Hóa Học'
          ? nb.subject
          : 'Toán Học',
      createdAt: typeof nb.createdAt === 'string' ? nb.createdAt : new Date().toISOString(),
      updatedAt: typeof nb.updatedAt === 'string' ? nb.updatedAt : new Date().toISOString(),
      activePageIndex: idx,
      pages,
    });
  }
  return cleaned;
}

function loadNotebooksFromStorage(key: string): InkNoteBook[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const sanitized = sanitizeNotebooks(JSON.parse(raw));
      if (sanitized.length > 0) return sanitized;
    }
  } catch {}
  return [createNewNotebook('Nháp giải bài tập #1', 'Toán Học', 'lined', 'white')];
}

const IDB_NAME = 'MathLikiInkNotesDB';
const IDB_STORE = 'notebooks';

function openNotesIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readNotebooksFromIdb(key: string): Promise<InkNoteBook[] | null> {
  const db = await openNotesIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        const val = req.result;
        const sanitized = sanitizeNotebooks(val);
        resolve(sanitized.length > 0 ? sanitized : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeNotebooksToIdb(key: string, data: InkNoteBook[]): Promise<boolean> {
  const db = await openNotesIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

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

const PenNibIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

type RulerGridItemId = 'text' | InkShapeKind;

const RULER_GRID_ITEMS: ReadonlyArray<{ id: RulerGridItemId; label: string }> = [
  // Row 1
  { id: 'text', label: 'Chữ & Ký hiệu Toán (T)' },
  { id: 'line', label: 'Đoạn thẳng' },
  { id: 'dashed_line', label: 'Đoạn thẳng nét đứt' },
  { id: 'dashdot_line', label: 'Đường nét gạch chấm' },
  { id: 'arrow', label: 'Mũi tên / Vectơ' },
  { id: 'double_arrow', label: 'Mũi tên hai chiều' },
  // Row 2
  { id: 'ray', label: 'Tia / Đường tròn tiếp tuyến' },
  { id: 'circle', label: 'Hình tròn' },
  { id: 'ellipse', label: 'Hình Elip / Bầu dục' },
  { id: 'capsule', label: 'Hình viên nang (Bo tròn)' },
  { id: 'rect', label: 'Hình chữ nhật / Hình vuông' },
  { id: 'triangle_right', label: 'Tam giác hướng phải' },
  // Row 3
  { id: 'triangle', label: 'Tam giác cân / đều' },
  { id: 'right_triangle', label: 'Tam giác vuông' },
  { id: 'diamond', label: 'Hình thoi' },
  { id: 'pentagon', label: 'Ngũ giác đều (5 cạnh)' },
  { id: 'hexagon', label: 'Lục giác đều (6 cạnh)' },
  { id: 'heptagon', label: 'Thất giác đều (7 cạnh)' },
  // Row 4
  { id: 'octagon', label: 'Bát giác đều (8 cạnh)' },
  { id: 'nonagon', label: 'Cửu giác đều (9 cạnh)' },
  { id: 'star', label: 'Ngôi sao 5 cánh' },
  { id: 'axes', label: 'Hệ trục tọa độ Oxy' },
  { id: 'axes3d', label: 'Hệ trục tọa độ Oxyz' },
];

function buildRegularPolygonSvgPoints(sides: number, startAngle: number = -Math.PI / 2, r: number = 7.4): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i * 2 * Math.PI) / sides;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function buildStarSvgPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 7.8 : 3.3;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const ShapeGlyph: React.FC<{ shape: RulerGridItemId; size?: number }> = ({ shape, size = 20 }) => {
  if (shape === 'text') {
    return (
      <span
        aria-hidden="true"
        className="font-serif font-normal leading-none select-none"
        style={{ fontSize: Math.round(size * 1.05) }}
      >
        T
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape === 'line' && <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />}
      {shape === 'dashed_line' && (
        <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" strokeDasharray="3.1 2.8" />
      )}
      {shape === 'dashdot_line' && (
        <line x1="5" y1="19" x2="19" y2="5" strokeDasharray="3.8 2.2 0.8 2.2" />
      )}
      {shape === 'arrow' && (
        <>
          <line x1="18.5" y1="5.5" x2="6" y2="18" />
          <polygon points="5.5,18.5 5.5,12.5 11.5,18.5" fill="currentColor" stroke="none" />
        </>
      )}
      {shape === 'double_arrow' && (
        <>
          <line x1="6.5" y1="17.5" x2="17.5" y2="6.5" />
          <polygon points="5.2,18.8 5.2,12.8 11.2,18.8" fill="currentColor" stroke="none" />
          <polygon points="18.8,5.2 12.8,5.2 18.8,11.2" fill="currentColor" stroke="none" />
        </>
      )}
      {shape === 'ray' && (
        <>
          <circle cx="9.2" cy="14.8" r="4.2" />
          <line x1="12.1" y1="11.9" x2="18.8" y2="5.2" />
        </>
      )}
      {shape === 'circle' && <circle cx="12" cy="12" r="7" />}
      {shape === 'ellipse' && <ellipse cx="12" cy="12" rx="7.6" ry="5.1" />}
      {shape === 'capsule' && <rect x="4.5" y="7.5" width="15" height="9" rx="4.5" />}
      {shape === 'rect' && <rect x="5.2" y="5.2" width="13.6" height="13.6" />}
      {shape === 'triangle_right' && <polygon points="6.5,5.2 18.5,12 6.5,18.8" />}
      {shape === 'triangle' && <polygon points="12,5.2 18.8,18.2 5.2,18.2" />}
      {shape === 'right_triangle' && <polygon points="6,5.2 6,18.5 18.5,18.5" />}
      {shape === 'diamond' && <polygon points="12,4.6 19.4,12 12,19.4 4.6,12" />}
      {shape === 'pentagon' && <polygon points={buildRegularPolygonSvgPoints(5)} />}
      {shape === 'hexagon' && <polygon points={buildRegularPolygonSvgPoints(6, 0)} />}
      {shape === 'heptagon' && <polygon points={buildRegularPolygonSvgPoints(7)} />}
      {shape === 'octagon' && <polygon points={buildRegularPolygonSvgPoints(8, Math.PI / 8)} />}
      {shape === 'nonagon' && <polygon points={buildRegularPolygonSvgPoints(9)} />}
      {shape === 'star' && <polygon points={buildStarSvgPoints()} />}
      {shape === 'axes' && (
        <>
          <line x1="12" y1="20" x2="12" y2="4.5" />
          <polyline points="9.2,7.2 12,4.2 14.8,7.2" />
          <line x1="4" y1="12" x2="19.5" y2="12" />
          <polyline points="16.8,9.2 19.8,12 16.8,14.8" />
          <text
            x="14.2"
            y="19.2"
            fontSize="5.8"
            fontWeight="700"
            fill="currentColor"
            stroke="none"
          >
            xy
          </text>
        </>
      )}
      {shape === 'axes3d' && (
        <>
          <line x1="10" y1="14" x2="10" y2="4.2" />
          <polyline points="7.6,6.8 10,4 12.4,6.8" />
          <line x1="10" y1="14" x2="20" y2="14" />
          <polyline points="17.4,11.6 20.2,14 17.4,16.4" />
          <line x1="10" y1="14" x2="4.2" y2="19.8" />
          <polyline points="4.2,16.4 4,20 7.6,19.8" />
          <text
            x="12.5"
            y="9.2"
            fontSize="5.4"
            fontWeight="700"
            fill="currentColor"
            stroke="none"
          >
            xyz
          </text>
        </>
      )}
    </svg>
  );
};

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
  const [notebooks, setNotebooks] = useState<InkNoteBook[]>(() => loadNotebooksFromStorage(storageKey));

  const [activeNotebookId, setActiveNotebookId] = useState<string>(() => {
    const initial = loadNotebooksFromStorage(storageKey);
    return initial[0]?.id || '';
  });

  useEffect(() => {
    if (!notebooks.some((n) => n.id === activeNotebookId) && notebooks[0]) {
      setActiveNotebookId(notebooks[0].id);
    }
  }, [notebooks, activeNotebookId]);

  const prevStorageKeyRef = useRef<string>(storageKey);
  useEffect(() => {
    if (prevStorageKeyRef.current === storageKey) return;
    prevStorageKeyRef.current = storageKey;
    const loaded = loadNotebooksFromStorage(storageKey);
    setNotebooks(loaded);
    setActiveNotebookId(loaded[0]?.id || '');
  }, [storageKey]);

  const activeNotebook = useMemo(
    () => notebooks.find((n) => n.id === activeNotebookId) || notebooks[0],
    [notebooks, activeNotebookId]
  );

  const activePageIndex = Math.min(
    Math.max(0, activeNotebook?.activePageIndex ?? 0),
    Math.max(0, (activeNotebook?.pages?.length ?? 1) - 1)
  );
  const activePage: NotePage = useMemo(
    () => activeNotebook?.pages?.[activePageIndex] || createBlankPage(),
    [activeNotebook, activePageIndex]
  );

  // Hydrate newer copy from IndexedDB if localStorage was full on previous session
  useEffect(() => {
    let cancelled = false;
    readNotebooksFromIdb(storageKey).then((idbList) => {
      if (cancelled || !idbList || idbList.length === 0) return;
      setNotebooks((prev) => {
        const prevNewest = prev.reduce((m, n) => Math.max(m, Date.parse(n.updatedAt || '') || 0), 0);
        const idbNewest = idbList.reduce((m, n) => Math.max(m, Date.parse(n.updatedAt || '') || 0), 0);
        if (idbNewest > prevNewest || idbList.length > prev.length) {
          return idbList;
        }
        return prev;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Debounced localStorage + IndexedDB local save (zero Firebase quota usage)
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(async () => {
      let savedLocal = false;
      try {
        localStorage.setItem(storageKey, JSON.stringify(notebooks));
        savedLocal = true;
      } catch {}

      const savedIdb = await writeNotebooksToIdb(storageKey, notebooks);
      if (savedLocal || savedIdb) {
        setSaveWarning(null);
      } else {
        setSaveWarning('Bộ nhớ trình duyệt gần đầy, hãy xuất hình ảnh/PDF để lưu bản sao.');
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [notebooks, storageKey]);

  // ==========================================
  // UI & TOOL STATES
  // ==========================================
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<'Tất cả' | NoteSubject>('Tất cả');
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>('');

  const [tool, setTool] = useState<InkTool>('pen');
  const [lastShapeTool, setLastShapeTool] = useState<InkShapeKind>('line');
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [showZoomMenu, setShowZoomMenu] = useState<boolean>(false);
  const [confirmClearPage, setConfirmClearPage] = useState<boolean>(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [confirmDeletePage, setConfirmDeletePage] = useState<boolean>(false);

  const [penColor, setPenColor] = useState<string>('#0f172a');
  const [penWidth, setPenWidth] = useState<number>(3.5);
  const [highlighterColor, setHighlighterColor] = useState<string>('#facc15');
  const [highlighterWidth, setHighlighterWidth] = useState<number>(22);
  const [stylusOnly, setStylusOnly] = useState<boolean>(false);

  const [zoom, setZoom] = useState<number>(0.85);
  const [isFitMode, setIsFitMode] = useState<boolean>(true);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImportingPdf, setIsImportingPdf] = useState<boolean>(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Undo / Redo history per page id
  const historyMapRef = useRef<Map<string, PageHistory>>(new Map());
  const [historyTick, setHistoryTick] = useState<number>(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const rulerBtnRef = useRef<HTMLButtonElement | null>(null);
  const activeShapeBtnRef = useRef<HTMLButtonElement | null>(null);
  const shapePopoverRef = useRef<HTMLDivElement | null>(null);

  // Auto-append page guards
  const lastAutoAddAtRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchAtBottomRef = useRef<boolean>(false);
  const hasWrittenNearBottomRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Auto-fit paper width to viewport cleanly (Scrble Ink style)
  const fitToViewportWidth = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const availW = Math.max(320, el.clientWidth - 20);
    const fit = Math.min(1.6, Math.max(0.4, Number((availW / PAGE_WIDTH).toFixed(2))));
    setZoom(fit);
    setIsFitMode(true);
  }, []);

  useEffect(() => {
    fitToViewportWidth();
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (isFitMode) {
        const availW = Math.max(320, el.clientWidth - 20);
        const fit = Math.min(1.6, Math.max(0.4, Number((availW / PAGE_WIDTH).toFixed(2))));
        setZoom(fit);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToViewportWidth, isFitMode]);

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

  const handleFocusPage = useCallback(
    (pageIdx: number) => {
      if (!activeNotebook || pageIdx === activePageIndex) return;
      setSelectedIds([]);
      setNotebooks((prev) =>
        prev.map((nb) =>
          nb.id === activeNotebook.id ? { ...nb, activePageIndex: pageIdx } : nb
        )
      );
    },
    [activeNotebook, activePageIndex]
  );

  const handleCommitElementsForPage = useCallback(
    (pageIdx: number, nextElements: InkElement[], recordHistory: boolean = true) => {
      if (!activeNotebook) return;
      const targetPage = activeNotebook.pages[pageIdx];
      if (!targetPage) return;

      if (recordHistory) {
        const h = getPageHistory(targetPage.id);
        h.past.push(targetPage.elements);
        if (h.past.length > 40) h.past.shift();
        h.future = [];
        setHistoryTick((t) => t + 1);
      }

      const now = new Date().toISOString();
      setNotebooks((prev) =>
        prev.map((nb) => {
          if (nb.id !== activeNotebook.id) return nb;
          const nextPages = nb.pages.map((p, idx) =>
            idx === pageIdx ? { ...p, elements: nextElements } : p
          );
          return { ...nb, updatedAt: now, activePageIndex: pageIdx, pages: nextPages };
        })
      );
    },
    [activeNotebook]
  );

  const handleEraseElementsForPage = useCallback(
    (pageIdx: number, erasedIds: Set<string>, pushHistoryOnce: boolean) => {
      if (!activeNotebook) return;
      const targetPage = activeNotebook.pages[pageIdx];
      if (!targetPage) return;

      if (pushHistoryOnce) {
        const h = getPageHistory(targetPage.id);
        h.past.push(targetPage.elements);
        if (h.past.length > 40) h.past.shift();
        h.future = [];
        setHistoryTick((t) => t + 1);
      }

      const now = new Date().toISOString();
      setNotebooks((prev) =>
        prev.map((nb) => {
          if (nb.id !== activeNotebook.id) return nb;
          return {
            ...nb,
            updatedAt: now,
            activePageIndex: pageIdx,
            pages: nb.pages.map((p, idx) =>
              idx === pageIdx
                ? { ...p, elements: p.elements.filter((el) => !erasedIds.has(el.id)) }
                : p
            ),
          };
        })
      );
    },
    [activeNotebook]
  );

  const handleUpdatePageTitle = useCallback(
    (pageIdx: number, nextTitle: string) => {
      if (!activeNotebook) return;
      const now = new Date().toISOString();
      setNotebooks((prev) =>
        prev.map((nb) => {
          if (nb.id !== activeNotebook.id) return nb;
          const nextPages = nb.pages.map((p, idx) =>
            idx === pageIdx ? { ...p, pageTitle: nextTitle } : p
          );
          return {
            ...nb,
            title: pageIdx === 0 && nextTitle.trim() ? nextTitle.trim() : nb.title,
            updatedAt: now,
            pages: nextPages,
          };
        })
      );
    },
    [activeNotebook]
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
  // AUTO-CREATE NEXT PAGE WHEN SWIPING / SCROLLING DOWN AT END
  // ==========================================
  const appendPageAndScroll = useCallback(
    (isAuto: boolean) => {
      if (!activeNotebook) return;
      const nowMs = Date.now();
      if (isAuto && nowMs - lastAutoAddAtRef.current < 850) return;
      lastAutoAddAtRef.current = nowMs;
      hasWrittenNearBottomRef.current = false;

      const templatePage =
        activeNotebook.pages[activeNotebook.pages.length - 1] || activePage;
      const newPage = createBlankPage(templatePage.paperStyle, templatePage.paperTheme);
      const nextPages = [...activeNotebook.pages, newPage];
      const nextIndex = nextPages.length - 1;

      setSelectedIds([]);
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

      showToast(
        isAuto ? `Đã tự động thêm Trang ${nextPages.length}` : `Đã thêm Trang ${nextPages.length}`
      );

      requestAnimationFrame(() => {
        setTimeout(() => {
          const vp = viewportRef.current;
          if (!vp) return;
          const targetEl = vp.querySelector(`[data-page-index="${nextIndex}"]`) as HTMLElement | null;
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 40);
      });
    },
    [activeNotebook, activePage, showToast]
  );

  const handleNearBottomWrite = useCallback(
    (pageIdx: number) => {
      if (!activeNotebook) return;
      if (pageIdx === activeNotebook.pages.length - 1) {
        hasWrittenNearBottomRef.current = true;
      }
    },
    [activeNotebook]
  );

  const handleViewportScroll = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || !activeNotebook) return;

    // Update activePageIndex based on scroll center
    const midY = vp.scrollTop + vp.clientHeight * 0.45;
    const pageEls = vp.querySelectorAll<HTMLElement>('[data-page-index]');
    let detectedIdx = activePageIndex;
    pageEls.forEach((el) => {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (midY >= top && midY <= bottom) {
        const idx = Number(el.dataset.pageIndex);
        if (Number.isFinite(idx)) detectedIdx = idx;
      }
    });

    if (detectedIdx !== activePageIndex) {
      setNotebooks((prev) =>
        prev.map((nb) =>
          nb.id === activeNotebook.id ? { ...nb, activePageIndex: detectedIdx } : nb
        )
      );
    }

    // Auto-create next page when user finishes writing near bottom and scrolls to bottom
    const lastPage = activeNotebook.pages[activeNotebook.pages.length - 1];
    const isAtBottom = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 8;
    if (isAtBottom && lastPage && lastPage.elements.length > 0 && hasWrittenNearBottomRef.current) {
      appendPageAndScroll(true);
    }
  }, [activeNotebook, activePageIndex, appendPageAndScroll]);

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setIsFitMode(false);
      setZoom((z) => Math.max(0.4, Math.min(2.2, Number((z + delta).toFixed(2)))));
      return;
    }

    const vp = viewportRef.current;
    if (!vp || !activeNotebook) return;
    const isAtBottom = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 16;
    if (!isAtBottom || e.deltaY <= 0) return;

    const lastPage = activeNotebook.pages[activeNotebook.pages.length - 1];
    const hasContent = Boolean(lastPage && lastPage.elements.length > 0);
    if ((hasContent && e.deltaY >= 14) || e.deltaY >= 45) {
      appendPageAndScroll(true);
    }
  };

  const handleViewportTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const vp = viewportRef.current;
    if (!vp || e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchAtBottomRef.current = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 20;
  };

  const handleViewportTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const vp = viewportRef.current;
    if (!vp || touchStartYRef.current === null || !activeNotebook) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const swipeUpDelta = touchStartYRef.current - endY; // positive = user swiped upward to move down
    touchStartYRef.current = null;

    const nowAtBottom = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 20;
    const lastPage = activeNotebook.pages[activeNotebook.pages.length - 1];
    const hasContent = Boolean(lastPage && lastPage.elements.length > 0);

    if (
      (touchAtBottomRef.current || nowAtBottom) &&
      ((hasContent && swipeUpDelta > 28) || swipeUpDelta > 56)
    ) {
      appendPageAndScroll(true);
    }
    touchAtBottomRef.current = false;
  };

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

      if (e.key === 'Escape') {
        if (showShapeMenu) {
          setShowShapeMenu(false);
          return;
        }
        if (isFullscreen) {
          setIsFullscreen(false);
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const delSet = new Set(selectedIds);
        handleCommitElementsForPage(
          activePageIndex,
          activePage.elements.filter((el) => !delSet.has(el.id))
        );
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
  }, [
    handleUndo,
    handleRedo,
    selectedIds,
    activePage.elements,
    activePageIndex,
    handleCommitElementsForPage,
    isFullscreen,
    showShapeMenu,
  ]);

  useEffect(() => {
    if (!showShapeMenu) return;
    const onPointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        shapePopoverRef.current?.contains(target) ||
        rulerBtnRef.current?.contains(target) ||
        activeShapeBtnRef.current?.contains(target)
      ) {
        return;
      }
      setShowShapeMenu(false);
    };
    window.addEventListener('pointerdown', onPointerDownOutside);
    return () => window.removeEventListener('pointerdown', onPointerDownOutside);
  }, [showShapeMenu]);

  const insertImageDataUrl = useCallback(
    (rawDataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        const natW = img.naturalWidth || 400;
        const natH = img.naturalHeight || 300;

        let finalDataUrl = rawDataUrl;
        const maxStoreDim = 1280;
        const storeScale = Math.min(1, maxStoreDim / Math.max(natW, natH));
        if (rawDataUrl.length > 180_000 || storeScale < 1) {
          try {
            const off = document.createElement('canvas');
            off.width = Math.max(1, Math.round(natW * storeScale));
            off.height = Math.max(1, Math.round(natH * storeScale));
            const octx = off.getContext('2d');
            if (octx) {
              octx.fillStyle = '#ffffff';
              octx.fillRect(0, 0, off.width, off.height);
              octx.drawImage(img, 0, 0, off.width, off.height);
              finalDataUrl = off.toDataURL('image/jpeg', 0.86);
            }
          } catch {}
        }

        const maxW = 680;
        const maxH = 520;
        const ratio = Math.min(1, maxW / natW, maxH / natH);
        const w = Math.max(40, Math.round(natW * ratio));
        const h = Math.max(40, Math.round(natH * ratio));

        const newItem: InkImageItem = {
          id: createId('img'),
          kind: 'image',
          x: Math.round((PAGE_WIDTH - w) / 2),
          y: Math.round((PAGE_HEIGHT - h) / 2),
          width: w,
          height: h,
          dataUrl: finalDataUrl,
        };
        handleCommitElementsForPage(activePageIndex, [...activePage.elements, newItem]);
        setSelectedIds([newItem.id]);
        setTool('select');
        showToast('Đã chèn ảnh vào trang ghi chú');
      };
      img.src = rawDataUrl;
    },
    [activePage.elements, activePageIndex, handleCommitElementsForPage, showToast]
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
    showToast('Đã tạo sổ ghi chú mới');
  };

  const handleDeleteNotebook = (nbId: string) => {
    if (notebooks.length <= 1) {
      const fresh = createNewNotebook('Nháp mới', 'Toán Học', 'lined', 'white');
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
              pages: nb.pages.map((p) => ({ ...p, paperStyle: style, paperTheme: theme })),
            }
      )
    );
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
    handleCommitElementsForPage(
      activePageIndex,
      activePage.elements.filter((el) => !delSet.has(el.id))
    );
    setSelectedIds([]);
  };

  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return;
    const selSet = new Set(selectedIds);
    const clones = activePage.elements
      .filter((el) => selSet.has(el.id))
      .map((el) => ({ ...translateElement(el, 28, 28), id: createId(el.kind.slice(0, 3)) }));
    handleCommitElementsForPage(activePageIndex, [...activePage.elements, ...clones]);
    setSelectedIds(clones.map((c) => c.id));
  };

  const handleRecolorSelected = (color: string) => {
    if (selectedIds.length === 0) return;
    const selSet = new Set(selectedIds);
    handleCommitElementsForPage(
      activePageIndex,
      activePage.elements.map((el) => (selSet.has(el.id) ? recolorElement(el, color) : el))
    );
  };

  const handleScaleSelectedImages = (factor: number) => {
    if (selectedIds.length === 0) return;
    const selSet = new Set(selectedIds);
    handleCommitElementsForPage(
      activePageIndex,
      activePage.elements.map((el) => {
        if (!selSet.has(el.id) || el.kind !== 'image') return el;
        const nextW = Math.max(80, Math.min(PAGE_WIDTH - 40, Math.round(el.width * factor)));
        const nextH = Math.max(60, Math.min(PAGE_HEIGHT - 40, Math.round(el.height * factor)));
        return { ...el, width: nextW, height: nextH };
      })
    );
  };

  const hasSelectedImage = useMemo(() => {
    if (selectedIds.length === 0) return false;
    const selSet = new Set(selectedIds);
    return activePage.elements.some((el) => selSet.has(el.id) && el.kind === 'image');
  }, [selectedIds, activePage.elements]);

  // ==========================================
  // EXPORT PNG & MULTI-PAGE PDF
  // ==========================================
  const handleExportPng = async () => {
    if (!activeNotebook) return;
    setIsExporting(true);
    try {
      const canvas = await renderPageToCanvas(activePage, 1.5);
      const safeTitle = (activeNotebook.title || 'ghi-chu').replace(/[^a-zA-Z0-9\u00C0-\u1EF9_-]+/g, '_');
      const filename = `${safeTitle}_trang_${activePageIndex + 1}.png`;

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/png');
      });

      const link = document.createElement('a');
      let objectUrl: string | null = null;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
      } else {
        link.href = canvas.toDataURL('image/png');
      }

      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (objectUrl) {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 1500);
      }
      showToast(`Đã lưu hình ảnh PNG (Trang ${activePageIndex + 1})`);
    } catch {
      showToast('Không thể xuất hình ảnh, vui lòng thử lại');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeNotebook) return;
    setIsExporting(true);
    try {
      const jspdfMod = await import('jspdf');
      const JsPdfCtor = jspdfMod.jsPDF || jspdfMod.default;
      const firstPg = activeNotebook.pages[0];
      const firstH = firstPg?.height || PAGE_HEIGHT;
      const pdf = new JsPdfCtor({
        orientation: firstH > PAGE_WIDTH ? 'portrait' : 'landscape',
        unit: 'px',
        format: [PAGE_WIDTH, firstH],
        hotfixes: ['px_scaling'],
      });
      for (let i = 0; i < activeNotebook.pages.length; i++) {
        const pg = activeNotebook.pages[i];
        const pgH = pg.height || PAGE_HEIGHT;
        if (i > 0) pdf.addPage([PAGE_WIDTH, pgH], pgH > PAGE_WIDTH ? 'portrait' : 'landscape');
        const pageCanvas = await renderPageToCanvas(pg, 1.25);
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_WIDTH, pgH);
      }
      const safeTitle = (activeNotebook.title || 'ghi-chu').replace(/[^a-zA-Z0-9\u00C0-\u1EF9_-]+/g, '_');
      pdf.save(`${safeTitle}.pdf`);
      showToast(`Đã xuất file PDF (${activeNotebook.pages.length} trang)`);
    } catch {
      showToast('Không thể xuất file PDF, vui lòng thử lại');
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

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsImportingPdf(true);
    showToast('Đang tải và xử lý các trang PDF...');

    try {
      let pdfjs = (window as any).pdfjsLib;
      if (!pdfjs) {
        let attempts = 0;
        while (!pdfjs && attempts < 25) {
          await new Promise((r) => setTimeout(r, 100));
          pdfjs = (window as any).pdfjsLib;
          attempts++;
        }
      }
      if (!pdfjs) {
        throw new Error('Trình đọc PDF chưa sẵn sàng, vui lòng tải lại trang.');
      }

      const arrayBuf = await file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
      const maxPagesToImport = Math.min(pdfDoc.numPages, 25);
      const importedPages: NotePage[] = [];

      for (let pageNum = 1; pageNum <= maxPagesToImport; pageNum++) {
        const pdfPage = await pdfDoc.getPage(pageNum);
        const vp1 = pdfPage.getViewport({ scale: 1 });
        const renderWidth = 1400;
        const renderScale = renderWidth / Math.max(1, vp1.width);
        const viewport = pdfPage.getViewport({ scale: renderScale });
        const pageH = Math.max(720, Math.min(2800, Math.round(PAGE_WIDTH * (vp1.height / Math.max(1, vp1.width)))));

        const offCanvas = document.createElement('canvas');
        offCanvas.width = renderWidth;
        offCanvas.height = Math.max(1, Math.round(viewport.height));
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) continue;

        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

        await pdfPage.render({
          canvasContext: offCtx,
          viewport,
        }).promise;

        const dataUrl = offCanvas.toDataURL('image/jpeg', 0.8);
        importedPages.push({
          id: createId('page'),
          paperStyle: 'blank',
          paperTheme: 'white',
          height: pageH,
          backgroundDataUrl: dataUrl,
          elements: [],
        });
      }

      if (importedPages.length === 0) {
        throw new Error('Không đọc được trang nào từ tệp PDF này.');
      }

      const cleanTitle = file.name.replace(/\.pdf$/i, '').trim() || 'Tài liệu PDF';
      const now = new Date().toISOString();
      const newNb: InkNoteBook = {
        id: createId('nb'),
        title: cleanTitle,
        subject: activeNotebook?.subject || 'Toán Học',
        createdAt: now,
        updatedAt: now,
        activePageIndex: 0,
        pages: importedPages,
      };

      setNotebooks((prev) => [newNb, ...prev]);
      setActiveNotebookId(newNb.id);
      setSelectedIds([]);

      requestAnimationFrame(() => {
        viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        fitToViewportWidth();
      });

      const suffix =
        pdfDoc.numPages > maxPagesToImport
          ? ` (đã nhập ${maxPagesToImport}/${pdfDoc.numPages} trang đầu)`
          : ` (${importedPages.length} trang)`;
      showToast(`Đã mở file PDF${suffix} — Bạn có thể viết trực tiếp lên trang!`);
    } catch (err: any) {
      showToast(err?.message || 'Không thể mở tệp PDF, vui lòng kiểm tra lại file.');
    } finally {
      setIsImportingPdf(false);
    }
  };

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

  const isShapeActive = isShapeTool(tool);

  const activeColor = tool === 'highlighter' ? highlighterColor : penColor;
  const activeWidth = tool === 'highlighter' ? highlighterWidth : penWidth;

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-white flex flex-col'
          : 'max-w-[1440px] mx-auto px-1 sm:px-3'
      }`}
    >
      <div
        className={`relative bg-white border border-slate-200 overflow-hidden flex flex-col shadow-sm ${
          isFullscreen
            ? 'flex-1 rounded-none border-0'
            : 'rounded-xl h-[calc(100dvh-8.75rem)] min-h-[540px]'
        }`}
      >
        {/* ============================================================ */}
        {/* SCRBLE INK SINGLE-ROW MINIMALIST TOP TOOLBAR                 */}
        {/* ============================================================ */}
        <div className="bg-white border-b border-slate-200 px-2 sm:px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          {/* LEFT GROUP: Drawer, Export PNG/PDF, Undo/Redo, Image, Add Page, Paper Settings */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Danh sách sổ ghi chú"
              aria-label="Danh sách sổ ghi chú"
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                sidebarOpen
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Menu size={18} />
            </button>

            <button
              type="button"
              onClick={handleExportPng}
              disabled={isExporting}
              title="Xuất hình ảnh (PNG)"
              aria-label="Xuất hình ảnh (PNG)"
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Download size={14} className="text-blue-600 shrink-0" />
              <span>Xuất hình ảnh</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              title="Xuất toàn bộ sổ ghi chú thành tệp PDF"
              aria-label="Xuất PDF"
              className="h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <FileDown size={13} />
              <span className="hidden xl:inline">Xuất PDF</span>
            </button>

            <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />

            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Hoàn tác (Ctrl+Z)"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Undo2 size={16} />
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Làm lại (Ctrl+Y)"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Redo2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              disabled={isImportingPdf}
              title="Tải file PDF lên để viết bài trực tiếp lên từng trang"
              aria-label="Mở file PDF để viết"
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isImportingPdf ? (
                <Loader2 size={14} className="text-emerald-600 animate-spin shrink-0" />
              ) : (
                <FileUp size={14} className="text-emerald-600 shrink-0" />
              )}
              <span className="hidden sm:inline">Mở PDF</span>
            </button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Chèn ảnh (hoặc Ctrl+V để dán)"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ImagePlus size={16} />
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
              onClick={() => appendPageAndScroll(false)}
              title="Thêm trang mới"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <FilePlus2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSettingsMenu((v) => !v);
                setShowShapeMenu(false);
                setShowZoomMenu(false);
              }}
              title="Kiểu giấy, màu nền & quản lý trang"
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                showSettingsMenu
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* CENTER GROUP: Title · Page Indicator · Fit/Zoom */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0 shrink-0 px-1">
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  autoFocus
                  className="h-7 px-2 rounded-md border border-blue-400 text-xs font-semibold text-slate-900 focus:outline-none w-32 sm:w-44"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(activeNotebook?.title || '');
                  setEditingTitle(true);
                }}
                title="Nhấn để đổi tên sổ ghi chú"
                className="font-semibold text-slate-800 hover:text-blue-600 truncate max-w-[110px] sm:max-w-[180px] cursor-pointer"
              >
                {activeNotebook?.title}
              </button>
            )}

            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="tabular-nums font-medium text-slate-600 whitespace-nowrap">
              {activePageIndex + 1} / {activeNotebook?.pages.length || 1}
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setShowZoomMenu((v) => !v);
                  setShowSettingsMenu(false);
                  setShowShapeMenu(false);
                }}
                title="Thu phóng trang giấy"
                className="px-1.5 py-1 rounded-md hover:bg-slate-100 text-slate-600 font-medium tabular-nums whitespace-nowrap cursor-pointer"
              >
                {isFitMode ? `Fit (${Math.round(zoom * 100)}%)` : `${Math.round(zoom * 100)}%`}
              </button>
            </div>
          </div>

          {/* RIGHT GROUP: Nib Indicator, Pen Color Dots, Highlighter Circles, Width Dots, Tool Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Active Pen Nib Circle (Scrble Ink signature black circle) */}
            <button
              type="button"
              onClick={() => setTool('pen')}
              title="Bút mực viết tay"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xs shrink-0 cursor-pointer transition-transform hover:scale-105"
              style={{
                backgroundColor:
                  tool === 'highlighter'
                    ? '#1e293b'
                    : penColor === '#ffffff'
                    ? '#334155'
                    : penColor,
              }}
            >
              <PenNibIcon size={15} />
            </button>

            {/* Quick Pen Color Dots */}
            <div className="flex items-center gap-1.5 px-1">
              {SCRBLE_PEN_SWATCHES.map((sw) => {
                const selected = tool !== 'highlighter' && penColor.toLowerCase() === sw.color.toLowerCase();
                return (
                  <button
                    key={sw.color}
                    type="button"
                    onClick={() => {
                      setPenColor(sw.color);
                      if (tool === 'highlighter' || tool === 'eraser_stroke' || tool === 'hand') {
                        setTool('pen');
                      }
                    }}
                    title={`Màu mực: ${sw.label}`}
                    className={`rounded-full transition-transform cursor-pointer shrink-0 ${
                      selected
                        ? 'w-3.5 h-3.5 ring-2 ring-blue-500 ring-offset-1 scale-110'
                        : 'w-2.5 h-2.5 hover:scale-125 opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: sw.color }}
                  />
                );
              })}

              {/* Custom Color Dot */}
              <label
                title="Chọn màu tùy chỉnh"
                className="w-4 h-4 rounded-full border border-slate-300 overflow-hidden cursor-pointer flex items-center justify-center bg-slate-100 shrink-0"
              >
                <Palette size={10} className="text-slate-600" />
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => {
                    if (tool === 'highlighter') setHighlighterColor(e.target.value);
                    else {
                      setPenColor(e.target.value);
                      if (tool === 'eraser_stroke' || tool === 'hand') setTool('pen');
                    }
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Highlighter Vibrant Circles (Yellow, Green, Cyan) */}
            <div className="flex items-center gap-1.5 pl-0.5">
              {SCRBLE_HIGHLIGHTER_SWATCHES.map((sw) => {
                const selected =
                  tool === 'highlighter' &&
                  highlighterColor.toLowerCase() === sw.color.toLowerCase();
                return (
                  <button
                    key={sw.color}
                    type="button"
                    onClick={() => {
                      setHighlighterColor(sw.color);
                      setTool('highlighter');
                    }}
                    title={`Bút dạ quang: ${sw.label}`}
                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer shrink-0 ${
                      selected
                        ? 'ring-2 ring-slate-900 ring-offset-1 scale-110'
                        : 'hover:scale-110 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: sw.color }}
                  />
                );
              })}
            </div>

            {/* Stroke Width Dots */}
            <div className="hidden md:flex items-center gap-1.5 px-1">
              {(tool === 'highlighter' ? [14, 22, 34] : [2, 3.5, 6.5]).map((w, idx) => {
                const sizePx = idx === 0 ? 6 : idx === 1 ? 10 : 14;
                const selected = Math.abs(activeWidth - w) < 0.7;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      if (tool === 'highlighter') setHighlighterWidth(w);
                      else setPenWidth(w);
                    }}
                    title={`Cỡ nét ${w}px`}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      selected ? 'bg-slate-200/80 ring-1 ring-slate-400' : 'hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="rounded-full block bg-slate-900"
                      style={{ width: sizePx, height: sizePx }}
                    />
                  </button>
                );
              })}
            </div>

            <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />

            {/* Scrble Ink Tool Icons Strip (Active Ink Pen in solid blue circle) */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setTool('pen')}
                title="Bút mực tự do (hỗ trợ lực nhấn)"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  tool === 'pen'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <PenLine size={16} />
              </button>

              <button
                type="button"
                onClick={() => setTool('pencil')}
                title="Bút chì nét đều"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  tool === 'pencil'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Pencil size={15} />
              </button>

              <button
                ref={rulerBtnRef}
                type="button"
                onClick={() => {
                  setShowShapeMenu((v) => !v);
                  setShowSettingsMenu(false);
                  setShowZoomMenu(false);
                }}
                title="Thước kẻ & Bảng hình học"
                aria-expanded={showShapeMenu}
                aria-haspopup="true"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  showShapeMenu
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Ruler size={16} />
              </button>

              <button
                ref={activeShapeBtnRef}
                type="button"
                onClick={() => {
                  if (!isShapeActive) {
                    setTool(lastShapeTool);
                  } else {
                    setShowShapeMenu((v) => !v);
                  }
                  setShowSettingsMenu(false);
                  setShowZoomMenu(false);
                }}
                title="Hình học đang chọn (nhấn để vẽ hoặc mở bảng chọn)"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isShapeActive
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ShapeGlyph shape={lastShapeTool} size={17} />
              </button>

              <button
                type="button"
                onClick={() => setTool('text')}
                title="Chèn chữ & ký hiệu Toán"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  tool === 'text'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Type size={16} />
              </button>

              <button
                type="button"
                onClick={() => setTool('eraser_stroke')}
                title="Tẩy nét (chạm hoặc quét qua nét cần xóa)"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  tool === 'eraser_stroke'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Eraser size={16} />
              </button>

              <button
                type="button"
                onClick={() => setTool('select')}
                title="Chọn, di chuyển & đổi màu nét vẽ"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  tool === 'select'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Lasso size={16} />
              </button>

              <button
                type="button"
                onClick={() => setTool('laser')}
                title="Đèn Laser chỉ bài"
                className={`w-8 h-8 rounded-full hidden sm:flex items-center justify-center transition-colors cursor-pointer ${
                  tool === 'laser'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Sparkles size={15} />
              </button>

              <button
                type="button"
                onClick={() => setTool('hand')}
                title="Kéo di chuyển trang (hoặc giữ phím Space)"
                className={`w-8 h-8 rounded-full hidden sm:flex items-center justify-center transition-colors cursor-pointer ${
                  tool === 'hand'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Hand size={15} />
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen((f) => !f)}
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Floating 6-Column Scrble Ink Ruler Shape & Text Popover */}
        {showShapeMenu && (
          <div
            ref={shapePopoverRef}
            role="dialog"
            aria-label="Bảng chọn hình học và văn bản"
            className="absolute top-[50px] right-2 sm:right-14 z-40 w-[278px] bg-white border border-slate-200/95 rounded-lg shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="grid grid-cols-6 gap-1">
              {RULER_GRID_ITEMS.map((item) => {
                const isActive = tool === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'text') {
                        setTool('text');
                      } else {
                        setTool(item.id);
                        setLastShapeTool(item.id);
                      }
                      setShowShapeMenu(false);
                    }}
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={isActive}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <ShapeGlyph shape={item.id} size={20} />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between px-1 text-[11px] text-slate-400">
              <span>Chọn công cụ để vẽ hoặc nhập chữ</span>
              <span>Shift: căn đều</span>
            </div>
          </div>
        )}

        {/* Zoom Quick Bar when Fit (%) clicked */}
        {showZoomMenu && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsFitMode(false);
                setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))));
              }}
              className="h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <ZoomOut size={13} />
              <span>Thu nhỏ</span>
            </button>
            <button
              type="button"
              onClick={fitToViewportWidth}
              className={`h-7 px-3 rounded-md text-xs font-semibold border cursor-pointer ${
                isFitMode
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Vừa khung (Fit)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFitMode(false);
                setZoom(1);
              }}
              className="h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFitMode(false);
                setZoom((z) => Math.min(2.2, Number((z + 0.1).toFixed(2))));
              }}
              className="h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <ZoomIn size={13} />
              <span>Phóng to</span>
            </button>
          </div>
        )}

        {/* Paper Style, Theme, Stylus-Only & Page Actions Panel (SlidersHorizontal) */}
        {showSettingsMenu && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {activePage.backgroundDataUrl ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <span>Đang ghi chú trực tiếp trên trang PDF (dữ liệu lưu cục bộ trên máy)</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-600">Dòng kẻ:</span>
                  {(
                    [
                      { id: 'lined', label: 'Kẻ ngang Scrble', icon: AlignJustify },
                      { id: 'grid', label: 'Ô ly vuông', icon: Grid3X3 },
                      { id: 'dots', label: 'Chấm bi', icon: MoreDotsIcon },
                      { id: 'blank', label: 'Giấy trơn', icon: Square },
                    ] as const
                  ).map((ps) => {
                    const Icon = ps.icon;
                    const active = activePage.paperStyle === ps.id;
                    return (
                      <button
                        key={ps.id}
                        type="button"
                        onClick={() => handleUpdatePaper(ps.id, activePage.paperTheme)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                          active
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon size={13} />
                        <span>{ps.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-600">Nền giấy:</span>
                  {(Object.keys(PAPER_THEME_META) as PaperTheme[]).map((themeKey) => {
                    const meta = PAPER_THEME_META[themeKey];
                    const active = activePage.paperTheme === themeKey;
                    return (
                      <button
                        key={themeKey}
                        type="button"
                        onClick={() => handleUpdatePaper(activePage.paperStyle, themeKey)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                          meta.swatchClass
                        } ${active ? 'ring-2 ring-blue-500 ring-offset-1' : 'opacity-85 hover:opacity-100'}`}
                      >
                        {active && <Check size={12} />}
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setStylusOnly((s) => !s)}
                className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  stylusOnly
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <PenTool size={13} />
                <span>{stylusOnly ? 'Chỉ bút cảm ứng: BẬT' : 'Chỉ bút cảm ứng'}</span>
              </button>

              <button
                type="button"
                onClick={handleDuplicatePage}
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Copy size={13} />
                <span>Nhân bản trang {activePageIndex + 1}</span>
              </button>

              {activeNotebook && activeNotebook.pages.length > 1 && (
                !confirmDeletePage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeletePage(true);
                      setConfirmClearPage(false);
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-semibold cursor-pointer"
                  >
                    Xóa trang {activePageIndex + 1}
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    <button
                      type="button"
                      onClick={handleDeleteCurrentPage}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Xác nhận xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePage(false)}
                      className="px-2 py-0.5 rounded bg-white text-slate-700 text-[11px] border border-slate-200 cursor-pointer"
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
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Xóa sạch trang {activePageIndex + 1}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleCommitElementsForPage(activePageIndex, []);
                        setSelectedIds([]);
                        setConfirmClearPage(false);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Xóa hết nét
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearPage(false)}
                      className="px-2 py-0.5 rounded bg-white text-slate-700 text-[11px] border border-slate-200 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MAIN BODY: COLLAPSIBLE NOTEBOOK DRAWER + CONTINUOUS PAGES    */}
        {/* ============================================================ */}
        <div className="flex-1 flex min-h-0 relative">
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/30 z-20 md:hidden"
              aria-hidden="true"
            />
          )}

          {sidebarOpen && (
            <aside className="absolute inset-y-0 left-0 md:static w-64 sm:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 z-30 shadow-xl md:shadow-none">
              <div className="p-3 border-b border-slate-200 space-y-2.5">
                <button
                  type="button"
                  onClick={handleCreateNotebook}
                  className="w-full h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Tạo Sổ Ghi Chú Mới</span>
                </button>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm sổ ghi chú..."
                      className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={activeNotebook?.subject || 'Toán Học'}
                    onChange={(e) => handleChangeSubject(e.target.value as NoteSubject)}
                    aria-label="Chọn môn học"
                    className="h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {NOTE_SUBJECTS.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
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
                              setConfirmDeleteNoteId(null);
                              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                setSidebarOpen(false);
                              }
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
                              {currentUserName && isActive && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{currentUserName}</span>
                                </>
                              )}
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
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100 relative">
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
                {hasSelectedImage && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleScaleSelectedImages(0.85)}
                      title="Thu nhỏ ảnh"
                      className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <ZoomOut size={13} />
                      <span>Nhỏ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScaleSelectedImages(1.18)}
                      title="Phóng to ảnh"
                      className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <ZoomIn size={13} />
                      <span>Lớn</span>
                    </button>
                    <div className="w-px h-4 bg-slate-200" />
                  </>
                )}
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

            {/* Continuous Multi-Page Scrollable Viewport */}
            <div
              ref={viewportRef}
              onScroll={handleViewportScroll}
              onWheel={handleViewportWheel}
              onTouchStart={handleViewportTouchStart}
              onTouchEnd={handleViewportTouchEnd}
              className="flex-1 overflow-auto p-1.5 sm:p-2.5"
            >
              <div className="min-w-full w-max flex flex-col items-center">
                {(activeNotebook?.pages || [activePage]).map((pg, idx, arr) => (
                  <InkPageCanvas
                    key={pg.id}
                    page={pg}
                    pageIndex={idx}
                    totalPages={arr.length}
                    isActive={idx === activePageIndex}
                    zoom={zoom}
                    tool={tool}
                    penColor={penColor}
                    penWidth={penWidth}
                    highlighterColor={highlighterColor}
                    highlighterWidth={highlighterWidth}
                    stylusOnly={stylusOnly}
                    isSpacePressed={isSpacePressed}
                    selectedIds={selectedIds}
                    viewportRef={viewportRef}
                    onFocusPage={handleFocusPage}
                    onSelectIds={setSelectedIds}
                    onCommitElements={handleCommitElementsForPage}
                    onEraseElements={handleEraseElementsForPage}
                    onUpdatePageTitle={handleUpdatePageTitle}
                    onDismissPopovers={() => {
                      setShowShapeMenu(false);
                      setShowSettingsMenu(false);
                      setShowZoomMenu(false);
                    }}
                    onNearBottomWrite={handleNearBottomWrite}
                  />
                ))}

                {/* Subtle Bottom Auto-Create Hint & Manual Add Trigger */}
                <div className="py-4 flex items-center justify-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">
                    Viết gần hết trang rồi cuộn hoặc vuốt xuống để tự động tạo trang mới
                  </span>
                  <button
                    type="button"
                    onClick={() => appendPageAndScroll(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus size={13} className="text-blue-600" />
                    <span>Thêm trang</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

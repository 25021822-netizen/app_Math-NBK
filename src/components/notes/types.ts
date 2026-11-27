export type InkShapeKind =
  | 'line'
  | 'dashed_line'
  | 'dashdot_line'
  | 'arrow'
  | 'double_arrow'
  | 'ray'
  | 'circle'
  | 'ellipse'
  | 'capsule'
  | 'rect'
  | 'triangle_right'
  | 'triangle'
  | 'right_triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'heptagon'
  | 'octagon'
  | 'nonagon'
  | 'star'
  | 'axes'
  | 'axes3d';

export const SHAPE_TOOL_LIST: readonly InkShapeKind[] = [
  'line',
  'dashed_line',
  'dashdot_line',
  'arrow',
  'double_arrow',
  'ray',
  'circle',
  'ellipse',
  'capsule',
  'rect',
  'triangle_right',
  'triangle',
  'right_triangle',
  'diamond',
  'pentagon',
  'hexagon',
  'heptagon',
  'octagon',
  'nonagon',
  'star',
  'axes',
  'axes3d',
];

const SHAPE_TOOL_SET = new Set<string>(SHAPE_TOOL_LIST);

export function isShapeTool(tool: string): tool is InkShapeKind {
  return SHAPE_TOOL_SET.has(tool);
}

export type InkTool =
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser_stroke'
  | 'select'
  | InkShapeKind
  | 'text'
  | 'laser'
  | 'hand';

export type PaperStyle = 'blank' | 'lined' | 'grid' | 'dots';
export type PaperTheme = 'white' | 'cream' | 'slate' | 'chalkboard';
export type NoteSubject = 'Chung' | 'Toán Học' | 'Vật Lý' | 'Hóa Học';

export interface InkPoint {
  x: number;
  y: number;
  p: number; // pressure 0.1 - 1.0
  t: number; // timestamp ms
}

export interface InkStroke {
  id: string;
  kind: 'stroke';
  tool: 'pen' | 'pencil' | 'highlighter';
  color: string;
  width: number;
  opacity: number;
  points: InkPoint[];
}

export interface InkShape {
  id: string;
  kind: 'shape';
  shape: InkShapeKind;
  color: string;
  width: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface InkTextItem {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface InkImageItem {
  id: string;
  kind: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
}

export type InkElement = InkStroke | InkShape | InkTextItem | InkImageItem;

export interface NotePage {
  id: string;
  paperStyle: PaperStyle;
  paperTheme: PaperTheme;
  pageTitle?: string;
  height?: number;
  backgroundDataUrl?: string;
  elements: InkElement[];
}

export interface InkNoteBook {
  id: string;
  title: string;
  subject: NoteSubject;
  createdAt: string;
  updatedAt: string;
  activePageIndex: number;
  pages: NotePage[];
}

export const PAGE_WIDTH = 1600;
export const PAGE_HEIGHT = 1040;

export const PAPER_THEME_META: Record<
  PaperTheme,
  {
    label: string;
    bg: string;
    line: string;
    dot: string;
    defaultInk: string;
    swatchClass: string;
  }
> = {
  white: {
    label: 'Giấy trắng',
    bg: '#ffffff',
    line: 'rgba(59, 130, 246, 0.28)',
    dot: 'rgba(100, 116, 139, 0.32)',
    defaultInk: '#0f172a',
    swatchClass: 'bg-white border-slate-300 text-slate-800',
  },
  cream: {
    label: 'Giấy kem',
    bg: '#fdf8ee',
    line: 'rgba(180, 148, 102, 0.25)',
    dot: 'rgba(161, 132, 92, 0.35)',
    defaultInk: '#1c1917',
    swatchClass: 'bg-[#fdf8ee] border-amber-300 text-stone-800',
  },
  slate: {
    label: 'Giấy tối',
    bg: '#0f172a',
    line: 'rgba(148, 163, 184, 0.16)',
    dot: 'rgba(148, 163, 184, 0.26)',
    defaultInk: '#f8fafc',
    swatchClass: 'bg-slate-900 border-slate-700 text-slate-100',
  },
  chalkboard: {
    label: 'Bảng xanh',
    bg: '#153229',
    line: 'rgba(209, 250, 229, 0.14)',
    dot: 'rgba(209, 250, 229, 0.24)',
    defaultInk: '#f8fafc',
    swatchClass: 'bg-[#153229] border-emerald-800 text-emerald-50',
  },
};

export const INK_COLOR_SWATCHES = [
  { color: '#0f172a', label: 'Đen mực' },
  { color: '#2563eb', label: 'Xanh dương' },
  { color: '#dc2626', label: 'Đỏ son' },
  { color: '#059669', label: 'Xanh lá' },
  { color: '#d97706', label: 'Cam hổ phách' },
  { color: '#7c3aed', label: 'Tím' },
  { color: '#0891b2', label: 'Xanh ngọc' },
  { color: '#ffffff', label: 'Trắng phấn' },
];

export const HIGHLIGHTER_COLOR_SWATCHES = [
  { color: '#facc15', label: 'Vàng chanh' },
  { color: '#4ade80', label: 'Xanh dạ quang' },
  { color: '#38bdf8', label: 'Xanh dương sáng' },
  { color: '#f472b6', label: 'Hồng sáng' },
  { color: '#fb923c', label: 'Cam sáng' },
];

export const MATH_QUICK_SYMBOLS = [
  'π',
  '√',
  '∫',
  '∑',
  '∞',
  '≤',
  '≥',
  '≠',
  '≈',
  '∈',
  '∀',
  '∃',
  '⇒',
  '⇔',
  '∠',
  '△',
  '⊥',
  '∥',
  '°',
  '→',
  'Δ',
  'α',
  'β',
  'θ',
  '²',
  '³',
];

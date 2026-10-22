import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Info,
  Circle,
  Ruler,
  Layers,
  Download,
  Eye,
  EyeOff,
  Compass,
  ArrowRight,
  Sliders,
  CornerDownRight,
  MousePointerClick,
  Crosshair,
  Target,
} from 'lucide-react';

// ==========================================
// TYPES
// ==========================================
export type Shape3DType =
  | 'pyramid_quad' // Chóp tứ giác S.ABCD
  | 'pyramid_tri'  // Chóp tam giác S.ABC
  | 'cone'         // Khối nón tròn xoay
  | 'cube'         // Khối lập phương
  | 'prism'        // Lăng trụ tam giác
  | 'cylinder';    // Khối trụ tròn xoay

export interface Point3D {
  name: string;
  x: number;
  y: number;
  z: number;
  label?: string;
  color?: string;
  isCustom?: boolean;
}

export interface Line3D {
  id: string;
  type: 'segment' | 'line' | 'ray' | 'perpendicular';
  p1: string;
  p2: string;
  style: 'solid' | 'dashed';
  color: string;
  label?: string;
  footPointName?: string; // Chân đường vuông góc nếu là perpendicular
}

export interface Plane3D {
  id: string;
  name: string;
  pointNames: string[]; // 3 hoặc nhiều điểm
  colorTheme: 'amber' | 'violet' | 'emerald' | 'cyan' | 'rose';
  opacity: number;
}

interface Geometry3DStudioProps {
  onExportImage?: (dataUrl: string, title: string) => void;
}

export const Geometry3DStudio: React.FC<Geometry3DStudioProps> = ({ onExportImage }) => {
  // Chọn hình khối không gian
  const [selectedShape, setSelectedShape] = useState<Shape3DType>('pyramid_quad');

  // Góc xoay và camera
  const [rotX, setRotX] = useState<number>(20);
  const [rotY, setRotY] = useState<number>(-35);
  const [zoomLevel, setZoomLevel] = useState<number>(1.15);
  const [isRotatingAuto, setIsRotatingAuto] = useState<boolean>(false);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showHiddenLines, setShowHiddenLines] = useState<boolean>(true);
  const [showShading, setShowShading] = useState<boolean>(true);

  // Kích thước tham số
  const [heightParam, setHeightParam] = useState<number>(140);
  const [radiusParam, setRadiusParam] = useState<number>(85);

  // Tọa độ đỉnh (có thể kéo thả & di chuyển tùy ý)
  const [vertexCoords, setVertexCoords] = useState<Record<string, Point3D>>({});

  // Danh sách các đối tượng do người dùng tự dựng
  const [customPoints, setCustomPoints] = useState<Point3D[]>([]);
  const [customLines, setCustomLines] = useState<Line3D[]>([]);
  const [customPlanes, setCustomPlanes] = useState<Plane3D[]>([]);

  // Điểm đang được chọn để di chuyển hoặc tinh chỉnh tọa độ
  const [selectedPointName, setSelectedPointName] = useState<string | null>(null);

  // Phân chia danh mục công cụ 3D rõ ràng theo yêu cầu
  const [activeCategory, setActiveCategory] = useState<'points' | 'lines' | 'planes' | 'move'>('points');

  // Trạng thái thao tác Tạo Điểm
  const [pointCreationMode, setPointCreationMode] = useState<'ratio' | 'centroid' | 'manual'>('ratio');
  const [ratioPointA, setRatioPointA] = useState<string>('');
  const [ratioPointB, setRatioPointB] = useState<string>('');
  const [ratioK, setRatioK] = useState<number>(0.5);
  const [ratioPointLabel, setRatioPointLabel] = useState<string>('M');

  const [centroidA, setCentroidA] = useState<string>('');
  const [centroidB, setCentroidB] = useState<string>('');
  const [centroidC, setCentroidC] = useState<string>('');
  const [centroidLabel, setCentroidLabel] = useState<string>('G');

  const [manualPointName, setManualPointName] = useState<string>('M');
  const [manualPointX, setManualPointX] = useState<number>(0);
  const [manualPointY, setManualPointY] = useState<number>(50);
  const [manualPointZ, setManualPointZ] = useState<number>(0);
  const [manualPointColor, setManualPointColor] = useState<string>('#10b981');

  // Tọa độ ngắm thời gian thực khi rê con trỏ trên hình 3D
  const [hover3DPoint, setHover3DPoint] = useState<{
    x: number;
    y: number;
    z: number;
    surfaceName: string;
    svgX: number;
    svgY: number;
  } | null>(null);

  // Hiển thị khung nhập tọa độ tay (tùy chọn phụ mở rộng)
  const [showManualInputs, setShowManualInputs] = useState<boolean>(false);

  // Trạng thái thao tác Tạo Đường
  const [lineCreationMode, setLineCreationMode] = useState<'segment' | 'line' | 'ray' | 'perpendicular'>('segment');
  const [linePointA, setLinePointA] = useState<string>('');
  const [linePointB, setLinePointB] = useState<string>('');
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed'>('solid');
  const [lineColor, setLineColor] = useState<string>('#2563eb');

  // Trạng thái thao tác Tạo Mặt
  const [planePoint1, setPlanePoint1] = useState<string>('');
  const [planePoint2, setPlanePoint2] = useState<string>('');
  const [planePoint3, setPlanePoint3] = useState<string>('');
  const [planeColorTheme, setPlaneColorTheme] = useState<'amber' | 'violet' | 'emerald' | 'cyan' | 'rose'>('amber');
  const [planeOpacity, setPlaneOpacity] = useState<number>(0.35);

  // Thông báo phản hồi người dùng
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<boolean>(false);

  // Kéo thả chuột trực tiếp trên điểm
  const [draggingPointName, setDraggingPointName] = useState<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; origCoord: Point3D } | null>(null);

  // ==========================================
  // KHỞI TẠO TỌA ĐỘ ĐỈNH CHUẨN KHI ĐỔI HÌNH
  // Xóa sạch tất cả các cài đặt sẵn của hình chóp
  // ==========================================
  const initDefaultVertices = (shape: Shape3DType, h = heightParam, r = radiusParam) => {
    let base: Record<string, Point3D> = {};

    if (shape === 'pyramid_quad') {
      // Hình chóp tứ giác S.ABCD: CHỈ CÓ ĐỈNH VÀ HÌNH CHÓP, KHÔNG CÓ TRUNG ĐIỂM, ĐƯỜNG CAO HAY THIẾT DIỆN CÀI SẴN
      const a = 90;
      const b = 70;
      base = {
        S: { name: 'S', x: 0, y: h, z: 0, label: 'S' },
        A: { name: 'A', x: -a, y: 0, z: b, label: 'A' },
        B: { name: 'B', x: a, y: 0, z: b, label: 'B' },
        C: { name: 'C', x: a + 20, y: 0, z: -b, label: 'C' },
        D: { name: 'D', x: -a + 20, y: 0, z: -b, label: 'D' },
      };
    } else if (shape === 'pyramid_tri') {
      // Hình chóp tam giác S.ABC: CHỈ CÓ S, A, B, C THUẦN TÚY
      base = {
        S: { name: 'S', x: 0, y: h, z: 0, label: 'S' },
        A: { name: 'A', x: -90, y: 0, z: 70, label: 'A' },
        B: { name: 'B', x: 90, y: 0, z: 70, label: 'B' },
        C: { name: 'C', x: 20, y: 0, z: -80, label: 'C' },
      };
    } else if (shape === 'cone') {
      // Khối nón tròn xoay
      base = {
        S: { name: 'S', x: 0, y: h, z: 0, label: 'S' },
        O: { name: 'O', x: 0, y: 0, z: 0, label: 'O' },
        A: { name: 'A', x: -r, y: 0, z: 0, label: 'A' },
        B: { name: 'B', x: r, y: 0, z: 0, label: 'B' },
      };
    } else if (shape === 'cube') {
      const s = 65;
      const hc = h * 0.75;
      base = {
        A: { name: 'A', x: -s, y: 0, z: s, label: 'A' },
        B: { name: 'B', x: s, y: 0, z: s, label: 'B' },
        C: { name: 'C', x: s, y: 0, z: -s, label: 'C' },
        D: { name: 'D', x: -s, y: 0, z: -s, label: 'D' },
        A1: { name: "A'", x: -s, y: hc, z: s, label: "A'" },
        B1: { name: "B'", x: s, y: hc, z: s, label: "B'" },
        C1: { name: "C'", x: s, y: hc, z: -s, label: "C'" },
        D1: { name: "D'", x: -s, y: hc, z: -s, label: "D'" },
      };
    } else if (shape === 'prism') {
      const hp = h * 0.8;
      base = {
        A: { name: 'A', x: -80, y: 0, z: 50, label: 'A' },
        B: { name: 'B', x: 80, y: 0, z: 50, label: 'B' },
        C: { name: 'C', x: 10, y: 0, z: -60, label: 'C' },
        A1: { name: "A'", x: -80, y: hp, z: 50, label: "A'" },
        B1: { name: "B'", x: 80, y: hp, z: 50, label: "B'" },
        C1: { name: "C'", x: 10, y: hp, z: -60, label: "C'" },
      };
    } else if (shape === 'cylinder') {
      const hc = h * 0.8;
      base = {
        O: { name: 'O', x: 0, y: 0, z: 0, label: 'O' },
        O1: { name: "O'", x: 0, y: hc, z: 0, label: "O'" },
        A: { name: 'A', x: -r, y: 0, z: 0, label: 'A' },
        B: { name: 'B', x: r, y: 0, z: 0, label: 'B' },
        A1: { name: "A'", x: -r, y: hc, z: 0, label: "A'" },
        B1: { name: "B'", x: r, y: hc, z: 0, label: "B'" },
      };
    }
    return base;
  };

  // Khởi tạo lần đầu
  useEffect(() => {
    setVertexCoords(initDefaultVertices(selectedShape));
  }, [selectedShape]);

  // Cập nhật khi đổi chiều cao hoặc bán kính
  const handleHeightChange = (newH: number) => {
    setHeightParam(newH);
    setVertexCoords((prev) => {
      const copy = { ...prev };
      if (copy.S) copy.S = { ...copy.S, y: newH };
      if (copy.A1 && (selectedShape === 'cube' || selectedShape === 'prism' || selectedShape === 'cylinder')) {
        const factor = selectedShape === 'cube' ? 0.75 : 0.8;
        ['A1', 'B1', 'C1', 'D1', 'O1'].forEach((k) => {
          if (copy[k]) copy[k] = { ...copy[k], y: newH * factor };
        });
      }
      return copy;
    });
  };

  // Chuyển hình khối và reset đối tượng người dùng
  const handleSelectShape = (shape: Shape3DType) => {
    setSelectedShape(shape);
    setCustomPoints([]);
    setCustomLines([]);
    setCustomPlanes([]);
    setSelectedPointName(null);
    setStatusMessage(`Đã chuyển sang hình: ${getShapeTitle(shape)} (Giao diện chuẩn sạch)`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Tên tiêu đề tiếng Việt của hình
  const getShapeTitle = (shape: Shape3DType) => {
    switch (shape) {
      case 'pyramid_quad':
        return 'Hình Chóp Tứ Giác S.ABCD';
      case 'pyramid_tri':
        return 'Hình Chóp Tam Giác S.ABC (Tứ Diện)';
      case 'cone':
        return 'Khối Nón Tròn Xoay';
      case 'cube':
        return 'Khối Lập Phương';
      case 'prism':
        return 'Lăng Trụ Tam Giác';
      case 'cylinder':
        return 'Khối Trụ Tròn Xoay';
    }
  };

  // Danh sách toàn bộ các điểm có sẵn (bao gồm đỉnh gốc và điểm tự tạo)
  const allPointsMap = useMemo<Record<string, Point3D>>(() => {
    const map: Record<string, Point3D> = { ...vertexCoords };
    customPoints.forEach((pt) => {
      map[pt.name] = pt;
    });
    return map;
  }, [vertexCoords, customPoints]);

  const allPointNames = useMemo(() => Object.keys(allPointsMap), [allPointsMap]);

  // Tự động gán mặc định cho các select box khi danh sách điểm đổi
  useEffect(() => {
    if (allPointNames.length >= 2) {
      if (!ratioPointA || !allPointNames.includes(ratioPointA)) setRatioPointA(allPointNames[0]);
      if (!ratioPointB || !allPointNames.includes(ratioPointB)) setRatioPointB(allPointNames[1]);
      if (!linePointA || !allPointNames.includes(linePointA)) setLinePointA(allPointNames[0]);
      if (!linePointB || !allPointNames.includes(linePointB)) setLinePointB(allPointNames[1]);
      if (!planePoint1 || !allPointNames.includes(planePoint1)) setPlanePoint1(allPointNames[0]);
      if (!planePoint2 || !allPointNames.includes(planePoint2)) setPlanePoint2(allPointNames[1]);
      if (!planePoint3 || !allPointNames.includes(planePoint3)) {
        setPlanePoint3(allPointNames[2] || allPointNames[0]);
      }
      if (!centroidA || !allPointNames.includes(centroidA)) setCentroidA(allPointNames[0]);
      if (!centroidB || !allPointNames.includes(centroidB)) setCentroidB(allPointNames[1]);
      if (!centroidC || !allPointNames.includes(centroidC)) {
        setCentroidC(allPointNames[2] || allPointNames[0]);
      }
    }
  }, [allPointNames]);

  // ==========================================
  // HÀM CHIẾU 3D TOÁN HỌC (3D PROJECTION)
  // ==========================================
  const project3D = (x: number, y: number, z: number) => {
    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;

    // Xoay quanh trục Y
    const x1 = x * Math.cos(radY) + z * Math.sin(radY);
    const z1 = -x * Math.sin(radY) + z * Math.cos(radY);

    // Xoay quanh trục X
    const y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
    const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

    const cx = 250;
    const cy = 200;
    const scale = zoomLevel;

    return {
      x: cx + x1 * scale,
      y: cy - y2 * scale,
      depth: z2,
    };
  };

  // Tự động xoay 360° nếu được kích hoạt
  useEffect(() => {
    if (!isRotatingAuto) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 1) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, [isRotatingAuto]);

  // ==========================================
  // 1. MỤC: TẠO ĐIỂM
  // ==========================================

  // a. Tạo điểm có tỷ lệ / trung điểm
  const handleCreateRatioPoint = () => {
    if (!ratioPointA || !ratioPointB || ratioPointA === ratioPointB) {
      setStatusMessage('Vui lòng chọn 2 điểm khác nhau để chia tỉ lệ!');
      return;
    }
    const p1 = allPointsMap[ratioPointA];
    const p2 = allPointsMap[ratioPointB];
    if (!p1 || !p2) return;

    const k = ratioK;
    const newX = Math.round(p1.x + k * (p2.x - p1.x));
    const newY = Math.round(p1.y + k * (p2.y - p1.y));
    const newZ = Math.round(p1.z + k * (p2.z - p1.z));

    const name = ratioPointLabel.trim() || `M${customPoints.length + 1}`;
    const newPoint: Point3D = {
      name,
      x: newX,
      y: newY,
      z: newZ,
      label: `${name} (k=${k} ${ratioPointA}${ratioPointB})`,
      color: '#10b981',
      isCustom: true,
    };

    setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);
    setSelectedPointName(name);
    setStatusMessage(`Đã tạo điểm [${name}] trên cạnh [${ratioPointA}${ratioPointB}] với tỉ lệ k=${k}!`);
    setTimeout(() => setStatusMessage(null), 3500);

    // Chuẩn bị tên cho điểm tiếp theo
    const nextCandidates = ['N', 'P', 'Q', 'I', 'J', 'K', 'H', 'E', 'F'];
    const next = nextCandidates.find((c) => !allPointNames.includes(c) && c !== name) || `M${customPoints.length + 2}`;
    setRatioPointLabel(next);
  };

  // b. Tạo trọng tâm 3 điểm / tam giác
  const handleCreateCentroid = () => {
    if (!centroidA || !centroidB || !centroidC) {
      setStatusMessage('Vui lòng chọn đủ 3 điểm để tìm trọng tâm!');
      return;
    }
    const pts = [centroidA, centroidB, centroidC];
    if (new Set(pts).size < 3) {
      setStatusMessage('3 điểm tạo trọng tâm tam giác phải khác nhau!');
      return;
    }
    const p1 = allPointsMap[centroidA];
    const p2 = allPointsMap[centroidB];
    const p3 = allPointsMap[centroidC];
    if (!p1 || !p2 || !p3) return;

    const gX = Math.round((p1.x + p2.x + p3.x) / 3);
    const gY = Math.round((p1.y + p2.y + p3.y) / 3);
    const gZ = Math.round((p1.z + p2.z + p3.z) / 3);

    const name = centroidLabel.trim() || 'G';
    const newPoint: Point3D = {
      name,
      x: gX,
      y: gY,
      z: gZ,
      label: `${name} (Trọng tâm ${centroidA}${centroidB}${centroidC})`,
      color: '#f59e0b',
      isCustom: true,
    };

    setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);
    setSelectedPointName(name);
    setStatusMessage(`Đã tạo thành công Trọng tâm [${name}] của tam giác [${centroidA}${centroidB}${centroidC}]!`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Sinh tên điểm tự do tiếp theo không trùng với các điểm đã có
  const getNextFreePointName = (existingNames: string[]): string => {
    const letters = ['M', 'N', 'P', 'Q', 'I', 'J', 'K', 'H', 'E', 'F', 'G', 'T', 'U', 'V', 'X', 'Y', 'Z'];
    for (const l of letters) {
      if (!existingNames.includes(l)) return l;
    }
    return `M${existingNames.length + 1}`;
  };

  // Tính toán tia chiếu 3D từ điểm ảnh màn hình SVG (svgX, svgY)
  const getRayFromScreen = (svgX: number, svgY: number) => {
    const cx = 250;
    const cy = 200;
    const scale = zoomLevel;

    const x1 = (svgX - cx) / scale;
    const y2 = -(svgY - cy) / scale;

    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;

    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);

    // Gốc tia tại z_view = 0 trong không gian 3D
    const P0 = {
      x: x1 * cosY + y2 * sinX * sinY,
      y: y2 * cosX,
      z: x1 * sinY - y2 * sinX * cosY,
    };

    // Vector hướng tia (chiều sâu vào trong màn hình)
    const d = {
      x: -sinY * cosX,
      y: sinX,
      z: cosY * cosX,
    };

    return { P0, d };
  };

  // Thuật toán kiểm tra giao giữa tia và tam giác trong không gian 3D (Möller–Trumbore)
  const intersectRayTriangle = (
    P0: { x: number; y: number; z: number },
    d: { x: number; y: number; z: number },
    v0: Point3D,
    v1: Point3D,
    v2: Point3D
  ): { hit: boolean; t: number; point: { x: number; y: number; z: number } } | null => {
    const edge1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
    const edge2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };
    const h = {
      x: d.y * edge2.z - d.z * edge2.y,
      y: d.z * edge2.x - d.x * edge2.z,
      z: d.x * edge2.y - d.y * edge2.x,
    };
    const a = edge1.x * h.x + edge1.y * h.y + edge1.z * h.z;
    if (Math.abs(a) < 1e-7) return null;
    const f = 1.0 / a;
    const s = { x: P0.x - v0.x, y: P0.y - v0.y, z: P0.z - v0.z };
    const u = f * (s.x * h.x + s.y * h.y + s.z * h.z);
    if (u < -0.04 || u > 1.04) return null;

    const q = {
      x: s.y * edge1.z - s.z * edge1.y,
      y: s.z * edge1.x - s.x * edge1.z,
      z: s.x * edge1.y - s.y * edge1.x,
    };
    const v = f * (d.x * q.x + d.y * q.y + d.z * q.z);
    if (v < -0.04 || u + v > 1.04) return null;

    const t = f * (edge2.x * q.x + edge2.y * q.y + edge2.z * q.z);
    return {
      hit: true,
      t,
      point: {
        x: Math.round(P0.x + t * d.x),
        y: Math.round(P0.y + t * d.y),
        z: Math.round(P0.z + t * d.z),
      },
    };
  };

  // Xác định tọa độ 3D và bề mặt tương ứng khi con trỏ rê hoặc nhấp trực tiếp vào hình
  const calculate3DPointFromScreen = (
    svgX: number,
    svgY: number
  ): { x: number; y: number; z: number; surfaceName: string } => {
    const pts = vertexCoords;

    // 1. Bắt dính vào các Cạnh của hình nếu con trỏ ở gần cạnh <= 8.5px
    const edges: { p1: Point3D; p2: Point3D; name: string }[] = [];

    if (selectedShape === 'pyramid_quad') {
      if (pts.S && pts.A) edges.push({ p1: pts.S, p2: pts.A, name: 'Cạnh bên SA' });
      if (pts.S && pts.B) edges.push({ p1: pts.S, p2: pts.B, name: 'Cạnh bên SB' });
      if (pts.S && pts.C) edges.push({ p1: pts.S, p2: pts.C, name: 'Cạnh bên SC' });
      if (pts.S && pts.D) edges.push({ p1: pts.S, p2: pts.D, name: 'Cạnh bên SD' });
      if (pts.A && pts.B) edges.push({ p1: pts.A, p2: pts.B, name: 'Cạnh đáy AB' });
      if (pts.B && pts.C) edges.push({ p1: pts.B, p2: pts.C, name: 'Cạnh đáy BC' });
      if (pts.C && pts.D) edges.push({ p1: pts.C, p2: pts.D, name: 'Cạnh đáy CD' });
      if (pts.D && pts.A) edges.push({ p1: pts.D, p2: pts.A, name: 'Cạnh đáy DA' });
    } else if (selectedShape === 'pyramid_tri') {
      if (pts.S && pts.A) edges.push({ p1: pts.S, p2: pts.A, name: 'Cạnh bên SA' });
      if (pts.S && pts.B) edges.push({ p1: pts.S, p2: pts.B, name: 'Cạnh bên SB' });
      if (pts.S && pts.C) edges.push({ p1: pts.S, p2: pts.C, name: 'Cạnh bên SC' });
      if (pts.A && pts.B) edges.push({ p1: pts.A, p2: pts.B, name: 'Cạnh đáy AB' });
      if (pts.B && pts.C) edges.push({ p1: pts.B, p2: pts.C, name: 'Cạnh đáy BC' });
      if (pts.C && pts.A) edges.push({ p1: pts.C, p2: pts.A, name: 'Cạnh đáy CA' });
    } else if (selectedShape === 'cone') {
      if (pts.S && pts.A) edges.push({ p1: pts.S, p2: pts.A, name: 'Đường sinh SA' });
      if (pts.S && pts.B) edges.push({ p1: pts.S, p2: pts.B, name: 'Đường sinh SB' });
      if (pts.S && pts.O) edges.push({ p1: pts.S, p2: pts.O, name: 'Đường cao SO' });
      if (pts.O && pts.A) edges.push({ p1: pts.O, p2: pts.A, name: 'Bán kính đáy OA' });
      if (pts.O && pts.B) edges.push({ p1: pts.O, p2: pts.B, name: 'Bán kính đáy OB' });
    } else if (selectedShape === 'cube') {
      const p = pts;
      if (p.A && p.B) edges.push({ p1: p.A, p2: p.B, name: 'Cạnh AB' });
      if (p.B && p.C) edges.push({ p1: p.B, p2: p.C, name: 'Cạnh BC' });
      if (p.C && p.D) edges.push({ p1: p.C, p2: p.D, name: 'Cạnh CD' });
      if (p.D && p.A) edges.push({ p1: p.D, p2: p.A, name: 'Cạnh DA' });
      if (p.A1 && p.B1) edges.push({ p1: p.A1, p2: p.B1, name: "Cạnh A'B'" });
      if (p.B1 && p.C1) edges.push({ p1: p.B1, p2: p.C1, name: "Cạnh B'C'" });
      if (p.C1 && p.D1) edges.push({ p1: p.C1, p2: p.D1, name: "Cạnh C'D'" });
      if (p.D1 && p.A1) edges.push({ p1: p.D1, p2: p.A1, name: "Cạnh D'A'" });
      if (p.A && p.A1) edges.push({ p1: p.A, p2: p.A1, name: "Cạnh bên AA'" });
      if (p.B && p.B1) edges.push({ p1: p.B, p2: p.B1, name: "Cạnh bên BB'" });
      if (p.C && p.C1) edges.push({ p1: p.C, p2: p.C1, name: "Cạnh bên CC'" });
      if (p.D && p.D1) edges.push({ p1: p.D, p2: p.D1, name: "Cạnh bên DD'" });
    } else if (selectedShape === 'prism') {
      const p = pts;
      if (p.A && p.B) edges.push({ p1: p.A, p2: p.B, name: 'Cạnh đáy AB' });
      if (p.B && p.C) edges.push({ p1: p.B, p2: p.C, name: 'Cạnh đáy BC' });
      if (p.C && p.A) edges.push({ p1: p.C, p2: p.A, name: 'Cạnh đáy CA' });
      if (p.A1 && p.B1) edges.push({ p1: p.A1, p2: p.B1, name: "Cạnh đáy A'B'" });
      if (p.B1 && p.C1) edges.push({ p1: p.B1, p2: p.C1, name: "Cạnh đáy B'C'" });
      if (p.C1 && p.A1) edges.push({ p1: p.C1, p2: p.A1, name: "Cạnh đáy C'A'" });
      if (p.A && p.A1) edges.push({ p1: p.A, p2: p.A1, name: "Cạnh bên AA'" });
      if (p.B && p.B1) edges.push({ p1: p.B, p2: p.B1, name: "Cạnh bên BB'" });
      if (p.C && p.C1) edges.push({ p1: p.C, p2: p.C1, name: "Cạnh bên CC'" });
    } else if (selectedShape === 'cylinder') {
      const p = pts;
      if (p.A && p.A1) edges.push({ p1: p.A, p2: p.A1, name: "Đường sinh AA'" });
      if (p.B && p.B1) edges.push({ p1: p.B, p2: p.B1, name: "Đường sinh BB'" });
      if (p.O && p.O1) edges.push({ p1: p.O, p2: p.O1, name: "Trục trụ OO'" });
    }

    customLines.forEach((l) => {
      const p1 = allPointsMap[l.p1];
      const p2 = allPointsMap[l.p2];
      if (p1 && p2) {
        edges.push({ p1, p2, name: `Đoạn thẳng [${l.p1}${l.p2}]` });
      }
    });

    let bestEdgeHit: { x: number; y: number; z: number; surfaceName: string; dist: number } | null = null;
    for (const edge of edges) {
      const s1 = project3D(edge.p1.x, edge.p1.y, edge.p1.z);
      const s2 = project3D(edge.p2.x, edge.p2.y, edge.p2.z);
      const vx = s2.x - s1.x;
      const vy = s2.y - s1.y;
      const lenSq = vx * vx + vy * vy;
      if (lenSq > 0.1) {
        const u = Math.max(0, Math.min(1, ((svgX - s1.x) * vx + (svgY - s1.y) * vy) / lenSq));
        const projX = s1.x + u * vx;
        const projY = s1.y + u * vy;
        const dist = Math.hypot(svgX - projX, svgY - projY);
        if (dist <= 8.5 && (!bestEdgeHit || dist < bestEdgeHit.dist)) {
          bestEdgeHit = {
            x: Math.round(edge.p1.x + u * (edge.p2.x - edge.p1.x)),
            y: Math.round(edge.p1.y + u * (edge.p2.y - edge.p1.y)),
            z: Math.round(edge.p1.z + u * (edge.p2.z - edge.p1.z)),
            surfaceName: `${edge.name}`,
            dist,
          };
        }
      }
    }

    if (bestEdgeHit) {
      return {
        x: bestEdgeHit.x,
        y: bestEdgeHit.y,
        z: bestEdgeHit.z,
        surfaceName: bestEdgeHit.surfaceName,
      };
    }

    // 2. Kiểm tra giao giữa tia và các mặt phẳng / mặt khối của hình
    const { P0, d } = getRayFromScreen(svgX, svgY);
    const faces: { name: string; tris: [Point3D, Point3D, Point3D][] }[] = [];

    if (selectedShape === 'pyramid_quad') {
      const { S, A, B, C, D } = pts;
      if (S && A && B) faces.push({ name: 'Mặt bên (SAB)', tris: [[S, A, B]] });
      if (S && B && C) faces.push({ name: 'Mặt bên (SBC)', tris: [[S, B, C]] });
      if (S && C && D) faces.push({ name: 'Mặt bên (SCD)', tris: [[S, C, D]] });
      if (S && D && A) faces.push({ name: 'Mặt bên (SDA)', tris: [[S, D, A]] });
      if (A && B && C && D) {
        faces.push({ name: 'Mặt đáy (ABCD)', tris: [[A, B, C], [A, C, D]] });
      }
    } else if (selectedShape === 'pyramid_tri') {
      const { S, A, B, C } = pts;
      if (S && A && B) faces.push({ name: 'Mặt bên (SAB)', tris: [[S, A, B]] });
      if (S && B && C) faces.push({ name: 'Mặt bên (SBC)', tris: [[S, B, C]] });
      if (S && C && A) faces.push({ name: 'Mặt bên (SCA)', tris: [[S, C, A]] });
      if (A && B && C) faces.push({ name: 'Mặt đáy (ABC)', tris: [[A, B, C]] });
    } else if (selectedShape === 'cone') {
      const { S, O } = pts;
      const r = radiusParam;
      if (S && O) {
        const segs = 16;
        const tris: [Point3D, Point3D, Point3D][] = [];
        const baseTris: [Point3D, Point3D, Point3D][] = [];
        for (let i = 0; i < segs; i++) {
          const a1 = (2 * Math.PI * i) / segs;
          const a2 = (2 * Math.PI * (i + 1)) / segs;
          const p1: Point3D = { name: '', x: O.x + r * Math.cos(a1), y: O.y, z: O.z + r * Math.sin(a1) };
          const p2: Point3D = { name: '', x: O.x + r * Math.cos(a2), y: O.y, z: O.z + r * Math.sin(a2) };
          tris.push([S, p1, p2]);
          baseTris.push([O, p1, p2]);
        }
        faces.push({ name: 'Mặt nón tròn xoay', tris });
        faces.push({ name: 'Mặt đáy tròn (tâm O)', tris: baseTris });
      }
    } else if (selectedShape === 'cube') {
      const { A, B, C, D, A1, B1, C1, D1 } = pts;
      if (A && B && C && D) faces.push({ name: 'Mặt đáy dưới (ABCD)', tris: [[A, B, C], [A, C, D]] });
      if (A1 && B1 && C1 && D1) faces.push({ name: "Mặt đáy trên (A'B'C'D')", tris: [[A1, B1, C1], [A1, C1, D1]] });
      if (A && B && B1 && A1) faces.push({ name: "Mặt trước (ABB'A')", tris: [[A, B, B1], [A, B1, A1]] });
      if (B && C && C1 && B1) faces.push({ name: "Mặt phải (BCC'B')", tris: [[B, C, C1], [B, C1, B1]] });
      if (C && D && D1 && C1) faces.push({ name: "Mặt sau (CDD'C')", tris: [[C, D, D1], [C, D1, C1]] });
      if (D && A && A1 && D1) faces.push({ name: "Mặt trái (DAA'D')", tris: [[D, A, A1], [D, A1, D1]] });
    } else if (selectedShape === 'prism') {
      const { A, B, C, A1, B1, C1 } = pts;
      if (A && B && C) faces.push({ name: 'Mặt đáy dưới (ABC)', tris: [[A, B, C]] });
      if (A1 && B1 && C1) faces.push({ name: "Mặt đáy trên (A'B'C')", tris: [[A1, B1, C1]] });
      if (A && B && B1 && A1) faces.push({ name: "Mặt bên (ABB'A')", tris: [[A, B, B1], [A, B1, A1]] });
      if (B && C && C1 && B1) faces.push({ name: "Mặt bên (BCC'B')", tris: [[B, C, C1], [B, C1, B1]] });
      if (C && A && A1 && C1) faces.push({ name: "Mặt bên (CAA'C')", tris: [[C, A, A1], [C, A1, C1]] });
    } else if (selectedShape === 'cylinder') {
      const { O, O1 } = pts;
      const r = radiusParam;
      if (O && O1) {
        const segs = 16;
        const latTris: [Point3D, Point3D, Point3D][] = [];
        const botTris: [Point3D, Point3D, Point3D][] = [];
        const topTris: [Point3D, Point3D, Point3D][] = [];
        for (let i = 0; i < segs; i++) {
          const a1 = (2 * Math.PI * i) / segs;
          const a2 = (2 * Math.PI * (i + 1)) / segs;
          const b1: Point3D = { name: '', x: O.x + r * Math.cos(a1), y: O.y, z: O.z + r * Math.sin(a1) };
          const b2: Point3D = { name: '', x: O.x + r * Math.cos(a2), y: O.y, z: O.z + r * Math.sin(a2) };
          const t1: Point3D = { name: '', x: O1.x + r * Math.cos(a1), y: O1.y, z: O1.z + r * Math.sin(a1) };
          const t2: Point3D = { name: '', x: O1.x + r * Math.cos(a2), y: O1.y, z: O1.z + r * Math.sin(a2) };
          latTris.push([b1, b2, t2], [b1, t2, t1]);
          botTris.push([O, b1, b2]);
          topTris.push([O1, t1, t2]);
        }
        faces.push({ name: 'Mặt trụ tròn xoay', tris: latTris });
        faces.push({ name: 'Mặt đáy dưới (O)', tris: botTris });
        faces.push({ name: "Mặt đáy trên (O')", tris: topTris });
      }
    }

    customPlanes.forEach((plane) => {
      const pCoords = plane.pointNames.map((n) => allPointsMap[n]).filter(Boolean) as Point3D[];
      if (pCoords.length >= 3) {
        const tris: [Point3D, Point3D, Point3D][] = [];
        for (let i = 1; i < pCoords.length - 1; i++) {
          tris.push([pCoords[0], pCoords[i], pCoords[i + 1]]);
        }
        faces.push({ name: `Mặt phẳng [${plane.name}]`, tris });
      }
    });

    let bestFaceHit: { point: { x: number; y: number; z: number }; surfaceName: string; t: number } | null = null;

    for (const face of faces) {
      for (const tri of face.tris) {
        const hit = intersectRayTriangle(P0, d, tri[0], tri[1], tri[2]);
        if (hit && (!bestFaceHit || hit.t < bestFaceHit.t)) {
          bestFaceHit = {
            point: hit.point,
            surfaceName: face.name,
            t: hit.t,
          };
        }
      }
    }

    if (bestFaceHit) {
      return {
        x: bestFaceHit.point.x,
        y: bestFaceHit.point.y,
        z: bestFaceHit.point.z,
        surfaceName: bestFaceHit.surfaceName,
      };
    }

    // 3. Nếu không trúng mặt nào, giao với mặt đáy y = 0
    if (Math.abs(d.y) > 1e-4) {
      const t = -P0.y / d.y;
      const gx = Math.round(P0.x + t * d.x);
      const gz = Math.round(P0.z + t * d.z);
      if (Math.abs(gx) <= 190 && Math.abs(gz) <= 190) {
        return {
          x: gx,
          y: 0,
          z: gz,
          surfaceName: 'Mặt đáy (y = 0)',
        };
      }
    }

    // 4. Mặc định mặt phẳng tại tâm
    return {
      x: Math.round(P0.x),
      y: Math.round(Math.max(0, P0.y)),
      z: Math.round(P0.z),
      surfaceName: 'Không gian tự do',
    };
  };

  // c. Tạo điểm mới theo tọa độ tự do (hoặc dùng con trỏ ấn vào hình)
  const handleCreateManualPoint = () => {
    const name = manualPointName.trim() || getNextFreePointName(allPointNames);
    const newPoint: Point3D = {
      name,
      x: manualPointX,
      y: manualPointY,
      z: manualPointZ,
      label: name,
      color: manualPointColor,
      isCustom: true,
    };

    setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);
    setSelectedPointName(name);
    setStatusMessage(`Đã tạo điểm mới [${name}] tại tọa độ (${manualPointX}, ${manualPointY}, ${manualPointZ})!`);
    setTimeout(() => setStatusMessage(null), 3500);

    const nextName = getNextFreePointName([...allPointNames, name]);
    setManualPointName(nextName);
  };

  // ==========================================
  // 2. MỤC: TẠO ĐƯỜNG (Đoạn thẳng, Đường thẳng, Tia, Đường vuông góc)
  // ==========================================
  const handleCreateLine = () => {
    if (!linePointA || !linePointB || linePointA === linePointB) {
      setStatusMessage('Vui lòng chọn 2 điểm khác nhau để tạo đường!');
      return;
    }

    if (lineCreationMode === 'perpendicular') {
      // Dựng đường vuông góc từ A hạ xuống mặt đáy hoặc tới cạnh
      const p1 = allPointsMap[linePointA];
      const p2 = allPointsMap[linePointB];
      if (!p1 || !p2) return;

      // Chân đường vuông góc trên mặt phẳng đáy y = 0
      const footName = `H_${linePointA}`;
      const footPoint: Point3D = {
        name: footName,
        x: p1.x,
        y: 0,
        z: p1.z,
        label: `${footName} (Hình chiếu)`,
        color: '#dc2626',
        isCustom: true,
      };

      setCustomPoints((prev) => [...prev.filter((p) => p.name !== footName), footPoint]);

      const newLine: Line3D = {
        id: 'line_' + Date.now(),
        type: 'perpendicular',
        p1: linePointA,
        p2: footName,
        style: 'dashed',
        color: '#dc2626',
        label: `${linePointA}${footName} ⊥ Đáy`,
        footPointName: footName,
      };

      setCustomLines((prev) => [...prev, newLine]);
      setStatusMessage(`Đã hạ đường cao vuông góc ${linePointA}${footName} ⊥ đáy!`);
      setTimeout(() => setStatusMessage(null), 3500);
      return;
    }

    const newLine: Line3D = {
      id: 'line_' + Date.now(),
      type: lineCreationMode,
      p1: linePointA,
      p2: linePointB,
      style: lineStyle,
      color: lineColor,
      label: `${linePointA}${linePointB}`,
    };

    setCustomLines((prev) => [...prev, newLine]);
    const typeLabel =
      lineCreationMode === 'segment' ? 'Đoạn thẳng' : lineCreationMode === 'line' ? 'Đường thẳng' : 'Tia';
    setStatusMessage(`Đã vẽ ${typeLabel} [${linePointA} - ${linePointB}] thành công!`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // ==========================================
  // 3. MỤC: TẠO MẶT (Mặt đi qua 3 điểm)
  // ==========================================
  const handleCreatePlane = () => {
    if (!planePoint1 || !planePoint2 || !planePoint3) {
      setStatusMessage('Vui lòng chọn đủ 3 điểm để tạo mặt phẳng!');
      return;
    }
    const pts = [planePoint1, planePoint2, planePoint3];
    if (new Set(pts).size < 3) {
      setStatusMessage('3 điểm tạo mặt phẳng phải khác nhau!');
      return;
    }

    const planeName = `(${pts.join('')})`;
    const newPlane: Plane3D = {
      id: 'plane_' + Date.now(),
      name: planeName,
      pointNames: pts,
      colorTheme: planeColorTheme,
      opacity: planeOpacity,
    };

    setCustomPlanes((prev) => [...prev, newPlane]);
    setStatusMessage(`Đã tạo thành công mặt phẳng ${planeName} đi qua 3 điểm!`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // ==========================================
  // 4. DI CHUYỂN ĐIỂM (BẰNG CHUỘT HOẶC THANH TRƯỢT TỌA ĐỘ)
  // ==========================================
  const handleUpdatePointCoord = (axis: 'x' | 'y' | 'z', val: number) => {
    if (!selectedPointName) return;

    // Cập nhật nếu là đỉnh gốc
    if (vertexCoords[selectedPointName]) {
      setVertexCoords((prev) => ({
        ...prev,
        [selectedPointName]: {
          ...prev[selectedPointName],
          [axis]: val,
        },
      }));
    }

    // Cập nhật nếu là điểm tự dựng
    setCustomPoints((prev) =>
      prev.map((pt) => (pt.name === selectedPointName ? { ...pt, [axis]: val } : pt))
    );
  };

  // Bắt đầu kéo rê điểm trực tiếp bằng chuột
  const handlePointMouseDown = (ptName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPointName(ptName);
    setDraggingPointName(ptName);

    const cur = allPointsMap[ptName];
    if (cur) {
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        origCoord: { ...cur },
      };
    }
  };

  // Kiểm tra xem chế độ Tạo Điểm Tự Do bằng con trỏ có đang hoạt động không
  const isFreePointMode = activeCategory === 'points' && pointCreationMode === 'manual';

  // Xử lý di chuyển chuột trên toàn bộ SVG Canvas
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // 1. Kéo thả chuột để di chuyển điểm đã chọn
    if (draggingPointName && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;

      const radY = (rotY * Math.PI) / 180;
      const radX = (rotX * Math.PI) / 180;
      const scale = zoomLevel;

      // Chiếu chuyển động 2D màn hình sang không gian 3D
      const dX = (dx * Math.cos(radY)) / scale;
      const dZ = (-dx * Math.sin(radY)) / scale;
      const dY = (-dy / Math.max(0.2, Math.cos(radX))) / scale;

      const newX = Math.round(dragStartRef.current.origCoord.x + dX);
      const newY = Math.round(Math.max(0, dragStartRef.current.origCoord.y + dY));
      const newZ = Math.round(dragStartRef.current.origCoord.z + dZ);

      if (vertexCoords[draggingPointName]) {
        setVertexCoords((prev) => ({
          ...prev,
          [draggingPointName]: {
            ...prev[draggingPointName],
            x: newX,
            y: newY,
            z: newZ,
          },
        }));
      }

      setCustomPoints((prev) =>
        prev.map((pt) => (pt.name === draggingPointName ? { ...pt, x: newX, y: newY, z: newZ } : pt))
      );
      return;
    }

    // 2. Tính toán điểm ngắm 3D thời gian thực khi đang ở chế độ Tạo Điểm Tự Do
    if (isFreePointMode && !draggingPointName) {
      const svg = e.currentTarget;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * 500;
        const svgY = ((e.clientY - rect.top) / rect.height) * 400;
        const pt = calculate3DPointFromScreen(svgX, svgY);
        setHover3DPoint({
          x: pt.x,
          y: pt.y,
          z: pt.z,
          surfaceName: pt.surfaceName,
          svgX,
          svgY,
        });
      }
    }
  };

  const handleSvgMouseUp = () => {
    setDraggingPointName(null);
    dragStartRef.current = null;
  };

  // Xuất ảnh Canvas hiện tại
  const handleExportCanvasImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgElement = document.getElementById('geometry-3d-studio-svg');
    if (svgElement) {
      const xml = new XMLSerializer().serializeToString(svgElement);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const image64 = 'data:image/svg+xml;base64,' + svg64;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        if (onExportImage) {
          onExportImage(pngUrl, getShapeTitle(selectedShape));
        }
        setExportNotice(true);
        setTimeout(() => setExportNotice(false), 3000);
      };
      img.src = image64;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-150">
      {/* ========================================================= */}
      {/* CỘT TRÁI: DANH MỤC CÔNG CỤ 3D (4 COLS)                    */}
      {/* ========================================================= */}
      <div className="lg:col-span-4 space-y-4 text-xs">
        {/* 1. CHỌN MÔ HÌNH HÌNH KHỐI KHÔNG GIAN */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Box size={16} className="text-blue-600" />
              <span>Mô Hình Không Gian 3D:</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Chuẩn GDPT 2018
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelectShape('pyramid_quad')}
              className={`p-2.5 rounded-2xl border font-bold text-left transition-all ${
                selectedShape === 'pyramid_quad'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block font-extrabold text-xs">Chóp Tứ Giác</span>
              <span className="text-[10px] text-slate-500 font-normal">S.ABCD (Đáy hình bình hành)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectShape('pyramid_tri')}
              className={`p-2.5 rounded-2xl border font-bold text-left transition-all ${
                selectedShape === 'pyramid_tri'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block font-extrabold text-xs">Chóp Tam Giác</span>
              <span className="text-[10px] text-slate-500 font-normal">S.ABC (Tứ diện thuần túy)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectShape('cone')}
              className={`p-2.5 rounded-2xl border font-bold text-left transition-all ${
                selectedShape === 'cone'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block font-extrabold text-xs flex items-center gap-1">
                <span>Khối Nón 3D</span>
                <span className="text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-black">Mới</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Đáy tròn nét khuất & bóng</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectShape('cube')}
              className={`p-2.5 rounded-2xl border font-bold text-left transition-all ${
                selectedShape === 'cube'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block font-extrabold text-xs">Khối Lập Phương</span>
              <span className="text-[10px] text-slate-500 font-normal">ABCD.A'B'C'D'</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectShape('prism')}
              className={`p-2.5 rounded-2xl border font-bold text-left transition-all ${
                selectedShape === 'prism'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block font-extrabold text-xs">Lăng Trụ Tam Giác</span>
              <span className="text-[10px] text-slate-500 font-normal">ABC.A'B'C'</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectShape('cylinder')}
              className={`p-2.5 rounded-2xl border font-bold text-left transition-all ${
                selectedShape === 'cylinder'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block font-extrabold text-xs">Khối Trụ Tròn Xoay</span>
              <span className="text-[10px] text-slate-500 font-normal">2 đáy elip song song</span>
            </button>
          </div>
        </div>

        {/* 2. THANH ĐIỀU HƯỚNG CÁC MỤC CHỨC NĂNG (TẠO ĐIỂM / TẠO ĐƯỜNG / TẠO MẶT / DI CHUYỂN) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 font-extrabold text-[11px]">
            <button
              type="button"
              onClick={() => setActiveCategory('points')}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeCategory === 'points'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Circle size={13} />
              <span>Tạo Điểm</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('lines')}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeCategory === 'lines'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ruler size={13} />
              <span>Tạo Đường</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('planes')}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeCategory === 'planes'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={13} />
              <span>Tạo Mặt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('move')}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeCategory === 'move'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Move size={13} />
              <span>Di Chuyển</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* NỘI DUNG MỤC 1: TẠO ĐIỂM                                  */}
          {/* ========================================================= */}
          {activeCategory === 'points' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 font-bold text-[11px]">
                <button
                  type="button"
                  onClick={() => setPointCreationMode('ratio')}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    pointCreationMode === 'ratio'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Điểm Tỉ Lệ (k)
                </button>
                <button
                  type="button"
                  onClick={() => setPointCreationMode('centroid')}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    pointCreationMode === 'centroid'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Trọng Tâm (G)
                </button>
                <button
                  type="button"
                  onClick={() => setPointCreationMode('manual')}
                  className={`flex-1 py-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    pointCreationMode === 'manual'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MousePointerClick size={12} className="text-emerald-600" />
                  <span>Điểm Tự Do (Ấn Vào Hình)</span>
                </button>
              </div>

              {/* Sub-tab 1: Điểm chia tỉ lệ */}
              {pointCreationMode === 'ratio' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Điểm Đầu (A):</label>
                      <select
                        value={ratioPointA}
                        onChange={(e) => setRatioPointA(e.target.value)}
                        className="w-full h-8 px-2 rounded-xl border border-emerald-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Điểm Cuối (B):</label>
                      <select
                        value={ratioPointB}
                        onChange={(e) => setRatioPointB(e.target.value)}
                        className="w-full h-8 px-2 rounded-xl border border-emerald-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 mb-1">
                      <span>Tỉ Lệ Vị Trí k:</span>
                      <strong className="text-emerald-700 font-mono">
                        {ratioK === 0.5
                          ? '1/2 (Trung Điểm)'
                          : ratioK === 0.33
                          ? '1/3'
                          : ratioK === 0.67
                          ? '2/3'
                          : `${ratioK}`}
                      </strong>
                    </div>

                    <div className="grid grid-cols-4 gap-1 mb-2">
                      {[0.5, 0.33, 0.67, 0.25].map((kVal) => (
                        <button
                          key={kVal}
                          type="button"
                          onClick={() => setRatioK(kVal)}
                          className={`py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            ratioK === kVal
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {kVal === 0.5 ? '1/2 (TĐ)' : kVal === 0.33 ? '1/3' : kVal === 0.67 ? '2/3' : '1/4'}
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min={0.05}
                      max={0.95}
                      step={0.05}
                      value={ratioK}
                      onChange={(e) => setRatioK(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">Tên Điểm:</span>
                    <input
                      type="text"
                      value={ratioPointLabel}
                      onChange={(e) => setRatioPointLabel(e.target.value.toUpperCase())}
                      maxLength={4}
                      className="w-16 h-8 px-2 rounded-xl border border-emerald-300 font-bold text-center text-xs bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleCreateRatioPoint}
                      className="flex-1 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Tạo Điểm Tỉ Lệ</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Trọng tâm tam giác */}
              {pointCreationMode === 'centroid' && (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                  <span className="text-[10px] font-bold text-amber-900 block">
                    Chọn 3 Đỉnh Để Tính Trọng Tâm Tam Giác G = (A + B + C)/3:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <select
                      value={centroidA}
                      onChange={(e) => setCentroidA(e.target.value)}
                      className="h-8 px-1.5 rounded-xl border border-amber-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>

                    <select
                      value={centroidB}
                      onChange={(e) => setCentroidB(e.target.value)}
                      className="h-8 px-1.5 rounded-xl border border-amber-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>

                    <select
                      value={centroidC}
                      onChange={(e) => setCentroidC(e.target.value)}
                      className="h-8 px-1.5 rounded-xl border border-amber-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">Tên:</span>
                    <input
                      type="text"
                      value={centroidLabel}
                      onChange={(e) => setCentroidLabel(e.target.value.toUpperCase())}
                      maxLength={4}
                      className="w-16 h-8 px-2 rounded-xl border border-amber-300 font-bold text-center text-xs bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCentroid}
                      className="flex-1 h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Tạo Trọng Tâm G</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Tạo điểm tự do bằng con trỏ ấn trực tiếp vào hình */}
              {pointCreationMode === 'manual' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  {/* Banner hướng dẫn ấn trực tiếp vào hình */}
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-300 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-[11px]">
                      <MousePointerClick size={14} className="text-emerald-600 animate-pulse" />
                      <span>ẤN CON TRỎ TRỰC TIẾP VÀO HÌNH 3D:</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      Di chuyển con trỏ chuột vào khung vẽ 3D bên phải và <strong>nhấp trực tiếp vào bất kỳ cạnh, mặt phẳng hoặc đáy hình</strong> để tạo điểm ngay tức thì!
                    </p>
                  </div>

                  {/* Radar tọa độ ngắm thời gian thực */}
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1 shadow-inner">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Target size={12} className="text-emerald-400" />
                        <span>Vị Trí Con Trỏ Đang Ngắm:</span>
                      </span>
                      {hover3DPoint ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] border border-emerald-500/30">
                          Sẵn sàng nhấp
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[9px]">Chưa trỏ vào hình</span>
                      )}
                    </div>

                    {hover3DPoint ? (
                      <div className="space-y-0.5 pt-0.5">
                        <div className="text-[11px] font-extrabold text-emerald-300 truncate">
                          {hover3DPoint.surfaceName}
                        </div>
                        <div className="font-mono text-[10px] text-slate-300 flex items-center justify-between">
                          <span>X: <strong className="text-white">{hover3DPoint.x}</strong></span>
                          <span>Y (Cao): <strong className="text-white">{hover3DPoint.y}</strong></span>
                          <span>Z (Sâu): <strong className="text-white">{hover3DPoint.z}</strong></span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic py-0.5">
                        Rê chuột trên mặt khối 3D để ngắm vị trí tọa độ...
                      </p>
                    )}
                  </div>

                  {/* Cài đặt tên điểm và màu sắc */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-700 shrink-0">Tên Điểm:</span>
                      <input
                        type="text"
                        value={manualPointName}
                        onChange={(e) => setManualPointName(e.target.value.toUpperCase())}
                        maxLength={4}
                        className="w-14 h-8 px-2 rounded-xl border border-emerald-300 font-bold text-center text-xs bg-white text-slate-900"
                        title="Tên điểm tiếp theo (sẽ tự động tăng M, N, P, Q... sau mỗi lần ấn)"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-700 shrink-0">Màu:</span>
                      <input
                        type="color"
                        value={manualPointColor}
                        onChange={(e) => setManualPointColor(e.target.value)}
                        className="w-7 h-7 rounded-lg cursor-pointer border border-emerald-300 bg-transparent"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (hover3DPoint) {
                          const name = manualPointName.trim() || getNextFreePointName(allPointNames);
                          const newPoint: Point3D = {
                            name,
                            x: hover3DPoint.x,
                            y: hover3DPoint.y,
                            z: hover3DPoint.z,
                            label: `${name} (${hover3DPoint.surfaceName})`,
                            color: manualPointColor || '#10b981',
                            isCustom: true,
                          };
                          setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);
                          setSelectedPointName(name);
                          setStatusMessage(`Đã tạo điểm tự do [${name}] trên ${hover3DPoint.surfaceName} tại (${hover3DPoint.x}, ${hover3DPoint.y}, ${hover3DPoint.z})!`);
                          setTimeout(() => setStatusMessage(null), 3500);
                          const nextName = getNextFreePointName([...allPointNames, name]);
                          setManualPointName(nextName);
                        } else {
                          handleCreateManualPoint();
                        }
                      }}
                      className="px-3 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-xs flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus size={13} />
                      <span>{hover3DPoint ? 'Đặt Tại Đây' : 'Tạo Điểm'}</span>
                    </button>
                  </div>

                  {/* Tùy chọn mở rộng nhập số tọa độ tay */}
                  <div className="pt-1 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={() => setShowManualInputs(!showManualInputs)}
                      className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center justify-between w-full py-0.5"
                    >
                      <span>{showManualInputs ? '▼ Thu gọn nhập số tay' : '▶ Tùy chọn nâng cao: Nhập số tọa độ X, Y, Z bằng tay'}</span>
                    </button>

                    {showManualInputs && (
                      <div className="space-y-2 pt-2 animate-in fade-in">
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Trục X:</label>
                            <input
                              type="number"
                              value={manualPointX}
                              onChange={(e) => setManualPointX(Number(e.target.value))}
                              className="w-full h-7 px-1.5 rounded-lg border border-emerald-300 font-mono text-center text-xs bg-white text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Trục Y (Cao):</label>
                            <input
                              type="number"
                              value={manualPointY}
                              onChange={(e) => setManualPointY(Number(e.target.value))}
                              className="w-full h-7 px-1.5 rounded-lg border border-emerald-300 font-mono text-center text-xs bg-white text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Trục Z (Sâu):</label>
                            <input
                              type="number"
                              value={manualPointZ}
                              onChange={(e) => setManualPointZ(Number(e.target.value))}
                              className="w-full h-7 px-1.5 rounded-lg border border-emerald-300 font-mono text-center text-xs bg-white text-slate-900"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleCreateManualPoint}
                          className="w-full h-7 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-colors"
                        >
                          <Plus size={12} />
                          <span>Tạo theo tọa độ số trên</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* NỘI DUNG MỤC 2: TẠO ĐƯỜNG                                 */}
          {/* ========================================================= */}
          {activeCategory === 'lines' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="grid grid-cols-4 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 font-bold text-[10px]">
                <button
                  type="button"
                  onClick={() => setLineCreationMode('segment')}
                  className={`py-1 rounded-lg transition-all ${
                    lineCreationMode === 'segment'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đoạn Thẳng
                </button>
                <button
                  type="button"
                  onClick={() => setLineCreationMode('line')}
                  className={`py-1 rounded-lg transition-all ${
                    lineCreationMode === 'line'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đường Thẳng
                </button>
                <button
                  type="button"
                  onClick={() => setLineCreationMode('ray')}
                  className={`py-1 rounded-lg transition-all ${
                    lineCreationMode === 'ray'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tia
                </button>
                <button
                  type="button"
                  onClick={() => setLineCreationMode('perpendicular')}
                  className={`py-1 rounded-lg transition-all ${
                    lineCreationMode === 'perpendicular'
                      ? 'bg-white text-rose-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vuông Góc
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      {lineCreationMode === 'perpendicular' ? 'Điểm Hạ (Đỉnh):' : 'Điểm 1:'}
                    </label>
                    <select
                      value={linePointA}
                      onChange={(e) => setLinePointA(e.target.value)}
                      className="w-full h-8 px-2 rounded-xl border border-purple-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      {lineCreationMode === 'perpendicular' ? 'Điểm Tham Chiếu:' : 'Điểm 2:'}
                    </label>
                    <select
                      value={linePointB}
                      onChange={(e) => setLinePointB(e.target.value)}
                      className="w-full h-8 px-2 rounded-xl border border-purple-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-600">Kiểu Nét:</span>
                    <button
                      type="button"
                      onClick={() => setLineStyle('solid')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        lineStyle === 'solid'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      Nét Liền
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineStyle('dashed')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        lineStyle === 'dashed'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      Nét Đứt
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-600">Màu:</span>
                    <input
                      type="color"
                      value={lineColor}
                      onChange={(e) => setLineColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer border border-purple-200 bg-transparent"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateLine}
                  className="w-full h-8 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={14} />
                  <span>
                    Vẽ {lineCreationMode === 'segment' ? 'Đoạn Thẳng' : lineCreationMode === 'line' ? 'Đường Thẳng' : lineCreationMode === 'ray' ? 'Tia' : 'Đường Cao Vuông Góc'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* NỘI DUNG MỤC 3: TẠO MẶT (MẶT QUA 3 ĐIỂM)                  */}
          {/* ========================================================= */}
          {activeCategory === 'planes' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                <span className="text-[10px] font-bold text-amber-900 block">
                  Chọn 3 Điểm Để Tạo Mặt Phẳng Thiết Diện Cắt Qua Khối:
                </span>

                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Điểm 1:</label>
                    <select
                      value={planePoint1}
                      onChange={(e) => setPlanePoint1(e.target.value)}
                      className="w-full h-8 px-1.5 rounded-xl border border-amber-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Điểm 2:</label>
                    <select
                      value={planePoint2}
                      onChange={(e) => setPlanePoint2(e.target.value)}
                      className="w-full h-8 px-1.5 rounded-xl border border-amber-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Điểm 3:</label>
                    <select
                      value={planePoint3}
                      onChange={(e) => setPlanePoint3(e.target.value)}
                      className="w-full h-8 px-1.5 rounded-xl border border-amber-300 font-bold text-xs bg-white text-slate-800"
                    >
                      {allPointNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-600">Màu Sắc:</span>
                    {(['amber', 'violet', 'emerald', 'cyan', 'rose'] as const).map((thm) => (
                      <button
                        key={thm}
                        type="button"
                        onClick={() => setPlaneColorTheme(thm)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${
                          planeColorTheme === thm ? 'scale-110 border-slate-900' : 'border-white'
                        }`}
                        style={{
                          backgroundColor:
                            thm === 'amber'
                              ? '#f59e0b'
                              : thm === 'violet'
                              ? '#8b5cf6'
                              : thm === 'emerald'
                              ? '#10b981'
                              : thm === 'cyan'
                              ? '#06b6d4'
                              : '#f43f5e',
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                    <span>Độ Mờ:</span>
                    <input
                      type="range"
                      min={0.15}
                      max={0.75}
                      step={0.05}
                      value={planeOpacity}
                      onChange={(e) => setPlaneOpacity(parseFloat(e.target.value))}
                      className="w-16 h-1.5 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreatePlane}
                  className="w-full h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={14} />
                  <span>Tạo Mặt Phẳng Đi Qua 3 Điểm</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* NỘI DUNG MỤC 4: DI CHUYỂN & TINH CHỈNH TỌA ĐỘ ĐIỂM        */}
          {/* ========================================================= */}
          {activeCategory === 'move' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600">Chọn Điểm Cần Di Chuyển:</span>
                  <span className="text-[10px] text-blue-600 italic">Hoặc nhấp kéo trực tiếp trên Canvas</span>
                </div>

                <select
                  value={selectedPointName || ''}
                  onChange={(e) => setSelectedPointName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-300 font-bold text-xs bg-white text-slate-900"
                >
                  <option value="">-- Nhấp chọn 1 điểm trên hình --</option>
                  {allPointNames.map((n) => (
                    <option key={n} value={n}>
                      Điểm {n} ({allPointsMap[n]?.x}, {allPointsMap[n]?.y}, {allPointsMap[n]?.z})
                    </option>
                  ))}
                </select>

                {selectedPointName && allPointsMap[selectedPointName] && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                      <span>Điểm: [{selectedPointName}]</span>
                      <button
                        type="button"
                        onClick={() => {
                          const def = initDefaultVertices(selectedShape)[selectedPointName];
                          if (def) {
                            setVertexCoords((prev) => ({ ...prev, [selectedPointName]: def }));
                          }
                        }}
                        className="text-[10px] text-slate-500 hover:text-blue-600 underline"
                      >
                        Đặt lại vị trí gốc
                      </button>
                    </div>

                    {/* Slider X */}
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-0.5">
                        <span>Trục X (Ngang):</span>
                        <strong>{allPointsMap[selectedPointName].x}</strong>
                      </div>
                      <input
                        type="range"
                        min={-160}
                        max={160}
                        value={allPointsMap[selectedPointName].x}
                        onChange={(e) => handleUpdatePointCoord('x', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    {/* Slider Y */}
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-0.5">
                        <span>Trục Y (Độ Cao):</span>
                        <strong>{allPointsMap[selectedPointName].y}</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={240}
                        value={allPointsMap[selectedPointName].y}
                        onChange={(e) => handleUpdatePointCoord('y', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Slider Z */}
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-0.5">
                        <span>Trục Z (Độ Sâu):</span>
                        <strong>{allPointsMap[selectedPointName].z}</strong>
                      </div>
                      <input
                        type="range"
                        min={-160}
                        max={160}
                        value={allPointsMap[selectedPointName].z}
                        onChange={(e) => handleUpdatePointCoord('z', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DANH SÁCH ĐỐI TƯỢNG ĐÃ TỰ TẠO (POINTS / LINES / PLANES) */}
          {(customPoints.length > 0 || customLines.length > 0 || customPlanes.length > 0) && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-800">
                  Đối Tượng Đã Tạo ({customPoints.length + customLines.length + customPlanes.length}):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomPoints([]);
                    setCustomLines([]);
                    setCustomPlanes([]);
                  }}
                  className="text-[10px] text-rose-600 hover:underline font-bold"
                >
                  Xóa tất cả
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {customPoints.map((pt) => (
                  <span
                    key={pt.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold"
                  >
                    <span>Điểm {pt.name}</span>
                    <button
                      type="button"
                      onClick={() => setCustomPoints((prev) => prev.filter((p) => p.name !== pt.name))}
                      className="hover:text-rose-600 font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {customLines.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-mono font-bold"
                  >
                    <span>{l.type === 'segment' ? 'Đoạn' : l.type === 'line' ? 'Đường' : l.type === 'ray' ? 'Tia' : '⊥'} [{l.p1}{l.p2}]</span>
                    <button
                      type="button"
                      onClick={() => setCustomLines((prev) => prev.filter((it) => it.id !== l.id))}
                      className="hover:text-rose-600 font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {customPlanes.map((pl) => (
                  <span
                    key={pl.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-mono font-bold"
                  >
                    <span>Mặt {pl.name}</span>
                    <button
                      type="button"
                      onClick={() => setCustomPlanes((prev) => prev.filter((it) => it.id !== pl.id))}
                      className="hover:text-rose-600 font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. TÙY CHỈNH GÓC XOAY & THÔNG SỐ */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between font-bold text-slate-800">
            <span>Góc Xoay Camera ({rotY}° / {rotX}°):</span>
            <button
              onClick={() => {
                setRotX(20);
                setRotY(-35);
                setZoomLevel(1.15);
              }}
              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>Mặc định</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 block mb-1">Xoay Ngang Y:</span>
              <input
                type="range"
                min={-180}
                max={180}
                value={rotY}
                onChange={(e) => setRotY(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 block mb-1">Nghiêng Dọc X:</span>
              <input
                type="range"
                min={-45}
                max={60}
                value={rotX}
                onChange={(e) => setRotX(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          {/* Chiều cao h */}
          <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5">
              <span>Chiều cao hình $h$:</span>
              <strong>{heightParam}</strong>
            </div>
            <input
              type="range"
              min={80}
              max={220}
              value={heightParam}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Bật/Tắt nét khuất và hệ trục */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showHiddenLines}
                onChange={(e) => setShowHiddenLines(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Hiện nét đứt đoạn khuất (Chuẩn SGK)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showAxes}
                onChange={(e) => setShowAxes(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Hiện hệ trục tọa độ Oxyz</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showShading}
                onChange={(e) => setShowShading(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Tô bóng mặt khối 3D mềm mại</span>
            </label>
          </div>

          {/* Nút xoay 360 */}
          <button
            type="button"
            onClick={() => setIsRotatingAuto(!isRotatingAuto)}
            className={`w-full py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
              isRotatingAuto
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <RotateCcw size={14} className={isRotatingAuto ? 'animate-spin' : ''} />
            <span>{isRotatingAuto ? 'Dừng Tự Động Xoay' : 'Bật Tự Động Xoay 360°'}</span>
          </button>
        </div>

        {/* Nút Xuất Ảnh */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-2 shadow-xs">
          <button
            type="button"
            onClick={handleExportCanvasImage}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition-all"
          >
            {exportNotice ? (
              <>
                <Check size={16} />
                <span>Đã Xuất & Lưu Hình Ảnh!</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Chụp Ảnh Đính Kèm Đề Thi / Bài Giảng</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CỘT PHẢI: KHUNG VẼ CANVAS 3D TƯƠNG TÁC (8 COLS)           */}
      {/* ========================================================= */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col items-center justify-center relative min-h-[580px]">
        {/* Floating Controls */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-100/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 z-20 text-xs shadow-xs">
          <button
            onClick={() => setZoomLevel((prev) => Math.min(prev + 0.15, 2.2))}
            title="Phóng to"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoomLevel((prev) => Math.max(prev - 0.15, 0.6))}
            title="Thu nhỏ"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => {
              setRotX(20);
              setRotY(-35);
              setZoomLevel(1.15);
            }}
            title="Đặt lại góc nhìn"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Thông báo trạng thái / hướng dẫn */}
        {statusMessage && (
          <div className="w-full max-w-[500px] mb-3 px-3.5 py-2 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold flex items-center gap-2 shadow-2xs animate-in fade-in">
            <Sparkles size={15} className="text-amber-500 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Hướng dẫn tương tác chuột */}
        <div className="w-full max-w-[500px] mb-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Move size={13} className="text-blue-600" />
            <span>Kéo chuột trên nền để xoay 3D · Kéo trực tiếp vào điểm để di chuyển</span>
          </span>
          {selectedPointName && (
            <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
              Đang chọn điểm [{selectedPointName}]
            </span>
          )}
        </div>

        {/* Canvas SVG 3D Container */}
        <div className="w-full max-w-[520px] aspect-5/4 relative flex items-center justify-center select-none overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-white shadow-inner">
          <svg
            id="geometry-3d-studio-svg"
            viewBox="0 0 500 400"
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startY = e.clientY;
              const initialRotY = rotY;
              const initialRotX = rotX;

              const onMouseMove = (moveEvent: MouseEvent) => {
                if (dragStartRef.current) return; // Nếu đang kéo điểm thì không xoay canvas
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                setRotY(initialRotY + dx * 0.7);
                setRotX(Math.max(-45, Math.min(60, initialRotX - dy * 0.5)));
              };

              const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
              };

              window.addEventListener('mousemove', onMouseMove);
              window.addEventListener('mouseup', onMouseUp);
            }}
          >
            {/* Lưới nền nhẹ */}
            <defs>
              <pattern id="grid3d_pattern" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
              </pattern>

              {/* Gradient bóng cho hình nón */}
              <linearGradient id="coneLateralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
                <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.22" />
              </linearGradient>

              {/* Gradient bóng cho hình chóp */}
              <linearGradient id="pyramidFaceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            <rect width="500" height="400" fill="url(#grid3d_pattern)" opacity="0.5" />

            {/* Hệ trục tọa độ không gian Oxyz */}
            {showAxes && (() => {
              const O = project3D(0, 0, 0);
              const X = project3D(120, 0, 0);
              const Y = project3D(0, 120, 0);
              const Z = project3D(0, 0, 120);

              return (
                <g className="text-[11px] font-mono font-bold select-none">
                  {/* Trục Ox */}
                  <line x1={O.x} y1={O.y} x2={X.x} y2={X.y} stroke="#ef4444" strokeWidth="1.5" />
                  <text x={X.x + 4} y={X.y + 4} fill="#ef4444">x</text>

                  {/* Trục Oy */}
                  <line x1={O.x} y1={O.y} x2={Y.x} y2={Y.y} stroke="#10b981" strokeWidth="1.5" />
                  <text x={Y.x} y={Y.y - 6} fill="#10b981">y</text>

                  {/* Trục Oz */}
                  <line x1={O.x} y1={O.y} x2={Z.x} y2={Z.y} stroke="#3b82f6" strokeWidth="1.5" />
                  <text x={Z.x - 12} y={Z.y + 12} fill="#3b82f6">z</text>

                  <circle cx={O.x} cy={O.y} r="2.5" fill="#64748b" />
                  <text x={O.x - 12} y={O.y + 12} fill="#64748b">O</text>
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 1. HÌNH CHÓP TỨ GIÁC S.ABCD (SẠCH, CHỈ CÓ HÌNH + ĐỈNH)    */}
            {/* ========================================================= */}
            {selectedShape === 'pyramid_quad' && (() => {
              const S_pt = vertexCoords.S || { x: 0, y: 140, z: 0 };
              const A_pt = vertexCoords.A || { x: -90, y: 0, z: 70 };
              const B_pt = vertexCoords.B || { x: 90, y: 0, z: 70 };
              const C_pt = vertexCoords.C || { x: 110, y: 0, z: -70 };
              const D_pt = vertexCoords.D || { x: -70, y: 0, z: -70 };

              const S = project3D(S_pt.x, S_pt.y, S_pt.z);
              const A = project3D(A_pt.x, A_pt.y, A_pt.z);
              const B = project3D(B_pt.x, B_pt.y, B_pt.z);
              const C = project3D(C_pt.x, C_pt.y, C_pt.z);
              const D = project3D(D_pt.x, D_pt.y, D_pt.z);

              return (
                <g className="font-bold text-xs select-none">
                  {/* Mặt đáy tô bóng nhẹ */}
                  {showShading && (
                    <polygon
                      points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`}
                      fill="url(#pyramidFaceGradient)"
                    />
                  )}

                  {/* Mặt bên SAB tô bóng */}
                  {showShading && (
                    <polygon
                      points={`${S.x},${S.y} ${A.x},${A.y} ${B.x},${B.y}`}
                      fill="rgba(59, 130, 246, 0.06)"
                    />
                  )}

                  {/* Cạnh đáy thấy được */}
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  {/* Cạnh đáy khuất nét đứt */}
                  {showHiddenLines && (
                    <>
                      <line x1={A.x} y1={A.y} x2={D.x} y2={D.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                      <line x1={D.x} y1={D.y} x2={C.x} y2={C.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                      <line x1={S.x} y1={S.y} x2={D.x} y2={D.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                    </>
                  )}

                  {/* Cạnh bên thấy được */}
                  <line x1={S.x} y1={S.y} x2={A.x} y2={A.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={S.x} y1={S.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={S.x} y1={S.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  {/* Nhãn và đỉnh gốc: DUY NHẤT S, A, B, C, D */}
                  {[
                    { pt: S, name: 'S', dx: 0, dy: -8 },
                    { pt: A, name: 'A', dx: -12, dy: 14 },
                    { pt: B, name: 'B', dx: 10, dy: 14 },
                    { pt: C, name: 'C', dx: 12, dy: -2 },
                    { pt: D, name: 'D', dx: -14, dy: -4 },
                  ].map((item) => (
                    <g
                      key={item.name}
                      onMouseDown={(e) => handlePointMouseDown(item.name, e)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={item.pt.x}
                        cy={item.pt.y}
                        r={selectedPointName === item.name ? 5 : 3.5}
                        fill={selectedPointName === item.name ? '#f59e0b' : '#2563eb'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text x={item.pt.x + item.dx} y={item.pt.y + item.dy} fill="#0f172a" fontSize="11">
                        {item.name}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 2. HÌNH CHÓP TAM GIÁC S.ABC (SẠCH, CHỈ CÓ S, A, B, C)     */}
            {/* ========================================================= */}
            {selectedShape === 'pyramid_tri' && (() => {
              const S_pt = vertexCoords.S || { x: 0, y: 140, z: 0 };
              const A_pt = vertexCoords.A || { x: -90, y: 0, z: 70 };
              const B_pt = vertexCoords.B || { x: 90, y: 0, z: 70 };
              const C_pt = vertexCoords.C || { x: 20, y: 0, z: -80 };

              const S = project3D(S_pt.x, S_pt.y, S_pt.z);
              const A = project3D(A_pt.x, A_pt.y, A_pt.z);
              const B = project3D(B_pt.x, B_pt.y, B_pt.z);
              const C = project3D(C_pt.x, C_pt.y, C_pt.z);

              return (
                <g className="font-bold text-xs select-none">
                  {showShading && (
                    <polygon
                      points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`}
                      fill="url(#pyramidFaceGradient)"
                    />
                  )}

                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  {showHiddenLines && (
                    <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                  )}

                  <line x1={S.x} y1={S.y} x2={A.x} y2={A.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={S.x} y1={S.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={S.x} y1={S.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  {[
                    { pt: S, name: 'S', dx: 0, dy: -8 },
                    { pt: A, name: 'A', dx: -12, dy: 14 },
                    { pt: B, name: 'B', dx: 10, dy: 14 },
                    { pt: C, name: 'C', dx: 10, dy: -4 },
                  ].map((item) => (
                    <g
                      key={item.name}
                      onMouseDown={(e) => handlePointMouseDown(item.name, e)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={item.pt.x}
                        cy={item.pt.y}
                        r={selectedPointName === item.name ? 5 : 3.5}
                        fill={selectedPointName === item.name ? '#f59e0b' : '#6366f1'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text x={item.pt.x + item.dx} y={item.pt.y + item.dy} fill="#0f172a" fontSize="11">
                        {item.name}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 3. KHỐI NÓN TRÒN XOAY (CẢI TIẾN CỰC ĐẸP & CHUẨN SGK)       */}
            {/* ========================================================= */}
            {selectedShape === 'cone' && (() => {
              const h = heightParam;
              const r = radiusParam;
              const S_pt = vertexCoords.S || { x: 0, y: h, z: 0 };
              const O_pt = vertexCoords.O || { x: 0, y: 0, z: 0 };

              const S = project3D(S_pt.x, S_pt.y, S_pt.z);
              const O = project3D(O_pt.x, O_pt.y, O_pt.z);

              // Lấy 64 điểm trên đường tròn đáy trong không gian 3D
              const numSamples = 64;
              const circlePoints3D: { x: number; y: number; z: number }[] = [];
              for (let i = 0; i < numSamples; i++) {
                const angle = (2 * Math.PI * i) / numSamples;
                circlePoints3D.push({
                  x: O_pt.x + r * Math.cos(angle),
                  y: O_pt.y,
                  z: O_pt.z + r * Math.sin(angle),
                });
              }

              // Chiếu 3D sang 2D
              const projectedCircle = circlePoints3D.map((p) => ({
                ...project3D(p.x, p.y, p.z),
                orig: p,
              }));

              // Tìm 2 điểm tiếp tuyến biên (silhouette generator lines)
              let minAngle = Infinity;
              let maxAngle = -Infinity;
              let leftPoint = projectedCircle[0];
              let rightPoint = projectedCircle[0];

              projectedCircle.forEach((p) => {
                const angle = Math.atan2(p.y - S.y, p.x - S.x);
                if (angle < minAngle) {
                  minAngle = angle;
                  leftPoint = p;
                }
                if (angle > maxAngle) {
                  maxAngle = angle;
                  rightPoint = p;
                }
              });

              // Phân chia cung nhìn thấy (trước) và cung khuất (sau)
              // Điểm có z1 < 0 sau khi xoay theo trục camera là cung sau
              const radY = (rotY * Math.PI) / 180;
              const isFrontPoint = (p: { orig: { x: number; z: number } }) => {
                const z1 = -p.orig.x * Math.sin(radY) + p.orig.z * Math.cos(radY);
                return z1 >= 0;
              };

              // Tạo path cho đáy hình nón
              const frontPoints = projectedCircle.filter(isFrontPoint);
              const backPoints = projectedCircle.filter((p) => !isFrontPoint(p));

              // Điểm A bán kính đáy
              const A_proj = project3D(O_pt.x + r, O_pt.y, O_pt.z);

              return (
                <g className="font-bold text-xs select-none">
                  {/* Tô bóng bề mặt nón bằng gradient */}
                  {showShading && (
                    <polygon
                      points={`${S.x},${S.y} ${leftPoint.x},${leftPoint.y} ${frontPoints.map((p) => `${p.x},${p.y}`).join(' ')} ${rightPoint.x},${rightPoint.y}`}
                      fill="url(#coneLateralGradient)"
                    />
                  )}

                  {/* Cung đáy phía sau (khuất): Nét đứt chuẩn SGK */}
                  {showHiddenLines && (
                    <path
                      d={projectedCircle
                        .map((p, idx) => {
                          const isBack = !isFrontPoint(p);
                          return isBack ? `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}` : '';
                        })
                        .filter(Boolean)
                        .join(' ')}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  )}

                  {/* Cung đáy phía trước (thấy được): Nét liền đậm sắc nét */}
                  <path
                    d={projectedCircle
                      .map((p, idx) => {
                        const isFront = isFrontPoint(p);
                        return isFront ? `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}` : '';
                      })
                      .filter(Boolean)
                      .join(' ')}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="2"
                  />

                  {/* Hai đường sinh ngoài biên (Generators) */}
                  <line x1={S.x} y1={S.y} x2={leftPoint.x} y2={leftPoint.y} stroke="#1e293b" strokeWidth="2" />
                  <line x1={S.x} y1={S.y} x2={rightPoint.x} y2={rightPoint.y} stroke="#1e293b" strokeWidth="2" />

                  {/* Đường cao trục SO (Nét đứt màu đỏ chuẩn) */}
                  {showHiddenLines && (
                    <>
                      <line x1={S.x} y1={S.y} x2={O.x} y2={O.y} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                      {/* Bán kính đáy OA */}
                      <line x1={O.x} y1={O.y} x2={A_proj.x} y2={A_proj.y} stroke="#2563eb" strokeWidth="1.4" strokeDasharray="3 3" />

                      {/* Ký hiệu góc vuông tại chân O */}
                      <rect
                        x={O.x}
                        y={O.y - 10}
                        width="8"
                        height="8"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.2"
                      />
                    </>
                  )}

                  {/* Ký hiệu độ dài h và r */}
                  <text x={S.x + 8} y={(S.y + O.y) / 2} fill="#ef4444" fontSize="11" fontStyle="italic">
                    h
                  </text>
                  <text x={(O.x + A_proj.x) / 2} y={O.y - 6} fill="#2563eb" fontSize="11" fontStyle="italic">
                    r
                  </text>

                  {/* Điểm đỉnh S và tâm đáy O */}
                  <g onMouseDown={(e) => handlePointMouseDown('S', e)} className="cursor-pointer">
                    <circle cx={S.x} cy={S.y} r={selectedPointName === 'S' ? 5 : 3.5} fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={S.x} y={S.y - 9} fill="#0f172a" fontSize="11">
                      S
                    </text>
                  </g>

                  <g onMouseDown={(e) => handlePointMouseDown('O', e)} className="cursor-pointer">
                    <circle cx={O.x} cy={O.y} r={selectedPointName === 'O' ? 4.5 : 3} fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={O.x - 14} y={O.y + 4} fill="#ef4444" fontSize="11">
                      O
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 4. KHỐI LẬP PHƯƠNG                                        */}
            {/* ========================================================= */}
            {selectedShape === 'cube' && (() => {
              const A = project3D(vertexCoords.A?.x || -65, vertexCoords.A?.y || 0, vertexCoords.A?.z || 65);
              const B = project3D(vertexCoords.B?.x || 65, vertexCoords.B?.y || 0, vertexCoords.B?.z || 65);
              const C = project3D(vertexCoords.C?.x || 65, vertexCoords.C?.y || 0, vertexCoords.C?.z || -65);
              const D = project3D(vertexCoords.D?.x || -65, vertexCoords.D?.y || 0, vertexCoords.D?.z || -65);

              const A1 = project3D(vertexCoords.A1?.x || -65, vertexCoords.A1?.y || 100, vertexCoords.A1?.z || 65);
              const B1 = project3D(vertexCoords.B1?.x || 65, vertexCoords.B1?.y || 100, vertexCoords.B1?.z || 65);
              const C1 = project3D(vertexCoords.C1?.x || 65, vertexCoords.C1?.y || 100, vertexCoords.C1?.z || -65);
              const D1 = project3D(vertexCoords.D1?.x || -65, vertexCoords.D1?.y || 100, vertexCoords.D1?.z || -65);

              return (
                <g className="font-bold text-xs select-none">
                  {showShading && (
                    <polygon
                      points={`${A1.x},${A1.y} ${B1.x},${B1.y} ${C1.x},${C1.y} ${D1.x},${D1.y}`}
                      fill="rgba(59, 130, 246, 0.12)"
                    />
                  )}

                  {/* Đáy trên */}
                  <line x1={A1.x} y1={A1.y} x2={B1.x} y2={B1.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B1.x} y1={B1.y} x2={C1.x} y2={C1.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={C1.x} y1={C1.y} x2={D1.x} y2={D1.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={D1.x} y1={D1.y} x2={A1.x} y2={A1.y} stroke="#1e293b" strokeWidth="1.8" />

                  {/* Cột đứng thấy được */}
                  <line x1={A1.x} y1={A1.y} x2={A.x} y2={A.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B1.x} y1={B1.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={C1.x} y1={C1.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  {/* Đáy dưới thấy được */}
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  {/* Cạnh khuất */}
                  {showHiddenLines && (
                    <>
                      <line x1={D1.x} y1={D1.y} x2={D.x} y2={D.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                      <line x1={A.x} y1={A.y} x2={D.x} y2={D.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                      <line x1={D.x} y1={D.y} x2={C.x} y2={C.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                    </>
                  )}

                  {/* Đỉnh */}
                  {[
                    { pt: A, name: 'A', dx: -12, dy: 12 },
                    { pt: B, name: 'B', dx: 8, dy: 12 },
                    { pt: C, name: 'C', dx: 10, dy: 0 },
                    { pt: D, name: 'D', dx: -14, dy: -4 },
                    { pt: A1, name: "A'", dx: -14, dy: -6 },
                    { pt: B1, name: "B'", dx: 6, dy: -6 },
                    { pt: C1, name: "C'", dx: 8, dy: -8 },
                    { pt: D1, name: "D'", dx: -14, dy: -8 },
                  ].map((item) => (
                    <g
                      key={item.name}
                      onMouseDown={(e) => handlePointMouseDown(item.name, e)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={item.pt.x}
                        cy={item.pt.y}
                        r={selectedPointName === item.name ? 5 : 3}
                        fill={selectedPointName === item.name ? '#f59e0b' : '#2563eb'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text x={item.pt.x + item.dx} y={item.pt.y + item.dy} fill="#0f172a" fontSize="10">
                        {item.name}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 5. LĂNG TRỤ TAM GIÁC                                       */}
            {/* ========================================================= */}
            {selectedShape === 'prism' && (() => {
              const A = project3D(vertexCoords.A?.x || -80, vertexCoords.A?.y || 0, vertexCoords.A?.z || 50);
              const B = project3D(vertexCoords.B?.x || 80, vertexCoords.B?.y || 0, vertexCoords.B?.z || 50);
              const C = project3D(vertexCoords.C?.x || 10, vertexCoords.C?.y || 0, vertexCoords.C?.z || -60);

              const A1 = project3D(vertexCoords.A1?.x || -80, vertexCoords.A1?.y || 110, vertexCoords.A1?.z || 50);
              const B1 = project3D(vertexCoords.B1?.x || 80, vertexCoords.B1?.y || 110, vertexCoords.B1?.z || 50);
              const C1 = project3D(vertexCoords.C1?.x || 10, vertexCoords.C1?.y || 110, vertexCoords.C1?.z || -60);

              return (
                <g className="font-bold text-xs select-none">
                  <polygon
                    points={`${A1.x},${A1.y} ${B1.x},${B1.y} ${C1.x},${C1.y}`}
                    fill="rgba(59, 130, 246, 0.12)"
                    stroke="#1e293b"
                    strokeWidth="1.8"
                  />

                  <line x1={A1.x} y1={A1.y} x2={A.x} y2={A.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B1.x} y1={B1.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={C1.x} y1={C1.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke="#1e293b" strokeWidth="1.8" />

                  {showHiddenLines && (
                    <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                  )}

                  {[
                    { pt: A, name: 'A', dx: -12, dy: 12 },
                    { pt: B, name: 'B', dx: 8, dy: 12 },
                    { pt: C, name: 'C', dx: 10, dy: -4 },
                    { pt: A1, name: "A'", dx: -14, dy: -6 },
                    { pt: B1, name: "B'", dx: 6, dy: -6 },
                    { pt: C1, name: "C'", dx: 8, dy: -8 },
                  ].map((item) => (
                    <g
                      key={item.name}
                      onMouseDown={(e) => handlePointMouseDown(item.name, e)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={item.pt.x}
                        cy={item.pt.y}
                        r={selectedPointName === item.name ? 5 : 3}
                        fill={selectedPointName === item.name ? '#f59e0b' : '#2563eb'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text x={item.pt.x + item.dx} y={item.pt.y + item.dy} fill="#0f172a" fontSize="10">
                        {item.name}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 6. KHỐI TRỤ TRÒN XOAY                                     */}
            {/* ========================================================= */}
            {selectedShape === 'cylinder' && (() => {
              const h = heightParam * 0.8;
              const r = radiusParam;
              const O1 = project3D(0, h, 0);
              const O2 = project3D(0, 0, 0);
              const A1 = project3D(-r, h, 0);
              const B1 = project3D(r, h, 0);
              const A2 = project3D(-r, 0, 0);
              const B2 = project3D(r, 0, 0);

              return (
                <g className="font-bold text-xs select-none">
                  <ellipse
                    cx={O1.x}
                    cy={O1.y}
                    rx={r * zoomLevel}
                    ry={r * 0.35 * zoomLevel}
                    fill="rgba(59, 130, 246, 0.12)"
                    stroke="#1e293b"
                    strokeWidth="1.8"
                  />

                  <ellipse
                    cx={O2.x}
                    cy={O2.y}
                    rx={r * zoomLevel}
                    ry={r * 0.35 * zoomLevel}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1.8"
                  />

                  <line x1={A1.x} y1={A1.y} x2={A2.x} y2={A2.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={B1.x} y1={B1.y} x2={B2.x} y2={B2.y} stroke="#1e293b" strokeWidth="1.8" />

                  {showHiddenLines && (
                    <line x1={O1.x} y1={O1.y} x2={O2.x} y2={O2.y} stroke="#ef4444" strokeWidth="1.4" strokeDasharray="4 3" />
                  )}

                  <circle cx={O1.x} cy={O1.y} r="2.5" fill="#ef4444" />
                  <text x={O1.x + 5} y={O1.y - 4} fill="#ef4444">O'</text>
                  <circle cx={O2.x} cy={O2.y} r="2.5" fill="#ef4444" />
                  <text x={O2.x + 5} y={O2.y + 12} fill="#ef4444">O</text>
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* ĐỐI TƯỢNG DO NGƯỜI DÙNG TỰ DỰNG (MẶT / ĐƯỜNG / ĐIỂM)      */}
            {/* ========================================================= */}

            {/* 1. CÁC MẶT PHẲNG ĐI QUA 3 ĐIỂM */}
            {customPlanes.map((plane) => {
              const pts = plane.pointNames
                .map((name) => (allPointsMap[name] ? project3D(allPointsMap[name].x, allPointsMap[name].y, allPointsMap[name].z) : null))
                .filter(Boolean) as { x: number; y: number }[];
              if (pts.length < 3) return null;

              const polyPoints = pts.map((p) => `${p.x},${p.y}`).join(' ');
              const themeColors = {
                amber: { fill: `rgba(245, 158, 11, ${plane.opacity})`, stroke: '#d97706' },
                violet: { fill: `rgba(139, 92, 246, ${plane.opacity})`, stroke: '#7c3aed' },
                emerald: { fill: `rgba(16, 185, 129, ${plane.opacity})`, stroke: '#059669' },
                cyan: { fill: `rgba(6, 182, 212, ${plane.opacity})`, stroke: '#0891b2' },
                rose: { fill: `rgba(244, 63, 94, ${plane.opacity})`, stroke: '#e11d48' },
              };
              const active = themeColors[plane.colorTheme] || themeColors.amber;
              const cX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
              const cY = pts.reduce((s, p) => s + p.y, 0) / pts.length;

              return (
                <g key={plane.id}>
                  <polygon points={polyPoints} fill={active.fill} stroke={active.stroke} strokeWidth="2.2" />
                  <rect
                    x={cX - 24}
                    y={cY - 9}
                    width="48"
                    height="18"
                    rx="4"
                    fill="#ffffff"
                    fillOpacity="0.88"
                    stroke={active.stroke}
                    strokeWidth="1"
                  />
                  <text
                    x={cX}
                    y={cY + 4}
                    fill={active.stroke}
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {plane.name}
                  </text>
                </g>
              );
            })}

            {/* 2. CÁC ĐƯỜNG THẲNG / ĐOẠN THẲNG / TIA / VUÔNG GÓC TỰ VẼ */}
            {customLines.map((l) => {
              const p1Coord = allPointsMap[l.p1];
              const p2Coord = allPointsMap[l.p2];
              if (!p1Coord || !p2Coord) return null;

              const p1 = project3D(p1Coord.x, p1Coord.y, p1Coord.z);
              const p2 = project3D(p2Coord.x, p2Coord.y, p2Coord.z);

              if (l.type === 'segment' || l.type === 'perpendicular') {
                return (
                  <g key={l.id}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={l.color || '#2563eb'}
                      strokeWidth="2.2"
                      strokeDasharray={l.style === 'dashed' ? '5 3' : undefined}
                    />
                    {/* Ký hiệu góc vuông nếu là đường vuông góc */}
                    {l.type === 'perpendicular' && (
                      <rect
                        x={p2.x - 3}
                        y={p2.y - 8}
                        width="7"
                        height="7"
                        fill="none"
                        stroke={l.color || '#dc2626'}
                        strokeWidth="1.2"
                      />
                    )}
                  </g>
                );
              } else if (l.type === 'line') {
                // Đường thẳng kéo dài 2 phía
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const ext1 = { x: p1.x - dx * 0.7, y: p1.y - dy * 0.7 };
                const ext2 = { x: p2.x + dx * 0.7, y: p2.y + dy * 0.7 };
                return (
                  <g key={l.id}>
                    <line
                      x1={ext1.x}
                      y1={ext1.y}
                      x2={ext2.x}
                      y2={ext2.y}
                      stroke={l.color || '#8b5cf6'}
                      strokeWidth="1.8"
                      strokeDasharray={l.style === 'dashed' ? '5 3' : undefined}
                    />
                    <circle cx={ext1.x} cy={ext1.y} r="2" fill={l.color} />
                    <circle cx={ext2.x} cy={ext2.y} r="2" fill={l.color} />
                  </g>
                );
              } else {
                // Tia xuất phát từ p1 qua p2 và kéo dài
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const ext = { x: p2.x + dx * 0.7, y: p2.y + dy * 0.7 };
                return (
                  <g key={l.id}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={ext.x}
                      y2={ext.y}
                      stroke={l.color || '#f59e0b'}
                      strokeWidth="2"
                      strokeDasharray={l.style === 'dashed' ? '5 3' : undefined}
                    />
                    {/* Mũi tên tia */}
                    <circle cx={p1.x} cy={p1.y} r="3" fill={l.color} />
                  </g>
                );
              }
            })}

            {/* 3. CÁC ĐIỂM TỰ TẠO (TRUNG ĐIỂM, TỈ LỆ, TRỌNG TÂM, MỚI) */}
            {customPoints.map((pt) => {
              const p = project3D(pt.x, pt.y, pt.z);
              const isSelected = selectedPointName === pt.name;

              return (
                <g
                  key={pt.name}
                  onMouseDown={(e) => handlePointMouseDown(pt.name, e)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="animate-pulse" />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 5.5 : 4}
                    fill={pt.color || '#10b981'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={p.x + 7}
                    y={p.y - 4}
                    fill="#065f46"
                    fontSize="10.5"
                    fontWeight="bold"
                    className="font-mono select-none"
                  >
                    {pt.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

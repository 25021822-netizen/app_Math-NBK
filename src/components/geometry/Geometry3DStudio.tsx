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

export type QuadBaseType = 'parallelogram' | 'trapezoid' | 'quadrilateral';

const QUAD_BASE_META: Record<QuadBaseType, { label: string; shortDesc: string }> = {
  parallelogram: { label: 'Hình bình hành', shortDesc: 'AB // CD, AD // BC' },
  trapezoid: { label: 'Hình thang', shortDesc: 'AB // CD (AB > CD)' },
  quadrilateral: { label: 'Tứ giác', shortDesc: 'Tứ giác lồi bất kỳ' },
};

const POINT_NAME_PREFERENCES = {
  ratio: ['M', 'N', 'P', 'Q', 'I', 'J', 'K', 'H', 'E', 'F', 'R', 'T', 'U', 'V'],
  centroid: ['G', 'G1', 'G2', 'G3', 'M', 'N', 'P', 'Q', 'I', 'J', 'K', 'E', 'F'],
  intersect_segments: ['I', 'J', 'K', 'E', 'F', 'M', 'N', 'P', 'Q', 'H', 'R', 'T'],
  intersect_line_plane: ['K', 'I', 'J', 'H', 'E', 'F', 'M', 'N', 'P', 'Q', 'R', 'T'],
  manual: ['M', 'N', 'P', 'Q', 'E', 'F', 'I', 'J', 'K', 'H', 'R', 'T', 'U', 'V'],
  perpendicular: ['H', 'H1', 'H2', 'H3', 'K', 'I', 'J'],
} as const;

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
  // Chọn hình khối không gian & dạng đáy cho hình chóp tứ giác
  const [selectedShape, setSelectedShape] = useState<Shape3DType>('pyramid_quad');
  const [quadBaseType, setQuadBaseType] = useState<QuadBaseType>('parallelogram');

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
  const [pointCreationMode, setPointCreationMode] = useState<
    'ratio' | 'centroid' | 'intersect_segments' | 'intersect_line_plane' | 'manual'
  >('ratio');
  const [ratioPointA, setRatioPointA] = useState<string>('');
  const [ratioPointB, setRatioPointB] = useState<string>('');
  const [ratioK, setRatioK] = useState<number>(0.5);
  const [ratioPointLabel, setRatioPointLabel] = useState<string>('M');

  const [centroidA, setCentroidA] = useState<string>('');
  const [centroidB, setCentroidB] = useState<string>('');
  const [centroidC, setCentroidC] = useState<string>('');
  const [centroidLabel, setCentroidLabel] = useState<string>('G');

  // Giao của 2 đoạn / đường thẳng
  const [seg1PointA, setSeg1PointA] = useState<string>('');
  const [seg1PointB, setSeg1PointB] = useState<string>('');
  const [seg2PointA, setSeg2PointA] = useState<string>('');
  const [seg2PointB, setSeg2PointB] = useState<string>('');
  const [intersectSegExtend, setIntersectSegExtend] = useState<boolean>(false);
  const [intersectSegDrawExt, setIntersectSegDrawExt] = useState<boolean>(true);
  const [intersectSegLabel, setIntersectSegLabel] = useState<string>('I');
  const [intersectSegColor, setIntersectSegColor] = useState<string>('#8b5cf6');

  // Giao của 1 đường thẳng với 1 mặt phẳng
  const [lpLinePointA, setLpLinePointA] = useState<string>('');
  const [lpLinePointB, setLpLinePointB] = useState<string>('');
  const [lpPlanePoint1, setLpPlanePoint1] = useState<string>('');
  const [lpPlanePoint2, setLpPlanePoint2] = useState<string>('');
  const [lpPlanePoint3, setLpPlanePoint3] = useState<string>('');
  const [lpRestrictSegment, setLpRestrictSegment] = useState<boolean>(false);
  const [lpDrawExtension, setLpDrawExtension] = useState<boolean>(true);
  const [intersectLPLabel, setIntersectLPLabel] = useState<string>('K');
  const [intersectLPColor, setIntersectLPColor] = useState<string>('#e11d48');

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
  const initDefaultVertices = (
    shape: Shape3DType,
    h = heightParam,
    r = radiusParam,
    baseType: QuadBaseType = quadBaseType
  ) => {
    let base: Record<string, Point3D> = {};

    if (shape === 'pyramid_quad') {
      if (baseType === 'trapezoid') {
        // Hình thang ABCD: Đáy lớn AB // Đáy nhỏ CD (AD và BC cắt nhau khi kéo dài)
        base = {
          S: { name: 'S', x: 0, y: h, z: 0, label: 'S' },
          A: { name: 'A', x: -105, y: 0, z: 70, label: 'A' },
          B: { name: 'B', x: 105, y: 0, z: 70, label: 'B' },
          C: { name: 'C', x: 50, y: 0, z: -70, label: 'C' },
          D: { name: 'D', x: -60, y: 0, z: -70, label: 'D' },
        };
      } else if (baseType === 'quadrilateral') {
        // Tứ giác lồi ABCD bất kỳ: Các cặp cạnh đối không song song
        base = {
          S: { name: 'S', x: 0, y: h, z: 0, label: 'S' },
          A: { name: 'A', x: -100, y: 0, z: 70, label: 'A' },
          B: { name: 'B', x: 85, y: 0, z: 88, label: 'B' },
          C: { name: 'C', x: 115, y: 0, z: -52, label: 'C' },
          D: { name: 'D', x: -52, y: 0, z: -86, label: 'D' },
        };
      } else {
        // Hình bình hành ABCD chuẩn SGK
        const a = 90;
        const b = 70;
        base = {
          S: { name: 'S', x: 0, y: h, z: 0, label: 'S' },
          A: { name: 'A', x: -a, y: 0, z: b, label: 'A' },
          B: { name: 'B', x: a, y: 0, z: b, label: 'B' },
          C: { name: 'C', x: a + 20, y: 0, z: -b, label: 'C' },
          D: { name: 'D', x: -a + 20, y: 0, z: -b, label: 'D' },
        };
      }
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

  // Khởi tạo lần đầu và khi đổi hình / dạng đáy
  useEffect(() => {
    setVertexCoords(initDefaultVertices(selectedShape, heightParam, radiusParam, quadBaseType));
  }, [selectedShape, quadBaseType]);

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
    setStatusMessage(`Đã chuyển sang hình: ${getShapeTitle(shape, quadBaseType)} (Giao diện chuẩn sạch)`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Chuyển dạng đáy cho hình chóp tứ giác S.ABCD
  const handleSelectQuadBase = (baseType: QuadBaseType) => {
    setQuadBaseType(baseType);
    if (selectedShape !== 'pyramid_quad') {
      setSelectedShape('pyramid_quad');
    }
    setCustomPoints([]);
    setCustomLines([]);
    setCustomPlanes([]);
    setSelectedPointName(null);
    setStatusMessage(`Đã chọn Chóp Tứ Giác S.ABCD — Đáy ${QUAD_BASE_META[baseType].label}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Tên tiêu đề tiếng Việt của hình
  const getShapeTitle = (shape: Shape3DType, baseType: QuadBaseType = quadBaseType) => {
    switch (shape) {
      case 'pyramid_quad':
        return `Hình Chóp Tứ Giác S.ABCD (Đáy ${QUAD_BASE_META[baseType].label.toLowerCase()})`;
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

  // Danh sách tất cả tên điểm đang dùng (cả key lẫn label hiển thị như A', O')
  const allUsedPointTokens = useMemo(() => {
    const tokens = new Set<string>();
    Object.entries(allPointsMap).forEach(([k, pt]) => {
      tokens.add(k.trim().toUpperCase());
      if (pt?.name) tokens.add(pt.name.trim().toUpperCase());
    });
    return Array.from(tokens);
  }, [allPointsMap]);

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

      // Mặc định thông minh cho giao 2 đoạn (ví dụ AC và BD trên chóp tứ giác)
      if (!seg1PointA || !allPointNames.includes(seg1PointA)) {
        setSeg1PointA(allPointNames.includes('A') ? 'A' : allPointNames[0]);
      }
      if (!seg1PointB || !allPointNames.includes(seg1PointB)) {
        setSeg1PointB(allPointNames.includes('C') ? 'C' : allPointNames[1]);
      }
      if (!seg2PointA || !allPointNames.includes(seg2PointA)) {
        setSeg2PointA(allPointNames.includes('B') ? 'B' : allPointNames[1]);
      }
      if (!seg2PointB || !allPointNames.includes(seg2PointB)) {
        setSeg2PointB(allPointNames.includes('D') ? 'D' : allPointNames[2] || allPointNames[0]);
      }

      // Mặc định cho giao 1 đường với 1 mặt phẳng
      if (!lpLinePointA || !allPointNames.includes(lpLinePointA)) setLpLinePointA(allPointNames[0]);
      if (!lpLinePointB || !allPointNames.includes(lpLinePointB)) setLpLinePointB(allPointNames[1]);
      if (!lpPlanePoint1 || !allPointNames.includes(lpPlanePoint1)) {
        setLpPlanePoint1(allPointNames[2] || allPointNames[0]);
      }
      if (!lpPlanePoint2 || !allPointNames.includes(lpPlanePoint2)) {
        setLpPlanePoint2(allPointNames[3] || allPointNames[1]);
      }
      if (!lpPlanePoint3 || !allPointNames.includes(lpPlanePoint3)) {
        setLpPlanePoint3(allPointNames[4] || allPointNames[2] || allPointNames[0]);
      }
    }
  }, [allPointNames]);

  // Danh sách các đoạn/cạnh hiện có (dùng để chọn nhanh khi tìm giao điểm)
  const availableSegmentOptions = useMemo(() => {
    const list: { key: string; label: string; p1: string; p2: string }[] = [];
    const seen = new Set<string>();
    const addEdge = (p1: string, p2: string, label: string) => {
      if (!allPointsMap[p1] || !allPointsMap[p2]) return;
      const k = `${p1}->${p2}`;
      if (seen.has(k)) return;
      seen.add(k);
      list.push({ key: k, label, p1, p2 });
    };

    customLines.forEach((l) => {
      const kind = l.type === 'segment' ? 'Đoạn' : l.type === 'line' ? 'Đường' : l.type === 'ray' ? 'Tia' : '⊥';
      addEdge(l.p1, l.p2, `${kind} ${allPointsMap[l.p1]?.name || l.p1}${allPointsMap[l.p2]?.name || l.p2}`);
    });

    if (selectedShape === 'pyramid_quad') {
      addEdge('S', 'A', 'Cạnh SA');
      addEdge('S', 'B', 'Cạnh SB');
      addEdge('S', 'C', 'Cạnh SC');
      addEdge('S', 'D', 'Cạnh SD');
      addEdge('A', 'B', 'Cạnh AB');
      addEdge('B', 'C', 'Cạnh BC');
      addEdge('C', 'D', 'Cạnh CD');
      addEdge('D', 'A', 'Cạnh DA');
      addEdge('A', 'C', 'Đường chéo AC');
      addEdge('B', 'D', 'Đường chéo BD');
    } else if (selectedShape === 'pyramid_tri') {
      addEdge('S', 'A', 'Cạnh SA');
      addEdge('S', 'B', 'Cạnh SB');
      addEdge('S', 'C', 'Cạnh SC');
      addEdge('A', 'B', 'Cạnh AB');
      addEdge('B', 'C', 'Cạnh BC');
      addEdge('C', 'A', 'Cạnh CA');
    } else if (selectedShape === 'cone') {
      addEdge('S', 'A', 'Đường sinh SA');
      addEdge('S', 'B', 'Đường sinh SB');
      addEdge('S', 'O', 'Đường cao SO');
      addEdge('A', 'B', 'Đường kính AB');
    } else if (selectedShape === 'cube') {
      addEdge('A', 'B', 'Cạnh AB');
      addEdge('B', 'C', 'Cạnh BC');
      addEdge('C', 'D', 'Cạnh CD');
      addEdge('D', 'A', 'Cạnh DA');
      addEdge('A1', 'B1', "Cạnh A'B'");
      addEdge('B1', 'C1', "Cạnh B'C'");
      addEdge('C1', 'D1', "Cạnh C'D'");
      addEdge('D1', 'A1', "Cạnh D'A'");
      addEdge('A', 'A1', "Cạnh AA'");
      addEdge('B', 'B1', "Cạnh BB'");
      addEdge('C', 'C1', "Cạnh CC'");
      addEdge('D', 'D1', "Cạnh DD'");
      addEdge('A', 'C', 'Đường chéo AC');
      addEdge('B', 'D', 'Đường chéo BD');
    } else if (selectedShape === 'prism') {
      addEdge('A', 'B', 'Cạnh AB');
      addEdge('B', 'C', 'Cạnh BC');
      addEdge('C', 'A', 'Cạnh CA');
      addEdge('A1', 'B1', "Cạnh A'B'");
      addEdge('B1', 'C1', "Cạnh B'C'");
      addEdge('C1', 'A1', "Cạnh C'A'");
      addEdge('A', 'A1', "Cạnh AA'");
      addEdge('B', 'B1', "Cạnh BB'");
      addEdge('C', 'C1', "Cạnh CC'");
    } else if (selectedShape === 'cylinder') {
      addEdge('A', 'A1', "Đường sinh AA'");
      addEdge('B', 'B1', "Đường sinh BB'");
      addEdge('O', 'O1', "Trục OO'");
      addEdge('A', 'B', 'Đường kính đáy AB');
    }

    return list;
  }, [allPointsMap, customLines, selectedShape]);

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

  // Vector hướng về camera trong không gian 3D (dùng cho ẩn/hiện cạnh khuất động)
  const viewDirWorld = useMemo(() => {
    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;
    return {
      x: -Math.sin(radY) * Math.cos(radX),
      y: Math.sin(radX),
      z: Math.cos(radY) * Math.cos(radX),
    };
  }, [rotX, rotY]);

  // Kiểm tra danh sách mặt đa diện hướng về phía người xem hay quay ra sau
  const computePolyhedronVisibility = (
    verts: Record<string, { x: number; y: number; z: number }>,
    faces: { keys: string[] }[]
  ) => {
    const vertList = Object.values(verts);
    const centroid = vertList.reduce(
      (acc, v) => ({ x: acc.x + v.x / vertList.length, y: acc.y + v.y / vertList.length, z: acc.z + v.z / vertList.length }),
      { x: 0, y: 0, z: 0 }
    );

    return faces.map((face) => {
      const p0 = verts[face.keys[0]];
      const p1 = verts[face.keys[1]];
      const p2 = verts[face.keys[2]];
      if (!p0 || !p1 || !p2) return true;

      const e1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
      const e2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
      let nx = e1.y * e2.z - e1.z * e2.y;
      let ny = e1.z * e2.x - e1.x * e2.z;
      let nz = e1.x * e2.y - e1.y * e2.x;
      const nLen = Math.hypot(nx, ny, nz);
      if (nLen < 1e-4) return true;

      const fc = face.keys.reduce(
        (acc, k) => {
          const v = verts[k];
          return { x: acc.x + v.x / face.keys.length, y: acc.y + v.y / face.keys.length, z: acc.z + v.z / face.keys.length };
        },
        { x: 0, y: 0, z: 0 }
      );
      const toFaceDot = nx * (fc.x - centroid.x) + ny * (fc.y - centroid.y) + nz * (fc.z - centroid.z);
      if (toFaceDot < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }

      return nx * viewDirWorld.x + ny * viewDirWorld.y + nz * viewDirWorld.z > 0.001;
    });
  };

  // Tạo SVG path sạch cho cung tròn phía trước / phía sau (hỗ trợ xoay mọi góc)
  const buildCircularArcPath = (
    points: { x: number; y: number; isFront: boolean }[],
    wantFront: boolean
  ): string => {
    const n = points.length;
    if (n === 0) return '';
    const matches = points.map((p) => p.isFront === wantFront);
    if (matches.every(Boolean)) {
      return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')} Z`;
    }
    if (matches.every((m) => !m)) return '';

    const segments: string[] = [];
    let startTransition = -1;
    for (let i = 0; i < n; i++) {
      if (matches[i] && !matches[(i - 1 + n) % n]) {
        startTransition = i;
        break;
      }
    }
    if (startTransition === -1) return '';

    let inRun = false;
    let currentRun: string[] = [];
    for (let offset = 0; offset <= n; offset++) {
      const idx = (startTransition + offset) % n;
      const prevIdx = (idx - 1 + n) % n;
      if (matches[idx]) {
        if (!inRun) {
          inRun = true;
          currentRun = [`M ${points[prevIdx].x.toFixed(2)} ${points[prevIdx].y.toFixed(2)}`];
        }
        currentRun.push(`L ${points[idx].x.toFixed(2)} ${points[idx].y.toFixed(2)}`);
      } else if (inRun) {
        currentRun.push(`L ${points[idx].x.toFixed(2)} ${points[idx].y.toFixed(2)}`);
        segments.push(currentRun.join(' '));
        inRun = false;
        currentRun = [];
      }
    }
    if (inRun && currentRun.length > 0) {
      segments.push(currentRun.join(' '));
    }
    return segments.join(' ');
  };

  // Tự động xoay 360° nếu được kích hoạt
  useEffect(() => {
    if (!isRotatingAuto) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 1) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, [isRotatingAuto]);

  // Sinh tên điểm tự động không trùng với các điểm đã có
  const getNextFreePointName = (
    existingNames: string[],
    preferredOrder: readonly string[] = POINT_NAME_PREFERENCES.manual
  ): string => {
    const used = new Set(existingNames.map((n) => n.trim().toUpperCase()).filter(Boolean));
    const fallbackPool = ['M', 'N', 'P', 'Q', 'I', 'J', 'K', 'H', 'E', 'F', 'G', 'R', 'T', 'U', 'V', 'X', 'Y', 'Z'];
    for (const candidate of [...preferredOrder, ...fallbackPool]) {
      if (!used.has(candidate.toUpperCase())) {
        return candidate;
      }
    }
    const basePrefix = preferredOrder[0]?.replace(/[0-9]/g, '') || 'M';
    let idx = 1;
    while (used.has(`${basePrefix}${idx}`.toUpperCase())) {
      idx += 1;
    }
    return `${basePrefix}${idx}`;
  };

  // Tự động điền tên điểm hợp lệ (không trống, không trùng) khi đổi hình, đổi tab, hoặc thêm/xóa điểm
  useEffect(() => {
    const usedSet = new Set(allUsedPointTokens);
    const shouldReplace = (val: string) => {
      const clean = val.trim().toUpperCase();
      return !clean || usedSet.has(clean);
    };

    if (shouldReplace(ratioPointLabel)) {
      setRatioPointLabel(getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.ratio));
    }
    if (shouldReplace(centroidLabel)) {
      setCentroidLabel(getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.centroid));
    }
    if (shouldReplace(intersectSegLabel)) {
      setIntersectSegLabel(getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_segments));
    }
    if (shouldReplace(intersectLPLabel)) {
      setIntersectLPLabel(getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_line_plane));
    }
    if (shouldReplace(manualPointName)) {
      setManualPointName(getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual));
    }
  }, [allUsedPointTokens, selectedShape, quadBaseType, pointCreationMode]);

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

    const name = ratioPointLabel.trim() || getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.ratio);
    const dispA = p1.name || ratioPointA;
    const dispB = p2.name || ratioPointB;
    const newPoint: Point3D = {
      name,
      x: newX,
      y: newY,
      z: newZ,
      label: `${name} (k=${k} ${dispA}${dispB})`,
      color: '#10b981',
      isCustom: true,
    };

    setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);
    setSelectedPointName(name);
    setStatusMessage(`Đã tạo điểm [${name}] trên cạnh [${dispA}${dispB}] với tỉ lệ k=${k}!`);
    setTimeout(() => setStatusMessage(null), 3500);

    const nextName = getNextFreePointName([...allUsedPointTokens, name], POINT_NAME_PREFERENCES.ratio);
    setRatioPointLabel(nextName);
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

    const name = centroidLabel.trim() || getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.centroid);
    const dispA = p1.name || centroidA;
    const dispB = p2.name || centroidB;
    const dispC = p3.name || centroidC;
    const newPoint: Point3D = {
      name,
      x: gX,
      y: gY,
      z: gZ,
      label: `${name} (Trọng tâm ${dispA}${dispB}${dispC})`,
      color: '#f59e0b',
      isCustom: true,
    };

    setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);
    setSelectedPointName(name);
    setStatusMessage(`Đã tạo thành công Trọng tâm [${name}] của tam giác [${dispA}${dispB}${dispC}]!`);
    setTimeout(() => setStatusMessage(null), 3500);

    const nextName = getNextFreePointName([...allUsedPointTokens, name], POINT_NAME_PREFERENCES.centroid);
    setCentroidLabel(nextName);
  };

  // Làm tròn tọa độ 1 chữ số thập phân (tránh -0)
  const roundCoord1 = (val: number): number => {
    const r = Math.round(val * 10) / 10;
    return Object.is(r, -0) ? 0 : r;
  };

  // Tính giao điểm của 2 đoạn / đường thẳng trong không gian 3D
  const computeSegmentIntersection3D = (
    p1: Point3D | undefined,
    p2: Point3D | undefined,
    p3: Point3D | undefined,
    p4: Point3D | undefined,
    allowExtended: boolean
  ): {
    ok: boolean;
    reason?: 'invalid' | 'parallel' | 'skew' | 'outside';
    point?: { x: number; y: number; z: number };
    t?: number;
    s?: number;
    message: string;
  } => {
    if (!p1 || !p2 || !p3 || !p4) {
      return { ok: false, reason: 'invalid', message: 'Vui lòng chọn đủ các điểm cho 2 đoạn.' };
    }
    const u = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v = { x: p4.x - p3.x, y: p4.y - p3.y, z: p4.z - p3.z };
    const a = u.x * u.x + u.y * u.y + u.z * u.z;
    const c = v.x * v.x + v.y * v.y + v.z * v.z;

    if (a < 1e-4 || c < 1e-4) {
      return { ok: false, reason: 'invalid', message: 'Hai đầu mút của mỗi đoạn thẳng phải khác nhau.' };
    }

    const b = u.x * v.x + u.y * v.y + u.z * v.z;
    const w0 = { x: p1.x - p3.x, y: p1.y - p3.y, z: p1.z - p3.z };
    const d = u.x * w0.x + u.y * w0.y + u.z * w0.z;
    const e = v.x * w0.x + v.y * w0.y + v.z * w0.z;

    const denom = a * c - b * b;
    if (denom < 1e-5 * a * c) {
      return {
        ok: false,
        reason: 'parallel',
        message: 'Hai đoạn/đường thẳng song song hoặc trùng nhau, không có giao điểm duy nhất.',
      };
    }

    const t = (b * e - c * d) / denom;
    const s = (a * e - b * d) / denom;

    const q1 = { x: p1.x + t * u.x, y: p1.y + t * u.y, z: p1.z + t * u.z };
    const q2 = { x: p3.x + s * v.x, y: p3.y + s * v.y, z: p3.z + s * v.z };
    const dist = Math.hypot(q1.x - q2.x, q1.y - q2.y, q1.z - q2.z);

    if (dist > 3.0) {
      return {
        ok: false,
        reason: 'skew',
        message: `Hai đường thẳng chéo nhau trong không gian (khoảng cách ≈ ${roundCoord1(dist)}), không cắt nhau.`,
      };
    }

    const pt = {
      x: roundCoord1((q1.x + q2.x) / 2),
      y: roundCoord1((q1.y + q2.y) / 2),
      z: roundCoord1((q1.z + q2.z) / 2),
    };

    const onSeg1 = t >= -0.02 && t <= 1.02;
    const onSeg2 = s >= -0.02 && s <= 1.02;

    if (!allowExtended && (!onSeg1 || !onSeg2)) {
      return {
        ok: false,
        reason: 'outside',
        point: pt,
        t,
        s,
        message: 'Hai đường đồng phẳng nhưng giao điểm nằm ngoài phạm vi 2 đoạn. Bật "Cho phép kéo dài" để tạo điểm này.',
      };
    }

    return {
      ok: true,
      point: pt,
      t,
      s,
      message:
        onSeg1 && onSeg2
          ? `Hai đoạn cắt nhau tại (${pt.x}, ${pt.y}, ${pt.z})`
          : `Hai đường cắt nhau trên phần kéo dài tại (${pt.x}, ${pt.y}, ${pt.z})`,
    };
  };

  // Tính giao điểm của 1 đường thẳng (L1L2) với 1 mặt phẳng (ABC) trong không gian 3D
  const computeLinePlaneIntersection3D = (
    l1: Point3D | undefined,
    l2: Point3D | undefined,
    pA: Point3D | undefined,
    pB: Point3D | undefined,
    pC: Point3D | undefined,
    restrictToSegment: boolean
  ): {
    ok: boolean;
    reason?: 'invalid' | 'parallel' | 'coincident' | 'outside';
    point?: { x: number; y: number; z: number };
    t?: number;
    message: string;
  } => {
    if (!l1 || !l2 || !pA || !pB || !pC) {
      return { ok: false, reason: 'invalid', message: 'Vui lòng chọn đủ điểm cho đường thẳng và mặt phẳng.' };
    }

    const u = { x: l2.x - l1.x, y: l2.y - l1.y, z: l2.z - l1.z };
    const uLen = Math.hypot(u.x, u.y, u.z);
    if (uLen < 1e-3) {
      return { ok: false, reason: 'invalid', message: 'Hai điểm xác định đường thẳng phải khác nhau.' };
    }

    const e1 = { x: pB.x - pA.x, y: pB.y - pA.y, z: pB.z - pA.z };
    const e2 = { x: pC.x - pA.x, y: pC.y - pA.y, z: pC.z - pA.z };
    const n = {
      x: e1.y * e2.z - e1.z * e2.y,
      y: e1.z * e2.x - e1.x * e2.z,
      z: e1.x * e2.y - e1.y * e2.x,
    };
    const nLen = Math.hypot(n.x, n.y, n.z);
    if (nLen < 1e-3) {
      return { ok: false, reason: 'invalid', message: 'Ba điểm tạo mặt phẳng bị trùng hoặc thẳng hàng.' };
    }

    const denom = n.x * u.x + n.y * u.y + n.z * u.z;
    const cosAngle = Math.abs(denom) / (nLen * uLen);

    const diff = { x: pA.x - l1.x, y: pA.y - l1.y, z: pA.z - l1.z };
    const num = n.x * diff.x + n.y * diff.y + n.z * diff.z;

    if (cosAngle < 1e-4) {
      const distToPlane = Math.abs(num) / nLen;
      if (distToPlane < 2.0) {
        return {
          ok: false,
          reason: 'coincident',
          message: 'Đường thẳng nằm trong mặt phẳng (có vô số giao điểm).',
        };
      }
      return {
        ok: false,
        reason: 'parallel',
        message: 'Đường thẳng song song với mặt phẳng, không có giao điểm.',
      };
    }

    const t = num / denom;
    const pt = {
      x: roundCoord1(l1.x + t * u.x),
      y: roundCoord1(l1.y + t * u.y),
      z: roundCoord1(l1.z + t * u.z),
    };

    const onSeg = t >= -0.02 && t <= 1.02;
    if (restrictToSegment && !onSeg) {
      return {
        ok: false,
        reason: 'outside',
        point: pt,
        t,
        message: 'Giao điểm nằm ngoài phạm vi đoạn thẳng. Bỏ chọn giới hạn đoạn để lấy giao điểm trên phần kéo dài.',
      };
    }

    return {
      ok: true,
      point: pt,
      t,
      message: onSeg
        ? `Đường thẳng cắt mặt phẳng ngay trên đoạn tại (${pt.x}, ${pt.y}, ${pt.z})`
        : `Đường thẳng cắt mặt phẳng trên phần kéo dài tại (${pt.x}, ${pt.y}, ${pt.z})`,
    };
  };

  // Kết quả tính thử thời gian thực cho 2 chế độ giao điểm
  const segIntersectPreview = useMemo(() => {
    if (activeCategory !== 'points' || pointCreationMode !== 'intersect_segments') return null;
    return computeSegmentIntersection3D(
      allPointsMap[seg1PointA],
      allPointsMap[seg1PointB],
      allPointsMap[seg2PointA],
      allPointsMap[seg2PointB],
      intersectSegExtend
    );
  }, [
    activeCategory,
    pointCreationMode,
    allPointsMap,
    seg1PointA,
    seg1PointB,
    seg2PointA,
    seg2PointB,
    intersectSegExtend,
  ]);

  const linePlaneIntersectPreview = useMemo(() => {
    if (activeCategory !== 'points' || pointCreationMode !== 'intersect_line_plane') return null;
    return computeLinePlaneIntersection3D(
      allPointsMap[lpLinePointA],
      allPointsMap[lpLinePointB],
      allPointsMap[lpPlanePoint1],
      allPointsMap[lpPlanePoint2],
      allPointsMap[lpPlanePoint3],
      lpRestrictSegment
    );
  }, [
    activeCategory,
    pointCreationMode,
    allPointsMap,
    lpLinePointA,
    lpLinePointB,
    lpPlanePoint1,
    lpPlanePoint2,
    lpPlanePoint3,
    lpRestrictSegment,
  ]);

  // Tạo điểm giao của 2 đoạn / đường thẳng
  const handleCreateSegmentIntersectionPoint = () => {
    const res = computeSegmentIntersection3D(
      allPointsMap[seg1PointA],
      allPointsMap[seg1PointB],
      allPointsMap[seg2PointA],
      allPointsMap[seg2PointB],
      intersectSegExtend
    );

    if (!res.ok || !res.point) {
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    const name =
      intersectSegLabel.trim() ||
      getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_segments);
    const n1 = allPointsMap[seg1PointA]?.name || seg1PointA;
    const n2 = allPointsMap[seg1PointB]?.name || seg1PointB;
    const n3 = allPointsMap[seg2PointA]?.name || seg2PointA;
    const n4 = allPointsMap[seg2PointB]?.name || seg2PointB;

    const newPoint: Point3D = {
      name,
      x: res.point.x,
      y: res.point.y,
      z: res.point.z,
      label: `${name} (${n1}${n2} ∩ ${n3}${n4})`,
      color: intersectSegColor || '#8b5cf6',
      isCustom: true,
    };

    setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);

    // Tùy chọn tự vẽ nét đứt nối từ đầu mút gần hơn tới giao điểm nếu nằm trên phần kéo dài
    if (intersectSegDrawExt && res.t !== undefined && res.s !== undefined) {
      const extLines: Line3D[] = [];
      if (res.t < -0.02) {
        extLines.push({
          id: `line_ext1_${Date.now()}`,
          type: 'segment',
          p1: seg1PointA,
          p2: name,
          style: 'dashed',
          color: intersectSegColor || '#8b5cf6',
          label: `${n1}${name}`,
        });
      } else if (res.t > 1.02) {
        extLines.push({
          id: `line_ext1_${Date.now()}`,
          type: 'segment',
          p1: seg1PointB,
          p2: name,
          style: 'dashed',
          color: intersectSegColor || '#8b5cf6',
          label: `${n2}${name}`,
        });
      }
      if (res.s < -0.02) {
        extLines.push({
          id: `line_ext2_${Date.now() + 1}`,
          type: 'segment',
          p1: seg2PointA,
          p2: name,
          style: 'dashed',
          color: intersectSegColor || '#8b5cf6',
          label: `${n3}${name}`,
        });
      } else if (res.s > 1.02) {
        extLines.push({
          id: `line_ext2_${Date.now() + 1}`,
          type: 'segment',
          p1: seg2PointB,
          p2: name,
          style: 'dashed',
          color: intersectSegColor || '#8b5cf6',
          label: `${n4}${name}`,
        });
      }
      if (extLines.length > 0) {
        setCustomLines((prev) => [...prev, ...extLines]);
      }
    }

    setSelectedPointName(name);
    setStatusMessage(`Đã tạo giao điểm [${name}] = ${n1}${n2} ∩ ${n3}${n4} tại (${res.point.x}, ${res.point.y}, ${res.point.z})!`);
    setTimeout(() => setStatusMessage(null), 4000);

    const nextName = getNextFreePointName(
      [...allUsedPointTokens, name],
      POINT_NAME_PREFERENCES.intersect_segments
    );
    setIntersectSegLabel(nextName);
  };

  // Tạo điểm giao của 1 đường thẳng với 1 mặt phẳng
  const handleCreateLinePlaneIntersectionPoint = () => {
    const res = computeLinePlaneIntersection3D(
      allPointsMap[lpLinePointA],
      allPointsMap[lpLinePointB],
      allPointsMap[lpPlanePoint1],
      allPointsMap[lpPlanePoint2],
      allPointsMap[lpPlanePoint3],
      lpRestrictSegment
    );

    if (!res.ok || !res.point) {
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    const name =
      intersectLPLabel.trim() ||
      getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_line_plane);
    const lA = allPointsMap[lpLinePointA]?.name || lpLinePointA;
    const lB = allPointsMap[lpLinePointB]?.name || lpLinePointB;
    const p1N = allPointsMap[lpPlanePoint1]?.name || lpPlanePoint1;
    const p2N = allPointsMap[lpPlanePoint2]?.name || lpPlanePoint2;
    const p3N = allPointsMap[lpPlanePoint3]?.name || lpPlanePoint3;

    const newPoint: Point3D = {
      name,
      x: res.point.x,
      y: res.point.y,
      z: res.point.z,
      label: `${name} (${lA}${lB} ∩ (${p1N}${p2N}${p3N}))`,
      color: intersectLPColor || '#e11d48',
      isCustom: true,
    };

    setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);

    if (lpDrawExtension && res.t !== undefined && (res.t < -0.02 || res.t > 1.02)) {
      const anchorPt = res.t < -0.02 ? lpLinePointA : lpLinePointB;
      const anchorName = allPointsMap[anchorPt]?.name || anchorPt;
      setCustomLines((prev) => [
        ...prev,
        {
          id: `line_lp_ext_${Date.now()}`,
          type: 'segment',
          p1: anchorPt,
          p2: name,
          style: 'dashed',
          color: intersectLPColor || '#e11d48',
          label: `${anchorName}${name}`,
        },
      ]);
    }

    setSelectedPointName(name);
    setStatusMessage(
      `Đã tạo giao điểm [${name}] = ${lA}${lB} ∩ (${p1N}${p2N}${p3N}) tại (${res.point.x}, ${res.point.y}, ${res.point.z})!`
    );
    setTimeout(() => setStatusMessage(null), 4000);

    const nextName = getNextFreePointName(
      [...allUsedPointTokens, name],
      POINT_NAME_PREFERENCES.intersect_line_plane
    );
    setIntersectLPLabel(nextName);
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
        // Do d = +V_camera (hướng về mắt người xem), t càng lớn nghĩa là mặt nằm ở phía trước gần camera nhất
        if (hit && (!bestFaceHit || hit.t > bestFaceHit.t)) {
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
    const name =
      manualPointName.trim() || getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual);
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

    const nextName = getNextFreePointName([...allUsedPointTokens, name], POINT_NAME_PREFERENCES.manual);
    setManualPointName(nextName);
  };

  // ==========================================
  // 2. MỤC: TẠO ĐƯỜNG (Đoạn thẳng, Đường thẳng, Tia, Đường vuông góc)
  // ==========================================
  const handleCreateLine = () => {
    if (lineCreationMode === 'perpendicular') {
      const p1 = allPointsMap[linePointA];
      if (!p1) {
        setStatusMessage('Vui lòng chọn điểm cần hạ đường vuông góc xuống đáy!');
        return;
      }

      const dispA = p1.name || linePointA;
      const footName = getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.perpendicular);
      const footPoint: Point3D = {
        name: footName,
        x: p1.x,
        y: 0,
        z: p1.z,
        label: `${footName} (Hình chiếu ${dispA})`,
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
        label: `${dispA}${footName} ⊥ Đáy`,
        footPointName: footName,
      };

      setCustomLines((prev) => [...prev, newLine]);
      setStatusMessage(`Đã hạ đường cao vuông góc ${dispA}${footName} ⊥ đáy!`);
      setTimeout(() => setStatusMessage(null), 3500);
      return;
    }

    if (!linePointA || !linePointB || linePointA === linePointB) {
      setStatusMessage('Vui lòng chọn 2 điểm khác nhau để tạo đường!');
      return;
    }

    const dispA = allPointsMap[linePointA]?.name || linePointA;
    const dispB = allPointsMap[linePointB]?.name || linePointB;

    const newLine: Line3D = {
      id: 'line_' + Date.now(),
      type: lineCreationMode,
      p1: linePointA,
      p2: linePointB,
      style: lineStyle,
      color: lineColor,
      label: `${dispA}${dispB}`,
    };

    setCustomLines((prev) => [...prev, newLine]);
    const typeLabel =
      lineCreationMode === 'segment' ? 'Đoạn thẳng' : lineCreationMode === 'line' ? 'Đường thẳng' : 'Tia';
    setStatusMessage(`Đã vẽ ${typeLabel} [${dispA} - ${dispB}] thành công!`);
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

    const dispPts = pts.map((k) => allPointsMap[k]?.name || k);
    const planeName = `(${dispPts.join('')})`;
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
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        if (onExportImage) {
          onExportImage(pngUrl, getShapeTitle(selectedShape, quadBaseType));
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
              <span className="text-[10px] text-slate-500 font-normal">
                S.ABCD ({QUAD_BASE_META[quadBaseType].label})
              </span>
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

          {selectedShape === 'pyramid_quad' && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-700">
                <span>Chọn Dạng Đáy Chóp S.ABCD:</span>
                <span className="text-[10px] font-semibold text-blue-700">
                  {QUAD_BASE_META[quadBaseType].shortDesc}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['parallelogram', 'trapezoid', 'quadrilateral'] as const).map((bType) => (
                  <button
                    key={bType}
                    type="button"
                    onClick={() => handleSelectQuadBase(bType)}
                    className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                      quadBaseType === bType
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {QUAD_BASE_META[bType].label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 font-bold text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setPointCreationMode('ratio')}
                  className={`col-span-2 py-1.5 px-1 rounded-lg transition-all ${
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
                  className={`col-span-2 py-1.5 px-1 rounded-lg transition-all ${
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
                  className={`col-span-2 py-1.5 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    pointCreationMode === 'manual'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MousePointerClick size={12} className="text-emerald-600 shrink-0" />
                  <span>Điểm Tự Do</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPointCreationMode('intersect_segments')}
                  className={`col-span-3 py-1.5 px-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    pointCreationMode === 'intersect_segments'
                      ? 'bg-white text-violet-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Crosshair size={12} className="text-violet-600 shrink-0" />
                  <span>Giao 2 Đoạn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPointCreationMode('intersect_line_plane')}
                  className={`col-span-3 py-1.5 px-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    pointCreationMode === 'intersect_line_plane'
                      ? 'bg-white text-rose-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Target size={12} className="text-rose-600 shrink-0" />
                  <span>Giao Đường & Mặt Phẳng</span>
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
                            {allPointsMap[n]?.name || n}
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
                            {allPointsMap[n]?.name || n}
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
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          setRatioPointLabel(getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.ratio));
                        }
                      }}
                      placeholder={getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.ratio)}
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
                          {allPointsMap[n]?.name || n}
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
                          {allPointsMap[n]?.name || n}
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
                          {allPointsMap[n]?.name || n}
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
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          setCentroidLabel(getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.centroid));
                        }
                      }}
                      placeholder={getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.centroid)}
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

              {/* Sub-tab 2b: Giao điểm của 2 đoạn thẳng */}
              {pointCreationMode === 'intersect_segments' && (
                <div className="p-3.5 rounded-2xl bg-violet-50/70 border border-violet-200 space-y-3">
                  <span className="text-[10.5px] font-bold text-violet-900 block">
                    Tìm Giao Điểm Của 2 Đoạn Thẳng Trong Không Gian:
                  </span>

                  {/* Đoạn 1 */}
                  <div className="p-2.5 rounded-xl bg-white/80 border border-violet-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold text-violet-800">Đoạn 1:</span>
                      <select
                        value=""
                        onChange={(e) => {
                          const found = availableSegmentOptions.find((o) => o.key === e.target.value);
                          if (found) {
                            setSeg1PointA(found.p1);
                            setSeg1PointB(found.p2);
                          }
                        }}
                        className="h-6 px-1.5 rounded-lg border border-violet-200 bg-violet-50 text-[10px] font-semibold text-violet-800 max-w-[155px]"
                      >
                        <option value="">Chọn nhanh cạnh/đoạn...</option>
                        {availableSegmentOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={seg1PointA}
                        onChange={(e) => setSeg1PointA(e.target.value)}
                        className="h-8 px-2 rounded-xl border border-violet-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={seg1PointB}
                        onChange={(e) => setSeg1PointB(e.target.value)}
                        className="h-8 px-2 rounded-xl border border-violet-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Đoạn 2 */}
                  <div className="p-2.5 rounded-xl bg-white/80 border border-violet-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold text-violet-800">Đoạn 2:</span>
                      <select
                        value=""
                        onChange={(e) => {
                          const found = availableSegmentOptions.find((o) => o.key === e.target.value);
                          if (found) {
                            setSeg2PointA(found.p1);
                            setSeg2PointB(found.p2);
                          }
                        }}
                        className="h-6 px-1.5 rounded-lg border border-violet-200 bg-violet-50 text-[10px] font-semibold text-violet-800 max-w-[155px]"
                      >
                        <option value="">Chọn nhanh cạnh/đoạn...</option>
                        {availableSegmentOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={seg2PointA}
                        onChange={(e) => setSeg2PointA(e.target.value)}
                        className="h-8 px-2 rounded-xl border border-violet-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={seg2PointB}
                        onChange={(e) => setSeg2PointB(e.target.value)}
                        className="h-8 px-2 rounded-xl border border-violet-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tùy chọn mở rộng */}
                  <div className="space-y-1.5 text-[10.5px] font-semibold text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={intersectSegExtend}
                        onChange={(e) => setIntersectSegExtend(e.target.checked)}
                        className="rounded text-violet-600 focus:ring-violet-500"
                      />
                      <span>Cho phép cắt trên phần kéo dài (đường thẳng)</span>
                    </label>
                    {intersectSegExtend && (
                      <label className="flex items-center gap-2 cursor-pointer pl-5 text-[10px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={intersectSegDrawExt}
                          onChange={(e) => setIntersectSegDrawExt(e.target.checked)}
                          className="rounded text-violet-600 focus:ring-violet-500"
                        />
                        <span>Tự động vẽ nét đứt nối tới giao điểm</span>
                      </label>
                    )}
                  </div>

                  {/* Xem trước kết quả tính toán */}
                  {segIntersectPreview && (
                    <div
                      className={`px-2.5 py-2 rounded-xl text-[10.5px] font-bold border ${
                        segIntersectPreview.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {segIntersectPreview.message}
                    </div>
                  )}

                  {/* Tên điểm, màu & nút tạo */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">Tên:</span>
                    <input
                      type="text"
                      value={intersectSegLabel}
                      onChange={(e) => setIntersectSegLabel(e.target.value.toUpperCase())}
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          setIntersectSegLabel(
                            getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_segments)
                          );
                        }
                      }}
                      placeholder={getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_segments)}
                      maxLength={4}
                      className="w-14 h-8 px-2 rounded-xl border border-violet-300 font-bold text-center text-xs bg-white text-slate-900"
                    />
                    <input
                      type="color"
                      value={intersectSegColor}
                      onChange={(e) => setIntersectSegColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer border border-violet-300 bg-transparent shrink-0"
                    />
                    <button
                      type="button"
                      onClick={handleCreateSegmentIntersectionPoint}
                      className="flex-1 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Tạo Giao Điểm</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tab 2c: Giao điểm của 1 đường thẳng với 1 mặt phẳng */}
              {pointCreationMode === 'intersect_line_plane' && (
                <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                  <span className="text-[10.5px] font-bold text-rose-900 block">
                    Tìm Giao Điểm Của Đường Thẳng (d) Và Mặt Phẳng (P):
                  </span>

                  {/* Đường thẳng (d) */}
                  <div className="p-2.5 rounded-xl bg-white/80 border border-rose-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold text-rose-800">Đường thẳng (đi qua 2 điểm):</span>
                      <select
                        value=""
                        onChange={(e) => {
                          const found = availableSegmentOptions.find((o) => o.key === e.target.value);
                          if (found) {
                            setLpLinePointA(found.p1);
                            setLpLinePointB(found.p2);
                          }
                        }}
                        className="h-6 px-1.5 rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-800 max-w-[145px]"
                      >
                        <option value="">Chọn nhanh đường...</option>
                        {availableSegmentOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={lpLinePointA}
                        onChange={(e) => setLpLinePointA(e.target.value)}
                        className="h-8 px-2 rounded-xl border border-rose-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={lpLinePointB}
                        onChange={(e) => setLpLinePointB(e.target.value)}
                        className="h-8 px-2 rounded-xl border border-rose-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mặt phẳng (P) */}
                  <div className="p-2.5 rounded-xl bg-white/80 border border-rose-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold text-rose-800">Mặt phẳng (qua 3 điểm):</span>
                      {customPlanes.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const pl = customPlanes.find((p) => p.id === e.target.value);
                            if (pl && pl.pointNames.length >= 3) {
                              setLpPlanePoint1(pl.pointNames[0]);
                              setLpPlanePoint2(pl.pointNames[1]);
                              setLpPlanePoint3(pl.pointNames[2]);
                            }
                          }}
                          className="h-6 px-1.5 rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-800 max-w-[140px]"
                        >
                          <option value="">Lấy từ mặt đã tạo...</option>
                          {customPlanes.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              Mặt {pl.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <select
                        value={lpPlanePoint1}
                        onChange={(e) => setLpPlanePoint1(e.target.value)}
                        className="h-8 px-1.5 rounded-xl border border-rose-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={lpPlanePoint2}
                        onChange={(e) => setLpPlanePoint2(e.target.value)}
                        className="h-8 px-1.5 rounded-xl border border-rose-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={lpPlanePoint3}
                        onChange={(e) => setLpPlanePoint3(e.target.value)}
                        className="h-8 px-1.5 rounded-xl border border-rose-300 font-bold text-xs bg-white text-slate-800"
                      >
                        {allPointNames.map((n) => (
                          <option key={n} value={n}>
                            {allPointsMap[n]?.name || n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tùy chọn đoạn / kéo dài */}
                  <div className="space-y-1.5 text-[10.5px] font-semibold text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lpRestrictSegment}
                        onChange={(e) => setLpRestrictSegment(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>Chỉ lấy giao điểm nằm trong đoạn thẳng</span>
                    </label>
                    {!lpRestrictSegment && (
                      <label className="flex items-center gap-2 cursor-pointer pl-5 text-[10px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={lpDrawExtension}
                          onChange={(e) => setLpDrawExtension(e.target.checked)}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span>Tự động vẽ nét đứt nối tới giao điểm</span>
                      </label>
                    )}
                  </div>

                  {/* Xem trước kết quả tính toán */}
                  {linePlaneIntersectPreview && (
                    <div
                      className={`px-2.5 py-2 rounded-xl text-[10.5px] font-bold border ${
                        linePlaneIntersectPreview.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {linePlaneIntersectPreview.message}
                    </div>
                  )}

                  {/* Tên điểm, màu & nút tạo */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">Tên:</span>
                    <input
                      type="text"
                      value={intersectLPLabel}
                      onChange={(e) => setIntersectLPLabel(e.target.value.toUpperCase())}
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          setIntersectLPLabel(
                            getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_line_plane)
                          );
                        }
                      }}
                      placeholder={getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_line_plane)}
                      maxLength={4}
                      className="w-14 h-8 px-2 rounded-xl border border-rose-300 font-bold text-center text-xs bg-white text-slate-900"
                    />
                    <input
                      type="color"
                      value={intersectLPColor}
                      onChange={(e) => setIntersectLPColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer border border-rose-300 bg-transparent shrink-0"
                    />
                    <button
                      type="button"
                      onClick={handleCreateLinePlaneIntersectionPoint}
                      className="flex-1 h-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Tạo Giao Điểm</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Tạo điểm tự do bằng con trỏ ấn trực tiếp vào hình */}
              {pointCreationMode === 'manual' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
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
                        onBlur={(e) => {
                          if (!e.target.value.trim()) {
                            setManualPointName(
                              getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual)
                            );
                          }
                        }}
                        placeholder={getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual)}
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
                          const name =
                            manualPointName.trim() ||
                            getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual);
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
                          const nextName = getNextFreePointName(
                            [...allUsedPointTokens, name],
                            POINT_NAME_PREFERENCES.manual
                          );
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
                          {allPointsMap[n]?.name || n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    {lineCreationMode === 'perpendicular' ? (
                      <>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Chiếu Vuông Góc Xuống:</label>
                        <div className="w-full h-8 px-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 font-bold text-[11px] flex items-center">
                          Mặt phẳng đáy (y = 0)
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Điểm 2:</label>
                        <select
                          value={linePointB}
                          onChange={(e) => setLinePointB(e.target.value)}
                          className="w-full h-8 px-2 rounded-xl border border-purple-300 font-bold text-xs bg-white text-slate-800"
                        >
                          {allPointNames.map((n) => (
                            <option key={n} value={n}>
                              {allPointsMap[n]?.name || n}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
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
                          {allPointsMap[n]?.name || n}
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
                          {allPointsMap[n]?.name || n}
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
                          {allPointsMap[n]?.name || n}
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
                      Điểm {allPointsMap[n]?.name || n} ({allPointsMap[n]?.x}, {allPointsMap[n]?.y}, {allPointsMap[n]?.z})
                    </option>
                  ))}
                </select>

                {selectedPointName && allPointsMap[selectedPointName] && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                      <span>Điểm: [{allPointsMap[selectedPointName]?.name || selectedPointName}]</span>
                      <button
                        type="button"
                        onClick={() => {
                          const def = initDefaultVertices(
                            selectedShape,
                            heightParam,
                            radiusParam,
                            quadBaseType
                          )[selectedPointName];
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
              <span>Chiều cao hình h:</span>
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
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-100/95 p-1.5 rounded-2xl border border-slate-200 z-20 text-xs shadow-xs">
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

        {isFreePointMode ? (
          <div className="w-full max-w-[500px] mb-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px] font-bold flex items-center justify-between shadow-2xs animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>
                Chế độ tạo điểm: Nhấp vào hình để đặt [
                {manualPointName.trim() || getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual)}]
              </span>
            </span>
          </div>
        ) : selectedPointName ? (
          <div className="w-full max-w-[500px] mb-2 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold flex items-center justify-end">
            <span>Đang chọn điểm [{allPointsMap[selectedPointName]?.name || selectedPointName}]</span>
          </div>
        ) : null}

        {/* Canvas SVG 3D Container */}
        <div className="w-full max-w-[520px] aspect-5/4 relative flex items-center justify-center select-none overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-white shadow-inner">
          <svg
            id="geometry-3d-studio-svg"
            viewBox="0 0 500 400"
            className={`w-full h-full ${isFreePointMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setHover3DPoint(null)}
            onMouseUp={handleSvgMouseUp}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startY = e.clientY;
              const initialRotY = rotY;
              const initialRotX = rotX;
              let hasMoved = false;

              const onMouseMove = (moveEvent: MouseEvent) => {
                if (dragStartRef.current) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                if (Math.hypot(dx, dy) > 5) {
                  hasMoved = true;
                }
                setRotY(initialRotY + dx * 0.7);
                setRotX(Math.max(-45, Math.min(60, initialRotX - dy * 0.5)));
              };

              const onMouseUp = (upEvent: MouseEvent) => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);

                // Nếu là nhấp chuột (không xoay) và đang ở chế độ Tạo Điểm Tự Do
                if (!hasMoved && !dragStartRef.current && isFreePointMode) {
                  const svgEl = document.getElementById('geometry-3d-studio-svg');
                  if (svgEl) {
                    const rect = svgEl.getBoundingClientRect();
                    const svgX = ((upEvent.clientX - rect.left) / rect.width) * 500;
                    const svgY = ((upEvent.clientY - rect.top) / rect.height) * 400;
                    if (svgX >= 0 && svgX <= 500 && svgY >= 0 && svgY <= 400) {
                      const calculated = calculate3DPointFromScreen(svgX, svgY);
                      const name =
                        manualPointName.trim() ||
                        getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual);
                      const newPoint: Point3D = {
                        name,
                        x: calculated.x,
                        y: calculated.y,
                        z: calculated.z,
                        label: `${name} (${calculated.surfaceName})`,
                        color: manualPointColor || '#10b981',
                        isCustom: true,
                      };
                      setCustomPoints((prev) => [...prev.filter((p) => p.name !== name), newPoint]);
                      setSelectedPointName(name);
                      setStatusMessage(`Đã tạo điểm tự do [${name}] trực tiếp trên ${calculated.surfaceName} tại tọa độ (${calculated.x}, ${calculated.y}, ${calculated.z})!`);
                      setTimeout(() => setStatusMessage(null), 3500);

                      const nextName = getNextFreePointName(
                        [...allUsedPointTokens, name],
                        POINT_NAME_PREFERENCES.manual
                      );
                      setManualPointName(nextName);
                    }
                  }
                }
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
            {/* 1. HÌNH CHÓP TỨ GIÁC S.ABCD (ĐÁY HBH / HÌNH THANG / TỨ GIÁC) */}
            {/* ========================================================= */}
            {selectedShape === 'pyramid_quad' && (() => {
              const S_pt = vertexCoords.S || { x: 0, y: heightParam, z: 0 };
              const A_pt = vertexCoords.A || { x: -90, y: 0, z: 70 };
              const B_pt = vertexCoords.B || { x: 90, y: 0, z: 70 };
              const C_pt = vertexCoords.C || { x: 110, y: 0, z: -70 };
              const D_pt = vertexCoords.D || { x: -70, y: 0, z: -70 };

              const verts3D = { S: S_pt, A: A_pt, B: B_pt, C: C_pt, D: D_pt };
              const faces = [
                { keys: ['S', 'A', 'B'] },
                { keys: ['S', 'B', 'C'] },
                { keys: ['S', 'C', 'D'] },
                { keys: ['S', 'D', 'A'] },
                { keys: ['A', 'B', 'C', 'D'] },
              ];
              const faceFront = computePolyhedronVisibility(verts3D, faces);
              const edges: { a: keyof typeof verts3D; b: keyof typeof verts3D; f1: number; f2: number }[] = [
                { a: 'A', b: 'B', f1: 0, f2: 4 },
                { a: 'B', b: 'C', f1: 1, f2: 4 },
                { a: 'C', b: 'D', f1: 2, f2: 4 },
                { a: 'D', b: 'A', f1: 3, f2: 4 },
                { a: 'S', b: 'A', f1: 0, f2: 3 },
                { a: 'S', b: 'B', f1: 0, f2: 1 },
                { a: 'S', b: 'C', f1: 1, f2: 2 },
                { a: 'S', b: 'D', f1: 2, f2: 3 },
              ];

              const proj = {
                S: project3D(S_pt.x, S_pt.y, S_pt.z),
                A: project3D(A_pt.x, A_pt.y, A_pt.z),
                B: project3D(B_pt.x, B_pt.y, B_pt.z),
                C: project3D(C_pt.x, C_pt.y, C_pt.z),
                D: project3D(D_pt.x, D_pt.y, D_pt.z),
              };
              const center2D = {
                x: (proj.S.x + proj.A.x + proj.B.x + proj.C.x + proj.D.x) / 5,
                y: (proj.S.y + proj.A.y + proj.B.y + proj.C.y + proj.D.y) / 5,
              };

              const hiddenEdges = edges.filter((e) => !(faceFront[e.f1] || faceFront[e.f2]));
              const visibleEdges = edges.filter((e) => faceFront[e.f1] || faceFront[e.f2]);

              return (
                <g className="font-bold text-xs select-none">
                  {/* Mặt đáy tô bóng nhẹ */}
                  {showShading && (
                    <polygon
                      points={`${proj.A.x},${proj.A.y} ${proj.B.x},${proj.B.y} ${proj.C.x},${proj.C.y} ${proj.D.x},${proj.D.y}`}
                      fill="url(#pyramidFaceGradient)"
                    />
                  )}

                  {/* Các mặt bên nhìn thấy tô bóng nhẹ */}
                  {showShading &&
                    [0, 1, 2, 3].map((fIdx) =>
                      faceFront[fIdx] ? (
                        <polygon
                          key={fIdx}
                          points={faces[fIdx].keys
                            .map((k) => {
                              const p = proj[k as keyof typeof proj];
                              return `${p.x},${p.y}`;
                            })
                            .join(' ')}
                          fill="rgba(59, 130, 246, 0.05)"
                        />
                      ) : null
                    )}

                  {/* Cạnh khuất nét đứt động theo góc xoay */}
                  {showHiddenLines &&
                    hiddenEdges.map((e) => {
                      const p1 = proj[e.a];
                      const p2 = proj[e.b];
                      return (
                        <line
                          key={`${e.a}-${e.b}`}
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#64748b"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      );
                    })}

                  {/* Cạnh thấy được nét liền */}
                  {visibleEdges.map((e) => {
                    const p1 = proj[e.a];
                    const p2 = proj[e.b];
                    return (
                      <line
                        key={`${e.a}-${e.b}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#1e293b"
                        strokeWidth="1.8"
                      />
                    );
                  })}

                  {/* Nhãn và đỉnh gốc: S, A, B, C, D */}
                  {(['S', 'A', 'B', 'C', 'D'] as const).map((keyName) => {
                    const pt = proj[keyName];
                    const vx = pt.x - center2D.x;
                    const vy = pt.y - center2D.y;
                    const len = Math.hypot(vx, vy) || 1;
                    const dx = (vx / len) * 14;
                    const dy = (vy / len) * 14 + 3;
                    return (
                      <g
                        key={keyName}
                        onMouseDown={(e) => handlePointMouseDown(keyName, e)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={selectedPointName === keyName ? 5 : 3.5}
                          fill={selectedPointName === keyName ? '#f59e0b' : '#2563eb'}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text x={pt.x + dx} y={pt.y + dy} textAnchor="middle" fill="#0f172a" fontSize="11">
                          {keyName}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 2. HÌNH CHÓP TAM GIÁC S.ABC (SẠCH, CHỈ CÓ S, A, B, C)     */}
            {/* ========================================================= */}
            {selectedShape === 'pyramid_tri' && (() => {
              const S_pt = vertexCoords.S || { x: 0, y: heightParam, z: 0 };
              const A_pt = vertexCoords.A || { x: -90, y: 0, z: 70 };
              const B_pt = vertexCoords.B || { x: 90, y: 0, z: 70 };
              const C_pt = vertexCoords.C || { x: 20, y: 0, z: -80 };

              const verts3D = { S: S_pt, A: A_pt, B: B_pt, C: C_pt };
              const faces = [
                { keys: ['S', 'A', 'B'] },
                { keys: ['S', 'B', 'C'] },
                { keys: ['S', 'C', 'A'] },
                { keys: ['A', 'B', 'C'] },
              ];
              const faceFront = computePolyhedronVisibility(verts3D, faces);
              const edges: { a: keyof typeof verts3D; b: keyof typeof verts3D; f1: number; f2: number }[] = [
                { a: 'A', b: 'B', f1: 0, f2: 3 },
                { a: 'B', b: 'C', f1: 1, f2: 3 },
                { a: 'C', b: 'A', f1: 2, f2: 3 },
                { a: 'S', b: 'A', f1: 0, f2: 2 },
                { a: 'S', b: 'B', f1: 0, f2: 1 },
                { a: 'S', b: 'C', f1: 1, f2: 2 },
              ];

              const proj = {
                S: project3D(S_pt.x, S_pt.y, S_pt.z),
                A: project3D(A_pt.x, A_pt.y, A_pt.z),
                B: project3D(B_pt.x, B_pt.y, B_pt.z),
                C: project3D(C_pt.x, C_pt.y, C_pt.z),
              };
              const center2D = {
                x: (proj.S.x + proj.A.x + proj.B.x + proj.C.x) / 4,
                y: (proj.S.y + proj.A.y + proj.B.y + proj.C.y) / 4,
              };

              const hiddenEdges = edges.filter((e) => !(faceFront[e.f1] || faceFront[e.f2]));
              const visibleEdges = edges.filter((e) => faceFront[e.f1] || faceFront[e.f2]);

              return (
                <g className="font-bold text-xs select-none">
                  {showShading && (
                    <polygon
                      points={`${proj.A.x},${proj.A.y} ${proj.B.x},${proj.B.y} ${proj.C.x},${proj.C.y}`}
                      fill="url(#pyramidFaceGradient)"
                    />
                  )}

                  {showHiddenLines &&
                    hiddenEdges.map((e) => {
                      const p1 = proj[e.a];
                      const p2 = proj[e.b];
                      return (
                        <line
                          key={`${e.a}-${e.b}`}
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#64748b"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      );
                    })}

                  {visibleEdges.map((e) => {
                    const p1 = proj[e.a];
                    const p2 = proj[e.b];
                    return (
                      <line
                        key={`${e.a}-${e.b}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#1e293b"
                        strokeWidth="1.8"
                      />
                    );
                  })}

                  {(['S', 'A', 'B', 'C'] as const).map((keyName) => {
                    const pt = proj[keyName];
                    const vx = pt.x - center2D.x;
                    const vy = pt.y - center2D.y;
                    const len = Math.hypot(vx, vy) || 1;
                    const dx = (vx / len) * 14;
                    const dy = (vy / len) * 14 + 3;
                    return (
                      <g
                        key={keyName}
                        onMouseDown={(e) => handlePointMouseDown(keyName, e)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={selectedPointName === keyName ? 5 : 3.5}
                          fill={selectedPointName === keyName ? '#f59e0b' : '#6366f1'}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text x={pt.x + dx} y={pt.y + dy} textAnchor="middle" fill="#0f172a" fontSize="11">
                          {keyName}
                        </text>
                      </g>
                    );
                  })}
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
              const A_pt = vertexCoords.A || { x: -r, y: 0, z: 0 };
              const B_pt = vertexCoords.B || { x: r, y: 0, z: 0 };

              const S = project3D(S_pt.x, S_pt.y, S_pt.z);
              const O = project3D(O_pt.x, O_pt.y, O_pt.z);
              const A_end = project3D(A_pt.x, A_pt.y, A_pt.z);
              const B_end = project3D(B_pt.x, B_pt.y, B_pt.z);

              const numSamples = 64;
              const radY = (rotY * Math.PI) / 180;
              const projectedCircle = Array.from({ length: numSamples }, (_, i) => {
                const angle = (2 * Math.PI * i) / numSamples;
                const orig = {
                  x: O_pt.x + r * Math.cos(angle),
                  y: O_pt.y,
                  z: O_pt.z + r * Math.sin(angle),
                };
                const p2d = project3D(orig.x, orig.y, orig.z);
                const z1 = -(orig.x - O_pt.x) * Math.sin(radY) + (orig.z - O_pt.z) * Math.cos(radY);
                return { ...p2d, orig, isFront: z1 >= 0 };
              });

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

              const frontPath = buildCircularArcPath(projectedCircle, true);
              const backPath = buildCircularArcPath(projectedCircle, false);
              const frontPoints = projectedCircle.filter((p) => p.isFront);

              return (
                <g className="font-bold text-xs select-none">
                  {showShading && frontPoints.length > 0 && (
                    <polygon
                      points={`${S.x},${S.y} ${leftPoint.x},${leftPoint.y} ${frontPoints.map((p) => `${p.x},${p.y}`).join(' ')} ${rightPoint.x},${rightPoint.y}`}
                      fill="url(#coneLateralGradient)"
                    />
                  )}

                  {showHiddenLines && backPath && (
                    <path
                      d={backPath}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  )}

                  {frontPath && (
                    <path
                      d={frontPath}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="2"
                    />
                  )}

                  <line x1={S.x} y1={S.y} x2={leftPoint.x} y2={leftPoint.y} stroke="#1e293b" strokeWidth="2" />
                  <line x1={S.x} y1={S.y} x2={rightPoint.x} y2={rightPoint.y} stroke="#1e293b" strokeWidth="2" />

                  {showHiddenLines && (
                    <>
                      <line x1={S.x} y1={S.y} x2={O.x} y2={O.y} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1={O.x} y1={O.y} x2={B_end.x} y2={B_end.y} stroke="#2563eb" strokeWidth="1.4" strokeDasharray="3 3" />
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

                  <text x={S.x + 8} y={(S.y + O.y) / 2} fill="#ef4444" fontSize="11" fontStyle="italic">
                    h
                  </text>
                  <text x={(O.x + B_end.x) / 2} y={O.y - 6} fill="#2563eb" fontSize="11" fontStyle="italic">
                    r
                  </text>

                  <g onMouseDown={(e) => handlePointMouseDown('S', e)} className="cursor-pointer">
                    <circle cx={S.x} cy={S.y} r={selectedPointName === 'S' ? 5 : 3.5} fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={S.x} y={S.y - 9} textAnchor="middle" fill="#0f172a" fontSize="11">
                      S
                    </text>
                  </g>

                  <g onMouseDown={(e) => handlePointMouseDown('O', e)} className="cursor-pointer">
                    <circle cx={O.x} cy={O.y} r={selectedPointName === 'O' ? 4.5 : 3} fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={O.x - 12} y={O.y + 4} fill="#ef4444" fontSize="11">
                      O
                    </text>
                  </g>

                  <g onMouseDown={(e) => handlePointMouseDown('A', e)} className="cursor-pointer">
                    <circle cx={A_end.x} cy={A_end.y} r={selectedPointName === 'A' ? 4.5 : 3} fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={A_end.x - 10} y={A_end.y + 12} fill="#0f172a" fontSize="10.5">
                      A
                    </text>
                  </g>

                  <g onMouseDown={(e) => handlePointMouseDown('B', e)} className="cursor-pointer">
                    <circle cx={B_end.x} cy={B_end.y} r={selectedPointName === 'B' ? 4.5 : 3} fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={B_end.x + 8} y={B_end.y + 12} fill="#0f172a" fontSize="10.5">
                      B
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 4. KHỐI LẬP PHƯƠNG                                        */}
            {/* ========================================================= */}
            {selectedShape === 'cube' && (() => {
              const s = 65;
              const hc = heightParam * 0.75;
              const verts3D = {
                A: vertexCoords.A || { x: -s, y: 0, z: s },
                B: vertexCoords.B || { x: s, y: 0, z: s },
                C: vertexCoords.C || { x: s, y: 0, z: -s },
                D: vertexCoords.D || { x: -s, y: 0, z: -s },
                A1: vertexCoords.A1 || { x: -s, y: hc, z: s },
                B1: vertexCoords.B1 || { x: s, y: hc, z: s },
                C1: vertexCoords.C1 || { x: s, y: hc, z: -s },
                D1: vertexCoords.D1 || { x: -s, y: hc, z: -s },
              };
              const faces = [
                { keys: ['A', 'B', 'C', 'D'] },       // 0: bottom
                { keys: ['A1', 'B1', 'C1', 'D1'] },   // 1: top
                { keys: ['A', 'B', 'B1', 'A1'] },     // 2: front
                { keys: ['B', 'C', 'C1', 'B1'] },     // 3: right
                { keys: ['C', 'D', 'D1', 'C1'] },     // 4: back
                { keys: ['D', 'A', 'A1', 'D1'] },     // 5: left
              ];
              const faceFront = computePolyhedronVisibility(verts3D, faces);
              const edges: { a: keyof typeof verts3D; b: keyof typeof verts3D; f1: number; f2: number }[] = [
                { a: 'A', b: 'B', f1: 0, f2: 2 },
                { a: 'B', b: 'C', f1: 0, f2: 3 },
                { a: 'C', b: 'D', f1: 0, f2: 4 },
                { a: 'D', b: 'A', f1: 0, f2: 5 },
                { a: 'A1', b: 'B1', f1: 1, f2: 2 },
                { a: 'B1', b: 'C1', f1: 1, f2: 3 },
                { a: 'C1', b: 'D1', f1: 1, f2: 4 },
                { a: 'D1', b: 'A1', f1: 1, f2: 5 },
                { a: 'A', b: 'A1', f1: 2, f2: 5 },
                { a: 'B', b: 'B1', f1: 2, f2: 3 },
                { a: 'C', b: 'C1', f1: 3, f2: 4 },
                { a: 'D', b: 'D1', f1: 4, f2: 5 },
              ];

              const proj = {
                A: project3D(verts3D.A.x, verts3D.A.y, verts3D.A.z),
                B: project3D(verts3D.B.x, verts3D.B.y, verts3D.B.z),
                C: project3D(verts3D.C.x, verts3D.C.y, verts3D.C.z),
                D: project3D(verts3D.D.x, verts3D.D.y, verts3D.D.z),
                A1: project3D(verts3D.A1.x, verts3D.A1.y, verts3D.A1.z),
                B1: project3D(verts3D.B1.x, verts3D.B1.y, verts3D.B1.z),
                C1: project3D(verts3D.C1.x, verts3D.C1.y, verts3D.C1.z),
                D1: project3D(verts3D.D1.x, verts3D.D1.y, verts3D.D1.z),
              };
              const center2D = {
                x: Object.values(proj).reduce((sum, p) => sum + p.x, 0) / 8,
                y: Object.values(proj).reduce((sum, p) => sum + p.y, 0) / 8,
              };

              const hiddenEdges = edges.filter((e) => !(faceFront[e.f1] || faceFront[e.f2]));
              const visibleEdges = edges.filter((e) => faceFront[e.f1] || faceFront[e.f2]);

              const cubeVertices: { keyName: keyof typeof proj; display: string }[] = [
                { keyName: 'A', display: 'A' },
                { keyName: 'B', display: 'B' },
                { keyName: 'C', display: 'C' },
                { keyName: 'D', display: 'D' },
                { keyName: 'A1', display: "A'" },
                { keyName: 'B1', display: "B'" },
                { keyName: 'C1', display: "C'" },
                { keyName: 'D1', display: "D'" },
              ];

              return (
                <g className="font-bold text-xs select-none">
                  {showShading && (
                    <polygon
                      points={`${proj.A1.x},${proj.A1.y} ${proj.B1.x},${proj.B1.y} ${proj.C1.x},${proj.C1.y} ${proj.D1.x},${proj.D1.y}`}
                      fill="rgba(59, 130, 246, 0.12)"
                    />
                  )}

                  {showHiddenLines &&
                    hiddenEdges.map((e) => {
                      const p1 = proj[e.a];
                      const p2 = proj[e.b];
                      return (
                        <line
                          key={`${e.a}-${e.b}`}
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#64748b"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      );
                    })}

                  {visibleEdges.map((e) => {
                    const p1 = proj[e.a];
                    const p2 = proj[e.b];
                    return (
                      <line
                        key={`${e.a}-${e.b}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#1e293b"
                        strokeWidth="1.8"
                      />
                    );
                  })}

                  {cubeVertices.map((item) => {
                    const pt = proj[item.keyName];
                    const vx = pt.x - center2D.x;
                    const vy = pt.y - center2D.y;
                    const len = Math.hypot(vx, vy) || 1;
                    const dx = (vx / len) * 13;
                    const dy = (vy / len) * 13 + 3;
                    return (
                      <g
                        key={item.keyName}
                        onMouseDown={(e) => handlePointMouseDown(item.keyName, e)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={selectedPointName === item.keyName ? 5 : 3}
                          fill={selectedPointName === item.keyName ? '#f59e0b' : '#2563eb'}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text x={pt.x + dx} y={pt.y + dy} textAnchor="middle" fill="#0f172a" fontSize="10">
                          {item.display}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 5. LĂNG TRỤ TAM GIÁC                                       */}
            {/* ========================================================= */}
            {selectedShape === 'prism' && (() => {
              const hp = heightParam * 0.8;
              const verts3D = {
                A: vertexCoords.A || { x: -80, y: 0, z: 50 },
                B: vertexCoords.B || { x: 80, y: 0, z: 50 },
                C: vertexCoords.C || { x: 10, y: 0, z: -60 },
                A1: vertexCoords.A1 || { x: -80, y: hp, z: 50 },
                B1: vertexCoords.B1 || { x: 80, y: hp, z: 50 },
                C1: vertexCoords.C1 || { x: 10, y: hp, z: -60 },
              };
              const faces = [
                { keys: ['A', 'B', 'C'] },
                { keys: ['A1', 'B1', 'C1'] },
                { keys: ['A', 'B', 'B1', 'A1'] },
                { keys: ['B', 'C', 'C1', 'B1'] },
                { keys: ['C', 'A', 'A1', 'C1'] },
              ];
              const faceFront = computePolyhedronVisibility(verts3D, faces);
              const edges: { a: keyof typeof verts3D; b: keyof typeof verts3D; f1: number; f2: number }[] = [
                { a: 'A', b: 'B', f1: 0, f2: 2 },
                { a: 'B', b: 'C', f1: 0, f2: 3 },
                { a: 'C', b: 'A', f1: 0, f2: 4 },
                { a: 'A1', b: 'B1', f1: 1, f2: 2 },
                { a: 'B1', b: 'C1', f1: 1, f2: 3 },
                { a: 'C1', b: 'A1', f1: 1, f2: 4 },
                { a: 'A', b: 'A1', f1: 2, f2: 4 },
                { a: 'B', b: 'B1', f1: 2, f2: 3 },
                { a: 'C', b: 'C1', f1: 3, f2: 4 },
              ];

              const proj = {
                A: project3D(verts3D.A.x, verts3D.A.y, verts3D.A.z),
                B: project3D(verts3D.B.x, verts3D.B.y, verts3D.B.z),
                C: project3D(verts3D.C.x, verts3D.C.y, verts3D.C.z),
                A1: project3D(verts3D.A1.x, verts3D.A1.y, verts3D.A1.z),
                B1: project3D(verts3D.B1.x, verts3D.B1.y, verts3D.B1.z),
                C1: project3D(verts3D.C1.x, verts3D.C1.y, verts3D.C1.z),
              };
              const center2D = {
                x: Object.values(proj).reduce((sum, p) => sum + p.x, 0) / 6,
                y: Object.values(proj).reduce((sum, p) => sum + p.y, 0) / 6,
              };

              const hiddenEdges = edges.filter((e) => !(faceFront[e.f1] || faceFront[e.f2]));
              const visibleEdges = edges.filter((e) => faceFront[e.f1] || faceFront[e.f2]);

              const prismVertices: { keyName: keyof typeof proj; display: string }[] = [
                { keyName: 'A', display: 'A' },
                { keyName: 'B', display: 'B' },
                { keyName: 'C', display: 'C' },
                { keyName: 'A1', display: "A'" },
                { keyName: 'B1', display: "B'" },
                { keyName: 'C1', display: "C'" },
              ];

              return (
                <g className="font-bold text-xs select-none">
                  {showShading && (
                    <polygon
                      points={`${proj.A1.x},${proj.A1.y} ${proj.B1.x},${proj.B1.y} ${proj.C1.x},${proj.C1.y}`}
                      fill="rgba(59, 130, 246, 0.12)"
                    />
                  )}

                  {showHiddenLines &&
                    hiddenEdges.map((e) => {
                      const p1 = proj[e.a];
                      const p2 = proj[e.b];
                      return (
                        <line
                          key={`${e.a}-${e.b}`}
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#64748b"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      );
                    })}

                  {visibleEdges.map((e) => {
                    const p1 = proj[e.a];
                    const p2 = proj[e.b];
                    return (
                      <line
                        key={`${e.a}-${e.b}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#1e293b"
                        strokeWidth="1.8"
                      />
                    );
                  })}

                  {prismVertices.map((item) => {
                    const pt = proj[item.keyName];
                    const vx = pt.x - center2D.x;
                    const vy = pt.y - center2D.y;
                    const len = Math.hypot(vx, vy) || 1;
                    const dx = (vx / len) * 13;
                    const dy = (vy / len) * 13 + 3;
                    return (
                      <g
                        key={item.keyName}
                        onMouseDown={(e) => handlePointMouseDown(item.keyName, e)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={selectedPointName === item.keyName ? 5 : 3}
                          fill={selectedPointName === item.keyName ? '#f59e0b' : '#2563eb'}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text x={pt.x + dx} y={pt.y + dy} textAnchor="middle" fill="#0f172a" fontSize="10">
                          {item.display}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* ========================================================= */}
            {/* 6. KHỐI TRỤ TRÒN XOAY                                     */}
            {/* ========================================================= */}
            {selectedShape === 'cylinder' && (() => {
              const h = heightParam * 0.8;
              const r = radiusParam;
              const O2_pt = vertexCoords.O || { x: 0, y: 0, z: 0 };
              const O1_pt = vertexCoords.O1 || { x: 0, y: h, z: 0 };
              const A2_pt = vertexCoords.A || { x: -r, y: 0, z: 0 };
              const B2_pt = vertexCoords.B || { x: r, y: 0, z: 0 };
              const A1_pt = vertexCoords.A1 || { x: -r, y: h, z: 0 };
              const B1_pt = vertexCoords.B1 || { x: r, y: h, z: 0 };

              const O1 = project3D(O1_pt.x, O1_pt.y, O1_pt.z);
              const O2 = project3D(O2_pt.x, O2_pt.y, O2_pt.z);
              const A1 = project3D(A1_pt.x, A1_pt.y, A1_pt.z);
              const B1 = project3D(B1_pt.x, B1_pt.y, B1_pt.z);
              const A2 = project3D(A2_pt.x, A2_pt.y, A2_pt.z);
              const B2 = project3D(B2_pt.x, B2_pt.y, B2_pt.z);

              const numSamples = 64;
              const radY = (rotY * Math.PI) / 180;
              const topSamples = Array.from({ length: numSamples }, (_, i) => {
                const ang = (2 * Math.PI * i) / numSamples;
                const ox = O1_pt.x + r * Math.cos(ang);
                const oz = O1_pt.z + r * Math.sin(ang);
                const p = project3D(ox, O1_pt.y, oz);
                const z1 = -(ox - O1_pt.x) * Math.sin(radY) + (oz - O1_pt.z) * Math.cos(radY);
                return { ...p, isFront: z1 >= 0 };
              });
              const botSamples = Array.from({ length: numSamples }, (_, i) => {
                const ang = (2 * Math.PI * i) / numSamples;
                const ox = O2_pt.x + r * Math.cos(ang);
                const oz = O2_pt.z + r * Math.sin(ang);
                const p = project3D(ox, O2_pt.y, oz);
                const z1 = -(ox - O2_pt.x) * Math.sin(radY) + (oz - O2_pt.z) * Math.cos(radY);
                return { ...p, isFront: z1 >= 0 };
              });

              // Hai đường sinh biên theo góc nhìn hiện tại
              let minIdx = 0;
              let maxIdx = 0;
              botSamples.forEach((p, idx) => {
                if (p.x < botSamples[minIdx].x) minIdx = idx;
                if (p.x > botSamples[maxIdx].x) maxIdx = idx;
              });
              const leftTop = topSamples[minIdx];
              const leftBot = botSamples[minIdx];
              const rightTop = topSamples[maxIdx];
              const rightBot = botSamples[maxIdx];

              const botFrontPath = buildCircularArcPath(botSamples, true);
              const botBackPath = buildCircularArcPath(botSamples, false);

              return (
                <g className="font-bold text-xs select-none">
                  {showShading && (
                    <polygon
                      points={topSamples.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
                      fill="rgba(59, 130, 246, 0.14)"
                    />
                  )}

                  {/* Đáy trên luôn nhìn thấy từ trên xuống (hoặc vẽ viền kín) */}
                  <polygon
                    points={topSamples.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1.8"
                  />

                  {/* Đáy dưới: nửa sau nét đứt, nửa trước nét liền */}
                  {showHiddenLines && botBackPath && (
                    <path d={botBackPath} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
                  )}
                  {botFrontPath && (
                    <path d={botFrontPath} fill="none" stroke="#1e293b" strokeWidth="1.8" />
                  )}

                  {/* Hai đường sinh ngoài biên */}
                  <line x1={leftTop.x} y1={leftTop.y} x2={leftBot.x} y2={leftBot.y} stroke="#1e293b" strokeWidth="1.8" />
                  <line x1={rightTop.x} y1={rightTop.y} x2={rightBot.x} y2={rightBot.y} stroke="#1e293b" strokeWidth="1.8" />

                  {showHiddenLines && (
                    <line x1={O1.x} y1={O1.y} x2={O2.x} y2={O2.y} stroke="#ef4444" strokeWidth="1.4" strokeDasharray="4 3" />
                  )}

                  {[
                    { keyName: 'O1', pt: O1, display: "O'", color: '#ef4444', dx: 8, dy: -4 },
                    { keyName: 'O', pt: O2, display: 'O', color: '#ef4444', dx: 8, dy: 12 },
                    { keyName: 'A1', pt: A1, display: "A'", color: '#2563eb', dx: -11, dy: -4 },
                    { keyName: 'B1', pt: B1, display: "B'", color: '#2563eb', dx: 10, dy: -4 },
                    { keyName: 'A', pt: A2, display: 'A', color: '#2563eb', dx: -11, dy: 10 },
                    { keyName: 'B', pt: B2, display: 'B', color: '#2563eb', dx: 10, dy: 10 },
                  ].map((item) => (
                    <g
                      key={item.keyName}
                      onMouseDown={(e) => handlePointMouseDown(item.keyName, e)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={item.pt.x}
                        cy={item.pt.y}
                        r={selectedPointName === item.keyName ? 4.5 : 2.8}
                        fill={selectedPointName === item.keyName ? '#f59e0b' : item.color}
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <text x={item.pt.x + item.dx} y={item.pt.y + item.dy} fill={item.color} fontSize="10.5">
                        {item.display}
                      </text>
                    </g>
                  ))}
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

            {/* 4. XEM TRƯỚC GIAO ĐIỂM (KHI ĐANG CHỌN GIAO 2 ĐOẠN HOẶC GIAO ĐƯỜNG - MẶT) */}
            {(segIntersectPreview?.ok && segIntersectPreview.point) || (linePlaneIntersectPreview?.ok && linePlaneIntersectPreview.point) ? (() => {
              const previewPt =
                pointCreationMode === 'intersect_segments'
                  ? segIntersectPreview?.point
                  : linePlaneIntersectPreview?.point;
              const previewColor =
                pointCreationMode === 'intersect_segments' ? intersectSegColor : intersectLPColor;
              const previewLabel =
                pointCreationMode === 'intersect_segments'
                  ? intersectSegLabel.trim() ||
                    getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_segments)
                  : intersectLPLabel.trim() ||
                    getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.intersect_line_plane);
              if (!previewPt) return null;
              const p = project3D(previewPt.x, previewPt.y, previewPt.z);
              return (
                <g className="pointer-events-none select-none">
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="10"
                    fill="none"
                    stroke={previewColor}
                    strokeWidth="1.6"
                    strokeDasharray="3 2"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill={previewColor}
                    fillOpacity="0.65"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={p.x + 11}
                    y={p.y - 5}
                    fill={previewColor}
                    fontSize="10"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    {previewLabel}?
                  </text>
                </g>
              );
            })() : null}

            {/* 5. CON TRỎ NGẮM TẠO ĐIỂM TỰ DO THỜI GIAN THỰC */}
            {isFreePointMode && hover3DPoint && !draggingPointName && (
              <g className="pointer-events-none select-none">
                {/* Vòng tròn xoay ngắm tọa độ */}
                <circle
                  cx={hover3DPoint.svgX}
                  cy={hover3DPoint.svgY}
                  r="13"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                {/* Điểm tâm phát xung */}
                <circle
                  cx={hover3DPoint.svgX}
                  cy={hover3DPoint.svgY}
                  r="4"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                {/* Dấu thập ngắm */}
                <line
                  x1={hover3DPoint.svgX - 9}
                  y1={hover3DPoint.svgY}
                  x2={hover3DPoint.svgX + 9}
                  y2={hover3DPoint.svgY}
                  stroke="#10b981"
                  strokeWidth="1.2"
                />
                <line
                  x1={hover3DPoint.svgX}
                  y1={hover3DPoint.svgY - 9}
                  x2={hover3DPoint.svgX}
                  y2={hover3DPoint.svgY + 9}
                  stroke="#10b981"
                  strokeWidth="1.2"
                />

                {/* Hộp nhãn thông tin tọa độ bám theo con trỏ */}
                <g transform={`translate(${Math.min(hover3DPoint.svgX + 12, 320)}, ${Math.max(hover3DPoint.svgY - 32, 20)})`}>
                  <rect
                    x="0"
                    y="0"
                    width="165"
                    height="32"
                    rx="8"
                    fill="#0f172a"
                    fillOpacity="0.94"
                    stroke="#10b981"
                    strokeWidth="1.2"
                  />
                  <text x="8" y="13" fill="#34d399" fontSize="9.5" fontWeight="bold">
                    Điểm [
                    {manualPointName.trim() ||
                      getNextFreePointName(allUsedPointTokens, POINT_NAME_PREFERENCES.manual)}
                    ]: ({hover3DPoint.x}, {hover3DPoint.y}, {hover3DPoint.z})
                  </text>
                  <text x="8" y="25" fill="#e2e8f0" fontSize="8.5">
                    {hover3DPoint.surfaceName} · Nhấp để tạo
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

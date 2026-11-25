import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Compass,
  Minimize2,
  Play,
  Pause,
} from 'lucide-react';

export type ThreeShapeType =
  | 'pyramid_s_abcd'
  | 'pyramid_s_abc'
  | 'cone_revolution'
  | 'cylinder_revolution'
  | 'prism_tri'
  | 'cube_poly'
  | 'surface_paraboloid'
  | 'surface_saddle';

export type PyramidBaseType = 'parallelogram' | 'trapezoid' | 'quadrilateral';

interface Three3DSceneViewProps {
  onExportSnapshot?: (dataUrl: string, title: string) => void;
}

const PYRAMID_BASE_LABELS: Record<PyramidBaseType, string> = {
  parallelogram: 'Hình bình hành',
  trapezoid: 'Hình thang',
  quadrilateral: 'Tứ giác',
};

const disposeMaterialResources = (mat: THREE.Material) => {
  const rec = mat as unknown as Record<string, unknown>;
  const mapKeys = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
    'envMap',
    'specularMap',
  ];
  mapKeys.forEach((key) => {
    const tex = rec[key];
    if (tex && typeof (tex as THREE.Texture).dispose === 'function') {
      (tex as THREE.Texture).dispose();
    }
  });
  mat.dispose();
};

const disposeObjectTree = (root: THREE.Object3D) => {
  root.traverse((obj) => {
    const meshLike = obj as THREE.Mesh;
    if (meshLike.geometry && typeof meshLike.geometry.dispose === 'function') {
      meshLike.geometry.dispose();
    }
    const mat = (meshLike as { material?: THREE.Material | THREE.Material[] }).material;
    if (mat) {
      if (Array.isArray(mat)) {
        mat.forEach(disposeMaterialResources);
      } else {
        disposeMaterialResources(mat);
      }
    }
  });
  while (root.children.length > 0) {
    root.remove(root.children[0]);
  }
};

export const Three3DSceneView: React.FC<Three3DSceneViewProps> = ({ onExportSnapshot }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI Control states
  const [currentShape, setCurrentShape] = useState<ThreeShapeType>('pyramid_s_abcd');
  const [pyramidBaseType, setPyramidBaseType] = useState<PyramidBaseType>('parallelogram');
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [showSectionPlane, setShowSectionPlane] = useState<boolean>(true);
  const [showCoordinateAxes, setShowCoordinateAxes] = useState<boolean>(true);
  const [showHeightPillar, setShowHeightPillar] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [roughnessVal] = useState<number>(0.25);
  const [opacityVal, setOpacityVal] = useState<number>(0.75);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);

  // References for live 3D mutations without React re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const subjectGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isSoftwareGlRef = useRef<boolean>(false);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sphericalRef = useRef<THREE.Spherical>(new THREE.Spherical(7.6, Math.PI / 3, Math.PI / 4));
  const targetSphericalRef = useRef<THREE.Spherical>(new THREE.Spherical(7.6, Math.PI / 3, Math.PI / 4));

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Procedural Contact Shadow Texture Generator (Zero external 404 dependencies)
  const createContactShadowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
      gradient.addColorStop(0.4, 'rgba(15, 23, 42, 0.35)');
      gradient.addColorStop(0.8, 'rgba(15, 23, 42, 0.08)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  // Procedural Canvas Sprite for 3D Vertex Labels
  const createVertexLabelSprite = (
    text: string,
    textColor = '#f8fafc',
    bgColor = 'rgba(15, 23, 42, 0.88)',
    borderColor = 'rgba(56, 189, 248, 0.65)'
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      ctx.beginPath();
      ctx.arc(64, 64, 42, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = borderColor;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = 'bold 46px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 66);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.5, 0.5, 1);
    sprite.renderOrder = 20;
    return sprite;
  };

  // Helper to add a crisp edge segment between two 3D vertices
  const addEdgeSegments = (
    group: THREE.Group,
    pairs: [THREE.Vector3, THREE.Vector3][],
    colorHex: number,
    opacity = 0.95
  ) => {
    const positions = new Float32Array(pairs.length * 6);
    pairs.forEach(([a, b], idx) => {
      const offset = idx * 6;
      positions[offset] = a.x;
      positions[offset + 1] = a.y;
      positions[offset + 2] = a.z;
      positions[offset + 3] = b.x;
      positions[offset + 4] = b.y;
      positions[offset + 5] = b.z;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: opacity < 1,
      opacity,
    });
    group.add(new THREE.LineSegments(geo, mat));
  };

  // Build Procedural Composite Subjects
  const buildSubject = (
    shapeType: ThreeShapeType,
    baseVariant: PyramidBaseType,
    group: THREE.Group
  ) => {
    disposeObjectTree(group);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(5.5, 5.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.01;
    group.add(shadowMesh);

    // Coordinate grid on base
    const gridHelper = new THREE.GridHelper(6, 12, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = 0.018;
    group.add(gridHelper);

    // Coordinate Axes Oxyz with arrows
    if (showCoordinateAxes) {
      const axesGroup = new THREE.Group();
      const axisLen = 3.2;

      const xMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.4, roughness: 0.25 });
      const xShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, axisLen, 16), xMat);
      xShaft.position.set(axisLen / 2, 0.025, 0);
      xShaft.rotation.z = -Math.PI / 2;
      const xCone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 16), xMat);
      xCone.position.set(axisLen, 0.025, 0);
      xCone.rotation.z = -Math.PI / 2;
      const xLbl = createVertexLabelSprite('x', '#fca5a5', 'rgba(127, 29, 29, 0.88)', '#ef4444');
      xLbl.position.set(axisLen + 0.3, 0.12, 0);
      xLbl.scale.set(0.38, 0.38, 1);

      const yMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.4, roughness: 0.25 });
      const yShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, axisLen, 16), yMat);
      yShaft.position.set(0, axisLen / 2, 0);
      const yCone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 16), yMat);
      yCone.position.set(0, axisLen, 0);
      const yLbl = createVertexLabelSprite('z', '#6ee7b7', 'rgba(6, 78, 59, 0.88)', '#10b981');
      yLbl.position.set(0, axisLen + 0.3, 0);
      yLbl.scale.set(0.38, 0.38, 1);

      const zMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.4, roughness: 0.25 });
      const zShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, axisLen, 16), zMat);
      zShaft.position.set(0, 0.025, axisLen / 2);
      zShaft.rotation.x = Math.PI / 2;
      const zCone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 16), zMat);
      zCone.position.set(0, 0.025, axisLen);
      zCone.rotation.x = Math.PI / 2;
      const zLbl = createVertexLabelSprite('y', '#93c5fd', 'rgba(30, 58, 138, 0.88)', '#3b82f6');
      zLbl.position.set(0, 0.12, axisLen + 0.3);
      zLbl.scale.set(0.38, 0.38, 1);

      axesGroup.add(xShaft, xCone, xLbl, yShaft, yCone, yLbl, zShaft, zCone, zLbl);
      group.add(axesGroup);
    }

    const useSoftwareFallback = isSoftwareGlRef.current;

    // Material Library (varied roughness & metalness across parts)
    const glassPBR = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.08,
      roughness: roughnessVal,
      transparent: true,
      opacity: useSoftwareFallback ? Math.min(0.48, opacityVal) : opacityVal,
      transmission: useSoftwareFallback ? 0 : 0.6,
      ior: 1.5,
      thickness: 0.6,
      clearcoat: 0.8,
      wireframe: wireframeMode,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const baseSlabMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.35,
      roughness: 0.65,
      wireframe: wireframeMode,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.18,
      wireframe: wireframeMode,
    });

    const vertexDotMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.35,
      roughness: 0.25,
    });

    const heightPillarMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.3,
      roughness: 0.25,
      wireframe: wireframeMode,
    });

    const sectionMat = new THREE.MeshPhysicalMaterial({
      color: 0xec4899,
      metalness: 0.15,
      roughness: 0.32,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const addVertexMarker = (
      pos: THREE.Vector3,
      label: string,
      offset: THREE.Vector3,
      isApex = false
    ) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(isApex ? 0.1 : 0.065, 20, 20),
        isApex ? accentMat : vertexDotMat
      );
      dot.position.copy(pos);
      group.add(dot);

      const sprite = createVertexLabelSprite(
        label,
        isApex ? '#fef3c7' : '#f8fafc',
        isApex ? 'rgba(180, 83, 9, 0.9)' : 'rgba(15, 23, 42, 0.88)',
        isApex ? '#f59e0b' : 'rgba(56, 189, 248, 0.7)'
      );
      sprite.position.copy(pos).add(offset);
      group.add(sprite);
    };

    if (shapeType === 'pyramid_s_abcd') {
      const yBase = 0.08;
      const h = 2.8;

      const baseCorners: [number, number][] =
        baseVariant === 'trapezoid'
          ? [
              [-1.75, 1.15], // A
              [1.75, 1.15], // B  (AB // CD, AB > CD)
              [0.9, -1.15], // C
              [-1.0, -1.15], // D
            ]
          : baseVariant === 'quadrilateral'
          ? [
              [-1.65, 1.15], // A
              [1.35, 1.45], // B
              [1.85, -0.85], // C
              [-0.85, -1.35], // D
            ]
          : [
              [-1.55, 1.15], // A (Hình bình hành)
              [1.15, 1.15], // B
              [1.55, -1.15], // C
              [-1.15, -1.15], // D
            ];

      const [A, B, C, D] = baseCorners.map(([bx, bz]) => new THREE.Vector3(bx, yBase, bz));
      const S = new THREE.Vector3(0, h, 0);

      // 1. Extruded polygonal base slab aligned flush with top at yBase
      const baseShape = new THREE.Shape();
      baseShape.moveTo(baseCorners[0][0], baseCorners[0][1]);
      for (let i = 1; i < baseCorners.length; i++) {
        baseShape.lineTo(baseCorners[i][0], baseCorners[i][1]);
      }
      baseShape.closePath();

      const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
        depth: 0.06,
        bevelEnabled: false,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseSlabMat);
      baseMesh.rotation.x = Math.PI / 2;
      baseMesh.position.y = yBase;
      group.add(baseMesh);

      // 2. Lateral glass faces S.ABCD
      const pyramidGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        S.x, S.y, S.z, A.x, A.y, A.z, B.x, B.y, B.z,
        S.x, S.y, S.z, B.x, B.y, B.z, C.x, C.y, C.z,
        S.x, S.y, S.z, C.x, C.y, C.z, D.x, D.y, D.z,
        S.x, S.y, S.z, D.x, D.y, D.z, A.x, A.y, A.z,
      ]);
      pyramidGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      pyramidGeo.computeVertexNormals();
      const pyramidMesh = new THREE.Mesh(pyramidGeo, glassPBR);
      pyramidMesh.renderOrder = 4;
      group.add(pyramidMesh);

      // Crisp wireframe edges
      addEdgeSegments(
        group,
        [
          [S, A],
          [S, B],
          [S, C],
          [S, D],
          [A, B],
          [B, C],
          [C, D],
          [D, A],
        ],
        0xf59e0b
      );
      addEdgeSegments(
        group,
        [
          [A, C],
          [B, D],
        ],
        0x94a3b8,
        0.55
      );

      // 3. Apex S beacon + Vertex labels
      const apexTorus = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 16, 32), accentMat);
      apexTorus.position.copy(S);
      apexTorus.rotation.x = Math.PI / 2;
      group.add(apexTorus);

      addVertexMarker(S, 'S', new THREE.Vector3(0, 0.36, 0), true);
      addVertexMarker(A, 'A', new THREE.Vector3(-0.3, 0.16, 0.25));
      addVertexMarker(B, 'B', new THREE.Vector3(0.3, 0.16, 0.25));
      addVertexMarker(C, 'C', new THREE.Vector3(0.3, 0.16, -0.25));
      addVertexMarker(D, 'D', new THREE.Vector3(-0.3, 0.16, -0.25));

      // 4. Height Pillar SO
      if (showHeightPillar) {
        const pillarGeo = new THREE.CylinderGeometry(0.028, 0.028, h - yBase, 16);
        const pillar = new THREE.Mesh(pillarGeo, heightPillarMat);
        pillar.position.set(0, (h + yBase) / 2, 0);
        const footMark = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), heightPillarMat);
        footMark.position.set(0, yBase + 0.01, 0);
        const footLabel = createVertexLabelSprite('O', '#fecaca', 'rgba(127, 29, 29, 0.9)', '#ef4444');
        footLabel.position.set(0.24, yBase + 0.2, 0.24);
        footLabel.scale.set(0.42, 0.42, 1);
        group.add(pillar, footMark, footLabel);
      }

      // 5. Section plane (SAC)
      if (showSectionPlane) {
        const secGeo = new THREE.BufferGeometry();
        const secVerts = new Float32Array([
          S.x, S.y, S.z,
          A.x, A.y, A.z,
          C.x, C.y, C.z,
        ]);
        secGeo.setAttribute('position', new THREE.BufferAttribute(secVerts, 3));
        secGeo.computeVertexNormals();
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        secMesh.renderOrder = 2;
        group.add(secMesh);
      }
    } else if (shapeType === 'pyramid_s_abc') {
      const yBase = 0.08;
      const h = 2.8;
      const A = new THREE.Vector3(-1.65, yBase, 1.05);
      const B = new THREE.Vector3(1.65, yBase, 1.05);
      const C = new THREE.Vector3(0.15, yBase, -1.55);
      const S = new THREE.Vector3(0, h, 0.15);

      const baseShape = new THREE.Shape();
      baseShape.moveTo(A.x, A.z);
      baseShape.lineTo(B.x, B.z);
      baseShape.lineTo(C.x, C.z);
      baseShape.closePath();

      const baseMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(baseShape, { depth: 0.06, bevelEnabled: false }),
        baseSlabMat
      );
      baseMesh.rotation.x = Math.PI / 2;
      baseMesh.position.y = yBase;
      group.add(baseMesh);

      const triGeo = new THREE.BufferGeometry();
      triGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([
            S.x, S.y, S.z, A.x, A.y, A.z, B.x, B.y, B.z,
            S.x, S.y, S.z, B.x, B.y, B.z, C.x, C.y, C.z,
            S.x, S.y, S.z, C.x, C.y, C.z, A.x, A.y, A.z,
          ]),
          3
        )
      );
      triGeo.computeVertexNormals();
      const triMesh = new THREE.Mesh(triGeo, glassPBR);
      triMesh.renderOrder = 4;
      group.add(triMesh);

      addEdgeSegments(
        group,
        [
          [S, A],
          [S, B],
          [S, C],
          [A, B],
          [B, C],
          [C, A],
        ],
        0xf59e0b
      );

      const apexTorus = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 16, 32), accentMat);
      apexTorus.position.copy(S);
      apexTorus.rotation.x = Math.PI / 2;
      group.add(apexTorus);

      addVertexMarker(S, 'S', new THREE.Vector3(0, 0.36, 0), true);
      addVertexMarker(A, 'A', new THREE.Vector3(-0.3, 0.16, 0.25));
      addVertexMarker(B, 'B', new THREE.Vector3(0.3, 0.16, 0.25));
      addVertexMarker(C, 'C', new THREE.Vector3(0.2, 0.16, -0.32));

      if (showHeightPillar) {
        const H = new THREE.Vector3(S.x, yBase, S.z);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, h - yBase, 16), heightPillarMat);
        pillar.position.set(H.x, (h + yBase) / 2, H.z);
        const footMark = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), heightPillarMat);
        footMark.position.set(H.x, yBase + 0.01, H.z);
        const footLabel = createVertexLabelSprite('H', '#fecaca', 'rgba(127, 29, 29, 0.9)', '#ef4444');
        footLabel.position.set(H.x + 0.25, yBase + 0.2, H.z + 0.2);
        footLabel.scale.set(0.42, 0.42, 1);
        group.add(pillar, footMark, footLabel);
      }

      if (showSectionPlane) {
        const M = new THREE.Vector3().addVectors(B, C).multiplyScalar(0.5);
        const secGeo = new THREE.BufferGeometry();
        secGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array([S.x, S.y, S.z, A.x, A.y, A.z, M.x, M.y, M.z]), 3)
        );
        secGeo.computeVertexNormals();
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        secMesh.renderOrder = 2;
        group.add(secMesh);
        addEdgeSegments(group, [[A, M], [S, M]], 0xf472b6, 0.85);
      }
    } else if (shapeType === 'prism_tri') {
      const yBase = 0.08;
      const h = 2.45;
      const A = new THREE.Vector3(-1.45, yBase, 1.0);
      const B = new THREE.Vector3(1.45, yBase, 1.0);
      const C = new THREE.Vector3(0.1, yBase, -1.35);
      const A1 = new THREE.Vector3(A.x, h, A.z);
      const B1 = new THREE.Vector3(B.x, h, B.z);
      const C1 = new THREE.Vector3(C.x, h, C.z);

      const baseShape = new THREE.Shape();
      baseShape.moveTo(A.x, A.z);
      baseShape.lineTo(B.x, B.z);
      baseShape.lineTo(C.x, C.z);
      baseShape.closePath();

      const botSlab = new THREE.Mesh(
        new THREE.ExtrudeGeometry(baseShape, { depth: 0.06, bevelEnabled: false }),
        baseSlabMat
      );
      botSlab.rotation.x = Math.PI / 2;
      botSlab.position.y = yBase;
      group.add(botSlab);

      const prismGeo = new THREE.BufferGeometry();
      prismGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([
            // Top A'B'C'
            A1.x, A1.y, A1.z, B1.x, B1.y, B1.z, C1.x, C1.y, C1.z,
            // Face ABB'A'
            A.x, A.y, A.z, B.x, B.y, B.z, B1.x, B1.y, B1.z,
            A.x, A.y, A.z, B1.x, B1.y, B1.z, A1.x, A1.y, A1.z,
            // Face BCC'B'
            B.x, B.y, B.z, C.x, C.y, C.z, C1.x, C1.y, C1.z,
            B.x, B.y, B.z, C1.x, C1.y, C1.z, B1.x, B1.y, B1.z,
            // Face CAA'C'
            C.x, C.y, C.z, A.x, A.y, A.z, A1.x, A1.y, A1.z,
            C.x, C.y, C.z, A1.x, A1.y, A1.z, C1.x, C1.y, C1.z,
          ]),
          3
        )
      );
      prismGeo.computeVertexNormals();
      const prismMesh = new THREE.Mesh(prismGeo, glassPBR);
      prismMesh.renderOrder = 4;
      group.add(prismMesh);

      addEdgeSegments(
        group,
        [
          [A, B],
          [B, C],
          [C, A],
          [A1, B1],
          [B1, C1],
          [C1, A1],
          [A, A1],
          [B, B1],
          [C, C1],
        ],
        0xf59e0b
      );

      addVertexMarker(A, 'A', new THREE.Vector3(-0.28, 0.14, 0.24));
      addVertexMarker(B, 'B', new THREE.Vector3(0.28, 0.14, 0.24));
      addVertexMarker(C, 'C', new THREE.Vector3(0.18, 0.14, -0.3));
      addVertexMarker(A1, "A'", new THREE.Vector3(-0.28, 0.24, 0.24), true);
      addVertexMarker(B1, "B'", new THREE.Vector3(0.28, 0.24, 0.24), true);
      addVertexMarker(C1, "C'", new THREE.Vector3(0.18, 0.24, -0.3), true);

      if (showHeightPillar) {
        const G = new THREE.Vector3().add(A).add(B).add(C).divideScalar(3);
        const G1 = new THREE.Vector3(G.x, h, G.z);
        const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h - yBase, 16), heightPillarMat);
        axis.position.set(G.x, (h + yBase) / 2, G.z);
        group.add(axis);
        addEdgeSegments(group, [[G, G1]], 0xef4444);
      }

      if (showSectionPlane) {
        const secGeo = new THREE.BufferGeometry();
        secGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array([A1.x, A1.y, A1.z, B.x, B.y, B.z, C.x, C.y, C.z]), 3)
        );
        secGeo.computeVertexNormals();
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        secMesh.renderOrder = 2;
        group.add(secMesh);
      }
    } else if (shapeType === 'cone_revolution') {
      const r = 1.75;
      const h = 3.0;

      const baseRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 16, 48), accentMat);
      baseRim.rotation.x = Math.PI / 2;
      baseRim.position.y = 0.06;
      group.add(baseRim);

      const coneGeo = new THREE.ConeGeometry(r, h, 48, 1, true);
      const coneMesh = new THREE.Mesh(coneGeo, glassPBR);
      coneMesh.position.y = h / 2 + 0.06;
      coneMesh.renderOrder = 4;
      group.add(coneMesh);

      if (showHeightPillar) {
        const axisGeo = new THREE.CylinderGeometry(0.028, 0.028, h, 16);
        const axis = new THREE.Mesh(axisGeo, heightPillarMat);
        axis.position.y = h / 2 + 0.06;
        group.add(axis);
      }

      const S = new THREE.Vector3(0, h + 0.06, 0);
      const O = new THREE.Vector3(0, 0.06, 0);
      const A = new THREE.Vector3(-r, 0.06, 0);
      const B = new THREE.Vector3(r, 0.06, 0);

      addVertexMarker(S, 'S', new THREE.Vector3(0, 0.34, 0), true);
      addVertexMarker(O, 'O', new THREE.Vector3(0.22, 0.16, 0.25));
      addVertexMarker(A, 'A', new THREE.Vector3(-0.28, 0.16, 0.15));
      addVertexMarker(B, 'B', new THREE.Vector3(0.28, 0.16, 0.15));

      if (showSectionPlane) {
        const secGeo = new THREE.BufferGeometry();
        const secVerts = new Float32Array([S.x, S.y, S.z, A.x, A.y, A.z, B.x, B.y, B.z]);
        secGeo.setAttribute('position', new THREE.BufferAttribute(secVerts, 3));
        secGeo.computeVertexNormals();
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        secMesh.renderOrder = 2;
        group.add(secMesh);
      }
    } else if (shapeType === 'cylinder_revolution') {
      const r = 1.45;
      const h = 2.55;

      const cylGeo = new THREE.CylinderGeometry(r, r, h, 48, 1, false);
      const cylMesh = new THREE.Mesh(cylGeo, glassPBR);
      cylMesh.position.y = h / 2 + 0.06;
      cylMesh.renderOrder = 4;
      group.add(cylMesh);

      const topRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 16, 48), accentMat);
      topRim.rotation.x = Math.PI / 2;
      topRim.position.y = h + 0.06;
      const botRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 16, 48), accentMat);
      botRim.rotation.x = Math.PI / 2;
      botRim.position.y = 0.06;
      group.add(topRim, botRim);

      if (showHeightPillar) {
        const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, h, 16), heightPillarMat);
        axis.position.y = h / 2 + 0.06;
        group.add(axis);
      }

      addVertexMarker(new THREE.Vector3(0, 0.06, 0), 'O', new THREE.Vector3(0.24, 0.16, 0.24));
      addVertexMarker(new THREE.Vector3(0, h + 0.06, 0), "O'", new THREE.Vector3(0.24, 0.24, 0.24), true);
      addVertexMarker(new THREE.Vector3(-r, 0.06, 0), 'A', new THREE.Vector3(-0.28, 0.15, 0.15));
      addVertexMarker(new THREE.Vector3(r, 0.06, 0), 'B', new THREE.Vector3(0.28, 0.15, 0.15));

      if (showSectionPlane) {
        const secGeo = new THREE.PlaneGeometry(2 * r, h);
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        secMesh.position.y = h / 2 + 0.06;
        secMesh.renderOrder = 2;
        group.add(secMesh);
      }
    } else if (shapeType === 'surface_paraboloid') {
      const segments = 40;
      const size = 3;
      const surfGeo = new THREE.PlaneGeometry(size, size, segments, segments);
      const pos = surfGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = (x * x + y * y) * 0.45;
        pos.setZ(i, z);
      }
      surfGeo.computeVertexNormals();
      const surfMesh = new THREE.Mesh(surfGeo, glassPBR);
      surfMesh.rotation.x = -Math.PI / 2;
      surfMesh.position.y = 0.2;
      group.add(surfMesh);

      const wire = new THREE.WireframeGeometry(surfGeo);
      const line = new THREE.LineSegments(
        wire,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.2;
      group.add(line);
    } else if (shapeType === 'surface_saddle') {
      const segments = 40;
      const size = 3.2;
      const surfGeo = new THREE.PlaneGeometry(size, size, segments, segments);
      const pos = surfGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = (x * x - y * y) * 0.45;
        pos.setZ(i, z);
      }
      surfGeo.computeVertexNormals();
      const surfMesh = new THREE.Mesh(surfGeo, glassPBR);
      surfMesh.rotation.x = -Math.PI / 2;
      surfMesh.position.y = 1.4;
      group.add(surfMesh);
    } else {
      // Cube ABCD.A'B'C'D'
      const s = 1.1;
      const y0 = 0.08;
      const y1 = 2.28;
      const boxGeo = new THREE.BoxGeometry(s * 2, y1 - y0, s * 2);
      const boxMesh = new THREE.Mesh(boxGeo, glassPBR);
      boxMesh.position.y = (y0 + y1) / 2;
      boxMesh.renderOrder = 4;

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(boxGeo),
        new THREE.LineBasicMaterial({ color: 0xf59e0b })
      );
      edges.position.y = (y0 + y1) / 2;
      group.add(boxMesh, edges);

      const A = new THREE.Vector3(-s, y0, s);
      const B = new THREE.Vector3(s, y0, s);
      const C = new THREE.Vector3(s, y0, -s);
      const D = new THREE.Vector3(-s, y0, -s);
      const A1 = new THREE.Vector3(-s, y1, s);
      const B1 = new THREE.Vector3(s, y1, s);
      const C1 = new THREE.Vector3(s, y1, -s);
      const D1 = new THREE.Vector3(-s, y1, -s);

      addVertexMarker(A, 'A', new THREE.Vector3(-0.24, 0.14, 0.24));
      addVertexMarker(B, 'B', new THREE.Vector3(0.24, 0.14, 0.24));
      addVertexMarker(C, 'C', new THREE.Vector3(0.24, 0.14, -0.24));
      addVertexMarker(D, 'D', new THREE.Vector3(-0.24, 0.14, -0.24));
      addVertexMarker(A1, "A'", new THREE.Vector3(-0.24, 0.24, 0.24), true);
      addVertexMarker(B1, "B'", new THREE.Vector3(0.24, 0.24, 0.24), true);
      addVertexMarker(C1, "C'", new THREE.Vector3(0.24, 0.24, -0.24), true);
      addVertexMarker(D1, "D'", new THREE.Vector3(-0.24, 0.24, -0.24), true);

      if (showSectionPlane) {
        const secGeo = new THREE.BufferGeometry();
        secGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(
            new Float32Array([
              A.x, A.y, A.z, C.x, C.y, C.z, C1.x, C1.y, C1.z,
              A.x, A.y, A.z, C1.x, C1.y, C1.z, A1.x, A1.y, A1.z,
            ]),
            3
          )
        );
        secGeo.computeVertexNormals();
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        secMesh.renderOrder = 2;
        group.add(secMesh);
      }
    }
  };

  // Main Scene Initialization (WebGL Renderer, Studio IBL, Damped Orbit Loop)
  useEffect(() => {
    if (!canvasRef.current || !mountRef.current) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param) || '');
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();
    isSoftwareGlRef.current = isSoftwareGl;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 580;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.045);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 4. Procedural RoomEnvironment IBL
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 5. Studio 3-point Lighting Rig
    const warmKeyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    warmKeyLight.position.set(6, 9, 6);
    warmKeyLight.castShadow = !isSoftwareGl;
    scene.add(warmKeyLight);

    const coolFillLight = new THREE.DirectionalLight(0xbae6fd, 1.2);
    coolFillLight.position.set(-6, 5, -5);
    scene.add(coolFillLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.0);
    scene.add(hemiLight);

    // 6. Subject Group
    const subjectGroup = new THREE.Group();
    subjectGroupRef.current = subjectGroup;
    scene.add(subjectGroup);

    buildSubject(currentShape, pyramidBaseType, subjectGroup);

    // 7. Render Loop with Software-WebGL Pacing & Smooth Damping
    let disposed = false;
    let prevTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        animFrameIdRef.current = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          animFrameIdRef.current = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          animFrameIdRef.current = window.setTimeout(cb, 80);
        }
      };
      animFrameIdRef.current = window.setTimeout(poll, 5);
    };

    const animate = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.1);
      prevTime = now;

      if (autoRotateRef.current && !isDraggingRef.current) {
        targetSphericalRef.current.theta += 0.35 * dt;
      }

      const dampFactor = 1 - Math.exp(-8 * dt);
      sphericalRef.current.radius +=
        (targetSphericalRef.current.radius - sphericalRef.current.radius) * dampFactor;
      sphericalRef.current.theta +=
        (targetSphericalRef.current.theta - sphericalRef.current.theta) * dampFactor;
      sphericalRef.current.phi +=
        (targetSphericalRef.current.phi - sphericalRef.current.phi) * dampFactor;
      sphericalRef.current.phi = Math.max(0.12, Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi));

      camera.position.setFromSpherical(sphericalRef.current);
      camera.lookAt(0, 1.2, 0);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        animFrameIdRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || 580;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        window.clearTimeout(animFrameIdRef.current);
      }
      disposeObjectTree(scene);
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  // Update subject when options change
  useEffect(() => {
    if (subjectGroupRef.current) {
      buildSubject(currentShape, pyramidBaseType, subjectGroupRef.current);
    }
  }, [
    currentShape,
    pyramidBaseType,
    wireframeMode,
    showSectionPlane,
    showCoordinateAxes,
    showHeightPillar,
    roughnessVal,
    opacityVal,
  ]);

  // Mouse & Touch Orbit Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMousePosRef.current.x;
    const dy = e.clientY - prevMousePosRef.current.y;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    targetSphericalRef.current.theta -= dx * 0.007;
    targetSphericalRef.current.phi -= dy * 0.007;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    targetSphericalRef.current.radius = Math.max(
      3.5,
      Math.min(14, targetSphericalRef.current.radius + e.deltaY * 0.005)
    );
  };

  const handleZoom = (delta: number) => {
    targetSphericalRef.current.radius = Math.max(
      3.5,
      Math.min(14, targetSphericalRef.current.radius + delta)
    );
  };

  const handleResetCamera = () => {
    targetSphericalRef.current.set(7.6, Math.PI / 3, Math.PI / 4);
  };

  // High-Res Snapshot Export
  const handleExportSnapshot = () => {
    if (!canvasRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const suffix = currentShape === 'pyramid_s_abcd' ? `_${pyramidBaseType}` : '';
    if (onExportSnapshot) {
      onExportSnapshot(dataUrl, `Hinh_3D_${currentShape}${suffix}.png`);
    } else {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Math_3D_${currentShape}${suffix}.png`;
      a.click();
    }
    setSnapshotSuccess(true);
    setTimeout(() => setSnapshotSuccess(false), 2500);
  };

  const shapeButtons: { id: ThreeShapeType; label: string }[] = [
    { id: 'pyramid_s_abcd', label: 'Chóp S.ABCD' },
    { id: 'pyramid_s_abc', label: 'Chóp S.ABC' },
    { id: 'prism_tri', label: 'Lăng trụ tam giác' },
    { id: 'cube_poly', label: 'Khối lập phương' },
    { id: 'cone_revolution', label: 'Khối nón xoay' },
    { id: 'cylinder_revolution', label: 'Khối trụ xoay' },
    { id: 'surface_paraboloid', label: 'Mặt Paraboloid' },
    { id: 'surface_saddle', label: 'Mặt yên ngựa' },
  ];

  const heightLabel =
    currentShape === 'pyramid_s_abc'
      ? 'Đường cao SH'
      : currentShape === 'pyramid_s_abcd'
      ? 'Đường cao SO'
      : currentShape === 'prism_tri' || currentShape === 'cylinder_revolution'
      ? 'Trục & chiều cao'
      : 'Đường cao SO';

  return (
    <div className="relative w-full h-[640px] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Quick Toolbar (Top-Right) */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/95 border border-slate-700/80 p-1.5 rounded-2xl shadow-lg">
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              autoRotate ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={autoRotate ? 'Tạm dừng xoay' : 'Bật xoay tự động'}
          >
            {autoRotate ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-1.0)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            title="Phóng to"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.0)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            title="Thu nhỏ"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            title="Góc nhìn ban đầu"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={handleExportSnapshot}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
            title="Xuất ảnh chụp 3D độ phân giải cao"
          >
            <Download size={14} />
            <span>{snapshotSuccess ? 'Đã lưu!' : 'Chụp ảnh'}</span>
          </button>
        </div>

        {/* Collapsible Floating Control Dock (solid rgba surfaces, no backdrop-blur) */}
        <div className="absolute bottom-4 left-4 z-10 max-w-sm w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Compass size={16} className="text-cyan-400" />
              <span className="text-xs font-black text-white uppercase tracking-wider">Mô Hình 3D Đa Diện & Mặt Cong</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDockCollapsed(!isDockCollapsed)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isDockCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          </div>

          {!isDockCollapsed && (
            <div className="pt-2.5 space-y-2 text-xs">
              {/* Shape Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Chọn Khối Không Gian / Mặt Cong:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {shapeButtons.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentShape(item.id)}
                      className={`py-1 px-2 rounded-xl text-[11px] font-bold text-left transition-all cursor-pointer ${
                        currentShape === item.id
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pyramid Base Sub-Selector */}
              {currentShape === 'pyramid_s_abcd' && (
                <div className="pt-1.5 border-t border-slate-800">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Dạng đáy chóp S.ABCD:
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['parallelogram', 'trapezoid', 'quadrilateral'] as PyramidBaseType[]).map((base) => (
                      <button
                        key={base}
                        type="button"
                        onClick={() => setPyramidBaseType(base)}
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                          pyramidBaseType === base
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {PYRAMID_BASE_LABELS[base]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSectionPlane(!showSectionPlane)}
                  className={`py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    showSectionPlane ? 'bg-pink-950/60 text-pink-300 border border-pink-500/30' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>Thiết diện (Cắt)</span>
                  <span>{showSectionPlane ? 'BẬT' : 'TẮT'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHeightPillar(!showHeightPillar)}
                  className={`py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    showHeightPillar ? 'bg-red-950/60 text-red-300 border border-red-500/30' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>{heightLabel}</span>
                  <span>{showHeightPillar ? 'BẬT' : 'TẮT'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWireframeMode(!wireframeMode)}
                  className={`py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    wireframeMode ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>Khung lưới (Wire)</span>
                  <span>{wireframeMode ? 'BẬT' : 'TẮT'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCoordinateAxes(!showCoordinateAxes)}
                  className={`py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    showCoordinateAxes ? 'bg-blue-950/60 text-blue-300 border border-blue-500/30' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>Hệ trục Oxyz</span>
                  <span>{showCoordinateAxes ? 'BẬT' : 'TẮT'}</span>
                </button>
              </div>

              {/* Opacity Slider */}
              <div className="pt-1.5 border-t border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Độ trong suốt khối:</span>
                  <span className="font-mono text-cyan-400">{Math.round(opacityVal * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={opacityVal}
                  onChange={(e) => setOpacityVal(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


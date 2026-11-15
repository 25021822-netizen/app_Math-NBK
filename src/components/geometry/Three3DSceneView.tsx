import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Box,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Download,
  Eye,
  Sliders,
  Layers,
  Info,
  Compass,
  Minimize2,
  Play,
  Pause,
  Grid,
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

interface Three3DSceneViewProps {
  onExportSnapshot?: (dataUrl: string, title: string) => void;
}

export const Three3DSceneView: React.FC<Three3DSceneViewProps> = ({ onExportSnapshot }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI Control states
  const [currentShape, setCurrentShape] = useState<ThreeShapeType>('pyramid_s_abcd');
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [showSectionPlane, setShowSectionPlane] = useState<boolean>(true);
  const [showCoordinateAxes, setShowCoordinateAxes] = useState<boolean>(true);
  const [showHeightPillar, setShowHeightPillar] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [roughnessVal, setRoughnessVal] = useState<number>(0.25);
  const [opacityVal, setOpacityVal] = useState<number>(0.75);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);

  // References for live 3D mutations without React re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const subjectGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sphericalRef = useRef<THREE.Spherical>(new THREE.Spherical(7.5, Math.PI / 3, Math.PI / 4));
  const targetSphericalRef = useRef<THREE.Spherical>(new THREE.Spherical(7.5, Math.PI / 3, Math.PI / 4));

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

  // Build Procedural 3-12 Part Composite Subjects
  const buildSubject = (shapeType: ThreeShapeType, group: THREE.Group) => {
    // Clear old children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m.dispose());
        } else {
          (child as any).material.dispose();
        }
      }
    }

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(5, 5);
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
    gridHelper.position.y = 0.015;
    group.add(gridHelper);

    // Coordinate Axes Oxyz with arrows
    if (showCoordinateAxes) {
      const axesGroup = new THREE.Group();
      const axisLen = 3.2;

      // X: Red
      const xMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.2 });
      const xShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, axisLen, 16), xMat);
      xShaft.position.set(axisLen / 2, 0.025, 0);
      xShaft.rotation.z = -Math.PI / 2;
      const xCone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 16), xMat);
      xCone.position.set(axisLen, 0.025, 0);
      xCone.rotation.z = -Math.PI / 2;
      axesGroup.add(xShaft, xCone);

      // Y: Green (Up in Three.js)
      const yMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.5, roughness: 0.2 });
      const yShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, axisLen, 16), yMat);
      yShaft.position.set(0, axisLen / 2, 0);
      const yCone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 16), yMat);
      yCone.position.set(0, axisLen, 0);
      axesGroup.add(yShaft, yCone);

      // Z: Blue
      const zMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.2 });
      const zShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, axisLen, 16), zMat);
      zShaft.position.set(0, 0.025, axisLen / 2);
      zShaft.rotation.x = Math.PI / 2;
      const zCone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 16), zMat);
      zCone.position.set(0, 0.025, axisLen);
      zCone.rotation.x = Math.PI / 2;
      axesGroup.add(zShaft, zCone);

      group.add(axesGroup);
    }

    // Material Library
    const glassPBR = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: roughnessVal,
      transparent: true,
      opacity: opacityVal,
      transmission: 0.6,
      ior: 1.5,
      wireframe: wireframeMode,
      side: THREE.DoubleSide,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.15,
      wireframe: wireframeMode,
    });

    const edgeTubeMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      metalness: 0.4,
      roughness: 0.3,
    });

    const heightPillarMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.3,
      roughness: 0.2,
      wireframe: wireframeMode,
    });

    const sectionMat = new THREE.MeshPhysicalMaterial({
      color: 0xec4899,
      metalness: 0.2,
      roughness: 0.3,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });

    if (shapeType === 'pyramid_s_abcd') {
      // 1. Base ABCD
      const baseShape = new THREE.Shape();
      const s = 1.6;
      baseShape.moveTo(-s, -s);
      baseShape.lineTo(s, -s);
      baseShape.lineTo(s, s);
      baseShape.lineTo(-s, s);
      baseShape.closePath();

      const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
      const baseGeo = new THREE.ExtrudeGeometry(baseShape, extrudeSettings);
      const baseMesh = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3, roughness: 0.5 }));
      baseMesh.rotation.x = Math.PI / 2;
      baseMesh.position.y = 0.08;
      group.add(baseMesh);

      // 2. Pyramid Body
      const h = 2.8;
      const pyramidGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        // Side 1: S, A, B
        0, h, 0,   -s, 0.08, -s,   s, 0.08, -s,
        // Side 2: S, B, C
        0, h, 0,   s, 0.08, -s,    s, 0.08, s,
        // Side 3: S, C, D
        0, h, 0,   s, 0.08, s,     -s, 0.08, s,
        // Side 4: S, D, A
        0, h, 0,   -s, 0.08, s,    -s, 0.08, -s,
      ]);
      pyramidGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      pyramidGeo.computeVertexNormals();
      const pyramidMesh = new THREE.Mesh(pyramidGeo, glassPBR);
      group.add(pyramidMesh);

      // 3. Apex S accent sphere & beacon
      const apexSphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), accentMat);
      apexSphere.position.set(0, h, 0);
      const apexTorus = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 16, 32), accentMat);
      apexTorus.position.set(0, h, 0);
      apexTorus.rotation.x = Math.PI / 2;
      group.add(apexSphere, apexTorus);

      // 4. Height Pillar SO (Đường cao SO)
      if (showHeightPillar) {
        const pillarGeo = new THREE.CylinderGeometry(0.03, 0.03, h, 16);
        const pillar = new THREE.Mesh(pillarGeo, heightPillarMat);
        pillar.position.set(0, h / 2, 0);
        const footMark = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), heightPillarMat);
        footMark.position.set(0, 0.08, 0);
        group.add(pillar, footMark);
      }

      // 5. Thiết diện qua trục / mặt cắt (Section Plane SAC)
      if (showSectionPlane) {
        const secGeo = new THREE.BufferGeometry();
        const secVerts = new Float32Array([
          0, h, 0,
          -s, 0.08, -s,
          s, 0.08, s,
        ]);
        secGeo.setAttribute('position', new THREE.BufferAttribute(secVerts, 3));
        secGeo.computeVertexNormals();
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        group.add(secMesh);
      }
    } else if (shapeType === 'cone_revolution') {
      const r = 1.8;
      const h = 3.0;

      // 1. Base Bevel ring
      const baseRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 16, 48), accentMat);
      baseRim.rotation.x = Math.PI / 2;
      baseRim.position.y = 0.05;
      group.add(baseRim);

      // 2. Conic Lathe Body
      const coneGeo = new THREE.ConeGeometry(r, h, 48, 1, true);
      const coneMesh = new THREE.Mesh(coneGeo, glassPBR);
      coneMesh.position.y = h / 2;
      group.add(coneMesh);

      // 3. Central Axis (Trục hình nón SO)
      const axisGeo = new THREE.CylinderGeometry(0.03, 0.03, h, 16);
      const axis = new THREE.Mesh(axisGeo, heightPillarMat);
      axis.position.y = h / 2;
      group.add(axis);

      // 4. Apex S
      const apexSphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), accentMat);
      apexSphere.position.set(0, h, 0);
      group.add(apexSphere);

      // 5. Thiết diện qua trục SAB (Axial section)
      if (showSectionPlane) {
        const secGeo = new THREE.BufferGeometry();
        const secVerts = new Float32Array([
          0, h, 0,
          -r, 0, 0,
          r, 0, 0,
        ]);
        secGeo.setAttribute('position', new THREE.BufferAttribute(secVerts, 3));
        secGeo.computeVertexNormals();
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        group.add(secMesh);
      }
    } else if (shapeType === 'cylinder_revolution') {
      const r = 1.5;
      const h = 2.6;

      const cylGeo = new THREE.CylinderGeometry(r, r, h, 48, 1, false);
      const cylMesh = new THREE.Mesh(cylGeo, glassPBR);
      cylMesh.position.y = h / 2;
      group.add(cylMesh);

      const topRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 16, 48), accentMat);
      topRim.rotation.x = Math.PI / 2;
      topRim.position.y = h;
      const botRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 16, 48), accentMat);
      botRim.rotation.x = Math.PI / 2;
      botRim.position.y = 0.04;
      group.add(topRim, botRim);

      if (showSectionPlane) {
        const secGeo = new THREE.PlaneGeometry(2 * r, h);
        const secMesh = new THREE.Mesh(secGeo, sectionMat);
        secMesh.position.y = h / 2;
        group.add(secMesh);
      }
    } else if (shapeType === 'surface_paraboloid') {
      // Mặt bậc hai Paraboloid Elliptic: z = (x^2 + y^2)/2
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

      // Wireframe overlay rings
      const wire = new THREE.WireframeGeometry(surfGeo);
      const line = new THREE.LineSegments(wire, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 }));
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.2;
      group.add(line);
    } else if (shapeType === 'surface_saddle') {
      // Mặt yên ngựa Hyperbolic Paraboloid: z = (x^2 - y^2)/2
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
      // Prism or Cube
      const boxGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
      const boxMesh = new THREE.Mesh(boxGeo, glassPBR);
      boxMesh.position.y = 1.1;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 }));
      edges.position.y = 1.1;
      group.add(boxMesh, edges);
    }
  };

  // Main Scene Initialization (WebGL Renderer, Lighting, Damped Loop)
  useEffect(() => {
    if (!canvasRef.current || !mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 580;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.05);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;

    // 3. Renderer with ACESFilmicToneMapping & sRGB
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // 4. Studio PBR Lighting Rig
    const warmKeyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    warmKeyLight.position.set(6, 9, 6);
    warmKeyLight.castShadow = true;
    scene.add(warmKeyLight);

    const coolFillLight = new THREE.DirectionalLight(0xbae6fd, 1.2);
    coolFillLight.position.set(-6, 5, -5);
    scene.add(coolFillLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.0);
    scene.add(hemiLight);

    // 5. Subject Group
    const subjectGroup = new THREE.Group();
    subjectGroupRef.current = subjectGroup;
    scene.add(subjectGroup);

    buildSubject(currentShape, subjectGroup);

    // 6. Lossless 60fps Loop with Damped Orbit Camera
    let prevTime = performance.now();
    const animate = (currentTime: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const dt = Math.min((currentTime - prevTime) / 1000, 0.1);
      prevTime = currentTime;

      // Auto rotation
      if (autoRotate && !isDraggingRef.current) {
        targetSphericalRef.current.theta += 0.35 * dt;
      }

      // Smooth camera damping: 1 - Math.exp(-k * dt)
      const dampFactor = 1 - Math.exp(-8 * dt);
      sphericalRef.current.radius += (targetSphericalRef.current.radius - sphericalRef.current.radius) * dampFactor;
      sphericalRef.current.theta += (targetSphericalRef.current.theta - sphericalRef.current.theta) * dampFactor;
      sphericalRef.current.phi += (targetSphericalRef.current.phi - sphericalRef.current.phi) * dampFactor;

      // Restrict phi to avoid gimbal flip
      sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi));

      camera.position.setFromSpherical(sphericalRef.current);
      camera.lookAt(0, 1.2, 0);

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Resize Handler
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
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }
    };
  }, []);

  // Update subject when options change
  useEffect(() => {
    if (subjectGroupRef.current) {
      buildSubject(currentShape, subjectGroupRef.current);
    }
  }, [currentShape, wireframeMode, showSectionPlane, showCoordinateAxes, showHeightPillar, roughnessVal, opacityVal]);

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
    targetSphericalRef.current.radius = Math.max(3.5, Math.min(14, targetSphericalRef.current.radius + e.deltaY * 0.005));
  };

  const handleZoom = (delta: number) => {
    targetSphericalRef.current.radius = Math.max(3.5, Math.min(14, targetSphericalRef.current.radius + delta));
  };

  const handleResetCamera = () => {
    targetSphericalRef.current.set(7.5, Math.PI / 3, Math.PI / 4);
  };

  // High-Res Snapshot Export
  const handleExportSnapshot = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    if (onExportSnapshot) {
      onExportSnapshot(dataUrl, `Hinh_3D_${currentShape}.png`);
    } else {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Math_3D_${currentShape}.png`;
      a.click();
    }
    setSnapshotSuccess(true);
    setTimeout(() => setSnapshotSuccess(false), 2500);
  };

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
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-2xl shadow-lg">
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

        {/* Collapsible Floating Control Dock (<= 15% footprint, solid rgba surfaces) */}
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
            <div className="pt-2.5 space-y-2.5 text-xs">
              {/* Shape Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Chọn Khối Không Gian / Mặt Cong:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentShape('pyramid_s_abcd')}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-left transition-all cursor-pointer ${
                      currentShape === 'pyramid_s_abcd'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Chóp S.ABCD
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentShape('cone_revolution')}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-left transition-all cursor-pointer ${
                      currentShape === 'cone_revolution'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Khối nón xoay
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentShape('cylinder_revolution')}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-left transition-all cursor-pointer ${
                      currentShape === 'cylinder_revolution'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Khối trụ xoay
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentShape('surface_paraboloid')}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-left transition-all cursor-pointer ${
                      currentShape === 'surface_paraboloid'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Mặt Paraboloid
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentShape('surface_saddle')}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-left transition-all cursor-pointer ${
                      currentShape === 'surface_saddle'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Mặt yên ngựa
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentShape('cube_poly')}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-left transition-all cursor-pointer ${
                      currentShape === 'cube_poly'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Khối lập phương
                  </button>
                </div>
              </div>

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
                  <span>Đường cao SO</span>
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

              {/* Sliders: PBR Roughness & Opacity */}
              <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Độ trong suốt (PBR Transmission):</span>
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

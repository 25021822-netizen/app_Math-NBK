import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Play,
  Pause,
  RotateCcw,
  Tag,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Atom,
  Sparkles,
  Hand,
} from 'lucide-react';
import {
  ELEMENT_SPECS,
  REACTION_3D_PRESETS,
  type Reaction3DPreset,
  type ReactionAtomSpec,
  type ReactionBondSpec,
} from './molecularReactions3dData';

interface MolecularReaction3DViewProps {
  initialReactionId?: string;
}

type ModelStyle = 'ball_stick' | 'space_filling';

// Module-scope reusable math objects (Zero GC in render loop)
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vMid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _perp = new THREE.Vector3();
const _altAxis = new THREE.Vector3(1, 0, 0);
const _quat = new THREE.Quaternion();
const _cStart = new THREE.Vector3();
const _cTS = new THREE.Vector3();
const _cEnd = new THREE.Vector3();
const _colTmp = new THREE.Color();
const _colBreak = new THREE.Color('#F59E0B');
const _colForm = new THREE.Color('#10B981');
const _colNormal = new THREE.Color('#CBD5E1');
const _colIonic = new THREE.Color('#38BDF8');

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.72)');
    grad.addColorStop(0.45, 'rgba(2, 6, 23, 0.34)');
    grad.addColorStop(0.85, 'rgba(2, 6, 23, 0.08)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createAtomSpriteTexture(labelText: string, bgHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.beginPath();
    ctx.roundRect(24, 24, 208, 80, 36);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = bgHex;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 46px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 128, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function evalBezierTrajectory(
  start: [number, number, number],
  ts: [number, number, number],
  end: [number, number, number],
  t: number,
  out: THREE.Vector3
) {
  // Piecewise smooth interpolation through exact Transition State at t = 0.5
  _cStart.set(start[0], start[1], start[2]);
  _cTS.set(ts[0], ts[1], ts[2]);
  _cEnd.set(end[0], end[1], end[2]);
  if (t <= 0.5) {
    const u = THREE.MathUtils.smoothstep(t * 2, 0, 1);
    out.lerpVectors(_cStart, _cTS, u);
  } else {
    const u = THREE.MathUtils.smoothstep((t - 0.5) * 2, 0, 1);
    out.lerpVectors(_cTS, _cEnd, u);
  }
}

interface AtomRuntime {
  spec: ReactionAtomSpec;
  index: number;
  group: THREE.Group;
  sphere: THREE.Mesh;
  ring: THREE.Mesh;
  sprite: THREE.Sprite;
  spriteMat: THREE.SpriteMaterial;
  currentChargeText: string;
}

interface BondRuntime {
  spec: ReactionBondSpec;
  group: THREE.Group;
  cylinders: THREE.Mesh[];
  material: THREE.MeshPhysicalMaterial;
}

interface ElectronRuntime {
  fromAtomIndex: number;
  toAtomIndex: number;
  offsetIdx: number;
  totalCount: number;
  window: [number, number];
  mesh: THREE.Mesh;
}

export const MolecularReaction3DView: React.FC<MolecularReaction3DViewProps> = ({
  initialReactionId,
}) => {
  const defaultId = initialReactionId || REACTION_3D_PRESETS[0].id;
  const [selectedReactionId, setSelectedReactionId] = useState<string>(defaultId);
  const [progress, setProgress] = useState<number>(0); // 0..1
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [modelStyle, setModelStyle] = useState<ModelStyle>('ball_stick');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [selectedAtomIndex, setSelectedAtomIndex] = useState<number | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);

  // Sync initialReactionId when parent changes modules
  useEffect(() => {
    if (initialReactionId && REACTION_3D_PRESETS.some((r) => r.id === initialReactionId)) {
      setSelectedReactionId(initialReactionId);
      setProgress(0);
      setIsPlaying(true);
      setSelectedAtomIndex(null);
    }
  }, [initialReactionId]);

  const activeReaction: Reaction3DPreset = useMemo(
    () => REACTION_3D_PRESETS.find((r) => r.id === selectedReactionId) || REACTION_3D_PRESETS[0],
    [selectedReactionId]
  );

  // Mutable refs for WebGL loop without tearing down canvas
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<number>(progress);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const speedRef = useRef<number>(speedMultiplier);
  const modelStyleRef = useRef<ModelStyle>(modelStyle);
  const showLabelsRef = useRef<boolean>(showLabels);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const selectedAtomRef = useRef<number | null>(selectedAtomIndex);
  const cameraResetGoalRef = useRef<boolean>(false);
  const playDirRef = useRef<1 | -1>(1);
  const pauseHoldRef = useRef<number>(0);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);
  useEffect(() => {
    modelStyleRef.current = modelStyle;
  }, [modelStyle]);
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);
  useEffect(() => {
    selectedAtomRef.current = selectedAtomIndex;
  }, [selectedAtomIndex]);

  // Persistent scene objects across reaction switches
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    moleculeRoot: THREE.Group;
    atomsRuntime: AtomRuntime[];
    bondsRuntime: BondRuntime[];
    electronsRuntime: ElectronRuntime[];
    sharedSphereGeo: THREE.SphereGeometry;
    sharedCylGeo: THREE.CylinderGeometry;
    sharedRingGeo: THREE.TorusGeometry;
    sharedElectronGeo: THREE.SphereGeometry;
    maxAniso: number;
  } | null>(null);

  // Build reaction scene graph inside existing Three.js scene
  const rebuildReactionGraph = (reaction: Reaction3DPreset) => {
    const bundle = sceneObjectsRef.current;
    if (!bundle) return;
    const {
      moleculeRoot,
      atomsRuntime,
      bondsRuntime,
      electronsRuntime,
      sharedSphereGeo,
      sharedCylGeo,
      sharedRingGeo,
      sharedElectronGeo,
      maxAniso,
    } = bundle;

    // Dispose dynamic materials & textures from previous reaction
    atomsRuntime.forEach((a) => {
      (a.sphere.material as THREE.Material).dispose();
      (a.ring.material as THREE.Material).dispose();
      a.spriteMat.map?.dispose();
      a.spriteMat.dispose();
    });
    bondsRuntime.forEach((b) => {
      b.material.dispose();
    });
    electronsRuntime.forEach((el) => {
      (el.mesh.material as THREE.Material).dispose();
    });

    while (moleculeRoot.children.length > 0) {
      moleculeRoot.remove(moleculeRoot.children[0]);
    }
    atomsRuntime.length = 0;
    bondsRuntime.length = 0;
    electronsRuntime.length = 0;

    // 1. Build composite atoms (sphere + valence ring + label sprite)
    reaction.atoms.forEach((spec, idx) => {
      const el = ELEMENT_SPECS[spec.element] || ELEMENT_SPECS.C;
      const group = new THREE.Group();
      group.position.set(spec.startPos[0], spec.startPos[1], spec.startPos[2]);

      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(el.color),
        metalness: el.metalness,
        roughness: el.roughness,
        clearcoat: el.metalness > 0.5 ? 0.35 : 0.75,
        clearcoatRoughness: 0.18,
      });

      const sphere = new THREE.Mesh(sharedSphereGeo, mat);
      sphere.scale.setScalar(el.radius);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      sphere.userData = { atomIndex: idx };
      sphere.layers.enable(1); // Raycasting layer
      group.add(sphere);

      const ringMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#38BDF8'),
        emissive: new THREE.Color('#0284C7'),
        emissiveIntensity: 0.5,
        metalness: 0.6,
        roughness: 0.25,
        transparent: true,
        opacity: 0,
      });
      const ring = new THREE.Mesh(sharedRingGeo, ringMat);
      ring.scale.setScalar(el.radius * 1.48);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      const initialLabel = spec.chargeStart ? `${el.symbol}${spec.chargeStart}` : el.symbol;
      const tex = createAtomSpriteTexture(initialLabel, el.color === '#F8FAFC' ? '#94A3B8' : el.color);
      tex.anisotropy = maxAniso;
      const spriteMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.68, 0.34, 1);
      sprite.position.set(0, el.radius + 0.38, 0);
      sprite.renderOrder = 10;
      group.add(sprite);

      moleculeRoot.add(group);
      atomsRuntime.push({
        spec,
        index: idx,
        group,
        sphere,
        ring,
        sprite,
        spriteMat,
        currentChargeText: initialLabel,
      });
    });

    // 2. Build composite bonds (up to 3 cylinders for triple bonds)
    reaction.bonds.forEach((bSpec) => {
      const maxOrder = Math.max(bSpec.orderStart, bSpec.orderEnd, 1);
      const group = new THREE.Group();
      const material = new THREE.MeshPhysicalMaterial({
        color: bSpec.isIonic ? _colIonic.clone() : _colNormal.clone(),
        metalness: 0.35,
        roughness: 0.28,
        transparent: true,
        opacity: bSpec.orderStart > 0 ? 1 : 0,
      });

      const cylinders: THREE.Mesh[] = [];
      for (let k = 0; k < maxOrder; k++) {
        const cyl = new THREE.Mesh(sharedCylGeo, material);
        cyl.castShadow = true;
        cyl.receiveShadow = true;
        group.add(cyl);
        cylinders.push(cyl);
      }

      moleculeRoot.add(group);
      bondsRuntime.push({
        spec: bSpec,
        group,
        cylinders,
        material,
      });
    });

    // 3. Build glowing electron transfer particles
    (reaction.electronTransfers || []).forEach((et) => {
      for (let i = 0; i < et.count; i++) {
        const eMat = new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          emissive: '#0EA5E9',
          emissiveIntensity: 1.6,
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: 0,
        });
        const mesh = new THREE.Mesh(sharedElectronGeo, eMat);
        mesh.visible = false;
        moleculeRoot.add(mesh);
        electronsRuntime.push({
          fromAtomIndex: et.fromAtomIndex,
          toAtomIndex: et.toAtomIndex,
          offsetIdx: i,
          totalCount: et.count,
          window: et.window,
          mesh,
        });
      }
    });
  };

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(300, container.clientWidth);
    const initH = Math.max(320, container.clientHeight);
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B1120');
    scene.fog = new THREE.FogExp2('#0B1120', 0.032);

    // Mandatory studio environment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 100);
    camera.position.set(0.4, 2.6, 8.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.2;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 0.1, 0);
    controls.update();

    const onControlStart = () => {
      cameraResetGoalRef.current = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#DBEAFE', '#0F172A', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFFBEB', 1.85);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38BDF8', 0.9);
    rimLight.position.set(-6, 3, -5);
    scene.add(rimLight);

    // Grounded Lab Stage Platform (Composite multi-part pedestal)
    const stageGroup = new THREE.Group();
    stageGroup.position.y = -2.25;

    const shadowTex = createContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.65 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    stageGroup.add(shadowPlane);

    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.9, 0.14, 64),
      new THREE.MeshStandardMaterial({ color: '#1E293B', metalness: 0.55, roughness: 0.42 })
    );
    baseDisc.receiveShadow = true;
    baseDisc.position.y = -0.07;
    stageGroup.add(baseDisc);

    const innerPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(4.25, 4.25, 0.02, 64),
      new THREE.MeshStandardMaterial({ color: '#0F172A', metalness: 0.25, roughness: 0.65 })
    );
    innerPlate.receiveShadow = true;
    innerPlate.position.y = 0.02;
    stageGroup.add(innerPlate);

    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(4.42, 0.045, 16, 80),
      new THREE.MeshStandardMaterial({ color: '#10B981', metalness: 0.75, roughness: 0.25 })
    );
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.position.y = 0.025;
    stageGroup.add(rimTorus);

    const gridHelper = new THREE.PolarGridHelper(4.1, 8, 4, 64, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.035;
    stageGroup.add(gridHelper);

    scene.add(stageGroup);

    const moleculeRoot = new THREE.Group();
    scene.add(moleculeRoot);

    const sharedSphereGeo = new THREE.SphereGeometry(1, 32, 24);
    const sharedCylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
    const sharedRingGeo = new THREE.TorusGeometry(1, 0.08, 12, 36);
    const sharedElectronGeo = new THREE.SphereGeometry(0.11, 16, 12);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    sceneObjectsRef.current = {
      scene,
      renderer,
      camera,
      controls,
      moleculeRoot,
      atomsRuntime: [],
      bondsRuntime: [],
      electronsRuntime: [],
      sharedSphereGeo,
      sharedCylGeo,
      sharedRingGeo,
      sharedElectronGeo,
      maxAniso,
    };

    rebuildReactionGraph(activeReaction);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster for atom inspection on tap/click
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerDownPos.x;
      const dy = ev.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 36) return; // Dragged to orbit, ignore click

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const currentBundle = sceneObjectsRef.current;
      if (!currentBundle) return;
      const atomMeshes = currentBundle.atomsRuntime.map((a) => a.sphere);
      const hits = raycaster.intersectObjects(atomMeshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.atomIndex;
        if (typeof idx === 'number') {
          setSelectedAtomIndex(idx);
        }
      } else {
        setSelectedAtomIndex(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // WebGL context loss guard
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const handleContextRestored = () => {
      setWebglUnavailable(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // ResizeObserver for crisp layout adaptation
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(240, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Frame pacing & animation loop
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let syncTimer = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const updateDynamicScene = (dt: number, elapsedSec: number) => {
      const b = sceneObjectsRef.current;
      if (!b) return;

      // Advance reaction progress if playing
      if (isPlayingRef.current) {
        if (pauseHoldRef.current > 0) {
          pauseHoldRef.current = Math.max(0, pauseHoldRef.current - dt);
        } else {
          let nextP = progressRef.current + playDirRef.current * dt * 0.14 * speedRef.current;
          if (nextP >= 1) {
            nextP = 1;
            playDirRef.current = -1;
            pauseHoldRef.current = 1.25; // Pause briefly on products
          } else if (nextP <= 0) {
            nextP = 0;
            playDirRef.current = 1;
            pauseHoldRef.current = 0.85; // Pause briefly on reactants
          }
          progressRef.current = nextP;
          syncTimer += dt;
          if (syncTimer > 0.04) {
            syncTimer = 0;
            setProgress(nextP);
          }
        }
      }

      const t = progressRef.current;
      const isSpaceFilling = modelStyleRef.current === 'space_filling';
      const labelsVisible = showLabelsRef.current;
      const activeSel = selectedAtomRef.current;

      // Smooth camera reset damping
      if (cameraResetGoalRef.current) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0.4, 7, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.6, 7, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 8.2, 7, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, 0, 7, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, 0.1, 7, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, 0, 7, dt);
        if (camera.position.distanceTo(_vA.set(0.4, 2.6, 8.2)) < 0.03) {
          cameraResetGoalRef.current = false;
        }
      }

      // Auto-rotate molecule gently
      if (autoRotateRef.current) {
        b.moleculeRoot.rotation.y += dt * 0.35;
      }

      // 1. Update atom positions, scales, charge labels & selection rings
      for (let i = 0; i < b.atomsRuntime.length; i++) {
        const atom = b.atomsRuntime[i];
        const el = ELEMENT_SPECS[atom.spec.element] || ELEMENT_SPECS.C;
        evalBezierTrajectory(atom.spec.startPos, atom.spec.tsPos, atom.spec.endPos, t, _vA);
        // Subtle thermal vibration
        const vibAmp = 0.015;
        _vA.y += Math.sin(elapsedSec * 2.5 + i * 1.7) * vibAmp;
        atom.group.position.copy(_vA);

        const targetRadius = isSpaceFilling ? el.vdwRadius : el.radius;
        const currR = atom.sphere.scale.x;
        const nextR = THREE.MathUtils.damp(currR, targetRadius, 10, dt);
        atom.sphere.scale.setScalar(nextR);

        // Update charge label dynamically as reaction crosses 0.5
        const activeCharge = t < 0.5 ? atom.spec.chargeStart || '' : atom.spec.chargeEnd || '';
        const desiredText = `${el.symbol}${activeCharge}`;
        if (desiredText !== atom.currentChargeText) {
          atom.currentChargeText = desiredText;
          const newTex = createAtomSpriteTexture(
            desiredText,
            el.color === '#F8FAFC' ? '#94A3B8' : el.color
          );
          newTex.anisotropy = b.maxAniso;
          atom.spriteMat.map?.dispose();
          atom.spriteMat.map = newTex;
          atom.spriteMat.needsUpdate = true;
        }

        atom.sprite.visible = labelsVisible && !isSpaceFilling;
        atom.sprite.position.y = nextR + 0.36;

        // Selection or ionic halo ring
        const ringMat = atom.ring.material as THREE.MeshStandardMaterial;
        const isSelected = activeSel === i;
        const hasCharge = activeCharge.length > 0;
        const targetRingOpacity = isSelected ? 0.95 : hasCharge ? 0.45 : 0;
        ringMat.opacity = THREE.MathUtils.damp(ringMat.opacity, targetRingOpacity, 10, dt);
        ringMat.color.set(isSelected ? '#FACC15' : '#38BDF8');
        ringMat.emissive.set(isSelected ? '#EAB308' : '#0284C7');
        atom.ring.scale.setScalar(nextR * (isSelected ? 1.58 : 1.44));
        atom.ring.rotation.z += dt * 1.2;
      }

      // 2. Update bonds (cleavage & formation)
      for (let i = 0; i < b.bondsRuntime.length; i++) {
        const bond = b.bondsRuntime[i];
        const atomA = b.atomsRuntime[bond.spec.a];
        const atomB = b.atomsRuntime[bond.spec.b];
        if (!atomA || !atomB) continue;

        if (isSpaceFilling) {
          bond.group.visible = false;
          continue;
        }

        const os = bond.spec.orderStart;
        const oe = bond.spec.orderEnd;

        let opacity = 1;
        let activeOrder = Math.max(os, oe, 1);
        let radiusScale = 1;

        if (os > 0 && oe === 0) {
          // Breaking bond: fades out across t in [0.24, 0.55]
          if (t >= 0.55) {
            opacity = 0;
          } else if (t > 0.24) {
            opacity = 1 - THREE.MathUtils.smoothstep(t, 0.24, 0.55);
          }
          activeOrder = os;
          _colTmp.copy(bond.spec.isIonic ? _colIonic : _colNormal);
          if (t > 0.2 && t < 0.55) {
            _colTmp.lerp(_colBreak, THREE.MathUtils.smoothstep(t, 0.2, 0.42));
            radiusScale = 1 - 0.35 * THREE.MathUtils.smoothstep(t, 0.25, 0.55);
          }
        } else if (os === 0 && oe > 0) {
          // Forming bond: emerges across t in [0.44, 0.76]
          if (t <= 0.44) {
            opacity = 0;
          } else if (t < 0.76) {
            opacity = THREE.MathUtils.smoothstep(t, 0.44, 0.76);
          }
          activeOrder = oe;
          _colTmp.copy(bond.spec.isIonic ? _colIonic : _colNormal);
          if (t > 0.44 && t < 0.85) {
            const blend = 1 - THREE.MathUtils.smoothstep(t, 0.65, 0.88);
            _colTmp.lerp(_colForm, blend);
            radiusScale = 0.65 + 0.35 * THREE.MathUtils.smoothstep(t, 0.44, 0.76);
          }
        } else if (os === 2 && oe === 1) {
          // Double bond opening to single bond (e.g. C=C -> C-C)
          activeOrder = t < 0.55 ? 2 : 1;
          _colTmp.copy(_colNormal);
          if (t > 0.25 && t < 0.55) {
            _colTmp.lerp(_colBreak, 0.45);
          }
        } else {
          activeOrder = os;
          _colTmp.copy(bond.spec.isIonic ? _colIonic : _colNormal);
        }

        if (opacity <= 0.02) {
          bond.group.visible = false;
          continue;
        }

        bond.group.visible = true;
        bond.material.opacity = opacity;
        bond.material.color.copy(_colTmp);

        _vA.copy(atomA.group.position);
        _vB.copy(atomB.group.position);
        _vMid.addVectors(_vA, _vB).multiplyScalar(0.5);
        _dir.subVectors(_vB, _vA);
        const len = _dir.length();
        if (len < 0.001) {
          bond.group.visible = false;
          continue;
        }
        _dir.divideScalar(len);

        // Perpendicular offset vector for double / triple bonds
        _perp.crossVectors(_dir, _up);
        if (_perp.lengthSq() < 0.001) {
          _perp.crossVectors(_dir, _altAxis);
        }
        _perp.normalize();
        _quat.setFromUnitVectors(_up, _dir);

        const baseStickRadius = (activeOrder > 1 ? 0.062 : 0.085) * radiusScale;
        const spacing = activeOrder === 3 ? 0.14 : 0.16;

        for (let k = 0; k < bond.cylinders.length; k++) {
          const cyl = bond.cylinders[k];
          if (k >= activeOrder) {
            cyl.visible = false;
            continue;
          }
          cyl.visible = true;
          const offsetFactor = activeOrder === 1 ? 0 : k - (activeOrder - 1) * 0.5;
          cyl.position.copy(_vMid).addScaledVector(_perp, offsetFactor * spacing);
          cyl.quaternion.copy(_quat);
          cyl.scale.set(baseStickRadius, Math.max(0.1, len * 0.92), baseStickRadius);
        }
      }

      // 3. Update glowing electron transfer arcs
      for (let i = 0; i < b.electronsRuntime.length; i++) {
        const el = b.electronsRuntime[i];
        const [wStart, wEnd] = el.window;
        if (t < wStart || t > wEnd) {
          el.mesh.visible = false;
          continue;
        }
        const aFrom = b.atomsRuntime[el.fromAtomIndex];
        const aTo = b.atomsRuntime[el.toAtomIndex];
        if (!aFrom || !aTo) continue;

        const localU = (t - wStart) / Math.max(0.001, wEnd - wStart);
        const staggeredU = (localU + el.offsetIdx * 0.14) % 1;
        _vA.copy(aFrom.group.position);
        _vB.copy(aTo.group.position);
        _vMid.lerpVectors(_vA, _vB, staggeredU);
        _vMid.y += Math.sin(staggeredU * Math.PI) * 1.15 + (el.offsetIdx - (el.totalCount - 1) * 0.5) * 0.25;
        el.mesh.position.copy(_vMid);
        el.mesh.visible = true;
        const eMat = el.mesh.material as THREE.MeshStandardMaterial;
        eMat.opacity = Math.sin(staggeredU * Math.PI);
      }
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      updateDynamicScene(dt, now / 1000);
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      // Dispose static & dynamic resources
      const b = sceneObjectsRef.current;
      if (b) {
        b.atomsRuntime.forEach((a) => {
          (a.sphere.material as THREE.Material).dispose();
          (a.ring.material as THREE.Material).dispose();
          a.spriteMat.map?.dispose();
          a.spriteMat.dispose();
        });
        b.bondsRuntime.forEach((bd) => bd.material.dispose());
        b.electronsRuntime.forEach((el) => (el.mesh.material as THREE.Material).dispose());
        b.sharedSphereGeo.dispose();
        b.sharedCylGeo.dispose();
        b.sharedRingGeo.dispose();
        b.sharedElectronGeo.dispose();
      }
      shadowTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneObjectsRef.current = null;
    };
    // Intentionally mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild reaction molecules whenever user switches selectedReactionId
  useEffect(() => {
    if (sceneObjectsRef.current) {
      rebuildReactionGraph(activeReaction);
      progressRef.current = 0;
      playDirRef.current = 1;
      pauseHoldRef.current = 0.6;
      setProgress(0);
    }
  }, [activeReaction]);

  const currentStage = useMemo(() => {
    if (progress < 0.3) {
      return {
        label: 'Chất tham gia (Trước phản ứng)',
        toneClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
        description: activeReaction.descriptionStart,
      };
    }
    if (progress < 0.7) {
      return {
        label: 'Trạng thái chuyển tiếp (Đứt & nối liên kết)',
        toneClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
        description: activeReaction.descriptionTS,
      };
    }
    return {
      label: 'Sản phẩm sau phản ứng',
      toneClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
      description: activeReaction.descriptionEnd,
    };
  }, [progress, activeReaction]);

  const inspectedAtom = useMemo(() => {
    if (selectedAtomIndex === null) return null;
    const atom = activeReaction.atoms[selectedAtomIndex];
    if (!atom) return null;
    const spec = ELEMENT_SPECS[atom.element] || ELEMENT_SPECS.C;
    return { atom, spec };
  }, [selectedAtomIndex, activeReaction]);

  const reactionElementsUsed = useMemo(() => {
    const seen = new Set<string>();
    activeReaction.atoms.forEach((a) => seen.add(a.element));
    return Array.from(seen).map((sym) => ELEMENT_SPECS[sym]).filter(Boolean);
  }, [activeReaction]);

  return (
    <div className="space-y-4">
      {/* Reaction Selector Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <Atom size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-emerald-700">
              Chế độ Tương tác 3D · Xoay 360° &amp; Quan sát biến đổi phân tử
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
              {activeReaction.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="reaction-3d-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Chọn phản ứng 3D:
          </label>
          <select
            id="reaction-3d-select"
            value={selectedReactionId}
            onChange={(e) => {
              setSelectedReactionId(e.target.value);
              setSelectedAtomIndex(null);
              setIsPlaying(true);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[280px] sm:max-w-[340px]"
          >
            {REACTION_3D_PRESETS.map((rx) => (
              <option key={rx.id} value={rx.id}>
                {rx.grade} · {rx.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interactive 3D Viewport Stage */}
      <div className="relative w-full h-[460px] sm:h-[580px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-sm">
        {/* Isolated WebGL mount container */}
        <div
          ref={mountRef}
          className="w-full h-full touch-none select-none cursor-grab active:cursor-grabbing"
          aria-label="Không gian 3D tương tác mô hình phân tử hóa học"
        />

        {webglUnavailable && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-200 space-y-2">
            <Atom size={36} className="text-emerald-400" />
            <p className="text-sm font-bold">Trình duyệt tạm thời không khả dụng WebGL 3D</p>
            <p className="text-xs text-slate-400 max-w-md">
              Hãy bật tăng tốc phần cứng trên trình duyệt hoặc chuyển về chế độ Mô phỏng 2D để tiếp tục quan sát thí nghiệm.
            </p>
          </div>
        )}

        {/* Top-left Minimal Equation & Stage Badge (No backdrop-blur over WebGL) */}
        <div className="pointer-events-none absolute top-3 left-3 right-3 sm:right-auto sm:max-w-lg z-10 flex flex-col gap-1.5">
          <div className="inline-flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white">
            <span className="font-mono font-bold text-xs sm:text-sm tracking-tight text-emerald-300">
              {activeReaction.equation}
            </span>
            {activeReaction.condition && (
              <span className="text-[11px] font-medium text-slate-300">
                · {activeReaction.condition}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${currentStage.toneClass}`}>
              {currentStage.label} · {Math.round(progress * 100)}%
            </span>
            {activeReaction.catalystSurfaceLabel && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-900/85 border border-slate-700 text-[11px] font-medium text-slate-300">
                {activeReaction.catalystSurfaceLabel}
              </span>
            )}
          </div>
        </div>

        {/* Subtle Orbit Gesture Hint (Top-right on desktop, hidden when atom inspected) */}
        {!inspectedAtom ? (
          <div className="pointer-events-none hidden sm:flex items-center gap-1.5 absolute top-3 right-3 z-10 px-2.5 py-1.5 rounded-lg bg-slate-900/85 border border-slate-700/80 text-[11px] font-medium text-slate-300">
            <Hand size={13} className="text-emerald-400" />
            <span>Kéo để xoay 360° · Cuộn để phóng to · Chạm nguyên tử để xem chi tiết</span>
          </div>
        ) : (
          <div className="absolute top-3 right-3 z-20 max-w-[260px] bg-slate-900/95 border border-amber-400/50 rounded-xl p-3 text-white shadow-lg">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700/80">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                  style={{ backgroundColor: inspectedAtom.spec.color }}
                />
                <span className="text-xs font-extrabold">
                  {inspectedAtom.spec.symbol} — {inspectedAtom.spec.nameVi}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAtomIndex(null)}
                className="text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Đóng
              </button>
            </div>
            <div className="mt-1.5 space-y-1 text-[11px] text-slate-300">
              <div className="font-mono">
                Số hiệu Z = {inspectedAtom.spec.atomicNumber}
                {(inspectedAtom.atom.chargeStart || inspectedAtom.atom.chargeEnd) && (
                  <span>
                    {' '}
                    · Điện tích: {inspectedAtom.atom.chargeStart || '⁰'} → {inspectedAtom.atom.chargeEnd || '⁰'}
                  </span>
                )}
              </div>
              <p className="text-slate-200 leading-snug">{inspectedAtom.atom.roleVi}</p>
            </div>
          </div>
        )}

        {/* Unified Collapsible Bottom Control Dock (Zero Viewport Center Occlusion) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-[880px] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setIsDockCollapsed((v) => !v)}
            className="mb-1.5 px-3 py-1 rounded-t-xl rounded-b-lg bg-slate-900/95 border border-slate-700 text-[11px] font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            {isDockCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{isDockCollapsed ? 'Mở bảng điều khiển 3D' : 'Thu gọn điều khiển'}</span>
          </button>

          {!isDockCollapsed && (
            <div className="w-full rounded-2xl bg-slate-900/95 border border-slate-700/90 p-3 sm:p-3.5 text-white space-y-2.5 shadow-xl">
              {/* Row 1: Play/Pause + Reaction Progress Scrubber + Stage Jump */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isPlaying
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    }`}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'Tạm dừng' : 'Chạy phản ứng'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      progressRef.current = 0;
                      setProgress(0);
                    }}
                    title="Về đầu phản ứng"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                <div className="flex-1 flex items-center gap-2.5 min-w-0">
                  <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                    Tiến trình:
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(progress * 100)}
                    onChange={(e) => {
                      setIsPlaying(false);
                      const val = Number(e.target.value) / 100;
                      progressRef.current = val;
                      setProgress(val);
                    }}
                    aria-label="Thanh trượt tiến trình phản ứng hóa học"
                    className="flex-1 accent-emerald-400 cursor-pointer"
                  />
                  <span className="font-mono tabular-nums text-xs font-bold text-emerald-300 w-10 text-right shrink-0">
                    {Math.round(progress * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {[
                    { label: 'Chất đầu', val: 0 },
                    { label: 'Chuyển tiếp', val: 0.5 },
                    { label: 'Sản phẩm', val: 1 },
                  ].map((st) => (
                    <button
                      key={st.label}
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        progressRef.current = st.val;
                        setProgress(st.val);
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                        Math.abs(progress - st.val) < 0.08
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Model Mode, Labels, Auto Rotate, Speed, Camera Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setModelStyle('ball_stick')}
                      className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                        modelStyle === 'ball_stick'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Cầu – Que
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelStyle('space_filling')}
                      className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                        modelStyle === 'space_filling'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Mô hình đặc
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLabels((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 cursor-pointer ${
                      showLabels
                        ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <Tag size={12} />
                    <span>Nhãn nguyên tử</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoRotate((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 cursor-pointer ${
                      autoRotate
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <RefreshCw size={12} />
                    <span>Tự xoay</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-semibold">Tốc độ:</span>
                  {[0.5, 1, 1.5].map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setSpeedMultiplier(sp)}
                      className={`px-2 py-0.5 rounded-md font-mono font-bold border cursor-pointer ${
                        speedMultiplier === sp
                          ? 'bg-slate-200 text-slate-950 border-white'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      cameraResetGoalRef.current = true;
                    }}
                    className="ml-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold cursor-pointer"
                  >
                    Đặt lại góc nhìn
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pedagogical Observation Deck Below 3D Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm text-slate-900">
              <Sparkles size={16} className="text-emerald-600" />
              <span>Diễn biến Cơ chế &amp; Biến đổi Phân tử</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {activeReaction.grade} · {activeReaction.categoryLabel}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {currentStage.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-amber-500 inline-block" />
              Liên kết đang đứt gãy (màu hổ phách)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Liên kết mới hình thành (màu ngọc lục bảo)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-sky-400 inline-block" />
              Liên kết ion / Dòng electron e⁻
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2.5">
          <div className="text-xs sm:text-sm font-extrabold text-slate-900">
            Bảng màu nguyên tử CPK trong phản ứng
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {reactionElementsUsed.map((el) => (
              <div
                key={el.symbol}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <span
                  className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                  style={{ backgroundColor: el.color }}
                />
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900 block leading-none">{el.symbol}</span>
                  <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                    {el.nameVi.split(' ')[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

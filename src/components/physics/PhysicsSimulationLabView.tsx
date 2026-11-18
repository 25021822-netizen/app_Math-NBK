import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import katex from 'katex';
import {
  Activity,
  ArrowUpRight,
  Waves,
  Zap,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Gauge,
  Radio,
  Eye,
  Cpu,
  Sun,
  Flame,
  Atom,
  Volume2,
  Thermometer,
  Disc,
  Orbit,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import type { ExtraPhysicsModuleId } from './ExtraPhysicsSimulations';
import type { ModernThermalModuleId } from './ModernAndThermalSimulations';

const ExtraPhysicsSimulations = lazy(() =>
  import('./ExtraPhysicsSimulations').then((m) => ({ default: m.ExtraPhysicsSimulations }))
);
const ModernAndThermalSimulations = lazy(() =>
  import('./ModernAndThermalSimulations').then((m) => ({ default: m.ModernAndThermalSimulations }))
);

type PhysicsModuleId =
  | 'oscillation'
  | 'projectile'
  | 'waves'
  | 'rlc'
  | ExtraPhysicsModuleId
  | ModernThermalModuleId;
type OscillationType = 'pendulum' | 'spring';
type WaveType = 'ripple' | 'young';
type PhysicsCategoryId = 'all' | 'mechanics' | 'waves' | 'optics' | 'electricity' | 'thermal' | 'nuclear';

interface PhysicsExperimentMeta {
  id: PhysicsModuleId;
  title: string;
  category: Exclude<PhysicsCategoryId, 'all'>;
  categoryLabel: string;
  grade: string;
  summary: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const PHYSICS_EXPERIMENTS: PhysicsExperimentMeta[] = [
  {
    id: 'oscillation',
    title: 'Dao Động Điều Hòa & Bảo Toàn Cơ Năng',
    category: 'mechanics',
    categoryLabel: 'Cơ học',
    grade: 'Lớp 11',
    summary: 'Con lắc đơn, con lắc lò xo, đồ thị động năng Wđ, thế năng Wt và cơ năng W theo thời gian.',
    icon: Activity,
  },
  {
    id: 'projectile',
    title: 'Chuyển Động Ném Xiên',
    category: 'mechanics',
    categoryLabel: 'Cơ học',
    grade: 'Lớp 10',
    summary: 'Khảo sát quỹ đạo parabol, tầm xa, độ cao cực đại và ảnh hưởng của lực cản không khí.',
    icon: ArrowUpRight,
  },
  {
    id: 'waves',
    title: 'Giao Thoa Sóng Nước 2 Nguồn',
    category: 'waves',
    categoryLabel: 'Sóng & Âm',
    grade: 'Lớp 11',
    summary: 'Quan sát vân cực đại, cực tiểu giao thoa từ 2 nguồn kết hợp cùng pha hoặc ngược pha.',
    icon: Waves,
  },
  {
    id: 'standingWave',
    title: 'Sóng Dừng Trên Dây',
    category: 'waves',
    categoryLabel: 'Sóng & Âm',
    grade: 'Lớp 11',
    summary: 'Cộng hưởng sóng dừng với 2 đầu cố định hoặc 1 đầu tự do, đếm số nút và bụng sóng.',
    icon: Radio,
  },
  {
    id: 'soundWave',
    title: 'Sóng Âm Thanh & Dao Động Ký',
    category: 'waves',
    categoryLabel: 'Sóng & Âm',
    grade: 'Lớp 11',
    summary: 'Lan truyền sóng dọc qua không khí, nước, thép kèm họa âm và phát âm thanh thực.',
    icon: Volume2,
  },
  {
    id: 'lightInterference',
    title: 'Giao Thoa Ánh Sáng (Y-âng)',
    category: 'optics',
    categoryLabel: 'Quang học',
    grade: 'Lớp 11',
    summary: 'Ánh sáng đơn sắc, giao thoa 2 bức xạ tìm vân trùng và quang phổ ánh sáng trắng.',
    icon: Disc,
  },
  {
    id: 'optics',
    title: 'Thấu Kính Quang Hình',
    category: 'optics',
    categoryLabel: 'Quang học',
    grade: 'Lớp 11',
    summary: 'Dựng ảnh thật, ảnh ảo qua thấu kính hội tụ và thấu kính phân kỳ bằng đường truyền tia sáng.',
    icon: Eye,
  },
  {
    id: 'photoelectric',
    title: 'Hiệu Ứng Quang Điện Ngoài',
    category: 'optics',
    categoryLabel: 'Lượng tử',
    grade: 'Lớp 12',
    summary: 'Thử nghiệm kim loại Catôt, giới hạn quang điện λ₀, hiệu điện thế hãm Uh và đường đặc tuyến I-U.',
    icon: Sun,
  },
  {
    id: 'dcCircuit',
    title: 'Định Luật Ôm Toàn Mạch',
    category: 'electricity',
    categoryLabel: 'Điện học',
    grade: 'Lớp 11',
    summary: 'Ghép nguồn nối tiếp/song song, đo cường độ dòng điện và cực đại công suất mạch ngoài P(R).',
    icon: Cpu,
  },
  {
    id: 'rlc',
    title: 'Mạch Điện Xoay Chiều RLC',
    category: 'electricity',
    categoryLabel: 'Điện học',
    grade: 'Lớp 12',
    summary: 'Giản đồ véc-tơ Fresnel, độ lệch pha φ, cộng hưởng điện và đồ thị u(t), i(t).',
    icon: Zap,
  },
  {
    id: 'idealGas',
    title: 'Khí Lý Tưởng & Đẳng Quá Trình',
    category: 'thermal',
    categoryLabel: 'Nhiệt học',
    grade: 'Lớp 12',
    summary: 'Chuyển động phân tử, chỉnh p-V-T-n và đồ thị 3 hệ trục p-V, p-T, V-T kiểm chứng pV = nRT.',
    icon: Flame,
  },
  {
    id: 'thermalLab',
    title: 'Đo Nhiệt Dung Riêng, Nóng Chảy, Hóa Hơi',
    category: 'thermal',
    categoryLabel: 'Nhiệt học',
    grade: 'Lớp 12',
    summary: 'Nhiệt lượng kế đo c, λ, L với đồ thị nhiệt độ theo thời gian T(t) qua các pha.',
    icon: Thermometer,
  },
  {
    id: 'rutherford',
    title: 'Thí Nghiệm Tán Xạ Rutherford',
    category: 'nuclear',
    categoryLabel: 'Hạt nhân',
    grade: 'Lớp 12',
    summary: 'Bắn chùm hạt α qua lá vàng, bạc, đồng; thống kê hạt xuyên thẳng, lệch góc và bật ngược.',
    icon: Orbit,
  },
  {
    id: 'nuclearFusion',
    title: 'Phản Ứng Nhiệt Hạch',
    category: 'nuclear',
    categoryLabel: 'Hạt nhân',
    grade: 'Lớp 12',
    summary: 'Tổng hợp hạt nhân nhẹ D + T, D + D vượt hàng rào đẩy Coulomb theo nhiệt độ plasma.',
    icon: Flame,
  },
  {
    id: 'nuclearFission',
    title: 'Phản Ứng Phân Hạch Dây Chuyền',
    category: 'nuclear',
    categoryLabel: 'Hạt nhân',
    grade: 'Lớp 12',
    summary: 'Phân hạch hạt nhân U-235 và điều chỉnh thanh hấp thụ Boron kiểm soát hệ số nhân k.',
    icon: Atom,
  },
];

function renderLatex(tex: string, displayMode = false): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode });
  } catch {
    return tex;
  }
}

function wavelengthToRgb(nm: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    b = 1;
  } else if (nm >= 440 && nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm >= 490 && nm < 510) {
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
  } else if (nm >= 580 && nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
  } else if (nm >= 645 && nm <= 760) {
    r = 1;
  }
  const factor =
    nm < 420
      ? 0.35 + (0.65 * (nm - 380)) / 40
      : nm > 700
      ? 0.35 + (0.65 * (760 - nm)) / 60
      : 1;
  return [
    Math.round(255 * Math.pow(r * factor, 0.8)),
    Math.round(255 * Math.pow(g * factor, 0.8)),
    Math.round(255 * Math.pow(b * factor, 0.8)),
  ];
}

export const PhysicsSimulationLabView: React.FC = () => {
  const [activeModule, setActiveModule] = useState<PhysicsModuleId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PhysicsCategoryId>('all');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1);

  // ===========================================================================
  // 1. DAO ĐỘNG ĐIỀU HÒA (CON LẮC ĐƠN & CON LẮC LÒ XO)
  // ===========================================================================
  const [oscType, setOscType] = useState<OscillationType>('pendulum');
  const [pendulumLength, setPendulumLength] = useState<number>(1.2); // m
  const [pendulumMass, setPendulumMass] = useState<number>(1.0); // kg
  const [pendulumAngleDeg, setPendulumAngleDeg] = useState<number>(18); // độ
  const [springK, setSpringK] = useState<number>(40); // N/m
  const [springMass, setSpringMass] = useState<number>(0.4); // kg
  const [springAmpCm, setSpringAmpCm] = useState<number>(10); // cm
  const [gravity, setGravity] = useState<number>(9.81); // m/s^2
  const [damping, setDamping] = useState<number>(0); // hệ số tắt dần
  const [showVectorsOsc, setShowVectorsOsc] = useState<boolean>(true);
  const [showEnergyBarsOsc, setShowEnergyBarsOsc] = useState<boolean>(true);
  const [oscGraphMode, setOscGraphMode] = useState<'both' | 'kinematics' | 'energy'>('both');
  const [oscTelemetry, setOscTelemetry] = useState({
    t: 0,
    x: 0,
    v: 0,
    ek: 0,
    ep: 0,
    eTotal: 0,
    eInitial: 0,
  });

  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const oscStateRef = useRef({
    t: 0,
    theta: (18 * Math.PI) / 180,
    omega: 0,
    x: 0.1,
    v: 0,
    eInitial: 1.0 * 9.81 * 1.2 * (1 - Math.cos((18 * Math.PI) / 180)),
    trail: [] as { x: number; y: number }[],
    history: [] as { t: number; x: number; v: number; ek: number; ep: number; eTotal: number }[],
  });

  const computeInitialOscEnergy = (
    type: OscillationType = oscType,
    len = pendulumLength,
    pMass = pendulumMass,
    angleDeg = pendulumAngleDeg,
    gVal = gravity,
    kVal = springK,
    ampCm = springAmpCm
  ) => {
    if (type === 'pendulum') {
      const rad = (angleDeg * Math.PI) / 180;
      return pMass * gVal * len * (1 - Math.cos(rad));
    }
    const ampM = ampCm / 100;
    return 0.5 * kVal * ampM * ampM;
  };

  const resetOscillation = (
    angleDeg = pendulumAngleDeg,
    ampCm = springAmpCm,
    type = oscType
  ) => {
    const e0 = computeInitialOscEnergy(
      type,
      pendulumLength,
      pendulumMass,
      angleDeg,
      gravity,
      springK,
      ampCm
    );
    oscStateRef.current = {
      t: 0,
      theta: (angleDeg * Math.PI) / 180,
      omega: 0,
      x: ampCm / 100,
      v: 0,
      eInitial: e0,
      trail: [],
      history: [],
    };
  };

  // ===========================================================================
  // 2. CHUYỂN ĐỘNG NÉM XIÊN
  // ===========================================================================
  const [projV0, setProjV0] = useState<number>(28); // m/s
  const [projAngleDeg, setProjAngleDeg] = useState<number>(45); // độ
  const [projH0, setProjH0] = useState<number>(2); // m
  const [projG, setProjG] = useState<number>(9.81); // m/s^2
  const [projDrag, setProjDrag] = useState<boolean>(false);
  const [projDragCoeff, setProjDragCoeff] = useState<number>(0.04);
  const [projTelemetry, setProjTelemetry] = useState({
    t: 0,
    x: 0,
    y: 2,
    vx: 0,
    vy: 0,
    v: 28,
    finished: false,
  });

  const projCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const projStateRef = useRef({
    t: 0,
    x: 0,
    y: 2,
    vx: 28 * Math.cos((45 * Math.PI) / 180),
    vy: 28 * Math.sin((45 * Math.PI) / 180),
    path: [{ x: 0, y: 2 }],
    idealPath: [] as { x: number; y: number }[],
    markers: [] as { x: number; y: number; t: number }[],
    lastMarkerT: 0,
    finished: false,
  });

  const projTheoretical = useMemo(() => {
    const rad = (projAngleDeg * Math.PI) / 180;
    const vx0 = projV0 * Math.cos(rad);
    const vy0 = projV0 * Math.sin(rad);
    const tApex = vy0 > 0 ? vy0 / projG : 0;
    const hMax = projH0 + (vy0 > 0 ? (vy0 * vy0) / (2 * projG) : 0);
    const disc = vy0 * vy0 + 2 * projG * projH0;
    const tFlight = (vy0 + Math.sqrt(Math.max(0, disc))) / projG;
    const range = vx0 * tFlight;
    const vImpact = Math.sqrt(vx0 * vx0 + Math.pow(vy0 - projG * tFlight, 2));
    return { tApex, hMax, tFlight, range, vImpact, vx0, vy0 };
  }, [projV0, projAngleDeg, projH0, projG]);

  const resetProjectile = (
    v0 = projV0,
    deg = projAngleDeg,
    h0 = projH0,
    gVal = projG
  ) => {
    const rad = (deg * Math.PI) / 180;
    const vx0 = v0 * Math.cos(rad);
    const vy0 = v0 * Math.sin(rad);
    const disc = vy0 * vy0 + 2 * gVal * h0;
    const tTotal = (vy0 + Math.sqrt(Math.max(0, disc))) / gVal;
    const ideal: { x: number; y: number }[] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const ti = (tTotal * i) / steps;
      ideal.push({
        x: vx0 * ti,
        y: Math.max(0, h0 + vy0 * ti - 0.5 * gVal * ti * ti),
      });
    }
    projStateRef.current = {
      t: 0,
      x: 0,
      y: h0,
      vx: vx0,
      vy: vy0,
      path: [{ x: 0, y: h0 }],
      idealPath: ideal,
      markers: [{ x: 0, y: h0, t: 0 }],
      lastMarkerT: 0,
      finished: false,
    };
  };

  useEffect(() => {
    resetProjectile(projV0, projAngleDeg, projH0, projG);
  }, [projV0, projAngleDeg, projH0, projG]);

  // ===========================================================================
  // 3. GIAO THOA SÓNG CƠ & THÍ NGHIỆM Y-ÂNG
  // ===========================================================================
  const [waveMode, setWaveMode] = useState<WaveType>('ripple');
  const [waveLambdaCm, setWaveLambdaCm] = useState<number>(3.2); // cm
  const [sourceDistCm, setSourceDistCm] = useState<number>(14); // cm
  const [waveFreqHz, setWaveFreqHz] = useState<number>(2.5); // Hz
  const [oppositePhase, setOppositePhase] = useState<boolean>(false);
  const [probePos, setProbePos] = useState<{ xNorm: number; yNorm: number }>({
    xNorm: 0.62,
    yNorm: 0.28,
  });

  // Young's double slit parameters
  const [youngLambdaNm, setYoungLambdaNm] = useState<number>(550); // nm (lục)
  const [youngSlitAMm, setYoungSlitAMm] = useState<number>(1.2); // mm
  const [youngDistDM, setYoungDistDM] = useState<number>(2.0); // m
  const [youngProbeXMm, setYoungProbeXMm] = useState<number>(1.83); // mm

  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wavePhaseRef = useRef<number>(0);

  // ===========================================================================
  // 4. MẠCH ĐIỆN XOAY CHIỀU RLC NỐI TIẾP
  // ===========================================================================
  const [rlcR, setRlcR] = useState<number>(60); // Ohm
  const [rlcLmH, setRlcLmH] = useState<number>(318); // mH
  const [rlcCuF, setRlcCuF] = useState<number>(31.8); // uF
  const [rlcFreqHz, setRlcFreqHz] = useState<number>(50); // Hz
  const [rlcUrms, setRlcUrms] = useState<number>(120); // V

  const rlcCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rlcPhaseRef = useRef<number>(0);

  const rlcCalc = useMemo(() => {
    const omega = 2 * Math.PI * rlcFreqHz;
    const L = rlcLmH / 1000;
    const C = rlcCuF / 1_000_000;
    const zl = omega * L;
    const zc = 1 / (omega * C);
    const z = Math.sqrt(rlcR * rlcR + (zl - zc) * (zl - zc));
    const iRms = rlcUrms / z;
    const ur = iRms * rlcR;
    const ul = iRms * zl;
    const uc = iRms * zc;
    const phiRad = Math.atan2(zl - zc, rlcR);
    const phiDeg = (phiRad * 180) / Math.PI;
    const cosPhi = Math.cos(phiRad);
    const pActive = rlcUrms * iRms * cosPhi;
    const fResonance = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const isResonance = Math.abs(zl - zc) <= Math.max(1.5, 0.02 * Math.max(zl, zc));
    const regimeText = isResonance
      ? 'Cộng hưởng điện (ZL = ZC, I đạt cực đại)'
      : zl > zc
      ? 'Mạch có tính cảm kháng (u sớm pha hơn i)'
      : 'Mạch có tính dung kháng (u trễ pha hơn i)';
    return {
      omega,
      zl,
      zc,
      z,
      iRms,
      ur,
      ul,
      uc,
      phiRad,
      phiDeg,
      cosPhi,
      pActive,
      fResonance,
      isResonance,
      regimeText,
    };
  }, [rlcR, rlcLmH, rlcCuF, rlcFreqHz, rlcUrms]);

  // ===========================================================================
  // MAIN 60FPS ANIMATION LOOP
  // ===========================================================================
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let telemetryTimer = 0;

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const dt = isRunning ? rawDt * timeScale : 0;

      // 1. OSCILLATION LOOP
      if (activeModule === 'oscillation' && oscCanvasRef.current) {
        const st = oscStateRef.current;
        if (dt > 0) {
          const subSteps = 6;
          const h = dt / subSteps;
          for (let s = 0; s < subSteps; s++) {
            if (oscType === 'pendulum') {
              const accel = -(gravity / pendulumLength) * Math.sin(st.theta) - damping * st.omega;
              st.omega += accel * h;
              st.theta += st.omega * h;
            } else {
              const accel = -(springK / springMass) * st.x - damping * st.v;
              st.v += accel * h;
              st.x += st.v * h;
            }
          }
          st.t += dt;
          const valX = oscType === 'pendulum' ? st.theta * pendulumLength : st.x;
          const valV = oscType === 'pendulum' ? st.omega * pendulumLength : st.v;
          const ekStep =
            oscType === 'pendulum'
              ? 0.5 * pendulumMass * valV * valV
              : 0.5 * springMass * st.v * st.v;
          const epStep =
            oscType === 'pendulum'
              ? pendulumMass * gravity * pendulumLength * (1 - Math.cos(st.theta))
              : 0.5 * springK * st.x * st.x;
          const eTotalStep = ekStep + epStep;
          if (st.history.length === 0 || damping === 0) {
            st.eInitial = eTotalStep;
          }
          st.history.push({
            t: st.t,
            x: valX,
            v: valV,
            ek: ekStep,
            ep: epStep,
            eTotal: eTotalStep,
          });
          if (st.history.length > 260) st.history.shift();
        }

        drawOscillationCanvas(oscCanvasRef.current);

        telemetryTimer += rawDt;
        if (telemetryTimer >= 0.06) {
          telemetryTimer = 0;
          if (oscType === 'pendulum') {
            const vLinear = st.omega * pendulumLength;
            const hBob = pendulumLength * (1 - Math.cos(st.theta));
            const ek = 0.5 * pendulumMass * vLinear * vLinear;
            const ep = pendulumMass * gravity * hBob;
            const eTotal = ek + ep;
            setOscTelemetry({
              t: st.t,
              x: st.theta * pendulumLength * 100,
              v: vLinear,
              ek,
              ep,
              eTotal,
              eInitial: Math.max(st.eInitial, eTotal),
            });
          } else {
            const ek = 0.5 * springMass * st.v * st.v;
            const ep = 0.5 * springK * st.x * st.x;
            const eTotal = ek + ep;
            setOscTelemetry({
              t: st.t,
              x: st.x * 100,
              v: st.v,
              ek,
              ep,
              eTotal,
              eInitial: Math.max(st.eInitial, eTotal),
            });
          }
        }
      }

      // 2. PROJECTILE LOOP
      if (activeModule === 'projectile' && projCanvasRef.current) {
        const st = projStateRef.current;
        if (dt > 0 && !st.finished) {
          const subSteps = 6;
          const h = dt / subSteps;
          for (let s = 0; s < subSteps; s++) {
            const speed = Math.hypot(st.vx, st.vy);
            const ax = projDrag ? -projDragCoeff * speed * st.vx : 0;
            const ay = -projG + (projDrag ? -projDragCoeff * speed * st.vy : 0);
            st.vx += ax * h;
            st.vy += ay * h;
            st.x += st.vx * h;
            st.y += st.vy * h;
            st.t += h;
            if (st.y <= 0) {
              st.y = 0;
              st.finished = true;
              break;
            }
          }
          st.path.push({ x: st.x, y: st.y });
          if (st.t - st.lastMarkerT >= 0.35 || st.finished) {
            st.markers.push({ x: st.x, y: st.y, t: st.t });
            st.lastMarkerT = st.t;
          }
        }

        drawProjectileCanvas(projCanvasRef.current);

        telemetryTimer += rawDt;
        if (telemetryTimer >= 0.05) {
          telemetryTimer = 0;
          setProjTelemetry({
            t: st.t,
            x: st.x,
            y: st.y,
            vx: st.vx,
            vy: st.vy,
            v: Math.hypot(st.vx, st.vy),
            finished: st.finished,
          });
        }
      }

      // 3. WAVES & INTERFERENCE LOOP
      if (activeModule === 'waves' && waveCanvasRef.current) {
        if (dt > 0) {
          wavePhaseRef.current += dt * 2 * Math.PI * waveFreqHz;
        }
        drawWaveCanvas(waveCanvasRef.current);
      }

      // 4. RLC CIRCUIT LOOP
      if (activeModule === 'rlc' && rlcCanvasRef.current) {
        if (dt > 0) {
          // Scaled slow-motion angular speed so AC waveforms & rotating phasors are readable
          rlcPhaseRef.current += dt * Math.PI * 1.4 * (rlcFreqHz / 50);
        }
        drawRlcCanvas(rlcCanvasRef.current);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  // ===========================================================================
  // CANVAS DRAWING ROUTINES
  // ===========================================================================
  const drawOscillationCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clean scientific off-white stage background
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const stageH = Math.floor(h * 0.58);
    const graphH = h - stageH;

    // Subtle millimeter grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, stageH);
      ctx.stroke();
    }
    for (let gy = 0; gy < stageH; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    const st = oscStateRef.current;
    const stageCenterOffset = showEnergyBarsOsc && w > 500 ? -54 : 0;

    if (oscType === 'pendulum') {
      const pivotX = w * 0.5 + stageCenterOffset;
      const pivotY = 34;
      const pxPerMeter = Math.min(170, (stageH - 76) / Math.max(0.6, pendulumLength));
      const rodPx = pendulumLength * pxPerMeter;
      const bobX = pivotX + rodPx * Math.sin(st.theta);
      const bobY = pivotY + rodPx * Math.cos(st.theta);

      if (isRunning) {
        st.trail.push({ x: bobX, y: bobY });
        if (st.trail.length > 42) st.trail.shift();
      }

      ctx.fillStyle = '#334155';
      ctx.fillRect(pivotX - 70, pivotY - 10, 140, 10);
      ctx.strokeStyle = '#94A3B8';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(pivotX, pivotY + rodPx + 24);
      ctx.stroke();
      ctx.setLineDash([]);

      if (Math.abs(st.theta) > 0.01) {
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const startA = Math.PI / 2;
        const endA = Math.PI / 2 - st.theta;
        ctx.arc(pivotX, pivotY, 44, Math.min(startA, endA), Math.max(startA, endA));
        ctx.stroke();
        ctx.fillStyle = '#0369A1';
        ctx.font = '600 11px ui-monospace, monospace';
        ctx.fillText(
          `α = ${((st.theta * 180) / Math.PI).toFixed(1)}°`,
          pivotX + (st.theta >= 0 ? 12 : -58),
          pivotY + 60
        );
      }

      if (st.trail.length > 1) {
        for (let i = 1; i < st.trail.length; i++) {
          ctx.strokeStyle = `rgba(2, 132, 199, ${(i / st.trail.length) * 0.45})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(st.trail[i - 1].x, st.trail[i - 1].y);
          ctx.lineTo(st.trail[i].x, st.trail[i].y);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
      ctx.fill();

      if (showVectorsOsc) {
        const vLin = st.omega * pendulumLength;
        const vScale = 28;
        const vx = vLin * Math.cos(st.theta) * vScale;
        const vy = -vLin * Math.sin(st.theta) * vScale;
        if (Math.hypot(vx, vy) > 3) {
          drawArrow(ctx, bobX, bobY, bobX + vx, bobY + vy, '#059669', 'v');
        }
        const fRest = -gravity * Math.sin(st.theta) * 5.5;
        const fx = fRest * Math.cos(st.theta);
        const fy = -fRest * Math.sin(st.theta);
        if (Math.hypot(fx, fy) > 3) {
          drawArrow(ctx, bobX, bobY, bobX + fx, bobY + fy, '#DC2626', 'F_ph');
        }
      }

      const grad = ctx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, 16);
      grad.addColorStop(0, '#38BDF8');
      grad.addColorStop(1, '#0369A1');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bobX, bobY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0C4A6E';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      const wallX = 44;
      const eqX = (showEnergyBarsOsc && w > 500 ? w * 0.43 : w * 0.56);
      const trackY = stageH * 0.54;
      const maxAmpSpan = showEnergyBarsOsc && w > 500 ? w * 0.21 : w * 0.28;
      const pxPerCm = Math.min(8, maxAmpSpan / Math.max(10, springAmpCm));
      const massX = eqX + st.x * 100 * pxPerCm;

      ctx.fillStyle = '#334155';
      ctx.fillRect(wallX - 14, trackY - 75, 14, 105);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wallX, trackY + 26);
      ctx.lineTo(eqX + springAmpCm * pxPerCm + 42, trackY + 26);
      ctx.stroke();

      const ampPx = springAmpCm * pxPerCm;
      [
        { x: eqX - ampPx, label: '-A', color: '#94A3B8' },
        { x: eqX, label: 'O (VTCB)', color: '#0284C7' },
        { x: eqX + ampPx, label: '+A', color: '#94A3B8' },
      ].forEach((m) => {
        ctx.strokeStyle = m.color;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(m.x, trackY - 58);
        ctx.lineTo(m.x, trackY + 42);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = m.color;
        ctx.font = '600 11px ui-monospace, monospace';
        ctx.fillText(m.label, m.x - 14, trackY + 56);
      });

      const springStart = wallX;
      const springEnd = massX - 24;
      const coils = 14;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(springStart, trackY);
      const span = Math.max(24, springEnd - springStart);
      for (let i = 1; i < coils; i++) {
        const cx = springStart + (span * i) / coils;
        const cy = trackY + (i % 2 === 0 ? -13 : 13);
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(springEnd, trackY);
      ctx.stroke();

      ctx.fillStyle = '#0284C7';
      ctx.fillRect(massX - 24, trackY - 24, 48, 48);
      ctx.strokeStyle = '#0369A1';
      ctx.lineWidth = 2;
      ctx.strokeRect(massX - 24, trackY - 24, 48, 48);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 12px ui-monospace, monospace';
      ctx.fillText(`${springMass.toFixed(1)}kg`, massX - 18, trackY + 4);

      if (showVectorsOsc) {
        const vx = st.v * 45;
        if (Math.abs(vx) > 4) {
          drawArrow(ctx, massX, trackY - 34, massX + vx, trackY - 34, '#059669', 'v');
        }
        const fx = -springK * st.x * 7;
        if (Math.abs(fx) > 4) {
          drawArrow(ctx, massX, trackY, massX + fx, trackY, '#DC2626', 'F_ph');
        }
      }
    }

    // =========================================================================
    // CỘT NĂNG LƯỢNG TRỰC QUAN TRÊN SÂN KHẤU: ĐỘNG NĂNG (Wđ), THẾ NĂNG (Wt), CƠ NĂNG (W)
    // =========================================================================
    const currentEk =
      oscType === 'pendulum'
        ? 0.5 * pendulumMass * Math.pow(st.omega * pendulumLength, 2)
        : 0.5 * springMass * st.v * st.v;
    const currentEp =
      oscType === 'pendulum'
        ? pendulumMass * gravity * pendulumLength * (1 - Math.cos(st.theta))
        : 0.5 * springK * st.x * st.x;
    const currentE = currentEk + currentEp;
    const refMaxE = Math.max(st.eInitial, currentE, 1e-4);

    if (showEnergyBarsOsc && w > 420) {
      const boxW = 158;
      const boxH = stageH - 28;
      const boxX = w - boxW - 14;
      const boxY = 14;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Biểu đồ Năng lượng', boxX + 10, boxY + 18);

      const chartTop = boxY + 32;
      const chartBottom = boxY + boxH - 36;
      const chartH = Math.max(60, chartBottom - chartTop);

      // Reference ceiling line for Initial Mechanical Energy W0
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(boxX + 10, chartTop);
      ctx.lineTo(boxX + boxW - 10, chartTop);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#64748B';
      ctx.font = '600 9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`W₀=${refMaxE.toFixed(2)}J`, boxX + boxW - 10, chartTop - 4);

      const bars = [
        { label: 'Wđ', val: currentEk, color: '#059669' },
        { label: 'Wt', val: currentEp, color: '#D97706' },
        { label: 'W', val: currentE, color: '#0284C7' },
      ];
      const barW = 28;
      const gap = 16;
      const startBarsX = boxX + 22;

      bars.forEach((b, idx) => {
        const bx = startBarsX + idx * (barW + gap);
        const ratio = Math.min(1, Math.max(0, b.val / refMaxE));
        const bh = ratio * chartH;
        const by = chartBottom - bh;

        // Track
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(bx, chartTop, barW, chartH);

        // Filled Energy Bar
        ctx.fillStyle = b.color;
        ctx.fillRect(bx, by, barW, bh);

        // Label below bar
        ctx.fillStyle = '#0F172A';
        ctx.font = '700 10px ui-sans-serif, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, bx + barW / 2, chartBottom + 13);

        ctx.fillStyle = b.color;
        ctx.font = '700 9px ui-monospace, monospace';
        ctx.fillText(b.val.toFixed(2), bx + barW / 2, chartBottom + 25);
      });
      ctx.textAlign = 'left';
    }

    // =========================================================================
    // BOTTOM SUBPLOT: ĐỒ THỊ x(t), v(t) VÀ/HOẶC NĂNG LƯỢNG Wđ(t), Wt(t), W(t)
    // =========================================================================
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, stageH, w, graphH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, stageH);
    ctx.lineTo(w, stageH);
    ctx.stroke();

    const hist = st.history;

    const drawKinematicsSubplot = (leftX: number, subW: number) => {
      const midY = stageH + graphH * 0.56;
      const padL = leftX + 24;
      const plotW = Math.max(40, subW - 38);
      const plotHalfH = graphH * 0.31;

      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + plotW, midY);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = '600 11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('x(t) [xanh dương] · v(t) [xanh lục]', leftX + 12, stageH + 18);

      if (hist.length > 1) {
        const maxX = Math.max(
          0.05,
          oscType === 'pendulum'
            ? pendulumLength * ((pendulumAngleDeg * Math.PI) / 180)
            : springAmpCm / 100
        );
        const omega0 =
          oscType === 'pendulum'
            ? Math.sqrt(gravity / pendulumLength)
            : Math.sqrt(springK / springMass);
        const maxV = Math.max(0.1, maxX * omega0);

        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        hist.forEach((pt, idx) => {
          const px = padL + (idx / Math.max(1, hist.length - 1)) * plotW;
          const py = midY - (pt.x / maxX) * plotHalfH;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        hist.forEach((pt, idx) => {
          const px = padL + (idx / Math.max(1, hist.length - 1)) * plotW;
          const py = midY - (pt.v / maxV) * plotHalfH;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    };

    const drawEnergySubplot = (leftX: number, subW: number) => {
      const baseY = stageH + graphH - 18;
      const topY = stageH + 30;
      const padL = leftX + 24;
      const plotW = Math.max(40, subW - 38);
      const plotH = Math.max(30, baseY - topY);

      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(padL, baseY);
      ctx.lineTo(padL + plotW, baseY);
      ctx.moveTo(padL, topY);
      ctx.lineTo(padL + plotW, topY);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = '600 11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Wđ(t) [lục] · Wt(t) [cam] · Cơ năng W(t) [xanh]', leftX + 12, stageH + 18);

      if (hist.length > 1) {
        const eMax = Math.max(refMaxE, ...hist.map((p) => p.eTotal), 1e-4);

        // Đường Wđ (Kinetic)
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        hist.forEach((pt, idx) => {
          const px = padL + (idx / Math.max(1, hist.length - 1)) * plotW;
          const py = baseY - (pt.ek / eMax) * plotH;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Đường Wt (Potential)
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        hist.forEach((pt, idx) => {
          const px = padL + (idx / Math.max(1, hist.length - 1)) * plotW;
          const py = baseY - (pt.ep / eMax) * plotH;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Đường Cơ năng W = Wđ + Wt
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        hist.forEach((pt, idx) => {
          const px = padL + (idx / Math.max(1, hist.length - 1)) * plotW;
          const py = baseY - (pt.eTotal / eMax) * plotH;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    };

    if (oscGraphMode === 'both' && w > 520) {
      const halfW = Math.floor(w / 2);
      drawKinematicsSubplot(0, halfW);
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(halfW, stageH + 8);
      ctx.lineTo(halfW, h - 8);
      ctx.stroke();
      drawEnergySubplot(halfW, w - halfW);
    } else if (oscGraphMode === 'energy') {
      drawEnergySubplot(0, w);
    } else {
      drawKinematicsSubplot(0, w);
    }
  };

  const drawProjectileCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 52;
    const padRight = 28;
    const padBottom = 42;
    const padTop = 28;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const maxWorldX = Math.max(30, projTheoretical.range * 1.15);
    const maxWorldY = Math.max(20, projTheoretical.hMax * 1.22);
    const scale = Math.min(plotW / maxWorldX, plotH / maxWorldY);

    const toPx = (wx: number, wy: number) => ({
      x: padLeft + wx * scale,
      y: h - padBottom - wy * scale,
    });

    // Coordinate grid in meters
    const stepM = maxWorldX > 120 ? 25 : maxWorldX > 60 ? 10 : 5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = '500 10px ui-monospace, monospace';

    for (let xm = 0; xm * scale <= plotW; xm += stepM) {
      const p = toPx(xm, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, padTop);
      ctx.lineTo(p.x, h - padBottom);
      ctx.stroke();
      ctx.fillText(`${xm}m`, p.x - 8, h - padBottom + 16);
    }
    for (let ym = 0; ym * scale <= plotH; ym += stepM) {
      const p = toPx(0, ym);
      ctx.beginPath();
      ctx.moveTo(padLeft, p.y);
      ctx.lineTo(w - padRight, p.y);
      ctx.stroke();
      ctx.fillText(`${ym}m`, 10, p.y + 3);
    }

    // Ground line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padLeft - 8, h - padBottom);
    ctx.lineTo(w - padRight + 8, h - padBottom);
    ctx.stroke();

    const st = projStateRef.current;

    // Ideal theoretical dashed curve
    if (st.idealPath.length > 1) {
      ctx.strokeStyle = projDrag ? '#94A3B8' : '#BAE6FD';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      st.idealPath.forEach((pt, idx) => {
        const p = toPx(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Platform pedestal if h0 > 0
    if (projH0 > 0) {
      const topP = toPx(0, projH0);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(topP.x - 10, topP.y, 20, h - padBottom - topP.y);
    }

    // Actual simulated path
    if (st.path.length > 1) {
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      st.path.forEach((pt, idx) => {
        const p = toPx(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // Strobe time markers
    st.markers.forEach((m) => {
      const p = toPx(m.x, m.y);
      ctx.fillStyle = '#0369A1';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Current ball + velocity decomposition arrows
    const ballP = toPx(st.x, st.y);
    const vArrowScale = 2.2;
    drawArrow(ctx, ballP.x, ballP.y, ballP.x + st.vx * vArrowScale, ballP.y, '#059669', 'vx');
    drawArrow(ctx, ballP.x, ballP.y, ballP.x, ballP.y - st.vy * vArrowScale, '#EA580C', 'vy');
    drawArrow(
      ctx,
      ballP.x,
      ballP.y,
      ballP.x + st.vx * vArrowScale,
      ballP.y - st.vy * vArrowScale,
      '#0F172A',
      'v'
    );

    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(ballP.x, ballP.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawWaveCanvas = (canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));

    if (waveMode === 'ripple') {
      // Lower pixel grid for silky-smooth 60fps 2-source interference computation
      const simW = Math.min(360, Math.floor(w / 2));
      const simH = Math.min(260, Math.floor(h / 2));
      if (canvas.width !== simW || canvas.height !== simH) {
        canvas.width = simW;
        canvas.height = simH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = ctx.createImageData(simW, simH);
      const data = img.data;

      // World size: 32 cm wide
      const worldWidthCm = 32;
      const pxPerCm = simW / worldWidthCm;
      const cx = simW / 2;
      const cy = simH / 2;
      const halfSepPx = (sourceDistCm / 2) * pxPerCm;
      const s1x = cx - halfSepPx;
      const s2x = cx + halfSepPx;
      const sy = cy;

      const lambdaPx = waveLambdaCm * pxPerCm;
      const k = (2 * Math.PI) / lambdaPx;
      const phase = wavePhaseRef.current;
      const phaseOffset = oppositePhase ? Math.PI : 0;

      for (let py = 0; py < simH; py++) {
        const dy = py - sy;
        const dy2 = dy * dy;
        for (let px = 0; px < simW; px++) {
          const d1 = Math.sqrt((px - s1x) * (px - s1x) + dy2);
          const d2 = Math.sqrt((px - s2x) * (px - s2x) + dy2);
          const w1 = Math.sin(k * d1 - phase) / (1 + d1 * 0.012);
          const w2 = Math.sin(k * d2 - phase + phaseOffset) / (1 + d2 * 0.012);
          const amp = (w1 + w2) * 0.5; // [-1, 1]
          const idx = (py * simW + px) * 4;
          // Deep ocean blue trough -> bright cyan crest
          if (amp >= 0) {
            data[idx] = Math.round(12 + amp * 130);
            data[idx + 1] = Math.round(55 + amp * 185);
            data[idx + 2] = Math.round(115 + amp * 140);
          } else {
            const t = -amp;
            data[idx] = Math.round(12 * (1 - t));
            data[idx + 1] = Math.round(55 * (1 - t * 0.7));
            data[idx + 2] = Math.round(115 * (1 - t * 0.45));
          }
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // Source markers S1, S2 & probe M
      ctx.fillStyle = '#FACC15';
      [
        { x: s1x, label: 'S1' },
        { x: s2x, label: 'S2' },
      ].forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 10px ui-sans-serif, sans-serif';
        ctx.fillText(s.label, s.x - 6, sy - 8);
      });

      const mx = probePos.xNorm * simW;
      const my = probePos.yNorm * simH;
      ctx.strokeStyle = '#FFFFFF';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(s1x, sy);
      ctx.lineTo(mx, my);
      ctx.lineTo(s2x, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px ui-sans-serif, sans-serif';
      ctx.fillText('M', mx + 6, my - 4);
    } else {
      // Young's double-slit optical screen + intensity distribution
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);

      const [r, g, b] = wavelengthToRgb(youngLambdaNm);
      const fringeSpacingMm = (youngLambdaNm * 1e-6 * youngDistDM * 1e3) / youngSlitAMm; // i = lambda*D/a (mm)

      // Top zone: interference band pattern across [-12 mm, +12 mm]
      const screenLeft = 36;
      const screenW = w - 72;
      const bandTop = 36;
      const bandH = Math.floor(h * 0.36);
      const halfSpanMm = 10;

      for (let px = 0; px < screenW; px++) {
        const xMm = ((px / screenW) * 2 - 1) * halfSpanMm;
        const phaseDiff = (Math.PI * xMm) / fringeSpacingMm;
        const intensity = Math.pow(Math.cos(phaseDiff), 2);
        ctx.fillStyle = `rgb(${Math.round(r * intensity)}, ${Math.round(g * intensity)}, ${Math.round(b * intensity)})`;
        ctx.fillRect(screenLeft + px, bandTop, 1.5, bandH);
      }

      ctx.strokeStyle = '#475569';
      ctx.strokeRect(screenLeft, bandTop, screenW, bandH);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 11px ui-sans-serif, sans-serif';
      ctx.fillText(
        `Hệ vân giao thoa ánh sáng đơn sắc (λ = ${youngLambdaNm} nm · khoảng vân i = ${fringeSpacingMm.toFixed(2)} mm)`,
        screenLeft,
        22
      );

      // Bottom zone: Intensity graph I(x)
      const graphTop = bandTop + bandH + 34;
      const graphH = h - graphTop - 36;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(screenLeft, graphTop + graphH);
      ctx.lineTo(screenLeft + screenW, graphTop + graphH);
      ctx.stroke();

      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let px = 0; px <= screenW; px += 2) {
        const xMm = ((px / screenW) * 2 - 1) * halfSpanMm;
        const intensity = Math.pow(Math.cos((Math.PI * xMm) / fringeSpacingMm), 2);
        const py = graphTop + graphH - intensity * (graphH - 12);
        if (px === 0) ctx.moveTo(screenLeft + px, py);
        else ctx.lineTo(screenLeft + px, py);
      }
      ctx.stroke();

      // Probe cursor M on Young screen
      const clampedMm = Math.max(-halfSpanMm, Math.min(halfSpanMm, youngProbeXMm));
      const probePx = screenLeft + ((clampedMm / halfSpanMm + 1) / 2) * screenW;
      ctx.strokeStyle = '#FACC15';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(probePx, bandTop);
      ctx.lineTo(probePx, graphTop + graphH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(`xM = ${clampedMm.toFixed(2)} mm`, Math.min(screenLeft + screenW - 95, Math.max(screenLeft, probePx + 6)), bandTop + 16);
    }
  };

  const drawRlcCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    // Split left: Fresnel Phasor Diagram; right: u(t) & i(t) waveforms
    const splitX = Math.floor(w * 0.44);
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(splitX, 16);
    ctx.lineTo(splitX, h - 16);
    ctx.stroke();

    const phasorCx = splitX * 0.45;
    const phasorCy = h * 0.52;
    const maxV = Math.max(rlcUrms, rlcCalc.ur, rlcCalc.ul, rlcCalc.uc, 40);
    const pxPerVolt = Math.min(splitX * 0.36, h * 0.36) / maxV;

    // Phasor axes
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, phasorCy);
    ctx.lineTo(splitX - 20, phasorCy);
    ctx.moveTo(phasorCx, 36);
    ctx.lineTo(phasorCx, h - 36);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Giản đồ véc-tơ Fresnel', 18, 26);

    const thetaI = rlcPhaseRef.current * 0.35;
    // Reference axis rotates or stays horizontal for textbook readability; keep I horizontal right!
    const urPx = rlcCalc.ur * pxPerVolt;
    const ulPx = rlcCalc.ul * pxPerVolt;
    const ucPx = rlcCalc.uc * pxPerVolt;
    const uNetY = -(ulPx - ucPx);

    drawArrow(ctx, phasorCx, phasorCy, phasorCx + Math.min(110, urPx * 0.85 + 24), phasorCy, '#059669', 'I');
    drawArrow(ctx, phasorCx, phasorCy, phasorCx + urPx, phasorCy, '#0284C7', 'UR');
    drawArrow(ctx, phasorCx + urPx, phasorCy, phasorCx + urPx, phasorCy - ulPx, '#EA580C', 'UL');
    drawArrow(ctx, phasorCx + urPx, phasorCy - ulPx, phasorCx + urPx, phasorCy - ulPx + ucPx, '#7C3AED', 'UC');
    drawArrow(ctx, phasorCx, phasorCy, phasorCx + urPx, phasorCy + uNetY, '#0F172A', 'U');

    // Right side: Waveforms u(t) and i(t)
    const waveLeft = splitX + 28;
    const waveW = w - waveLeft - 24;
    const waveMidY = h * 0.52;
    const waveAmpPx = h * 0.32;

    ctx.fillStyle = '#334155';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Dao động ký u(t) [đen] & i(t) [xanh lục]', waveLeft, 26);

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waveLeft, waveMidY);
    ctx.lineTo(waveLeft + waveW, waveMidY);
    ctx.stroke();

    // i(t)
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let px = 0; px <= waveW; px += 2) {
      const a = (px / waveW) * 4 * Math.PI - thetaI;
      const y = waveMidY - Math.sin(a) * waveAmpPx * 0.65;
      if (px === 0) ctx.moveTo(waveLeft + px, y);
      else ctx.lineTo(waveLeft + px, y);
    }
    ctx.stroke();

    // u(t) leads i(t) by phiRad
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let px = 0; px <= waveW; px += 2) {
      const a = (px / waveW) * 4 * Math.PI - thetaI + rlcCalc.phiRad;
      const y = waveMidY - Math.sin(a) * waveAmpPx * 0.92;
      if (px === 0) ctx.moveTo(waveLeft + px, y);
      else ctx.lineTo(waveLeft + px, y);
    }
    ctx.stroke();
  };

  // Probe click handler for ripple tank
  const handleWaveCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xNorm = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const yNorm = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));
    if (waveMode === 'ripple') {
      setProbePos({ xNorm, yNorm });
    } else {
      const screenLeft = 36;
      const screenW = rect.width - 72;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - screenLeft) / screenW));
      setYoungProbeXMm((ratio * 2 - 1) * 10);
    }
  };

  // Probe readout computation for ripple tank
  const rippleProbeInfo = useMemo(() => {
    const worldW = 32;
    const worldH = 23;
    const s1x = worldW / 2 - sourceDistCm / 2;
    const s2x = worldW / 2 + sourceDistCm / 2;
    const sy = worldH / 2;
    const mx = probePos.xNorm * worldW;
    const my = probePos.yNorm * worldH;
    const d1 = Math.hypot(mx - s1x, my - sy);
    const d2 = Math.hypot(mx - s2x, my - sy);
    const diff = Math.abs(d2 - d1);
    const ratio = diff / waveLambdaCm;
    const kNear = oppositePhase ? Math.round(ratio - 0.5) + 0.5 : Math.round(ratio);
    const err = Math.abs(ratio - kNear);
    const halfShift = oppositePhase ? Math.round(ratio) : Math.round(ratio - 0.5) + 0.5;
    const errMin = Math.abs(ratio - halfShift);
    let stateText = 'Vùng dao động trung gian';
    if (err < 0.14) stateText = 'Cực đại giao thoa (Biên độ 2A)';
    else if (errMin < 0.14) stateText = 'Cực tiểu giao thoa (Đứng yên)';
    return { d1, d2, diff, ratio, stateText };
  }, [probePos, sourceDistCm, waveLambdaCm, oppositePhase]);

  const oscPeriod =
    oscType === 'pendulum'
      ? 2 * Math.PI * Math.sqrt(pendulumLength / gravity)
      : 2 * Math.PI * Math.sqrt(springMass / springK);

  const oscOmega = (2 * Math.PI) / oscPeriod;

  const youngFringeI = (youngLambdaNm * 1e-6 * youngDistDM * 1e3) / youngSlitAMm;
  const youngOrderK = youngProbeXMm / youngFringeI;

  const filteredExperiments = useMemo(
    () =>
      selectedCategory === 'all'
        ? PHYSICS_EXPERIMENTS
        : PHYSICS_EXPERIMENTS.filter((exp) => exp.category === selectedCategory),
    [selectedCategory]
  );

  const activeExperimentMeta = useMemo(
    () => PHYSICS_EXPERIMENTS.find((exp) => exp.id === activeModule) || null,
    [activeModule]
  );

  if (activeModule === null) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-sky-700">
                Phòng Thí Nghiệm Vật Lý Tương Tác · Lớp 10 · 11 · 12
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                Chọn Thí Nghiệm Mô Phỏng Vật Lý
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Nhấn vào một mục thí nghiệm bên dưới để mở không gian mô phỏng trực quan và bảng điều khiển thông số.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
              {filteredExperiments.length} / {PHYSICS_EXPERIMENTS.length} thí nghiệm
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[
              { id: 'all' as PhysicsCategoryId, label: 'Tất cả' },
              { id: 'mechanics' as PhysicsCategoryId, label: 'Cơ học' },
              { id: 'waves' as PhysicsCategoryId, label: 'Sóng & Âm' },
              { id: 'optics' as PhysicsCategoryId, label: 'Quang & Lượng tử' },
              { id: 'electricity' as PhysicsCategoryId, label: 'Điện học' },
              { id: 'thermal' as PhysicsCategoryId, label: 'Nhiệt học' },
              { id: 'nuclear' as PhysicsCategoryId, label: 'Hạt nhân' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white text-sky-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExperiments.map((exp) => {
            const Icon = exp.icon;
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() => setActiveModule(exp.id)}
                className="group text-left bg-white border border-slate-200 hover:border-sky-400 hover:shadow-sm rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {exp.grade} · {exp.categoryLabel}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 group-hover:bg-sky-50 group-hover:border-sky-200 flex items-center justify-center text-sky-700 shrink-0 transition-colors">
                      <Icon size={18} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-sky-700 transition-colors">
                      {exp.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {exp.summary}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-700">
                  <span>Mở thí nghiệm</span>
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-5">
      {/* Focused Experiment Top Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveModule(null)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Danh sách thí nghiệm</span>
          </button>

          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 truncate">
              {activeExperimentMeta?.grade} · {activeExperimentMeta?.categoryLabel}
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
              {activeExperimentMeta?.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="quick-physics-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Chuyển nhanh:
          </label>
          <select
            id="quick-physics-select"
            value={activeModule}
            onChange={(e) => setActiveModule(e.target.value as PhysicsModuleId)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            {PHYSICS_EXPERIMENTS.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Render Selected Experiment Module */}
      {activeModule === 'rutherford' ||
      activeModule === 'lightInterference' ||
      activeModule === 'soundWave' ||
      activeModule === 'nuclearFusion' ||
      activeModule === 'nuclearFission' ||
      activeModule === 'thermalLab' ? (
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm font-semibold text-slate-600">
              Đang tải mô phỏng thí nghiệm...
            </div>
          }
        >
          <ModernAndThermalSimulations moduleId={activeModule} />
        </Suspense>
      ) : activeModule === 'standingWave' ||
        activeModule === 'optics' ||
        activeModule === 'dcCircuit' ||
        activeModule === 'photoelectric' ||
        activeModule === 'idealGas' ? (
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm font-semibold text-slate-600">
              Đang tải mô phỏng thí nghiệm...
            </div>
          }
        >
          <ExtraPhysicsSimulations moduleId={activeModule} />
        </Suspense>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT ZONE: INTERACTIVE CANVAS STAGE */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          {/* Playback Toolbar */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRunning((v) => !v)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isRunning
                    ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                    : 'bg-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                {isRunning ? <Pause size={14} /> : <Play size={14} />}
                <span>{isRunning ? 'Tạm dừng' : 'Tiếp tục'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (activeModule === 'oscillation') resetOscillation();
                  else if (activeModule === 'projectile') resetProjectile();
                  else if (activeModule === 'waves') wavePhaseRef.current = 0;
                  else rlcPhaseRef.current = 0;
                  setIsRunning(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Đặt lại</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {activeModule === 'oscillation' && (
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                  {[
                    { id: 'both' as const, label: 'Song song' },
                    { id: 'energy' as const, label: 'Đồ thị Wđ, Wt, W' },
                    { id: 'kinematics' as const, label: 'Đồ thị x, v' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setOscGraphMode(mode.id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        oscGraphMode === mode.id
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Tốc độ:</span>
                {[0.5, 1, 1.5].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setTimeScale(sp)}
                    className={`px-2 py-1 rounded-md font-mono tabular-nums font-bold text-[11px] border cursor-pointer ${
                      timeScale === sp
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sp}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas Container */}
          <div className="relative w-full h-[450px] sm:h-[520px] bg-slate-50">
            {activeModule === 'oscillation' && (
              <canvas ref={oscCanvasRef} className="w-full h-full block" />
            )}
            {activeModule === 'projectile' && (
              <canvas ref={projCanvasRef} className="w-full h-full block" />
            )}
            {activeModule === 'waves' && (
              <canvas
                ref={waveCanvasRef}
                onClick={handleWaveCanvasClick}
                className="w-full h-full block cursor-crosshair"
                title="Nhấp chuột lên vùng thí nghiệm để di chuyển điểm khảo sát M"
              />
            )}
            {activeModule === 'rlc' && (
              <canvas ref={rlcCanvasRef} className="w-full h-full block" />
            )}
          </div>

          {/* Tabular Telemetry Readout Strip */}
          <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {activeModule === 'oscillation' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Chu kỳ T / Tần số f</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {oscPeriod.toFixed(2)} s · {(1 / oscPeriod).toFixed(2)} Hz
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Li độ x(t)</span>
                  <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                    {oscTelemetry.x.toFixed(2)} cm
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Vận tốc v(t)</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                    {oscTelemetry.v.toFixed(2)} m/s
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Cơ năng hiện tại W</span>
                  <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                    {oscTelemetry.eTotal.toFixed(3)} J
                  </span>
                </div>
              </>
            )}

            {activeModule === 'projectile' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Tầm xa lý thuyết L</span>
                  <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                    {projTheoretical.range.toFixed(2)} m
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Độ cao cực đại Hmax</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {projTheoretical.hMax.toFixed(2)} m
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Vị trí hiện tại (x, y)</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                    ({projTelemetry.x.toFixed(1)}, {projTelemetry.y.toFixed(1)}) m
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Thời gian t / Tốc độ v</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {projTelemetry.t.toFixed(2)} s · {projTelemetry.v.toFixed(1)} m/s
                  </span>
                </div>
              </>
            )}

            {activeModule === 'waves' && waveMode === 'ripple' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Khoảng cách d₁, d₂</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {rippleProbeInfo.d1.toFixed(1)} / {rippleProbeInfo.d2.toFixed(1)} cm
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Hiệu đường đi Δd</span>
                  <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                    {rippleProbeInfo.diff.toFixed(2)} cm ({rippleProbeInfo.ratio.toFixed(2)}λ)
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                  <span className="text-[11px] text-slate-500 block">Trạng thái tại điểm M (Nhấp chuột để dời M)</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {rippleProbeInfo.stateText}
                  </span>
                </div>
              </>
            )}

            {activeModule === 'waves' && waveMode === 'young' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Khoảng vân i</span>
                  <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                    {youngFringeI.toFixed(2)} mm
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Tọa độ điểm M</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    xM = {youngProbeXMm.toFixed(2)} mm
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                  <span className="text-[11px] text-slate-500 block">Xác định loại vân tại M (xM / i = {youngOrderK.toFixed(2)})</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {Math.abs(youngOrderK - Math.round(youngOrderK)) < 0.14
                      ? `Vân sáng bậc k = ${Math.round(youngOrderK)}`
                      : Math.abs(Math.abs(youngOrderK - Math.floor(youngOrderK)) - 0.5) < 0.14
                      ? `Vân tối thứ ${Math.floor(Math.abs(youngOrderK)) + 1}`
                      : 'Vị trí cường độ sáng trung gian'}
                  </span>
                </div>
              </>
            )}

            {activeModule === 'rlc' && (
              <>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Cảm kháng ZL / Dung kháng ZC</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {rlcCalc.zl.toFixed(1)} Ω / {rlcCalc.zc.toFixed(1)} Ω
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Tổng trở Z / Cường độ I</span>
                  <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                    {rlcCalc.z.toFixed(1)} Ω · {rlcCalc.iRms.toFixed(2)} A
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Độ lệch pha φ / cosφ</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                    {rlcCalc.phiDeg.toFixed(1)}° · {rlcCalc.cosPhi.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] text-slate-500 block">Công suất tiêu thụ P</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                    {rlcCalc.pActive.toFixed(1)} W
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Dedicated Conservation of Mechanical Energy Breakdown for Oscillation */}
          {activeModule === 'oscillation' && (() => {
            const denom = Math.max(oscTelemetry.eInitial, oscTelemetry.eTotal, 1e-6);
            const ekPct = Math.min(100, Math.max(0, (oscTelemetry.ek / denom) * 100));
            const epPct = Math.min(100 - ekPct, Math.max(0, (oscTelemetry.ep / denom) * 100));
            const lostEnergy = Math.max(0, oscTelemetry.eInitial - oscTelemetry.eTotal);
            const lossPct = Math.min(100, Math.max(0, (lostEnergy / denom) * 100));
            return (
              <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      Định Luật Bảo Toàn Cơ Năng: W = Wđ + Wt
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Theo dõi sự chuyển hóa qua lại giữa động năng và thế năng trong quá trình dao động
                    </p>
                  </div>
                  <div className="font-mono tabular-nums font-bold text-xs text-slate-800">
                    {damping === 0 ? (
                      <span className="text-emerald-700">
                        Bảo toàn (W = W₀ = {oscTelemetry.eTotal.toFixed(3)} J)
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        Tắt dần (Hao phí ΔW = {lostEnergy.toFixed(3)} J)
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Proportional Conversion Bar */}
                <div className="space-y-1.5">
                  <div className="h-4 w-full rounded-lg overflow-hidden bg-slate-200 flex border border-slate-300/70">
                    <div
                      style={{ width: `${ekPct}%` }}
                      className="h-full bg-emerald-600 transition-all duration-75"
                      title={`Động năng Wđ: ${ekPct.toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${epPct}%` }}
                      className="h-full bg-amber-500 transition-all duration-75"
                      title={`Thế năng Wt: ${epPct.toFixed(1)}%`}
                    />
                    {lossPct > 0.3 && (
                      <div
                        style={{ width: `${lossPct}%` }}
                        className="h-full bg-slate-400 transition-all duration-75"
                        title={`Năng lượng hao phí: ${lossPct.toFixed(1)}%`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600">
                    <span>■ Wđ: {ekPct.toFixed(1)}%</span>
                    <span>■ Wt: {epPct.toFixed(1)}%</span>
                    {damping > 0 && <span>■ Hao phí do ma sát: {lossPct.toFixed(1)}%</span>}
                  </div>
                </div>

                {/* Three Quantitative Energy Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                    <div className="text-[11px] font-bold text-emerald-700">
                      Động năng (Wđ = ½mv²)
                    </div>
                    <div className="font-mono tabular-nums text-base font-extrabold text-slate-900">
                      {oscTelemetry.ek.toFixed(4)} J
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Cực đại khi qua vị trí cân bằng (x = 0) và bằng 0 ở hai biên.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                    <div className="text-[11px] font-bold text-amber-700">
                      Thế năng ({oscType === 'pendulum' ? 'Wt = mgl(1 - cosα)' : 'Wt = ½kx²'})
                    </div>
                    <div className="font-mono tabular-nums text-base font-extrabold text-slate-900">
                      {oscTelemetry.ep.toFixed(4)} J
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Cực đại ở vị trí biên (±A hoặc ±α₀) và bằng 0 tại vị trí cân bằng.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                    <div className="text-[11px] font-bold text-sky-700">
                      Cơ năng (W = Wđ + Wt)
                    </div>
                    <div className="font-mono tabular-nums text-base font-extrabold text-slate-900">
                      {oscTelemetry.eTotal.toFixed(4)} J
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {damping === 0
                        ? 'Không đổi theo thời gian: động năng tăng bao nhiêu thì thế năng giảm bấy nhiêu.'
                        : 'Giảm dần theo thời gian do công của lực cản môi trường (b > 0).'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* RIGHT ZONE: PARAMETER CONTROLS & PHYSICS FORMULAS */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <SlidersHorizontal size={16} className="text-sky-600" />
              <h2 className="text-sm font-extrabold text-slate-900">Bảng Tham Số Thí Nghiệm</h2>
            </div>

            {activeModule === 'oscillation' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setOscType('pendulum');
                      resetOscillation(pendulumAngleDeg, springAmpCm, 'pendulum');
                    }}
                    className={`py-1.5 rounded-md font-bold cursor-pointer ${
                      oscType === 'pendulum' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Con Lắc Đơn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOscType('spring');
                      resetOscillation(pendulumAngleDeg, springAmpCm, 'spring');
                    }}
                    className={`py-1.5 rounded-md font-bold cursor-pointer ${
                      oscType === 'spring' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Con Lắc Lò Xo
                  </button>
                </div>

                {oscType === 'pendulum' ? (
                  <>
                    <SliderControl
                      label="Chiều dài dây l"
                      valueDisplay={`${pendulumLength.toFixed(2)} m`}
                      min={0.4}
                      max={2.5}
                      step={0.05}
                      value={pendulumLength}
                      onChange={setPendulumLength}
                    />
                    <SliderControl
                      label="Khối lượng vật nặng m"
                      valueDisplay={`${pendulumMass.toFixed(2)} kg`}
                      min={0.2}
                      max={3.0}
                      step={0.1}
                      value={pendulumMass}
                      onChange={setPendulumMass}
                    />
                    <SliderControl
                      label="Biên độ góc ban đầu α₀"
                      valueDisplay={`${pendulumAngleDeg}°`}
                      min={5}
                      max={60}
                      step={1}
                      value={pendulumAngleDeg}
                      onChange={(v) => {
                        setPendulumAngleDeg(v);
                        resetOscillation(v, springAmpCm, 'pendulum');
                      }}
                    />
                    <SliderControl
                      label="Gia tốc trọng trường g"
                      valueDisplay={`${gravity.toFixed(2)} m/s²`}
                      min={1.6}
                      max={20}
                      step={0.1}
                      value={gravity}
                      onChange={setGravity}
                    />
                  </>
                ) : (
                  <>
                    <SliderControl
                      label="Độ cứng lò xo k"
                      valueDisplay={`${springK} N/m`}
                      min={10}
                      max={100}
                      step={2}
                      value={springK}
                      onChange={setSpringK}
                    />
                    <SliderControl
                      label="Khối lượng vật m"
                      valueDisplay={`${springMass.toFixed(2)} kg`}
                      min={0.1}
                      max={2.0}
                      step={0.05}
                      value={springMass}
                      onChange={setSpringMass}
                    />
                    <SliderControl
                      label="Biên độ dao động A"
                      valueDisplay={`${springAmpCm} cm`}
                      min={4}
                      max={20}
                      step={1}
                      value={springAmpCm}
                      onChange={(v) => {
                        setSpringAmpCm(v);
                        resetOscillation(pendulumAngleDeg, v, 'spring');
                      }}
                    />
                  </>
                )}

                <SliderControl
                  label="Hệ số cản môi trường b"
                  valueDisplay={`${damping.toFixed(2)}`}
                  min={0}
                  max={0.6}
                  step={0.02}
                  value={damping}
                  onChange={setDamping}
                />

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showVectorsOsc}
                      onChange={(e) => setShowVectorsOsc(e.target.checked)}
                      className="rounded accent-sky-600"
                    />
                    <span className="font-semibold text-slate-700">Hiển thị véc-tơ vận tốc (v) &amp; lực phục hồi (F_ph)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showEnergyBarsOsc}
                      onChange={(e) => setShowEnergyBarsOsc(e.target.checked)}
                      className="rounded accent-sky-600"
                    />
                    <span className="font-semibold text-slate-700">Hiển thị cột Cơ năng · Động năng · Thế năng</span>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 block">Mẫu thí nghiệm nhanh</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setGravity(9.81);
                        setDamping(0);
                        resetOscillation();
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-[11px] cursor-pointer"
                    >
                      Lý tưởng (b = 0)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGravity(9.81);
                        setDamping(0.24);
                        resetOscillation();
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-[11px] cursor-pointer"
                    >
                      Tắt dần (b = 0.24)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'projectile' && (
              <div className="space-y-4 text-xs">
                <SliderControl
                  label="Vận tốc ban đầu v₀"
                  valueDisplay={`${projV0} m/s`}
                  min={8}
                  max={50}
                  step={1}
                  value={projV0}
                  onChange={setProjV0}
                />
                <SliderControl
                  label="Góc ném α"
                  valueDisplay={`${projAngleDeg}°`}
                  min={0}
                  max={85}
                  step={1}
                  value={projAngleDeg}
                  onChange={setProjAngleDeg}
                />
                <SliderControl
                  label="Độ cao ban đầu h₀"
                  valueDisplay={`${projH0} m`}
                  min={0}
                  max={35}
                  step={1}
                  value={projH0}
                  onChange={setProjH0}
                />
                <SliderControl
                  label="Gia tốc trọng trường g"
                  valueDisplay={`${projG.toFixed(2)} m/s²`}
                  min={1.6}
                  max={20}
                  step={0.1}
                  value={projG}
                  onChange={setProjG}
                />

                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={projDrag}
                    onChange={(e) => {
                      setProjDrag(e.target.checked);
                      resetProjectile();
                    }}
                    className="rounded accent-sky-600"
                  />
                  <span className="font-semibold text-slate-700">Bật lực cản không khí (so sánh với quỹ đạo lý tưởng)</span>
                </label>

                {projDrag && (
                  <SliderControl
                    label="Hệ số lực cản k"
                    valueDisplay={`${projDragCoeff.toFixed(3)}`}
                    min={0.01}
                    max={0.12}
                    step={0.005}
                    value={projDragCoeff}
                    onChange={(v) => {
                      setProjDragCoeff(v);
                      resetProjectile();
                    }}
                  />
                )}

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setProjAngleDeg(45);
                      setProjH0(0);
                      setProjV0(30);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-[11px] cursor-pointer"
                  >
                    Tầm xa cực đại (45°)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProjAngleDeg(0);
                      setProjH0(25);
                      setProjV0(22);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-[11px] cursor-pointer"
                  >
                    Ném ngang (h₀ = 25m)
                  </button>
                </div>
              </div>
            )}

            {activeModule === 'waves' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setWaveMode('ripple')}
                    className={`py-1.5 rounded-md font-bold cursor-pointer ${
                      waveMode === 'ripple' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Sóng Nước 2 Nguồn
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaveMode('young')}
                    className={`py-1.5 rounded-md font-bold cursor-pointer ${
                      waveMode === 'young' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Khe Y-âng Ánh Sáng
                  </button>
                </div>

                {waveMode === 'ripple' ? (
                  <>
                    <SliderControl
                      label="Bước sóng λ"
                      valueDisplay={`${waveLambdaCm.toFixed(1)} cm`}
                      min={1.6}
                      max={6.0}
                      step={0.2}
                      value={waveLambdaCm}
                      onChange={setWaveLambdaCm}
                    />
                    <SliderControl
                      label="Khoảng cách S₁S₂"
                      valueDisplay={`${sourceDistCm.toFixed(1)} cm`}
                      min={6}
                      max={24}
                      step={0.5}
                      value={sourceDistCm}
                      onChange={setSourceDistCm}
                    />
                    <SliderControl
                      label="Tần số nguồn sóng f"
                      valueDisplay={`${waveFreqHz.toFixed(1)} Hz`}
                      min={0.5}
                      max={5}
                      step={0.25}
                      value={waveFreqHz}
                      onChange={setWaveFreqHz}
                    />
                    <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={oppositePhase}
                        onChange={(e) => setOppositePhase(e.target.checked)}
                        className="rounded accent-sky-600"
                      />
                      <span className="font-semibold text-slate-700">Hai nguồn dao động ngược pha (Δφ = π)</span>
                    </label>
                  </>
                ) : (
                  <>
                    <SliderControl
                      label="Bước sóng ánh sáng λ"
                      valueDisplay={`${youngLambdaNm} nm`}
                      min={380}
                      max={760}
                      step={5}
                      value={youngLambdaNm}
                      onChange={setYoungLambdaNm}
                    />
                    <SliderControl
                      label="Khoảng cách hai khe a"
                      valueDisplay={`${youngSlitAMm.toFixed(2)} mm`}
                      min={0.4}
                      max={3.0}
                      step={0.1}
                      value={youngSlitAMm}
                      onChange={setYoungSlitAMm}
                    />
                    <SliderControl
                      label="Khoảng cách tới màn D"
                      valueDisplay={`${youngDistDM.toFixed(1)} m`}
                      min={0.8}
                      max={3.5}
                      step={0.1}
                      value={youngDistDM}
                      onChange={setYoungDistDM}
                    />
                  </>
                )}
              </div>
            )}

            {activeModule === 'rlc' && (
              <div className="space-y-4 text-xs">
                <SliderControl
                  label="Điện trở R"
                  valueDisplay={`${rlcR} Ω`}
                  min={10}
                  max={200}
                  step={5}
                  value={rlcR}
                  onChange={setRlcR}
                />
                <SliderControl
                  label="Độ tự cảm L"
                  valueDisplay={`${rlcLmH} mH`}
                  min={50}
                  max={800}
                  step={10}
                  value={rlcLmH}
                  onChange={setRlcLmH}
                />
                <SliderControl
                  label="Điện dung C"
                  valueDisplay={`${rlcCuF.toFixed(1)} μF`}
                  min={5}
                  max={100}
                  step={1}
                  value={rlcCuF}
                  onChange={setRlcCuF}
                />
                <SliderControl
                  label="Tần số nguồn f"
                  valueDisplay={`${rlcFreqHz.toFixed(1)} Hz`}
                  min={20}
                  max={120}
                  step={0.5}
                  value={rlcFreqHz}
                  onChange={setRlcFreqHz}
                />
                <SliderControl
                  label="Điện áp hiệu dụng U"
                  valueDisplay={`${rlcUrms} V`}
                  min={50}
                  max={220}
                  step={10}
                  value={rlcUrms}
                  onChange={setRlcUrms}
                />

                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  rlcCalc.isResonance
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <Gauge size={14} />
                    <span>{rlcCalc.regimeText}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRlcFreqHz(Number(rlcCalc.fResonance.toFixed(1)))}
                  className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Đặt tần số cộng hưởng (f₀ = {rlcCalc.fResonance.toFixed(1)} Hz)
                </button>
              </div>
            )}
          </div>

          {/* Mathematical / Physical Formula Reference Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
            <h3 className="font-extrabold text-slate-900">Công Thức Trọng Tâm</h3>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto text-slate-800 space-y-2">
              {activeModule === 'oscillation' && (
                <div className="space-y-2">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderLatex(
                        oscType === 'pendulum'
                          ? String.raw`T = 2\pi\sqrt{\frac{l}{g}} = ${oscPeriod.toFixed(2)}\text{ s},\quad \omega = ${oscOmega.toFixed(2)}\text{ rad/s}`
                          : String.raw`T = 2\pi\sqrt{\frac{m}{k}} = ${oscPeriod.toFixed(2)}\text{ s},\quad \omega = ${oscOmega.toFixed(2)}\text{ rad/s}`,
                        false
                      ),
                    }}
                  />
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderLatex(
                        oscType === 'pendulum'
                          ? String.raw`W = W_{\text{đ}} + W_t = \frac{1}{2}mv^2 + mgl(1 - \cos\alpha)`
                          : String.raw`W = W_{\text{đ}} + W_t = \frac{1}{2}mv^2 + \frac{1}{2}kx^2 = \frac{1}{2}kA^2`,
                        false
                      ),
                    }}
                  />
                </div>
              )}
              {activeModule === 'projectile' && (
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderLatex(
                      String.raw`y(x) = h_0 + x\tan\alpha - \frac{g x^2}{2v_0^2\cos^2\alpha}`,
                      false
                    ),
                  }}
                />
              )}
              {activeModule === 'waves' && (
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderLatex(
                      waveMode === 'ripple'
                        ? String.raw`\Delta d = d_2 - d_1 = k\lambda\text{ (cực đại cùng pha)}`
                        : String.raw`i = \frac{\lambda D}{a} = ${youngFringeI.toFixed(2)}\text{ mm}`,
                      false
                    ),
                  }}
                />
              )}
              {activeModule === 'rlc' && (
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderLatex(
                      String.raw`Z = \sqrt{R^2 + (Z_L - Z_C)^2},\quad \tan\varphi = \frac{Z_L - Z_C}{R}`,
                      false
                    ),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

interface SliderControlProps {
  label: string;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  valueDisplay,
  min,
  max,
  step,
  value,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="font-mono tabular-nums font-bold text-sky-700">{valueDisplay}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-sky-600 cursor-pointer"
    />
  </div>
);

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  label?: string
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 3) return;
  const angle = Math.atan2(dy, dx);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const head = 7;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = 'bold 11px ui-sans-serif, sans-serif';
    ctx.fillText(label, x2 + 4, y2 - 4);
  }
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { Play, Pause, RotateCcw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';

export type AdditionalPhysicsModuleId =
  | 'accelerationNewton'
  | 'circularMotion'
  | 'momentumCollision'
  | 'dopplerEffect'
  | 'refractionDispersion'
  | 'electromagneticInduction'
  | 'lorentzForce'
  | 'radioactiveDecay';

function renderLatex(tex: string, displayMode = false): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode });
  } catch {
    return tex;
  }
}

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
  const ang = Math.atan2(dy, dx);
  const head = Math.min(10, Math.max(6, len * 0.25));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(label, x2 + 6 * Math.cos(ang) + 2, y2 + 6 * Math.sin(ang) - 4);
  }
  ctx.restore();
}

interface SliderControlProps {
  label: string;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (val: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  valueDisplay,
  min,
  max,
  step,
  value,
  disabled = false,
  onChange,
}) => (
  <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
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
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-sky-600 cursor-pointer"
    />
  </div>
);

interface AdditionalPhysicsSimulationsProps {
  moduleId: AdditionalPhysicsModuleId;
}

const REFRACTION_MEDIA = [
  { id: 'air', name: 'Không khí', n: 1.0 },
  { id: 'water', name: 'Nước', n: 1.333 },
  { id: 'ethanol', name: 'Rượu Etylic', n: 1.36 },
  { id: 'glass', name: 'Thủy tinh Crown', n: 1.52 },
  { id: 'flint', name: 'Thủy tinh Flint', n: 1.66 },
  { id: 'diamond', name: 'Kim cương', n: 2.42 },
];

const DECAY_ISOTOPES = [
  { id: 'I131', label: 'I-131 (Iốt)', halfLifeDisplay: '8,02 ngày', tHalfUnits: 8.02, unit: 'ngày', mode: 'β⁻ + γ' },
  { id: 'Po210', label: 'Po-210 (Pôlôni)', halfLifeDisplay: '138 ngày', tHalfUnits: 138, unit: 'ngày', mode: 'α' },
  { id: 'Cs137', label: 'Cs-137 (Xêsi)', halfLifeDisplay: '30,1 năm', tHalfUnits: 30.1, unit: 'năm', mode: 'β⁻ + γ' },
  { id: 'C14', label: 'C-14 (Cacbon)', halfLifeDisplay: '5730 năm', tHalfUnits: 5730, unit: 'năm', mode: 'β⁻' },
];

const CHARGED_PARTICLES = [
  { id: 'electron', label: 'Electron (e⁻)', qSign: -1, qMul: 1, mRel: 0.35, color: '#0284C7' },
  { id: 'proton', label: 'Prôtôn (p⁺)', qSign: 1, qMul: 1, mRel: 1.0, color: '#DC2626' },
  { id: 'alpha', label: 'Hạt Alpha (α²⁺)', qSign: 1, qMul: 2, mRel: 3.97, color: '#D97706' },
];

export const AdditionalPhysicsSimulations: React.FC<AdditionalPhysicsSimulationsProps> = ({
  moduleId,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ===========================================================================
  // 1. CHUYỂN ĐỘNG TRÒN ĐỀU & LỰC HƯỚNG TÂM
  // ===========================================================================
  const [circRadius, setCircRadius] = useState<number>(1.8); // m
  const [circOmega, setCircOmega] = useState<number>(2.4); // rad/s
  const [circMass, setCircMass] = useState<number>(1.2); // kg
  const [showCircVectors, setShowCircVectors] = useState<boolean>(true);
  const circStateRef = useRef({ angle: 0, t: 0 });
  const [circReadout, setCircReadout] = useState({ angleDeg: 0, laps: 0 });

  const circCalc = useMemo(() => {
    const v = circOmega * circRadius;
    const aHt = circOmega * circOmega * circRadius;
    const fHt = circMass * aHt;
    const period = (2 * Math.PI) / circOmega;
    const freq = circOmega / (2 * Math.PI);
    return { v, aHt, fHt, period, freq };
  }, [circRadius, circOmega, circMass]);

  // ===========================================================================
  // 0. GIA TỐC & ĐỊNH LUẬT II NEWTON (MẶT NGANG & MẶT NGHIÊNG)
  // ===========================================================================
  const [accMode, setAccMode] = useState<'horizontal' | 'incline'>('horizontal');
  const [accForceN, setAccForceN] = useState<number>(12); // N (kéo ngang)
  const [accMassKg, setAccMassKg] = useState<number>(2.0); // kg
  const [accMu, setAccMu] = useState<number>(0.15); // hệ số ma sát trượt
  const [accAngleDeg, setAccAngleDeg] = useState<number>(28); // góc nghiêng mặt phẳng
  const accG = 9.81;

  const accCalc = useMemo(() => {
    if (accMode === 'horizontal') {
      const normalN = accMassKg * accG;
      const fFrictionMax = accMu * normalN;
      const netForce = Math.max(0, accForceN - fFrictionMax);
      const a = netForce / accMassKg;
      return {
        normalN,
        fFriction: accForceN <= fFrictionMax ? accForceN : fFrictionMax,
        drivingForce: accForceN,
        netForce,
        a,
        isMoving: accForceN > fFrictionMax,
      };
    }
    const rad = (accAngleDeg * Math.PI) / 180;
    const px = accMassKg * accG * Math.sin(rad);
    const normalN = accMassKg * accG * Math.cos(rad);
    const fFrictionMax = accMu * normalN;
    const netForce = Math.max(0, px - fFrictionMax);
    const a = netForce / accMassKg;
    return {
      normalN,
      fFriction: px <= fFrictionMax ? px : fFrictionMax,
      drivingForce: px,
      netForce,
      a,
      isMoving: px > fFrictionMax,
    };
  }, [accMode, accForceN, accMassKg, accMu, accAngleDeg]);

  const accStateRef = useRef({
    s: 0, // m (0..10)
    v: 0, // m/s
    t: 0, // s
    gate1T: null as number | null,
    gate2T: null as number | null,
    finished: false,
    dots: [0] as number[],
    lastDotT: 0,
    history: [{ t: 0, v: 0, s: 0 }] as { t: number; v: number; s: number }[],
  });
  const [accReadout, setAccReadout] = useState({
    s: 0,
    v: 0,
    t: 0,
    gate1T: null as number | null,
    gate2T: null as number | null,
  });

  const resetAcceleration = () => {
    accStateRef.current = {
      s: 0,
      v: 0,
      t: 0,
      gate1T: null,
      gate2T: null,
      finished: false,
      dots: [0],
      lastDotT: 0,
      history: [{ t: 0, v: 0, s: 0 }],
    };
    setAccReadout({ s: 0, v: 0, t: 0, gate1T: null, gate2T: null });
  };

  useEffect(() => {
    resetAcceleration();
  }, [accMode, accForceN, accMassKg, accMu, accAngleDeg]);

  // ===========================================================================
  // 2. ĐỊNH LUẬT BẢO TOÀN ĐỘNG LƯỢNG (VA CHẠM & TÁCH VẬT PHẢN LỰC)
  // ===========================================================================
  const [colMode, setColMode] = useState<'elastic' | 'inelastic' | 'recoil'>('elastic');
  const [colM1, setColM1] = useState<number>(2.0); // kg
  const [colV1Init, setColV1Init] = useState<number>(4.0); // m/s
  const [colM2, setColM2] = useState<number>(3.0); // kg
  const [colV2Init, setColV2Init] = useState<number>(-1.5); // m/s
  const [colImpulse, setColImpulse] = useState<number>(10); // N.s cho chế độ tách vật
  const colStateRef = useRef({
    x1: -3.6,
    x2: 2.8,
    v1: 4.0,
    v2: -1.5,
    collided: false,
    t: 0,
    flash: 0,
  });
  const [colReadout, setColReadout] = useState({
    v1: 4.0,
    v2: -1.5,
    collided: false,
  });

  const resetCollision = (
    mode: 'elastic' | 'inelastic' | 'recoil' = colMode,
    m1 = colM1,
    v1 = colV1Init,
    m2 = colM2,
    v2 = colV2Init,
    impulse = colImpulse
  ) => {
    void m1;
    void m2;
    void impulse;
    if (mode === 'recoil') {
      colStateRef.current = {
        x1: -0.45,
        x2: 0.45,
        v1: 0,
        v2: 0,
        collided: false,
        t: 0,
        flash: 0,
      };
      setColReadout({ v1: 0, v2: 0, collided: false });
    } else {
      colStateRef.current = {
        x1: -3.8,
        x2: 3.0,
        v1,
        v2,
        collided: false,
        t: 0,
        flash: 0,
      };
      setColReadout({ v1, v2, collided: false });
    }
  };

  const colCalc = useMemo(() => {
    if (colMode === 'recoil') {
      const pBefore = 0;
      const ekBefore = 0;
      const v1After = -colImpulse / colM1;
      const v2After = colImpulse / colM2;
      const pAfter = colM1 * v1After + colM2 * v2After;
      const ekAfter = 0.5 * colM1 * v1After * v1After + 0.5 * colM2 * v2After * v2After;
      return { pBefore, pAfter, ekBefore, ekAfter, v1After, v2After, heatLoss: 0 };
    }
    const pBefore = colM1 * colV1Init + colM2 * colV2Init;
    const ekBefore = 0.5 * colM1 * colV1Init * colV1Init + 0.5 * colM2 * colV2Init * colV2Init;
    let v1After = 0;
    let v2After = 0;
    if (colMode === 'elastic') {
      v1After = ((colM1 - colM2) * colV1Init + 2 * colM2 * colV2Init) / (colM1 + colM2);
      v2After = ((colM2 - colM1) * colV2Init + 2 * colM1 * colV1Init) / (colM1 + colM2);
    } else {
      const vCommon = pBefore / (colM1 + colM2);
      v1After = vCommon;
      v2After = vCommon;
    }
    const pAfter = colM1 * v1After + colM2 * v2After;
    const ekAfter = 0.5 * colM1 * v1After * v1After + 0.5 * colM2 * v2After * v2After;
    const heatLoss = Math.max(0, ekBefore - ekAfter);
    return { pBefore, pAfter, ekBefore, ekAfter, v1After, v2After, heatLoss };
  }, [colMode, colM1, colV1Init, colM2, colV2Init, colImpulse]);

  // ===========================================================================
  // 3. HIỆU ỨNG DOPPLER
  // ===========================================================================
  const [dopplerF0, setDopplerF0] = useState<number>(440); // Hz
  const [dopplerVs, setDopplerVs] = useState<number>(110); // m/s (source rightwards)
  const [dopplerVo, setDopplerVo] = useState<number>(0); // m/s (observer towards right if > 0)
  const [dopplerSoundOn, setDopplerSoundOn] = useState<boolean>(false);
  const dopplerSpeedSound = 340;
  const dopplerStateRef = useRef({
    sourceX: -0.78, // normalized [-1..1]
    t: 0,
    lastEmitT: 0,
    rings: [] as { cx: number; cy: number; r: number }[],
  });
  const [dopplerApproaching, setDopplerApproaching] = useState<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const dopplerCalc = useMemo(() => {
    const v = dopplerSpeedSound;
    const obsRelativeToApproach = dopplerApproaching ? dopplerVo : -dopplerVo;
    const denom = Math.max(10, dopplerApproaching ? v - dopplerVs : v + dopplerVs);
    const fObserved = dopplerF0 * ((v + obsRelativeToApproach) / denom);
    const lambda0 = v / dopplerF0;
    const lambdaFront = (v - dopplerVs) / dopplerF0;
    const lambdaBack = (v + dopplerVs) / dopplerF0;
    return { fObserved, lambda0, lambdaFront, lambdaBack };
  }, [dopplerF0, dopplerVs, dopplerVo, dopplerApproaching]);

  useEffect(() => {
    if (moduleId === 'dopplerEffect' && dopplerSoundOn && isRunning) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        if (!oscNodeRef.current) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          gain.gain.value = 0.05;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          oscNodeRef.current = osc;
          gainNodeRef.current = gain;
        }
        if (oscNodeRef.current) {
          oscNodeRef.current.frequency.setTargetAtTime(
            Math.max(140, Math.min(1800, dopplerCalc.fObserved)),
            ctx.currentTime,
            0.05
          );
        }
      } catch {
        // Ignore audio error
      }
    } else {
      if (oscNodeRef.current) {
        try {
          oscNodeRef.current.stop();
          oscNodeRef.current.disconnect();
        } catch {}
        oscNodeRef.current = null;
      }
      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch {}
        gainNodeRef.current = null;
      }
    }
    return () => {
      if (moduleId !== 'dopplerEffect' && oscNodeRef.current) {
        try {
          oscNodeRef.current.stop();
          oscNodeRef.current.disconnect();
        } catch {}
        oscNodeRef.current = null;
      }
    };
  }, [moduleId, dopplerSoundOn, isRunning, dopplerCalc.fObserved]);

  // ===========================================================================
  // 4. KHÚC XẠ ÁNH SÁNG, PHẢN XẠ TOÀN PHẦN & TÁN SẮC LĂNG KÍNH
  // ===========================================================================
  const [optSubMode, setOptSubMode] = useState<'refraction' | 'prism'>('refraction');
  const [refN1Id, setRefN1Id] = useState<string>('water');
  const [refN2Id, setRefN2Id] = useState<string>('air');
  const [refAngleI, setRefAngleI] = useState<number>(38); // degrees
  const [prismApexDeg, setPrismApexDeg] = useState<number>(60); // A
  const [prismIncidenceDeg, setPrismIncidenceDeg] = useState<number>(48); // i1
  const [prismWhiteLight, setPrismWhiteLight] = useState<boolean>(true);
  const [prismMonoNm, setPrismMonoNm] = useState<number>(589);

  const n1Val = useMemo(() => REFRACTION_MEDIA.find((m) => m.id === refN1Id)?.n || 1.333, [refN1Id]);
  const n2Val = useMemo(() => REFRACTION_MEDIA.find((m) => m.id === refN2Id)?.n || 1.0, [refN2Id]);

  const refCalc = useMemo(() => {
    const iRad = (refAngleI * Math.PI) / 180;
    const sinR = (n1Val * Math.sin(iRad)) / n2Val;
    const hasCritical = n1Val > n2Val;
    const iCritDeg = hasCritical ? (Math.asin(n2Val / n1Val) * 180) / Math.PI : null;
    const isTotalInternalReflection = sinR >= 1;
    const rDeg = isTotalInternalReflection ? null : (Math.asin(Math.min(1, sinR)) * 180) / Math.PI;
    return { iCritDeg, isTotalInternalReflection, rDeg };
  }, [n1Val, n2Val, refAngleI]);

  // ===========================================================================
  // 5. CẢM ỨNG ĐIỆN TỪ FARADAY, ĐỊNH LUẬT LENZ, THANH DẪN & MÁY PHÁT ĐIỆN
  // ===========================================================================
  const [emSubMode, setEmSubMode] = useState<'faraday' | 'rod' | 'generator'>('faraday');
  const [emTurns, setEmTurns] = useState<number>(120); // N vòng
  const [emBField, setEmBField] = useState<number>(0.45); // T
  const [emFreqHz, setEmFreqHz] = useState<number>(0.8); // Hz
  const [emAreaCm2, setEmAreaCm2] = useState<number>(40); // cm^2
  const [emManualMagnet, setEmManualMagnet] = useState<boolean>(false);
  const [emManualPos, setEmManualPos] = useState<number>(-0.9); // [-1.1 .. 1.1]
  // Rod submode params
  const [emRodLenCm, setEmRodLenCm] = useState<number>(40); // cm
  const [emRodVelMs, setEmRodVelMs] = useState<number>(2.5); // m/s
  const [emRodResOhm, setEmRodResOhm] = useState<number>(2.0); // Ohm

  const emStateRef = useRef({
    t: 0,
    magPos: -1.0, // [-1.2 .. 1.2]
    prevMagPos: -1.0,
    angle: 0,
    rodX: 0.15, // [0.15 .. 0.85]
    rodDir: 1,
    history: [] as { t: number; phi: number; emf: number }[],
  });
  const [emReadout, setEmReadout] = useState({ phiMwb: 0, emfV: 0, currentA: 0, fMagN: 0 });

  const emCalc = useMemo(() => {
    const S = emAreaCm2 / 10000;
    const omega = 2 * Math.PI * emFreqHz;
    const phiMax = emTurns * emBField * S * 1000; // mWb
    const emfMax =
      emSubMode === 'rod'
        ? emBField * (emRodLenCm / 100) * emRodVelMs
        : emTurns * emBField * S * omega; // V
    const rodMaxPhiMwb = emBField * (emRodLenCm / 100) * 1.0 * 1000;
    return { S, omega, phiMax, emfMax, rodMaxPhiMwb };
  }, [emTurns, emBField, emFreqHz, emAreaCm2, emSubMode, emRodLenCm, emRodVelMs]);

  // ===========================================================================
  // 6. LỰC TỪ & LỰC LO-REN-XƠ
  // ===========================================================================
  const [lorentzParticleId, setLorentzParticleId] = useState<string>('proton');
  const [lorentzB, setLorentzB] = useState<number>(0.6); // T
  const [lorentzV, setLorentzV] = useState<number>(3.2); // x 10^6 m/s
  const [lorentzBIntoPage, setLorentzBIntoPage] = useState<boolean>(true);
  const lorentzParticle = useMemo(
    () => CHARGED_PARTICLES.find((p) => p.id === lorentzParticleId) || CHARGED_PARTICLES[1],
    [lorentzParticleId]
  );
  const lorentzStateRef = useRef({
    x: 0.16, // normalized [0..1]
    y: 0.5,
    vx: 1,
    vy: 0,
    trail: [] as { x: number; y: number }[],
    t: 0,
  });

  const resetLorentz = () => {
    lorentzStateRef.current = {
      x: 0.15,
      y: 0.5,
      vx: 1,
      vy: 0,
      trail: [{ x: 0.15, y: 0.5 }],
      t: 0,
    };
  };

  const lorentzCalc = useMemo(() => {
    // Physical values for proton/electron/alpha at v * 1e6 m/s
    const qCoulomb = lorentzParticle.qMul * 1.602e-19;
    const mKg =
      lorentzParticle.id === 'electron'
        ? 9.109e-31
        : lorentzParticle.id === 'alpha'
        ? 6.644e-27
        : 1.673e-27;
    const vMs = lorentzV * 1e6;
    const radiusM = (mKg * vMs) / (qCoulomb * lorentzB);
    const fNewton = qCoulomb * vMs * lorentzB;
    const periodNs = ((2 * Math.PI * mKg) / (qCoulomb * lorentzB)) * 1e9;
    return { radiusM, fNewton, periodNs };
  }, [lorentzParticle, lorentzB, lorentzV]);

  // ===========================================================================
  // 7. ĐỊNH LUẬT PHÓNG XẠ & CHU KỲ BÁN RÃ
  // ===========================================================================
  const [decayIsotopeId, setDecayIsotopeId] = useState<string>('I131');
  const [decaySpeedMul, setDecaySpeedMul] = useState<number>(1.0);
  const decayIsotope = useMemo(
    () => DECAY_ISOTOPES.find((i) => i.id === decayIsotopeId) || DECAY_ISOTOPES[0],
    [decayIsotopeId]
  );
  const TOTAL_NUCLEI = 400;
  const decayStateRef = useRef({
    elapsedHalfLives: 0,
    // Each nucleus stores its scheduled decay time in units of half-lives
    decayTimes: Array.from({ length: TOTAL_NUCLEI }, () => -Math.log2(Math.max(1e-6, Math.random()))),
    history: [{ halfLives: 0, remaining: TOTAL_NUCLEI }],
  });
  const [decayReadout, setDecayReadout] = useState({
    halfLives: 0,
    remaining: TOTAL_NUCLEI,
    decayed: 0,
  });

  const resetDecay = () => {
    decayStateRef.current = {
      elapsedHalfLives: 0,
      decayTimes: Array.from({ length: TOTAL_NUCLEI }, () => -Math.log2(Math.max(1e-6, Math.random()))),
      history: [{ halfLives: 0, remaining: TOTAL_NUCLEI }],
    };
    setDecayReadout({ halfLives: 0, remaining: TOTAL_NUCLEI, decayed: 0 });
  };

  useEffect(() => {
    resetLorentz();
  }, [lorentzParticleId, lorentzB, lorentzV, lorentzBIntoPage]);

  useEffect(() => {
    resetDecay();
  }, [decayIsotopeId]);

  // ===========================================================================
  // MAIN 60FPS ANIMATION LOOP
  // ===========================================================================
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let uiTimer = 0;

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const dt = isRunning ? rawDt * timeScale : 0;

      // 0. Acceleration & Newton's 2nd Law
      if (moduleId === 'accelerationNewton' && canvasRef.current) {
        const st = accStateRef.current;
        if (dt > 0 && !st.finished && accCalc.a > 0) {
          const sub = 5;
          const h = dt / sub;
          for (let i = 0; i < sub; i++) {
            st.t += h;
            st.v += accCalc.a * h;
            st.s += st.v * h;
            if (st.gate1T === null && st.s >= 2.5) st.gate1T = st.t;
            if (st.gate2T === null && st.s >= 7.5) st.gate2T = st.t;
            if (st.s >= 10) {
              st.s = 10;
              st.finished = true;
              break;
            }
          }
          if (st.t - st.lastDotT >= 0.32 || st.finished) {
            st.dots.push(st.s);
            st.lastDotT = st.t;
          }
          st.history.push({ t: st.t, v: st.v, s: st.s });
          if (st.history.length > 220) st.history.shift();
        }
        drawAccelerationCanvas(canvasRef.current);
        uiTimer += rawDt;
        if (uiTimer >= 0.06) {
          uiTimer = 0;
          setAccReadout({
            s: st.s,
            v: st.v,
            t: st.t,
            gate1T: st.gate1T,
            gate2T: st.gate2T,
          });
        }
      }

      // 1. Circular motion
      if (moduleId === 'circularMotion' && canvasRef.current) {
        const st = circStateRef.current;
        if (dt > 0) {
          st.t += dt;
          st.angle += circOmega * dt;
        }
        drawCircularCanvas(canvasRef.current);
        uiTimer += rawDt;
        if (uiTimer >= 0.08) {
          uiTimer = 0;
          setCircReadout({
            angleDeg: ((st.angle * 180) / Math.PI) % 360,
            laps: Math.floor(st.angle / (2 * Math.PI)),
          });
        }
      }

      // 2. Momentum conservation (Elastic, Inelastic, Recoil)
      if (moduleId === 'momentumCollision' && canvasRef.current) {
        const st = colStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (colMode === 'recoil') {
            if (!st.collided && st.t >= 0.65) {
              st.collided = true;
              st.flash = 1;
              st.v1 = -colImpulse / colM1;
              st.v2 = colImpulse / colM2;
            }
            st.x1 += st.v1 * dt;
            st.x2 += st.v2 * dt;
            if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 3);
            if (st.x1 < -5.3) {
              st.x1 = -5.3;
              st.v1 = Math.abs(st.v1);
            }
            if (st.x2 > 5.3) {
              st.x2 = 5.3;
              st.v2 = -Math.abs(st.v2);
            }
          } else {
            st.x1 += st.v1 * dt;
            st.x2 += st.v2 * dt;
            if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 3);

            const rSum = 0.85;
            if (!st.collided && st.x2 - st.x1 <= rSum && st.v1 > st.v2) {
              st.collided = true;
              st.flash = 1;
              const mid = (st.x1 + st.x2) / 2;
              st.x1 = mid - rSum / 2;
              st.x2 = mid + rSum / 2;
              if (colMode === 'elastic') {
                const u1 = st.v1;
                const u2 = st.v2;
                st.v1 = ((colM1 - colM2) * u1 + 2 * colM2 * u2) / (colM1 + colM2);
                st.v2 = ((colM2 - colM1) * u2 + 2 * colM1 * u1) / (colM1 + colM2);
              } else {
                const vCommon = (colM1 * st.v1 + colM2 * st.v2) / (colM1 + colM2);
                st.v1 = vCommon;
                st.v2 = vCommon;
              }
            }
            if (st.x1 < -5.3) {
              st.x1 = -5.3;
              st.v1 = Math.abs(st.v1);
              if (colMode === 'inelastic' && st.collided) st.v2 = st.v1;
            }
            if (st.x2 > 5.3) {
              st.x2 = 5.3;
              st.v2 = -Math.abs(st.v2);
              if (colMode === 'inelastic' && st.collided) st.v1 = st.v2;
            }
          }
        }
        drawCollisionCanvas(canvasRef.current);
        uiTimer += rawDt;
        if (uiTimer >= 0.08) {
          uiTimer = 0;
          setColReadout({ v1: st.v1, v2: st.v2, collided: st.collided });
        }
      }

      // 3. Doppler effect
      if (moduleId === 'dopplerEffect' && canvasRef.current) {
        const st = dopplerStateRef.current;
        if (dt > 0) {
          st.t += dt;
          const normSpeed = (dopplerVs / dopplerSpeedSound) * 0.24;
          st.sourceX += normSpeed * dt;
          if (st.sourceX > 0.92) {
            st.sourceX = -0.88;
            st.rings = [];
          }
          const emitInterval = Math.max(0.06, 0.26 * (440 / dopplerF0));
          if (st.t - st.lastEmitT >= emitInterval) {
            st.lastEmitT = st.t;
            st.rings.push({ cx: st.sourceX, cy: 0.5, r: 0.005 });
          }
          st.rings.forEach((rg) => {
            rg.r += 0.24 * dt;
          });
          st.rings = st.rings.filter((rg) => rg.r < 1.8);
        }
        drawDopplerCanvas(canvasRef.current);
        uiTimer += rawDt;
        if (uiTimer >= 0.08) {
          uiTimer = 0;
          setDopplerApproaching(st.sourceX <= 0.48);
        }
      }

      // 4. Refraction & Dispersion (instant redraw on slider changes)
      if (moduleId === 'refractionDispersion' && canvasRef.current) {
        drawRefractionCanvas(canvasRef.current);
      }

      // 5. Electromagnetic Induction
      if (moduleId === 'electromagneticInduction' && canvasRef.current) {
        const st = emStateRef.current;
        if (dt > 0) {
          st.t += dt;
          const omega = 2 * Math.PI * emFreqHz;
          st.angle = omega * st.t;
          const S = emAreaCm2 / 10000;
          let phi = 0;
          let emf = 0;
          let currentA = 0;
          let fMagN = 0;

          if (emSubMode === 'faraday') {
            if (emManualMagnet) {
              // Smoothly approach manual position and compute derivative dPos/dt
              const diff = emManualPos - st.magPos;
              const vel = (diff * 12);
              st.magPos += diff * Math.min(1, dt * 12);
              const bell = Math.exp(-3.2 * st.magPos * st.magPos);
              phi = emTurns * emBField * S * bell * 1000; // mWb
              const dBellDPos = -6.4 * st.magPos * bell;
              emf = -emTurns * emBField * S * dBellDPos * vel;
            } else {
              st.magPos = -Math.cos(st.angle);
              const bell = Math.exp(-3.2 * st.magPos * st.magPos);
              phi = emTurns * emBField * S * bell * 1000; // mWb
              const dMagDt = omega * Math.sin(st.angle);
              const dBellDPos = -6.4 * st.magPos * bell;
              emf = -emTurns * emBField * S * dBellDPos * dMagDt;
            }
            currentA = emf / 2.0;
          } else if (emSubMode === 'rod') {
            const lenM = emRodLenCm / 100;
            const normSpeed = 0.22 * (emRodVelMs / 2.5);
            st.rodX += st.rodDir * normSpeed * dt;
            if (st.rodX >= 0.86) {
              st.rodX = 0.86;
              st.rodDir = -1;
            } else if (st.rodX <= 0.16) {
              st.rodX = 0.16;
              st.rodDir = 1;
            }
            const signedV = st.rodDir * emRodVelMs;
            // Flux Phi = B * l * x (with x proportional to rodX)
            phi = emBField * lenM * (st.rodX * 1.0) * 1000; // mWb
            emf = -emBField * lenM * signedV;
            currentA = emf / emRodResOhm;
            fMagN = emBField * Math.abs(currentA) * lenM;
          } else {
            phi = emTurns * emBField * S * Math.cos(st.angle) * 1000;
            emf = emTurns * emBField * S * omega * Math.sin(st.angle);
            currentA = emf / 2.0;
          }

          st.history.push({ t: st.t, phi, emf });
          if (st.history.length > 220) st.history.shift();
          uiTimer += rawDt;
          if (uiTimer >= 0.07) {
            uiTimer = 0;
            setEmReadout({ phiMwb: phi, emfV: emf, currentA, fMagN });
          }
        }
        drawEmCanvas(canvasRef.current);
      }

      // 6. Lorentz Force
      if (moduleId === 'lorentzForce' && canvasRef.current) {
        const st = lorentzStateRef.current;
        if (dt > 0) {
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const w = Math.max(320, rect.width);
          const h = Math.max(360, rect.height);
          const aspect = w / h;
          const fieldLeft = 0.25;

          const speedNorm = 0.24 * (lorentzV / 3.2);
          // Desired visual radius proportional to m*v / (|q|*B)
          const rVisual = Math.max(
            0.09,
            Math.min(0.42, 0.22 * ((lorentzParticle.mRel * (lorentzV / 3.2)) / (lorentzParticle.qMul * (lorentzB / 0.6))))
          );
          const subSteps = 6;
          const subDt = dt / subSteps;
          for (let s = 0; s < subSteps; s++) {
            const inField = st.x >= fieldLeft && st.x <= 0.96 && st.y >= 0.04 && st.y <= 0.96;
            if (inField) {
              // F = q (v x B). Screen x right, y down. B into screen (+z):
              // For q > 0, v=(1,0), v x (+z) = (0, -1) -> upward deflection!
              const bDir = lorentzBIntoPage ? 1 : -1;
              const sign = lorentzParticle.qSign * bDir;
              const angularRate = sign * (speedNorm / rVisual);
              const dTheta = angularRate * subDt;
              const nvx = st.vx * Math.cos(dTheta) + st.vy * Math.sin(dTheta);
              const nvy = -st.vx * Math.sin(dTheta) + st.vy * Math.cos(dTheta);
              st.vx = nvx;
              st.vy = nvy;
            }
            st.x += (st.vx * speedNorm * subDt) / aspect;
            st.y += st.vy * speedNorm * subDt;

            if (st.x > 1.04 || st.x < -0.04 || st.y < -0.05 || st.y > 1.05) {
              st.x = 0.12;
              st.y = 0.5;
              st.vx = 1;
              st.vy = 0;
              st.trail = [{ x: st.x, y: st.y }];
            }
          }
          st.trail.push({ x: st.x, y: st.y });
          if (st.trail.length > 220) st.trail.shift();
        }
        drawLorentzCanvas(canvasRef.current);
      }

      // 7. Radioactive Decay
      if (moduleId === 'radioactiveDecay' && canvasRef.current) {
        const st = decayStateRef.current;
        if (dt > 0 && st.elapsedHalfLives < 5.0) {
          st.elapsedHalfLives = Math.min(5.0, st.elapsedHalfLives + dt * 0.35 * decaySpeedMul);
          const remaining = st.decayTimes.filter((tDec) => tDec > st.elapsedHalfLives).length;
          const lastHist = st.history[st.history.length - 1];
          if (!lastHist || st.elapsedHalfLives - lastHist.halfLives >= 0.04) {
            st.history.push({ halfLives: st.elapsedHalfLives, remaining });
          }
          uiTimer += rawDt;
          if (uiTimer >= 0.08) {
            uiTimer = 0;
            setDecayReadout({
              halfLives: st.elapsedHalfLives,
              remaining,
              decayed: TOTAL_NUCLEI - remaining,
            });
          }
        }
        drawDecayCanvas(canvasRef.current);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  // ===========================================================================
  // DRAWING FUNCTIONS
  // ===========================================================================
  const setupCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  const drawAccelerationCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const stageH = Math.floor(h * 0.58);
    const graphH = h - stageH;
    const st = accStateRef.current;

    if (accMode === 'horizontal') {
      const railY = stageH * 0.68;
      const padX = 48;
      const trackPx = w - padX * 2;
      const toX = (sMeters: number) => padX + (sMeters / 10) * trackPx;

      // Ground & ruler ticks
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(padX - 10, railY, trackPx + 20, 12);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padX - 10, railY);
      ctx.lineTo(padX + trackPx + 10, railY);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '500 10px ui-monospace, monospace';
      for (let m = 0; m <= 10; m += 1) {
        const tx = toX(m);
        ctx.beginPath();
        ctx.moveTo(tx, railY);
        ctx.lineTo(tx, railY + 6);
        ctx.stroke();
        ctx.fillText(`${m}m`, tx - 7, railY + 23);
      }

      // Photogates at 2.5m & 7.5m
      [2.5, 7.5].forEach((gm, idx) => {
        const gx = toX(gm);
        ctx.strokeStyle = '#0EA5E9';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(gx, railY - 64);
        ctx.lineTo(gx, railY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#0369A1';
        ctx.font = '700 10px ui-sans-serif, sans-serif';
        ctx.fillText(`Cổng ${idx + 1} (${gm}m)`, gx - 28, railY - 68);
      });

      // Strobe position markers
      st.dots.forEach((dm) => {
        const dx = toX(dm);
        ctx.fillStyle = 'rgba(2, 132, 199, 0.35)';
        ctx.beginPath();
        ctx.arc(dx, railY - 5, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Block
      const bx = toX(st.s);
      const boxW = 54;
      const boxH = 38;
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.roundRect(bx - boxW / 2, railY - boxH, boxW, boxH, 7);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${accMassKg.toFixed(1)}kg`, bx, railY - 15);
      ctx.textAlign = 'left';

      const cy = railY - boxH / 2;
      drawArrow(ctx, bx + boxW / 2, cy, bx + boxW / 2 + Math.min(85, accForceN * 2.5), cy, '#DC2626', `F=${accForceN}N`);
      if (accCalc.fFriction > 0.05) {
        drawArrow(ctx, bx - boxW / 2, cy + 8, bx - boxW / 2 - Math.min(65, accCalc.fFriction * 2.5), cy + 8, '#D97706', `Fms=${accCalc.fFriction.toFixed(1)}N`);
      }
      if (accCalc.a > 0) {
        drawArrow(ctx, bx, railY - boxH - 12, bx + Math.min(75, accCalc.a * 12), railY - boxH - 12, '#059669', `a=${accCalc.a.toFixed(2)}`);
      }
    } else {
      // Inclined plane mode
      const rad = (accAngleDeg * Math.PI) / 180;
      const baseLeft = 72;
      const baseY = stageH - 26;
      const rampLenPx = Math.min(w - 150, (stageH - 60) / Math.max(0.25, Math.sin(rad)));
      const topX = baseLeft;
      const topY = baseY - rampLenPx * Math.sin(rad);
      const endX = baseLeft + rampLenPx * Math.cos(rad);
      const endY = baseY;

      // Ramp triangle
      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(topX, endY);
      ctx.lineTo(endX, endY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Angle label
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText(`α = ${accAngleDeg}°`, endX - 58, endY - 8);

      const dirX = Math.cos(rad);
      const dirY = Math.sin(rad);
      const normX = Math.sin(rad);
      const normY = -Math.cos(rad);
      const frac = st.s / 10;
      const cx = topX + dirX * (frac * rampLenPx) + normX * 18;
      const cy = topY + dirY * (frac * rampLenPx) + normY * 18;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad);
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.roundRect(-24, -16, 48, 32, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${accMassKg.toFixed(1)}kg`, 0, 4);
      ctx.restore();
      ctx.textAlign = 'left';

      // Force vectors P, N, Fms
      drawArrow(ctx, cx, cy, cx, cy + 48, '#475569', 'P');
      drawArrow(ctx, cx, cy, cx + normX * 42, cy + normY * 42, '#0284C7', 'N');
      if (accCalc.fFriction > 0.05) {
        drawArrow(ctx, cx, cy, cx - dirX * 32, cy - dirY * 32, '#D97706', 'Fms');
      }
      if (accCalc.a > 0) {
        drawArrow(ctx, cx + normX * 22, cy + normY * 22, cx + normX * 22 + dirX * 48, cy + normY * 22 + dirY * 48, '#059669', `a=${accCalc.a.toFixed(2)}`);
      }
    }

    // Bottom subplots: v(t) and s(t)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, stageH, w, graphH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, stageH);
    ctx.lineTo(w, stageH);
    ctx.stroke();

    const halfW = Math.floor(w / 2);
    const drawMiniGraph = (leftX: number, subW: number, title: string, color: string, getY: (p: { t: number; v: number; s: number }) => number, maxY: number) => {
      const gx = leftX + 24;
      const gy = stageH + 28;
      const gw = subW - 40;
      const gh = graphH - 42;
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.fillStyle = '#334155';
      ctx.font = '600 11px ui-sans-serif, sans-serif';
      ctx.fillText(title, leftX + 14, stageH + 18);

      const hist = st.history;
      if (hist.length > 1) {
        const maxT = Math.max(2.5, hist[hist.length - 1].t);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        hist.forEach((pt, idx) => {
          const px = gx + (pt.t / maxT) * gw;
          const py = gy + gh - Math.min(1, getY(pt) / Math.max(0.5, maxY)) * gh;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    };

    const maxVRef = Math.max(4, Math.sqrt(2 * Math.max(0.5, accCalc.a) * 10));
    drawMiniGraph(0, halfW, 'Đồ thị vận tốc v(t) = at (đường thẳng)', '#059669', (p) => p.v, maxVRef);
    drawMiniGraph(halfW, w - halfW, 'Đồ thị quãng đường s(t) = ½at² (parabol)', '#0284C7', (p) => p.s, 10);
  };

  const drawCircularCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    // Subtle polar grid
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rPx = Math.min(w, h) * 0.34 * (circRadius / 2.2);

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, cy);
    ctx.lineTo(w - 20, cy);
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx, h - 20);
    ctx.stroke();

    // Orbit ring
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const ang = circStateRef.current.angle;
    const px = cx + rPx * Math.cos(ang);
    const py = cy - rPx * Math.sin(ang);

    // Swept angle sector
    ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Math.min(48, rPx * 0.45), -(ang % (Math.PI * 2)), 0);
    ctx.closePath();
    ctx.fill();

    // Radius rod
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText('O', cx - 16, cy + 16);

    if (showCircVectors) {
      // Tangential velocity (counter-clockwise: (-sin, -cos) in screen coords since y is down)
      const vLen = Math.min(110, Math.max(30, circCalc.v * 14));
      const vx = -Math.sin(ang) * vLen;
      const vy = -Math.cos(ang) * vLen;
      drawArrow(ctx, px, py, px + vx, py + vy, '#059669', 'v');

      // Centripetal force / acceleration toward O
      const fLen = Math.min(rPx * 0.85, Math.max(26, circCalc.fHt * 4.5));
      const fx = ((cx - px) / rPx) * fLen;
      const fy = ((cy - py) / rPx) * fLen;
      drawArrow(ctx, px, py, px + fx, py + fy, '#DC2626', 'Fht');
    }

    // Mass bob
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('m', px, py + 3);
    ctx.textAlign = 'left';
  };

  const drawCollisionCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const trackY = h * 0.58;
    const padX = 48;
    const trackW = w - padX * 2;
    const toPxX = (worldX: number) => padX + ((worldX + 6) / 12) * trackW;

    // Air track rail
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(padX, trackY + 26, trackW, 12);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padX, trackY + 26);
    ctx.lineTo(padX + trackW, trackY + 26);
    ctx.stroke();

    // Scale ticks
    ctx.fillStyle = '#64748B';
    ctx.font = '500 10px ui-monospace, monospace';
    for (let xm = -5; xm <= 5; xm += 1) {
      const tx = toPxX(xm);
      ctx.beginPath();
      ctx.moveTo(tx, trackY + 26);
      ctx.lineTo(tx, trackY + 33);
      ctx.stroke();
      ctx.fillText(`${xm}m`, tx - 8, trackY + 50);
    }

    const st = colStateRef.current;
    const x1Px = toPxX(st.x1);
    const x2Px = toPxX(st.x2);
    const r1 = 22 + Math.min(12, colM1 * 2.5);
    const r2 = 22 + Math.min(12, colM2 * 2.5);

    // Collision flash spark
    if (st.flash > 0.05) {
      const midX = (x1Px + x2Px) / 2;
      ctx.strokeStyle = `rgba(245, 158, 11, ${st.flash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(midX, trackY, 34 * (1.2 - st.flash * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cart 1
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.roundRect(x1Px - r1, trackY - r1 + 4, r1 * 2, r1 * 1.45, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`m₁=${colM1.toFixed(1)}kg`, x1Px, trackY + 4);

    // Cart 2
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.roundRect(x2Px - r2, trackY - r2 + 4, r2 * 2, r2 * 1.45, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`m₂=${colM2.toFixed(1)}kg`, x2Px, trackY + 4);
    ctx.textAlign = 'left';

    // Show recoil spring at center before separation
    if (colMode === 'recoil' && !st.collided) {
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1Px + r1, trackY);
      ctx.lineTo(x2Px - r2, trackY);
      ctx.stroke();
    }

    // Momentum & velocity arrows above carts
    if (Math.abs(st.v1) > 0.05) {
      drawArrow(ctx, x1Px, trackY - r1 - 12, x1Px + st.v1 * 18, trackY - r1 - 12, '#0284C7', `v₁=${st.v1.toFixed(2)}`);
    }
    if (Math.abs(st.v2) > 0.05) {
      drawArrow(ctx, x2Px, trackY - r2 - 34, x2Px + st.v2 * 18, trackY - r2 - 34, '#D97706', `v₂=${st.v2.toFixed(2)}`);
    }

    // Top momentum bar comparison
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(24, 18, w - 48, 72, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(
      `Tổng động lượng hệ: p = m₁v₁ + m₂v₂ = ${(colM1 * st.v1 + colM2 * st.v2).toFixed(2)} kg·m/s`,
      38,
      42
    );
    ctx.fillStyle = '#475569';
    ctx.font = '600 11px ui-monospace, monospace';
    const modeStatusText =
      colMode === 'recoil'
        ? st.collided
          ? 'Đã tách vật: p₁ + p₂ = 0 (ngược chiều nhau)'
          : 'Đang nén lò xo (p₀ = 0, chuẩn bị bung)'
        : st.collided
        ? colMode === 'elastic'
          ? 'Sau va chạm đàn hồi'
          : 'Sau va chạm mềm (dính vào nhau)'
        : 'Trước va chạm';
    ctx.fillText(
      `Ban đầu: p₀ = ${colCalc.pBefore.toFixed(2)} kg·m/s   |   ${modeStatusText}`,
      38,
      66
    );
  };

  const drawDopplerCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const st = dopplerStateRef.current;
    const sx = ((st.sourceX + 1) / 2) * w;
    const sy = h * 0.5;
    const obsX = w * 0.76;
    const obsY = sy;

    // Emit spherical wavefront rings
    st.rings.forEach((rg) => {
      const cx = ((rg.cx + 1) / 2) * w;
      const cy = rg.cy * h;
      const radPx = rg.r * (w * 0.5);
      const alpha = Math.max(0.08, 1 - rg.r / 1.5);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radPx, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Observer microphone
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(obsX, obsY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText('Máy thu', obsX - 22, obsY + 28);

    // Moving sound source
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(sx - 18, sy - 12, 36, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('f₀', sx, sy + 4);
    ctx.textAlign = 'left';

    drawArrow(ctx, sx + 22, sy, sx + 22 + Math.max(15, dopplerVs * 0.28), sy, '#FBBF24', `vs=${dopplerVs}m/s`);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillText(
      st.sourceX <= 0.76
        ? `Nguồn đang tiến lại gần máy thu · f' = ${dopplerCalc.fObserved.toFixed(1)} Hz (âm cao hơn f₀)`
        : `Nguồn đang đi ra xa máy thu · f' = ${dopplerCalc.fObserved.toFixed(1)} Hz (âm trầm hơn f₀)`,
      18,
      28
    );
  };

  const drawRefractionCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;

    if (optSubMode === 'refraction') {
      const midY = h * 0.5;
      const cx = w * 0.5;

      // Top medium n1 & bottom medium n2
      ctx.fillStyle = n1Val > 1.2 ? '#E0F2FE' : '#F8FAFC';
      ctx.fillRect(0, 0, w, midY);
      ctx.fillStyle = n2Val > 1.2 ? '#BAE6FD' : '#F1F5F9';
      ctx.fillRect(0, midY, w, h - midY);

      // Interface line
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // Normal N'N
      ctx.strokeStyle = '#64748B';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, 20);
      ctx.lineTo(cx, h - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      const rayLen = Math.min(w, h) * 0.42;
      const iRad = (refAngleI * Math.PI) / 180;
      const incX = cx - rayLen * Math.sin(iRad);
      const incY = midY - rayLen * Math.cos(iRad);

      // Incident ray
      drawArrow(ctx, incX, incY, cx, midY, '#DC2626', `i=${refAngleI}°`);

      // Weak or full reflected ray
      const refX = cx + rayLen * Math.sin(iRad);
      const refY = midY - rayLen * Math.cos(iRad);
      ctx.save();
      ctx.globalAlpha = refCalc.isTotalInternalReflection ? 1 : 0.35;
      drawArrow(
        ctx,
        cx,
        midY,
        refX,
        refY,
        refCalc.isTotalInternalReflection ? '#DC2626' : '#F87171',
        refCalc.isTotalInternalReflection ? 'Phản xạ toàn phần!' : `i'=${refAngleI}°`
      );
      ctx.restore();

      // Refracted ray
      if (!refCalc.isTotalInternalReflection && refCalc.rDeg !== null) {
        const rRad = (refCalc.rDeg * Math.PI) / 180;
        const outX = cx + rayLen * Math.sin(rRad);
        const outY = midY + rayLen * Math.cos(rRad);
        drawArrow(ctx, cx, midY, outX, outY, '#0284C7', `r=${refCalc.rDeg.toFixed(1)}°`);
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(`Môi trường 1: n₁ = ${n1Val.toFixed(3)}`, 20, 28);
      ctx.fillText(`Môi trường 2: n₂ = ${n2Val.toFixed(3)}`, 20, midY + 26);
    } else {
      // Prism dispersion mode
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.44;
      const apexY = h * 0.24;
      const prismH = h * 0.48;
      const A = (prismApexDeg * Math.PI) / 180;
      const halfBase = prismH * Math.tan(A / 2);

      const topPt = { x: cx, y: apexY };
      const leftPt = { x: cx - halfBase, y: apexY + prismH };
      const rightPt = { x: cx + halfBase, y: apexY + prismH };

      // Draw glass prism
      ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topPt.x, topPt.y);
      ctx.lineTo(leftPt.x, leftPt.y);
      ctx.lineTo(rightPt.x, rightPt.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hit point on left face
      const hitX = (topPt.x + leftPt.x) / 2;
      const hitY = (topPt.y + leftPt.y) / 2;
      const leftNormalAngle = Math.PI - (Math.PI / 2 - A / 2); // pointing up-left outward
      const incAngleWorld = leftNormalAngle - (prismIncidenceDeg * Math.PI) / 180;
      const srcX = hitX + 160 * Math.cos(incAngleWorld);
      const srcY = hitY + 160 * Math.sin(incAngleWorld);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(srcX, srcY);
      ctx.lineTo(hitX, hitY);
      ctx.stroke();

      const bands = prismWhiteLight
        ? [
            { label: 'Đỏ', n: 1.512, color: '#EF4444' },
            { label: 'Cam', n: 1.517, color: '#F97316' },
            { label: 'Vàng', n: 1.522, color: '#FACC15' },
            { label: 'Lục', n: 1.531, color: '#22C55E' },
            { label: 'Lam', n: 1.541, color: '#3B82F6' },
            { label: 'Tím', n: 1.558, color: '#A855F7' },
          ]
        : [
            {
              label: `${prismMonoNm}nm`,
              n: 1.51 + ((760 - prismMonoNm) / 380) * 0.048,
              color: '#38BDF8',
            },
          ];

      const screenX = w * 0.88;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(screenX, 30);
      ctx.lineTo(screenX, h - 30);
      ctx.stroke();

      bands.forEach((b) => {
        const i1 = (prismIncidenceDeg * Math.PI) / 180;
        const r1 = Math.asin(Math.sin(i1) / b.n);
        const r2 = A - r1;
        const sinI2 = b.n * Math.sin(r2);
        const exitX = hitX + (rightPt.x - hitX) * 0.72;
        const exitY = hitY + (r1 - A / 2) * 32;

        ctx.strokeStyle = b.color;
        ctx.lineWidth = prismWhiteLight ? 2.2 : 3;
        ctx.beginPath();
        ctx.moveTo(hitX, hitY);
        ctx.lineTo(exitX, exitY);

        if (Math.abs(sinI2) < 1) {
          const i2 = Math.asin(sinI2);
          const deviation = i1 + i2 - A;
          const outDir = Math.atan2(hitY - srcY, hitX - srcX) + deviation;
          const tHit = (screenX - exitX) / Math.max(0.1, Math.cos(outDir));
          const endY = exitY + Math.sin(outDir) * tHit;
          ctx.lineTo(screenX, endY);
        }
        ctx.stroke();
      });

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText(`Góc chiết quang A = ${prismApexDeg}° · Góc tới i₁ = ${prismIncidenceDeg}°`, 20, 26);
    }
  };

  const drawEmCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const st = emStateRef.current;
    const stageH = Math.floor(h * 0.54);
    const graphH = h - stageH;

    if (emSubMode === 'faraday') {
      const coilCx = w * 0.58;
      const coilCy = stageH * 0.52;
      const magX = coilCx + st.magPos * (w * 0.24);

      // Coil loops
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 3;
      const loopCount = Math.min(10, Math.max(4, Math.round(emTurns / 30)));
      for (let i = 0; i < loopCount; i++) {
        const lx = coilCx - 45 + (i * 90) / Math.max(1, loopCount - 1);
        ctx.beginPath();
        ctx.ellipse(lx, coilCy, 10, 44, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Induced B_c arrow inside coil (Lenz's law visualization)
      if (Math.abs(emReadout.emfV) > 0.06) {
        const bcDir = emReadout.emfV >= 0 ? -1 : 1;
        drawArrow(ctx, coilCx - bcDir * 24, coilCy - 56, coilCx + bcDir * 24, coilCy - 56, '#059669', 'B_c (Lenz)');
      }

      // Galvanometer connected below
      const gx = w * 0.17;
      const gy = stageH * 0.52;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(coilCx - 45, coilCy + 44);
      ctx.lineTo(gx + 28, gy + 16);
      ctx.moveTo(coilCx + 45, coilCy + 44);
      ctx.lineTo(gx + 28, gy - 16);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const needleNorm = Math.max(-1, Math.min(1, emReadout.emfV / Math.max(0.15, emCalc.emfMax * 0.7)));
      const needleAng = -Math.PI / 2 + needleNorm * (Math.PI / 3);
      drawArrow(ctx, gx, gy + 10, gx + 24 * Math.cos(needleAng), gy + 10 + 24 * Math.sin(needleAng), '#DC2626');
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText('G', gx - 4, gy + 26);

      // Bar magnet
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(magX - 42, coilCy - 16, 42, 32);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(magX, coilCy - 16, 42, 32);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px ui-sans-serif, sans-serif';
      ctx.fillText('N', magX - 26, coilCy + 4);
      ctx.fillText('S', magX + 16, coilCy + 4);
    } else if (emSubMode === 'rod') {
      const railLeft = w * 0.16;
      const railRight = w * 0.88;
      const railTop = stageH * 0.24;
      const railBot = stageH * 0.78;

      // Magnetic field markers (⊗ B into page)
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 1.2;
      for (let gx = railLeft + 24; gx < railRight - 10; gx += 42) {
        for (let gy = railTop + 16; gy < railBot - 10; gy += 36) {
          ctx.beginPath();
          ctx.arc(gx, gy, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(gx - 3.5, gy - 3.5);
          ctx.lineTo(gx + 3.5, gy + 3.5);
          ctx.moveTo(gx + 3.5, gy - 3.5);
          ctx.lineTo(gx - 3.5, gy + 3.5);
          ctx.stroke();
        }
      }

      // Parallel rails + left resistor R
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(railRight, railTop);
      ctx.lineTo(railLeft, railTop);
      ctx.lineTo(railLeft, railBot);
      ctx.lineTo(railRight, railBot);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      const resY = (railTop + railBot) / 2;
      ctx.fillRect(railLeft - 14, resY - 22, 28, 44);
      ctx.strokeRect(railLeft - 14, resY - 22, 28, 44);
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText(`R`, railLeft - 4, resY + 4);

      // Moving metal rod MN
      const rodPx = railLeft + st.rodX * (railRight - railLeft);
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(rodPx, railTop - 10);
      ctx.lineTo(rodPx, railBot + 10);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '800 12px ui-sans-serif, sans-serif';
      ctx.fillText('M', rodPx - 5, railTop - 16);
      ctx.fillText('N', rodPx - 5, railBot + 24);

      // Velocity vector v & opposing Magnetic force F_từ (Lenz)
      const dir = st.rodDir;
      drawArrow(ctx, rodPx, resY - 14, rodPx + dir * 48, resY - 14, '#059669', 'v');
      drawArrow(ctx, rodPx, resY + 14, rodPx - dir * 38, resY + 14, '#DC2626', 'F_từ');

      // Induced current direction on rod & rails
      const iDirY = dir > 0 ? -1 : 1; // v=(+1,0), B into page -> F_L on +q is up (N -> M)
      drawArrow(ctx, rodPx - 14, resY + iDirY * 22, rodPx - 14, resY - iDirY * 22, '#0284C7', 'I_c');

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText(`Từ trường B = ${emBField.toFixed(2)} T (⊗) · Thanh MN dài l = ${emRodLenCm} cm`, railLeft + 14, 20);
    } else {
      const cx = w * 0.5;
      const cy = stageH * 0.5;
      // N - S magnet poles
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(cx - 170, cy - 55, 55, 110);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(cx + 115, cy - 55, 55, 110);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 18px ui-sans-serif, sans-serif';
      ctx.fillText('N', cx - 150, cy + 6);
      ctx.fillText('S', cx + 135, cy + 6);

      // Magnetic field arrows B
      for (let yy = cy - 36; yy <= cy + 36; yy += 36) {
        drawArrow(ctx, cx - 105, yy, cx + 105, yy, '#94A3B8');
      }

      // Rotating coil projection
      const projW = 68 * Math.cos(st.angle);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 4;
      ctx.strokeRect(cx - projW / 2, cy - 44, projW, 88);
    }

    // Bottom graph: Phi(t) and e(t)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, stageH, w, graphH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, stageH);
    ctx.lineTo(w, stageH);
    ctx.stroke();

    const midY = stageH + graphH * 0.56;
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(24, midY);
    ctx.lineTo(w - 20, midY);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '600 11px ui-sans-serif, sans-serif';
    ctx.fillText('Từ thông Φ(t) [xanh dương] · Suất điện động cảm ứng e(t) [đỏ]', 16, stageH + 18);

    const hist = st.history;
    if (hist.length > 1) {
      const maxPhi = Math.max(0.5, emSubMode === 'rod' ? emCalc.rodMaxPhiMwb : emCalc.phiMax);
      const maxEmf = Math.max(0.2, emCalc.emfMax);
      const plotW = w - 48;
      const halfH = graphH * 0.32;

      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const px = 24 + (idx / Math.max(1, hist.length - 1)) * plotW;
        const py = midY - (pt.phi / maxPhi) * halfH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const px = 24 + (idx / Math.max(1, hist.length - 1)) * plotW;
        const py = midY - (pt.emf / maxEmf) * halfH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  };

  const drawLorentzCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const fieldLeftPx = w * 0.25;
    ctx.fillStyle = 'rgba(2, 132, 199, 0.06)';
    ctx.fillRect(fieldLeftPx, 0, w - fieldLeftPx, h);
    ctx.strokeStyle = '#0284C7';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fieldLeftPx, 0);
    ctx.lineTo(fieldLeftPx, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw B-field symbols (⊗ or ⊙)
    ctx.strokeStyle = '#64748B';
    ctx.fillStyle = '#64748B';
    ctx.lineWidth = 1.2;
    for (let gx = fieldLeftPx + 36; gx < w - 20; gx += 48) {
      for (let gy = 36; gy < h - 20; gy += 48) {
        ctx.beginPath();
        ctx.arc(gx, gy, 7, 0, Math.PI * 2);
        ctx.stroke();
        if (lorentzBIntoPage) {
          ctx.beginPath();
          ctx.moveTo(gx - 4, gy - 4);
          ctx.lineTo(gx + 4, gy + 4);
          ctx.moveTo(gx + 4, gy - 4);
          ctx.lineTo(gx - 4, gy + 4);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const st = lorentzStateRef.current;
    if (st.trail.length > 1) {
      ctx.strokeStyle = lorentzParticle.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      st.trail.forEach((pt, idx) => {
        const px = pt.x * w;
        const py = pt.y * h;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    const px = st.x * w;
    const py = st.y * h;
    drawArrow(ctx, px, py, px + st.vx * 45, py + st.vy * 45, '#059669', 'v');

    if (st.x >= 0.25) {
      const bDir = lorentzBIntoPage ? 1 : -1;
      const sign = lorentzParticle.qSign * bDir;
      const fx = st.vy * sign * 40;
      const fy = -st.vx * sign * 40;
      drawArrow(ctx, px, py, px + fx, py + fy, '#DC2626', 'f_L');
    }

    ctx.fillStyle = lorentzParticle.color;
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText(`Vùng từ trường đều B = ${lorentzB.toFixed(2)} T (${lorentzBIntoPage ? '⊗ hướng vào' : '⊙ hướng ra'})`, fieldLeftPx + 12, 22);
  };

  const drawDecayCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const st = decayStateRef.current;
    const splitX = Math.floor(w * 0.46);

    // Left: 20x20 grid of 400 nuclei
    const gridPad = 24;
    const gridSpan = Math.min(splitX - gridPad * 2, h - 76);
    const cell = gridSpan / 20;
    const startX = (splitX - gridSpan) / 2;
    const startY = 42;

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Mẫu 400 hạt nhân', startX, 24);

    for (let i = 0; i < TOTAL_NUCLEI; i++) {
      const row = Math.floor(i / 20);
      const col = i % 20;
      const nx = startX + col * cell + cell / 2;
      const ny = startY + row * cell + cell / 2;
      const isParent = st.decayTimes[i] > st.elapsedHalfLives;
      ctx.fillStyle = isParent ? '#0284C7' : '#CBD5E1';
      ctx.beginPath();
      ctx.arc(nx, ny, Math.max(2.5, cell * 0.34), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#475569';
    ctx.font = '600 11px ui-sans-serif, sans-serif';
    ctx.fillText('■ Xanh: Hạt nhân mẹ (chưa phân rã) · ■ Xám: Hạt nhân con', startX, startY + gridSpan + 20);

    // Right: Exponential decay curve N(t)
    const gx = splitX + 42;
    const gy = 38;
    const gw = w - gx - 24;
    const gh = h - gy - 44;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    // Vertical T, 2T, 3T, 4T markers
    ctx.font = '600 10px ui-monospace, monospace';
    for (let k = 1; k <= 4; k++) {
      const tx = gx + (k / 5) * gw;
      ctx.strokeStyle = '#E2E8F0';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(tx, gy);
      ctx.lineTo(tx, gy + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#64748B';
      ctx.fillText(`${k}T`, tx - 6, gy + gh + 15);
    }

    // Theoretical curve N0 * 2^(-t/T)
    ctx.strokeStyle = '#94A3B8';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let step = 0; step <= 80; step++) {
      const hl = (step / 80) * 5;
      const px = gx + (hl / 5) * gw;
      const py = gy + gh - Math.pow(2, -hl) * gh;
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Simulated Monte-Carlo parent curve
    if (st.history.length > 1) {
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      st.history.forEach((pt, idx) => {
        const px = gx + (pt.halfLives / 5) * gw;
        const py = gy + gh - (pt.remaining / TOTAL_NUCLEI) * gh;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Đồ thị phân rã N(t) = N₀ · 2^(-t/T)', gx, 24);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
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
                if (moduleId === 'accelerationNewton') resetAcceleration();
                else if (moduleId === 'circularMotion') circStateRef.current = { angle: 0, t: 0 };
                else if (moduleId === 'momentumCollision') resetCollision();
                else if (moduleId === 'dopplerEffect') dopplerStateRef.current = { sourceX: -0.78, t: 0, lastEmitT: 0, rings: [] };
                else if (moduleId === 'electromagneticInduction')
                  emStateRef.current = { t: 0, magPos: -1, prevMagPos: -1, angle: 0, rodX: 0.16, rodDir: 1, history: [] };
                else if (moduleId === 'lorentzForce') resetLorentz();
                else if (moduleId === 'radioactiveDecay') resetDecay();
                setIsRunning(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Đặt lại</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {moduleId === 'dopplerEffect' && (
              <button
                type="button"
                onClick={() => setDopplerSoundOn((v) => !v)}
                className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 cursor-pointer ${
                  dopplerSoundOn
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {dopplerSoundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>{dopplerSoundOn ? 'Tắt âm' : 'Nghe Doppler'}</span>
              </button>
            )}
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

        <div className="relative w-full h-[430px] sm:h-[490px] bg-slate-50">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {moduleId === 'accelerationNewton' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Gia tốc lý thuyết a</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {accCalc.a.toFixed(2)} m/s²
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Hợp lực Fhl / Lực ma sát</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {accCalc.netForce.toFixed(1)} N · {accCalc.fFriction.toFixed(1)} N
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Vận tốc / Quãng đường</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {accReadout.v.toFixed(2)} m/s · {accReadout.s.toFixed(2)} m
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Cổng quang 1 (2.5m) / 2 (7.5m)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {accReadout.gate1T !== null ? `${accReadout.gate1T.toFixed(2)}s` : '--'} · {accReadout.gate2T !== null ? `${accReadout.gate2T.toFixed(2)}s` : '--'}
                </span>
              </div>
            </>
          )}

          {moduleId === 'circularMotion' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tốc độ dài v = ωR</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {circCalc.v.toFixed(2)} m/s
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Gia tốc hướng tâm</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {circCalc.aHt.toFixed(2)} m/s²
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Lực hướng tâm Fht</span>
                <span className="font-mono tabular-nums font-bold text-rose-700 mt-0.5 block">
                  {circCalc.fHt.toFixed(2)} N
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Chu kỳ T / Số vòng</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {circCalc.period.toFixed(2)} s · {circReadout.laps} vòng
                </span>
              </div>
            </>
          )}

          {moduleId === 'momentumCollision' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Động lượng p trước/sau</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {colCalc.pBefore.toFixed(2)} / {colCalc.pAfter.toFixed(2)} kg·m/s
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Vận tốc hiện tại (v₁, v₂)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {colReadout.v1.toFixed(2)} · {colReadout.v2.toFixed(2)} m/s
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Động năng trước → sau</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {colCalc.ekBefore.toFixed(1)} → {colCalc.ekAfter.toFixed(1)} J
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Nhiệt năng tỏa ra Q</span>
                <span className="font-mono tabular-nums font-bold text-amber-700 mt-0.5 block">
                  {colCalc.heatLoss.toFixed(2)} J
                </span>
              </div>
            </>
          )}

          {moduleId === 'dopplerEffect' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tần số phát f₀</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {dopplerF0} Hz
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tần số máy thu f'</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {dopplerCalc.fObserved.toFixed(1)} Hz
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Bước sóng phía trước</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {(dopplerCalc.lambdaFront * 100).toFixed(1)} cm
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Bước sóng phía sau</span>
                <span className="font-mono tabular-nums font-bold text-amber-700 mt-0.5 block">
                  {(dopplerCalc.lambdaBack * 100).toFixed(1)} cm
                </span>
              </div>
            </>
          )}

          {moduleId === 'refractionDispersion' && optSubMode === 'refraction' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Góc tới i</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {refAngleI}°
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Góc khúc xạ r</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {refCalc.rDeg === null ? 'Không có' : `${refCalc.rDeg.toFixed(1)}°`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Góc giới hạn igh</span>
                <span className="font-mono tabular-nums font-bold text-amber-700 mt-0.5 block">
                  {refCalc.iCritDeg === null ? 'Không tồn tại (n₁ ≤ n₂)' : `${refCalc.iCritDeg.toFixed(1)}°`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Hiện tượng</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {refCalc.isTotalInternalReflection ? 'Phản xạ toàn phần' : 'Khúc xạ ánh sáng'}
                </span>
              </div>
            </>
          )}

          {moduleId === 'refractionDispersion' && optSubMode === 'prism' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Góc chiết quang A</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {prismApexDeg}°
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Góc tới i₁</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {prismIncidenceDeg}°
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                <span className="text-[11px] text-slate-500 block">Giải thích tán sắc</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {prismWhiteLight
                    ? 'Chiết suất thủy tinh tăng từ Đỏ (n = 1.512) đến Tím (n = 1.558) nên tia tím lệch nhiều nhất.'
                    : `Ánh sáng đơn sắc ${prismMonoNm} nm bị lệch nhưng không bị tách màu.`}
                </span>
              </div>
            </>
          )}

          {moduleId === 'electromagneticInduction' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">
                  {emSubMode === 'rod' ? 'Độ lớn s.đ.đ |e_c| = Blv' : 'Từ thông cực đại Φ₀'}
                </span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {emSubMode === 'rod' ? `${emCalc.emfMax.toFixed(2)} V` : `${emCalc.phiMax.toFixed(1)} mWb`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">
                  {emSubMode === 'rod' ? 'Dòng cảm ứng I_c' : 'Suất điện động cực đại E₀'}
                </span>
                <span className="font-mono tabular-nums font-bold text-rose-700 mt-0.5 block">
                  {emSubMode === 'rod' ? `${emReadout.currentA.toFixed(2)} A` : `${emCalc.emfMax.toFixed(2)} V`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Từ thông tức thời Φ(t)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {emReadout.phiMwb.toFixed(1)} mWb
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">
                  {emSubMode === 'rod' ? 'Lực từ cản trở F_từ' : 'Suất điện động e(t)'}
                </span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {emSubMode === 'rod' ? `${emReadout.fMagN.toFixed(3)} N` : `${emReadout.emfV.toFixed(2)} V`}
                </span>
              </div>
            </>
          )}

          {moduleId === 'lorentzForce' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Bán kính quỹ đạo R</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {(lorentzCalc.radiusM * 100).toFixed(3)} cm
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Lực Lo-ren-xơ fL</span>
                <span className="font-mono tabular-nums font-bold text-rose-700 mt-0.5 block">
                  {(lorentzCalc.fNewton * 1e13).toFixed(2)} ×10⁻¹³ N
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Chu kỳ quay T</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {lorentzCalc.periodNs.toFixed(2)} ns
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Loại hạt</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {lorentzParticle.label}
                </span>
              </div>
            </>
          )}

          {moduleId === 'radioactiveDecay' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Số chu kỳ bán rã (t/T)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {decayReadout.halfLives.toFixed(2)} T ({(decayReadout.halfLives * decayIsotope.tHalfUnits).toFixed(1)} {decayIsotope.unit})
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Hạt nhân mẹ còn lại N</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {decayReadout.remaining} / {TOTAL_NUCLEI} ({((decayReadout.remaining / TOTAL_NUCLEI) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Đã phân rã ΔN</span>
                <span className="font-mono tabular-nums font-bold text-amber-700 mt-0.5 block">
                  {decayReadout.decayed} hạt
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Chu kỳ bán rã T / Tia</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {decayIsotope.halfLifeDisplay} · {decayIsotope.mode}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT ZONE: PARAMETER DECK & FORMULA CARD */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <SlidersHorizontal size={16} className="text-sky-600" />
            <h2 className="text-sm font-extrabold text-slate-900">Bảng Tham Số Thí Nghiệm</h2>
          </div>

          {moduleId === 'accelerationNewton' && (
            <>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAccMode('horizontal')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    accMode === 'horizontal' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Kéo mặt ngang
                </button>
                <button
                  type="button"
                  onClick={() => setAccMode('incline')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    accMode === 'incline' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Mặt phẳng nghiêng
                </button>
              </div>
              {accMode === 'horizontal' ? (
                <SliderControl
                  label="Lực kéo F"
                  valueDisplay={`${accForceN} N`}
                  min={2}
                  max={35}
                  step={1}
                  value={accForceN}
                  onChange={setAccForceN}
                />
              ) : (
                <SliderControl
                  label="Góc nghiêng α"
                  valueDisplay={`${accAngleDeg}°`}
                  min={8}
                  max={55}
                  step={1}
                  value={accAngleDeg}
                  onChange={setAccAngleDeg}
                />
              )}
              <SliderControl
                label="Khối lượng vật m"
                valueDisplay={`${accMassKg.toFixed(1)} kg`}
                min={0.5}
                max={6.0}
                step={0.5}
                value={accMassKg}
                onChange={setAccMassKg}
              />
              <SliderControl
                label="Hệ số ma sát trượt μ"
                valueDisplay={`${accMu.toFixed(2)}`}
                min={0}
                max={0.5}
                step={0.02}
                value={accMu}
                onChange={setAccMu}
              />
              {!accCalc.isMoving && (
                <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 font-semibold">
                  Lực kéo chưa thắng nổi ma sát tối đa nên vật đứng yên (a = 0 m/s²).
                </div>
              )}
            </>
          )}

          {moduleId === 'circularMotion' && (
            <>
              <SliderControl
                label="Bán kính quỹ đạo R"
                valueDisplay={`${circRadius.toFixed(2)} m`}
                min={0.6}
                max={2.4}
                step={0.1}
                value={circRadius}
                onChange={setCircRadius}
              />
              <SliderControl
                label="Tốc độ góc ω"
                valueDisplay={`${circOmega.toFixed(1)} rad/s`}
                min={0.5}
                max={6.0}
                step={0.1}
                value={circOmega}
                onChange={setCircOmega}
              />
              <SliderControl
                label="Khối lượng vật m"
                valueDisplay={`${circMass.toFixed(1)} kg`}
                min={0.2}
                max={4.0}
                step={0.2}
                value={circMass}
                onChange={setCircMass}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={showCircVectors}
                  onChange={(e) => setShowCircVectors(e.target.checked)}
                  className="rounded accent-sky-600"
                />
                <span className="font-semibold text-slate-700">Hiển thị véc-tơ vận tốc (v) &amp; lực hướng tâm (Fht)</span>
              </label>
            </>
          )}

          {moduleId === 'momentumCollision' && (
            <>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'elastic' as const, label: 'Đàn hồi' },
                  { id: 'inelastic' as const, label: 'Va chạm mềm' },
                  { id: 'recoil' as const, label: 'Tách 2 vật' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setColMode(m.id);
                      resetCollision(m.id, colM1, colV1Init, colM2, colV2Init, colImpulse);
                    }}
                    className={`py-1.5 rounded-md font-bold text-[11px] cursor-pointer ${
                      colMode === m.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <SliderControl
                label="Khối lượng xe 1 (m₁)"
                valueDisplay={`${colM1.toFixed(1)} kg`}
                min={0.5}
                max={6.0}
                step={0.5}
                value={colM1}
                onChange={(v) => {
                  setColM1(v);
                  resetCollision(colMode, v, colV1Init, colM2, colV2Init, colImpulse);
                }}
              />
              <SliderControl
                label="Khối lượng xe 2 (m₂)"
                valueDisplay={`${colM2.toFixed(1)} kg`}
                min={0.5}
                max={6.0}
                step={0.5}
                value={colM2}
                onChange={(v) => {
                  setColM2(v);
                  resetCollision(colMode, colM1, colV1Init, v, colV2Init, colImpulse);
                }}
              />
              {colMode === 'recoil' ? (
                <SliderControl
                  label="Xung lực bung lò xo"
                  valueDisplay={`${colImpulse.toFixed(1)} N·s`}
                  min={4}
                  max={20}
                  step={1}
                  value={colImpulse}
                  onChange={(imp) => {
                    setColImpulse(imp);
                    resetCollision('recoil', colM1, colV1Init, colM2, colV2Init, imp);
                  }}
                />
              ) : (
                <>
                  <SliderControl
                    label="Vận tốc ban đầu v₁"
                    valueDisplay={`${colV1Init.toFixed(1)} m/s`}
                    min={0.5}
                    max={6.0}
                    step={0.5}
                    value={colV1Init}
                    onChange={(v) => {
                      setColV1Init(v);
                      resetCollision(colMode, colM1, v, colM2, colV2Init, colImpulse);
                    }}
                  />
                  <SliderControl
                    label="Vận tốc ban đầu v₂"
                    valueDisplay={`${colV2Init.toFixed(1)} m/s`}
                    min={-5.0}
                    max={2.0}
                    step={0.5}
                    value={colV2Init}
                    onChange={(v) => {
                      setColV2Init(v);
                      resetCollision(colMode, colM1, colV1Init, colM2, v, colImpulse);
                    }}
                  />
                </>
              )}
            </>
          )}

          {moduleId === 'dopplerEffect' && (
            <>
              <SliderControl
                label="Tần số nguồn phát f₀"
                valueDisplay={`${dopplerF0} Hz`}
                min={220}
                max={880}
                step={10}
                value={dopplerF0}
                onChange={setDopplerF0}
              />
              <SliderControl
                label="Tốc độ nguồn âm vs"
                valueDisplay={`${dopplerVs} m/s`}
                min={0}
                max={260}
                step={10}
                value={dopplerVs}
                onChange={setDopplerVs}
              />
              <SliderControl
                label="Tốc độ máy thu vo"
                valueDisplay={`${dopplerVo} m/s`}
                min={-60}
                max={80}
                step={5}
                value={dopplerVo}
                onChange={setDopplerVo}
              />
            </>
          )}

          {moduleId === 'refractionDispersion' && (
            <>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setOptSubMode('refraction')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    optSubMode === 'refraction' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Khúc xạ &amp; PXTP
                </button>
                <button
                  type="button"
                  onClick={() => setOptSubMode('prism')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    optSubMode === 'prism' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tán sắc lăng kính
                </button>
              </div>
              {optSubMode === 'refraction' ? (
                <>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Môi trường tới (n₁)</label>
                    <select
                      value={refN1Id}
                      onChange={(e) => setRefN1Id(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800"
                    >
                      {REFRACTION_MEDIA.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (n = {m.n})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Môi trường khúc xạ (n₂)</label>
                    <select
                      value={refN2Id}
                      onChange={(e) => setRefN2Id(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800"
                    >
                      {REFRACTION_MEDIA.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (n = {m.n})
                        </option>
                      ))}
                    </select>
                  </div>
                  <SliderControl
                    label="Góc tới i"
                    valueDisplay={`${refAngleI}°`}
                    min={0}
                    max={85}
                    step={1}
                    value={refAngleI}
                    onChange={setRefAngleI}
                  />
                </>
              ) : (
                <>
                  <SliderControl
                    label="Góc chiết quang A"
                    valueDisplay={`${prismApexDeg}°`}
                    min={30}
                    max={75}
                    step={1}
                    value={prismApexDeg}
                    onChange={setPrismApexDeg}
                  />
                  <SliderControl
                    label="Góc tới mặt bên i₁"
                    valueDisplay={`${prismIncidenceDeg}°`}
                    min={20}
                    max={75}
                    step={1}
                    value={prismIncidenceDeg}
                    onChange={setPrismIncidenceDeg}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={prismWhiteLight}
                      onChange={(e) => setPrismWhiteLight(e.target.checked)}
                      className="rounded accent-sky-600"
                    />
                    <span className="font-semibold text-slate-700">Chùm ánh sáng trắng (tán sắc 7 màu)</span>
                  </label>
                  {!prismWhiteLight && (
                    <SliderControl
                      label="Bước sóng đơn sắc λ"
                      valueDisplay={`${prismMonoNm} nm`}
                      min={380}
                      max={760}
                      step={5}
                      value={prismMonoNm}
                      onChange={setPrismMonoNm}
                    />
                  )}
                </>
              )}
            </>
          )}

          {moduleId === 'electromagneticInduction' && (
            <>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'faraday', label: 'Nam châm' },
                  { id: 'rod', label: 'Thanh dẫn' },
                  { id: 'generator', label: 'Máy phát' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setEmSubMode(m.id as 'faraday' | 'rod' | 'generator');
                      emStateRef.current.history = [];
                    }}
                    className={`py-1.5 rounded-md font-bold cursor-pointer ${
                      emSubMode === m.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {emSubMode === 'rod' ? (
                <>
                  <SliderControl
                    label="Cảm ứng từ B"
                    valueDisplay={`${emBField.toFixed(2)} T`}
                    min={0.1}
                    max={1.2}
                    step={0.05}
                    value={emBField}
                    onChange={setEmBField}
                  />
                  <SliderControl
                    label="Chiều dài thanh MN (l)"
                    valueDisplay={`${emRodLenCm} cm`}
                    min={20}
                    max={80}
                    step={5}
                    value={emRodLenCm}
                    onChange={setEmRodLenCm}
                  />
                  <SliderControl
                    label="Tốc độ kéo thanh v"
                    valueDisplay={`${emRodVelMs.toFixed(1)} m/s`}
                    min={0.5}
                    max={6.0}
                    step={0.2}
                    value={emRodVelMs}
                    onChange={setEmRodVelMs}
                  />
                  <SliderControl
                    label="Điện trở mạch R"
                    valueDisplay={`${emRodResOhm.toFixed(1)} Ω`}
                    min={0.5}
                    max={10.0}
                    step={0.5}
                    value={emRodResOhm}
                    onChange={setEmRodResOhm}
                  />
                </>
              ) : (
                <>
                  {emSubMode === 'faraday' && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={emManualMagnet}
                          onChange={(e) => setEmManualMagnet(e.target.checked)}
                          className="rounded accent-sky-600"
                        />
                        <span className="font-semibold text-slate-700">Tự tay kéo nam châm (kiểm chứng ΔΦ/Δt)</span>
                      </label>
                      {emManualMagnet && (
                        <SliderControl
                          label="Vị trí nam châm (kéo qua ống dây)"
                          valueDisplay={emManualPos.toFixed(2)}
                          min={-1.1}
                          max={1.1}
                          step={0.02}
                          value={emManualPos}
                          onChange={setEmManualPos}
                        />
                      )}
                    </>
                  )}
                  <SliderControl
                    label="Số vòng dây N"
                    valueDisplay={`${emTurns} vòng`}
                    min={20}
                    max={300}
                    step={10}
                    value={emTurns}
                    onChange={setEmTurns}
                  />
                  <SliderControl
                    label="Cảm ứng từ B"
                    valueDisplay={`${emBField.toFixed(2)} T`}
                    min={0.1}
                    max={1.2}
                    step={0.05}
                    value={emBField}
                    onChange={setEmBField}
                  />
                  <SliderControl
                    label="Diện tích khung S"
                    valueDisplay={`${emAreaCm2} cm²`}
                    min={10}
                    max={100}
                    step={5}
                    value={emAreaCm2}
                    onChange={setEmAreaCm2}
                  />
                  <SliderControl
                    label="Tần số dao động/quay f"
                    valueDisplay={`${emFreqHz.toFixed(1)} Hz`}
                    min={0.2}
                    max={2.5}
                    step={0.1}
                    value={emFreqHz}
                    disabled={emSubMode === 'faraday' && emManualMagnet}
                    onChange={setEmFreqHz}
                  />
                </>
              )}
            </>
          )}

          {moduleId === 'lorentzForce' && (
            <>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Chọn hạt mang điện</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {CHARGED_PARTICLES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLorentzParticleId(p.id)}
                      className={`px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                        lorentzParticleId === p.id
                          ? 'bg-sky-50 border-sky-300 text-sky-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <SliderControl
                label="Cảm ứng từ B"
                valueDisplay={`${lorentzB.toFixed(2)} T`}
                min={0.2}
                max={1.5}
                step={0.05}
                value={lorentzB}
                onChange={setLorentzB}
              />
              <SliderControl
                label="Vận tốc ban đầu v"
                valueDisplay={`${lorentzV.toFixed(1)} ×10⁶ m/s`}
                min={1.0}
                max={6.0}
                step={0.2}
                value={lorentzV}
                onChange={setLorentzV}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={lorentzBIntoPage}
                  onChange={(e) => setLorentzBIntoPage(e.target.checked)}
                  className="rounded accent-sky-600"
                />
                <span className="font-semibold text-slate-700">Từ trường B hướng vào mặt phẳng (⊗)</span>
              </label>
            </>
          )}

          {moduleId === 'radioactiveDecay' && (
            <>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Đồng vị phóng xạ</label>
                <select
                  value={decayIsotopeId}
                  onChange={(e) => setDecayIsotopeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800"
                >
                  {DECAY_ISOTOPES.map((iso) => (
                    <option key={iso.id} value={iso.id}>
                      {iso.label} (T = {iso.halfLifeDisplay})
                    </option>
                  ))}
                </select>
              </div>
              <SliderControl
                label="Nhịp phân rã mô phỏng"
                valueDisplay={`${decaySpeedMul.toFixed(1)}×`}
                min={0.4}
                max={2.5}
                step={0.1}
                value={decaySpeedMul}
                onChange={setDecaySpeedMul}
              />
            </>
          )}
        </div>

        {/* Formula card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <h3 className="font-extrabold text-slate-900">Công Thức Trọng Tâm</h3>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto text-slate-800 space-y-2">
            {moduleId === 'accelerationNewton' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    accMode === 'horizontal'
                      ? String.raw`\vec{a} = \frac{\vec{F}_{hl}}{m} = \frac{F - \mu mg}{m},\quad v = at,\quad s = \frac{1}{2}at^2`
                      : String.raw`a = g(\sin\alpha - \mu\cos\alpha),\quad v^2 - v_0^2 = 2as`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'circularMotion' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`v = \omega R,\quad a_{ht} = \frac{v^2}{R} = \omega^2 R,\quad F_{ht} = m\omega^2 R`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'momentumCollision' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`\vec{p}_1 + \vec{p}_2 = \vec{p}_1' + \vec{p}_2'\quad (m_1 v_1 + m_2 v_2 = m_1 v_1' + m_2 v_2')`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'dopplerEffect' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`f' = f_0 \frac{v \pm v_o}{v \mp v_s},\quad v = 340\text{ m/s}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'refractionDispersion' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    optSubMode === 'refraction'
                      ? String.raw`n_1 \sin i = n_2 \sin r,\quad \sin i_{gh} = \frac{n_2}{n_1}\ (n_1 > n_2)`
                      : String.raw`D = i_1 + i_2 - A,\quad r_1 + r_2 = A`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'electromagneticInduction' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    emSubMode === 'rod'
                      ? String.raw`|e_c| = B l v\sin\theta,\quad I_c = \frac{|e_c|}{R},\quad F_{t\text{ừ}} = B I_c l`
                      : String.raw`\Phi = NBS\cos(\omega t),\quad e_c = -\frac{\Delta \Phi}{\Delta t} = \omega NBS\sin(\omega t)`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'lorentzForce' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`f_L = |q|vB\sin\alpha,\quad R = \frac{mv}{|q|B},\quad T = \frac{2\pi m}{|q|B}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'radioactiveDecay' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`N(t) = N_0 \cdot 2^{-\frac{t}{T}} = N_0 e^{-\lambda t},\quad H(t) = \lambda N(t)`,
                    false
                  ),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

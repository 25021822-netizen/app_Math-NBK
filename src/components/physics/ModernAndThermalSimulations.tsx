import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { Play, Pause, RotateCcw, SlidersHorizontal, Volume2, VolumeX, Zap } from 'lucide-react';

export type ModernThermalModuleId =
  | 'rutherford'
  | 'lightInterference'
  | 'soundWave'
  | 'nuclearFusion'
  | 'nuclearFission'
  | 'thermalLab';

function renderLatex(tex: string, displayMode = false): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode });
  } catch {
    return tex;
  }
}

function wavelengthToRgbTuple(nm: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm >= 440 && nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm >= 490 && nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm >= 580 && nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else if (nm >= 645 && nm <= 760) {
    r = 1;
  }
  const factor =
    nm < 420 ? 0.35 + (0.65 * (nm - 380)) / 40 : nm > 700 ? 0.35 + (0.65 * (760 - nm)) / 60 : 1;
  return [
    Math.round(255 * Math.pow(r * factor, 0.8)),
    Math.round(255 * Math.pow(g * factor, 0.8)),
    Math.round(255 * Math.pow(b * factor, 0.8)),
  ];
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

interface ModernAndThermalSimulationsProps {
  moduleId: ModernThermalModuleId;
}

// =============================================================================
// RUTHERFORD FOIL DATA
// =============================================================================
const FOIL_TARGETS = [
  { id: 'Au', label: 'Vàng (⁷⁹Au)', z: 79 },
  { id: 'Ag', label: 'Bạc (⁴⁷Ag)', z: 47 },
  { id: 'Cu', label: 'Đồng (²⁹Cu)', z: 29 },
];

// =============================================================================
// THERMAL LAB SUBSTANCES
// =============================================================================
const SPECIFIC_HEAT_LIQUIDS = [
  { id: 'water', name: 'Nước nguyên chất', c: 4200 },
  { id: 'alcohol', name: 'Rượu etylic', c: 2500 },
  { id: 'oil', name: 'Dầu thực vật', c: 2100 },
  { id: 'brine', name: 'Nước muối loãng', c: 3850 },
];

export const ModernAndThermalSimulations: React.FC<ModernAndThermalSimulationsProps> = ({
  moduleId,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ===========================================================================
  // 1. THÍ NGHIỆM RUTHERFORD (TÁN XẠ HẠT ALPHA)
  // ===========================================================================
  const [ruthTargetId, setRuthTargetId] = useState<string>('Au');
  const [ruthEnergyMeV, setRuthEnergyMeV] = useState<number>(5.5);
  const [ruthBeamMode, setRuthBeamMode] = useState<'beam' | 'single'>('beam');
  const [ruthImpactB, setRuthImpactB] = useState<number>(18); // fm-scaled parameter
  const [ruthStats, setRuthStats] = useState({ total: 0, straight: 0, deflected: 0, back: 0 });
  const ruthParticlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[]; counted: boolean }[]
  >([]);
  const ruthFlashRef = useRef<{ angle: number; alpha: number }[]>([]);

  const ruthTarget = FOIL_TARGETS.find((f) => f.id === ruthTargetId) || FOIL_TARGETS[0];

  const ruthSingleAngleDeg = useMemo(() => {
    // Rutherford formula scaled for visible demonstration
    const kStrength = (ruthTarget.z / 79) * (5.5 / ruthEnergyMeV) * 28;
    const rad = 2 * Math.atan(kStrength / Math.max(1.2, Math.abs(ruthImpactB)));
    return (rad * 180) / Math.PI;
  }, [ruthTarget.z, ruthEnergyMeV, ruthImpactB]);

  const spawnSingleAlpha = (impactYOffset = ruthImpactB) => {
    ruthParticlesRef.current.push({
      x: -175,
      y: impactYOffset,
      vx: 165 * Math.sqrt(ruthEnergyMeV / 5.5),
      vy: 0,
      trail: [],
      counted: false,
    });
  };

  // ===========================================================================
  // 2. GIAO THOA ÁNH SÁNG (ĐƠN SẮC / 2 BỨC XẠ / ÁNH SÁNG TRẮNG)
  // ===========================================================================
  const [liMode, setLiMode] = useState<'mono' | 'twoColor' | 'white'>('mono');
  const [liLambda1Nm, setLiLambda1Nm] = useState<number>(560);
  const [liLambda2Nm, setLiLambda2Nm] = useState<number>(420);
  const [liSlitAMm, setLiSlitAMm] = useState<number>(1.2);
  const [liDistDM, setLiDistDM] = useState<number>(2.0);
  const [liProbeMm, setLiProbeMm] = useState<number>(1.4);

  const liCalc = useMemo(() => {
    const i1 = (liLambda1Nm * 1e-6 * liDistDM * 1e3) / liSlitAMm;
    const i2 = (liLambda2Nm * 1e-6 * liDistDM * 1e3) / liSlitAMm;
    // Smallest integer coincidence k1/k2 = lam2/lam1
    let k1Coinc = 1;
    let k2Coinc = 1;
    let minErr = 999;
    for (let k1 = 1; k1 <= 15; k1++) {
      const k2Float = (k1 * liLambda1Nm) / liLambda2Nm;
      const k2Round = Math.round(k2Float);
      const err = Math.abs(k2Float - k2Round);
      if (err < 0.04 && err < minErr && k2Round >= 1) {
        minErr = err;
        k1Coinc = k1;
        k2Coinc = k2Round;
      }
    }
    const iOverlap = minErr < 0.04 ? k1Coinc * i1 : null;
    return { i1, i2, iOverlap, k1Coinc, k2Coinc };
  }, [liLambda1Nm, liLambda2Nm, liSlitAMm, liDistDM]);

  // ===========================================================================
  // 3. SÓNG ÂM THANH (SÓNG DỌC KHÔNG KHÍ + DAO ĐỘNG KÝ + WEB AUDIO)
  // ===========================================================================
  const [soundFreqHz, setSoundFreqHz] = useState<number>(440);
  const [soundLevelDb, setSoundLevelDb] = useState<number>(65);
  const [soundMedium, setSoundMedium] = useState<'air' | 'water' | 'steel'>('air');
  const [soundTimbre, setSoundTimbre] = useState<'pure' | 'flute'>('pure');
  const [soundAudioOn, setSoundAudioOn] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const soundPhaseRef = useRef<number>(0);

  const soundSpeed = soundMedium === 'air' ? 340 : soundMedium === 'water' ? 1480 : 5000;
  const soundWavelengthM = soundSpeed / soundFreqHz;
  const soundCategory =
    soundFreqHz < 16 ? 'Hạ âm (< 16 Hz)' : soundFreqHz <= 20000 ? 'Âm nghe được' : 'Siêu âm (> 20 kHz)';

  // Safe Web Audio API control
  useEffect(() => {
    if (moduleId !== 'soundWave' || !soundAudioOn || !isRunning) {
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.03);
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      if (!oscNodeRef.current || !gainNodeRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscNodeRef.current = osc;
        gainNodeRef.current = gain;
      }
      oscNodeRef.current.type = soundTimbre === 'pure' ? 'sine' : 'triangle';
      oscNodeRef.current.frequency.setTargetAtTime(
        Math.min(2000, Math.max(40, soundFreqHz)),
        ctx.currentTime,
        0.03
      );
      const vol = Math.min(0.18, Math.max(0.01, ((soundLevelDb - 20) / 90) * 0.16));
      gainNodeRef.current.gain.setTargetAtTime(vol, ctx.currentTime, 0.04);
    } catch {
      // Audio playback skipped if browser blocks context
    }
  }, [moduleId, soundAudioOn, isRunning, soundFreqHz, soundLevelDb, soundTimbre]);

  useEffect(() => {
    return () => {
      try {
        oscNodeRef.current?.stop();
        audioCtxRef.current?.close();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  // ===========================================================================
  // 4. PHẢN ỨNG NHIỆT HẠCH (D + T -> He + n + 17.6 MeV)
  // ===========================================================================
  const [fusionReaction, setFusionReaction] = useState<'DT' | 'DD'>('DT');
  const [fusionTempMK, setFusionTempMK] = useState<number>(120); // Triệu Kelvin
  const [fusionCount, setFusionCount] = useState<number>(0);
  const fusionStateRef = useRef({
    stage: 'approaching' as 'approaching' | 'repelled' | 'fused',
    prog: 0,
    flash: 0,
    cycleTimer: 0,
  });

  const fusionEnergyMeV = fusionReaction === 'DT' ? 17.6 : 3.27;
  const fusionIgnited = fusionTempMK >= (fusionReaction === 'DT' ? 100 : 150);

  // ===========================================================================
  // 5. PHẢN ỨNG PHÂN HẠCH (U-235 + n -> Ba + Kr + 3n)
  // ===========================================================================
  const [fissionRodPct, setFissionRodPct] = useState<number>(35); // % thanh điều khiển hạ xuống
  const [fissionEnrichPct, setFissionEnrichPct] = useState<number>(75);
  const [fissionTelemetry, setFissionTelemetry] = useState({ count: 0, energyMeV: 0, activeNeutrons: 0 });
  const fissionStateRef = useRef({
    nuclei: [] as { x: number; y: number; intact: boolean; isU235: boolean; splitFlash: number }[],
    neutrons: [] as { x: number; y: number; vx: number; vy: number }[],
    fragments: [] as { x: number; y: number; vx: number; vy: number; label: string; color: string; life: number }[],
    count: 0,
  });

  const initFissionGrid = (enrich = fissionEnrichPct) => {
    const nuclei: { x: number; y: number; intact: boolean; isU235: boolean; splitFlash: number }[] = [];
    const cols = 7;
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nuclei.push({
          x: 130 + c * 68 + (r % 2 === 0 ? 0 : 20),
          y: 88 + r * 66,
          intact: true,
          isU235: ((r * cols + c) * 37) % 100 < enrich,
          splitFlash: 0,
        });
      }
    }
    fissionStateRef.current = {
      nuclei,
      neutrons: [{ x: 24, y: 220, vx: 170, vy: 0 }],
      fragments: [],
      count: 0,
    };
    setFissionTelemetry({ count: 0, energyMeV: 0, activeNeutrons: 1 });
  };

  useEffect(() => {
    if (moduleId === 'nuclearFission' && fissionStateRef.current.nuclei.length === 0) {
      initFissionGrid();
    }
  }, [moduleId]);

  const fireTriggerNeutron = () => {
    fissionStateRef.current.neutrons.push({
      x: 24,
      y: 120 + Math.random() * 200,
      vx: 165,
      vy: (Math.random() - 0.5) * 35,
    });
  };

  // ===========================================================================
  // 6. THÍ NGHIỆM ĐO NHIỆT DUNG RIÊNG, NHIỆT NÓNG CHẢY, NHIỆT HÓA HƠI
  // ===========================================================================
  const [thermalMode, setThermalMode] = useState<'specificHeat' | 'fusion' | 'vaporization'>('specificHeat');
  const [thLiquidId, setThLiquidId] = useState<string>('water');
  const [thPowerW, setThPowerW] = useState<number>(600);
  const [thMassKg, setThMassKg] = useState<number>(0.5);
  const [thReadout, setThReadout] = useState({ tSec: 0, tempC: 25, massLeftG: 500, meltedG: 0, qKJ: 0 });
  const thermalRef = useRef({
    tSec: 0,
    tempC: 25,
    meltedKg: 0,
    vaporizedKg: 0,
    history: [{ t: 0, val: 25 }] as { t: number; val: number }[],
  });

  const thLiquid = SPECIFIC_HEAT_LIQUIDS.find((l) => l.id === thLiquidId) || SPECIFIC_HEAT_LIQUIDS[0];
  const LATENT_FUSION = 334000; // J/kg (Nước đá)
  const LATENT_VAPOR = 2260000; // J/kg (Nước sôi)

  const resetThermal = (mode = thermalMode, massKg = thMassKg) => {
    const startTemp = mode === 'specificHeat' ? 25 : mode === 'fusion' ? -10 : 85;
    thermalRef.current = {
      tSec: 0,
      tempC: startTemp,
      meltedKg: 0,
      vaporizedKg: 0,
      history: [{ t: 0, val: startTemp }],
    };
    setThReadout({
      tSec: 0,
      tempC: startTemp,
      massLeftG: massKg * 1000,
      meltedG: 0,
      qKJ: 0,
    });
  };

  // ===========================================================================
  // MAIN ANIMATION LOOP
  // ===========================================================================
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let uiSyncTimer = 0;
    let spawnTimer = 0;

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const dt = isRunning ? rawDt * timeScale : 0;
      const canvas = canvasRef.current;

      if (canvas) {
        if (moduleId === 'rutherford') {
          if (dt > 0) {
            spawnTimer += dt;
            if (ruthBeamMode === 'beam' && spawnTimer >= 0.14 && ruthParticlesRef.current.length < 36) {
              spawnTimer = 0;
              const randomB = (Math.random() - 0.5) * 140;
              spawnSingleAlpha(randomB);
            }
            updateRutherford(dt);
          }
          drawRutherfordCanvas(canvas);
        } else if (moduleId === 'lightInterference') {
          drawLightInterferenceCanvas(canvas);
        } else if (moduleId === 'soundWave') {
          if (dt > 0) {
            soundPhaseRef.current += dt * Math.min(26, Math.max(4, soundFreqHz * 0.028));
          }
          drawSoundWaveCanvas(canvas);
        } else if (moduleId === 'nuclearFusion') {
          if (dt > 0) {
            updateFusion(dt);
          }
          drawFusionCanvas(canvas);
        } else if (moduleId === 'nuclearFission') {
          if (dt > 0) {
            updateFission(dt, canvas);
          }
          drawFissionCanvas(canvas);
          uiSyncTimer += rawDt;
          if (uiSyncTimer > 0.1) {
            uiSyncTimer = 0;
            const st = fissionStateRef.current;
            setFissionTelemetry({
              count: st.count,
              energyMeV: st.count * 200,
              activeNeutrons: st.neutrons.length,
            });
          }
        } else if (moduleId === 'thermalLab') {
          if (dt > 0) {
            updateThermal(dt * 12); // Accelerated lab time so students see clear slope in ~15s
          }
          drawThermalCanvas(canvas);
          uiSyncTimer += rawDt;
          if (uiSyncTimer > 0.08) {
            uiSyncTimer = 0;
            const th = thermalRef.current;
            setThReadout({
              tSec: th.tSec,
              tempC: th.tempC,
              massLeftG: Math.max(0, (thMassKg - th.vaporizedKg) * 1000),
              meltedG: Math.min(thMassKg * 1000, th.meltedKg * 1000),
              qKJ: (thPowerW * th.tSec) / 1000,
            });
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  // ===========================================================================
  // PHYSICS UPDATERS & DRAWERS
  // ===========================================================================
  const setupDpr = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(340, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  // --- 1. RUTHERFORD ---
  const updateRutherford = (dt: number) => {
    const arr = ruthParticlesRef.current;
    const kCoulomb = (ruthTarget.z / 79) * 180000;
    const subSteps = 4;
    const h = dt / subSteps;

    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      for (let s = 0; s < subSteps; s++) {
        const r2 = p.x * p.x + p.y * p.y;
        const r = Math.max(5.5, Math.sqrt(r2));
        const fMag = kCoulomb / (r * r * r);
        p.vx += fMag * p.x * h;
        p.vy += fMag * p.y * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
      }
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 55) p.trail.shift();

      const dist = Math.hypot(p.x, p.y);
      if (!p.counted && dist > 185) {
        p.counted = true;
        const angDeg = Math.abs((Math.atan2(p.vy, p.vx) * 180) / Math.PI);
        ruthFlashRef.current.push({ angle: Math.atan2(p.y, p.x), alpha: 1 });
        setRuthStats((prev) => ({
          total: prev.total + 1,
          straight: prev.straight + (angDeg < 15 ? 1 : 0),
          deflected: prev.deflected + (angDeg >= 15 && angDeg < 90 ? 1 : 0),
          back: prev.back + (angDeg >= 90 ? 1 : 0),
        }));
      }

      if (dist > 260) {
        arr.splice(i, 1);
      }
    }

    for (let i = ruthFlashRef.current.length - 1; i >= 0; i--) {
      ruthFlashRef.current[i].alpha -= dt * 1.4;
      if (ruthFlashRef.current[i].alpha <= 0) ruthFlashRef.current.splice(i, 1);
    }
  };

  const drawRutherfordCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.56;
    const cy = h * 0.5;
    const screenR = Math.min(w * 0.36, h * 0.42);

    // Fluorescent ZnS circular detector screen
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, screenR, 0.28, Math.PI * 2 - 0.28);
    ctx.stroke();

    // Wait: gap on left side for incoming alpha beam! Draw arc with opening at angle PI
    ctx.clearRect(cx - screenR - 8, cy - 38, 22, 76);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(cx - screenR - 8, cy - 38, 22, 76);

    // Scintillation flashes on ZnS screen
    ruthFlashRef.current.forEach((fl) => {
      const fx = cx + screenR * Math.cos(fl.angle);
      const fy = cy + screenR * Math.sin(fl.angle);
      ctx.fillStyle = `rgba(52, 211, 153, ${fl.alpha})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Lead source box on left
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(24, cy - 32, 58, 64);
    ctx.strokeRect(24, cy - 32, 58, 64);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px ui-sans-serif, sans-serif';
    ctx.fillText('Nguồn α', 31, cy + 4);

    // Thin gold/metal foil line & nucleus at center
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - screenR * 0.72);
    ctx.lineTo(cx, cy + screenR * 0.72);
    ctx.stroke();

    // Nucleus glowing core
    const nGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 14);
    nGrad.addColorStop(0, '#FACC15');
    nGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EAB308';
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Alpha particles & trails
    const worldToPx = screenR / 185;
    ruthParticlesRef.current.forEach((p) => {
      if (p.trail.length > 1) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        p.trail.forEach((pt, idx) => {
          const px = cx + pt.x * worldToPx;
          const py = cy + pt.y * worldToPx;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(cx + p.x * worldToPx, cy + p.y * worldToPx, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(`Hạt nhân ${ruthTarget.label} · Màn huỳnh quang ZnS`, 20, 26);
  };

  // --- 2. GIAO THOA ÁNH SÁNG ---
  const drawLightInterferenceCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const screenLeft = 34;
    const screenW = w - 68;
    const bandTop = 44;
    const bandH = Math.floor(h * 0.42);
    const halfSpanMm = 9;

    for (let px = 0; px < screenW; px++) {
      const xMm = ((px / screenW) * 2 - 1) * halfSpanMm;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;

      if (liMode === 'mono') {
        const [r, g, b] = wavelengthToRgbTuple(liLambda1Nm);
        const inten = Math.pow(Math.cos((Math.PI * xMm) / liCalc.i1), 2);
        rSum = r * inten;
        gSum = g * inten;
        bSum = b * inten;
      } else if (liMode === 'twoColor') {
        const [r1, g1, b1] = wavelengthToRgbTuple(liLambda1Nm);
        const [r2, g2, b2] = wavelengthToRgbTuple(liLambda2Nm);
        const int1 = Math.pow(Math.cos((Math.PI * xMm) / liCalc.i1), 2);
        const int2 = Math.pow(Math.cos((Math.PI * xMm) / liCalc.i2), 2);
        rSum = Math.min(255, r1 * int1 + r2 * int2);
        gSum = Math.min(255, g1 * int1 + g2 * int2);
        bSum = Math.min(255, b1 * int1 + b2 * int2);
      } else {
        // White light: integrate 14 wavelengths across [390, 730] nm
        const samples = 14;
        for (let s = 0; s < samples; s++) {
          const lam = 390 + (s / (samples - 1)) * 340;
          const iLam = (lam * 1e-6 * liDistDM * 1e3) / liSlitAMm;
          const inten = Math.pow(Math.cos((Math.PI * xMm) / iLam), 2);
          const [r, g, b] = wavelengthToRgbTuple(lam);
          rSum += (r * inten) / 5.5;
          gSum += (g * inten) / 5.5;
          bSum += (b * inten) / 5.5;
        }
        rSum = Math.min(255, rSum);
        gSum = Math.min(255, gSum);
        bSum = Math.min(255, bSum);
      }

      ctx.fillStyle = `rgb(${Math.round(rSum)}, ${Math.round(gSum)}, ${Math.round(bSum)})`;
      ctx.fillRect(screenLeft + px, bandTop, 1.5, bandH);
    }

    ctx.strokeStyle = '#475569';
    ctx.strokeRect(screenLeft, bandTop, screenW, bandH);

    // Millimeter scale along screen bottom
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (let m = -8; m <= 8; m += 2) {
      const px = screenLeft + ((m / halfSpanMm + 1) / 2) * screenW;
      ctx.fillText(`${m}`, px, bandTop + bandH + 14);
    }
    ctx.textAlign = 'left';

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(
      liMode === 'mono'
        ? `Hệ vân đơn sắc λ = ${liLambda1Nm} nm · Khoảng vân i = ${liCalc.i1.toFixed(2)} mm`
        : liMode === 'twoColor'
        ? `Giao thoa đồng thời 2 bức xạ λ₁=${liLambda1Nm}nm & λ₂=${liLambda2Nm}nm`
        : 'Giao thoa ánh sáng trắng (Vân trung tâm trắng · Quang phổ cầu vồng hai bên)',
      screenLeft,
      26
    );

    // Intensity Plot below
    const gTop = bandTop + bandH + 34;
    const gH = h - gTop - 32;
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(screenLeft, gTop + gH);
    ctx.lineTo(screenLeft + screenW, gTop + gH);
    ctx.stroke();

    const drawCurve = (iSpacing: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let px = 0; px <= screenW; px += 2) {
        const xMm = ((px / screenW) * 2 - 1) * halfSpanMm;
        const inten = Math.pow(Math.cos((Math.PI * xMm) / iSpacing), 2);
        const py = gTop + gH - inten * (gH - 12);
        if (px === 0) ctx.moveTo(screenLeft + px, py);
        else ctx.lineTo(screenLeft + px, py);
      }
      ctx.stroke();
    };

    if (liMode === 'mono') {
      const [r, g, b] = wavelengthToRgbTuple(liLambda1Nm);
      drawCurve(liCalc.i1, `rgb(${r},${g},${b})`);
    } else if (liMode === 'twoColor') {
      const [r1, g1, b1] = wavelengthToRgbTuple(liLambda1Nm);
      const [r2, g2, b2] = wavelengthToRgbTuple(liLambda2Nm);
      drawCurve(liCalc.i1, `rgb(${r1},${g1},${b1})`);
      drawCurve(liCalc.i2, `rgb(${r2},${g2},${b2})`);
    } else {
      drawCurve(liCalc.i1, '#F8FAFC');
    }

    // Probe line xM
    const pPx = screenLeft + ((Math.max(-halfSpanMm, Math.min(halfSpanMm, liProbeMm)) / halfSpanMm + 1) / 2) * screenW;
    ctx.strokeStyle = '#FACC15';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pPx, bandTop);
    ctx.lineTo(pPx, gTop + gH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`xM=${liProbeMm.toFixed(2)}mm`, Math.min(screenLeft + screenW - 88, pPx + 5), bandTop + 16);
  };

  // --- 3. SÓNG ÂM THANH ---
  const drawSoundWaveCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const stageH = Math.floor(h * 0.54);
    const graphH = h - stageH;

    // Speaker cone on left
    const spkX = 48;
    const spkCy = stageH * 0.5;
    const ampScale = Math.max(0.15, (soundLevelDb - 15) / 95);
    const coneVib = Math.sin(soundPhaseRef.current) * 6 * ampScale;

    ctx.fillStyle = '#334155';
    ctx.fillRect(16, spkCy - 26, 20, 52);
    ctx.beginPath();
    ctx.moveTo(36, spkCy - 26);
    ctx.lineTo(spkX + coneVib, spkCy - 46);
    ctx.lineTo(spkX + coneVib, spkCy + 46);
    ctx.lineTo(36, spkCy + 26);
    ctx.closePath();
    ctx.fillStyle = '#0284C7';
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(`Sóng dọc truyền âm (${soundMedium === 'air' ? 'Không khí' : soundMedium === 'water' ? 'Nước' : 'Thép'} · v = ${soundSpeed} m/s)`, 18, 24);

    // Longitudinal air particles (compressions & rarefactions)
    const startX = 76;
    const spanW = w - startX - 24;
    const cols = 38;
    const rows = 9;
    const cycles = Math.max(1.5, Math.min(7, soundFreqHz / 220));
    const k = (2 * Math.PI * cycles) / spanW;

    for (let r = 0; r < rows; r++) {
      const y0 = 52 + ((stageH - 80) * r) / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const x0 = startX + (spanW * c) / (cols - 1);
        const disp = Math.sin(k * (x0 - startX) - soundPhaseRef.current) * 10 * ampScale;
        const densityShift = Math.cos(k * (x0 - startX) - soundPhaseRef.current);
        ctx.fillStyle = densityShift > 0.3 ? '#0284C7' : densityShift < -0.3 ? '#94A3B8' : '#475569';
        ctx.beginPath();
        ctx.arc(x0 + disp, y0, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bottom: Acoustic Pressure Oscilloscope
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, stageH, w, graphH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(0, stageH);
    ctx.lineTo(w, stageH);
    ctx.stroke();

    const midY = stageH + graphH * 0.54;
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(32, midY);
    ctx.lineTo(w - 24, midY);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText(`Dao động ký áp suất âm (${soundTimbre === 'pure' ? 'Âm thuần - Sóng sin' : 'Nhạc âm - Có họa âm'})`, 18, stageH + 20);

    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const gW = w - 56;
    const maxH = graphH * 0.34 * ampScale;
    for (let px = 0; px <= gW; px += 2) {
      const theta = (px / gW) * 2 * Math.PI * cycles - soundPhaseRef.current;
      const waveVal =
        soundTimbre === 'pure'
          ? Math.sin(theta)
          : 0.72 * Math.sin(theta) + 0.28 * Math.sin(2 * theta) + 0.14 * Math.sin(3 * theta);
      const py = midY - waveVal * maxH;
      if (px === 0) ctx.moveTo(32 + px, py);
      else ctx.lineTo(32 + px, py);
    }
    ctx.stroke();
  };

  // --- 4. PHẢN ỨNG NHIỆT HẠCH ---
  const updateFusion = (dt: number) => {
    const st = fusionStateRef.current;
    st.prog += dt * (0.45 + (fusionTempMK / 150) * 0.45);
    if (st.stage === 'approaching' && st.prog >= 1) {
      if (fusionIgnited) {
        st.stage = 'fused';
        st.prog = 0;
        st.flash = 1;
        setFusionCount((c) => c + 1);
      } else {
        st.stage = 'repelled';
        st.prog = 0;
      }
    } else if ((st.stage === 'fused' || st.stage === 'repelled') && st.prog >= 1.1) {
      st.stage = 'approaching';
      st.prog = 0;
    }
    if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 1.4);
  };

  const drawFusionCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.52;
    const st = fusionStateRef.current;

    // Status Banner
    ctx.fillStyle = fusionIgnited ? 'rgba(5, 150, 105, 0.22)' : 'rgba(217, 119, 6, 0.22)';
    ctx.strokeStyle = fusionIgnited ? '#10B981' : '#F59E0B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(16, 14, w - 32, 34, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fusionIgnited ? '#A7F3D0' : '#FDE68A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(
      fusionIgnited
        ? `Nhiệt độ ${fusionTempMK} triệu K đủ thắng lực đẩy Coulomb → PHẢN ỨNG NHIỆT HẠCH XẢY RA (+${fusionEnergyMeV} MeV)`
        : `Nhiệt độ ${fusionTempMK} triệu K chưa đủ thắng rào cản Coulomb (Cần ≥ ${fusionReaction === 'DT' ? 100 : 150} triệu K)`,
      28,
      35
    );

    // Energy flash on fusion
    if (st.flash > 0) {
      const fGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 140 * (1.2 - st.flash * 0.4));
      fGrad.addColorStop(0, `rgba(250, 204, 21, ${st.flash * 0.9})`);
      fGrad.addColorStop(0.5, `rgba(249, 115, 22, ${st.flash * 0.4})`);
      fGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 150, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawNucleusCluster = (nx: number, ny: number, pCount: number, nCount: number, label: string) => {
      const total = pCount + nCount;
      for (let i = 0; i < total; i++) {
        const ang = (i / total) * Math.PI * 2;
        const rad = total === 1 ? 0 : 7;
        const px = nx + Math.cos(ang) * rad;
        const py = ny + Math.sin(ang) * rad;
        ctx.fillStyle = i < pCount ? '#EF4444' : '#94A3B8';
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, nx, ny + 28);
      ctx.textAlign = 'left';
    };

    if (st.stage === 'approaching') {
      const offset = (1 - st.prog) * (w * 0.34) + (fusionIgnited ? 0 : 28);
      drawNucleusCluster(cx - offset, cy, 1, 1, 'D (²₁H)');
      drawNucleusCluster(
        cx + offset,
        cy,
        1,
        fusionReaction === 'DT' ? 2 : 1,
        fusionReaction === 'DT' ? 'T (³₁H)' : 'D (²₁H)'
      );
    } else if (st.stage === 'repelled') {
      const offset = 28 + st.prog * (w * 0.28);
      drawNucleusCluster(cx - offset, cy - st.prog * 35, 1, 1, 'D (²₁H)');
      drawNucleusCluster(
        cx + offset,
        cy + st.prog * 35,
        1,
        fusionReaction === 'DT' ? 2 : 1,
        fusionReaction === 'DT' ? 'T (³₁H)' : 'D (²₁H)'
      );
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 12px ui-sans-serif, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Bị đẩy ngược bởi lực tĩnh điện Coulomb!', cx, cy);
      ctx.textAlign = 'left';
    } else {
      const distHe = st.prog * (w * 0.2);
      const distN = st.prog * (w * 0.38);
      drawNucleusCluster(cx - distHe, cy - distHe * 0.3, 2, fusionReaction === 'DT' ? 2 : 1, fusionReaction === 'DT' ? '⁴₂He (α)' : '³₂He');
      drawNucleusCluster(cx + distN, cy + distN * 0.25, 0, 1, 'n (¹₀n)');
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${fusionEnergyMeV} MeV`, cx, cy - 45);
      ctx.textAlign = 'left';
    }
  };

  // --- 5. PHẢN ỨNG PHÂN HẠCH ---
  const updateFission = (dt: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(340, rect.height);
    const st = fissionStateRef.current;

    // Control rods occupy vertical gaps between columns if lowered
    const rodDepthPx = (fissionRodPct / 100) * (h - 90);
    const rodXs = [230, 366, 502];

    for (let i = st.neutrons.length - 1; i >= 0; i--) {
      const n = st.neutrons[i];
      n.x += n.vx * dt;
      n.y += n.vy * dt;

      // Absorbed by Boron control rods?
      const hitRod = rodXs.some((rx) => Math.abs(n.x - rx) < 7 && n.y < 40 + rodDepthPx);
      if (hitRod || n.x < 0 || n.x > w || n.y < 0 || n.y > h) {
        st.neutrons.splice(i, 1);
        continue;
      }

      // Hit U-235 nucleus?
      let hit = false;
      for (const nuc of st.nuclei) {
        if (!nuc.intact || !nuc.isU235) continue;
        if (Math.hypot(n.x - nuc.x, n.y - nuc.y) < 16) {
          nuc.intact = false;
          nuc.splitFlash = 1;
          st.count += 1;
          st.neutrons.splice(i, 1);

          // Spawn 2 fission fragments (Ba + Kr)
          const ang = Math.random() * Math.PI;
          st.fragments.push(
            { x: nuc.x, y: nuc.y, vx: Math.cos(ang) * 75, vy: Math.sin(ang) * 75, label: '¹⁴¹Ba', color: '#10B981', life: 1.5 },
            { x: nuc.x, y: nuc.y, vx: -Math.cos(ang) * 85, vy: -Math.sin(ang) * 85, label: '⁹²Kr', color: '#F59E0B', life: 1.5 }
          );

          // Spawn 3 secondary neutrons
          if (st.neutrons.length < 40) {
            for (let k = 0; k < 3; k++) {
              const na = -0.9 + k * 0.9 + (Math.random() - 0.5) * 0.4;
              st.neutrons.push({
                x: nuc.x,
                y: nuc.y,
                vx: Math.cos(na) * 165,
                vy: Math.sin(na) * 165,
              });
            }
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    st.nuclei.forEach((n) => {
      if (n.splitFlash > 0) n.splitFlash = Math.max(0, n.splitFlash - dt * 1.8);
    });
    for (let i = st.fragments.length - 1; i >= 0; i--) {
      const f = st.fragments[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) st.fragments.splice(i, 1);
    }
  };

  const drawFissionCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const st = fissionStateRef.current;
    const rodDepthPx = (fissionRodPct / 100) * (h - 90);

    // Control rods (Boron/Cadmium)
    [230, 366, 502].forEach((rx) => {
      ctx.fillStyle = '#475569';
      ctx.fillRect(rx - 5, 38, 10, rodDepthPx);
      ctx.strokeStyle = '#94A3B8';
      ctx.strokeRect(rx - 5, 38, 10, rodDepthPx);
    });

    // Nuclei grid
    st.nuclei.forEach((nuc) => {
      if (nuc.splitFlash > 0) {
        ctx.fillStyle = `rgba(250, 204, 21, ${nuc.splitFlash * 0.65})`;
        ctx.beginPath();
        ctx.arc(nuc.x, nuc.y, 26, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!nuc.intact) return;
      ctx.fillStyle = nuc.isU235 ? '#0284C7' : '#334155';
      ctx.beginPath();
      ctx.arc(nuc.x, nuc.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(nuc.isU235 ? '235' : '238', nuc.x, nuc.y + 3);
      ctx.textAlign = 'left';
    });

    // Fragments
    st.fragments.forEach((f) => {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.fillText(f.label, f.x + 10, f.y + 3);
    });

    // Neutrons
    ctx.fillStyle = '#FACC15';
    st.neutrons.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(`Phản ứng dây chuyền ²³⁵U · Thanh điều khiển hấp thụ nơtron: ${fissionRodPct}%`, 18, 24);
  };

  // --- 6. THÍ NGHIỆM NHIỆT HỌC ---
  const updateThermal = (dtSimSec: number) => {
    const th = thermalRef.current;
    const dQ = thPowerW * dtSimSec;
    th.tSec += dtSimSec;

    if (thermalMode === 'specificHeat') {
      if (th.tempC < 100) {
        th.tempC = Math.min(100, th.tempC + dQ / (thMassKg * thLiquid.c));
      }
      th.history.push({ t: th.tSec, val: th.tempC });
    } else if (thermalMode === 'fusion') {
      if (th.tempC < 0) {
        th.tempC = Math.min(0, th.tempC + dQ / (thMassKg * 2100)); // ice c ≈ 2100
      } else if (th.meltedKg < thMassKg) {
        th.tempC = 0;
        th.meltedKg = Math.min(thMassKg, th.meltedKg + dQ / LATENT_FUSION);
      } else if (th.tempC < 80) {
        th.tempC = Math.min(80, th.tempC + dQ / (thMassKg * 4200));
      }
      th.history.push({ t: th.tSec, val: th.tempC });
    } else {
      if (th.tempC < 100) {
        th.tempC = Math.min(100, th.tempC + dQ / (thMassKg * 4200));
      } else if (th.vaporizedKg < thMassKg * 0.85) {
        th.tempC = 100;
        th.vaporizedKg = Math.min(thMassKg * 0.85, th.vaporizedKg + dQ / LATENT_VAPOR);
      }
      th.history.push({ t: th.tSec, val: th.tempC });
    }
    if (th.history.length > 260) th.history.shift();
  };

  const drawThermalCanvas = (canvas: HTMLCanvasElement) => {
    const info = setupDpr(canvas);
    if (!info) return;
    const { ctx, w, h } = info;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const splitX = Math.floor(w * 0.44);
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(splitX, 16);
    ctx.lineTo(splitX, h - 16);
    ctx.stroke();

    // Left: Calorimeter / Beaker + Heater + Balance
    const th = thermalRef.current;
    const bx = 56;
    const bw = splitX - 112;
    const bBot = h - 72;
    const bH = h * 0.48;
    const bTop = bBot - bH;

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(
      thermalMode === 'specificHeat'
        ? 'Nhiệt lượng kế đo nhiệt dung riêng'
        : thermalMode === 'fusion'
        ? 'Thí nghiệm đo nhiệt nóng chảy riêng'
        : 'Đo nhiệt hóa hơi trên cân điện tử',
      18,
      28
    );

    // Liquid level
    const remainRatio = thermalMode === 'vaporization' ? Math.max(0.15, (thMassKg - th.vaporizedKg) / thMassKg) : 0.78;
    const liqH = bH * remainRatio * 0.82;
    ctx.fillStyle = thermalMode === 'fusion' && th.meltedKg < thMassKg ? '#E0F2FE' : 'rgba(56, 189, 248, 0.38)';
    ctx.fillRect(bx + 3, bBot - liqH, bw - 6, liqH);

    // Ice cubes if fusion mode and not fully melted
    if (thermalMode === 'fusion' && th.meltedKg < thMassKg) {
      const iceScale = 1 - th.meltedKg / thMassKg;
      ctx.fillStyle = '#BAE6FD';
      ctx.strokeStyle = '#0284C7';
      const sz = Math.max(10, 38 * iceScale);
      ctx.fillRect(bx + bw * 0.28, bBot - liqH + 8, sz, sz * 0.8);
      ctx.strokeRect(bx + bw * 0.28, bBot - liqH + 8, sz, sz * 0.8);
    }

    // Heating coil
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + 18, bBot - 18);
    ctx.lineTo(bx + bw - 18, bBot - 18);
    ctx.stroke();

    // Beaker wall
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(bx, bTop);
    ctx.lineTo(bx, bBot);
    ctx.lineTo(bx + bw, bBot);
    ctx.lineTo(bx + bw, bTop);
    ctx.stroke();

    // Electronic scale / base
    ctx.fillStyle = '#334155';
    ctx.fillRect(bx - 12, bBot + 2, bw + 24, 24);
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `m = ${Math.max(0, (thMassKg - th.vaporizedKg) * 1000).toFixed(0)} g · T = ${th.tempC.toFixed(1)}°C`,
      bx + bw / 2,
      bBot + 18
    );
    ctx.textAlign = 'left';

    // Right: T(t) Heating Curve Graph
    const gx = splitX + 42;
    const gw = w - gx - 24;
    const gyTop = 64;
    const gyBot = h - 54;
    const gh = gyBot - gyTop;

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText('Đồ thị Nhiệt độ theo Thời gian T(t)', splitX + 20, 28);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, gyTop);
    ctx.lineTo(gx, gyBot);
    ctx.lineTo(gx + gw, gyBot);
    ctx.stroke();

    const minT = -15;
    const maxT = 110;
    const zeroY = gyBot - ((0 - minT) / (maxT - minT)) * gh;
    ctx.strokeStyle = '#CBD5E1';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(gx, zeroY);
    ctx.lineTo(gx + gw, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#64748B';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText('0°C', gx - 26, zeroY + 3);

    if (th.history.length > 1) {
      const tMaxPlot = Math.max(60, th.tSec * 1.05);
      ctx.strokeStyle = '#E11D48';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      th.history.forEach((pt, idx) => {
        const px = gx + (pt.t / tMaxPlot) * gw;
        const py = gyBot - ((pt.val - minT) / (maxT - minT)) * gh;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    ctx.fillStyle = '#64748B';
    ctx.fillText('t (s)', gx + gw - 26, gyBot + 16);
    ctx.fillText('T (°C)', gx - 32, gyTop - 10);
  };

  // ===========================================================================
  // RENDER SANDBOX
  // ===========================================================================
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT STAGE */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
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
                if (moduleId === 'rutherford') {
                  ruthParticlesRef.current = [];
                  ruthFlashRef.current = [];
                  setRuthStats({ total: 0, straight: 0, deflected: 0, back: 0 });
                } else if (moduleId === 'nuclearFission') {
                  initFissionGrid();
                } else if (moduleId === 'thermalLab') {
                  resetThermal();
                }
                setIsRunning(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Đặt lại</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
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

        {/* 4-Column Tabular Readouts */}
        <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {moduleId === 'rutherford' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tổng hạt α bắn</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {ruthStats.total} hạt
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Xuyên thẳng (&lt;15°)</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {ruthStats.straight} hạt
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Lệch góc lớn / Bật ngược</span>
                <span className="font-mono tabular-nums font-bold text-amber-700 mt-0.5 block">
                  {ruthStats.deflected} / {ruthStats.back} hạt
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Góc lệch lý thuyết θ</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {ruthSingleAngleDeg.toFixed(1)}°
                </span>
              </div>
            </>
          )}

          {moduleId === 'lightInterference' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Khoảng vân i₁</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {liCalc.i1.toFixed(2)} mm
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Khoảng vân i₂</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {liMode === 'twoColor' ? `${liCalc.i2.toFixed(2)} mm` : '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Khoảng vân trùng i≡</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {liMode === 'twoColor' && liCalc.iOverlap ? `${liCalc.iOverlap.toFixed(2)} mm` : '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Bậc vân tại M (xM/i₁)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {(liProbeMm / liCalc.i1).toFixed(2)}
                </span>
              </div>
            </>
          )}

          {moduleId === 'soundWave' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tần số f / Chu kỳ T</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {soundFreqHz} Hz · {(1000 / soundFreqHz).toFixed(2)} ms
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Bước sóng λ</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {soundWavelengthM.toFixed(2)} m
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Mức cường độ âm L</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {soundLevelDb} dB
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Phân loại sóng âm</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{soundCategory}</span>
              </div>
            </>
          )}

          {moduleId === 'nuclearFusion' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Năng lượng tỏa / 1 pứ</span>
                <span className="font-mono tabular-nums font-bold text-amber-700 mt-0.5 block">
                  {fusionEnergyMeV} MeV
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Số phản ứng thành công</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {fusionCount} lần
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Tổng năng lượng</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {(fusionCount * fusionEnergyMeV).toFixed(1)} MeV
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Điều kiện nhiệt hạch</span>
                <span className={`font-bold mt-0.5 block ${fusionIgnited ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {fusionIgnited ? 'Đạt ngưỡng cháy' : 'Chưa đủ T'}
                </span>
              </div>
            </>
          )}

          {moduleId === 'nuclearFission' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Số hạt ²³⁵U đã phân hạch</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {fissionTelemetry.count} hạt
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Năng lượng tỏa ra</span>
                <span className="font-mono tabular-nums font-bold text-amber-700 mt-0.5 block">
                  {fissionTelemetry.energyMeV} MeV
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Nơtron đang hoạt động</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {fissionTelemetry.activeNeutrons} nơtron
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Chế độ dây chuyền</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {fissionRodPct >= 65 ? 'k < 1 (Tắt dần)' : fissionRodPct >= 30 ? 'k ≈ 1 (Kiểm soát)' : 'k > 1 (Bùng nổ)'}
                </span>
              </div>
            </>
          )}

          {moduleId === 'thermalLab' && (
            <>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Thời gian đun t</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
                  {thReadout.tSec.toFixed(1)} s
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Nhiệt lượng Q = P·t</span>
                <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
                  {thReadout.qKJ.toFixed(1)} kJ
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">Nhiệt độ hiện tại</span>
                <span className="font-mono tabular-nums font-bold text-rose-700 mt-0.5 block">
                  {thReadout.tempC.toFixed(1)} °C
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-500 block">
                  {thermalMode === 'specificHeat'
                    ? 'Nhiệt dung riêng c'
                    : thermalMode === 'fusion'
                    ? 'Đá đã tan / λ'
                    : 'Nước còn lại / L'}
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
                  {thermalMode === 'specificHeat'
                    ? `${thLiquid.c} J/kg·K`
                    : thermalMode === 'fusion'
                    ? `${thReadout.meltedG.toFixed(0)}g · 334kJ/kg`
                    : `${thReadout.massLeftG.toFixed(0)}g · 2260kJ/kg`}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT CONTROLS */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <SlidersHorizontal size={16} className="text-sky-600" />
            <h2 className="text-sm font-extrabold text-slate-900">Bảng Tham Số Thí Nghiệm</h2>
          </div>

          {moduleId === 'rutherford' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRuthBeamMode('beam')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    ruthBeamMode === 'beam' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Chùm hạt α liên tục
                </button>
                <button
                  type="button"
                  onClick={() => setRuthBeamMode('single')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    ruthBeamMode === 'single' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Bắn từng hạt
                </button>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1.5">Lá kim loại bia (Z)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {FOIL_TARGETS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRuthTargetId(f.id)}
                      className={`py-1.5 rounded-lg border font-bold text-[11px] cursor-pointer ${
                        ruthTargetId === f.id ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderControl
                label="Động năng hạt α"
                valueDisplay={`${ruthEnergyMeV.toFixed(1)} MeV`}
                min={3.0}
                max={9.0}
                step={0.5}
                value={ruthEnergyMeV}
                onChange={setRuthEnergyMeV}
              />

              <SliderControl
                label="Tham số va chạm b (độ lệch tâm)"
                valueDisplay={`${ruthImpactB}`}
                min={-60}
                max={60}
                step={2}
                value={ruthImpactB}
                onChange={setRuthImpactB}
              />

              <button
                type="button"
                onClick={() => spawnSingleAlpha(ruthImpactB)}
                className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap size={14} />
                <span>Bắn 1 hạt α tại b = {ruthImpactB}</span>
              </button>
            </div>
          )}

          {moduleId === 'lightInterference' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'mono' as const, label: 'Đơn sắc' },
                  { id: 'twoColor' as const, label: '2 bức xạ' },
                  { id: 'white' as const, label: 'Ánh sáng trắng' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLiMode(m.id)}
                    className={`py-1.5 rounded-md font-bold text-[11px] cursor-pointer ${
                      liMode === m.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {liMode !== 'white' && (
                <SliderControl
                  label="Bước sóng λ₁"
                  valueDisplay={`${liLambda1Nm} nm`}
                  min={380}
                  max={760}
                  step={10}
                  value={liLambda1Nm}
                  onChange={setLiLambda1Nm}
                />
              )}
              {liMode === 'twoColor' && (
                <SliderControl
                  label="Bước sóng λ₂"
                  valueDisplay={`${liLambda2Nm} nm`}
                  min={380}
                  max={760}
                  step={10}
                  value={liLambda2Nm}
                  onChange={setLiLambda2Nm}
                />
              )}
              <SliderControl
                label="Khoảng cách hai khe a"
                valueDisplay={`${liSlitAMm.toFixed(2)} mm`}
                min={0.5}
                max={3.0}
                step={0.1}
                value={liSlitAMm}
                onChange={setLiSlitAMm}
              />
              <SliderControl
                label="Khoảng cách tới màn D"
                valueDisplay={`${liDistDM.toFixed(1)} m`}
                min={0.8}
                max={3.5}
                step={0.1}
                value={liDistDM}
                onChange={setLiDistDM}
              />
              <SliderControl
                label="Vị trí điểm M trên màn"
                valueDisplay={`${liProbeMm.toFixed(2)} mm`}
                min={-8}
                max={8}
                step={0.1}
                value={liProbeMm}
                onChange={setLiProbeMm}
              />
            </div>
          )}

          {moduleId === 'soundWave' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'air' as const, label: 'Không khí' },
                  { id: 'water' as const, label: 'Nước' },
                  { id: 'steel' as const, label: 'Thép' },
                ].map((med) => (
                  <button
                    key={med.id}
                    type="button"
                    onClick={() => setSoundMedium(med.id)}
                    className={`py-1.5 rounded-md font-bold text-[11px] cursor-pointer ${
                      soundMedium === med.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {med.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSoundTimbre('pure')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    soundTimbre === 'pure' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Âm thuần (Sin)
                </button>
                <button
                  type="button"
                  onClick={() => setSoundTimbre('flute')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    soundTimbre === 'flute' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Nhạc âm (Họa âm)
                </button>
              </div>

              <SliderControl
                label="Tần số (Độ cao của âm) f"
                valueDisplay={`${soundFreqHz} Hz`}
                min={10}
                max={1200}
                step={5}
                value={soundFreqHz}
                onChange={setSoundFreqHz}
              />
              <SliderControl
                label="Mức cường độ âm (Độ to) L"
                valueDisplay={`${soundLevelDb} dB`}
                min={20}
                max={110}
                step={5}
                value={soundLevelDb}
                onChange={setSoundLevelDb}
              />

              <button
                type="button"
                onClick={() => setSoundAudioOn((v) => !v)}
                className={`w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  soundAudioOn
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {soundAudioOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span>{soundAudioOn ? 'Đang phát âm thanh thật (Bấm để tắt)' : 'Bật loa nghe âm thanh thực tế'}</span>
              </button>
            </div>
          )}

          {moduleId === 'nuclearFusion' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFusionReaction('DT')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    fusionReaction === 'DT' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  D + T → He + n
                </button>
                <button
                  type="button"
                  onClick={() => setFusionReaction('DD')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    fusionReaction === 'DD' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  D + D → ³He + n
                </button>
              </div>

              <SliderControl
                label="Nhiệt độ plasma T"
                valueDisplay={`${fusionTempMK} triệu K`}
                min={20}
                max={200}
                step={5}
                value={fusionTempMK}
                onChange={setFusionTempMK}
              />

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Phản ứng nhiệt hạch tổng hợp hai hạt nhân nhẹ thành hạt nhân nặng hơn ở nhiệt độ cực cao (hàng trăm triệu độ K) để thắng lực đẩy tĩnh điện Coulomb.
              </p>
            </div>
          )}

          {moduleId === 'nuclearFission' && (
            <div className="space-y-4 text-xs">
              <SliderControl
                label="Độ hạ thanh điều khiển (Hấp thụ nơtron)"
                valueDisplay={`${fissionRodPct}%`}
                min={0}
                max={100}
                step={5}
                value={fissionRodPct}
                onChange={setFissionRodPct}
              />
              <SliderControl
                label="Độ làm giàu hạt nhân ²³⁵U"
                valueDisplay={`${fissionEnrichPct}%`}
                min={25}
                max={100}
                step={5}
                value={fissionEnrichPct}
                onChange={(v) => {
                  setFissionEnrichPct(v);
                  initFissionGrid(v);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={fireTriggerNeutron}
                  className="py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
                >
                  Bắn 1 nơtron kích thích
                </button>
                <button
                  type="button"
                  onClick={() => initFissionGrid()}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
                >
                  Nạp lại khối ²³⁵U
                </button>
              </div>
            </div>
          )}

          {moduleId === 'thermalLab' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'specificHeat' as const, label: 'Nhiệt dung riêng' },
                  { id: 'fusion' as const, label: 'Nóng chảy' },
                  { id: 'vaporization' as const, label: 'Hóa hơi' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setThermalMode(m.id);
                      resetThermal(m.id, thMassKg);
                    }}
                    className={`py-1.5 rounded-md font-bold text-[11px] cursor-pointer ${
                      thermalMode === m.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {thermalMode === 'specificHeat' && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1.5">Chất lỏng khảo sát</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SPECIFIC_HEAT_LIQUIDS.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setThLiquidId(l.id);
                          resetThermal('specificHeat', thMassKg);
                        }}
                        className={`py-1.5 px-2 rounded-lg border font-bold text-[11px] cursor-pointer ${
                          thLiquidId === l.id
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <SliderControl
                label="Công suất dây nung P"
                valueDisplay={`${thPowerW} W`}
                min={200}
                max={1500}
                step={50}
                value={thPowerW}
                onChange={setThPowerW}
              />
              <SliderControl
                label="Khối lượng mẫu m"
                valueDisplay={`${thMassKg.toFixed(2)} kg`}
                min={0.2}
                max={1.5}
                step={0.1}
                value={thMassKg}
                onChange={(v) => {
                  setThMassKg(v);
                  resetThermal(thermalMode, v);
                }}
              />
            </div>
          )}
        </div>

        {/* Formula Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <h3 className="font-extrabold text-slate-900">Công Thức Trọng Tâm</h3>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto text-slate-800">
            {moduleId === 'rutherford' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`\tan\frac{\theta}{2} = \frac{k\,Z\,q_\alpha}{2 E_\alpha b}\quad (\text{Hạt nhân nhỏ, tích điện dương})`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'lightInterference' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`i = \frac{\lambda D}{a},\quad x_{\text{trùng}} = k_1 i_1 = k_2 i_2`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'soundWave' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`L(\text{dB}) = 10\log\left(\frac{I}{I_0}\right),\quad \lambda = \frac{v}{f}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'nuclearFusion' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`{}^2_1\text{H} + {}^3_1\text{H} \to {}^4_2\text{He} + {}^1_0 n + 17.6\text{ MeV}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'nuclearFission' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`{}^1_0 n + {}^{235}_{92}\text{U} \to {}^{141}_{56}\text{Ba} + {}^{92}_{36}\text{Kr} + 3\,{}^1_0 n + 200\text{ MeV}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'thermalLab' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    thermalMode === 'specificHeat'
                      ? String.raw`Q = m c \Delta T \implies c = \frac{P \cdot t}{m \cdot \Delta T}`
                      : thermalMode === 'fusion'
                      ? String.raw`Q = \lambda m \implies \lambda = \frac{P \cdot \tau_{\text{tan}}}{m}`
                      : String.raw`Q = L m \implies L = \frac{P \cdot \Delta t}{\Delta m}`,
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

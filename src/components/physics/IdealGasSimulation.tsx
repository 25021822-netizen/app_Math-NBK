import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { Play, Pause, RotateCcw, SlidersHorizontal, BookmarkCheck } from 'lucide-react';

function renderLatex(tex: string, displayMode = false): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode });
  } catch {
    return tex;
  }
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

type GasProcessId = 'isothermal' | 'isobaric' | 'isochoric' | 'general';
type GasChartId = 'pV' | 'pT' | 'VT';

interface GasSpecies {
  id: 'He' | 'H2' | 'N2' | 'O2';
  name: string;
  formula: string;
  molarMassKg: number;
  dof: number; // Degrees of freedom i (3 monatomic, 5 diatomic)
  color: string;
}

const GAS_SPECIES: GasSpecies[] = [
  { id: 'He', name: 'Heli (Đơn nguyên tử)', formula: 'He', molarMassKg: 0.004, dof: 3, color: '#0EA5E9' },
  { id: 'H2', name: 'Hiđrô (Lưỡng nguyên tử)', formula: 'H₂', molarMassKg: 0.002, dof: 5, color: '#8B5CF6' },
  { id: 'N2', name: 'Nitơ (Lưỡng nguyên tử)', formula: 'N₂', molarMassKg: 0.028, dof: 5, color: '#0284C7' },
  { id: 'O2', name: 'Oxi (Lưỡng nguyên tử)', formula: 'O₂', molarMassKg: 0.032, dof: 5, color: '#E11D48' },
];

const R_ATM = 0.082057; // L·atm / (mol·K)
const R_SI = 8.31446; // J / (mol·K)
const KB_SI = 1.380649e-23; // J / K
const NA_CONST = 6.02214e23; // mol^-1
const ATM_TO_KPA = 101.325;

const MIN_VOL_L = 4.0;
const MAX_VOL_L = 36.0;
const MIN_TEMP_K = 150;
const MAX_TEMP_K = 700;

interface GasMolecule {
  // Normalized horizontal [0, 1] across box width
  // Physical vertical fraction [0, 1] relative to MAX_VOL_L height (0 = bottom of cylinder, 1 = max top)
  x: number;
  yFromBottom: number;
  vx: number; // normalized units/s at reference T=300K, M=0.028
  vy: number;
  speedMult: number; // Rayleigh / Maxwell speed dispersion
}

interface StateSnapshot {
  pAtm: number;
  vL: number;
  tK: number;
  nMol: number;
}

function createInitialMolecules(): GasMolecule[] {
  const list: GasMolecule[] = [];
  for (let i = 0; i < 64; i++) {
    // Box-Muller like speed variation for realistic velocity spread
    const u1 = ((i * 37 + 13) % 97 + 1) / 98;
    const speed = Math.max(0.35, Math.min(2.1, Math.sqrt(-Math.log(u1))));
    const angle = (i * 2.39996) % (Math.PI * 2);
    list.push({
      x: 0.08 + ((i * 73) % 84) / 100,
      yFromBottom: 0.04 + ((i * 41) % 30) / 100,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speedMult: speed,
    });
  }
  return list;
}

export const IdealGasSimulation: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1);
  const [processId, setProcessId] = useState<GasProcessId>('isothermal');
  const [chartId, setChartId] = useState<GasChartId>('pV');
  const [speciesId, setSpeciesId] = useState<GasSpecies['id']>('N2');

  const [moles, setMoles] = useState<number>(1.0);
  const [tempK, setTempK] = useState<number>(300);
  const [volL, setVolL] = useState<number>(12.0);
  const [lockedPAtm, setLockedPAtm] = useState<number>(() => (1.0 * R_ATM * 300) / 12.0);

  // State 1 snapshot for verifying state laws & computing A', Q, ΔU
  const [state1, setState1] = useState<StateSnapshot>(() => ({
    pAtm: (1.0 * R_ATM * 300) / 12.0,
    vL: 12.0,
    tK: 300,
    nMol: 1.0,
  }));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moleculesRef = useRef<GasMolecule[]>(createInitialMolecules());
  const wallFlashesRef = useRef<{ xNorm: number; yNorm: number; life: number }[]>([]);

  const species = useMemo(
    () => GAS_SPECIES.find((g) => g.id === speciesId) || GAS_SPECIES[2],
    [speciesId]
  );

  // Exact consistent state calculation satisfying p*V = n*R*T unconditionally
  const gasCalc = useMemo(() => {
    let actualT = tempK;
    let actualV = volL;
    let actualP = (moles * R_ATM * actualT) / actualV;

    if (processId === 'isobaric') {
      actualP = lockedPAtm;
      const idealV = (moles * R_ATM * tempK) / actualP;
      if (idealV < MIN_VOL_L) {
        actualV = MIN_VOL_L;
        actualT = Math.round((actualP * MIN_VOL_L) / (moles * R_ATM));
      } else if (idealV > MAX_VOL_L) {
        actualV = MAX_VOL_L;
        actualT = Math.round((actualP * MAX_VOL_L) / (moles * R_ATM));
      } else {
        actualV = idealV;
      }
    }

    const pKpa = actualP * ATM_TO_KPA;
    const vM3 = actualV * 1e-3;
    const vrms = Math.sqrt((3 * R_SI * actualT) / species.molarMassKg);
    const meanKineticJ = 1.5 * KB_SI * actualT; // Translational average kinetic energy (J)
    const densityM3 = (moles * NA_CONST) / vM3; // molecules / m^3
    const pvOverT = (actualP * actualV) / actualT; // L·atm/K = nR

    // First Law of Thermodynamics from State 1 -> Current State 2 (when n is constant)
    const deltaT = actualT - state1.tK;
    const deltaU = 0.5 * species.dof * moles * R_SI * deltaT; // J
    let workByGas = 0; // A' = \int p dV (J)
    let hasExactWork = true;

    if (Math.abs(moles - state1.nMol) > 0.01) {
      hasExactWork = false;
    } else if (processId === 'isochoric') {
      workByGas = 0;
    } else if (processId === 'isobaric') {
      workByGas = actualP * ATM_TO_KPA * 1000 * (actualV - state1.vL) * 1e-3;
    } else if (processId === 'isothermal') {
      workByGas = moles * R_SI * actualT * Math.log(actualV / Math.max(0.1, state1.vL));
    } else {
      hasExactWork = false;
    }

    const heatQ = hasExactWork ? deltaU + workByGas : 0; // Q = ΔU + A' (since ΔU = Q - A')

    return {
      actualP,
      actualV,
      actualT,
      pKpa,
      vrms,
      meanKineticJ,
      densityM3,
      pvOverT,
      deltaU,
      workByGas,
      heatQ,
      hasExactWork,
    };
  }, [processId, moles, tempK, volL, lockedPAtm, species, state1]);

  // Keep valid T limits for isobaric slider display/guidance
  const isobaricTLimits = useMemo(() => {
    const tMin = Math.max(MIN_TEMP_K, Math.ceil((lockedPAtm * MIN_VOL_L) / (moles * R_ATM)));
    const tMax = Math.min(MAX_TEMP_K, Math.floor((lockedPAtm * MAX_VOL_L) / (moles * R_ATM)));
    return { tMin, tMax: Math.max(tMin, tMax) };
  }, [lockedPAtm, moles]);

  // Valid physical pressure bounds [pMin, pMax] for the active process
  const pressureLimits = useMemo(() => {
    if (processId === 'isobaric') {
      return { pMin: 0.4, pMax: 8.0 };
    }
    if (processId === 'isochoric') {
      const pMin = Math.max(0.2, (moles * R_ATM * MIN_TEMP_K) / volL);
      const pMax = (moles * R_ATM * MAX_TEMP_K) / volL;
      return { pMin: Number(pMin.toFixed(2)), pMax: Number(Math.max(pMin + 0.1, pMax).toFixed(2)) };
    }
    // isothermal or general: pressure adjusts volume within [MIN_VOL_L, MAX_VOL_L] at current T
    const pMin = (moles * R_ATM * tempK) / MAX_VOL_L;
    const pMax = (moles * R_ATM * tempK) / MIN_VOL_L;
    return { pMin: Number(pMin.toFixed(2)), pMax: Number(Math.max(pMin + 0.1, pMax).toFixed(2)) };
  }, [processId, moles, tempK, volL]);

  const handlePressureChange = (nextP: number) => {
    const clampedP = Math.max(pressureLimits.pMin, Math.min(pressureLimits.pMax, nextP));
    if (processId === 'isobaric') {
      setLockedPAtm(clampedP);
      const idealV = (moles * R_ATM * tempK) / clampedP;
      if (idealV < MIN_VOL_L) {
        setTempK(Math.min(MAX_TEMP_K, Math.max(MIN_TEMP_K, Math.ceil((clampedP * MIN_VOL_L) / (moles * R_ATM)))));
      } else if (idealV > MAX_VOL_L) {
        setTempK(Math.min(MAX_TEMP_K, Math.max(MIN_TEMP_K, Math.floor((clampedP * MAX_VOL_L) / (moles * R_ATM)))));
      }
      return;
    }
    if (processId === 'isochoric') {
      const nextT = Math.round((clampedP * volL) / (moles * R_ATM));
      setTempK(Math.min(MAX_TEMP_K, Math.max(MIN_TEMP_K, nextT)));
      return;
    }
    // isothermal or general: V = nRT / p
    const nextV = (moles * R_ATM * tempK) / clampedP;
    setVolL(Number(Math.min(MAX_VOL_L, Math.max(MIN_VOL_L, nextV)).toFixed(2)));
  };

  const handleSelectProcess = (nextProc: GasProcessId) => {
    const curP = gasCalc.actualP;
    const curV = gasCalc.actualV;
    const curT = gasCalc.actualT;

    setVolL(Number(curV.toFixed(2)));
    setTempK(Math.round(curT));
    if (nextProc === 'isobaric') {
      setLockedPAtm(Math.min(8.0, Math.max(0.4, Number(curP.toFixed(2)))));
    }
    setState1({
      pAtm: curP,
      vL: curV,
      tK: curT,
      nMol: moles,
    });
    setProcessId(nextProc);
  };

  const handleCaptureState1 = () => {
    setState1({
      pAtm: gasCalc.actualP,
      vL: gasCalc.actualV,
      tK: gasCalc.actualT,
      nMol: moles,
    });
  };

  const handleReset = () => {
    const defT = 300;
    const defV = 12.0;
    const defN = 1.0;
    const defP = (defN * R_ATM * defT) / defV;
    setMoles(defN);
    setTempK(defT);
    setVolL(defV);
    setLockedPAtm(defP);
    setState1({ pAtm: defP, vL: defV, tK: defT, nMol: defN });
    moleculesRef.current = createInitialMolecules();
    wallFlashesRef.current = [];
    setIsRunning(true);
  };

  // Animation loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const dt = isRunning ? rawDt * timeScale : 0;

      if (dt > 0) {
        updateMolecules(dt);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        drawIdealGasCanvas(canvas);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  const updateMolecules = (dt: number) => {
    // v_rms scales with sqrt(T / M). Relative to N2 (0.028) at 300 K:
    const speedScale = Math.sqrt((gasCalc.actualT / 300) * (0.028 / species.molarMassKg)) * 0.48;
    const maxYNorm = gasCalc.actualV / MAX_VOL_L; // e.g., 12/36 = 0.333 of total cylinder capacity
    const activeCount = Math.min(64, Math.max(16, Math.round(moles * 32)));

    for (let i = 0; i < activeCount; i++) {
      const m = moleculesRef.current[i];
      m.x += m.vx * speedScale * dt;
      // Same physical velocity scale vertically (cylinder visual height ~ 1.4x width, factor handled in step)
      m.yFromBottom += m.vy * speedScale * 0.72 * dt;

      if (m.x < 0.03) {
        m.x = 0.03;
        m.vx = Math.abs(m.vx);
      } else if (m.x > 0.97) {
        m.x = 0.97;
        m.vx = -Math.abs(m.vx);
      }

      if (m.yFromBottom < 0.02) {
        m.yFromBottom = 0.02;
        m.vy = Math.abs(m.vy);
      } else if (m.yFromBottom > maxYNorm - 0.02) {
        m.yFromBottom = Math.max(0.025, maxYNorm - 0.02);
        m.vy = -Math.abs(m.vy);
        if (wallFlashesRef.current.length < 18) {
          wallFlashesRef.current.push({
            xNorm: m.x,
            yNorm: maxYNorm,
            life: 1,
          });
        }
      }
    }

    for (let i = wallFlashesRef.current.length - 1; i >= 0; i--) {
      wallFlashesRef.current[i].life -= dt * 4.5;
      if (wallFlashesRef.current[i].life <= 0) {
        wallFlashesRef.current.splice(i, 1);
      }
    }
  };

  const drawIdealGasCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(340, Math.floor(rect.width));
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

    const splitX = Math.floor(w * 0.44);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 16);
    ctx.lineTo(splitX, h - 16);
    ctx.stroke();

    // =========================================================================
    // LEFT: CYLINDER, PISTON, LOCKING PINS, WEIGHTS, THERMOMETER & PRESSURE GAUGE
    // =========================================================================
    const cylW = Math.min(180, splitX - 135);
    const cylX = 68;
    const cylBot = h - 74;
    const cylMaxH = h - 154;
    const volFrac = Math.min(1, Math.max(MIN_VOL_L / MAX_VOL_L, gasCalc.actualV / MAX_VOL_L));
    const chamberH = cylMaxH * volFrac;
    const pistonY = cylBot - chamberH;

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(`Xi-lanh khí ${species.formula} (n = ${moles.toFixed(1)} mol)`, 20, 26);

    // Thermal background inside gas chamber
    const tempNorm = Math.min(1, Math.max(0, (gasCalc.actualT - MIN_TEMP_K) / (MAX_TEMP_K - MIN_TEMP_K)));
    const rCol = Math.round(216 + tempNorm * 39);
    const gCol = Math.round(238 - tempNorm * 58);
    const bCol = Math.round(255 - tempNorm * 105);
    ctx.fillStyle = `rgb(${rCol}, ${gCol}, ${bCol})`;
    ctx.fillRect(cylX, pistonY, cylW, chamberH);

    // Heat / Cold reservoir base under cylinder
    ctx.fillStyle = tempNorm > 0.45 ? '#F97316' : tempNorm < 0.25 ? '#0EA5E9' : '#94A3B8';
    ctx.beginPath();
    ctx.roundRect(cylX - 6, cylBot + 4, cylW + 12, 14, 4);
    ctx.fill();
    if (tempNorm > 0.45) {
      // Flame icons along burner
      ctx.fillStyle = '#FEF08A';
      for (let fx = cylX + 18; fx < cylX + cylW - 10; fx += 26) {
        ctx.beginPath();
        ctx.moveTo(fx, cylBot + 4);
        ctx.quadraticCurveTo(fx + 5, cylBot - 6, fx + 10, cylBot + 4);
        ctx.fill();
      }
    }

    // Active gas molecules
    const activeCount = Math.min(64, Math.max(16, Math.round(moles * 32)));
    for (let i = 0; i < activeCount; i++) {
      const m = moleculesRef.current[i];
      const mx = cylX + 6 + m.x * (cylW - 12);
      const my = cylBot - 5 - m.yFromBottom * (cylMaxH - 10);
      if (my < pistonY + 3) continue;

      // Subtle speed color coding + velocity tail
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - m.vx * 4, my + m.vy * 4);
      ctx.stroke();

      ctx.fillStyle = species.color;
      ctx.beginPath();
      ctx.arc(mx, my, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Piston impact flashes
    wallFlashesRef.current.forEach((f) => {
      const fx = cylX + 6 + f.xNorm * (cylW - 12);
      ctx.fillStyle = `rgba(225, 29, 72, ${Math.max(0, f.life * 0.7)})`;
      ctx.beginPath();
      ctx.arc(fx, pistonY + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Cylinder walls
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cylX, cylBot - cylMaxH - 18);
    ctx.lineTo(cylX, cylBot);
    ctx.lineTo(cylX + cylW, cylBot);
    ctx.lineTo(cylX + cylW, cylBot - cylMaxH - 18);
    ctx.stroke();

    // Volume scale markings along left wall
    ctx.strokeStyle = '#64748B';
    ctx.fillStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.font = '600 9px ui-monospace, monospace';
    ctx.textAlign = 'right';
    [8, 16, 24, 32, 36].forEach((vMark) => {
      const my = cylBot - (vMark / MAX_VOL_L) * cylMaxH;
      ctx.beginPath();
      ctx.moveTo(cylX - 5, my);
      ctx.lineTo(cylX + 4, my);
      ctx.stroke();
      ctx.fillText(`${vMark}L`, cylX - 8, my + 3);
    });
    ctx.textAlign = 'left';

    // Piston head + rod + platform
    ctx.fillStyle = '#475569';
    ctx.fillRect(cylX + 2, pistonY - 12, cylW - 4, 12);
    ctx.fillStyle = '#64748B';
    ctx.fillRect(cylX + cylW / 2 - 4, pistonY - 40, 8, 28);
    ctx.fillRect(cylX + cylW / 2 - 26, pistonY - 45, 52, 5);

    // Weights on piston platform (proportional to pressure when not locked)
    if (processId !== 'isochoric') {
      const weightCount = Math.min(5, Math.max(1, Math.round(gasCalc.actualP / 1.1)));
      for (let wIdx = 0; wIdx < weightCount; wIdx++) {
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.fillRect(cylX + cylW / 2 - 16, pistonY - 53 - wIdx * 8, 32, 7);
        ctx.strokeRect(cylX + cylW / 2 - 16, pistonY - 53 - wIdx * 8, 32, 7);
      }
    } else {
      // Locking pins on cylinder walls for Isochoric (Đẳng tích)
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(cylX - 8, pistonY - 14, 12, 8);
      ctx.fillRect(cylX + cylW - 4, pistonY - 14, 12, 8);
      ctx.fillStyle = '#991B1B';
      ctx.font = 'bold 9px ui-sans-serif, sans-serif';
      ctx.fillText('Chốt hãm V', cylX + cylW + 10, pistonY - 7);
    }

    // Analog Pressure Gauge connected to bottom-right of cylinder
    const gaugeCx = cylX + cylW + 38;
    const gaugeCy = cylBot - 36;
    const gaugeR = 24;
    // Pipe
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cylX + cylW, cylBot - 16);
    ctx.lineTo(gaugeCx, cylBot - 16);
    ctx.lineTo(gaugeCx, gaugeCy + gaugeR);
    ctx.stroke();

    // Dial
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gaugeCx, gaugeCy, gaugeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gauge ticks (adaptive scale so high pressure never pins off-scale)
    const maxGaugeAtm = gasCalc.actualP > 10 ? Math.ceil(gasCalc.actualP / 5) * 5 + 5 : 10;
    const pAngle = Math.PI * 0.75 + Math.min(1, gasCalc.actualP / maxGaugeAtm) * Math.PI * 1.5;
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gaugeCx, gaugeCy);
    ctx.lineTo(gaugeCx + Math.cos(pAngle) * (gaugeR - 5), gaugeCy + Math.sin(pAngle) * (gaugeR - 5));
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(gaugeCx, gaugeCy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${gasCalc.actualP.toFixed(2)}`, gaugeCx, gaugeCy + 13);
    ctx.fillStyle = '#64748B';
    ctx.fillText('atm', gaugeCx, gaugeCy - 9);

    // Thermometer beside gauge
    const thermX = gaugeCx;
    const thermTop = cylBot - cylMaxH + 24;
    const thermBot = gaugeCy - gaugeR - 28;
    if (thermBot - thermTop > 50) {
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.roundRect(thermX - 5, thermTop, 10, thermBot - thermTop, 5);
      ctx.fill();
      const fillH = Math.max(8, tempNorm * (thermBot - thermTop - 6));
      ctx.fillStyle = tempNorm > 0.5 ? '#EF4444' : '#0284C7';
      ctx.beginPath();
      ctx.roundRect(thermX - 3, thermBot - fillH, 6, fillH, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(thermX, thermBot + 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.fillText(`${Math.round(gasCalc.actualT)}K`, thermX, thermTop - 6);
    }

    // Bottom caption below cylinder
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `V = ${gasCalc.actualV.toFixed(1)} L · p = ${gasCalc.actualP.toFixed(2)} atm · T = ${Math.round(gasCalc.actualT)} K`,
      splitX / 2,
      h - 24
    );
    ctx.textAlign = 'left';

    // =========================================================================
    // RIGHT: INTERACTIVE STATE DIAGRAMS (p-V, p-T, V-T) WITH ORIGIN EXTRAPOLATION
    // =========================================================================
    const gx = splitX + 48;
    const gw = w - gx - 24;
    const gyTop = 58;
    const gyBot = h - 54;
    const gh = gyBot - gyTop;

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    const chartTitle =
      chartId === 'pV'
        ? 'Đồ thị trạng thái p - V (Đường đẳng nhiệt & Công)'
        : chartId === 'pT'
        ? 'Đồ thị trạng thái p - T (Nhiệt độ tuyệt đối K)'
        : 'Đồ thị trạng thái V - T (Nhiệt độ tuyệt đối K)';
    ctx.fillText(chartTitle, splitX + 18, 26);

    // Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(gx, gyTop);
    ctx.lineTo(gx, gyBot);
    ctx.lineTo(gx + gw, gyBot);
    ctx.stroke();

    const maxP = Math.max(8.0, Math.ceil(Math.max(gasCalc.actualP, state1.pAtm) / 2) * 2 + 2);
    const maxV = 38.0; // L
    const maxT = 740.0; // K (starts at 0 K to show absolute zero origin!)

    const toPxPV = (v: number, p: number) => ({
      x: gx + (Math.min(maxV, Math.max(0, v)) / maxV) * gw,
      y: gyBot - (Math.min(maxP, Math.max(0, p)) / maxP) * gh,
    });
    const toPxPT = (t: number, p: number) => ({
      x: gx + (Math.min(maxT, Math.max(0, t)) / maxT) * gw,
      y: gyBot - (Math.min(maxP, Math.max(0, p)) / maxP) * gh,
    });
    const toPxVT = (t: number, v: number) => ({
      x: gx + (Math.min(maxT, Math.max(0, t)) / maxT) * gw,
      y: gyBot - (Math.min(maxV, Math.max(0, v)) / maxV) * gh,
    });

    // Subtle grid lines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const yG = gyBot - (i / 4) * gh;
      const xG = gx + (i / 4) * gw;
      ctx.beginPath();
      ctx.moveTo(gx, yG);
      ctx.lineTo(gx + gw, yG);
      ctx.moveTo(xG, gyTop);
      ctx.lineTo(xG, gyBot);
      ctx.stroke();
    }

    if (chartId === 'pV') {
      // Faint reference isotherm at T1 if different from T2
      if (Math.abs(state1.tK - gasCalc.actualT) > 5) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 80; i++) {
          const vv = 3 + (i / 80) * (maxV - 3);
          const pp = (moles * R_ATM * state1.tK) / vv;
          if (pp > maxP) continue;
          const pt = toPxPV(vv, pp);
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shade Work Area A' between V1 and V2 for isothermal or isobaric
      if (gasCalc.hasExactWork && Math.abs(gasCalc.actualV - state1.vL) > 0.2) {
        const vStart = Math.min(state1.vL, gasCalc.actualV);
        const vEnd = Math.max(state1.vL, gasCalc.actualV);
        ctx.fillStyle = gasCalc.actualV > state1.vL ? 'rgba(14, 165, 233, 0.14)' : 'rgba(245, 158, 11, 0.14)';
        ctx.beginPath();
        const pStartPt = toPxPV(vStart, 0);
        ctx.moveTo(pStartPt.x, gyBot);
        for (let i = 0; i <= 40; i++) {
          const vv = vStart + (i / 40) * (vEnd - vStart);
          const pp = processId === 'isobaric' ? gasCalc.actualP : (moles * R_ATM * gasCalc.actualT) / vv;
          const pt = toPxPV(vv, Math.min(maxP, pp));
          ctx.lineTo(pt.x, pt.y);
        }
        const pEndPt = toPxPV(vEnd, 0);
        ctx.lineTo(pEndPt.x, gyBot);
        ctx.closePath();
        ctx.fill();
      }

      // Active Process Curve
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (processId === 'isothermal' || processId === 'general') {
        let started = false;
        for (let i = 0; i <= 100; i++) {
          const vv = 3 + (i / 100) * (maxV - 3);
          const pp = (moles * R_ATM * gasCalc.actualT) / vv;
          if (pp > maxP) continue;
          const pt = toPxPV(vv, pp);
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else ctx.lineTo(pt.x, pt.y);
        }
      } else if (processId === 'isobaric') {
        const pLeft = toPxPV(MIN_VOL_L, gasCalc.actualP);
        const pRight = toPxPV(MAX_VOL_L, gasCalc.actualP);
        ctx.moveTo(pLeft.x, pLeft.y);
        ctx.lineTo(pRight.x, pRight.y);
      } else {
        const pBot = toPxPV(gasCalc.actualV, (moles * R_ATM * MIN_TEMP_K) / gasCalc.actualV);
        const pTop = toPxPV(gasCalc.actualV, Math.min(maxP, (moles * R_ATM * MAX_TEMP_K) / gasCalc.actualV));
        ctx.moveTo(pBot.x, pBot.y);
        ctx.lineTo(pTop.x, pTop.y);
      }
      ctx.stroke();

      // State 1 & State 2 points
      const pt1 = toPxPV(state1.vL, state1.pAtm);
      const pt2 = toPxPV(gasCalc.actualV, gasCalc.actualP);
      drawStateMarkers(ctx, pt1, pt2, gx, gw, gasCalc);

      // Axis labels
      ctx.fillStyle = '#64748B';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillText('V (lít)', gx + gw - 36, gyBot + 18);
      ctx.fillText(`p (atm, max ${maxP})`, gx - 42, gyTop - 8);
      ctx.fillText('0', gx - 10, gyBot + 14);
    } else if (chartId === 'pT') {
      // p - T diagram
      if (processId === 'isochoric' || processId === 'general') {
        const slope = (moles * R_ATM) / gasCalc.actualV;
        const pAtMinT = slope * MIN_TEMP_K;
        const pAtMaxT = Math.min(maxP, slope * MAX_TEMP_K);
        const tAtMax = Math.min(MAX_TEMP_K, maxP / slope);

        // Dashed extrapolation to Origin O(0, 0)
        const origin = toPxPT(0, 0);
        const minPt = toPxPT(MIN_TEMP_K, pAtMinT);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(minPt.x, minPt.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Solid line segment
        const maxPt = toPxPT(tAtMax, pAtMaxT);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(minPt.x, minPt.y);
        ctx.lineTo(maxPt.x, maxPt.y);
        ctx.stroke();
      } else if (processId === 'isobaric') {
        const ptA = toPxPT(isobaricTLimits.tMin, gasCalc.actualP);
        const ptB = toPxPT(isobaricTLimits.tMax, gasCalc.actualP);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.stroke();
      } else {
        // Isothermal: vertical line at T = const
        const ptA = toPxPT(gasCalc.actualT, (moles * R_ATM * gasCalc.actualT) / MAX_VOL_L);
        const ptB = toPxPT(gasCalc.actualT, Math.min(maxP, (moles * R_ATM * gasCalc.actualT) / MIN_VOL_L));
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.stroke();
      }

      const pt1 = toPxPT(state1.tK, state1.pAtm);
      const pt2 = toPxPT(gasCalc.actualT, gasCalc.actualP);
      drawStateMarkers(ctx, pt1, pt2, gx, gw, gasCalc);

      ctx.fillStyle = '#64748B';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillText('T (K)', gx + gw - 32, gyBot + 18);
      ctx.fillText(`p (atm, max ${maxP})`, gx - 42, gyTop - 8);
      ctx.fillText('0 K', gx - 12, gyBot + 14);
    } else {
      // V - T diagram
      if (processId === 'isobaric' || processId === 'general') {
        const pRef = gasCalc.actualP;
        const slope = (moles * R_ATM) / pRef;
        const tStart = Math.max(MIN_TEMP_K, Math.ceil((pRef * MIN_VOL_L) / (moles * R_ATM)));
        const tEnd = Math.min(MAX_TEMP_K, Math.floor((pRef * MAX_VOL_L) / (moles * R_ATM)));
        const origin = toPxVT(0, 0);
        const ptMin = toPxVT(tStart, slope * tStart);
        const ptMax = toPxVT(Math.max(tStart, tEnd), Math.min(MAX_VOL_L, slope * Math.max(tStart, tEnd)));

        // Dashed extrapolation to O(0, 0)
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(ptMin.x, ptMin.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ptMin.x, ptMin.y);
        ctx.lineTo(ptMax.x, ptMax.y);
        ctx.stroke();
      } else if (processId === 'isochoric') {
        const ptA = toPxVT(MIN_TEMP_K, gasCalc.actualV);
        const ptB = toPxVT(MAX_TEMP_K, gasCalc.actualV);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.stroke();
      } else {
        // Isothermal: vertical line at T = const
        const ptA = toPxVT(gasCalc.actualT, MIN_VOL_L);
        const ptB = toPxVT(gasCalc.actualT, MAX_VOL_L);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.stroke();
      }

      const pt1 = toPxVT(state1.tK, state1.vL);
      const pt2 = toPxVT(gasCalc.actualT, gasCalc.actualV);
      drawStateMarkers(ctx, pt1, pt2, gx, gw, gasCalc);

      ctx.fillStyle = '#64748B';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillText('T (K)', gx + gw - 32, gyBot + 18);
      ctx.fillText('V (lít)', gx - 42, gyTop - 8);
      ctx.fillText('0 K', gx - 12, gyBot + 14);
    }
  };

  function drawStateMarkers(
    ctx: CanvasRenderingContext2D,
    pt1: { x: number; y: number },
    pt2: { x: number; y: number },
    gx: number,
    gw: number,
    cur: { actualV: number; actualP: number; actualT: number }
  ) {
    const moved = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y) > 8;
    if (moved) {
      // Point 1 marker
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(pt1.x, pt1.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 10px ui-sans-serif, sans-serif';
      ctx.fillText('(1)', pt1.x - 16, pt1.y - 7);
    }

    // Current Point 2 marker
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.arc(pt2.x, pt2.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10px ui-monospace, monospace';
    const label = `${moved ? '(2) ' : ''}${cur.actualV.toFixed(1)}L; ${cur.actualP.toFixed(2)}atm; ${Math.round(cur.actualT)}K`;
    const tx = Math.min(Math.max(pt2.x - 45, gx + 6), gx + gw - 150);
    ctx.fillText(label, tx, Math.max(70, pt2.y - 10));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT ZONE: INTERACTIVE CANVAS STAGE + TELEMETRY */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
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
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw size={14} />
              <span>Đặt lại</span>
            </button>

            <button
              type="button"
              onClick={handleCaptureState1}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Đặt trạng thái hiện tại làm Trạng thái (1) để so sánh"
            >
              <BookmarkCheck size={14} />
              <span>Chốt trạng thái (1)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Coordinate system switcher */}
            <div className="flex items-center gap-1 bg-slate-200/75 p-0.5 rounded-lg text-[11px] font-bold">
              {[
                { id: 'pV' as const, label: 'p - V' },
                { id: 'pT' as const, label: 'p - T' },
                { id: 'VT' as const, label: 'V - T' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChartId(c.id)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                    chartId === c.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-xs">
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

        {/* Canvas Viewport */}
        <div className="relative w-full h-[430px] sm:h-[490px] bg-slate-50">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* 4-Column Tabular Telemetry Strip */}
        <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[11px] text-slate-500 block">Áp suất p</span>
            <span className="font-mono tabular-nums font-bold text-rose-700 mt-0.5 block">
              {gasCalc.actualP.toFixed(2)} atm ({gasCalc.pKpa.toFixed(1)} kPa)
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[11px] text-slate-500 block">Thể tích V & Mật độ μ</span>
            <span className="font-mono tabular-nums font-bold text-sky-700 mt-0.5 block">
              {gasCalc.actualV.toFixed(1)} L · {(gasCalc.densityM3 / 1e25).toFixed(2)}×10²⁵/m³
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[11px] text-slate-500 block">Nhiệt độ T & Động năng Wđ</span>
            <span className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 block">
              {Math.round(gasCalc.actualT)} K · {(gasCalc.meanKineticJ * 1e21).toFixed(2)}×10⁻²¹ J
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[11px] text-slate-500 block">Tốc độ v_rms & pV/T</span>
            <span className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5 block">
              {gasCalc.vrms.toFixed(0)} m/s · {gasCalc.pvOverT.toFixed(3)}
            </span>
          </div>
        </div>

        {/* First Law & State Comparison Bar */}
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600 font-semibold">Biến thiên nội năng ΔU:</span>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              {gasCalc.deltaU >= 0 ? '+' : ''}
              {gasCalc.deltaU.toFixed(0)} J
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600 font-semibold">Công khí thực hiện A':</span>
            <span className="font-mono tabular-nums font-bold text-sky-700">
              {gasCalc.hasExactWork
                ? `${gasCalc.workByGas >= 0 ? '+' : ''}${gasCalc.workByGas.toFixed(0)} J`
                : 'Tùy đường đi'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600 font-semibold">Nhiệt lượng Q (1→2):</span>
            <span className="font-mono tabular-nums font-bold text-rose-700">
              {gasCalc.hasExactWork
                ? `${gasCalc.heatQ >= 0 ? '+' : ''}${gasCalc.heatQ.toFixed(0)} J`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT ZONE: CONTROLS + FORMULAS */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <SlidersHorizontal size={16} className="text-sky-600" />
            <h2 className="text-sm font-extrabold text-slate-900">Tham Số & Đẳng Quá Trình</h2>
          </div>

          <div className="space-y-4 text-xs">
            {/* Process selector */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'isothermal' as const, label: 'Đẳng nhiệt (T)' },
                { id: 'isobaric' as const, label: 'Đẳng áp (p)' },
                { id: 'isochoric' as const, label: 'Đẳng tích (V)' },
                { id: 'general' as const, label: 'Tổng quát' },
              ].map((proc) => (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => handleSelectProcess(proc.id)}
                  className={`py-1.5 px-2 rounded-md font-bold text-[11px] cursor-pointer whitespace-nowrap ${
                    processId === proc.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {proc.label}
                </button>
              ))}
            </div>

            {/* Gas Species selector */}
            <div>
              <span className="font-semibold text-slate-700 block mb-1.5">Loại khí lý tưởng</span>
              <div className="grid grid-cols-4 gap-1.5">
                {GAS_SPECIES.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSpeciesId(sp.id)}
                    className={`py-1.5 rounded-lg border font-bold text-[11px] cursor-pointer ${
                      speciesId === sp.id
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sp.formula}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {species.name} · M = {(species.molarMassKg * 1000).toFixed(0)} g/mol
              </span>
            </div>

            <SliderControl
              label="Số mol khí n"
              valueDisplay={`${moles.toFixed(1)} mol`}
              min={0.5}
              max={2.0}
              step={0.1}
              value={moles}
              disabled={processId === 'isobaric'}
              onChange={setMoles}
            />

            <SliderControl
              label="Nhiệt độ tuyệt đối T"
              valueDisplay={`${Math.round(gasCalc.actualT)} K (${Math.round(gasCalc.actualT) - 273}°C)`}
              min={processId === 'isobaric' ? isobaricTLimits.tMin : MIN_TEMP_K}
              max={processId === 'isobaric' ? isobaricTLimits.tMax : MAX_TEMP_K}
              step={5}
              value={Math.round(gasCalc.actualT)}
              disabled={processId === 'isothermal'}
              onChange={setTempK}
            />

            <SliderControl
              label="Thể tích xi-lanh V"
              valueDisplay={`${gasCalc.actualV.toFixed(1)} lít`}
              min={MIN_VOL_L}
              max={MAX_VOL_L}
              step={0.5}
              value={gasCalc.actualV}
              disabled={processId === 'isobaric' || processId === 'isochoric'}
              onChange={setVolL}
            />

            <SliderControl
              label="Áp suất p"
              valueDisplay={`${gasCalc.actualP.toFixed(2)} atm (${gasCalc.pKpa.toFixed(0)} kPa)`}
              min={pressureLimits.pMin}
              max={pressureLimits.pMax}
              step={0.05}
              value={Number(gasCalc.actualP.toFixed(2))}
              onChange={handlePressureChange}
            />

            <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {processId === 'isothermal'
                ? 'Định luật Boyle (T = const): kéo thanh Thể tích V hoặc Áp suất p để thấy p và V tỉ lệ nghịch (p₁V₁ = p₂V₂).'
                : processId === 'isobaric'
                ? 'Định luật Charles (p = const): đặt mức áp suất p không đổi rồi kéo Nhiệt độ T để quan sát V tỉ lệ thuận với T.'
                : processId === 'isochoric'
                ? 'Quá trình đẳng tích (V = const): kéo Nhiệt độ T hoặc Áp suất p để kiểm chứng p tỉ lệ thuận với T (p₁/T₁ = p₂/T₂).'
                : 'Phương trình Clapeyron (pV = nRT): tự do thay đổi cả V, T, p và n để kiểm chứng phương trình trạng thái khí lý tưởng.'}
            </p>
          </div>
        </div>

        {/* Formula Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <h3 className="font-extrabold text-slate-900">Công Thức Trọng Tâm</h3>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto text-slate-800 space-y-2">
            <div
              dangerouslySetInnerHTML={{
                __html: renderLatex(
                  String.raw`pV = nRT,\quad \frac{p_1 V_1}{T_1} = \frac{p_2 V_2}{T_2}`,
                  false
                ),
              }}
            />
            <div
              dangerouslySetInnerHTML={{
                __html: renderLatex(
                  String.raw`p = \frac{1}{3}\mu m \overline{v^2} = \frac{2}{3}\mu \overline{E}_đ,\quad \overline{E}_đ = \frac{3}{2}k_B T`,
                  false
                ),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

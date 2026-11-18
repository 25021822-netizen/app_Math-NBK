import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { Play, Pause, RotateCcw, SlidersHorizontal, Zap } from 'lucide-react';

export type ElectromagnetismModuleId = 'cyclotron' | 'selfInduction' | 'transformer';

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

interface CyclotronParticle {
  id: 'proton' | 'deuteron' | 'alpha';
  label: string;
  qMul: number; // multiples of e
  mRel: number; // multiples of m_p
  color: string;
}

const CYCLOTRON_PARTICLES: CyclotronParticle[] = [
  { id: 'proton', label: 'Prôtôn (p⁺, q=+e, m=1u)', qMul: 1, mRel: 1.0, color: '#DC2626' },
  { id: 'deuteron', label: 'Đơtêri (d⁺, q=+e, m=2u)', qMul: 1, mRel: 2.0, color: '#0284C7' },
  { id: 'alpha', label: 'Hạt Alpha (α²⁺, q=+2e, m=4u)', qMul: 2, mRel: 4.0, color: '#D97706' },
];

const E_CHARGE = 1.602176634e-19;
const M_PROTON = 1.67262192e-27;

interface ElectromagnetismSimulationsProps {
  moduleId: ElectromagnetismModuleId;
}

export const ElectromagnetismSimulations: React.FC<ElectromagnetismSimulationsProps> = ({
  moduleId,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ===========================================================================
  // 1. MÁY GIA TỐC HẠT XYCLÔTRON (CYCLOTRON)
  // ===========================================================================
  const [cycParticleId, setCycParticleId] = useState<'proton' | 'deuteron' | 'alpha'>('proton');
  const [cycB, setCycB] = useState<number>(1.4); // T
  const [cycVoltageKv, setCycVoltageKv] = useState<number>(60); // kV
  const [cycRadiusCm, setCycRadiusCm] = useState<number>(50); // cm
  const [cycFreqSync, setCycFreqSync] = useState<boolean>(true);
  const [cycFreqRatio, setCycFreqRatio] = useState<number>(1.0); // f_AC / f_c
  const [cycBIntoPage, setCycBIntoPage] = useState<boolean>(true);

  const cycParticle = useMemo(
    () => CYCLOTRON_PARTICLES.find((p) => p.id === cycParticleId) || CYCLOTRON_PARTICLES[0],
    [cycParticleId]
  );

  const cycCalc = useMemo(() => {
    const q = cycParticle.qMul * E_CHARGE;
    const m = cycParticle.mRel * M_PROTON;
    const rMaxM = cycRadiusCm / 100;
    const fcHz = (q * cycB) / (2 * Math.PI * m);
    const eMaxJ = (q * q * cycB * cycB * rMaxM * rMaxM) / (2 * m);
    const eMaxMeV = eMaxJ / (1e6 * E_CHARGE);
    const vMaxMs = (q * cycB * rMaxM) / m;
    const activeRatio = cycFreqSync ? 1.0 : cycFreqRatio;
    return {
      q,
      m,
      rMaxM,
      fcMHz: fcHz / 1e6,
      fAcMHz: (fcHz * activeRatio) / 1e6,
      eMaxMeV,
      vMaxMs,
      activeRatio,
    };
  }, [cycParticle, cycB, cycRadiusCm, cycFreqSync, cycFreqRatio]);

  // Dimensionless internal simulation coordinates (radius normalized so Rmax = 1.0)
  const cycStateRef = useRef({
    x: 0,
    y: 0,
    vx: 0.16,
    vy: 0,
    phase: 0, // AC voltage phase (rad)
    crossings: 0,
    exited: false,
    exitTimer: 0,
    prevX: 0,
    trail: [{ x: 0, y: 0 }] as { x: number; y: number }[],
    t: 0,
  });

  const [cycReadout, setCycReadout] = useState({
    rCm: 0,
    energyMeV: 0,
    vScale7: 0,
    crossings: 0,
    exited: false,
    acSign: 1,
  });

  const resetCyclotron = () => {
    // Start right near center with small initial injection velocity
    cycStateRef.current = {
      x: -0.02,
      y: 0,
      vx: 0.14,
      vy: 0,
      phase: 0,
      crossings: 0,
      exited: false,
      exitTimer: 0,
      prevX: -0.02,
      trail: [{ x: -0.02, y: 0 }],
      t: 0,
    };
    setCycReadout({
      rCm: 0,
      energyMeV: 0,
      vScale7: 0,
      crossings: 0,
      exited: false,
      acSign: 1,
    });
  };

  useEffect(() => {
    resetCyclotron();
  }, [cycParticleId, cycB, cycVoltageKv, cycRadiusCm, cycFreqSync, cycFreqRatio, cycBIntoPage]);

  // ===========================================================================
  // 2. HIỆN TƯỢNG TỰ CẢM & ĐÓNG NGẮT MẠCH (SELF-INDUCTION)
  // ===========================================================================
  const [selfSwitchClosed, setSelfSwitchClosed] = useState<boolean>(true);
  const [selfEmfV, setSelfEmfV] = useState<number>(12); // V
  const [selfResOhm, setSelfResOhm] = useState<number>(8); // Ohm
  const [selfInductH, setSelfInductH] = useState<number>(1.2); // H
  const [selfIronCore, setSelfIronCore] = useState<boolean>(true);

  const effectiveL = selfIronCore ? selfInductH * 2.5 : selfInductH;
  const selfTau = effectiveL / selfResOhm;
  const selfSteadyI = selfEmfV / selfResOhm;

  const selfStateRef = useRef({
    t: 0,
    i1: 0, // nhánh đèn 1 + R
    i2: 0, // nhánh đèn 2 + L
    eSelf: 0, // suất điện động tự cảm (V)
    flashBoost: 0, // xung sáng khi ngắt K
    prevClosed: true,
    history: [] as { t: number; i1: number; i2: number; eSelf: number }[],
  });

  const [selfReadout, setSelfReadout] = useState({
    i1: 0,
    i2: 0,
    eSelf: 0,
    energyJ: 0,
  });

  const resetSelfInduction = (closed = true) => {
    setSelfSwitchClosed(closed);
    selfStateRef.current = {
      t: 0,
      i1: 0,
      i2: 0,
      eSelf: 0,
      flashBoost: 0,
      prevClosed: closed,
      history: [{ t: 0, i1: 0, i2: 0, eSelf: 0 }],
    };
    setSelfReadout({ i1: 0, i2: 0, eSelf: 0, energyJ: 0 });
  };

  // ===========================================================================
  // 3. MÁY BIẾN ÁP & TRUYỀN TẢI ĐIỆN NĂNG (TRANSFORMER)
  // ===========================================================================
  const [trMode, setTrMode] = useState<'transformer' | 'transmission'>('transformer');
  const [trN1, setTrN1] = useState<number>(400); // vòng
  const [trN2, setTrN2] = useState<number>(800); // vòng
  const [trU1, setTrU1] = useState<number>(110); // V
  const [trLoadOhm, setTrLoadOhm] = useState<number>(50); // Ohm
  // Transmission mode parameters
  const [trPowerKw, setTrPowerKw] = useState<number>(40); // kW
  const [trLineOhm, setTrLineOhm] = useState<number>(20); // Ohm
  const [trGenKv, setTrGenKv] = useState<number>(2); // kV

  const trCalc = useMemo(() => {
    const ratio = trN2 / trN1;
    const u2 = trU1 * ratio;
    const i2 = u2 / trLoadOhm;
    const i1 = i2 * ratio;
    const pLoad = u2 * i2;

    // Transmission
    const uTransKv = trGenKv * ratio;
    const pWatts = trPowerKw * 1000;
    const uTransV = uTransKv * 1000;
    const iLine = pWatts / uTransV;
    const deltaP = iLine * iLine * trLineOhm;
    const efficiency = Math.max(0, Math.min(100, ((pWatts - deltaP) / pWatts) * 100));
    const deltaU = iLine * trLineOhm;
    // Baseline without step-up (k = 1)
    const iNoStep = pWatts / (trGenKv * 1000);
    const deltaPNoStep = iNoStep * iNoStep * trLineOhm;
    return {
      ratio,
      u2,
      i2,
      i1,
      pLoad,
      uTransKv,
      iLine,
      deltaPKw: deltaP / 1000,
      efficiency,
      deltaU,
      deltaPNoStepKw: deltaPNoStep / 1000,
    };
  }, [trN1, trN2, trU1, trLoadOhm, trPowerKw, trLineOhm, trGenKv]);

  const trStateRef = useRef({ t: 0 });

  // ===========================================================================
  // MAIN ANIMATION LOOP
  // ===========================================================================
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let uiTimer = 0;

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, (now - lastTs) / 1000);
      lastTs = now;
      const dt = isRunning ? rawDt * timeScale : 0;

      // 1. CYCLOTRON PHYSICS
      if (moduleId === 'cyclotron' && canvasRef.current) {
        const st = cycStateRef.current;
        if (dt > 0) {
          if (st.exited) {
            st.exitTimer += dt;
            if (st.exitTimer > 1.4) {
              resetCyclotron();
            }
          } else {
            // Visual angular frequency scaled cleanly for smooth spiral observation
            const omegaCVisual = (3.4 * cycB * cycParticle.qMul) / cycParticle.mRel;
            const omegaACVisual = omegaCVisual * cycCalc.activeRatio;
            const bDir = cycBIntoPage ? 1 : -1;
            // Energy kick proportional to U0 / E_max so higher U0 -> wider spirals, higher B -> tighter spirals
            const kickRatio = (cycVoltageKv / 1000) / Math.max(0.3, cycCalc.eMaxMeV);
            const dvKick = Math.max(0.038, Math.min(0.20, 0.28 * Math.sqrt(kickRatio)));
            const scalePos = 0.92;

            const subSteps = 12;
            const subDt = dt / subSteps;
            for (let s = 0; s < subSteps; s++) {
              st.t += subDt;
              st.phase += omegaACVisual * subDt;

              // Uniform magnetic field B acts everywhere inside the chamber -> exact T_c = 2*pi*m / (|q|*B)
              const dTheta = bDir * omegaCVisual * subDt;
              const nvx = st.vx * Math.cos(dTheta) + st.vy * Math.sin(dTheta);
              const nvy = -st.vx * Math.sin(dTheta) + st.vy * Math.cos(dTheta);
              st.vx = nvx;
              st.vy = nvy;

              // Electric field across the central gap (x = 0) accelerates/decelerates on transit
              if ((st.prevX < 0 && st.x >= 0) || (st.prevX > 0 && st.x <= 0)) {
                st.crossings += 1;
                const eSign = Math.cos(st.phase);
                const dirVx = st.vx >= 0 ? 1 : -1;
                const vCur = Math.hypot(st.vx, st.vy);
                const gain = eSign * dirVx * dvKick;
                const newV = Math.max(0.08, vCur + gain);
                const scale = newV / Math.max(1e-6, vCur);
                st.vx *= scale;
                st.vy *= scale;
              }

              st.prevX = st.x;
              st.x += st.vx * subDt * omegaCVisual * scalePos;
              st.y += st.vy * subDt * omegaCVisual * scalePos;

              if (st.trail.length === 0 || Math.hypot(st.x - st.trail[st.trail.length - 1].x, st.y - st.trail[st.trail.length - 1].y) > 0.015) {
                st.trail.push({ x: st.x, y: st.y });
                if (st.trail.length > 750) st.trail.shift();
              }

              if (Math.hypot(st.x, st.y) >= 0.96) {
                st.exited = true;
                st.exitTimer = 0;
                break;
              }
            }
          }

          uiTimer += rawDt;
          if (uiTimer >= 0.07) {
            uiTimer = 0;
            const rNorm = Math.min(1, Math.hypot(st.x, st.y) / 0.96);
            const rCm = rNorm * cycRadiusCm;
            const energyMeV = cycCalc.eMaxMeV * rNorm * rNorm;
            const vScale7 = (cycCalc.vMaxMs * rNorm) / 1e7;
            setCycReadout({
              rCm,
              energyMeV,
              vScale7,
              crossings: st.crossings,
              exited: st.exited,
              acSign: Math.cos(st.phase) >= 0 ? 1 : -1,
            });
          }
        }
        drawCyclotronCanvas(canvasRef.current);
      }

      // 2. SELF-INDUCTION PHYSICS
      if (moduleId === 'selfInduction' && canvasRef.current) {
        const st = selfStateRef.current;
        if (dt > 0) {
          // Detect switch transition
          if (st.prevClosed !== selfSwitchClosed) {
            if (!selfSwitchClosed && st.i2 > 0.05) {
              // Opening switch K causes coil to discharge through loop (2*R) with huge spike e_tc = -L di/dt
              st.flashBoost = 1.0;
            }
            st.prevClosed = selfSwitchClosed;
          }

          const subSteps = 8;
          const subDt = dt / subSteps;
          for (let s = 0; s < subSteps; s++) {
            st.t += subDt;
            if (selfSwitchClosed) {
              // Branch 1 reaches steady E/R nearly instantaneously
              const targetI1 = selfEmfV / selfResOhm;
              st.i1 += (targetI1 - st.i1) * Math.min(1, subDt * 35);
              // Branch 2: L di2/dt + R i2 = E
              const di2dt = (selfEmfV - selfResOhm * st.i2) / Math.max(0.05, effectiveL);
              st.i2 = Math.max(0, st.i2 + di2dt * subDt);
              st.eSelf = -effectiveL * di2dt;
              st.flashBoost = Math.max(0, st.flashBoost - subDt * 2.5);
            } else {
              // Switch opened: current from L loops through both lamps in series (R_loop = 2.2 * R)
              const rLoop = selfResOhm * 2.4;
              const di2dt = -(rLoop * st.i2) / Math.max(0.05, effectiveL);
              st.i2 = Math.max(0, st.i2 + di2dt * subDt);
              st.i1 = st.i2; // circulates back through branch 1
              st.eSelf = -effectiveL * di2dt;
              st.flashBoost = Math.max(0, st.flashBoost - subDt * 1.4);
            }
          }

          st.history.push({ t: st.t, i1: st.i1, i2: st.i2, eSelf: st.eSelf });
          if (st.history.length > 220) st.history.shift();

          uiTimer += rawDt;
          if (uiTimer >= 0.07) {
            uiTimer = 0;
            setSelfReadout({
              i1: st.i1,
              i2: st.i2,
              eSelf: st.eSelf,
              energyJ: 0.5 * effectiveL * st.i2 * st.i2,
            });
          }
        }
        drawSelfInductionCanvas(canvasRef.current);
      }

      // 3. TRANSFORMER PHYSICS
      if (moduleId === 'transformer' && canvasRef.current) {
        const st = trStateRef.current;
        if (dt > 0) {
          st.t += dt;
        }
        drawTransformerCanvas(canvasRef.current);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  const setupCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  // ===========================================================================
  // DRAW: 1. CYCLOTRON
  // ===========================================================================
  const drawCyclotronCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const st = cycStateRef.current;
    const cx = w * 0.5;
    const cy = h * 0.52;
    const maxR = Math.min(w, h) * 0.38;
    const gapPx = 18;

    // Magnetic field markers inside vacuum chamber
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    for (let gx = cx - maxR; gx <= cx + maxR; gx += 38) {
      for (let gy = cy - maxR; gy <= cy + maxR; gy += 38) {
        if (Math.hypot(gx - cx, gy - cy) > maxR - 14) continue;
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, Math.PI * 2);
        ctx.stroke();
        if (cycBIntoPage) {
          ctx.beginPath();
          ctx.moveTo(gx - 3, gy - 3);
          ctx.lineTo(gx + 3, gy + 3);
          ctx.moveTo(gx + 3, gy - 3);
          ctx.lineTo(gx - 3, gy + 3);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const eVal = Math.cos(st.phase);
    const d1Hot = eVal > 0;

    // Left Dee (D1)
    ctx.save();
    ctx.fillStyle = d1Hot ? 'rgba(239, 68, 68, 0.14)' : 'rgba(56, 189, 248, 0.14)';
    ctx.strokeStyle = d1Hot ? '#F87171' : '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx - gapPx / 2, cy, maxR, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Dee (D2)
    ctx.fillStyle = !d1Hot ? 'rgba(239, 68, 68, 0.14)' : 'rgba(56, 189, 248, 0.14)';
    ctx.strokeStyle = !d1Hot ? '#F87171' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(cx + gapPx / 2, cy, maxR, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Electric field arrows across the gap
    const eStrength = Math.abs(eVal);
    if (eStrength > 0.15) {
      const eColor = eVal >= 0 ? '#FBBF24' : '#34D399';
      for (let yy = cy - maxR * 0.72; yy <= cy + maxR * 0.72; yy += 44) {
        const dir = eVal >= 0 ? 1 : -1;
        drawArrow(ctx, cx - dir * 10, yy, cx + dir * 10, yy, eColor);
      }
    }

    // Labels for D1 & D2
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '800 14px ui-sans-serif, sans-serif';
    ctx.fillText(`D₁ (${d1Hot ? '+' : '−'})`, cx - maxR * 0.65, cy - maxR * 0.72);
    ctx.fillText(`D₂ (${!d1Hot ? '+' : '−'})`, cx + maxR * 0.42, cy - maxR * 0.72);

    // Beam extraction deflector channel & target
    const exitAng = 0.25;
    const ex1 = cx + (maxR - 4) * Math.cos(exitAng);
    const ey1 = cy + (maxR - 4) * Math.sin(exitAng);
    const ex2 = cx + (maxR + 68) * Math.cos(exitAng + 0.1);
    const ey2 = cy + (maxR + 68) * Math.sin(exitAng + 0.1);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex1, ey1 - 7);
    ctx.lineTo(ex2, ey2 - 7);
    ctx.moveTo(ex1, ey1 + 7);
    ctx.lineTo(ex2, ey2 + 7);
    ctx.stroke();

    // Target block
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(ex2, ey2 - 14, 14, 28);
    ctx.fillStyle = '#FCD34D';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText('Bia', ex2 - 2, ey2 - 19);

    // AC Source symbol at bottom
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - gapPx / 2 - 16, cy + maxR);
    ctx.lineTo(cx - gapPx / 2 - 16, cy + maxR + 22);
    ctx.lineTo(cx - 18, cy + maxR + 22);
    ctx.moveTo(cx + gapPx / 2 + 16, cy + maxR);
    ctx.lineTo(cx + gapPx / 2 + 16, cy + maxR + 22);
    ctx.lineTo(cx + 18, cy + maxR + 22);
    ctx.stroke();
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(cx, cy + maxR + 22, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FDE68A';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillText('~U₀', cx - 11, cy + maxR + 26);

    // Ion source at center
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Spiral trajectory trail
    if (st.trail.length > 1) {
      ctx.strokeStyle = cycParticle.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      st.trail.forEach((pt, idx) => {
        const px = cx + pt.x * maxR;
        const py = cy + pt.y * maxR;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Current particle
    const ppx = cx + st.x * maxR;
    const ppy = cy + st.y * maxR;
    const vNorm = Math.hypot(st.vx, st.vy) || 1;
    drawArrow(ctx, ppx, ppy, ppx + (st.vx / vNorm) * 28, ppy + (st.vy / vNorm) * 28, '#34D399', 'v');

    ctx.fillStyle = cycParticle.color;
    ctx.beginPath();
    ctx.arc(ppx, ppy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top telemetry overlay inside stage
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(
      `B = ${cycB.toFixed(2)} T (${cycBIntoPage ? '⊗ hướng vào' : '⊙ hướng ra'}) · U₀ = ${cycVoltageKv} kV · f_AC = ${cycCalc.fAcMHz.toFixed(2)} MHz`,
      16,
      24
    );

    if (!cycFreqSync && Math.abs(cycFreqRatio - 1) > 0.03) {
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText(
        `⚠ Lệch pha cộng hưởng (f_AC / f_c = ${cycFreqRatio.toFixed(2)}): hạt bị hãm khi lệch pha!`,
        16,
        44
      );
    } else if (st.exited) {
      ctx.fillStyle = '#86EFAC';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(
        `✓ Chùm hạt đạt năng lượng thoát cực đại E_max = ${cycCalc.eMaxMeV.toFixed(2)} MeV!`,
        16,
        44
      );
    }
  };

  // ===========================================================================
  // DRAW: 2. SELF-INDUCTION
  // ===========================================================================
  const drawSelfInductionCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const st = selfStateRef.current;
    const stageH = Math.floor(h * 0.62);
    const graphH = h - stageH;

    // Circuit geometry
    const leftX = w * 0.16;
    const rightX = w * 0.84;
    const topY = stageH * 0.22;
    const midY = stageH * 0.52;
    const botY = stageH * 0.84;

    // Main rails
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    // Top branch (Branch 1: Lamp 1 + R)
    ctx.moveTo(leftX, midY);
    ctx.lineTo(leftX, topY);
    ctx.lineTo(rightX, topY);
    ctx.lineTo(rightX, midY);
    // Middle branch (Branch 2: Lamp 2 + L)
    ctx.moveTo(leftX, midY);
    ctx.lineTo(rightX, midY);
    // Bottom branch (Battery + Switch K)
    ctx.moveTo(leftX, midY);
    ctx.lineTo(leftX, botY);
    ctx.lineTo(w * 0.58, botY);
    ctx.moveTo(w * 0.68, botY);
    ctx.lineTo(rightX, botY);
    ctx.lineTo(rightX, midY);
    ctx.stroke();

    // Branch 1 Resistor box
    const rx = w * 0.34;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.fillRect(rx - 28, topY - 12, 56, 24);
    ctx.strokeRect(rx - 28, topY - 12, 56, 24);
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(`R=${selfResOhm}Ω`, rx - 21, topY + 4);

    // Branch 1 Lamp Đ1
    const l1x = w * 0.66;
    const bright1 = Math.min(1.5, st.i1 / Math.max(0.2, selfSteadyI));
    drawLamp(ctx, l1x, topY, bright1, 'Đ₁');

    // Branch 2 Inductor L (coil loops + optional iron core)
    const lxStart = w * 0.28;
    const lxWidth = 104;
    if (selfIronCore) {
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(lxStart + 4, midY - 22, lxWidth - 8, 8);
    }
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    const coils = 6;
    const coilStep = lxWidth / coils;
    for (let i = 0; i < coils; i++) {
      ctx.arc(lxStart + i * coilStep + coilStep / 2, midY, coilStep / 2, Math.PI, 0, false);
    }
    ctx.stroke();
    ctx.fillStyle = '#92400E';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(`L=${effectiveL.toFixed(1)}H${selfIronCore ? ' (Lõi Fe)' : ''}`, lxStart - 4, midY + 26);

    // Branch 2 Lamp Đ2
    const bright2 = Math.min(1.6, st.i2 / Math.max(0.2, selfSteadyI) + st.flashBoost * 0.7);
    drawLamp(ctx, l1x, midY, bright2, 'Đ₂');

    // Bottom Battery E
    const bx = w * 0.38;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(bx - 12, botY - 16, 24, 32);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 6, botY - 16);
    ctx.lineTo(bx - 6, botY + 16);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx + 6, botY - 9);
    ctx.lineTo(bx + 6, botY + 9);
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(`E = ${selfEmfV}V`, bx - 22, botY + 28);

    // Switch K
    const kx1 = w * 0.58;
    const kx2 = w * 0.68;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(kx1, botY, 4, 0, Math.PI * 2);
    ctx.arc(kx2, botY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = selfSwitchClosed ? '#059669' : '#DC2626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(kx1, botY);
    if (selfSwitchClosed) {
      ctx.lineTo(kx2, botY);
    } else {
      ctx.lineTo(kx2 - 6, botY - 22);
    }
    ctx.stroke();
    ctx.fillStyle = selfSwitchClosed ? '#059669' : '#DC2626';
    ctx.font = '800 12px ui-sans-serif, sans-serif';
    ctx.fillText(selfSwitchClosed ? 'Khóa K: ĐÓNG' : 'Khóa K: NGẮT', kx1 - 12, botY + 26);

    // Current arrows
    if (st.i1 > 0.05) {
      drawArrow(ctx, w * 0.48, topY - 18, w * 0.55, topY - 18, '#0284C7', selfSwitchClosed ? 'i₁' : 'i_xả');
    }
    if (st.i2 > 0.05) {
      drawArrow(ctx, w * 0.48, midY - 18, w * 0.55, midY - 18, '#D97706', 'i₂');
    }
    if (!selfSwitchClosed && st.i2 > 0.05) {
      ctx.fillStyle = '#DC2626';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText('⚡ Suất điện động tự cảm phóng ngược duy trì dòng qua hai đèn!', leftX, 24);
    } else if (selfSwitchClosed && Math.abs(st.eSelf) > 0.4) {
      ctx.fillStyle = '#B45309';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText('Cuộn cảm L sinh suất điện động tự cảm cản trở dòng i₂ tăng → Đ₂ sáng chậm hơn Đ₁', leftX, 24);
    }

    // Bottom graph: i1(t) & i2(t)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, stageH, w, graphH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, stageH);
    ctx.lineTo(w, stageH);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '600 11px ui-sans-serif, sans-serif';
    ctx.fillText('Đồ thị dòng điện i₁(t) [xanh dương] và i₂(t) qua cuộn cảm [cam]', 16, stageH + 18);

    const hist = st.history;
    if (hist.length > 1) {
      const gx = 28;
      const gy = stageH + 28;
      const gw = w - 52;
      const gh = graphH - 40;
      const maxI = Math.max(1.0, selfSteadyI * 1.15);

      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(gx, gy + gh);
      ctx.lineTo(gx + gw, gy + gh);
      ctx.stroke();

      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const px = gx + (idx / Math.max(1, hist.length - 1)) * gw;
        const py = gy + gh - Math.min(1, pt.i1 / maxI) * gh;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const px = gx + (idx / Math.max(1, hist.length - 1)) * gw;
        const py = gy + gh - Math.min(1, pt.i2 / maxI) * gh;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  };

  function drawLamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    brightness: number,
    label: string
  ) {
    const b = Math.max(0, Math.min(1.5, brightness));
    if (b > 0.05) {
      const glowR = 16 + b * 22;
      const grad = ctx.createRadialGradient(x, y, 4, x, y, glowR);
      grad.addColorStop(0, `rgba(250, 204, 21, ${Math.min(0.85, b * 0.65)})`);
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = b > 0.15 ? `rgba(254, 240, 138, ${0.4 + Math.min(0.6, b * 0.5)})` : '#FFFFFF';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cross inside bulb
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 10);
    ctx.lineTo(x + 10, y + 10);
    ctx.moveTo(x + 10, y - 10);
    ctx.lineTo(x - 10, y + 10);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 11px ui-sans-serif, sans-serif';
    ctx.fillText(label, x - 8, y + 30);
  }

  // ===========================================================================
  // DRAW: 3. TRANSFORMER & POWER TRANSMISSION
  // ===========================================================================
  const drawTransformerCanvas = (canvas: HTMLCanvasElement) => {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const st = trStateRef.current;
    const fluxSin = Math.sin(st.t * 4.2);

    if (trMode === 'transformer') {
      const stageH = Math.floor(h * 0.64);
      const graphH = h - stageH;
      const cx = w * 0.5;
      const cy = stageH * 0.5;

      // Iron core frame (laminated steel)
      const coreW = 190;
      const coreH = 148;
      ctx.fillStyle = '#94A3B8';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - coreW / 2, cy - coreH / 2, coreW, coreH);
      ctx.strokeRect(cx - coreW / 2, cy - coreH / 2, coreW, coreH);

      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(cx - coreW / 2 + 34, cy - coreH / 2 + 30, coreW - 68, coreH - 60);
      ctx.strokeRect(cx - coreW / 2 + 34, cy - coreH / 2 + 30, coreW - 68, coreH - 60);

      // Magnetic flux loop pulsing inside iron core
      ctx.save();
      ctx.strokeStyle = fluxSin >= 0 ? '#0284C7' : '#DC2626';
      ctx.lineWidth = 1.5 + Math.abs(fluxSin) * 1.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -st.t * 45 * (fluxSin >= 0 ? 1 : -1);
      ctx.strokeRect(cx - coreW / 2 + 17, cy - coreH / 2 + 15, coreW - 34, coreH - 30);
      ctx.restore();

      // Primary coil windings (left limb)
      const n1Vis = Math.max(4, Math.min(12, Math.round(trN1 / 90)));
      const pX = cx - coreW / 2 + 17;
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 3;
      for (let i = 0; i < n1Vis; i++) {
        const yy = cy - 40 + (i * 80) / Math.max(1, n1Vis - 1);
        ctx.beginPath();
        ctx.moveTo(pX - 20, yy - 3);
        ctx.lineTo(pX + 20, yy + 3);
        ctx.stroke();
      }
      // Primary circuit leads & AC source
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pX - 20, cy - 43);
      ctx.lineTo(cx - 190, cy - 43);
      ctx.lineTo(cx - 190, cy + 43);
      ctx.lineTo(pX - 20, cy + 43);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx - 190, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText('~U₁', cx - 201, cy + 4);
      ctx.fillText(`N₁ = ${trN1}`, cx - 122, cy - coreH / 2 - 10);

      // Secondary coil windings (right limb)
      const n2Vis = Math.max(4, Math.min(16, Math.round(trN2 / 110)));
      const sX = cx + coreW / 2 - 17;
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 3;
      for (let i = 0; i < n2Vis; i++) {
        const yy = cy - 40 + (i * 80) / Math.max(1, n2Vis - 1);
        ctx.beginPath();
        ctx.moveTo(sX - 20, yy - 3);
        ctx.lineTo(sX + 20, yy + 3);
        ctx.stroke();
      }
      // Secondary load R
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sX + 20, cy - 43);
      ctx.lineTo(cx + 190, cy - 43);
      ctx.lineTo(cx + 190, cy + 43);
      ctx.lineTo(sX + 20, cy + 43);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx + 176, cy - 22, 28, 44);
      ctx.strokeRect(cx + 176, cy - 22, 28, 44);
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText(`R`, cx + 186, cy + 4);
      ctx.fillText(`N₂ = ${trN2}`, cx + 70, cy - coreH / 2 - 10);

      // Role tag
      ctx.fillStyle = trN2 > trN1 ? '#059669' : trN2 < trN1 ? '#D97706' : '#475569';
      ctx.font = '800 12px ui-sans-serif, sans-serif';
      const roleLabel =
        trN2 > trN1 ? 'MÁY TĂNG ÁP (U₂ > U₁)' : trN2 < trN1 ? 'MÁY HẠ ÁP (U₂ < U₁)' : 'TỈ SỐ 1:1 (U₂ = U₁)';
      ctx.fillText(roleLabel, cx - 72, 24);

      // Bottom AC waveform graph u1(t) & u2(t)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, stageH, w, graphH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(0, stageH);
      ctx.lineTo(w, stageH);
      ctx.stroke();

      const midG = stageH + graphH * 0.58;
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(24, midG);
      ctx.lineTo(w - 24, midG);
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.font = '600 11px ui-sans-serif, sans-serif';
      ctx.fillText('Đồ thị điện áp xoay chiều u₁(t) [cam] và u₂(t) [xanh dương]', 16, stageH + 18);

      const maxU = Math.max(trU1, trCalc.u2, 50);
      const amp = graphH * 0.32;
      const plotW = w - 48;

      // u1
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120;
        const px = 24 + u * plotW;
        const py = midG - (trU1 / maxU) * amp * Math.sin(u * Math.PI * 6 - st.t * 4.2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // u2
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120;
        const px = 24 + u * plotW;
        const py = midG - (trCalc.u2 / maxU) * amp * Math.sin(u * Math.PI * 6 - st.t * 4.2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      // TRANSMISSION MODE
      const cy = h * 0.44;
      const xGen = w * 0.12;
      const xStepUp = w * 0.30;
      const xStepDown = w * 0.72;
      const xHome = w * 0.88;

      // Power plant
      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.fillRect(xGen - 34, cy - 30, 68, 60);
      ctx.strokeRect(xGen - 34, cy - 30, 68, 60);
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('Nhà máy', xGen - 23, cy - 4);
      ctx.fillText(`${trPowerKw} kW`, xGen - 18, cy + 14);

      // Step-up transformer
      ctx.fillStyle = '#DBEAFE';
      ctx.strokeStyle = '#0284C7';
      ctx.fillRect(xStepUp - 28, cy - 28, 56, 56);
      ctx.strokeRect(xStepUp - 28, cy - 28, 56, 56);
      ctx.fillStyle = '#0369A1';
      ctx.fillText(`Tăng áp`, xStepUp - 22, cy - 4);
      ctx.fillText(`×${trCalc.ratio.toFixed(1)}`, xStepUp - 14, cy + 14);

      // Step-down / substation
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#D97706';
      ctx.fillRect(xStepDown - 28, cy - 28, 56, 56);
      ctx.strokeRect(xStepDown - 28, cy - 28, 56, 56);
      ctx.fillStyle = '#B45309';
      ctx.fillText(`Hạ áp`, xStepDown - 16, cy - 4);
      ctx.fillText(`220 V`, xStepDown - 15, cy + 14);

      // Consumer Lamp / House
      const effNorm = trCalc.efficiency / 100;
      drawLamp(ctx, xHome, cy, effNorm * 1.2, 'Hộ tiêu thụ');

      // Connecting lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(xGen + 34, cy);
      ctx.lineTo(xStepUp - 28, cy);
      ctx.moveTo(xStepDown + 28, cy);
      ctx.lineTo(xHome - 16, cy);
      ctx.stroke();

      // Long transmission line (glows red if high loss!)
      const lossRatio = Math.min(1, trCalc.deltaPKw / Math.max(1, trPowerKw));
      ctx.strokeStyle = lossRatio > 0.35 ? '#DC2626' : lossRatio > 0.12 ? '#D97706' : '#059669';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(xStepUp + 28, cy - 10);
      ctx.lineTo(xStepDown - 28, cy - 10);
      ctx.moveTo(xStepUp + 28, cy + 10);
      ctx.lineTo(xStepDown - 28, cy + 10);
      ctx.stroke();

      // Animated current pulses on transmission line
      for (let k = 0; k < 5; k++) {
        const px = xStepUp + 32 + (((st.t * 80 + k * 65) % (xStepDown - xStepUp - 64)));
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(px, cy - 10, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText(
        `U truyền tải = ${trCalc.uTransKv.toFixed(1)} kV · R dây = ${trLineOhm} Ω`,
        (xStepUp + xStepDown) / 2 - 105,
        cy - 26
      );
      ctx.fillStyle = lossRatio > 0.25 ? '#DC2626' : '#059669';
      ctx.fillText(
        `Hao phí tỏa nhiệt ΔP = ${trCalc.deltaPKw.toFixed(2)} kW (Hiệu suất H = ${trCalc.efficiency.toFixed(1)}%)`,
        (xStepUp + xStepDown) / 2 - 140,
        cy + 36
      );

      // Bottom comparison bar: With vs Without Step-up
      const barY = h * 0.72;
      const barW = w - 120;
      ctx.fillStyle = '#334155';
      ctx.font = '700 12px ui-sans-serif, sans-serif';
      ctx.fillText('So sánh công suất hao phí ΔP:', 24, barY - 12);

      // Without step-up
      const wNo = Math.min(barW, (trCalc.deltaPNoStepKw / Math.max(1, trPowerKw)) * barW);
      ctx.fillStyle = '#FECACA';
      ctx.fillRect(24, barY, barW, 18);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(24, barY, wNo, 18);
      ctx.fillStyle = '#0F172A';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillText(`Không tăng áp (${trGenKv} kV): ΔP = ${trCalc.deltaPNoStepKw.toFixed(2)} kW`, 24, barY + 32);

      // With step-up
      const wYes = Math.min(barW, (trCalc.deltaPKw / Math.max(1, trPowerKw)) * barW);
      ctx.fillStyle = '#D1FAE5';
      ctx.fillRect(24, barY + 46, barW, 18);
      ctx.fillStyle = '#059669';
      ctx.fillRect(24, barY + 46, wYes, 18);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`Sau tăng áp (${trCalc.uTransKv.toFixed(1)} kV): ΔP = ${trCalc.deltaPKw.toFixed(2)} kW`, 24, barY + 78);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Canvas Stage + Telemetry */}
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
                if (moduleId === 'cyclotron') resetCyclotron();
                else if (moduleId === 'selfInduction') resetSelfInduction(true);
                else trStateRef.current.t = 0;
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Đặt lại</span>
            </button>

            {moduleId === 'selfInduction' && (
              <button
                type="button"
                onClick={() => setSelfSwitchClosed((v) => !v)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  selfSwitchClosed
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <Zap size={14} />
                <span>{selfSwitchClosed ? 'Ngắt Khóa K' : 'Đóng Khóa K'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
            {[0.5, 1, 1.5].map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setTimeScale(sp)}
                className={`px-2 py-1 rounded-md font-mono font-bold cursor-pointer ${
                  timeScale === sp ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full h-[420px] sm:h-[470px]">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* Telemetry strip */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {moduleId === 'cyclotron' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Tần số cộng hưởng fc</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {cycCalc.fcMHz.toFixed(2)} MHz
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Động năng Ek / Emax</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {cycReadout.energyMeV.toFixed(2)} / {cycCalc.eMaxMeV.toFixed(2)} MeV
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Bán kính quỹ đạo r</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {cycReadout.rCm.toFixed(1)} cm
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Lần qua khe / Vận tốc</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {cycReadout.crossings} lần · {cycReadout.vScale7.toFixed(2)}×10⁷ m/s
                </div>
              </div>
            </>
          )}

          {moduleId === 'selfInduction' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Dòng nhánh R (i₁)</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {selfReadout.i1.toFixed(2)} A
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Dòng cuộn cảm L (i₂)</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {selfReadout.i2.toFixed(2)} A
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Suất điện động tự cảm</div>
                <div className="font-mono tabular-nums font-bold text-rose-700 mt-0.5">
                  {selfReadout.eSelf.toFixed(2)} V
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Năng lượng từ trường W</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {selfReadout.energyJ.toFixed(2)} J (τ = {selfTau.toFixed(2)}s)
                </div>
              </div>
            </>
          )}

          {moduleId === 'transformer' && trMode === 'transformer' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Điện áp thứ cấp U₂</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {trCalc.u2.toFixed(1)} V
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Dòng sơ cấp I₁</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {trCalc.i1.toFixed(2)} A
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Dòng thứ cấp I₂</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {trCalc.i2.toFixed(2)} A
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Công suất tải P₂</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {trCalc.pLoad.toFixed(1)} W
                </div>
              </div>
            </>
          )}

          {moduleId === 'transformer' && trMode === 'transmission' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Điện áp truyền tải</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {trCalc.uTransKv.toFixed(1)} kV (×{trCalc.ratio.toFixed(1)})
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Dòng trên dây I</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {trCalc.iLine.toFixed(2)} A
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Hao phí đường dây ΔP</div>
                <div className="font-mono tabular-nums font-bold text-rose-700 mt-0.5">
                  {trCalc.deltaPKw.toFixed(2)} kW
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500 font-medium">Hiệu suất truyền tải H</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {trCalc.efficiency.toFixed(1)} %
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Controls + Formula */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm">
            <SlidersHorizontal size={16} className="text-sky-600" />
            <span>Thông Số Thí Nghiệm</span>
          </div>

          {moduleId === 'cyclotron' && (
            <>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Loại hạt cần gia tốc</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {CYCLOTRON_PARTICLES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setCycParticleId(p.id)}
                      className={`px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                        cycParticleId === p.id
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
                valueDisplay={`${cycB.toFixed(2)} T`}
                min={0.5}
                max={2.5}
                step={0.05}
                value={cycB}
                onChange={setCycB}
              />
              <SliderControl
                label="Hiệu điện thế khe U₀"
                valueDisplay={`${cycVoltageKv} kV`}
                min={20}
                max={120}
                step={5}
                value={cycVoltageKv}
                onChange={setCycVoltageKv}
              />
              <SliderControl
                label="Bán kính hộp chữ D (Rmax)"
                valueDisplay={`${cycRadiusCm} cm`}
                min={30}
                max={80}
                step={5}
                value={cycRadiusCm}
                onChange={setCycRadiusCm}
              />

              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={cycFreqSync}
                  onChange={(e) => setCycFreqSync(e.target.checked)}
                  className="rounded accent-sky-600"
                />
                <span className="font-semibold text-slate-700">Đồng bộ tần số cộng hưởng (f_AC = fc)</span>
              </label>

              {!cycFreqSync && (
                <SliderControl
                  label="Tỉ số tần số (f_AC / fc)"
                  valueDisplay={`${cycFreqRatio.toFixed(2)}×`}
                  min={0.75}
                  max={1.25}
                  step={0.01}
                  value={cycFreqRatio}
                  onChange={setCycFreqRatio}
                />
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cycBIntoPage}
                  onChange={(e) => setCycBIntoPage(e.target.checked)}
                  className="rounded accent-sky-600"
                />
                <span className="font-semibold text-slate-700">Từ trường B hướng vào mặt phẳng (⊗)</span>
              </label>
            </>
          )}

          {moduleId === 'selfInduction' && (
            <>
              <SliderControl
                label="Suất điện động nguồn E"
                valueDisplay={`${selfEmfV} V`}
                min={6}
                max={24}
                step={1}
                value={selfEmfV}
                onChange={setSelfEmfV}
              />
              <SliderControl
                label="Điện trở mạch R"
                valueDisplay={`${selfResOhm} Ω`}
                min={4}
                max={20}
                step={1}
                value={selfResOhm}
                onChange={setSelfResOhm}
              />
              <SliderControl
                label="Độ tự cảm cuộn dây L₀"
                valueDisplay={`${selfInductH.toFixed(1)} H`}
                min={0.2}
                max={2.4}
                step={0.1}
                value={selfInductH}
                onChange={setSelfInductH}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={selfIronCore}
                  onChange={(e) => setSelfIronCore(e.target.checked)}
                  className="rounded accent-sky-600"
                />
                <span className="font-semibold text-slate-700">Đưa lõi sắt non vào ống dây (L = 2,5 L₀)</span>
              </label>
            </>
          )}

          {moduleId === 'transformer' && (
            <>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTrMode('transformer')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    trMode === 'transformer' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Máy biến áp
                </button>
                <button
                  type="button"
                  onClick={() => setTrMode('transmission')}
                  className={`py-1.5 rounded-md font-bold cursor-pointer ${
                    trMode === 'transmission' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Truyền tải điện
                </button>
              </div>

              <SliderControl
                label="Số vòng sơ cấp N₁"
                valueDisplay={`${trN1} vòng`}
                min={100}
                max={1000}
                step={50}
                value={trN1}
                onChange={setTrN1}
              />
              <SliderControl
                label="Số vòng thứ cấp N₂"
                valueDisplay={`${trN2} vòng`}
                min={100}
                max={2000}
                step={50}
                value={trN2}
                onChange={setTrN2}
              />

              {trMode === 'transformer' ? (
                <>
                  <SliderControl
                    label="Điện áp sơ cấp U₁"
                    valueDisplay={`${trU1} V`}
                    min={20}
                    max={220}
                    step={10}
                    value={trU1}
                    onChange={setTrU1}
                  />
                  <SliderControl
                    label="Điện trở tải R"
                    valueDisplay={`${trLoadOhm} Ω`}
                    min={10}
                    max={120}
                    step={5}
                    value={trLoadOhm}
                    onChange={setTrLoadOhm}
                  />
                </>
              ) : (
                <>
                  <SliderControl
                    label="Công suất phát P"
                    valueDisplay={`${trPowerKw} kW`}
                    min={10}
                    max={100}
                    step={5}
                    value={trPowerKw}
                    onChange={setTrPowerKw}
                  />
                  <SliderControl
                    label="Điện áp đầu phát"
                    valueDisplay={`${trGenKv} kV`}
                    min={1}
                    max={10}
                    step={0.5}
                    value={trGenKv}
                    onChange={setTrGenKv}
                  />
                  <SliderControl
                    label="Điện trở đường dây R_d"
                    valueDisplay={`${trLineOhm} Ω`}
                    min={5}
                    max={50}
                    step={5}
                    value={trLineOhm}
                    onChange={setTrLineOhm}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Formula card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <h3 className="font-extrabold text-slate-900">Công Thức Trọng Tâm</h3>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto text-slate-800 space-y-2">
            {moduleId === 'cyclotron' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`f_c = \frac{|q|B}{2\pi m},\quad r = \frac{mv}{|q|B},\quad E_{\max} = \frac{q^2 B^2 R_{\max}^2}{2m}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'selfInduction' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    String.raw`e_{tc} = -L\frac{\Delta i}{\Delta t},\quad W = \frac{1}{2}Li^2,\quad \tau = \frac{L}{R}`,
                    false
                  ),
                }}
              />
            )}
            {moduleId === 'transformer' && (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderLatex(
                    trMode === 'transformer'
                      ? String.raw`\frac{U_1}{U_2} = \frac{N_1}{N_2} = \frac{I_2}{I_1}`
                      : String.raw`\Delta P = \frac{P^2 R_d}{U^2\cos^2\varphi},\quad H = 1 - \frac{\Delta P}{P}`,
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

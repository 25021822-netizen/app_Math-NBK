import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Factory,
  Zap,
} from 'lucide-react';

export type IndustrialModuleId = 'aluminum_prod' | 'industrial_prod';
type IndustrialProcessId = 'h2so4' | 'nh3' | 'naoh_cl2' | 'iron';

interface ChemSliderProps {
  label: string;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (val: number) => void;
}

const ChemSlider: React.FC<ChemSliderProps> = ({
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
      <span className="font-mono tabular-nums font-bold text-emerald-700">{valueDisplay}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-emerald-600 cursor-pointer"
    />
  </div>
);

interface IndustrialChemistrySimulationsProps {
  moduleId: IndustrialModuleId;
}

export const IndustrialChemistrySimulations: React.FC<IndustrialChemistrySimulationsProps> = ({
  moduleId,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ===========================================================================
  // 1. MÔ HÌNH SẢN XUẤT NHÔM (HALL–HÉROULT: ĐIỆN PHÂN NÓNG CHẢY Al2O3)
  // ===========================================================================
  const [alCurrentKA, setAlCurrentKA] = useState<number>(150); // 50..300 kA
  const [alEfficiencyPct, setAlEfficiencyPct] = useState<number>(92); // 80..98%
  const [alUseCryolite, setAlUseCryolite] = useState<boolean>(true);
  const [alHours, setAlHours] = useState<number>(0); // 0..24 h simulated
  const alStateRef = useRef({ t: 0, hours: 0 });

  const alCalc = useMemo(() => {
    const F = 96500;
    const IAmps = alCurrentKA * 1000;
    const tSec = alHours * 3600;
    const eff = alUseCryolite ? alEfficiencyPct / 100 : 0;
    // m(Al) = (27 * I * t * eff) / (3 * F) in grams -> kg
    const massAlKg = ((27 * IAmps * tSec * eff) / (3 * F)) / 1000;
    // 2Al2O3 -> 4Al + 3O2 => 102g Al2O3 gives 54g Al
    const massAl2O3Kg = massAlKg * (102 / 54);
    // O2 produced: n(O2) = 0.75 * n(Al); graphite anode burns C + O2 -> CO2 (~0.45 kg C / kg Al practical)
    const massCarbonBurnedKg = massAlKg * 0.44;
    const meltTempC = alUseCryolite ? 950 : 2050;
    const anodeWearFrac = Math.min(0.68, alHours / 28);
    const alPoolFrac = Math.min(1, alHours / 24);
    return { massAlKg, massAl2O3Kg, massCarbonBurnedKg, meltTempC, anodeWearFrac, alPoolFrac };
  }, [alCurrentKA, alEfficiencyPct, alUseCryolite, alHours]);

  // ===========================================================================
  // 2. MÔ HÌNH SẢN XUẤT CÁC CHẤT CÔNG NGHIỆP (H2SO4, NH3, XÚT-CLO, GANG)
  // ===========================================================================
  const [processId, setProcessId] = useState<IndustrialProcessId>('h2so4');

  // H2SO4 Contact process state
  const [h2so4TempC, setH2so4TempC] = useState<number>(450);
  const [h2so4UseAcidAbsorb, setH2so4UseAcidAbsorb] = useState<boolean>(true);

  // NH3 Haber-Bosch state
  const [nh3TempC, setNh3TempC] = useState<number>(450);
  const [nh3PressureBar, setNh3PressureBar] = useState<number>(200);
  const [nh3CatalystFe, setNh3CatalystFe] = useState<boolean>(true);

  // NaOH - Cl2 Chlor-alkali state
  const [chlorMembrane, setChlorMembrane] = useState<boolean>(true);
  const [chlorCurrentKA, setChlorCurrentKA] = useState<number>(12);
  const [chlorHours, setChlorHours] = useState<number>(0);

  // Iron Blast Furnace state
  const [ironBlastHotAirC, setIronBlastHotAirC] = useState<number>(1100);
  const [ironOreInputKg, setIronOreInputKg] = useState<number>(1600);

  const indStateRef = useRef({ t: 0, chlorHours: 0 });

  const processCalc = useMemo(() => {
    if (processId === 'h2so4') {
      // Optimum near 450°C with V2O5; too low = slow, too high = exothermic reverse shift
      const kineticFactor = Math.min(1, Math.exp((h2so4TempC - 430) / 80));
      const eqFactor = Math.max(0.45, Math.min(0.99, 1.0 - Math.max(0, h2so4TempC - 420) * 0.0014));
      const so2ToSo3Pct = Math.round(98 * kineticFactor * eqFactor);
      const finalYieldPct = h2so4UseAcidAbsorb ? so2ToSo3Pct : Math.round(so2ToSo3Pct * 0.58);
      return {
        so2ToSo3Pct,
        finalYieldPct,
        absorbNote: h2so4UseAcidAbsorb
          ? 'Hấp thụ SO₃ bằng H₂SO₄ 98% tạo Oleum H₂SO₄·nSO₃'
          : 'Cảnh báo: Dùng H₂O trực tiếp tạo mù acid mịt, hiệu suất thấp!',
      };
    }
    if (processId === 'nh3') {
      // Haber-Bosch: exothermic -> higher P increases yield, lower T increases equilibrium yield but slows rate
      const eqYield = Math.min(
        48,
        Math.max(8, (nh3PressureBar / 200) * 28 * Math.exp(-(nh3TempC - 450) / 260))
      );
      const speedFactor = nh3CatalystFe ? 1.0 : 0.18;
      const singlePassPct = eqYield * speedFactor;
      return {
        singlePassPct,
        recycleTotalPct: nh3CatalystFe ? Math.min(98, 72 + singlePassPct * 0.65) : singlePassPct * 1.4,
      };
    }
    if (processId === 'naoh_cl2') {
      const F = 96500;
      const nMolE = (chlorCurrentKA * 1000 * chlorHours * 3600) / F;
      const molNaOH = chlorMembrane ? nMolE : 0; // Without membrane reacts to form NaClO
      const massNaOHKg = (molNaOH * 40) / 1000;
      const volCl2M3 = chlorMembrane ? ((nMolE / 2) * 24.79) / 1000 : 0;
      const volH2M3 = ((nMolE / 2) * 24.79) / 1000;
      const massNaClOKg = !chlorMembrane ? ((nMolE / 2) * 74.5) / 1000 : 0;
      return { massNaOHKg, volCl2M3, volH2M3, massNaClOKg };
    }
    // Blast furnace: Fe2O3 (160) -> 2 Fe (112)
    const purity = 0.85;
    const redEff = Math.min(0.97, 0.72 + ((ironBlastHotAirC - 700) / 700) * 0.24);
    const massFeKg = ironOreInputKg * purity * (112 / 160) * redEff;
    const massGangKg = massFeKg / 0.95; // ~95% Fe, ~4% C
    return { massFeKg, massGangKg, redEffPct: Math.round(redEff * 100) };
  }, [
    processId,
    h2so4TempC,
    h2so4UseAcidAbsorb,
    nh3TempC,
    nh3PressureBar,
    nh3CatalystFe,
    chlorMembrane,
    chlorCurrentKA,
    chlorHours,
    ironBlastHotAirC,
    ironOreInputKg,
  ]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let uiTimer = 0;

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

    const tick = (now: number) => {
      const rawDt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const dt = isRunning ? rawDt : 0;

      if (moduleId === 'aluminum_prod' && canvasRef.current) {
        const st = alStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (alUseCryolite && st.hours < 24) {
            st.hours = Math.min(24, st.hours + dt * 0.9);
          }
          uiTimer += rawDt;
          if (uiTimer >= 0.08) {
            uiTimer = 0;
            setAlHours(Number(st.hours.toFixed(1)));
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawAluminumCell(setup.ctx, setup.w, setup.h, st.t);
      }

      if (moduleId === 'industrial_prod' && canvasRef.current) {
        const st = indStateRef.current;
        if (dt > 0) {
          st.t += dt;
          if (processId === 'naoh_cl2' && st.chlorHours < 20) {
            st.chlorHours = Math.min(20, st.chlorHours + dt * 0.85);
            uiTimer += rawDt;
            if (uiTimer >= 0.08) {
              uiTimer = 0;
              setChlorHours(Number(st.chlorHours.toFixed(1)));
            }
          }
        }
        const setup = setupCanvas(canvasRef.current);
        if (setup) drawIndustrialProcess(setup.ctx, setup.w, setup.h, st.t);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // ===========================================================================
  // CANVAS DRAWERS
  // ===========================================================================
  const drawAluminumCell = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const tankW = Math.min(440, w * 0.72);
    const tankH = h * 0.56;
    const tankLeft = cx - tankW / 2;
    const tankBot = h * 0.86;
    const tankTop = tankBot - tankH;

    // Outer steel shell
    ctx.fillStyle = '#475569';
    ctx.fillRect(tankLeft - 14, tankTop, tankW + 28, tankH + 16);
    // Graphite Cathode lining (−)
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(tankLeft, tankTop + 6, tankW, tankH);

    // Inner bath cavity
    const innerL = tankLeft + 18;
    const innerW = tankW - 36;
    const innerBot = tankBot - 16;
    const innerTop = tankTop + 18;
    const innerH = innerBot - innerTop;

    // Molten electrolyte Al2O3 + Cryolite Na3AlF6 (950°C glow or frozen solid if no cryolite)
    ctx.fillStyle = alUseCryolite ? 'rgba(251, 146, 60, 0.75)' : '#CBD5E1';
    ctx.fillRect(innerL, innerTop + 26, innerW, innerH - 26);

    // Crust / protective slag layer on top
    ctx.fillStyle = alUseCryolite ? '#94A3B8' : '#64748B';
    ctx.fillRect(innerL, innerTop + 18, innerW, 10);

    // Molten Aluminum pool at the bottom of Cathode (−)
    const poolH = alUseCryolite ? 14 + alCalc.alPoolFrac * 28 : 4;
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(innerL, innerBot - poolH, innerW, poolH);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(innerL, innerBot - poolH, innerW, poolH);

    // Molten Al drainage tap spout on right
    ctx.fillStyle = '#334155';
    ctx.fillRect(tankLeft + tankW, innerBot - 16, 36, 12);
    if (alUseCryolite && alCalc.alPoolFrac > 0.1) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(tankLeft + tankW + 2, innerBot - 13, 34, 6);
    }

    // 3 Consumable Carbon Anodes (+) suspended from top busbar (they shrink as O2 burns C -> CO/CO2!)
    const busY = 38;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(innerL + 20, busY, innerW - 40, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillText(`ANOT (+) · Thanh than chì (tiêu hao dần) · I = ${alCurrentKA} kA`, innerL + 28, busY + 9);

    const anodeBaseLen = innerTop + innerH * 0.56 - (busY + 12);
    const wearPx = alUseCryolite ? alCalc.anodeWearFrac * 44 : 0;
    const anodeXs = [cx - innerW * 0.28, cx, cx + innerW * 0.28];

    anodeXs.forEach((ax, idx) => {
      const aW = Math.min(54, innerW * 0.18);
      const curBot = busY + 12 + anodeBaseLen - wearPx;
      ctx.fillStyle = '#334155';
      ctx.fillRect(ax - aW / 2, busY + 12, aW, curBot - (busY + 12));
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ax - aW / 2, busY + 12, aW, curBot - (busY + 12));

      // Gas bubbles O2 / CO / CO2 rising around burning carbon anode
      if (alUseCryolite) {
        for (let b = 0; b < 5; b++) {
          const yOff = ((t * 58 + b * 18 + idx * 11) % 62);
          ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(ax + Math.sin(t * 4 + b + idx) * (aW * 0.55), curBot - yOff, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    });

    // Labels
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12px ui-sans-serif, sans-serif';
    ctx.fillText(
      alUseCryolite
        ? 'Hỗn hợp nóng chảy Al₂O₃ + Criolit (Na₃AlF₆) ~950°C'
        : '⚠ Thiếu Criolit: Al₂O₃ nóng chảy ở ~2050°C (không điện phân hiệu quả)',
      innerL + 8,
      innerTop + 12
    );

    ctx.fillStyle = '#1E293B';
    ctx.font = '800 11px ui-sans-serif, sans-serif';
    ctx.fillText('Nhôm lỏng Al (d ≈ 2,3 g/cm³)', cx - 72, innerBot - poolH / 2 + 4);
    ctx.fillStyle = '#0F172A';
    ctx.fillText('Lớp lót than chì làm CATOT (−)', cx - 88, tankBot + 32);
  };

  const drawIndustrialProcess = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    if (processId === 'h2so4') {
      // 3 Towers: 1. Pyrite burner -> 2. Contact tower (V2O5, 450C) -> 3. Oleum absorber
      const towerW = Math.min(130, w * 0.22);
      const towerH = h * 0.54;
      const topY = h * 0.22;
      const xs = [w * 0.18, w * 0.50, w * 0.82];

      // Connecting pipes
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(xs[0] + towerW / 2, topY + 40);
      ctx.lineTo(xs[1] - towerW / 2, topY + 40);
      ctx.moveTo(xs[1] + towerW / 2, topY + towerH - 40);
      ctx.lineTo(xs[2] - towerW / 2, topY + towerH - 40);
      ctx.stroke();

      // Animated gas pulses flowing left -> right
      for (let i = 0; i < 4; i++) {
        const frac = (t * 0.45 + i * 0.25) % 1;
        const gx1 = xs[0] + towerW / 2 + frac * (xs[1] - xs[0] - towerW);
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(gx1, topY + 40, 4.5, 0, Math.PI * 2);
        ctx.fill();

        const gx2 = xs[1] + towerW / 2 + frac * (xs[2] - xs[1] - towerW);
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(gx2, topY + towerH - 40, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tower 1: Burner
      ctx.fillStyle = '#FFF7ED';
      ctx.strokeStyle = '#C2410C';
      ctx.lineWidth = 2.4;
      ctx.fillRect(xs[0] - towerW / 2, topY, towerW, towerH);
      ctx.strokeRect(xs[0] - towerW / 2, topY, towerW, towerH);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(xs[0] - towerW / 2 + 8, topY + towerH - 46, towerW - 16, 38);
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px ui-sans-serif, sans-serif';
      ctx.fillText('1. Lò đốt FeS₂ / S', xs[0] - towerW / 2 + 8, topY - 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.fillText('→ SO₂↑ + Fe₂O₃', xs[0] - towerW / 2 + 12, topY + towerH - 22);

      // Tower 2: Contact Tower with V2O5 catalyst trays
      ctx.fillStyle = '#FEFCE8';
      ctx.strokeStyle = '#CA8A04';
      ctx.fillRect(xs[1] - towerW / 2, topY, towerW, towerH);
      ctx.strokeRect(xs[1] - towerW / 2, topY, towerW, towerH);
      for (let tray = 0; tray < 3; tray++) {
        ctx.fillStyle = '#EAB308';
        ctx.fillRect(xs[1] - towerW / 2 + 10, topY + 48 + tray * 46, towerW - 20, 12);
      }
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px ui-sans-serif, sans-serif';
      ctx.fillText(`2. Tháp tiếp xúc (${h2so4TempC}°C)`, xs[1] - towerW / 2 - 4, topY - 10);
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.fillText('XT: V₂O₅ · 2SO₂+O₂⇌2SO₃', xs[1] - towerW / 2 + 4, topY + towerH + 18);

      // Tower 3: Absorber
      ctx.fillStyle = h2so4UseAcidAbsorb ? '#ECFDF5' : '#FEF2F2';
      ctx.strokeStyle = h2so4UseAcidAbsorb ? '#059669' : '#DC2626';
      ctx.fillRect(xs[2] - towerW / 2, topY, towerW, towerH);
      ctx.strokeRect(xs[2] - towerW / 2, topY, towerW, towerH);
      ctx.fillStyle = h2so4UseAcidAbsorb ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.22)';
      ctx.fillRect(xs[2] - towerW / 2 + 6, topY + towerH * 0.35, towerW - 12, towerH * 0.62);
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px ui-sans-serif, sans-serif';
      ctx.fillText('3. Tháp hấp thụ SO₃', xs[2] - towerW / 2 + 4, topY - 10);
      ctx.font = '700 10px ui-sans-serif, sans-serif';
      ctx.fillText(h2so4UseAcidAbsorb ? 'H₂SO₄ 98% → Oleum' : '⚠ Tạo mù H₂SO₄!', xs[2] - towerW / 2 + 8, topY + towerH + 18);
    } else if (processId === 'nh3') {
      // Haber-Bosch: Reactor -> Cooler -> Recycle loop
      const rX = w * 0.30;
      const cX = w * 0.72;
      const midY = h * 0.48;
      const boxW = Math.min(150, w * 0.26);
      const boxH = h * 0.52;

      // Top pipe Reactor -> Condenser
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(rX + boxW / 2, midY - 40);
      ctx.lineTo(cX - boxW / 2, midY - 40);
      ctx.stroke();

      // Recycle loop bottom Condenser -> Reactor
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(cX, midY - boxH / 2);
      ctx.lineTo(cX, 38);
      ctx.lineTo(rX, 38);
      ctx.lineTo(rX, midY - boxH / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#0369A1';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('Tuần hoàn N₂, H₂ chưa phản ứng', w * 0.36, 28);

      // Reactor vessel
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 2.5;
      ctx.fillRect(rX - boxW / 2, midY - boxH / 2, boxW, boxH);
      ctx.strokeRect(rX - boxW / 2, midY - boxH / 2, boxW, boxH);
      if (nh3CatalystFe) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(rX - boxW / 2 + 14, midY - 20, boxW - 28, 44);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 10px ui-sans-serif, sans-serif';
        ctx.fillText('Xúc tác bột Fe', rX - 38, midY + 6);
      }
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px ui-sans-serif, sans-serif';
      ctx.fillText(`Tháp tổng hợp (${nh3TempC}°C, ${nh3PressureBar} bar)`, rX - boxW / 2 - 10, midY + boxH / 2 + 22);

      // Condenser vessel
      ctx.fillStyle = '#E0F2FE';
      ctx.strokeStyle = '#0284C7';
      ctx.fillRect(cX - boxW / 2, midY - boxH / 2, boxW, boxH);
      ctx.strokeRect(cX - boxW / 2, midY - boxH / 2, boxW, boxH);
      const liqH = Math.max(12, Math.min(72, (processCalc.singlePassPct ?? 0) * 1.4));
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(cX - boxW / 2 + 4, midY + boxH / 2 - liqH, boxW - 8, liqH);
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px ui-sans-serif, sans-serif';
      ctx.fillText('Tháp làm lạnh → Thu NH₃ lỏng', cX - boxW / 2 - 6, midY + boxH / 2 + 22);
    } else if (processId === 'naoh_cl2') {
      // Chlor-alkali diaphragm cell
      const bx = w * 0.5;
      const bBot = h * 0.84;
      const bW = Math.min(360, w * 0.62);
      const bH = h * 0.54;
      const liqH = bH * 0.78;

      ctx.fillStyle = chlorMembrane ? 'rgba(226, 232, 240, 0.45)' : 'rgba(254, 249, 195, 0.58)';
      ctx.fillRect(bx - bW / 2, bBot - liqH, bW, liqH);

      if (chlorMembrane) {
        // Pink NaOH compartment at Cathode (right)
        ctx.fillStyle = 'rgba(219, 39, 119, 0.25)';
        ctx.fillRect(bx, bBot - liqH, bW / 2, liqH);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.moveTo(bx, bBot - liqH - 12);
        ctx.lineTo(bx, bBot);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#059669';
        ctx.font = '800 11px ui-sans-serif, sans-serif';
        ctx.fillText('Màng ngăn Na⁺', bx - 38, bBot - liqH - 20);
      }

      const anoX = bx - bW * 0.28;
      const catX = bx + bW * 0.28;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(anoX - 10, bBot - bH + 10, 20, bH - 28);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(catX - 10, bBot - bH + 10, 20, bH - 28);

      // Bubbles: Cl2 (yellow-green at Anode), H2 (white at Cathode)
      for (let i = 0; i < 10; i++) {
        const yOff = (t * 58 + i * 24) % (liqH - 24);
        ctx.fillStyle = 'rgba(163, 230, 53, 0.88)';
        ctx.beginPath();
        ctx.arc(anoX + Math.sin(t * 4 + i) * 14, bBot - 22 - yOff, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(catX + Math.cos(t * 4 + i) * 14, bBot - 22 - yOff, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx - bW / 2, bBot - bH, bW, bH);

      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px ui-sans-serif, sans-serif';
      ctx.fillText('Anot (+) → Cl₂↑', anoX - 42, bBot + 22);
      ctx.fillText('Catot (−) → H₂↑ + NaOH', catX - 58, bBot + 22);
      ctx.fillText(
        chlorMembrane ? 'Chế độ: Sản xuất Xút – Clo (NaOH + Cl₂ + H₂)' : 'Không màng ngăn: Tạo nước Javel (NaCl + NaClO)',
        bx - 125,
        36
      );
    } else {
      // Blast furnace for Pig Iron (Lò cao luyện gang)
      const fx = w * 0.42;
      const fTop = 48;
      const fBot = h * 0.88;
      const fH = fBot - fTop;

      // Furnace trapezoid silhouette
      const grad = ctx.createLinearGradient(0, fTop, 0, fBot);
      grad.addColorStop(0, '#E2E8F0');
      grad.addColorStop(0.55, '#FDBA74');
      grad.addColorStop(1, '#DC2626');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(fx - 42, fTop);
      ctx.lineTo(fx - 84, fTop + fH * 0.62);
      ctx.lineTo(fx - 64, fBot);
      ctx.lineTo(fx + 64, fBot);
      ctx.lineTo(fx + 84, fTop + fH * 0.62);
      ctx.lineTo(fx + 42, fTop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Molten Iron bottom + Slag layer CaSiO3 on top of iron
      ctx.fillStyle = '#F97316';
      ctx.fillRect(fx - 62, fBot - 36, 124, 34);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(fx - 62, fBot - 52, 124, 16);

      // Hot air blast tuyere
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fx - 130, fBot - 70);
      ctx.lineTo(fx - 66, fBot - 70);
      ctx.stroke();

      // Temperature & reaction zone annotations on right
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 11px ui-sans-serif, sans-serif';
      ctx.fillText('Nạp liệu: Fe₂O₃ + Than cốc (C) + CaCO₃', fx - 92, fTop - 12);
      ctx.fillText(`~400–600°C: 3Fe₂O₃ + CO → 2Fe₃O₄ + CO₂`, fx + 96, fTop + fH * 0.25);
      ctx.fillText(`~900°C: FeO + CO → Fe + CO₂ · CaCO₃ → CaO`, fx + 96, fTop + fH * 0.52);
      ctx.fillText(`~1500°C: C + O₂ → CO₂ · Tạo xỉ CaSiO₃`, fx + 96, fTop + fH * 0.74);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Xỉ CaSiO₃', fx - 26, fBot - 40);
      ctx.fillText('Gang lỏng', fx - 26, fBot - 14);
      ctx.fillStyle = '#DC2626';
      ctx.fillText(`Khí nóng ${ironBlastHotAirC}°C`, fx - 142, fBot - 80);
    }
  };

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
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{isRunning ? 'Tạm dừng' : 'Tiếp tục'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (moduleId === 'aluminum_prod') {
                  alStateRef.current.hours = 0;
                  setAlHours(0);
                } else {
                  indStateRef.current.chlorHours = 0;
                  setChlorHours(0);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Làm lại</span>
            </button>
          </div>
        </div>

        <div className="relative w-full h-[400px] sm:h-[440px]">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* Quantitative Readouts */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {moduleId === 'aluminum_prod' ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Thời gian vận hành</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {alHours.toFixed(1)} giờ · {alCalc.meltTempC}°C
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Nhôm Al thu được</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {alCalc.massAlKg.toFixed(1)} kg
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Quặng Al₂O₃ tiêu thụ</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {alCalc.massAl2O3Kg.toFixed(1)} kg
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Anot than chì bị đốt</div>
                <div className="font-mono tabular-nums font-bold text-rose-700 mt-0.5">
                  −{alCalc.massCarbonBurnedKg.toFixed(1)} kg
                </div>
              </div>
            </>
          ) : processId === 'h2so4' ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Chuyển hóa SO₂ → SO₃</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {processCalc.so2ToSo3Pct}%
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Hiệu suất thu H₂SO₄</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {processCalc.finalYieldPct}%
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 col-span-2">
                <div className="text-slate-500">Chất hấp thụ tháp cuối</div>
                <div className="font-bold text-slate-800 mt-0.5">{processCalc.absorbNote}</div>
              </div>
            </>
          ) : processId === 'nh3' ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Hiệu suất 1 lượt qua tháp</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {(processCalc.singlePassPct ?? 0).toFixed(1)}%
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Hiệu suất tổng (có tuần hoàn)</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {(processCalc.recycleTotalPct ?? 0).toFixed(1)}%
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 col-span-2">
                <div className="text-slate-500">Điều kiện tối ưu công nghiệp</div>
                <div className="font-bold text-slate-800 mt-0.5">400–450°C · 150–250 bar · Xúc tác Fe</div>
              </div>
            </>
          ) : processId === 'naoh_cl2' ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Thời gian điện phân</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                  {chlorHours.toFixed(1)} giờ
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">{chlorMembrane ? 'Xút NaOH thu được' : 'NaClO (Javel) tạo thành'}</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {(chlorMembrane ? processCalc.massNaOHKg ?? 0 : processCalc.massNaClOKg ?? 0).toFixed(1)} kg
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Khí Cl₂ (Anot)</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">
                  {(processCalc.volCl2M3 ?? 0).toFixed(2)} m³
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Khí H₂ (Catot)</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {(processCalc.volH2M3 ?? 0).toFixed(2)} m³
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Quặng Hematite (85% Fe₂O₃)</div>
                <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">{ironOreInputKg} kg</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Hiệu suất khử CO</div>
                <div className="font-mono tabular-nums font-bold text-amber-700 mt-0.5">{processCalc.redEffPct}%</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Sắt nguyên chất tạo ra</div>
                <div className="font-mono tabular-nums font-bold text-sky-700 mt-0.5">
                  {(processCalc.massFeKg ?? 0).toFixed(1)} kg
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                <div className="text-slate-500">Gang thành phẩm (~95% Fe)</div>
                <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                  {(processCalc.massGangKg ?? 0).toFixed(1)} kg
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT CONTROLS & EQUATIONS */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm">
            <SlidersHorizontal size={16} className="text-emerald-600" />
            <span>Thông Số Công Nghiệp</span>
          </div>

          {moduleId === 'aluminum_prod' ? (
            <>
              <ChemSlider
                label="Cường độ dòng điện I"
                valueDisplay={`${alCurrentKA} kA`}
                min={50}
                max={300}
                step={10}
                value={alCurrentKA}
                onChange={setAlCurrentKA}
              />
              <ChemSlider
                label="Hiệu suất dòng điện"
                valueDisplay={`${alEfficiencyPct}%`}
                min={80}
                max={98}
                step={1}
                value={alEfficiencyPct}
                onChange={setAlEfficiencyPct}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alUseCryolite}
                  onChange={(e) => setAlUseCryolite(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <span className="font-semibold text-slate-700">
                  Pha Criolit (Na₃AlF₆) hạ nhiệt độ nóng chảy còn ~950°C
                </span>
              </label>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Chọn dây chuyền sản xuất</label>
                {[
                  { id: 'h2so4', label: 'Sản xuất Sulfuric Acid (H₂SO₄)' },
                  { id: 'nh3', label: 'Sản xuất Ammonia (NH₃ — Haber-Bosch)' },
                  { id: 'naoh_cl2', label: 'Sản xuất Xút (NaOH) & Khí Clo (Cl₂)' },
                  { id: 'iron', label: 'Sản xuất Gang từ Quặng Sắt (Lò cao)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setProcessId(opt.id as IndustrialProcessId)}
                    className={`w-full px-3 py-2 rounded-xl border text-left font-bold cursor-pointer ${
                      processId === opt.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {processId === 'h2so4' && (
                <>
                  <ChemSlider
                    label="Nhiệt độ tháp tiếp xúc V₂O₅"
                    valueDisplay={`${h2so4TempC} °C`}
                    min={350}
                    max={600}
                    step={10}
                    value={h2so4TempC}
                    onChange={setH2so4TempC}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={h2so4UseAcidAbsorb}
                      onChange={(e) => setH2so4UseAcidAbsorb(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span className="font-semibold text-slate-700">
                      Hấp thụ SO₃ bằng H₂SO₄ 98% (tạo Oleum)
                    </span>
                  </label>
                </>
              )}

              {processId === 'nh3' && (
                <>
                  <ChemSlider
                    label="Nhiệt độ tháp tổng hợp"
                    valueDisplay={`${nh3TempC} °C`}
                    min={300}
                    max={600}
                    step={10}
                    value={nh3TempC}
                    onChange={setNh3TempC}
                  />
                  <ChemSlider
                    label="Áp suất nén"
                    valueDisplay={`${nh3PressureBar} bar`}
                    min={50}
                    max={300}
                    step={10}
                    value={nh3PressureBar}
                    onChange={setNh3PressureBar}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={nh3CatalystFe}
                      onChange={(e) => setNh3CatalystFe(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span className="font-semibold text-slate-700">Dùng xúc tác bột Fe</span>
                  </label>
                </>
              )}

              {processId === 'naoh_cl2' && (
                <>
                  <ChemSlider
                    label="Cường độ dòng điện"
                    valueDisplay={`${chlorCurrentKA} kA`}
                    min={2}
                    max={30}
                    step={2}
                    value={chlorCurrentKA}
                    onChange={setChlorCurrentKA}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={chlorMembrane}
                      onChange={(e) => setChlorMembrane(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span className="font-semibold text-slate-700">
                      Có màng ngăn trao đổi ion (tắt để thu Javel)
                    </span>
                  </label>
                </>
              )}

              {processId === 'iron' && (
                <>
                  <ChemSlider
                    label="Nhiệt độ gió nóng thổi vào lò"
                    valueDisplay={`${ironBlastHotAirC} °C`}
                    min={700}
                    max={1400}
                    step={50}
                    value={ironBlastHotAirC}
                    onChange={setIronBlastHotAirC}
                  />
                  <ChemSlider
                    label="Khối lượng quặng Hematite nạp"
                    valueDisplay={`${ironOreInputKg} kg`}
                    min={800}
                    max={3200}
                    step={200}
                    value={ironOreInputKg}
                    onChange={setIronOreInputKg}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Theory & Equations */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
            {moduleId === 'aluminum_prod' ? (
              <Zap size={15} className="text-emerald-600" />
            ) : (
              <Factory size={15} className="text-emerald-600" />
            )}
            <span>Phương Trình &amp; Nguyên Lí Sản Xuất</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-slate-800">
            {moduleId === 'aluminum_prod' ? (
              <>
                <p className="font-semibold text-sky-800">Catot (−): Al³⁺ + 3e → Al (lỏng)</p>
                <p className="font-semibold text-rose-800">Anot (+): 2O²⁻ → O₂ ↑ + 4e  (O₂ đốt cháy Anot C → CO, CO₂)</p>
                <p className="font-mono font-bold text-slate-900 pt-1 border-t border-slate-200">
                  2Al₂O₃ —(đpnc, criolit)→ 4Al + 3O₂ ↑
                </p>
                <p className="text-slate-600 flex items-start gap-1.5">
                  <Info size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    Vai trò Criolit (Na₃AlF₆): hạ nhiệt độ nóng chảy từ 2050°C xuống ~950°C, tăng độ dẫn điện và tạo lớp bảo vệ nổi trên nhôm lỏng tránh bị O₂ oxi hóa. Thanh than chì Anot tan dần nên phải định kì thay thế.
                  </span>
                </p>
              </>
            ) : processId === 'h2so4' ? (
              <>
                <p className="font-mono font-bold text-slate-900">4FeS₂ + 11O₂ —(t°)→ 2Fe₂O₃ + 8SO₂ ↑</p>
                <p className="font-mono font-bold text-slate-900">2SO₂ + O₂ ⇌ (450°C, V₂O₅) ⇌ 2SO₃</p>
                <p className="font-mono font-bold text-slate-900">H₂SO₄ + nSO₃ → H₂SO₄·nSO₃ (Oleum)</p>
                <p className="text-slate-600">
                  Dùng H₂SO₄ 98% hấp thụ SO₃ rồi pha loãng giúp tránh hiện tượng tạo mù acid mịt như khi cho SO₃ tác dụng trực tiếp với nước.
                </p>
              </>
            ) : processId === 'nh3' ? (
              <>
                <p className="font-mono font-bold text-slate-900">
                  N₂(g) + 3H₂(g) ⇌ (450°C, 200 bar, Fe) ⇌ 2NH₃(g) · ΔᵣH°₂₉₈ = -91,8 kJ
                </p>
                <p className="text-slate-600">
                  Theo nguyên lí Le Chatelier: tăng áp suất giúp cân bằng dịch chuyển tạo NH₃ (giảm số mol khí 4 → 2). Nhiệt độ chọn ~450°C để dung hòa tốc độ phản ứng và hiệu suất cân bằng.
                </p>
              </>
            ) : processId === 'naoh_cl2' ? (
              <>
                <p className="font-mono font-bold text-slate-900">
                  {chlorMembrane
                    ? '2NaCl + 2H₂O —(đpdd có màng ngăn)→ 2NaOH + Cl₂ ↑ + H₂ ↑'
                    : 'NaCl + H₂O —(đpdd không màng ngăn)→ NaClO + H₂ ↑'}
                </p>
                <p className="text-slate-600">
                  Màng ngăn trao đổi cation chỉ cho ion Na⁺ đi sang buồng Catot, ngăn không cho khí Cl₂ phản ứng ngược lại với NaOH tạo NaClO.
                </p>
              </>
            ) : (
              <>
                <p className="font-mono font-bold text-slate-900">
                  Fe₂O₃ + 3CO —(t°)→ 2Fe + 3CO₂ ↑
                </p>
                <p className="font-mono text-[11px] text-emerald-700 font-semibold">
                  Tạo xỉ: CaCO₃ → CaO + CO₂  ;  CaO + SiO₂ → CaSiO₃
                </p>
                <p className="text-slate-600">
                  Than cốc vừa sinh nhiệt vừa tạo khí khử CO khử dần oxide sắt qua các nấc Fe₂O₃ → Fe₃O₄ → FeO → Fe lỏng.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

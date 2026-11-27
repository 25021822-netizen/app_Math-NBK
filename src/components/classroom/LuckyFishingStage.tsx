import React, { useEffect, useRef, useState } from 'react';
import { Anchor } from 'lucide-react';

export interface FishingStudentEntry {
  id: string;
  label: string;
}

interface LuckyFishingStageProps {
  students: FishingStudentEntry[];
  isBusy: boolean;
  hasWinner: boolean;
  castNonce: number;
  onRequestCast: () => void;
  onFishingStateChange: (fishing: boolean) => void;
  onSplashSound: () => void;
  onBiteSound: () => void;
  onCatchComplete: (caught: FishingStudentEntry) => void;
}

type FishingPhase = 'idle' | 'casting' | 'luring' | 'bite' | 'reeling' | 'caught';

interface FishEntity {
  id: string;
  name: string;
  bodyColor: string;
  finColor: string;
  stripeColor: string;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  tailPhase: number;
  scale: number;
  isHooked: boolean;
}

interface RippleEntity {
  id: number;
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

interface BubbleEntity {
  x: number;
  y: number;
  r: number;
  speed: number;
}

const STAGE_W = 560;
const STAGE_H = 340;
const WATER_Y = 76;
const ROD_TIP_X = 270;
const ROD_TIP_Y = 24;

const FISH_PALETTES = [
  { body: '#F97316', fin: '#EA580C', stripe: '#FFEDD5' }, // Clown orange
  { body: '#FACC15', fin: '#EAB308', stripe: '#FEF9C3' }, // Golden tang
  { body: '#EC4899', fin: '#DB2777', stripe: '#FCE7F3' }, // Coral pink
  { body: '#10B981', fin: '#059669', stripe: '#D1FAE5' }, // Emerald
  { body: '#8B5CF6', fin: '#7C3AED', stripe: '#EDE9FE' }, // Violet
  { body: '#06B6D4', fin: '#0891B2', stripe: '#CFFAFE' }, // Reef cyan
  { body: '#EF4444', fin: '#DC2626', stripe: '#FEE2E2' }, // Koi red
  { body: '#3B82F6', fin: '#2563EB', stripe: '#DBEAFE' }, // Royal blue
];

function truncateFishName(name: string, maxLen: number): string {
  const clean = name.trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

function createInitialFish(students: FishingStudentEntry[]): FishEntity[] {
  const count = Math.max(1, students.length);
  return students.map((stu, idx) => {
    const pal = FISH_PALETTES[idx % FISH_PALETTES.length];
    const row = idx % Math.min(6, Math.max(3, Math.ceil(count / 2)));
    const rowStep = 175 / Math.max(2, Math.min(6, Math.max(3, Math.ceil(count / 2))) - 1);
    const dir: 1 | -1 = idx % 2 === 0 ? 1 : -1;
    const x = 68 + ((idx * 97 + 40) % (STAGE_W - 136));
    const y = Math.min(292, Math.max(114, 114 + row * rowStep + ((idx % 3) - 1) * 8));
    return {
      id: stu.id,
      name: stu.label,
      bodyColor: pal.body,
      finColor: pal.fin,
      stripeColor: pal.stripe,
      x,
      y,
      vx: dir * (34 + (idx % 4) * 11),
      facing: dir,
      tailPhase: idx * 1.15,
      scale: count > 16 ? 0.84 : count > 10 ? 0.92 : 1,
      isHooked: false,
    };
  });
}

function createBubbles(): BubbleEntity[] {
  return Array.from({ length: 12 }, (_, idx) => ({
    x: 45 + ((idx * 47) % (STAGE_W - 90)),
    y: WATER_Y + 30 + ((idx * 53) % 210),
    r: 2 + (idx % 3) * 1.4,
    speed: 18 + (idx % 4) * 7,
  }));
}

export const LuckyFishingStage: React.FC<LuckyFishingStageProps> = ({
  students,
  isBusy,
  hasWinner,
  castNonce,
  onRequestCast,
  onFishingStateChange,
  onSplashSound,
  onBiteSound,
  onCatchComplete,
}) => {
  const [phase, setPhase] = useState<FishingPhase>('idle');
  const [fishes, setFishes] = useState<FishEntity[]>(() => createInitialFish(students));
  const [hookPos, setHookPos] = useState<{ x: number; y: number }>({ x: 280, y: 50 });
  const [bobberPos, setBobberPos] = useState<{ x: number; y: number; visible: boolean; submerged: boolean }>({
    x: 280,
    y: WATER_Y,
    visible: false,
    submerged: false,
  });
  const [ripples, setRipples] = useState<RippleEntity[]>([]);
  const [bubbles, setBubbles] = useState<BubbleEntity[]>(() => createBubbles());
  const [statusLabel, setStatusLabel] = useState<string>('');

  const fishesRef = useRef<FishEntity[]>(fishes);
  const bubblesRef = useRef<BubbleEntity[]>(bubbles);
  const ripplesRef = useRef<RippleEntity[]>([]);
  const phaseRef = useRef<FishingPhase>('idle');
  const rafRef = useRef<number | null>(null);
  const lastCastNonceRef = useRef<number>(castNonce);

  const castStateRef = useRef<{
    targetFishId: string;
    targetFishName: string;
    hookX: number;
    targetHookY: number;
    elapsed: number;
    splashPlayed: boolean;
    bitePlayed: boolean;
  } | null>(null);

  const callbacksRef = useRef({
    onFishingStateChange,
    onSplashSound,
    onBiteSound,
    onCatchComplete,
  });
  callbacksRef.current = {
    onFishingStateChange,
    onSplashSound,
    onBiteSound,
    onCatchComplete,
  };

  // Sync fish roster when students change while idle, or reset after winner dismissed
  useEffect(() => {
    if (phaseRef.current === 'caught' && !hasWinner) {
      phaseRef.current = 'idle';
      setPhase('idle');
      setBobberPos({ x: 280, y: WATER_Y, visible: false, submerged: false });
      setStatusLabel('');
      const next = createInitialFish(students);
      fishesRef.current = next;
      setFishes(next);
      return;
    }
    if (phaseRef.current !== 'idle') return;
    const next = createInitialFish(students);
    fishesRef.current = next;
    setFishes(next);
  }, [students, hasWinner]);

  // Start cast when castNonce increments
  useEffect(() => {
    if (castNonce === lastCastNonceRef.current) return;
    lastCastNonceRef.current = castNonce;
    if (students.length === 0) return;
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'caught') return;

    const currentFish = createInitialFish(students);
    fishesRef.current = currentFish;
    const chosenIdx = Math.floor(Math.random() * currentFish.length);
    const chosen = currentFish[chosenIdx];

    const hookX = Math.round(180 + Math.random() * 210);
    const targetHookY = Math.round(175 + Math.random() * 68);

    castStateRef.current = {
      targetFishId: chosen.id,
      targetFishName: chosen.name,
      hookX,
      targetHookY,
      elapsed: 0,
      splashPlayed: false,
      bitePlayed: false,
    };

    ripplesRef.current = [];
    phaseRef.current = 'casting';
    setPhase('casting');
    setStatusLabel('Đang thả mồi...');
    callbacksRef.current.onFishingStateChange(true);
  }, [castNonce, students]);

  // Main 60fps animation loop for swimming fish, bubbles, ripples, and cast sequence
  useEffect(() => {
    let lastTs = performance.now();
    let rippleSeq = 1;

    const addRipple = (x: number, y: number, maxAge = 0.85) => {
      ripplesRef.current.push({ id: rippleSeq++, x, y, age: 0, maxAge });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.008, (now - lastTs) / 1000));
      lastTs = now;

      // Update rising bubbles
      const nextBubbles = bubblesRef.current.map((b) => {
        const ny = b.y - b.speed * dt;
        if (ny < WATER_Y + 8) {
          return { ...b, y: STAGE_H - 22 };
        }
        return { ...b, y: ny };
      });
      bubblesRef.current = nextBubbles;
      setBubbles(nextBubbles);

      // Update expanding water ripples
      if (ripplesRef.current.length > 0) {
        ripplesRef.current = ripplesRef.current
          .map((r) => ({ ...r, age: r.age + dt }))
          .filter((r) => r.age < r.maxAge);
        setRipples([...ripplesRef.current]);
      }

      const activePhase = phaseRef.current;
      const cast = castStateRef.current;

      // Advance cast state machine
      let curHookX = 280;
      let curHookY = 52;
      let showBobber = false;
      let bobberY = WATER_Y;
      let bobberSubmerged = false;

      if (cast && (activePhase === 'casting' || activePhase === 'luring' || activePhase === 'bite' || activePhase === 'reeling')) {
        cast.elapsed += dt;
        const t = cast.elapsed;

        if (t < 0.55) {
          // Casting down into pond
          const p = t / 0.55;
          const ease = 1 - Math.pow(1 - p, 2);
          curHookX = ROD_TIP_X + (cast.hookX - ROD_TIP_X) * ease;
          curHookY = ROD_TIP_Y + 12 + (cast.targetHookY - (ROD_TIP_Y + 12)) * ease;
          if (curHookY >= WATER_Y) {
            showBobber = true;
            bobberY = WATER_Y;
            if (!cast.splashPlayed) {
              cast.splashPlayed = true;
              addRipple(cast.hookX, WATER_Y, 0.9);
              callbacksRef.current.onSplashSound();
            }
          }
        } else if (t < 2.15) {
          // Luring fish around bait
          if (phaseRef.current !== 'luring') {
            phaseRef.current = 'luring';
            setPhase('luring');
            setStatusLabel('Đang nhử cá...');
          }
          showBobber = true;
          curHookX = cast.hookX;
          curHookY = cast.targetHookY + Math.sin(t * 5) * 4;
          bobberY = WATER_Y + Math.sin(t * 5) * 2;
        } else if (t < 2.6) {
          // Fish bites!
          if (phaseRef.current !== 'bite') {
            phaseRef.current = 'bite';
            setPhase('bite');
            setStatusLabel('Cắn câu rồi!');
          }
          showBobber = true;
          bobberSubmerged = true;
          curHookX = cast.hookX + Math.sin(t * 28) * 4;
          curHookY = cast.targetHookY + 8 + Math.cos(t * 24) * 3;
          bobberY = WATER_Y + 8;
          if (!cast.bitePlayed) {
            cast.bitePlayed = true;
            addRipple(cast.hookX, WATER_Y, 1.0);
            callbacksRef.current.onBiteSound();
          }
        } else if (t < 3.4) {
          // Reeling up to surface
          if (phaseRef.current !== 'reeling') {
            phaseRef.current = 'reeling';
            setPhase('reeling');
            setStatusLabel('Đang kéo lên...');
          }
          const rp = (t - 2.6) / 0.8;
          const ease = 1 - Math.pow(1 - rp, 2);
          showBobber = rp < 0.72;
          curHookX = cast.hookX;
          curHookY = cast.targetHookY + (56 - cast.targetHookY) * ease;
          bobberY = WATER_Y;
        } else {
          // Caught!
          phaseRef.current = 'caught';
          setPhase('caught');
          setStatusLabel(`Đã câu được: ${cast.targetFishName}`);
          curHookX = cast.hookX;
          curHookY = 56;
          showBobber = false;
          const winnerObj: FishingStudentEntry = {
            id: cast.targetFishId,
            label: cast.targetFishName,
          };
          castStateRef.current = null;
          callbacksRef.current.onFishingStateChange(false);
          callbacksRef.current.onCatchComplete(winnerObj);
        }

        setHookPos({ x: curHookX, y: curHookY });
        setBobberPos({ x: curHookX, y: bobberY, visible: showBobber, submerged: bobberSubmerged });
      } else if (activePhase === 'caught') {
        // Keep caught fish suspended cleanly above water
        setHookPos((prev) => ({ x: prev.x, y: 56 }));
      }

      // Update fish positions
      const list = fishesRef.current;
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        f.tailPhase += dt * (f.isHooked ? 16 : 6.5);

        if (cast && f.id === cast.targetFishId && (phaseRef.current === 'luring' || phaseRef.current === 'bite' || phaseRef.current === 'reeling')) {
          if (phaseRef.current === 'luring') {
            // Target fish swims smoothly toward the hook
            const mouthOffset = f.facing * 20;
            const dx = curHookX - (f.x + mouthOffset);
            const dy = curHookY - f.y;
            const dist = Math.hypot(dx, dy);
            if (Math.abs(dx) > 4) {
              f.facing = dx >= 0 ? 1 : -1;
            }
            if (dist > 3) {
              const speed = Math.min(185, Math.max(70, dist * 2.2));
              f.x += (dx / dist) * speed * dt;
              f.y += (dy / dist) * speed * dt;
            }
          } else {
            // Bite or reeling: fish is latched onto the hook
            f.isHooked = true;
            f.x = curHookX - f.facing * 18;
            f.y = curHookY + 4;
          }
          continue;
        }

        if (phaseRef.current === 'caught' && f.isHooked) {
          continue;
        }

        // Curious nudge during luring for other fishes
        if (cast && phaseRef.current === 'luring') {
          const dx = curHookX - f.x;
          const dy = curHookY - f.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 65 && dist < 170) {
            f.vx += Math.sign(dx) * 18 * dt;
          }
          f.vx = Math.max(-75, Math.min(75, f.vx));
        }

        f.x += f.vx * dt;
        if (f.x <= 48) {
          f.x = 48;
          f.vx = Math.abs(f.vx);
          f.facing = 1;
        } else if (f.x >= STAGE_W - 48) {
          f.x = STAGE_W - 48;
          f.vx = -Math.abs(f.vx);
          f.facing = -1;
        } else {
          f.facing = f.vx >= 0 ? 1 : -1;
        }
      }

      setFishes(list.map((f) => ({ ...f })));
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      callbacksRef.current.onFishingStateChange(false);
    };
  }, []);

  const lineStartX = ROD_TIP_X;
  const lineStartY =
    phase === 'bite' || phase === 'reeling' ? ROD_TIP_Y + 7 : ROD_TIP_Y;

  const isHookVisible = phase !== 'idle';

  return (
    <div className="w-full space-y-3">
      {/* 2D Fishing Pond Canvas */}
      <div
        onClick={() => {
          if (!isBusy && students.length > 0) {
            onRequestCast();
          }
        }}
        className={`relative rounded-2xl border border-sky-300 overflow-hidden shadow-inner select-none ${
          !isBusy && students.length > 0 ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          className="w-full h-auto block"
          role="img"
          aria-label="Ao câu cá gọi tên học sinh"
        >
          <defs>
            <linearGradient id="luckySkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="100%" stopColor="#BAE6FD" />
            </linearGradient>
            <linearGradient id="luckyPondGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="48%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0C4A6E" />
            </linearGradient>
            <linearGradient id="luckySandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>

          {/* Sky */}
          <rect x="0" y="0" width={STAGE_W} height={WATER_Y + 4} fill="url(#luckySkyGrad)" />

          {/* Sun & Soft Clouds */}
          <circle cx="496" cy="28" r="16" fill="#FDE047" opacity="0.9" />
          <g fill="#FFFFFF" opacity="0.82">
            <ellipse cx="182" cy="26" rx="22" ry="9" />
            <ellipse cx="198" cy="23" rx="16" ry="8" />
            <ellipse cx="386" cy="34" rx="24" ry="8" />
            <ellipse cx="404" cy="31" rx="15" ry="7" />
          </g>

          {/* Wooden Pier on Left */}
          <rect x="16" y="58" width="14" height="26" fill="#78350F" />
          <rect x="68" y="58" width="14" height="26" fill="#78350F" />
          <rect x="0" y="50" width="102" height="11" rx="3" fill="#B45309" stroke="#78350F" strokeWidth="1.5" />

          {/* Fishing Rod extending from Pier */}
          <path
            d={`M 74 52 Q 175 26 ${lineStartX} ${lineStartY}`}
            fill="none"
            stroke="#78350F"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="74" cy="52" r="4" fill="#1E293B" />

          {/* Pond Water */}
          <rect x="0" y={WATER_Y} width={STAGE_W} height={STAGE_H - WATER_Y} fill="url(#luckyPondGrad)" />

          {/* Sunlight Beams */}
          <polygon points="110,76 185,76 235,315 80,315" fill="#FFFFFF" opacity="0.06" />
          <polygon points="310,76 395,76 460,315 280,315" fill="#FFFFFF" opacity="0.05" />

          {/* Water Surface Wave */}
          <path
            d={`M 0 ${WATER_Y} Q 35 ${WATER_Y - 5} 70 ${WATER_Y} T 140 ${WATER_Y} T 210 ${WATER_Y} T 280 ${WATER_Y} T 350 ${WATER_Y} T 420 ${WATER_Y} T 490 ${WATER_Y} T 560 ${WATER_Y} L 560 ${WATER_Y + 8} L 0 ${WATER_Y + 8} Z`}
            fill="#38BDF8"
            opacity="0.45"
          />

          {/* Seabed Sand */}
          <path
            d={`M 0 315 Q 140 305 280 316 T 560 312 L 560 ${STAGE_H} L 0 ${STAGE_H} Z`}
            fill="url(#luckySandGrad)"
          />

          {/* Decorative Seaweed */}
          <g stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.85">
            <path d="M 38 318 Q 30 294 42 272 Q 50 254 38 238" />
            <path d="M 52 320 Q 60 298 49 280" stroke="#059669" />
            <path d="M 510 316 Q 520 290 506 268 Q 498 250 512 232" />
            <path d="M 494 318 Q 486 298 498 278" stroke="#34D399" />
            <path d="M 248 318 Q 240 300 252 282" stroke="#059669" />
          </g>

          {/* Rising Bubbles */}
          {bubbles.map((b, idx) => (
            <circle
              key={idx}
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill="#E0F2FE"
              fillOpacity="0.32"
              stroke="#FFFFFF"
              strokeOpacity="0.45"
              strokeWidth="0.8"
            />
          ))}

          {/* Water Ripples */}
          {ripples.map((rp) => {
            const p = rp.age / rp.maxAge;
            return (
              <ellipse
                key={rp.id}
                cx={rp.x}
                cy={rp.y}
                rx={10 + p * 36}
                ry={3 + p * 8}
                fill="none"
                stroke="#E0F2FE"
                strokeWidth="2"
                opacity={Math.max(0, 1 - p)}
              />
            );
          })}

          {/* Fishing Line & Hook */}
          {isHookVisible && (
            <g>
              <line
                x1={lineStartX}
                y1={lineStartY}
                x2={hookPos.x}
                y2={hookPos.y}
                stroke="#F8FAFC"
                strokeWidth="1.5"
                opacity="0.9"
              />
              {/* Bobber */}
              {bobberPos.visible && (
                <g transform={`translate(${bobberPos.x}, ${bobberPos.y})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="6"
                    fill="#EF4444"
                    stroke="#FFFFFF"
                    strokeWidth="1.4"
                  />
                  <path d="M -6 0 A 6 6 0 0 0 6 0 Z" fill="#FFFFFF" />
                  {bobberPos.submerged && (
                    <text
                      x="12"
                      y="-6"
                      fill="#FEF08A"
                      fontSize="11"
                      fontWeight="900"
                      stroke="#0F172A"
                      strokeWidth="0.5"
                    >
                      Cắn câu!
                    </text>
                  )}
                </g>
              )}
              {/* Metallic Hook + Bait */}
              <path
                d={`M ${hookPos.x} ${hookPos.y} L ${hookPos.x} ${hookPos.y + 8} A 4.5 4.5 0 1 1 ${hookPos.x - 8} ${hookPos.y + 7}`}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {phase !== 'caught' && phase !== 'reeling' && (
                <circle cx={hookPos.x - 3} cy={hookPos.y + 10} r="3.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
              )}
            </g>
          )}

          {/* Swimming Fishes */}
          {fishes.length === 0 ? (
            <text
              x={STAGE_W / 2}
              y={200}
              textAnchor="middle"
              fill="#F8FAFC"
              fontSize="13"
              fontWeight="700"
            >
              Chưa có học sinh nào trong ao cá.
            </text>
          ) : (
            fishes.map((fish) => {
              const bobY = fish.isHooked ? 0 : Math.sin(fish.tailPhase * 0.55) * 3;
              const wagDeg = Math.sin(fish.tailPhase) * (fish.isHooked ? 12 : 6);
              const label = truncateFishName(fish.name, 14);
              const labelW = Math.max(46, label.length * 6.5 + 14);

              return (
                <g
                  key={fish.id}
                  transform={`translate(${fish.x}, ${fish.y + bobY}) scale(${fish.scale})`}
                >
                  {/* Name tag above fish */}
                  <g transform="translate(0, -23)">
                    <rect
                      x={-labelW / 2}
                      y="-10"
                      width={labelW}
                      height="16"
                      rx="5"
                      fill={fish.isHooked ? '#FACC15' : 'rgba(15, 23, 42, 0.72)'}
                      stroke={fish.isHooked ? '#854D0E' : 'rgba(255,255,255,0.28)'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      fill={fish.isHooked ? '#0F172A' : '#FFFFFF'}
                      fontSize="9.5"
                      fontWeight="800"
                    >
                      {label}
                    </text>
                  </g>

                  {/* Fish Body (flipped by swimming direction) */}
                  <g transform={`scale(${fish.facing}, 1) rotate(${fish.isHooked ? -18 : 0})`}>
                    {/* Tail fin */}
                    <path
                      d="M -16 0 L -27 -8 L -24 0 L -27 8 Z"
                      fill={fish.finColor}
                      stroke="#0F172A"
                      strokeOpacity="0.35"
                      strokeWidth="1"
                      transform={`rotate(${wagDeg} -16 0)`}
                    />
                    {/* Dorsal fin */}
                    <path
                      d="M -6 -9 Q 2 -16 9 -8 Z"
                      fill={fish.finColor}
                    />
                    {/* Main Body */}
                    <ellipse
                      cx="0"
                      cy="0"
                      rx="18"
                      ry="11"
                      fill={fish.bodyColor}
                      stroke="#0F172A"
                      strokeOpacity="0.35"
                      strokeWidth="1.1"
                    />
                    {/* Decorative Stripe */}
                    <path
                      d="M -3 -10 Q 1 0 -3 10"
                      fill="none"
                      stroke={fish.stripeColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                    {/* Eye */}
                    <circle cx="10" cy="-2.5" r="3" fill="#FFFFFF" />
                    <circle cx="11" cy="-2.5" r="1.5" fill="#0F172A" />
                    {/* Side Fin */}
                    <path
                      d="M 1 2 Q -5 8 -10 4 Z"
                      fill={fish.stripeColor}
                      opacity="0.85"
                    />
                  </g>
                </g>
              );
            })
          )}
        </svg>

        {/* Subtle live status text inside top-right corner of sky */}
        {statusLabel && (
          <div className="absolute top-2.5 right-3 px-2.5 py-1 rounded-lg bg-slate-900/75 text-white text-[11px] font-bold pointer-events-none">
            {statusLabel}
          </div>
        )}
      </div>

      {/* Primary Action Button */}
      {!hasWinner && (
        <button
          type="button"
          onClick={onRequestCast}
          disabled={isBusy || students.length === 0}
          className="w-full py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-45 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <Anchor size={14} />
          <span>{isBusy ? 'Đang thả câu...' : 'Thả Câu May Mắn'}</span>
        </button>
      )}
    </div>
  );
};

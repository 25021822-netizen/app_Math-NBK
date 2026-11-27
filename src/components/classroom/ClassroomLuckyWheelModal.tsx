import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile } from '../../types/math';
import {
  X,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
  History,
  Check,
  Play,
  Award,
  Flag,
  Trophy,
  Sparkles,
  Fish,
} from 'lucide-react';
import { LuckyFishingStage, FishingStudentEntry } from './LuckyFishingStage';

interface ClassroomLuckyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  enrolledStudents: UserProfile[];
  userRole: string;
}

type LuckyGameMode = 'wheel' | 'duck_race' | 'fishing';

interface SpinRecord {
  id: string;
  label: string;
  game: LuckyGameMode;
  spunAt: string;
}

interface StoredLuckyState {
  gameMode: LuckyGameMode;
  excludedStudentIds: string[];
  removeAfterWin: boolean;
  soundEnabled: boolean;
  history: SpinRecord[];
}

interface DuckRunner {
  id: string;
  name: string;
  color: string;
  hatColor: string;
  laneIndex: number;
  progress: number; // 0 -> 100
  speed: number;
  wobblePhase: number;
  boostTimer: number;
  finishedOrder: number | null;
}

const WHEEL_COLORS = [
  { fill: '#2563EB', text: '#FFFFFF' }, // blue-600
  { fill: '#F59E0B', text: '#1E293B' }, // amber-500
  { fill: '#10B981', text: '#FFFFFF' }, // emerald-500
  { fill: '#7C3AED', text: '#FFFFFF' }, // violet-600
  { fill: '#EC4899', text: '#FFFFFF' }, // pink-500
  { fill: '#06B6D4', text: '#0F172A' }, // cyan-500
  { fill: '#EF4444', text: '#FFFFFF' }, // red-500
  { fill: '#84CC16', text: '#0F172A' }, // lime-500
  { fill: '#F97316', text: '#FFFFFF' }, // orange-500
  { fill: '#6366F1', text: '#FFFFFF' }, // indigo-500
];

const DUCK_PALETTES = [
  { body: '#FACC15', hat: '#EF4444' },
  { body: '#FDE047', hat: '#2563EB' },
  { body: '#FB923C', hat: '#10B981' },
  { body: '#FBBF24', hat: '#7C3AED' },
  { body: '#FEF08A', hat: '#EC4899' },
  { body: '#F59E0B', hat: '#0EA5E9' },
  { body: '#FDE68A', hat: '#14B8A6' },
  { body: '#FCA5A5', hat: '#1E293B' },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y, 'Z'].join(' ');
}

function truncateLabel(label: string, maxLen: number): string {
  const clean = label.trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

export const ClassroomLuckyWheelLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 20,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="14" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
    <path d="M16 16 L16 3 A13 13 0 0 1 27.26 9.5 Z" fill="#2563EB" />
    <path d="M16 16 L27.26 9.5 A13 13 0 0 1 27.26 22.5 Z" fill="#F59E0B" />
    <path d="M16 16 L27.26 22.5 A13 13 0 0 1 16 29 Z" fill="#10B981" />
    <path d="M16 16 L16 29 A13 13 0 0 1 4.74 22.5 Z" fill="#7C3AED" />
    <path d="M16 16 L4.74 22.5 A13 13 0 0 1 4.74 9.5 Z" fill="#EC4899" />
    <path d="M16 16 L4.74 9.5 A13 13 0 0 1 16 3 Z" fill="#06B6D4" />
    <circle cx="16" cy="16" r="13" stroke="#FFFFFF" strokeWidth="1.2" />
    <circle cx="16" cy="16" r="4.2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="1.5" fill="#F59E0B" />
    <path d="M16 0.5 L18.5 5 H13.5 L16 0.5 Z" fill="#DC2626" stroke="#FFFFFF" strokeWidth="0.7" />
  </svg>
);

const RacingDuckSvg: React.FC<{ bodyColor: string; hatColor: string; number: number; isBoosting?: boolean }> = ({
  bodyColor,
  hatColor,
  number,
  isBoosting = false,
}) => (
  <svg width="36" height="30" viewBox="0 0 40 34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Water ripple under duck */}
    <ellipse cx="18" cy="29.5" rx="13" ry="2.6" fill="#E0F2FE" opacity="0.85" />
    {isBoosting && (
      <path d="M1 22 L7 20 M0 26 L6 25" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    )}
    {/* Duck body */}
    <ellipse cx="18" cy="22" rx="11.5" ry="7.8" fill={bodyColor} stroke="#78350F" strokeWidth="1.3" />
    {/* Wing */}
    <path d="M12 20 C16 17.5, 22 18.5, 23 22 C20 24.5, 14 24.5, 12 20 Z" fill="#FFFFFF" fillOpacity="0.45" />
    {/* Tail */}
    <path d="M6.5 21 L2.5 16.5 L8.5 18.5 Z" fill={bodyColor} stroke="#78350F" strokeWidth="1.2" strokeLinejoin="round" />
    {/* Duck head */}
    <circle cx="27.5" cy="13.5" r="6.5" fill={bodyColor} stroke="#78350F" strokeWidth="1.3" />
    {/* Cute cap / bandana */}
    <path d="M22.5 10.5 C24 6.5, 31 6.5, 32.5 10.5 Z" fill={hatColor} stroke="#1E293B" strokeWidth="1" />
    <path d="M31.5 10.2 L35.5 10.8" stroke={hatColor} strokeWidth="2.2" strokeLinecap="round" />
    {/* Beak */}
    <path d="M33.2 13.2 L38.5 14.5 L33.2 16.2 Z" fill="#EA580C" stroke="#7C2D12" strokeWidth="1" strokeLinejoin="round" />
    {/* Eye */}
    <circle cx="29.5" cy="12.5" r="1.3" fill="#0F172A" />
    <circle cx="29.9" cy="12.1" r="0.45" fill="#FFFFFF" />
    {/* Lane number */}
    <text x="17.5" y="24.5" textAnchor="middle" fill="#0F172A" fontSize="8" fontWeight="900">
      {number}
    </text>
  </svg>
);

export const ClassroomLuckyWheelModal: React.FC<ClassroomLuckyWheelModalProps> = ({
  isOpen,
  onClose,
  classId,
  className,
  enrolledStudents,
  userRole,
}) => {
  const storageKey = `mathnbk_lucky_v2_${classId}`;

  const loadInitialState = (): StoredLuckyState => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredLuckyState>;
        return {
          gameMode:
            parsed.gameMode === 'duck_race' || parsed.gameMode === 'fishing'
              ? parsed.gameMode
              : 'wheel',
          excludedStudentIds: Array.isArray(parsed.excludedStudentIds) ? parsed.excludedStudentIds : [],
          removeAfterWin: Boolean(parsed.removeAfterWin),
          soundEnabled: parsed.soundEnabled !== false,
          history: Array.isArray(parsed.history) ? parsed.history.slice(0, 15) : [],
        };
      }
    } catch {
      // ignore localStorage errors
    }
    return {
      gameMode: 'wheel',
      excludedStudentIds: [],
      removeAfterWin: false,
      soundEnabled: true,
      history: [],
    };
  };

  const [gameMode, setGameMode] = useState<LuckyGameMode>(() => loadInitialState().gameMode);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>(() => loadInitialState().excludedStudentIds);
  const [removeAfterWin, setRemoveAfterWin] = useState<boolean>(() => loadInitialState().removeAfterWin);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadInitialState().soundEnabled);
  const [history, setHistory] = useState<SpinRecord[]>(() => loadInitialState().history);

  // Wheel state
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<{ id: string; label: string; game: LuckyGameMode } | null>(null);

  // Duck race state
  const [ducks, setDucks] = useState<DuckRunner[]>([]);
  const [isRacing, setIsRacing] = useState(false);
  const [racePodium, setRacePodium] = useState<{ id: string; name: string; rank: number }[]>([]);

  // Fishing state
  const [isFishing, setIsFishing] = useState(false);
  const [fishingCastNonce, setFishingCastNonce] = useState(0);

  const spinTimeoutRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const raceRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const isBusy = isSpinning || isRacing || isFishing;

  // Sync state when switching classroom
  useEffect(() => {
    const next = loadInitialState();
    setGameMode(next.gameMode);
    setExcludedStudentIds(next.excludedStudentIds);
    setRemoveAfterWin(next.removeAfterWin);
    setSoundEnabled(next.soundEnabled);
    setHistory(next.history);
    setWinner(null);
    setIsSpinning(false);
    setIsRacing(false);
    setIsFishing(false);
    setRacePodium([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // Persist per classroom
  useEffect(() => {
    try {
      const stateToSave: StoredLuckyState = {
        gameMode,
        excludedStudentIds,
        removeAfterWin,
        soundEnabled,
        history: history.slice(0, 15),
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch {
      // ignore localStorage quota errors
    }
  }, [storageKey, gameMode, excludedStudentIds, removeAfterWin, soundEnabled, history]);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
      if (raceRafRef.current) window.cancelAnimationFrame(raceRafRef.current);
    };
  }, []);

  const activeStudents = useMemo(() => {
    const excludedSet = new Set(excludedStudentIds);
    return enrolledStudents
      .filter((s) => !excludedSet.has(s.id))
      .map((s) => ({ id: s.id, label: s.name || s.id }));
  }, [enrolledStudents, excludedStudentIds]);

  // Keep idle duck runners synced with activeStudents when not mid-race
  useEffect(() => {
    if (isRacing) return;
    setDucks(
      activeStudents.map((stu, idx) => {
        const pal = DUCK_PALETTES[idx % DUCK_PALETTES.length];
        return {
          id: stu.id,
          name: stu.label,
          color: pal.body,
          hatColor: pal.hat,
          laneIndex: idx,
          progress: 0,
          speed: 0,
          wobblePhase: idx * 0.9,
          boostTimer: 0,
          finishedOrder: null,
        };
      })
    );
  }, [activeStudents, isRacing]);

  const playTickSound = (freq = 640) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // ignore audio context errors
    }
  };

  const playQuackSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
    } catch {
      // ignore audio context errors
    }
  };

  const playWinSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.26);
      });
    } catch {
      // ignore audio context errors
    }
  };

  const playSplashSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(190, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // ignore audio context errors
    }
  };

  const handleRequestFishingCast = () => {
    if (isBusy || activeStudents.length === 0) return;
    setWinner(null);
    setFishingCastNonce((n) => n + 1);
  };

  const handleFishingCatchComplete = (caught: FishingStudentEntry) => {
    setWinner({ id: caught.id, label: caught.label, game: 'fishing' });
    playWinSound();
    setHistory((prev) => [
      {
        id: `fish_${Date.now()}`,
        label: caught.label,
        game: 'fishing',
        spunAt: new Date().toISOString(),
      },
      ...prev.slice(0, 14),
    ]);
    if (removeAfterWin) {
      setExcludedStudentIds((prev) =>
        prev.includes(caught.id) ? prev : [...prev, caught.id]
      );
    }
  };

  // --- WHEEL SPIN ---
  const handleSpin = () => {
    if (isBusy || activeStudents.length === 0) return;

    setIsSpinning(true);
    setWinner(null);

    const n = activeStudents.length;
    const winningIdx = Math.floor(Math.random() * n);
    const chosenEntry = activeStudents[winningIdx];
    const sliceAngle = 360 / n;

    const jitter = (Math.random() - 0.5) * sliceAngle * 0.65;
    const targetCenter = winningIdx * sliceAngle + sliceAngle / 2 + jitter;
    const desiredMod = ((360 - targetCenter) % 360 + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const deltaMod = ((desiredMod - currentMod) % 360 + 360) % 360;
    const extraTurns = (5 + Math.floor(Math.random() * 3)) * 360;
    const nextRotation = rotation + extraTurns + deltaMod;

    setRotation(nextRotation);

    if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = window.setInterval(() => {
      playTickSound();
    }, 140);

    if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
    spinTimeoutRef.current = window.setTimeout(() => {
      if (tickIntervalRef.current) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      setIsSpinning(false);
      setWinner({ id: chosenEntry.id, label: chosenEntry.label, game: 'wheel' });
      playWinSound();

      setHistory((prev) => [
        {
          id: `spin_${Date.now()}`,
          label: chosenEntry.label,
          game: 'wheel',
          spunAt: new Date().toISOString(),
        },
        ...prev.slice(0, 14),
      ]);

      if (removeAfterWin) {
        setExcludedStudentIds((prev) =>
          prev.includes(chosenEntry.id) ? prev : [...prev, chosenEntry.id]
        );
      }
    }, 4200);
  };

  // --- DUCK RACE ---
  const handleStartDuckRace = () => {
    if (isBusy || activeStudents.length === 0) return;
    if (raceRafRef.current) window.cancelAnimationFrame(raceRafRef.current);

    setIsRacing(true);
    setWinner(null);
    setRacePodium([]);
    playQuackSound();

    const runners: DuckRunner[] = activeStudents.map((stu, idx) => {
      const pal = DUCK_PALETTES[idx % DUCK_PALETTES.length];
      return {
        id: stu.id,
        name: stu.label,
        color: pal.body,
        hatColor: pal.hat,
        laneIndex: idx,
        progress: 0,
        speed: 13 + Math.random() * 6,
        wobblePhase: idx * 0.9,
        boostTimer: 0,
        finishedOrder: null,
      };
    });

    setDucks(runners);

    let lastTs = performance.now();
    let finishCounter = 0;
    let lastQuackAt = lastTs;
    const podiumList: { id: string; name: string; rank: number }[] = [];

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.008, (now - lastTs) / 1000));
      lastTs = now;

      if (now - lastQuackAt > 1100 && finishCounter === 0) {
        lastQuackAt = now;
        if (Math.random() < 0.65) playQuackSound();
      }

      let allDone = true;

      for (let i = 0; i < runners.length; i++) {
        const d = runners[i];
        d.wobblePhase += dt * 11;

        if (d.finishedOrder !== null) continue;
        allDone = false;

        // Dynamic speed fluctuation & random splash boosts for exciting overtakes
        if (d.boostTimer > 0) {
          d.boostTimer -= dt;
        } else if (Math.random() < 0.035) {
          d.boostTimer = 0.45 + Math.random() * 0.45;
        }

        const drift = (Math.random() - 0.48) * 14;
        d.speed = Math.max(9.5, Math.min(26, d.speed + drift * dt * 5));
        const effectiveSpeed = d.boostTimer > 0 ? d.speed * 1.48 : d.speed;
        d.progress = Math.min(100, d.progress + effectiveSpeed * dt);

        if (d.progress >= 100) {
          finishCounter += 1;
          d.finishedOrder = finishCounter;
          podiumList.push({ id: d.id, name: d.name, rank: finishCounter });
        }
      }

      setDucks(runners.map((r) => ({ ...r })));
      if (podiumList.length > 0) {
        setRacePodium([...podiumList]);
      }

      // Stop as soon as all ducks finish (or top 3 + 1.2s buffer, here waiting all ducks is ~0.8s extra and super clean)
      if (!allDone) {
        raceRafRef.current = window.requestAnimationFrame(step);
      } else {
        setIsRacing(false);
        const firstWinner = podiumList[0];
        if (firstWinner) {
          setWinner({ id: firstWinner.id, label: firstWinner.name, game: 'duck_race' });
          playWinSound();
          setHistory((prev) => [
            {
              id: `duck_${Date.now()}`,
              label: firstWinner.name,
              game: 'duck_race',
              spunAt: new Date().toISOString(),
            },
            ...prev.slice(0, 14),
          ]);
          if (removeAfterWin) {
            setExcludedStudentIds((prev) =>
              prev.includes(firstWinner.id) ? prev : [...prev, firstWinner.id]
            );
          }
        }
      }
    };

    raceRafRef.current = window.requestAnimationFrame(step);
  };

  const handleToggleStudent = (studentId: string) => {
    if (isBusy) return;
    setExcludedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleRestoreAllStudents = () => {
    if (isBusy) return;
    setExcludedStudentIds([]);
    setWinner(null);
    setRacePodium([]);
  };

  if (!isOpen) return null;

  const cx = 160;
  const cy = 160;
  const radius = 148;
  const n = activeStudents.length;
  const sliceAngle = n > 0 ? 360 / n : 360;

  const sortedLiveDucks = [...ducks].sort((a, b) => {
    if (a.finishedOrder !== null && b.finishedOrder !== null) return a.finishedOrder - b.finishedOrder;
    if (a.finishedOrder !== null) return -1;
    if (b.finishedOrder !== null) return 1;
    return b.progress - a.progress;
  });
  const currentLeaderId = sortedLiveDucks[0]?.progress && sortedLiveDucks[0].progress > 0 ? sortedLiveDucks[0].id : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
              <ClassroomLuckyWheelLogo size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                Lucky · {className}
              </h3>
              <p className="text-[11px] text-slate-500">
                {gameMode === 'wheel'
                  ? 'Vòng quay may mắn'
                  : gameMode === 'duck_race'
                  ? 'Đua vịt gọi tên'
                  : 'Câu cá gọi tên'}{' '}
                · {activeStudents.length}/{enrolledStudents.length} học sinh tham gia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Đóng Lucky"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Game Stage */}
          <div className="lg:col-span-7 flex flex-col items-center space-y-4">
            {/* Game Mode Switcher: Vòng quay, Đua vịt & Câu cá */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setGameMode('wheel');
                  setWinner(null);
                  setRacePodium([]);
                }}
                className={`px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  gameMode === 'wheel'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={14} />
                <span>Vòng Quay</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setGameMode('duck_race');
                  setWinner(null);
                  setRacePodium([]);
                }}
                className={`px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  gameMode === 'duck_race'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flag size={14} />
                <span>Đua Vịt</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setGameMode('fishing');
                  setWinner(null);
                  setRacePodium([]);
                }}
                className={`px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  gameMode === 'fishing'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Fish size={14} />
                <span>Câu Cá</span>
              </button>
            </div>

            {gameMode === 'wheel' ? (
              <>
                {/* Wheel Stage */}
                <div className="relative flex items-center justify-center pt-3 pb-1">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 drop-shadow-md" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 28 28">
                      <path
                        d="M14 27 L3 4 Q2 1 6 1 H22 Q26 1 25 4 Z"
                        fill="#DC2626"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>

                  <div className="relative w-[290px] h-[290px] sm:w-[320px] sm:h-[320px] rounded-full shadow-lg border-4 border-slate-900 bg-slate-100 select-none">
                    <svg
                      viewBox="0 0 320 320"
                      className="w-full h-full"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: isSpinning
                          ? 'transform 4.2s cubic-bezier(0.12, 0.85, 0.16, 1)'
                          : 'none',
                      }}
                    >
                      {n === 0 ? (
                        <g>
                          <circle cx={cx} cy={cy} r={radius} fill="#E2E8F0" />
                          <text
                            x={cx}
                            y={cy - 22}
                            textAnchor="middle"
                            fill="#475569"
                            fontSize="12"
                            fontWeight="700"
                          >
                            Chưa có học sinh tham gia
                          </text>
                        </g>
                      ) : n === 1 ? (
                        <g>
                          <circle cx={cx} cy={cy} r={radius} fill={WHEEL_COLORS[0].fill} stroke="#FFFFFF" strokeWidth="2" />
                          <text
                            x={cx}
                            y={cy - 55}
                            textAnchor="middle"
                            fill={WHEEL_COLORS[0].text}
                            fontSize="14"
                            fontWeight="800"
                          >
                            {truncateLabel(activeStudents[0].label, 20)}
                          </text>
                        </g>
                      ) : (
                        activeStudents.map((entry, idx) => {
                          const startAngle = idx * sliceAngle;
                          const endAngle = (idx + 1) * sliceAngle;
                          const midAngle = startAngle + sliceAngle / 2;
                          const palette = WHEEL_COLORS[idx % WHEEL_COLORS.length];
                          const fontSize = n > 18 ? 8.5 : n > 12 ? 10 : n > 7 ? 11.5 : 13;
                          const maxChars = n > 14 ? 12 : 16;

                          return (
                            <g key={entry.id}>
                              <path
                                d={createSlicePath(cx, cy, radius, startAngle, endAngle)}
                                fill={palette.fill}
                                stroke="#FFFFFF"
                                strokeWidth="1.75"
                              />
                              <g transform={`rotate(${midAngle} ${cx} ${cy})`}>
                                <text
                                  x={cx}
                                  y={cy - radius * 0.62}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  transform={`rotate(-90 ${cx} ${cy - radius * 0.62})`}
                                  fill={palette.text}
                                  fontSize={fontSize}
                                  fontWeight="800"
                                >
                                  {truncateLabel(entry.label, maxChars)}
                                </text>
                              </g>
                            </g>
                          );
                        })
                      )}
                    </svg>

                    {/* Center Spin Hub */}
                    <button
                      type="button"
                      onClick={handleSpin}
                      disabled={isBusy || activeStudents.length === 0}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white hover:bg-amber-50 disabled:opacity-60 border-4 border-slate-900 shadow-lg flex flex-col items-center justify-center text-slate-900 font-black text-xs transition-transform active:scale-95 cursor-pointer z-10"
                    >
                      <Play size={16} className="fill-blue-600 text-blue-600 ml-0.5" />
                      <span className="text-[10px] tracking-wider uppercase mt-0.5">
                        {isSpinning ? '...' : 'QUAY'}
                      </span>
                    </button>
                  </div>
                </div>

                {!winner && (
                  <button
                    type="button"
                    onClick={handleSpin}
                    disabled={isBusy || activeStudents.length === 0}
                    className="w-full max-w-xs py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Play size={14} className="fill-current" />
                    <span>{isSpinning ? 'Đang quay...' : 'Quay Vòng May Mắn'}</span>
                  </button>
                )}
              </>
            ) : gameMode === 'duck_race' ? (
              /* DUCK RACE STAGE */
              <div className="w-full space-y-3">
                <div className="rounded-2xl border border-sky-300 bg-gradient-to-b from-sky-500 to-cyan-600 p-3 shadow-inner overflow-hidden">
                  {/* Track Header */}
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-sky-50 pb-2 border-b border-white/20">
                    <span>Xuất phát</span>
                    <span className="inline-flex items-center gap-1">
                      <Flag size={11} />
                      <span>Vạch đích</span>
                    </span>
                  </div>

                  {ducks.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-white/90">
                      Chưa có học sinh nào trên đường đua.
                    </div>
                  ) : (
                    <div className="relative divide-y divide-white/20 max-h-[300px] overflow-y-auto pr-1 mt-1">
                      {/* Finish Checkered Line */}
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 right-5 w-2 opacity-80"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(0deg, #FFFFFF 0px, #FFFFFF 6px, #0F172A 6px, #0F172A 12px)',
                        }}
                        aria-hidden="true"
                      />

                      {ducks.map((duck, idx) => {
                        const isLeader = currentLeaderId === duck.id;
                        const bobY = isRacing && duck.finishedOrder === null ? Math.sin(duck.wobblePhase) * 2.5 : 0;
                        const tiltDeg = isRacing && duck.finishedOrder === null ? Math.cos(duck.wobblePhase) * 4 : 0;

                        return (
                          <div key={duck.id} className="relative h-11 flex items-center">
                            {/* Lane Number & Student Name Watermark */}
                            <div className="flex items-center gap-1.5 z-0 pointer-events-none pl-1">
                              <span className="w-5 h-5 rounded-md bg-slate-900/35 text-white font-mono font-bold text-[10px] flex items-center justify-center tabular-nums">
                                {idx + 1}
                              </span>
                              <span className="text-[11px] font-bold text-white/90 drop-shadow-xs truncate max-w-[140px]">
                                {duck.name}
                              </span>
                              {isLeader && (
                                <span className="text-[10px] font-black text-amber-200 drop-shadow-xs">
                                  · Dẫn đầu
                                </span>
                              )}
                            </div>

                            {/* Swimming Duck */}
                            <div
                              className="absolute top-1/2 z-10 flex items-center"
                              style={{
                                left: `calc(${duck.progress * 0.84}% + 4px)`,
                                transform: `translateY(calc(-50% + ${bobY}px)) rotate(${tiltDeg}deg)`,
                              }}
                            >
                              <RacingDuckSvg
                                bodyColor={duck.color}
                                hatColor={duck.hatColor}
                                number={idx + 1}
                                isBoosting={duck.boostTimer > 0 && duck.finishedOrder === null}
                              />
                            </div>

                            {/* Finish Rank Badge */}
                            {duck.finishedOrder !== null && duck.finishedOrder <= 3 && (
                              <span
                                className={`ml-auto mr-7 z-10 px-1.5 py-0.5 rounded font-mono font-black text-[10px] ${
                                  duck.finishedOrder === 1
                                    ? 'bg-amber-300 text-amber-950'
                                    : duck.finishedOrder === 2
                                    ? 'bg-slate-100 text-slate-800'
                                    : 'bg-orange-200 text-orange-950'
                                }`}
                              >
                                #{duck.finishedOrder}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live Podium during/after race */}
                {racePodium.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {racePodium.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 border ${
                          p.rank === 1
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <Trophy size={12} className={p.rank === 1 ? 'text-amber-500' : 'text-slate-400'} />
                        <span>
                          Hạng {p.rank}: {p.name}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {!winner && (
                  <button
                    type="button"
                    onClick={handleStartDuckRace}
                    disabled={isBusy || activeStudents.length === 0}
                    className="w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-45 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Flag size={14} />
                    <span>{isRacing ? 'Các chú vịt đang tăng tốc...' : 'Xuất Phát Đua Vịt'}</span>
                  </button>
                )}
              </div>
            ) : (
              /* FISHING POND STAGE */
              <LuckyFishingStage
                students={activeStudents}
                isBusy={isBusy}
                hasWinner={Boolean(winner)}
                castNonce={fishingCastNonce}
                onRequestCast={handleRequestFishingCast}
                onFishingStateChange={setIsFishing}
                onSplashSound={playSplashSound}
                onBiteSound={() => playTickSound(880)}
                onCatchComplete={handleFishingCatchComplete}
              />
            )}

            {/* Winner Banner (Shared for Wheel, Duck Race & Fishing) */}
            {winner && (
              <div className="w-full p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Award size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                      {winner.game === 'duck_race'
                        ? 'Vịt Về Đích Đầu Tiên'
                        : winner.game === 'fishing'
                        ? 'Cá Cắn Câu'
                        : 'Người Được Chọn'}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 block truncate">
                      {winner.label}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={
                    gameMode === 'wheel'
                      ? handleSpin
                      : gameMode === 'duck_race'
                      ? handleStartDuckRace
                      : handleRequestFishingCast
                  }
                  disabled={activeStudents.length === 0}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {gameMode === 'wheel'
                    ? 'Quay tiếp'
                    : gameMode === 'duck_race'
                    ? 'Đua ván mới'
                    : 'Thả câu tiếp'}
                </button>
              </div>
            )}
          </div>

          {/* Right: Class Student Roster & History */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-slate-900 inline-flex items-center gap-1.5">
                  <Users size={14} className="text-blue-600" />
                  <span>
                    Học sinh tham gia ({activeStudents.length}/{enrolledStudents.length})
                  </span>
                </span>
                {excludedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreAllStudents}
                    disabled={isBusy}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Khôi phục đủ</span>
                  </button>
                )}
              </div>

              {/* Toggle auto remove winner */}
              <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                <span className="text-[11px] font-semibold text-slate-700">
                  Tự động bỏ tên vừa thắng (không lặp lại)
                </span>
                <input
                  type="checkbox"
                  checked={removeAfterWin}
                  onChange={(e) => setRemoveAfterWin(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              {enrolledStudents.length === 0 ? (
                <div className="p-4 rounded-xl bg-white border border-dashed border-slate-200 text-center text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Lớp chưa có học sinh nào.</p>
                  <p className="text-[11px]">
                    {userRole === 'teacher'
                      ? 'Hãy thêm học sinh vào nhóm lớp để sử dụng Vòng quay, Đua vịt và Câu cá.'
                      : 'Khi lớp có thành viên tham gia, danh sách sẽ hiển thị tại đây.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {enrolledStudents.map((stu) => {
                    const isIncluded = !excludedStudentIds.includes(stu.id);
                    return (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() => handleToggleStudent(stu.id)}
                        disabled={isBusy}
                        className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isIncluded
                            ? 'bg-white border-slate-200 text-slate-900 hover:border-blue-300'
                            : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                        }`}
                      >
                        <span className="font-semibold truncate">{stu.name}</span>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                            isIncluded ? 'bg-blue-600 text-white' : 'bg-slate-200 text-transparent'
                          }`}
                        >
                          <Check size={11} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* History */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 inline-flex items-center gap-1.5">
                  <History size={14} className="text-blue-600" />
                  <span>Lịch sử Lucky lớp này</span>
                </span>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Xóa lịch sử
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="text-[11px] text-slate-400">Chưa có lượt chơi nào trong lớp này.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 pr-1">
                  {history.map((rec, i) => (
                    <div key={rec.id} className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-slate-800 truncate">
                          {i + 1}. {rec.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            rec.game === 'duck_race'
                              ? 'bg-amber-100 text-amber-800'
                              : rec.game === 'fishing'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {rec.game === 'duck_race'
                            ? 'Đua vịt'
                            : rec.game === 'fishing'
                            ? 'Câu cá'
                            : 'Vòng quay'}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400 tabular-nums shrink-0">
                        {new Date(rec.spunAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

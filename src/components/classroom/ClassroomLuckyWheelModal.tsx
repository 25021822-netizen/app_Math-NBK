import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile } from '../../types/math';
import {
  X,
  RotateCcw,
  Plus,
  Trash2,
  Users,
  Sparkles,
  Volume2,
  VolumeX,
  History,
  Check,
  Play,
  Award,
} from 'lucide-react';

interface ClassroomLuckyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  enrolledStudents: UserProfile[];
  userRole: string;
}

type WheelMode = 'students' | 'custom';

interface SpinRecord {
  id: string;
  label: string;
  mode: WheelMode;
  spunAt: string;
}

interface StoredWheelState {
  mode: WheelMode;
  customItems: string[];
  excludedStudentIds: string[];
  removeAfterWin: boolean;
  soundEnabled: boolean;
  history: SpinRecord[];
}

const DEFAULT_CUSTOM_ITEMS = [
  '+1 điểm cộng',
  'Miễn 1 lần kiểm tra',
  'Giải 1 bài tập mẫu',
  'Tràng pháo tay',
  'Chọn bạn trả lời thay',
  'Thưởng +50 XP',
];

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

export const ClassroomLuckyWheelModal: React.FC<ClassroomLuckyWheelModalProps> = ({
  isOpen,
  onClose,
  classId,
  className,
  enrolledStudents,
  userRole,
}) => {
  const storageKey = `mathnbk_lucky_wheel_${classId}`;

  const loadInitialState = (): StoredWheelState => {
    const defaultMode: WheelMode = enrolledStudents.length > 0 ? 'students' : 'custom';
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredWheelState>;
        return {
          mode: parsed.mode === 'custom' || parsed.mode === 'students' ? parsed.mode : defaultMode,
          customItems:
            Array.isArray(parsed.customItems) && parsed.customItems.length > 0
              ? parsed.customItems
              : DEFAULT_CUSTOM_ITEMS,
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
      mode: defaultMode,
      customItems: DEFAULT_CUSTOM_ITEMS,
      excludedStudentIds: [],
      removeAfterWin: false,
      soundEnabled: true,
      history: [],
    };
  };

  const [mode, setMode] = useState<WheelMode>(() => loadInitialState().mode);
  const [customItems, setCustomItems] = useState<string[]>(() => loadInitialState().customItems);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>(() => loadInitialState().excludedStudentIds);
  const [removeAfterWin, setRemoveAfterWin] = useState<boolean>(() => loadInitialState().removeAfterWin);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadInitialState().soundEnabled);
  const [history, setHistory] = useState<SpinRecord[]>(() => loadInitialState().history);

  const [newCustomItem, setNewCustomItem] = useState('');
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<{ id: string; label: string } | null>(null);

  const spinTimeoutRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sync state when switching classroom
  useEffect(() => {
    const next = loadInitialState();
    setMode(next.mode);
    setCustomItems(next.customItems);
    setExcludedStudentIds(next.excludedStudentIds);
    setRemoveAfterWin(next.removeAfterWin);
    setSoundEnabled(next.soundEnabled);
    setHistory(next.history);
    setWinner(null);
    setIsSpinning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // Persist per classroom
  useEffect(() => {
    try {
      const stateToSave: StoredWheelState = {
        mode,
        customItems,
        excludedStudentIds,
        removeAfterWin,
        soundEnabled,
        history: history.slice(0, 15),
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch {
      // ignore localStorage quota errors
    }
  }, [storageKey, mode, customItems, excludedStudentIds, removeAfterWin, soundEnabled, history]);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
    };
  }, []);

  const playTickSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // ignore audio context errors
    }
  };

  const playWinSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  const activeEntries = useMemo(() => {
    if (mode === 'students') {
      const excludedSet = new Set(excludedStudentIds);
      return enrolledStudents
        .filter((s) => !excludedSet.has(s.id))
        .map((s) => ({ id: s.id, label: s.name || s.id }));
    }
    return customItems
      .map((label, idx) => ({ id: `custom_${idx}_${label}`, label: label.trim() }))
      .filter((item) => item.label.length > 0);
  }, [mode, enrolledStudents, excludedStudentIds, customItems]);

  const handleSpin = () => {
    if (isSpinning || activeEntries.length === 0) return;

    setIsSpinning(true);
    setWinner(null);

    const n = activeEntries.length;
    const winningIdx = Math.floor(Math.random() * n);
    const chosenEntry = activeEntries[winningIdx];
    const sliceAngle = 360 / n;

    // Slice i spans [i * sliceAngle, (i + 1) * sliceAngle] clockwise from top (0 deg).
    // Rotating clockwise by R deg moves slice center from centerAngle to (centerAngle + R) mod 360.
    // We want (centerAngle + R) mod 360 === 0 => R mod 360 === (360 - centerAngle) mod 360.
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
      setWinner(chosenEntry);
      playWinSound();

      setHistory((prev) => [
        {
          id: `spin_${Date.now()}`,
          label: chosenEntry.label,
          mode,
          spunAt: new Date().toISOString(),
        },
        ...prev.slice(0, 14),
      ]);

      if (removeAfterWin && mode === 'students') {
        setExcludedStudentIds((prev) =>
          prev.includes(chosenEntry.id) ? prev : [...prev, chosenEntry.id]
        );
      }
    }, 4200);
  };

  const handleToggleStudent = (studentId: string) => {
    if (isSpinning) return;
    setExcludedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleRestoreAllStudents = () => {
    if (isSpinning) return;
    setExcludedStudentIds([]);
    setWinner(null);
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCustomItem.trim();
    if (!clean || isSpinning) return;
    setCustomItems((prev) => [...prev, clean]);
    setNewCustomItem('');
  };

  const handleDeleteCustomItem = (idx: number) => {
    if (isSpinning) return;
    setCustomItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResetCustomDefaults = () => {
    if (isSpinning) return;
    setCustomItems(DEFAULT_CUSTOM_ITEMS);
    setWinner(null);
  };

  if (!isOpen) return null;

  const cx = 160;
  const cy = 160;
  const radius = 148;
  const n = activeEntries.length;
  const sliceAngle = n > 0 ? 360 / n : 360;

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
                {mode === 'students'
                  ? `Gọi tên ngẫu nhiên (${activeEntries.length}/${enrolledStudents.length} học sinh trên vòng quay)`
                  : `Quay phần thưởng / thử thách (${activeEntries.length} mục)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'Tắt âm thanh vòng quay' : 'Bật âm thanh vòng quay'}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Đóng vòng quay may mắn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive Wheel */}
          <div className="lg:col-span-7 flex flex-col items-center space-y-4">
            {/* Mode Switcher */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => {
                  setMode('students');
                  setWinner(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  mode === 'students'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users size={14} />
                <span>Học sinh lớp ({enrolledStudents.length})</span>
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => {
                  setMode('custom');
                  setWinner(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  mode === 'custom'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={14} />
                <span>Tùy chỉnh mục quay</span>
              </button>
            </div>

            {/* Wheel Stage */}
            <div className="relative flex items-center justify-center pt-3 pb-1">
              {/* Top Pointer */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 z-20 drop-shadow-md"
                aria-hidden="true"
              >
                <svg width="28" height="28" viewBox="0 0 28 28">
                  <path
                    d="M14 27 L3 4 Q2 1 6 1 H22 Q26 1 25 4 Z"
                    fill="#DC2626"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Rotating Wheel SVG */}
              <div
                className="relative w-[290px] h-[290px] sm:w-[320px] sm:h-[320px] rounded-full shadow-lg border-4 border-slate-900 bg-slate-100 select-none"
              >
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
                        y={cy - 18}
                        textAnchor="middle"
                        fill="#475569"
                        fontSize="12"
                        fontWeight="700"
                      >
                        Chưa có mục nào để quay
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
                        {truncateLabel(activeEntries[0].label, 20)}
                      </text>
                    </g>
                  ) : (
                    activeEntries.map((entry, idx) => {
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
                  disabled={isSpinning || activeEntries.length === 0}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white hover:bg-amber-50 disabled:opacity-60 border-4 border-slate-900 shadow-lg flex flex-col items-center justify-center text-slate-900 font-black text-xs transition-transform active:scale-95 cursor-pointer z-10"
                >
                  <Play size={16} className="fill-blue-600 text-blue-600 ml-0.5" />
                  <span className="text-[10px] tracking-wider uppercase mt-0.5">
                    {isSpinning ? '...' : 'QUAY'}
                  </span>
                </button>
              </div>
            </div>

            {/* Winner Display */}
            {winner ? (
              <div className="w-full p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Award size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                      Kết Quả Vòng Quay
                    </span>
                    <span className="text-base font-extrabold text-slate-900 block truncate">
                      {winner.label}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSpin}
                  disabled={activeEntries.length === 0}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Quay tiếp
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSpin}
                disabled={isSpinning || activeEntries.length === 0}
                className="w-full max-w-xs py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Play size={14} className="fill-current" />
                <span>{isSpinning ? 'Đang quay...' : 'Bắt Đầu Quay May Mắn'}</span>
              </button>
            )}
          </div>

          {/* Right: Entries Manager & History */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            {mode === 'students' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-900">
                    Danh sách học sinh ({activeEntries.length}/{enrolledStudents.length})
                  </span>
                  {excludedStudentIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRestoreAllStudents}
                      disabled={isSpinning}
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
                    Tự động bỏ tên vừa trúng (không gọi lặp)
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
                        ? 'Hãy thêm học sinh vào lớp hoặc chuyển sang tab "Tùy chỉnh mục quay".'
                        : 'Bạn có thể chuyển sang tab "Tùy chỉnh mục quay" để quay phần thưởng.'}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {enrolledStudents.map((stu) => {
                      const isIncluded = !excludedStudentIds.includes(stu.id);
                      return (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => handleToggleStudent(stu.id)}
                          disabled={isSpinning}
                          className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isIncluded
                              ? 'bg-white border-slate-200 text-slate-900 hover:border-blue-300'
                              : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                          }`}
                        >
                          <span className="font-semibold truncate">{stu.name}</span>
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                              isIncluded
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-transparent'
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
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-900">
                    Các ô trên vòng quay ({customItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetCustomDefaults}
                    disabled={isSpinning}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Mặc định</span>
                  </button>
                </div>

                <form onSubmit={handleAddCustomItem} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCustomItem}
                    onChange={(e) => setNewCustomItem(e.target.value)}
                    placeholder="Thêm tên / phần thưởng / câu hỏi..."
                    maxLength={60}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!newCustomItem.trim() || isSpinning}
                    className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-bold text-xs inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Thêm</span>
                  </button>
                </form>

                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {customItems.map((item, idx) => (
                    <div
                      key={`${idx}_${item}`}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: WHEEL_COLORS[idx % WHEEL_COLORS.length].fill }}
                        />
                        <span className="font-semibold text-slate-800 truncate">{item}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomItem(idx)}
                        disabled={isSpinning || customItems.length <= 1}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                        title="Xóa mục này"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spin History */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 inline-flex items-center gap-1.5">
                  <History size={14} className="text-blue-600" />
                  <span>Lịch sử quay lớp này</span>
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
                <p className="text-[11px] text-slate-400">Chưa có lượt quay nào trong lớp này.</p>
              ) : (
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 pr-1">
                  {history.map((rec, i) => (
                    <div key={rec.id} className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-slate-800 truncate">
                        {i + 1}. {rec.label}
                      </span>
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

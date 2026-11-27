import React, { useEffect, useRef } from 'react';

interface ConfettiCelebrationProps {
  active: boolean;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  gravity: number;
  drag: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle' | 'ribbon';
  wobble: number;
  wobbleSpeed: number;
}

const CONFETTI_COLORS = [
  '#2563EB', // blue
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EC4899', // pink
  '#7C3AED', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
];

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({ active, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onComplete?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];

    const spawnCannon = (originX: number, originY: number, baseAngleDeg: number, spreadDeg: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = ((baseAngleDeg + (Math.random() - 0.5) * spreadDeg) * Math.PI) / 180;
        const speed = 7 + Math.random() * 11;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 6 + Math.random() * 6,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          alpha: 1,
          decay: 0.006 + Math.random() * 0.005,
          gravity: 0.22,
          drag: 0.985,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.25,
          shape: i % 5 === 0 ? 'circle' : i % 2 === 0 ? 'ribbon' : 'rect',
          wobble: Math.random() * 10,
          wobbleSpeed: 0.08 + Math.random() * 0.08,
        });
      }
    };

    const spawnFireworkBurst = (cx: number, cy: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
        const speed = 2.5 + Math.random() * 6.5;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 5,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          alpha: 1,
          decay: 0.011 + Math.random() * 0.006,
          gravity: 0.14,
          drag: 0.97,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          shape: i % 2 === 0 ? 'circle' : 'rect',
          wobble: Math.random() * 10,
          wobbleSpeed: 0.1,
        });
      }
    };

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Initial twin cannons + center firework
    spawnCannon(w * 0.12, h * 0.85, -62, 34, 55);
    spawnCannon(w * 0.88, h * 0.85, -118, 34, 55);
    spawnFireworkBurst(w * 0.5, h * 0.28, 48);

    const t1 = window.setTimeout(() => {
      spawnFireworkBurst(window.innerWidth * 0.28, window.innerHeight * 0.24, 36);
      spawnFireworkBurst(window.innerWidth * 0.72, window.innerHeight * 0.24, 36);
    }, 420);

    const t2 = window.setTimeout(() => {
      spawnCannon(window.innerWidth * 0.5, 0, 90, 120, 45);
    }, 850);

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y > window.innerHeight + 40) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x + Math.sin(p.wobble) * 2, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'ribbon') {
          ctx.fillRect(-p.size * 0.6, -p.size * 0.22, p.size * 1.2, p.size * 0.44);
        } else {
          ctx.fillRect(-p.size * 0.45, -p.size * 0.45, p.size * 0.9, p.size * 0.9);
        }
        ctx.restore();
      }

      if (particles.length > 0 && now - startTime < 4600) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        onComplete?.();
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-50"
    />
  );
};

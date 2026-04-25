'use client';

import { useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GlowStar {
  x: number;
  y: number;
  r: number;
  opacity: number;
  speed: number;
  phase: number;
  vx: number;
  vy: number;
  type: 'glow' | 'sparkle' | 'tiny';
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

// Glowing circle — matches the constellation nodes in the logo
function drawGlowStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  // Outer halo
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
  halo.addColorStop(0, `rgba(140,210,255,${alpha * 0.25})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Core glow
  const core = ctx.createRadialGradient(x, y, 0, x, y, r);
  core.addColorStop(0, `rgba(220,240,255,${alpha})`);
  core.addColorStop(0.45, `rgba(100,190,255,${alpha * 0.85})`);
  core.addColorStop(1, `rgba(40,120,220,${alpha * 0.3})`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 4-point sparkle — matches the decorative stars in the logo
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Outer glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
  glow.addColorStop(0, 'rgba(160,220,255,0.3)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 4-point star shape — thin elongated diamond arms
  ctx.fillStyle = 'rgba(200,235,255,1)';
  ctx.beginPath();
  // Top arm
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r * 0.18, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r * 0.18, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();

  // Horizontal arm (shorter)
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y);
  ctx.quadraticCurveTo(x - r * 0.08, y - r * 0.08, x, y - r * 0.14);
  ctx.quadraticCurveTo(x + r * 0.08, y - r * 0.08, x + r * 0.7, y);
  ctx.quadraticCurveTo(x + r * 0.08, y + r * 0.08, x, y + r * 0.14);
  ctx.quadraticCurveTo(x - r * 0.08, y + r * 0.08, x - r * 0.7, y);
  ctx.fill();

  ctx.restore();
}

// Tiny dot — background fill
function drawTiny(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle = `rgba(${140 + Math.random() * 60 | 0},${200 + Math.random() * 40 | 0},255,1)`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SplashScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    // Generate stars — logo-style blue glowing circles + sparkles + tiny dots
    const stars: GlowStar[] = Array.from({ length: 110 }, () => {
      const roll = Math.random();
      const type: GlowStar['type'] = roll < 0.06 ? 'sparkle' : roll < 0.28 ? 'glow' : 'tiny';
      return {
        x: Math.random() * W(),
        y: Math.random() * H(),
        r: type === 'sparkle' ? 4 + Math.random() * 5
          : type === 'glow' ? 2 + Math.random() * 4
          : 0.6 + Math.random() * 1.4,
        opacity: type === 'tiny' ? 0.2 + Math.random() * 0.5 : 0.4 + Math.random() * 0.6,
        speed: 0.25 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        type,
      };
    });

    let t = 0;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W(), H());

      // Background
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, W(), H());

      // Nebula — blue tint matching logo background
      const nebula = ctx.createRadialGradient(W() * 0.55, H() * 0.45, 0, W() * 0.55, H() * 0.45, W() * 0.7);
      nebula.addColorStop(0, 'rgba(10,40,100,0.22)');
      nebula.addColorStop(0.4, 'rgba(5,20,60,0.12)');
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, W(), H());

      // Draw stars
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -30) s.x = W() + 30;
        if (s.x > W() + 30) s.x = -30;
        if (s.y < -30) s.y = H() + 30;
        if (s.y > H() + 30) s.y = -30;

        const twinkle = s.opacity * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));

        if (s.type === 'sparkle') {
          drawSparkle(ctx, s.x, s.y, s.r, twinkle);
        } else if (s.type === 'glow') {
          drawGlowStar(ctx, s.x, s.y, s.r, twinkle);
        } else {
          drawTiny(ctx, s.x, s.y, s.r, twinkle);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#080c14]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Logo with vignette */}
        <div className="relative">
          {/* Radial vignette — fades corners into dark bg */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 2,
              borderRadius: 24,
              background: 'radial-gradient(ellipse at center, transparent 42%, #080c14 100%)',
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Memo"
            className="relative block"
            style={{
              width: 96,
              height: 'auto',
              borderRadius: 24,
              filter: 'drop-shadow(0 0 28px rgba(80,170,255,0.45))',
            }}
          />
        </div>

        {/* Skeleton text lines */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-2.5 rounded-full bg-white/8" style={{ width: 80 }} />
          <div className="h-2 rounded-full bg-white/5" style={{ width: 52 }} />
        </div>
      </div>
    </div>
  );
}

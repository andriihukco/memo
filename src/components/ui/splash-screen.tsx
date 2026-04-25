'use client';

import { useEffect, useRef } from 'react';

// ── Star particle types ───────────────────────────────────────────────────────

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  speed: number;       // twinkle speed
  phase: number;       // twinkle phase offset
  type: 'dot' | 'cross' | 'spark';
  vx: number;          // drift velocity
  vy: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;        // 0–1
  decay: number;
  r: number;
  hue: number;
}

// ── Canvas star field ─────────────────────────────────────────────────────────

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.35;
  ctx.lineCap = 'round';
  // Main cross
  ctx.beginPath();
  ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
  ctx.stroke();
  // Diagonal arms (shorter)
  ctx.lineWidth = r * 0.2;
  const d = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
  ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
  ctx.stroke();
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(180,200,255,0.8)');
  grad.addColorStop(1, 'rgba(100,140,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSparkParticle(ctx: CanvasRenderingContext2D, s: Spark) {
  ctx.save();
  ctx.globalAlpha = s.life * 0.9;
  const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
  grad.addColorStop(0, `hsla(${s.hue},100%,90%,1)`);
  grad.addColorStop(1, `hsla(${s.hue},100%,60%,0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

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

    // Generate stars
    const COUNT = 120;
    const stars: Star[] = Array.from({ length: COUNT }, () => {
      const type = Math.random() < 0.15 ? 'cross' : Math.random() < 0.08 ? 'spark' : 'dot';
      return {
        x: Math.random() * W(),
        y: Math.random() * H(),
        r: type === 'cross' ? 3 + Math.random() * 5 : type === 'spark' ? 1.5 + Math.random() * 2.5 : 0.5 + Math.random() * 2.5,
        opacity: 0.3 + Math.random() * 0.7,
        speed: 0.3 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        type,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
      };
    });

    const sparks: Spark[] = [];

    // Periodically emit spark bursts
    const emitBurst = () => {
      const x = Math.random() * W();
      const y = Math.random() * H();
      const n = 6 + Math.floor(Math.random() * 8);
      const hue = Math.random() < 0.5 ? 220 + Math.random() * 40 : 40 + Math.random() * 30;
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        const speed = 0.4 + Math.random() * 1.2;
        sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.012 + Math.random() * 0.018,
          r: 1.5 + Math.random() * 2.5,
          hue,
        });
      }
    };

    const burstInterval = setInterval(emitBurst, 1200);
    emitBurst(); // immediate first burst

    let t = 0;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W(), H());

      // Background — deep dark
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, W(), H());

      // Subtle nebula glow in center
      const nebula = ctx.createRadialGradient(W() / 2, H() / 2, 0, W() / 2, H() / 2, W() * 0.6);
      nebula.addColorStop(0, 'rgba(30,50,120,0.18)');
      nebula.addColorStop(0.5, 'rgba(10,20,60,0.08)');
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, W(), H());

      // Draw stars
      for (const s of stars) {
        // Drift
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -20) s.x = W() + 20;
        if (s.x > W() + 20) s.x = -20;
        if (s.y < -20) s.y = H() + 20;
        if (s.y > H() + 20) s.y = -20;

        // Twinkle
        const twinkle = s.opacity * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase));

        if (s.type === 'cross') {
          drawCross(ctx, s.x, s.y, s.r, twinkle);
        } else {
          drawDot(ctx, s.x, s.y, s.r, twinkle);
        }
      }

      // Draw spark particles
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.015; // gentle gravity
        sp.life -= sp.decay;
        if (sp.life <= 0) { sparks.splice(i, 1); continue; }
        drawSparkParticle(ctx, sp);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(burstInterval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#080c14]">
      {/* Star canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Logo + shimmer */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Logo with shimmer skeleton effect */}
        <div className="relative">
          {/* Radial vignette — fades corners into the dark background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 2,
              borderRadius: 24,
              background: 'radial-gradient(ellipse at center, transparent 45%, #080c14 100%)',
            }}
          />
          {/* Shimmer overlay */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{ zIndex: 1 }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
          </div>
          {/* Logo image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Memo"
            className="relative block"
            style={{
              width: 96,
              height: 'auto',
              borderRadius: 24,
              filter: 'drop-shadow(0 0 24px rgba(71,151,255,0.35))',
            }}
          />
        </div>

        {/* Skeleton text lines */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="h-2.5 rounded-full bg-white/10 overflow-hidden"
            style={{ width: 80 }}
          >
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.8s ease-in-out infinite 0.2s',
              }}
            />
          </div>
          <div
            className="h-2 rounded-full bg-white/6 overflow-hidden"
            style={{ width: 52 }}
          >
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.8s ease-in-out infinite 0.5s',
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
}

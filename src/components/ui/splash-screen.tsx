'use client';

import { useEffect, useRef, useState } from 'react';

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

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  alpha: number;
  life: number;       // 0→1 progress
  maxLife: number;    // frames
  active: boolean;
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawGlowStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
  halo.addColorStop(0, `rgba(140,210,255,${alpha * 0.25})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
  ctx.fill();

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

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
  glow.addColorStop(0, 'rgba(160,220,255,0.3)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(200,235,255,1)';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r * 0.18, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r * 0.18, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y);
  ctx.quadraticCurveTo(x - r * 0.08, y - r * 0.08, x, y - r * 0.14);
  ctx.quadraticCurveTo(x + r * 0.08, y - r * 0.08, x + r * 0.7, y);
  ctx.quadraticCurveTo(x + r * 0.08, y + r * 0.08, x, y + r * 0.14);
  ctx.quadraticCurveTo(x - r * 0.08, y + r * 0.08, x - r * 0.7, y);
  ctx.fill();

  ctx.restore();
}

function drawTiny(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle = `rgba(${140 + Math.random() * 60 | 0},${200 + Math.random() * 40 | 0},255,1)`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShootingStar(ctx: CanvasRenderingContext2D, s: ShootingStar) {
  // Fade in for first 20% of life, fade out for last 30%
  const fadeIn  = Math.min(s.life / 0.2, 1);
  const fadeOut = s.life > 0.7 ? 1 - (s.life - 0.7) / 0.3 : 1;
  const alpha   = s.alpha * fadeIn * fadeOut;
  if (alpha <= 0) return;

  const tailX = s.x - s.vx * s.len;
  const tailY = s.y - s.vy * s.len;

  const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
  grad.addColorStop(0, `rgba(180,230,255,0)`);
  grad.addColorStop(0.6, `rgba(200,235,255,${alpha * 0.5})`);
  grad.addColorStop(1, `rgba(230,245,255,${alpha})`);

  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(s.x, s.y);
  ctx.stroke();

  // Bright head dot
  ctx.globalAlpha = alpha;
  const headGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 3);
  headGlow.addColorStop(0, 'rgba(255,255,255,1)');
  headGlow.addColorStop(1, 'rgba(140,210,255,0)');
  ctx.fillStyle = headGlow;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function spawnShootingStar(W: number, H: number): ShootingStar {
  // Always enter from top or left edges, travel diagonally down-right
  const fromTop = Math.random() < 0.6;
  const angle = (Math.PI / 4) + (Math.random() - 0.5) * (Math.PI / 6); // ~45° ± 15°
  const speed = 6 + Math.random() * 8;
  return {
    x: fromTop ? Math.random() * W : 0,
    y: fromTop ? 0 : Math.random() * H * 0.5,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len: 40 + Math.random() * 60,
    alpha: 0.6 + Math.random() * 0.4,
    life: 0,
    maxLife: 55 + Math.random() * 35,
    active: true,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SplashScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const [dots, setDots] = useState(1);

  // Cycling dots: . → .. → ... → . every 500ms
  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => d >= 3 ? 1 : d + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    // Background stars
    const stars: GlowStar[] = Array.from({ length: 110 }, () => {
      const roll = Math.random();
      const type: GlowStar['type'] = roll < 0.06 ? 'sparkle' : roll < 0.28 ? 'glow' : 'tiny';
      return {
        x: Math.random() * W(),
        y: Math.random() * H(),
        r: type === 'sparkle' ? 4 + Math.random() * 5
          : type === 'glow'    ? 2 + Math.random() * 4
          : 0.6 + Math.random() * 1.4,
        opacity: type === 'tiny' ? 0.2 + Math.random() * 0.5 : 0.4 + Math.random() * 0.6,
        speed: 0.25 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        type,
      };
    });

    // Shooting stars pool
    const shooters: ShootingStar[] = [];
    let nextShooterIn = 60 + Math.random() * 80; // frames until next spawn

    let t = 0;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W(), H());

      // Background
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, W(), H());

      // Nebula — breathes slowly
      const nebulaPulse = 0.18 + 0.04 * Math.sin(t * 0.4);
      const nebula = ctx.createRadialGradient(W() * 0.55, H() * 0.45, 0, W() * 0.55, H() * 0.45, W() * 0.7);
      nebula.addColorStop(0, `rgba(10,40,100,${nebulaPulse})`);
      nebula.addColorStop(0.4, `rgba(5,20,60,${nebulaPulse * 0.55})`);
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, W(), H());

      // Secondary nebula accent — drifts slightly
      const nx2 = W() * 0.25 + Math.sin(t * 0.18) * W() * 0.04;
      const ny2 = H() * 0.65 + Math.cos(t * 0.14) * H() * 0.03;
      const nebula2 = ctx.createRadialGradient(nx2, ny2, 0, nx2, ny2, W() * 0.45);
      nebula2.addColorStop(0, `rgba(20,10,80,${0.12 + 0.03 * Math.sin(t * 0.3)})`);
      nebula2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, W(), H());

      // Background stars
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -30) s.x = W() + 30;
        if (s.x > W() + 30) s.x = -30;
        if (s.y < -30) s.y = H() + 30;
        if (s.y > H() + 30) s.y = -30;

        const twinkle = s.opacity * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));

        if (s.type === 'sparkle') drawSparkle(ctx, s.x, s.y, s.r, twinkle);
        else if (s.type === 'glow') drawGlowStar(ctx, s.x, s.y, s.r, twinkle);
        else drawTiny(ctx, s.x, s.y, s.r, twinkle);
      }

      // Shooting stars
      nextShooterIn--;
      if (nextShooterIn <= 0) {
        shooters.push(spawnShootingStar(W(), H()));
        nextShooterIn = 90 + Math.random() * 120;
      }

      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.life = Math.min(s.life + 1 / s.maxLife, 1);
        s.x += s.vx;
        s.y += s.vy;
        drawShootingStar(ctx, s);
        if (s.life >= 1) shooters.splice(i, 1);
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
        {/* Logo with pulsing glow */}
        <div
          className="relative"
          style={{
            animation: 'splashLogoGlow 3s ease-in-out infinite',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Memo"
            className="block"
            style={{
              width: 96,
              height: 'auto',
              filter: 'drop-shadow(0 0 28px rgba(80,170,255,0.45))',
            }}
          />
        </div>

        {/* Loading text with cycling dots */}
        <p
          style={{
            fontFamily: "'Comfortaa', 'Mulish', sans-serif",
            fontSize: 14,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.01em',
            minWidth: '13ch',   // prevent layout shift as dots change
            textAlign: 'left',
          }}
        >
          Запускаємо пам&apos;ять{'.'.repeat(dots)}
        </p>
      </div>

      <style>{`
        @keyframes splashLogoGlow {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(80,170,255,0.35)); }
          50%       { filter: drop-shadow(0 0 38px rgba(80,170,255,0.70)); }
        }
      `}</style>
    </div>
  );
}

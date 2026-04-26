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

      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Animated M constellation logo */}
        <svg viewBox="0 0 220 280" style={{ width: 140, overflow: 'visible', filter: 'drop-shadow(0 0 24px rgba(163,228,255,0.35))' }}>
          <defs>
            <style>{`
              @keyframes mDotJiggle {
                0%,100% { transform: translate(0,0); }
                33% { transform: translate(2px,-2px); }
                66% { transform: translate(-1px,1px); }
              }
              @keyframes svgShimmer {
                0%,100% { opacity:0.3; transform:scale(0.8); }
                50% { opacity:1; transform:scale(1.2); }
              }
              @keyframes svgDrift0 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(4px,-6px)} 50%{transform:translate(-3px,-4px)} 75%{transform:translate(5px,3px)} }
              @keyframes svgDrift1 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-5px,4px)} 50%{transform:translate(3px,6px)} 75%{transform:translate(-4px,-3px)} }
              @keyframes svgDrift2 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(6px,3px)} 50%{transform:translate(-4px,5px)} 75%{transform:translate(2px,-6px)} }
              @keyframes svgDrift3 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-3px,-5px)} 50%{transform:translate(5px,-2px)} 75%{transform:translate(-6px,4px)} }
              @keyframes svgDrift4 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(2px,7px)} 50%{transform:translate(-6px,2px)} 75%{transform:translate(4px,-5px)} }
              @keyframes svgDrift5 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-7px,-2px)} 50%{transform:translate(4px,-5px)} 75%{transform:translate(-2px,6px)} }
              @keyframes svgDrift6 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(5px,-4px)} 50%{transform:translate(-2px,7px)} 75%{transform:translate(6px,2px)} }
              @keyframes svgDrift7 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-4px,5px)} 50%{transform:translate(7px,-3px)} 75%{transform:translate(-5px,-4px)} }
            `}</style>
          </defs>

          {/* Drifting bg stars */}
          {([
            { cx:30,  cy:40,  r:1,   dur:'7s',   delay:'0s',   anim:'svgDrift0' },
            { cx:190, cy:110, r:1.2, dur:'9s',   delay:'0.5s', anim:'svgDrift1' },
            { cx:50,  cy:220, r:0.8, dur:'8s',   delay:'1.2s', anim:'svgDrift2' },
            { cx:170, cy:240, r:1,   dur:'11s',  delay:'0.8s', anim:'svgDrift3' },
            { cx:20,  cy:150, r:1.1, dur:'6s',   delay:'2s',   anim:'svgDrift4' },
            { cx:200, cy:60,  r:0.9, dur:'10s',  delay:'1.5s', anim:'svgDrift5' },
            { cx:110, cy:20,  r:1,   dur:'8.5s', delay:'0.3s', anim:'svgDrift6' },
            { cx:80,  cy:250, r:0.7, dur:'7.5s', delay:'2.2s', anim:'svgDrift7' },
          ] as { cx:number; cy:number; r:number; dur:string; delay:string; anim:string }[]).map((s, i) => (
            <circle key={i} fill="#a3e4ff" cx={s.cx} cy={s.cy} r={s.r}
              style={{ animation: `${s.anim} ${s.dur} ease-in-out infinite, svgShimmer ${s.dur} ease-in-out infinite`, animationDelay: s.delay }} />
          ))}

          {/* M path */}
          <path stroke="rgba(163,228,255,0.5)" strokeWidth="2.5" strokeLinecap="round" fill="none"
            d="M 45,185 L 75,85 L 110,155 L 145,85 L 175,185" />

          {/* M dots */}
          {([
            [45,185,0],[55,152,-1],[65,118,-2],[75,85,0],
            [93,120,-1.5],[110,155,0],[127,120,-0.5],[145,85,0],
            [155,118,-2.5],[165,152,-1.2],[175,185,0],
          ] as [number,number,number][]).map(([cx,cy,delay],i) => (
            <circle key={i} fill="#a3e4ff" cx={cx} cy={cy} r="7.5"
              style={{ animation: `mDotJiggle 5s ease-in-out infinite`, animationDelay: `${delay}s` }} />
          ))}

          {/* Accent sparkle stars */}
          <path fill="#a3e4ff" style={{ filter:'drop-shadow(0 0 3px rgba(163,228,255,0.8))' }}
            d="M175,30 L178,42 L190,45 L178,48 L175,60 L172,48 L160,45 L172,42 Z" opacity="0.9" />
          <path fill="#a3e4ff" style={{ filter:'drop-shadow(0 0 3px rgba(163,228,255,0.8))' }}
            d="M85,185 L87,192 L94,194 L87,196 L85,203 L83,196 L76,194 L83,192 Z" opacity="0.7" />
          <path fill="#a3e4ff" style={{ filter:'drop-shadow(0 0 3px rgba(163,228,255,0.8))' }}
            d="M40,55 L42,60 L47,61 L42,62 L40,67 L38,62 L33,61 L38,60 Z" opacity="0.8" />
          <rect fill="#a3e4ff" x="195" y="180" width="4" height="4" transform="rotate(45 197 182)"
            style={{ animation: 'svgShimmer 9s ease-in-out infinite', animationDelay: '1s' }} />
          <rect fill="#a3e4ff" x="25" y="110" width="3" height="3" transform="rotate(45 26.5 111.5)"
            style={{ animation: 'svgShimmer 7s ease-in-out infinite', animationDelay: '0.4s' }} />
        </svg>

        {/* Brand name */}
        <p style={{
          fontFamily: "'Comfortaa', 'Mulish', sans-serif",
          fontSize: 36,
          fontWeight: 300,
          letterSpacing: '0.18em',
          color: '#a3e4ff',
          textTransform: 'lowercase',
          textShadow: '0 0 20px rgba(163,228,255,0.4)',
          marginTop: -8,
        }}>
          memo
        </p>
      </div>
    </div>
  );
}

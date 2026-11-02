'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Hero sky drawn by one WebGL fragment shader: gradient sky, stars and two layers of
 * lit fbm clouds. No Three.js. Day and night blend through `uNight` when the theme changes.
 *
 * Cost control: renders below device resolution (clouds are soft), stops when off screen or when
 * the tab is hidden, and draws single static frames under prefers-reduced-motion.
 * When WebGL is missing the canvas stays empty and the section's flat colour shows.
 */

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uNight;
uniform vec2 uPointer;
uniform vec3 uHaze; // xy centre in px (y up), z radius in px

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

// Cloud density for one layer, plus a cheap light term sampled towards the light.
vec2 clouds(vec2 p, float speed, float cover, vec2 toLight) {
  vec2 q = p + vec2(uTime * speed, 0.0);
  float warp = fbm(q * 0.7 + vec2(0.0, uTime * 0.004));
  float n = fbm(q + warp * 0.9);
  float d = smoothstep(cover, cover + 0.3, n);
  float lit = clamp((n - fbm(q + warp * 0.9 + toLight * 0.06)) * 5.0 + 0.55, 0.0, 1.0);
  return vec2(d, lit);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 par = uPointer * 0.015;

  // Sky
  vec3 dayTop = vec3(0.50, 0.68, 0.90);
  vec3 dayHor = vec3(0.90, 0.96, 1.00);
  vec3 nightTop = vec3(0.015, 0.02, 0.06);
  vec3 nightHor = vec3(0.10, 0.09, 0.20);
  float t = smoothstep(0.0, 1.0, uv.y);
  vec3 sky = mix(mix(dayHor, dayTop, t), mix(nightHor, nightTop, t), uNight);

  // No sun or moon. Light for the clouds comes from a fixed point high on the right.
  vec2 lightC = vec2(aspect * 0.85, 1.15) + par * 2.0;

  // Stars, fixed to pixels so density is the same on every screen. Night only.
  vec2 g = gl_FragCoord.xy / 7.0;
  vec2 id = floor(g);
  float h = hash(id);
  vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float star = smoothstep(0.09, 0.0, length(fract(g) - 0.5 - off * 0.6)) * step(0.982, h);
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + h * 2.5) + h * 40.0);
  float starMask = smoothstep(0.2, 0.7, uv.y) * uNight;
  sky += vec3(1.0) * star * twinkle * starMask;

  // Clouds: a far thin layer and a near full layer, lit from the fixed light point.

  vec2 far = clouds(vec2(p.x * 2.2, p.y * 5.0) + par, 0.010, 0.44, normalize(lightC - p));
  vec2 near = clouds(vec2(p.x * 1.3, p.y * 3.2) + par * 2.5 + 11.0, 0.022, 0.40, normalize(lightC - p));
  float farMask = smoothstep(0.3, 0.6, uv.y) * (1.0 - smoothstep(0.92, 1.0, uv.y));
  float nearMask = 1.0 - smoothstep(0.25, 0.6, uv.y);

  vec3 litDay = vec3(1.0, 0.99, 0.97); vec3 shadeDay = vec3(0.70, 0.75, 0.86);
  vec3 litNight = vec3(0.40, 0.42, 0.56); vec3 shadeNight = vec3(0.08, 0.09, 0.16);
  vec3 lit = mix(litDay, litNight, uNight);
  vec3 shade = mix(shadeDay, shadeNight, uNight);

  sky = mix(sky, mix(shade, lit, far.y) , far.x * farMask * mix(0.65, 0.5, uNight));
  sky = mix(sky, mix(shade, lit, near.y) , near.x * nearMask * mix(0.95, 0.8, uNight));

  // Haze behind the hero copy keeps the heading readable on any cloud.
  float haze = exp(-pow(length(gl_FragCoord.xy - uHaze.xy) / max(uHaze.z, 1.0), 2.0));
  sky = mix(sky, mix(vec3(0.93, 0.97, 1.00), vec3(0.02, 0.025, 0.07), uNight), haze * 0.45);

  // Dither against banding.
  sky += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(sky, 1.0);
}
`;

/** Base curve from the landing skill, cubic-bezier(0.22, 1, 0.36, 1), solved for y at time x. */
function ease(x: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const s = (lo + hi) / 2;
    const bx = 3 * (1 - s) ** 2 * s * 0.22 + 3 * (1 - s) * s ** 2 * 0.36 + s ** 3;
    if (bx < x) lo = s;
    else hi = s;
  }
  const s = (lo + hi) / 2;
  return 3 * (1 - s) ** 2 * s * 1 + 3 * (1 - s) * s ** 2 * 1 + s ** 3;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[sky] shader compile failed', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

const isDark = () => document.documentElement.classList.contains('dark');

export function SkyCanvas({ hazeRef }: { hazeRef?: RefObject<HTMLElement> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.parentElement;
    if (!canvas || !section) return;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      night: gl.getUniformLocation(prog, 'uNight'),
      pointer: gl.getUniformLocation(prog, 'uPointer'),
      haze: gl.getUniformLocation(prog, 'uHaze'),
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let scale = 1;
    let night = isDark() ? 1 : 0;
    let nightFrom = night;
    let nightTo = night;
    let nightStart = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let visible = true;
    let frame = 0;
    const t0 = performance.now();

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      // About 0.75 of CSS pixels, capped near 1.1 MP: clouds are soft and stars stay crisp enough.
      const px = rect.width * rect.height;
      scale = Math.min(0.75 * Math.min(window.devicePixelRatio || 1, 2), Math.sqrt(1_100_000 / Math.max(px, 1)));
      canvas!.width = Math.max(1, Math.round(rect.width * scale));
      canvas!.height = Math.max(1, Math.round(rect.height * scale));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      if (!running()) draw(performance.now());
    }

    function hazeUniform() {
      const target = hazeRef?.current;
      if (!target) return [0, 0, 0];
      const c = canvas!.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const x = (r.left + r.width / 2 - c.left) * scale;
      const y = (c.bottom - (r.top + r.height / 2)) * scale;
      return [x, y, Math.max(r.width, r.height) * 0.6 * scale];
    }

    function draw(now: number) {
      if (nightFrom !== nightTo) {
        const k = Math.min(1, (now - nightStart) / 1200);
        night = nightFrom + (nightTo - nightFrom) * ease(k);
        if (k >= 1) nightFrom = nightTo;
      }
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      const [hx, hy, hr] = hazeUniform();
      gl!.uniform2f(u.res, canvas!.width, canvas!.height);
      gl!.uniform1f(u.time, reduced.matches ? 40 : (now - t0) / 1000 + 40);
      gl!.uniform1f(u.night, night);
      gl!.uniform2f(u.pointer, pointer.x, pointer.y);
      gl!.uniform3f(u.haze, hx, hy, hr);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    const running = () => visible && !document.hidden && (!reduced.matches || nightFrom !== nightTo);

    function loop(now: number) {
      draw(now);
      frame = running() ? requestAnimationFrame(loop) : 0;
    }
    function kick() {
      if (!frame && running()) frame = requestAnimationFrame(loop);
      else if (!running()) draw(performance.now());
    }

    const themeObserver = new MutationObserver(() => {
      const target = isDark() ? 1 : 0;
      if (target === nightTo) return;
      nightFrom = night;
      nightTo = target;
      nightStart = performance.now();
      if (reduced.matches) {
        night = nightFrom = target;
        draw(performance.now());
        return;
      }
      kick();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(canvas);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function onMove(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return;
      const r = section!.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    }
    section.addEventListener('pointermove', onMove);
    document.addEventListener('visibilitychange', kick);
    reduced.addEventListener('change', kick);

    resize();
    kick();

    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      io.disconnect();
      ro.disconnect();
      section.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', kick);
      reduced.removeEventListener('change', kick);
      // Free GL objects but keep the context: React may mount again on the same canvas.
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [hazeRef]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 -z-10 size-full" />;
}

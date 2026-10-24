import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8');

function tokens(selector: string): Record<string, [number, number, number]> {
  const m = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no ${selector} block`);
  const out: Record<string, [number, number, number]> = {};
  for (const [, name, h, s, l] of m[1].matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g)) {
    out[name] = [Number(h), Number(s) / 100, Number(l) / 100];
  }
  return out;
}

function hslToRgb([h, s, l]: [number, number, number]): number[] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance(hsl: [number, number, number]): number {
  const [r, g, b] = hslToRgb(hsl).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT: [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['primary', 'background'],
  ['destructive', 'background'],
  ['destructive-foreground', 'destructive'],
  ['success', 'background'],
  ['warning', 'background'],
];
const NON_TEXT: [string, string][] = [
  ['input', 'background'],
  ['ring', 'background'],
];

describe.each([[':root'], ['.dark']])('contrast %s', (sel) => {
  const t = tokens(sel);
  it.each(TEXT)('%s on %s >= 4.5', (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(NON_TEXT)('%s on %s >= 3', (fg, bg) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});

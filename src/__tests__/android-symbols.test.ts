import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Expo app draws icons with SF Symbols, which exist on iOS only. mobile/src/components/symbol.tsx
 * maps each one to a Material Symbol for Android. This test finds every SF name the app passes to an
 * icon and fails if one has no Android mapping, or if a mapping points at a name the font lacks.
 */
const MOBILE = join(__dirname, '..', '..', 'mobile');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') return [];
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const SOURCES = [
  ...walk(join(MOBILE, 'app')),
  ...walk(join(MOBILE, 'src', 'components')),
  ...walk(join(MOBILE, 'src', 'screens')),
  join(MOBILE, 'src', 'lib', 'category-meta.ts'),
].filter((f) => !f.endsWith('symbol.tsx'));

function usedSymbols(): Map<string, string> {
  const used = new Map<string, string>();
  const add = (name: string, file: string) => used.set(name, file.replace(MOBILE, 'mobile'));
  for (const file of SOURCES) {
    const src = readFileSync(file, 'utf8');
    // <Symbol name="x" />, <Tool symbol="x" />, <Empty icon="x" /> (route names like <Tabs.Screen name="index"> are not icons)
    for (const m of src.matchAll(/<Symbol\b[^>]*?\bname="([a-z0-9.]+)"/gs)) add(m[1], file);
    for (const m of src.matchAll(/\b(?:symbol|icon)="([a-z0-9.]+)"/g)) add(m[1], file);
    // { icon: 'x' }, { iconActive: 'x' }, { symbol: 'x' }
    for (const m of src.matchAll(/\b(?:icon|iconActive|symbol)\s*:\s*'([a-z0-9.]+)'/g)) add(m[1], file);
    // <Symbol name={cond ? 'a' : 'b'} />, <Symbol name={MAP[x] ?? 'fallback'} />
    for (const m of src.matchAll(/<Symbol\b[^>]*?name=\{([^}]*)\}/gs)) for (const l of m[1].matchAll(/'([a-z0-9.]+)'/g)) add(l[1], file);
    // const SYMBOLS = { lucideName: 'sf.name', … } (metric icons on Today)
    const map = src.match(/const SYMBOLS[^=]*=\s*\{([^}]*)\}/s);
    if (map) for (const v of map[1].matchAll(/:\s*'([a-z0-9.]+)'/g)) add(v[1], file);
  }
  return used;
}

const symbolFile = readFileSync(join(MOBILE, 'src', 'components', 'symbol.tsx'), 'utf8');
const mapping = new Map(
  [...symbolFile.matchAll(/^\s+'?([a-z0-9.]+)'?:\s*'([a-z0-9_]+)',$/gm)].map((m) => [m[1], m[2]] as const),
);
const font = JSON.parse(readFileSync(join(MOBILE, 'node_modules', 'expo-symbols', 'build', 'android', 'symbols.json'), 'utf8')) as Record<string, unknown>;

describe('Android icons', () => {
  it('reads the mapping and finds icons in the app', () => {
    expect(mapping.size).toBeGreaterThan(40);
    expect(usedSymbols().size).toBeGreaterThan(30);
  });

  it('maps every SF Symbol the app uses to a Material Symbol', () => {
    const missing = [...usedSymbols()].filter(([name]) => !mapping.has(name)).map(([name, file]) => `${name} (${file})`);
    expect(missing).toEqual([]);
  });

  it('maps only to names that exist in the Material Symbols font', () => {
    const unknown = [...mapping.values()].filter((m) => !(m in font));
    expect(unknown).toEqual([]);
  });
});

import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { palettes } from '../../mobile/src/theme/palettes';

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8');
const map = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../docs/design/tokens/color-map.json'), 'utf8'),
) as { roles: { role: string; web: string; native: keyof typeof palettes.dark }[] };

const block = (selector: string) => {
  const m = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no ${selector} block`);
  return m[1];
};

describe('shared colour map', () => {
  it.each(map.roles.map((r) => [r.role, r] as const))('%s maps to a web variable in both themes', (_, r) => {
    expect(block(':root')).toContain(`${r.web}:`);
    expect(block('.dark')).toContain(`${r.web}:`);
  });

  it.each(map.roles.map((r) => [r.role, r] as const))('%s maps to a native key in both schemes', (_, r) => {
    expect(palettes.light).toHaveProperty(r.native);
    expect(palettes.dark).toHaveProperty(r.native);
  });
});

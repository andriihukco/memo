// Builds src/i18n/dicts/<code>.json: the Mini App dictionaries (../src/i18n) plus
// the keys that only the native app uses (src/i18n/extra/<code>.json).
// Run `npm run i18n:sync` after changing either side. Commit the generated files.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, '../../src/i18n');
const extraDir = join(here, '../src/i18n/extra');
const outDir = join(here, '../src/i18n/dicts');
const LOCALES = ['en', 'zh', 'es', 'hi', 'ar', 'de', 'fr', 'pt', 'it', 'pl', 'uk'];

mkdirSync(outDir, { recursive: true });
for (const code of LOCALES) {
  const web = JSON.parse(readFileSync(join(webDir, `${code}.json`), 'utf8'));
  const extraPath = join(extraDir, `${code}.json`);
  const extra = existsSync(extraPath) ? JSON.parse(readFileSync(extraPath, 'utf8')) : {};
  writeFileSync(join(outDir, `${code}.json`), `${JSON.stringify({ ...web, ...extra }, null, 2)}\n`);
  console.log(`${code}: ${Object.keys(web).length} web + ${Object.keys(extra).length} native keys`);
}

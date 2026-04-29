const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/i18n');
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
const enKeys = Object.keys(en);

const locales = ['fr', 'es', 'de', 'ar', 'hi', 'it', 'pl', 'pt', 'zh', 'uk'];

for (const locale of locales) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), 'utf8'));
  const keys = Object.keys(data);
  const missing = enKeys.filter(k => !keys.includes(k));
  console.log(`\n=== ${locale}: ${keys.length} keys, missing ${missing.length} ===`);
  missing.forEach(k => console.log(`  MISSING: ${k}`));
}

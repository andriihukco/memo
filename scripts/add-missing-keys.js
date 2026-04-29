/**
 * Adds newly needed i18n keys to all locale files.
 * Run after adding new keys to en.json and uk.json.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/i18n');
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
const locales = ['fr', 'es', 'de', 'ar', 'hi', 'it', 'pl', 'pt', 'zh'];

for (const locale of locales) {
  const filePath = path.join(dir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const enKeys = Object.keys(en);
  const missing = enKeys.filter(k => !Object.keys(data).includes(k));
  if (missing.length === 0) { console.log(`${locale}: ok`); continue; }
  // Merge in en.json order
  const merged = {};
  for (const key of enKeys) {
    merged[key] = data[key] !== undefined ? data[key] : en[key];
  }
  for (const key of Object.keys(data)) {
    if (!merged[key]) merged[key] = data[key];
  }
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`${locale}: added ${missing.length} keys`);
}

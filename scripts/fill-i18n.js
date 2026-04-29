/**
 * Fills missing i18n keys in all locale files using en.json as fallback.
 * Inserts each missing key right after its predecessor key from en.json,
 * preserving the original file order.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/i18n');
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
const enKeys = Object.keys(en);

const locales = ['fr', 'es', 'de', 'ar', 'hi', 'it', 'pl', 'pt', 'zh'];

for (const locale of locales) {
  const filePath = path.join(dir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const existing = Object.keys(data);
  const missing = enKeys.filter(k => !existing.includes(k));

  if (missing.length === 0) {
    console.log(`${locale}: already complete`);
    continue;
  }

  // Build merged object in en.json key order
  const merged = {};
  for (const key of enKeys) {
    if (data[key] !== undefined) {
      merged[key] = data[key];
    } else {
      // Use English value as fallback
      merged[key] = en[key];
    }
  }
  // Also keep any extra keys the locale has that en doesn't
  for (const key of existing) {
    if (merged[key] === undefined) merged[key] = data[key];
  }

  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`${locale}: filled ${missing.length} missing keys`);
}

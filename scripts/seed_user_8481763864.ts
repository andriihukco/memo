/**
 * Seed 180 days of realistic diary entries for telegram_id 8481763864
 * Entries are encrypted with the user's derived key (same as the bot does).
 *
 * Run: npx tsx --env-file=.env.local scripts/seed_user_8481763864.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENTRY_ENCRYPTION_PEPPER = process.env.ENTRY_ENCRYPTION_PEPPER!;

const USER_ID = "42e59bb9-f60e-4bb7-af0b-fcaa3d4c78c9";
const TELEGRAM_ID = "8481763864";

// ── Crypto (mirrors src/lib/crypto.ts) ───────────────────────────────────────

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const VERSION = 0x01;
const ENC_PREFIX = "enc:";
const INFO = new TextEncoder().encode("memo-entry-encryption-v1");

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function deriveUserKey(telegramUserId: string): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const ikmRaw = new TextEncoder().encode(telegramUserId);
  const ikmHash = await subtle.digest("SHA-256", ikmRaw);
  const hkdfKey = await subtle.importKey("raw", ikmHash, { name: "HKDF" }, false, ["deriveKey"]);
  const salt = new TextEncoder().encode(ENTRY_ENCRYPTION_PEPPER);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: INFO },
    hkdfKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptField(plaintext: string, key: CryptoKey): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  const packed = new Uint8Array(1 + IV_LENGTH + ciphertext.byteLength);
  packed[0] = VERSION;
  packed.set(iv, 1);
  packed.set(new Uint8Array(ciphertext), 1 + IV_LENGTH);
  return ENC_PREFIX + uint8ToBase64(packed);
}

// ── Entry templates ───────────────────────────────────────────────────────────

interface EntryTemplate {
  content: string;
  category: string;
  metadata: Record<string, unknown>;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  // Randomize time within the day
  d.setHours(7 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate 180 days of realistic entries (2-4 per day)
function generateEntries(): Array<EntryTemplate & { created_at: string }> {
  const entries: Array<EntryTemplate & { created_at: string }> = [];

  const foodItems = [
    { name: "вівсянка з бананом і медом", kcal: 380, protein: 12, carbs: 68, fat: 7 },
    { name: "яєчня з двох яєць і тост", kcal: 320, protein: 18, carbs: 28, fat: 16 },
    { name: "гречка з куркою 200г", kcal: 420, protein: 38, carbs: 42, fat: 8 },
    { name: "рис з лососем 150г", kcal: 480, protein: 32, carbs: 52, fat: 14 },
    { name: "борщ домашній, 2 тарілки", kcal: 340, protein: 14, carbs: 48, fat: 10 },
    { name: "куряча грудка з овочами 250г", kcal: 310, protein: 52, carbs: 12, fat: 6 },
    { name: "піца 2 шматки", kcal: 580, protein: 22, carbs: 72, fat: 24 },
    { name: "салат з тунцем і яйцем", kcal: 280, protein: 28, carbs: 8, fat: 14 },
    { name: "сирники зі сметаною 3шт", kcal: 420, protein: 18, carbs: 44, fat: 18 },
    { name: "паста болоньєзе 300г", kcal: 520, protein: 28, carbs: 64, fat: 16 },
    { name: "омлет з сиром і помідорами", kcal: 360, protein: 22, carbs: 6, fat: 26 },
    { name: "суп курячий з локшиною", kcal: 220, protein: 18, carbs: 24, fat: 6 },
    { name: "стейк яловичий 200г з картоплею", kcal: 620, protein: 48, carbs: 38, fat: 28 },
    { name: "йогурт грецький з горіхами", kcal: 240, protein: 14, carbs: 18, fat: 12 },
    { name: "бутерброд з авокадо і яйцем", kcal: 340, protein: 14, carbs: 28, fat: 20 },
  ];

  const workouts = [
    { desc: "Пробіг 5км за 28 хвилин, парк Шевченка", km: 5, min: 28, kcal: 400 },
    { desc: "Зал 60 хвилин: присідання, жим, тяга", km: 0, min: 60, kcal: 420 },
    { desc: "Пробіг 8км за 45 хвилин", km: 8, min: 45, kcal: 640 },
    { desc: "Велосипед 20км по набережній", km: 20, min: 65, kcal: 480 },
    { desc: "Зал 45 хвилин: кардіо + силові", km: 0, min: 45, kcal: 350 },
    { desc: "Пробіг 3км, легка розминка", km: 3, min: 18, kcal: 240 },
    { desc: "Плавання 40 хвилин, 1.2км", km: 1.2, min: 40, kcal: 380 },
    { desc: "Зал 90 хвилин: ноги день", km: 0, min: 90, kcal: 560 },
    { desc: "Пробіг 10км, особистий рекорд!", km: 10, min: 52, kcal: 800 },
    { desc: "Йога 30 хвилин вдома", km: 0, min: 30, kcal: 120 },
  ];

  const thoughts = [
    "Сьогодні відчуваю себе дуже продуктивно. Закрив 3 задачі на роботі, які відкладав тиждень.",
    "Думаю про зміну роботи. Поточна позиція вже не дає розвитку, хочеться чогось нового.",
    "Прочитав статтю про атомні звички. Треба почати з маленьких змін, а не революцій.",
    "Зустрівся з другом якого не бачив пів року. Добре поговорили, відчуваю натхнення.",
    "Важкий день. Все йшло не так, але ввечері вдалося відновитись.",
    "Починаю новий проект на роботі. Трохи страшно, але цікаво.",
    "Медитував 10 хвилин вранці. Помітив що день пройшов спокійніше.",
    "Треба більше спілкуватись з батьками. Давно не дзвонив.",
    "Відчуваю що застряг у рутині. Треба щось змінити.",
    "Сьогодні зробив те чого боявся — написав першим. Все добре вийшло.",
    "Читаю 'Атлант розправив плечі'. Дуже захоплює.",
    "Плануємо відпустку з дівчиною. Думаємо про Грузію або Туреччину.",
    "Купив нові кросівки для бігу. Нарешті нормальні.",
    "Зробив генеральне прибирання. Відчуваю полегшення.",
    "Вчора погано спав, сьогодні важко зосередитись.",
  ];

  const expenses = [
    { desc: "Продукти в АТБ", amount: 680, currency: "UAH" },
    { desc: "Кава в Starbucks", amount: 95, currency: "UAH" },
    { desc: "Обід в кафе", amount: 320, currency: "UAH" },
    { desc: "Таксі Uber", amount: 145, currency: "UAH" },
    { desc: "Спортзал, місячний абонемент", amount: 1200, currency: "UAH" },
    { desc: "Книга в Yakaboo", amount: 280, currency: "UAH" },
    { desc: "Одяг в Zara", amount: 1850, currency: "UAH" },
    { desc: "Ліки в аптеці", amount: 340, currency: "UAH" },
    { desc: "Кіно з дівчиною", amount: 420, currency: "UAH" },
    { desc: "Продукти Сільпо", amount: 920, currency: "UAH" },
    { desc: "Бензин", amount: 1100, currency: "UAH" },
    { desc: "Підписка Netflix", amount: 199, currency: "UAH" },
    { desc: "Ресторан на день народження", amount: 2400, currency: "UAH" },
    { desc: "Нові навушники", amount: 3200, currency: "UAH" },
    { desc: "Комунальні послуги", amount: 1680, currency: "UAH" },
  ];

  const sleepEntries = [
    { desc: "Спав 7.5 годин, прокинувся бадьорим", hours: 7.5, quality: 8 },
    { desc: "Погано спав, 5 годин, багато думок", hours: 5, quality: 4 },
    { desc: "Відмінний сон 8 годин", hours: 8, quality: 9 },
    { desc: "Спав 6 годин, прокинувся раніше будильника", hours: 6, quality: 6 },
    { desc: "Сон 9 годин у вихідний, відпочив", hours: 9, quality: 9 },
    { desc: "Безсоння до 2 ночі, потім 5 годин", hours: 5, quality: 3 },
    { desc: "Нормальний сон 7 годин", hours: 7, quality: 7 },
  ];

  const waterEntries = [
    "Випив 2 літри води за день",
    "Сьогодні тільки 1 літр, треба більше",
    "2.5 літри, добре тримаю норму",
    "Забув пити воду, десь 800мл",
    "3 літри — багато тренувався",
  ];

  const weightEntries = [82, 81.8, 81.5, 81.2, 81.0, 80.8, 80.5, 80.2, 80.0, 79.8, 79.5, 79.2];

  // Generate entries spread over 180 days
  for (let day = 179; day >= 0; day--) {
    const numEntries = rand(2, 4);

    // Always add food entry
    const food = pick(foodItems);
    entries.push({
      content: `${food.name}`,
      category: "calories",
      created_at: daysAgo(day),
      metadata: {
        food_item: food.name,
        estimated_calories: food.kcal,
        dashboard_metrics: [
          { key: "kcal_intake", label: "Калорії", value: food.kcal, unit: "ккал", icon: "utensils", aggregate: "sum" },
          { key: "protein_g", label: "Білки", value: food.protein, unit: "г", icon: "beef", aggregate: "sum" },
          { key: "carbs_g", label: "Вуглеводи", value: food.carbs, unit: "г", icon: "wheat", aggregate: "sum" },
          { key: "fat_g", label: "Жири", value: food.fat, unit: "г", icon: "droplets", aggregate: "sum" },
        ],
      },
    });

    // Workout 4x per week
    if (day % 2 === 0 || day % 7 === 3) {
      const w = pick(workouts);
      const metrics = [];
      if (w.km > 0) metrics.push({ key: "distance_km", label: "Дистанція", value: w.km, unit: "км", icon: "map-pin", aggregate: "sum" });
      metrics.push({ key: "active_min", label: "Активність", value: w.min, unit: "хв", icon: "timer", aggregate: "sum" });
      metrics.push({ key: "kcal_burned", label: "Спалено", value: w.kcal, unit: "ккал", icon: "flame", aggregate: "sum" });
      entries.push({
        content: w.desc,
        category: "workout",
        created_at: daysAgo(day),
        metadata: { dashboard_metrics: metrics },
      });
    }

    // Thoughts 3x per week
    if (day % 3 === 0) {
      entries.push({
        content: pick(thoughts),
        category: "thoughts",
        created_at: daysAgo(day),
        metadata: {},
      });
    }

    // Expenses 2x per week
    if (day % 4 === 0 || day % 7 === 5) {
      const exp = pick(expenses);
      entries.push({
        content: `${exp.desc} — ${exp.amount} грн`,
        category: "expenses",
        created_at: daysAgo(day),
        metadata: {
          amount: exp.amount,
          currency: exp.currency,
          category: "expenses",
          dashboard_metrics: [
            { key: "expenses_day", label: "Витрати", value: exp.amount, unit: "грн", icon: "wallet", aggregate: "sum" },
          ],
        },
      });
    }

    // Sleep every day
    if (numEntries >= 3) {
      const sl = pick(sleepEntries);
      entries.push({
        content: sl.desc,
        category: "sleep",
        created_at: daysAgo(day),
        metadata: {
          dashboard_metrics: [
            { key: "sleep_hours", label: "Сон", value: sl.hours, unit: "год", icon: "moon", aggregate: "avg" },
            { key: "sleep_quality", label: "Якість сну", value: sl.quality, unit: "/10", icon: "smile", aggregate: "avg" },
          ],
        },
      });
    }

    // Water every 3 days
    if (day % 3 === 1) {
      const ml = rand(1200, 2800);
      entries.push({
        content: pick(waterEntries),
        category: "health",
        created_at: daysAgo(day),
        metadata: {
          dashboard_metrics: [
            { key: "water_ml", label: "Вода", value: ml, unit: "мл", icon: "droplets", aggregate: "sum" },
          ],
        },
      });
    }

    // Weight weekly
    if (day % 7 === 0) {
      const w = weightEntries[Math.min(Math.floor(day / 15), weightEntries.length - 1)];
      entries.push({
        content: `Вага ${w} кг`,
        category: "health",
        created_at: daysAgo(day),
        metadata: {
          dashboard_metrics: [
            { key: "weight_kg", label: "Вага", value: w, unit: "кг", icon: "scale", aggregate: "last" },
          ],
        },
      });
    }
  }

  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ENTRY_ENCRYPTION_PEPPER) {
    console.error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENTRY_ENCRYPTION_PEPPER");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Check if user already has entries
  const { count } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", USER_ID);

  if ((count ?? 0) > 10) {
    console.log(`User already has ${count} entries. Skipping seed to avoid duplicates.`);
    console.log("Delete existing entries first if you want to re-seed.");
    process.exit(0);
  }

  console.log("Deriving encryption key...");
  const cryptoKey = await deriveUserKey(TELEGRAM_ID);

  const rawEntries = generateEntries();
  console.log(`Generated ${rawEntries.length} entries. Encrypting and inserting...`);

  let inserted = 0;
  const BATCH = 20;

  for (let i = 0; i < rawEntries.length; i += BATCH) {
    const batch = rawEntries.slice(i, i + BATCH);

    const rows = await Promise.all(batch.map(async (e) => ({
      user_id: USER_ID,
      content: await encryptField(e.content, cryptoKey),
      category: e.category,
      metadata: e.metadata,
      created_at: e.created_at,
      raw_media_url: null,
      thread_id: null,
      reply_to_entry_id: null,
    })));

    const { error } = await supabase.from("entries").insert(rows);
    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message);
    } else {
      inserted += rows.length;
      process.stdout.write(`\r${inserted}/${rawEntries.length} inserted`);
    }
  }

  console.log(`\n✓ Done. Inserted ${inserted} entries for user ${USER_ID} (telegram_id=${TELEGRAM_ID})`);
}

main().catch(console.error);

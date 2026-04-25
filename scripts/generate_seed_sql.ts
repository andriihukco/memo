/**
 * Generates a SQL file with 180 days of seed entries for user 8481763864
 * Entries are stored as plaintext (no encryption) — decryptField handles this gracefully.
 * Run: npx tsx scripts/generate_seed_sql.ts > /tmp/seed_entries.sql
 */

const USER_ID = "42e59bb9-f60e-4bb7-af0b-fcaa3d4c78c9";

function daysAgo(n: number, hourOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(7 + hourOffset, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

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
  "Читаю Атлант розправив плечі. Дуже захоплює.",
  "Плануємо відпустку з дівчиною. Думаємо про Грузію або Туреччину.",
  "Купив нові кросівки для бігу. Нарешті нормальні.",
  "Зробив генеральне прибирання. Відчуваю полегшення.",
  "Вчора погано спав, сьогодні важко зосередитись.",
];

const expenses = [
  { desc: "Продукти в АТБ", amount: 680 },
  { desc: "Кава в кав'ярні", amount: 95 },
  { desc: "Обід в кафе", amount: 320 },
  { desc: "Таксі Uber", amount: 145 },
  { desc: "Спортзал, місячний абонемент", amount: 1200 },
  { desc: "Книга в Yakaboo", amount: 280 },
  { desc: "Одяг в Zara", amount: 1850 },
  { desc: "Ліки в аптеці", amount: 340 },
  { desc: "Кіно з дівчиною", amount: 420 },
  { desc: "Продукти Сільпо", amount: 920 },
  { desc: "Бензин", amount: 1100 },
  { desc: "Підписка Netflix", amount: 199 },
  { desc: "Ресторан на день народження", amount: 2400 },
  { desc: "Нові навушники", amount: 3200 },
  { desc: "Комунальні послуги", amount: 1680 },
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

const weights = [82, 81.8, 81.5, 81.2, 81.0, 80.8, 80.5, 80.2, 80.0, 79.8, 79.5, 79.2];

const lines: string[] = [];
lines.push("-- Seed entries for user 8481763864 (42e59bb9-f60e-4bb7-af0b-fcaa3d4c78c9)");
lines.push("-- Plaintext entries — decryptField handles non-enc: values gracefully");
lines.push("BEGIN;");

let seed = 0;

for (let day = 179; day >= 0; day--) {
  // Food
  const food = pick(foodItems, seed++);
  const foodMeta = JSON.stringify({
    food_item: food.name,
    estimated_calories: food.kcal,
    dashboard_metrics: [
      { key: "kcal_intake", label: "Калорії", value: food.kcal, unit: "ккал", icon: "utensils", aggregate: "sum" },
      { key: "protein_g", label: "Білки", value: food.protein, unit: "г", icon: "beef", aggregate: "sum" },
      { key: "carbs_g", label: "Вуглеводи", value: food.carbs, unit: "г", icon: "wheat", aggregate: "sum" },
      { key: "fat_g", label: "Жири", value: food.fat, unit: "г", icon: "droplets", aggregate: "sum" },
    ],
  });
  lines.push(`INSERT INTO entries (user_id, content, category, metadata, created_at) VALUES ('${USER_ID}', '${esc(food.name)}', 'calories', '${esc(foodMeta)}'::jsonb, '${daysAgo(day, 0)}');`);

  // Workout (4x/week)
  if (day % 2 === 0 || day % 7 === 3) {
    const w = pick(workouts, seed++);
    const wMetrics = [];
    if (w.km > 0) wMetrics.push({ key: "distance_km", label: "Дистанція", value: w.km, unit: "км", icon: "map-pin", aggregate: "sum" });
    wMetrics.push({ key: "active_min", label: "Активність", value: w.min, unit: "хв", icon: "timer", aggregate: "sum" });
    wMetrics.push({ key: "kcal_burned", label: "Спалено", value: w.kcal, unit: "ккал", icon: "flame", aggregate: "sum" });
    const wMeta = JSON.stringify({ dashboard_metrics: wMetrics });
    lines.push(`INSERT INTO entries (user_id, content, category, metadata, created_at) VALUES ('${USER_ID}', '${esc(w.desc)}', 'workout', '${esc(wMeta)}'::jsonb, '${daysAgo(day, 2)}');`);
  }

  // Thoughts (3x/week)
  if (day % 3 === 0) {
    const t = pick(thoughts, seed++);
    lines.push(`INSERT INTO entries (user_id, content, category, metadata, created_at) VALUES ('${USER_ID}', '${esc(t)}', 'thoughts', '{}'::jsonb, '${daysAgo(day, 4)}');`);
  }

  // Expenses (2x/week)
  if (day % 4 === 0 || day % 7 === 5) {
    const exp = pick(expenses, seed++);
    const expMeta = JSON.stringify({
      amount: exp.amount, currency: "UAH", category: "expenses",
      dashboard_metrics: [{ key: "expenses_day", label: "Витрати", value: exp.amount, unit: "грн", icon: "wallet", aggregate: "sum" }],
    });
    lines.push(`INSERT INTO entries (user_id, content, category, metadata, created_at) VALUES ('${USER_ID}', '${esc(exp.desc + " — " + exp.amount + " грн")}', 'expenses', '${esc(expMeta)}'::jsonb, '${daysAgo(day, 6)}');`);
  }

  // Sleep (daily)
  const sl = pick(sleepEntries, seed++);
  const slMeta = JSON.stringify({
    dashboard_metrics: [
      { key: "sleep_hours", label: "Сон", value: sl.hours, unit: "год", icon: "moon", aggregate: "avg" },
      { key: "sleep_quality", label: "Якість сну", value: sl.quality, unit: "/10", icon: "smile", aggregate: "avg" },
    ],
  });
  lines.push(`INSERT INTO entries (user_id, content, category, metadata, created_at) VALUES ('${USER_ID}', '${esc(sl.desc)}', 'sleep', '${esc(slMeta)}'::jsonb, '${daysAgo(day, 8)}');`);

  // Water (every 3 days)
  if (day % 3 === 1) {
    const ml = 1200 + (seed % 16) * 100;
    const waterMeta = JSON.stringify({ dashboard_metrics: [{ key: "water_ml", label: "Вода", value: ml, unit: "мл", icon: "droplets", aggregate: "sum" }] });
    lines.push(`INSERT INTO entries (user_id, content, category, metadata, created_at) VALUES ('${USER_ID}', 'Випив ${ml} мл води за день', 'health', '${esc(waterMeta)}'::jsonb, '${daysAgo(day, 10)}');`);
    seed++;
  }

  // Weight (weekly)
  if (day % 7 === 0) {
    const w = weights[Math.min(Math.floor(day / 15), weights.length - 1)];
    const wMeta = JSON.stringify({ dashboard_metrics: [{ key: "weight_kg", label: "Вага", value: w, unit: "кг", icon: "scale", aggregate: "last" }] });
    lines.push(`INSERT INTO entries (user_id, content, category, metadata, created_at) VALUES ('${USER_ID}', 'Вага ${w} кг', 'health', '${esc(wMeta)}'::jsonb, '${daysAgo(day, 12)}');`);
  }
}

lines.push("COMMIT;");
lines.push(`SELECT count(*) as inserted FROM entries WHERE user_id = '${USER_ID}';`);

console.log(lines.join("\n"));

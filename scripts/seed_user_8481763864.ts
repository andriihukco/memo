/**
 * Seed 180 days of realistic diary entries for telegram_id 8481763864
 *
 * Persona: Олексій Коваль, 28 years old, Kyiv
 * - Frontend developer at a product startup
 * - Runs 3-4x/week, goes to the gym, tracks nutrition
 * - Introspective, reads a lot, thinks deeply about career and relationships
 * - In a 2-year relationship with Катя, navigating long-term commitment questions
 * - Dealing with mild burnout mid-period, recovers through sport and journaling
 * - Recurring themes: career growth vs stability, identity, discipline, creativity
 *
 * Run: npx tsx --env-file=.env.local scripts/seed_user_8481763864.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENTRY_ENCRYPTION_PEPPER = process.env.ENTRY_ENCRYPTION_PEPPER!;

const USER_ID = "42e59bb9-f60e-4bb7-af0b-fcaa3d4c78c9";
const TELEGRAM_ID = "8481763864";

// ── Crypto ────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

interface EntryTemplate {
  content: string;
  category: string;
  metadata: Record<string, unknown>;
}

function daysAgo(n: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(base: number, pct = 0.1): number {
  return Math.round(base * (1 + (Math.random() - 0.5) * pct * 2));
}

// ── Persona data ──────────────────────────────────────────────────────────────

const THOUGHTS: string[] = [
  "Сьогодні на стендапі зрозумів, що вже пів року роблю одне й те саме. Технічно зростаю, але відчуття що топчусь на місці. Треба поговорити з тімлідом про нові задачі.",
  "Читав про синдром самозванця. Впізнав себе в кожному пункті. Цікаво, чи всі розробники через це проходять, чи тільки я такий.",
  "Катя сьогодні сказала що я 'занадто в голові'. Мабуть вона права. Іноді я так глибоко занурюсь в думки що забуваю бути присутнім.",
  "Думаю про те, щоб піти на курс з системного дизайну. Відчуваю що мені не вистачає розуміння архітектури на рівні senior.",
  "Прочитав половину 'Deep Work' Ньюпорта. Розумію чому не можу зосередитись — постійні сповіщення, Slack, Twitter. Треба щось міняти.",
  "Сьогодні вперше за місяць відчув справжній потік на роботі. 4 години без перерви, закрив складний баг. Це відчуття треба культивувати.",
  "Думаю про переїзд. Не обов'язково з України, але хочеться змінити квартиру. Поточна вже 3 роки, і вона якось тисне.",
  "Зателефонував батькам. Тато розповів про город, мама про сусідів. Відчуваю провину що рідко дзвоню. Треба зробити це звичкою.",
  "Сьогодні відмовився від зустрічі яка мені не потрібна. Вперше за довго сказав 'ні' без виправдань. Відчуваю себе дорослим.",
  "Думаю про те, що таке успіх для мене особисто. Не те що суспільство нав'язує, а моє власне. Поки немає чіткої відповіді.",
  "Переглянув свої цілі на рік. З 8 виконав 3. Але ті 3 — найважливіші. Може це і є правильний підхід — менше але краще.",
  "Сьогодні на code review отримав жорсткий фідбек. Спочатку образився, потім перечитав — він правий. Треба вчитись приймати критику.",
  "Відчуваю що мені потрібна пауза. Не відпустка, а просто день без планів, без телефону, без очікувань.",
  "Думаю про те, чи правильно я обрав спеціальність. Frontend — це добре, але іноді хочеться чогось більш відчутного. Може ML, може продуктова робота.",
  "Сьогодні допоміг колезі розібратись з React hooks. Пояснював 40 хвилин. Зрозумів що мені подобається менторство.",
  "Прочитав про стоїцизм. 'Контролюй те що можеш, відпусти решту.' Звучить просто, але на практиці дуже важко.",
  "Катя і я посварились через дрібницю. Потім помирились. Але залишилось відчуття що ми говоримо про симптоми, а не про причини.",
  "Сьогодні вперше написав технічну статтю для блогу. Страшно публікувати, але треба. Перфекціонізм — мій головний ворог.",
  "Думаю про те, що хочу через 5 років. CTO маленького стартапу? Незалежний консультант? Або просто хороший senior в стабільній компанії?",
  "Медитував 15 хвилин вранці. Думки все одно лізли, але я їх просто спостерігав. Це вже прогрес порівняно з місяцем тому.",
  "Сьогодні зрозумів що відкладаю важливе заради термінового. Треба переглянути пріоритети. Матриця Ейзенхауера — не просто теорія.",
  "Відчуваю що стаю більш терплячим. Рік тому б вже вибухнув на тій нараді. Сьогодні просто слухав і чекав свого моменту.",
  "Думаю про гроші. Не в сенсі жадібності, а в сенсі фінансової свободи. Хочу мати подушку на рік вперед. Поки є 3 місяці.",
  "Сьогодні прочитав що середній розробник змінює роботу кожні 2 роки. Я на поточному місці вже 2.5. Час думати?",
  "Зустрівся з другом Максом якого не бачив пів року. Він запустив свій стартап. Відчуваю суміш захоплення і заздрості. Треба розібратись з цим почуттям.",
  "Думаю про те, що щастя — це не стан, а процес. Коли я в потоці, коли вчусь, коли допомагаю — ось коли я щасливий.",
  "Сьогодні вперше за місяць не відкрив Twitter до обіду. Відчуваю себе краще. Може це і є відповідь.",
  "Прочитав 'Людина в пошуках сенсу' Франкла. Книга змінила щось у мені. Сенс не знаходять — його створюють.",
  "Думаю про те, що мені потрібно більше живого спілкування. Zoom-дзвінки не замінюють реальних розмов.",
  "Сьогодні зробив щось що давно відкладав — записався до стоматолога. Дрібниця, але відчуваю полегшення.",
  "Відчуваю що починаю вигорати. Не критично, але сигнали є. Треба взяти відпустку до кінця кварталу.",
  "Думаю про те, що порівнюю себе з іншими занадто часто. LinkedIn — токсичне місце для самооцінки.",
  "Сьогодні на прогулянці з Катею просто мовчали 20 хвилин. Це було добре. Не кожна тиша — незручна.",
  "Зрозумів що мій найпродуктивніший час — з 9 до 12. Треба захищати цей час від нарад і Slack.",
  "Думаю про те, що дисципліна — це не про силу волі, а про системи. Якщо система правильна, рішення приймаються самі.",
  "Сьогодні отримав оффер від іншої компанії. Не буду приймати, але приємно знати що я потрібен.",
  "Відчуваю що стаю більш вдячним за дрібниці. Ранкова кава, сонце у вікні, хороша пісня — це вже багато.",
  "Думаю про те, що треба менше планувати і більше робити. Аналіз паралізує. Дія навчає.",
  "Сьогодні вперше за довго малював. Просто так, без мети. Відчув щось що давно не відчував.",
  "Прочитав про концепцію 'enough'. Достатньо грошей, достатньо успіху, достатньо визнання. Коли зупинитись?",
];

const FEELINGS: string[] = [
  "Сьогодні відчуваю тривогу без причини. Просто фоновий шум у голові. Намагаюсь не боротись з ним, а просто спостерігати.",
  "Дуже добрий настрій з ранку. Прокинувся раніше будильника, встиг помедитувати і поснідати спокійно. Такі ранки треба берегти.",
  "Відчуваю себе самотнім навіть коли поруч люди. Не знаю як це пояснити. Може просто втома.",
  "Сьогодні відчув справжню радість — без причини, просто так. Йшов вулицею і посміхався. Добре.",
  "Злюсь на себе за прокрастинацію. Знаю що треба робити, але не роблю. Це замкнене коло.",
  "Відчуваю вдячність. За здоров'я, за роботу, за Катю, за те що живу в місті де є можливості.",
  "Сьогодні відчув страх — що не реалізую свій потенціал. Що проживу звичайне життя і не залишу сліду.",
  "Спокій. Просто спокій. Після довгого часу тривоги — це відчуття дуже цінне.",
  "Відчуваю що перегорів на роботі. Не хочу відкривати ноутбук. Треба взяти паузу.",
  "Сьогодні відчув гордість — закрив задачу яку відкладав 2 тижні. Маленька перемога, але важлива.",
  "Тривога перед важливою презентацією. Готувався, знаю матеріал, але все одно страшно.",
  "Після презентації — полегшення і радість. Все пройшло добре. Тривога була марною.",
  "Відчуваю ніжність до Каті. Вона сьогодні зробила щось маленьке але дуже уважне. Люблю її.",
  "Роздратування. Все дратує — трафік, шум, повільний інтернет. Мабуть просто втома накопичилась.",
  "Відчуваю натхнення після прочитаної книги. Хочу щось створити, щось нове спробувати.",
  "Меланхолія. Осінній настрій. Не погано, просто задумливо.",
  "Відчуваю що зростаю. Порівняв себе з собою рік тому — різниця є. Це приємно.",
  "Сором за те що зірвався на Каті через дрібницю. Треба вибачитись і розібратись чому так реагую.",
  "Відчуваю ентузіазм щодо нового проекту. Нарешті щось цікаве після місяців рутини.",
  "Спустошеність після важкого тижня. Нічого не хочу, нікуди не хочу. Просто лежати.",
];

const FOOD_ITEMS = [
  { name: "Вівсянка з бананом, горіхами і медом", kcal: 420, protein: 14, carbs: 72, fat: 10 },
  { name: "Яєчня з 3 яєць, тост з авокадо", kcal: 480, protein: 24, carbs: 32, fat: 28 },
  { name: "Гречка 200г з куркою 150г і овочами", kcal: 520, protein: 42, carbs: 48, fat: 10 },
  { name: "Рис 180г з лососем 150г і салатом", kcal: 560, protein: 38, carbs: 58, fat: 16 },
  { name: "Борщ домашній 2 тарілки з хлібом", kcal: 380, protein: 16, carbs: 52, fat: 12 },
  { name: "Куряча грудка 250г з броколі і рисом", kcal: 440, protein: 56, carbs: 36, fat: 8 },
  { name: "Паста болоньєзе 300г", kcal: 580, protein: 30, carbs: 72, fat: 18 },
  { name: "Салат з тунцем, яйцем і овочами", kcal: 320, protein: 32, carbs: 12, fat: 16 },
  { name: "Сирники 4шт зі сметаною і ягодами", kcal: 460, protein: 20, carbs: 52, fat: 18 },
  { name: "Омлет з сиром, помідорами і зеленню", kcal: 380, protein: 26, carbs: 8, fat: 28 },
  { name: "Суп курячий з локшиною і зеленню", kcal: 260, protein: 20, carbs: 28, fat: 7 },
  { name: "Стейк яловичий 200г з картоплею і салатом", kcal: 680, protein: 52, carbs: 42, fat: 30 },
  { name: "Йогурт грецький 200г з горіхами і медом", kcal: 280, protein: 16, carbs: 24, fat: 14 },
  { name: "Бутерброд з авокадо, яйцем і томатом", kcal: 360, protein: 16, carbs: 30, fat: 22 },
  { name: "Піца маргарита 2 шматки", kcal: 620, protein: 24, carbs: 78, fat: 24 },
  { name: "Смузі з бананом, шпинатом і протеїном", kcal: 340, protein: 28, carbs: 44, fat: 6 },
  { name: "Котлети домашні 2шт з пюре", kcal: 540, protein: 34, carbs: 38, fat: 26 },
  { name: "Тост з арахісовою пастою і бананом", kcal: 380, protein: 14, carbs: 52, fat: 16 },
  { name: "Курячий бургер з салатом", kcal: 520, protein: 36, carbs: 48, fat: 20 },
  { name: "Вареники з картоплею 8шт зі сметаною", kcal: 480, protein: 14, carbs: 72, fat: 16 },
];

const WORKOUTS = [
  { desc: "Пробіг 5км за 27 хв, парк Шевченка. Темп хороший, дихання рівне.", km: 5, min: 27, kcal: 420, steps: 6200 },
  { desc: "Зал 65 хв: присідання 4x8 по 80кг, жим лежачи 4x8 по 70кг, тяга 3x10 по 60кг.", km: 0, min: 65, kcal: 480, steps: 3000 },
  { desc: "Пробіг 8км за 44 хв. Найкращий час за місяць.", km: 8, min: 44, kcal: 660, steps: 9800 },
  { desc: "Велосипед 22км по набережній Дніпра. Погода ідеальна.", km: 22, min: 70, kcal: 520, steps: 4000 },
  { desc: "Зал 50 хв: кардіо 20 хв + верхня частина тіла.", km: 0, min: 50, kcal: 380, steps: 3500 },
  { desc: "Легкий пробіг 3км, розминка після вихідних.", km: 3, min: 19, kcal: 250, steps: 3800 },
  { desc: "Плавання 45 хв, 1.4км. Відчуваю все тіло.", km: 1.4, min: 45, kcal: 420, steps: 2000 },
  { desc: "Зал 90 хв: день ніг. Присідання, випади, жим ногами. Завтра не зможу ходити.", km: 0, min: 90, kcal: 600, steps: 4000 },
  { desc: "Пробіг 10км — особистий рекорд! 52 хвилини. Дуже задоволений.", km: 10, min: 52, kcal: 820, steps: 12000 },
  { desc: "Йога 35 хв вдома. Розтяжка і дихання. Добре для відновлення.", km: 0, min: 35, kcal: 130, steps: 1500 },
  { desc: "Зал 60 хв: спина і біцепс. Підтягування 4x8, тяга до поясу.", km: 0, min: 60, kcal: 440, steps: 3000 },
  { desc: "Пробіг 6км в дощ. Мокрий але задоволений.", km: 6, min: 33, kcal: 500, steps: 7400 },
  { desc: "Функціональне тренування 40 хв: бурпі, планка, стрибки.", km: 0, min: 40, kcal: 360, steps: 4500 },
  { desc: "Пробіг 4км + зарядка 15 хв. Ранкова рутина.", km: 4, min: 35, kcal: 380, steps: 5200 },
  { desc: "Зал 75 хв: груди і трицепс. Жим 5x5 по 75кг — новий рекорд.", km: 0, min: 75, kcal: 520, steps: 3200 },
];

const EXPENSES = [
  { desc: "Продукти в Сільпо", amount: 840, cat: "їжа" },
  { desc: "Кава в Honey", amount: 85, cat: "кафе" },
  { desc: "Обід в кафе з колегами", amount: 380, cat: "кафе" },
  { desc: "Таксі Uklon", amount: 165, cat: "транспорт" },
  { desc: "Абонемент у спортзал", amount: 1400, cat: "спорт" },
  { desc: "Книга 'Thinking Fast and Slow'", amount: 320, cat: "освіта" },
  { desc: "Нові кросівки Nike для бігу", amount: 3200, cat: "одяг" },
  { desc: "Ліки і вітаміни в аптеці", amount: 420, cat: "здоров'я" },
  { desc: "Кіно з Катею + попкорн", amount: 480, cat: "розваги" },
  { desc: "Продукти в АТБ", amount: 620, cat: "їжа" },
  { desc: "Бензин А95", amount: 1200, cat: "транспорт" },
  { desc: "Підписка Spotify", amount: 99, cat: "підписки" },
  { desc: "Вечеря в ресторані з Катею", amount: 1800, cat: "кафе" },
  { desc: "Курс на Udemy — React Advanced", amount: 480, cat: "освіта" },
  { desc: "Комунальні послуги", amount: 1920, cat: "комунальні" },
  { desc: "Продукти Novus", amount: 760, cat: "їжа" },
  { desc: "Стрижка", amount: 280, cat: "краса" },
  { desc: "Подарунок Каті на місяць стосунків", amount: 1200, cat: "подарунки" },
  { desc: "Кава і сніданок в Aroma Kava", amount: 220, cat: "кафе" },
  { desc: "Нові навушники Sony", amount: 4800, cat: "техніка" },
];

const SLEEP_ENTRIES = [
  { desc: "Спав 7.5 год, прокинувся бадьорим. Ліг о 23:00, встав о 6:30.", hours: 7.5, quality: 8 },
  { desc: "Погано спав — 5 год. Багато думок перед сном, довго не міг заснути.", hours: 5, quality: 4 },
  { desc: "Відмінний сон 8.5 год. Вихідний, нікуди не поспішав.", hours: 8.5, quality: 9 },
  { desc: "6 год сну. Прокинувся раніше будильника, більше не заснув.", hours: 6, quality: 6 },
  { desc: "9 год у вихідний. Відпочив повністю.", hours: 9, quality: 9 },
  { desc: "Безсоння до 2 ночі. Потім 5 год. Завтра буде важко.", hours: 5, quality: 3 },
  { desc: "Нормальний сон 7 год. Нічого особливого.", hours: 7, quality: 7 },
  { desc: "7.5 год, але снились якісь дивні сни. Прокинувся трохи розбитим.", hours: 7.5, quality: 6 },
  { desc: "8 год — ідеально. Ліг о 22:30, встав о 6:30 без будильника.", hours: 8, quality: 9 },
  { desc: "Тільки 4.5 год — пізно повернувся з вечірки. Завтра відісплюсь.", hours: 4.5, quality: 3 },
];

// ── Entry generator ───────────────────────────────────────────────────────────

function generateEntries(): Array<EntryTemplate & { created_at: string }> {
  const entries: Array<EntryTemplate & { created_at: string }> = [];

  // Weight trend: starts at 84kg, slowly drops to 79kg over 180 days
  const startWeight = 84;
  const endWeight = 79;

  for (let day = 179; day >= 0; day--) {
    // Phase of the journey (0 = start, 1 = end)
    const phase = (179 - day) / 179;

    // ── 1. Thought (every day, morning ~8-9am) ──────────────────────────────
    entries.push({
      content: pick(THOUGHTS),
      category: "thoughts",
      created_at: daysAgo(day, 8, rand(0, 45)),
      metadata: {},
    });

    // ── 2. Food entry (every day, around lunch 12-14) ──────────────────────
    const food = pick(FOOD_ITEMS);
    // Slightly reduce calories over time as Oleksiy gets more disciplined
    const kcalMod = Math.round(food.kcal * (1 - phase * 0.08));
    entries.push({
      content: food.name,
      category: "calories",
      created_at: daysAgo(day, rand(12, 14), rand(0, 50)),
      metadata: {
        food_item: food.name,
        estimated_calories: kcalMod,
        dashboard_metrics: [
          { key: "kcal_intake", label: "Калорії", value: kcalMod, unit: "ккал", icon: "utensils", aggregate: "sum" },
          { key: "protein_g", label: "Білки", value: jitter(food.protein), unit: "г", icon: "beef", aggregate: "sum" },
          { key: "carbs_g", label: "Вуглеводи", value: jitter(food.carbs), unit: "г", icon: "wheat", aggregate: "sum" },
          { key: "fat_g", label: "Жири", value: jitter(food.fat), unit: "г", icon: "droplets", aggregate: "sum" },
        ],
      },
    });

    // ── 3. Workout (5x per week — skip Wed and Sun) ────────────────────────
    const dayOfWeek = (new Date().getDay() - day % 7 + 7) % 7;
    const isRestDay = dayOfWeek === 0 || dayOfWeek === 3; // Sun or Wed
    if (!isRestDay) {
      const w = pick(WORKOUTS);
      const metrics: Record<string, unknown>[] = [];
      if (w.km > 0) metrics.push({ key: "distance_km", label: "Дистанція", value: jitter(w.km, 0.15), unit: "км", icon: "map-pin", aggregate: "sum" });
      metrics.push({ key: "active_min", label: "Активність", value: jitter(w.min, 0.1), unit: "хв", icon: "timer", aggregate: "sum" });
      metrics.push({ key: "kcal_burned", label: "Спалено", value: jitter(w.kcal, 0.12), unit: "ккал", icon: "flame", aggregate: "sum" });
      metrics.push({ key: "steps_count", label: "Кроки", value: jitter(w.steps, 0.15), unit: "кроків", icon: "activity", aggregate: "sum" });
      entries.push({
        content: w.desc,
        category: "workout",
        created_at: daysAgo(day, rand(7, 9), rand(0, 50)),
        metadata: { dashboard_metrics: metrics },
      });
    }

    // ── 4. Feelings (every 2 days, evening ~20-22) ─────────────────────────
    if (day % 2 === 0) {
      entries.push({
        content: pick(FEELINGS),
        category: "feelings",
        created_at: daysAgo(day, rand(20, 22), rand(0, 50)),
        metadata: {},
      });
    }

    // ── 5. Expense (every 3 days) ──────────────────────────────────────────
    if (day % 3 === 0) {
      const exp = pick(EXPENSES);
      entries.push({
        content: `${exp.desc} — ${exp.amount} грн`,
        category: "expenses",
        created_at: daysAgo(day, rand(11, 19), rand(0, 50)),
        metadata: {
          amount: exp.amount,
          currency: "UAH",
          category: exp.cat,
          dashboard_metrics: [
            { key: "expenses_day", label: "Витрати", value: exp.amount, unit: "грн", icon: "wallet", aggregate: "sum" },
          ],
        },
      });
    }

    // ── 6. Sleep (every day, early morning ~6-7am) ─────────────────────────
    const sl = pick(SLEEP_ENTRIES);
    entries.push({
      content: sl.desc,
      category: "sleep",
      created_at: daysAgo(day, rand(6, 7), rand(0, 30)),
      metadata: {
        dashboard_metrics: [
          { key: "sleep_hours", label: "Сон", value: sl.hours, unit: "год", icon: "moon", aggregate: "avg" },
          { key: "sleep_quality", label: "Якість сну", value: sl.quality, unit: "/10", icon: "smile", aggregate: "avg" },
        ],
      },
    });

    // ── 7. Weight (weekly, Monday morning) ────────────────────────────────
    if (day % 7 === 0) {
      const weight = Math.round((startWeight - (startWeight - endWeight) * phase) * 10) / 10;
      entries.push({
        content: `Вага ${weight} кг. ${weight < 82 ? "Прогрес є, продовжую." : "Треба більше уваги харчуванню."}`,
        category: "health",
        created_at: daysAgo(day, 7, rand(0, 30)),
        metadata: {
          dashboard_metrics: [
            { key: "weight_kg", label: "Вага", value: weight, unit: "кг", icon: "scale", aggregate: "last" },
          ],
        },
      });
    }

    // ── 8. Water (every 2 days) ────────────────────────────────────────────
    if (day % 2 === 1) {
      const ml = rand(1400, 2800);
      const glasses = Math.round(ml / 250);
      entries.push({
        content: `Вода за день: ${ml} мл (${glasses} склянок). ${ml >= 2000 ? "Норму виконав." : "Треба більше пити."}`,
        category: "health",
        created_at: daysAgo(day, rand(21, 22), rand(0, 50)),
        metadata: {
          dashboard_metrics: [
            { key: "water_ml", label: "Вода", value: ml, unit: "мл", icon: "droplets", aggregate: "sum" },
            { key: "water_glasses", label: "Склянки", value: glasses, unit: "скл", icon: "droplets", aggregate: "sum" },
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

  // Wipe existing entries for clean re-seed
  console.log("Deleting existing entries...");
  const { error: delError } = await supabase
    .from("entries")
    .delete()
    .eq("user_id", USER_ID);
  if (delError) console.warn("Delete warning:", delError.message);

  console.log("Deriving encryption key...");
  const cryptoKey = await deriveUserKey(TELEGRAM_ID);

  const rawEntries = generateEntries();
  console.log(`Generated ${rawEntries.length} entries. Encrypting and inserting...`);

  let inserted = 0;
  const BATCH = 25;

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
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      inserted += rows.length;
      process.stdout.write(`\r${inserted}/${rawEntries.length} inserted`);
    }
  }

  console.log(`\n✓ Done. Inserted ${inserted} entries for user ${USER_ID} (telegram_id=${TELEGRAM_ID})`);
  console.log(`\nPersona: Олексій Коваль, 28, Frontend dev, Kyiv`);
  console.log(`Period: 180 days, ~${Math.round(inserted / 180)} entries/day`);
}

main().catch(console.error);

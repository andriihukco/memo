-- Seed 90 days of diary entries for telegram_id 8481763864
-- Persona: Олексій Коваль, 28, Frontend dev, Kyiv
-- Run in Supabase SQL editor (service role context)

-- ── Step 1: ensure auth user exists ──────────────────────────────────────────
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'telegram_8481763864@memo.app',
  crypt('tg_8481763864_seed', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"telegram_id":"8481763864","username":"oleksiy_koval"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'telegram_8481763864@memo.app'
);

-- ── Step 2: ensure profile exists (keyed by telegram_id) ─────────────────────
INSERT INTO profiles (id, telegram_id, username, settings, subscription_tier, subscription_status)
SELECT u.id, 8481763864, 'oleksiy_koval', '{}', 'stars_pro', 'active'
FROM auth.users u
WHERE u.email = 'telegram_8481763864@memo.app'
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE telegram_id = 8481763864);

-- Update tier if profile already existed
UPDATE profiles SET subscription_tier = 'stars_pro', subscription_status = 'active'
WHERE telegram_id = 8481763864;

DO $$
DECLARE
  uid UUID;
  d DATE;
  day_offset INT;
  phase FLOAT;
  weight_kg FLOAT;
  kcal INT;
  protein INT;
  carbs INT;
  fat INT;
  sleep_h FLOAT;
  sleep_q INT;
  water_ml INT;
  expense_amt INT;
  km FLOAT;
  active_min INT;
  kcal_burned INT;
  steps INT;

  thoughts TEXT[] := ARRAY[
    'Сьогодні на стендапі зрозумів, що вже пів року роблю одне й те саме. Технічно зростаю, але відчуття що топчусь на місці. Треба поговорити з тімлідом про нові задачі.',
    'Читав про синдром самозванця. Впізнав себе в кожному пункті. Цікаво, чи всі розробники через це проходять, чи тільки я такий.',
    'Катя сьогодні сказала що я занадто в голові. Мабуть вона права. Іноді я так глибоко занурюсь в думки що забуваю бути присутнім.',
    'Думаю про те, щоб піти на курс з системного дизайну. Відчуваю що мені не вистачає розуміння архітектури на рівні senior.',
    'Прочитав половину Deep Work Ньюпорта. Розумію чому не можу зосередитись — постійні сповіщення, Slack, Twitter. Треба щось міняти.',
    'Сьогодні вперше за місяць відчув справжній потік на роботі. 4 години без перерви, закрив складний баг. Це відчуття треба культивувати.',
    'Думаю про переїзд. Не обов''язково з України, але хочеться змінити квартиру. Поточна вже 3 роки, і вона якось тисне.',
    'Зателефонував батькам. Тато розповів про город, мама про сусідів. Відчуваю провину що рідко дзвоню. Треба зробити це звичкою.',
    'Сьогодні відмовився від зустрічі яка мені не потрібна. Вперше за довго сказав ні без виправдань. Відчуваю себе дорослим.',
    'Думаю про те, що таке успіх для мене особисто. Не те що суспільство нав''язує, а моє власне. Поки немає чіткої відповіді.',
    'Переглянув свої цілі на рік. З 8 виконав 3. Але ті 3 — найважливіші. Може це і є правильний підхід — менше але краще.',
    'Сьогодні на code review отримав жорсткий фідбек. Спочатку образився, потім перечитав — він правий. Треба вчитись приймати критику.',
    'Відчуваю що мені потрібна пауза. Не відпустка, а просто день без планів, без телефону, без очікувань.',
    'Думаю про те, чи правильно я обрав спеціальність. Frontend — це добре, але іноді хочеться чогось більш відчутного.',
    'Сьогодні допоміг колезі розібратись з React hooks. Пояснював 40 хвилин. Зрозумів що мені подобається менторство.',
    'Прочитав про стоїцизм. Контролюй те що можеш, відпусти решту. Звучить просто, але на практиці дуже важко.',
    'Катя і я посварились через дрібницю. Потім помирились. Але залишилось відчуття що ми говоримо про симптоми, а не про причини.',
    'Сьогодні вперше написав технічну статтю для блогу. Страшно публікувати, але треба. Перфекціонізм — мій головний ворог.',
    'Думаю про те, що хочу через 5 років. CTO маленького стартапу? Незалежний консультант? Або просто хороший senior в стабільній компанії?',
    'Медитував 15 хвилин вранці. Думки все одно лізли, але я їх просто спостерігав. Це вже прогрес порівняно з місяцем тому.',
    'Сьогодні зрозумів що відкладаю важливе заради термінового. Треба переглянути пріоритети.',
    'Відчуваю що стаю більш терплячим. Рік тому б вже вибухнув на тій нараді. Сьогодні просто слухав і чекав свого моменту.',
    'Думаю про гроші. Не в сенсі жадібності, а в сенсі фінансової свободи. Хочу мати подушку на рік вперед. Поки є 3 місяці.',
    'Сьогодні отримав оффер від іншої компанії. Не буду приймати, але приємно знати що я потрібен.',
    'Відчуваю що стаю більш вдячним за дрібниці. Ранкова кава, сонце у вікні, хороша пісня — це вже багато.',
    'Думаю про те, що треба менше планувати і більше робити. Аналіз паралізує. Дія навчає.',
    'Сьогодні вперше за довго малював. Просто так, без мети. Відчув щось що давно не відчував.',
    'Прочитав про концепцію enough. Достатньо грошей, достатньо успіху, достатньо визнання. Коли зупинитись?',
    'Зустрівся з другом Максом якого не бачив пів року. Він запустив свій стартап. Відчуваю суміш захоплення і заздрості.',
    'Думаю про те, що щастя — це не стан, а процес. Коли я в потоці, коли вчусь, коли допомагаю — ось коли я щасливий.'
  ];

  feelings TEXT[] := ARRAY[
    'Сьогодні відчуваю тривогу без причини. Просто фоновий шум у голові. Намагаюсь не боротись з ним, а просто спостерігати.',
    'Дуже добрий настрій з ранку. Прокинувся раніше будильника, встиг помедитувати і поснідати спокійно.',
    'Відчуваю себе самотнім навіть коли поруч люди. Не знаю як це пояснити. Може просто втома.',
    'Сьогодні відчув справжню радість — без причини, просто так. Йшов вулицею і посміхався.',
    'Злюсь на себе за прокрастинацію. Знаю що треба робити, але не роблю. Це замкнене коло.',
    'Відчуваю вдячність. За здоров''я, за роботу, за Катю, за те що живу в місті де є можливості.',
    'Сьогодні відчув страх — що не реалізую свій потенціал. Що проживу звичайне життя і не залишу сліду.',
    'Спокій. Просто спокій. Після довгого часу тривоги — це відчуття дуже цінне.',
    'Відчуваю що перегорів на роботі. Не хочу відкривати ноутбук. Треба взяти паузу.',
    'Сьогодні відчув гордість — закрив задачу яку відкладав 2 тижні. Маленька перемога, але важлива.',
    'Тривога перед важливою презентацією. Готувався, знаю матеріал, але все одно страшно.',
    'Після презентації — полегшення і радість. Все пройшло добре. Тривога була марною.',
    'Відчуваю ніжність до Каті. Вона сьогодні зробила щось маленьке але дуже уважне.',
    'Роздратування. Все дратує — трафік, шум, повільний інтернет. Мабуть просто втома накопичилась.',
    'Відчуваю натхнення після прочитаної книги. Хочу щось створити, щось нове спробувати.',
    'Меланхолія. Осінній настрій. Не погано, просто задумливо.',
    'Відчуваю що зростаю. Порівняв себе з собою рік тому — різниця є. Це приємно.',
    'Сором за те що зірвався на Каті через дрібницю. Треба вибачитись і розібратись чому так реагую.',
    'Відчуваю ентузіазм щодо нового проекту. Нарешті щось цікаве після місяців рутини.',
    'Спустошеність після важкого тижня. Нічого не хочу, нікуди не хочу. Просто лежати.'
  ];

  foods TEXT[] := ARRAY[
    'Вівсянка з бананом, горіхами і медом',
    'Яєчня з 3 яєць, тост з авокадо',
    'Гречка 200г з куркою 150г і овочами',
    'Рис 180г з лососем 150г і салатом',
    'Борщ домашній 2 тарілки з хлібом',
    'Куряча грудка 250г з броколі і рисом',
    'Паста болоньєзе 300г',
    'Салат з тунцем, яйцем і овочами',
    'Сирники 4шт зі сметаною і ягодами',
    'Омлет з сиром, помідорами і зеленню',
    'Суп курячий з локшиною і зеленню',
    'Стейк яловичий 200г з картоплею і салатом',
    'Йогурт грецький 200г з горіхами і медом',
    'Бутерброд з авокадо, яйцем і томатом',
    'Піца маргарита 2 шматки',
    'Смузі з бананом, шпинатом і протеїном',
    'Котлети домашні 2шт з пюре',
    'Тост з арахісовою пастою і бананом',
    'Курячий бургер з салатом',
    'Вареники з картоплею 8шт зі сметаною'
  ];

  food_kcal INT[] := ARRAY[420,480,520,560,380,440,580,320,460,380,260,680,280,360,620,340,540,380,520,480];
  food_prot INT[] := ARRAY[14,24,42,38,16,56,30,32,20,26,20,52,16,16,24,28,34,14,36,14];
  food_carb INT[] := ARRAY[72,32,48,58,52,36,72,12,52,8,28,42,24,30,78,44,38,52,48,72];
  food_fat  INT[] := ARRAY[10,28,10,16,12,8,18,16,18,28,7,30,14,22,24,6,26,16,20,16];

  workouts TEXT[] := ARRAY[
    'Пробіг 5км за 27 хв, парк Шевченка. Темп хороший, дихання рівне.',
    'Зал 65 хв: присідання 4x8 по 80кг, жим лежачи 4x8 по 70кг, тяга 3x10 по 60кг.',
    'Пробіг 8км за 44 хв. Найкращий час за місяць.',
    'Велосипед 22км по набережній Дніпра. Погода ідеальна.',
    'Зал 50 хв: кардіо 20 хв + верхня частина тіла.',
    'Легкий пробіг 3км, розминка після вихідних.',
    'Плавання 45 хв, 1.4км. Відчуваю все тіло.',
    'Зал 90 хв: день ніг. Присідання, випади, жим ногами.',
    'Пробіг 10км — особистий рекорд! 52 хвилини.',
    'Йога 35 хв вдома. Розтяжка і дихання.',
    'Зал 60 хв: спина і біцепс. Підтягування 4x8.',
    'Пробіг 6км в дощ. Мокрий але задоволений.',
    'Функціональне тренування 40 хв: бурпі, планка, стрибки.',
    'Пробіг 4км + зарядка 15 хв. Ранкова рутина.',
    'Зал 75 хв: груди і трицепс. Жим 5x5 по 75кг — новий рекорд.'
  ];
  w_km    FLOAT[] := ARRAY[5,0,8,22,0,3,1.4,0,10,0,0,6,0,4,0];
  w_min   INT[]   := ARRAY[27,65,44,70,50,19,45,90,52,35,60,33,40,35,75];
  w_kcal  INT[]   := ARRAY[420,480,660,520,380,250,420,600,820,130,440,500,360,380,520];
  w_steps INT[]   := ARRAY[6200,3000,9800,4000,3500,3800,2000,4000,12000,1500,3000,7400,4500,5200,3200];

  expenses TEXT[] := ARRAY[
    'Продукти в Сільпо',
    'Кава в Honey',
    'Обід в кафе з колегами',
    'Таксі Uklon',
    'Абонемент у спортзал',
    'Книга Thinking Fast and Slow',
    'Нові кросівки Nike для бігу',
    'Ліки і вітаміни в аптеці',
    'Кіно з Катею',
    'Продукти в АТБ',
    'Бензин А95',
    'Підписка Spotify',
    'Вечеря в ресторані з Катею',
    'Курс на Udemy — React Advanced',
    'Комунальні послуги'
  ];
  exp_amt INT[] := ARRAY[840,85,380,165,1400,320,3200,420,480,620,1200,99,1800,480,1920];
  exp_cat TEXT[] := ARRAY['їжа','кафе','кафе','транспорт','спорт','освіта','одяг','здоров''я','розваги','їжа','транспорт','підписки','кафе','освіта','комунальні'];

  fi INT; wi INT; ei INT; ti INT; fli INT;
BEGIN

-- Resolve UUID from telegram_id
SELECT id INTO uid FROM profiles WHERE telegram_id = 8481763864;
IF uid IS NULL THEN
  RAISE EXCEPTION 'Profile for telegram_id 8481763864 not found. Run the INSERT steps above first.';
END IF;

-- Delete existing entries for clean seed
DELETE FROM entries WHERE user_id = uid;

FOR day_offset IN REVERSE 89..0 LOOP
  d := CURRENT_DATE - day_offset;
  phase := (89.0 - day_offset) / 89.0;
  weight_kg := ROUND((CAST(84.0 - 5.0 * phase AS NUMERIC)), 1);

  -- Pick indices deterministically but varied
  fi  := (day_offset * 7 + 3)  % 20 + 1;
  wi  := (day_offset * 11 + 5) % 15 + 1;
  ei  := (day_offset * 13 + 2) % 15 + 1;
  ti  := (day_offset * 17 + 1) % 30 + 1;
  fli := (day_offset * 19 + 7) % 20 + 1;

  kcal    := food_kcal[fi] - ROUND(food_kcal[fi] * 0.08 * phase);
  protein := food_prot[fi];
  carbs   := food_carb[fi];
  fat     := food_fat[fi];

  -- 1. Thought (every day, morning)
  INSERT INTO entries (user_id, content, category, metadata, created_at)
  VALUES (
    uid,
    thoughts[ti],
    'thoughts',
    '{}',
    d + TIME '08:15:00' + (INTERVAL '1 minute' * (day_offset % 45))
  );

  -- 2. Food (every day, lunch)
  INSERT INTO entries (user_id, content, category, metadata, created_at)
  VALUES (
    uid,
    foods[fi],
    'calories',
    jsonb_build_object(
      'food_item', foods[fi],
      'estimated_calories', kcal,
      'dashboard_metrics', jsonb_build_array(
        jsonb_build_object('key','kcal_intake','label','Калорії','value',kcal,'unit','ккал','icon','utensils','aggregate','sum'),
        jsonb_build_object('key','protein_g','label','Білки','value',protein,'unit','г','icon','beef','aggregate','sum'),
        jsonb_build_object('key','carbs_g','label','Вуглеводи','value',carbs,'unit','г','icon','wheat','aggregate','sum'),
        jsonb_build_object('key','fat_g','label','Жири','value',fat,'unit','г','icon','droplets','aggregate','sum')
      )
    ),
    d + TIME '13:00:00' + (INTERVAL '1 minute' * (day_offset % 60))
  );

  -- 3. Workout (5 days/week — skip day_offset % 7 IN (0,3))
  IF (day_offset % 7) NOT IN (0, 3) THEN
    INSERT INTO entries (user_id, content, category, metadata, created_at)
    VALUES (
      uid,
      workouts[wi],
      'workout',
      jsonb_build_object(
        'dashboard_metrics', jsonb_build_array(
          jsonb_build_object('key','active_min','label','Активність','value',w_min[wi],'unit','хв','icon','timer','aggregate','sum'),
          jsonb_build_object('key','kcal_burned','label','Спалено','value',w_kcal[wi],'unit','ккал','icon','flame','aggregate','sum'),
          jsonb_build_object('key','steps_count','label','Кроки','value',w_steps[wi],'unit','кроків','icon','activity','aggregate','sum')
        )
      ),
      d + TIME '07:30:00' + (INTERVAL '1 minute' * (day_offset % 30))
    );
  END IF;

  -- 4. Feelings (every 2 days, evening)
  IF day_offset % 2 = 0 THEN
    INSERT INTO entries (user_id, content, category, metadata, created_at)
    VALUES (
      uid,
      feelings[fli],
      'feelings',
      '{}',
      d + TIME '21:00:00' + (INTERVAL '1 minute' * (day_offset % 50))
    );
  END IF;

  -- 5. Expense (every 3 days)
  IF day_offset % 3 = 0 THEN
    INSERT INTO entries (user_id, content, category, metadata, created_at)
    VALUES (
      uid,
      expenses[ei] || ' — ' || exp_amt[ei]::TEXT || ' грн',
      'expenses',
      jsonb_build_object(
        'amount', exp_amt[ei],
        'currency', 'UAH',
        'category', exp_cat[ei],
        'dashboard_metrics', jsonb_build_array(
          jsonb_build_object('key','expenses_day','label','Витрати','value',exp_amt[ei],'unit','грн','icon','wallet','aggregate','sum')
        )
      ),
      d + TIME '15:30:00' + (INTERVAL '1 minute' * (day_offset % 40))
    );
  END IF;

  -- 6. Sleep (every day, early morning)
  sleep_h := CASE (day_offset % 10)
    WHEN 0 THEN 7.5 WHEN 1 THEN 5.0 WHEN 2 THEN 8.5 WHEN 3 THEN 6.0
    WHEN 4 THEN 9.0 WHEN 5 THEN 5.0 WHEN 6 THEN 7.0 WHEN 7 THEN 7.5
    WHEN 8 THEN 8.0 WHEN 9 THEN 4.5 ELSE 7.0 END;
  sleep_q := CASE (day_offset % 10)
    WHEN 0 THEN 8 WHEN 1 THEN 4 WHEN 2 THEN 9 WHEN 3 THEN 6
    WHEN 4 THEN 9 WHEN 5 THEN 3 WHEN 6 THEN 7 WHEN 7 THEN 6
    WHEN 8 THEN 9 WHEN 9 THEN 3 ELSE 7 END;

  INSERT INTO entries (user_id, content, category, metadata, created_at)
  VALUES (
    uid,
    'Сон ' || sleep_h || ' год, якість ' || sleep_q || '/10',
    'sleep',
    jsonb_build_object(
      'dashboard_metrics', jsonb_build_array(
        jsonb_build_object('key','sleep_hours','label','Сон','value',sleep_h,'unit','год','icon','moon','aggregate','avg'),
        jsonb_build_object('key','sleep_quality','label','Якість сну','value',sleep_q,'unit','/10','icon','smile','aggregate','avg')
      )
    ),
    d + TIME '06:45:00' + (INTERVAL '1 minute' * (day_offset % 20))
  );

  -- 7. Weight (weekly)
  IF day_offset % 7 = 0 THEN
    INSERT INTO entries (user_id, content, category, metadata, created_at)
    VALUES (
      uid,
      'Вага ' || weight_kg || ' кг',
      'health',
      jsonb_build_object(
        'dashboard_metrics', jsonb_build_array(
          jsonb_build_object('key','weight_kg','label','Вага','value',weight_kg,'unit','кг','icon','scale','aggregate','last')
        )
      ),
      d + TIME '07:00:00'
    );
  END IF;

  -- 8. Water (every other day)
  IF day_offset % 2 = 1 THEN
    water_ml := 1400 + (day_offset % 15) * 100;
    INSERT INTO entries (user_id, content, category, metadata, created_at)
    VALUES (
      uid,
      'Вода за день: ' || water_ml || ' мл (' || (water_ml / 250) || ' склянок)',
      'health',
      jsonb_build_object(
        'dashboard_metrics', jsonb_build_array(
          jsonb_build_object('key','water_ml','label','Вода','value',water_ml,'unit','мл','icon','droplets','aggregate','sum'),
          jsonb_build_object('key','water_glasses','label','Склянки','value',(water_ml / 250),'unit','скл','icon','droplets','aggregate','sum')
        )
      ),
      d + TIME '22:00:00' + (INTERVAL '1 minute' * (day_offset % 30))
    );
  END IF;

END LOOP;

RAISE NOTICE 'Seed complete. Inserted entries for telegram_id 8481763864 (uuid=%)', uid;
END $$;

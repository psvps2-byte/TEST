# Тести БЗВП (браузерний застосунок + Supabase)

Готовий застосунок для проходження тестів з архіву, з опційним підключенням Supabase для збереження результатів і лідерборду.

## Що вже є

- Імпорт питань з `.xlsx` у [`data/tests.json`](/Users/paha/Desktop/Тестування/data/tests.json).
- Підтримка форматів правильних відповідей:
  - окрема колонка `Відповідь` / `Правильна відповідь`;
  - правильний варіант виділений червоним шрифтом у таблиці.
- Веб-інтерфейс для проходження тесту.
- Supabase-інтеграція:
  - збереження спроб;
  - лідерборд по вибраному набору.

## Локальний запуск

```bash
cd '/Users/paha/Desktop/Тестування'
python3 server.py
```

Відкрити: `http://localhost:8080`

## Оновлення бази тестів із Excel

```bash
cd '/Users/paha/Desktop/Тестування'
python3 scripts/build_tests.py
```

## Налаштування Supabase

1. Створіть проект у Supabase.
2. Відкрийте SQL Editor і виконайте [`supabase/schema.sql`](/Users/paha/Desktop/Тестування/supabase/schema.sql).
3. Скопіюйте [`supabase-config.example.js`](/Users/paha/Desktop/Тестування/supabase-config.example.js) у `supabase-config.js` і заповніть:
   - `url`
   - `anonKey`
4. Перезапустіть сайт.

## Деплой на GitHub + Railway

1. Створіть репозиторій GitHub і запуште цей каталог.
2. У Railway: `New Project` -> `Deploy from GitHub Repo`.
3. Railway автоматично підхопить [`railway.json`](/Users/paha/Desktop/Тестування/railway.json) і запустить `python3 server.py`.
4. Після деплою відкрийте домен Railway.
5. Відредагуйте `supabase-config.js` у репозиторії (або через CI/CD), щоб вказати бойові ключі.

## Основні файли

- [`index.html`](/Users/paha/Desktop/Тестування/index.html)
- [`styles.css`](/Users/paha/Desktop/Тестування/styles.css)
- [`app.js`](/Users/paha/Desktop/Тестування/app.js)
- [`data/tests.json`](/Users/paha/Desktop/Тестування/data/tests.json)
- [`scripts/build_tests.py`](/Users/paha/Desktop/Тестування/scripts/build_tests.py)
- [`supabase/schema.sql`](/Users/paha/Desktop/Тестування/supabase/schema.sql)
- [`supabase-config.example.js`](/Users/paha/Desktop/Тестування/supabase-config.example.js)
- [`server.py`](/Users/paha/Desktop/Тестування/server.py)
- [`railway.json`](/Users/paha/Desktop/Тестування/railway.json)

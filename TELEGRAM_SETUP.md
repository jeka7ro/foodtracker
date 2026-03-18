# Telegram Bot Setup - Quick Guide

## 🤖 Creează Bot Telegram

### Pas 1: Deschide Telegram

Caută `@BotFather` în Telegram

### Pas 2: Creează Bot

Trimite comenzile:
```
/newbot
```

Urmează instrucțiunile:
1. Nume bot (ex: "Aggregator Monitor Bot")
2. Username bot (trebuie să se termine în "bot", ex: "aggregator_monitor_bot")

### Pas 3: Copiază Token

BotFather îți va da un token care arată așa:
```
123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Pas 4: Adaugă Token în Workers

Editează `/Users/eugeniucazmal/dev/aggregator-monitor-fba2535a/workers/.env`:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

---

## 📱 Obține Chat ID

### Opțiunea 1: Grup Telegram (Recomandat)

1. **Creează grup** în Telegram
2. **Adaugă bot-ul** în grup (caută username-ul bot-ului)
3. **Trimite un mesaj** în grup (orice mesaj)
4. **Obține Chat ID:**
   - Mergi la: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Înlocuiește `<TOKEN>` cu token-ul tău
   - Caută în răspuns: `"chat":{"id":-1001234567890}`
   - Copiază ID-ul (cu minus!)

### Opțiunea 2: Chat Personal

1. **Caută bot-ul** în Telegram
2. **Trimite** `/start`
3. **Obține Chat ID:**
   - Mergi la: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Caută: `"chat":{"id":123456789}`
   - Copiază ID-ul

---

## 🏪 Configurează Restaurant

În Supabase, rulează:

```sql
UPDATE restaurants 
SET telegram_group_id = '-1001234567890'  -- ID-ul tău de la pasul anterior
WHERE name = 'Test Sushi Restaurant';
```

---

## ✅ Testează

Restart workers:
```bash
cd /Users/eugeniucazmal/dev/aggregator-monitor-fba2535a/workers
# Oprește cu Ctrl+C
npm start
```

Dacă restaurantul e detectat ca închis în timpul programului, vei primi mesaj în Telegram!

---

## 🎯 Next: Adaugă Restaurant Real

Pentru a testa cu date reale:

```sql
-- Adaugă un restaurant real
INSERT INTO restaurants (
  name, 
  city, 
  glovo_url, 
  working_hours_start, 
  working_hours_end,
  telegram_group_id,
  is_active
) VALUES (
  'Nume Restaurant Real',
  'Chișinău',
  'https://glovoapp.com/md/chi/restaurant-real',  -- URL real Glovo
  '10:00',
  '22:00',
  '-1001234567890',  -- Chat ID Telegram
  true
);
```

Workers-ul va începe să-l monitorizeze automat!

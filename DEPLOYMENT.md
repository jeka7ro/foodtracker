# Deploy to Render - Step by Step

## 🚀 Deploy Workers to Render

### Pas 1: Creează Cont Render

1. Mergi la https://render.com
2. Sign up cu GitHub
3. Autorizează Render să acceseze repo-urile tale

### Pas 2: Creează Web Service

1. Click "New +" → "Background Worker"
2. Conectează repo-ul GitHub: `aggregator-monitor`
3. Configurare:
   - **Name:** `aggregator-monitor-workers`
   - **Region:** Frankfurt (EU Central)
   - **Branch:** `main`
   - **Root Directory:** `workers`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

### Pas 3: Environment Variables

Adaugă în Render:

```
SUPABASE_URL=https://crzubinnjelhkzunbpvr.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
CHECK_INTERVAL_MINUTES=5
```

### Pas 4: Deploy

Click "Create Background Worker"

Render va:
1. Clone repo-ul
2. Rula `npm install`
3. Porni workers cu `npm start`
4. Rula 24/7 automat

### Pas 5: Verificare

În Render Dashboard:
- Logs → vezi output-ul workers-ului
- Ar trebui să vezi: "🚀 Aggregator Monitor Workers Starting..."

---

## 🌐 Deploy Frontend to Netlify

### Pas 1: Build Frontend

Local:
```bash
cd /Users/eugeniucazmal/dev/aggregator-monitor-fba2535a
npm run build
```

### Pas 2: Creează Site Netlify

1. Mergi la https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Conectează GitHub
4. Selectează repo `aggregator-monitor`

### Pas 3: Build Settings

```
Build command: npm run build
Publish directory: dist
```

### Pas 4: Environment Variables

Adaugă în Netlify:

```
VITE_SUPABASE_URL=https://crzubinnjelhkzunbpvr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Pas 5: Deploy

Click "Deploy site"

Netlify va da un URL: `https://aggregator-monitor-xyz.netlify.app`

---

## ✅ Verificare Finală

### 1. Workers (Render)

Verifică în Render Logs:
```
📍 Found X active restaurant(s)
🏪 Restaurant Name
   Working hours: ✅ Should be open
🔍 Checking...
✅ Restaurant - Glovo - available
```

### 2. Frontend (Netlify)

Deschide URL-ul Netlify:
- Login funcționează?
- Dashboard se încarcă?
- Alerts page arată corect?

### 3. Supabase

Verifică în Table Editor:
- `monitoring_checks` - ar trebui să apară records noi la fiecare 5 minute
- `alerts` - ar trebui să apară alerte când detectează probleme

### 4. Telegram

Dacă ai configurat:
- Primești mesaje când restaurantul e închis în program?

---

## 🔧 Troubleshooting

### Workers nu pornesc pe Render

**Verifică:**
- Build logs pentru erori
- Environment variables sunt setate corect
- `package.json` există în folder `workers/`

### Frontend nu se conectează la Supabase

**Verifică:**
- Environment variables în Netlify
- CORS settings în Supabase (ar trebui să permită domain-ul Netlify)

### Nu primești alerte Telegram

**Verifică:**
- `TELEGRAM_BOT_TOKEN` e corect
- Restaurant are `telegram_group_id` setat
- Bot-ul e adăugat în grup
- Workers rulează (vezi logs în Render)

---

## 💰 Costuri

### Render
- **Free tier:** 750 ore/lună (suficient pentru 1 worker 24/7)
- **Paid:** $7/lună pentru mai multă putere

### Netlify
- **Free tier:** 100GB bandwidth/lună
- **Paid:** $19/lună pentru mai mult

### Supabase
- **Free tier:** 500MB database, 2GB bandwidth
- **Paid:** $25/lună pentru mai mult

**Total pentru început: $0/lună** (totul pe free tier!)

---

## 🎯 Next Steps După Deploy

1. **Monitorizează logs** primele 24h
2. **Adaugă mai multe restaurante** în Supabase
3. **Configurează Telegram** pentru fiecare restaurant
4. **Testează alertele** - oprește manual un restaurant și vezi dacă primești notificare
5. **Optimizează interval** - poate 10 minute în loc de 5 pentru a economisi resurse

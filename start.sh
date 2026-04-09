#!/bin/bash
# ─────────────────────────────────────────────
# Aggregator Monitor — Start All Services
# ─────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKERS_DIR="$ROOT_DIR/workers"

echo ""
echo "🚀 Aggregator Monitor — Pornire servere..."
echo ""

# Ucide orice proces pe portul 3001 (API server) sau 5173 (Vite)
echo "🔄 Oprire procese vechi dacă există..."
lsof -ti :3001 | xargs kill -9 2>/dev/null
lsof -ti :5573 | xargs kill -9 2>/dev/null
sleep 1

# Pornire API Server (workers) în background
echo "⚡ Pornire API Server (port 3001)..."
cd "$WORKERS_DIR"
node src/api-server.js &
API_PID=$!
echo "   API Server PID: $API_PID"

# Scurt delay
sleep 1

# Pornire Vite dev server în background
echo "⚡ Pornire Frontend (port 5573)..."
cd "$ROOT_DIR"
npm run dev -- --port 5573 &
VITE_PID=$!
echo "   Vite PID: $VITE_PID"

echo ""
echo "✅ Ambele servere pornite!"
echo "   → Frontend: http://localhost:5573"
echo "   → API:      http://localhost:3001"
echo ""
echo "   Apasă Ctrl+C pentru a opri tot."
echo ""

# Asteapta ambele procese. Daca unul se opreste, opreste-le pe amandoua
wait $API_PID $VITE_PID

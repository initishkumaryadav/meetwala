#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "  🤖  MeetWala — AI Proxy Attendee"
echo "  ================================"
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found. Install Docker Desktop first."
  exit 1
fi

# Check .env
if [ ! -f ".env" ]; then
  echo "⚠️  No .env found. Copying from .env.example..."
  cp .env.example .env
  echo "❗ Fill in your API keys in .env before proceeding."
  exit 1
fi

echo "🐳 Starting services..."
docker compose up -d postgres redis chromadb

echo "⏳ Waiting for databases..."
sleep 8

echo "🗃️  Running DB migrations..."
docker compose run --rm backend npx prisma migrate dev --name init

echo "🚀 Starting all services..."
docker compose up -d

echo ""
echo "  ✅ MeetWala is running!"
echo "  ─────────────────────────────────"
echo "  🌐 App:        http://localhost"
echo "  ⚛️  Frontend:   http://localhost:5173"
echo "  🖥️  Backend:    http://localhost:4000"
echo "  🤖 AI Service: http://localhost:8000/docs"
echo "  ─────────────────────────────────"
echo "  📋 Logs: docker compose logs -f"
echo ""
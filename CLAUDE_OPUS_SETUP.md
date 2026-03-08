# MeetWala — Complete Project Summary for AI Assistant Setup
# ============================================================
# Paste this entire file into Claude Opus (or any AI coding assistant)
# and say: "Read this and fix all errors, install dependencies, and make the project runnable."

---

## WHAT IS THIS PROJECT

MeetWala is a full-stack AI-powered virtual meeting proxy system.
When a user cannot attend a meeting, they brief an AI bot before the meeting.
The bot joins the meeting on their behalf, listens to the conversation via
real-time speech-to-text, answers questions using the briefing data (RAG),
and when it doesn't know something, it WhatsApps the real user, gets a reply,
and delivers it in the meeting — all in real time.

---

## TECH STACK

### Frontend
- React 18 (pure JSX, NO TypeScript)
- Vite 5 as build tool
- Tailwind CSS for styling
- Framer Motion for animations
- Zustand for state management
- React Router DOM v6 for routing
- TanStack React Query v5 for data fetching
- Axios for HTTP requests
- Socket.IO client for real-time events
- Lucide React for icons
- React Hot Toast for notifications

### Backend
- Node.js 20 with Express.js (CommonJS, NO TypeScript)
- Socket.IO server for real-time bidirectional communication
- Prisma ORM with PostgreSQL 16
- IORedis for Redis connection
- Passport.js for authentication (Google OAuth2 + JWT strategy)
- jsonwebtoken for JWT signing/verification
- Twilio SDK for WhatsApp messaging
- @deepgram/sdk for real-time speech-to-text streaming
- Axios for calling the AI service
- Winston for logging
- Morgan for HTTP request logging
- Helmet, CORS, Compression, express-rate-limit as middleware
- Nodemon for dev hot-reload

### AI Service
- Python 3.12 with FastAPI
- Uvicorn as ASGI server
- LangChain 0.2.x for LLM orchestration
- LangGraph 0.2.x for stateful multi-step bot pipeline
- langchain-google-genai for Google Gemini 1.5 Pro
- langchain-chroma for ChromaDB vector store integration
- ChromaDB 0.5.x as vector database (self-hosted)
- Google Generative AI embeddings (models/embedding-001)
- LangSmith for LLM call tracing (optional)
- aioredis for async Redis connection
- Pydantic v2 for request/response validation
- Loguru for logging
- python-dotenv for env management

### Infrastructure
- Docker + Docker Compose (7 containers)
- PostgreSQL 16 (primary database)
- Redis 7 (session cache, escalation queue)
- ChromaDB (vector database for RAG)
- Nginx (reverse proxy)
- All services communicate on a Docker bridge network called meetwala-net

---

## FOLDER STRUCTURE

```
meetwala-js/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── scripts/
│   ├── dev.sh
│   └── init.sql
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.js                         (Express server entry point)
│       ├── middleware/
│       │   ├── auth.middleware.js           (JWT protect routes)
│       │   ├── error.handler.js             (global error handler)
│       │   ├── passport.js                  (Google OAuth2 + JWT setup)
│       │   ├── request.logger.js            (log each request)
│       │   └── socket.auth.js               (verify JWT on socket connect)
│       ├── routes/
│       │   ├── auth.routes.js               (Google OAuth + /me + /logout)
│       │   ├── meeting.routes.js            (CRUD for meetings)
│       │   ├── briefing.routes.js           (save briefing → AI service)
│       │   ├── proxy.routes.js              (proxy session CRUD)
│       │   ├── webhook.routes.js            (Twilio WhatsApp callback)
│       │   └── health.routes.js             (health check all services)
│       ├── services/
│       │   ├── db.service.js                (Prisma singleton)
│       │   ├── redis.service.js             (IORedis singleton)
│       │   ├── ai.service.js                (axios calls to FastAPI)
│       │   ├── whatsapp.service.js          (Twilio WhatsApp send)
│       │   ├── tts.service.js               (ElevenLabs TTS)
│       │   └── transcription.service.js     (Deepgram live STT)
│       ├── socket/
│       │   └── socket.server.js             (Socket.IO init + all events)
│       └── utils/
│           ├── logger.js                    (Winston logger)
│           └── nanoid.js                    (short ID generator)
├── ai-service/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py                          (FastAPI app + lifespan)
│       ├── api/
│       │   ├── __init__.py
│       │   ├── briefing.py                  (POST /briefing/ingest)
│       │   ├── respond.py                   (POST /respond/meeting + /whatsapp-reply)
│       │   └── health.py                    (GET /health)
│       ├── core/
│       │   ├── __init__.py
│       │   ├── langgraph/
│       │   │   ├── __init__.py
│       │   │   └── bot_graph.py             (LangGraph state machine)
│       │   ├── llm/
│       │   │   ├── __init__.py
│       │   │   ├── gemini.py                (Gemini 1.5 Pro init)
│       │   │   └── prompts.py               (all LLM prompt templates)
│       │   └── rag/
│       │       ├── __init__.py
│       │       ├── chroma.py                (ChromaDB client)
│       │       └── retriever.py             (ingest + retrieve chunks)
│       ├── services/
│       │   ├── __init__.py
│       │   └── redis_service.py             (async Redis client)
│       └── utils/
│           └── __init__.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx                         (ReactDOM.createRoot entry)
        ├── App.jsx                          (React Router routes)
        ├── index.css                        (Tailwind directives + custom classes)
        ├── store/
        │   ├── auth.store.js                (Zustand: token, user, logout)
        │   └── meeting.store.js             (Zustand: participants, transcript, botStatus)
        ├── services/
        │   ├── api.js                       (Axios instance + all API helpers)
        │   └── socket.js                    (Socket.IO client + event listeners)
        └── components/
            ├── dashboard/
            │   ├── LoginPage.jsx            (Google OAuth login screen)
            │   └── Dashboard.jsx            (home: meetings list, proxy sessions)
            ├── briefing/
            │   └── BriefingPage.jsx         (chat-style pre-meeting briefing)
            ├── meeting/
            │   ├── MeetingRoom.jsx          (live meeting: video grid + controls)
            │   ├── BotStatusPanel.jsx       (shows bot state, events, WA status)
            │   ├── TranscriptPanel.jsx      (live captions sidebar)
            │   └── ParticipantTile.jsx      (single video tile, bot tile)
            └── shared/
                └── NotFound.jsx             (404 page)
```

---

## DATABASE SCHEMA (Prisma)

Models:
1. User          — id, email, name, avatarUrl, googleId, whatsappPhone
2. Meeting       — id, title, roomCode (unique), hostId, status (SCHEDULED/LIVE/ENDED), scheduledAt, startedAt, endedAt
3. ProxySession  — id, meetingId, userId, status (IDLE/BRIEFED/ACTIVE/ESCALATING/COMPLETED), botName
4. Briefing      — id, proxySessionId (unique), userId, rawText, chromaCollectionId, chunkCount
5. TranscriptEntry — id, meetingId, speaker, text, isFinal, timestamp
6. BotEvent      — id, meetingId, proxySessionId, type (RAG_RESPONSE/LLM_RESPONSE/WHATSAPP_ESCALATION/WHATSAPP_REPLY/SILENCE/JOIN/LEAVE), input, output, latencyMs
7. WhatsAppQuery — id, proxySessionId, questionAsked, sentAt, replyText, repliedAt, status (PENDING/REPLIED/TIMED_OUT)

---

## API ROUTES

### Backend REST API (Node.js :4000)

AUTH
  GET  /api/auth/google              → redirect to Google OAuth
  GET  /api/auth/google/callback     → OAuth callback, returns JWT in redirect
  GET  /api/auth/me                  → get current user (JWT protected)
  POST /api/auth/logout              → logout (JWT protected)

MEETINGS
  POST   /api/meetings               → create meeting
  GET    /api/meetings               → list user's meetings
  GET    /api/meetings/:roomCode     → get meeting by room code
  PATCH  /api/meetings/:id/start     → set status LIVE
  PATCH  /api/meetings/:id/end       → set status ENDED

PROXY SESSIONS
  POST   /api/proxy                  → create proxy session for a meeting
  GET    /api/proxy/my               → list my proxy sessions
  GET    /api/proxy/:id              → get session with bot events + WA queries
  PATCH  /api/proxy/:id/status       → update session status

BRIEFINGS
  POST   /api/briefings              → ingest briefing text (calls AI service)
  GET    /api/briefings/:proxySessionId → get briefing

WEBHOOK
  POST   /api/webhook/whatsapp       → Twilio WhatsApp reply callback

HEALTH
  GET    /api/health                 → check postgres + redis + ai-service

### AI Service REST API (FastAPI :8000)

  POST   /briefing/ingest            → chunk + embed briefing into ChromaDB
  POST   /respond/meeting            → run full LangGraph pipeline on transcript
  POST   /respond/whatsapp-reply     → formulate meeting response from WA reply
  GET    /health                     → service health check
  GET    /docs                       → FastAPI auto-generated Swagger UI

---

## SOCKET.IO EVENTS

Client → Server:
  meeting:join          { roomCode, proxySessionId? }
  meeting:leave         { roomCode }
  meeting:audio_chunk   { roomCode, chunk: ArrayBuffer }
  meeting:send_message  { roomCode, text }

Server → Client:
  meeting:user_joined   { socketId, userId, name, avatar, isBot }
  meeting:user_left     { socketId, userId, name }
  meeting:transcript    { speaker, text, isFinal, timestamp }
  meeting:room_state    { participants, roomCode }
  meeting:message       { from, userId, text, timestamp }
  bot:status            { status }   ← idle | thinking | speaking | escalating
  bot:response          { text, audioBase64, source, timestamp }
  bot:whatsapp_sent     { question }
  bot:whatsapp_replied  { queryId, replyText, userName }

---

## LANGGRAPH BOT PIPELINE

The bot pipeline runs inside the AI service for every final transcript line.

State machine nodes:
  1. classify        → Is this question directed at the absent person? (yes/no)
  2. rag_lookup      → Retrieve top-5 similar chunks from ChromaDB briefing
  3. decide          → Score confidence 0.0–1.0
                       confidence > 0.65 → answer from RAG
                       confidence ≤ 0.65 → escalate to WhatsApp
  4. rag_respond     → Generate natural first-person meeting response
  5. escalate        → Store escalation in Redis, Node picks it up and sends WA
  6. skip            → If not directed at bot, do nothing

Graph edges:
  classify → [rag_lookup | skip]
  rag_lookup → decide
  decide → [rag_respond | escalate]
  rag_respond → END
  escalate    → END
  skip        → END

---

## WHATSAPP ESCALATION FLOW

1. LangGraph escalate node stores question in Redis key: escalation:{proxySessionId}
2. Node backend detects the escalation (polling Redis or triggered by AI response)
3. Node calls whatsapp.service.js → Twilio sends message to user's phone
4. Socket.IO broadcasts bot:whatsapp_sent to frontend
5. User replies on WhatsApp
6. Twilio calls POST /api/webhook/whatsapp
7. Node finds the pending WhatsAppQuery in DB, marks REPLIED
8. Node calls aiService.formulateWhatsAppReply()
9. AI service uses WA_REPLY_PROMPT to make it sound natural
10. Node calls ttsService.synthesizeBase64() → ElevenLabs audio
11. Socket.IO broadcasts bot:response to frontend with text + audio
12. Frontend plays audio in meeting room

---

## ENVIRONMENT VARIABLES NEEDED

Fill these in .env (copy from .env.example):

GOOGLE_API_KEY          → Google AI Studio → Create API key (for Gemini 1.5 Pro)
GOOGLE_CLIENT_ID        → Google Cloud Console → OAuth 2.0 Client ID
GOOGLE_CLIENT_SECRET    → Google Cloud Console → OAuth 2.0 Client Secret
TWILIO_ACCOUNT_SID      → Twilio Console → Account SID
TWILIO_AUTH_TOKEN       → Twilio Console → Auth Token
TWILIO_WHATSAPP_FROM    → Twilio Sandbox WhatsApp number (whatsapp:+14155238886)
DEEPGRAM_API_KEY        → Deepgram Console → Create API key
ELEVENLABS_API_KEY      → ElevenLabs Console → Profile → API key
ELEVENLABS_VOICE_ID     → ElevenLabs → choose a voice → copy ID
JWT_SECRET              → any long random string (e.g. openssl rand -hex 32)
POSTGRES_USER           → meetwala
POSTGRES_PASSWORD       → any password
POSTGRES_DB             → meetwala_db
REDIS_PASSWORD          → any password
CHROMA_AUTH_TOKEN       → any token string
LANGCHAIN_API_KEY       → LangSmith (optional, for tracing)

---

## DOCKER SERVICES AND PORTS

Service        | Container Name        | Port
---------------|----------------------|------
nginx          | meetwala-nginx        | 80
frontend       | meetwala-frontend     | 5173
backend        | meetwala-backend      | 4000
ai-service     | meetwala-ai           | 8000
postgres       | meetwala-postgres     | 5432
redis          | meetwala-redis        | 6379
chromadb       | meetwala-chromadb     | 8001

All services are on Docker network: meetwala-net
Services communicate by container name (e.g. backend calls http://ai-service:8000)

---

## KNOWN ISSUES TO FIX

1. BACKEND — Missing nodemon in devDependencies path
   Fix: In backend/package.json, nodemon is in devDependencies.
   The Dockerfile runs npm install (not npm install --omit=dev) so nodemon is available.
   Make sure Dockerfile uses: RUN npm install (not npm ci --omit=dev)

2. BACKEND — Prisma migrate needs DATABASE_URL at build time
   Fix: Run migrations AFTER containers are up, not during Docker build.
   The dev.sh script handles this: docker compose run --rm backend npx prisma migrate dev

3. BACKEND — Redis connection string parsing
   The redis.service.js manually parses REDIS_URL. 
   Better fix: pass host and port separately OR use:
   const redis = new Redis(process.env.REDIS_URL, { password: process.env.REDIS_PASSWORD })

4. AI SERVICE — ChromaDB HttpClient constructor changed in newer versions
   If chromadb>=0.5 throws on HttpClient, use:
   chromadb.HttpClient({ host: host, port: port })
   instead of positional args.

5. AI SERVICE — aioredis is deprecated in favor of redis-py async
   If aioredis fails to install, replace with:
   pip install redis[asyncio]
   And in redis_service.py:
   from redis.asyncio import from_url
   redis_client = await from_url(url, decode_responses=True)

6. FRONTEND — Zustand persist middleware import
   Make sure zustand/middleware is imported correctly.
   In zustand v4: import { persist } from 'zustand/middleware'  ✅ already correct.

7. FRONTEND — Socket.IO autoConnect false
   socket.js sets autoConnect: false, so connectSocket() must be called explicitly.
   MeetingRoom.jsx calls connectSocket() on mount — this is correct.

8. FRONTEND — Tailwind custom colors not working
   tailwind.config.js uses flat color values (e.g. brand: "#00D4FF").
   But in index.css classes like bg-brand won't work with Tailwind v3.
   Fix: Either use inline styles (already done in most components) OR
   change tailwind.config.js colors to objects: brand: { DEFAULT: "#00D4FF", 300: "#00D4FF" }

9. GENERAL — .env file
   Never commit .env to git. Always cp .env.example .env and fill values.
   All Docker services receive env vars from the root .env via docker-compose.yml.

10. GENERAL — logs directory
    backend/src/utils/logger.js writes to logs/error.log and logs/combined.log.
    Create the logs directory: mkdir -p backend/logs
    Or add it to Dockerfile: RUN mkdir -p logs

---

## SETUP STEPS IN ORDER

Step 1: Install Docker Desktop (https://docker.com)
Step 2: Clone/unzip the project
Step 3: cp .env.example .env
Step 4: Fill all API keys in .env
Step 5: chmod +x scripts/dev.sh
Step 6: ./scripts/dev.sh
         This will:
         - Start postgres, redis, chromadb first
         - Wait 8 seconds for DB health
         - Run: docker compose run --rm backend npx prisma migrate dev --name init
         - Start all remaining services
Step 7: Open http://localhost:5173
Step 8: Click "Continue with Google" to log in
Step 9: Create a meeting from the dashboard
Step 10: Click a meeting → briefing page opens → answer 6 questions
Step 11: Click "Join Meeting" → live meeting room opens
Step 12: Bot monitors the meeting and responds

---

## QUICK COMMANDS

# Start everything
docker compose up -d

# View all logs
docker compose logs -f

# View just one service
docker compose logs -f backend

# Restart one service
docker compose restart backend

# Run DB migrations manually
docker compose run --rm backend npx prisma migrate dev

# Open Prisma Studio (DB GUI)
docker compose run --rm -p 5555:5555 backend npx prisma studio

# Rebuild after code changes
docker compose up -d --build

# Stop everything
docker compose down

# Stop and delete all data (volumes)
docker compose down -v

# Access AI service Swagger UI
open http://localhost:8000/docs

# Check health of all services
curl http://localhost:4000/api/health

---

## HOW THE FULL FLOW WORKS END TO END

1. User logs in via Google OAuth → JWT stored in localStorage via Zustand persist
2. User creates a Meeting → roomCode generated (e.g. mw-ab12cd34)
3. User creates a ProxySession for that meeting (registers bot for themselves)
4. User goes to /brief/:sessionId → BriefingPage opens
5. Bot asks 6 questions via chat UI → user answers each
6. Answers concatenated into briefingText → POST /api/briefings
7. Backend calls AI service POST /briefing/ingest
8. AI service splits text into 500-char chunks with 80-char overlap
9. Chunks embedded via Google embedding-001 → stored in ChromaDB collection "briefing_{sessionId}"
10. ProxySession status updated to BRIEFED
11. User clicks "Join Meeting" → /meeting/:roomCode
12. MeetingRoom mounts → connects Socket.IO → calls joinRoom(roomCode)
13. Browser accesses webcam/mic via getUserMedia
14. Audio chunks streamed every 250ms via Socket.IO → backend
15. Backend forwards to Deepgram live STT → returns transcript lines
16. Transcript broadcast to all room participants via Socket.IO
17. Backend also calls POST /respond/meeting on AI service for each final transcript line
18. LangGraph pipeline runs:
     - classify: is this for the bot? → if no, skip
     - rag_lookup: find top 5 relevant briefing chunks
     - decide: confidence score → respond or escalate
     - rag_respond: generate first-person answer using Gemini 1.5 Pro
19. Response text sent to ElevenLabs → base64 audio
20. Socket.IO broadcasts bot:response { text, audioBase64 } to frontend
21. Frontend plays audio + shows text in BotStatusPanel
22. If escalating: Redis stores question → backend sends WhatsApp via Twilio
23. User replies on WhatsApp → Twilio POSTs to /api/webhook/whatsapp
24. Backend finds pending query, calls AI service to formulate response
25. Response played in meeting room as if bot answered normally

---

## FILE THAT NEEDS CREATION (not in zip)

backend/logs/.gitkeep   ← create this so the logs directory exists
Content: (empty file)

---

## PROMPT TO GIVE THE AI ASSISTANT

"I have a project called MeetWala. It is a full-stack JavaScript + Python project.
Read the summary above carefully. Then:
1. Check every file for syntax errors and fix them
2. Verify all imports are correct (no TypeScript imports, no missing modules)
3. Make sure package.json files have all required dependencies
4. Ensure all environment variable references match what is in .env.example
5. Fix the 10 known issues listed in the KNOWN ISSUES section
6. Create backend/logs/.gitkeep
7. Verify the Prisma schema is valid and all model relations are correct
8. Make sure the LangGraph bot_graph.py BotState TypedDict matches what all nodes return
9. Check that Socket.IO event names are consistent between socket.server.js and socket.js (frontend)
10. Confirm the docker-compose.yml service dependencies and healthchecks are correct
After fixing, give me the corrected versions of any files that had errors."
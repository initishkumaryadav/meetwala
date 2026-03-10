<p align="center">
  <img src="https://img.shields.io/badge/MeetWala-AI%20Meeting%20Proxy-00D4FF?style=for-the-badge&logo=robot&logoColor=white" alt="MeetWala" />
</p>

<h1 align="center">🤖 MeetWala</h1>
<h3 align="center">AI-Powered Virtual Meeting Proxy System</h3>

<p align="center">
  <em>Can't attend a meeting? Let your AI bot attend for you — it listens, answers, and escalates when it doesn't know.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js" />
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker" />
  <img src="https://img.shields.io/badge/LangGraph-AI%20Pipeline-FF6F00" />
</p>

---

## 📖 Table of Contents

1. [What is MeetWala?](#-what-is-meetwala)
2. [The Problem We Solve](#-the-problem-we-solve)
3. [Key Features](#-key-features)
4. [System Architecture](#-system-architecture)
5. [Technology Stack](#-technology-stack)
6. [How It Works — Step by Step](#-how-it-works--step-by-step)
7. [Service Breakdown](#-service-breakdown)
   - [Frontend (React)](#1-frontend--react-18--vite--tailwind-css)
   - [Backend (Node.js)](#2-backend--nodejs-20--express--socketio)
   - [AI Service (Python)](#3-ai-service--python-312--fastapi--langgraph)
   - [Databases](#4-databases)
   - [Infrastructure](#5-infrastructure--docker--nginx)
8. [AI Bot Pipeline (LangGraph)](#-ai-bot-pipeline--langgraph-state-machine)
9. [WhatsApp Escalation Flow](#-whatsapp-escalation-flow)
10. [Real-Time Communication](#-real-time-communication)
11. [Database Schema](#-database-schema)
12. [API Endpoints](#-api-endpoints)
13. [Project Structure](#-project-structure)
14. [Setup & Installation](#-setup--installation)
15. [Environment Variables](#-environment-variables)
16. [Useful Commands](#-useful-commands)

---

## 🧠 What is MeetWala?

**MeetWala** is a full-stack, AI-powered virtual meeting proxy system. It allows users who cannot attend a meeting to send an **AI bot** in their place. The bot:

- **Listens** to the meeting conversation in real-time using speech-to-text
- **Answers questions** on the user's behalf using information the user briefed it with before the meeting
- **Escalates to WhatsApp** when the bot is unsure about an answer — it messages the real user, gets their reply, and delivers it back in the meeting with synthesized speech

Think of it as your **intelligent meeting stand-in** that knows what you'd say, and asks you when it doesn't.

---

## 🎯 The Problem We Solve

| Problem | MeetWala's Solution |
|---------|-------------------|
| You have two meetings at the same time | Send your AI bot to one meeting while you attend the other |
| You can't make it to a quick standup | Brief the bot with your updates; it delivers them naturally |
| You're traveling but need meeting representation | The bot represents you and contacts you via WhatsApp only when needed |
| Meeting notes are never accurate enough | Full real-time transcription + bot activity log for every meeting |

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎥 **Live Video Meetings** | Full WebRTC-based video conferencing with screen sharing, reactions, and hand raise |
| 🤖 **AI Bot Proxy** | An AI bot that joins the meeting, listens, and responds on your behalf |
| 📝 **Pre-Meeting Briefing** | Chat-style interface to brief the bot — upload documents, images, PDFs, or type your updates |
| 🧠 **RAG-Powered Answers** | The bot retrieves answers from your briefing using vector similarity search (ChromaDB) |
| 📊 **Confidence Scoring** | The AI scores its confidence (0–1) on every answer. If below 0.65, it escalates |
| 📱 **WhatsApp Escalation** | When unsure, the bot messages you on WhatsApp, waits for your reply, and speaks it in the meeting |
| 🗣️ **Text-to-Speech** | Bot responses are delivered as natural synthesized speech using ElevenLabs / Edge TTS |
| 🎙️ **Real-Time Transcription** | Every word in the meeting is transcribed live using Deepgram's speech-to-text engine |
| 🔐 **Google OAuth** | Secure authentication via Google Sign-In with JWT session management |
| 📅 **Meeting Scheduling** | Create and schedule meetings with unique room codes |
| 📄 **PDF Summary Export** | Download a complete meeting summary as a PDF after the meeting ends |
| 💬 **In-Meeting Chat** | Text chat alongside video during meetings |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              NGINX (Port 80)                           │
│                          Reverse Proxy + Load Balancer                  │
│    ┌──────────┐    ┌──────────────┐    ┌────────────────────────┐      │
│    │  /       │───▶│   Frontend    │    │  /socket.io/ (WebSocket)│     │
│    │  /api/   │───▶│   Backend     │    │  upgraded to Backend    │     │
│    └──────────┘    └──────────────┘    └────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                        │
         ▼                    ▼                        ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│  Frontend   │     │    Backend      │     │    AI Service        │
│  React 18   │◄───▶│  Node.js 20    │────▶│    Python 3.12       │
│  Vite 5     │     │  Express       │     │    FastAPI            │
│  Port 5173  │     │  Socket.IO     │     │    LangGraph          │
│             │     │  Port 4000     │     │    Port 8000          │
└─────────────┘     └───────┬────────┘     └──────────┬───────────┘
                            │                          │
              ┌─────────────┼──────────────────────────┤
              │             │                          │
              ▼             ▼                          ▼
     ┌──────────────┐ ┌──────────┐          ┌────────────────┐
     │ PostgreSQL 16│ │ Redis 7  │          │  ChromaDB 0.5  │
     │ Primary DB   │ │ Cache +  │          │  Vector Store  │
     │ Port 5432    │ │ Escalation│          │  (RAG)         │
     │              │ │ Queue    │          │  Port 8001     │
     │              │ │ Port 6379│          │                │
     └──────────────┘ └──────────┘          └────────────────┘
```

### How Services Connect

```
Frontend ──── WebSocket (Socket.IO) ───── Backend
Frontend ──── HTTP REST (Axios) ───────── Backend
Backend  ──── HTTP REST (Axios) ───────── AI Service (FastAPI)
Backend  ──── Prisma ORM ─────────────── PostgreSQL
Backend  ──── IORedis ─────────────────── Redis
Backend  ──── Deepgram SDK ────────────── Deepgram Cloud (STT)
Backend  ──── Twilio SDK ──────────────── Twilio Cloud (WhatsApp)
Backend  ──── ElevenLabs API ──────────── ElevenLabs Cloud (TTS)
AI Service ── LangChain + ChromaDB ────── ChromaDB (Vector Search)
AI Service ── OpenAI SDK ──────────────── OpenAI Cloud (GPT-4o-mini)
AI Service ── Async Redis ─────────────── Redis (Escalation Queue)
```

---

## 🛠 Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3 | UI component framework |
| **Vite** | 5 | Lightning-fast build tool and dev server |
| **Tailwind CSS** | 3.4 | Utility-first CSS framework for rapid styling |
| **Framer Motion** | 11.3 | Smooth animations and transitions |
| **Zustand** | 4.5 | Lightweight state management |
| **React Router DOM** | 6 | Client-side routing |
| **TanStack React Query** | 5 | Server state management and data caching |
| **Socket.IO Client** | 4.7 | Real-time bidirectional communication |
| **Axios** | 1.7 | HTTP client for REST API calls |
| **WebRTC** | Native | Peer-to-peer video/audio streaming |
| **Lucide React** | 0.400 | Icon library |
| **React Hot Toast** | 2.4 | Notification system |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20 | Server runtime |
| **Express** | 4.19 | HTTP web framework |
| **Socket.IO** | 4.7 | Real-time WebSocket server |
| **Prisma** | 5.16 | Type-safe ORM for PostgreSQL |
| **PostgreSQL** | 16 | Primary relational database |
| **IORedis** | 5.4 | Redis client for caching and pub/sub |
| **Passport.js** | — | Authentication middleware (Google OAuth2 + JWT) |
| **jsonwebtoken** | — | JWT token generation and verification |
| **Deepgram SDK** | 3.3 | Real-time speech-to-text streaming |
| **Twilio SDK** | 5.2 | WhatsApp messaging for escalation |
| **ElevenLabs API** | — | High-quality text-to-speech synthesis |
| **PDFKit** | 0.17 | Meeting summary PDF generation |
| **Winston** | 3.13 | Structured application logging |
| **Helmet** | — | Security headers middleware |
| **CORS** | — | Cross-origin resource sharing |

### AI / ML Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.12 | AI service runtime |
| **FastAPI** | 0.115 | Async web framework for AI endpoints |
| **Uvicorn** | 0.30 | ASGI server for FastAPI |
| **LangChain** | 0.3.7 | LLM orchestration framework |
| **LangGraph** | 0.2.53 | Stateful AI pipeline as a state machine |
| **OpenAI GPT-4o-mini** | — | Large Language Model for reasoning |
| **OpenAI Embeddings** | text-embedding-3-small | Text vectorization for similarity search |
| **ChromaDB** | 0.5.5 | Vector database for RAG (Retrieval-Augmented Generation) |
| **Edge TTS** | 6.1 | Free Microsoft text-to-speech engine |
| **PyMuPDF** | — | PDF text extraction |
| **python-docx** | — | DOCX document parsing |
| **Pillow** | — | Image processing |
| **Pydantic** | v2 | Request/response data validation |
| **Loguru** | — | Structured logging |

### Infrastructure Technologies

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization of all services |
| **Docker Compose** | Multi-container orchestration (7 containers) |
| **Nginx** | Reverse proxy, routing, and WebSocket upgrade |
| **Render** | Cloud hosting platform (production deployment) |
| **Google STUN Servers** | NAT traversal for WebRTC peer connections |

---

## 🔄 How It Works — Step by Step

### Phase 1: Setup & Briefing

```
  👤 User                          🖥️ System
  ─────                           ──────
  
  1. Logs in via Google OAuth ──────▶ JWT token issued
  
  2. Creates a meeting ─────────────▶ Meeting created with unique room code
                                      Status: SCHEDULED
  
  3. Creates a proxy session ───────▶ AI bot assigned to the meeting
                                      Status: IDLE
  
  4. Opens briefing page ──────────▶ Chat-style interface loads
  
  5. Types updates / uploads        ▶ Text chunked into 500-char segments
     documents / PDFs / images        with 80-char overlap
                                    ▶ Each chunk embedded using
                                      text-embedding-3-small
                                    ▶ Vectors stored in ChromaDB
                                      collection: briefing_{sessionId}
  
  6. Clicks "Finalize Briefing" ───▶ Session status → BRIEFED
                                      Bot is now ready!
```

### Phase 2: Live Meeting

```
  👥 Meeting Participants           🤖 AI Bot
  ──────────────────────           ────────
  
  1. Participants join meeting ────▶ WebRTC connections established
                                    Deepgram STT stream started
                                    Bot activated (status: ACTIVE)
  
  2. Someone speaks ───────────────▶ Audio streamed to Deepgram
                                    Real-time transcription generated
  
  3. Question directed at bot ─────▶ LangGraph pipeline triggered:
                                    
                                    ┌─ CLASSIFY: Is this for the bot?
                                    │   └─ YES ─▶
                                    ├─ RAG LOOKUP: Search ChromaDB
                                    │   └─ Top 5 relevant chunks found
                                    ├─ DECIDE: Confidence score = 0.82
                                    │   └─ Confident (> 0.65) ─▶
                                    └─ RESPOND: Generate natural answer
                                       └─ "Based on my work this week..."
                                    
                                    ▶ Text-to-speech synthesized
                                    ▶ Audio played in meeting
                                    ▶ Status: idle → thinking → speaking → idle
```

### Phase 3: WhatsApp Escalation (When Bot is Unsure)

```
  🤖 Bot                 📱 WhatsApp              👤 User
  ────                   ─────────                ─────
  
  1. Confidence = 0.42 (< 0.65)
     "I'm not sure about this"
     
  2. Stores question ──▶ Redis: escalation:{sessionId}
  
  3. Sends WhatsApp ───▶ "Hey! Someone in your    ──▶ User reads
     via Twilio           meeting asked: [question].     the message
                          What should I say?"
  
  4. Bot status: ESCALATING
     "Checking with the user..."
  
  5.                      User types reply ◀────────── "Tell them the
                                                        deadline is Friday"
  
  6. Twilio webhook ◀── Reply received
  
  7. AI reformulates ──▶ "The deadline for that
     for natural speech   deliverable is this Friday"
  
  8. TTS synthesis ────▶ Audio played in meeting
  
  9. Bot status: idle
```

---

## 📦 Service Breakdown

### 1. Frontend — React 18 + Vite + Tailwind CSS

The frontend is a **single-page application** built with React that provides:

#### Pages

| Page | Route | Description |
|------|-------|-------------|
| **Login** | `/login` | Google OAuth sign-in with animated background and feature showcase cards |
| **Dashboard** | `/` | Home screen — view all meetings, create/join meetings, manage proxy sessions, schedule future meetings with calendar |
| **Briefing** | `/brief/:sessionId` | Chat-style interface to brief the AI bot — type messages, upload documents (PDF/DOCX/images), have a conversation with the bot to extract key information |
| **Meeting Room** | `/meeting/:roomCode` | Full-featured meeting room — video grid, controls (mic/camera/screen share), live transcript sidebar, bot status panel, in-meeting chat, reactions |

#### State Management

- **Auth Store (Zustand + Persist)** — Stores JWT token and user info; persists across page refreshes
- **Meeting Store (Zustand)** — Stores real-time meeting state: participants, transcripts, bot status, WebRTC streams, chat messages

#### Key Frontend Features
- **WebRTC Video Grid** — Peer-to-peer video with dynamic layout (auto/grid/sidebar modes)
- **Live Transcription Panel** — Real-time captions with speaker identification
- **Bot Status Indicators** — Visual indicators for bot state (idle → thinking → speaking → escalating)
- **Responsive Design** — Works on desktop and tablet screens

---

### 2. Backend — Node.js 20 + Express + Socket.IO

The backend is the **central orchestrator** that connects all services:

#### Core Responsibilities

| Responsibility | How |
|---------------|-----|
| **Authentication** | Google OAuth2 flow → JWT issued → stateless auth |
| **Meeting Management** | CRUD operations via Prisma → PostgreSQL |
| **Real-Time Communication** | Socket.IO server handles all live events |
| **Speech-to-Text** | Deepgram SDK streams audio, returns transcripts |
| **AI Orchestration** | Forwards transcripts to AI service, processes responses |
| **WhatsApp Messaging** | Twilio SDK sends escalation messages, receives replies via webhook |
| **Text-to-Speech** | ElevenLabs API converts bot responses to audio |
| **PDF Export** | PDFKit generates meeting summary documents |

#### Middleware Stack

```
Request → Morgan (logging) → Helmet (security) → CORS → Rate Limiter
       → Compression → JSON Parser → Passport (auth) → Routes
```

#### Socket.IO — Real-Time Event Flow

```
Client connects with JWT ──▶ Auth verified ──▶ Socket established
                                                     │
   ┌─────────────────────────────────────────────────┘
   │
   ├── meeting:join ────── User enters room, auto-start if scheduled
   ├── meeting:audio_chunk ── Audio → Deepgram → Transcript
   ├── meeting:send_message ── Chat message broadcast
   ├── webrtc:offer/answer/ice ── Video call signaling
   │
   └── Server emits:
       ├── meeting:transcript ──── Live captions
       ├── bot:status ─────────── Bot state changes
       ├── bot:response ───────── Answer text + audio
       ├── bot:whatsapp_sent ──── Escalation notification
       └── bot:whatsapp_replied ── User reply received
```

---

### 3. AI Service — Python 3.12 + FastAPI + LangGraph

The AI service is the **intelligence engine** of MeetWala:

#### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /briefing/ingest` | Chunk briefing text → embed → store in ChromaDB |
| `POST /briefing/upload` | Extract text from docs/images/PDFs → ingest |
| `POST /briefing/chat` | Conversational briefing with the bot |
| `POST /respond/meeting` | Run full LangGraph pipeline on a transcript line |
| `POST /respond/whatsapp-reply` | Reformat WhatsApp reply for natural meeting speech |
| `POST /respond/tts` | Convert text → speech (Edge TTS) |
| `GET /health` | Service health check |
| `GET /docs` | Auto-generated Swagger API documentation |

#### Document Processing

```
PDF ───────▶ PyMuPDF ──────▶ Extracted text
DOCX ──────▶ python-docx ──▶ Extracted text
Images ────▶ OpenAI Vision ─▶ Extracted text (GPT-4o-mini reads the image)
Text ──────▶ Direct ────────▶ Raw text

All extracted text ──▶ Chunked (500 chars, 80 overlap)
                   ──▶ Embedded (text-embedding-3-small)
                   ──▶ Stored in ChromaDB
```

---

### 4. Databases

#### PostgreSQL 16 — Primary Database

Stores all structured data: users, meetings, proxy sessions, briefings, transcripts, bot events, and WhatsApp queries. Accessed via **Prisma ORM** with migration support.

#### Redis 7 — Cache & Queue

- **Escalation Queue**: Stores pending WhatsApp questions (key: `escalation:{proxySessionId}`)
- **Session Cache**: Temporary data for active meeting sessions
- **Graceful Degradation**: System continues working if Redis is temporarily unavailable

#### ChromaDB 0.5 — Vector Database

- **Purpose**: Stores vector embeddings of briefing content for RAG similarity search
- **Collections**: One per proxy session (`briefing_{proxySessionId}`)
- **Embedding Model**: OpenAI `text-embedding-3-small`
- **Search**: Top-5 most similar chunks returned for each query

---

### 5. Infrastructure — Docker + Nginx

#### Docker Compose — 7 Containers

| Container | Image/Build | Port | Purpose |
|-----------|-------------|------|---------|
| `meetwala-nginx` | Nginx | 80 | Reverse proxy, routes traffic |
| `meetwala-frontend` | ./frontend | 5173 | React dev server |
| `meetwala-backend` | ./backend | 4000 | Node.js API + Socket.IO |
| `meetwala-ai` | ./ai-services | 8000 | Python AI service |
| `meetwala-postgres` | PostgreSQL 16 | 5432 | Primary database |
| `meetwala-redis` | Redis 7 | 6379 | Cache + escalation queue |
| `meetwala-chromadb` | ChromaDB | 8001 | Vector database |

All containers communicate on the `meetwala-net` Docker bridge network using container names as hostnames.

#### Nginx Routing

```
http://localhost/           ──▶  Frontend (React)
http://localhost/api/       ──▶  Backend (Express)
http://localhost/socket.io/ ──▶  Backend (Socket.IO with WebSocket upgrade)
```

---

## 🧪 AI Bot Pipeline — LangGraph State Machine

The heart of MeetWala is the **LangGraph state machine** that processes every transcript line:

```
                    ┌──────────────────────┐
                    │      START           │
                    │  (Transcript Input)   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     CLASSIFY          │
                    │  "Is this question   │
                    │   directed at the    │
                    │   absent person?"    │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │                      │
                    ▼                      ▼
            ┌──────────┐          ┌──────────────┐
            │   SKIP   │          │  RAG LOOKUP  │
            │  (Not    │          │  Search top  │
            │  for bot)│          │  5 chunks in │
            │          │          │  ChromaDB    │
            └────┬─────┘          └──────┬───────┘
                 │                       │
                 ▼                       ▼
              ┌─────┐          ┌──────────────────┐
              │ END │          │     DECIDE        │
              └─────┘          │  Confidence       │
                               │  Score (0–1)      │
                               └────────┬──────────┘
                                        │
                          ┌─────────────┴──────────────┐
                          │                            │
                     confidence > 0.65            confidence ≤ 0.65
                          │                            │
                          ▼                            ▼
                 ┌─────────────────┐        ┌──────────────────┐
                 │  RAG RESPOND    │        │    ESCALATE       │
                 │  Generate answer│        │  Save to Redis    │
                 │  using context  │        │  Send WhatsApp    │
                 │  (GPT-4o-mini)  │        │  to real user     │
                 └────────┬────────┘        └────────┬─────────┘
                          │                          │
                          ▼                          ▼
                       ┌─────┐                    ┌─────┐
                       │ END │                    │ END │
                       └─────┘                    └─────┘
```

### Pipeline Nodes Explained

| Node | LLM | Temperature | What It Does |
|------|-----|-------------|-------------|
| **Classify** | GPT-4o-mini | 0.0 (deterministic) | Analyzes transcript to determine if the statement/question is directed at the absent person |
| **RAG Lookup** | — | — | Performs vector similarity search in ChromaDB to find the 5 most relevant briefing chunks |
| **Decide** | GPT-4o-mini | 0.0 (deterministic) | Evaluates if the retrieved context is sufficient to answer confidently; returns a score 0–1 |
| **RAG Respond** | GPT-4o-mini | 0.7 (creative) | Generates a natural, first-person response using the briefing context (2–4 sentences) |
| **Escalate** | — | — | Stores the question in Redis and triggers a WhatsApp message to the real user |
| **Skip** | — | — | No-op; ignores transcript lines not directed at the bot |

---

## 📱 WhatsApp Escalation Flow

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ AI says  │     │ Question │     │ Twilio   │     │ User's   │
  │ "Not     │────▶│ stored   │────▶│ sends    │────▶│ WhatsApp │
  │ sure"    │     │ in Redis │     │ WhatsApp │     │ receives │
  │ (< 0.65) │     │          │     │ message  │     │ question │
  └──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                          │
                                                     User replies
                                                          │
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌───┴──────┐
  │ Audio    │     │ AI makes │     │ Backend  │     │ Twilio   │
  │ played   │◀────│ it sound │◀────│ receives │◀────│ webhook  │
  │ in       │     │ natural  │     │ via      │     │ callback │
  │ meeting  │     │ (prompt) │     │ POST     │     │          │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## 🔌 Real-Time Communication

### WebRTC — Video/Audio

```
Peer A                                              Peer B
  │                                                    │
  ├── createOffer() ──▶ Socket.IO ──▶ handleOffer() ──┤
  │                                                    │
  ├── handleAnswer() ◀── Socket.IO ◀── createAnswer() ┤
  │                                                    │
  ├── ICE candidates ◀──── exchanged ────▶             │
  │                                                    │
  └────────── Direct peer-to-peer media stream ────────┘
  
  STUN Servers: stun.l.google.com:19302 (NAT traversal)
```

### Socket.IO — Event-Driven Architecture

| Direction | Event | Payload | Purpose |
|-----------|-------|---------|---------|
| Client → Server | `meeting:join` | `{roomCode, proxySessionId}` | Join meeting room |
| Client → Server | `meeting:audio_chunk` | `{roomCode, chunk}` | Stream audio for STT |
| Client → Server | `meeting:send_message` | `{roomCode, text}` | Send chat message |
| Server → Client | `meeting:transcript` | `{speaker, text, isFinal}` | Live transcription |
| Server → Client | `bot:status` | `{status}` | Bot state: idle/thinking/speaking/escalating |
| Server → Client | `bot:response` | `{text, audioBase64}` | Bot answer with audio |
| Server → Client | `bot:whatsapp_sent` | `{question}` | Escalation sent to user |
| Server → Client | `bot:whatsapp_replied` | `{replyText}` | User replied via WhatsApp |

### Deepgram — Speech-to-Text

```
Microphone → Audio Chunks (via Socket.IO) → Backend → Deepgram Live API
                                                           │
                                          Interim results ◀─┤
                                          Final results   ◀─┘
                                                │
                                         Broadcast via Socket.IO
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                              TranscriptPanel           LangGraph
                              (UI display)              (Bot pipeline)
```

---

## 🗄 Database Schema

```
┌───────────────┐     ┌──────────────────┐     ┌───────────────────┐
│     User      │     │     Meeting       │     │   ProxySession    │
├───────────────┤     ├──────────────────┤     ├───────────────────┤
│ id (UUID)     │────▶│ hostId (FK)       │     │ id                │
│ email         │     │ id                │◀────│ meetingId (FK)    │
│ name          │     │ title             │     │ userId (FK)       │
│ avatarUrl     │────▶│ roomCode (unique) │     │ status            │
│ googleId      │     │ status            │     │ (IDLE | BRIEFED   │
│ whatsappPhone │     │ (SCHEDULED |      │     │  ACTIVE |         │
└───────────────┘     │  LIVE | ENDED)    │     │  ESCALATING |     │
                      │ scheduledAt       │     │  COMPLETED)       │
                      │ startedAt/endedAt │     │ botName           │
                      └──────────────────┘     └─────────┬─────────┘
                                                         │
                      ┌──────────────────┐     ┌─────────┴─────────┐
                      │ TranscriptEntry  │     │    Briefing       │
                      ├──────────────────┤     ├───────────────────┤
                      │ id               │     │ id                │
                      │ meetingId (FK)   │     │ proxySessionId    │
                      │ speaker          │     │   (unique, FK)    │
                      │ text             │     │ rawText           │
                      │ isFinal          │     │ chromaCollectionId│
                      │ timestamp        │     │ chunkCount        │
                      └──────────────────┘     └───────────────────┘

                      ┌──────────────────┐     ┌───────────────────┐
                      │    BotEvent      │     │  WhatsAppQuery    │
                      ├──────────────────┤     ├───────────────────┤
                      │ id               │     │ id                │
                      │ meetingId (FK)   │     │ proxySessionId(FK)│
                      │ proxySessionId   │     │ questionAsked     │
                      │ type:            │     │ sentAt            │
                      │  RAG_RESPONSE    │     │ replyText         │
                      │  LLM_RESPONSE   │     │ repliedAt         │
                      │  WA_ESCALATION  │     │ status:           │
                      │  WA_REPLY       │     │  PENDING          │
                      │  SILENCE        │     │  REPLIED          │
                      │  JOIN / LEAVE   │     │  TIMED_OUT        │
                      │ input, output   │     └───────────────────┘
                      │ latencyMs       │
                      └──────────────────┘
```

---

## 🔗 API Endpoints

### Backend REST API (Node.js — Port 4000)

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Redirect to Google OAuth consent screen |
| GET | `/api/auth/google/callback` | OAuth callback — issues JWT |
| GET | `/api/auth/me` | Get current authenticated user |
| POST | `/api/auth/logout` | Logout (invalidate session) |

#### Meetings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/meetings` | Create a new meeting |
| GET | `/api/meetings` | List all user's meetings |
| GET | `/api/meetings/join/:roomCode` | Join a meeting by room code |
| GET | `/api/meetings/:roomCode` | Get meeting details |
| PATCH | `/api/meetings/:id/start` | Start meeting (set LIVE) |
| PATCH | `/api/meetings/:id/end` | End meeting |
| GET | `/api/meetings/:roomCode/summary-pdf` | Download meeting summary as PDF |

#### Proxy Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proxy` | Create a proxy session (assign bot to meeting) |
| GET | `/api/proxy/my` | List my proxy sessions |
| GET | `/api/proxy/:id` | Get session details with bot events |
| POST | `/api/proxy/:id/activate` | Activate the bot |
| POST | `/api/proxy/:id/deactivate` | Deactivate the bot |
| PATCH | `/api/proxy/:id/status` | Update session status |

#### Briefings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/briefings` | Ingest briefing text → AI service → ChromaDB |
| POST | `/api/briefings/upload` | Upload documents/images for briefing |
| POST | `/api/briefings/chat` | Conversational briefing with AI |
| POST | `/api/briefings/finalize` | Finalize briefing (mark session as BRIEFED) |

#### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhook/whatsapp` | Twilio WhatsApp reply callback |

#### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check PostgreSQL, Redis, AI service availability |

### AI Service API (FastAPI — Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/briefing/ingest` | Chunk + embed briefing text into ChromaDB |
| POST | `/briefing/upload` | Process documents/images and ingest |
| POST | `/briefing/chat` | Chat-based briefing with AI |
| POST | `/respond/meeting` | Run full LangGraph pipeline on transcript |
| POST | `/respond/whatsapp-reply` | Reformat WhatsApp reply for meeting speech |
| POST | `/respond/tts` | Text-to-speech conversion (Edge TTS) |
| GET | `/health` | Service health check |
| GET | `/docs` | Interactive Swagger API documentation |

---

## 📂 Project Structure

```
meetwala/
│
├── docker-compose.yml          # Development: 7 containers
├── docker-compose.prod.yml     # Production: optimized images
├── render.yaml                 # Render.com deployment config
├── .env.example                # Template for environment variables
│
├── nginx/
│   ├── nginx.conf              # Dev reverse proxy config
│   └── nginx.prod.conf         # Production nginx config
│
├── scripts/
│   ├── dev.sh                  # Development startup script
│   └── init.sql                # Database initialization
│
├── frontend/                   # React SPA
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx             # Routes definition
│       ├── main.jsx            # React entry point
│       ├── index.css           # Tailwind + custom styles
│       ├── components/
│       │   ├── dashboard/
│       │   │   ├── LoginPage.jsx       # Google sign-in
│       │   │   └── Dashboard.jsx       # Home screen
│       │   ├── briefing/
│       │   │   └── BriefingPage.jsx    # Pre-meeting briefing
│       │   ├── meeting/
│       │   │   ├── MeetingRoom.jsx     # Live meeting UI
│       │   │   ├── ParticipantTile.jsx # Video tile
│       │   │   ├── TranscriptPanel.jsx # Live captions
│       │   │   └── BotStatusPanel.jsx  # Bot status display
│       │   └── shared/
│       │       └── NotFound.jsx        # 404 page
│       ├── services/
│       │   ├── api.js                  # Axios HTTP client
│       │   └── socket.js              # Socket.IO + WebRTC
│       ├── store/
│       │   ├── auth.store.js           # Auth state (Zustand)
│       │   └── meeting.store.js        # Meeting state (Zustand)
│       └── hooks/
│           └── useMediaQuery.js        # Responsive hook
│
├── backend/                    # Node.js API Server
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma              # Database schema
│   └── src/
│       ├── index.js                    # Express + Socket.IO entry
│       ├── middleware/
│       │   ├── auth.middleware.js      # JWT verification
│       │   ├── passport.js            # Google OAuth config
│       │   ├── error.handler.js       # Global error handler
│       │   └── request.logger.js      # Request logging
│       ├── routes/
│       │   ├── auth.routes.js         # Authentication
│       │   ├── meeting.routes.js      # Meeting CRUD
│       │   ├── briefing.routes.js     # Briefing ingestion
│       │   ├── proxy.routes.js        # Proxy session mgmt
│       │   ├── webhook.routes.js      # WhatsApp callbacks
│       │   └── health.routes.js       # Health checks
│       ├── services/
│       │   ├── db.service.js          # Prisma singleton
│       │   ├── redis.service.js       # Redis client
│       │   ├── ai.service.js          # AI service client
│       │   ├── transcription.service.js # Deepgram STT
│       │   ├── tts.service.js         # ElevenLabs TTS
│       │   └── whatsapp.service.js    # Twilio WhatsApp
│       ├── socket/
│       │   └── socket.server.js       # Socket.IO events
│       └── utils/
│           ├── logger.js              # Winston logger
│           └── nanoid.js              # ID generator
│
└── ai-services/                # Python AI Engine
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── main.py                     # FastAPI app entry
        ├── api/
        │   ├── briefing.py            # Briefing endpoints
        │   ├── respond.py             # Bot response endpoints
        │   └── health.py              # Health check
        ├── core/
        │   ├── langgraph/
        │   │   └── bot_graph.py       # LangGraph state machine
        │   ├── llm/
        │   │   ├── gemini.py          # LLM initialization
        │   │   └── prompts.py         # All prompt templates
        │   └── rag/
        │       ├── chroma.py          # ChromaDB client
        │       └── retriever.py       # Chunk + embed + search
        └── services/
            └── redis_service.py       # Async Redis client
```

---

## 🚀 Setup & Installation

### Prerequisites

- [Docker Desktop](https://docker.com) installed and running
- Google Cloud Console project with OAuth 2.0 credentials
- API keys for: Deepgram, Twilio, ElevenLabs, OpenAI (or Google AI)

### Steps

```bash
# 1. Clone the repository
git clone <repository-url>
cd meetwala

# 2. Create environment file
cp .env.example .env

# 3. Fill in all API keys in .env (see Environment Variables section)

# 4. Start all services
docker compose up -d

# 5. Run database migrations
docker compose run --rm backend npx prisma migrate dev

# 6. Open the application
# Visit http://localhost in your browser
```

### Or use the automated script:
```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

---

## 🔑 Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth 2.0 login |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | OAuth 2.0 login |
| `OPENAI_API_KEY` | OpenAI Platform | GPT-4o-mini + Embeddings |
| `DEEPGRAM_API_KEY` | Deepgram Console | Real-time speech-to-text |
| `TWILIO_ACCOUNT_SID` | Twilio Console | WhatsApp messaging |
| `TWILIO_AUTH_TOKEN` | Twilio Console | WhatsApp messaging |
| `TWILIO_WHATSAPP_FROM` | Twilio Sandbox | WhatsApp sender number |
| `ELEVENLABS_API_KEY` | ElevenLabs Console | Text-to-speech |
| `ELEVENLABS_VOICE_ID` | ElevenLabs | Voice selection |
| `JWT_SECRET` | Self-generated | JWT signing key |
| `POSTGRES_USER` | Self-defined | Database username |
| `POSTGRES_PASSWORD` | Self-defined | Database password |
| `POSTGRES_DB` | Self-defined | Database name |
| `REDIS_PASSWORD` | Self-defined | Redis password |
| `CHROMA_AUTH_TOKEN` | Self-defined | ChromaDB auth token |

---

## 💻 Useful Commands

```bash
# Start all services
docker compose up -d

# View logs (all services)
docker compose logs -f

# View logs (single service)
docker compose logs -f backend

# Restart a service
docker compose restart backend

# Rebuild after code changes
docker compose up -d --build

# Run database migrations
docker compose run --rm backend npx prisma migrate dev

# Open Prisma Studio (database GUI)
docker compose run --rm -p 5555:5555 backend npx prisma studio

# Access AI service API docs
# Visit http://localhost:8000/docs

# Check system health
curl http://localhost:4000/api/health

# Stop all services
docker compose down

# Stop and remove all data
docker compose down -v
```

---

<p align="center">
  Built with ❤️ using React, Node.js, Python, LangChain, LangGraph, and a whole lot of WebSockets.
</p>

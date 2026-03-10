const { Server }          = require("socket.io");
const jwt                 = require("jsonwebtoken");
const { prisma }          = require("../services/db.service");
const logger              = require("../utils/logger");

// Lazy-load services to avoid circular deps
let _services;
function services() {
  if (!_services) {
    _services = {
      transcription: require("../services/transcription.service").transcriptionService,
      ai:            require("../services/ai.service").aiService,
      tts:           require("../services/tts.service").ttsService,
      whatsapp:      require("../services/whatsapp.service").whatsappService,
      redis:         require("../services/redis.service").redis,
    };
  }
  return _services;
}

let io = null;

const EVENTS = {
  USER_JOINED:       "meeting:user_joined",
  USER_LEFT:         "meeting:user_left",
  TRANSCRIPT_UPDATE: "meeting:transcript",
  ROOM_STATE:        "meeting:room_state",
  MESSAGE:           "meeting:message",
  BOT_STATUS:        "bot:status",
  BOT_RESPONSE:      "bot:response",
  WHATSAPP_SENT:     "bot:whatsapp_sent",
  WHATSAPP_REPLIED:  "bot:whatsapp_replied",
  // WebRTC signaling
  WEBRTC_OFFER:      "webrtc:offer",
  WEBRTC_ANSWER:     "webrtc:answer",
  WEBRTC_ICE:        "webrtc:ice-candidate",
};

// Map roomCode → Set of socket IDs
const rooms = new Map();
// Map roomCode → active proxy session info (for bot)
const activeBots = new Map();
// Debounce bot invocation per room (prevent double-fire)
const botProcessing = new Map();

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.APP_URL || "http://localhost:5173", credentials: true },
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 1e6,
  });

  // JWT authentication middleware
  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) return next(new Error("No token provided"));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id} (${socket.user.name})`);

    // ── Join meeting room ──────────────────────────────
    socket.on("meeting:join", async ({ roomCode, proxySessionId }) => {
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.proxySessionId = proxySessionId;

      if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
      rooms.get(roomCode).add(socket.id);

      // Notify others about new user
      socket.to(roomCode).emit(EVENTS.USER_JOINED, {
        socketId: socket.id,
        userId:   socket.user.id,
        name:     socket.user.name,
        avatar:   socket.user.avatarUrl,
        isBot:    false,
      });

      // Build current participant list
      const participants = [];
      const socketsInRoom = await io.in(roomCode).fetchSockets();
      for (const s of socketsInRoom) {
        if (s.user) {
          participants.push({
            socketId: s.id,
            userId:   s.user.id,
            name:     s.user.name,
            avatar:   s.user.avatarUrl,
            isBot:    false,
          });
        }
      }

      // Include bot if active in this room
      const bot = activeBots.get(roomCode);
      if (bot) {
        participants.push({
          socketId: `bot-${bot.proxySessionId}`,
          userId:   `bot-${bot.userId}`,
          name:     bot.botName,
          avatar:   null,
          isBot:    true,
        });
      }

      socket.emit(EVENTS.ROOM_STATE, { participants, roomCode });

      // Auto-start meeting if SCHEDULED
      const meeting = await prisma.meeting.findUnique({ where: { roomCode } });
      if (meeting) {
        if (meeting.status === "SCHEDULED") {
          await prisma.meeting.update({ where: { id: meeting.id }, data: { status: "LIVE", startedAt: new Date() } });
        }
        await services().transcription.startForRoom(roomCode, meeting.id);
      }

      logger.info(`👤 ${socket.user.name} joined room ${roomCode}`);
    });

    // ── Leave meeting room ─────────────────────────────
    socket.on("meeting:leave", ({ roomCode }) => {
      handleLeave(socket, roomCode);
    });

    // ── Audio chunk (STT) ──────────────────────────────
    socket.on("meeting:audio_chunk", ({ roomCode, chunk }) => {
      services().transcription.sendAudio(roomCode, chunk);
    });

    // ── Chat message ───────────────────────────────────
    socket.on("meeting:send_message", ({ roomCode, text }) => {
      io.to(roomCode).emit(EVENTS.MESSAGE, {
        from:      socket.user.name,
        userId:    socket.user.id,
        text,
        timestamp: new Date().toISOString(),
      });
    });

    // ── WebRTC Signaling ───────────────────────────────
    socket.on("webrtc:offer", ({ to, offer }) => {
      io.to(to).emit(EVENTS.WEBRTC_OFFER, { from: socket.id, offer });
    });

    socket.on("webrtc:answer", ({ to, answer }) => {
      io.to(to).emit(EVENTS.WEBRTC_ANSWER, { from: socket.id, answer });
    });

    socket.on("webrtc:ice-candidate", ({ to, candidate }) => {
      io.to(to).emit(EVENTS.WEBRTC_ICE, { from: socket.id, candidate });
    });

    // ── Disconnect ─────────────────────────────────────
    socket.on("disconnect", () => {
      if (socket.roomCode) handleLeave(socket, socket.roomCode);
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  logger.info("📡 Socket.IO server initialized");
}

function handleLeave(socket, roomCode) {
  socket.leave(roomCode);
  const room = rooms.get(roomCode);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) {
      rooms.delete(roomCode);
      services().transcription.stopForRoom(roomCode);
      // Remove bot when no humans left
      activeBots.delete(roomCode);
      botProcessing.delete(roomCode);
    }
  }
  io.to(roomCode).emit(EVENTS.USER_LEFT, {
    socketId: socket.id,
    userId:   socket.user.id,
    name:     socket.user.name,
  });
}

// ── Bot management ───────────────────────────────────

/**
 * Inject an AI bot into a meeting room.
 * Called when proxy session is activated.
 */
async function injectBot(roomCode, proxySession) {
  const botInfo = {
    proxySessionId: proxySession.id,
    userId:         proxySession.userId,
    botName:        proxySession.botName || "AI Proxy",
    collectionName: proxySession.briefing?.chromaCollectionId,
    meetingId:      proxySession.meetingId,
    whatsappPhone:  proxySession.whatsappPhone || null,
  };
  activeBots.set(roomCode, botInfo);

  logger.info(`🤖 Bot "${botInfo.botName}" injected into room ${roomCode} | collection=${botInfo.collectionName || "NONE"}`);

  // Announce bot joined
  broadcastToRoom(roomCode, EVENTS.USER_JOINED, {
    socketId: `bot-${proxySession.id}`,
    userId:   `bot-${proxySession.userId}`,
    name:     botInfo.botName,
    avatar:   null,
    isBot:    true,
  });

  emitBotStatus(roomCode, "idle");

  // Log bot join event
  await prisma.botEvent.create({
    data: {
      meetingId:      proxySession.meetingId,
      proxySessionId: proxySession.id,
      type:           "JOIN",
      output:         `${botInfo.botName} joined the meeting`,
    },
  });

  logger.info(`🤖 Bot "${botInfo.botName}" injected into room ${roomCode}`);
}

/**
 * Remove bot from meeting room.
 */
async function removeBot(roomCode) {
  const bot = activeBots.get(roomCode);
  if (!bot) return;
  activeBots.delete(roomCode);
  botProcessing.delete(roomCode);

  broadcastToRoom(roomCode, EVENTS.USER_LEFT, {
    socketId: `bot-${bot.proxySessionId}`,
    userId:   `bot-${bot.userId}`,
    name:     bot.botName,
  });

  emitBotStatus(roomCode, "idle");

  await prisma.botEvent.create({
    data: {
      meetingId:      bot.meetingId,
      proxySessionId: bot.proxySessionId,
      type:           "LEAVE",
      output:         `${bot.botName} left the meeting`,
    },
  });

  logger.info(`🤖 Bot removed from room ${roomCode}`);
}

/**
 * Called by transcription service on every final transcript line.
 * Triggers the AI bot pipeline if a bot is active in the room.
 */
async function handleFinalTranscript(roomCode, speaker, text, meetingId) {
  const bot = activeBots.get(roomCode);
  if (!bot) return;
  if (!bot.collectionName) {
    logger.warn(`🤖 Bot in room ${roomCode} has no collectionName — cannot respond`);
    return;
  }

  // Skip if bot is already processing or this is the bot speaking
  if (botProcessing.get(roomCode)) return;
  if (speaker === bot.botName || speaker === "BOT") return;

  botProcessing.set(roomCode, true);
  emitBotStatus(roomCode, "thinking");

  try {
    const result = await services().ai.respondToTranscript({
      proxy_session_id: bot.proxySessionId,
      meeting_id:       meetingId || bot.meetingId,
      collection_name:  bot.collectionName,
      transcript:       text,
      speaker,
      bot_name:         bot.botName || "AI Proxy",
    });

    if (result.should_escalate) {
      // Speak the interim response in the meeting first
      if (result.bot_response) {
        emitBotStatus(roomCode, "speaking");

        let escalateAudio = null;
        try {
          escalateAudio = await services().ai.synthesizeSpeech(result.bot_response);
        } catch { /* TTS optional */ }

        broadcastToRoom(roomCode, EVENTS.BOT_RESPONSE, {
          text:        result.bot_response,
          audioBase64: escalateAudio,
          source:      "escalation",
          confidence:  result.confidence,
          timestamp:   new Date().toISOString(),
        });

        // Save the interim response as a transcript entry
        await prisma.transcriptEntry.create({
          data: { meetingId: bot.meetingId, speaker: bot.botName, text: result.bot_response, isFinal: true },
        });

        broadcastToRoom(roomCode, EVENTS.TRANSCRIPT_UPDATE, {
          speaker: bot.botName, text: result.bot_response, isFinal: true, timestamp: new Date().toISOString(),
        });
      }

      // Now escalate to WhatsApp
      emitBotStatus(roomCode, "escalating");

      // Save query to DB
      const waQuery = await prisma.whatsAppQuery.create({
        data: {
          proxySessionId: bot.proxySessionId,
          questionAsked:  text,
        },
      });

      // Update session status
      await prisma.proxySession.update({
        where: { id: bot.proxySessionId },
        data:  { status: "ESCALATING" },
      });

      // Send WhatsApp if phone available
      if (bot.whatsappPhone) {
        try {
          await services().whatsapp.sendMessage(
            bot.whatsappPhone,
            `🤖 MeetWala Bot\n\nSomeone in your meeting asked:\n"${text}"\n\nI'm not confident enough to answer. Please reply with your response.`
          );

          broadcastToRoom(roomCode, EVENTS.WHATSAPP_SENT, {
            queryId:  waQuery.id,
            question: text,
          });
        } catch (err) {
          logger.error(`WhatsApp send failed: ${err.message}`);
        }
      }

      // Log escalation event
      await prisma.botEvent.create({
        data: {
          meetingId:      bot.meetingId,
          proxySessionId: bot.proxySessionId,
          type:           "WHATSAPP_ESCALATION",
          input:          text,
          output:         "Escalated to WhatsApp",
          latencyMs:      result.latency_ms,
        },
      });

    } else if (result.bot_response) {
      // Bot has a confident answer — speak it
      emitBotStatus(roomCode, "speaking");

      let audioBase64 = null;
      try {
        audioBase64 = await services().ai.synthesizeSpeech(result.bot_response);
      } catch { /* TTS optional */ }

      broadcastToRoom(roomCode, EVENTS.BOT_RESPONSE, {
        text:        result.bot_response,
        audioBase64,
        source:      "rag",
        confidence:  result.confidence,
        timestamp:   new Date().toISOString(),
      });

      // Save transcript entry for bot
      await prisma.transcriptEntry.create({
        data: { meetingId: bot.meetingId, speaker: bot.botName, text: result.bot_response, isFinal: true },
      });

      // Broadcast bot transcript
      broadcastToRoom(roomCode, EVENTS.TRANSCRIPT_UPDATE, {
        speaker: bot.botName, text: result.bot_response, isFinal: true, timestamp: new Date().toISOString(),
      });

      // Log bot event
      await prisma.botEvent.create({
        data: {
          meetingId:      bot.meetingId,
          proxySessionId: bot.proxySessionId,
          type:           "RAG_RESPONSE",
          input:          text,
          output:         result.bot_response,
          latencyMs:      result.latency_ms,
        },
      });
    }
    // If not directed at bot, result.bot_response is null — do nothing

  } catch (err) {
    logger.error(`Bot pipeline error for room ${roomCode}: ${err.message}`);
    emitBotStatus(roomCode, "error");
  } finally {
    botProcessing.set(roomCode, false);
    emitBotStatus(roomCode, "idle");
  }
}

function broadcastToRoom(roomCode, event, data) {
  if (io) io.to(roomCode).emit(event, data);
}

function emitBotStatus(roomCode, status) {
  broadcastToRoom(roomCode, EVENTS.BOT_STATUS, { status });
}

module.exports = {
  initSocketServer,
  broadcastToRoom,
  emitBotStatus,
  injectBot,
  removeBot,
  handleFinalTranscript,
  EVENTS,
};
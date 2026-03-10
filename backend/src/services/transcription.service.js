const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const { prisma }  = require("./db.service");
const logger      = require("../utils/logger");

// Lazy-load socket to avoid circular dependency
let _socket;
function getSocket() {
  if (!_socket) _socket = require("../socket/socket.server");
  return _socket;
}

let deepgram = null;
function getDeepgram() {
  if (!deepgram && process.env.DEEPGRAM_API_KEY) {
    deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  }
  return deepgram;
}

// Active connections per room
const activeConnections = new Map();

const transcriptionService = {
  async startForRoom(roomCode, meetingId) {
    if (activeConnections.has(roomCode)) return;

    const client = getDeepgram();
    if (!client) {
      logger.warn("Deepgram API key not set — transcription disabled");
      return;
    }

    const live = client.listen.live({
      model:           "nova-2",
      language:        "en-US",
      smart_format:    true,
      diarize:         true,
      punctuate:       true,
      interim_results: true,
    });

    live.on(LiveTranscriptionEvents.Open, () => {
      logger.info(`🎙️  Deepgram started for room: ${roomCode}`);
    });

    live.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const alt = data.channel?.alternatives?.[0];
      if (!alt?.transcript) return;

      const isFinal = data.is_final;
      const speaker = `Speaker ${data.channel_index?.[0] ?? 0}`;
      const text    = alt.transcript;

      getSocket().broadcastToRoom(roomCode, getSocket().EVENTS.TRANSCRIPT_UPDATE, {
        speaker, text, isFinal, timestamp: new Date().toISOString(),
      });

      if (isFinal && text.trim()) {
        await prisma.transcriptEntry.create({
          data: { meetingId, speaker, text, isFinal: true },
        }).catch(() => {});

        // Trigger AI bot pipeline for final transcripts
        getSocket().handleFinalTranscript(roomCode, speaker, text, meetingId);
      }
    });

    live.on(LiveTranscriptionEvents.Error, (err) => {
      logger.error(`Deepgram error (${roomCode}): ${err.message || err}`);
    });

    live.on(LiveTranscriptionEvents.Close, () => {
      activeConnections.delete(roomCode);
      logger.info(`🎙️  Deepgram closed for room: ${roomCode}`);
    });

    activeConnections.set(roomCode, live);
  },

  sendAudio(roomCode, chunk) {
    const conn = activeConnections.get(roomCode);
    if (conn) conn.send(chunk);
  },

  stopForRoom(roomCode) {
    const conn = activeConnections.get(roomCode);
    if (conn) { conn.finish(); activeConnections.delete(roomCode); }
  },
};

module.exports = { transcriptionService };
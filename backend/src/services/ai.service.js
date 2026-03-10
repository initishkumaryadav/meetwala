const axios  = require("axios");
const FormData = require("form-data");
const logger = require("../utils/logger");

const client = axios.create({
  baseURL: process.env.AI_SERVICE_URL || "http://ai-service:8000",
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

const aiService = {
  async ingestBriefing({ proxy_session_id, briefing_text, metadata = {} }) {
    const { data } = await client.post("/briefing/ingest", {
      proxy_session_id,
      briefing_text,
      metadata,
    });
    return data;
  },

  async uploadFiles({ proxySessionId, files, metadata = {} }) {
    const form = new FormData();
    form.append("proxy_session_id", proxySessionId);
    for (const file of files) {
      form.append("files", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    }
    const { data } = await client.post("/briefing/upload", form, {
      headers: form.getHeaders(),
      timeout: 120000, // 2 min for large files
    });
    return data;
  },

  async chatBriefing({ proxySessionId, userMessage, chatHistory = [], metadata = {} }) {
    const { data } = await client.post("/briefing/chat", {
      proxy_session_id: proxySessionId,
      user_message:     userMessage,
      chat_history:     chatHistory,
      metadata,
    });
    return data;
  },

  async respondToTranscript({ proxy_session_id, meeting_id, collection_name, transcript, speaker, bot_name }) {
    const { data } = await client.post("/respond/meeting", {
      proxy_session_id,
      meeting_id,
      collection_name,
      transcript,
      speaker,
      bot_name,
    });
    return data;
  },

  async formulateWhatsAppReply({ proxySessionId, originalQuestion, userReply }) {
    const { data } = await client.post("/respond/whatsapp-reply", {
      proxy_session_id:  proxySessionId,
      original_question: originalQuestion,
      user_reply:        userReply,
    });
    return data;
  },

  async healthCheck() {
    const { data } = await client.get("/health");
    return data;
  },

  async synthesizeSpeech(text, voice = "en-US-AriaNeural") {
    const { data } = await client.post("/respond/tts", { text, voice }, { timeout: 30000 });
    return data?.audioBase64 || null;
  },
};

module.exports = { aiService };
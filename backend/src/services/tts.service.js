const axios  = require("axios");
const logger = require("../utils/logger");

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

const ttsService = {
  async synthesizeBase64(text) {
    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        {
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          responseType: "arraybuffer",
        }
      );
      logger.debug(`🔊 TTS synthesized: "${text.substring(0, 50)}..."`);
      return Buffer.from(response.data).toString("base64");
    } catch (err) {
      logger.error("TTS error:", err.message);
      return null;
    }
  },
};

module.exports = { ttsService };
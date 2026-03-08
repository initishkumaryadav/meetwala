const twilio = require("twilio");
const logger = require("../utils/logger");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const whatsappService = {
  async sendMessage(to, body) {
    try {
      const msg = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to:   `whatsapp:${to}`,
        body,
      });
      logger.info(`📱 WhatsApp sent to ${to}: SID=${msg.sid}`);
      return msg;
    } catch (err) {
      logger.error(`WhatsApp send error: ${err.message}`);
      throw err;
    }
  },
};

module.exports = { whatsappService };

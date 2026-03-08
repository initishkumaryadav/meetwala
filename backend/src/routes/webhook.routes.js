const router                         = require("express").Router();
const { prisma }                     = require("../services/db.service");
const { redis }                      = require("../services/redis.service");
const { broadcastToRoom, emitBotStatus, EVENTS } = require("../socket/socket.server");
const { aiService }                  = require("../services/ai.service");
const { ttsService }                 = require("../services/tts.service");
const logger                         = require("../utils/logger");

/**
 * POST /api/webhook/whatsapp
 * Twilio sends replies here when user responds on WhatsApp.
 */
router.post("/whatsapp", async (req, res) => {
  // Respond immediately so Twilio doesn't retry
  res.status(200).send("<Response></Response>");

  const { From, Body } = req.body;
  if (!From || !Body) return;

  const phoneNumber = From.replace("whatsapp:", "");
  const replyText   = Body.trim();

  logger.info(`📱 WhatsApp reply from ${phoneNumber}: "${replyText}"`);

  try {
    // Find user by phone
    const user = await prisma.user.findFirst({ where: { whatsappPhone: phoneNumber } });
    if (!user) return logger.warn(`No user found for phone ${phoneNumber}`);

    // Find most recent PENDING query for this user
    const pendingQuery = await prisma.whatsAppQuery.findFirst({
      where: {
        status:      "PENDING",
        proxySession: {
          userId: user.id,
          status: "ESCALATING",
        },
      },
      include: { proxySession: { include: { meeting: true } } },
      orderBy: { sentAt: "desc" },
    });

    if (!pendingQuery) return logger.warn(`No pending WA query for user ${user.id}`);

    // Mark replied
    await prisma.whatsAppQuery.update({
      where: { id: pendingQuery.id },
      data:  { replyText, repliedAt: new Date(), status: "REPLIED" },
    });

    await prisma.proxySession.update({
      where: { id: pendingQuery.proxySessionId },
      data:  { status: "ACTIVE" },
    });

    const { meeting } = pendingQuery.proxySession;

    // Notify frontend
    broadcastToRoom(meeting.roomCode, EVENTS.WHATSAPP_REPLIED, {
      queryId: pendingQuery.id, replyText, userName: user.name,
    });

    emitBotStatus(meeting.roomCode, "thinking");

    // Ask AI to formulate response
    const botResponse = await aiService.formulateWhatsAppReply({
      proxySessionId:   pendingQuery.proxySessionId,
      originalQuestion: pendingQuery.questionAsked,
      userReply:        replyText,
    });

    // Synthesize voice
    const audioBase64 = botResponse.text ? await ttsService.synthesizeBase64(botResponse.text) : null;

    broadcastToRoom(meeting.roomCode, EVENTS.BOT_RESPONSE, {
      text:        botResponse.text,
      audioBase64,
      source:      "whatsapp_reply",
      timestamp:   new Date().toISOString(),
    });

    emitBotStatus(meeting.roomCode, "idle");

    // Log bot event
    await prisma.botEvent.create({
      data: {
        meetingId:      meeting.id,
        proxySessionId: pendingQuery.proxySessionId,
        type:           "WHATSAPP_REPLY",
        input:          pendingQuery.questionAsked,
        output:         botResponse.text,
      },
    });

    await redis.del(`escalation:${pendingQuery.proxySessionId}`);
    logger.info(`✅ WhatsApp reply handled for room ${meeting.roomCode}`);

  } catch (err) {
    logger.error("WhatsApp webhook error:", err);
  }
});

module.exports = router;
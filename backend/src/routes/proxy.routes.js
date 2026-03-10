const router          = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { prisma }      = require("../services/db.service");
const { injectBot, removeBot } = require("../socket/socket.server");

// Create a proxy session for a meeting
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { meetingId, botName, whatsappPhone } = req.body;
    const session = await prisma.proxySession.create({
      data: {
        meetingId,
        userId:  req.user.id,
        botName: botName || `${req.user.name}'s Bot`,
        whatsappPhone: whatsappPhone || null,
      },
    });
    res.status(201).json({ session });
  } catch (err) { next(err); }
});

// Get all proxy sessions for logged-in user
router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const sessions = await prisma.proxySession.findMany({
      where:   { userId: req.user.id },
      include: { meeting: true, briefing: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ sessions });
  } catch (err) { next(err); }
});

// Get single proxy session with full log
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.proxySession.findUnique({
      where:   { id: req.params.id },
      include: {
        meeting:   true,
        briefing:  true,
        botEvents: { orderBy: { timestamp: "asc" } },
        waQueries: { orderBy: { sentAt: "asc" } },
      },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ session });
  } catch (err) { next(err); }
});

// Activate bot — send it into the meeting
router.post("/:id/activate", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.proxySession.findUnique({
      where:   { id: req.params.id },
      include: { meeting: true, briefing: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== req.user.id) return res.status(403).json({ error: "Not your session" });
    if (!session.briefing) return res.status(400).json({ error: "Complete briefing first" });

    await prisma.proxySession.update({
      where: { id: session.id },
      data:  { status: "ACTIVE" },
    });

    await injectBot(session.meeting.roomCode, session);

    res.json({ success: true, message: `Bot "${session.botName}" sent to meeting` });
  } catch (err) { next(err); }
});

// Deactivate bot — remove from meeting
router.post("/:id/deactivate", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.proxySession.findUnique({
      where:   { id: req.params.id },
      include: { meeting: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== req.user.id) return res.status(403).json({ error: "Not your session" });

    await prisma.proxySession.update({
      where: { id: session.id },
      data:  { status: "COMPLETED" },
    });

    await removeBot(session.meeting.roomCode);

    res.json({ success: true, message: "Bot removed from meeting" });
  } catch (err) { next(err); }
});

// Update proxy session status
router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const session = await prisma.proxySession.update({
      where: { id: req.params.id },
      data:  { status },
    });
    res.json({ session });
  } catch (err) { next(err); }
});

module.exports = router;
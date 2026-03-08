const router            = require("express").Router();
const { requireAuth }   = require("../middleware/auth.middleware");
const { prisma }        = require("../services/db.service");
const { nanoid }        = require("../utils/nanoid");
const { removeBot }     = require("../socket/socket.server");
const PDFDocument       = require("pdfkit");

// Create a new meeting
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, scheduledAt } = req.body;
    const roomCode = `mw-${nanoid(8)}`;
    const meeting  = await prisma.meeting.create({
      data: {
        title,
        roomCode,
        hostId:      req.user.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      },
    });
    res.status(201).json({ meeting });
  } catch (err) { next(err); }
});

// List all meetings for logged-in user (host or participant)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const meetings = await prisma.meeting.findMany({
      where:   { hostId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { proxySessions: { include: { user: true } } },
    });
    res.json({ meetings });
  } catch (err) { next(err); }
});

// Join meeting by room code — validates access
router.get("/join/:roomCode", requireAuth, async (req, res, next) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where:   { roomCode: req.params.roomCode },
      include: { host: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (meeting.status === "ENDED") return res.status(410).json({ error: "Meeting has ended" });
    res.json({ meeting });
  } catch (err) { next(err); }
});

// Get single meeting by room code
router.get("/:roomCode", requireAuth, async (req, res, next) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where:   { roomCode: req.params.roomCode },
      include: {
        host: true,
        proxySessions: { include: { user: true, briefing: true } },
        transcript:    { orderBy: { timestamp: "asc" } },
        botEvents:     { orderBy: { timestamp: "asc" } },
      },
    });
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json({ meeting });
  } catch (err) { next(err); }
});

// Start meeting
router.patch("/:id/start", requireAuth, async (req, res, next) => {
  try {
    const meeting = await prisma.meeting.update({
      where: { id: req.params.id },
      data:  { status: "LIVE", startedAt: new Date() },
    });
    res.json({ meeting });
  } catch (err) { next(err); }
});

// End meeting — removes bots, saves summary
router.patch("/:id/end", requireAuth, async (req, res, next) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where:   { id: req.params.id },
      include: { proxySessions: true },
    });
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    // Remove all active bots
    for (const ps of meeting.proxySessions) {
      if (ps.status === "ACTIVE" || ps.status === "ESCALATING") {
        await removeBot(meeting.roomCode);
        await prisma.proxySession.update({
          where: { id: ps.id },
          data:  { status: "COMPLETED" },
        });
      }
    }

    const updated = await prisma.meeting.update({
      where: { id: req.params.id },
      data:  { status: "ENDED", endedAt: new Date() },
    });
    res.json({ meeting: updated });
  } catch (err) { next(err); }
});

// Download meeting summary as PDF
router.get("/:roomCode/summary-pdf", requireAuth, async (req, res, next) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where:   { roomCode: req.params.roomCode },
      include: {
        host:          { select: { name: true, email: true } },
        transcript:    { where: { isFinal: true }, orderBy: { timestamp: "asc" } },
        botEvents:     { orderBy: { timestamp: "asc" } },
        proxySessions: { include: { user: { select: { name: true } } } },
      },
    });
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="MeetWala-${meeting.roomCode}-Summary.pdf"`
    );
    doc.pipe(res);

    // ── Header ──
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("MeetWala - Meeting Summary", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text("━".repeat(80), { align: "center" });
    doc.moveDown(0.75);

    // ── Meeting Details ──
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("Meeting Details");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(`Title:      ${meeting.title}`);
    doc.text(`Room Code:  ${meeting.roomCode}`);
    doc.text(`Host:       ${meeting.host?.name || "Unknown"} (${meeting.host?.email || ""})`);
    doc.text(`Status:     ${meeting.status}`);
    if (meeting.startedAt)
      doc.text(`Started:    ${new Date(meeting.startedAt).toLocaleString()}`);
    if (meeting.endedAt)
      doc.text(`Ended:      ${new Date(meeting.endedAt).toLocaleString()}`);
    if (meeting.startedAt && meeting.endedAt) {
      const durationMs = new Date(meeting.endedAt) - new Date(meeting.startedAt);
      const mins = Math.floor(durationMs / 60000);
      const secs = Math.floor((durationMs % 60000) / 1000);
      doc.text(`Duration:   ${mins}m ${secs}s`);
    }

    // Participants
    const participantNames = [
      meeting.host?.name,
      ...meeting.proxySessions.map((ps) => `${ps.user?.name || "Unknown"} (Bot: ${ps.botName || "AI Proxy"})`),
    ].filter(Boolean);
    doc.text(`Participants: ${participantNames.join(", ")}`);
    doc.moveDown(1);

    // ── Conversation Log ──
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text("━".repeat(80), { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("Conversation Log");
    doc.moveDown(0.5);

    if (meeting.transcript.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#999999").text("No transcript entries recorded for this meeting.");
      doc.moveDown(0.5);
    } else {
      for (const entry of meeting.transcript) {
        const time = new Date(entry.timestamp).toLocaleTimeString();

        // Check page space and add new page if needed
        if (doc.y > doc.page.height - 80) doc.addPage();

        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a").text(`[${time}] ${entry.speaker}:`, { continued: false });
        doc.fontSize(9).font("Helvetica").fillColor("#333333").text(entry.text);
        doc.moveDown(0.3);
      }
    }
    doc.moveDown(0.5);

    // ── Bot Activity Log ──
    if (meeting.botEvents.length > 0) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666666")
        .text("━".repeat(80), { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("AI Bot Activity");
      doc.moveDown(0.5);

      for (const event of meeting.botEvents) {
        if (doc.y > doc.page.height - 80) doc.addPage();

        const time = new Date(event.timestamp).toLocaleTimeString();
        const typeLabel = event.type.replace(/_/g, " ");

        doc.fontSize(9).font("Helvetica-Bold").fillColor("#4a4a4a").text(`[${time}] ${typeLabel}`);
        if (event.input)
          doc.fontSize(8).font("Helvetica").fillColor("#666666").text(`  Question: ${event.input}`);
        if (event.output)
          doc.fontSize(8).font("Helvetica").fillColor("#333333").text(`  Response: ${event.output}`);
        if (event.latencyMs)
          doc.fontSize(7).font("Helvetica").fillColor("#999999").text(`  (${event.latencyMs}ms)`);
        doc.moveDown(0.3);
      }
      doc.moveDown(0.5);
    }

    // ── Summary Section ──
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text("━".repeat(80), { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("Meeting Summary");
    doc.moveDown(0.5);

    // Build a quick summary from the transcript
    const speakerMap = {};
    for (const entry of meeting.transcript) {
      if (!speakerMap[entry.speaker]) speakerMap[entry.speaker] = 0;
      speakerMap[entry.speaker]++;
    }

    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(`Total transcript entries: ${meeting.transcript.length}`);
    doc.text(`Total bot events: ${meeting.botEvents.length}`);
    doc.moveDown(0.3);

    if (Object.keys(speakerMap).length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").text("Speaker Breakdown:");
      doc.font("Helvetica");
      for (const [speaker, count] of Object.entries(speakerMap)) {
        doc.text(`  • ${speaker}: ${count} message${count !== 1 ? "s" : ""}`);
      }
      doc.moveDown(0.3);
    }

    // Key topics from bot events
    const botResponses = meeting.botEvents.filter((e) => e.type === "RAG_RESPONSE" || e.type === "LLM_RESPONSE");
    if (botResponses.length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").text("AI Bot Responses:");
      doc.font("Helvetica");
      doc.text(`  The AI bot provided ${botResponses.length} response${botResponses.length !== 1 ? "s" : ""} during the meeting.`);
    }

    const escalations = meeting.botEvents.filter((e) => e.type === "WHATSAPP_ESCALATION");
    if (escalations.length > 0) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").text("WhatsApp Escalations:");
      doc.font("Helvetica");
      doc.text(`  ${escalations.length} question${escalations.length !== 1 ? "s were" : " was"} escalated to the host via WhatsApp.`);
    }

    doc.moveDown(1);

    // ── Footer ──
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#999999")
      .text(`Generated by MeetWala on ${new Date().toLocaleString()}`, { align: "center" });

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
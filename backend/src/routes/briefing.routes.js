const router          = require("express").Router();
const multer          = require("multer");
const { requireAuth } = require("../middleware/auth.middleware");
const { prisma }      = require("../services/db.service");
const { aiService }   = require("../services/ai.service");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf", "text/plain", "text/markdown", "text/csv",
      "application/json", "image/png", "image/jpeg", "image/webp", "image/gif",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Save / update briefing (ingest into ChromaDB)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { proxySessionId, briefingText } = req.body;

    if (!briefingText || briefingText.trim().length < 10)
      return res.status(400).json({ error: "Briefing text too short" });

    // Ingest into ChromaDB via AI service
    const result = await aiService.ingestBriefing({
      proxy_session_id: proxySessionId,
      briefing_text:    briefingText,
      metadata:         { userId: req.user.id },
    });

    // Save to DB
    const briefing = await prisma.briefing.upsert({
      where:  { proxySessionId },
      create: {
        proxySessionId,
        userId:             req.user.id,
        rawText:            briefingText,
        chromaCollectionId: result.collection_name,
        chunkCount:         result.chunk_count,
      },
      update: {
        rawText:            briefingText,
        chromaCollectionId: result.collection_name,
        chunkCount:         result.chunk_count,
      },
    });

    // Mark proxy session as BRIEFED
    await prisma.proxySession.update({
      where: { id: proxySessionId },
      data:  { status: "BRIEFED" },
    });

    res.json({ briefing, chunkCount: result.chunk_count });
  } catch (err) { next(err); }
});

// Upload documents/images → extract text → store in RAG
router.post("/upload", requireAuth, upload.array("files", 10), async (req, res, next) => {
  try {
    const { proxySessionId } = req.body;
    if (!proxySessionId) return res.status(400).json({ error: "proxySessionId required" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const result = await aiService.uploadFiles({
      proxySessionId,
      files: req.files,
      metadata: { userId: req.user.id },
    });

    // Update briefing DB record chunk count
    const existing = await prisma.briefing.findUnique({ where: { proxySessionId } });
    if (existing) {
      await prisma.briefing.update({
        where: { proxySessionId },
        data: {
          chunkCount:         { increment: result.total_new_chunks },
          chromaCollectionId: result.collection_name,
        },
      });
    } else {
      await prisma.briefing.create({
        data: {
          proxySessionId,
          userId:             req.user.id,
          rawText:            `[${result.files.map(f => f.filename).join(", ")}]`,
          chromaCollectionId: result.collection_name,
          chunkCount:         result.total_new_chunks,
        },
      });
    }

    res.json(result);
  } catch (err) { next(err); }
});

// Conversational briefing chat
router.post("/chat", requireAuth, async (req, res, next) => {
  try {
    const { proxySessionId, userMessage, chatHistory } = req.body;
    if (!proxySessionId || !userMessage) return res.status(400).json({ error: "proxySessionId and userMessage required" });

    const result = await aiService.chatBriefing({
      proxySessionId,
      userMessage,
      chatHistory: chatHistory || [],
      metadata: { userId: req.user.id },
    });

    // Update briefing DB if chunks were added
    if (result.chunks_added > 0) {
      const existing = await prisma.briefing.findUnique({ where: { proxySessionId } });
      if (existing) {
        await prisma.briefing.update({
          where: { proxySessionId },
          data: {
            chunkCount:         { increment: result.chunks_added },
            chromaCollectionId: result.collection_name,
          },
        });
      } else {
        await prisma.briefing.create({
          data: {
            proxySessionId,
            userId:             req.user.id,
            rawText:            "[conversational briefing]",
            chromaCollectionId: result.collection_name,
            chunkCount:         result.chunks_added,
          },
        });
      }
    }

    res.json(result);
  } catch (err) { next(err); }
});

// Finalize briefing — mark as BRIEFED
router.post("/finalize", requireAuth, async (req, res, next) => {
  try {
    const { proxySessionId } = req.body;
    if (!proxySessionId) return res.status(400).json({ error: "proxySessionId required" });

    const briefing = await prisma.briefing.findUnique({ where: { proxySessionId } });
    if (!briefing || briefing.chunkCount === 0) {
      return res.status(400).json({ error: "No briefing data found. Please add some information first." });
    }

    await prisma.proxySession.update({
      where: { id: proxySessionId },
      data:  { status: "BRIEFED" },
    });

    res.json({ success: true, chunkCount: briefing.chunkCount });
  } catch (err) { next(err); }
});

// Get briefing for a proxy session
router.get("/:proxySessionId", requireAuth, async (req, res, next) => {
  try {
    const briefing = await prisma.briefing.findUnique({
      where: { proxySessionId: req.params.proxySessionId },
    });
    if (!briefing) return res.status(404).json({ error: "No briefing found" });
    res.json({ briefing });
  } catch (err) { next(err); }
});

module.exports = router;
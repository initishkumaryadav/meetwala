const router        = require("express").Router();
const { prisma }    = require("../services/db.service");
const { redis }     = require("../services/redis.service");
const { aiService } = require("../services/ai.service");

router.get("/", async (_req, res) => {
  const checks = {};
  try { await prisma.$queryRaw`SELECT 1`; checks.postgres = "ok"; }
  catch { checks.postgres = "error"; }
  try { await redis.ping(); checks.redis = "ok"; }
  catch { checks.redis = "error"; }
  try { await aiService.healthCheck(); checks.aiService = "ok"; }
  catch { checks.aiService = "error"; }

  const allOk = Object.values(checks).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "healthy" : "degraded",
    checks,
    timestamp: new Date(),
  });
});

module.exports = router;
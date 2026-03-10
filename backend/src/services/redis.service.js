const Redis  = require("ioredis");
const logger = require("../utils/logger");

let redis;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 3) { logger.warn("Redis unreachable — stopping retries"); return null; }
        return Math.min(times * 500, 3000);
      },
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
    });
  } else {
    redis = new Redis({
      host: "localhost",
      port: 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 500, 3000);
      },
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  redis.on("connect", () => logger.info("⚡ Redis connected"));
  redis.on("error",   (err) => {
    if (!redis._errorLogged) {
      logger.warn(`Redis unavailable: ${err.message} — features needing Redis will be degraded`);
      redis._errorLogged = true;
    }
  });

  // Attempt connection but don't block startup
  redis.connect().catch(() => {});
} catch (err) {
  logger.warn(`Redis init failed: ${err.message}`);
}

module.exports = { redis };
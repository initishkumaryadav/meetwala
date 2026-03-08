const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

prisma.$connect()
  .then(() => logger.info("🗄️  PostgreSQL connected via Prisma"))
  .catch((err) => logger.error("Prisma connect error:", err));

module.exports = { prisma };
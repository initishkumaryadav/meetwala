const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$connect()
  .then(() => { console.log("DB OK"); return p.$disconnect(); })
  .catch((e) => { console.error("DB FAIL:", e.message); process.exit(1); });

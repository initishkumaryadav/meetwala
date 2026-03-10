const path = require("path");
// Load .env from project root in dev, Railway injects env vars in production
const envPath = path.resolve(__dirname, "../../.env");
if (require("fs").existsSync(envPath)) require("dotenv").config({ path: envPath });
const express    = require("express");
const http       = require("http");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const compression = require("compression");
const rateLimit  = require("express-rate-limit");

const { initSocketServer } = require("./socket/socket.server");
const { initPassport }     = require("./middleware/passport");
const { errorHandler }     = require("./middleware/error.handler");
const { requestLogger }    = require("./middleware/request.logger");
const logger               = require("./utils/logger");

// Routes
const authRoutes     = require("./routes/auth.routes");
const meetingRoutes  = require("./routes/meeting.routes");
const briefingRoutes = require("./routes/briefing.routes");
const proxyRoutes    = require("./routes/proxy.routes");
const webhookRoutes  = require("./routes/webhook.routes");
const healthRoutes   = require("./routes/health.routes");

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;

// ── Middleware ─────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(requestLogger);

// Webhook routes need urlencoded body parsing (Twilio sends form-encoded)
app.use("/api/webhook", express.urlencoded({ extended: true }), webhookRoutes);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api", limiter);

// Passport (Auth)
initPassport(app);

// ── Routes ─────────────────────────────────────────────
app.use("/api/health",    healthRoutes);
app.use("/api/auth",      authRoutes);
app.use("/api/meetings",  meetingRoutes);
app.use("/api/briefings", briefingRoutes);
app.use("/api/proxy",     proxyRoutes);

// ── Socket.IO ──────────────────────────────────────────
initSocketServer(server);

// ── Error handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`🚀 MeetWala backend running on port ${PORT}`);
  logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
});

module.exports = server;

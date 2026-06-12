require("dotenv").config();
const express    = require("express");
const http       = require("http");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const { Server } = require("socket.io");
const rateLimit  = require("express-rate-limit");

const db            = require("./db/connection");
const authRouter    = require("./routes/auth");
const trafficRouter = require("./routes/traffic");
const detectRouter  = require("./routes/detection");
const analyticsRouter = require("./routes/analytics");
const mitigationRouter= require("./routes/mitigation");
const alertsRouter  = require("./routes/alerts");
const { initWebSocket } = require("./websocket/manager");

const app    = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173", methods: ["GET","POST"] },
});
initWebSocket(io);
app.set("io", io);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.use("/api", rateLimit({ windowMs: 60_000, max: 300, message: "Rate limit exceeded" }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",       authRouter);
app.use("/api/traffic",    trafficRouter);
app.use("/api/detection",  detectRouter);
app.use("/api/analytics",  analyticsRouter);
app.use("/api/mitigation", mitigationRouter);
app.use("/api/alerts",     alertsRouter);

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", db: "connected", timestamp: new Date() });
  } catch {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🛡️  ShieldNet backend running on port ${PORT}`);
  console.log(`🔌 WebSocket ready`);
});

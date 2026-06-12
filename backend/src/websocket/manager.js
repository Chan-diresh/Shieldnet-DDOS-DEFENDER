const db = require("../db/connection");

let _io = null;

function initWebSocket(io) {
  _io = io;

  io.on("connection", (socket) => {
    console.log(`⚡ Client connected: ${socket.id}`);

    socket.on("subscribe", (room) => socket.join(room));

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Broadcast live traffic snapshot every second
  setInterval(broadcastTrafficSnapshot, 1000);

  // Broadcast dashboard summary every 5 seconds
  setInterval(broadcastDashboardSummary, 5000);
}

async function broadcastTrafficSnapshot() {
  if (!_io) return;
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '1 second') AS total_rps,
        COALESCE(SUM(packets_per_sec) FILTER (WHERE recorded_at > NOW() - INTERVAL '1 second'), 0) AS packets_per_sec,
        COALESCE(SUM(bytes_per_sec)   FILTER (WHERE recorded_at > NOW() - INTERVAL '1 second'), 0) AS bytes_per_sec
      FROM traffic_logs
    `);

    const attacks = await db.query(`
      SELECT COUNT(*) as attack_rps
      FROM attack_events
      WHERE detected_at > NOW() - INTERVAL '1 second'
    `);

    _io.emit("traffic:snapshot", {
      timestamp:     new Date().toISOString(),
      total_rps:     parseInt(rows[0].total_rps || 0),
      attack_rps:    parseInt(attacks.rows[0].attack_rps || 0),
      packets_per_sec: parseFloat(rows[0].packets_per_sec || 0),
      bytes_per_sec:   parseFloat(rows[0].bytes_per_sec || 0),
    });
  } catch (_) {
    // Emit simulated data if DB not ready
    _io.emit("traffic:snapshot", simulateTrafficSnapshot());
  }
}

async function broadcastDashboardSummary() {
  if (!_io) return;
  try {
    const [blocked, attacks, alerts] = await Promise.all([
      db.query("SELECT COUNT(*) FROM blocked_ips WHERE is_active = TRUE"),
      db.query("SELECT COUNT(*) FROM attack_events WHERE detected_at > NOW() - INTERVAL '1 hour'"),
      db.query("SELECT COUNT(*) FROM alerts WHERE is_read = FALSE"),
    ]);

    _io.emit("dashboard:summary", {
      blocked_ips:   parseInt(blocked.rows[0].count),
      attacks_1h:    parseInt(attacks.rows[0].count),
      unread_alerts: parseInt(alerts.rows[0].count),
    });
  } catch (_) {}
}

function simulateTrafficSnapshot() {
  const total = 800 + Math.floor(Math.random() * 600);
  const attack = Math.random() > 0.6 ? Math.floor(Math.random() * 400) : Math.floor(Math.random() * 50);
  return {
    timestamp:      new Date().toISOString(),
    total_rps:      total,
    attack_rps:     attack,
    packets_per_sec: total * 1.4,
    bytes_per_sec:  total * 512,
  };
}

function emitNewAttack(attack) {
  if (_io) _io.emit("attack:new", attack);
}

function emitNewAlert(alert) {
  if (_io) _io.emit("alert:new", alert);
}

module.exports = { initWebSocket, emitNewAttack, emitNewAlert };

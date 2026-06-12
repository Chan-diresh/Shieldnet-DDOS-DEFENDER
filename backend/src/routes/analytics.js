const router = require("express").Router();
const db     = require("../db/connection");
const { authMiddleware } = require("../middleware/auth");

// GET /api/analytics/overview — dashboard KPI summary
router.get("/overview", authMiddleware, async (req, res) => {
  try {
    const [traffic, attacks, blocked, mlStats] = await Promise.all([
      db.query(`
        SELECT COUNT(*) as total_requests,
               COALESCE(SUM(packets_per_sec),0) as total_packets,
               COALESCE(SUM(bytes_per_sec),0) as total_bytes
        FROM traffic_logs WHERE recorded_at > NOW() - INTERVAL '24 hours'`),
      db.query(`
        SELECT COUNT(*) as total_attacks,
               COUNT(*) FILTER (WHERE severity='CRITICAL') as critical,
               COUNT(*) FILTER (WHERE severity='HIGH') as high,
               COUNT(*) FILTER (WHERE status='ACTIVE') as active
        FROM attack_events WHERE detected_at > NOW() - INTERVAL '24 hours'`),
      db.query("SELECT COUNT(*) as blocked_ips FROM blocked_ips WHERE is_active=TRUE"),
      db.query("SELECT AVG(confidence) as avg_conf, COUNT(*) as total_predictions FROM ml_predictions WHERE predicted_at > NOW() - INTERVAL '24 hours'"),
    ]);
    res.json({
      traffic:  traffic.rows[0],
      attacks:  attacks.rows[0],
      blocked:  blocked.rows[0],
      ml_stats: mlStats.rows[0],
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// GET /api/analytics/traffic-series?interval=hour&range=24h
router.get("/traffic-series", authMiddleware, async (req, res) => {
  const { interval = "hour", range = "24h" } = req.query;
  const trunc  = interval === "minute" ? "minute" : "hour";
  const period = range === "7d" ? "7 days" : range === "30d" ? "30 days" : "24 hours";
  try {
    const { rows } = await db.query(`
      SELECT
        date_trunc($1, tl.recorded_at) AS bucket,
        COUNT(tl.id) AS total,
        COUNT(mp.id) FILTER (WHERE mp.is_attack IS TRUE)  AS attacks,
        COUNT(mp.id) FILTER (WHERE mp.is_attack IS FALSE) AS legitimate
      FROM traffic_logs tl
      LEFT JOIN ml_predictions mp ON mp.traffic_log_id = tl.id
      WHERE tl.recorded_at > NOW() - INTERVAL '${period}'
      GROUP BY 1 ORDER BY 1
    `, [trunc]);
    res.json(rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// GET /api/analytics/attack-types
router.get("/attack-types", authMiddleware, async (req, res) => {
  const { range = "24h" } = req.query;
  const period = range === "7d" ? "7 days" : "24 hours";
  try {
    const { rows } = await db.query(`
      SELECT attack_type, COUNT(*) as count,
             AVG(confidence) as avg_confidence,
             COUNT(*) FILTER (WHERE severity='CRITICAL') as critical_count
      FROM attack_events
      WHERE detected_at > NOW() - INTERVAL '${period}'
      GROUP BY attack_type ORDER BY count DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// GET /api/analytics/top-attackers
router.get("/top-attackers", authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT src_ip::text, COUNT(*) as attack_count,
             MAX(detected_at) as last_seen,
             array_agg(DISTINCT attack_type) as attack_types,
             MAX(severity) as max_severity
      FROM attack_events
      WHERE detected_at > NOW() - INTERVAL '24 hours'
      GROUP BY src_ip ORDER BY attack_count DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// GET /api/analytics/hourly-summary
router.get("/hourly-summary", authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT snapshot_hour, total_requests, legitimate_requests,
             attack_requests, blocked_requests, unique_attackers,
             top_attack_type, avg_confidence, bandwidth_in_gbps
      FROM analytics_snapshots
      ORDER BY snapshot_hour DESC LIMIT 48
    `);
    res.json(rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

module.exports = router;

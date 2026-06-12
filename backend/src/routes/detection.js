const router = require("express").Router();
const db     = require("../db/connection");
const ml     = require("../services/mlService");
const { authMiddleware } = require("../middleware/auth");

// GET /api/detection/attacks — list attack events
router.get("/attacks", authMiddleware, async (req, res) => {
  const { page = 1, limit = 50, severity, status, since } = req.query;
  const offset = (page - 1) * limit;
  const filters = []; const params = [];
  if (severity) { params.push(severity); filters.push(`severity = $${params.length}`); }
  if (status)   { params.push(status);   filters.push(`status   = $${params.length}`); }
  if (since)    { params.push(since);    filters.push(`detected_at > $${params.length}`); }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  try {
    const { rows } = await db.query(`
      SELECT id, detected_at, src_ip, dst_ip, attack_type, severity,
             confidence, status, country, packets_rate, bytes_rate
      FROM attack_events ${where}
      ORDER BY detected_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, limit, offset]);
    const total = await db.query(`SELECT COUNT(*) FROM attack_events ${where}`, params);
    res.json({ data: rows, total: parseInt(total.rows[0].count), page: parseInt(page) });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// GET /api/detection/attacks/:id
router.get("/attacks/:id", authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    `SELECT ae.*, mp.stage1_prob, mp.stage2_prob, mp.model_version
     FROM attack_events ae
     LEFT JOIN ml_predictions mp ON mp.id = ae.prediction_id
     WHERE ae.id = $1`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// PATCH /api/detection/attacks/:id/resolve
router.patch("/attacks/:id/resolve", authMiddleware, async (req, res) => {
  const { notes } = req.body;
  const { rows } = await db.query(`
    UPDATE attack_events
    SET status='RESOLVED', resolved_at=NOW(), notes=$2
    WHERE id=$1 RETURNING *
  `, [req.params.id, notes]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// GET /api/detection/stats — aggregated detection stats
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const [total, byType, bySeverity, mlHealth] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '1 hour') as last_hour,
          COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') as last_24h,
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
          AVG(confidence) as avg_confidence
        FROM attack_events`),
      db.query(`
        SELECT attack_type, COUNT(*) as count
        FROM attack_events
        WHERE detected_at > NOW() - INTERVAL '24 hours'
        GROUP BY attack_type ORDER BY count DESC LIMIT 10`),
      db.query(`
        SELECT severity, COUNT(*) as count
        FROM attack_events
        WHERE detected_at > NOW() - INTERVAL '24 hours'
        GROUP BY severity`),
      ml.healthCheck(),
    ]);
    res.json({
      totals:      total.rows[0],
      by_type:     byType.rows,
      by_severity: bySeverity.rows,
      ml_service:  mlHealth,
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// POST /api/detection/predict — ad-hoc single prediction
router.post("/predict", authMiddleware, async (req, res) => {
  try {
    const result = await ml.predict(req.body);
    res.json(result);
  } catch (err) {
    console.error(err); res.status(502).json({ error: "ML service error: " + err.message });
  }
});

// GET /api/detection/model-info
router.get("/model-info", authMiddleware, async (req, res) => {
  try { res.json(await ml.getModelInfo()); }
  catch (err) { res.status(502).json({ error: "ML service error" }); }
});

module.exports = router;

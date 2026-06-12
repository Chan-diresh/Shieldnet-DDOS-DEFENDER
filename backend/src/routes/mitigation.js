const router = require("express").Router();
const db     = require("../db/connection");
const { authMiddleware, requireRole } = require("../middleware/auth");

// ── Mitigation Rules ──────────────────────────────────────────────────────────

// GET /api/mitigation/rules
router.get("/rules", authMiddleware, async (_req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM mitigation_rules ORDER BY is_active DESC, hit_count DESC"
  );
  res.json(rows);
});

// PATCH /api/mitigation/rules/:id/toggle
router.patch("/rules/:id/toggle", authMiddleware, async (req, res) => {
  const { rows } = await db.query(`
    UPDATE mitigation_rules
    SET is_active = NOT is_active, updated_at = NOW()
    WHERE id = $1 RETURNING *
  `, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Rule not found" });
  res.json(rows[0]);
});

// POST /api/mitigation/rules
router.post("/rules", authMiddleware, requireRole("admin"), async (req, res) => {
  const { name, description, layer, rule_type, threshold, action } = req.body;
  try {
    const { rows } = await db.query(`
      INSERT INTO mitigation_rules (name, description, layer, rule_type, threshold, action, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [name, description, layer, rule_type, threshold, action, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Rule name already exists" });
    res.status(500).json({ error: "DB error" });
  }
});

// DELETE /api/mitigation/rules/:id
router.delete("/rules/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const { rowCount } = await db.query("DELETE FROM mitigation_rules WHERE id=$1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Rule deleted" });
});

// ── Blocked IPs ──────────────────────────────────────────────────────────────

// GET /api/mitigation/blocked-ips
router.get("/blocked-ips", authMiddleware, async (req, res) => {
  const { page = 1, limit = 50, active = "true" } = req.query;
  const offset = (page - 1) * limit;
  const { rows } = await db.query(`
    SELECT id, ip_address::text, reason, attack_type, blocked_at, expires_at,
           blocked_by, is_active, hit_count, last_seen
    FROM blocked_ips
    WHERE is_active = $1
    ORDER BY last_seen DESC
    LIMIT $2 OFFSET $3
  `, [active === "true", limit, offset]);
  const total = await db.query("SELECT COUNT(*) FROM blocked_ips WHERE is_active=$1", [active === "true"]);
  res.json({ data: rows, total: parseInt(total.rows[0].count), page: parseInt(page) });
});

// POST /api/mitigation/blocked-ips — manual block
router.post("/blocked-ips", authMiddleware, async (req, res) => {
  const { ip_address, reason = "Manual block", expires_at } = req.body;
  try {
    const { rows } = await db.query(`
      INSERT INTO blocked_ips (ip_address, reason, blocked_by, expires_at)
      VALUES ($1,$2,'manual',$3)
      ON CONFLICT (ip_address) DO UPDATE SET is_active=TRUE, reason=$2, last_seen=NOW()
      RETURNING *
    `, [ip_address, reason, expires_at || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/mitigation/blocked-ips/:id — unblock
router.delete("/blocked-ips/:id", authMiddleware, async (req, res) => {
  const { rows } = await db.query(`
    UPDATE blocked_ips SET is_active=FALSE WHERE id=$1 RETURNING *
  `, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json({ message: "IP unblocked", data: rows[0] });
});

module.exports = router;

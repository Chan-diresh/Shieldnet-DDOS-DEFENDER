const router = require("express").Router();
const db     = require("../db/connection");
const { authMiddleware } = require("../middleware/auth");

// GET /api/alerts
router.get("/", authMiddleware, async (req, res) => {
  const { unread_only = "false", limit = 50 } = req.query;
  const where = unread_only === "true" ? "WHERE is_read=FALSE" : "";
  const { rows } = await db.query(
    `SELECT id, event_id, created_at, severity, title, message, is_read, is_resolved
     FROM alerts ${where} ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

// PATCH /api/alerts/:id/read
router.patch("/:id/read", authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    "UPDATE alerts SET is_read=TRUE WHERE id=$1 RETURNING *",
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// PATCH /api/alerts/read-all
router.patch("/read-all", authMiddleware, async (_req, res) => {
  const { rowCount } = await db.query("UPDATE alerts SET is_read=TRUE WHERE is_read=FALSE");
  res.json({ updated: rowCount });
});

// DELETE /api/alerts/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  const { rowCount } = await db.query("DELETE FROM alerts WHERE id=$1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Alert deleted" });
});

module.exports = router;

const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db      = require("../db/connection");
const { authMiddleware } = require("../middleware/auth");

// POST /api/auth/register
router.post("/register", [
  body("username").trim().isLength({ min: 3 }),
  body("email").isEmail(),
  body("password").isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password, role = "analyst" } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (username, email, password, role)
       VALUES ($1,$2,$3,$4) RETURNING id, username, email, role, created_at`,
      [username, email, hash, role]
    );
    const token = jwt.sign(
      { id: rows[0].id, username: rows[0].username, role: rows[0].role },
      process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );
    res.status(201).json({ user: rows[0], token });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "User already exists" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", [
  body("email").isEmail(),
  body("password").notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );
    res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, username, email, role, created_at FROM users WHERE id=$1", [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

module.exports = router;

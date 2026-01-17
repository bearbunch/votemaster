import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 10000;

console.log("🚀 Starting server...");

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sessions = {};

/* ================= DB INIT ================= */

(async () => {
  console.log("🗄 Initializing database...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Database ready");
})();

/* ================= MIDDLEWARE ================= */

function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  console.log("🔐 Auth token:", token);

  if (!token || !sessions[token]) {
    console.log("❌ Auth failed");
    return res.status(401).json({ error: "Not authenticated" });
  }

  req.user = sessions[token];
  next();
}

function requireAdmin(req, res, next) {
  console.log("👑 Admin check:", req.user.role);
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

/* ================= ROUTES ================= */

app.post("/ping", (req, res) => {
  console.log("📡 Ping received");
  res.json({ ok: true });
});

/* ---- REGISTER ---- */
app.post("/register", async (req, res) => {
  console.log("📝 Register request:", req.body);

  let { username, email, password } = req.body;
  let role = "user";

  if (password.includes(",")) {
    const [key, realPass] = password.split(",", 2);
    if (key === process.env.ADMIN_KEY) {
      role = "admin";
      password = realPass;
      console.log("👑 Admin registration");
    }
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username,email,password,role)
       VALUES ($1,$2,$3,$4)
       RETURNING id,username,role`,
      [username, email, hash, role]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("❌ Register error:", err.message);
    res.status(400).json({ error: "User exists or bad input" });
  }
});

/* ---- LOGIN ---- */
app.post("/login", async (req, res) => {
  console.log("🔑 Login attempt:", req.body.username);

  const { username, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE username=$1",
    [username]
  );

  const user = result.rows[0];
  if (!user) {
    console.log("❌ User not found");
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    console.log("❌ Bad password");
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions[token] = {
    id: user.id,
    username: user.username,
    role: user.role,
    created: Date.now()
  };

  console.log("✅ Login success:", user.username);

  res.json({
    token,
    username: user.username,
    role: user.role
  });
});

/* ---- CURRENT USER ---- */
app.get("/me", requireAuth, (req, res) => {
  console.log("👤 /me:", req.user.username);
  res.json(req.user);
});

/* ---- ADMIN USERS ---- */
app.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  console.log("📋 Admin list users");
  const result = await pool.query(
    "SELECT id,username,email,role,created_at FROM users"
  );
  res.json(result.rows);
});

/* ---- TERMINATE USER ---- */
app.post("/admin/terminate-user", requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.body;
  console.log("💥 Terminate user:", username);

  await pool.query("DELETE FROM users WHERE username=$1", [username]);

  for (const t in sessions) {
    if (sessions[t].username === username) delete sessions[t];
  }

  res.json({ success: true });
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 10000;

/* ================= GLOBAL LOGGING ================= */

app.use((req, res, next) => {
  console.log("====================================");
  console.log("➡️  REQUEST");
  console.log("TIME:", new Date().toISOString());
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("HEADERS:", req.headers);
  console.log("====================================");
  next();
});

app.use(cors());
app.use(express.json());

/* ================= SESSIONS ================= */

const sessions = {}; // token -> user

console.log("🔐 Session store initialized");

/* ================= DATABASE INIT ================= */

async function initDB() {
  console.log("🗄️  Initializing database...");
  try {
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
  } catch (err) {
    console.error("❌ DB INIT FAILED", err);
    process.exit(1);
  }
}
initDB();

/* ================= AUTH HELPERS ================= */

function requireAuth(req, res, next) {
  console.log("🔐 requireAuth called");
  const token = req.headers.authorization;
  console.log("🔑 Token received:", token);

  if (!token || !sessions[token]) {
    console.warn("❌ Auth failed – invalid or missing token");
    return res.status(401).json({ error: "Not authenticated" });
  }

  req.user = sessions[token];
  console.log("✅ Auth OK:", req.user);
  next();
}

function requireAdmin(req, res, next) {
  console.log("🛂 requireAdmin called for:", req.user);
  if (req.user.role !== "admin") {
    console.warn("❌ Admin access denied");
    return res.status(403).json({ error: "Admin only" });
  }
  console.log("✅ Admin access granted");
  next();
}

/* ================= REGISTER ================= */

app.post("/register", async (req, res) => {
  console.log("📝 REGISTER BODY:", req.body);

  let { username, email, password } = req.body;
  if (!username || !email || !password) {
    console.warn("❌ Missing fields");
    return res.status(400).json({ error: "Missing fields" });
  }

  let role = "user";

  if (password.includes(",")) {
    const [key, realPass] = password.split(",", 2);
    console.log("🔐 Admin key attempt:", key);
    if (key === process.env.ADMIN_KEY) {
      role = "admin";
      password = realPass;
      console.log("👑 Admin registration approved");
    } else {
      console.warn("❌ Invalid admin key");
    }
  }

  try {
    console.log("🔑 Hashing password...");
    const hash = await bcrypt.hash(password, 10);

    console.log("📥 Inserting user into DB:", username);
    const r = await pool.query(
      `INSERT INTO users (username,email,password,role)
       VALUES ($1,$2,$3,$4)
       RETURNING id,username,role`,
      [username, email, hash, role]
    );

    console.log("✅ User created:", r.rows[0]);
    res.json({ success: true, user: r.rows[0] });

  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);
    if (err.code === "23505") {
      console.warn("⚠️ Duplicate user");
      return res.status(409).json({ error: "User already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
  console.log("🔓 LOGIN BODY:", req.body);

  const { username, password } = req.body;
  try {
    console.log("🔍 Fetching user:", username);
    const r = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    const user = r.rows[0];
    if (!user) {
      console.warn("❌ User not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("🔐 Comparing password...");
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      console.warn("❌ Password mismatch");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions[token] = {
      id: user.id,
      username: user.username,
      role: user.role,
      created: Date.now()
    };

    console.log("✅ LOGIN SUCCESS");
    console.log("🎟️ Token:", token);
    console.log("📦 Sessions:", sessions);

    res.json({ token, username: user.username, role: user.role });

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= LOGOUT ================= */

app.post("/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization;
  console.log("🚪 LOGOUT token:", token);
  delete sessions[token];
  console.log("📦 Sessions after logout:", sessions);
  res.json({ success: true });
});

/* ================= ADMIN ================= */

app.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  console.log("📋 ADMIN LIST USERS");
  const r = await pool.query(
    "SELECT username,email,role,created_at FROM users ORDER BY created_at"
  );
  console.log("👥 Users:", r.rows);
  res.json(r.rows);
});

app.post("/admin/reset-password", requireAuth, requireAdmin, async (req, res) => {
  console.log("🔁 RESET PASSWORD BODY:", req.body);

  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    console.warn("❌ Missing fields");
    return res.status(400).json({ error: "Missing fields" });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    "UPDATE users SET password=$1 WHERE username=$2",
    [hash, username]
  );

  console.log("✅ Password reset for:", username);
  res.json({ success: true });
});

app.post("/admin/terminate-user", requireAuth, requireAdmin, async (req, res) => {
  console.log("❌ TERMINATE USER BODY:", req.body);

  const { username } = req.body;
  if (!username)
    return res.status(400).json({ error: "Missing username" });

  if (username === req.user.username) {
    console.warn("⚠️ Admin tried to delete self");
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  await pool.query("DELETE FROM users WHERE username=$1", [username]);
  console.log("🗑️ User deleted:", username);

  Object.keys(sessions).forEach(t => {
    if (sessions[t].username === username) {
      console.log("🧹 Removing session:", t);
      delete sessions[t];
    }
  });

  res.json({ success: true });
});

/* ================= KEEP ALIVE ================= */

app.post("/ping", (req, res) => {
  console.log("📡 PING received – server alive");
  res.json({ ok: true });
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED");
  console.log("🌍 PORT:", PORT);
  console.log("🔑 ADMIN_KEY loaded:", !!process.env.ADMIN_KEY);
});

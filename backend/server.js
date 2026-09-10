import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";
import { db, reportSelect, userView } from "./src/database.js";
import { createSessionToken, hashPassword, hashToken, verifyPassword, voucherCode } from "./src/security.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.join(root, "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const port = Number(process.env.PORT || 5050);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => {
      const extension = file.mimetype === "image/png" ? ".png" : file.mimetype === "image/webp" ? ".webp" : ".jpg";
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

function removeUpload(file) {
  if (file?.path) fs.rmSync(file.path, { force: true });
}

function createSession(userId) {
  const token = createSessionToken();
  const now = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), userId, now + 60 * 60 * 24 * 7);
  return token;
}

function authenticate(request, response, next) {
  const token = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : "";
  if (!token) return response.status(401).json({ error: "Sign in required" });
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.credits
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(token), Math.floor(Date.now() / 1000));
  if (!row) return response.status(401).json({ error: "Session expired. Sign in again." });
  request.user = row;
  request.sessionHash = hashToken(token);
  next();
}

function requireRole(role) {
  return (request, response, next) => request.user.role === role ? next() : response.status(403).json({ error: `${role === "admin" ? "Admin" : "Volunteer"} access required` });
}

app.get("/health", (_request, response) => response.json({ ok: true, service: "zerotrash-backend" }));

app.post("/api/auth/register", (request, response) => {
  const name = String(request.body?.name || "").trim().slice(0, 80);
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  if (name.length < 2) return response.status(400).json({ error: "Enter your full name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: "Enter a valid college email" });
  if (password.length < 6) return response.status(400).json({ error: "Password must have at least 6 characters" });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return response.status(409).json({ error: "An account already exists for this email" });
  const { salt, hash } = hashPassword(password);
  const result = db.prepare("INSERT INTO users (name, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, 'volunteer')").run(name, email, hash, salt);
  const user = db.prepare("SELECT id, name, email, role, credits FROM users WHERE id = ?").get(result.lastInsertRowid);
  response.status(201).json({ token: createSession(user.id), user: userView(user) });
});

app.post("/api/auth/login", (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  const user = db.prepare("SELECT id, name, email, role, credits, password_hash, password_salt FROM users WHERE email = ?").get(email);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) return response.status(401).json({ error: "Email or password is incorrect" });
  response.json({ token: createSession(user.id), user: userView(user) });
});

app.get("/api/auth/me", authenticate, (request, response) => response.json({ data: userView(request.user) }));
app.post("/api/auth/logout", authenticate, (request, response) => {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(request.sessionHash);
  response.json({ ok: true });
});

app.get("/api/state", authenticate, requireRole("volunteer"), (request, response) => {
  const reports = db.prepare(`${reportSelect} WHERE r.volunteer_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 40`).all(request.user.id);
  const totals = db.prepare("SELECT coalesce(sum(weight), 0) AS totalWeight, count(CASE WHEN status = 'verified' THEN 1 END) AS verifiedCount FROM reports WHERE volunteer_id = ?").get(request.user.id);
  const balance = db.prepare("SELECT credits FROM users WHERE id = ?").get(request.user.id).credits;
  const redemptions = db.prepare(`
    SELECT rd.id, rd.reward_id AS rewardId, rw.name, rw.description,
      rd.credits AS value, rd.code, rd.created_at AS redeemedAt
    FROM redemptions rd
    JOIN rewards rw ON rw.id = rd.reward_id
    WHERE rd.user_id = ?
    ORDER BY rd.created_at DESC, rd.id DESC
    LIMIT 50
  `).all(request.user.id);
  response.json({ reports, redemptions, balance: Number(balance), totalWeight: Number(totals.totalWeight), verifiedCount: Number(totals.verifiedCount) });
});

app.post("/api/reports", authenticate, requireRole("volunteer"), upload.single("photo"), (request, response) => {
  const location = String(request.body?.location || "").trim().slice(0, 120);
  const wasteType = String(request.body?.wasteType || "").trim().slice(0, 80);
  const notes = String(request.body?.notes || "").trim().slice(0, 500);
  if (!request.file || location.length < 3 || !wasteType) {
    removeUpload(request.file);
    return response.status(400).json({ error: !request.file ? "A before photo is required" : "Enter a location and waste type" });
  }
  const result = db.prepare("INSERT INTO reports (volunteer_id, location, waste_type, notes, before_image) VALUES (?, ?, ?, ?, ?)").run(request.user.id, location, wasteType, notes, request.file.filename);
  response.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.post("/api/reports/:id/after", authenticate, requireRole("volunteer"), upload.single("photo"), (request, response) => {
  const report = db.prepare("SELECT id, status FROM reports WHERE id = ? AND volunteer_id = ?").get(request.params.id, request.user.id);
  if (!report || report.status !== "awaiting_cleanup" || !request.file) {
    removeUpload(request.file);
    if (!report) return response.status(404).json({ error: "Report not found" });
    if (!request.file) return response.status(400).json({ error: "An after photo is required" });
    return response.status(409).json({ error: "This report is not awaiting a cleanup photo" });
  }
  db.prepare("UPDATE reports SET after_image = ?, status = 'awaiting_weighing' WHERE id = ?").run(request.file.filename, report.id);
  response.json({ status: "awaiting_weighing" });
});

app.get("/api/admin/state", authenticate, requireRole("admin"), (_request, response) => {
  const reports = db.prepare(`${reportSelect} ORDER BY CASE r.status WHEN 'awaiting_weighing' THEN 0 WHEN 'awaiting_cleanup' THEN 1 ELSE 2 END, r.created_at DESC, r.id DESC LIMIT 100`).all();
  const summary = db.prepare(`
    SELECT count(*) AS totalEntries,
      count(CASE WHEN status = 'awaiting_weighing' THEN 1 END) AS pendingVerification,
      count(CASE WHEN status = 'awaiting_cleanup' THEN 1 END) AS awaitingCleanup,
      count(CASE WHEN status = 'verified' THEN 1 END) AS verifiedCount,
      coalesce(sum(CASE WHEN status = 'verified' THEN weight ELSE 0 END), 0) AS totalWeight,
      coalesce(sum(CASE WHEN status = 'verified' THEN credits ELSE 0 END), 0) AS creditsIssued
    FROM reports
  `).get();
  response.json({ reports, summary });
});

app.post("/api/admin/reports/:id/verify", authenticate, requireRole("admin"), (request, response) => {
  const weight = Number(request.body?.weight);
  const center = String(request.body?.center || "").trim().slice(0, 120);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100 || center.length < 2) return response.status(400).json({ error: "Enter a valid weight and collection centre" });
  const report = db.prepare("SELECT id, volunteer_id, status, after_image FROM reports WHERE id = ?").get(request.params.id);
  if (!report) return response.status(404).json({ error: "Report not found" });
  if (report.status !== "awaiting_weighing" || !report.after_image) return response.status(409).json({ error: report.status === "verified" ? "This report has already been verified" : "The volunteer must add an after photo first" });
  const credits = Math.round(weight * 30);
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO credit_ledger (user_id, amount, kind, detail, report_id) VALUES (?, ?, 'cleanup', ?, ?)").run(report.volunteer_id, credits, `Cleanup #${report.id} verified at ${center}`, report.id);
    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(credits, report.volunteer_id);
    db.prepare("UPDATE reports SET center = ?, weight = ?, credits = ?, status = 'verified', verified_by = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(center, weight, credits, request.user.id, report.id);
    db.exec("COMMIT");
    response.json({ status: "verified", credits, verifiedBy: request.user.email });
  } catch (error) {
    db.exec("ROLLBACK");
    if (String(error).includes("UNIQUE")) return response.status(409).json({ error: "This report has already been verified" });
    throw error;
  }
});

app.post("/api/rewards/:id/redeem", authenticate, requireRole("volunteer"), (request, response) => {
  const reward = db.prepare("SELECT id, name, cost, stock FROM rewards WHERE id = ?").get(request.params.id);
  if (!reward) return response.status(404).json({ error: "Reward not found" });
  if (reward.stock <= 0) return response.status(409).json({ error: "This voucher is out of stock" });
  const user = db.prepare("SELECT credits FROM users WHERE id = ?").get(request.user.id);
  if (user.credits < reward.cost) return response.status(409).json({ error: "You do not have enough credits yet" });
  const code = voucherCode();
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(reward.cost, request.user.id);
    db.prepare("UPDATE rewards SET stock = stock - 1 WHERE id = ?").run(reward.id);
    db.prepare("INSERT INTO credit_ledger (user_id, amount, kind, detail) VALUES (?, ?, 'redemption', ?)").run(request.user.id, -reward.cost, `${reward.name} voucher`);
    db.prepare("INSERT INTO redemptions (user_id, reward_id, credits, code) VALUES (?, ?, ?, ?)").run(request.user.id, reward.id, reward.cost, code);
    db.exec("COMMIT");
    response.json({ code, balance: user.credits - reward.cost });
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
});

app.get("/api/images/:key", authenticate, (request, response) => {
  const key = path.basename(request.params.key);
  if (key !== request.params.key) return response.status(404).end();
  if (request.user.role !== "admin") {
    const owned = db.prepare("SELECT id FROM reports WHERE volunteer_id = ? AND (before_image = ? OR after_image = ?)").get(request.user.id, key, key);
    if (!owned) return response.status(404).end();
  }
  const filePath = path.join(uploadDirectory, key);
  if (!fs.existsSync(filePath)) return response.status(404).end();
  response.setHeader("Cache-Control", "private, max-age=3600");
  response.sendFile(filePath);
});

app.use((error, request, response, _next) => {
  removeUpload(request.file);
  console.error(error);
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return response.status(413).json({ error: "Photo must be smaller than 5 MB" });
  response.status(500).json({ error: "The backend could not complete this request" });
});

app.listen(port, "127.0.0.1", () => console.log(`ZeroTrash backend running at http://localhost:${port}`));

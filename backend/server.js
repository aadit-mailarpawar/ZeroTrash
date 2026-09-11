import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";
import { db, spotSelect, userView } from "./src/database.js";
import { createSessionToken, hashPassword, hashToken, verifyPassword, voucherCode } from "./src/security.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.join(root, "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const port = Number(process.env.PORT || 5050);
const host = process.env.HOST || "127.0.0.1";
const requirePhotoLocation = process.env.REQUIRE_PHOTO_LOCATION === "true";
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

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function readOptionalCoordinates(body) {
  const hasLatitude = body?.latitude !== undefined && body.latitude !== "";
  const hasLongitude = body?.longitude !== undefined && body.longitude !== "";
  if (!hasLatitude && !hasLongitude) return { latitude: null, longitude: null, valid: !requirePhotoLocation };
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  return { latitude, longitude, valid: validCoordinates(latitude, longitude) };
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
  const reports = db.prepare(`${spotSelect} WHERE s.volunteer_id = ? ORDER BY s.created_at DESC, s.id DESC LIMIT 40`).all(request.user.id);
  const availableSpots = db.prepare(`${spotSelect} WHERE s.status = 'open' ORDER BY s.created_at DESC, s.id DESC LIMIT 40`).all();
  const totals = db.prepare("SELECT coalesce(sum(weight), 0) AS totalWeight, count(CASE WHEN status = 'verified' THEN 1 END) AS verifiedCount FROM cleanup_spots WHERE volunteer_id = ?").get(request.user.id);
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
  response.json({ reports, availableSpots, redemptions, balance: Number(balance), totalWeight: Number(totals.totalWeight), verifiedCount: Number(totals.verifiedCount) });
});

app.post("/api/admin/spots", authenticate, requireRole("admin"), (request, response) => {
  const location = String(request.body?.location || "").trim().slice(0, 120);
  const wasteType = String(request.body?.wasteType || "").trim().slice(0, 80);
  const notes = String(request.body?.notes || "").trim().slice(0, 500);
  if (location.length < 3 || !wasteType) return response.status(400).json({ error: "Enter a location and waste type" });
  const result = db.prepare("INSERT INTO cleanup_spots (created_by, location, waste_type, notes) VALUES (?, ?, ?, ?)").run(request.user.id, location, wasteType, notes);
  response.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.post("/api/spots/:id/start", authenticate, requireRole("volunteer"), upload.single("photo"), (request, response) => {
  const { latitude, longitude, valid } = readOptionalCoordinates(request.body);
  if (!request.file || !valid) {
    removeUpload(request.file);
    return response.status(400).json({ error: !request.file ? "A before photo is required" : "A valid photo location is required" });
  }
  const result = db.prepare(`
    UPDATE cleanup_spots SET volunteer_id = ?, before_image = ?, before_lat = ?, before_lng = ?,
      before_uploaded_at = CURRENT_TIMESTAMP, status = 'awaiting_after'
    WHERE id = ? AND status = 'open' AND volunteer_id IS NULL
  `).run(request.user.id, request.file.filename, latitude, longitude, request.params.id);
  if (Number(result.changes) !== 1) {
    removeUpload(request.file);
    return response.status(409).json({ error: "This cleanup spot has already been taken" });
  }
  response.json({ status: "awaiting_after" });
});

app.post("/api/reports/:id/after", authenticate, requireRole("volunteer"), upload.single("photo"), (request, response) => {
  const { latitude, longitude, valid } = readOptionalCoordinates(request.body);
  const report = db.prepare("SELECT id, status FROM cleanup_spots WHERE id = ? AND volunteer_id = ?").get(request.params.id, request.user.id);
  if (!report || report.status !== "awaiting_after" || !request.file || !valid) {
    removeUpload(request.file);
    if (!report) return response.status(404).json({ error: "Report not found" });
    if (!request.file) return response.status(400).json({ error: "An after photo is required" });
    if (!valid) return response.status(400).json({ error: "A valid photo location is required" });
    return response.status(409).json({ error: "This spot is not awaiting an after photo" });
  }
  db.prepare(`
    UPDATE cleanup_spots SET after_image = ?, after_lat = ?, after_lng = ?,
      after_uploaded_at = CURRENT_TIMESTAMP, status = 'awaiting_weighing'
    WHERE id = ?
  `).run(request.file.filename, latitude, longitude, report.id);
  response.json({ status: "awaiting_weighing" });
});

app.get("/api/admin/state", authenticate, requireRole("admin"), (_request, response) => {
  const reports = db.prepare(`${spotSelect} ORDER BY CASE s.status WHEN 'awaiting_weighing' THEN 0 WHEN 'open' THEN 1 WHEN 'awaiting_after' THEN 2 ELSE 3 END, s.created_at DESC, s.id DESC LIMIT 100`).all();
  const summary = db.prepare(`
    SELECT count(*) AS totalEntries,
      count(CASE WHEN status = 'awaiting_weighing' THEN 1 END) AS pendingVerification,
      count(CASE WHEN status = 'open' THEN 1 END) AS openSpots,
      count(CASE WHEN status = 'awaiting_after' THEN 1 END) AS awaitingCleanup,
      count(CASE WHEN status = 'verified' THEN 1 END) AS verifiedCount,
      coalesce(sum(CASE WHEN status = 'verified' THEN weight ELSE 0 END), 0) AS totalWeight,
      coalesce(sum(CASE WHEN status = 'verified' THEN credits ELSE 0 END), 0) AS creditsIssued
    FROM cleanup_spots
  `).get();
  response.json({ reports, summary });
});

app.post("/api/admin/reports/:id/verify", authenticate, requireRole("admin"), (request, response) => {
  const weight = Number(request.body?.weight);
  const center = String(request.body?.center || "").trim().slice(0, 120);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100 || center.length < 2) return response.status(400).json({ error: "Enter a valid weight and collection centre" });
  const report = db.prepare("SELECT id, volunteer_id, status, after_image FROM cleanup_spots WHERE id = ?").get(request.params.id);
  if (!report) return response.status(404).json({ error: "Report not found" });
  if (report.status !== "awaiting_weighing" || !report.after_image) return response.status(409).json({ error: report.status === "verified" ? "This report has already been verified" : "The volunteer must add an after photo first" });
  const credits = Math.round(weight * 30);
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO spot_credit_ledger (user_id, spot_id, amount, detail) VALUES (?, ?, ?, ?)").run(report.volunteer_id, report.id, credits, `Cleanup #${report.id} verified at ${center}`);
    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(credits, report.volunteer_id);
    db.prepare("UPDATE cleanup_spots SET center = ?, weight = ?, credits = ?, status = 'verified', verified_by = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(center, weight, credits, request.user.id, report.id);
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
    const owned = db.prepare("SELECT id FROM cleanup_spots WHERE volunteer_id = ? AND (before_image = ? OR after_image = ?)").get(request.user.id, key, key);
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

app.listen(port, host, () => console.log(`ZeroTrash backend running at http://${host}:${port}`));

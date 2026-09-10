import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./security.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDirectory = path.join(root, "data");
fs.mkdirSync(dataDirectory, { recursive: true });

export const db = new DatabaseSync(path.join(dataDirectory, "zerotrash.sqlite"));
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('volunteer', 'admin')) DEFAULT 'volunteer',
    credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    waste_type TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    before_image TEXT NOT NULL,
    after_image TEXT,
    center TEXT,
    weight REAL,
    credits INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('awaiting_cleanup', 'awaiting_weighing', 'verified')) DEFAULT 'awaiting_cleanup',
    verified_by INTEGER REFERENCES users(id),
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('cleanup', 'redemption')),
    detail TEXT NOT NULL,
    report_id INTEGER UNIQUE REFERENCES reports(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    cost INTEGER NOT NULL CHECK (cost > 0),
    stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0)
  );
  CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id TEXT NOT NULL REFERENCES rewards(id),
    credits INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_reports_volunteer ON reports(volunteer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`);

function seedUser(name, email, password, role) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return;
  const { salt, hash } = hashPassword(password);
  db.prepare("INSERT INTO users (name, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)").run(name, email, hash, salt, role);
}

seedUser("ZeroTrash Admin", "admin@zerotrash.local", "admin123", "admin");
seedUser("Demo Volunteer", "volunteer@zerotrash.local", "volunteer123", "volunteer");

const rewardInsert = db.prepare("INSERT OR IGNORE INTO rewards (id, name, description, cost, stock) VALUES (?, ?, ?, ?, ?)");
rewardInsert.run("cafe-100", "Campus Café", "₹100 food voucher", 100, 100);
rewardInsert.run("books-250", "College Bookstore", "₹250 bookstore voucher", 250, 100);
rewardInsert.run("canteen-500", "Main Canteen", "₹500 meal voucher", 500, 100);

export function userView(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, pointsBalance: Number(row.credits) };
}

export const reportSelect = `
  SELECT r.id, u.name AS volunteer, u.email AS volunteerEmail,
    r.location, r.waste_type AS wasteType, r.notes,
    r.before_image AS beforeKey, r.after_image AS afterKey,
    r.center, r.weight, r.credits, r.status,
    verifier.email AS verifiedBy, r.verified_at AS verifiedAt,
    r.created_at AS createdAt
  FROM reports r
  JOIN users u ON u.id = r.volunteer_id
  LEFT JOIN users verifier ON verifier.id = r.verified_by
`;

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
  CREATE TABLE IF NOT EXISTS cleanup_spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    volunteer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    location TEXT NOT NULL,
    waste_type TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    before_image TEXT,
    before_lat REAL,
    before_lng REAL,
    before_uploaded_at TEXT,
    after_image TEXT,
    after_lat REAL,
    after_lng REAL,
    after_uploaded_at TEXT,
    center TEXT,
    weight REAL,
    credits INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('open', 'awaiting_after', 'awaiting_weighing', 'verified')) DEFAULT 'open',
    verified_by INTEGER REFERENCES users(id),
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS spot_credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spot_id INTEGER NOT NULL UNIQUE REFERENCES cleanup_spots(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_reports_volunteer ON reports(volunteer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_cleanup_spots_status_created ON cleanup_spots(status, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_cleanup_spots_volunteer_created ON cleanup_spots(volunteer_id, created_at DESC, id DESC);
  DROP INDEX IF EXISTS idx_redemptions_user;
  CREATE INDEX IF NOT EXISTS idx_redemptions_user_created_id ON redemptions(user_id, created_at DESC, id DESC);
`);
db.exec("PRAGMA optimize;");

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

export const spotSelect = `
  SELECT s.id, coalesce(u.name, 'Unclaimed') AS volunteer,
    coalesce(u.email, '') AS volunteerEmail,
    s.location, s.waste_type AS wasteType, s.notes,
    s.before_image AS beforeKey, s.after_image AS afterKey,
    s.before_lat AS beforeLat, s.before_lng AS beforeLng,
    s.after_lat AS afterLat, s.after_lng AS afterLng,
    s.center, s.weight, s.credits, s.status,
    creator.email AS createdBy, verifier.email AS verifiedBy,
    s.verified_at AS verifiedAt, s.created_at AS createdAt
  FROM cleanup_spots s
  LEFT JOIN users u ON u.id = s.volunteer_id
  JOIN users creator ON creator.id = s.created_by
  LEFT JOIN users verifier ON verifier.id = s.verified_by
`;

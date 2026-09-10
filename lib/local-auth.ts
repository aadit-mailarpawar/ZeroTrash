import { getRawDb } from "@/db/bindings";

const LEGACY_COOKIE_NAME = "zt_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export type UserRole = "volunteer" | "admin";
export type LocalUser = { id: number; name: string; email: string; role: UserRole };

function cookieName(role: UserRole) {
  return role === "admin" ? "zt_admin_session" : "zt_volunteer_session";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(size = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createPasswordSalt() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations: 120_000 }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function startSession(userId: number, role: UserRole) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const db = getRawDb();
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Math.floor(Date.now() / 1000)).run();
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, userId, expiresAt).run();
  return `${cookieName(role)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

function readCookie(request: Request, targetName: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === targetName) return rest.join("=");
  }
  return null;
}

export async function getLocalUser(request: Request, requiredRole?: UserRole): Promise<LocalUser | null> {
  const names = requiredRole
    ? [cookieName(requiredRole), LEGACY_COOKIE_NAME]
    : [LEGACY_COOKIE_NAME, cookieName("volunteer"), cookieName("admin")];

  for (const name of names) {
    const token = readCookie(request, name);
    if (!token) continue;
    const tokenHash = await sha256(token);
    const user = await getRawDb().prepare("SELECT users.id, users.name, users.email, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?").bind(tokenHash, Math.floor(Date.now() / 1000)).first<LocalUser>();
    if (user && (!requiredRole || user.role === requiredRole)) return user;
  }
  return null;
}

export function isAdminUser(user: LocalUser | null): user is LocalUser & { role: "admin" } {
  return user?.role === "admin";
}

export async function endSession(request: Request, role: UserRole) {
  const names = [cookieName(role), LEGACY_COOKIE_NAME];
  const tokens = new Set(names.map((name) => readCookie(request, name)).filter((token): token is string => Boolean(token)));
  for (const token of tokens) {
    await getRawDb().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return names.map((name) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

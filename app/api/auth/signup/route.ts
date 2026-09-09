import { createPasswordSalt, hashPassword, startSession } from "@/lib/local-auth";
import { getRawDb } from "@/db/bindings";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { name?: string; email?: string; password?: string };
    const name = String(payload.name ?? "").trim().slice(0, 80);
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");
    if (name.length < 2) return Response.json({ error: "Enter your full name" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid college email" }, { status: 400 });
    if (password.length < 6) return Response.json({ error: "Password must have at least 6 characters" }, { status: 400 });
    const db = getRawDb();
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return Response.json({ error: "An account already exists for this email" }, { status: 409 });
    const salt = createPasswordSalt();
    const passwordHash = await hashPassword(password, salt);
    const user = await db.prepare("INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?) RETURNING id, name, email").bind(name, email, passwordHash, salt).first<{ id: number; name: string; email: string }>();
    if (!user) throw new Error("User creation failed");
    const cookie = await startSession(user.id);
    return Response.json({ user: { name: user.name, email: user.email } }, { status: 201, headers: { "Set-Cookie": cookie } });
  } catch (error) {
    console.error("signup failed", error);
    return Response.json({ error: "Could not create the account" }, { status: 500 });
  }
}

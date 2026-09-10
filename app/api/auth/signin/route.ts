import { constantTimeEqual, hashPassword, startSession } from "@/lib/local-auth";
import { getRawDb } from "@/db/bindings";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { email?: string; password?: string };
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");
    const user = await getRawDb().prepare("SELECT id, name, email, password_hash AS passwordHash, salt, role FROM users WHERE email = ?").bind(email).first<{ id: number; name: string; email: string; passwordHash: string; salt: string; role: "volunteer" | "admin" }>();
    if (!user || !constantTimeEqual(await hashPassword(password, user.salt), user.passwordHash)) return Response.json({ error: "Email or password is incorrect" }, { status: 401 });
    const cookie = await startSession(user.id, user.role);
    return Response.json({ user: { name: user.name, email: user.email, role: user.role } }, { headers: { "Set-Cookie": cookie } });
  } catch (error) {
    console.error("signin failed", error);
    return Response.json({ error: "Could not sign in" }, { status: 500 });
  }
}

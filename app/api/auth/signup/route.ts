import { backendFetch, startSession } from "@/lib/local-auth";

type BackendAuth = { token?: string; user?: { name: string; email: string }; error?: string };

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { name?: string; email?: string; password?: string };
    const name = String(payload.name ?? "").trim().slice(0, 80);
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");
    if (name.length < 2) return Response.json({ error: "Enter your full name" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid college email" }, { status: 400 });
    if (password.length < 6) return Response.json({ error: "Password must have at least 6 characters" }, { status: 400 });
    const response = await backendFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "volunteer" }),
    });
    const result = await response.json() as BackendAuth;
    if (!response.ok || !result.token || !result.user) {
      return Response.json({ error: result.error || "Could not create the account" }, { status: response.status });
    }
    return Response.json(
      { user: { name: result.user.name, email: result.user.email, role: "volunteer" } },
      { status: 201, headers: { "Set-Cookie": startSession(result.token, "volunteer") } },
    );
  } catch (error) {
    console.error("backend signup failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

import { backendFetch, startSession, type UserRole } from "@/lib/local-auth";

type BackendAuth = {
  token?: string;
  user?: { name: string; email: string; role: "volunteer" | "admin" };
  error?: string;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { email?: string; password?: string };
    const response = await backendFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(payload.email ?? "").trim().toLowerCase(), password: String(payload.password ?? "") }),
    });
    const result = await response.json() as BackendAuth;
    if (!response.ok || !result.token || !result.user) {
      return Response.json({ error: result.error || "Email or password is incorrect" }, { status: response.status });
    }
    const role: UserRole = result.user.role === "admin" ? "admin" : "volunteer";
    return Response.json(
      { user: { name: result.user.name, email: result.user.email, role } },
      { headers: { "Set-Cookie": startSession(result.token, role) } },
    );
  } catch (error) {
    console.error("backend signin failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

import { backendFetch, endSession, getBackendSession } from "@/lib/local-auth";

export async function POST(request: Request) {
  const role = new URL(request.url).searchParams.get("role") === "admin" ? "admin" : "volunteer";
  try {
    const session = await getBackendSession(request, role);
    if (session) await backendFetch("/api/auth/logout", { method: "POST" }, session.token);
  } catch { /* Always clear the browser cookie, even when the local backend is unavailable. */ }
  const headers = new Headers();
  for (const cookie of endSession(role)) headers.append("Set-Cookie", cookie);
  return Response.json({ ok: true }, { headers });
}

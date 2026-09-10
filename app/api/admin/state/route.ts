import { backendFetch, getBackendSession } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getBackendSession(request, "admin");
    if (!session) return Response.json({ error: "Admin sign-in required" }, { status: 401 });
    const response = await backendFetch("/api/admin/state", {}, session.token);
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("backend admin state failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

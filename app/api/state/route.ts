import { backendFetch, getBackendSession } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getBackendSession(request, "volunteer");
    if (!session) return Response.json({ error: "Sign in to view your impact" }, { status: 401 });
    const response = await backendFetch("/api/state", {}, session.token);
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("backend state load failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

import { backendFetch, getBackendSession } from "@/lib/local-auth";

export async function POST(request: Request) {
  try {
    const session = await getBackendSession(request, "volunteer");
    if (!session) return Response.json({ error: "Sign in before reporting a spot" }, { status: 401 });
    const response = await backendFetch("/api/reports", { method: "POST", body: await request.formData() }, session.token);
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("backend report create failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

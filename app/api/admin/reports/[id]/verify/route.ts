import { backendFetch, getBackendSession } from "@/lib/local-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getBackendSession(request, "admin");
    if (!session) return Response.json({ error: "Admin sign-in required" }, { status: 401 });
    const id = encodeURIComponent((await params).id);
    const response = await backendFetch(`/api/admin/reports/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    }, session.token);
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("backend verification failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

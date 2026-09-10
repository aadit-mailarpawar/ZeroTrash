import { backendFetch, getBackendSession } from "@/lib/local-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getBackendSession(request, "volunteer");
    if (!session) return Response.json({ error: "Sign in before starting a cleanup" }, { status: 401 });
    const id = encodeURIComponent((await params).id);
    const response = await backendFetch(`/api/spots/${id}/start`, { method: "POST", body: await request.formData() }, session.token);
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("backend cleanup start failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

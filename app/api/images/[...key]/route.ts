import { backendFetch, getBackendSession } from "@/lib/local-auth";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const session = await getBackendSession(request, "admin") ?? await getBackendSession(request, "volunteer");
    if (!session) return new Response("Not signed in", { status: 401 });
    const key = (await params).key.join("/");
    if (key.includes("/") || key.includes("\\")) return new Response("Not found", { status: 404 });
    const response = await backendFetch(`/api/images/${encodeURIComponent(key)}`, {}, session.token);
    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, max-age=3600");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
}

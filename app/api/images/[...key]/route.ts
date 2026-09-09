import { getBucket } from "@/db/bindings";
import { getLocalUser } from "@/lib/local-auth";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    if (!await getLocalUser(request)) return new Response("Not signed in", { status: 401 });
    const key = (await params).key.join("/");
    if (!key.startsWith("cleanups/")) return new Response("Not found", { status: 404 });
    const object = await getBucket().get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "private, max-age=3600");
    return new Response(object.body, { headers });
  } catch { return new Response("Image unavailable", { status: 503 }); }
}

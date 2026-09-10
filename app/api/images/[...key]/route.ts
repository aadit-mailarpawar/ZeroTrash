import { getBucket, getRawDb } from "@/db/bindings";
import { getLocalUser } from "@/lib/local-auth";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const user = await getLocalUser(request);
    if (!user) return new Response("Not signed in", { status: 401 });
    const key = (await params).key.join("/");
    if (!key.startsWith("cleanups/")) return new Response("Not found", { status: 404 });
    if (user.role !== "admin") {
      const owned = await getRawDb().prepare("SELECT id FROM reports WHERE volunteer_email = ? AND (before_key = ? OR after_key = ?)").bind(user.email, key, key).first();
      if (!owned) return new Response("Not found", { status: 404 });
    }
    const object = await getBucket().get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "private, max-age=3600");
    return new Response(object.body, { headers });
  } catch { return new Response("Image unavailable", { status: 503 }); }
}

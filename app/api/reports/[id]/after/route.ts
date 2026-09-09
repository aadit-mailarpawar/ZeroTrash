import { getRawDb, getBucket, imageKey, requireImage } from "@/db/bindings";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let key: string | null = null;
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid report" }, { status: 400 });
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email) return Response.json({ error: "Sign in before adding cleanup proof" }, { status: 401 });
    const current = await getRawDb().prepare("SELECT status FROM reports WHERE id = ? AND volunteer_email = ?").bind(id, email).first<{ status: string }>();
    if (!current) return Response.json({ error: "Report not found" }, { status: 404 });
    if (current.status !== "awaiting_cleanup") return Response.json({ error: "This report is not awaiting a cleanup photo" }, { status: 409 });
    const photo = requireImage(form.get("photo"));
    key = imageKey("after", photo);
    const bucket = getBucket();
    await bucket.put(key, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });
    await getRawDb().prepare("UPDATE reports SET after_key = ?, status = 'awaiting_weighing' WHERE id = ? AND volunteer_email = ?").bind(key, id, email).run();
    return Response.json({ status: "awaiting_weighing" });
  } catch (error) {
    if (key) { try { await getBucket().delete(key); } catch { /* best effort cleanup */ } }
    console.error("after photo failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the photo" }, { status: 500 });
  }
}

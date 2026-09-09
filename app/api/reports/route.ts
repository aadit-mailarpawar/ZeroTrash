import { getRawDb, getBucket, imageKey, requireImage } from "@/db/bindings";

export async function POST(request: Request) {
  let key: string | null = null;
  try {
    const form = await request.formData();
    const location = String(form.get("location") ?? "").trim();
    const wasteType = String(form.get("wasteType") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim().slice(0, 500);
    const volunteer = String(form.get("volunteer") ?? "Volunteer").trim().slice(0, 80);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (location.length < 3 || location.length > 120) return Response.json({ error: "Enter a clear campus location" }, { status: 400 });
    if (!wasteType) return Response.json({ error: "Choose a waste type" }, { status: 400 });
    if (!email) return Response.json({ error: "Sign in before reporting a spot" }, { status: 401 });
    const photo = requireImage(form.get("photo"));
    key = imageKey("before", photo);
    const bucket = getBucket();
    await bucket.put(key, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });
    const result = await getRawDb().prepare("INSERT INTO reports (volunteer, volunteer_email, location, waste_type, notes, before_key, status) VALUES (?, ?, ?, ?, ?, ?, 'awaiting_cleanup') RETURNING id").bind(volunteer || "Volunteer", email, location, wasteType, notes, key).first<{ id: number }>();
    return Response.json({ id: result?.id }, { status: 201 });
  } catch (error) {
    if (key) { try { await getBucket().delete(key); } catch { /* best effort cleanup */ } }
    console.error("report create failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the report" }, { status: 500 });
  }
}

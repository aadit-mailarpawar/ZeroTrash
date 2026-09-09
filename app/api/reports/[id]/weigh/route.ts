import { getRawDb } from "@/db/bindings";
import { getLocalUser } from "@/lib/local-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getLocalUser(request);
    if (!user) return Response.json({ error: "Sign in before recording a weigh-in" }, { status: 401 });
    const id = Number((await params).id);
    const payload = await request.json() as { weight?: number; center?: string };
    const weight = Number(payload.weight);
    const center = String(payload.center ?? "").trim();
    if (!Number.isInteger(id) || !Number.isFinite(weight) || weight <= 0 || weight > 100 || center.length < 2) return Response.json({ error: "Enter a valid report, weight and collection centre" }, { status: 400 });
    const db = getRawDb();
    const current = await db.prepare("SELECT status, volunteer_email AS volunteerEmail FROM reports WHERE id = ? AND volunteer_email = ?").bind(id, user.email).first<{ status: string; volunteerEmail: string }>();
    if (!current) return Response.json({ error: "Report not found" }, { status: 404 });
    if (current.status !== "awaiting_weighing") return Response.json({ error: "Add an after photo before weighing this cleanup" }, { status: 409 });
    const credits = Math.round(weight * 30);
    await db.batch([
      db.prepare("UPDATE reports SET center = ?, weight = ?, credits = ?, status = 'verified' WHERE id = ? AND status = 'awaiting_weighing'").bind(center, weight, credits, id),
      db.prepare("INSERT INTO credit_ledger (amount, kind, detail, volunteer_email) VALUES (?, 'cleanup', ?, ?)").bind(credits, `Verified cleanup #${id} at ${center}`, current.volunteerEmail),
    ]);
    return Response.json({ status: "verified", credits });
  } catch (error) {
    console.error("weigh-in failed", error);
    return Response.json({ error: "Could not record the weigh-in" }, { status: 500 });
  }
}

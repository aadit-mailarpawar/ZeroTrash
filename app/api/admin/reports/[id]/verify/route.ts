import { getRawDb } from "@/db/bindings";
import { getLocalUser, isAdminUser } from "@/lib/local-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getLocalUser(request);
    if (!user) return Response.json({ error: "Admin sign-in required" }, { status: 401 });
    if (!isAdminUser(user)) return Response.json({ error: "Admin access required" }, { status: 403 });

    const id = Number((await params).id);
    const payload = await request.json() as { weight?: number; center?: string };
    const weight = Number(payload.weight);
    const center = String(payload.center ?? "").trim().slice(0, 120);
    if (!Number.isInteger(id) || !Number.isFinite(weight) || weight <= 0 || weight > 100 || center.length < 2) {
      return Response.json({ error: "Enter a valid report, weight and collection centre" }, { status: 400 });
    }

    const db = getRawDb();
    const report = await db.prepare("SELECT status, volunteer_email AS volunteerEmail, after_key AS afterKey FROM reports WHERE id = ?").bind(id).first<{ status: string; volunteerEmail: string; afterKey: string | null }>();
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
    if (!report.volunteerEmail) return Response.json({ error: "This legacy demo entry is not linked to a volunteer" }, { status: 409 });
    if (report.status !== "awaiting_weighing") {
      const message = report.status === "awaiting_cleanup" ? "The volunteer must add an after photo first" : "This report has already been verified";
      return Response.json({ error: message }, { status: 409 });
    }

    const credits = Math.round(weight * 30);
    const detail = `Admin verified cleanup #${id} at ${center}`;
    const [, update] = await db.batch([
      db.prepare(`
        INSERT OR IGNORE INTO credit_ledger (amount, kind, detail, volunteer_email, report_id)
        SELECT ?, 'cleanup', ?, volunteer_email, id FROM reports
        WHERE id = ? AND status = 'awaiting_weighing' AND after_key IS NOT NULL
      `).bind(credits, detail, id),
      db.prepare(`
        UPDATE reports SET center = ?, weight = ?, credits = ?, status = 'verified',
          verified_by = ?, verified_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'awaiting_weighing'
          AND EXISTS (SELECT 1 FROM credit_ledger WHERE report_id = ? AND kind = 'cleanup')
      `).bind(center, weight, credits, user.email, id, id),
    ]);

    if (Number(update.meta.changes ?? 0) !== 1) return Response.json({ error: "This report was already verified" }, { status: 409 });
    return Response.json({ status: "verified", credits, verifiedBy: user.email });
  } catch (error) {
    console.error("admin verification failed", error);
    return Response.json({ error: "Could not verify this cleanup" }, { status: 500 });
  }
}

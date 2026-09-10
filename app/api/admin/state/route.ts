import { getRawDb } from "@/db/bindings";
import { getLocalUser, isAdminUser } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

type AdminReport = {
  id: number;
  volunteer: string;
  volunteerEmail: string;
  location: string;
  wasteType: string;
  notes: string;
  beforeKey: string;
  afterKey: string | null;
  center: string | null;
  weight: number | null;
  credits: number;
  status: "awaiting_cleanup" | "awaiting_weighing" | "verified";
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export async function GET(request: Request) {
  try {
    const user = await getLocalUser(request, "admin");
    if (!user) return Response.json({ error: "Admin sign-in required" }, { status: 401 });
    if (!isAdminUser(user)) return Response.json({ error: "Admin access required" }, { status: 403 });

    const db = getRawDb();
    const [reportRows, summary] = await Promise.all([
      db.prepare(`
        SELECT id, volunteer, volunteer_email AS volunteerEmail, location,
          waste_type AS wasteType, notes, before_key AS beforeKey,
          after_key AS afterKey, center, weight, credits, status,
          verified_by AS verifiedBy, verified_at AS verifiedAt,
          created_at AS createdAt
        FROM reports
        ORDER BY CASE status
          WHEN 'awaiting_weighing' THEN 0
          WHEN 'awaiting_cleanup' THEN 1
          ELSE 2
        END, created_at DESC, id DESC
        LIMIT 100
      `).all<AdminReport>(),
      db.prepare(`
        SELECT
          count(*) AS totalEntries,
          count(CASE WHEN status = 'awaiting_weighing' THEN 1 END) AS pendingVerification,
          count(CASE WHEN status = 'awaiting_cleanup' THEN 1 END) AS awaitingCleanup,
          count(CASE WHEN status = 'verified' THEN 1 END) AS verifiedCount,
          coalesce(sum(CASE WHEN status = 'verified' THEN weight ELSE 0 END), 0) AS totalWeight,
          coalesce(sum(CASE WHEN status = 'verified' THEN credits ELSE 0 END), 0) AS creditsIssued
        FROM reports
      `).first<Record<string, number>>(),
    ]);

    return Response.json({
      reports: reportRows.results ?? [],
      summary: {
        totalEntries: Number(summary?.totalEntries ?? 0),
        pendingVerification: Number(summary?.pendingVerification ?? 0),
        awaitingCleanup: Number(summary?.awaitingCleanup ?? 0),
        verifiedCount: Number(summary?.verifiedCount ?? 0),
        totalWeight: Number(summary?.totalWeight ?? 0),
        creditsIssued: Number(summary?.creditsIssued ?? 0),
      },
    });
  } catch (error) {
    console.error("admin state load failed", error);
    return Response.json({ error: "Admin records are temporarily unavailable" }, { status: 503 });
  }
}

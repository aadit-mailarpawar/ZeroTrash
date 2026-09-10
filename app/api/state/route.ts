import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { creditLedger, reports } from "@/db/schema";
import { getLocalUser } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getLocalUser(request, "volunteer");
    if (!user) return Response.json({ error: "Sign in to view your impact" }, { status: 401 });
    if (user.role !== "volunteer") return Response.json({ error: "Volunteer access required" }, { status: 403 });
    const email = user.email;
    const db = getDb();
    const [rows, totals, balance] = await Promise.all([
      db.select().from(reports).where(eq(reports.volunteerEmail, email)).orderBy(desc(reports.createdAt), desc(reports.id)).limit(40),
      db.select({ totalWeight: sql<number>`coalesce(sum(${reports.weight}), 0)`, verifiedCount: sql<number>`count(case when ${reports.status} = 'verified' then 1 end)` }).from(reports).where(eq(reports.volunteerEmail, email)),
      db.select({ value: sql<number>`coalesce(sum(${creditLedger.amount}), 0)` }).from(creditLedger).where(eq(creditLedger.volunteerEmail, email)),
    ]);
    return Response.json({ reports: rows, totalWeight: Number(totals[0]?.totalWeight ?? 0), verifiedCount: Number(totals[0]?.verifiedCount ?? 0), balance: Number(balance[0]?.value ?? 0) });
  } catch (error) {
    console.error("state load failed", error);
    return Response.json({ error: "Impact data is temporarily unavailable" }, { status: 503 });
  }
}

import { desc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { creditLedger, reports } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const [rows, totals, balance] = await Promise.all([
      db.select().from(reports).orderBy(desc(reports.createdAt), desc(reports.id)).limit(40),
      db.select({ totalWeight: sql<number>`coalesce(sum(${reports.weight}), 0)`, verifiedCount: sql<number>`count(case when ${reports.status} = 'verified' then 1 end)` }).from(reports),
      db.select({ value: sql<number>`coalesce(sum(${creditLedger.amount}), 0)` }).from(creditLedger),
    ]);
    return Response.json({ reports: rows, totalWeight: Number(totals[0]?.totalWeight ?? 0), verifiedCount: Number(totals[0]?.verifiedCount ?? 0), balance: Number(balance[0]?.value ?? 0) });
  } catch (error) {
    console.error("state load failed", error);
    return Response.json({ error: "Impact data is temporarily unavailable" }, { status: 503 });
  }
}

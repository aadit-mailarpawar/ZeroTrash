import { getRawDb } from "@/db/bindings";

const rewards = {
  "cafe-100": { name: "Campus Café", cost: 100 },
  "books-250": { name: "College Bookstore", cost: 250 },
  "canteen-500": { name: "Main Canteen", cost: 500 },
} as const;

export async function POST(request: Request) {
  try {
    const { rewardId, email: rawEmail } = await request.json() as { rewardId?: string; email?: string };
    const email = String(rawEmail ?? "").trim().toLowerCase();
    if (!email) return Response.json({ error: "Sign in before redeeming a voucher" }, { status: 401 });
    const reward = rewards[rewardId as keyof typeof rewards];
    if (!reward) return Response.json({ error: "Reward not found" }, { status: 404 });
    const db = getRawDb();
    const row = await db.prepare("SELECT coalesce(sum(amount), 0) AS balance FROM credit_ledger WHERE volunteer_email = ?").bind(email).first<{ balance: number }>();
    if (Number(row?.balance ?? 0) < reward.cost) return Response.json({ error: "You do not have enough credits yet" }, { status: 409 });
    const code = `ZT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await db.batch([
      db.prepare("INSERT INTO credit_ledger (amount, kind, detail, volunteer_email) VALUES (?, 'redemption', ?, ?)").bind(-reward.cost, `${reward.name} voucher`, email),
      db.prepare("INSERT INTO redemptions (reward_id, reward_name, credits, code, volunteer_email) VALUES (?, ?, ?, ?, ?)").bind(rewardId, reward.name, reward.cost, code, email),
    ]);
    return Response.json({ code, balance: Number(row?.balance ?? 0) - reward.cost });
  } catch (error) {
    console.error("redemption failed", error);
    return Response.json({ error: "Could not redeem the voucher" }, { status: 500 });
  }
}

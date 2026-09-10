import { backendFetch, getBackendSession } from "@/lib/local-auth";

export async function POST(request: Request) {
  try {
    const session = await getBackendSession(request, "volunteer");
    if (!session) return Response.json({ error: "Sign in before redeeming a voucher" }, { status: 401 });
    const { rewardId } = await request.json() as { rewardId?: string };
    if (!rewardId) return Response.json({ error: "Reward not found" }, { status: 404 });
    const response = await backendFetch(`/api/rewards/${encodeURIComponent(rewardId)}/redeem`, { method: "POST" }, session.token);
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("backend redemption failed", error);
    return Response.json({ error: "The ZeroTrash backend is not running" }, { status: 503 });
  }
}

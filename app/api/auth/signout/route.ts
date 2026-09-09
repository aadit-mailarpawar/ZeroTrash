import { endSession } from "@/lib/local-auth";

export async function POST(request: Request) {
  try {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": await endSession(request) } });
  } catch (error) {
    console.error("signout failed", error);
    return Response.json({ error: "Could not sign out" }, { status: 500 });
  }
}

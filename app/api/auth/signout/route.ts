import { endSession } from "@/lib/local-auth";

export async function POST(request: Request) {
  try {
    const role = new URL(request.url).searchParams.get("role") === "admin" ? "admin" : "volunteer";
    const headers = new Headers();
    for (const cookie of await endSession(request, role)) headers.append("Set-Cookie", cookie);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error("signout failed", error);
    return Response.json({ error: "Could not sign out" }, { status: 500 });
  }
}

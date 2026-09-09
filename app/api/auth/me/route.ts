import { getLocalUser } from "@/lib/local-auth";

export async function GET(request: Request) {
  try {
    const user = await getLocalUser(request);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    return Response.json({ user: { name: user.name, email: user.email } });
  } catch (error) {
    console.error("session read failed", error);
    return Response.json({ error: "Session unavailable" }, { status: 503 });
  }
}

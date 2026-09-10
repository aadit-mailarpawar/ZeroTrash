import { getLocalUser } from "@/lib/local-auth";

export async function GET(request: Request) {
  try {
    const roleParam = new URL(request.url).searchParams.get("role");
    const role = roleParam === "admin" || roleParam === "volunteer" ? roleParam : undefined;
    const user = await getLocalUser(request, role);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    return Response.json({ user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error("session read failed", error);
    return Response.json({ error: "Session unavailable" }, { status: 503 });
  }
}

const LEGACY_COOKIE_NAME = "zt_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export type UserRole = "volunteer" | "admin";
export type LocalUser = { id: string; name: string; email: string; role: UserRole; pointsBalance: number };
type BackendUser = { id: number; name: string; email: string; role: "volunteer" | "admin"; pointsBalance?: number };

export const BACKEND_ORIGIN = (process.env.TRASH_BACKEND_URL || "http://127.0.0.1:5050").replace(/\/$/, "");

function cookieName(role: UserRole) {
  return role === "admin" ? "zt_admin_session" : "zt_volunteer_session";
}

function readCookie(request: Request, targetName: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === targetName) return rest.join("=");
  }
  return null;
}

export async function backendFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BACKEND_ORIGIN}${path}`, { ...init, headers, cache: "no-store" });
}

function frontendRole(role: BackendUser["role"]): UserRole {
  return role === "admin" ? "admin" : "volunteer";
}

export function startSession(token: string, role: UserRole) {
  return `${cookieName(role)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export async function getBackendSession(request: Request, requiredRole: UserRole) {
  const names = [cookieName(requiredRole), LEGACY_COOKIE_NAME];
  for (const name of names) {
    const token = readCookie(request, name);
    if (!token) continue;
    const response = await backendFetch("/api/auth/me", {}, token);
    if (!response.ok) continue;
    const payload = await response.json() as { data?: BackendUser };
    const backendUser = payload.data;
    if (!backendUser || frontendRole(backendUser.role) !== requiredRole) continue;
    const user: LocalUser = {
      id: String(backendUser.id),
      name: backendUser.name,
      email: backendUser.email,
      role: requiredRole,
      pointsBalance: Number(backendUser.pointsBalance ?? 0),
    };
    return { token, user };
  }
  return null;
}

export async function getLocalUser(request: Request, requiredRole: UserRole = "volunteer") {
  return (await getBackendSession(request, requiredRole))?.user ?? null;
}

export function isAdminUser(user: LocalUser | null): user is LocalUser & { role: "admin" } {
  return user?.role === "admin";
}

export function endSession(role: UserRole) {
  return [cookieName(role), LEGACY_COOKIE_NAME].map((name) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

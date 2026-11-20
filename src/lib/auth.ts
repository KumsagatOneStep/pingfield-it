import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import type { Role } from "./validate";

export const SESSION_COOKIE = "prn_session";
const SESSION_HOURS = 8;

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
};

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };
export const hasRole = (u: SessionUser, min: Role) => RANK[u.role] >= RANK[min];

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function startSession(userId: number, sessionVersion: number) {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// The token alone is not trusted: the user must still exist, be active,
// and have the same session_version (bumped on password reset / deactivation).
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let uid: number, sv: number;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    uid = Number(payload.sub);
    sv = Number(payload.sv);
    if (!Number.isInteger(uid) || !Number.isInteger(sv)) return null;
  } catch {
    return null;
  }
  const rows = await db()`
    select id, username, full_name, role, must_change_password
    from users where id = ${uid} and active and session_version = ${sv}`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    mustChangePassword: r.must_change_password,
  };
}

/** For server pages: redirects instead of rendering when access is missing. */
export async function requirePageUser(min: Role = "viewer", opts: { passwordPage?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.passwordPage) redirect("/account");
  if (!hasRole(user, min)) redirect("/");
  return user;
}

export const jsonError = (status: number, error: string, extra: object = {}) =>
  NextResponse.json({ error, ...extra }, { status });

/** Rejects cross-site writes: the browser always sends Origin on POST/PUT/PATCH/DELETE. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** For API routes: returns the user, or a ready error response. */
export async function requireApiUser(
  req: Request,
  min: Role = "viewer",
  opts: { passwordChange?: boolean } = {},
): Promise<SessionUser | NextResponse> {
  if (req.method !== "GET" && !sameOrigin(req)) return jsonError(403, "Запрос отклонён");
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Сессия истекла, войдите снова");
  if (user.mustChangePassword && !opts.passwordChange) return jsonError(403, "Сначала смените пароль");
  if (!hasRole(user, min)) return jsonError(403, "Недостаточно прав");
  return user;
}

export async function audit(
  user: SessionUser,
  action: "create" | "update" | "delete",
  entity: "printer" | "user" | "tmc_act" | "tmc_item" | "tmc_org" | "cartridge_move" | "cartridge_model" | "kb_article",
  entityId: number | null,
  before: unknown,
  after: unknown,
) {
  await db()`
    insert into audit_log (user_id, username, action, entity, entity_id, before, after)
    values (${user.id}, ${user.username}, ${action}, ${entity}, ${entityId},
            ${before === null ? null : JSON.stringify(before)}::jsonb,
            ${after === null ? null : JSON.stringify(after)}::jsonb)`;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

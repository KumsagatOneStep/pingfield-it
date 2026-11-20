import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { ROLES, passwordProblem, type Role } from "@/lib/validate";
import { demoUserChangeError } from "@/lib/demo/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireApiUser(req, "admin");
  if (admin instanceof NextResponse) return admin;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(404, "Пользователь не найден");
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;

  const sql = db();
  const [before] = await sql`select id, username, full_name, act_name, position, role, active from users where id = ${id}`;
  if (!before) return jsonError(404, "Пользователь не найден");
  const locked = demoUserChangeError(before as { username: string; role: string; active: boolean }, b);
  if (locked) return jsonError(403, locked);

  const role = b.role === undefined ? before.role : (b.role as Role);
  const active = b.active === undefined ? before.active : b.active;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim().slice(0, 120) : before.full_name;
  const actName = typeof b.actName === "string" ? b.actName.trim().slice(0, 120) : before.act_name;
  const position = typeof b.position === "string" ? b.position.trim().slice(0, 120) : before.position;
  if (!ROLES.includes(role)) return jsonError(400, "Неизвестная роль");
  if (typeof active !== "boolean") return jsonError(400, "Неверное значение «активен»");
  if (id === admin.id && (role !== "admin" || !active)) {
    return jsonError(400, "Нельзя снять права администратора или отключить самого себя");
  }

  let hash: string | null = null;
  if (b.password !== undefined) {
    const pwErr = passwordProblem(b.password);
    if (pwErr) return jsonError(400, pwErr);
    hash = await bcrypt.hash(b.password as string, 12);
  }
  // Any change to access ends the user's current sessions.
  const bump = hash !== null || role !== before.role || active !== before.active;

  const [row] = await sql`
    update users set
      role = ${role}, active = ${active}, full_name = ${fullName},
      act_name = ${actName}, position = ${position},
      password_hash = coalesce(${hash}, password_hash),
      must_change_password = case when ${hash}::text is not null then true else must_change_password end,
      failed_attempts = case when ${hash}::text is not null then 0 else failed_attempts end,
      locked_until = case when ${hash}::text is not null then null else locked_until end,
      session_version = session_version + ${bump ? 1 : 0}
    where id = ${id}
    returning id, username, full_name, act_name, position, role, active`;
  // A new password also lifts any login throttling for this account.
  if (hash !== null) await sql`delete from login_failures where username = ${before.username}`;
  await audit(admin, "update", "user", id, before, { ...row, passwordReset: hash !== null });
  return NextResponse.json({ user: row });
}

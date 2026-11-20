import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { ROLES, USERNAME_RE, passwordProblem, type Role } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireApiUser(req, "admin");
  if (user instanceof NextResponse) return user;
  const rows = await db()`
    select id, username, full_name, act_name, position, role, active, must_change_password, created_at,
           locked_until is not null and locked_until > now() as locked
    from users order by username`;
  return NextResponse.json({ users: rows });
}

export async function POST(req: Request) {
  const user = await requireApiUser(req, "admin");
  if (user instanceof NextResponse) return user;
  const b = (await readJson(req)) as Record<string, unknown> | null;
  const username = typeof b?.username === "string" ? b.username.trim().toLowerCase() : "";
  const fullName = typeof b?.fullName === "string" ? b.fullName.trim().slice(0, 120) : "";
  const actName = typeof b?.actName === "string" ? b.actName.trim().slice(0, 120) : "";
  const position = typeof b?.position === "string" ? b.position.trim().slice(0, 120) : "";
  const role = b?.role as Role;
  if (!USERNAME_RE.test(username)) return jsonError(400, "Логин: 3–32 символа, латиница, цифры, точка, дефис или _");
  if (!ROLES.includes(role)) return jsonError(400, "Выберите роль");
  const pwErr = passwordProblem(b?.password);
  if (pwErr) return jsonError(400, pwErr);

  const sql = db();
  const exists = await sql`select 1 from users where username = ${username}`;
  if (exists[0]) return jsonError(409, `Логин «${username}» уже занят`);
  const hash = await bcrypt.hash(b!.password as string, 12);
  const [row] = await sql`
    insert into users (username, full_name, act_name, position, password_hash, role, must_change_password)
    values (${username}, ${fullName}, ${actName}, ${position}, ${hash}, ${role}, true)
    returning id, username, full_name, act_name, position, role, active`;
  await audit(user, "create", "user", row.id, null, row);
  return NextResponse.json({ user: row }, { status: 201 });
}

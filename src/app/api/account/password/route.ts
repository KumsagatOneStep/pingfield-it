import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { jsonError, readJson, requireApiUser, startSession } from "@/lib/auth";
import { passwordProblem } from "@/lib/validate";
import { isDemoUsername } from "@/lib/demo/accounts";
import { DEMO_PASSWORD_LOCKED } from "@/lib/demo/guard";

export async function POST(req: Request) {
  const user = await requireApiUser(req, "viewer", { passwordChange: true });
  if (user instanceof NextResponse) return user;
  if (isDemoUsername(user.username)) return jsonError(403, DEMO_PASSWORD_LOCKED);
  const b = (await readJson(req)) as { current?: unknown; next?: unknown } | null;
  const current = typeof b?.current === "string" ? b.current : "";
  const pwErr = passwordProblem(b?.next);
  if (pwErr) return jsonError(400, pwErr);
  if (b!.next === current) return jsonError(400, "Новый пароль должен отличаться от текущего");

  const sql = db();
  const [row] = await sql`select password_hash from users where id = ${user.id}`;
  if (!row || !(await bcrypt.compare(current, row.password_hash))) {
    return jsonError(400, "Текущий пароль введён неверно");
  }
  const hash = await bcrypt.hash(b!.next as string, 12);
  const [upd] = await sql`
    update users set password_hash = ${hash}, must_change_password = false,
      session_version = session_version + 1
    where id = ${user.id} returning session_version`;
  // Other devices are signed out; this one gets a fresh session.
  await startSession(user.id, upd.session_version);
  return NextResponse.json({ ok: true });
}

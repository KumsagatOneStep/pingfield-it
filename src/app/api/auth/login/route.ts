import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { jsonError, readJson, sameOrigin, startSession } from "@/lib/auth";
import { clientIp, loginDecision, USER_WINDOW_MINUTES, USERNAME_MAX, WINDOW_MINUTES } from "@/lib/login-policy";

// Compared against when the user does not exist, so both paths take the same time.
const DUMMY_HASH = "$2b$12$bk/oVPQxorgC.V1N72BDiusu/8s2uz36Y/IVho9gsdSM/2RtZahIS";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Запрос отклонён");
  const body = (await readJson(req)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || password.length > 128) return jsonError(400, "Введите логин и пароль");
  // No account can have a longer login (USERNAME_RE allows 3–32 characters), so answer
  // as for a wrong password and do not store the string in login_failures.
  if (username.length > USERNAME_MAX) return jsonError(401, "Неверный логин или пароль");

  const sql = db();
  const ip = clientIp(req.headers);

  // Everything below up to the password check depends only on the login string and
  // the IP, never on whether the user exists, so both answer the same way.
  await sql`delete from login_failures where at < now() - interval '1 day'`;
  const [counts] = await sql`
    select
      count(*) filter (where username = ${username} and ip = ${ip}
                         and at > now() - make_interval(mins => ${WINDOW_MINUTES}))::int as "pairFails",
      count(*) filter (where ip = ${ip}
                         and at > now() - make_interval(mins => ${WINDOW_MINUTES}))::int as "ipFails",
      count(*) filter (where username = ${username})::int as "userFails"
    from login_failures
    where (username = ${username} or ip = ${ip})
      and at > now() - make_interval(mins => ${USER_WINDOW_MINUTES})`;
  const decision = loginDecision(counts as { pairFails: number; ipFails: number; userFails: number });
  if (decision.delayMs) await sleep(decision.delayMs);
  if (decision.blocked) return jsonError(429, `Слишком много неудачных попыток. Подождите ${WINDOW_MINUTES} минут.`);

  const rows = await sql`
    select id, password_hash, active, session_version, must_change_password
    from users where username = ${username}`;
  const user = rows[0];

  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    await sql`insert into login_failures (username, ip) values (${username}, ${ip})`;
    return jsonError(401, "Неверный логин или пароль");
  }

  await sql`delete from login_failures where username = ${username} and ip = ${ip}`;
  await startSession(user.id, user.session_version);
  return NextResponse.json({ ok: true, mustChangePassword: user.must_change_password });
}

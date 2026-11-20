import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validatePrinter } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireApiUser(req);
  if (user instanceof NextResponse) return user;
  const rows = await db()`
    select p.id, p.ip, p.owner, p.room, p.model, p.note, p.updated_at, u.username as updated_by
    from printers p left join users u on u.id = p.updated_by
    order by p.id`;
  return NextResponse.json({ printers: rows });
}

export async function POST(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const body = await readJson(req);
  const v = validatePrinter(body);
  if ("error" in v) return jsonError(400, v.error);
  const p = v.value;
  const force = (body as { force?: unknown }).force === true;

  const sql = db();
  if (p.ip && !force) {
    const clash = await sql`select owner from printers where ip = ${p.ip} limit 1`;
    if (clash[0]) return jsonError(409, `${p.ip} уже записан за «${clash[0].owner}»`, { conflict: true });
  }
  const [row] = await sql`
    insert into printers (ip, owner, room, model, note, updated_by)
    values (${p.ip}, ${p.owner}, ${p.room}, ${p.model}, ${p.note}, ${user.id})
    returning id, ip, owner, room, model, note`;
  await audit(user, "create", "printer", row.id, null, row);
  return NextResponse.json({ printer: row }, { status: 201 });
}

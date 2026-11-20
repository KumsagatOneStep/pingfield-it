import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validatePrinter } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const rows = await db()`select id, ip, owner, room, model, note from printers where id = ${id}`;
  return rows[0] ?? null;
}

function parseId(s: string) {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError(404, "Запись не найдена");
  const body = await readJson(req);
  const v = validatePrinter(body);
  if ("error" in v) return jsonError(400, v.error);
  const p = v.value;
  const force = (body as { force?: unknown }).force === true;

  const sql = db();
  const before = await load(id);
  if (!before) return jsonError(404, "Запись уже удалена");
  if (p.ip && !force) {
    const clash = await sql`select owner from printers where ip = ${p.ip} and id <> ${id} limit 1`;
    if (clash[0]) return jsonError(409, `${p.ip} уже записан за «${clash[0].owner}»`, { conflict: true });
  }
  const [row] = await sql`
    update printers set ip = ${p.ip}, owner = ${p.owner}, room = ${p.room}, model = ${p.model},
      note = ${p.note}, updated_at = now(), updated_by = ${user.id}
    where id = ${id}
    returning id, ip, owner, room, model, note`;
  await audit(user, "update", "printer", id, before, row);
  return NextResponse.json({ printer: row });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = parseId((await ctx.params).id);
  if (!id) return jsonError(404, "Запись не найдена");
  const before = await load(id);
  if (!before) return jsonError(404, "Запись уже удалена");
  await db()`delete from printers where id = ${id}`;
  await audit(user, "delete", "printer", id, before, null);
  return NextResponse.json({ ok: true });
}

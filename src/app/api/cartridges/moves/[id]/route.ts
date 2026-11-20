import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, hasRole, jsonError, readJson, requireApiUser, type SessionUser } from "@/lib/auth";
import { almatyToday, isSameAlmatyDay } from "@/lib/tmc/date";
import { validateMove } from "@/lib/cartridges/validate";
import { linesJson, moveSnapshot } from "@/lib/cartridges/moves";

type Ctx = { params: Promise<{ id: string }> };

async function loadForChange(user: SessionUser, id: number) {
  if (!Number.isInteger(id) || id <= 0) return jsonError(404, "Запись не найдена");
  const [m] = await db()`
    select m.move_date::text as move_date, m.from_place, m.to_place, m.note, m.created_by, m.created_at,
           (select jsonb_agg(jsonb_build_object('model', l.model, 'qty', l.qty, 'writtenOff', l.written_off) order by l.pos)
            from cartridge_move_lines l where l.move_id = m.id) as lines
    from cartridge_moves m where m.id = ${id}`;
  if (!m) return jsonError(404, "Запись не найдена");
  const own = m.created_by === user.id && isSameAlmatyDay(new Date(m.created_at), new Date());
  if (!hasRole(user, "admin") && !own) return jsonError(403, "Изменить можно только свою запись в день создания");
  return moveSnapshot({
    moveDate: m.move_date,
    fromPlace: m.from_place,
    toPlace: m.to_place,
    note: m.note,
    lines: m.lines ?? [],
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  const before = await loadForChange(user, id);
  if (before instanceof NextResponse) return before;
  const v = validateMove(await readJson(req), almatyToday());
  if ("error" in v) return jsonError(400, v.error);
  const m = v.value;
  // One statement: the move and its lines change together or not at all.
  const [row] = await db()`
    with upd as (
      update cartridge_moves
      set move_date = ${m.moveDate}, from_place = ${m.fromPlace}, to_place = ${m.toPlace}, note = ${m.note}
      where id = ${id}
      returning id
    ), del as (
      delete from cartridge_move_lines where move_id = ${id}
    ), ins as (
      insert into cartridge_move_lines (move_id, pos, model, qty, written_off)
      select upd.id, l.pos, l.model, l.qty, l.written_off
      from upd, jsonb_to_recordset(${linesJson(m.lines)}::jsonb) as l(pos int, model text, qty int, written_off int)
    )
    select id from upd`;
  if (!row) return jsonError(404, "Запись не найдена");
  await audit(user, "update", "cartridge_move", id, before, moveSnapshot(m));
  return NextResponse.json({ move: { id } });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  const before = await loadForChange(user, id);
  if (before instanceof NextResponse) return before;
  await db()`delete from cartridge_moves where id = ${id}`;
  await audit(user, "delete", "cartridge_move", id, before, null);
  return NextResponse.json({ ok: true });
}

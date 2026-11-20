import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { almatyToday } from "@/lib/tmc/date";
import { validateMove } from "@/lib/cartridges/validate";
import { linesJson, moveSnapshot } from "@/lib/cartridges/moves";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const moves = await db()`
    select m.id, m.move_date::text as move_date, m.from_place, m.to_place, m.note, m.created_by,
           u.username as created_by_username, m.created_at,
           (select jsonb_agg(jsonb_build_object('model', l.model, 'qty', l.qty, 'written_off', l.written_off) order by l.pos)
            from cartridge_move_lines l where l.move_id = m.id) as lines
    from cartridge_moves m
    left join users u on u.id = m.created_by
    order by m.move_date desc, m.id desc
    limit 200`;
  return NextResponse.json({ moves });
}

export async function POST(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const v = validateMove(await readJson(req), almatyToday());
  if ("error" in v) return jsonError(400, v.error);
  const m = v.value;
  // One statement: the move and its lines are inserted together or not at all.
  const [row] = await db()`
    with mv as (
      insert into cartridge_moves (move_date, from_place, to_place, note, created_by)
      values (${m.moveDate}, ${m.fromPlace}, ${m.toPlace}, ${m.note}, ${user.id})
      returning id
    ), ins as (
      insert into cartridge_move_lines (move_id, pos, model, qty, written_off)
      select mv.id, l.pos, l.model, l.qty, l.written_off
      from mv, jsonb_to_recordset(${linesJson(m.lines)}::jsonb) as l(pos int, model text, qty int, written_off int)
    )
    select id from mv`;
  await audit(user, "create", "cartridge_move", row.id, null, moveSnapshot(m));
  return NextResponse.json({ move: { id: row.id } }, { status: 201 });
}

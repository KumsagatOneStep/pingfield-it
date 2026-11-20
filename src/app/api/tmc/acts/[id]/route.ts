import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, hasRole, jsonError, requireApiUser } from "@/lib/auth";
import { isSameAlmatyDay } from "@/lib/tmc/date";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(404, "Акт не найден");

  const sql = db();
  const [act] = await sql`
    select a.id, a.recipient_name, a.department, a.created_by, a.created_at,
           (select string_agg(l.name || ' × ' || l.qty, '; ' order by l.pos) from tmc_act_lines l where l.act_id = a.id) as lines
    from tmc_acts a where a.id = ${id}`;
  if (!act) return jsonError(404, "Акт уже удалён");
  const own = act.created_by === user.id && isSameAlmatyDay(new Date(act.created_at), new Date());
  if (!hasRole(user, "admin") && !own) return jsonError(403, "Удалить можно только свой акт в день создания");

  await sql`delete from tmc_acts where id = ${id}`;
  await audit(user, "delete", "tmc_act", id, { recipient_name: act.recipient_name, department: act.department, lines: act.lines }, null);
  return NextResponse.json({ ok: true });
}

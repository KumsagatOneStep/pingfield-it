import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateAct } from "@/lib/tmc/validate";
import { almatyToday } from "@/lib/tmc/date";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;

export async function GET(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const pat = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const rows = await db()`
    select a.id, a.act_date::text as act_date, a.org, a.recipient_name, a.recipient_position, a.department,
           a.giver_name, a.created_by, u.username as created_by_username, a.created_at,
           coalesce((select json_agg(json_build_object('pos', l.pos, 'name', l.name, 'qty', l.qty) order by l.pos)
                     from tmc_act_lines l where l.act_id = a.id), '[]'::json) as lines
    from tmc_acts a left join users u on u.id = a.created_by
    where ${q} = ''
       or a.recipient_name ilike ${pat}
       or exists (select 1 from tmc_act_lines l where l.act_id = a.id and l.name ilike ${pat})
    order by a.created_at desc, a.id desc
    limit ${LIST_LIMIT}`;
  return NextResponse.json({ acts: rows });
}

export async function POST(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const sql = db();
  const orgs = (await sql`select name from tmc_orgs`).map((r) => r.name as string);
  const v = validateAct(await readJson(req), orgs);
  if ("error" in v) return jsonError(400, v.error);
  const a = v.value;

  const [me] = await sql`select act_name, position from users where id = ${user.id}`;
  if (!me?.act_name || !me?.position) {
    return jsonError(400, "Попросите администратора заполнить ваши ФИО для актов и должность");
  }
  const lines = a.lines.map((l, i) => ({ pos: i + 1, name: l.name, inv: l.invNumber, sn: l.serialNumber, qty: l.qty }));
  // One statement: the act and its lines are inserted together or not at all.
  const [row] = await sql`
    with act as (
      insert into tmc_acts (act_date, org, recipient_name, recipient_position, department,
                            giver_name, giver_position, note, created_by)
      values (${almatyToday()}, ${a.org}, ${a.recipientName}, ${a.recipientPosition}, ${a.department},
              ${me.act_name}, ${me.position}, ${a.note}, ${user.id})
      returning id
    ), ins as (
      insert into tmc_act_lines (act_id, pos, name, inv_number, serial_number, qty)
      select act.id, l.pos, l.name, l.inv, l.sn, l.qty
      from act, jsonb_to_recordset(${JSON.stringify(lines)}::jsonb) as l(pos int, name text, inv text, sn text, qty int)
    )
    select id from act`;
  await audit(user, "create", "tmc_act", row.id, null, {
    recipient_name: a.recipientName,
    department: a.department,
    lines: a.lines.map((l) => `${l.name} × ${l.qty}`).join("; "),
  });
  return NextResponse.json({ act: { id: row.id } }, { status: 201 });
}

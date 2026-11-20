import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/auth";
import { buildActXlsx } from "@/lib/tmc/xlsx";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(404, "Акт не найден");

  const sql = db();
  const [a] = await sql`
    select act_date::text as act_date, org, recipient_name, recipient_position, department,
           giver_name, giver_position, note
    from tmc_acts where id = ${id}`;
  if (!a) return jsonError(404, "Акт не найден");
  const lines = await sql`
    select name, inv_number, serial_number, qty from tmc_act_lines where act_id = ${id} order by pos`;

  const buf = await buildActXlsx({
    actDate: a.act_date,
    org: a.org,
    recipientName: a.recipient_name,
    recipientPosition: a.recipient_position,
    department: a.department,
    giverName: a.giver_name,
    giverPosition: a.giver_position,
    note: a.note,
    lines: lines.map((l) => ({ name: l.name, invNumber: l.inv_number, serialNumber: l.serial_number, qty: l.qty })),
  });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="TMC.xlsx"; filename*=UTF-8''${encodeURIComponent("ТМЦ.xlsx")}`,
      "Cache-Control": "no-store",
    },
  });
}

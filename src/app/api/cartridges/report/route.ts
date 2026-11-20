import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/auth";
import { OBJECTS, CONTRACTOR } from "@/lib/cartridges/constants";
import { validatePeriod } from "@/lib/cartridges/validate";
import { objectReport, contractorReport, type ReportInputRow } from "@/lib/cartridges/report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const q = new URL(req.url).searchParams;
  const place = q.get("place") ?? "";
  if (place !== CONTRACTOR && !(OBJECTS as readonly string[]).includes(place)) return jsonError(400, "Выберите место");
  const p = validatePeriod(q.get("from"), q.get("to"));
  if ("error" in p) return jsonError(400, p.error);
  const { from, to } = p.value;

  const rows = (await db()`
    select m.from_place, m.to_place, l.model, l.qty, l.written_off
    from cartridge_move_lines l
    join cartridge_moves m on m.id = l.move_id
    where (m.from_place = ${place} or m.to_place = ${place})
      and (${from}::date is null or m.move_date >= ${from}::date)
      and (${to}::date is null or m.move_date <= ${to}::date)`) as ReportInputRow[];

  return place === CONTRACTOR
    ? NextResponse.json({ kind: "contractor", rows: contractorReport(rows) })
    : NextResponse.json({ kind: "object", rows: objectReport(place, rows) });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, hasRole, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateItemName } from "@/lib/tmc/validate";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const all = hasRole(user, "admin");
  const rows = await db()`
    select id, name, active, description, category, photo is not null as has_photo, photo_rev
    from tmc_items
    where ${all} or active
    order by name`;
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const b = (await readJson(req)) as { name?: unknown } | null;
  const v = validateItemName(b?.name);
  if ("error" in v) return jsonError(400, v.error);
  const rows = await db()`
    insert into tmc_items (name) values (${v.value})
    on conflict (name) do nothing
    returning id, name, active`;
  if (!rows[0]) {
    const [existing] = await db()`select active from tmc_items where name = ${v.value}`;
    return jsonError(409, existing && !existing.active
      ? "Это наименование скрыто администратором — попросите вернуть его в справочнике"
      : "Такое наименование уже есть");
  }
  await audit(user, "create", "tmc_item", rows[0].id, null, rows[0]);
  return NextResponse.json({ item: rows[0] }, { status: 201 });
}

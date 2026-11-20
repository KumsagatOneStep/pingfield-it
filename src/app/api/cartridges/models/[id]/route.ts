import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, hasRole, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateItemName } from "@/lib/tmc/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(404, "Модель не найдена");
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;

  const sql = db();
  const [before] = await sql`select id, name, active from cartridge_models where id = ${id}`;
  if (!before) return jsonError(404, "Модель не найдена");

  let name = before.name as string;
  if (b.name !== undefined) {
    const v = validateItemName(b.name);
    if ("error" in v) return jsonError(400, v.error);
    name = v.value;
  }
  let active = before.active as boolean;
  if (b.active !== undefined) {
    if (!hasRole(user, "admin")) return jsonError(403, "Скрывать модели может только администратор");
    if (typeof b.active !== "boolean") return jsonError(400, "Неверное значение «активно»");
    active = b.active;
  }
  if (name !== before.name) {
    const clash = await sql`select 1 from cartridge_models where name = ${name} and id <> ${id}`;
    if (clash[0]) return jsonError(409, "Такая модель уже есть");
  }
  const [row] = await sql`
    update cartridge_models set name = ${name}, active = ${active}
    where id = ${id}
    returning id, name, active`;
  await audit(user, "update", "cartridge_model", id, before, row);
  return NextResponse.json({ item: row });
}

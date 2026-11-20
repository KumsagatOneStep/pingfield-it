import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, hasRole, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateItemName } from "@/lib/tmc/validate";
import { validateCategory, validateDescription, validatePhoto } from "@/lib/tmc/catalog";

type Ctx = { params: Promise<{ id: string }> };

const COLS = "id, name, active, description, category, photo is not null as has_photo, photo_rev";

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(404, "Наименование не найдено");
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;

  const sql = db();
  const [before] = await sql.query(`select ${COLS} from tmc_items where id = $1`, [id]);
  if (!before) return jsonError(404, "Наименование не найдено");

  let name = before.name as string;
  if (b.name !== undefined) {
    const v = validateItemName(b.name);
    if ("error" in v) return jsonError(400, v.error);
    name = v.value;
  }
  let active = before.active as boolean;
  if (b.active !== undefined) {
    if (!hasRole(user, "admin")) return jsonError(403, "Скрывать наименования может только администратор");
    if (typeof b.active !== "boolean") return jsonError(400, "Неверное значение «активно»");
    active = b.active;
  }

  // Catalog card: section, description and photo are the admin's.
  const touchesCard = b.description !== undefined || b.category !== undefined || b.photo !== undefined;
  if (touchesCard && !hasRole(user, "admin")) return jsonError(403, "Фото и описание меняет только администратор");
  let description = before.description as string;
  if (b.description !== undefined) {
    const v = validateDescription(b.description);
    if ("error" in v) return jsonError(400, v.error);
    description = v.value;
  }
  let category = before.category as string;
  if (b.category !== undefined) {
    const v = validateCategory(b.category);
    if ("error" in v) return jsonError(400, v.error);
    category = v.value;
  }
  // photo: undefined = keep, null = remove, string = replace.
  let photo: { hex: string; type: string } | null | undefined;
  if (b.photo === null) photo = null;
  else if (b.photo !== undefined) {
    const v = validatePhoto(b.photo);
    if ("error" in v) return jsonError(400, v.error);
    photo = { hex: v.value.bytes.toString("hex"), type: v.value.type };
  }

  if (name !== before.name) {
    const clash = await sql`select 1 from tmc_items where name = ${name} and id <> ${id}`;
    if (clash[0]) return jsonError(409, "Такое наименование уже есть");
  }
  const [row] = photo === undefined
    ? await sql.query(
        `update tmc_items set name = $2, active = $3, description = $4, category = $5 where id = $1 returning ${COLS}`,
        [id, name, active, description, category])
    : await sql.query(
        `update tmc_items set name = $2, active = $3, description = $4, category = $5,
           photo = case when $6::text is null then null else decode($6, 'hex') end,
           photo_type = $7, photo_rev = photo_rev + 1
         where id = $1 returning ${COLS}`,
        [id, name, active, description, category, photo?.hex ?? null, photo?.type ?? null]);
  await audit(user, "update", "tmc_item", id, before, row);
  return NextResponse.json({ item: row });
}

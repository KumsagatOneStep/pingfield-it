import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateOrgName } from "@/lib/tmc/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Rename. Acts keep the name they were issued with: only new acts get the new one.
export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "admin");
  if (user instanceof NextResponse) return user;
  const id = await parseId(ctx);
  if (!id) return jsonError(404, "Организация не найдена");
  const b = (await readJson(req)) as { name?: unknown } | null;
  const v = validateOrgName(b?.name);
  if ("error" in v) return jsonError(400, v.error);

  const sql = db();
  const [before] = await sql`select id, name from tmc_orgs where id = ${id}`;
  if (!before) return jsonError(404, "Организация не найдена");
  if (before.name === v.value) return NextResponse.json({ org: before });
  const clash = await sql`select 1 from tmc_orgs where name = ${v.value} and id <> ${id}`;
  if (clash[0]) return jsonError(409, "Такая организация уже есть");
  const [row] = await sql`update tmc_orgs set name = ${v.value} where id = ${id} returning id, name`;
  if (!row) return jsonError(404, "Организация не найдена");
  await audit(user, "update", "tmc_org", id, before, row);
  return NextResponse.json({ org: row });
}

// Delete. Issued acts are unaffected (they store the name as text). The last one stays:
// without any organization no act could be issued. The count locks the rows (for update),
// so two admins deleting the last two at once wait for each other instead of both passing.
export async function DELETE(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "admin");
  if (user instanceof NextResponse) return user;
  const id = await parseId(ctx);
  if (!id) return jsonError(404, "Организация не найдена");
  const sql = db();
  const [row] = await sql`
    delete from tmc_orgs
    where id = ${id} and (select count(*) from (select 1 from tmc_orgs for update) locked) > 1
    returning id, name`;
  if (!row) {
    const [exists] = await sql`select 1 from tmc_orgs where id = ${id}`;
    return exists
      ? jsonError(409, "Нельзя удалить последнюю организацию: без неё акт не оформить")
      : jsonError(404, "Организация не найдена");
  }
  await audit(user, "delete", "tmc_org", id, row, null);
  return NextResponse.json({ ok: true });
}

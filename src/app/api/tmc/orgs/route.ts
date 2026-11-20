import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateOrgName } from "@/lib/tmc/validate";

export const dynamic = "force-dynamic";

// Organizations for TMC acts: editors read the list for the form, only the admin changes it.
export async function GET(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const rows = await db()`select id, name from tmc_orgs order by name`;
  return NextResponse.json({ orgs: rows });
}

export async function POST(req: Request) {
  const user = await requireApiUser(req, "admin");
  if (user instanceof NextResponse) return user;
  const b = (await readJson(req)) as { name?: unknown } | null;
  const v = validateOrgName(b?.name);
  if ("error" in v) return jsonError(400, v.error);
  const [row] = await db()`
    insert into tmc_orgs (name) values (${v.value})
    on conflict (name) do nothing
    returning id, name`;
  if (!row) return jsonError(409, "Такая организация уже есть");
  await audit(user, "create", "tmc_org", row.id, null, row);
  return NextResponse.json({ org: row }, { status: 201 });
}

import { NextResponse } from "next/server";
import { audit, hasRole, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateArticle } from "@/lib/helper/validate";
import { auditSnapshot, getArticle, setArchived, updateArticle } from "@/lib/helper/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const NOT_FOUND = "Запись не найдена";

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "viewer");
  if (user instanceof NextResponse) return user;
  const a = await getArticle(Number((await ctx.params).id), hasRole(user, "admin"));
  return a ? NextResponse.json(a) : jsonError(404, NOT_FOUND);
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  const body = await readJson(req);
  const v = validateArticle(body);
  if ("error" in v) return jsonError(400, v.error);
  const expected = (body as { updatedAt?: unknown }).updatedAt;
  if (typeof expected !== "string" || !expected) return jsonError(400, "Нет отметки версии записи, обновите страницу");
  const before = await getArticle(id, false);
  if (!before) return jsonError(404, NOT_FOUND);
  const r = await updateArticle(user, id, v.value, expected);
  if (!r) return jsonError(404, NOT_FOUND);
  if ("error" in r) return jsonError(400, r.error);
  if ("conflict" in r) return jsonError(409, `Запись уже изменил ${r.conflict}, обновите страницу`);
  await audit(user, "update", "kb_article", id, auditSnapshot(before), auditSnapshot(v.value));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "admin");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  const body = (await readJson(req)) as { archived?: unknown } | null;
  if (typeof body?.archived !== "boolean") return jsonError(400, "Укажите archived: true или false");
  const r = await setArchived(id, body.archived);
  if (!r) return jsonError(404, NOT_FOUND);
  if (body.archived) await audit(user, "delete", "kb_article", id, { title: r.title, archived: false }, null);
  else await audit(user, "update", "kb_article", id, { title: r.title, archived: true }, { title: r.title, archived: false });
  return NextResponse.json({ ok: true });
}

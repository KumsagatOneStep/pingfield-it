import { NextResponse } from "next/server";
import { audit, hasRole, jsonError, readJson, requireApiUser } from "@/lib/auth";
import { validateArticle } from "@/lib/helper/validate";
import { auditSnapshot, createArticle, listArticles, listTags } from "@/lib/helper/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireApiUser(req, "viewer");
  if (user instanceof NextResponse) return user;
  const q = new URL(req.url).searchParams;
  const articles = await listArticles({
    q: (q.get("q") ?? "").slice(0, 200),
    tag: (q.get("tag") ?? "").trim(),
    includeArchived: q.get("archived") === "1" && hasRole(user, "admin"),
  });
  return NextResponse.json({ articles, tags: await listTags() });
}

export async function POST(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const v = validateArticle(await readJson(req));
  if ("error" in v) return jsonError(400, v.error);
  const r = await createArticle(user, v.value);
  if ("error" in r) return jsonError(400, r.error);
  await audit(user, "create", "kb_article", r.id, null, auditSnapshot(v.value));
  return NextResponse.json({ id: r.id }, { status: 201 });
}

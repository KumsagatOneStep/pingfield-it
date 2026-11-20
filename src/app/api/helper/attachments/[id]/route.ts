import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth";
import { ATTACHMENT_CSP } from "@/lib/helper/csp";
import { getAttachment } from "@/lib/helper/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "viewer");
  if (user instanceof NextResponse) return user;
  const a = await getAttachment(Number((await ctx.params).id), user);
  if (!a) return jsonError(404, "Вложение не найдено");
  const headers: Record<string, string> = {
    "Content-Type": a.meta.mime,
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": ATTACHMENT_CSP,
  };
  if (a.meta.kind === "file") headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(a.meta.filename)}`;
  return new Response(new Uint8Array(a.bytes), { headers });
}

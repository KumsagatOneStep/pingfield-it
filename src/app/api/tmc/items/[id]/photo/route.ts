import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Catalog photo. The page adds ?v=<photo_rev>, so a changed photo gets a new URL
// and the old one can stay cached in the browser.
export async function GET(req: Request, ctx: Ctx) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(404, "Фото не найдено");
  const [row] = await db()`
    select encode(photo, 'base64') as b64, photo_type from tmc_items where id = ${id} and photo is not null`;
  if (!row) return jsonError(404, "Фото не найдено");
  return new Response(new Uint8Array(Buffer.from(row.b64 as string, "base64")), {
    headers: {
      "Content-Type": row.photo_type as string,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

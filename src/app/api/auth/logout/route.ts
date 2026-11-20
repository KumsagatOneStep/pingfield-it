import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endSession, getCurrentUser, jsonError, sameOrigin } from "@/lib/auth";
import { isDemoUsername } from "@/lib/demo/accounts";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Запрос отклонён");
  // Deleting the cookie is not enough: a copied token would stay valid until it expires.
  // Bumping session_version invalidates every token issued to this user, on all devices.
  const user = await getCurrentUser();
  // Demo accounts are shared by every visitor: signing out must not sign out everyone else.
  if (user && !isDemoUsername(user.username)) await db()`update users set session_version = session_version + 1 where id = ${user.id}`;
  await endSession();
  return NextResponse.json({ ok: true });
}

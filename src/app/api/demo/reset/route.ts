import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { resetDemo } from "@/lib/demo/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called by Vercel Cron (vercel.json) with "Authorization: Bearer <CRON_SECRET>".
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  return NextResponse.json(await resetDemo(db()));
}

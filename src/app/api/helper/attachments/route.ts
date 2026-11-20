import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth";
import { MAX_FILE_BYTES, MAX_IMAGE_BYTES } from "@/lib/helper/constants";
import { sniffFileType } from "@/lib/helper/files";
import { insertAttachment, purgeOldDrafts } from "@/lib/helper/store";

export const dynamic = "force-dynamic";

const TOO_BIG_FILE = "Файл слишком большой (максимум 1 МБ)";
const NO_SPACE = "В демо-версии место для файлов закончилось, оно освободится после ночного сброса";
const TOO_BIG_IMAGE = "Картинка слишком большая (максимум 400 КБ)";

// Raw body upload (not base64 JSON): files stay well under Vercel's 4.5 MB request limit.
export async function POST(req: Request) {
  const user = await requireApiUser(req, "editor");
  if (user instanceof NextResponse) return user;
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind");
  if (kind !== "image" && kind !== "file") return jsonError(400, "Неизвестный вид вложения");
  const name = (q.get("name") ?? "").replace(/[\\/\0\r\n]/g, "_").trim().slice(0, 200) || (kind === "image" ? "скриншот" : "файл");
  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  const tooBig = kind === "image" ? TOO_BIG_IMAGE : TOO_BIG_FILE;
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > limit) return jsonError(400, tooBig);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0) return jsonError(400, "Пустой файл");
  if (bytes.length > limit) return jsonError(400, tooBig);
  const type = sniffFileType(bytes, name);
  if (kind === "image" && type?.kind !== "image") return jsonError(400, "Это не похоже на картинку. Подойдут JPG, PNG или WebP.");
  if (kind === "file" && !type) return jsonError(400, "Такой тип файла не поддерживается. Подойдут PDF, DOCX, XLSX, TXT, ZIP");
  await purgeOldDrafts();
  const meta = await insertAttachment(user.id, kind, name, type!.mime, bytes);
  if (!meta) return jsonError(400, NO_SPACE);
  return NextResponse.json(meta);
}

// Client-side: shrink pasted screenshots and upload attachments as raw bytes.
import type { AttachmentMeta } from "@/lib/helper/store";
import { MAX_IMAGE_BYTES } from "@/lib/helper/constants";

export const SESSION_EXPIRED =
  "Сессия истекла. Откройте сайт в новой вкладке, войдите и вернитесь сюда — затем повторите. Введённый текст не пропал.";

const MAX_SIDE = 1600;
const QUALITIES = [0.85, 0.7, 0.55];

export async function shrinkScreenshot(file: Blob): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Не удалось открыть картинку. Подойдут JPG, PNG или WebP.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не смог обработать картинку");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const encode = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  // Safari cannot encode WebP and silently returns PNG; fall back to JPEG there.
  const probe = await encode("image/webp", QUALITIES[0]);
  const type = probe?.type === "image/webp" ? "image/webp" : "image/jpeg";
  for (const q of QUALITIES) {
    const blob = type === "image/webp" && q === QUALITIES[0] ? probe : await encode(type, q);
    if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
  }
  throw new Error("Скриншот слишком большой даже после сжатия. Обрежьте его и вставьте снова.");
}

export async function uploadAttachment(kind: "image" | "file", blob: Blob, name: string): Promise<AttachmentMeta> {
  const res = await fetch(`/api/helper/attachments?kind=${kind}&name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (res.status === 401) throw new Error(SESSION_EXPIRED);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Не удалось загрузить файл");
  return data as AttachmentMeta;
}

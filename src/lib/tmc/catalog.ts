// Catalog of TMC items: sections, photo checks and adding picked items to act lines.
// Used by both the act form (client) and the item API (server).

export const CATALOG_CATEGORIES = [
  "Периферия",
  "Кабели",
  "Сеть",
  "Переходники и хабы",
  "Питание",
  "Комплектующие ПК",
  "Сумки",
  "Прочее",
] as const;

// After resizing in the browser a photo is ~50–150 KB; this is a hard upper bound.
export const MAX_PHOTO_BYTES = 400 * 1024;
export const MAX_DESCRIPTION = 400;
const MAX_QTY = 9999;

type Result<T> = { value: T } | { error: string };

export function sniffImageType(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

// Accepts plain base64 or a data: URL. Server-only (uses Buffer).
export function validatePhoto(v: unknown): Result<{ bytes: Buffer; type: string }> {
  if (typeof v !== "string" || v.trim() === "") return { error: "Фото не передано" };
  const b64 = v.replace(/^data:[^,]*,/, "");
  if (b64.length > Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 4) return { error: "Фото слишком большое (максимум 400 КБ)" };
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length > MAX_PHOTO_BYTES) return { error: "Фото слишком большое (максимум 400 КБ)" };
  const type = sniffImageType(bytes);
  if (!type) return { error: "Это не похоже на фото. Подойдут JPG, PNG или WebP." };
  return { value: { bytes, type } };
}

export function validateCategory(v: unknown): Result<string> {
  if (v === undefined || v === null || v === "") return { value: "" };
  if (typeof v === "string" && (CATALOG_CATEGORIES as readonly string[]).includes(v)) return { value: v };
  return { error: "Неизвестный раздел каталога" };
}

export function validateDescription(v: unknown): Result<string> {
  if (v === undefined || v === null) return { value: "" };
  if (typeof v !== "string") return { error: "Описание заполнено неверно" };
  const t = v.trim();
  if (t.length > MAX_DESCRIPTION) return { error: `Описание слишком длинное (максимум ${MAX_DESCRIPTION} символов)` };
  return { value: t };
}

type LineLike = { key: number; name: string; qty: string };

// Puts the items picked in the catalog into the act: same name adds to its quantity,
// empty lines are filled first, the rest are appended. Nothing changes if the limit would be exceeded.
export function addPicksToLines<L extends LineLike>(
  lines: L[],
  picks: { name: string; qty: number }[],
  maxLines: number,
  makeLine: (name: string, qty: number) => L,
): { lines: L[] } | { error: string } {
  const out = lines.map((l) => ({ ...l }));
  for (const p of picks) {
    const same = out.find((l) => l.name.trim() === p.name);
    if (same) {
      const cur = Number(same.qty) || 0;
      same.qty = String(Math.min(MAX_QTY, cur + p.qty));
      continue;
    }
    const empty = out.find((l) => l.name.trim() === "");
    if (empty) {
      empty.name = p.name;
      empty.qty = String(Math.min(MAX_QTY, p.qty));
      continue;
    }
    if (out.length >= maxLines) return { error: `В акте не больше ${maxLines} позиций. Уберите лишнее из выбора.` };
    out.push(makeLine(p.name, Math.min(MAX_QTY, p.qty)));
  }
  return { lines: out };
}

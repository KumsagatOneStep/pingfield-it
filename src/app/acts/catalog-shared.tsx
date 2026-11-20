"use client";

export type TmcItem = {
  id: number;
  name: string;
  active: boolean;
  description: string;
  category: string;
  has_photo: boolean;
  photo_rev: number;
};

export const photoUrl = (it: TmcItem) => `/api/tmc/items/${it.id}/photo?v=${it.photo_rev}`;

export function ItemPhoto({ item, className }: { item: TmcItem; className?: string }) {
  return (
    <div className={`cat-photo ${className ?? ""}`}>
      {item.has_photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photoUrl(item)} alt="" loading="lazy" decoding="async" />
        : <span className="cat-nophoto" aria-hidden="true">📦</span>}
    </div>
  );
}

const MAX_SIDE = 600;

// Shrinks a picked file to at most 600 px and re-encodes it as JPEG, so the
// photo stored in the database stays around 50–150 KB. Returns base64 without the data: prefix.
export async function shrinkPhoto(file: File): Promise<string> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Не удалось открыть файл как картинку. Подойдут JPG, PNG или WebP.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не смог обработать фото");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background, like a shop photo
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Браузер не смог обработать фото");
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

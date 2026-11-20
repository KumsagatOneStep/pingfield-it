// Attachment type checks by content, and URL checks for rendered Markdown.

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));
const ext = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

const ZIP_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

export function sniffFileType(b: Uint8Array, filename: string): { mime: string; kind: "image" | "file" } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", kind: "image" };
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return { mime: "image/png", kind: "image" };
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { mime: "image/webp", kind: "image" };
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return { mime: "application/pdf", kind: "file" };
  const e = ext(filename);
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) {
    return ZIP_TYPES[e] ? { mime: ZIP_TYPES[e], kind: "file" } : null;
  }
  if (e === "txt" && !b.subarray(0, 4096).includes(0)) return { mime: "text/plain; charset=utf-8", kind: "file" };
  return null;
}

export function isSafeImageSrc(src: string): boolean {
  return /^\/api\/helper\/attachments\/\d+$/.test(src);
}

export function isSafeHref(href: string): boolean {
  const h = href.trim();
  if (h.startsWith("/")) return !h.startsWith("//");
  return /^(https?:|mailto:)/i.test(h);
}

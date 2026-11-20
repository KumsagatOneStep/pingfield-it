// Pure checks used by the article form in the browser.
import { MAX_FILE_BYTES } from "./constants.ts";

const FILE_EXT = /\.(pdf|docx|xlsx|txt|zip)$/i;

/** Screenshot to upload on paste. Excel/Word put text and a bitmap together — then keep the text. */
export function pickPastedImage<T extends { type: string }>(files: T[], plainText: string): T | null {
  if (plainText.trim() !== "") return null;
  return files.find((f) => f.type.startsWith("image/")) ?? null;
}

/** Error text, or null when the file may be uploaded. Server re-checks by content. */
export function checkFileBeforeUpload(name: string, size: number): string | null {
  if (!FILE_EXT.test(name)) return "Такой тип файла не поддерживается. Подойдут PDF, DOCX, XLSX, TXT, ZIP";
  if (size === 0) return "Пустой файл";
  if (size > MAX_FILE_BYTES) return "Файл слишком большой (максимум 1 МБ)";
  return null;
}

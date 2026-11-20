import { IP_EXAMPLE } from "./subnet.ts";
export type PrinterInput = {
  ip: string;
  owner: string;
  room: string;
  model: string;
  note: string;
};

export const ROLES = ["viewer", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function parseIp(s: string): string | null {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return parts.join(".");
}

function str(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > max ? null : t;
}

export function validatePrinter(body: unknown): { value: PrinterInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Пустой запрос" };
  const b = body as Record<string, unknown>;
  const ipRaw = str(b.ip, 15);
  const owner = str(b.owner, 120);
  const room = str(b.room, 120);
  const model = str(b.model, 120);
  const note = str(b.note, 1000);
  if (ipRaw === null) return { error: `IP-адрес записан неверно. Пример: ${IP_EXAMPLE}` };
  if (owner === null || room === null || model === null) return { error: "Поле слишком длинное (максимум 120 символов)" };
  if (note === null) return { error: "Примечание слишком длинное (максимум 1000 символов)" };
  if (!owner) return { error: "Укажите владельца: отдел или сотрудника." };
  let ip = "";
  if (ipRaw) {
    const p = parseIp(ipRaw);
    if (!p) return { error: `IP-адрес записан неверно. Пример: ${IP_EXAMPLE}` };
    ip = p;
  }
  return { value: { ip, owner, room, model, note } };
}

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 12;

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string") return "Введите пароль";
  if (pw.length < MIN_PASSWORD) return `Пароль должен быть не короче ${MIN_PASSWORD} символов`;
  if (pw.length > 128) return "Пароль слишком длинный";
  return null;
}

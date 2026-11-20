import { DEPARTMENTS } from "./constants.ts";

export type ActLineInput = { name: string; invNumber: string; serialNumber: string; qty: number };
export type ActInput = {
  org: string;
  recipientName: string;
  recipientPosition: string;
  department: string;
  note: string;
  lines: ActLineInput[];
};

export const MAX_LINES = 20;

// Trimmed string, "" for missing, null for wrong type or too long.
function str(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > max ? null : t;
}

// Puts dots on initials: "Петров ПС", "Петров П С", "Петров П.С" → "Петров П. С.".
// Two capitals in the first word without dots are left alone: it can be a surname (ЛИ).
export function formatPersonName(raw: string): string {
  return raw.trim().split(/\s+/).map((word, i) => {
    const letters = word.replace(/\./g, "");
    if (/^\p{L}$/u.test(letters)) return `${letters.toUpperCase()}.`;
    if ((i > 0 || word.includes(".")) && /^\p{Lu}{2}$/u.test(letters)) return `${letters[0]}. ${letters[1]}.`;
    return word;
  }).join(" ");
}

function validateLine(v: unknown): { value: ActLineInput } | { error: string } {
  if (!v || typeof v !== "object") return { error: "Позиция заполнена неверно" };
  const l = v as Record<string, unknown>;
  const name = str(l.name, 300);
  const invNumber = str(l.invNumber, 60);
  const serialNumber = str(l.serialNumber, 60);
  if (name === null) return { error: "Наименование слишком длинное (максимум 300 символов)" };
  if (!name) return { error: "Выберите наименование" };
  if (invNumber === null || serialNumber === null) return { error: "Инвентарный и заводской номер — не длиннее 60 символов" };
  const qty = l.qty;
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 9999) {
    return { error: "Количество — целое число от 1 до 9999" };
  }
  return { value: { name, invNumber, serialNumber, qty } };
}

export const MAX_ORG_NAME = 120;

// `orgs` is the current list from tmc_orgs: an act may only name one of them.
export function validateAct(body: unknown, orgs: readonly string[]): { value: ActInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Пустой запрос" };
  const b = body as Record<string, unknown>;
  const org = str(b.org, MAX_ORG_NAME);
  const department = str(b.department, 200);
  const recipientName = str(b.recipientName, 120);
  const recipientPosition = str(b.recipientPosition, 120);
  const note = str(b.note, 1000);
  if (!org || !orgs.includes(org)) return { error: "Выберите организацию" };
  if (recipientName === null) return { error: "ФИО получателя слишком длинное (максимум 120 символов)" };
  if (!recipientName) return { error: "Укажите ФИО получателя" };
  if (recipientPosition === null) return { error: "Должность слишком длинная (максимум 120 символов)" };
  if (!recipientPosition) return { error: "Укажите должность получателя" };
  if (!department || !DEPARTMENTS.includes(department)) return { error: "Выберите подразделение" };
  if (note === null) return { error: "Примечание слишком длинное (максимум 1000 символов)" };
  if (!Array.isArray(b.lines) || b.lines.length === 0) return { error: "Добавьте хотя бы одну позицию" };
  if (b.lines.length > MAX_LINES) return { error: `Не больше ${MAX_LINES} позиций в акте` };
  const lines: ActLineInput[] = [];
  for (const raw of b.lines) {
    const r = validateLine(raw);
    if ("error" in r) return r;
    lines.push(r.value);
  }
  return { value: { org, recipientName: formatPersonName(recipientName), recipientPosition, department, note, lines } };
}

export function validateItemName(v: unknown): { value: string } | { error: string } {
  const name = str(v, 300);
  if (name === null) return { error: "Наименование слишком длинное (максимум 300 символов)" };
  if (!name) return { error: "Введите наименование" };
  return { value: name };
}

// Organization name as printed in the act: trimmed, inner runs of spaces collapsed.
export function validateOrgName(v: unknown): { value: string } | { error: string } {
  const raw = str(v, MAX_ORG_NAME * 2);
  const name = raw === null ? null : raw.replace(/\s+/g, " ");
  if (name === null || name.length > MAX_ORG_NAME) return { error: `Название слишком длинное (максимум ${MAX_ORG_NAME} символов)` };
  if (!name) return { error: "Введите название организации" };
  return { value: name };
}

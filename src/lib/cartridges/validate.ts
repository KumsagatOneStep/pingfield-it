import { HUB, MAX_MOVE_LINES, PLACES, CONTRACTOR } from "./constants.ts";

export type MoveLine = { model: string; qty: number; writtenOff: number };
export type MoveInput = { moveDate: string; fromPlace: string; toPlace: string; note: string; lines: MoveLine[] };

const MAX_QTY = 9999;
const isQty = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_QTY;

function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function validateLine(v: unknown, fromContractor: boolean): { value: MoveLine } | { error: string } {
  if (!v || typeof v !== "object") return { error: "Строка заполнена неверно" };
  const l = v as Record<string, unknown>;
  const model = typeof l.model === "string" ? l.model.trim() : "";
  if (!model) return { error: "Укажите модель картриджа" };
  if (model.length > 300) return { error: "Название модели слишком длинное (максимум 300 символов)" };
  const writtenOff = l.writtenOff ?? 0;
  if (!isQty(l.qty) || !isQty(writtenOff)) return { error: "Количество — целое число от 0 до 9999" };
  if (writtenOff > 0 && !fromContractor) return { error: "Списать можно только при возврате от подрядчика" };
  if (l.qty + writtenOff < 1) return { error: `Укажите количество для модели ${model}` };
  return { value: { model, qty: l.qty, writtenOff } };
}

export function validateMove(body: unknown, today: string): { value: MoveInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Пустой запрос" };
  const b = body as Record<string, unknown>;
  if (!isIsoDate(b.moveDate)) return { error: "Укажите дату" };
  if (b.moveDate > today) return { error: "Дата не может быть в будущем" };
  const { fromPlace, toPlace } = b;
  if (typeof fromPlace !== "string" || !PLACES.includes(fromPlace)) return { error: "Выберите, откуда" };
  if (typeof toPlace !== "string" || !PLACES.includes(toPlace)) return { error: "Выберите, куда" };
  if (fromPlace === toPlace) return { error: "«Откуда» и «Куда» должны отличаться" };
  if (fromPlace !== HUB && toPlace !== HUB) return { error: `Одно из мест должно быть «${HUB}»` };
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > 1000) return { error: "Примечание слишком длинное (максимум 1000 символов)" };
  if (!Array.isArray(b.lines) || b.lines.length === 0) return { error: "Добавьте хотя бы одну модель" };
  if (b.lines.length > MAX_MOVE_LINES) return { error: `Не больше ${MAX_MOVE_LINES} моделей в записи` };

  const lines: MoveLine[] = [];
  const seen = new Set<string>();
  for (const raw of b.lines) {
    const r = validateLine(raw, fromPlace === CONTRACTOR);
    if ("error" in r) return r;
    if (seen.has(r.value.model)) return { error: `Модель ${r.value.model} указана дважды` };
    seen.add(r.value.model);
    lines.push(r.value);
  }
  return { value: { moveDate: b.moveDate, fromPlace, toPlace, note, lines } };
}

export function validatePeriod(from: unknown, to: unknown): { value: { from: string | null; to: string | null } } | { error: string } {
  const f = from === undefined || from === null || from === "" ? null : from;
  const t = to === undefined || to === null || to === "" ? null : to;
  if ((f !== null && !isIsoDate(f)) || (t !== null && !isIsoDate(t))) return { error: "Неверная дата периода" };
  if (f !== null && t !== null && f > t) return { error: "Дата «С» позже даты «По»" };
  return { value: { from: f as string | null, to: t as string | null } };
}

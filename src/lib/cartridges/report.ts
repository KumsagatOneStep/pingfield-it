import { HUB, CONTRACTOR } from "./constants.ts";

export type ReportInputRow = { from_place: string; to_place: string; model: string; qty: number; written_off: number };
export type ContractorRow = { model: string; sent: number; returned: number; writtenOff: number; remaining: number };
export type ObjectRow = { model: string; received: number; returned: number; waiting: number };

function totalsByModel<T>(blank: () => T, entries: [string, (t: T) => void][]): (T & { model: string })[] {
  const byModel = new Map<string, T>();
  for (const [model, add] of entries) {
    if (!byModel.has(model)) byModel.set(model, blank());
    add(byModel.get(model) as T);
  }
  return [...byModel.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([model, t]) => ({ model, ...t }));
}

export function contractorReport(rows: ReportInputRow[]): ContractorRow[] {
  const entries: [string, (t: Omit<ContractorRow, "model" | "remaining">) => void][] = [];
  for (const r of rows) {
    if (r.from_place === HUB && r.to_place === CONTRACTOR) entries.push([r.model, (t) => { t.sent += r.qty; }]);
    if (r.from_place === CONTRACTOR && r.to_place === HUB) {
      entries.push([r.model, (t) => { t.returned += r.qty; t.writtenOff += r.written_off; }]);
    }
  }
  return totalsByModel(() => ({ sent: 0, returned: 0, writtenOff: 0 }), entries)
    .map((t) => ({ ...t, remaining: t.sent - t.returned - t.writtenOff }));
}

export function objectReport(place: string, rows: ReportInputRow[]): ObjectRow[] {
  const entries: [string, (t: Omit<ObjectRow, "model" | "waiting">) => void][] = [];
  for (const r of rows) {
    if (r.from_place === place && r.to_place === HUB) entries.push([r.model, (t) => { t.received += r.qty; }]);
    if (r.from_place === HUB && r.to_place === place) entries.push([r.model, (t) => { t.returned += r.qty; }]);
  }
  return totalsByModel(() => ({ received: 0, returned: 0 }), entries)
    .map((t) => ({ ...t, waiting: t.received - t.returned }));
}

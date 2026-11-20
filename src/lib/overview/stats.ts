// Numbers for the "Обзор" dashboard tiles. Pure: tested in tests/overview-stats.test.ts.
import { OBJECTS } from "../cartridges/constants.ts";
import { objectReport, contractorReport, type ReportInputRow } from "../cartridges/report.ts";

import { SUBNET_PREFIX as PREFIX } from "../subnet.ts";

export type Cell = { n: number; state: "free" | "busy" | "dup"; owners: string[] };
export type SubnetStats = { cells: Cell[]; busy: number; free: number; dup: number; outside: number; firstFree: string | null };

export function subnetStats(printers: { ip: string; owner: string }[]): SubnetStats {
  const owners = new Map<number, string[]>();
  let outside = 0;
  for (const p of printers) {
    const ip = p.ip.trim();
    const last = ip.startsWith(PREFIX) ? Number(ip.slice(PREFIX.length)) : NaN;
    if (!Number.isInteger(last) || last < 1 || last > 254) {
      outside++;
      continue;
    }
    owners.set(last, [...(owners.get(last) ?? []), p.owner]);
  }
  const cells: Cell[] = Array.from({ length: 254 }, (_, i) => {
    const o = owners.get(i + 1) ?? [];
    return { n: i + 1, state: o.length === 0 ? "free" : o.length > 1 ? "dup" : "busy", owners: o };
  });
  const busy = cells.filter((c) => c.state !== "free").length;
  const first = cells.find((c) => c.state === "free");
  return {
    cells,
    busy,
    free: 254 - busy,
    dup: cells.filter((c) => c.state === "dup").length,
    outside,
    firstFree: first ? PREFIX + first.n : null,
  };
}

/** Counts per day, oldest → newest, for the `days` days ending at `today` (YYYY-MM-DD). */
export function dailyCounts(dates: string[], today: string, days: number): number[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  const out = new Array<number>(days).fill(0);
  for (const d of dates) {
    const ago = Math.round((end - Date.parse(`${d}T00:00:00Z`)) / 86400000);
    if (ago >= 0 && ago < days) out[days - 1 - ago]++;
  }
  return out;
}

export function greeting(now: Date): string {
  const h = Number(now.toLocaleString("en-GB", { timeZone: "Asia/Almaty", hour: "2-digit", hour12: false }));
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 18) return "Добрый день";
  if (h >= 18 && h < 23) return "Добрый вечер";
  return "Доброй ночи";
}

export type CartridgeSummary = {
  inContractor: number;
  waiting: { place: string; count: number }[];
  topModels: { model: string; remaining: number }[];
};

export function cartridgeSummary(rows: ReportInputRow[]): CartridgeSummary {
  const contractor = contractorReport(rows);
  return {
    inContractor: contractor.reduce((s, r) => s + r.remaining, 0),
    waiting: OBJECTS.map((place) => ({
      place,
      count: objectReport(place, rows).reduce((s, r) => s + r.waiting, 0),
    })),
    topModels: contractor
      .filter((r) => r.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 4)
      .map((r) => ({ model: r.model, remaining: r.remaining })),
  };
}

/** "5 мин" ago from a Postgres timestamptz text. `nowMs` comes from the server so SSR and hydration match. */
export function timeAgo(pgText: string, nowMs: number): string {
  const t = Date.parse(pgText.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  const min = Math.max(0, Math.floor((nowMs - t) / 60000));
  if (min < 1) return "сейчас";
  if (min < 60) return `${min} мин`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} ч`;
  return `${Math.floor(min / 1440)} дн`;
}

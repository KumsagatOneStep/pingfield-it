import "server-only";
import { db } from "@/lib/db";
import { hasRole, type SessionUser } from "@/lib/auth";
import { auditSubject, auditVerb } from "@/lib/audit-subject";
import { almatyToday } from "@/lib/tmc/date";
import type { ReportInputRow } from "@/lib/cartridges/report";
import { cartridgeSummary, dailyCounts, greeting, subnetStats, type CartridgeSummary, type SubnetStats } from "./stats";

export type OverviewData = {
  name: string;
  greeting: string;
  today: string;
  /** Server time (ms) for "N мин назад": the browser must not use its own clock during hydration. */
  now: number;
  subnet: SubnetStats;
  printersTotal: number;
  helper: { total: number; latest: { id: number; title: string }[] };
  // editor/admin only:
  cartridges: CartridgeSummary | null;
  acts: { month: number; daily: number[] } | null;
  activity: { id: number; who: string; text: string; entity: string; at: string }[] | null;
};

export async function loadOverview(user: SessionUser): Promise<OverviewData> {
  const sql = db();
  const editor = hasRole(user, "editor");
  const today = almatyToday();
  const [printers, helperCount, helperLatest] = await Promise.all([
    sql`select ip, owner from printers`,
    sql`select count(*)::int as n from kb_articles where not archived`,
    sql`select id, title from kb_articles where not archived order by updated_at desc limit 4`,
  ]);
  let cartridges: OverviewData["cartridges"] = null;
  let acts: OverviewData["acts"] = null;
  let activity: OverviewData["activity"] = null;
  if (editor) {
    const [moves, actDays, audit] = await Promise.all([
      sql`select m.from_place, m.to_place, l.model, l.qty, l.written_off
          from cartridge_move_lines l join cartridge_moves m on m.id = l.move_id`,
      sql`select ((created_at at time zone 'Asia/Almaty')::date)::text as d from tmc_acts
          where created_at > now() - interval '40 days'`,
      sql`select id, username, action, entity, before, after, at::text as at from audit_log order by at desc limit 6`,
    ]);
    cartridges = cartridgeSummary(moves as ReportInputRow[]);
    const dates = actDays.map((r) => r.d as string);
    acts = { month: dates.filter((d) => d.slice(0, 7) === today.slice(0, 7)).length, daily: dailyCounts(dates, today, 30) };
    activity = audit.map((r) => ({
      id: Number(r.id),
      who: r.username as string,
      text: `${auditVerb(r.entity, r.action)} ${auditSubject(r.entity, r.after ?? r.before)}`,
      entity: r.entity as string,
      at: r.at as string,
    }));
  }
  return {
    name: user.fullName || user.username,
    greeting: greeting(new Date()),
    today,
    now: Date.now(),
    subnet: subnetStats(printers as { ip: string; owner: string }[]),
    printersTotal: printers.length,
    helper: { total: helperCount[0].n, latest: helperLatest as { id: number; title: string }[] },
    cartridges,
    acts,
    activity,
  };
}

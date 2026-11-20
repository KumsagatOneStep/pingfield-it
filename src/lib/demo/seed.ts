// Wipes the database and loads the demo data. Used by the nightly cron route and `npm run db:demo-reset` (scripts/demo-reset.mts).
// Relative .ts imports so that plain node (scripts/demo-reset.mts, scripts/e2e-demo.mjs) can load it too.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { NeonQueryFunction, NeonQueryPromise } from "@neondatabase/serverless";
import { SEED_ITEMS, SEED_ORGS } from "../tmc/constants.ts";
import { sniffImageType } from "../tmc/catalog.ts";
import { searchFields } from "../helper/search.ts";
import { DEMO_ACCOUNTS } from "./accounts.ts";
import { ACTS, ARTICLES, CARTRIDGE_MODELS, MOVES, VIEWER } from "./fixtures.ts";

type Sql = NeonQueryFunction<false, false>;
type PrinterRow = { ip: string; owner: string; room: string; model: string; note: string };
type CatalogEntry = { category: string; photo: string; description: string };

export type ResetSummary = { printers: number; users: number; audit: number; moves: number; acts: number; articles: number };

const TABLES = [
  "kb_attachments", "kb_articles", "cartridge_move_lines", "cartridge_moves", "cartridge_models",
  "tmc_act_lines", "tmc_acts", "tmc_orgs", "tmc_items", "audit_log", "login_failures", "printers", "users",
];

const root = () => process.cwd();
const DAY = 24 * 60 * 60 * 1000;
/** A moment `days` ago, shifted by `minutes` so events of one day do not collide. */
const ago = (days: number, minutes = 0) => new Date(Date.now() - days * DAY - minutes * 60_000).toISOString();
/** Calendar date in Almaty (UTC+5) `days` ago. */
const dateAgo = (days: number) => new Date(Date.now() - days * DAY + 5 * 3600_000).toISOString().slice(0, 10);

export async function resetDemo(sql: Sql): Promise<ResetSummary> {
  const schema = readFileSync(join(root(), "sql/schema.sql"), "utf8");
  for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) await sql.query(stmt);

  const printers = JSON.parse(readFileSync(join(root(), "scripts/seed-data.json"), "utf8")) as PrinterRow[];
  const catalog = JSON.parse(readFileSync(join(root(), "data/catalog/catalog.json"), "utf8")) as Record<string, CatalogEntry>;
  const users = [
    ...DEMO_ACCOUNTS.map((a) => ({ ...a, hash: bcrypt.hashSync(a.password, 10) })),
    { ...VIEWER, role: "viewer", hash: bcrypt.hashSync(randomBytes(18).toString("base64"), 10) },
  ];
  const userName = (id: number) => users[id - 1].username;

  const q: NeonQueryPromise<false, false>[] = [sql.query(`truncate ${TABLES.join(", ")} restart identity cascade`)];

  // Users get ids 1..3 in this order (identity restarted above).
  for (const u of users) {
    q.push(sql`insert into users (username, full_name, act_name, position, password_hash, role, must_change_password, created_at)
               values (${u.username}, ${u.fullName}, ${u.actName}, ${u.position}, ${u.hash}, ${u.role}, false, ${ago(45)})`);
  }

  printers.forEach((p, i) => {
    q.push(sql`insert into printers (ip, owner, room, model, note, updated_at, updated_by)
               values (${p.ip}, ${p.owner}, ${p.room}, ${p.model}, ${p.note}, ${ago(40 - (i % 30), i)}, ${(i % 2) + 1})`);
  });

  const audit = (days: number, min: number, by: number, action: string, entity: string, id: number | null, before: unknown, after: unknown) =>
    q.push(sql`insert into audit_log (at, user_id, username, action, entity, entity_id, before, after)
               values (${ago(days, min)}, ${by}, ${userName(by)}, ${action}, ${entity}, ${id},
                       ${before === null ? null : JSON.stringify(before)}::jsonb, ${after === null ? null : JSON.stringify(after)}::jsonb)`);
  const pr = (i: number) => ({ id: i + 1, ...printers[i] });
  audit(9, 30, 1, "create", "printer", 50, null, pr(49));
  audit(8, 10, 2, "update", "printer", 7, { ...pr(6), note: "" }, pr(6));
  audit(7, 45, 1, "update", "printer", 12, { ...pr(11), room: "каб. 101" }, pr(11));
  audit(5, 20, 1, "delete", "printer", null, { id: 62, ip: "10.20.0.249", owner: "Учебный класс", room: "каб. 120", model: "HP LaserJet Pro M404dn", note: "списан" }, null);
  audit(3, 15, 2, "update", "printer", 3, { ...pr(2), model: "" }, pr(2));
  audit(0, 90, 1, "create", "printer", 55, null, pr(54));

  q.push(sql`insert into tmc_orgs (name, created_at) select unnest(${[...SEED_ORGS]}::text[]), ${ago(45)}`);
  for (const name of SEED_ITEMS) {
    const c = catalog[name];
    q.push(sql`insert into tmc_items (name, category, description) values (${name}, ${c?.category ?? ""}, ${c?.description ?? ""})`);
  }

  for (const name of CARTRIDGE_MODELS) q.push(sql`insert into cartridge_models (name, created_at) values (${name}, ${ago(45)})`);
  MOVES.forEach((m, i) => {
    const id = i + 1;
    q.push(sql`insert into cartridge_moves (move_date, from_place, to_place, note, created_by, created_at)
               values (${dateAgo(m.daysAgo)}, ${m.from}, ${m.to}, ${m.note}, ${m.by}, ${ago(m.daysAgo, 60)})`);
    m.lines.forEach(([model, qty, off], pos) =>
      q.push(sql`insert into cartridge_move_lines (move_id, pos, model, qty, written_off) values (${id}, ${pos + 1}, ${model}, ${qty}, ${off})`));
    audit(m.daysAgo, 60, m.by, "create", "cartridge_move", id, null, { id, from_place: m.from, to_place: m.to });
  });

  ACTS.forEach((a, i) => {
    const id = i + 1;
    const giver = users[a.by - 1];
    q.push(sql`insert into tmc_acts (act_date, org, recipient_name, recipient_position, department, giver_name, giver_position, note, created_by, created_at)
               values (${dateAgo(a.daysAgo)}, ${a.org}, ${a.recipientName}, ${a.recipientPosition}, ${a.department},
                       ${giver.actName}, ${giver.position}, ${a.note}, ${a.by}, ${ago(a.daysAgo, 120)})`);
    a.lines.forEach(([name, inv, serial, qty], pos) =>
      q.push(sql`insert into tmc_act_lines (act_id, pos, name, inv_number, serial_number, qty) values (${id}, ${pos + 1}, ${name}, ${inv}, ${serial}, ${qty})`));
    audit(a.daysAgo, 120, a.by, "create", "tmc_act", id, null, { id, recipient_name: a.recipientName });
  });

  ARTICLES.forEach((a, i) => {
    const id = i + 1;
    const s = searchFields({ ...a, videoUrl: "", fileIds: [] });
    q.push(sql`insert into kb_articles (title, symptom, cause, prerequisites, solution, tags, search_head, search_body, archived,
                                        created_by, created_at, updated_by, updated_at)
               values (${a.title}, ${a.symptom}, ${a.cause}, ${a.prerequisites}, ${a.solution}, ${a.tags}::text[], ${s.head}, ${s.body},
                       ${a.archived ?? false}, ${a.by}, ${ago(a.daysAgo, 200)}, ${a.by}, ${ago(a.daysAgo, 200)})`);
    audit(a.daysAgo, 200, a.by, "create", "kb_article", id, null, { id, title: a.title });
  });

  await sql.transaction(q);

  // Photos go one per request after the transaction: ~1.8 MB in one HTTP request is too close to Neon's limits.
  for (const [name, c] of Object.entries(catalog)) {
    const bytes = readFileSync(join(root(), "data/catalog", c.photo));
    const type = sniffImageType(bytes);
    if (!type) throw new Error(`${c.photo} is not an image`);
    await sql`update tmc_items set photo = decode(${bytes.toString("hex")}, 'hex'), photo_type = ${type}, photo_rev = photo_rev + 1 where name = ${name}`;
  }

  const [s] = await sql`
    select (select count(*) from printers)::int as printers, (select count(*) from users)::int as users,
           (select count(*) from audit_log)::int as audit, (select count(*) from cartridge_moves)::int as moves,
           (select count(*) from tmc_acts)::int as acts, (select count(*) from kb_articles)::int as articles`;
  return s as ResetSummary;
}

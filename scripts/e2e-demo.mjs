// End-to-end check of the demo reset against a LOCAL database (see README → Local development).
// Needs .env.test and a dev server started with it:
//   set -a; . ./.env.test; set +a; npx next dev -p 3100
//   node --env-file=.env.test scripts/e2e-demo.mjs
import assert from "node:assert/strict";
import { neon, neonConfig } from "@neondatabase/serverless";
import { resetDemo } from "../src/lib/demo/seed.ts";
import { DEMO_ACCOUNTS } from "../src/lib/demo/accounts.ts";

const { DATABASE_URL, NEON_LOCAL_PROXY, CRON_SECRET } = process.env;
assert.ok(NEON_LOCAL_PROXY, "e2e runs only against the local proxy (NEON_LOCAL_PROXY=1)");
neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
const sql = neon(DATABASE_URL);
const BASE = process.env.BASE_URL ?? "http://localhost:3100";

const expectSummary = (s) => {
  assert.equal(s.printers, 61);
  assert.equal(s.users, 3);
  assert.ok(s.moves >= 8, `moves ${s.moves}`);
  assert.equal(s.acts, 5);
  assert.ok(s.articles >= 6, `articles ${s.articles}`);
  assert.ok(s.audit >= 12, `audit ${s.audit}`);
};

let step = 0;
const ok = (name) => console.log(`ok ${++step} — ${name}`);

expectSummary(await resetDemo(sql));
ok("first reset");

await sql`insert into printers (ip, owner) values ('10.20.0.250', 'посетитель')`;
expectSummary(await resetDemo(sql));
const [{ min, n }] = await sql`select min(id)::int as min, count(*)::int as n from printers where owner = 'посетитель' or id = 1`;
assert.equal(min, 1);
assert.equal(n, 1);
ok("second reset wipes visitor rows and restarts ids");

const [{ photos }] = await sql`select count(*)::int as photos from tmc_items where photo is not null`;
assert.equal(photos, 37);
const [{ png }] = await sql`select count(*)::int as png from tmc_items where photo_type = 'image/png' and substring(photo from 1 for 4) = '\\x89504e47'::bytea`;
assert.equal(png, 37, "placeholder photos are stored as PNG with the matching type");
ok("catalog photos loaded");

const login = async (username, password) =>
  fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ username, password }),
  });
for (const a of DEMO_ACCOUNTS) {
  const r = await login(a.username, a.password);
  assert.equal(r.status, 200, `${a.username}: ${r.status}`);
  assert.equal((await r.json()).mustChangePassword, false);
}
ok("demo accounts sign in right after reset");

// Demo guards (Task 5)
const cookieOf = (r) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const asUser = async (username) => {
  const a = DEMO_ACCOUNTS.find((x) => x.username === username);
  const cookie = cookieOf(await login(a.username, a.password));
  return (path, method, body) => fetch(`${BASE}${path}`, {
    method, headers: { cookie, origin: BASE, "content-type": "application/json" }, body: body && JSON.stringify(body),
  });
};
const admin = await asUser("demo_admin");
const [{ id: editorId }] = await sql`select id from users where username = 'demo_editor'`;
for (const change of [{ role: "viewer" }, { active: false }, { password: "a-new-password-123" }]) {
  const r = await admin(`/api/users/${editorId}`, "PATCH", change);
  assert.equal(r.status, 403, JSON.stringify(change));
}
const [ed] = await sql`select role, active, must_change_password from users where username = 'demo_editor'`;
assert.deepEqual(ed, { role: "editor", active: true, must_change_password: false });
assert.equal((await admin(`/api/users/${editorId}`, "PATCH", { fullName: "Иван И." })).status, 200);
ok("demo admin cannot change another demo account's access, may rename it");

const editor = await asUser("demo_editor");
assert.equal((await editor("/api/account/password", "POST", { current: "demo-editor-2026", next: "another-password-1" })).status, 403);
ok("demo account cannot change its own password");

await sql`insert into kb_attachments (kind, filename, mime, size, data, created_by)
          values ('file', 'filler.bin', 'application/pdf', ${50 * 1024 * 1024 - 1000}, '\\x00', 1)`;
const pdf = new TextEncoder().encode("%PDF-1.4\n" + "x".repeat(5000));
const up = await fetch(`${BASE}/api/helper/attachments?kind=file&name=a.pdf`, {
  method: "POST", headers: { cookie: cookieOf(await login("demo_editor", "demo-editor-2026")), origin: BASE }, body: pdf,
});
assert.equal(up.status, 400);
assert.match((await up.json()).error, /место для файлов закончилось/);
ok("attachments are refused once 50 MB are used");

const first = await asUser("demo_editor");
const second = await asUser("demo_editor");
assert.equal((await first("/api/auth/logout", "POST")).status, 200);
assert.equal((await second("/api/printers", "GET")).status, 200);
ok("one visitor signing out of a demo account does not sign out the others");

// Reset route (Task 6)
const reset = (auth) => fetch(`${BASE}/api/demo/reset`, auth ? { headers: { authorization: auth } } : {});
await sql`insert into printers (ip, owner) values ('10.20.0.251', 'посетитель')`;
assert.equal((await reset()).status, 401);
assert.equal((await reset("Bearer wrong")).status, 401);
assert.equal((await reset(`Bearer ${CRON_SECRET}x`)).status, 401);
const [{ kept }] = await sql`select count(*)::int as kept from printers where owner = 'посетитель'`;
assert.equal(kept, 1);
ok("reset route refuses missing or wrong secret and leaves data alone");

const good = await reset(`Bearer ${CRON_SECRET}`);
assert.equal(good.status, 200);
expectSummary(await good.json());
const [{ gone }] = await sql`select count(*)::int as gone from printers where owner = 'посетитель'`;
assert.equal(gone, 0);
ok("reset route with the secret resets the data");

console.log("e2e-demo: all passed");

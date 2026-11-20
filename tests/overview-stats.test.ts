import { test } from "node:test";
import assert from "node:assert/strict";
import { subnetStats, dailyCounts, greeting, cartridgeSummary } from "../src/lib/overview/stats.ts";

test("subnetStats marks busy, free and duplicate cells of 10.20.0.1–254", () => {
  const s = subnetStats([
    { ip: "10.20.0.1", owner: "Fortinet" },
    { ip: "10.20.0.5", owner: "Бухгалтерия" },
    { ip: "10.20.0.5", owner: "Касса" },
    { ip: "10.20.1.15", owner: "Филиал Восток" },
    { ip: "", owner: "Без IP" },
    { ip: " 10.20.0.254 ", owner: "Склад" },
  ]);
  assert.equal(s.cells.length, 254);
  assert.deepEqual(s.cells[0], { n: 1, state: "busy", owners: ["Fortinet"] });
  assert.deepEqual(s.cells[4], { n: 5, state: "dup", owners: ["Бухгалтерия", "Касса"] });
  assert.equal(s.cells[1].state, "free");
  assert.equal(s.cells[253].state, "busy");
  assert.equal(s.busy, 3);
  assert.equal(s.free, 251);
  assert.equal(s.dup, 1);
  assert.equal(s.outside, 2);
  assert.equal(s.firstFree, "10.20.0.2");
});

test("subnetStats with a full subnet has no first free address", () => {
  const all = Array.from({ length: 254 }, (_, i) => ({ ip: `10.20.0.${i + 1}`, owner: "x" }));
  assert.equal(subnetStats(all).firstFree, null);
});

test("dailyCounts returns oldest→newest counts for the last N days", () => {
  assert.deepEqual(dailyCounts(["2026-11-12", "2026-11-12", "2026-11-10", "2026-10-01"], "2026-11-12", 3), [1, 0, 2]);
});

test("greeting depends on Almaty hour", () => {
  assert.equal(greeting(new Date("2026-11-12T03:00:00Z")), "Доброе утро"); // 08:00 Almaty
  assert.equal(greeting(new Date("2026-11-12T08:00:00Z")), "Добрый день"); // 13:00
  assert.equal(greeting(new Date("2026-11-12T14:00:00Z")), "Добрый вечер"); // 19:00
  assert.equal(greeting(new Date("2026-11-12T19:00:00Z")), "Доброй ночи"); // 00:00
});

test("cartridgeSummary: at contractor and waiting per object", () => {
  const H = "Головной офис";
  const s = cartridgeSummary([
    { from_place: H, to_place: "Сервис-партнёр", model: "CE285A", qty: 6, written_off: 0 },
    { from_place: "Сервис-партнёр", to_place: H, model: "CE285A", qty: 3, written_off: 1 },
    { from_place: "Склад Север", to_place: H, model: "CF217A", qty: 4, written_off: 0 },
    { from_place: H, to_place: "Склад Север", model: "CF217A", qty: 1, written_off: 0 },
  ]);
  assert.equal(s.inContractor, 2);
  assert.deepEqual(s.waiting, [
    { place: "Склад Север", count: 3 },
    { place: "Склад Юг", count: 0 },
    { place: "Филиал Восток", count: 0 },
  ]);
  assert.deepEqual(s.topModels, [{ model: "CE285A", remaining: 2 }]);
});

test("timeAgo is computed from a given now, so server and browser render the same text", async () => {
  const { timeAgo } = await import("../src/lib/overview/stats.ts");
  const now = Date.parse("2026-11-12T10:00:30Z");
  assert.equal(timeAgo("2026-11-12 15:00:10+05", now), "сейчас");
  assert.equal(timeAgo("2026-11-12 14:55:00.123456+05", now), "5 мин");
  assert.equal(timeAgo("2026-11-12 12:00:00+05", now), "3 ч");
  assert.equal(timeAgo("2026-11-10 15:00:00+05", now), "2 дн");
});

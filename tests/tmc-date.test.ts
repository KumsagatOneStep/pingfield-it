import { test } from "node:test";
import assert from "node:assert/strict";
import { almatyToday, formatActDate, isSameAlmatyDay } from "../src/lib/tmc/date.ts";
import { DEPARTMENTS, SEED_ORGS, SEED_ITEMS } from "../src/lib/tmc/constants.ts";

test("almatyToday uses Almaty calendar date late in the evening", () => {
  assert.equal(almatyToday(new Date("2026-11-03T18:30:00Z")), "2026-11-03");
});

test("almatyToday rolls over after Almaty midnight while UTC is still yesterday", () => {
  assert.equal(almatyToday(new Date("2026-11-02T19:30:00Z")), "2026-11-03");
});

test("formatActDate writes month in genitive with leading zero", () => {
  assert.equal(formatActDate("2026-11-03"), "03 ноября 2026 г.");
  assert.equal(formatActDate("2026-10-21"), "21 октября 2026 г.");
  assert.equal(formatActDate("2026-05-01"), "01 мая 2026 г.");
});

test("isSameAlmatyDay compares by Almaty calendar day", () => {
  assert.equal(isSameAlmatyDay(new Date("2026-11-02T19:30:00Z"), new Date("2026-11-03T18:59:00Z")), true);
  assert.equal(isSameAlmatyDay(new Date("2026-11-02T19:30:00Z"), new Date("2026-11-03T19:00:00Z")), false);
});

test("finance subdivisions follow their department", () => {
  const i = DEPARTMENTS.indexOf("Финансовый отдел");
  assert.deepEqual(DEPARTMENTS.slice(i, i + 3), ["Финансовый отдел", "Расчётный отдел", "Бухгалтерский учёт"]);
});

test("fixed lists have the sizes from the spec", () => {
  assert.equal(DEPARTMENTS.length, 16);
  assert.equal(SEED_ORGS.length, 3);
  assert.equal(SEED_ITEMS.length, 37);
  assert.equal(new Set(DEPARTMENTS).size, 16);
});

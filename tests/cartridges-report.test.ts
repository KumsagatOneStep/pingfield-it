import { test } from "node:test";
import assert from "node:assert/strict";
import { HUB, CONTRACTOR } from "../src/lib/cartridges/constants.ts";
import { objectReport, contractorReport } from "../src/lib/cartridges/report.ts";

const row = (from_place: string, to_place: string, model: string, qty: number, written_off = 0) =>
  ({ from_place, to_place, model, qty, written_off });

test("contractor: remaining is sent minus returned minus written off", () => {
  const r = contractorReport([row(HUB, CONTRACTOR, "CE285A", 30), row(CONTRACTOR, HUB, "CE285A", 24, 2)]);
  assert.deepEqual(r, [{ model: "CE285A", sent: 30, returned: 24, writtenOff: 2, remaining: 4 }]);
});

test("contractor: several moves of one model add up", () => {
  const r = contractorReport([row(HUB, CONTRACTOR, "A", 3), row(HUB, CONTRACTOR, "A", 4), row(CONTRACTOR, HUB, "A", 1), row(CONTRACTOR, HUB, "A", 2, 1)]);
  assert.deepEqual(r, [{ model: "A", sent: 7, returned: 3, writtenOff: 1, remaining: 3 }]);
});

test("contractor: a return without a recorded send goes negative", () => {
  assert.equal(contractorReport([row(CONTRACTOR, HUB, "A", 2)])[0].remaining, -2);
});

test("contractor: moves of other places are ignored", () => {
  assert.deepEqual(contractorReport([row("Склад Север", HUB, "A", 5), row(HUB, "Склад Юг", "A", 1)]), []);
});

test("object: waiting is received minus returned", () => {
  const r = objectReport("Склад Север", [row("Склад Север", HUB, "CE285A", 6), row(HUB, "Склад Север", "CE285A", 4)]);
  assert.deepEqual(r, [{ model: "CE285A", received: 6, returned: 4, waiting: 2 }]);
});

test("object: other objects and CONTRACTOR are ignored", () => {
  assert.deepEqual(objectReport("Склад Север", [row("Склад Юг", HUB, "A", 5), row(HUB, CONTRACTOR, "A", 5), row(HUB, "Склад Юг", "A", 1)]), []);
});

test("object: write-offs from CONTRACTOR do not change waiting", () => {
  const r = objectReport("Склад Север", [row("Склад Север", HUB, "A", 6), row(CONTRACTOR, HUB, "A", 0, 3)]);
  assert.equal(r[0].waiting, 6);
});

test("rows are sorted by model", () => {
  const r = contractorReport([row(HUB, CONTRACTOR, "Б", 1), row(HUB, CONTRACTOR, "А", 1), row(HUB, CONTRACTOR, "В", 1)]);
  assert.deepEqual(r.map((x) => x.model), ["А", "Б", "В"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { HUB, CONTRACTOR } from "../src/lib/cartridges/constants.ts";
import { validateMove, validatePeriod } from "../src/lib/cartridges/validate.ts";

const TODAY = "2026-11-11";
const good = () => ({
  moveDate: "2026-11-10",
  fromPlace: HUB,
  toPlace: CONTRACTOR,
  note: "  партия  ",
  lines: [{ model: " CE285A ", qty: 6 }],
});
const err = (b: unknown) => {
  const r = validateMove(b, TODAY);
  return "error" in r ? r.error : null;
};
const lines = (qty: unknown, writtenOff?: unknown) => [{ model: "CE285A", qty, writtenOff }];

test("valid move is accepted and trimmed", () => {
  const r = validateMove(good(), TODAY);
  assert.ok("value" in r);
  assert.equal(r.value.note, "партия");
  assert.deepEqual(r.value.lines, [{ model: "CE285A", qty: 6, writtenOff: 0 }]);
});

test("today is allowed, a future date is not", () => {
  assert.equal(err({ ...good(), moveDate: TODAY }), null);
  assert.ok(err({ ...good(), moveDate: "2026-11-12" }));
});

for (const bad of ["11.11.2026", "2026-02-31", "", undefined, 5]) {
  test(`bad date is rejected: ${String(bad)}`, () => assert.ok(err({ ...good(), moveDate: bad })));
}

test("one side must be the head office", () => {
  assert.ok(err({ ...good(), fromPlace: "Склад Север", toPlace: CONTRACTOR }));
});

test("same place on both sides is rejected", () => {
  assert.ok(err({ ...good(), fromPlace: HUB, toPlace: HUB }));
});

test("unknown place is rejected", () => {
  assert.ok(err({ ...good(), toPlace: "Марс" }));
});

test("empty and oversized line lists are rejected", () => {
  assert.ok(err({ ...good(), lines: [] }));
  const many = Array.from({ length: 21 }, (_, i) => ({ model: `M${i}`, qty: 1 }));
  assert.ok(err({ ...good(), lines: many }));
});

for (const bad of ["3", 1.5, -1, 10000, null]) {
  test(`bad quantity is rejected: ${String(bad)}`, () => assert.ok(err({ ...good(), lines: lines(bad) })));
}

test("a line with nothing in it is rejected", () => {
  assert.ok(err({ ...good(), lines: lines(0, 0) }));
});

test("write-off is only allowed on returns from contractor", () => {
  assert.ok(err({ ...good(), lines: lines(1, 2) }));
  assert.equal(err({ ...good(), fromPlace: CONTRACTOR, toPlace: HUB, lines: lines(1, 2) }), null);
});

test("a return from CONTRACTOR may be write-offs only", () => {
  assert.equal(err({ ...good(), fromPlace: CONTRACTOR, toPlace: HUB, lines: lines(0, 1) }), null);
});

test("bad write-off values are rejected", () => {
  for (const bad of ["1", 1.5, -1, 10000]) {
    assert.ok(err({ ...good(), fromPlace: CONTRACTOR, toPlace: HUB, lines: lines(1, bad) }), String(bad));
  }
});

test("the same model twice in one move is rejected", () => {
  assert.ok(err({ ...good(), lines: [{ model: "CE285A", qty: 1 }, { model: " CE285A", qty: 2 }] }));
});

test("missing model and overlong fields are rejected", () => {
  assert.ok(err({ ...good(), lines: [{ model: " ", qty: 1 }] }));
  assert.ok(err({ ...good(), lines: [{ model: "я".repeat(301), qty: 1 }] }));
  assert.ok(err({ ...good(), note: "я".repeat(1001) }));
});

test("period: empty bounds are null", () => {
  assert.deepEqual(validatePeriod("", undefined), { value: { from: null, to: null } });
});

test("period: valid bounds pass, a reversed period is an error", () => {
  assert.deepEqual(validatePeriod("2026-11-01", "2026-11-10"), { value: { from: "2026-11-01", to: "2026-11-10" } });
  assert.ok("error" in validatePeriod("2026-11-10", "2026-11-01"));
});

test("period: a malformed bound is an error", () => {
  assert.ok("error" in validatePeriod("вчера", null));
});

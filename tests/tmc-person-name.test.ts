import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPersonName, validateAct } from "../src/lib/tmc/validate.ts";

const cases: [string, string][] = [
  ["Петров ПС", "Петров П. С."],
  ["Петров П С", "Петров П. С."],
  ["Петров П.С.", "Петров П. С."],
  ["Петров П.С", "Петров П. С."],
  ["Петров П. С.", "Петров П. С."],
  ["Петров п с", "Петров П. С."],
  ["  Петров   П   С ", "Петров П. С."],
  ["Петров П", "Петров П."],
  ["П С Петров", "П. С. Петров"],
  ["П.С. Петров", "П. С. Петров"],
  ["Әбенов ҚӨ", "Әбенов Қ. Ө."],
  // Full names and short surnames stay as typed.
  ["Петров Павел Сергеевич", "Петров Павел Сергеевич"],
  ["ПЕТРОВ ПАВЕЛ", "ПЕТРОВ ПАВЕЛ"],
  ["ЛИ П С", "ЛИ П. С."],
  ["Ли П С", "Ли П. С."],
  ["", ""],
];

for (const [input, expected] of cases) {
  test(`formatPersonName: "${input}"`, () => assert.equal(formatPersonName(input), expected));
}

test("validateAct stores the recipient with dotted initials", () => {
  const r = validateAct({
    org: "АО «Орбита Групп»",
    recipientName: "Петрова АС",
    recipientPosition: "Экономист",
    department: "Бухгалтерия",
    note: "",
    lines: [{ name: "Накопитель 256GB", invNumber: "", serialNumber: "", qty: 1 }],
  }, ["АО «Орбита Групп»"]);
  assert.ok("value" in r);
  assert.equal(r.value.recipientName, "Петрова А. С.");
});

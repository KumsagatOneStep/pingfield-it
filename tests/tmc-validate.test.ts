import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAct as validateActWith, validateItemName, validateOrgName } from "../src/lib/tmc/validate.ts";

const ORGS = ["ТОО «Орбита-Сервис»", "АО «Орбита Групп»"];
const validateAct = (b: unknown) => validateActWith(b, ORGS);

const good = () => ({
  org: "АО «Орбита Групп»",
  recipientName: "  Петрова А. С. ",
  recipientPosition: "Бухгалтер",
  department: "Бухгалтерия",
  note: "",
  lines: [{ name: " Мышь проводная Rapoo N100 ", invNumber: "", serialNumber: "", qty: 1 }],
});
const err = (r: ReturnType<typeof validateActWith>) => ("error" in r ? r.error : null);

test("valid act is accepted and trimmed", () => {
  const r = validateAct(good());
  assert.ok("value" in r);
  assert.equal(r.value.recipientName, "Петрова А. С.");
  assert.equal(r.value.lines[0].name, "Мышь проводная Rapoo N100");
  assert.equal(r.value.lines[0].qty, 1);
});

test("unknown org is rejected", () => {
  assert.equal(err(validateAct({ ...good(), org: "ООО Рога" })), "Выберите организацию");
});

test("unknown department is rejected", () => {
  assert.equal(err(validateAct({ ...good(), department: "Отдел X" })), "Выберите подразделение");
});

test("recipient name and position are required", () => {
  assert.equal(err(validateAct({ ...good(), recipientName: " " })), "Укажите ФИО получателя");
  assert.equal(err(validateAct({ ...good(), recipientPosition: "" })), "Укажите должность получателя");
});

test("line count is between 1 and 20", () => {
  assert.equal(err(validateAct({ ...good(), lines: [] })), "Добавьте хотя бы одну позицию");
  const line = good().lines[0];
  assert.equal(err(validateAct({ ...good(), lines: Array(21).fill(line) })), "Не больше 20 позиций в акте");
  assert.ok("value" in validateAct({ ...good(), lines: Array(20).fill(line) }));
});

test("qty must be an integer 1..9999", () => {
  for (const qty of [0, -1, 1.5, "2", 10000]) {
    const g = good();
    g.lines[0].qty = qty as number;
    assert.equal(err(validateAct(g)), "Количество — целое число от 1 до 9999", String(qty));
  }
});

test("line name is required", () => {
  const g = good();
  g.lines[0].name = " ";
  assert.equal(err(validateAct(g)), "Выберите наименование");
});

test("length limits", () => {
  assert.ok(err(validateAct({ ...good(), recipientName: "я".repeat(121) })));
  assert.ok(err(validateAct({ ...good(), recipientPosition: "я".repeat(121) })));
  assert.ok(err(validateAct({ ...good(), note: "я".repeat(1001) })));
  const g = good();
  g.lines[0].invNumber = "1".repeat(61);
  assert.ok(err(validateAct(g)));
  const h = good();
  h.lines[0].name = "я".repeat(301);
  assert.ok(err(validateAct(h)));
});

test("non-object body is rejected", () => {
  assert.ok(err(validateAct(null)));
  assert.ok(err(validateAct({ ...good(), lines: "x" })));
});

test("validateItemName trims and limits", () => {
  assert.deepEqual(validateItemName("  Мышь  "), { value: "Мышь" });
  assert.ok("error" in validateItemName(""));
  assert.ok("error" in validateItemName("я".repeat(301)));
  assert.ok("error" in validateItemName(5));
});

test("act org must be in the current list (from the database)", () => {
  assert.ok("value" in validateActWith(good(), ["АО «Орбита Групп»"]));
  assert.equal(err(validateActWith(good(), ["ТОО «Орбита-Сервис»"])), "Выберите организацию");
  assert.equal(err(validateActWith(good(), [])), "Выберите организацию");
});

test("org name is trimmed and spaces collapsed", () => {
  const r = validateOrgName("  ТОО   «Новая»  ");
  assert.ok("value" in r);
  assert.equal(r.value, "ТОО «Новая»");
});

test("empty, non-string or too long org name is rejected", () => {
  assert.deepEqual(validateOrgName("   "), { error: "Введите название организации" });
  assert.ok("error" in validateOrgName(undefined));
  assert.ok("error" in validateOrgName(42));
  assert.ok("error" in validateOrgName("Я".repeat(121)));
  assert.ok("value" in validateOrgName("Я".repeat(120)));
});

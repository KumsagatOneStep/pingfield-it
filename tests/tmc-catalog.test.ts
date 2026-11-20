import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATALOG_CATEGORIES, MAX_PHOTO_BYTES, addPicksToLines, sniffImageType, validateCategory, validateDescription, validatePhoto,
} from "../src/lib/tmc/catalog.ts";
import { SEED_ITEMS } from "../src/lib/tmc/constants.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 ")]);

test("sniffImageType recognises jpeg, png and webp by their bytes", () => {
  assert.equal(sniffImageType(JPEG), "image/jpeg");
  assert.equal(sniffImageType(PNG), "image/png");
  assert.equal(sniffImageType(WEBP), "image/webp");
  assert.equal(sniffImageType(Buffer.from("<svg onload=alert(1)>")), null);
  assert.equal(sniffImageType(Buffer.from([])), null);
});

test("validatePhoto accepts a base64 image and rejects anything else", () => {
  const ok = validatePhoto(JPEG.toString("base64"));
  assert.ok("value" in ok && ok.value.type === "image/jpeg" && ok.value.bytes.equals(JPEG));
  const dataUrl = validatePhoto("data:image/png;base64," + PNG.toString("base64"));
  assert.ok("value" in dataUrl && dataUrl.value.type === "image/png");
  assert.ok("error" in validatePhoto(Buffer.from("<html>").toString("base64")));
  assert.ok("error" in validatePhoto(42));
  assert.ok("error" in validatePhoto(""));
  const big = Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES)]);
  assert.match((validatePhoto(big.toString("base64")) as { error: string }).error, /большое/);
});

test("validateCategory allows only the known sections or empty", () => {
  assert.deepEqual(validateCategory("Сеть"), { value: "Сеть" });
  assert.deepEqual(validateCategory(""), { value: "" });
  assert.deepEqual(validateCategory(undefined), { value: "" });
  assert.ok("error" in validateCategory("Что-то своё"));
  assert.ok(CATALOG_CATEGORIES.includes("Прочее"));
});

test("validateDescription trims and limits length", () => {
  assert.deepEqual(validateDescription("  Тихая мышь  "), { value: "Тихая мышь" });
  assert.deepEqual(validateDescription(null), { value: "" });
  assert.ok("error" in validateDescription("x".repeat(401)));
  assert.ok("error" in validateDescription(5));
});

test("addPicksToLines fills the empty line, adds to the same name and appends the rest", () => {
  let n = 0;
  const make = (name: string, qty: number) => ({ key: 100 + ++n, name, qty: String(qty) });
  const lines = [
    { key: 1, name: "Мышь проводная Rapoo N100", qty: "2" },
    { key: 2, name: "", qty: "1" },
  ];
  const r = addPicksToLines(lines, [
    { name: "Мышь проводная Rapoo N100", qty: 3 },
    { name: "Переходник", qty: 1 },
    { name: "Кабель HDMI 20 м", qty: 2 },
  ], 20, make);
  assert.ok("lines" in r);
  assert.deepEqual(r.lines.map((l) => [l.name, l.qty]), [
    ["Мышь проводная Rapoo N100", "5"],
    ["Переходник", "1"],
    ["Кабель HDMI 20 м", "2"],
  ]);
  assert.equal(r.lines[1].key, 2, "the empty line is reused, not replaced");
});

test("addPicksToLines refuses to go over the line limit and keeps lines unchanged", () => {
  const make = (name: string, qty: number) => ({ key: Math.random(), name, qty: String(qty) });
  const lines = [{ key: 1, name: "А", qty: "1" }];
  const r = addPicksToLines(lines, [{ name: "Б", qty: 1 }, { name: "В", qty: 1 }], 2, make);
  assert.ok("error" in r);
  assert.match(r.error, /20|2/);
});

test("addPicksToLines caps a line at 9999", () => {
  const make = (name: string, qty: number) => ({ key: 9, name, qty: String(qty) });
  const r = addPicksToLines([{ key: 1, name: "А", qty: "9990" }], [{ name: "А", qty: 50 }], 20, make);
  assert.ok("lines" in r && r.lines[0].qty === "9999");
});

test("seed catalog describes every seed item with a known section and an existing photo", () => {
  const seed = JSON.parse(readFileSync("data/catalog/catalog.json", "utf8")) as Record<string, { category: string; description: string; photo: string }>;
  for (const name of SEED_ITEMS) {
    const e = seed[name];
    assert.ok(e, `no catalog entry for ${name}`);
    assert.ok((CATALOG_CATEGORIES as readonly string[]).includes(e.category), `${name}: ${e.category}`);
    assert.ok(e.description.length > 0 && e.description.length <= 400, name);
    const bytes = readFileSync(`data/catalog/${e.photo}`);
    assert.ok(sniffImageType(bytes), `${e.photo} is not an image`);
    assert.ok(bytes.length <= MAX_PHOTO_BYTES, `${e.photo} too big`);
  }
});

test("schema adds catalog columns to tmc_items idempotently", () => {
  const sql = readFileSync("sql/schema.sql", "utf8");
  for (const c of ["description", "category", "photo", "photo_type", "photo_rev"]) {
    assert.match(sql, new RegExp(`alter table tmc_items add column if not exists ${c} `));
  }
});

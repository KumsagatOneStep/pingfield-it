import { test } from "node:test";
import assert from "node:assert/strict";
import { describeKb } from "../src/lib/helper/audit.ts";

const snap = { title: "Домен", symptom: "s", cause: "", prerequisites: "", solution: "a", tags: ["AD"], video_url: "" };

test("create shows only the title", () => {
  assert.equal(describeKb(null, snap), "Название: Домен");
});

test("update lists changed field names, not texts", () => {
  assert.equal(describeKb(snap, { ...snap, solution: "b".repeat(5000), tags: ["AD", "домен"] }), "изменил: Решение, Метки");
});

test("update with no changes says so", () => {
  assert.equal(describeKb(snap, { ...snap }), "без изменений текста");
});

test("archive and restore", () => {
  assert.equal(describeKb({ title: "Домен", archived: false }, null), "в архив");
  assert.equal(describeKb({ title: "Домен", archived: true }, { title: "Домен", archived: false }), "из архива");
});

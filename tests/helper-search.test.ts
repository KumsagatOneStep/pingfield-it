import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, searchFields, extractImageIds } from "../src/lib/helper/search.ts";

test("normalize lowercases, folds ё and collapses spaces", () => {
  assert.equal(normalize("  Ёлка   ДОМЕН "), "елка домен");
});

test("searchFields puts tags in head and solution in body", () => {
  const f = searchFields({
    title: "Принтер", symptom: "Не печатает", cause: "Драйвер", prerequisites: "Права",
    solution: "Переустановить Ёлку", tags: ["HP"], videoUrl: "", fileIds: [],
  });
  assert.match(f.head, /принтер/);
  assert.match(f.head, /не печатает/);
  assert.match(f.head, /hp/);
  assert.doesNotMatch(f.head, /переустановить/);
  assert.match(f.body, /переустановить елку/);
  assert.match(f.body, /драйвер/);
});

test("extractImageIds returns unique internal ids only, in order", () => {
  assert.deepEqual(
    extractImageIds(
      "a ![](/api/helper/attachments/12) b ![x](/api/helper/attachments/12)",
      "![](https://evil/1.png) ![](/api/helper/attachments/7)",
    ),
    [12, 7],
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArticle } from "../src/lib/helper/validate.ts";

const good = () => ({
  title: "  Ошибка доверительных отношений  ",
  symptom: " Не удалось установить доверительные отношения ",
  cause: "",
  prerequisites: "",
  solution: "1. Reset-ComputerMachinePassword",
  tags: [" домен ", "AD"],
  videoUrl: "",
  fileIds: [],
});
const err = (b: unknown) => {
  const r = validateArticle(b);
  return "error" in r ? r.error : null;
};

test("valid article is accepted and trimmed", () => {
  const r = validateArticle(good());
  assert.ok("value" in r);
  assert.equal(r.value.title, "Ошибка доверительных отношений");
  assert.equal(r.value.symptom, "Не удалось установить доверительные отношения");
  assert.deepEqual(r.value.tags, ["домен", "AD"]);
  assert.deepEqual(r.value.fileIds, []);
});

test("missing body is rejected", () => {
  assert.ok(err(null));
});

test("required fields cannot be empty or whitespace", () => {
  assert.match(err({ ...good(), title: "   " })!, /Название/);
  assert.match(err({ ...good(), symptom: "" })!, /Симптом/);
  assert.match(err({ ...good(), solution: " \n " })!, /Решение/);
});

test("title over 200 chars is rejected", () => {
  assert.ok(err({ ...good(), title: "а".repeat(201) }));
  assert.equal(err({ ...good(), title: "а".repeat(200) }), null);
});

test("section over 20000 chars is rejected", () => {
  assert.ok(err({ ...good(), solution: "x".repeat(20001) }));
  assert.ok(err({ ...good(), cause: "x".repeat(20001) }));
  assert.equal(err({ ...good(), solution: "x".repeat(20000) }), null);
});

test("more than 10 tags is rejected", () => {
  assert.ok(err({ ...good(), tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }));
});

test("tags are trimmed, empty dropped, duplicates merged case-insensitively", () => {
  const r = validateArticle({ ...good(), tags: [" Домен", "", "домен", "  ", "AD"] });
  assert.ok("value" in r);
  assert.deepEqual(r.value.tags, ["Домен", "AD"]);
});

test("video url must be http(s) or empty", () => {
  assert.ok(err({ ...good(), videoUrl: "javascript:alert(1)" }));
  assert.ok(err({ ...good(), videoUrl: "ftp://x" }));
  assert.equal(err({ ...good(), videoUrl: "" }), null);
  assert.equal(err({ ...good(), videoUrl: "https://youtu.be/x" }), null);
});

test("fileIds must be positive integers", () => {
  assert.ok(err({ ...good(), fileIds: ["1"] }));
  assert.ok(err({ ...good(), fileIds: [1.5] }));
  assert.ok(err({ ...good(), fileIds: [-1] }));
  assert.equal(err({ ...good(), fileIds: [3, 4] }), null);
});

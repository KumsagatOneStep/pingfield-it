import { test } from "node:test";
import assert from "node:assert/strict";
import { initials } from "../src/lib/initials.ts";

test("two words give two letters, uppercase", () => {
  assert.equal(initials("Данияр Ахметов"), "ДА");
  assert.equal(initials("данияр it"), "ДI");
});
test("one word gives one letter; logins use the first letter", () => {
  assert.equal(initials("Администратор"), "А");
  assert.equal(initials("ui.kb.editor"), "U");
});
test("brackets and extra spaces are ignored; empty falls back", () => {
  assert.equal(initials("  Дана (просмотр) "), "ДП");
  assert.equal(initials(""), "?");
});

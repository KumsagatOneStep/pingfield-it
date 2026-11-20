import { test } from "node:test";
import assert from "node:assert/strict";
import { demoUserChangeError, DEMO_LOCKED } from "../src/lib/demo/guard.ts";
import { MAX_FILE_BYTES, MAX_TOTAL_ATTACHMENT_BYTES } from "../src/lib/helper/constants.ts";
import { checkFileBeforeUpload } from "../src/lib/helper/client.ts";

for (const username of ["demo_editor", "demo_admin"]) {
  test(`${username}: role, active and password cannot be changed`, () => {
    const t = { username, role: username === "demo_admin" ? "admin" : "editor", active: true };
    assert.equal(demoUserChangeError(t, { role: "viewer" }), DEMO_LOCKED);
    assert.equal(demoUserChangeError(t, { active: false }), DEMO_LOCKED);
    assert.equal(demoUserChangeError(t, { password: "something-long-enough" }), DEMO_LOCKED);
  });

  test(`${username}: sending the unchanged role and active flag is fine`, () => {
    const t = { username, role: username === "demo_admin" ? "admin" : "editor", active: true };
    assert.equal(demoUserChangeError(t, { role: t.role, active: true }), null);
  });

  test(`${username}: name fields may change`, () => {
    assert.equal(demoUserChangeError({ username, role: "editor", active: true }, { fullName: "Другое имя" }), null);
  });
}

test("other users are not locked", () => {
  const t = { username: "petrova", role: "viewer", active: true };
  assert.equal(demoUserChangeError(t, { role: "editor", active: false, password: "something-long-enough" }), null);
});

test("demo file limit is 1 MB, 50 MB in total", () => {
  assert.equal(MAX_FILE_BYTES, 1024 * 1024);
  assert.equal(MAX_TOTAL_ATTACHMENT_BYTES, 50 * 1024 * 1024);
  assert.equal(checkFileBeforeUpload("a.pdf", 1.5 * 1024 * 1024), "Файл слишком большой (максимум 1 МБ)");
  assert.equal(checkFileBeforeUpload("a.pdf", 1024 * 1024), null);
});

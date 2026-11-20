import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });

test("pages use the shared Dropdown, not native <select>", () => {
  const withSelect = files("src/app").filter((f) => /<select[\s>]/.test(readFileSync(f, "utf8")));
  assert.deepEqual(withSelect, []);
});

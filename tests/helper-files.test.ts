import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffFileType, isSafeImageSrc, isSafeHref } from "../src/lib/helper/files.ts";

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...Buffer.from(x, "latin1")] : [x])));

test("images are detected by signature", () => {
  assert.deepEqual(sniffFileType(bytes(0x89, "PNG\r\n\x1a\n", 0, 0), "a.png"), { mime: "image/png", kind: "image" });
  assert.deepEqual(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0), "a.jpg"), { mime: "image/jpeg", kind: "image" });
  assert.deepEqual(sniffFileType(bytes("RIFF", 0, 0, 0, 0, "WEBP"), "a.webp"), { mime: "image/webp", kind: "image" });
});

test("pdf is detected by signature", () => {
  assert.deepEqual(sniffFileType(bytes("%PDF-1.7\n"), "guide.pdf"), { mime: "application/pdf", kind: "file" });
});

test("zip containers are told apart by extension", () => {
  const zip = bytes("PK", 3, 4, 0, 0);
  assert.equal(sniffFileType(zip, "a.docx")?.mime, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(sniffFileType(zip, "a.XLSX")?.mime, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(sniffFileType(zip, "a.zip")?.mime, "application/zip");
  assert.equal(sniffFileType(zip, "a.exe"), null);
});

test("txt passes only without null bytes", () => {
  assert.deepEqual(sniffFileType(bytes("привет"), "notes.txt"), { mime: "text/plain; charset=utf-8", kind: "file" });
  assert.equal(sniffFileType(bytes("ab", 0, "cd"), "notes.txt"), null);
});

test("exe renamed to pdf is rejected", () => {
  assert.equal(sniffFileType(bytes("MZ", 0x90, 0), "a.pdf"), null);
});

test("isSafeImageSrc allows only internal attachment urls", () => {
  assert.equal(isSafeImageSrc("/api/helper/attachments/5"), true);
  assert.equal(isSafeImageSrc("https://x/1.png"), false);
  assert.equal(isSafeImageSrc("/api/helper/attachments/5?x"), false);
  assert.equal(isSafeImageSrc("data:image/png;base64,AAA"), false);
});

test("isSafeHref blocks javascript and allows http(s), mailto, relative", () => {
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref(" JavaScript:alert(1)"), false);
  assert.equal(isSafeHref("https://a"), true);
  assert.equal(isSafeHref("http://a"), true);
  assert.equal(isSafeHref("mailto:a@b"), true);
  assert.equal(isSafeHref("/helper/3"), true);
  assert.equal(isSafeHref("//evil.com"), false);
});

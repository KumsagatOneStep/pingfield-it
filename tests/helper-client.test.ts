import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPastedImage, checkFileBeforeUpload } from "../src/lib/helper/client.ts";

const png = { type: "image/png", name: "image.png" };

test("a pasted screenshot (image only, no text) is taken", () => {
  assert.equal(pickPastedImage([png], ""), png);
  assert.equal(pickPastedImage([png], "  \n"), png);
});

test("pasting cells from Excel/Word (text + bitmap) keeps the text", () => {
  assert.equal(pickPastedImage([png], "SRV-DC01.corp.example\t10.20.5.20"), null);
});

test("plain text paste has no image", () => {
  assert.equal(pickPastedImage([], "abc"), null);
  assert.equal(pickPastedImage([{ type: "application/pdf", name: "a.pdf" }], ""), null);
});

test("files over 1 MB are refused before upload with the limit in the message", () => {
  assert.match(checkFileBeforeUpload("big.pdf", 2 * 1024 * 1024)!, /1 МБ/);
  assert.equal(checkFileBeforeUpload("ok.pdf", 1024 * 1024), null);
});

test("unsupported extensions are refused before upload", () => {
  assert.match(checkFileBeforeUpload("setup.exe", 100)!, /PDF, DOCX, XLSX, TXT, ZIP/);
  assert.equal(checkFileBeforeUpload("Отчёт.XLSX", 100), null);
  assert.match(checkFileBeforeUpload("empty.txt", 0)!, /Пустой/);
});

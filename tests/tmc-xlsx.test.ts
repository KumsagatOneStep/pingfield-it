import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { buildActXlsx, type ActForSheet } from "../src/lib/tmc/xlsx.ts";

const FILTER = "Сетевой фильтр SVC ZC6S-30M-USB/TypeC - Зм, 6 розеток, IxUSB-A, 1xUSB-C, черный";
const base: ActForSheet = {
  actDate: "2026-11-03",
  org: "АО «Орбита Групп»",
  recipientName: "Петрова А. С.",
  recipientPosition: "Бухгалтер",
  department: "Бухгалтерия",
  giverName: "Иванов И. И.",
  giverPosition: "Системный администратор",
  note: "",
  lines: [{ name: FILTER, invNumber: "", serialNumber: "", qty: 1 }],
};

async function load(buf: Buffer | ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  return wb.worksheets[0];
}
const sample = () => {
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.readFile("docs/tmc-act-sample.xlsx").then(() => wb.worksheets[0]);
};
const v = (ws: ExcelJS.Worksheet, a: string) => ws.getCell(a).value;
const mergeRanges = (ws: ExcelJS.Worksheet) => (ws.model.merges as string[]).slice().sort();

test("single-line act fills both copies like the sample", async () => {
  const ws = await load(await buildActXlsx(base));
  for (const off of [0, 21]) {
    const r = (n: number) => n + off;
    assert.equal(v(ws, `A${r(1)}`), "Акт приема-передачи ТМЦ от 03 ноября 2026 г.");
    assert.equal(v(ws, `B${r(3)}`), "Петрова А. С.");
    assert.equal(v(ws, `G${r(3)}`), "АО «Орбита Групп»");
    assert.equal(v(ws, `A${r(7)}`), 1);
    assert.equal(v(ws, `B${r(7)}`), FILTER);
    assert.equal(v(ws, `K${r(7)}`), 1);
    assert.equal(v(ws, `A${r(15)}`), "ТМЦ передал: Иванов И. И.");
    assert.equal(v(ws, `A${r(16)}`), "Должность: Системный администратор");
    assert.equal(v(ws, `H${r(16)}`), "(подпись)");
    assert.equal(v(ws, `A${r(18)}`), "ТМЦ принял (-а): Петрова А. С.");
    assert.equal(v(ws, `A${r(19)}`), "Должность: Бухгалтер");
    assert.equal(v(ws, `H${r(19)}`), "(подпись)");
    assert.equal(v(ws, `A${r(20)}`), "Подразделение: Бухгалтерия");
  }
});

test("fixed texts and merges equal the sample", async () => {
  const ws = await load(await buildActXlsx(base));
  const s = await sample();
  for (const a of ["A3", "E3", "J3", "A4", "A6", "B6", "I6", "K6", "A9", "A10", "A12", "A25", "A30", "A31"]) {
    assert.equal(v(ws, a), v(s, a), a);
  }
  const invHeaders: unknown[] = [];
  ws.eachRow((row) => row.eachCell((c) => {
    if (String(c.value).startsWith("Инвентарн")) invHeaders.push(c.value);
  }));
  // Two copies of the act, each header merged over G:H.
  assert.deepEqual(invHeaders, Array(4).fill("Инвентарный"));
  assert.deepEqual(mergeRanges(ws), mergeRanges(s));
  assert.equal(ws.pageSetup.paperSize, 9);
  assert.equal(ws.pageSetup.fitToPage, true);
  assert.equal(ws.getCell("B7").alignment?.wrapText, true);
  assert.equal(ws.getCell("B7").border?.top?.style, "thin");
});

test("five lines shift the second copy and keep merges disjoint", async () => {
  const lines = [1, 2, 3, 4, 5].map((i) => ({ name: `Позиция ${i}`, invNumber: `INV${i}`, serialNumber: `SN${i}`, qty: i }));
  const ws = await load(await buildActXlsx({ ...base, lines }));
  for (let i = 0; i < 5; i++) {
    assert.equal(v(ws, `A${7 + i}`), i + 1);
    assert.equal(v(ws, `B${7 + i}`), `Позиция ${i + 1}`);
    assert.equal(v(ws, `G${7 + i}`), `INV${i + 1}`);
    assert.equal(v(ws, `I${7 + i}`), `SN${i + 1}`);
    assert.equal(v(ws, `K${7 + i}`), i + 1);
    assert.equal(v(ws, `B${32 + i}`), `Позиция ${i + 1}`);
    assert.equal(ws.getCell(`B${7 + i}`).border?.bottom?.style, "thin");
  }
  assert.equal(v(ws, "A19"), "ТМЦ передал: Иванов И. И.");
  assert.equal(v(ws, "A24"), "Подразделение: Бухгалтерия");
  assert.equal(v(ws, "A26"), "Акт приема-передачи ТМЦ от 03 ноября 2026 г.");
  assert.equal(v(ws, "A44"), "ТМЦ передал: Иванов И. И.");
  assert.equal(v(ws, "A49"), "Подразделение: Бухгалтерия");
  let sig = 0;
  ws.eachRow((row) => row.eachCell((c) => { if (c.value === "(подпись)" && c.address === c.master.address) sig++; }));
  assert.equal(sig, 4);
  // merges must not overlap
  const cells = new Set<string>();
  for (const m of ws.model.merges as string[]) {
    const [a, b] = m.split(":").map((x) => ws.getCell(x));
    for (let r = Number(a.row); r <= Number(b.row); r++)
      for (let c = Number(a.col); c <= Number(b.col); c++) {
        const k = `${r}:${c}`;
        assert.ok(!cells.has(k), `overlap at ${m}`);
        cells.add(k);
      }
  }
  assert.equal(ws.getRow(25).getCell(1).value, null);
});

test("note is written in both copies", async () => {
  const ws = await load(await buildActXlsx({ ...base, note: "Выдано взамен сломанной" }));
  assert.equal(v(ws, "A13"), "Выдано взамен сломанной");
  assert.equal(v(ws, "A34"), "Выдано взамен сломанной");
  const empty = await load(await buildActXlsx(base));
  assert.equal(v(empty, "A12"), "Примечание:");
  assert.equal(v(empty, "A13"), null);
});

test("long item name gets a taller row; short name keeps sample height", async () => {
  const long = await load(await buildActXlsx({ ...base, lines: [{ name: FILTER + " " + FILTER, invNumber: "", serialNumber: "", qty: 1 }] }));
  assert.ok((long.getRow(7).height ?? 0) > 34.5);
  const short = await load(await buildActXlsx({ ...base, lines: [{ name: "Мышь", invNumber: "", serialNumber: "", qty: 1 }] }));
  assert.equal(short.getRow(7).height, 34.5);
});

test("more than 8 lines puts the second copy on its own page", async () => {
  const lines = Array.from({ length: 10 }, (_, i) => ({ name: `П${i}`, invNumber: "", serialNumber: "", qty: 1 }));
  const ws = await load(await buildActXlsx({ ...base, lines }));
  assert.equal(ws.pageSetup.fitToPage, false);
  assert.equal(v(ws, `A${1 + 20 + 9 + 1}`), "Акт приема-передачи ТМЦ от 03 ноября 2026 г.");
});

test("review: ~90-char item name gets a third text line of height", async () => {
  const name = "Мышь беспроводная Logitech M185 оптическая, 1000 dpi, USB-приёмник Unifying, серая, 2 кн";
  assert.equal(name.length, 88);
  const ws = await load(await buildActXlsx({ ...base, lines: [{ name, invNumber: "", serialNumber: "", qty: 1 }] }));
  assert.ok((ws.getRow(7).height ?? 0) >= 45, `height ${ws.getRow(7).height}`);
  const sampleName = await load(await buildActXlsx(base));
  assert.equal(sampleName.getRow(7).height, 34.5);
});

test("review: >8 lines disables fit-to-page so the manual break is honoured", async () => {
  for (const n of [9, 20]) {
    const lines = Array.from({ length: n }, (_, i) => ({ name: `П${i}`, invNumber: "", serialNumber: "", qty: 1 }));
    const buf = await buildActXlsx({ ...base, lines });
    const ws = await load(buf);
    assert.equal(ws.pageSetup.fitToPage, false, `n=${n}`);
    const scale = ws.pageSetup.scale ?? 100;
    assert.ok(scale >= 10 && scale <= 90, `scale ${scale}`);
    const top2 = 1 + 20 + n - 1 + 1;
    // exceljs does not read rowBreaks back, so check the sheet XML itself
    const zip = await JSZip.loadAsync(buf);
    const sheet = Object.keys(zip.files).find((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))!;
    const xml = await zip.file(sheet)!.async("string");
    assert.doesNotMatch(xml, /fitToPage="1"/, `n=${n}`);
    const brk = [...xml.matchAll(/<brk id="(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(brk, [top2 - 1], `n=${n}`);
    // one copy must fit the printable A4 height at that scale
    let h = 0;
    for (let r = 1; r < top2; r++) h += ws.getRow(r).height ?? 15;
    const printable = (842 - 72 * ((ws.pageSetup.margins?.top ?? 0.75) + (ws.pageSetup.margins?.bottom ?? 0.75)));
    assert.ok((h * scale) / 100 <= printable, `n=${n}: ${h}pt at ${scale}% > ${printable}`);
  }
});

test("review: long note wraps with enough height in both copies", async () => {
  const note = "Выдано взамен неисправного устройства, старое устройство сдано на склад ИТ, акт списания будет оформлен отдельно бухгалтерией в течение недели.";
  const ws = await load(await buildActXlsx({ ...base, note }));
  for (const r of [13, 34]) {
    assert.equal(ws.getCell(`A${r}`).alignment?.wrapText, true, `row ${r}`);
    assert.ok((ws.getRow(r).height ?? 15) >= 30, `row ${r} height ${ws.getRow(r).height}`);
  }
});

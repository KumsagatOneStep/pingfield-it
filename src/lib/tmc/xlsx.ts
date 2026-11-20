// Builds the "Акт приема-передачи ТМЦ" workbook. Layout comes from the paper
// sample (template.ts): rows 1–20 of it are one copy of the act; row 7 is the
// item row and is repeated once per line. Two copies are written one under the other.
import ExcelJS from "exceljs";
import { TEMPLATE_B64 } from "./template.ts";
import { formatActDate } from "./date.ts";
import type { ActLineInput } from "./validate.ts";

export type ActForSheet = {
  actDate: string; // YYYY-MM-DD
  org: string;
  recipientName: string;
  recipientPosition: string;
  department: string;
  giverName: string;
  giverPosition: string;
  note: string;
  lines: ActLineInput[];
};

const COLS = 11; // A..K
const PROTO_ROWS = 20;
const ITEM_ROW = 7;
const NOTE_ROW = 13;
const ONE_PAGE_MAX_LINES = 8;
const ITEM_ROW_HEIGHT = 34.5; // sample height, fits two lines of the name
// Conservative for Arial 11 in merged B:F (Excel wraps on word boundaries); the
// 79-char sample name still fits two lines.
const NAME_CHARS_PER_LINE = 40;
const NOTE_CHARS_PER_LINE = 85; // merged A:K
const LINE_PT = 15;
const A4_HEIGHT_PT = 842;
const MAX_SPLIT_SCALE = 90; // the sample prints at 90%

type Merge = { r1: number; c1: number; r2: number; c2: number };
type ProtoRow = { height?: number; cells: { value: ExcelJS.CellValue; style: Partial<ExcelJS.Style> }[] };

function parseMerge(ws: ExcelJS.Worksheet, range: string): Merge {
  const [a, b] = range.split(":").map((x) => ws.getCell(x));
  return { r1: Number(a.row), c1: Number(a.col), r2: Number(b.row), c2: Number(b.col) };
}

function itemRowHeight(name: string): number {
  const lines = Math.ceil(name.length / NAME_CHARS_PER_LINE);
  return lines <= 2 ? ITEM_ROW_HEIGHT : lines * LINE_PT + 4.5;
}

export async function buildActXlsx(act: ActForSheet): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(TEMPLATE_B64, "base64") as unknown as ArrayBuffer);
  const src = wb.worksheets[0];

  const proto: ProtoRow[] = [];
  for (let r = 1; r <= PROTO_ROWS; r++) {
    const row = src.getRow(r);
    const cells = [];
    for (let c = 1; c <= COLS; c++) {
      const cell = row.getCell(c);
      const isMaster = !cell.isMerged || cell.master.address === cell.address;
      cells.push({ value: isMaster ? cell.value : null, style: structuredClone(cell.style) });
    }
    proto.push({ height: row.height, cells });
  }
  const protoMerges = (src.model.merges as string[]).map((m) => parseMerge(src, m)).filter((m) => m.r2 <= PROTO_ROWS);

  const sheetName = src.name;
  src.name = "template";
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: structuredClone(src.pageSetup),
    properties: structuredClone(src.properties),
    views: structuredClone(src.views),
  });
  for (let c = 1; c <= COLS; c++) ws.getColumn(c).width = src.getColumn(c).width;
  wb.removeWorksheet(src.id);

  const n = act.lines.length;
  const blockRows = PROTO_ROWS + n - 1;
  // proto row (1-based) → sheet row for a copy starting at `top`
  const at = (top: number, r: number) => top - 1 + (r <= ITEM_ROW ? r : r + n - 1);

  const writeCopy = (top: number) => {
    proto.forEach((p, i) => {
      const r = i + 1;
      const targets = r === ITEM_ROW ? act.lines.map((_, k) => top - 1 + ITEM_ROW + k) : [at(top, r)];
      for (const t of targets) {
        const row = ws.getRow(t);
        if (p.height) row.height = p.height;
        p.cells.forEach((pc, ci) => {
          const cell = row.getCell(ci + 1);
          cell.style = structuredClone(pc.style);
          cell.value = pc.value;
        });
      }
    });
    for (const m of protoMerges) {
      if (m.r1 === ITEM_ROW) {
        for (let k = 0; k < n; k++) ws.mergeCells(top - 1 + ITEM_ROW + k, m.c1, top - 1 + ITEM_ROW + k, m.c2);
      } else {
        ws.mergeCells(at(top, m.r1), m.c1, at(top, m.r2), m.c2);
      }
    }

    const set = (r: number, col: string, value: ExcelJS.CellValue) => {
      ws.getCell(`${col}${at(top, r)}`).value = value;
    };
    set(1, "A", `Акт приема-передачи ТМЦ от ${formatActDate(act.actDate)}`);
    set(3, "B", act.recipientName);
    set(3, "G", act.org);
    set(6, "G", "Инвентарный"); // column header; the sample says "Инвентарный номер"
    act.lines.forEach((l, k) => {
      const r = top - 1 + ITEM_ROW + k;
      const row = ws.getRow(r);
      row.getCell("A").value = k + 1;
      row.getCell("B").value = l.name;
      row.getCell("G").value = l.invNumber || null;
      row.getCell("I").value = l.serialNumber || null;
      row.getCell("K").value = l.qty;
      row.height = itemRowHeight(l.name);
    });
    set(NOTE_ROW, "A", act.note || null);
    if (act.note) {
      const noteCell = ws.getCell(`A${at(top, NOTE_ROW)}`);
      noteCell.alignment = { ...noteCell.alignment, wrapText: true, vertical: "top" };
      const lines = Math.ceil(act.note.length / NOTE_CHARS_PER_LINE);
      if (lines > 1) ws.getRow(at(top, NOTE_ROW)).height = lines * LINE_PT;
    }
    set(15, "A", `ТМЦ передал: ${act.giverName}`);
    set(16, "A", `Должность: ${act.giverPosition}`);
    set(18, "A", `ТМЦ принял (-а): ${act.recipientName}`);
    set(19, "A", `Должность: ${act.recipientPosition}`);
    set(20, "A", `Подразделение: ${act.department}`);
  };

  const top2 = blockRows + 2;
  writeCopy(1);
  writeCopy(top2);
  if (n > ONE_PAGE_MAX_LINES) {
    // Excel ignores manual breaks while "Fit to page" is on: switch it off and pick
    // a fixed scale at which one copy fits the printable height of A4.
    ws.getRow(top2 - 1).addPageBreak();
    let copyHeight = 0;
    for (let r = 1; r < top2; r++) copyHeight += ws.getRow(r).height ?? LINE_PT;
    const m = ws.pageSetup.margins ?? { top: 0.75, bottom: 0.75 };
    const printable = A4_HEIGHT_PT - 72 * ((m.top ?? 0.75) + (m.bottom ?? 0.75));
    ws.pageSetup.fitToPage = false;
    ws.pageSetup.scale = Math.max(10, Math.min(MAX_SPLIT_SCALE, Math.floor((printable * 100) / copyHeight)));
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

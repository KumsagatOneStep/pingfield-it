import type { MoveInput, MoveLine } from "./validate.ts";

// Parameter for jsonb_to_recordset in the insert of a move's lines.
export function linesJson(lines: MoveLine[]): string {
  return JSON.stringify(lines.map((l, i) => ({ pos: i + 1, model: l.model, qty: l.qty, written_off: l.writtenOff })));
}

// Shape stored in audit_log; lines are text so the audit page shows them readably.
export function moveSnapshot(m: MoveInput) {
  return {
    move_date: m.moveDate,
    from_place: m.fromPlace,
    to_place: m.toPlace,
    note: m.note,
    lines: m.lines.map((l) => `${l.model} × ${l.qty}${l.writtenOff ? ` (списано ${l.writtenOff})` : ""}`).join("; "),
  };
}

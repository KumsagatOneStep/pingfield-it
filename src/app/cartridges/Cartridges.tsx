"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { HUB, MAX_MOVE_LINES, OBJECTS, PLACES, CONTRACTOR } from "@/lib/cartridges/constants";
import type { ObjectRow, ContractorRow } from "@/lib/cartridges/report";
import { almatyToday, isSameAlmatyDay } from "@/lib/tmc/date";
import ItemsPanel, { type Item } from "../acts/ItemsPanel";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, DropdownValue } from "../ui/Dropdown";

type Me = { id: number; isAdmin: boolean };
type MoveLineRow = { model: string; qty: number; written_off: number };
type Move = {
  id: number;
  move_date: string;
  from_place: string;
  to_place: string;
  note: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  lines: MoveLineRow[];
};
type Line = { key: number; model: string; qty: string; writtenOff: string };
type Report = { kind: "contractor"; rows: ContractorRow[] } | { kind: "object"; rows: ObjectRow[] };

const REPORT_PLACES: readonly string[] = [CONTRACTOR, ...OBJECTS];
const MODELS_LABELS = {
  title: "Справочник моделей",
  hint: "Модели картриджей",
  placeholder: "Новая модель, напр. CE285A",
  aria: "Новая модель",
};

// Fixed key for the server-rendered line: a module counter differs between server and browser.
const FIRST_LINE: Line = { key: 0, model: "", qty: "", writtenOff: "" };
let lineKey = 0;
const newLine = (model = "", qty = "", writtenOff = ""): Line => ({ key: ++lineKey, model, qty, writtenOff });
const fmtDay = (iso: string) => iso.split("-").reverse().join(".");

export default function Cartridges({ me }: { me: Me }) {
  const [tab, setTab] = useState<"moves" | "models">("moves");
  const [models, setModels] = useState<Item[] | null>(null);
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [listError, setListError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editOriginalModels, setEditOriginalModels] = useState<Set<string>>(new Set());
  const [moveDate, setMoveDate] = useState(almatyToday());
  const [fromPlace, setFromPlace] = useState(HUB);
  const [toPlace, setToPlace] = useState(CONTRACTOR);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([FIRST_LINE]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLElement>(null);

  const [place, setPlace] = useState<string>(CONTRACTOR);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState("");
  const reportRequest = useRef(0);

  const fromContractor = fromPlace === CONTRACTOR;

  const loadModels = useCallback(async () => {
    try {
      setModels((await api<{ items: Item[] }>("/api/cartridges/models")).items);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  const loadMoves = useCallback(async () => {
    try {
      setMoves((await api<{ moves: Move[] }>("/api/cartridges/moves")).moves);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  const loadReport = useCallback(async () => {
    const q = new URLSearchParams({ place, from, to });
    // Dates change quickly: only the latest request may update the table.
    const request = ++reportRequest.current;
    try {
      const r = await api<Report>(`/api/cartridges/report?${q}`);
      if (request !== reportRequest.current) return;
      setReport(r);
      setReportError("");
    } catch (e) {
      if (request !== reportRequest.current) return;
      setReport(null);
      setReportError((e as Error).message);
    }
  }, [place, from, to]);

  useEffect(() => { loadModels(); loadMoves(); }, [loadModels, loadMoves]);
  useEffect(() => { loadReport(); }, [loadReport]);

  const activeModels = useMemo(() => new Set((models ?? []).filter((m) => m.active).map((m) => m.name)), [models]);
  const isKnown = (name: string) => activeModels.has(name) || editOriginalModels.has(name);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Every move goes through the head office, so picking one side settles the other.
  // Write-offs stay in the lines when the direction changes; submit refuses them unless the move is from CONTRACTOR.
  function changeFrom(v: string) {
    setFromPlace(v);
    if (v !== HUB) setToPlace(HUB);
    else if (toPlace === HUB) setToPlace(CONTRACTOR);
  }
  function changeTo(v: string) {
    setToPlace(v);
    setFromPlace(v !== HUB ? HUB : fromPlace === HUB ? CONTRACTOR : fromPlace);
  }

  function resetForm() {
    setEditId(null);
    setEditOriginalModels(new Set());
    setMoveDate(almatyToday());
    setFromPlace(HUB);
    setToPlace(CONTRACTOR);
    setNote("");
    setLines([newLine()]);
    setFormError("");
  }

  function startEdit(m: Move) {
    setEditId(m.id);
    setEditOriginalModels(new Set(m.lines.map((l) => l.model)));
    setMoveDate(m.move_date);
    setFromPlace(m.from_place);
    setToPlace(m.to_place);
    setNote(m.note);
    setLines(m.lines.map((l) => newLine(l.model, String(l.qty), l.written_off ? String(l.written_off) : "")));
    setFormError("");
    formRef.current?.scrollIntoView();
  }

  async function addToCatalog(line: Line) {
    setFormError("");
    try {
      await api("/api/cartridges/models", "POST", { name: line.model });
      setLine(line.key, { model: line.model.trim() });
      await loadModels();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const unknown = lines.find((l) => l.model.trim() && !isKnown(l.model.trim()));
    if (unknown) {
      setFormError(`«${unknown.model.trim()}» нет в справочнике. Выберите модель из списка или добавьте её в справочник.`);
      return;
    }
    if (!fromContractor && lines.some((l) => l.writtenOff.trim() !== "" && Number(l.writtenOff) !== 0)) {
      setFormError("Списание возможно только при возврате от подрядчика — уберите списанные или верните «Откуда» = подрядчик");
      return;
    }
    const empty = lines.find((l) => l.qty.trim() === "" && (!fromContractor || l.writtenOff.trim() === ""));
    if (empty) {
      setFormError("Укажите количество");
      return;
    }
    setSaving(true);
    try {
      const body = {
        moveDate,
        fromPlace,
        toPlace,
        note,
        lines: lines.map((l) => ({
          model: l.model,
          qty: l.qty.trim() === "" ? 0 : Number(l.qty),
          writtenOff: !fromContractor || l.writtenOff.trim() === "" ? 0 : Number(l.writtenOff),
        })),
      };
      if (editId === null) await api("/api/cartridges/moves", "POST", body);
      else await api(`/api/cartridges/moves/${editId}`, "PATCH", body);
      resetForm();
      loadMoves();
      loadReport();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setListError("");
    try {
      await api(`/api/cartridges/moves/${id}`, "DELETE");
      setConfirmId(null);
      if (editId === id) resetForm();
      loadMoves();
      loadReport();
    } catch (e) {
      setListError((e as Error).message);
    }
  }

  const canChange = (m: Move) => me.isAdmin || (m.created_by === me.id && isSameAlmatyDay(new Date(m.created_at), new Date()));

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Картриджи</h1>
          <p className="sub">Куда отправили, сколько получили и сколько ещё не вернулось.</p>
        </div>
      </header>

      {loadError && <div className="err" role="alert">{loadError}</div>}

      <div className="tabs" role="group" aria-label="Раздел">
        <button type="button" aria-pressed={tab === "moves"} onClick={() => setTab("moves")}>Учёт</button>
        <button type="button" aria-pressed={tab === "models"} onClick={() => setTab("models")}>Справочник моделей</button>
      </div>

      {tab === "models" ? (
        <ItemsPanel items={models} isAdmin={me.isAdmin} reload={loadModels} apiPath="/api/cartridges/models" labels={MODELS_LABELS} />
      ) : (
        <>
          <section className="panel" aria-labelledby="cmFormTitle" ref={formRef}>
            <div className="panel-head">
              <h2 id="cmFormTitle">{editId === null ? "Новая запись" : "Исправление записи"}</h2>
            </div>
            <form className="stack" onSubmit={submit} noValidate>
              <div className="row">
                <div className="field">
                  <label htmlFor="cmDate">Дата</label>
                  <input id="cmDate" type="date" max={almatyToday()} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="cmFrom">Откуда</label>
                  <Dropdown block value={fromPlace} onValueChange={changeFrom}>
                    <DropdownTrigger id="cmFrom"><DropdownValue /></DropdownTrigger>
                    <DropdownContent matchTriggerWidth>
                      {PLACES.map((p) => <DropdownItem key={p} value={p}>{p}</DropdownItem>)}
                    </DropdownContent>
                  </Dropdown>
                </div>
                <div className="field">
                  <label htmlFor="cmTo">Куда</label>
                  <Dropdown block value={toPlace} onValueChange={changeTo}>
                    <DropdownTrigger id="cmTo"><DropdownValue /></DropdownTrigger>
                    <DropdownContent matchTriggerWidth>
                      {PLACES.map((p) => <DropdownItem key={p} value={p}>{p}</DropdownItem>)}
                    </DropdownContent>
                  </Dropdown>
                </div>
              </div>

              <fieldset className="lines">
                <legend>Модели</legend>
                <datalist id="cartridgeModels">
                  {(models ?? []).filter((m) => m.active).map((m) => <option key={m.id} value={m.name} />)}
                </datalist>
                {lines.map((l, idx) => {
                  const name = l.model.trim();
                  const missing = name !== "" && models !== null && !isKnown(name);
                  return (
                    <div className="line" key={l.key}>
                      <div className="field">
                        <label htmlFor={`cm${l.key}`}>{idx + 1}. Модель картриджа</label>
                        <input id={`cm${l.key}`} list="cartridgeModels" value={l.model} onChange={(e) => setLine(l.key, { model: e.target.value })}
                          maxLength={300} placeholder="Начните вводить и выберите из списка" autoComplete="off" />
                        {missing && (
                          <span className="help">
                            Нет в справочнике.{" "}
                            <button type="button" className="small" onClick={() => addToCatalog(l)}>Добавить в справочник</button>
                          </span>
                        )}
                      </div>
                      <div className="line-meta">
                        <div className="field qty">
                          <label htmlFor={`cq${l.key}`}>{fromContractor ? "Годных" : "Количество"}</label>
                          <input id={`cq${l.key}`} type="number" min={0} max={9999} step={1} value={l.qty}
                            onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                        </div>
                        {fromContractor && (
                          <div className="field qty">
                            <label htmlFor={`cw${l.key}`}>Списано</label>
                            <input id={`cw${l.key}`} type="number" min={0} max={9999} step={1} value={l.writtenOff}
                              onChange={(e) => setLine(l.key, { writtenOff: e.target.value })} />
                          </div>
                        )}
                        {lines.length > 1 && (
                          <button type="button" className="small" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                            aria-label={`Убрать модель ${idx + 1}`}>Убрать</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {lines.length < MAX_MOVE_LINES && (
                  <div><button type="button" className="small" onClick={() => setLines((ls) => [...ls, newLine()])}>+ модель</button></div>
                )}
              </fieldset>

              <div className="field">
                <label htmlFor="cmNote">Примечание</label>
                <input id="cmNote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="необязательно" />
              </div>

              {formError && <div className="err" role="alert">{formError}</div>}
              <div className="actions">
                <div className="right">
                  {editId !== null && <button type="button" onClick={resetForm}>Отмена</button>}
                  <button type="submit" className="primary" disabled={saving}>
                    {saving ? "Сохраняю…" : editId === null ? "Сохранить" : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="cmReportTitle">
            <div className="panel-head">
              <h2 id="cmReportTitle">Отчёт</h2>
            </div>
            <div className="tabs" role="group" aria-label="Место">
              {REPORT_PLACES.map((p) => (
                <button key={p} type="button" aria-pressed={place === p} onClick={() => setPlace(p)}>{p}</button>
              ))}
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="cmFromDate">С</label>
                <input id="cmFromDate" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cmToDate">По</label>
                <input id="cmToDate" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            {reportError && <div className="err" role="alert">{reportError}</div>}
            <div className="tablewrap">
              <ReportTable report={report} failed={Boolean(reportError)} />
            </div>
          </section>

          <section className="panel" aria-labelledby="cmLogTitle">
            <div className="panel-head">
              <h2 id="cmLogTitle">Журнал</h2>
              <span className="meta">Последние 200</span>
            </div>
            {listError && <div className="err" role="alert">{listError}</div>}
            <div className="tablewrap">
              <table>
                <thead><tr><th>Дата</th><th>Откуда → куда</th><th>Модели</th><th>Кто записал</th><th></th></tr></thead>
                <tbody>
                  {!moves && <tr><td colSpan={5} className="empty">Загрузка…</td></tr>}
                  {moves?.length === 0 && <tr><td colSpan={5} className="empty">Записей пока нет</td></tr>}
                  {moves?.map((m) => (
                    <tr key={m.id}>
                      <td className="nowrap mono">{fmtDay(m.move_date)}</td>
                      <td>{m.from_place} → {m.to_place}{m.note && <><br /><span className="meta">{m.note}</span></>}</td>
                      <td>
                        {m.lines.map((l) => (
                          <div key={l.model}>
                            {l.model} <span className="meta">× {l.qty}{l.written_off > 0 && `, списано ${l.written_off}`}</span>
                          </div>
                        ))}
                      </td>
                      <td className="nowrap">{m.created_by_username ?? "—"}</td>
                      <td className="nowrap">
                        {canChange(m) && (
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {confirmId === m.id ? (
                              <>
                                <button type="button" className="small danger solid" onClick={() => remove(m.id)}>Да, удалить</button>
                                <button type="button" className="small" onClick={() => setConfirmId(null)}>Нет</button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="small" onClick={() => startEdit(m)}>Исправить</button>
                                <button type="button" className="small danger" onClick={() => setConfirmId(m.id)}>Удалить</button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function ReportTable({ report, failed }: { report: Report | null; failed: boolean }) {
  if (failed) return null;
  if (!report) return <p className="empty">Загрузка…</p>;
  if (report.rows.length === 0) return <p className="empty">Данных пока нет</p>;
  if (report.kind === "contractor") {
    return (
      <table>
        <thead><tr><th>Модель</th><th>Отправили</th><th>Вернулось</th><th>Списано</th><th>Ещё там</th></tr></thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.model}><td>{r.model}</td><td>{r.sent}</td><td>{r.returned}</td><td>{r.writtenOff}</td><td><b>{r.remaining}</b></td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table>
      <thead><tr><th>Модель</th><th>Получили от объекта</th><th>Вернули на объект</th><th>Ждут возврата</th></tr></thead>
      <tbody>
        {report.rows.map((r) => (
          <tr key={r.model}><td>{r.model}</td><td>{r.received}</td><td>{r.returned}</td><td><b>{r.waiting}</b></td></tr>
        ))}
      </tbody>
    </table>
  );
}

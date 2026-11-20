"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { SUBDEPARTMENTS, TOP_DEPARTMENTS } from "@/lib/tmc/constants";
import { almatyToday, formatActDate, isSameAlmatyDay } from "@/lib/tmc/date";
import { formatPersonName, MAX_LINES } from "@/lib/tmc/validate";
import { addPicksToLines } from "@/lib/tmc/catalog";
import TmcItemsPanel from "./TmcItemsPanel";
import TmcOrgsPanel, { type TmcOrg } from "./TmcOrgsPanel";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, DropdownValue } from "../ui/Dropdown";
import CatalogPicker, { type CatalogPickerHandle } from "./CatalogPicker";
import type { TmcItem } from "./catalog-shared";

type Me = { id: number; isAdmin: boolean; actName: string; position: string };
type Act = {
  id: number;
  act_date: string;
  org: string;
  recipient_name: string;
  recipient_position: string;
  department: string;
  giver_name: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  lines: { pos: number; name: string; qty: number }[];
};
type Line = { key: number; name: string; qty: string; invNumber: string; serialNumber: string };
type Tab = "acts" | "items" | "orgs";

const ORG_KEY = "tmc.lastOrg";
const fileUrl = (id: number) => `/api/tmc/acts/${id}/file`;
const fmtDay = (iso: string) => iso.split("-").reverse().join(".");

let lineSeq = 0;
const newLine = (): Line => ({ key: ++lineSeq, name: "", qty: "1", invNumber: "", serialNumber: "" });
// The first line has a fixed key: the module counter differs between server and browser,
// and a counter-based id on the first render caused a hydration mismatch.
const FIRST_LINE: Line = { key: 0, name: "", qty: "1", invNumber: "", serialNumber: "" };

// The organization used last time, if it is still in the list; otherwise the first one.
function readLastOrg(names: string[]): string {
  try {
    const v = localStorage.getItem(ORG_KEY);
    if (v && names.includes(v)) return v;
  } catch { /* storage unavailable */ }
  return names[0] ?? "";
}

export default function Acts({ me }: { me: Me }) {
  const [tab, setTab] = useState<Tab>("acts");
  const [acts, setActs] = useState<Act[] | null>(null);
  const [items, setItems] = useState<TmcItem[] | null>(null);
  const [orgs, setOrgs] = useState<TmcOrg[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [listError, setListError] = useState("");

  const [org, setOrg] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPosition, setRecipientPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([FIRST_LINE]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pickerRef = useRef<CatalogPickerHandle>(null);

  const canIssue = Boolean(me.actName && me.position);

  const loadActs = useCallback(async (q: string) => {
    try {
      const r = await api<{ acts: Act[] }>(`/api/tmc/acts?q=${encodeURIComponent(q)}`);
      setActs(r.acts);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  const loadItems = useCallback(async () => {
    try {
      setItems((await api<{ items: TmcItem[] }>("/api/tmc/items")).items);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  const loadOrgs = useCallback(async () => {
    try {
      setOrgs((await api<{ orgs: TmcOrg[] }>("/api/tmc/orgs")).orgs);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => { loadItems(); loadOrgs(); }, [loadItems, loadOrgs]);
  useEffect(() => {
    const t = setTimeout(() => loadActs(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query, loadActs]);

  const activeNames = useMemo(() => new Set((items ?? []).filter((i) => i.active).map((i) => i.name)), [items]);

  function openForm() {
    setOrg(readLastOrg((orgs ?? []).map((o) => o.name)));
    setRecipientName("");
    setRecipientPosition("");
    setDepartment("");
    setNote("");
    setLines([newLine()]);
    setFormError("");
    dialogRef.current?.showModal();
  }

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function addFromCatalog(picks: { name: string; qty: number }[]): string | null {
    const r = addPicksToLines(lines, picks, MAX_LINES, (name, qty) => ({ ...newLine(), name, qty: String(qty) }));
    if ("error" in r) return r.error;
    setLines(r.lines);
    setFormError("");
    return null;
  }

  async function addToCatalog(line: Line) {
    setFormError("");
    try {
      await api("/api/tmc/items", "POST", { name: line.name });
      setLine(line.key, { name: line.name.trim() });
      await loadItems();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const unknown = lines.find((l) => l.name.trim() && !activeNames.has(l.name.trim()));
    if (unknown) {
      setFormError(`«${unknown.name.trim()}» нет в справочнике. Выберите наименование из списка или добавьте его в справочник.`);
      return;
    }
    setSaving(true);
    try {
      const body = {
        org,
        recipientName,
        recipientPosition,
        department,
        note,
        lines: lines.map((l) => ({ name: l.name, qty: Number(l.qty), invNumber: l.invNumber, serialNumber: l.serialNumber })),
      };
      const r = await api<{ act: { id: number } }>("/api/tmc/acts", "POST", body);
      try { localStorage.setItem(ORG_KEY, org); } catch { /* storage unavailable */ }
      dialogRef.current?.close();
      window.location.href = fileUrl(r.act.id);
      loadActs(query.trim());
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setListError("");
    try {
      await api(`/api/tmc/acts/${id}`, "DELETE");
      setConfirmId(null);
      loadActs(query.trim());
    } catch (e) {
      setListError((e as Error).message);
    }
  }

  const canDelete = (a: Act) => me.isAdmin || (a.created_by === me.id && isSameAlmatyDay(new Date(a.created_at), new Date()));

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Акты ТМЦ</h1>
          <p className="sub">Акт приема-передачи: заполните получателя и позиции, файл скачается готовым к печати.</p>
        </div>
        <button className="primary" type="button" onClick={openForm} disabled={!canIssue || !orgs?.length}>Новый акт</button>
      </header>

      {!canIssue && (
        <div className="err" role="alert">
          Чтобы оформлять акты, попросите администратора заполнить ваши «ФИО для актов» и «Должность» в разделе «Пользователи».
        </div>
      )}
      {loadError && <div className="err" role="alert">{loadError}</div>}

      <div className="tabs" role="group" aria-label="Раздел">
        <button type="button" aria-pressed={tab === "acts"} onClick={() => setTab("acts")}>Журнал актов</button>
        <button type="button" aria-pressed={tab === "items"} onClick={() => setTab("items")}>Справочник наименований</button>
        {me.isAdmin && <button type="button" aria-pressed={tab === "orgs"} onClick={() => setTab("orgs")}>Организации</button>}
      </div>

      {tab === "items" ? (
        <TmcItemsPanel items={items} isAdmin={me.isAdmin} reload={loadItems} />
      ) : tab === "orgs" && me.isAdmin ? (
        <TmcOrgsPanel orgs={orgs} reload={loadOrgs} />
      ) : (
        <section className="panel" aria-labelledby="actsTitle">
          <div className="panel-head">
            <h2 id="actsTitle">Журнал актов</h2>
            <span className="meta">Последние 200</span>
          </div>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по ФИО получателя или наименованию" aria-label="Поиск актов" />
          {listError && <div className="err" role="alert">{listError}</div>}
          <div className="tablewrap">
            <table>
              <thead><tr><th>Дата</th><th>Получатель</th><th>Подразделение</th><th>Позиции</th><th>Выдал</th><th></th></tr></thead>
              <tbody>
                {!acts && <tr><td colSpan={6} className="empty">Загрузка…</td></tr>}
                {acts?.length === 0 && <tr><td colSpan={6} className="empty">{query.trim() ? "Ничего не найдено" : "Актов пока нет"}</td></tr>}
                {acts?.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap mono">{fmtDay(a.act_date)}</td>
                    <td>{a.recipient_name}<br /><span className="meta">{a.recipient_position} · {a.org}</span></td>
                    <td>{a.department}</td>
                    <td>{a.lines.map((l) => <div key={l.pos}>{l.name} <span className="meta">× {l.qty}</span></div>)}</td>
                    <td className="nowrap">{a.giver_name}<br /><span className="meta">{a.created_by_username ?? "—"}</span></td>
                    <td className="nowrap">
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <a className="btnlink small" href={fileUrl(a.id)}>Скачать</a>
                        {canDelete(a) && (confirmId === a.id ? (
                          <>
                            <button type="button" className="small danger solid" onClick={() => remove(a.id)}>Да, удалить</button>
                            <button type="button" className="small" onClick={() => setConfirmId(null)}>Нет</button>
                          </>
                        ) : (
                          <button type="button" className="small danger" onClick={() => setConfirmId(a.id)}>Удалить</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <dialog ref={dialogRef} className="wide" aria-labelledby="actFormTitle">
        <form className="stack" onSubmit={submit} noValidate>
          <h2 id="actFormTitle">Новый акт от {formatActDate(almatyToday())}</h2>
          <div className="meta">Передал: <b>{me.actName}</b>, {me.position}</div>

          <div className="field">
            <label htmlFor="afOrg">Организация</label>
            <Dropdown block value={org} onValueChange={setOrg}>
                    <DropdownTrigger id="afOrg"><DropdownValue /></DropdownTrigger>
                    <DropdownContent matchTriggerWidth>
                      {(orgs ?? []).map((o) => <DropdownItem key={o.id} value={o.name}>{o.name}</DropdownItem>)}
                    </DropdownContent>
                  </Dropdown>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="afName">ФИО получателя</label>
              <input id="afName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                onBlur={(e) => setRecipientName(formatPersonName(e.target.value))} maxLength={120}
                placeholder="напр. Петров ПС" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="afPos">Должность получателя</label>
              <input id="afPos" value={recipientPosition} onChange={(e) => setRecipientPosition(e.target.value)} maxLength={120}
                placeholder="напр. Супервайзер область" autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="afDep">Подразделение</label>
            <Dropdown block value={department} onValueChange={setDepartment}>
                    <DropdownTrigger id="afDep"><DropdownValue /></DropdownTrigger>
                    <DropdownContent matchTriggerWidth>
                      <DropdownItem value="">— выберите —</DropdownItem>
                      {TOP_DEPARTMENTS.flatMap((d) => [
                        <DropdownItem key={d} value={d}>{d}</DropdownItem>,
                        ...(SUBDEPARTMENTS[d] ?? []).map((sub) => (
                          <DropdownItem key={sub} value={sub} indent>{sub}</DropdownItem>
                        )),
                      ])}
                    </DropdownContent>
                  </Dropdown>
          </div>

          <fieldset className="lines">
            <legend>Позиции</legend>
            <div className="lines-tools">
              <button type="button" className="primary small" onClick={() => pickerRef.current?.open()}>Выбрать из каталога</button>
              <span className="meta">или начните вводить название в строке</span>
            </div>
            <datalist id="tmcItems">
              {(items ?? []).filter((i) => i.active).map((i) => <option key={i.id} value={i.name} />)}
            </datalist>
            {lines.map((l, idx) => {
              const name = l.name.trim();
              const missing = name !== "" && items !== null && !activeNames.has(name);
              return (
                <div className="line" key={l.key}>
                  <div className="field">
                    <label htmlFor={`ln${l.key}`}>{idx + 1}. Наименование</label>
                    <input id={`ln${l.key}`} list="tmcItems" value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })}
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
                      <label htmlFor={`lq${l.key}`}>Кол-во</label>
                      <input id={`lq${l.key}`} type="number" min={1} max={9999} step={1} value={l.qty}
                        onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`li${l.key}`}>Инв. номер</label>
                      <input id={`li${l.key}`} value={l.invNumber} onChange={(e) => setLine(l.key, { invNumber: e.target.value })} maxLength={60} placeholder="необязательно" />
                    </div>
                    <div className="field">
                      <label htmlFor={`ls${l.key}`}>Заводской номер</label>
                      <input id={`ls${l.key}`} value={l.serialNumber} onChange={(e) => setLine(l.key, { serialNumber: e.target.value })} maxLength={60} placeholder="необязательно" />
                    </div>
                    {lines.length > 1 && (
                      <button type="button" className="small" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        aria-label={`Убрать позицию ${idx + 1}`}>Убрать</button>
                    )}
                  </div>
                </div>
              );
            })}
            {lines.length < MAX_LINES && (
              <div><button type="button" className="small" onClick={() => setLines((ls) => [...ls, newLine()])}>+ позиция</button></div>
            )}
          </fieldset>

          <div className="field">
            <label htmlFor="afNote">Примечание</label>
            <input id="afNote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="необязательно" />
          </div>

          {formError && <div className="err" role="alert">{formError}</div>}
          <div className="actions">
            <div className="right">
              <button type="button" onClick={() => dialogRef.current?.close()}>Отмена</button>
              <button type="submit" className="primary" disabled={saving}>{saving ? "Сохраняю…" : "Создать и скачать"}</button>
            </div>
          </div>
        </form>
      </dialog>
      <CatalogPicker ref={pickerRef} items={items} onAdd={addFromCatalog} />
    </main>
  );
}

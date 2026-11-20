"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { parseIp } from "@/lib/validate";
import { IP_EXAMPLE, SUBNET_CIDR, SUBNET_LABEL, SUBNET_PREFIX } from "@/lib/subnet";

type Printer = {
  id: number;
  ip: string;
  owner: string;
  room: string;
  model: string;
  note: string;
  updated_at: string;
  updated_by: string | null;
};
type Filter = "all" | "in" | "out" | "noip" | "dup";
type Draft = { id: number | null; ip: string; owner: string; room: string; model: string; note: string };

const PREFIX = SUBNET_PREFIX;
const REFRESH_MS = 30_000;

const inRange = (ip: string) => {
  const p = parseIp(ip);
  if (!p) return false;
  const last = Number(p.split(".")[3]);
  return p.startsWith(PREFIX) && last >= 1 && last <= 254;
};
const kind = (p: Printer) => (!p.ip ? "noip" : inRange(p.ip) ? "in" : "out");
const ipKey = (ip: string) => {
  const p = parseIp(ip);
  return p ? p.split(".").reduce((a, n) => a * 256 + Number(n), 0) : Infinity;
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Transform that puts the dialog box over the element it was opened from.
function fromSource(dialog: HTMLElement, source: HTMLElement) {
  const to = dialog.getBoundingClientRect();
  const from = source.getBoundingClientRect();
  if (!to.width || !from.width) return null;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return { dx, dy, sx: from.width / to.width, sy: from.height / to.height };
}

function StatusChip({ p, dup }: { p: Printer; dup: boolean }) {
  if (dup) return <span className="chip warn">Конфликт</span>;
  const k = kind(p);
  if (k === "noip") return <span className="chip noip">Без IP</span>;
  if (k === "out") return <span className="chip out">Др. подсеть</span>;
  return <span className="chip plain">Подсеть {SUBNET_LABEL}</span>;
}

const FILTERS: [Filter, string][] = [
  ["all", "Все"],
  ["in", SUBNET_LABEL],
  ["out", "Другие подсети"],
  ["noip", "Без IP"],
  ["dup", "Конфликты"],
];

export default function Registry({ canEdit }: { canEdit: boolean }) {
  const [printers, setPrinters] = useState<Printer[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const [force, setForce] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const [mode, setMode] = useState<"view" | "edit">("edit");
  const [openSeq, setOpenSeq] = useState(0);
  const listRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ printers: Printer[] }>("/api/printers");
      setPrinters(r.printers);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  // Pick up colleagues' changes: poll while the tab is visible, and on focus.
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const all = printers ?? [];
  const byIp = useMemo(() => {
    const m = new Map<string, Printer[]>();
    for (const p of all) if (p.ip) m.set(p.ip, [...(m.get(p.ip) ?? []), p]);
    return m;
  }, [all]);
  const dupIps = useMemo(() => new Set([...byIp].filter(([, l]) => l.length > 1).map(([ip]) => ip)), [byIp]);
  const busy = [...byIp.keys()].filter(inRange).length;
  const firstFree = useMemo(() => {
    for (let i = 1; i <= 254; i++) if (!byIp.has(PREFIX + i)) return PREFIX + i;
    return null;
  }, [byIp]);

  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (p: Printer) => !q || q.split(/\s+/).every((w) => [p.ip, p.owner, p.room, p.model, p.note].join(" ").toLowerCase().includes(w)),
    [q],
  );

  const rows = all
    .filter(matches)
    .filter((p) => (filter === "all" ? true : filter === "dup" ? !!p.ip && dupIps.has(p.ip) : kind(p) === filter))
    .sort((a, b) => ipKey(a.ip) - ipKey(b.ip) || a.owner.localeCompare(b.owner, "ru"));

  const owners = useMemo(() => [...new Set(all.map((p) => p.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [all]);

  // An existing printer opens as a card first; a new one goes straight to the form.
  function openEditor(p: Printer | null, presetIp = "", from: HTMLElement | null = null) {
    setDraft(p ? { id: p.id, ip: p.ip, owner: p.owner, room: p.room, model: p.model, note: p.note } : { id: null, ip: presetIp, owner: "", room: "", model: "", note: "" });
    setMode(p ? "view" : "edit");
    setFormError("");
    setForce(false);
    setConfirmDelete(false);
    sourceRef.current = from;
    stopDialogAnimations();
    dialogRef.current?.showModal();
    setOpenSeq((n) => n + 1);
  }

  // The card flies out of the cell or row it was opened from, along a slight arc.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const source = sourceRef.current;
    if (!openSeq || !dialog?.open) return;
    const k = source?.isConnected && !reducedMotion() ? fromSource(dialog, source) : null;
    if (!k) {
      if (!reducedMotion()) dialog.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });
      return;
    }
    const rise = Math.min(90, Math.abs(k.dy) * 0.25 + 24);
    dialog.animate([
      { transform: `translate(${k.dx}px, ${k.dy}px) scale(${k.sx}, ${k.sy})`, opacity: 0.6, borderRadius: "14px" },
      { transform: `translate(${k.dx * 0.4}px, ${k.dy * 0.4 - rise}px) scale(${((k.sx + 1) / 2) * 1.04}, ${((k.sy + 1) / 2) * 1.04})`, opacity: 1, offset: 0.5 },
      { transform: "none", opacity: 1 },
    ], { duration: 520, easing: "cubic-bezier(.22,.85,.3,1)" });
  }, [openSeq]);

  // A closing animation left running would later close the next card, so every open and close stops it.
  function stopDialogAnimations() {
    closingRef.current = false;
    dialogRef.current?.getAnimations().forEach((a) => a.cancel());
  }

  function closeEditor() {
    const dialog = dialogRef.current;
    if (!dialog?.open || closingRef.current) return;
    closingRef.current = true;
    const finish = () => {
      closingRef.current = false;
      dialog.close();
      setDraft(null);
    };
    const source = sourceRef.current;
    if (reducedMotion()) return finish();
    const k = source?.isConnected ? fromSource(dialog, source) : null;
    const frames = k
      ? [{ transform: "none", opacity: 1 }, { transform: `translate(${k.dx}px, ${k.dy}px) scale(${k.sx}, ${k.sy})`, opacity: 0.2 }]
      : [{ transform: "none", opacity: 1 }, { transform: "scale(.96)", opacity: 0 }];
    dialog.animate(frames, { duration: k ? 360 : 160, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" }).onfinish = () => {
      dialog.getAnimations().forEach((a) => a.cancel());
      finish();
    };
  }
  function openIp(ip: string, from: HTMLElement | null = null) {
    const list = byIp.get(ip) ?? [];
    if (list.length === 0) {
      if (canEdit) openEditor(null, ip, from);
    } else if (list.length === 1) {
      openEditor(list[0], "", from);
    } else {
      setQuery(ip);
      setFilter("all");
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function edit<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    if (k === "ip" || k === "owner") {
      setForce(false);
      setFormError("");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (draft.ip.trim() && !parseIp(draft.ip)) return setFormError(`IP-адрес записан неверно. Пример: ${IP_EXAMPLE}`);
    if (!draft.owner.trim()) return setFormError("Укажите владельца: отдел или сотрудника.");
    setSaving(true);
    try {
      const body = { ip: draft.ip, owner: draft.owner, room: draft.room, model: draft.model, note: draft.note, force };
      if (draft.id) await api(`/api/printers/${draft.id}`, "PUT", body);
      else await api("/api/printers", "POST", body);
      setToast(draft.id ? "Изменения сохранены" : "Принтер добавлен");
      closeEditor();
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data.conflict) {
        setForce(true);
        setFormError(`${err.message}. Нажмите «Сохранить» ещё раз, чтобы всё равно записать (будет отмечено как конфликт).`);
      } else setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    try {
      await api(`/api/printers/${draft.id}`, "DELETE");
      setToast("Запись удалена");
      closeEditor();
      load();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  const current = draft?.id ? all.find((p) => p.id === draft.id) : null;

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="label">Helpdesk · сеть печати</div>
          <h1>Реестр IP принтеров</h1>
          <p className="sub">
            Подсеть <span className="mono">{SUBNET_CIDR}</span>, адреса <span className="mono">.1–.254</span>
          </p>
        </div>
      </header>

      {loadError && <div className="err">{loadError}</div>}

      <section className="stats" aria-label="Сводка">
        <div className="stat"><span className="label">Занято в {SUBNET_LABEL}</span><b>{printers ? busy : "—"}</b></div>
        <div className="stat free"><span className="label">Свободно в {SUBNET_LABEL}</span><b>{printers ? 254 - busy : "—"}</b></div>
        <div className="stat warn"><span className="label">Конфликты</span><b>{printers ? dupIps.size : "—"}</b></div>
        <div className="stat"><span className="label">Вне {SUBNET_LABEL} / без IP</span><b>{printers ? all.filter((p) => kind(p) !== "in").length : "—"}</b></div>
      </section>

      <div className="bar">
        <div className="grow">
          <input type="search" id="q" placeholder="Поиск по IP, отделу, кабинету, модели…" autoComplete="off" aria-label="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {canEdit && (
          <>
            <button className="primary" type="button" onClick={() => openEditor(null)}>Добавить принтер</button>
            <button type="button" onClick={() => (firstFree ? openEditor(null, firstFree) : setToast("Свободных адресов нет"))}>Взять свободный IP</button>
          </>
        )}
      </div>
      {printers && (
        <div className="hint">
          {firstFree ? <>Первый свободный адрес: <span className="mono">{firstFree}</span></> : `Свободных адресов в ${SUBNET_LABEL} нет.`}
        </div>
      )}

      <section className="panel" aria-labelledby="mapTitle">
        <div className="panel-head">
          <h2 id="mapTitle">Карта подсети {SUBNET_LABEL}</h2>
          <div className="legend">
            <span><i className="sw" />свободен</span>
            <span><i className="sw busy" />занят</span>
            <span><i className="sw dup" />несколько записей</span>
          </div>
        </div>
        <div className="grid" role="list">
          {Array.from({ length: 254 }, (_, i) => {
            const ip = PREFIX + (i + 1);
            const list = byIp.get(ip) ?? [];
            const hit = q ? list.some(matches) || (!list.length && ip.includes(q)) : false;
            const cls = ["cell", list.length > 1 ? "dup" : list.length ? "busy" : "", q ? (hit ? "hit" : "dim") : ""].join(" ");
            const title = list.length ? `${ip} — ${list.map((p) => p.owner).join(" / ")}` : `${ip} — свободен`;
            return (
              <button key={ip} type="button" role="listitem" className={cls} title={title} aria-label={title} onClick={(e) => openIp(ip, e.currentTarget)}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="meta">
          {canEdit
            ? "Нажмите на ячейку: свободную — чтобы зарегистрировать принтер, занятую — чтобы открыть карточку."
            : "Нажмите на занятую ячейку, чтобы открыть карточку принтера."}
        </div>
      </section>

      <section className="panel" aria-labelledby="listTitle">
        <div className="panel-head">
          <h2 id="listTitle" ref={listRef}>Записи</h2>
          <div className="tabs" role="group" aria-label="Фильтр">
            {FILTERS.map(([f, label]) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="tablewrap fixed-head">
          <table>
            <thead>
              <tr>
                <th>IP</th><th>Статус</th><th>Владелец</th><th>Кабинет / место</th><th>Модель</th><th>Примечание</th>
                <th className="act"><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {!printers ? (
                <tr><td colSpan={7} className="empty">Загрузка…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="empty">{all.length ? "Ничего не найдено" : "Записей пока нет"}</td></tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="click" tabIndex={0} onClick={(e) => openEditor(p, "", e.currentTarget)} onKeyDown={(e) => e.key === "Enter" && openEditor(p, "", e.currentTarget)}>
                    <td className="ip">{p.ip || <span className="muted">—</span>}</td>
                    <td className="nowrap"><StatusChip p={p} dup={!!p.ip && dupIps.has(p.ip)} /></td>
                    <td>{p.owner}</td>
                    <td>{p.room}</td>
                    <td>{p.model}</td>
                    <td className="muted">{p.note}</td>
                    <td className="act">
                      <button
                        type="button"
                        className="small"
                        tabIndex={-1}
                        aria-label={`Открыть карточку: ${p.ip || "без IP"} — ${p.owner}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(p, "", e.currentTarget.closest("tr"));
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {printers && all.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={7}>
                    Всего записей: <b>{all.length}</b>
                    {rows.length !== all.length ? <> · показано: <b>{rows.length}</b></> : null}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <dialog ref={dialogRef} aria-labelledby="dlgTitle" onClose={() => {
        // The close event arrives later than close(); ignore it if a new card has opened since.
        if (dialogRef.current?.open) return;
        stopDialogAnimations();
        setDraft(null);
      }} onCancel={(e) => { e.preventDefault(); closeEditor(); }}>
        {draft && mode === "view" && current && (
          <div className="pcard">
            <div className="pcard-top">
              <span className="label">Карточка принтера</span>
              {current.ip && dupIps.has(current.ip) ? <span className="chip warn">конфликт</span>
                : !current.ip ? <span className="chip noip">без IP</span>
                : kind(current) === "out" ? <span className="chip out">др. подсеть</span> : null}
            </div>
            <div className="pcard-ip mono">{current.ip || "без IP"}</div>
            <h2 id="dlgTitle" className="pcard-owner">{current.owner}</h2>
            <dl className="pcard-facts">
              <div><dt>Кабинет / место</dt><dd>{current.room || "—"}</dd></div>
              <div><dt>Модель</dt><dd>{current.model || "—"}</dd></div>
              {current.note && <div className="wide"><dt>Примечание</dt><dd>{current.note}</dd></div>}
            </dl>
            <div className="meta">Изменено: {fmtDate(current.updated_at)}{current.updated_by ? ` · ${current.updated_by}` : ""}</div>
            <div className="actions">
              <div className="right">
                <button type="button" onClick={closeEditor}>Закрыть</button>
                {canEdit && <button type="button" className="primary" onClick={() => setMode("edit")}>Изменить</button>}
              </div>
            </div>
          </div>
        )}
        {draft && (mode === "edit" || !current) && (
          <form className="stack" onSubmit={save} noValidate>
            <h2 id="dlgTitle">{draft.id ? "Карточка принтера" : "Новый принтер"}</h2>
            <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="row">
                <div className="field">
                  <label htmlFor="fIp">IP-адрес</label>
                  <input id="fIp" className="mono" inputMode="decimal" placeholder={`${SUBNET_PREFIX}___`} autoComplete="off" value={draft.ip} onChange={(e) => edit("ip", e.target.value)} />
                  <span className="help">Пусто — принтер без IP (по кабелю)</span>
                </div>
                <div className="field">
                  <label htmlFor="fRoom">Кабинет / место</label>
                  <input id="fRoom" placeholder="напр. каб. 305, 3 эт." autoComplete="off" value={draft.room} onChange={(e) => edit("room", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="fOwner">Владелец (отдел или сотрудник)</label>
                <input id="fOwner" list="owners" placeholder="напр. Бухгалтерия" autoComplete="off" autoFocus={!!draft.ip || !!draft.id} value={draft.owner} onChange={(e) => edit("owner", e.target.value)} />
                <datalist id="owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="field">
                <label htmlFor="fModel">Модель</label>
                <input id="fModel" placeholder="напр. HP LaserJet M428" autoComplete="off" value={draft.model} onChange={(e) => edit("model", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="fNote">Примечание</label>
                <textarea id="fNote" placeholder="MAC, серийный номер, картридж…" value={draft.note} onChange={(e) => edit("note", e.target.value)} />
              </div>
            </fieldset>
            {formError && <div className="err" role="alert">{formError}</div>}
            {current && (
              <div className="meta">
                Изменено: {fmtDate(current.updated_at)}{current.updated_by ? ` · ${current.updated_by}` : ""}
              </div>
            )}
            <div className="actions">
              {canEdit && draft.id && (
                <div className="confirm">
                  {confirmDelete ? (
                    <>
                      <span>Удалить запись?</span>
                      <button type="button" className="danger solid" onClick={remove}>Да, удалить</button>
                      <button type="button" onClick={() => setConfirmDelete(false)}>Нет</button>
                    </>
                  ) : (
                    <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>Удалить</button>
                  )}
                </div>
              )}
              <div className="right">
                <button type="button" onClick={closeEditor}>{canEdit ? "Отмена" : "Закрыть"}</button>
                {canEdit && <button type="submit" className="primary" disabled={saving}>Сохранить</button>}
              </div>
            </div>
          </form>
        )}
      </dialog>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { MAX_ORG_NAME } from "@/lib/tmc/validate";

const API = "/api/tmc/orgs";

export type TmcOrg = { id: number; name: string };

// Organizations for TMC acts; this tab is shown to the admin only (the API checks it too).
// Issued acts keep the name they were printed with, so renaming or deleting is safe.
export default function TmcOrgsPanel({ orgs, reload }: { orgs: TmcOrg[] | null; reload: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      reload();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api(API, "POST", { name }))) setName("");
  }

  async function save(id: number) {
    if (await run(() => api(`${API}/${id}`, "PATCH", { name: draft }))) setEditId(null);
  }

  async function remove(id: number) {
    if (await run(() => api(`${API}/${id}`, "DELETE"))) setConfirmId(null);
  }

  const last = (orgs?.length ?? 0) <= 1;

  return (
    <section className="panel" aria-labelledby="orgsTitle">
      <div className="panel-head">
        <h2 id="orgsTitle">Организации</h2>
        <span className="meta">Как название печатается в акте. Уже выпущенные акты не меняются.</span>
      </div>
      <form className="bar" onSubmit={add}>
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_ORG_NAME}
          placeholder="Новая организация, напр. ТОО «Пример»" aria-label="Новая организация" />
        <button type="submit" className="primary" disabled={!name.trim() || busy}>Добавить</button>
      </form>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>Название</th><th></th></tr></thead>
          <tbody>
            {!orgs && <tr><td colSpan={2} className="empty">Загрузка…</td></tr>}
            {orgs?.length === 0 && <tr><td colSpan={2} className="empty">Организаций нет — добавьте первую</td></tr>}
            {orgs?.map((o) => (
              <tr key={o.id}>
                <td>
                  {editId === o.id ? (
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_ORG_NAME}
                      aria-label="Название организации" autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) save(o.id); }
                        if (e.key === "Escape") setEditId(null);
                      }} />
                  ) : o.name}
                </td>
                <td className="nowrap">
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {editId === o.id ? (
                      <>
                        <button type="button" className="small primary" onClick={() => save(o.id)} disabled={!draft.trim() || busy}>Сохранить</button>
                        <button type="button" className="small" onClick={() => setEditId(null)}>Отмена</button>
                      </>
                    ) : confirmId === o.id ? (
                      <>
                        <button type="button" className="small danger solid" onClick={() => remove(o.id)} disabled={busy}>Да, удалить</button>
                        <button type="button" className="small" onClick={() => setConfirmId(null)}>Нет</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="small" onClick={() => { setEditId(o.id); setDraft(o.name); setConfirmId(null); }}>Изменить</button>
                        <button type="button" className="small danger" onClick={() => { setConfirmId(o.id); setEditId(null); }}
                          disabled={last} title={last ? "Последнюю организацию удалить нельзя" : undefined}>Удалить</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

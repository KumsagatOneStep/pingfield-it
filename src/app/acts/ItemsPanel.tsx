"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export type Item = { id: number; name: string; active: boolean };

export type ItemsPanelLabels = { title: string; hint: string; placeholder: string; aria: string };

export default function ItemsPanel({ items, isAdmin, reload, apiPath, labels }: {
  items: Item[] | null;
  isAdmin: boolean;
  reload: () => void;
  apiPath: string;
  labels: ItemsPanelLabels;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      reload();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api(apiPath, "POST", { name }))) setName("");
  }

  async function saveEdit(id: number) {
    if (await run(() => api(`${apiPath}/${id}`, "PATCH", { name: editName }))) setEditId(null);
  }

  return (
    <section className="panel" aria-labelledby="itemsTitle">
      <div className="panel-head">
        <h2 id="itemsTitle">{labels.title}</h2>
        <span className="meta">{labels.hint}</span>
      </div>
      <form className="bar" onSubmit={add}>
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} maxLength={300}
          placeholder={labels.placeholder} aria-label={labels.aria} />
        <button type="submit" className="primary" disabled={!name.trim()}>Добавить</button>
      </form>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>Наименование</th><th></th></tr></thead>
          <tbody>
            {!items && <tr><td colSpan={2} className="empty">Загрузка…</td></tr>}
            {items?.length === 0 && <tr><td colSpan={2} className="empty">Справочник пуст</td></tr>}
            {items?.map((it) => (
              <tr key={it.id}>
                <td>
                  {editId === it.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={300} aria-label="Наименование" autoFocus />
                  ) : (
                    <>{it.name}{!it.active && <span className="chip noip" style={{ marginLeft: 6 }}>скрыто</span>}</>
                  )}
                </td>
                <td className="nowrap">
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {editId === it.id ? (
                      <>
                        <button type="button" className="small primary" onClick={() => saveEdit(it.id)} disabled={!editName.trim()}>Сохранить</button>
                        <button type="button" className="small" onClick={() => setEditId(null)}>Отмена</button>
                      </>
                    ) : (
                      <button type="button" className="small" onClick={() => { setEditId(it.id); setEditName(it.name); }}>Изменить</button>
                    )}
                    {isAdmin && editId !== it.id && (
                      <button type="button" className="small" onClick={() => run(() => api(`${apiPath}/${it.id}`, "PATCH", { active: !it.active }))}>
                        {it.active ? "Скрыть" : "Вернуть"}
                      </button>
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

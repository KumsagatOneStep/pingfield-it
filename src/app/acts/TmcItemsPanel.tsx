"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { CATALOG_CATEGORIES, MAX_DESCRIPTION } from "@/lib/tmc/catalog";
import { ItemPhoto, shrinkPhoto, type TmcItem } from "./catalog-shared";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, DropdownValue } from "../ui/Dropdown";

const API = "/api/tmc/items";

type Draft = { name: string; category: string; description: string; photo?: string | null; preview?: string };

// Справочник наименований ТМЦ with catalog cards. Editors can add and rename items;
// the photo, section and description are changed by the admin.
export default function TmcItemsPanel({ items, isAdmin, reload }: {
  items: TmcItem[] | null;
  isAdmin: boolean;
  reload: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
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
    const created = await run(async () => {
      const r = await api<{ item: { id: number; name: string } }>(API, "POST", { name });
      if (isAdmin) startEdit({ id: r.item.id, name: r.item.name, category: "", description: "" });
    });
    if (created) setName("");
  }

  function startEdit(it: Pick<TmcItem, "id" | "name" | "category" | "description">) {
    setEditId(it.id);
    setDraft({ name: it.name, category: it.category, description: it.description });
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !draft) return;
    setError("");
    try {
      const b64 = await shrinkPhoto(f);
      setDraft({ ...draft, photo: b64, preview: `data:image/jpeg;base64,${b64}` });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save(id: number) {
    if (!draft) return;
    const body: Record<string, unknown> = { name: draft.name };
    if (isAdmin) {
      body.category = draft.category;
      body.description = draft.description;
      if (draft.photo !== undefined) body.photo = draft.photo;
    }
    if (await run(() => api(`${API}/${id}`, "PATCH", body))) {
      setEditId(null);
      setDraft(null);
    }
  }

  return (
    <section className="panel" aria-labelledby="itemsTitle">
      <div className="panel-head">
        <h2 id="itemsTitle">Справочник наименований</h2>
        <span className="meta">Как наименования печатаются в акте и выглядят в каталоге</span>
      </div>
      <form className="bar" onSubmit={add}>
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} maxLength={300}
          placeholder="Новое наименование, напр. Мышь беспроводная Logitech M185" aria-label="Новое наименование" />
        <button type="submit" className="primary" disabled={!name.trim() || busy}>Добавить</button>
      </form>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="tablewrap">
        <table className="items-table">
          <thead><tr><th style={{ width: 72 }}>Фото</th><th>Наименование</th><th></th></tr></thead>
          <tbody>
            {!items && <tr><td colSpan={3} className="empty">Загрузка…</td></tr>}
            {items?.length === 0 && <tr><td colSpan={3} className="empty">Справочник пуст</td></tr>}
            {items?.map((it) => {
              const editing = editId === it.id && draft;
              return (
                <tr key={it.id}>
                  <td>
                    {editing && draft.preview
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <div className="cat-photo thumb"><img src={draft.preview} alt="" /></div>
                      : editing && draft.photo === null
                        ? <div className="cat-photo thumb"><span className="cat-nophoto" aria-hidden="true">📦</span></div>
                        : <ItemPhoto item={it} className="thumb" />}
                  </td>
                  <td>
                    {editing ? (
                      <div className="stack" style={{ gap: 8 }}>
                        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={300} aria-label="Наименование" autoFocus />
                        {isAdmin && (
                          <>
                            <Dropdown block value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <DropdownTrigger aria-label="Раздел каталога"><DropdownValue /></DropdownTrigger>
                    <DropdownContent matchTriggerWidth>
                      <DropdownItem value="">— раздел не выбран (будет в «Прочее») —</DropdownItem>
                      {CATALOG_CATEGORIES.map((c) => <DropdownItem key={c} value={c}>{c}</DropdownItem>)}
                    </DropdownContent>
                  </Dropdown>
                            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                              maxLength={MAX_DESCRIPTION} rows={2} placeholder="Короткое описание: что это и для чего" aria-label="Описание" />
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <label className="btnlink small filepick">
                                {it.has_photo || draft.photo ? "Заменить фото" : "Загрузить фото"}
                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} />
                              </label>
                              {(it.has_photo || draft.photo) && draft.photo !== null && (
                                <button type="button" className="small" onClick={() => setDraft({ ...draft, photo: null, preview: undefined })}>Убрать фото</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>{it.name}{!it.active && <span className="chip noip" style={{ marginLeft: 6 }}>скрыто</span>}</div>
                        <div className="meta">
                          {it.category || "Без раздела"}{it.description ? ` · ${it.description}` : ""}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="nowrap">
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {editing ? (
                        <>
                          <button type="button" className="small primary" onClick={() => save(it.id)} disabled={!draft.name.trim() || busy}>Сохранить</button>
                          <button type="button" className="small" onClick={() => { setEditId(null); setDraft(null); }}>Отмена</button>
                        </>
                      ) : (
                        <button type="button" className="small" onClick={() => startEdit(it)}>Изменить</button>
                      )}
                      {isAdmin && !editing && (
                        <button type="button" className="small" onClick={() => run(() => api(`${API}/${it.id}`, "PATCH", { active: !it.active }))}>
                          {it.active ? "Скрыть" : "Вернуть"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CATALOG_CATEGORIES } from "@/lib/tmc/catalog";
import { ItemPhoto, type TmcItem } from "./catalog-shared";

export type CatalogPickerHandle = { open: () => void };
type Pick = { name: string; qty: number };

const ALL = "Все";
const OTHER = "Прочее";
const MAX_QTY = 9999;
const sectionOf = (i: TmcItem) => i.category || OTHER;

// Shop-style catalog: pick several items with quantities, then add them all to the act.
// onAdd returns an error text to show, or null when the items were added.
const CatalogPicker = forwardRef<CatalogPickerHandle, {
  items: TmcItem[] | null;
  onAdd: (picks: Pick[]) => string | null;
}>(function CatalogPicker({ items, onAdd }, ref) {
  const dlg = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(ALL);
  const [cart, setCart] = useState<Map<number, number>>(new Map());
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({
    open() {
      setQ("");
      setCat(ALL);
      setCart(new Map());
      setError("");
      dlg.current?.showModal();
      requestAnimationFrame(() => searchRef.current?.focus());
    },
  }));

  const active = useMemo(() => (items ?? []).filter((i) => i.active), [items]);
  const sections = useMemo(
    () => CATALOG_CATEGORIES.filter((c) => active.some((i) => sectionOf(i) === c)),
    [active],
  );
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return active.filter((i) => {
      if (cat !== ALL && sectionOf(i) !== cat) return false;
      const hay = `${i.name} ${i.description}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [active, q, cat]);

  const setQty = (id: number, qty: number) => setCart((m) => {
    const next = new Map(m);
    if (qty <= 0) next.delete(id);
    else next.set(id, Math.min(MAX_QTY, qty));
    return next;
  });

  const totalQty = [...cart.values()].reduce((a, b) => a + b, 0);

  function confirm() {
    const picks = active.filter((i) => cart.has(i.id)).map((i) => ({ name: i.name, qty: cart.get(i.id)! }));
    const err = onAdd(picks);
    if (err) setError(err);
    else dlg.current?.close();
  }

  return (
    <dialog ref={dlg} className="catalog" aria-labelledby="catTitle">
      <div className="cat-head">
        <h2 id="catTitle">Каталог</h2>
        <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: мышь, кабель, сумка…" aria-label="Поиск по каталогу" />
        <button type="button" className="small" onClick={() => dlg.current?.close()} aria-label="Закрыть каталог">✕</button>
      </div>
      <div className="cat-chips" role="group" aria-label="Разделы">
        {[ALL, ...sections].map((c) => (
          <button key={c} type="button" className="small" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="cat-grid">
        {!items && <p className="empty">Загрузка…</p>}
        {items && shown.length === 0 && <p className="empty">Ничего не найдено</p>}
        {shown.map((it) => {
          const qty = cart.get(it.id) ?? 0;
          return (
            <div key={it.id} className={`cat-card${qty ? " picked" : ""}`}>
              <ItemPhoto item={it} />
              <div className="cat-name">{it.name}</div>
              {it.description && <div className="cat-desc">{it.description}</div>}
              <div className="cat-buy">
                {qty === 0 ? (
                  <button type="button" className="small primary" onClick={() => setQty(it.id, 1)}>Добавить</button>
                ) : (
                  <div className="cat-qty">
                    <button type="button" className="small" onClick={() => setQty(it.id, qty - 1)} aria-label={`Меньше: ${it.name}`}>−</button>
                    <input type="number" min={1} max={MAX_QTY} value={qty} aria-label={`Количество: ${it.name}`}
                      onChange={(e) => setQty(it.id, Math.floor(Number(e.target.value) || 0))} />
                    <button type="button" className="small" onClick={() => setQty(it.id, qty + 1)} aria-label={`Больше: ${it.name}`}>+</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="cat-foot">
        {error && <div className="err" role="alert">{error}</div>}
        <span className="meta">{cart.size ? `Выбрано: ${cart.size} поз., ${totalQty} шт.` : "Выберите позиции"}</span>
        <button type="button" className="primary" disabled={cart.size === 0} onClick={confirm}>Добавить в акт</button>
      </div>
    </dialog>
  );
});

export default CatalogPicker;

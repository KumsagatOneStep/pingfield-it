"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ArticleSummary } from "@/lib/helper/store";
import { fmtWhen } from "./format";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, DropdownValue } from "../ui/Dropdown";

const ALL = "*";

type ListResponse = { articles: ArticleSummary[]; tags: string[] };

export default function HelperList({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [archived, setArchived] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (tag) qs.set("tag", tag);
      if (archived) qs.set("archived", "1");
      try {
        const r = await api<ListResponse>(`/api/helper/articles?${qs}`);
        if (!stale) {
          setData(r);
          setError("");
        }
      } catch (e) {
        if (!stale) setError((e as Error).message);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, tag, archived]);

  const filtered = q.trim() !== "" || tag !== "";
  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Помощник</h1>
          <p className="sub">Решения IT-отдела: решили один раз — записали, дальше найдёт любой.</p>
        </div>
        {canEdit && (
          <Link href="/helper/new" className="btnlink primary">Новая запись</Link>
        )}
      </header>
      <section className="panel">
        <div className="bar">
          <input
            className="grow"
            type="search"
            placeholder="Поиск: текст ошибки, симптом, команда, метка"
            aria-label="Поиск"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Dropdown value={tag || ALL} onValueChange={(v) => setTag(v === ALL ? "" : v)}>
            <DropdownTrigger aria-label="Метка">
              <DropdownValue placeholder="Все метки" />
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownItem value={ALL}>Все метки</DropdownItem>
              {data?.tags.map((t) => <DropdownItem key={t} value={t}>{t}</DropdownItem>)}
            </DropdownContent>
          </Dropdown>
          {isAdmin && (
            <label className="hint kb-check">
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Показать архив
            </label>
          )}
        </div>
        {error && <p className="err">{error}</p>}
        {!data && !error && <p className="empty">Загрузка…</p>}
        {data && data.articles.length === 0 && (
          <p className="empty">{filtered ? "Ничего не найдено" : "Записей пока нет"}</p>
        )}
        {data && data.articles.length > 0 && (
          <ul className="kb-list">
            {data.articles.map((a) => (
              <li key={a.id} className="kb-card">
                <Link href={`/helper/${a.id}`} className="kb-title">{a.title}</Link>
                {a.archived && <span className="chip bad">в архиве</span>}
                {a.symptomLine && <p className="kb-symptom">{a.symptomLine}</p>}
                <div className="kb-meta">
                  {a.tags.map((t) => (
                    <button key={t} type="button" className="kb-tag" onClick={() => setTag(t)}>{t}</button>
                  ))}
                  <span className="meta">{a.authorName} · {fmtWhen(a.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

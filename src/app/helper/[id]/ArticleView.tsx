"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Article } from "@/lib/helper/store";
import Markdown from "../Markdown";
import { fmtSize, fmtWhen } from "../format";

const SECTIONS = [
  ["symptom", "Симптом"],
  ["cause", "Причина"],
  ["prerequisites", "Что нужно заранее"],
  ["solution", "Решение"],
] as const;

export default function ArticleView({ article: a, canEdit, isAdmin }: { article: Article; canEdit: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const archive = async (archived: boolean) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/helper/articles/${a.id}`, "PATCH", { archived });
      if (archived) router.push("/helper");
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const edited = a.updatedAt !== a.createdAt;
  return (
    <main className="wrap kb-article">
      <p className="hint"><Link href="/helper">← Все записи</Link></p>
      <header className="top">
        <div>
          <h1>{a.title} {a.archived && <span className="chip bad">в архиве</span>}</h1>
          <p className="meta">
            Автор: {a.createdByName || "—"}, {fmtWhen(a.createdAt)}
            {edited && <> · Изменил: {a.updatedByName || "—"}, {fmtWhen(a.updatedAt)}</>}
          </p>
          {a.tags.length > 0 && (
            <div className="kb-meta">{a.tags.map((t) => <span key={t} className="kb-tag">{t}</span>)}</div>
          )}
        </div>
        <div className="actions">
          {canEdit && !a.archived && <Link href={`/helper/${a.id}/edit`} className="btnlink">Изменить</Link>}
          {isAdmin && !a.archived && <button type="button" className="danger" disabled={busy} onClick={() => archive(true)}>В архив</button>}
          {isAdmin && a.archived && <button type="button" disabled={busy} onClick={() => archive(false)}>Вернуть из архива</button>}
        </div>
      </header>
      {error && <p className="err">{error}</p>}
      {SECTIONS.filter(([k]) => a[k].trim() !== "").map(([k, label]) => (
        <section key={k} className="panel">
          <h2 className="kb-h">{label}</h2>
          <Markdown text={a[k]} />
        </section>
      ))}
      {a.files.length > 0 && (
        <section className="panel">
          <h2 className="kb-h">Вложения</h2>
          <ul className="kb-files">
            {a.files.map((f) => (
              <li key={f.id}>
                <a href={`/api/helper/attachments/${f.id}`}>{f.filename}</a> <span className="meta">{fmtSize(f.size)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {a.videoUrl && (
        <section className="panel">
          <h2 className="kb-h">Видео</h2>
          <a href={a.videoUrl} target="_blank" rel="noopener noreferrer">{a.videoUrl}</a>
        </section>
      )}
    </main>
  );
}

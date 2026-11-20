"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { api } from "@/lib/api";
import { checkFileBeforeUpload, pickPastedImage } from "@/lib/helper/client";
import { MAX_FILES, MAX_TAGS } from "@/lib/helper/constants";
import type { Article, AttachmentMeta } from "@/lib/helper/store";
import Markdown from "./Markdown";
import { fmtSize } from "./format";
import { SESSION_EXPIRED, shrinkScreenshot, uploadAttachment } from "./upload";

type SectionKey = "symptom" | "cause" | "prerequisites" | "solution";
const SECTIONS: { key: SectionKey; label: string; required: boolean; help: string }[] = [
  { key: "symptom", label: "Симптом", required: true, help: "Что видит пользователь. Дословный текст ошибки — по нему будут искать." },
  { key: "cause", label: "Причина", required: false, help: "Почему так происходит, особенности объекта." },
  { key: "prerequisites", label: "Что нужно заранее", required: false, help: "Права, учётные записи, доступ." },
  { key: "solution", label: "Решение", required: true, help: "Шаги по порядку. Скриншот можно вставить сочетанием Ctrl+V прямо в текст." },
];

let uploadSeq = 0;

/** Number for the next "1. " step: last numbered line above the cursor + 1. */
function nextStepNumber(before: string): number {
  const nums = [...before.matchAll(/^(\d+)\.\s/gm)].map((m) => Number(m[1]));
  return nums.length ? nums[nums.length - 1] + 1 : 1;
}

function SectionEditor({
  label, required, help, value, onChange, onError,
}: {
  label: string; required: boolean; help: string; value: string;
  onChange: (update: (prev: string) => string) => void; onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);

  // Inserts text at the cursor; block snippets start on their own line.
  const insert = (snippet: string, block: boolean) => {
    const ta = ref.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const lead = block && before !== "" && !before.endsWith("\n") ? "\n" : "";
    const text = lead + snippet;
    onChange((prev) => prev.slice(0, start) + text + prev.slice(end));
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
    return start + lead.length;
  };

  const addImage = async (blob: Blob, name: string) => {
    const marker = `[Загрузка картинки ${++uploadSeq}…]`;
    insert(`${marker}\n`, true);
    try {
      const meta = await uploadAttachment("image", await shrinkScreenshot(blob), name);
      onChange((prev) => prev.replace(marker, `![скриншот](/api/helper/attachments/${meta.id})`));
    } catch (e) {
      onChange((prev) => prev.replace(`${marker}\n`, "").replace(marker, ""));
      onError((e as Error).message);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = pickPastedImage([...e.clipboardData.files], e.clipboardData.getData("text/plain"));
    if (!file) return;
    e.preventDefault();
    void addImage(file, file.name || "скриншот.png");
  };

  return (
    <div className="field kb-section">
      <div className="kb-section-head">
        <label>{label}{required && <span className="kb-req"> *</span>}</label>
        <div className="kb-tools">
          {!preview && (
            <>
              <button type="button" className="small" onClick={() => {
                const ta = ref.current;
                insert(`${nextStepNumber(value.slice(0, ta?.selectionStart ?? value.length))}. `, true);
              }}>Шаг</button>
              <button type="button" className="small" onClick={() => {
                const at = insert("```\n\n```\n", true);
                requestAnimationFrame(() => ref.current?.setSelectionRange(at + 4, at + 4));
              }}>Команда</button>
              <button type="button" className="small" onClick={() => insert("| Столбец 1 | Столбец 2 |\n|---|---|\n|  |  |\n", true)}>Таблица</button>
              <button type="button" className="small" onClick={() => fileRef.current?.click()}>Картинка</button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void addImage(f, f.name);
              }} />
            </>
          )}
          <button type="button" className="small" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? "Редактировать" : "Предпросмотр"}
          </button>
        </div>
      </div>
      <p className="help">{help}</p>
      {preview ? (
        <div className="kb-preview">{value.trim() ? <Markdown text={value} /> : <p className="hint">Пусто</p>}</div>
      ) : (
        <textarea ref={ref} value={value} rows={label === "Решение" ? 14 : 4} onPaste={onPaste} aria-label={label}
          onChange={(e) => { const v = e.target.value; onChange(() => v); }} />
      )}
    </div>
  );
}

export default function ArticleForm({ initial }: { initial?: Article }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState<Record<SectionKey, string>>({
    symptom: initial?.symptom ?? "",
    cause: initial?.cause ?? "",
    prerequisites: initial?.prerequisites ?? "",
    solution: initial?.solution ?? "",
  });
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [files, setFiles] = useState<AttachmentMeta[]>(initial?.files ?? []);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    api<{ tags: string[] }>("/api/helper/articles").then((r) => setKnownTags(r.tags)).catch(() => {});
  }, []);

  // Unsaved text survives a reload of this tab (expired session, conflict, accidental refresh).
  const draftKey = `kb-draft:${initial?.id ?? "new"}`;
  const snapshot = JSON.stringify({ title, text, tags, videoUrl, files });
  const [initialSnapshot] = useState(snapshot);
  const dirty = snapshot !== initialSnapshot;
  const draftChecked = useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw && raw !== initialSnapshot) {
        const d = JSON.parse(raw);
        setTitle(d.title);
        setText(d.text);
        setTags(d.tags);
        setVideoUrl(d.videoUrl);
        setFiles(d.files);
        setRestored(true);
      }
    } catch {}
    draftChecked.current = true;
  }, [draftKey, initialSnapshot]);
  useEffect(() => {
    if (!draftChecked.current || saving) return;
    try {
      if (dirty) sessionStorage.setItem(draftKey, snapshot);
      else sessionStorage.removeItem(draftKey);
    } catch {}
  }, [draftKey, snapshot, dirty, saving]);
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);
  const discardDraft = () => {
    try { sessionStorage.removeItem(draftKey); } catch {}
    window.location.reload();
  };

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, " ");
    setTagDraft("");
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (tags.length >= MAX_TAGS) return setError(`Не больше ${MAX_TAGS} меток`);
    setTags([...tags, t]);
  };

  const addFiles = async (list: FileList) => {
    setError("");
    let count = files.length + uploading;
    for (const f of [...list]) {
      if (count >= MAX_FILES) {
        setError(`Не больше ${MAX_FILES} файлов в одной записи`);
        break;
      }
      const bad = checkFileBeforeUpload(f.name, f.size);
      if (bad) {
        setError(`${f.name}: ${bad}`);
        continue;
      }
      count++;
      setUploading((n) => n + 1);
      try {
        const meta = await uploadAttachment("file", f, f.name);
        setFiles((prev) => [...prev, meta]);
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const pendingImages = Object.values(text).some((t) => /\[Загрузка картинки \d+…\]/.test(t));

  const save = async () => {
    setError("");
    const pending = tagDraft.trim() ? [...tags, tagDraft.trim()] : tags;
    const body = { title, ...text, tags: pending, videoUrl, fileIds: files.map((f) => f.id) };
    setSaving(true);
    try {
      // Not api(): on 401 it navigates to /login and the typed text would be lost.
      const res = await fetch(initial ? `/api/helper/articles/${initial.id}` : "/api/helper/articles", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initial ? { ...body, updatedAt: initial.updatedAt } : body),
      });
      if (res.status === 401) throw new Error(SESSION_EXPIRED);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить. Попробуйте ещё раз.");
      try { sessionStorage.removeItem(draftKey); } catch {}
      router.push(`/helper/${initial ? initial.id : data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof TypeError ? "Нет связи с сервером. Текст не пропал — попробуйте ещё раз." : (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <main className="wrap kb-form">
      <p className="hint"><Link href={initial ? `/helper/${initial.id}` : "/helper"}>← {initial ? "К записи" : "Все записи"}</Link></p>
      <h1>{initial ? "Изменить запись" : "Новая запись"}</h1>
      {restored && (
        <p className="okmsg">
          Восстановлен ваш несохранённый текст.{initial && " Если запись тем временем правил кто-то другой, проверьте, не затрёте ли вы его правку."}{" "}
          <button type="button" className="small" onClick={discardDraft}>Отбросить</button>
        </p>
      )}
      <section className="panel">
        <div className="field">
          <label htmlFor="kb-title">Название<span className="kb-req"> *</span></label>
          <input id="kb-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Ошибка доверительных отношений с доменом" />
        </div>
        {SECTIONS.map((s) => (
          <SectionEditor key={s.key} label={s.label} required={s.required} help={s.help} value={text[s.key]}
            onChange={(update) => setText((prev) => ({ ...prev, [s.key]: update(prev[s.key]) }))} onError={setError} />
        ))}
        <div className="field">
          <label htmlFor="kb-tags">Метки</label>
          <div className="kb-meta">
            {tags.map((t) => (
              <span key={t} className="kb-tag">{t} <button type="button" className="kb-x" aria-label={`Убрать метку ${t}`}
                onClick={() => setTags(tags.filter((x) => x !== t))}>×</button></span>
            ))}
          </div>
          <input id="kb-tags" list="kb-known-tags" value={tagDraft} placeholder="Введите метку и нажмите Enter"
            onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value.slice(0, -1)) : setTagDraft(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagDraft); } }} />
          <datalist id="kb-known-tags">{knownTags.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="kb-video">Ссылка на видео</label>
          <input id="kb-video" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="field">
          <label>Файлы</label>
          <p className="help">PDF, DOCX, XLSX, TXT, ZIP до 1 МБ, не больше {MAX_FILES}.</p>
          {files.length > 0 && (
            <ul className="kb-files">
              {files.map((f) => (
                <li key={f.id}>{f.filename} <span className="meta">{fmtSize(f.size)}</span>{" "}
                  <button type="button" className="small" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>Убрать</button></li>
              ))}
            </ul>
          )}
          {uploading > 0 && <p className="hint">Загрузка файлов…</p>}
          <input type="file" multiple accept=".pdf,.docx,.xlsx,.txt,.zip" aria-label="Добавить файлы"
            onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="actions">
          <span className="hint">* — обязательные поля</span>
          <div className="right">
            <button type="button" className="primary" disabled={saving || uploading > 0 || pendingImages} onClick={save}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

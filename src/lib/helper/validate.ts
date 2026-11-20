import { MAX_SECTION, MAX_TAG, MAX_TAGS, MAX_TITLE } from "./constants.ts";

export type ArticleInput = {
  title: string;
  symptom: string;
  cause: string;
  prerequisites: string;
  solution: string;
  tags: string[];
  videoUrl: string;
  fileIds: number[];
};

type Result<T> = { value: T } | { error: string };

const SECTIONS = [
  ["symptom", "Симптом", true],
  ["cause", "Причина", false],
  ["prerequisites", "Что нужно заранее", false],
  ["solution", "Решение", true],
] as const;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : null);

export function validateArticle(body: unknown): Result<ArticleInput> {
  if (!body || typeof body !== "object") return { error: "Пустой запрос" };
  const b = body as Record<string, unknown>;

  const title = str(b.title);
  if (title === null || title === "") return { error: "Заполните поле «Название»" };
  if (title.length > MAX_TITLE) return { error: `Название длиннее ${MAX_TITLE} символов` };

  const sections: Record<string, string> = {};
  for (const [key, label, required] of SECTIONS) {
    const v = str(b[key]);
    if (v === null) return { error: `Поле «${label}» должно быть текстом` };
    if (required && v === "") return { error: `Заполните поле «${label}»` };
    if (v.length > MAX_SECTION) return { error: `Поле «${label}» длиннее ${MAX_SECTION} символов` };
    sections[key] = v;
  }

  const rawTags = b.tags ?? [];
  if (!Array.isArray(rawTags)) return { error: "Метки переданы неверно" };
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const t of rawTags) {
    if (typeof t !== "string") return { error: "Метки переданы неверно" };
    const v = t.trim().replace(/\s+/g, " ");
    if (!v) continue;
    if (v.length > MAX_TAG) return { error: `Метка длиннее ${MAX_TAG} символов: «${v.slice(0, 20)}…»` };
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    tags.push(v);
  }
  if (tags.length > MAX_TAGS) return { error: `Не больше ${MAX_TAGS} меток` };

  const videoUrl = str(b.videoUrl);
  if (videoUrl === null) return { error: "Ссылка на видео передана неверно" };
  if (videoUrl !== "") {
    let ok = false;
    try {
      const u = new URL(videoUrl);
      ok = u.protocol === "http:" || u.protocol === "https:";
    } catch {}
    if (!ok) return { error: "Ссылка на видео должна начинаться с http:// или https://" };
  }

  const rawIds = b.fileIds ?? [];
  if (!Array.isArray(rawIds) || !rawIds.every((x) => typeof x === "number" && Number.isInteger(x) && x > 0))
    return { error: "Файлы переданы неверно" };

  return {
    value: {
      title,
      symptom: sections.symptom,
      cause: sections.cause,
      prerequisites: sections.prerequisites,
      solution: sections.solution,
      tags,
      videoUrl,
      fileIds: [...new Set(rawIds as number[])],
    },
  };
}

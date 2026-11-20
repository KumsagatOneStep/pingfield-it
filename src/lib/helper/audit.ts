// Audit journal text for helper articles: field names only, sections can be 20 000 chars long.

const LABELS: Record<string, string> = {
  title: "Название",
  symptom: "Симптом",
  cause: "Причина",
  prerequisites: "Что нужно заранее",
  solution: "Решение",
  tags: "Метки",
  video_url: "Видео",
};

type Json = Record<string, unknown> | null;

export function describeKb(before: Json, after: Json): string {
  if (before && "archived" in before) return after ? "из архива" : "в архив";
  if (!before) return `Название: ${String(after?.title ?? "")}`;
  if (!after) return "";
  const changed = Object.keys(LABELS).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return changed.length ? `изменил: ${changed.map((k) => LABELS[k]).join(", ")}` : "без изменений текста";
}

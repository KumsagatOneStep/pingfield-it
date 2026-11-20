import type { ArticleInput } from "./validate.ts";

/** Lowercase, ё→е, collapse whitespace: the same form is stored and searched. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/** head ranks higher in search than body. */
export function searchFields(a: ArticleInput): { head: string; body: string } {
  return {
    head: normalize([a.title, a.symptom, a.tags.join(" ")].join(" ")),
    body: normalize([a.cause, a.prerequisites, a.solution].join(" ")),
  };
}

/** Unique attachment ids of images embedded as ![…](/api/helper/attachments/<id>). */
export function extractImageIds(...texts: string[]): number[] {
  const ids: number[] = [];
  for (const t of texts) {
    for (const m of t.matchAll(/!\[[^\]]*\]\(\/api\/helper\/attachments\/(\d+)\)/g)) {
      const id = Number(m[1]);
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

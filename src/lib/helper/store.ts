import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { DRAFT_TTL_HOURS, MAX_FILES, MAX_IMAGES, MAX_TOTAL_ATTACHMENT_BYTES } from "./constants";
import { extractImageIds, normalize, searchFields } from "./search";
import type { ArticleInput } from "./validate";

export type AttachmentMeta = { id: number; kind: "image" | "file"; filename: string; mime: string; size: number };
export type ArticleSummary = {
  id: number;
  title: string;
  symptomLine: string;
  tags: string[];
  authorName: string;
  updatedAt: string;
  archived: boolean;
};
export type Article = ArticleSummary &
  ArticleInput & { createdAt: string; createdByName: string; updatedByName: string; files: AttachmentMeta[] };

const likePattern = (q: string) => `%${normalize(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const firstLine = (s: string) => s.split("\n").find((l) => l.trim() !== "")?.trim() ?? "";

/** Audit snapshot: the editable fields under their column names. */
export const auditSnapshot = (a: ArticleInput) => ({
  title: a.title,
  symptom: a.symptom,
  cause: a.cause,
  prerequisites: a.prerequisites,
  solution: a.solution,
  tags: a.tags,
  video_url: a.videoUrl,
});

export async function listArticles(opts: { q: string; tag: string; includeArchived: boolean }): Promise<ArticleSummary[]> {
  // Every word must occur somewhere (title/symptom/tags or the rest); all words in head ranks first.
  const pats = normalize(opts.q).split(" ").filter(Boolean).slice(0, 8).map(likePattern);
  const rows = await db()`
    select a.id, a.title, a.symptom, a.tags, a.updated_at::text as updated_at, a.archived,
           coalesce(nullif(u.full_name, ''), u.username, '') as author
    from kb_articles a left join users u on u.id = a.created_by
    where (${opts.includeArchived}::boolean or not a.archived)
      and coalesce((select bool_and(a.search_head like p escape '\\' or a.search_body like p escape '\\')
                    from unnest(${pats}::text[]) p), true)
      and (${opts.tag || null}::text is null or ${opts.tag}::text = any(a.tags))
    order by case when coalesce((select bool_and(a.search_head like p escape '\\') from unnest(${pats}::text[]) p), false)
                  then 0 else 1 end,
             a.updated_at desc, a.id desc
    limit 200`;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    symptomLine: firstLine(r.symptom),
    tags: r.tags,
    authorName: r.author,
    updatedAt: r.updated_at,
    archived: r.archived,
  }));
}

export async function listTags(): Promise<string[]> {
  const rows = await db()`select distinct unnest(tags) as tag from kb_articles where not archived`;
  return rows.map((r) => r.tag as string).sort((a, b) => a.localeCompare(b, "ru"));
}

export async function getArticle(id: number, includeArchived: boolean): Promise<Article | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [r] = await db()`
    select a.*, a.created_at::text as created_text, a.updated_at::text as updated_text,
           coalesce(nullif(c.full_name, ''), c.username, '') as created_name,
           coalesce(nullif(u.full_name, ''), u.username, '') as updated_name,
           (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'filename', f.filename,
                                                         'mime', f.mime, 'size', f.size) order by f.id), '[]')
            from kb_attachments f where f.article_id = a.id and f.kind = 'file') as files
    from kb_articles a
    left join users c on c.id = a.created_by
    left join users u on u.id = a.updated_by
    where a.id = ${id} and (${includeArchived}::boolean or not a.archived)`;
  if (!r) return null;
  const files = r.files as AttachmentMeta[];
  return {
    id: r.id,
    title: r.title,
    symptomLine: firstLine(r.symptom),
    symptom: r.symptom,
    cause: r.cause,
    prerequisites: r.prerequisites,
    solution: r.solution,
    tags: r.tags,
    videoUrl: r.video_url,
    fileIds: files.map((f) => f.id),
    files,
    archived: r.archived,
    authorName: r.created_name,
    createdByName: r.created_name,
    updatedByName: r.updated_name,
    createdAt: r.created_text,
    updatedAt: r.updated_text,
  };
}

function limits(input: ArticleInput): { imageIds: number[]; error?: string } {
  const imageIds = extractImageIds(input.symptom, input.cause, input.prerequisites, input.solution);
  if (imageIds.length > MAX_IMAGES) return { imageIds, error: `Не больше ${MAX_IMAGES} картинок в одной записи` };
  if (input.fileIds.length > MAX_FILES) return { imageIds, error: `Не больше ${MAX_FILES} файлов в одной записи` };
  return { imageIds };
}

// Binding rule shared by create and update: a draft of this user, or an attachment
// already in this article; images by the ids in the text, files by fileIds.

export async function createArticle(user: SessionUser, input: ArticleInput): Promise<{ id: number } | { error: string }> {
  const { imageIds, error } = limits(input);
  if (error) return { error };
  const s = searchFields(input);
  const [row] = await db()`
    with ins as (
      insert into kb_articles (title, symptom, cause, prerequisites, solution, tags, video_url,
                               search_head, search_body, created_by, updated_by)
      values (${input.title}, ${input.symptom}, ${input.cause}, ${input.prerequisites}, ${input.solution},
              ${input.tags}::text[], ${input.videoUrl}, ${s.head}, ${s.body}, ${user.id}, ${user.id})
      returning id
    ), bind as (
      update kb_attachments f set article_id = ins.id from ins
      where f.article_id is null and f.created_by = ${user.id}
        and ((f.kind = 'image' and f.id = any(${imageIds}::int[])) or (f.kind = 'file' and f.id = any(${input.fileIds}::int[])))
    )
    select id from ins`;
  return { id: row.id };
}

export async function updateArticle(
  user: SessionUser,
  id: number,
  input: ArticleInput,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { conflict: string } | { error: string } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const { imageIds, error } = limits(input);
  if (error) return { error };
  const s = searchFields(input);
  // One statement: article, newly bound drafts and dropped attachments change together.
  const [row] = await db()`
    with upd as (
      update kb_articles set
        title = ${input.title}, symptom = ${input.symptom}, cause = ${input.cause},
        prerequisites = ${input.prerequisites}, solution = ${input.solution}, tags = ${input.tags}::text[],
        video_url = ${input.videoUrl}, search_head = ${s.head}, search_body = ${s.body},
        updated_by = ${user.id}, updated_at = now()
      where id = ${id} and not archived and updated_at::text = ${expectedUpdatedAt}
      returning id
    ), bind as (
      update kb_attachments f set article_id = upd.id from upd
      where f.article_id is null and f.created_by = ${user.id}
        and ((f.kind = 'image' and f.id = any(${imageIds}::int[])) or (f.kind = 'file' and f.id = any(${input.fileIds}::int[])))
    ), drop as (
      delete from kb_attachments f using upd
      where f.article_id = upd.id
        and not ((f.kind = 'image' and f.id = any(${imageIds}::int[])) or (f.kind = 'file' and f.id = any(${input.fileIds}::int[])))
    )
    select id from upd`;
  if (row) return { ok: true };
  const [cur] = await db()`
    select coalesce(nullif(u.full_name, ''), u.username, 'другой сотрудник') as name
    from kb_articles a left join users u on u.id = a.updated_by
    where a.id = ${id} and not a.archived`;
  return cur ? { conflict: cur.name as string } : null;
}

export async function setArchived(id: number, archived: boolean): Promise<{ title: string } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [row] = await db()`
    update kb_articles set archived = ${archived} where id = ${id} and archived <> ${archived} returning title`;
  return row ? { title: row.title as string } : null;
}

export async function purgeOldDrafts(): Promise<void> {
  await db()`
    delete from kb_attachments
    where article_id is null and created_at < now() - make_interval(hours => ${DRAFT_TTL_HOURS})`;
}

export async function insertAttachment(
  userId: number,
  kind: "image" | "file",
  filename: string,
  mime: string,
  bytes: Uint8Array,
): Promise<AttachmentMeta | null> {
  // Demo: refuse when all attachments together would exceed MAX_TOTAL_ATTACHMENT_BYTES (null = no space).
  const [r] = await db()`
    insert into kb_attachments (kind, filename, mime, size, data, created_by)
    select ${kind}, ${filename}, ${mime}, ${bytes.length}, decode(${Buffer.from(bytes).toString("hex")}, 'hex'), ${userId}
    where (select coalesce(sum(size), 0) from kb_attachments) + ${bytes.length} <= ${MAX_TOTAL_ATTACHMENT_BYTES}
    returning id`;
  if (!r) return null;
  return { id: r.id, kind, filename, mime, size: bytes.length };
}

/** Drafts: author only. Archived article: admin only. Otherwise any signed-in user. */
export async function getAttachment(id: number, user: SessionUser): Promise<{ meta: AttachmentMeta; bytes: Buffer } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [r] = await db()`
    select f.id, f.kind, f.filename, f.mime, f.size, encode(f.data, 'base64') as b64
    from kb_attachments f left join kb_articles a on a.id = f.article_id
    where f.id = ${id}
      and ((f.article_id is null and f.created_by = ${user.id})
        or (f.article_id is not null and (not a.archived or ${user.role === "admin"}::boolean)))`;
  if (!r) return null;
  return {
    meta: { id: r.id, kind: r.kind, filename: r.filename, mime: r.mime, size: r.size },
    bytes: Buffer.from(r.b64 as string, "base64"),
  };
}

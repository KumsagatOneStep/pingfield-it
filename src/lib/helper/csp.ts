// CSP for files served from /api/helper/attachments/:id. Shared by next.config.ts
// (which sets headers for the path) and the route itself, so both say the same thing.
// No imports: next.config.ts loads this file at build time.
export const ATTACHMENT_CSP = "default-src 'none'; frame-ancestors 'none'; sandbox";

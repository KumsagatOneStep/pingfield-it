// Postgres timestamptz text → "12.11.2026, 14:05" in Almaty time.
export const fmtWhen = (pgText: string) =>
  pgText
    ? new Date(pgText.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toLocaleString("ru-RU", {
        timeZone: "Asia/Almaty",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;

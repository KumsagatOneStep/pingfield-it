import { requirePageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import TopNav from "../TopNav";
import { describeKb } from "@/lib/helper/audit";
import { auditSubject, auditVerb } from "@/lib/audit-subject";

export const dynamic = "force-dynamic";

const FIELDS: Record<string, string> = {
  ip: "IP", owner: "Владелец", room: "Кабинет", model: "Модель", note: "Примечание",
  username: "Логин", full_name: "Имя", act_name: "ФИО для актов", position: "Должность",
  recipient_name: "Получатель", department: "Подразделение", lines: "Позиции", name: "Наименование", role: "Роль", active: "Активен", passwordReset: "Сброс пароля",
};

type Json = Record<string, unknown> | null;

function describe(before: Json, after: Json): string {
  const keys = Object.keys(FIELDS).filter((k) => (before && k in before) || (after && k in after));
  const val = (v: unknown) => (v === "" || v === undefined || v === null ? "—" : String(v));
  if (!before) return keys.filter((k) => after?.[k] !== "" && after?.[k] !== false).map((k) => `${FIELDS[k]}: ${val(after?.[k])}`).join("\n");
  if (!after) return keys.filter((k) => before[k] !== "").map((k) => `${FIELDS[k]}: ${val(before[k])}`).join("\n");
  return keys
    .filter((k) => k === "passwordReset" ? after[k] === true : k in before && String(before[k]) !== String(after[k]))
    .map((k) => (k === "passwordReset" ? "Пароль сброшен" : `${FIELDS[k]}: ${val(before[k])} → ${val(after[k])}`))
    .join("\n");
}

export default async function AuditPage() {
  const user = await requirePageUser("editor");
  const rows = await db()`
    select id, at, username, action, entity, entity_id, before, after
    from audit_log order by at desc limit 500`;
  return (
    <>
      <TopNav user={user} />
      <main className="wrap">
        <header className="top">
          <div>
            <h1>Журнал изменений</h1>
            <p className="sub">Последние 500 действий: кто, когда и что поменял.</p>
          </div>
        </header>
        <section className="panel">
          <div className="tablewrap">
            <table>
              <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Изменения</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={4} className="empty">Изменений пока не было</td></tr>}
                {rows.map((r) => {
                  const subject = auditSubject(r.entity, r.after ?? r.before);
                  return (
                    <tr key={r.id}>
                      <td className="nowrap mono">{new Date(r.at).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}</td>
                      <td className="nowrap">{r.username}</td>
                      <td>{auditVerb(r.entity, r.action)} {subject}</td>
                      <td><pre className="diff">{r.entity === "kb_article" ? describeKb(r.before, r.after) : describe(r.before, r.after)}</pre></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

// "принтер 10.20.0.5", "акт ТМЦ для …" — what an audit_log row is about. Shared by /audit and /overview.
type Obj = Record<string, unknown> | null | undefined;

export function auditSubject(entity: string, obj: Obj): string {
  const s = (k: string) => String(obj?.[k] ?? "");
  switch (entity) {
    case "printer": return `принтер ${s("ip") || "без IP"}`;
    case "tmc_act": return `акт ТМЦ для ${s("recipient_name")}`;
    case "tmc_item": return `наименование ТМЦ «${s("name")}»`;
    case "tmc_org": return `организацию «${s("name")}»`;
    case "cartridge_move": return `запись картриджей ${s("from_place")} → ${s("to_place")}`;
    case "cartridge_model": return `модель картриджа «${s("name")}»`;
    case "kb_article": return `запись Помощника «${s("title")}»`;
    default: return `пользователя ${s("username")}`;
  }
}

export const AUDIT_ACTION: Record<string, string> = { create: "добавил", update: "изменил", delete: "удалил" };
export const auditVerb = (entity: string, action: string) =>
  entity === "kb_article" && action === "delete" ? "убрал" : AUDIT_ACTION[action] ?? action;

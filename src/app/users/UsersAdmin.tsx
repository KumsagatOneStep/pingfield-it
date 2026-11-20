"use client";
import { isDemoUsername } from "@/lib/demo/accounts";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, DropdownValue } from "../ui/Dropdown";

type Role = "viewer" | "editor" | "admin";
type User = { id: number; username: string; full_name: string; act_name: string; position: string; role: Role; active: boolean; must_change_password: boolean; locked: boolean };

const ROLE_LABEL: Record<Role, string> = { viewer: "Просмотр", editor: "Редактор", admin: "Администратор" };

function genPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default function UsersAdmin({ meId }: { meId: number }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);
  const [formError, setFormError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [newRole, setNewRole] = useState<Role>("editor");
  const actDialogRef = useRef<HTMLDialogElement>(null);
  const [actEdit, setActEdit] = useState<User | null>(null);
  const [actError, setActError] = useState("");

  const load = useCallback(async () => {
    try {
      setUsers((await api<{ users: User[] }>("/api/users")).users);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function patch(u: User, body: Partial<{ role: Role; active: boolean; password: string; fullName: string; actName: string; position: string }>) {
    setError("");
    try {
      await api(`/api/users/${u.id}`, "PATCH", body);
      if (body.password) setIssued({ username: u.username, password: body.password });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openActEdit(u: User) {
    setActEdit(u);
    setActError("");
    actDialogRef.current?.showModal();
  }

  async function saveActEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actEdit) return;
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/users/${actEdit.id}`, "PATCH", { fullName: f.get("fullName"), actName: f.get("actName"), position: f.get("position") });
      actDialogRef.current?.close();
      load();
    } catch (err) {
      setActError((err as Error).message);
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = genPassword();
    setFormError("");
    try {
      await api("/api/users", "POST", { username: f.get("username"), fullName: f.get("fullName"), actName: f.get("actName"), position: f.get("position"), role: f.get("role"), password });
      dialogRef.current?.close();
      setIssued({ username: String(f.get("username")).trim().toLowerCase(), password });
      load();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Пользователи</h1>
          <p className="sub">Просмотр — только смотреть. Редактор — добавлять, менять, удалять принтеры. Администратор — ещё и управлять пользователями.</p>
        </div>
        <button className="primary" type="button" onClick={() => { setFormError(""); setNewRole("editor"); dialogRef.current?.showModal(); }}>Добавить пользователя</button>
      </header>

      {error && <div className="err" role="alert">{error}</div>}
      {issued && (
        <div className="okmsg">
          Временный пароль для <b>{issued.username}</b>: <span className="mono" style={{ userSelect: "all" }}>{issued.password}</span>
          <br />Передайте его лично. При первом входе пользователь задаст свой пароль. Больше этот пароль нигде не показывается.
          <div style={{ marginTop: 6 }}><button type="button" className="small" onClick={() => setIssued(null)}>Скрыть</button></div>
        </div>
      )}

      <section className="panel">
        <div className="tablewrap">
          <table>
            <thead><tr><th>Логин</th><th>Имя</th><th>Для актов</th><th>Роль</th><th>Состояние</th><th></th></tr></thead>
            <tbody>
              {!users && <tr><td colSpan={6} className="empty">Загрузка…</td></tr>}
              {users?.map((u) => {
                const self = u.id === meId;
                return (
                  <tr key={u.id}>
                    <td className="mono">{u.username}</td>
                    <td>{u.full_name}</td>
                    <td>
                      {u.act_name || u.position
                        ? <>{u.act_name || "—"}<br /><span className="meta">{u.position || "должность не указана"}</span></>
                        : <span className="meta">не заполнено</span>}
                      <div><button type="button" className="small" onClick={() => openActEdit(u)}>Изменить</button></div>
                    </td>
                    <td>
                      <Dropdown value={u.role} disabled={self || isDemoUsername(u.username)} onValueChange={(v) => patch(u, { role: v as Role })}>
                        <DropdownTrigger aria-label={`Роль ${u.username}`} className="dd-compact"><DropdownValue /></DropdownTrigger>
                        <DropdownContent matchTriggerWidth>
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <DropdownItem key={r} value={r}>{ROLE_LABEL[r]}</DropdownItem>)}
                        </DropdownContent>
                      </Dropdown>
                    </td>
                    <td className="nowrap">
                      {u.active ? <span className="chip ok">активен</span> : <span className="chip bad">отключён</span>}
                      {u.locked && <span className="chip warn">заблокирован 15 мин</span>}
                      {u.must_change_password && <span className="chip out">временный пароль</span>}
                    </td>
                    <td className="nowrap">
                      {isDemoUsername(u.username) && !self && <span className="meta">демо-аккаунт</span>}
                      {!self && !isDemoUsername(u.username) && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="small" onClick={() => patch(u, { password: genPassword() })}>Сбросить пароль</button>
                          <button type="button" className={`small ${u.active ? "danger" : ""}`} onClick={() => patch(u, { active: !u.active })}>
                            {u.active ? "Отключить" : "Включить"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogRef} aria-labelledby="newUserTitle">
        <form className="stack" onSubmit={create}>
          <h2 id="newUserTitle">Новый пользователь</h2>
          <div className="field">
            <label htmlFor="nuUsername">Логин</label>
            <input id="nuUsername" name="username" required pattern="[a-zA-Z0-9._\-]{3,32}" autoComplete="off" placeholder="напр. a.ivanov" />
            <span className="help">Латиница, цифры, точка, дефис; 3–32 символа</span>
          </div>
          <div className="field">
            <label htmlFor="nuName">Имя</label>
            <input id="nuName" name="fullName" autoComplete="off" placeholder="напр. Алия Иванова" />
          </div>
          <div className="field">
            <label htmlFor="nuActName">ФИО для актов</label>
            <input id="nuActName" name="actName" autoComplete="off" placeholder="напр. Иванов И. И." />
          </div>
          <div className="field">
            <label htmlFor="nuPosition">Должность</label>
            <input id="nuPosition" name="position" autoComplete="off" placeholder="напр. Системный администратор" />
          </div>
          <div className="field">
            <label htmlFor="nuRole">Роль</label>
            <Dropdown block name="role" value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
              <DropdownTrigger id="nuRole"><DropdownValue /></DropdownTrigger>
              <DropdownContent matchTriggerWidth>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <DropdownItem key={r} value={r}>{ROLE_LABEL[r]}</DropdownItem>)}
              </DropdownContent>
            </Dropdown>
          </div>
          <div className="meta">Временный пароль сгенерируется автоматически и покажется после создания.</div>
          {formError && <div className="err" role="alert">{formError}</div>}
          <div className="actions">
            <div className="right">
              <button type="button" onClick={() => dialogRef.current?.close()}>Отмена</button>
              <button type="submit" className="primary">Создать</button>
            </div>
          </div>
        </form>
      </dialog>
      <dialog ref={actDialogRef} aria-labelledby="actEditTitle">
        {actEdit && (
          <form className="stack" onSubmit={saveActEdit} key={actEdit.id}>
            <h2 id="actEditTitle">{actEdit.username}: данные пользователя</h2>
            <div className="field">
              <label htmlFor="aeName">Имя</label>
              <input id="aeName" name="fullName" defaultValue={actEdit.full_name} maxLength={120} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="aeActName">ФИО для актов</label>
              <input id="aeActName" name="actName" defaultValue={actEdit.act_name} maxLength={120} autoComplete="off" placeholder="напр. Иванов И. И." />
              <span className="help">Печатается в акте ТМЦ в строке «ТМЦ передал»</span>
            </div>
            <div className="field">
              <label htmlFor="aePosition">Должность</label>
              <input id="aePosition" name="position" defaultValue={actEdit.position} maxLength={120} autoComplete="off" placeholder="напр. Системный администратор" />
            </div>
            {actError && <div className="err" role="alert">{actError}</div>}
            <div className="actions">
              <div className="right">
                <button type="button" onClick={() => actDialogRef.current?.close()}>Отмена</button>
                <button type="submit" className="primary">Сохранить</button>
              </div>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}

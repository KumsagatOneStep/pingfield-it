"use client";
import { useState } from "react";
import PasswordInput from "../PasswordInput";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";

const DEMO_LABEL: Record<string, string> = { demo_editor: "Войти как редактор", demo_admin: "Войти как админ" };

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await signIn(f.get("username"), f.get("password"));
  }

  async function signIn(username: FormDataEntryValue | null, password: FormDataEntryValue | null) {
    setBusy(true);
    setError("");
    try {
      // Not api(): it treats every 401 as an expired session and reloads /login,
      // which here would swallow the "wrong login or password" message.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { mustChangePassword?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось войти. Попробуйте ещё раз.");
      window.location.href = data.mustChangePassword ? "/account" : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="signin-fields" onSubmit={onSubmit}>
      <div className="anim d3">
        <label htmlFor="username">Логин</label>
        <div className="glass">
          <input id="username" name="username" autoComplete="username" required autoFocus placeholder="Введите логин" />
        </div>
      </div>
      <div className="anim d4">
        <label htmlFor="password">Пароль</label>
        <div className="glass">
          <PasswordInput id="password" name="password" autoComplete="current-password" required placeholder="Введите пароль" iconToggle />
        </div>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="primary signin-submit anim d5" type="submit" disabled={busy}>{busy ? "Вход…" : "Войти"}</button>
      <div className="demo-login">
        <p className="demo-login-title">Демо-доступ</p>
        <div className="demo-login-buttons">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.username} type="button" disabled={busy} onClick={() => signIn(a.username, a.password)}>
              {DEMO_LABEL[a.username]}
            </button>
          ))}
        </div>
        <p className="signin-note">
          {DEMO_ACCOUNTS.map((a, i) => (
            <span key={a.username}>{i > 0 && " · "}<span className="mono">{a.username}</span> / <span className="mono">{a.password}</span></span>
          ))}
        </p>
      </div>
    </form>
  );
}

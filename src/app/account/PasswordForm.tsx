"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import PasswordInput from "../PasswordInput";

export default function PasswordForm() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError("");
    if (f.get("next") !== f.get("repeat")) return setError("Новые пароли не совпадают");
    setBusy(true);
    try {
      await api("/api/account/password", "POST", { current: f.get("current"), next: f.get("next") });
      form.reset();
      setDone(true);
      setTimeout(() => (window.location.href = "/"), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" style={{ padding: 0 }} onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="current">Текущий пароль</label>
        <PasswordInput id="current" name="current" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="next">Новый пароль</label>
        <PasswordInput id="next" name="next" autoComplete="new-password" minLength={12} required />
        <span className="help">Не короче 12 символов. Удобно взять фразу из нескольких слов.</span>
      </div>
      <div className="field">
        <label htmlFor="repeat">Новый пароль ещё раз</label>
        <PasswordInput id="repeat" name="repeat" autoComplete="new-password" required />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      {done && <div className="okmsg">Пароль изменён. Другие устройства вышли из аккаунта.</div>}
      <button className="primary" type="submit" disabled={busy}>Сменить пароль</button>
    </form>
  );
}

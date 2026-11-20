"use client";
import { useEffect, useRef, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { iconToggle?: boolean };

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

// Поле пароля с кнопкой «Показать / Скрыть», чтобы проверить введённое.
// При отправке формы пароль снова прячется до того, как уйдёт запрос:
// браузер не должен запомнить его как обычный текст в подсказках автозаполнения.
export default function PasswordInput({ iconToggle = false, ...props }: Props) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const hide = () => {
      if (ref.current) ref.current.type = "password"; // синхронно, до обработчика отправки
      setShown(false);
    };
    form.addEventListener("submit", hide, true);
    form.addEventListener("reset", hide);
    return () => {
      form.removeEventListener("submit", hide, true);
      form.removeEventListener("reset", hide);
    };
  }, []);

  return (
    <div className={iconToggle ? "pw pw-icon" : "pw"}>
      <input {...props} ref={ref} type={shown ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className={iconToggle ? "pw-eye" : "small"}
        aria-pressed={shown}
        aria-controls={props.id}
        aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
        onClick={() => setShown((s) => !s)}
      >
        {iconToggle ? <EyeIcon off={shown} /> : shown ? "Скрыть" : "Показать"}
      </button>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

// Picture for the right half of the page (public/). While it is null, a plain gradient is shown instead.
const HERO_IMAGE: string | null = "/login-hero.svg";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="signin">
      <section className="signin-form">
        <div className="signin-inner">
          <div className="signin-kicker anim d1">Служба технической поддержки</div>
          <h1 className="anim d1">Вход в систему</h1>
          <p className="signin-lead anim d2">Реестр принтеров, акты ТМЦ и учёт картриджей.</p>
          <LoginForm />
        </div>
      </section>
      <section className="signin-hero" aria-hidden="true">
        <div
          className={`signin-hero-img anim-slide${HERO_IMAGE ? "" : " placeholder"}`}
          style={HERO_IMAGE ? { backgroundImage: `url(${HERO_IMAGE})` } : undefined}
        />
      </section>
    </main>
  );
}

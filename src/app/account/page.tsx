import { requirePageUser } from "@/lib/auth";
import TopNav from "../TopNav";
import PasswordForm from "./PasswordForm";
import { isDemoUsername } from "@/lib/demo/accounts";
import { DEMO_PASSWORD_LOCKED } from "@/lib/demo/guard";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requirePageUser("viewer", { passwordPage: true });
  return (
    <>
      <TopNav user={user} />
      <main className="wrap" style={{ maxWidth: 480 }}>
        <h1>Смена пароля</h1>
        {user.mustChangePassword && (
          <div className="err">Пароль выдан администратором. Придумайте свой, чтобы продолжить работу.</div>
        )}
        <div className="panel">{isDemoUsername(user.username) ? <p>{DEMO_PASSWORD_LOCKED}.</p> : <PasswordForm />}</div>
      </main>
    </>
  );
}

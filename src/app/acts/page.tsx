import { hasRole, requirePageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import TopNav from "../TopNav";
import Acts from "./Acts";

export const dynamic = "force-dynamic";

export default async function ActsPage() {
  const user = await requirePageUser("editor");
  const [me] = await db()`select act_name, position from users where id = ${user.id}`;
  return (
    <>
      <TopNav user={user} />
      <Acts me={{ id: user.id, isAdmin: hasRole(user, "admin"), actName: me?.act_name ?? "", position: me?.position ?? "" }} />
    </>
  );
}

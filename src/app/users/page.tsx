import { requirePageUser } from "@/lib/auth";
import TopNav from "../TopNav";
import UsersAdmin from "./UsersAdmin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requirePageUser("admin");
  return (
    <>
      <TopNav user={user} />
      <UsersAdmin meId={user.id} />
    </>
  );
}

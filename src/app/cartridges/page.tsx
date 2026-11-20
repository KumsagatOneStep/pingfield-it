import { hasRole, requirePageUser } from "@/lib/auth";
import TopNav from "../TopNav";
import Cartridges from "./Cartridges";

export const dynamic = "force-dynamic";

export default async function CartridgesPage() {
  const user = await requirePageUser("editor");
  return (
    <>
      <TopNav user={user} />
      <Cartridges me={{ id: user.id, isAdmin: hasRole(user, "admin") }} />
    </>
  );
}

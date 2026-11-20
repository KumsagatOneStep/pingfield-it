import { hasRole, requirePageUser } from "@/lib/auth";
import TopNav from "../TopNav";
import HelperList from "./HelperList";

export const dynamic = "force-dynamic";

export default async function HelperPage() {
  const user = await requirePageUser("viewer");
  return (
    <>
      <TopNav user={user} />
      <HelperList canEdit={hasRole(user, "editor")} isAdmin={hasRole(user, "admin")} />
    </>
  );
}

import { hasRole, requirePageUser } from "@/lib/auth";
import { loadOverview } from "@/lib/overview/load";
import TopNav from "./TopNav";
import Overview from "./overview/Overview";

export const dynamic = "force-dynamic";

// Home page: the "Обзор" dashboard. The printer registry lives at /registry.
export default async function Home() {
  const user = await requirePageUser("viewer");
  const data = await loadOverview(user);
  return (
    <>
      <TopNav user={user} />
      <Overview data={data} canEdit={hasRole(user, "editor")} />
    </>
  );
}

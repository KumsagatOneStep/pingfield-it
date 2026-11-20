import { requirePageUser } from "@/lib/auth";
import TopNav from "../TopNav";
import Registry from "./Registry";

export const dynamic = "force-dynamic";

export default async function RegistryPage() {
  const user = await requirePageUser();
  return (
    <>
      <TopNav user={user} />
      <Registry canEdit={user.role !== "viewer"} />
    </>
  );
}

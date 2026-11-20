import { requirePageUser } from "@/lib/auth";
import TopNav from "../../TopNav";
import ArticleForm from "../ArticleForm";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const user = await requirePageUser("editor");
  return (
    <>
      <TopNav user={user} />
      <ArticleForm />
    </>
  );
}

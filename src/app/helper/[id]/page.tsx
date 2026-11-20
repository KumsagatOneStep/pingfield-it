import { notFound } from "next/navigation";
import { hasRole, requirePageUser } from "@/lib/auth";
import { getArticle } from "@/lib/helper/store";
import TopNav from "../../TopNav";
import ArticleView from "./ArticleView";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("viewer");
  const isAdmin = hasRole(user, "admin");
  const article = await getArticle(Number((await params).id), isAdmin);
  if (!article) notFound();
  return (
    <>
      <TopNav user={user} />
      <ArticleView article={article} canEdit={hasRole(user, "editor")} isAdmin={isAdmin} />
    </>
  );
}

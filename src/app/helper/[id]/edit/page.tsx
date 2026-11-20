import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getArticle } from "@/lib/helper/store";
import TopNav from "../../../TopNav";
import ArticleForm from "../../ArticleForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("editor");
  const article = await getArticle(Number((await params).id), false);
  if (!article) notFound();
  return (
    <>
      <TopNav user={user} />
      <ArticleForm initial={article} />
    </>
  );
}

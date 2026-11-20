import { REPO_URL } from "@/lib/demo/links";

export default function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <span>Демо-версия: данные выдуманы и сбрасываются каждую ночь</span>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Исходный код на GitHub</a>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMyEvaluationHistory } from "@/server/evaluation";
import HistoryView from "./history-view";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const evaluations = await getMyEvaluationHistory();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <a href="/" className="text-sm text-blue-600 hover:underline">← メニューに戻る</a>
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">自己評価履歴</h2>
      {evaluations.length === 0 ? (
        <p className="text-center py-16 text-gray-400">評価履歴がありません</p>
      ) : (
        <HistoryView evaluations={evaluations} />
      )}
    </div>
  );
}

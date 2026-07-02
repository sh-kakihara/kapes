import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import LeaderEvalForm from "./leader-eval-form";
import { EVALUATION_ITEMS } from "@/lib/constants";

export default async function LeaderEvalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["LEADER", "ADMIN"].includes(session.user.role)) redirect("/evaluation");

  const { id } = await params;
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { employee: true, scores: true, period: true },
  });

  if (!evaluation) redirect("/leader");

  const selfScores = EVALUATION_ITEMS.map((item) => {
    const s = evaluation.scores.find((x) => x.item_code === item.code && x.evaluator === "self");
    return { item_code: item.code, score: s?.score ?? null, comment: s?.comment ?? "" };
  });
  const leaderScores = EVALUATION_ITEMS.map((item) => {
    const s = evaluation.scores.find((x) => x.item_code === item.code && x.evaluator === "leader");
    return { item_code: item.code, score: s?.score ?? null, comment: s?.comment ?? "" };
  });

  return (
    <div>
      <div className="mb-4">
        <a href="/leader" className="text-sm text-blue-600 hover:underline">← 一覧に戻る</a>
      </div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">{evaluation.employee.name} の評価</h2>
      <p className="text-sm text-gray-500 mb-6">期間: {evaluation.period.name}</p>

      <LeaderEvalForm
        evaluation={{ id: evaluation.id, status: evaluation.status, period: { leader_deadline: evaluation.period.leader_deadline } }}
        selfScores={selfScores}
        leaderScores={leaderScores}
      />
    </div>
  );
}

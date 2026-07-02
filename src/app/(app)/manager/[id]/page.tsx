import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ManagerEvalForm from "./manager-eval-form";
import { EVALUATION_ITEMS } from "@/lib/constants";

export default async function ManagerEvalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isManager = ["MANAGER", "ADMIN"].includes(session.user.role);
  let isDeptViewer = false;
  if (!isManager && !["DIRECTOR", "EXECUTIVE", "COUNSELOR", "PRESIDENT", "ADMIN"].includes(session.user.role)) {
    const me2 = await prisma.user.findUnique({ where: { id: session.user.id }, select: { section_id: true, department_id: true } });
    if (me2 && !me2.section_id && me2.department_id) isDeptViewer = true;
  }
  if (!isManager && !isDeptViewer) redirect("/evaluation");

  const { id } = await params;
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { employee: { include: { department: true } }, scores: true, period: true },
  });

  if (!evaluation) redirect("/manager");

  // 課長自身の部署の has_leader を取得
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { section: true },
  });
  const hasLeader = me?.section?.has_leader ?? false;

  const selfScores = EVALUATION_ITEMS.map((item) => {
    const s = evaluation.scores.find((x) => x.item_code === item.code && x.evaluator === "self");
    return { item_code: item.code, score: s?.score ?? null, comment: s?.comment ?? "" };
  });
  const isLeaderEmployee = evaluation.employee.role === "LEADER";

  // リーダー社員の場合、リーダー評価欄に自己評価点を表示する
  const leaderScores = EVALUATION_ITEMS.map((item) => {
    const ev = isLeaderEmployee ? "self" : "leader";
    const s = evaluation.scores.find((x) => x.item_code === item.code && x.evaluator === ev);
    return { item_code: item.code, score: s?.score ?? null, comment: s?.comment ?? "" };
  });
  const managerScores = EVALUATION_ITEMS.map((item) => {
    const s = evaluation.scores.find((x) => x.item_code === item.code && x.evaluator === "manager");
    return { item_code: item.code, score: s?.score ?? null, comment: s?.comment ?? "" };
  });

  return (
    <div>
      <div className="mb-4">
        <a href="/manager" className="text-sm text-blue-600 hover:underline">← 一覧に戻る</a>
      </div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">{evaluation.employee.name} の評価</h2>
      <p className="text-sm text-gray-500 mb-6">期間: {evaluation.period.name}</p>

      <ManagerEvalForm
        evaluation={{ id: evaluation.id, status: evaluation.status, period: { manager_deadline: evaluation.period.manager_deadline }, skipDirector: evaluation.employee.department?.skip_director ?? false }}
        selfScores={selfScores}
        leaderScores={leaderScores}
        managerScores={managerScores}
        hasLeader={hasLeader}
        leaderScoreIsSelf={isLeaderEmployee}
      />
    </div>
  );
}

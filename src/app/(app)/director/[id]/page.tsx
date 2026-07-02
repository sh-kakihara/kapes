import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import DirectorEvalForm from "./director-eval-form";
import { EVALUATION_ITEMS } from "@/lib/constants";

export default async function DirectorEvalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isDirectorRole = ["DIRECTOR", "EXECUTIVE", "ADMIN"].includes(session.user.role);
  const viewer = isDirectorRole
    ? null
    : await prisma.user.findUnique({ where: { id: session.user.id }, select: { can_view_evaluations: true } });
  if (!isDirectorRole && !viewer?.can_view_evaluations) redirect("/evaluation");
  const readOnly = !isDirectorRole;

  const { id } = await params;
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { employee: true, scores: true, period: true },
  });

  if (!evaluation) redirect("/director");

  const hasExecutive = evaluation.employee.department_id
    ? !!(await prisma.user.findFirst({
        where: { department_id: evaluation.employee.department_id, role: "EXECUTIVE", is_active: true, deleted_at: null },
      }))
    : false;

  const build = (evaluator: string) => EVALUATION_ITEMS.map((item) => {
    const s = evaluation.scores.find((x) => x.item_code === item.code && x.evaluator === evaluator);
    return { item_code: item.code, score: s?.score ?? null, comment: s?.comment ?? "" };
  });

  const employeeRole = evaluation.employee.role;
  // 課長社員：課長評価欄に自己評価点を表示
  const managerScores = employeeRole === "MANAGER" ? build("self") : build("manager");
  // リーダー社員：リーダー評価欄に自己評価点を表示
  const leaderScores = employeeRole === "LEADER" ? build("self") : build("leader");

  return (
    <div>
      <div className="mb-4">
        <a href="/director" className="text-sm text-blue-600 hover:underline">← 一覧に戻る</a>
      </div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">{evaluation.employee.name} の評価</h2>
      <p className="text-sm text-gray-500 mb-6">期間: {evaluation.period.name}</p>

      <DirectorEvalForm
        evaluation={{ id: evaluation.id, status: evaluation.status, period: { director_deadline: evaluation.period.director_deadline } }}
        selfScores={build("self")}
        leaderScores={leaderScores}
        managerScores={managerScores}
        employeeRole={employeeRole}
        directorScores={build("director")}
        directorHasSaved={evaluation.scores.some((s) => s.evaluator === "director")}
        executiveScores={build("executive")}
        executiveHasSaved={evaluation.scores.some((s) => s.evaluator === "executive")}
        isExecutive={session.user.role === "EXECUTIVE"}
        hasExecutive={hasExecutive}
        readOnly={readOnly}
      />
    </div>
  );
}

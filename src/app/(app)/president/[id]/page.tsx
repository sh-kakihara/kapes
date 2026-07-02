import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { EVALUATION_ITEMS, STATUS_LABELS } from "@/lib/constants";
import GradeEditPanel from "./grade-edit-panel";

export default async function PresidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/evaluation");

  const { id } = await params;
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true, section: true, group: true } },
      scores: true,
      period: true,
    },
  });

  if (!evaluation) redirect("/president");

  const empRecord = await prisma.employeeRecord.findFirst({
    where: { user_id: evaluation.employee_id },
    orderBy: { fiscal_year: "desc" },
  });

  const employeeRole = evaluation.employee.role;

  // 執行役員が在籍する部かどうか確認
  const hasExecutiveInDept = evaluation.employee.department_id
    ? !!(await prisma.user.findFirst({
        where: { department_id: evaluation.employee.department_id, role: "EXECUTIVE", is_active: true, deleted_at: null },
      }))
    : false;

  function build(evaluator: string) {
    return EVALUATION_ITEMS.map((item) => {
      const s = evaluation!.scores.find((x) => x.item_code === item.code && x.evaluator === evaluator);
      return { item_code: item.code, score: s?.score ?? null, comment: s?.comment ?? "" };
    });
  }

  const selfScores = build("self");
  const leaderScores = employeeRole === "LEADER" ? build("self") : build("leader");
  const managerScores = employeeRole === "MANAGER" ? build("self") : build("manager");
  const executiveScores = build("executive");

  // 部長評価列の解決
  // DIRECTOR + 執行役員在籍部 → 執行役員評価を部長評価として表示
  // EXECUTIVE → 自己評価を部長評価として表示
  // DIRECTOR（自分自身） → 自己評価を表示
  let rawDirectorScores;
  if (employeeRole === "EXECUTIVE") {
    rawDirectorScores = build("self");
  } else if (employeeRole === "DIRECTOR" && hasExecutiveInDept) {
    rawDirectorScores = executiveScores;
  } else if (employeeRole === "DIRECTOR") {
    rawDirectorScores = build("self");
  } else {
    rawDirectorScores = build("director");
  }

  // 部長評価スキップ（skip_director）または部長評価が未入力の場合は課長評価を代替表示
  const skipDirector = evaluation.employee.department?.skip_director ?? false;
  const directorHasScore = rawDirectorScores.some((s) => s.score !== null || s.comment);
  const directorScores = (!directorHasScore && skipDirector) ? managerScores : rawDirectorScores;
  const directorIsFallback = !directorHasScore && skipDirector;

  // 部長評価行のラベル
  const directorLabel =
    employeeRole === "EXECUTIVE" ? "部長評価（顧問の自己評価）" :
    (employeeRole === "DIRECTOR" && hasExecutiveInDept) ? "部長評価（顧問評価）" :
    "部長評価";

  const hasLeader = leaderScores.some((s) => s.score !== null || s.comment);

  const selfTotal = selfScores.reduce((sum, s) => sum + (s.score ?? 0), 0);
  const dirTotal = directorScores.reduce((sum, s) => sum + (s.score ?? 0), 0);
  const diff = dirTotal - selfTotal;

  return (
    <div>
      <div className="mb-4">
        <a href="/president" className="text-sm text-blue-600 hover:underline">← 一覧に戻る</a>
      </div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">{evaluation.employee.name} の評価</h2>
      <p className="text-sm text-gray-500 mb-1">期間: {evaluation.period.name}</p>
      <p className="text-sm text-gray-500 mb-4">
        {[evaluation.employee.department?.name, evaluation.employee.section?.name, evaluation.employee.group?.name]
          .filter(Boolean).join(" › ")}
      </p>

      <div className="mb-4">
        <GradeEditPanel
          userId={evaluation.employee_id}
          fiscalYear={empRecord?.fiscal_year ?? new Date().getFullYear()}
          initialGrades={{
            curr_summer_president_eval: empRecord?.curr_summer_president_eval ?? null,
            curr_winter_president_eval: empRecord?.curr_winter_president_eval ?? null,
          }}
        />
      </div>

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">
          {STATUS_LABELS[evaluation.status] ?? evaluation.status}
        </span>
        <span className="text-sm text-gray-600">
          合計（部長評価）: <strong className="text-purple-700">{dirTotal}</strong>
          <span className="mx-2 text-gray-400">/</span>
          合計（自己評価）: <strong className="text-blue-700">{selfTotal}</strong>
          <span className="mx-3 text-gray-400">|</span>
          差分:&nbsp;
          <strong className={diff > 0 ? "text-green-700" : diff < 0 ? "text-red-600" : "text-gray-500"}>
            {diff > 0 ? `+${diff}` : `${diff}`}
          </strong>
        </span>
      </div>

      <div className="space-y-4">
        {EVALUATION_ITEMS.map((item, idx) => {
          const self = selfScores.find((x) => x.item_code === item.code);
          const ldr = leaderScores.find((x) => x.item_code === item.code);
          const mgr = managerScores.find((x) => x.item_code === item.code);
          const dir = directorScores.find((x) => x.item_code === item.code);
          return (
            <div key={item.code} className="bg-white rounded-lg border p-5">
              <p className="font-semibold text-sm text-gray-800 mb-1">{idx + 1}. {item.label}</p>
              <p className="text-xs text-gray-500 mb-3">{item.description}</p>

              <div className="bg-gray-50 rounded p-3 mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">【本人の自己評価】</p>
                <div className="flex items-start gap-3">
                  <span className="text-blue-700 font-bold">{self?.score ?? "未入力"}</span>
                  {self?.comment && <span className="text-sm text-gray-600">「{self.comment}」</span>}
                </div>
              </div>

              {(employeeRole === "LEADER" || hasLeader) && (
                <div className="bg-gray-50 rounded p-3 mb-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    【リーダー評価】
                    {employeeRole === "LEADER" && <span className="ml-1 text-gray-400 font-normal">（自己評価と同じ点数）</span>}
                  </p>
                  <div className="flex items-start gap-3">
                    <span className="text-orange-600 font-bold">{ldr?.score ?? "未入力"}</span>
                    {ldr?.comment && <span className="text-sm text-gray-600">「{ldr.comment}」</span>}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded p-3 mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  【課長評価】
                  {employeeRole === "MANAGER" && <span className="ml-1 text-gray-400 font-normal">（自己評価と同じ点数）</span>}
                </p>
                <div className="flex items-start gap-3">
                  <span className="text-green-700 font-bold">{mgr?.score ?? "未入力"}</span>
                  {mgr?.comment && <span className="text-sm text-gray-600">「{mgr.comment}」</span>}
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  【{directorLabel}】
                  {directorIsFallback && <span className="ml-1 text-gray-400 font-normal">（課長評価と同じ点数）</span>}
                </p>
                <div className="flex items-start gap-3">
                  <span className="text-purple-700 font-bold">{dir?.score ?? "未入力"}</span>
                  {dir?.comment && <span className="text-sm text-gray-600">「{dir.comment}」</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

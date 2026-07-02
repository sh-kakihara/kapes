import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllPeriods, getPresidentEvaluations } from "@/server/evaluation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import EvaluationListTable, { type EvalListItem } from "@/components/evaluation-list-table";
import PeriodSelector from "./period-selector";

export default async function PresidentPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/evaluation");

  const { period: periodId } = await searchParams;
  const periods = await getAllPeriods();

  if (periods.length === 0) {
    return <div className="text-center py-20 text-gray-500">評価期間がありません</div>;
  }

  const selectedPeriod = periods.find((p) => p.id === periodId) ?? periods[0];
  const evaluations = await getPresidentEvaluations(selectedPeriod.id);

  // 執行役員が在籍する部署IDセットを取得
  const executiveDeptUsers = await prisma.user.findMany({
    where: { role: "EXECUTIVE", is_active: true, deleted_at: null, department_id: { not: null } },
    select: { department_id: true },
  });
  const execDeptIds = new Set(executiveDeptUsers.map((u) => u.department_id as string));

  const items: EvalListItem[] = evaluations.map((ev) => {
    const deptId = ev.employee.department?.id ?? null;
    const hasExec = deptId ? execDeptIds.has(deptId) : false;
    const role = ev.employee.role;

    // 部長評価列の差し替えロジック
    // DIRECTOR + 執行役員在籍部 → "executive" スコアを "director" として表示
    // EXECUTIVE → "self" スコアを "director" として表示
    let scores = ev.scores.map((s) => ({ item_code: s.item_code, evaluator: s.evaluator, score: s.score, comment: s.comment }));
    if (role === "EXECUTIVE") {
      // 自己評価を director キーとして追加
      const selfScores = scores.filter((s) => s.evaluator === "self").map((s) => ({ ...s, evaluator: "director" }));
      scores = [...scores.filter((s) => s.evaluator !== "director"), ...selfScores];
    } else if (role === "DIRECTOR" && hasExec) {
      // 執行役員評価を director キーとして追加
      const execScores = scores.filter((s) => s.evaluator === "executive").map((s) => ({ ...s, evaluator: "director" }));
      scores = [...scores.filter((s) => s.evaluator !== "director"), ...execScores];
    }

    return {
      evalId: ev.evalId,
      employee: {
        id: ev.employee.id,
        employee_number: ev.employee.employee_number,
        name: ev.employee.name,
        role,
        department: ev.employee.department,
        section: ev.employee.section
          ? { name: ev.employee.section.name, has_leader: ev.employee.section.has_leader }
          : null,
        group: ev.employee.group ?? null,
        hasManager: ev.employee.hasManager,
      },
      status: ev.status,
      scores,
      skip_reason: ev.skip_reason ?? null,
    };
  });

  const scoreOptions = [
    { value: "director", label: "部長評価" },
    { value: "manager", label: "課長評価" },
    { value: "leader", label: "リーダー評価" },
    { value: "self", label: "自己評価" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">評価閲覧画面</h2>
          <Link
            href={`/president/scatter${selectedPeriod.id !== periods[0]?.id ? `?period=${selectedPeriod.id}` : ""}`}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
          >
            散布図
          </Link>
        </div>
        <PeriodSelector
          periods={periods.map((p) => ({ id: p.id, name: p.name, is_active: p.is_active }))}
          selectedId={selectedPeriod.id}
        />
      </div>
      <p className="text-sm text-gray-500 mb-6">評価期間: {selectedPeriod.name}</p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-lg border">
          提出された評価はありません
        </div>
      ) : (
        <EvaluationListTable
          items={items}
          detailBasePath="/president"
          detailButtonLabel="詳細を見る"
          scoreEvaluator="director"
          scoreOptions={scoreOptions}
hideWithoutGroupForEvaluator="leader"
          popupColumns={[
            { key: "self",      label: "自己評価",     color: "text-blue-600" },
            { key: "leader",    label: "リーダー評価", color: "text-orange-500", hideIfSectionNoLeader: true },
            { key: "manager",   label: "課長評価",     color: "text-green-700" },
            { key: "director",  label: "部長評価",     color: "text-purple-700" },
          ]}
          diffColumn={{ evaluatorA: "director", evaluatorB: "self", label: "部長評価−自己評価", showForEvaluator: "director" }}
        />
      )}
    </div>
  );
}

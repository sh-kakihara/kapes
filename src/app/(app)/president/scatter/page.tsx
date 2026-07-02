import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllPeriods, getPresidentEvaluations } from "@/server/evaluation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import PeriodSelector from "../period-selector";
import ScatterChart, { type ScatterPoint } from "./scatter-chart";

export default async function ScatterPage({
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

  // 執行役員が在籍する部署IDセット（部長評価の差し替えに使用）
  const executiveDeptUsers = await prisma.user.findMany({
    where: { role: "EXECUTIVE", is_active: true, deleted_at: null, department_id: { not: null } },
    select: { department_id: true },
  });
  const execDeptIds = new Set(executiveDeptUsers.map((u) => u.department_id as string));

  const points: ScatterPoint[] = [];

  for (const ev of evaluations) {
    const role = ev.employee.role;
    const deptId = ev.employee.department?.id ?? null;
    const hasExec = deptId ? execDeptIds.has(deptId) : false;

    // 部長評価キーの解決（president/page.tsx と同じロジック）
    let directorKey = "director";
    if (role === "EXECUTIVE") directorKey = "self";
    else if (role === "DIRECTOR" && hasExec) directorKey = "executive";

    const selfTotal = ev.scores
      .filter((s) => s.evaluator === "self" && s.score !== null)
      .reduce((sum, s) => sum + (s.score ?? 0), 0);

    const directorTotal = ev.scores
      .filter((s) => s.evaluator === directorKey && s.score !== null)
      .reduce((sum, s) => sum + (s.score ?? 0), 0);

    // 自己評価・部長評価ともに入力済みの社員のみプロット
    const selfCount = ev.scores.filter((s) => s.evaluator === "self" && s.score !== null).length;
    const directorCount = ev.scores.filter((s) => s.evaluator === directorKey && s.score !== null).length;
    if (selfCount === 0 || directorCount === 0) continue;

    points.push({
      name: ev.employee.name,
      employeeNumber: ev.employee.employee_number ?? null,
      department: ev.employee.department?.name ?? "",
      selfTotal,
      directorTotal,
    });
  }

  const periodQuery = selectedPeriod.id !== periods[0]?.id ? `?period=${selectedPeriod.id}` : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/president${periodQuery}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← 評価閲覧画面
          </Link>
          <h2 className="text-xl font-bold text-gray-800">評価散布図</h2>
        </div>
        <PeriodSelector
          periods={periods.map((p) => ({ id: p.id, name: p.name, is_active: p.is_active }))}
          selectedId={selectedPeriod.id}
          basePath="/president/scatter"
        />
      </div>
      <p className="text-sm text-gray-500 mb-1">評価期間: {selectedPeriod.name}</p>
      <p className="text-xs text-gray-400 mb-6">自己評価・部長評価がともに入力済みの社員のみ表示（{points.length}名）</p>

      {points.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-lg border">
          プロットできるデータがありません
        </div>
      ) : (
        <ScatterChart points={points} />
      )}
    </div>
  );
}

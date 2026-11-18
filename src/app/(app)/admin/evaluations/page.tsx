import { auth } from "@/auth";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getAllPeriods, getAdminEvaluations } from "@/server/evaluation";
import { type EvalListItem } from "@/components/evaluation-list-table";
import AdminEvalTable from "./admin-eval-table";
import PeriodSelect from "./period-select";

export default async function AdminEvaluationsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const { period: periodIdParam } = await searchParams;

  const periods = await getAllPeriods();
  if (periods.length === 0) {
    return (
      <div>
        <div className="mb-4"><a href="/admin" className="text-sm text-blue-600 hover:underline">← 管理者メニュー</a></div>
        <div className="text-center py-20 text-gray-500">評価期間がありません</div>
      </div>
    );
  }

  const period = periods.find((p) => p.id === periodIdParam) ?? periods[0];
  const evaluations = await getAdminEvaluations(period.id);

  const items: EvalListItem[] = evaluations.map((ev) => ({
    evalId: ev.evalId,
    employee: {
      id: ev.employee.id,
      employee_number: ev.employee.employee_number,
      name: ev.employee.name,
      role: ev.employee.role,
      department: ev.employee.department,
      section: ev.employee.section,
      group: ev.employee.group,
    },
    status: ev.status,
    scores: ev.scores.map((s) => ({
      item_code: s.item_code,
      evaluator: s.evaluator,
      score: s.score,
      comment: s.comment,
    })),
    skip_reason: ev.skip_reason,
  }));

  return (
    <div>
      <div className="mb-4"><a href="/admin" className="text-sm text-blue-600 hover:underline">← 管理者メニュー</a></div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">全評価閲覧</h2>

      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm font-medium text-gray-600">評価期間：</label>
        <PeriodSelect periods={periods} selectedId={period.id} />
      </div>

      <AdminEvalTable items={items} />
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActivePeriods, getManagerEvaluationList, getDeptViewerEvaluationList, skipEvaluation, undoSkipEvaluation } from "@/server/evaluation";
import { prisma } from "@/lib/db";
import EvaluationListTable from "@/components/evaluation-list-table";

export default async function ManagerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const isManager = ["MANAGER", "ADMIN"].includes(role);

  // 課なし閲覧者（部長・顧問・参事・課長・社長・管理者以外で課なし）の判定
  let isDeptViewer = false;
  if (!isManager && !["DIRECTOR", "EXECUTIVE", "COUNSELOR", "PRESIDENT", "ADMIN"].includes(role)) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { section_id: true, department_id: true } });
    if (me && !me.section_id && me.department_id) {
      isDeptViewer = true;
    }
  }

  if (!isManager && !isDeptViewer) redirect("/evaluation");

  const periods = await getActivePeriods();
  if (periods.length === 0) {
    return <div className="text-center py-20 text-gray-500">有効な評価期間がありません</div>;
  }

  const period = periods[0];

  if (isDeptViewer) {
    const items = await getDeptViewerEvaluationList(period.id);
    return (
      <div>
        <h2 className="text-xl font-bold mb-1 text-gray-800">課長評価画面</h2>
        <p className="text-sm text-gray-500 mb-6">評価期間: {period.name}</p>
        <EvaluationListTable
          items={items}
          detailBasePath="/manager"
          scoreEvaluator="manager"
          scoreOptions={[
            { value: "manager", label: "課長評価" },
            { value: "leader",  label: "リーダー評価" },
            { value: "self",    label: "自己評価" },
          ]}
          popupColumns={[
            { key: "self",    label: "自己評価",     color: "text-blue-600" },
            { key: "leader",  label: "リーダー評価", color: "text-orange-500", hideIfSectionNoLeader: true },
            { key: "manager", label: "課長評価",     color: "text-green-700" },
          ]}
          onSkipEvaluation={async (item, reason) => {
            "use server";
            await skipEvaluation(period.id, item.employee.id, reason);
          }}
          onUndoSkipEvaluation={async (item) => {
            "use server";
            await undoSkipEvaluation(item.evalId!);
          }}
        />
      </div>
    );
  }

  const items = await getManagerEvaluationList(period.id);

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { section: true },
  });
  const hasLeader = me?.section?.has_leader ?? false;
  const scoreEvaluator = hasLeader ? "leader" : "self";

  const scoreOptions = [
    { value: "manager", label: "課長評価" },
    ...(hasLeader ? [{ value: "leader", label: "リーダー評価" }] : []),
    { value: "self", label: "自己評価" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">課長評価画面</h2>
      <p className="text-sm text-gray-500 mb-6">評価期間: {period.name}</p>
      <EvaluationListTable
        items={items}
        detailBasePath="/manager"
        scoreEvaluator={scoreEvaluator}
        scoreOptions={scoreOptions}
        selfUserId={session.user.id}
        hideForEvaluator="leader"
        selfHidesForEvaluator="manager"
        showSelfForRoles={[{ evaluator: "leader", role: "LEADER" }]}
        popupColumns={[
          { key: "self",   label: "自己評価",     color: "text-blue-600" },
          { key: "leader", label: "リーダー評価", color: "text-orange-500", roleOverride: "LEADER", hideIfSectionNoLeader: true },
        ]}
        onSkipEvaluation={async (item, reason) => {
          "use server";
          await skipEvaluation(period.id, item.employee.id, reason);
        }}
        onUndoSkipEvaluation={async (item) => {
          "use server";
          await undoSkipEvaluation(item.evalId!);
        }}
      />
    </div>
  );
}

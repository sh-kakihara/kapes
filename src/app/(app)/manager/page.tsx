import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActivePeriods, getManagerEvaluationList } from "@/server/evaluation";
import { prisma } from "@/lib/db";
import EvaluationListTable from "@/components/evaluation-list-table";

export default async function ManagerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) redirect("/evaluation");

  const periods = await getActivePeriods();
  if (periods.length === 0) {
    return <div className="text-center py-20 text-gray-500">有効な評価期間がありません</div>;
  }

  const period = periods[0];
  const items = await getManagerEvaluationList(period.id);

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { section: true },
  });
  const hasLeader = me?.section?.has_leader ?? false;
  // リーダーあり部署はリーダー評価点、なし部署は自己評価点
  // ただし課長自身は selfUserId により自己評価点を表示
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
      />
    </div>
  );
}

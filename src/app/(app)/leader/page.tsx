import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActivePeriods, getLeaderEvaluationList } from "@/server/evaluation";
import EvaluationListTable from "@/components/evaluation-list-table";

export default async function LeaderPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["LEADER", "ADMIN"].includes(session.user.role)) redirect("/evaluation");

  const periods = await getActivePeriods();
  if (periods.length === 0) {
    return <div className="text-center py-20 text-gray-500">有効な評価期間がありません</div>;
  }

  const period = periods[0];
  const items = await getLeaderEvaluationList(period.id);

  return (
    <div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">リーダー評価画面</h2>
      <p className="text-sm text-gray-500 mb-6">評価期間: {period.name}</p>
      <EvaluationListTable
        items={items}
        detailBasePath="/leader"
        scoreEvaluator="self"
        scoreOptions={[
          { value: "self", label: "自己評価" },
          { value: "leader", label: "リーダー評価" },
        ]}
        selfUserId={session.user.id}
        selfHidesForEvaluator="leader"
        hideWithoutGroupForEvaluator="leader"
        popupColumns={[
          { key: "self",   label: "自己評価",     color: "text-blue-600" },
          { key: "leader", label: "リーダー評価", color: "text-orange-500", hideIfHasGroup: true, hideIfSectionNoLeader: true },
        ]}
      />
    </div>
  );
}

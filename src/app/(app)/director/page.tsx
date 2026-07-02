import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActivePeriods, getDirectorEvaluationList } from "@/server/evaluation";
import { prisma } from "@/lib/db";
import EvaluationListTable from "@/components/evaluation-list-table";

export default async function DirectorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isDirectorRole = ["DIRECTOR", "ADMIN"].includes(session.user.role);
  const isExecutive = session.user.role === "EXECUTIVE";
  if (!isDirectorRole && !isExecutive) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { can_view_evaluations: true } });
    if (!me?.can_view_evaluations) redirect("/evaluation");
  }

  const periods = await getActivePeriods();
  if (periods.length === 0) {
    return <div className="text-center py-20 text-gray-500">有効な評価期間がありません</div>;
  }

  const period = periods[0];
  const items = await getDirectorEvaluationList(period.id);

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  const hasLeader = me?.department_id
    ? (await prisma.section.count({ where: { department_id: me.department_id, has_leader: true, deleted_at: null } })) > 0
    : false;

  const scoreOptions = [
    { value: "manager",  label: "課長評価" },
    { value: "director", label: "部長評価" },
    ...(hasLeader ? [{ value: "leader", label: "リーダー評価" }] : []),
    { value: "self", label: "自己評価" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">部長評価画面</h2>
      <p className="text-sm text-gray-500 mb-6">評価期間: {period.name}</p>
      <EvaluationListTable
        items={items}
        detailBasePath="/director"
        scoreEvaluator="manager"
        scoreOptions={scoreOptions}
        selfUserId={session.user.id}
        hideForEvaluator={["leader", "manager"]}
        selfHidesForEvaluator="director"
        showSelfForRoles={[
          { evaluator: "leader", role: "LEADER" },
          { evaluator: "manager", role: "MANAGER" },
        ]}
        hideWithoutGroupForEvaluator="leader"
        popupColumns={[
          { key: "self",    label: "自己評価",     color: "text-blue-600" },
          { key: "leader",  label: "リーダー評価", color: "text-orange-500", roleOverride: "LEADER", showForRoles: ["STAFF", "LEADER"], hideIfSectionNoLeader: true },
          { key: "manager", label: "課長評価",     color: "text-green-700", roleOverride: "MANAGER" },
        ]}
      />
    </div>
  );
}

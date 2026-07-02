import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActivePeriods, getOrCreateMyEvaluation } from "@/server/evaluation";
import { prisma } from "@/lib/db";
import EvaluationForm from "./evaluation-form";

export default async function EvaluationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { employee_type: true, department: { select: { skip_evaluation: true } } },
  });
  if (dbUser?.employee_type === "実習生" || dbUser?.department?.skip_evaluation) redirect("/");

  const periods = await getActivePeriods();
  if (periods.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        現在有効な評価期間がありません。管理者にお問い合わせください。
      </div>
    );
  }

  const period = periods[0];
  const evaluation = await getOrCreateMyEvaluation(period.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { section: true, department: true },
  });
  const hasLeader = user?.section?.has_leader ?? false;
  const skipDirector = user?.department?.skip_director ?? false;
  const role = session.user.role;

  // 課長が存在するか（課なし or 課長不在の場合は部長へ直提出）
  const hasManager = user?.section_id
    ? !!(await prisma.user.findFirst({
        where: { section_id: user.section_id, role: "MANAGER", is_active: true, deleted_at: null },
      }))
    : false;

  // 部署に執行役員がいるか
  const hasExecutive = user?.department_id
    ? !!(await prisma.user.findFirst({
        where: { department_id: user.department_id, role: "EXECUTIVE", is_active: true, deleted_at: null },
      }))
    : false;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">自己評価入力</h2>
      <p className="text-sm text-gray-500 mb-6">評価期間: {period.name}</p>
      <EvaluationForm evaluation={evaluation} hasLeader={hasLeader} role={role} skipDirector={skipDirector} hasManager={hasManager} hasExecutive={hasExecutive} />
    </div>
  );
}

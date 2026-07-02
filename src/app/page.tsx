import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  if (role === "ADMIN") redirect("/admin");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      employee_type: true,
      can_view_evaluations: true,
      can_view_notices: true,
      section_id: true,
      department_id: true,
      department: { select: { skip_evaluation: true } },
      section: { select: { has_leader: true } },
    },
  });
  const isTrainee = dbUser?.employee_type === "実習生";
  const skipEvaluation = dbUser?.department?.skip_evaluation ?? false;
  const sectionHasLeader = dbUser?.section?.has_leader ?? false;
  const canViewEvaluations = dbUser?.can_view_evaluations ?? false;
  const canViewNotices = dbUser?.can_view_notices ?? false;

  // 1年以内に定年（60歳）となる社員（社長権限のみ）
  let retiringEmployees: { id: string; name: string; employee_number: string | null; birth_date: Date }[] = [];
  if (role === "PRESIDENT") {
    const today = new Date();
    const sixtyYearsAgo = new Date(today.getFullYear() - 60, today.getMonth(), today.getDate());
    const fiftyNineYearsAgo = new Date(today.getFullYear() - 59, today.getMonth(), today.getDate());
    const records = await prisma.employeeRecord.findMany({
      where: {
        birth_date: { gte: sixtyYearsAgo, lte: fiftyNineYearsAgo },
        user: { is_active: true, deleted_at: null, resign_date: null },
      },
      select: {
        birth_date: true,
        user: { select: { id: true, name: true, employee_number: true } },
      },
      distinct: ["user_id"],
      orderBy: { birth_date: "asc" },
    });
    retiringEmployees = records.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      employee_number: r.user.employee_number,
      birth_date: r.birth_date!,
    }));
  }

  const menus: { href: string; label: string; description: string; color: string }[] = [];

  if (role === "PRESIDENT") {
    menus.push({ href: "/president", label: "評価閲覧", description: "全社員の評価を閲覧する", color: "bg-indigo-600 hover:bg-indigo-700" });
    menus.push({ href: "/admin/employees", label: "社員台帳", description: "社員の給与・賞与・評価情報を管理する", color: "bg-teal-600 hover:bg-teal-700" });
  } else if (!isTrainee && !skipEvaluation) {
    menus.push({ href: "/evaluation", label: "自己評価", description: "自分の評価を入力・提出する", color: "bg-blue-600 hover:bg-blue-700" });
  }
  if (role === "LEADER") {
    menus.push({ href: "/leader", label: "リーダー評価", description: "担当メンバーのリーダー評価を行う", color: "bg-orange-500 hover:bg-orange-600" });
  }
  if (role === "MANAGER") {
    menus.push({ href: "/manager", label: "課長評価", description: "担当課員の課長評価を行う", color: "bg-green-600 hover:bg-green-700" });
    if (sectionHasLeader) {
      menus.push({ href: "/manager/groups", label: "グループ・リーダー管理", description: "グループのメンバーとリーダーを設定する", color: "bg-green-700 hover:bg-green-800" });
    }
  }
  if (role === "DIRECTOR") {
    menus.push({ href: "/director", label: "部長評価", description: "部署全体の部長評価を行う", color: "bg-purple-600 hover:bg-purple-700" });
  }
  if (role === "EXECUTIVE") {
    menus.push({ href: "/director", label: "部長評価閲覧", description: "担当部署の部長評価を閲覧する", color: "bg-indigo-600 hover:bg-indigo-700" });
  }
  // 課なし・部長でも顧問でも課長でもない部署所属者 → 課長評価閲覧
  const isDeptViewer = !["DIRECTOR", "EXECUTIVE", "COUNSELOR", "MANAGER", "PRESIDENT", "ADMIN", "LEADER"].includes(role)
    && !dbUser?.section_id
    && !!dbUser?.department_id;
  if (isDeptViewer) {
    menus.push({ href: "/manager", label: "課長評価", description: "自部署の課長評価を入力する", color: "bg-green-600 hover:bg-green-700" });
  }
  if (!isTrainee && !skipEvaluation && role !== "PRESIDENT") {
    menus.push({ href: "/history", label: "自己評価履歴", description: "過去の自己評価を期間ごとに閲覧する", color: "bg-slate-500 hover:bg-slate-600" });
  }
  if (canViewNotices) {
    menus.push({ href: "/my-notices", label: "通知書", description: "昇給・賞与通知書を閲覧・印刷する", color: "bg-amber-600 hover:bg-amber-700" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">人事評価システム</span>
        <div className="flex items-center gap-4 text-sm">
          <span>{session.user.name}（{ROLE_LABELS[role] ?? role}）</span>
          <a href="/settings" className="text-xs text-blue-200 hover:text-white">パスワード変更</a>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
        <div className="max-w-lg mx-auto py-10">
          <h2 className="text-xl font-bold text-gray-800 mb-6">メニュー</h2>
          <div className="space-y-3">
            {menus.map((m) => (
              <Link key={m.href} href={m.href}
                className={`flex flex-col px-6 py-4 rounded-lg text-white transition-colors ${m.color}`}>
                <span className="font-bold text-base">{m.label}</span>
                <span className="text-sm opacity-90 mt-0.5">{m.description}</span>
              </Link>
            ))}
          </div>
          {retiringEmployees.length > 0 && (
            <div className="mt-6 bg-amber-50 border border-amber-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-600 text-lg">⚠️</span>
                <h3 className="font-bold text-amber-800 text-sm">
                  1年以内に定年（60歳）となる社員 — {retiringEmployees.length}名
                </h3>
              </div>
              <div className="space-y-1.5">
                {retiringEmployees.map((emp) => {
                  const today = new Date();
                  const birth = new Date(emp.birth_date);
                  const retirementDate = new Date(birth.getFullYear() + 60, birth.getMonth(), birth.getDate());
                  const daysLeft = Math.ceil((retirementDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const months = Math.floor(daysLeft / 30);
                  const retirementStr = `${retirementDate.getFullYear()}年${retirementDate.getMonth() + 1}月${retirementDate.getDate()}日`;
                  return (
                    <div key={emp.id} className="flex items-center gap-3 text-sm bg-white border border-amber-200 rounded px-3 py-2">
                      <span className="text-gray-500 text-xs w-14 shrink-0">{emp.employee_number ?? "-"}</span>
                      <span className="font-medium text-gray-800 w-24 shrink-0">{emp.name}</span>
                      <span className="text-gray-500 text-xs">
                        定年日: {retirementStr}
                        <span className={`ml-2 font-medium ${daysLeft <= 90 ? "text-red-600" : "text-amber-700"}`}>
                          （あと約{months}ヶ月）
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

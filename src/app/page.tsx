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
      department: { select: { skip_evaluation: true } },
      section: { select: { has_leader: true } },
    },
  });
  const isTrainee = dbUser?.employee_type === "実習生";
  const skipEvaluation = dbUser?.department?.skip_evaluation ?? false;
  const sectionHasLeader = dbUser?.section?.has_leader ?? false;
  const canViewEvaluations = dbUser?.can_view_evaluations ?? false;
  const canViewNotices = dbUser?.can_view_notices ?? false;

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
    menus.push({ href: "/director", label: "顧問評価", description: "担当部署の評価を行う", color: "bg-indigo-600 hover:bg-indigo-700" });
  }
  if (canViewEvaluations && !["DIRECTOR", "EXECUTIVE", "ADMIN", "PRESIDENT"].includes(role)) {
    menus.push({ href: "/director", label: "評価閲覧", description: "部門の評価を閲覧する（閲覧専用）", color: "bg-gray-600 hover:bg-gray-700" });
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
        </div>
      </main>
    </div>
  );
}

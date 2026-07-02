import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "PRESIDENT"].includes(session.user.role)) redirect("/evaluation");

  return (
    <div>
      <h2 className="text-xl font-bold mb-6 text-gray-800">管理者メニュー</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/admin/users" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">社員管理</h3>
          <p className="text-sm text-gray-500">社員の登録・編集・削除</p>
        </Link>
        <Link href="/admin/departments" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">部署・課管理</h3>
          <p className="text-sm text-gray-500">部署・課の追加、リーダー評価の有無設定</p>
        </Link>
        <Link href="/admin/periods" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">評価期間管理</h3>
          <p className="text-sm text-gray-500">評価期間の作成・修正期限の設定</p>
        </Link>
        <Link href="/admin/evaluations" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">全評価閲覧</h3>
          <p className="text-sm text-gray-500">全社員の全評価（自己・リーダー・課長・部長）を閲覧</p>
        </Link>
        <Link href="/admin/employees" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">社員台帳</h3>
          <p className="text-sm text-gray-500">社員の給与・賞与・評価情報を管理</p>
        </Link>
        <Link href="/admin/notices" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">昇給・賞与通知書</h3>
          <p className="text-sm text-gray-500">昇給通知・賞与通知の作成と印刷</p>
        </Link>
        <Link href="/admin/attendance" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">精勤手当・支給額設定</h3>
          <p className="text-sm text-gray-500">期ごとの出勤情報・精勤手当・欠勤控除の管理</p>
        </Link>
        <Link href="/admin/inflation" className="bg-white rounded-lg border p-6 hover:border-blue-400 transition-colors">
          <h3 className="font-bold text-gray-800 mb-1">インフレ手当設定</h3>
          <p className="text-sm text-gray-500">夏期・冬期のインフレ手当金額を設定</p>
        </Link>
      </div>
    </div>
  );
}

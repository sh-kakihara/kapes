import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NoticesIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/admin");

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← 管理者メニュー
      </Link>
      <h2 className="text-xl font-bold mb-6 text-gray-800">昇給・賞与通知書</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-2xl">
        <Link
          href="/admin/notices/salary"
          className="bg-white rounded-xl border-2 p-10 hover:border-blue-400 hover:shadow-md transition-all text-center"
        >
          <h3 className="text-2xl font-bold text-gray-800 mb-2">昇給通知</h3>
          <p className="text-sm text-gray-500">昇給通知書の設定と印刷</p>
        </Link>
        <Link
          href="/admin/notices/bonus"
          className="bg-white rounded-xl border-2 p-10 hover:border-blue-400 hover:shadow-md transition-all text-center"
        >
          <h3 className="text-2xl font-bold text-gray-800 mb-2">賞与通知</h3>
          <p className="text-sm text-gray-500">夏期・冬期の賞与通知書の設定と印刷</p>
        </Link>
      </div>
    </div>
  );
}

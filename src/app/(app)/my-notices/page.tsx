import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MyNoticesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← メニュー
      </Link>
      <h2 className="text-xl font-bold mb-6 text-gray-800">自分の通知書</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-2xl">
        <Link
          href="/my-notices/salary"
          className="bg-white rounded-xl border-2 p-10 hover:border-blue-400 hover:shadow-md transition-all text-center"
        >
          <h3 className="text-2xl font-bold text-gray-800 mb-2">昇給通知</h3>
          <p className="text-sm text-gray-500">年度ごとの昇給通知書を閲覧・印刷</p>
        </Link>
        <Link
          href="/my-notices/bonus"
          className="bg-white rounded-xl border-2 p-10 hover:border-blue-400 hover:shadow-md transition-all text-center"
        >
          <h3 className="text-2xl font-bold text-gray-800 mb-2">賞与通知</h3>
          <p className="text-sm text-gray-500">夏期・冬期の賞与通知書を閲覧・印刷</p>
        </Link>
      </div>
    </div>
  );
}

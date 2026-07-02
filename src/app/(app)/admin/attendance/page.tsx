import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAttendancePeriods } from "@/server/attendance";
import AttendanceMain from "./attendance-main";

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "PRESIDENT"].includes(session.user.role)) redirect("/");

  const periods = await getAttendancePeriods();

  return (
    <div>
      {session.user.role === "ADMIN" && (
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← 管理者メニュー
        </Link>
      )}
      <h2 className="text-xl font-bold mb-1 text-gray-800">精勤手当・支給額設定</h2>
      <p className="text-sm text-gray-500 mb-6">管理者・社長のみアクセスできます</p>
      <AttendanceMain initialPeriods={periods} />
    </div>
  );
}

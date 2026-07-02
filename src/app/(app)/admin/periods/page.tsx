import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPeriods, createPeriod, togglePeriod } from "@/server/admin";
import PeriodAdmin from "./period-admin";

export default async function AdminPeriodsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const periods = await getPeriods();

  return (
    <div>
      <div className="mb-4">
        <a href="/admin" className="text-sm text-blue-600 hover:underline">← 管理者メニュー</a>
      </div>
      <h2 className="text-xl font-bold mb-6 text-gray-800">評価期間管理</h2>
      <PeriodAdmin periods={periods} />
    </div>
  );
}

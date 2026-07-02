import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getInflationSetting, getInflationEmployees } from "@/server/inflation";
import InflationMain from "./inflation-main";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

export default async function InflationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; season?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/admin");

  const sp = await searchParams;
  const year = Number(sp.year ?? CURRENT_YEAR);
  const season = (sp.season === "冬期" ? "冬期" : "夏期") as "夏期" | "冬期";

  const [setting, { setting_id, rows }] = await Promise.all([
    getInflationSetting(year, season),
    getInflationEmployees(year, season),
  ]);

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← 管理者メニュー
      </Link>
      <h2 className="text-xl font-bold mb-6 text-gray-800">インフレ手当設定</h2>
      <InflationMain
        key={`${year}-${season}`}
        years={YEARS}
        activeYear={year}
        activeSeason={season}
        enabled={setting?.enabled ?? true}
        noticeDate={setting?.notice_date ?? ""}
        settingId={setting_id}
        rows={rows}
      />
    </div>
  );
}

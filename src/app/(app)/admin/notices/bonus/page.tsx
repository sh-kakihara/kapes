import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBonusNoticeDocument, getBonusNoticeEmployees } from "@/server/notice";
import { DEFAULT_REP } from "@/lib/notice-constants";
import BonusMain from "./bonus-main";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

export default async function BonusNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/admin");

  const sp = await searchParams;
  const year = Number(sp.year ?? CURRENT_YEAR);

  const [summerDoc, winterDoc, summerEmps, winterEmps] = await Promise.all([
    getBonusNoticeDocument(year, "夏期"),
    getBonusNoticeDocument(year, "冬期"),
    getBonusNoticeEmployees(year, "夏期"),
    getBonusNoticeEmployees(year, "冬期"),
  ]);

  const defaultRep = DEFAULT_REP;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <a href="/admin/notices" className="text-sm text-gray-400 hover:text-gray-600">昇給・賞与通知書</a>
        <span className="text-gray-300">›</span>
        <span className="text-sm text-gray-700 font-medium">賞与通知</span>
      </div>
      <h2 className="text-xl font-bold mb-6 text-gray-800">賞与通知</h2>
      <BonusMain
        years={YEARS}
        activeYear={year}
        bonusSummerDate={summerDoc?.notice_date ?? ""}
        bonusSummerRep={summerDoc?.representative_name ?? defaultRep}
        bonusSummerComment={summerDoc?.comment ?? ""}
        bonusWinterDate={winterDoc?.notice_date ?? ""}
        bonusWinterRep={winterDoc?.representative_name ?? defaultRep}
        bonusWinterComment={winterDoc?.comment ?? ""}
        summerEmployees={summerEmps}
        winterEmployees={winterEmps}
      />
    </div>
  );
}

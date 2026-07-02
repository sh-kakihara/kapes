import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNoticeDocument, getNoticeEmployees } from "@/server/notice";
import { DEFAULT_REP } from "@/lib/notice-constants";
import SalaryMain from "./salary-main";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

export default async function SalaryNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/admin");

  const sp = await searchParams;
  const year = Number(sp.year ?? CURRENT_YEAR);

  const [doc, employees] = await Promise.all([
    getNoticeDocument(year),
    getNoticeEmployees(year),
  ]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <a href="/admin/notices" className="text-sm text-gray-400 hover:text-gray-600">昇給・賞与通知書</a>
        <span className="text-gray-300">›</span>
        <span className="text-sm text-gray-700 font-medium">昇給通知</span>
      </div>
      <h2 className="text-xl font-bold mb-6 text-gray-800">昇給通知</h2>
      <SalaryMain
        years={YEARS}
        activeYear={year}
        representative={doc?.representative_name ?? DEFAULT_REP}
        noticeDate={doc?.notice_date ?? ""}
        comment={doc?.comment ?? ""}
        employees={employees}
      />
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMySalaryNoticeYears, getMySalaryNotice } from "@/server/my-notice";
import { toWareki, getSalaryNoticeText, fmtAmount } from "@/lib/wareki";

const CURRENT_YEAR = new Date().getFullYear();

export default async function MySalaryNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const years = await getMySalaryNoticeYears();
  const allYears = years.length > 0 ? years : [CURRENT_YEAR];
  const activeYear = Number(sp.year ?? allYears[0]);

  const notice = await getMySalaryNotice(activeYear);
  const wareki = notice?.notice_date ? toWareki(notice.notice_date) : "";

  const noticeText = notice
    ? getSalaryNoticeText(
        notice.birth_date ? new Date(notice.birth_date) : null,
        notice.gender,
        notice.salary_increase,
        notice.notice_date || new Date().toISOString().slice(0, 10),
        wareki
      )
    : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link href="/my-notices" className="text-sm text-gray-400 hover:text-gray-600">通知書</Link>
        <span className="text-gray-300">›</span>
        <span className="text-sm text-gray-700 font-medium">昇給通知</span>
      </div>
      <h2 className="text-xl font-bold mb-5 text-gray-800">昇給通知</h2>

      {/* 年タブ */}
      <div className="flex border-b mb-6">
        {allYears.map((y) => (
          <a
            key={y}
            href={`/my-notices/salary?year=${y}`}
            className={`px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              y === activeYear
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {y}年度
          </a>
        ))}
      </div>

      {!notice ? (
        <div className="bg-white rounded-lg border p-10 text-center text-gray-400">
          {activeYear}年度の昇給通知はまだ作成されていません
        </div>
      ) : !notice.notice_date ? (
        <div className="bg-white rounded-lg border p-10 text-center text-gray-400">
          {activeYear}年度の昇給通知は準備中です
        </div>
      ) : (
        <div className="space-y-5">
          {/* 通知書プレビュー — 印刷レイアウトに近い横長2カラム */}
          <div
            className="bg-white rounded-lg border shadow-sm"
            style={{
              fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif',
              padding: "8mm 12mm",
              display: "flex",
              flexDirection: "row",
              gap: "8mm",
              minHeight: "120mm",
            }}
          >
            {/* 左カラム: 氏名・本文・昇給額 */}
            <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "column" }}>
              <p style={{ fontSize: "24pt", fontWeight: "bold", marginBottom: "5mm", letterSpacing: "0.25em", lineHeight: 1.2 }}>
                {notice.name}　殿
              </p>
              <div style={{ fontSize: "12pt", lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: "3mm" }}>
                {noticeText}
              </div>
              {(notice.salary_increase ?? 0) > 0 && notice.employment_type && (
                <div style={{ fontSize: "12pt", marginLeft: "10mm", marginTop: "1mm" }}>
                  {notice.employment_type}　　{fmtAmount(notice.salary_increase!)}
                </div>
              )}
            </div>

            {/* 右カラム: コメント・日付・代表者 */}
            <div style={{ flex: "1", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <p style={{ fontSize: "11pt", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {notice.comment}
              </p>
              <div style={{ textAlign: "right", fontSize: "11pt", lineHeight: 2, marginTop: "4mm" }}>
                <div>{notice.notice_date ? toWareki(notice.notice_date) : ""}</div>
                <div>{notice.representative}</div>
              </div>
            </div>
          </div>

          <a
            href={`/my-notices/print-salary?fiscal_year=${activeYear}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
          >
            印刷プレビュー →
          </a>
        </div>
      )}
    </div>
  );
}

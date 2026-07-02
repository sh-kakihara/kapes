import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMyBonusNoticeYears, getMyBonusNotice } from "@/server/my-notice";
import { toWareki, fmtAmount } from "@/lib/wareki";

const CURRENT_YEAR = new Date().getFullYear();

export default async function MyBonusNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; season?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const years = await getMyBonusNoticeYears();
  const allYears = years.length > 0 ? years : [CURRENT_YEAR];
  const activeYear = Number(sp.year ?? allYears[0]);
  const activeSeason = (sp.season === "冬期" ? "冬期" : "夏期") as "夏期" | "冬期";

  const notice = await getMyBonusNotice(activeYear, activeSeason);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link href="/my-notices" className="text-sm text-gray-400 hover:text-gray-600">通知書</Link>
        <span className="text-gray-300">›</span>
        <span className="text-sm text-gray-700 font-medium">賞与通知</span>
      </div>
      <h2 className="text-xl font-bold mb-5 text-gray-800">賞与通知</h2>

      {/* 年タブ */}
      <div className="flex border-b mb-5">
        {allYears.map((y) => (
          <a
            key={y}
            href={`/my-notices/bonus?year=${y}&season=${activeSeason}`}
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

      {/* 夏期/冬期 切替 */}
      <div className="flex gap-2 mb-6">
        {(["夏期", "冬期"] as const).map((s) => (
          <a
            key={s}
            href={`/my-notices/bonus?year=${activeYear}&season=${s}`}
            className={`px-6 py-2 text-sm rounded border transition-colors ${
              activeSeason === s
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      {!notice ? (
        <div className="bg-white rounded-lg border p-10 text-center text-gray-400">
          {activeYear}年度{activeSeason}の賞与通知はまだ作成されていません
        </div>
      ) : (
        <div className="max-w-2xl space-y-5">
          {/* 通知書プレビュー */}
          <div className="bg-white rounded-lg border p-8 shadow-sm"
            style={{ fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif' }}>
            <p style={{ fontSize: "22pt", fontWeight: "bold", marginBottom: "6mm", letterSpacing: "0.2em" }}>
              {notice.name}　殿
            </p>

            {/* 支給明細テーブル */}
            <div className="mb-6">
              <table style={{ borderCollapse: "collapse", fontSize: "10pt", width: "100%", maxWidth: "340px" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "center", backgroundColor: "#f5f5f5", fontWeight: "normal" }}>支給額</th>
                    <th style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "center", backgroundColor: "#f5f5f5", fontWeight: "normal" }}>精勤手当</th>
                    <th style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "center", backgroundColor: "#f5f5f5", fontWeight: "normal" }}>インフレ手当</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "right" }}>
                      {notice.payment != null ? notice.payment.toLocaleString("ja-JP") : "0"}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "right" }}>
                      {notice.bonus_add.toLocaleString("ja-JP")}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "right" }}>
                      {notice.inflation_enabled ? notice.inflation_amount.toLocaleString("ja-JP") : "－"}
                    </td>
                  </tr>
                </tbody>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "center", backgroundColor: "#f5f5f5", fontWeight: "normal" }}>有給</th>
                    <th style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "center", backgroundColor: "#f5f5f5", fontWeight: "normal" }}>欠勤</th>
                    <th style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "center", backgroundColor: "#f5f5f5", fontWeight: "normal" }}>遅早時間</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "right" }}>
                      {notice.paid_leave_days != null ? `${notice.paid_leave_days}日` : "0日"}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "right" }}>
                      {notice.absent_days != null ? `${notice.absent_days}日` : "0日"}
                    </td>
                    <td style={{ border: "1px solid #999", padding: "2mm 4mm", textAlign: "right" }}>
                      {notice.late_early_hours != null ? `${notice.late_early_hours}時間` : "0時間"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: "11pt", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {notice.comment}
            </div>
            <div style={{ textAlign: "right", fontSize: "11pt", lineHeight: 2, marginTop: "6mm" }}>
              {notice.notice_date && <div>{toWareki(notice.notice_date)}</div>}
              <div>{notice.representative}</div>
            </div>
          </div>

          <a
            href={`/my-notices/print-bonus?fiscal_year=${activeYear}&season=${encodeURIComponent(activeSeason)}`}
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

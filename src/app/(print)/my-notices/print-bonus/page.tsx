import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMyBonusNotice } from "@/server/my-notice";
import BonusPrintView from "@/app/(app)/admin/notices/print/bonus-print-view";

export default async function MyNoticePrintBonusPage({
  searchParams,
}: {
  searchParams: Promise<{ fiscal_year?: string; season?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const fiscal_year = Number(sp.fiscal_year ?? new Date().getFullYear());
  const season = sp.season ?? "夏期";

  const notice = await getMyBonusNotice(fiscal_year, season);
  if (!notice) redirect("/my-notices/bonus");

  return (
    <BonusPrintView
      fiscal_year={fiscal_year}
      season={season}
      notice_date={notice.notice_date}
      representative={notice.representative}
      comment={notice.comment}
      items={[notice]}
      backHref={`/my-notices/bonus?year=${fiscal_year}&season=${encodeURIComponent(season)}`}
    />
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBonusNoticeDocument, getBonusNoticeEmployees } from "@/server/notice";
import { DEFAULT_REP } from "@/lib/notice-constants";
import BonusPrintView from "@/app/(app)/admin/notices/print/bonus-print-view";

export default async function BonusNoticePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ fiscal_year?: string; season?: string; ids?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/admin");

  const sp = await searchParams;
  const fiscal_year = Number(sp.fiscal_year ?? new Date().getFullYear());
  const season = sp.season ?? "夏期";
  const idsParam = sp.ids;

  const [doc, allItems] = await Promise.all([
    getBonusNoticeDocument(fiscal_year, season),
    getBonusNoticeEmployees(fiscal_year, season),
  ]);

  const selectedIds = idsParam ? new Set(idsParam.split(",")) : null;
  const items = selectedIds ? allItems.filter((e) => selectedIds.has(e.id)) : allItems;

  return (
    <BonusPrintView
      fiscal_year={fiscal_year}
      season={season}
      notice_date={doc?.notice_date ?? ""}
      representative={doc?.representative_name ?? DEFAULT_REP}
      comment={doc?.comment ?? ""}
      items={items}
    />
  );
}

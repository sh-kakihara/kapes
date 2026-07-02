import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNoticeDocument, getNoticeEmployees } from "@/server/notice";
import { DEFAULT_REP } from "@/lib/notice-constants";
import PrintView from "@/app/(app)/admin/notices/print/print-view";

export default async function NoticePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ fiscal_year?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/admin");

  const sp = await searchParams;
  const fiscal_year = Number(sp.fiscal_year ?? new Date().getFullYear());

  const [doc, employees] = await Promise.all([
    getNoticeDocument(fiscal_year),
    getNoticeEmployees(fiscal_year),
  ]);

  return (
    <PrintView
      fiscal_year={fiscal_year}
      notice_date={doc?.notice_date ?? ""}
      comment={doc?.comment ?? ""}
      representative={doc?.representative_name ?? DEFAULT_REP}
      items={employees}
    />
  );
}

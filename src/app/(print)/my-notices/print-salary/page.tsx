import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMySalaryNotice } from "@/server/my-notice";
import PrintView from "@/app/(app)/admin/notices/print/print-view";

export default async function MyNoticePrintSalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ fiscal_year?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const fiscal_year = Number(sp.fiscal_year ?? new Date().getFullYear());

  const notice = await getMySalaryNotice(fiscal_year);
  if (!notice) redirect("/my-notices/salary");

  const item = {
    id: notice.id,
    name: notice.name,
    employee_type: notice.employee_type,
    birth_date: notice.birth_date,
    gender: notice.gender,
    employment_type: notice.employment_type,
    salary_increase: notice.salary_increase,
  };

  return (
    <PrintView
      fiscal_year={fiscal_year}
      notice_date={notice.notice_date}
      comment={notice.comment}
      representative={notice.representative}
      items={[item]}
      backHref={`/my-notices/salary?year=${fiscal_year}`}
    />
  );
}

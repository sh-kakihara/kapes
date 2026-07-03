import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getEmployeeRecords, getAvailableFiscalYears } from "@/server/employee-record";

import { prisma } from "@/lib/db";
import { calcBonus, calcPayment } from "@/lib/attendance-calc";
import EmployeeLedgerTable from "./employee-ledger-table";

function getFiscalYear(date: Date = new Date()): number {
  return date.getMonth() >= 4 ? date.getFullYear() : date.getFullYear() - 1;
}

export default async function EmployeeLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) redirect("/");

  const { year } = await searchParams;
  const currentFY = getFiscalYear();
  const selectedYear = year ? parseInt(year) : currentFY;

  const [availableYears, rows] = await Promise.all([
    getAvailableFiscalYears(),
    getEmployeeRecords(selectedYear),
  ]);

  // 現在年度がまだ取り込まれていなくてもタブに表示する
  const allYears = availableYears.includes(currentFY)
    ? availableYears
    : [currentFY, ...availableYears];

  // 部長評価オーバーレイ（アクティブ評価期間から自動反映）
  const activePeriod = await prisma.evaluationPeriod.findFirst({
    where: { is_active: true },
    orderBy: { start_date: "desc" },
  });

  // 評価期間の年度を名称から抽出（例: "2026年度冬期" → 2026）
  const periodFiscalYear = activePeriod
    ? parseInt(activePeriod.name.match(/^(\d{4})年度/)?.[1] ?? "0")
    : 0;

  if (activePeriod && periodFiscalYear === selectedYear) {
    const isSummer = activePeriod.name.includes("夏");
    const isWinter = activePeriod.name.includes("冬");
    const targetField = isSummer
      ? "curr_summer_director_eval"
      : isWinter
      ? "curr_winter_director_eval"
      : null;

    if (targetField) {
      const execDeptUsers = await prisma.user.findMany({
        where: { role: "EXECUTIVE", is_active: true, deleted_at: null, department_id: { not: null } },
        select: { department_id: true },
      });
      const execDeptIds = new Set(execDeptUsers.map((u) => u.department_id as string));

      const evaluations = await prisma.evaluation.findMany({
        where: { period_id: activePeriod.id },
        include: { scores: true, employee: { select: { id: true, role: true, department_id: true } } },
      });

      const scoreMap = new Map<string, number>();
      for (const ev of evaluations) {
        const role = ev.employee.role;
        const deptId = ev.employee.department_id;
        const hasExec = deptId ? execDeptIds.has(deptId) : false;

        let evaluatorKey: string;
        if (role === "EXECUTIVE") {
          evaluatorKey = "self";
        } else if (role === "DIRECTOR" && hasExec) {
          evaluatorKey = "executive";
        } else {
          evaluatorKey = "director";
        }

        const total = ev.scores
          .filter((s) => s.evaluator === evaluatorKey && s.score != null)
          .reduce((sum, s) => sum + (s.score ?? 0), 0);

        if (total > 0) scoreMap.set(ev.employee_id, total);
      }

      for (const row of rows) {
        const total = scoreMap.get(row.user.id);
        if (total != null) {
          row.record = {
            ...(row.record ?? {}),
            [targetField]: String(total),
          } as typeof row.record;
        }
      }
    }
  }

  // 精勤手当オーバーレイ（夏期・冬期の AttendanceRecord から取得）
  const attendancePeriods = await prisma.attendancePeriod.findMany({
    where: {
      name: { in: [`${selectedYear}年度夏期`, `${selectedYear}年度冬期`] },
    },
    include: { records: true },
  });

  const summerPeriod = attendancePeriods.find((p) => p.name === `${selectedYear}年度夏期`);
  const winterPeriod = attendancePeriods.find((p) => p.name === `${selectedYear}年度冬期`);

  // EmployeeRecord を employee_number でひける map を作成（基本額計算用）
  const empRecordMap = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (row.user.employee_number && row.record) {
      empRecordMap.set(row.user.employee_number, row.record as Record<string, unknown>);
    }
  }

  type AttendanceInfo = { bonus_add: number; payment: number | null };
  const summerMap = new Map<string, AttendanceInfo>();
  const winterMap = new Map<string, AttendanceInfo>();

  for (const r of summerPeriod?.records ?? []) {
    const paid   = r.paid_leave_days  != null ? Number(r.paid_leave_days)  : null;
    const absent = r.absent_days      != null ? Number(r.absent_days)      : null;
    const late   = r.late_early_hours != null ? Number(r.late_early_hours) : null;
    const bonusAdd = calcBonus(r.bonus_eligible, paid, absent, late);
    const er = empRecordMap.get(r.employee_number);
    const empBonus = er?.curr_summer_bonus != null ? Number(er.curr_summer_bonus) : 0;
    const empPos   = er?.curr_position_allowance != null ? Number(er.curr_position_allowance) : null;
    const baseAmt  = empBonus + bonusAdd;
    summerMap.set(r.employee_number, {
      bonus_add: bonusAdd,
      payment:   calcPayment(r.bonus_eligible, baseAmt > 0 ? baseAmt : null, empPos, absent, late),
    });
  }
  for (const r of winterPeriod?.records ?? []) {
    const paid   = r.paid_leave_days  != null ? Number(r.paid_leave_days)  : null;
    const absent = r.absent_days      != null ? Number(r.absent_days)      : null;
    const late   = r.late_early_hours != null ? Number(r.late_early_hours) : null;
    const bonusAdd = calcBonus(r.bonus_eligible, paid, absent, late);
    const er = empRecordMap.get(r.employee_number);
    const empBonus = er?.curr_winter_bonus != null ? Number(er.curr_winter_bonus) : 0;
    const empPos   = er?.curr_position_allowance != null ? Number(er.curr_position_allowance) : null;
    const baseAmt  = empBonus + bonusAdd;
    winterMap.set(r.employee_number, {
      bonus_add: bonusAdd,
      payment:   calcPayment(r.bonus_eligible, baseAmt > 0 ? baseAmt : null, empPos, absent, late),
    });
  }

  for (const row of rows) {
    const empNo = row.user.employee_number;
    if (!empNo) continue;
    const s = summerMap.get(empNo);
    const w = winterMap.get(empNo);
    if (s || w) {
      row.record = {
        ...(row.record ?? {}),
        ...(s ? { curr_summer_bonus_add: s.bonus_add, curr_summer_payment: s.payment } : {}),
        ...(w ? { curr_winter_bonus_add: w.bonus_add, curr_winter_payment: w.payment } : {}),
      } as typeof row.record;
    }
  }

  return (
    <div>
      {session.user.role === "ADMIN" && (
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          ← 管理者メニュー
        </Link>
      )}
      <h2 className="text-xl font-bold mb-1 text-gray-800">社員台帳</h2>
      <p className="text-sm text-gray-500 mb-6">社長・管理者のみ閲覧・編集できます</p>
      <EmployeeLedgerTable
        initialRows={rows}
        availableYears={allYears}
        selectedYear={selectedYear}
        isAdmin={["ADMIN", "PRESIDENT"].includes(session.user.role)}
      />
    </div>
  );
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { forbidden } from "next/navigation";
import { calcBonus, calcPayment } from "@/lib/attendance-calc";
import { calcInflationAmount } from "@/lib/inflation-calc";
import type { BonusNoticeEmployee } from "@/server/notice";

async function requireSelf() {
  const session = await auth();
  if (!session?.user?.id) forbidden();
  return session.user;
}

// ---- 昇給通知 ----

export type MySalaryNotice = {
  fiscal_year: number;
  notice_date: string;
  representative: string;
  comment: string;
  id: string;
  name: string;
  employee_type: string;
  birth_date: string | null;
  gender: string | null;
  employment_type: string | null;
  salary_increase: number | null;
};

export async function getMySalaryNoticeYears(): Promise<number[]> {
  const me = await requireSelf();
  const records = await prisma.employeeRecord.findMany({
    where: { user_id: me.id },
    select: { fiscal_year: true },
    orderBy: { fiscal_year: "desc" },
  });
  return [...new Set(records.map((r) => r.fiscal_year))];
}

export async function getMySalaryNotice(fiscal_year: number): Promise<MySalaryNotice | null> {
  const me = await requireSelf();

  const [doc, rec, user] = await Promise.all([
    prisma.noticeDocument.findUnique({
      where: { type_fiscal_year_season: { type: "昇給通知", fiscal_year, season: "年次" } },
    }),
    prisma.employeeRecord.findFirst({
      where: { user_id: me.id, fiscal_year },
    }),
    prisma.user.findUnique({
      where: { id: me.id },
      select: { name: true, employee_type: true },
    }),
  ]);

  if (!rec) return null;

  return {
    fiscal_year,
    notice_date: doc?.notice_date ?? "",
    representative: doc?.representative_name ?? "",
    comment: doc?.comment ?? "",
    id: me.id,
    name: user?.name ?? "",
    employee_type: user?.employee_type ?? "",
    birth_date: rec.birth_date?.toISOString() ?? null,
    gender: rec.gender ?? null,
    employment_type: rec.employment_type ?? null,
    salary_increase: rec.curr_salary_increase != null ? Number(rec.curr_salary_increase) : null,
  };
}

// ---- 賞与通知 ----

export type MyBonusNotice = BonusNoticeEmployee & {
  notice_date: string;
  representative: string;
  comment: string;
};

export async function getMyBonusNoticeYears(): Promise<number[]> {
  const me = await requireSelf();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { employee_number: true },
  });
  if (!user?.employee_number) return [];

  const periods = await prisma.attendancePeriod.findMany({
    where: { records: { some: { employee_number: user.employee_number } } },
    select: { name: true },
  });

  const years = new Set<number>();
  for (const p of periods) {
    const m = p.name.match(/^(\d{4})年度/);
    if (m) years.add(Number(m[1]));
  }
  return [...years].sort((a, b) => b - a);
}

export async function getMyBonusNotice(
  fiscal_year: number,
  season: string
): Promise<MyBonusNotice | null> {
  const me = await requireSelf();

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { employee_number: true, name: true, employee_type: true, hire_date: true },
  });
  if (!user?.employee_number) return null;

  const periodName = `${fiscal_year}年度${season}`;
  const [period, doc, er, inflationSetting] = await Promise.all([
    prisma.attendancePeriod.findFirst({
      where: { name: periodName },
      include: { records: { where: { employee_number: user.employee_number } } },
    }),
    prisma.noticeDocument.findUnique({
      where: { type_fiscal_year_season: { type: "賞与通知", fiscal_year, season } },
    }),
    prisma.employeeRecord.findFirst({
      where: { fiscal_year, user_id: me.id },
      select: {
        birth_date: true, gender: true, employment_type: true, training_period: true,
        curr_summer_bonus: true, curr_winter_bonus: true, curr_position_allowance: true,
      },
    }),
    prisma.inflationSetting.findUnique({
      where: { fiscal_year_season: { fiscal_year, season } },
      include: { overrides: { where: { user_id: me.id } } },
    }),
  ]);

  const r = period?.records[0];
  if (!r || !doc) return null;

  const isSummer = season === "夏期";
  const paid = r.paid_leave_days != null ? Number(r.paid_leave_days) : null;
  const absent = r.absent_days != null ? Number(r.absent_days) : null;
  const late = r.late_early_hours != null ? Number(r.late_early_hours) : null;

  const bonusAdd = calcBonus(r.bonus_eligible, paid, absent, late);
  const rawBonus = isSummer ? er?.curr_summer_bonus : er?.curr_winter_bonus;
  const bonusAmount = rawBonus != null ? Number(rawBonus) : null;
  const positionAllowance = er?.curr_position_allowance != null ? Number(er.curr_position_allowance) : null;
  const baseAmount = (bonusAmount ?? 0) + bonusAdd;
  const payment = calcPayment(
    r.bonus_eligible,
    baseAmount > 0 ? baseAmount : null,
    positionAllowance,
    absent,
    late
  );

  const inflationEnabled = inflationSetting?.enabled ?? false;
  const inflationNoticeDate = inflationSetting?.notice_date ? new Date(inflationSetting.notice_date) : new Date();
  const autoInflation = inflationEnabled
    ? calcInflationAmount(
        user.hire_date ?? null,
        er?.birth_date ?? null,
        er?.employment_type ?? null,
        er?.training_period ?? null,
        inflationNoticeDate
      )
    : 0;
  const override = inflationSetting?.overrides[0];
  const inflationAmount = inflationEnabled ? (override?.amount ?? autoInflation) : 0;

  return {
    id: me.id,
    employee_number: user.employee_number,
    name: user.name,
    employee_type: user.employee_type ?? "",
    birth_date: er?.birth_date?.toISOString() ?? null,
    gender: er?.gender ?? null,
    employment_type: er?.employment_type ?? null,
    bonus_amount: bonusAmount,
    bonus_add: bonusAdd,
    position_allowance: positionAllowance,
    payment,
    paid_leave_days: paid,
    absent_days: absent,
    late_early_hours: late,
    inflation_amount: inflationAmount,
    inflation_enabled: inflationEnabled,
    notice_date: doc.notice_date ?? "",
    representative: doc.representative_name ?? "",
    comment: doc.comment ?? "",
  };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { forbidden } from "next/navigation";
import { revalidatePath } from "next/cache";
import { calcBonus, calcPayment } from "@/lib/attendance-calc";
import { calcInflationAmount } from "@/lib/inflation-calc";

const FIXED_SEASON = "年次";
import { DEFAULT_REP } from "@/lib/notice-constants";

async function requirePresidentOrAdmin() {
  const session = await auth();
  if (!session?.user?.id) forbidden();
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) forbidden();
  return session.user;
}

export async function getNoticeDocument(fiscal_year: number) {
  await requirePresidentOrAdmin();
  return prisma.noticeDocument.findUnique({
    where: { type_fiscal_year_season: { type: "昇給通知", fiscal_year, season: FIXED_SEASON } },
  });
}

export async function upsertNoticeDocument(data: {
  fiscal_year: number;
  notice_date: string;
  comment: string;
  representative_name: string;
}) {
  const me = await requirePresidentOrAdmin();
  await prisma.noticeDocument.upsert({
    where: { type_fiscal_year_season: { type: "昇給通知", fiscal_year: data.fiscal_year, season: FIXED_SEASON } },
    create: { type: "昇給通知", season: FIXED_SEASON, ...data, created_by: me.id, updated_by: me.id },
    update: {
      notice_date: data.notice_date,
      comment: data.comment,
      representative_name: data.representative_name,
      updated_by: me.id,
    },
  });
  revalidatePath("/admin/notices");
  return { ok: true };
}

export async function getNoticeEmployees(fiscal_year: number) {
  await requirePresidentOrAdmin();

  const yearStart = new Date(fiscal_year, 0, 1);
  const yearEnd   = new Date(fiscal_year, 11, 31);

  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      employee_type: { in: ["柿原工業", "柿原技研"] },
      AND: [
        { OR: [{ hire_date: null }, { hire_date: { lte: yearEnd } }] },
        { OR: [{ resign_date: null }, { resign_date: { gte: yearStart } }] },
      ],
    },
    include: {
      employee_records: {
        where: { fiscal_year },
        take: 1,
      },
    },
    orderBy: [{ employee_number: "asc" }],
  });

  return users.map((u) => {
    const rec = u.employee_records[0] ?? null;
    return {
      id: u.id,
      name: u.name,
      employee_type: u.employee_type ?? "",
      birth_date: rec?.birth_date?.toISOString() ?? null,
      gender: rec?.gender ?? null,
      employment_type: rec?.employment_type ?? null,
      salary_increase: rec?.curr_salary_increase != null ? Number(rec.curr_salary_increase) : null,
    };
  });
}

// ---- 賞与通知 ----

export type BonusNoticeEmployee = {
  id: string;
  employee_number: string;
  name: string;
  employee_type: string;
  birth_date: string | null;
  gender: string | null;
  employment_type: string | null;
  bonus_amount: number | null;
  bonus_add: number;
  position_allowance: number | null;
  payment: number | null;
  paid_leave_days: number | null;
  absent_days: number | null;
  late_early_hours: number | null;
  inflation_amount: number;
  inflation_enabled: boolean;
};

export async function getBonusNoticeDocument(fiscal_year: number, season: string) {
  await requirePresidentOrAdmin();
  return prisma.noticeDocument.findUnique({
    where: { type_fiscal_year_season: { type: "賞与通知", fiscal_year, season } },
  });
}

export async function upsertBonusNoticeDocument(data: {
  fiscal_year: number;
  season: string;
  notice_date: string;
  representative_name: string;
  comment: string;
}) {
  const me = await requirePresidentOrAdmin();
  await prisma.noticeDocument.upsert({
    where: { type_fiscal_year_season: { type: "賞与通知", fiscal_year: data.fiscal_year, season: data.season } },
    create: {
      type: "賞与通知",
      season: data.season,
      fiscal_year: data.fiscal_year,
      notice_date: data.notice_date,
      comment: data.comment,
      representative_name: data.representative_name,
      created_by: me.id,
      updated_by: me.id,
    },
    update: {
      notice_date: data.notice_date,
      representative_name: data.representative_name,
      comment: data.comment,
      updated_by: me.id,
    },
  });
  revalidatePath("/admin/notices");
  return { ok: true };
}

export async function getBonusNoticeEmployees(
  fiscal_year: number,
  season: string
): Promise<BonusNoticeEmployee[]> {
  await requirePresidentOrAdmin();

  const periodName = `${fiscal_year}年度${season}`;
  const period = await prisma.attendancePeriod.findFirst({
    where: { name: periodName },
    include: { records: true },
  });
  if (!period) return [];

  const isSummer = season === "夏期";
  const empNos = period.records.map((r) => r.employee_number);

  const empRecordSelect = {
    birth_date: true,
    gender: true,
    employment_type: true,
    training_period: true,
    curr_summer_bonus: true,
    curr_winter_bonus: true,
    curr_position_allowance: true,
    user: {
      select: {
        id: true,
        employee_number: true,
        employee_type: true,
        name: true,
        hire_date: true,
      },
    },
  } as const;

  const [empRecords, allEmpRecords, inflationSetting] = await Promise.all([
    prisma.employeeRecord.findMany({
      where: { fiscal_year, user: { employee_number: { in: empNos } } },
      select: empRecordSelect,
    }),
    prisma.employeeRecord.findMany({
      where: { fiscal_year, user: { deleted_at: null, is_active: true } },
      select: empRecordSelect,
    }),
    prisma.inflationSetting.findUnique({
      where: { fiscal_year_season: { fiscal_year, season } },
      include: { overrides: true },
    }),
  ]);

  const erMap = new Map(
    empRecords.map((er) => [er.user.employee_number ?? "", er])
  );

  const inflationEnabled = inflationSetting?.enabled ?? false;
  const inflationNoticeDate = inflationSetting?.notice_date
    ? new Date(inflationSetting.notice_date)
    : new Date();
  const inflationOverrideMap = new Map<string, number>(
    (inflationSetting?.overrides ?? []).map((o) => [o.user_id, o.amount])
  );

  const INELIGIBLE_EMPLOYMENT_TYPES = new Set(["時給", "月給/賞与支給なし"]);
  function isWithinFirstYear(hireDate: Date | null | undefined): boolean {
    if (!hireDate) return false;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return hireDate > oneYearAgo;
  }

  const results: BonusNoticeEmployee[] = [];
  for (const r of period.records) {
    const er = erMap.get(r.employee_number);
    const paid = r.paid_leave_days != null ? Number(r.paid_leave_days) : null;
    const absent = r.absent_days != null ? Number(r.absent_days) : null;
    const late = r.late_early_hours != null ? Number(r.late_early_hours) : null;

    const employmentType = er?.employment_type ?? null;
    const hireDate = er?.user.hire_date ?? null;
    const eligible = (
      INELIGIBLE_EMPLOYMENT_TYPES.has(employmentType ?? "") ||
      isWithinFirstYear(hireDate)
    ) ? false : r.bonus_eligible;

    const bonusAdd = r.bonus_override != null
      ? Number(r.bonus_override)
      : calcBonus(eligible, paid, absent, late);
    const rawBonusAmt = isSummer ? er?.curr_summer_bonus : er?.curr_winter_bonus;
    const bonusAmount = rawBonusAmt != null ? Number(rawBonusAmt) : null;
    const positionAllowance = er?.curr_position_allowance != null ? Number(er.curr_position_allowance) : null;

    const baseAmount = bonusAmount ?? 0;
    const payment = calcPayment(
      eligible && r.bonus_override == null,
      baseAmount > 0 ? baseAmount : null,
      positionAllowance,
      absent,
      late
    );

    const userId = er?.user.id ?? "";
    const autoInflation = inflationEnabled
      ? calcInflationAmount(
          er?.user.hire_date ?? null,
          er?.birth_date ?? null,
          er?.employment_type ?? null,
          er?.training_period ?? null,
          inflationNoticeDate
        )
      : 0;
    const inflationAmount = inflationEnabled
      ? (inflationOverrideMap.get(userId) ?? autoInflation)
      : 0;

    results.push({
      id: userId || r.employee_number,
      employee_number: r.employee_number,
      name: er?.user.name ?? r.name,
      employee_type: er?.user.employee_type ?? "",
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
    });
  }

  // 精勤手当データのない社員台帳の社員を追加（精勤手当0円・出勤情報なし）
  const attendanceEmpNosSet = new Set(empNos);
  for (const er of allEmpRecords) {
    const empNo = er.user.employee_number ?? "";
    if (!empNo || attendanceEmpNosSet.has(empNo)) continue;

    const rawBonusAmt = isSummer ? er.curr_summer_bonus : er.curr_winter_bonus;
    const bonusAmount = rawBonusAmt != null ? Number(rawBonusAmt) : null;
    const positionAllowance = er.curr_position_allowance != null ? Number(er.curr_position_allowance) : null;
    const payment = calcPayment(false, bonusAmount != null && bonusAmount > 0 ? bonusAmount : null, positionAllowance, null, null);
    const userId = er.user.id;
    const autoInflation = inflationEnabled
      ? calcInflationAmount(er.user.hire_date ?? null, er.birth_date ?? null, er.employment_type ?? null, er.training_period ?? null, inflationNoticeDate)
      : 0;
    const inflationAmount = inflationEnabled ? (inflationOverrideMap.get(userId) ?? autoInflation) : 0;

    results.push({
      id: userId,
      employee_number: empNo,
      name: er.user.name,
      employee_type: er.user.employee_type ?? "",
      birth_date: er.birth_date?.toISOString() ?? null,
      gender: er.gender ?? null,
      employment_type: er.employment_type ?? null,
      bonus_amount: bonusAmount,
      bonus_add: 0,
      position_allowance: positionAllowance,
      payment,
      paid_leave_days: null,
      absent_days: null,
      late_early_hours: null,
      inflation_amount: inflationAmount,
      inflation_enabled: inflationEnabled,
    });
  }

  results.sort((a, b) => a.employee_number.localeCompare(b.employee_number, "ja", { numeric: true }));
  return results;
}

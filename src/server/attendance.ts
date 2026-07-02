"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { forbidden } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { calcBonus, calcPayment } from "@/lib/attendance-calc";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) forbidden();
  if (!["ADMIN", "PRESIDENT"].includes(session.user.role)) forbidden();
  return session.user;
}

export type AttendancePeriodRow = {
  id: string;
  name: string;
};

export type AttendanceRecordRow = {
  id: string;
  period_id: string;
  employee_number: string;
  name: string;
  department: string | null;
  section: string | null;
  work_days: number | null;
  paid_leave_days: number | null;
  absent_days: number | null;
  late_early_hours: number | null;
  overtime_hours: number | null;
  night_overtime_hours: number | null;
  holiday_hours: number | null;
  legal_holiday_hours: number | null;
  bonus_eligible: boolean;
  bonus_amount: number | null;
  /** 夏/冬期賞与額（EmployeeRecordから） */
  employee_bonus: number | null;
  /** 役職手当（EmployeeRecordから） */
  employee_position_allowance: number | null;
  /** 基本額 = employee_bonus + bonus_amount + employee_position_allowance */
  base_amount: number | null;
  payment_amount: number | null;
  notes: string | null;
};


function mapRow(r: {
  id: string; period_id: string; employee_number: string; name: string;
  work_days: Prisma.Decimal | null; paid_leave_days: Prisma.Decimal | null;
  absent_days: Prisma.Decimal | null; late_early_hours: Prisma.Decimal | null;
  overtime_hours: Prisma.Decimal | null; night_overtime_hours: Prisma.Decimal | null;
  holiday_hours: Prisma.Decimal | null; legal_holiday_hours: Prisma.Decimal | null;
  bonus_eligible: boolean; bonus_amount: Prisma.Decimal | null;
  payment_amount: Prisma.Decimal | null; notes: string | null;
}, empInfo?: { employee_bonus: number | null; employee_position_allowance: number | null; department?: string | null; section?: string | null }): AttendanceRecordRow {
  const bonusAmt = r.bonus_amount != null ? Number(r.bonus_amount) : null;
  const empBonus = empInfo?.employee_bonus ?? null;
  const empPos = empInfo?.employee_position_allowance ?? null;
  // 基本額 = 賞与額 + 精勤手当（役職手当は別列）
  const baseRaw = (empBonus ?? 0) + (bonusAmt ?? 0);
  const baseAmount = baseRaw > 0 ? baseRaw : null;
  return {
    id: r.id,
    period_id: r.period_id,
    employee_number: r.employee_number,
    name: r.name,
    department: empInfo?.department ?? null,
    section: empInfo?.section ?? null,
    work_days: r.work_days != null ? Number(r.work_days) : null,
    paid_leave_days: r.paid_leave_days != null ? Number(r.paid_leave_days) : null,
    absent_days: r.absent_days != null ? Number(r.absent_days) : null,
    late_early_hours: r.late_early_hours != null ? Number(r.late_early_hours) : null,
    overtime_hours: r.overtime_hours != null ? Number(r.overtime_hours) : null,
    night_overtime_hours: r.night_overtime_hours != null ? Number(r.night_overtime_hours) : null,
    holiday_hours: r.holiday_hours != null ? Number(r.holiday_hours) : null,
    legal_holiday_hours: r.legal_holiday_hours != null ? Number(r.legal_holiday_hours) : null,
    bonus_eligible: r.bonus_eligible,
    bonus_amount: bonusAmt,
    employee_bonus: empBonus,
    employee_position_allowance: empPos,
    base_amount: baseAmount,
    payment_amount: r.payment_amount != null ? Number(r.payment_amount) : null,
    notes: r.notes ?? null,
  };
}

/** 期間名 "2026年度夏期" から { fy, isSummer } を解析 */
function parsePeriodName(name: string): { fy: number; isSummer: boolean } | null {
  const m = name.match(/^(\d+)年度(夏期|冬期)$/);
  if (!m) return null;
  return { fy: parseInt(m[1]), isSummer: m[2] === "夏期" };
}

/** EmployeeRecord から 賞与額・役職手当・部・課 を取得するマップを構築 */
async function buildEmpInfoMap(
  employeeNumbers: string[],
  fy: number,
  isSummer: boolean
): Promise<Map<string, { employee_bonus: number | null; employee_position_allowance: number | null; department: string | null; section: string | null }>> {
  const empRecords = await prisma.employeeRecord.findMany({
    where: { fiscal_year: fy, user: { employee_number: { in: employeeNumbers } } },
    select: {
      curr_summer_bonus: true,
      curr_winter_bonus: true,
      curr_position_allowance: true,
      user: {
        select: {
          employee_number: true,
          department: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
  });
  const map = new Map<string, { employee_bonus: number | null; employee_position_allowance: number | null; department: string | null; section: string | null }>();
  for (const er of empRecords) {
    if (!er.user.employee_number) continue;
    const empBonus = isSummer ? er.curr_summer_bonus : er.curr_winter_bonus;
    map.set(er.user.employee_number, {
      employee_bonus: empBonus != null ? Number(empBonus) : null,
      employee_position_allowance: er.curr_position_allowance != null ? Number(er.curr_position_allowance) : null,
      department: er.user.department?.name ?? null,
      section: er.user.section?.name ?? null,
    });
  }
  return map;
}

export async function getAttendancePeriods(): Promise<AttendancePeriodRow[]> {
  await requireAdmin();
  return prisma.attendancePeriod.findMany({
    orderBy: { name: "desc" },
    select: { id: true, name: true },
  });
}

export async function createAttendancePeriod(name: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "期間名を入力してください" };
  try {
    await prisma.attendancePeriod.create({
      data: { name: trimmed, sort_key: trimmed, created_by: me.id, updated_by: me.id },
    });
    revalidatePath("/admin/attendance");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "同じ名前の期間がすでに存在します" };
    }
    throw e;
  }
}

export async function getAttendanceRecords(periodId: string): Promise<AttendanceRecordRow[]> {
  await requireAdmin();
  const period = await prisma.attendancePeriod.findUnique({ where: { id: periodId }, select: { name: true } });
  const rows = await prisma.attendanceRecord.findMany({
    where: { period_id: periodId },
    orderBy: { employee_number: "asc" },
  });
  const parsed = period ? parsePeriodName(period.name) : null;
  let empInfoMap = new Map<string, { employee_bonus: number | null; employee_position_allowance: number | null }>();
  if (parsed) {
    const empNos = rows.map((r) => r.employee_number);
    empInfoMap = await buildEmpInfoMap(empNos, parsed.fy, parsed.isSummer);
  }
  return rows.map((r) => mapRow(r, empInfoMap.get(r.employee_number)));
}

export async function deleteAttendanceRecord(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  await prisma.attendanceRecord.delete({ where: { id } });
  revalidatePath("/admin/attendance");
  return { ok: true };
}

export async function deleteAllAttendanceRecords(periodId: string): Promise<{ deleted: number }> {
  await requireAdmin();
  const result = await prisma.attendanceRecord.deleteMany({ where: { period_id: periodId } });
  revalidatePath("/admin/attendance");
  return { deleted: result.count };
}

export async function updateAttendanceRecord(
  id: string,
  data: {
    work_days?: string;
    paid_leave_days?: string;
    absent_days?: string;
    late_early_hours?: string;
    overtime_hours?: string;
    night_overtime_hours?: string;
    holiday_hours?: string;
    legal_holiday_hours?: string;
    bonus_eligible?: boolean;
    notes?: string;
  }
): Promise<{ ok: boolean }> {
  const me = await requireAdmin();

  function dec(v: string | undefined): Prisma.Decimal | null | undefined {
    if (v === undefined) return undefined;
    const s = v.trim();
    if (s === "" || s === "-") return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : new Prisma.Decimal(n);
  }
  function num(v: string | undefined): number | null {
    if (v === undefined) return null;
    const s = v.trim();
    if (s === "" || s === "-") return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  const eligible = data.bonus_eligible ?? true;
  const bonus = calcBonus(
    eligible,
    num(data.paid_leave_days),
    num(data.absent_days),
    num(data.late_early_hours)
  );

  // 基本額・役職手当を EmployeeRecord から取得
  const existing = await prisma.attendanceRecord.findUnique({
    where: { id },
    select: { period_id: true, employee_number: true },
  });
  let baseAmount: number | null = null;
  let empPositionAllowance: number | null = null;
  if (existing) {
    const period = await prisma.attendancePeriod.findUnique({ where: { id: existing.period_id }, select: { name: true } });
    const parsed = period ? parsePeriodName(period.name) : null;
    if (parsed) {
      const empInfoMap = await buildEmpInfoMap([existing.employee_number], parsed.fy, parsed.isSummer);
      const info = empInfoMap.get(existing.employee_number);
      const raw = (info?.employee_bonus ?? 0) + bonus;
      baseAmount = raw > 0 ? raw : null;
      empPositionAllowance = info?.employee_position_allowance ?? null;
    }
  }

  const payment = calcPayment(eligible, baseAmount, empPositionAllowance, num(data.absent_days), num(data.late_early_hours));

  await prisma.attendanceRecord.update({
    where: { id },
    data: {
      work_days: dec(data.work_days),
      paid_leave_days: dec(data.paid_leave_days),
      absent_days: dec(data.absent_days),
      late_early_hours: dec(data.late_early_hours),
      overtime_hours: dec(data.overtime_hours),
      night_overtime_hours: dec(data.night_overtime_hours),
      holiday_hours: dec(data.holiday_hours),
      legal_holiday_hours: dec(data.legal_holiday_hours),
      bonus_eligible: eligible,
      bonus_amount: new Prisma.Decimal(bonus),
      payment_amount: payment != null ? new Prisma.Decimal(payment) : null,
      notes: data.notes !== undefined ? (data.notes.trim() || null) : undefined,
      updated_by: me.id,
    },
  });
  return { ok: true };
}

export type ImportAttendanceRow = {
  employee_number: string;
  name: string;
  work_days: string;
  paid_leave_days: string;
  absent_days: string;
  late_early_hours: string;
  overtime_hours: string;
  night_overtime_hours: string;
  holiday_hours: string;
  legal_holiday_hours: string;
};

function toDecimal(v: string): Prisma.Decimal | null {
  const s = v.trim();
  if (s === "" || s === "-") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : new Prisma.Decimal(n);
}
function toNum(v: string): number | null {
  const d = toDecimal(v);
  return d != null ? Number(d) : null;
}

/** 社員番号から雇用形態を取得（最新年度のEmployeeRecord） */
async function getEmploymentType(employeeNumber: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { employee_number: employeeNumber },
    select: {
      employee_records: {
        orderBy: { fiscal_year: "desc" },
        take: 1,
        select: { employment_type: true },
      },
    },
  });
  return user?.employee_records[0]?.employment_type ?? null;
}

/** 時給は精勤手当対象外 */
async function resolveEligible(employeeNumber: string): Promise<boolean> {
  const type = await getEmploymentType(employeeNumber);
  return type !== "時給";
}

export async function importAttendanceRecords(
  periodId: string,
  rows: ImportAttendanceRow[]
): Promise<{ imported: number; errors: string[] }> {
  const me = await requireAdmin();

  const period = await prisma.attendancePeriod.findUnique({ where: { id: periodId }, select: { name: true } });
  if (!period) return { imported: 0, errors: ["期間が見つかりません"] };

  const parsedPeriod = parsePeriodName(period.name);

  const errors: string[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.employee_number.trim()) {
      errors.push(`行${i + 2}: 社員番号が空です`);
      continue;
    }
    try {
      // 時給は自動で対象外、それ以外は対象
      const eligible = await resolveEligible(row.employee_number.trim());
      const bonus = calcBonus(
        eligible,
        toNum(row.paid_leave_days),
        toNum(row.absent_days),
        toNum(row.late_early_hours)
      );
      // 基本額 = 賞与額 + 精勤手当、役職手当は別途（EmployeeRecordから取得）
      let baseAmount: number | null = null;
      let importEmpPos: number | null = null;
      if (parsedPeriod) {
        const empMap = await buildEmpInfoMap([row.employee_number.trim()], parsedPeriod.fy, parsedPeriod.isSummer);
        const info = empMap.get(row.employee_number.trim());
        const raw = (info?.employee_bonus ?? 0) + bonus;
        baseAmount = raw > 0 ? raw : null;
        importEmpPos = info?.employee_position_allowance ?? null;
      }
      const payment = calcPayment(eligible, baseAmount, importEmpPos, toNum(row.absent_days), toNum(row.late_early_hours));

      await prisma.attendanceRecord.upsert({
        where: { period_id_employee_number: { period_id: periodId, employee_number: row.employee_number.trim() } },
        create: {
          period_id: periodId,
          employee_number: row.employee_number.trim(),
          name: row.name.trim(),
          work_days: toDecimal(row.work_days),
          paid_leave_days: toDecimal(row.paid_leave_days),
          absent_days: toDecimal(row.absent_days),
          late_early_hours: toDecimal(row.late_early_hours),
          overtime_hours: toDecimal(row.overtime_hours),
          night_overtime_hours: toDecimal(row.night_overtime_hours),
          holiday_hours: toDecimal(row.holiday_hours),
          legal_holiday_hours: toDecimal(row.legal_holiday_hours),
          bonus_eligible: eligible,
          bonus_amount: new Prisma.Decimal(bonus),
          created_by: me.id,
          updated_by: me.id,
        },
        update: {
          name: row.name.trim(),
          work_days: toDecimal(row.work_days),
          paid_leave_days: toDecimal(row.paid_leave_days),
          absent_days: toDecimal(row.absent_days),
          late_early_hours: toDecimal(row.late_early_hours),
          overtime_hours: toDecimal(row.overtime_hours),
          night_overtime_hours: toDecimal(row.night_overtime_hours),
          holiday_hours: toDecimal(row.holiday_hours),
          legal_holiday_hours: toDecimal(row.legal_holiday_hours),
          bonus_eligible: eligible,
          bonus_amount: new Prisma.Decimal(bonus),
          payment_amount: payment != null ? new Prisma.Decimal(payment) : null,
          updated_by: me.id,
        },
      });
      imported++;
    } catch {
      errors.push(`行${i + 2}: 取込エラー（社員番号: ${row.employee_number}）`);
    }
  }

  revalidatePath("/admin/attendance");
  return { imported, errors };
}

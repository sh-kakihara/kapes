"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { forbidden } from "next/navigation";
import { revalidatePath } from "next/cache";
import { calcInflationAmount, calcYearsEmployed } from "@/lib/inflation-calc";
import { calcAgeAt } from "@/lib/wareki";

async function requirePresidentOrAdmin() {
  const session = await auth();
  if (!session?.user?.id) forbidden();
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) forbidden();
  return session.user;
}

// ---- 設定 ----

export async function getInflationSetting(fiscal_year: number, season: string) {
  await requirePresidentOrAdmin();
  return prisma.inflationSetting.findUnique({
    where: { fiscal_year_season: { fiscal_year, season } },
  });
}

export async function upsertInflationSetting(data: {
  fiscal_year: number;
  season: string;
  enabled: boolean;
  notice_date: string;
}): Promise<{ ok: boolean; id: string }> {
  const me = await requirePresidentOrAdmin();
  const result = await prisma.inflationSetting.upsert({
    where: { fiscal_year_season: { fiscal_year: data.fiscal_year, season: data.season } },
    create: { ...data, created_by: me.id, updated_by: me.id },
    update: { enabled: data.enabled, notice_date: data.notice_date, updated_by: me.id },
  });
  revalidatePath("/admin/inflation");
  return { ok: true, id: result.id };
}

// ---- 個人上書き ----

export async function overrideInflationEmployee(
  setting_id: string,
  user_id: string,
  amount: number
): Promise<{ ok: boolean }> {
  await requirePresidentOrAdmin();
  await prisma.inflationEmployee.upsert({
    where: { setting_id_user_id: { setting_id, user_id } },
    create: { setting_id, user_id, amount },
    update: { amount },
  });
  revalidatePath("/admin/inflation");
  return { ok: true };
}

export async function resetInflationEmployee(
  setting_id: string,
  user_id: string
): Promise<{ ok: boolean }> {
  await requirePresidentOrAdmin();
  await prisma.inflationEmployee.deleteMany({ where: { setting_id, user_id } });
  revalidatePath("/admin/inflation");
  return { ok: true };
}

// ---- 一覧取得 ----

export type InflationEmployeeRow = {
  user_id: string;
  employee_number: string;
  name: string;
  department: string | null;
  section: string | null;
  hire_date: string | null;
  birth_date: string | null;
  employment_type: string | null;
  training_period: string | null;
  years_employed: number | null;
  age: number | null;
  auto_amount: number;
  override_amount: number | null;
  final_amount: number;
};

export async function getInflationEmployees(
  fiscal_year: number,
  season: string
): Promise<{ setting_id: string | null; rows: InflationEmployeeRow[] }> {
  await requirePresidentOrAdmin();

  const setting = await prisma.inflationSetting.findUnique({
    where: { fiscal_year_season: { fiscal_year, season } },
    include: { overrides: true },
  });

  const noticeDate = setting?.notice_date
    ? new Date(setting.notice_date)
    : new Date();

  const overrideMap = new Map<string, number>(
    (setting?.overrides ?? []).map((o) => [o.user_id, o.amount])
  );

  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      employee_type: { in: ["柿原工業", "柿原技研"] },
    },
    include: {
      department: { select: { name: true } },
      section: { select: { name: true } },
      employee_records: {
        where: { fiscal_year },
        take: 1,
        select: { birth_date: true, employment_type: true, training_period: true },
      },
    },
    orderBy: { employee_number: "asc" },
  });

  const rows: InflationEmployeeRow[] = users.map((u) => {
    const rec = u.employee_records[0] ?? null;
    const hireDate = u.hire_date ?? null;
    const birthDate = rec?.birth_date ?? null;
    const employmentType = rec?.employment_type ?? null;
    const trainingPeriod = rec?.training_period ?? null;

    const yearsEmployed = hireDate ? calcYearsEmployed(hireDate, noticeDate) : null;
    const age = birthDate ? calcAgeAt(birthDate, noticeDate) : null;
    const autoAmount = calcInflationAmount(hireDate, birthDate, employmentType, trainingPeriod, noticeDate);
    const overrideAmt = overrideMap.get(u.id) ?? null;

    return {
      user_id: u.id,
      employee_number: u.employee_number ?? "",
      name: u.name,
      department: u.department?.name ?? null,
      section: u.section?.name ?? null,
      hire_date: hireDate?.toISOString() ?? null,
      birth_date: birthDate?.toISOString() ?? null,
      employment_type: employmentType,
      training_period: trainingPeriod,
      years_employed: yearsEmployed,
      age,
      auto_amount: autoAmount,
      override_amount: overrideAmt,
      final_amount: overrideAmt ?? autoAmount,
    };
  });

  return { setting_id: setting?.id ?? null, rows };
}

// ---- 賞与通知画面用: 個人別インフレ手当を返す ----

export async function getInflationAmountMap(
  fiscal_year: number,
  season: string
): Promise<{ enabled: boolean; amounts: Map<string, number> }> {
  const setting = await prisma.inflationSetting.findUnique({
    where: { fiscal_year_season: { fiscal_year, season } },
    include: { overrides: true },
  });

  if (!setting?.enabled) return { enabled: false, amounts: new Map() };

  const noticeDate = setting.notice_date ? new Date(setting.notice_date) : new Date();
  const overrideMap = new Map<string, number>(setting.overrides.map((o) => [o.user_id, o.amount]));

  const users = await prisma.user.findMany({
    where: { deleted_at: null, is_active: true },
    select: {
      id: true,
      hire_date: true,
      employee_records: {
        where: { fiscal_year },
        take: 1,
        select: { birth_date: true, employment_type: true, training_period: true },
      },
    },
  });

  const amounts = new Map<string, number>();
  for (const u of users) {
    const rec = u.employee_records[0] ?? null;
    const auto = calcInflationAmount(
      u.hire_date ?? null,
      rec?.birth_date ?? null,
      rec?.employment_type ?? null,
      rec?.training_period ?? null,
      noticeDate
    );
    amounts.set(u.id, overrideMap.get(u.id) ?? auto);
  }

  return { enabled: true, amounts };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { forbidden } from "next/navigation";
import { z } from "zod";

async function requirePresidentOrAdmin() {
  const session = await auth();
  if (!session?.user?.id) forbidden();
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) forbidden();
  return session.user;
}

// 5月始まりの年度を返す
function getFiscalYear(date: Date = new Date()): number {
  return date.getMonth() >= 4 ? date.getFullYear() : date.getFullYear() - 1;
}

export type EmployeeRecordData = {
  job_title?: string | null;
  employment_type?: string | null;
  training_period?: string | null;
  tech_intern_1_date?: string | null;
  tech_intern_3_date?: string | null;
  specified_skilled_date?: string | null;
  hire_date?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  education?: string | null;
  prev_annual_income?: number | null;
  curr_base_salary?: number | null;
  curr_position_allowance?: number | null;
  curr_salary_increase?: number | null;
  curr_summer_bonus?: number | null;
  curr_summer_director_eval?: string | null;
  curr_summer_president_eval?: string | null;
  curr_winter_bonus?: number | null;
  curr_winter_director_eval?: string | null;
  curr_winter_president_eval?: string | null;
  curr_notes?: string | null;
};

/** 利用可能な年度一覧（降順） */
export async function getAvailableFiscalYears(): Promise<number[]> {
  await requirePresidentOrAdmin();
  const rows = await prisma.employeeRecord.findMany({
    select: { fiscal_year: true },
    distinct: ["fiscal_year"],
    orderBy: { fiscal_year: "desc" },
  });
  return rows.map((r) => r.fiscal_year);
}

/**
 * 新年度タブ作成。
 * - ADMIN のみ実行可
 * - 対象年に在籍している全社員（hire_date / resign_date で判定）の EmployeeRecord を作成
 * - 基本情報は直近年度のレコードからコピー（給与・評価は空）
 * - すでにレコードが存在する社員はスキップ
 */
export async function createFiscalYearRecords(newYear: number): Promise<{ created: number; skipped: number }> {
  const me = await auth();
  if (!me?.user?.id || !["ADMIN", "PRESIDENT"].includes(me.user.role)) forbidden();

  const yearStart = new Date(newYear, 0, 1);
  const yearEnd   = new Date(newYear, 11, 31);

  // 対象年に在籍している社員（hire_date/resign_date で判定）
  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      role: { notIn: ["PRESIDENT", "ADMIN"] },
      AND: [
        { OR: [{ hire_date: null }, { hire_date: { lte: yearEnd } }] },
        { OR: [{ resign_date: null }, { resign_date: { gte: yearStart } }] },
      ],
    },
    select: { id: true },
  });

  const userIds = users.map((u) => u.id);

  // すでに新年度レコードがある社員を除外
  const existing = await prisma.employeeRecord.findMany({
    where: { fiscal_year: newYear, user_id: { in: userIds } },
    select: { user_id: true },
  });
  const existingIds = new Set(existing.map((r) => r.user_id));
  const targets = userIds.filter((id) => !existingIds.has(id));

  // 各社員の直近レコードから基本情報を取得
  const latestRecords = await prisma.employeeRecord.findMany({
    where: {
      user_id: { in: targets },
      fiscal_year: { lt: newYear },
    },
    orderBy: { fiscal_year: "desc" },
  });

  // user_id → 最新レコード のマップ
  const latestMap = new Map<string, typeof latestRecords[number]>();
  for (const rec of latestRecords) {
    if (!latestMap.has(rec.user_id)) latestMap.set(rec.user_id, rec);
  }

  let created = 0;
  for (const userId of targets) {
    const prev = latestMap.get(userId);
    await prisma.employeeRecord.create({
      data: {
        user_id: userId,
        fiscal_year: newYear,
        // 基本情報は前年度からコピー
        job_title:            prev?.job_title            ?? null,
        employment_type:      prev?.employment_type      ?? null,
        hire_date:            prev?.hire_date            ?? null,
        birth_date:           prev?.birth_date           ?? null,
        gender:               prev?.gender               ?? null,
        education:            prev?.education            ?? null,
        training_period:      prev?.training_period      ?? null,
        // 基本給・役職手当は前年度からコピー、評価・賞与等は空
        curr_base_salary:          prev?.curr_base_salary         ?? null,
        curr_position_allowance:   prev?.curr_position_allowance  ?? null,
      },
    });
    created++;
  }

  return { created, skipped: existingIds.size };
}

/**
 * 社員台帳一覧取得。
 * 基本情報（実習生期以左）は最新年度レコードから取得し、タブ切替で変わらない。
 * 給与・評価列は selectedFiscalYear のレコードから取得。
 */
export async function getEmployeeRecords(selectedFiscalYear: number) {
  await requirePresidentOrAdmin();

  const yearStart = new Date(selectedFiscalYear, 4, 1);      // 5月1日（期首）
  const yearEnd   = new Date(selectedFiscalYear + 1, 3, 30); // 翌年4月30日（期末）

  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      role: { notIn: ["PRESIDENT", "ADMIN"] },
      // 在籍期間フィルター（hire_date未設定の場合は制限なし）
      AND: [
        { OR: [{ hire_date: null }, { hire_date: { lte: yearEnd } }] },
        { OR: [{ resign_date: null }, { resign_date: { gte: yearStart } }] },
      ],
    },
    include: {
      department: true,
      section: true,
      section2: true,
      employee_records: {
        where: { fiscal_year: selectedFiscalYear },
        take: 1,
      },
    },
    orderBy: [{ department: { name: "asc" } }, { employee_number: "asc" }, { name: "asc" }],
  });

  return users.map((u) => {
    const rec = u.employee_records[0] ?? null;

    // 選択年度のレコードがある場合のみデータを返す（他年度で補完しない）
    const record = rec
      ? {
          id: rec.id,
          fiscal_year: rec.fiscal_year,
          job_title: rec.job_title,
          employment_type: rec.employment_type,
          hire_date: rec.hire_date,
          birth_date: rec.birth_date,
          gender: rec.gender,
          education: rec.education,
          training_period: rec.training_period,
          tech_intern_1_date: rec.tech_intern_1_date,
          tech_intern_3_date: rec.tech_intern_3_date,
          specified_skilled_date: rec.specified_skilled_date,
          prev_annual_income: rec.prev_annual_income,
          curr_base_salary: rec.curr_base_salary,
          curr_position_allowance: rec.curr_position_allowance,
          curr_salary_increase: rec.curr_salary_increase,
          curr_summer_bonus: rec.curr_summer_bonus,
          curr_summer_director_eval: rec.curr_summer_director_eval,
          curr_summer_president_eval: rec.curr_summer_president_eval,
          curr_winter_bonus: rec.curr_winter_bonus,
          curr_winter_director_eval: rec.curr_winter_director_eval,
          curr_winter_president_eval: rec.curr_winter_president_eval,
          curr_notes: rec.curr_notes,
        }
      : null;

    return {
      user: {
        id: u.id,
        employee_number: u.employee_number,
        name: u.name,
        role: u.role,
        employee_type: u.employee_type,
        department: u.department,
        section: u.section,
        section2: u.section2,
        section2_name: u.section2_name,
      },
      record,
    };
  });
}

export async function upsertEmployeeRecord(
  userId: string,
  fiscalYear: number,
  data: EmployeeRecordData,
) {
  const me = await requirePresidentOrAdmin();

  const parsed = {
    job_title: data.job_title ?? null,
    employment_type: data.employment_type ?? null,
    hire_date: data.hire_date ? new Date(data.hire_date) : null,
    birth_date: data.birth_date ? new Date(data.birth_date) : null,
    gender: data.gender ?? null,
    education: data.education ?? null,
    training_period: data.training_period ?? null,
    tech_intern_1_date: data.tech_intern_1_date ? new Date(data.tech_intern_1_date) : null,
    tech_intern_3_date: data.tech_intern_3_date ? new Date(data.tech_intern_3_date) : null,
    specified_skilled_date: data.specified_skilled_date ? new Date(data.specified_skilled_date) : null,
    prev_annual_income: data.prev_annual_income ?? null,
    curr_base_salary: data.curr_base_salary ?? null,
    curr_position_allowance: data.curr_position_allowance ?? null,
    curr_salary_increase: data.curr_salary_increase ?? null,
    curr_summer_bonus: data.curr_summer_bonus ?? null,
    curr_summer_director_eval: data.curr_summer_director_eval ?? null,
    curr_summer_president_eval: data.curr_summer_president_eval ?? null,
    curr_winter_bonus: data.curr_winter_bonus ?? null,
    curr_winter_director_eval: data.curr_winter_director_eval ?? null,
    curr_winter_president_eval: data.curr_winter_president_eval ?? null,
    curr_notes: data.curr_notes ?? null,
    updated_by: me.id,
  };

  await prisma.employeeRecord.upsert({
    where: { user_id_fiscal_year: { user_id: userId, fiscal_year: fiscalYear } },
    create: { user_id: userId, fiscal_year: fiscalYear, created_by: me.id, ...parsed },
    update: parsed,
  });

  // 次年度以降のレコードにも役職を反映（既存レコードのみ・上書き）
  if (parsed.job_title !== undefined) {
    await prisma.employeeRecord.updateMany({
      where: { user_id: userId, fiscal_year: { gt: fiscalYear } },
      data: { job_title: parsed.job_title, updated_by: me.id },
    });
  }

  return { ok: true };
}

// ---------- CSV Import ----------

function makeFieldLabels(fy: number): Record<string, string> {
  const y = `${fy}年度`;
  return {
    employment_type: "雇用形態",
    hire_date: "入社年月日",
    birth_date: "生年月日",
    gender: "性別",
    education: "最終学歴",
    training_period: "実習生期",
    fiscal_year: "対象年度",
    curr_base_salary: `${y}_基本給`,
    curr_position_allowance: `${y}_役職手当`,
    curr_salary_increase: `${y}_昇給額`,
    curr_summer_bonus: `${y}_夏期賞与`,
    curr_summer_director_eval: `${y}_夏部長評価`,
    curr_summer_president_eval: `${y}_夏社長評価`,
    curr_winter_bonus: `${y}_冬期賞与`,
    curr_winter_director_eval: `${y}_冬部長評価`,
    curr_winter_president_eval: `${y}_冬社長評価`,
    curr_notes: `${y}_備考`,
  };
}

function describeZodIssue(
  issue: { path: PropertyKey[]; message: string },
  raw: Record<string, unknown>,
  fieldLabels: Record<string, string>,
): string {
  const key = String(issue.path[0] ?? "");
  const label = fieldLabels[key] ?? key;
  const value = raw[key];
  const valueStr = value == null || value === "" ? "（空）" : `「${value}」`;

  if (key === "fiscal_year") {
    return `${label}: ${valueStr} → 西暦4桁の数値（例: 2026）を入力してください`;
  }
  if (key.endsWith("_date") || key === "hire_date" || key === "birth_date") {
    return `${label}: ${valueStr} → 日付は yyyy-MM-dd または yyyy/MM/dd 形式で入力してください`;
  }
  if (key.endsWith("_president_eval")) {
    return `${label}: ${valueStr} → A+・A・B+・B・C のいずれかを入力してください`;
  }
  if (["curr_base_salary","curr_position_allowance","curr_salary_increase",
       "curr_summer_bonus","curr_winter_bonus"].includes(key)) {
    return `${label}: ${valueStr} → 数値を入力してください`;
  }
  return `${label}: ${valueStr} → ${issue.message}`;
}

const evalSchema = z.string().regex(/^(A\+|A|B\+|B|C)$/).nullable();
const numSchema = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().nullable(),
);
const dateSchema = z.preprocess(
  (v) => {
    if (v === "" || v == null) return null;
    return String(v).replace(/^(\d{4})\/(\d{2})\/(\d{2})$/, "$1-$2-$3");
  },
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
);
const fiscalYearSchema = z.preprocess(
  (v) => {
    if (v === "" || v == null) return null;
    // "2026年度" → 2026、"2026" → 2026
    const n = Number(String(v).replace(/[^0-9]/g, "").slice(0, 4));
    return isNaN(n) ? null : n;
  },
  z.number().int().min(2000).max(2100),
);

const rowSchema = z.object({
  employment_type: z.string().nullable(),
  hire_date: dateSchema,
  birth_date: dateSchema,
  gender: z.string().nullable(),
  education: z.string().nullable(),
  training_period: z.string().nullable(),
  fiscal_year: fiscalYearSchema,
  prev_annual_income: numSchema,
  curr_base_salary: numSchema,
  curr_position_allowance: numSchema,
  curr_salary_increase: numSchema,
  curr_summer_bonus: numSchema,
  curr_summer_director_eval: z.string().nullable(),
  curr_summer_president_eval: evalSchema,
  curr_winter_bonus: numSchema,
  curr_winter_director_eval: z.string().nullable(),
  curr_winter_president_eval: evalSchema,
  curr_notes: z.string().nullable(),
});

export type ImportResult = {
  imported: number;
  errors: { line: number; message: string }[];
};

// ヘッダー名 → フィールドキーのマッピング
const HEADER_TO_FIELD: Record<string, string> = {
  "雇用形態": "employment_type",
  "入社年月日": "hire_date",
  "生年月日": "birth_date",
  "性別": "gender",
  "最終学歴": "education",
  "実習生期": "training_period",
  "技能実習生１号開始日": "tech_intern_1_date",
  "技能実習生３号開始日": "tech_intern_3_date",
  "特定技能開始日": "specified_skilled_date",
  "対象年度": "fiscal_year",
  "前年度年収": "prev_annual_income",
  "基本給": "curr_base_salary",
  "役職手当": "curr_position_allowance",
  "昇給額": "curr_salary_increase",
  "夏期賞与": "curr_summer_bonus",
  "夏部長評価": "curr_summer_director_eval",
  "夏社長評価": "curr_summer_president_eval",
  "冬期賞与": "curr_winter_bonus",
  "冬部長評価": "curr_winter_director_eval",
  "冬社長評価": "curr_winter_president_eval",
  "備考": "curr_notes",
};

// rowSchema の部分スキーマ（含まれている列だけ検証）
const partialRowSchemas: Record<string, z.ZodTypeAny> = {
  employment_type: z.string().nullable(),
  hire_date: dateSchema,
  birth_date: dateSchema,
  gender: z.string().nullable(),
  education: z.string().nullable(),
  training_period: z.string().nullable(),
  tech_intern_1_date: dateSchema,
  tech_intern_3_date: dateSchema,
  specified_skilled_date: dateSchema,
  fiscal_year: fiscalYearSchema,
  prev_annual_income: numSchema,
  curr_base_salary: numSchema,
  curr_position_allowance: numSchema,
  curr_salary_increase: numSchema,
  curr_summer_bonus: numSchema,
  curr_summer_director_eval: z.string().nullable(),
  curr_summer_president_eval: evalSchema,
  curr_winter_bonus: numSchema,
  curr_winter_director_eval: z.string().nullable(),
  curr_winter_president_eval: evalSchema,
  curr_notes: z.string().nullable(),
};

export async function importEmployeeRecordsCsv(
  allRows: string[][],
): Promise<ImportResult> {
  const me = await requirePresidentOrAdmin();
  const errors: { line: number; message: string }[] = [];
  const currentFY = getFiscalYear();
  const fieldLabels = makeFieldLabels(currentFY);

  if (allRows.length < 2) return { imported: 0, errors: [{ line: 1, message: "データ行がありません" }] };

  // 1行目をヘッダーとして解析
  const headerRow = allRows[0].map((h) => h.trim());
  const empNoIdx = headerRow.indexOf("社員番号");
  if (empNoIdx === -1) return { imported: 0, errors: [{ line: 1, message: "ヘッダー行に「社員番号」列がありません" }] };

  // 課２列のインデックス
  const section2Idx = headerRow.indexOf("課２");

  // 更新対象フィールドのインデックスを抽出（社員番号・課２以外）
  const fieldCols: { colIdx: number; fieldKey: string }[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    if (c === empNoIdx || c === section2Idx) continue;
    const fieldKey = HEADER_TO_FIELD[headerRow[c]];
    if (fieldKey) fieldCols.push({ colIdx: c, fieldKey });
  }

  const hasSection2Col = section2Idx !== -1;
  if (fieldCols.length === 0 && !hasSection2Col) return { imported: 0, errors: [{ line: 1, message: "更新可能な列がありません。ヘッダー名を確認してください" }] };
  if (fieldCols.length > 0 && !fieldCols.some((f) => f.fieldKey === "fiscal_year")) {
    return { imported: 0, errors: [{ line: 1, message: "「対象年度」列が必要です" }] };
  }

  type ValidRow = { line: number; employee_number: string; data: Record<string, unknown> };
  const valid: ValidRow[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const line = i + 1;
    const cols = allRows[i];
    const emp_no = (cols[empNoIdx] ?? "").trim();
    if (!emp_no && cols.every((c) => !c?.trim())) continue;
    if (!emp_no) { errors.push({ line, message: "社員番号が空です" }); continue; }

    const section2NameValue = hasSection2Col ? (cols[section2Idx]?.trim() || null) : undefined;

    const raw: Record<string, unknown> = {};
    for (const { colIdx, fieldKey } of fieldCols) {
      raw[fieldKey] = cols[colIdx]?.trim() || null;
    }

    // フィールドごとに個別検証
    const parsed: Record<string, unknown> = {};
    let rowError = false;
    for (const [key, val] of Object.entries(raw)) {
      const schema = partialRowSchemas[key];
      if (!schema) continue;
      const result = schema.safeParse(val);
      if (!result.success) {
        const msg = result.error.issues
          .map((e) => describeZodIssue({ path: [key], message: e.message }, { [key]: val }, fieldLabels))
          .join(" / ");
        errors.push({ line, message: `社員番号 ${emp_no}: ${msg}` });
        rowError = true;
        break;
      }
      parsed[key] = result.data;
    }
    if (rowError) continue;

    if (section2NameValue !== undefined) parsed.section2_name = section2NameValue;

    valid.push({ line, employee_number: emp_no, data: parsed });
  }

  let imported = 0;
  for (const row of valid) {
    const user = await prisma.user.findFirst({
      where: { employee_number: row.employee_number, deleted_at: null },
    });
    if (!user) {
      errors.push({ line: row.line, message: `社員番号 ${row.employee_number} が見つかりません` });
      continue;
    }

    // 課２を User に保存
    if (row.data.section2_name !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: { section2_name: row.data.section2_name as string | null },
      });
    }

    const fy = row.data.fiscal_year as number;
    if (!fieldCols.some((f) => f.fieldKey === "fiscal_year")) {
      imported++;
      continue;
    }
    const updateData: Record<string, unknown> = { updated_by: me.id };
    for (const { fieldKey } of fieldCols) {
      if (fieldKey === "fiscal_year") continue;
      if (fieldKey in row.data) {
        const v = row.data[fieldKey];
        if (["hire_date", "birth_date", "tech_intern_1_date", "tech_intern_3_date", "specified_skilled_date"].includes(fieldKey)) {
          updateData[fieldKey] = v ? new Date(v as string) : null;
        } else {
          updateData[fieldKey] = v;
        }
      }
    }

    const existing = await prisma.employeeRecord.findUnique({
      where: { user_id_fiscal_year: { user_id: user.id, fiscal_year: fy } },
    });

    if (existing) {
      await prisma.employeeRecord.update({
        where: { user_id_fiscal_year: { user_id: user.id, fiscal_year: fy } },
        data: updateData,
      });
    } else {
      await prisma.employeeRecord.create({
        data: { user_id: user.id, fiscal_year: fy, created_by: me.id, ...updateData },
      });
    }
    imported++;
  }

  return { imported, errors };
}

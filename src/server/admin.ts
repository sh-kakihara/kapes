"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") forbidden();
  return session;
}

export async function getUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { deleted_at: null },
    include: {
      department: { include: { sections: { where: { deleted_at: null }, include: { groups: { where: { deleted_at: null } } } } } },
      section: { include: { groups: { where: { deleted_at: null } } } },
      section2: { include: { groups: { where: { deleted_at: null } } } },
      group: true,
    },
    orderBy: [{ department: { name: "asc" } }, { section: { name: "asc" } }, { name: "asc" }],
  });
}

export async function createUser(data: {
  employee_number?: string; login_id: string; name: string; password: string;
  role: Role; department_id?: string; section_id?: string; section2_id?: string; group_id?: string;
  employee_type?: string; hire_date?: string; resign_date?: string;
}) {
  await requireAdmin();
  const password_hash = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: {
      employee_number: data.employee_number || null,
      login_id: data.login_id,
      name: data.name,
      password_hash,
      role: data.role,
      department_id: data.department_id || null,
      section_id: data.section_id || null,
      section2_id: data.section2_id || null,
      group_id: data.group_id || null,
      employee_type: data.employee_type || null,
      hire_date: data.hire_date ? new Date(data.hire_date) : null,
      resign_date: data.resign_date ? new Date(data.resign_date) : null,
    },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/employees");
}

export async function updateUser(id: string, data: {
  employee_number?: string; name: string; role: Role;
  department_id?: string; section_id?: string; section2_id?: string; group_id?: string;
  is_active: boolean; password?: string; employee_type?: string;
  can_view_evaluations?: boolean; can_view_notices?: boolean; hire_date?: string; resign_date?: string;
}) {
  await requireAdmin();
  const password_hash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
  await prisma.user.update({
    where: { id },
    data: {
      employee_number: data.employee_number || null,
      name: data.name,
      role: data.role,
      department: data.department_id ? { connect: { id: data.department_id } } : { disconnect: true },
      section: data.section_id ? { connect: { id: data.section_id } } : { disconnect: true },
      section2: data.section2_id ? { connect: { id: data.section2_id } } : { disconnect: true },
      group: data.group_id ? { connect: { id: data.group_id } } : { disconnect: true },
      is_active: data.is_active,
      employee_type: data.employee_type || null,
      can_view_evaluations: data.can_view_evaluations ?? false,
      can_view_notices: data.can_view_notices ?? false,
      hire_date: data.hire_date ? new Date(data.hire_date) : null,
      resign_date: data.resign_date ? new Date(data.resign_date) : null,
      ...(password_hash ? { password_hash } : {}),
    },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/employees");
}

export async function updateUserSection2(userId: string, section2Name: string | null) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { section2_name: section2Name || null },
  });
  revalidatePath("/admin/employees");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (target?.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", deleted_at: null } });
    if (adminCount <= 1) throw new Error("管理者が1人しかいないため削除できません。先に別の管理者を追加してください。");
  }
  await prisma.user.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } });
  revalidatePath("/admin/users");
  revalidatePath("/admin/employees");
}

export async function bulkSetCanViewNotices(userIds: string[], enabled: boolean) {
  await requireAdmin();
  await prisma.user.updateMany({
    where: { id: { in: userIds }, deleted_at: null },
    data: { can_view_notices: enabled },
  });
  revalidatePath("/admin/users");
}

export async function getDepartments() {
  await requireAdmin();
  return prisma.department.findMany({
    where: { deleted_at: null },
    include: {
      sections: {
        where: { deleted_at: null },
        include: { groups: { where: { deleted_at: null } } },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(name: string) {
  await requireAdmin();
  const existing = await prisma.department.findFirst({ where: { name, deleted_at: { not: null } } });
  if (existing) {
    await prisma.department.update({ where: { id: existing.id }, data: { deleted_at: { set: null }, skip_director: false } });
  } else {
    await prisma.department.create({ data: { name } });
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/departments");
}

export async function toggleDepartmentSkipDirector(id: string, value: boolean) {
  await requireAdmin();
  await prisma.department.update({ where: { id }, data: { skip_director: value } });
  revalidatePath("/admin/departments");
}

export async function toggleDepartmentSkipEvaluation(id: string, value: boolean) {
  await requireAdmin();
  await prisma.department.update({ where: { id }, data: { skip_evaluation: value } });
  revalidatePath("/admin/departments");
}

export async function createSection(department_id: string, name: string) {
  await requireAdmin();
  const existing = await prisma.section.findFirst({ where: { department_id, name, deleted_at: { not: null } } });
  if (existing) {
    await prisma.section.update({ where: { id: existing.id }, data: { deleted_at: { set: null } } });
  } else {
    await prisma.section.create({ data: { department_id, name } });
  }
  revalidatePath("/admin/users");
}

export async function createGroup(section_id: string, name: string) {
  await requireAdmin();
  const existing = await prisma.group.findFirst({ where: { section_id, name, deleted_at: { not: null } } });
  if (existing) {
    await prisma.group.update({ where: { id: existing.id }, data: { deleted_at: { set: null } } });
  } else {
    await prisma.group.create({ data: { section_id, name } });
  }
  revalidatePath("/admin/users");
}

// CSVインポート（upsert by login_id）
export async function importUsersFromCsv(rows: {
  employee_number: string; login_id: string; name: string; password: string;
  role: string; department_name: string; section_name: string; group_name: string;
  employee_type?: string; is_active?: string;
}[]) {
  await requireAdmin();

  const results: { row: number; login_id: string; status: string; error?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // 部署解決
      let dept = null;
      if (row.department_name) {
        dept = await prisma.department.findFirst({ where: { name: row.department_name, deleted_at: null } });
        if (!dept) throw new Error(`部署「${row.department_name}」が見つかりません`);
      }
      // 課解決
      let sec = null;
      if (row.section_name && dept) {
        sec = await prisma.section.findFirst({ where: { name: row.section_name, department_id: dept.id, deleted_at: null } });
        if (!sec) throw new Error(`課「${row.section_name}」が見つかりません`);
      }
      // グループ解決
      let grp = null;
      if (row.group_name && sec) {
        grp = await prisma.group.findFirst({ where: { name: row.group_name, section_id: sec.id, deleted_at: null } });
        if (!grp) throw new Error(`グループ「${row.group_name}」が見つかりません`);
      }

      const validRoles = ["STAFF", "LEADER", "MANAGER", "DIRECTOR", "EXECUTIVE", "PRESIDENT", "ADMIN"];
      if (!validRoles.includes(row.role)) throw new Error(`ロール「${row.role}」が不正です`);

      if (!row.employee_number) throw new Error("社員番号は必須です");
      const existing = await prisma.user.findFirst({ where: { employee_number: row.employee_number, deleted_at: null } });
      const validEmployeeTypes = ["柿原工業", "柿原技研", "実習生"];
      const employeeType = row.employee_type && validEmployeeTypes.includes(row.employee_type)
        ? row.employee_type : undefined;
      const isActive = row.is_active === "無効" ? false : row.is_active === "有効" ? true : undefined;

      const updateData: Record<string, unknown> = {
        employee_number: row.employee_number || null,
        login_id: row.login_id,
        name: row.name,
        role: row.role as Role,
        department_id: dept?.id ?? null,
        section_id: sec?.id ?? null,
        group_id: grp?.id ?? null,
        ...(employeeType !== undefined ? { employee_type: employeeType } : {}),
        ...(isActive !== undefined ? { is_active: isActive } : {}),
      };
      if (row.password) updateData.password_hash = await bcrypt.hash(row.password, 10);

      if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data: updateData });
        results.push({ row: i + 2, login_id: row.login_id, status: "更新" });
      } else {
        if (!row.password) throw new Error("新規登録にはパスワードが必要です");
        await prisma.user.create({
          data: {
            ...updateData,
            login_id: row.login_id,
            password_hash: await bcrypt.hash(row.password, 10),
          } as Parameters<typeof prisma.user.create>[0]["data"],
        });
        results.push({ row: i + 2, login_id: row.login_id, status: "新規" });
      }
    } catch (e: unknown) {
      results.push({ row: i + 2, login_id: row.login_id, status: "エラー", error: e instanceof Error ? e.message : "不明なエラー" });
    }
  }

  revalidatePath("/admin/users");
  return results;
}

export async function getPeriods() {
  await requireAdmin();
  return prisma.evaluationPeriod.findMany({ orderBy: { start_date: "desc" } });
}

export async function createPeriod(data: {
  name: string; start_date: string; end_date: string;
  self_deadline?: string; leader_deadline?: string;
  manager_deadline?: string; director_deadline?: string;
}) {
  await requireAdmin();
  await prisma.evaluationPeriod.create({
    data: {
      name: data.name,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      self_deadline: data.self_deadline ? new Date(data.self_deadline) : null,
      leader_deadline: data.leader_deadline ? new Date(data.leader_deadline) : null,
      manager_deadline: data.manager_deadline ? new Date(data.manager_deadline) : null,
      director_deadline: data.director_deadline ? new Date(data.director_deadline) : null,
    },
  });
  revalidatePath("/admin/periods");
}

export async function updatePeriodDates(id: string, start_date: string, end_date: string) {
  await requireAdmin();
  if (!start_date || !end_date) throw new Error("開始日・終了日は必須です");
  if (new Date(start_date) > new Date(end_date)) throw new Error("開始日は終了日より前にしてください");
  await prisma.evaluationPeriod.update({
    where: { id },
    data: { start_date: new Date(start_date), end_date: new Date(end_date) },
  });
  revalidatePath("/admin/periods");
}

export async function updatePeriodName(id: string, name: string) {
  await requireAdmin();
  if (!name.trim()) throw new Error("期間名は必須です");
  await prisma.evaluationPeriod.update({
    where: { id },
    data: { name: name.trim() },
  });
  revalidatePath("/admin/periods");
  revalidatePath("/admin/employees");
}

export async function updatePeriodDeadlines(
  id: string,
  deadlines: { self_deadline?: string | null; leader_deadline?: string | null; manager_deadline?: string | null; director_deadline?: string | null }
) {
  await requireAdmin();
  await prisma.evaluationPeriod.update({
    where: { id },
    data: {
      self_deadline: deadlines.self_deadline != null ? new Date(deadlines.self_deadline) : null,
      leader_deadline: deadlines.leader_deadline != null ? new Date(deadlines.leader_deadline) : null,
      manager_deadline: deadlines.manager_deadline != null ? new Date(deadlines.manager_deadline) : null,
      director_deadline: deadlines.director_deadline != null ? new Date(deadlines.director_deadline) : null,
    },
  });
  revalidatePath("/admin/periods");
}

// 後方互換用（削除済みフィールドのため無効化）
export async function toggleDepartmentLeader(_id: string, _has_leader: boolean) {
  // Department.has_leader は Section.has_leader に移行済み
}

export async function renameDepartment(id: string, name: string) {
  await requireAdmin();
  await prisma.department.update({ where: { id }, data: { name } });
  revalidatePath("/admin/departments");
}

export async function deleteDepartment(id: string) {
  await requireAdmin();
  const hasUsers = await prisma.user.count({ where: { department_id: id, deleted_at: null } });
  if (hasUsers > 0) throw new Error("所属ユーザーがいるため削除できません");
  await prisma.department.update({ where: { id }, data: { deleted_at: new Date() } });
  revalidatePath("/admin/departments");
}

export async function renameSection(id: string, name: string) {
  await requireAdmin();
  await prisma.section.update({ where: { id }, data: { name } });
  revalidatePath("/admin/departments");
}

export async function toggleSectionLeader(id: string, has_leader: boolean) {
  await requireAdmin();
  await prisma.section.update({ where: { id }, data: { has_leader } });
  revalidatePath("/admin/departments");
}

export async function deleteSection(id: string) {
  await requireAdmin();
  const hasUsers = await prisma.user.count({ where: { section_id: id, deleted_at: null } });
  if (hasUsers > 0) throw new Error("所属ユーザーがいるため削除できません");
  await prisma.section.update({ where: { id }, data: { deleted_at: new Date() } });
  revalidatePath("/admin/departments");
}

export async function renameGroup(id: string, name: string) {
  await requireAdmin();
  await prisma.group.update({ where: { id }, data: { name } });
  revalidatePath("/admin/departments");
}

export async function deleteGroup(id: string) {
  await requireAdmin();
  const hasUsers = await prisma.user.count({ where: { group_id: id, deleted_at: null } });
  if (hasUsers > 0) throw new Error("所属ユーザーがいるため削除できません");
  await prisma.group.update({ where: { id }, data: { deleted_at: new Date() } });
  revalidatePath("/admin/departments");
}

export async function togglePeriod(id: string, is_active: boolean) {
  await requireAdmin();
  await prisma.evaluationPeriod.update({ where: { id }, data: { is_active } });
  revalidatePath("/admin/periods");
}

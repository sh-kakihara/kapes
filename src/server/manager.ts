"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { forbidden } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireManager() {
  const session = await auth();
  if (!session?.user || !["MANAGER", "ADMIN"].includes(session.user.role)) forbidden();
  return session;
}

/** 課長自身の課に所属するグループ一覧（メンバー付き）を返す */
export async function getMyGroups() {
  const session = await requireManager();
  const me = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { section_id: true },
  });
  if (!me?.section_id) return { section: null, groups: [], ungrouped: [] };

  const section = await prisma.section.findUnique({
    where: { id: me.section_id },
    select: { id: true, name: true, has_leader: true },
  });

  const groups = await prisma.group.findMany({
    where: { section_id: me.section_id, deleted_at: null },
    include: {
      users: {
        where: { deleted_at: null, is_active: true, employee_type: { not: "実習生" } },
        select: { id: true, employee_number: true, name: true, role: true },
        orderBy: [{ employee_number: "asc" }, { name: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  // グループ未所属の課員（LEADER/STAFF/EXECUTIVE 等、課長・部長・社長以外）
  const ungrouped = await prisma.user.findMany({
    where: {
      section_id: me.section_id,
      group_id: null,
      deleted_at: null,
      is_active: true,
      role: { notIn: ["MANAGER", "DIRECTOR", "PRESIDENT", "ADMIN"] },
      employee_type: { not: "実習生" },
    },
    select: { id: true, employee_number: true, name: true, role: true },
    orderBy: [{ employee_number: "asc" }, { name: "asc" }],
  });

  return { section, groups, ungrouped };
}

/** 社員をグループに移動（null でグループ解除） */
export async function assignUserToGroup(userId: string, groupId: string | null) {
  const session = await requireManager();
  const me = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { section_id: true },
  });

  // 対象ユーザーが同じ課に所属していることを確認
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { section_id: true },
  });
  if (!target || target.section_id !== me?.section_id) forbidden();

  // グループが同じ課のものであることを確認
  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { section_id: true } });
    if (!group || group.section_id !== me?.section_id) forbidden();
  }

  await prisma.user.update({
    where: { id: userId },
    data: { group_id: groupId },
  });
  revalidatePath("/manager/groups");
}

/** グループを新規作成 */
export async function createGroup(name: string) {
  const session = await requireManager();
  const me = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { section_id: true },
  });
  if (!me?.section_id) forbidden();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "グループ名を入力してください" };

  await prisma.group.create({
    data: { name: trimmed, section_id: me.section_id! },
  });
  revalidatePath("/manager/groups");
  return { ok: true };
}

/** グループ名を変更 */
export async function renameGroup(groupId: string, name: string) {
  const session = await requireManager();
  const me = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { section_id: true },
  });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { section_id: true },
  });
  if (!group || group.section_id !== me?.section_id) forbidden();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "グループ名を入力してください" };

  await prisma.group.update({ where: { id: groupId }, data: { name: trimmed } });
  revalidatePath("/manager/groups");
  return { ok: true };
}

/** グループを削除（メンバーがいる場合は不可） */
export async function deleteGroup(groupId: string) {
  const session = await requireManager();
  const me = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { section_id: true },
  });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { section_id: true, _count: { select: { users: { where: { deleted_at: null, is_active: true } } } } },
  });
  if (!group || group.section_id !== me?.section_id) forbidden();
  if (group._count.users > 0) return { ok: false, error: "メンバーが所属しているため削除できません" };

  await prisma.group.update({
    where: { id: groupId },
    data: { deleted_at: new Date() },
  });
  revalidatePath("/manager/groups");
  return { ok: true };
}

/** 社員のロールを LEADER ↔ STAFF で切り替え */
export async function toggleLeaderRole(userId: string, makeLeader: boolean) {
  const session = await requireManager();
  const me = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { section_id: true },
  });

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { section_id: true, role: true },
  });
  if (!target || target.section_id !== me?.section_id) forbidden();
  if (!["STAFF", "LEADER"].includes(target.role)) forbidden();

  await prisma.user.update({
    where: { id: userId },
    data: { role: makeLeader ? "LEADER" : "STAFF" },
  });
  revalidatePath("/manager/groups");
}

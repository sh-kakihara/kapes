"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function setupFirstLogin(newLoginId: string, newPassword: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "未認証です" };
  if (!session.user.is_first_login) return { ok: false, error: "既に初回設定は完了しています" };

  if (!newLoginId || newLoginId.length < 3) return { ok: false, error: "ログインIDは3文字以上で入力してください" };
  if (newPassword.length < 6) return { ok: false, error: "パスワードは6文字以上で入力してください" };

  const existing = await prisma.user.findFirst({ where: { login_id: newLoginId, NOT: { id: session.user.id } } });
  if (existing) return { ok: false, error: "そのログインIDは既に使用されています" };

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { login_id: newLoginId, password_hash: hash, is_first_login: false },
  });
  return { ok: true };
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "未認証です" };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "ユーザーが見つかりません" };

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return { ok: false, error: "現在のパスワードが正しくありません" };

  if (newPassword.length < 6) return { ok: false, error: "新しいパスワードは6文字以上で入力してください" };

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password_hash: hash } });
  return { ok: true };
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUsers, getDepartments, createUser, updateUser, deleteUser } from "@/server/admin";
import UserAdmin from "./user-admin";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const [users, departments] = await Promise.all([getUsers(), getDepartments()]);

  return (
    <div>
      <div className="mb-4">
        <a href="/admin" className="text-sm text-blue-600 hover:underline">← 管理者メニュー</a>
      </div>
      <h2 className="text-xl font-bold mb-6 text-gray-800">ユーザー管理</h2>
      <UserAdmin users={users} departments={departments} />
    </div>
  );
}

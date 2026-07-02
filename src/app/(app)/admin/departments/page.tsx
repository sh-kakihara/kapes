import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDepartments } from "@/server/admin";
import DepartmentAdmin from "./department-admin";

export default async function AdminDepartmentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const departments = await getDepartments();

  return (
    <div>
      <div className="mb-4">
        <a href="/admin" className="text-sm text-blue-600 hover:underline">← 管理者メニュー</a>
      </div>
      <h2 className="text-xl font-bold mb-6 text-gray-800">部署・課管理</h2>
      <DepartmentAdmin departments={departments} />
    </div>
  );
}

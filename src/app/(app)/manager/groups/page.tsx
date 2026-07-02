import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMyGroups } from "@/server/manager";
import GroupEditor from "./group-editor";

export default async function ManagerGroupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) redirect("/evaluation");

  const { section, groups, ungrouped } = await getMyGroups();

  if (!section) {
    return (
      <div className="text-center py-20 text-gray-500">
        課に所属していないためグループ管理ができません。
      </div>
    );
  }

  const groupsForEditor = groups.map((g) => ({
    id: g.id,
    name: g.name,
    members: g.users,
  }));

  return (
    <div>
      <h2 className="text-xl font-bold mb-1 text-gray-800">グループ・リーダー管理</h2>
      <p className="text-sm text-gray-500 mb-6">課: {section.name}</p>
      <GroupEditor groups={groupsForEditor} ungrouped={ungrouped} hasLeader={section.has_leader} />
    </div>
  );
}

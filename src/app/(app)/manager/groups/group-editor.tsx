"use client";

import { useState, useTransition } from "react";
import { assignUserToGroup, toggleLeaderRole, createGroup, deleteGroup, renameGroup } from "@/server/manager";
import { useRouter } from "next/navigation";

type Member = { id: string; employee_number: string | null; name: string; role: string };
type Group = { id: string; name: string; members: Member[] };

const ROLE_LABELS: Record<string, string> = {
  STAFF: "一般",
  LEADER: "リーダー",
  MANAGER: "課長",
};

export default function GroupEditor({
  groups,
  ungrouped,
  hasLeader,
}: {
  groups: Group[];
  ungrouped: Member[];
  hasLeader: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  function refresh() {
    router.refresh();
  }

  async function handleAssign(userId: string, groupId: string | null) {
    setMessage("");
    startTransition(async () => {
      await assignUserToGroup(userId, groupId);
      setMessage("グループを更新しました");
      refresh();
    });
  }

  async function handleToggleLeader(userId: string, isLeader: boolean) {
    setMessage("");
    startTransition(async () => {
      await toggleLeaderRole(userId, !isLeader);
      setMessage("ロールを更新しました");
      refresh();
    });
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setMessage("");
    startTransition(async () => {
      const result = await createGroup(newGroupName);
      if (result.ok) {
        setNewGroupName("");
        setMessage("グループを追加しました");
        refresh();
      } else {
        setMessage(result.error ?? "エラーが発生しました");
      }
    });
  }

  function startEditGroup(group: Group) {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }

  async function handleRenameGroup(groupId: string) {
    setMessage("");
    startTransition(async () => {
      const result = await renameGroup(groupId, editingGroupName);
      if (result.ok) {
        setEditingGroupId(null);
        setMessage("グループ名を変更しました");
        refresh();
      } else {
        setMessage(result.error ?? "エラーが発生しました");
      }
    });
  }

  async function handleDeleteGroup(groupId: string, memberCount: number) {
    if (memberCount > 0) return;
    setMessage("");
    startTransition(async () => {
      const result = await deleteGroup(groupId);
      if (result.ok) {
        setMessage("グループを削除しました");
        refresh();
      } else {
        setMessage(result.error ?? "エラーが発生しました");
      }
    });
  }

  const allGroups = groups;

  return (
    <div className="space-y-6">
      {message && <p className="text-sm text-green-600">{message}</p>}

      {/* グループ追加 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
          placeholder="新しいグループ名"
          className="text-sm border rounded px-3 py-1.5 w-48"
          disabled={pending}
        />
        <button
          onClick={handleCreateGroup}
          disabled={pending || !newGroupName.trim()}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          グループを追加
        </button>
      </div>

      {/* グループ別メンバー */}
      {allGroups.map((group) => (
        <div key={group.id} className="bg-white border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700 border-b flex items-center gap-2">
            {editingGroupId === group.id ? (
              <>
                <input
                  type="text"
                  value={editingGroupName}
                  onChange={(e) => setEditingGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameGroup(group.id);
                    if (e.key === "Escape") setEditingGroupId(null);
                  }}
                  className="text-sm border rounded px-2 py-0.5 w-40"
                  autoFocus
                  disabled={pending}
                />
                <button
                  onClick={() => handleRenameGroup(group.id)}
                  disabled={pending || !editingGroupName.trim()}
                  className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingGroupId(null)}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-100"
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <span>{group.name}</span>
                <span className="text-xs text-gray-400">（{group.members.length}名）</span>
                <button
                  onClick={() => startEditGroup(group)}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-100"
                >
                  名前変更
                </button>
              </>
            )}
            <div className="ml-auto">
              <button
                disabled={pending || group.members.length > 0}
                onClick={() => handleDeleteGroup(group.id, group.members.length)}
                title={group.members.length > 0 ? "メンバーが所属しているため削除できません" : "グループを削除"}
                className="text-xs px-2 py-1 rounded border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                削除
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">社員番号</th>
                <th className="px-4 py-2 text-left">氏名</th>
                <th className="px-4 py-2 text-left">区分</th>
                {hasLeader && <th className="px-4 py-2 text-left">リーダー</th>}
                <th className="px-4 py-2 text-left">グループ変更</th>
              </tr>
            </thead>
            <tbody>
              {group.members.length === 0 && (
                <tr><td colSpan={hasLeader ? 5 : 4} className="px-4 py-4 text-gray-400 text-center text-xs">メンバーなし</td></tr>
              )}
              {group.members.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{m.employee_number ?? "-"}</td>
                  <td className="px-4 py-2">{m.name}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "LEADER" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </td>
                  {hasLeader && (
                    <td className="px-4 py-2">
                      <button
                        disabled={pending}
                        onClick={() => handleToggleLeader(m.id, m.role === "LEADER")}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          m.role === "LEADER"
                            ? "border-orange-400 text-orange-600 hover:bg-orange-50"
                            : "border-gray-300 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {m.role === "LEADER" ? "解除" : "設定"}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <select
                      disabled={pending}
                      value={group.id}
                      onChange={(e) => handleAssign(m.id, e.target.value === "" ? null : e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="">（未所属）</option>
                      {allGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* グループ未所属 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="bg-amber-50 px-4 py-2 font-medium text-amber-800 border-b flex items-center gap-2">
          <span>グループ未所属</span>
          <span className="text-xs text-amber-500">（{ungrouped.length}名）</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">社員番号</th>
              <th className="px-4 py-2 text-left">氏名</th>
              <th className="px-4 py-2 text-left">区分</th>
              <th className="px-4 py-2 text-left">グループに追加</th>
            </tr>
          </thead>
          <tbody>
            {ungrouped.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4 text-gray-400 text-center text-xs">全員グループ所属済み</td></tr>
            )}
            {ungrouped.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-500">{m.employee_number ?? "-"}</td>
                <td className="px-4 py-2">{m.name}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "LEADER" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <select
                    disabled={pending}
                    value=""
                    onChange={(e) => { if (e.target.value) handleAssign(m.id, e.target.value); }}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">グループを選択...</option>
                    {allGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

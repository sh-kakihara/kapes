"use client";

import { useState } from "react";
import {
  createDepartment, createSection, createGroup,
  renameDepartment, deleteDepartment,
  renameSection, deleteSection, toggleSectionLeader,
  renameGroup, deleteGroup, toggleDepartmentSkipDirector, toggleDepartmentSkipEvaluation,
} from "@/server/admin";

type Group = { id: string; name: string };
type Section = { id: string; name: string; has_leader: boolean; groups: Group[] };
type Department = { id: string; name: string; skip_director: boolean; skip_evaluation: boolean; sections: Section[] };

export default function DepartmentAdmin({ departments }: { departments: Department[] }) {
  const [newDeptName, setNewDeptName] = useState("");
  const [addingSection, setAddingSection] = useState<{ dept_id: string; name: string } | null>(null);
  const [addingGroup, setAddingGroup] = useState<{ sec_id: string; name: string } | null>(null);

  // 編集中の名前 { id: newName }
  const [editingDept, setEditingDept] = useState<{ id: string; name: string } | null>(null);
  const [editingSection, setEditingSection] = useState<{ id: string; name: string } | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string } | null>(null);

  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function msg(text: string, ok = true) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleCreateDept(e: React.FormEvent) {
    e.preventDefault();
    try { await createDepartment(newDeptName); setNewDeptName(""); msg("部を追加しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleRenameDept(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDept) return;
    try { await renameDepartment(editingDept.id, editingDept.name); setEditingDept(null); msg("部名を変更しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleDeleteDept(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？\n（所属ユーザーがいる場合は削除できません）`)) return;
    try { await deleteDepartment(id); msg("部を削除しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault();
    if (!addingSection) return;
    try { await createSection(addingSection.dept_id, addingSection.name); setAddingSection(null); msg("課を追加しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleRenameSection(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSection) return;
    try { await renameSection(editingSection.id, editingSection.name); setEditingSection(null); msg("課名を変更しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleDeleteSection(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？\n（所属ユーザーがいる場合は削除できません）`)) return;
    try { await deleteSection(id); msg("課を削除しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleToggleSectionLeader(id: string, current: boolean) {
    try {
      await toggleSectionLeader(id, !current);
      msg(!current ? "リーダー評価ありに設定しました" : "リーダー評価なしに設定しました");
    } catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleToggleSkipDirector(id: string, current: boolean) {
    if (!current && !confirm("「部長評価スキップ（課長→社長）」に設定します。この部署は課長評価後、社長に直接提出されます。よろしいですか？")) return;
    try {
      await toggleDepartmentSkipDirector(id, !current);
      msg(!current ? "部長スキップに設定しました（課長→社長）" : "通常フローに戻しました（課長→部長→社長）");
    } catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleToggleSkipEvaluation(id: string, current: boolean) {
    if (!current && !confirm("「評価対象外」に設定します。この部署の社員は自己評価・課長評価・部長評価の対象外になります。よろしいですか？")) return;
    try {
      await toggleDepartmentSkipEvaluation(id, !current);
      msg(!current ? "評価対象外に設定しました" : "評価対象に戻しました");
    } catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!addingGroup) return;
    try { await createGroup(addingGroup.sec_id, addingGroup.name); setAddingGroup(null); msg("グループを追加しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleRenameGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;
    try { await renameGroup(editingGroup.id, editingGroup.name); setEditingGroup(null); msg("グループ名を変更しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  async function handleDeleteGroup(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？\n（所属ユーザーがいる場合は削除できません）`)) return;
    try { await deleteGroup(id); msg("グループを削除しました"); }
    catch (e: unknown) { msg(e instanceof Error ? e.message : "エラー", false); }
  }

  return (
    <div className="space-y-5">
      {/* フラッシュメッセージ */}
      {message && (
        <div className={`text-sm px-4 py-2 rounded ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* 部追加フォーム */}
      <form onSubmit={handleCreateDept} className="flex gap-2">
        <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
          placeholder="新しい部の名前" required
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <button type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          部を追加
        </button>
      </form>

      {/* 部一覧 */}
      <div className="space-y-4">
        {departments.length === 0 && <p className="text-sm text-gray-400">部署が登録されていません</p>}
        {departments.map((dept) => (
          <div key={dept.id} className="bg-white rounded-lg border p-4">

            {/* 部ヘッダー */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-bold text-gray-800">🏢</span>
              {editingDept?.id === dept.id ? (
                <form onSubmit={handleRenameDept} className="flex gap-2 flex-1">
                  <input value={editingDept.name}
                    onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                    required autoFocus
                    className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">保存</button>
                  <button type="button" onClick={() => setEditingDept(null)} className="px-3 py-1 border rounded text-xs hover:bg-gray-50">取消</button>
                </form>
              ) : (
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <span className="font-bold text-gray-800">{dept.name}</span>
                  <button
                    onClick={() => handleToggleSkipDirector(dept.id, dept.skip_director)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors
                      ${dept.skip_director
                        ? "bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200"
                        : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"}`}>
                    {dept.skip_director ? "課長→社長（部長スキップ）" : "通常フロー"}
                  </button>
                  <button
                    onClick={() => handleToggleSkipEvaluation(dept.id, dept.skip_evaluation)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors
                      ${dept.skip_evaluation
                        ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                        : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"}`}>
                    {dept.skip_evaluation ? "評価対象外" : "評価対象"}
                  </button>
                  <button onClick={() => setEditingDept({ id: dept.id, name: dept.name })}
                    className="text-xs text-gray-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50">
                    ✏️ 名前変更
                  </button>
                  <button onClick={() => handleDeleteDept(dept.id, dept.name)}
                    className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50">
                    🗑 削除
                  </button>
                  <button onClick={() => setAddingSection({ dept_id: dept.id, name: "" })}
                    className="ml-auto text-xs text-gray-600 border px-2 py-1 rounded hover:bg-gray-50">
                    + 課を追加
                  </button>
                </div>
              )}
            </div>

            {/* 課追加フォーム */}
            {addingSection?.dept_id === dept.id && (
              <form onSubmit={handleCreateSection} className="flex gap-2 mb-3 ml-6">
                <input value={addingSection.name}
                  onChange={(e) => setAddingSection({ ...addingSection, name: e.target.value })}
                  placeholder="課名" required
                  className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">追加</button>
                <button type="button" onClick={() => setAddingSection(null)} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">取消</button>
              </form>
            )}

            {/* 課一覧 */}
            <div className="space-y-2 ml-6">
              {dept.sections.length === 0 && <p className="text-xs text-gray-400">課なし</p>}
              {dept.sections.map((sec) => (
                <div key={sec.id} className="border-l-2 border-gray-200 pl-3 py-1">

                  {/* 課ヘッダー */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">📂</span>
                    {editingSection?.id === sec.id ? (
                      <form onSubmit={handleRenameSection} className="flex gap-2 flex-1">
                        <input value={editingSection.name}
                          onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                          required autoFocus
                          className="flex-1 border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button type="submit" className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">保存</button>
                        <button type="button" onClick={() => setEditingSection(null)} className="px-2 py-0.5 border rounded text-xs hover:bg-gray-50">取消</button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-700">{sec.name}</span>

                        {/* リーダー評価トグル */}
                        <button
                          onClick={() => handleToggleSectionLeader(sec.id, sec.has_leader)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors
                            ${sec.has_leader
                              ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                              : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"}`}>
                          {sec.has_leader ? "リーダー評価あり" : "リーダー評価なし"}
                        </button>

                        <button onClick={() => setEditingSection({ id: sec.id, name: sec.name })}
                          className="text-xs text-gray-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50">
                          ✏️ 名前変更
                        </button>
                        <button onClick={() => handleDeleteSection(sec.id, sec.name)}
                          className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50">
                          🗑 削除
                        </button>
                        {sec.has_leader && (
                          <button onClick={() => setAddingGroup({ sec_id: sec.id, name: "" })}
                            className="ml-auto text-xs text-gray-500 border px-2 py-0.5 rounded hover:bg-gray-50">
                            + グループ追加
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* グループ追加フォーム */}
                  {addingGroup?.sec_id === sec.id && (
                    <form onSubmit={handleCreateGroup} className="flex gap-2 mb-2 ml-4">
                      <input value={addingGroup.name}
                        onChange={(e) => setAddingGroup({ ...addingGroup, name: e.target.value })}
                        placeholder="グループ名" required
                        className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <button type="submit" className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">追加</button>
                      <button type="button" onClick={() => setAddingGroup(null)} className="px-2 py-1 border rounded text-xs hover:bg-gray-50">取消</button>
                    </form>
                  )}

                  {/* グループ一覧 */}
                  <div className="flex flex-wrap gap-1.5 ml-4">
                    {sec.groups.length === 0 && <span className="text-xs text-gray-400">グループなし</span>}
                    {sec.groups.map((g) => (
                      <div key={g.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                        {editingGroup?.id === g.id ? (
                          <form onSubmit={handleRenameGroup} className="flex gap-1 items-center">
                            <input value={editingGroup.name}
                              onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                              required autoFocus
                              className="border rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            <button type="submit" className="text-blue-700 hover:text-blue-900 font-bold">✓</button>
                            <button type="button" onClick={() => setEditingGroup(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                          </form>
                        ) : (
                          <>
                            <span>👥 {g.name}</span>
                            <button onClick={() => setEditingGroup({ id: g.id, name: g.name })}
                              className="text-blue-400 hover:text-blue-700 ml-0.5" title="名前変更">✏️</button>
                            <button onClick={() => handleDeleteGroup(g.id, g.name)}
                              className="text-blue-300 hover:text-red-500" title="削除">✕</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

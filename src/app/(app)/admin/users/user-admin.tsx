"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getFacetedRowModel, getFacetedUniqueValues,
  flexRender, type ColumnDef, type SortingState, type ColumnFiltersState,
  type FilterFn, type Column,
} from "@tanstack/react-table";
import { createUser, updateUser, deleteUser, importUsersFromCsv } from "@/server/admin";
import { ROLE_LABELS } from "@/lib/constants";

const NONE_SELECTED = "__none__";

const multiSelectFilter: FilterFn<User> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  if (filterValue[0] === NONE_SELECTED) return false;
  return filterValue.includes(String(row.getValue(columnId) ?? ""));
};
multiSelectFilter.autoRemove = (val: string[]) => !val || val.length === 0;

function FacetedFilter({ column, title }: { column: Column<User, unknown>; title: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const uniqueValues = useMemo(
    () => Array.from(column.getFacetedUniqueValues().keys()).filter((v) => v !== "").sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [column.getFacetedUniqueValues()]
  );
  const filtered = useMemo(
    () => uniqueValues.filter((v) => String(v).toLowerCase().includes(search.toLowerCase())),
    [uniqueValues, search]
  );
  const filterValue = (column.getFilterValue() as string[]) ?? [];
  const isAllSelected = filterValue.length === 0;
  const isNoneSelected = filterValue.length === 1 && filterValue[0] === NONE_SELECTED;
  const isFiltered = !isAllSelected;

  function isChecked(val: string) {
    if (isAllSelected) return true;
    if (isNoneSelected) return false;
    return filterValue.includes(val);
  }
  function toggleAll() {
    column.setFilterValue(isAllSelected ? [NONE_SELECTED] : []);
    setSearch("");
  }
  function toggleValue(val: string) {
    const current = isAllSelected ? uniqueValues.map(String) : isNoneSelected ? [] : filterValue;
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    if (next.length === 0) column.setFilterValue([NONE_SELECTED]);
    else if (next.length === uniqueValues.length) column.setFilterValue([]);
    else column.setFilterValue(next);
  }

  const sortDir = column.getIsSorted();

  return (
    <div ref={ref} className="relative inline-block">
      <div className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-1 rounded w-full
        ${isFiltered ? "text-blue-700 bg-blue-50" : "text-gray-600"}`}>
        <button
          onClick={() => column.toggleSorting(sortDir === "asc")}
          className="flex items-center gap-1 hover:text-blue-700 flex-1 min-w-0"
        >
          <span className="truncate">{title}</span>
          <span className="text-gray-400 shrink-0">
            {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "⇅"}
          </span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 px-0.5 hover:text-blue-600 ${isFiltered ? "text-blue-600" : "text-gray-400"}`}
          title="絞り込み"
        >
          ☰
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-44 max-w-56 p-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="検索..."
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs border-b border-gray-100 mb-1 pb-2">
              <input type="checkbox" checked={isAllSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-blue-600" />
              <span className="font-medium text-gray-700">（すべて選択）</span>
            </label>
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-1.5 py-1">該当なし</p>}
            {filtered.map((val) => (
              <label key={String(val)} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs">
                <input type="checkbox" checked={isChecked(String(val))} onChange={() => toggleValue(String(val))} className="w-3.5 h-3.5 accent-blue-600" />
                <span className="text-gray-700 truncate">{String(val) || "（空白）"}</span>
              </label>
            ))}
          </div>
          {isFiltered && (
            <button onClick={toggleAll} className="mt-2 w-full text-xs text-blue-600 hover:underline text-left px-1.5">
              フィルターをクリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Group = { id: string; name: string };
type Section = { id: string; name: string; has_leader: boolean; groups: Group[] };
type Department = { id: string; name: string; sections: Section[] };
type User = {
  id: string; employee_number: string | null; login_id: string; name: string; role: string;
  is_active: boolean; employee_type: string | null; can_view_evaluations: boolean;
  hire_date: Date | null; resign_date: Date | null;
  department: Department | null;
  section: Section | null;
  group: Group | null;
  [key: string]: unknown;
};

const ROLES = ["STAFF", "LEADER", "MANAGER", "DIRECTOR", "EXECUTIVE", "PRESIDENT", "ADMIN"] as const;
const EMPLOYEE_TYPES = ["柿原工業", "柿原技研", "実習生"] as const;

const CSV_HEADERS = ["社員番号", "ログインID", "氏名", "パスワード", "ロール", "部署名", "課名", "グループ名", "社員種別", "状態"];

function downloadCsvTemplate() {
  const bom = "﻿";
  const header = CSV_HEADERS.join(",");
  const example = ["001", "user001", "山田太郎", "password123", "STAFF", "営業部", "第一営業課", "Aグループ", "柿原工業", "有効"].join(",");
  const content = bom + header + "\n" + example + "\n";
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "社員インポートテンプレート.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function UserAdmin({ users, departments }: { users: User[]; departments: Department[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "employee_number", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [importResult, setImportResult] = useState<{ row: number; login_id: string; status: string; error?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    employee_number: "", login_id: "", name: "", password: "", role: "STAFF",
    department_id: "", section_id: "", group_id: "", is_active: true, employee_type: "",
    can_view_evaluations: false, hire_date: "", resign_date: "",
  });

  const isDirector = form.role === "DIRECTOR";
  const isManagerOrAbove = ["MANAGER", "DIRECTOR", "PRESIDENT", "ADMIN"].includes(form.role);
  const selectedDept = departments.find((d) => d.id === form.department_id);
  const isSkc = selectedDept?.name === "SKC";
  const sections = departments.find((d) => d.id === form.department_id)?.sections ?? [];
  const selectedSection = sections.find((s) => s.id === form.section_id);
  const sectionHasLeader = selectedSection?.has_leader ?? false;
  const groups = (!isManagerOrAbove && sectionHasLeader) ? (selectedSection?.groups ?? []) : [];

  function openNew() {
    setForm({ employee_number: "", login_id: "", name: "", password: "", role: "STAFF", department_id: "", section_id: "", group_id: "", is_active: true, employee_type: "", can_view_evaluations: false, hire_date: "", resign_date: "" });
    setFormError("");
    setEditUser(null);
    setShowForm(true);
  }

  function openEdit(u: User) {
    setFormError("");
    setForm({
      employee_number: u.employee_number ?? "",
      login_id: u.login_id, name: u.name, password: "", role: u.role,
      department_id: u.department?.id ?? "",
      section_id: u.section?.id ?? "",
      group_id: u.group?.id ?? "",
      is_active: u.is_active,
      employee_type: u.employee_type ?? "",
      can_view_evaluations: u.can_view_evaluations ?? false,
      hire_date: u.hire_date ? new Date(u.hire_date).toISOString().slice(0, 10) : "",
      resign_date: u.resign_date ? new Date(u.resign_date).toISOString().slice(0, 10) : "",
    });
    setEditUser(u);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setFormError("");
    try {
      if (editUser) {
        await updateUser(editUser.id, {
          employee_number: form.employee_number || undefined,
          name: form.name, role: form.role as "STAFF",
          department_id: form.department_id || undefined,
          section_id: form.section_id || undefined,
          group_id: form.group_id || undefined,
          is_active: form.is_active,
          password: form.password || undefined,
          employee_type: form.employee_type || undefined,
          can_view_evaluations: form.can_view_evaluations,
          hire_date: form.hire_date || undefined,
          resign_date: form.resign_date || undefined,
        });
        setMessage("更新しました");
      } else {
        if (!form.password) { setMessage("新規登録時はパスワードが必須です"); return; }
        await createUser({
          employee_number: form.employee_number || undefined,
          login_id: form.login_id, name: form.name, password: form.password,
          role: form.role as "STAFF",
          department_id: form.department_id || undefined,
          section_id: form.section_id || undefined,
          group_id: form.group_id || undefined,
          employee_type: form.employee_type || undefined,
          hire_date: form.hire_date || undefined,
          resign_date: form.resign_date || undefined,
        });
        setMessage("登録しました");
      }
      setShowForm(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "エラーが発生しました";
      setMessage(msg);
      setFormError(msg);
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(`${u.name} を削除しますか？`)) return;
    try {
      await deleteUser(u.id);
      setMessage("削除しました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    const dataLines = lines.slice(1); // ヘッダー除外
    const rows = dataLines.map((line) => {
      const cols = line.split(",");
      return {
        employee_number: cols[0]?.trim() ?? "",
        login_id: cols[1]?.trim() ?? "",
        name: cols[2]?.trim() ?? "",
        password: cols[3]?.trim() ?? "",
        role: cols[4]?.trim() ?? "STAFF",
        department_name: cols[5]?.trim() ?? "",
        section_name: cols[6]?.trim() ?? "",
        group_name: cols[7]?.trim() ?? "",
        employee_type: cols[8]?.trim() ?? "",
        is_active: cols[9]?.trim() ?? "",
      };
    }).filter((r) => r.employee_number);

    try {
      const results = await importUsersFromCsv(rows);
      setImportResult(results);
      setMessage(`インポート完了: ${results.filter((r) => r.status !== "エラー").length}件成功、${results.filter((r) => r.status === "エラー").length}件エラー`);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "インポートに失敗しました");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const filterableCols = ["employee_number", "name", "login_id", "role", "department", "section", "group", "employee_type", "is_active"];

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: "employee_number",
      header: "社員番号",
      cell: (info) => info.getValue() ?? "-",
      filterFn: multiSelectFilter,
    },
    {
      accessorKey: "name",
      header: "氏名",
      filterFn: multiSelectFilter,
    },
    {
      accessorKey: "login_id",
      header: "ログインID",
      filterFn: multiSelectFilter,
    },
    {
      id: "role",
      accessorFn: (row) => ROLE_LABELS[row.role] ?? row.role,
      header: "ロール",
      filterFn: multiSelectFilter,
    },
    {
      id: "department",
      accessorFn: (row) => row.department?.name ?? "",
      header: "部署",
      filterFn: multiSelectFilter,
    },
    {
      id: "section",
      accessorFn: (row) => row.section?.name ?? "",
      header: "課",
      filterFn: multiSelectFilter,
    },
    {
      id: "group",
      accessorFn: (row) => row.group?.name ?? "",
      header: "グループ",
      filterFn: multiSelectFilter,
    },
    {
      id: "employee_type",
      accessorFn: (row) => row.employee_type ?? "",
      header: "社員種別",
      filterFn: multiSelectFilter,
    },
    {
      id: "is_active",
      accessorFn: (row) => row.is_active ? "有効" : "無効",
      header: "状態",
      filterFn: multiSelectFilter,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row.original)} className="text-xs text-blue-600 hover:underline">編集</button>
          <button onClick={() => handleDelete(row.original)} className="text-xs text-red-500 hover:underline">削除</button>
        </div>
      ),
    },
  ], []);

  const table = useReactTable({
    data: users,
    columns,
    filterFns: { multiSelectFilter },
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div>
      {message && <p className={`mb-4 text-sm ${message.includes("エラー") || message.includes("失敗") ? "text-red-500" : "text-green-600"}`}>{message}</p>}

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
          + 新規登録
        </button>
        <button onClick={downloadCsvTemplate} className="px-4 py-2 border border-gray-400 text-gray-600 rounded text-sm hover:bg-gray-50">
          CSVテンプレートDL
        </button>
        <label className="px-4 py-2 border border-green-600 text-green-600 rounded text-sm cursor-pointer hover:bg-green-50">
          CSVインポート
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
        </label>
      </div>

      {importResult.length > 0 && (
        <div className="mb-4 bg-gray-50 border rounded p-3 text-xs max-h-40 overflow-y-auto">
          {importResult.map((r) => (
            <div key={r.row} className={r.status === "エラー" ? "text-red-500" : "text-gray-700"}>
              行{r.row} [{r.login_id}] → {r.status}{r.error ? `（${r.error}）` : ""}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-x-auto" style={{ minHeight: "420px" }}>
        <table className="w-full text-sm min-w-max">
          <thead className="bg-gray-50 border-b">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canFilter = filterableCols.includes(header.id);
                  const canSort = header.column.getCanSort();
                  return (
                    <th key={header.id}
                      className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">
                      {canFilter ? (
                        <FacetedFilter
                          column={header.column}
                          title={header.column.columnDef.header as string}
                        />
                      ) : (
                        <div
                          className={`flex items-center gap-1 px-1 ${canSort ? "cursor-pointer select-none hover:text-blue-700" : ""}`}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" && " ▲"}
                          {header.column.getIsSorted() === "desc" && " ▼"}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={`border-b last:border-0 hover:bg-gray-50 ${!row.original.is_active ? "opacity-50" : ""}`}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-3 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center py-8 text-gray-400 text-sm">該当する社員がいません</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-1">{table.getFilteredRowModel().rows.length} 件表示</p>

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl max-h-screen overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">{editUser ? "社員編集" : "社員登録"}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">社員番号</label>
                  <input value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm" placeholder="例: 001" />
                </div>
                {!editUser && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ログインID *</label>
                    <input value={form.login_id} onChange={(e) => setForm({ ...form, login_id: e.target.value })}
                      required className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">パスワード {editUser ? "（変更時のみ）" : "*"}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">社員種別</label>
                <select value={form.employee_type}
                  onChange={(e) => setForm({ ...form, employee_type: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">（未設定）</option>
                  {EMPLOYEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">入社年月日</label>
                  <input type="date" value={form.hire_date}
                    onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">退社年月日</label>
                  <input type="date" value={form.resign_date}
                    onChange={(e) => setForm({ ...form, resign_date: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-400 mt-0.5">在籍中は空欄</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ロール</label>
                <select value={form.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    // 部長は課・グループを持たない
                    setForm({ ...form, role: newRole, section_id: newRole === "DIRECTOR" ? "" : form.section_id, group_id: newRole === "DIRECTOR" ? "" : form.group_id });
                  }}
                  className="w-full border rounded px-3 py-2 text-sm">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">部署</label>
                <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value, section_id: "", group_id: "" })}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">（なし）</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {!isDirector && sections.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">課</label>
                  <select value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value, group_id: "" })}
                    className="w-full border rounded px-3 py-2 text-sm">
                    <option value="">（なし）</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {!isDirector && sectionHasLeader && groups.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">グループ</label>
                  <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm">
                    <option value="">（なし）</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              {!isDirector && form.section_id && !sectionHasLeader && (
                <p className="text-xs text-gray-400">※ この課はリーダー評価なしのためグループ設定はありません</p>
              )}
              {editUser && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  <label htmlFor="is_active" className="text-xs text-gray-700">有効</label>
                </div>
              )}
              {!isSkc && form.department_id && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="can_view_evaluations" checked={form.can_view_evaluations}
                    onChange={(e) => setForm({ ...form, can_view_evaluations: e.target.checked })} />
                  <label htmlFor="can_view_evaluations" className="text-xs text-gray-700">
                    部長評価画面を閲覧可（閲覧専用）
                  </label>
                </div>
              )}
              {formError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700">
                  {editUser ? "更新" : "登録"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded text-sm font-medium hover:bg-gray-50">
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

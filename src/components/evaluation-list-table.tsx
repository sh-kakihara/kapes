"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table";
import { EVALUATION_ITEMS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

const NONE_SELECTED = "__none__";

const multiSelectFilter: FilterFn<RowData> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  if (filterValue[0] === NONE_SELECTED) return false;
  return filterValue.includes(String(row.getValue(columnId)));
};
multiSelectFilter.autoRemove = (val: string[]) => !val || val.length === 0;

type Employee = {
  id: string;
  employee_number: string | null;
  name: string;
  role: string;
  department: { name: string; skip_director?: boolean } | null;
  section: { name: string; has_leader?: boolean } | null;
  group: { name: string } | null;
  hasManager?: boolean;
};

type Score = { item_code: string; evaluator: string; score: number | null; comment?: string | null };

export type EvalListItem = {
  evalId: string | null;
  employee: Employee;
  status: string | null;
  scores: Score[];
};

type RowData = {
  evalId: string | null;
  employeeId: string;
  status: string;
  employee_number: string;
  name: string;
  department: string;
  section: string;
  group: string;
  total: number | null;
  diff: number | null;
  isSelf: boolean;
} & Record<string, number | string | boolean | null>;

const columnHelper = createColumnHelper<RowData>();

const EVALUATOR_LABELS: Record<string, string> = {
  self: "自己評価",
  leader: "リーダー評価",
  manager: "課長評価",
  director: "部長評価",
};

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (!sorted) return <span className="text-gray-300 ml-1 text-xs">↕</span>;
  return <span className="text-blue-600 ml-1 text-xs">{sorted === "asc" ? "↑" : "↓"}</span>;
}

function FacetedFilter({
  column,
  title,
}: {
  column: import("@tanstack/react-table").Column<RowData, unknown>;
  title: string;
}) {
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
    if (isAllSelected) {
      column.setFilterValue([NONE_SELECTED]); // 全解除
    } else {
      column.setFilterValue([]); // 全選択
    }
    setSearch("");
  }
  function toggleValue(val: string) {
    const current = isAllSelected ? uniqueValues.map(String) : isNoneSelected ? [] : filterValue;
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    if (next.length === 0) {
      column.setFilterValue([NONE_SELECTED]);
    } else if (next.length === uniqueValues.length) {
      column.setFilterValue([]);
    } else {
      column.setFilterValue(next);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-left text-xs font-medium px-1.5 py-1 rounded hover:bg-gray-100 transition-colors w-full
          ${isFiltered ? "text-blue-700 bg-blue-50" : "text-gray-600"}`}
      >
        <span className="truncate">{title}</span>
        <span className={`ml-auto text-xs ${isFiltered ? "text-blue-600" : "text-gray-400"}`}>▼</span>
      </button>
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
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleAll}
                className="w-3.5 h-3.5 accent-blue-600"
              />
              <span className="font-medium text-gray-700">（すべて選択）</span>
            </label>
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-1.5 py-1">該当なし</p>}
            {filtered.map((val) => (
              <label
                key={String(val)}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={isChecked(String(val))}
                  onChange={() => toggleValue(String(val))}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-gray-700 truncate">{val || "（空白）"}</span>
              </label>
            ))}
          </div>
          {isFiltered && (
            <button
              onClick={toggleAll}
              className="mt-2 w-full text-xs text-blue-600 hover:underline text-left px-1.5"
            >
              フィルターをクリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvaluationListTable({
  items,
  detailBasePath,
  scoreEvaluator,
  scoreOptions,
  selfUserId,
  hideForEvaluator,
  selfHidesForEvaluator,
  showSelfForRoles,
  popupColumns,
  hideWithoutGroupForEvaluator,
  diffColumn,
  detailButtonLabel = "評価入力へ",
}: {
  items: EvalListItem[];
  detailBasePath: string;
  scoreEvaluator: string;
  scoreOptions?: { value: string; label: string }[];
  selfUserId?: string;
  /** この evaluator 選択中は selfUserId 行を非表示にする */
  hideForEvaluator?: string | string[];
  /** この evaluator 選択中は selfUserId 行のスコアを「—」にする */
  selfHidesForEvaluator?: string;
  showSelfForRoles?: { evaluator: string; role: string }[];
  /**
   * ポップアップモーダルに表示する列定義。
   * roleOverride: employee.role が一致する場合 "self" evaluator を使用。
   * showForRoles: 指定ロールの社員にのみ列を表示（未指定=全員）。
   */
  popupColumns?: {
    key: string;
    label: string;
    color: string;
    roleOverride?: string;
    showForRoles?: string[];
    /** true のとき、グループ所属の社員行ではこの列を非表示 */
    hideIfHasGroup?: boolean;
    /** true のとき、リーダー評価のない課の社員行ではこの列を非表示 */
    hideIfSectionNoLeader?: boolean;
  }[];
  /** この evaluator 選択中はグループ未所属の社員行を一覧から非表示 */
  hideWithoutGroupForEvaluator?: string;
  /** 合計〜ステータス間に差分列を表示（指定 evaluator 選択時のみ） */
  diffColumn?: { evaluatorA: string; evaluatorB: string; label: string; showForEvaluator: string };
  /** ポップアップのボタンラベル（デフォルト: "評価入力へ"） */
  detailButtonLabel?: string;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedItem, setSelectedItem] = useState<EvalListItem | null>(null);
  const [selectedEvaluator, setSelectedEvaluator] = useState(scoreEvaluator);

  const data = useMemo<RowData[]>(() =>
    items.flatMap((item) => {
      const isSelf = item.employee.id === selfUserId;

      // hideForEvaluator: 自分行を非表示
      const hideEvs = Array.isArray(hideForEvaluator) ? hideForEvaluator : hideForEvaluator ? [hideForEvaluator] : [];
      if (isSelf && hideEvs.includes(selectedEvaluator)) return [];
      // hideWithoutGroupForEvaluator: グループ未所属行を非表示
      if (hideWithoutGroupForEvaluator && selectedEvaluator === hideWithoutGroupForEvaluator && !item.employee.group) return [];

      // 使用する evaluator を決定
      let ev: string;
      if (isSelf) {
        // selfHidesForEvaluator: 自分行は存在しないキーで全スコアを null に
        ev = (selfHidesForEvaluator && selectedEvaluator === selfHidesForEvaluator)
          ? "__null__"
          : "self";
      } else if (showSelfForRoles?.some((r) => r.evaluator === selectedEvaluator && r.role === item.employee.role)) {
        // 指定ロールの社員はそのevaluator選択時に自己評価を表示
        ev = "self";
      } else {
        ev = selectedEvaluator;
      }

      const row: Record<string, number | string | boolean | null> = {
        evalId: item.evalId,
        employeeId: item.employee.id,
        status: STATUS_LABELS[item.status ?? "NO_EVAL"] ?? item.status ?? "",
        employee_number: item.employee.employee_number ?? "",
        name: item.employee.name.length > 10 ? item.employee.name.slice(0, 10) : item.employee.name,
        department: item.employee.department?.name ?? "",
        section: item.employee.section?.name ?? "",
        group: item.employee.group?.name ?? "",
        isSelf,
        total: 0,
        diff: null,
      };
      // skip_director の部署で部長評価がない場合は課長評価を代替使用
      const skipDirector = item.employee.department?.skip_director ?? false;
      const noManager = item.employee.hasManager === false;
      let effectiveEv = ev;
      if (ev === "director" && skipDirector && !item.scores.some((s) => s.evaluator === "director" && s.score !== null)) {
        effectiveEv = "manager";
      }
      // 課長不在で課長評価選択時は自己評価を代替表示
      if (effectiveEv === "manager" && noManager && !item.scores.some((s) => s.evaluator === "manager" && s.score !== null)) {
        effectiveEv = "self";
      }

      let total = 0;
      for (const evItem of EVALUATION_ITEMS) {
        const s = item.scores.find((x) => x.item_code === evItem.code && x.evaluator === effectiveEv);
        const score = s?.score ?? null;
        row[evItem.code] = score;
        if (score !== null) total += score;
      }
      const hasAnyScore = item.scores.some((s) => s.evaluator === effectiveEv && s.score !== null);
      row.total = hasAnyScore ? total : null;

      // 差分列用の計算（常に全evaluatorのデータから計算）
      if (diffColumn) {
        const totalA = item.scores.filter((s) => s.evaluator === diffColumn.evaluatorA).reduce((sum, s) => sum + (s.score ?? 0), 0);
        const totalB = item.scores.filter((s) => s.evaluator === diffColumn.evaluatorB).reduce((sum, s) => sum + (s.score ?? 0), 0);
        const hasA = item.scores.some((s) => s.evaluator === diffColumn.evaluatorA && s.score !== null);
        const hasB = item.scores.some((s) => s.evaluator === diffColumn.evaluatorB && s.score !== null);
        row.diff = (hasA && hasB) ? totalA - totalB : null;
      }
      return [row as RowData];
    }),
    [items, selectedEvaluator, selfUserId, hideForEvaluator, selfHidesForEvaluator, showSelfForRoles, hideWithoutGroupForEvaluator, diffColumn]
  );

  const filterableCols = ["employee_number", "name", "department", "section", "group", "status"];

  const columns = useMemo(() => [
    columnHelper.accessor("employee_number", { header: "社員番号", filterFn: multiSelectFilter }),
    columnHelper.accessor("name", {
      header: "名前",
      filterFn: multiSelectFilter,
      cell: (info) => {
        const isSelf = info.row.original.isSelf as boolean;
        return (
          <span className={`font-medium ${isSelf ? "text-orange-600" : ""}`}>
            {info.getValue()}
            {isSelf && <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1 rounded">本人</span>}
          </span>
        );
      },
    }),
    columnHelper.accessor("department", { header: "部", filterFn: multiSelectFilter }),
    columnHelper.accessor("section", { header: "課", filterFn: multiSelectFilter }),
    columnHelper.accessor("group", { header: "グループ", filterFn: multiSelectFilter }),
    ...EVALUATION_ITEMS.map((item, idx) =>
      columnHelper.accessor(item.code as keyof RowData, {
        id: item.code,
        header: () => (
          <span className="text-xs font-semibold text-gray-500" title={item.label}>
            {idx + 1}
          </span>
        ),
        cell: (info) => {
          const v = info.getValue() as number | null;
          return (
            <span className={v !== null && v > 0 ? "font-medium text-blue-700" : "text-gray-300"}>
              {v !== null ? v : "—"}
            </span>
          );
        },
      })
    ),
    columnHelper.accessor("total", {
      header: "合計",
      cell: (info) => {
        const v = info.getValue() as number | null;
        return (
          <span className={v !== null ? "font-bold text-blue-800" : "text-gray-300"}>
            {v !== null ? v : "—"}
          </span>
        );
      },
    }),
    ...(diffColumn && selectedEvaluator === diffColumn.showForEvaluator
      ? [columnHelper.accessor("diff" as keyof RowData, {
          id: "diff",
          header: () => <div className="text-xs font-semibold text-gray-600">{diffColumn.label}</div>,
          cell: (info) => {
            const v = info.getValue() as number | null;
            if (v === null) return <span className="text-gray-300">—</span>;
            return (
              <span className={`inline-block font-bold px-1.5 py-0.5 rounded text-xs ${
                v > 0 ? "bg-green-100 text-green-800" : v < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
              }`}>
                {v > 0 ? `+${v}` : `${v}`}
              </span>
            );
          },
        })]
      : []),
    columnHelper.accessor("status", {
      header: "ステータス",
      filterFn: multiSelectFilter,
      cell: (info) => {
        const label = info.getValue() as string;
        const statusKey = Object.keys(STATUS_LABELS).find((k) => STATUS_LABELS[k] === label) ?? "";
        const color = STATUS_COLORS[statusKey] ?? "bg-gray-100 text-gray-500";
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${color}`}>
            {label}
          </span>
        );
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedEvaluator, selfUserId, diffColumn]);

  const table = useReactTable({
    data,
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

  function handleExport() {
    const evaluatorLabel = scoreOptions?.find((o) => o.value === selectedEvaluator)?.label ?? selectedEvaluator;
    const filteredRows = table.getFilteredRowModel().rows;

    const headers = [
      "社員番号", "名前", "部", "課", "グループ",
      ...EVALUATION_ITEMS.flatMap((item, idx) => [
        `${idx + 1}.${item.label}_点数`,
        `${idx + 1}.${item.label}_コメント`,
      ]),
      "合計",
      "ステータス",
    ];

    const csvRows = filteredRows.map((row) => {
      const item = items.find(
        (i) => (i.employee.employee_number ?? "") === row.original.employee_number &&
                i.employee.name.slice(0, 10) === row.original.name
      );

      const isSelf = item?.employee.id === selfUserId;
      let ev = selectedEvaluator;
      if (isSelf) {
        ev = selfHidesForEvaluator && selectedEvaluator === selfHidesForEvaluator ? "__null__" : "self";
      } else if (showSelfForRoles?.some((r) => r.evaluator === selectedEvaluator && r.role === item?.employee.role)) {
        ev = "self";
      }
      const skipDirector = item?.employee.department?.skip_director ?? false;
      const noManager = item?.employee.hasManager === false;
      if (ev === "director" && skipDirector && !item?.scores.some((s) => s.evaluator === "director" && s.score !== null)) ev = "manager";
      if (ev === "manager" && noManager && !item?.scores.some((s) => s.evaluator === "manager" && s.score !== null)) ev = "self";

      const scoreCommentCols = EVALUATION_ITEMS.flatMap((evalItem) => {
        const s = item?.scores.find((x) => x.item_code === evalItem.code && x.evaluator === ev);
        return [s?.score != null ? String(s.score) : "", s?.comment ?? ""];
      });

      return [
        row.original.employee_number,
        item?.employee.name ?? row.original.name,
        row.original.department,
        row.original.section,
        row.original.group,
        ...scoreCommentCols,
        row.original.total != null ? String(row.original.total) : "",
        row.original.status,
      ];
    });

    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `評価一覧_${evaluatorLabel}_${new Date().toLocaleDateString("ja-JP").replace(/\//g, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {(scoreOptions && scoreOptions.length > 1) || true ? (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {scoreOptions && scoreOptions.length > 1 && (
            <>
              <label className="text-sm font-medium text-gray-600">表示する点数：</label>
              <select
                value={selectedEvaluator}
                onChange={(e) => setSelectedEvaluator(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {scoreOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="ml-auto px-4 py-1.5 text-sm border border-green-600 text-green-700 rounded hover:bg-green-50 font-medium"
          >
            CSVエクスポート
          </button>
        </div>
      ) : null}
      <div className="rounded-lg border bg-white min-h-64">
        <table className="text-sm w-full table-fixed">
          <thead className="bg-gray-50 border-b">
            <tr>
              {table.getFlatHeaders().map((header) => {
                const canFilter = filterableCols.includes(header.id);
                const canSort = header.column.getCanSort();
                return (
                  <th
                key={header.id}
                className={`py-2 text-left whitespace-nowrap border-r border-gray-200 last:border-r-0 ${
                  EVALUATION_ITEMS.some((i) => i.code === header.id)
                    ? "px-1 w-7 text-center"
                    : header.id === "employee_number" ? "px-2 w-20"
                    : header.id === "name" ? "px-2 w-24"
                    : header.id === "department" ? "px-2 w-20"
                    : header.id === "section" ? "px-2 w-20"
                    : header.id === "group" ? "px-2 w-16"
                    : header.id === "total" ? "px-2 w-14 text-center"
                    : header.id === "diff" ? "px-2 w-14 text-center"
                    : header.id === "status" ? "px-2 w-24"
                    : "px-2"
                }`}
              >
                    {canFilter ? (
                      <FacetedFilter
                        column={header.column}
                        title={String(
                          typeof header.column.columnDef.header === "function"
                            ? header.id
                            : header.column.columnDef.header
                        )}
                      />
                    ) : (
                      <div
                        className={`flex items-center justify-center text-xs font-medium text-gray-600 ${canSort ? "cursor-pointer select-none hover:text-blue-700" : ""}`}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && <SortIcon sorted={header.column.getIsSorted()} />}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-gray-400">
                  該当するデータがありません
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const isSelfRow = row.original.isSelf as boolean;
                return (
                <tr
                  key={row.id}
                  onClick={isSelfRow ? undefined : () => {
                    const item = items.find(
                      (i) =>
                        i.employee.name === row.original.name &&
                        (i.employee.employee_number ?? "") === row.original.employee_number
                    );
                    if (item) setSelectedItem(item);
                  }}
                  className={`border-b last:border-0 transition-colors ${isSelfRow ? "bg-orange-50" : "hover:bg-blue-50 cursor-pointer"}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`py-2 whitespace-nowrap text-sm border-r border-gray-200 last:border-r-0 ${
                        EVALUATION_ITEMS.some((i) => i.code === cell.column.id)
                          ? "px-1 text-center"
                          : "px-2"
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        {table.getFilteredRowModel().rows.length} 件表示 / 全 {items.length} 件　※行をクリックすると詳細を表示します
      </p>

      {/* 詳細モーダル */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <div>
                <p className="font-bold text-lg text-gray-800">{selectedItem.employee.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedItem.employee.employee_number &&
                    `社員番号: ${selectedItem.employee.employee_number} ／ `}
                  {[
                    selectedItem.employee.department?.name,
                    selectedItem.employee.section?.name,
                    selectedItem.employee.group?.name,
                  ]
                    .filter(Boolean)
                    .join(" › ")}
                </p>
                <span
                  className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                    STATUS_COLORS[selectedItem.status ?? "NO_EVAL"] ?? "bg-gray-100 text-gray-500"
                  }`}
                >
                  {STATUS_LABELS[selectedItem.status ?? "NO_EVAL"] ?? selectedItem.status ?? ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {selectedItem.evalId && detailBasePath && (
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      router.push(`${detailBasePath}/${selectedItem.evalId}`);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    {detailButtonLabel}
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {selectedItem.evalId ? (
                (() => {
                  // 表示列を決定
                  type ColDef = { key: string; label: string; color: string; effectiveKey: string };
                  let cols: ColDef[];

                  if (popupColumns) {
                    const itemSkipDirector = selectedItem.employee.department?.skip_director ?? false;
                    const itemHasDirector = selectedItem.scores.some((s) => s.evaluator === "director" && s.score !== null);
                    const itemNoManager = selectedItem.employee.hasManager === false;
                    const itemHasManager = selectedItem.scores.some((s) => s.evaluator === "manager" && s.score !== null);
                    cols = popupColumns
                      .filter((c) => !c.showForRoles || c.showForRoles.includes(selectedItem.employee.role))
                      .filter((c) => !(c.hideIfHasGroup && selectedItem.employee.group !== null))
                      .filter((c) => !(c.hideIfSectionNoLeader && !selectedItem.employee.section?.has_leader))
                      .map((c) => {
                        let effectiveKey = (c.roleOverride && selectedItem.employee.role === c.roleOverride) ? "self" : c.key;
                        // skip_director 部署で部長評価なし → 課長評価を代替
                        if (effectiveKey === "director" && itemSkipDirector && !itemHasDirector) {
                          effectiveKey = "manager";
                        }
                        // 課長不在で課長評価なし → 自己評価を代替
                        if (effectiveKey === "manager" && itemNoManager && !itemHasManager) {
                          effectiveKey = "self";
                        }
                        return { key: c.key, label: c.label, color: c.color, effectiveKey };
                      });
                  } else {
                    // fallback: 旧 2 列ロジック
                    const isSelf = selectedItem.employee.id === selfUserId;
                    let ev: string;
                    if (isSelf) {
                      ev = (selfHidesForEvaluator && selectedEvaluator === selfHidesForEvaluator) ? "__null__" : "self";
                    } else if (showSelfForRoles?.some((r) => r.evaluator === selectedEvaluator && r.role === selectedItem.employee.role)) {
                      ev = "self";
                    } else {
                      ev = selectedEvaluator;
                    }
                    cols = ev === "self" || ev === "__null__"
                      ? [{ key: "self", label: isSelf ? "自己評価（本人）" : "自己評価", color: "text-blue-600", effectiveKey: ev }]
                      : [
                          { key: "self", label: "自己評価", color: "text-blue-600", effectiveKey: "self" },
                          { key: ev, label: EVALUATOR_LABELS[ev] ?? ev, color: "text-orange-600", effectiveKey: ev },
                        ];
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border rounded">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">項目</th>
                            {cols.map((c) => (
                              <th key={c.key} className={`text-center px-3 py-2 font-medium w-20 ${c.color}`}>
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {EVALUATION_ITEMS.map((item, idx) => (
                            <tr key={item.code} className="border-t">
                              <td className="px-3 py-2 text-gray-700 text-xs">
                                {idx + 1}. {item.label}
                              </td>
                              {cols.map((c) => {
                                const s = selectedItem.scores.find(
                                  (x) => x.item_code === item.code && x.evaluator === c.effectiveKey
                                );
                                return (
                                  <td key={c.key} className={`px-3 py-2 text-center font-bold ${c.color}`}>
                                    {s?.score ?? "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr className="border-t bg-gray-50 font-bold">
                            <td className="px-3 py-2 text-gray-700">合計</td>
                            {cols.map((c) => {
                              const total = selectedItem.scores
                                .filter((s) => s.evaluator === c.effectiveKey)
                                .reduce((sum, s) => sum + (s.score ?? 0), 0);
                              return (
                                <td key={c.key} className={`px-3 py-2 text-center ${c.color}`}>
                                  {total || "—"}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              ) : (
                <p className="text-center py-8 text-gray-400">まだ評価が開始されていません</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

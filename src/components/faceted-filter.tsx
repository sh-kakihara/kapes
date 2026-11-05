"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Column } from "@tanstack/react-table";

export const NONE_SELECTED = "__none__";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FacetedFilter({ column, title }: { column: Column<any, unknown>; title: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // ドロップダウンを開いたときの確定済みフィルタ値を保持（OK前は pending で管理）
  const [pending, setPending] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // 外クリックでキャンセル扱いで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ドロップダウンを開く際に現在の確定フィルタ値を pending にコピー
  function openDropdown() {
    const current = (column.getFilterValue() as string[]) ?? [];
    setPending(current);
    setSearch("");
    setOpen(true);
  }

  const uniqueValues = useMemo(
    () => column.getCanFilter() ? Array.from(column.getFacetedUniqueValues().keys()).filter((v) => v !== "").sort() : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [column.getFacetedUniqueValues()]
  );

  // 検索テキストで表示する選択肢を絞る（フィルタ適用はしない）
  const filtered = useMemo(
    () => uniqueValues.filter((v) => String(v).toLowerCase().includes(search.toLowerCase())),
    [uniqueValues, search]
  );

  const isAllSelected = pending.length === 0;
  const isNoneSelected = pending.length === 1 && pending[0] === NONE_SELECTED;
  const appliedFilter = (column.getFilterValue() as string[]) ?? [];
  const isFiltered = appliedFilter.length > 0;
  const sortDir = column.getIsSorted();

  function isChecked(val: string) {
    if (isAllSelected) return true;
    if (isNoneSelected) return false;
    return pending.includes(val);
  }

  function toggleAll() {
    setPending(isAllSelected ? [NONE_SELECTED] : []);
  }

  function toggleValue(val: string) {
    const current = isAllSelected ? uniqueValues.map(String) : isNoneSelected ? [] : pending;
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    if (next.length === 0) setPending([NONE_SELECTED]);
    else if (next.length === uniqueValues.length) setPending([]);
    else setPending(next);
  }

  function handleOk() {
    column.setFilterValue(pending.length === 0 ? [] : pending);
    setOpen(false);
    setSearch("");
  }

  function handleCancel() {
    setOpen(false);
    setSearch("");
  }

  function handleClear() {
    setPending([]);
  }

  return (
    <div ref={ref} className="relative inline-block w-full">
      <div className={`flex items-center gap-0.5 text-xs font-medium px-1 py-0.5 rounded w-full ${isFiltered ? "text-blue-700 bg-blue-50" : "text-gray-600"}`}>
        <button onClick={() => column.toggleSorting(sortDir === "asc")} className="flex items-center gap-1 hover:text-blue-700 flex-1 min-w-0">
          <span className="truncate">{title}</span>
          <span className="text-gray-400 shrink-0">{sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "⇅"}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); open ? handleCancel() : openDropdown(); }}
          className={`shrink-0 hover:text-blue-700 ${isFiltered ? "text-blue-600" : "text-gray-400"}`}
          title="フィルター"
        >
          {isFiltered ? "▼" : "▽"}
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-48 p-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="検索..."
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5 mb-2">
            <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs">
              <input type="checkbox" checked={isAllSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-blue-600" />
              <span className="text-gray-700 font-medium">（すべて選択）</span>
            </label>
            {filtered.map((val) => (
              <label key={String(val)} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs">
                <input type="checkbox" checked={isChecked(String(val))} onChange={() => toggleValue(String(val))} className="w-3.5 h-3.5 accent-blue-600" />
                <span className="text-gray-700 truncate">{String(val) || "（空白）"}</span>
              </label>
            ))}
          </div>
          {!isAllSelected && (
            <button onClick={handleClear} className="mb-2 w-full text-xs text-blue-600 hover:underline text-left px-1.5">
              フィルターをクリア
            </button>
          )}
          <div className="flex gap-1.5 pt-1 border-t border-gray-100">
            <button
              onClick={handleOk}
              className="flex-1 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              OK
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-1 text-xs font-medium border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { FacetedFilter as default };

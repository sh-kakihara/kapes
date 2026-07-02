"use client";

import { useRouter } from "next/navigation";

export default function PeriodSelect({ periods, selectedId }: {
  periods: { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selectedId}
      onChange={(e) => router.push(`/admin/evaluations?period=${e.target.value}`)}
      className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
    >
      {periods.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

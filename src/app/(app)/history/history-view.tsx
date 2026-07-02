"use client";

import { useState } from "react";
import { EVALUATION_ITEMS } from "@/lib/constants";

const EVALUATORS = [
  { key: "self", label: "自己評価", color: "text-blue-600" },
];

type Score = { item_code: string; evaluator: string; score: number | null; comment?: string | null };
type Evaluation = {
  id: string;
  scores: Score[];
  period: { id: string; name: string };
};

export default function HistoryView({ evaluations }: { evaluations: Evaluation[] }) {
  const [selectedId, setSelectedId] = useState(evaluations[0]?.id ?? "");

  const ev = evaluations.find((e) => e.id === selectedId) ?? evaluations[0];

  if (!ev) return <p className="text-center py-16 text-gray-400">評価履歴がありません</p>;

  const presentEvaluators = EVALUATORS.filter((e) =>
    ev.scores.some((s) => s.evaluator === e.key && s.score !== null)
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <label className="text-sm font-medium text-gray-600">評価期間：</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          {evaluations.map((e) => (
            <option key={e.id} value={e.id}>{e.period.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">評価項目</th>
                {presentEvaluators.map((e) => (
                  <th key={e.key} className={`text-right px-3 py-2 font-medium w-20 whitespace-nowrap ${e.color}`}>
                    {e.label}
                  </th>
                ))}
                {presentEvaluators.length === 0 && (
                  <th className="text-center px-4 py-2 text-gray-400 font-normal">未入力</th>
                )}
              </tr>
            </thead>
            <tbody>
              {EVALUATION_ITEMS.map((item, idx) => (
                <tr key={item.code} className="border-t">
                  <td className="px-4 py-2 text-xs text-gray-700 w-full">
                    {idx + 1}. {item.label}
                  </td>
                  {presentEvaluators.map((e) => {
                    const s = ev.scores.find((x) => x.item_code === item.code && x.evaluator === e.key);
                    return (
                      <td key={e.key} className={`px-3 py-2 text-right font-bold whitespace-nowrap ${e.color}`}>
                        {s?.score ?? "—"}
                        {s?.comment && (
                          <p className="text-xs font-normal text-gray-500 mt-0.5">{s.comment}</p>
                        )}
                      </td>
                    );
                  })}
                  {presentEvaluators.length === 0 && <td />}
                </tr>
              ))}
              <tr className="border-t bg-gray-50 font-bold">
                <td className="px-4 py-2 text-gray-700">合計</td>
                {presentEvaluators.map((e) => {
                  const total = ev.scores
                    .filter((s) => s.evaluator === e.key && s.score !== null)
                    .reduce((sum, s) => sum + (s.score ?? 0), 0);
                  const hasScore = ev.scores.some((s) => s.evaluator === e.key && s.score !== null);
                  return (
                    <td key={e.key} className={`px-3 py-2 text-right whitespace-nowrap ${e.color}`}>
                      {hasScore ? total : "—"}
                    </td>
                  );
                })}
                {presentEvaluators.length === 0 && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

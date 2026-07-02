"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVALUATION_ITEMS, STATUS_LABELS } from "@/lib/constants";
import { saveDirectorEvaluation, submitFromDirector } from "@/server/evaluation";

type ScoreEntry = { item_code: string; score: number | null; comment: string };

function isWithinDeadline(deadline: Date | null): boolean {
  if (!deadline) return false;
  return new Date() <= new Date(deadline);
}

export default function DirectorEvalForm({
  evaluation,
  selfScores,
  leaderScores,
  managerScores,
  directorScores,
  directorHasSaved,
  employeeRole,
  readOnly = false,
}: {
  evaluation: { id: string; status: string; period: { director_deadline: Date | null } };
  selfScores: ScoreEntry[];
  leaderScores: ScoreEntry[];
  managerScores: ScoreEntry[];
  directorScores: ScoreEntry[];
  directorHasSaved: boolean;
  employeeRole?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const deadline = evaluation.period.director_deadline;
  const withinDeadline = isWithinDeadline(deadline);

  const canEdit = evaluation.status === "SUBMITTED_TO_DIRECTOR" || withinDeadline;
  const canSubmit = evaluation.status === "SUBMITTED_TO_DIRECTOR";

  const [scores, setScores] = useState<ScoreEntry[]>(() => {
    if (!directorHasSaved && managerScores.some((s) => s.score !== null)) {
      return directorScores.map((s) => ({
        ...s,
        score: managerScores.find((m) => m.item_code === s.item_code)?.score ?? null,
      }));
    }
    return directorScores;
  });

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  function setScore(item_code: string, score: number | null) {
    setScores((prev) => prev.map((s) => (s.item_code === item_code ? { ...s, score } : s)));
  }
  function setComment(item_code: string, comment: string) {
    setScores((prev) => prev.map((s) => (s.item_code === item_code ? { ...s, comment } : s)));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await saveDirectorEvaluation(evaluation.id, scores);
      setMessage("保存しました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!confirm("社長に提出します。よろしいですか？")) return;
    setSubmitting(true);
    try {
      await saveDirectorEvaluation(evaluation.id, scores);
      await submitFromDirector(evaluation.id);
      router.push("/director");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "提出に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">
          {STATUS_LABELS[evaluation.status] ?? evaluation.status}
        </span>
        {withinDeadline && deadline && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
            修正期限: {new Date(deadline).toLocaleDateString("ja-JP")} まで修正可
          </span>
        )}
        {canEdit && !canSubmit && (
          <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded">
            課長評価がまだ届いていないため提出できません
          </span>
        )}
      </div>

      <div className="space-y-5">
        {EVALUATION_ITEMS.map((item, idx) => {
          const self = selfScores.find((x) => x.item_code === item.code);
          const ldr = leaderScores.find((x) => x.item_code === item.code);
          const mgr = managerScores.find((x) => x.item_code === item.code);
          const dir = scores.find((x) => x.item_code === item.code)!;
          return (
            <div key={item.code} className="bg-white rounded-lg border p-5">
              <p className="font-semibold text-sm text-gray-800 mb-1">
                {idx + 1}. {item.label}
              </p>
              <p className="text-xs text-gray-500 mb-3">{item.description}</p>

              <div className="bg-gray-50 rounded p-3 mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">【本人の自己評価】</p>
                <div className="flex items-center gap-3">
                  <span className="text-blue-700 font-bold">{self?.score ?? "未入力"}</span>
                  {self?.comment && <span className="text-sm text-gray-600">「{self.comment}」</span>}
                </div>
              </div>

              {(employeeRole === "LEADER" || (ldr && (ldr.score !== null || ldr.comment))) && (
                <div className="bg-gray-50 rounded p-3 mb-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    【リーダー評価】
                    {employeeRole === "LEADER" && <span className="ml-1 text-gray-400 font-normal">（自己評価と同じ点数）</span>}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-orange-600 font-bold">{ldr?.score ?? "未入力"}</span>
                    {ldr?.comment && <span className="text-sm text-gray-600">「{ldr.comment}」</span>}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded p-3 mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  【課長評価】
                  {employeeRole === "MANAGER" && <span className="ml-1 text-gray-400 font-normal">（自己評価と同じ点数）</span>}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-green-700 font-bold">{mgr?.score ?? "未入力"}</span>
                  {mgr?.comment && <span className="text-sm text-gray-600">「{mgr.comment}」</span>}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  【部長評価】
                  {canEdit && canSubmit && dir.score === managerScores.find((m) => m.item_code === item.code)?.score && dir.score !== null && (
                    <span className="ml-2 text-xs text-gray-400">（課長評価から自動入力）</span>
                  )}
                </p>
                {canEdit && !readOnly ? (
                  <>
                    <div className="flex gap-2 mb-2">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setScore(item.code, v)}
                          className={`w-10 h-10 rounded-full border-2 text-sm font-bold transition-colors
                            ${dir.score === v
                              ? "bg-purple-600 border-purple-600 text-white"
                              : "border-gray-300 text-gray-600 hover:border-purple-400"
                            }`}
                        >
                          {v}
                        </button>
                      ))}
                      {dir.score !== null && (
                        <button type="button" onClick={() => setScore(item.code, null)} className="text-xs text-gray-400 ml-2 hover:text-red-400">
                          クリア
                        </button>
                      )}
                    </div>
                    <textarea
                      value={dir.comment}
                      onChange={(e) => setComment(item.code, e.target.value)}
                      placeholder="コメント（任意）"
                      rows={2}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-purple-700 font-bold">{dir.score ?? "未入力"}</span>
                    {dir.comment && <span className="text-sm text-gray-600">「{dir.comment}」</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.includes("失敗") ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}

      {readOnly && (
        <p className="mt-4 text-sm text-gray-400 bg-gray-50 border rounded px-4 py-2">閲覧専用です。評価の入力・提出はできません。</p>
      )}

      {canEdit && !readOnly && (
        <div className="mt-6 flex gap-3 items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 border border-purple-600 text-purple-600 rounded font-medium text-sm hover:bg-purple-50 disabled:opacity-50"
          >
            {saving ? "保存中..." : "一時保存"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || saving || !canSubmit}
            title={!canSubmit ? "課長評価がまだ届いていないため提出できません" : undefined}
            className="px-6 py-2 bg-purple-600 text-white rounded font-medium text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "提出中..." : "社長に提出"}
          </button>
          {!canSubmit && (
            <span className="text-xs text-gray-400">※ 課長評価が届いていません</span>
          )}
        </div>
      )}
    </div>
  );
}

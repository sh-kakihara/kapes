"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVALUATION_ITEMS, STATUS_LABELS } from "@/lib/constants";
import { saveManagerEvaluation, submitFromManager } from "@/server/evaluation";

type ScoreEntry = { item_code: string; score: number | null; comment: string };

function isWithinDeadline(deadline: Date | null): boolean {
  if (!deadline) return false;
  return new Date() <= new Date(deadline);
}

const STATUS_ORDER = [
  "DRAFT",
  "SUBMITTED_TO_LEADER",
  "SUBMITTED_TO_MANAGER",
  "SUBMITTED_TO_DIRECTOR",
  "SUBMITTED_TO_PRESIDENT",
  "COMPLETED",
] as const;

function statusIndex(s: string) {
  return STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]);
}

export default function ManagerEvalForm({
  evaluation,
  selfScores,
  leaderScores,
  managerScores,
  hasLeader,
  leaderScoreIsSelf = false,
  readOnly = false,
}: {
  evaluation: { id: string; status: string; period: { manager_deadline: Date | null }; skipDirector: boolean };
  selfScores: ScoreEntry[];
  leaderScores: ScoreEntry[];
  managerScores: ScoreEntry[];
  hasLeader: boolean;
  leaderScoreIsSelf?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const deadline = evaluation.period.manager_deadline;
  const withinDeadline = isWithinDeadline(deadline);
  const canEdit =
    !readOnly && (evaluation.status === "SUBMITTED_TO_MANAGER" || withinDeadline);

  // 提出条件:
  // リーダーあり → リーダー評価が課長に届いている（SUBMITTED_TO_MANAGER以上）
  // リーダーなし → 自己評価が課長に届いている（SUBMITTED_TO_MANAGER以上）
  // いずれも status >= SUBMITTED_TO_MANAGER
  const canSubmit =
    statusIndex(evaluation.status) >= statusIndex("SUBMITTED_TO_MANAGER");

  const notSubmittedReason = !canSubmit
    ? hasLeader
      ? "リーダー評価がまだ届いていないため提出できません"
      : "自己評価がまだ届いていないため提出できません"
    : null;

  const [scores, setScores] = useState(managerScores);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  function setScore(item_code: string, score: number | null) {
    setScores((prev) =>
      prev.map((s) => (s.item_code === item_code ? { ...s, score } : s))
    );
  }
  function setComment(item_code: string, comment: string) {
    setScores((prev) =>
      prev.map((s) => (s.item_code === item_code ? { ...s, comment } : s))
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await saveManagerEvaluation(evaluation.id, scores);
      setMessage("保存しました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    const submitLabel = evaluation.skipDirector ? "社長" : "部長";
    if (!confirm(`${submitLabel}に提出します。よろしいですか？`)) return;
    setSubmitting(true);
    try {
      await saveManagerEvaluation(evaluation.id, scores);
      await submitFromManager(evaluation.id);
      router.push("/manager");
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
        {canEdit && notSubmittedReason && (
          <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded">
            {notSubmittedReason}
          </span>
        )}
      </div>

      <div className="space-y-5">
        {EVALUATION_ITEMS.map((item, idx) => {
          const self = selfScores.find((x) => x.item_code === item.code);
          const ldr = leaderScores.find((x) => x.item_code === item.code);
          const mgr = scores.find((x) => x.item_code === item.code)!;
          return (
            <div key={item.code} className="bg-white rounded-lg border p-5">
              <p className="font-semibold text-sm text-gray-800 mb-1">
                {idx + 1}. {item.label}
              </p>
              <p className="text-xs text-gray-500 mb-3">{item.description}</p>

              <div className="bg-gray-50 rounded p-3 mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">【本人の自己評価】</p>
                <div className="flex items-center gap-3">
                  <span className="text-blue-700 font-bold">
                    {self?.score ?? "未入力"}
                  </span>
                  {self?.comment && (
                    <span className="text-sm text-gray-600">「{self.comment}」</span>
                  )}
                </div>
              </div>

              {ldr && (ldr.score !== null || ldr.comment) && (
                <div className="bg-gray-50 rounded p-3 mb-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    【リーダー評価】
                    {leaderScoreIsSelf && <span className="ml-1 text-gray-400 font-normal">（自己評価と同じ点数）</span>}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-orange-600 font-bold">
                      {ldr.score ?? "未入力"}
                    </span>
                    {ldr.comment && (
                      <span className="text-sm text-gray-600">「{ldr.comment}」</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">【課長評価】</p>
                {canEdit ? (
                  <>
                    <div className="flex gap-2 mb-2">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setScore(item.code, v)}
                          className={`w-10 h-10 rounded-full border-2 text-sm font-bold transition-colors
                            ${mgr.score === v
                              ? "bg-green-600 border-green-600 text-white"
                              : "border-gray-300 text-gray-600 hover:border-green-400"
                            }`}
                        >
                          {v}
                        </button>
                      ))}
                      {mgr.score !== null && (
                        <button
                          type="button"
                          onClick={() => setScore(item.code, null)}
                          className="text-xs text-gray-400 ml-2 hover:text-red-400"
                        >
                          クリア
                        </button>
                      )}
                    </div>
                    <textarea
                      value={mgr.comment}
                      onChange={(e) => setComment(item.code, e.target.value)}
                      placeholder="コメント（任意）"
                      rows={2}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-green-700 font-bold">
                      {mgr.score ?? "未入力"}
                    </span>
                    {mgr.comment && (
                      <span className="text-sm text-gray-600">「{mgr.comment}」</span>
                    )}
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

      {canEdit && (
        <div className="mt-6 flex gap-3 items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 border border-green-600 text-green-600 rounded font-medium text-sm hover:bg-green-50 disabled:opacity-50"
          >
            {saving ? "保存中..." : "一時保存"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || saving || !canSubmit}
            title={notSubmittedReason ?? undefined}
            className="px-6 py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "提出中..." : evaluation.skipDirector ? "社長に提出" : "部長に提出"}
          </button>
          {notSubmittedReason && (
            <span className="text-xs text-gray-400">※ {notSubmittedReason}</span>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVALUATION_ITEMS, STATUS_LABELS } from "@/lib/constants";
import { saveSelfEvaluation, submitFromEmployee } from "@/server/evaluation";

type Score = { item_code: string; evaluator: string; score: number | null; comment: string | null };
type Evaluation = {
  id: string;
  status: string;
  scores: Score[];
  period: { self_deadline: Date | null };
};

function isWithinDeadline(deadline: Date | null): boolean {
  if (!deadline) return false;
  return new Date() <= new Date(deadline);
}

function getSubmitLabel(role: string, hasLeader: boolean, skipDirector: boolean, hasManager: boolean, hasExecutive: boolean): string {
  if (role === "EXECUTIVE") return "社長に提出";
  if (role === "DIRECTOR") return "社長に提出";
  if (role === "MANAGER") return skipDirector ? "社長に提出" : "部長に提出";
  if (role === "LEADER") return "課長に提出";
  if (hasLeader) return "リーダーに提出";
  if (!hasManager) return skipDirector ? "社長に提出" : "部長に提出";
  return "課長に提出";
}

export default function EvaluationForm({
  evaluation,
  hasLeader,
  role,
  skipDirector = false,
  hasManager = true,
  hasExecutive = false,
}: {
  evaluation: Evaluation;
  hasLeader: boolean;
  role: string;
  skipDirector?: boolean;
  hasManager?: boolean;
  hasExecutive?: boolean;
}) {
  const deadline = evaluation.period.self_deadline;
  const withinDeadline = isWithinDeadline(deadline);
  const isDraft = evaluation.status === "DRAFT";
  const canEdit = isDraft || withinDeadline;

  const initialScores = EVALUATION_ITEMS.map((item) => {
    const existing = evaluation.scores.find((s) => s.item_code === item.code && s.evaluator === "self");
    return { item_code: item.code, score: existing?.score ?? null, comment: existing?.comment ?? "" };
  });

  const router = useRouter();
  const [scores, setScores] = useState(initialScores);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const totalScore = scores.reduce((sum, s) => sum + (s.score ?? 0), 0);
  const answeredCount = scores.filter((s) => s.score !== null).length;
  const allAnswered = answeredCount === EVALUATION_ITEMS.length;

  function setScore(item_code: string, score: number | null) {
    setScores((prev) => prev.map((s) => s.item_code === item_code ? { ...s, score } : s));
  }
  function setComment(item_code: string, comment: string) {
    setScores((prev) => prev.map((s) => s.item_code === item_code ? { ...s, comment } : s));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await saveSelfEvaluation(evaluation.id, scores);
      setMessage("保存しました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!allAnswered) {
      setMessage(`未入力の項目があります（${answeredCount}/${EVALUATION_ITEMS.length}項目入力済み）`);
      return;
    }
    const submitLabel = getSubmitLabel(role, hasLeader, skipDirector, hasManager, hasExecutive);
    if (!confirm(`${submitLabel}します。よろしいですか？`)) return;
    setSubmitting(true);
    setMessage("");
    try {
      await saveSelfEvaluation(evaluation.id, scores);
      await submitFromEmployee(evaluation.id);
      router.push("/");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "提出に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = getSubmitLabel(role, hasLeader, skipDirector, hasManager, hasExecutive);

  return (
    <div>
      {!isDraft && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">
            {STATUS_LABELS[evaluation.status] ?? evaluation.status}
          </span>
          {withinDeadline && deadline && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              修正期限: {new Date(deadline).toLocaleDateString("ja-JP")} まで修正可
            </span>
          )}
          {!withinDeadline && !isDraft && (
            <span className="text-xs text-gray-400">修正期限を過ぎています</span>
          )}
        </div>
      )}

      {/* 合計点バー */}
      {canEdit && (
        <div className="sticky top-0 z-10 bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-800">合計点</span>
            <span className="text-2xl font-bold text-blue-700">{totalScore}</span>
            <span className="text-sm text-blue-500">/ {EVALUATION_ITEMS.length * 5}</span>
          </div>
          <div className="text-sm text-gray-500">
            {answeredCount === EVALUATION_ITEMS.length ? (
              <span className="text-green-600 font-medium">✓ 全項目入力済み</span>
            ) : (
              <span className="text-amber-600">{answeredCount} / {EVALUATION_ITEMS.length} 項目入力済み</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {EVALUATION_ITEMS.map((item, idx) => {
          const s = scores.find((x) => x.item_code === item.code)!;
          const missing = canEdit && s.score === null;
          return (
            <div key={item.code} className={`bg-white rounded-lg border p-5 ${missing ? "border-amber-300" : ""}`}>
              <p className="font-semibold text-sm text-gray-800 mb-1">
                {idx + 1}. {item.label}
                {missing && <span className="ml-2 text-xs text-amber-500 font-normal">※ 未入力</span>}
              </p>
              <p className="text-xs text-gray-500 mb-4">{item.description}</p>
              {canEdit ? (
                <>
                  <div className="flex gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} type="button" onClick={() => setScore(item.code, v)}
                        className={`w-10 h-10 rounded-full border-2 text-sm font-bold transition-colors
                          ${s.score === v ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}>
                        {v}
                      </button>
                    ))}
                    {s.score !== null && (
                      <button type="button" onClick={() => setScore(item.code, null)} className="text-xs text-gray-400 ml-2 hover:text-red-400">
                        クリア
                      </button>
                    )}
                  </div>
                  <textarea value={s.comment ?? ""} onChange={(e) => setComment(item.code, e.target.value)}
                    placeholder="コメント（任意）" rows={2}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-700">{s.score ?? "未入力"}</span>
                  {s.comment && <span className="text-sm text-gray-600">「{s.comment}」</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 合計点（下部） */}
      {!canEdit && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-800">合計点</span>
          <span className="text-2xl font-bold text-blue-700">{totalScore}</span>
          <span className="text-sm text-blue-500">/ {EVALUATION_ITEMS.length * 5}</span>
        </div>
      )}

      {message && (
        <p className={`mt-4 text-sm ${message.includes("失敗") || message.includes("過ぎ") || message.includes("未入力") ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}

      {canEdit && (
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-6 py-2 border border-blue-600 text-blue-600 rounded font-medium text-sm hover:bg-blue-50 disabled:opacity-50">
            {saving ? "保存中..." : "一時保存"}
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || saving}
            className={`px-6 py-2 rounded font-medium text-sm disabled:opacity-50 transition-colors
              ${allAnswered ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
            {submitting ? "提出中..." : submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}

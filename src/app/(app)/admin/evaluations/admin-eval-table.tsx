"use client";

import { useRouter } from "next/navigation";
import EvaluationListTable, { type EvalListItem } from "@/components/evaluation-list-table";
import { rollbackEvaluationStatus } from "@/server/evaluation";

export default function AdminEvalTable({ items }: { items: EvalListItem[] }) {
  const router = useRouter();

  async function handleRollback(item: EvalListItem) {
    if (!item.evalId) return;
    await rollbackEvaluationStatus(item.evalId);
    router.refresh();
  }

  return (
    <EvaluationListTable
      items={items}
      detailBasePath="/director"
      detailQuery="from=admin"
      scoreEvaluator="manager"
      scoreOptions={[
        { value: "self",     label: "自己評価" },
        { value: "leader",   label: "リーダー評価" },
        { value: "manager",  label: "課長評価" },
        { value: "director", label: "部長評価" },
      ]}
      popupColumns={[
        { key: "self",      label: "自己評価",     color: "text-blue-600" },
        { key: "leader",    label: "リーダー評価", color: "text-orange-500", showForRoles: ["STAFF", "LEADER"], hideIfSectionNoLeader: true },
        { key: "manager",   label: "課長評価",     color: "text-green-700",  roleOverride: "MANAGER" },
        { key: "director",  label: "部長評価",     color: "text-purple-700" },
      ]}
      detailButtonLabel="評価を見る"
      onRollbackStatus={handleRollback}
    />
  );
}

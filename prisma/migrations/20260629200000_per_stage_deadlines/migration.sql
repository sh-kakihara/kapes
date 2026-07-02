-- submission_deadlineを4段階の期限カラムに置き換え
ALTER TABLE "EvaluationPeriod" ADD COLUMN "self_deadline" TIMESTAMP(3);
ALTER TABLE "EvaluationPeriod" ADD COLUMN "leader_deadline" TIMESTAMP(3);
ALTER TABLE "EvaluationPeriod" ADD COLUMN "manager_deadline" TIMESTAMP(3);
ALTER TABLE "EvaluationPeriod" ADD COLUMN "director_deadline" TIMESTAMP(3);

-- 既存データを移行（submission_deadlineの値をすべての段階にコピー）
UPDATE "EvaluationPeriod"
SET "self_deadline" = "submission_deadline",
    "leader_deadline" = "submission_deadline",
    "manager_deadline" = "submission_deadline",
    "director_deadline" = "submission_deadline"
WHERE "submission_deadline" IS NOT NULL;

ALTER TABLE "EvaluationPeriod" DROP COLUMN "submission_deadline";

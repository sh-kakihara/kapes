-- evaluationのstatusカラムをnull許容に変更
-- リセット時に「自己評価未入力」(null)と「自己評価入力中」(DRAFT)を区別するため
ALTER TABLE "Evaluation" ALTER COLUMN "status" DROP NOT NULL;

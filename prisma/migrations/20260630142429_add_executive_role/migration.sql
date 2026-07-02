ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EXECUTIVE';
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED_TO_EXECUTIVE';
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS executive_id TEXT;
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS submitted_to_executive_at TIMESTAMP(3);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Evaluation_executive_id_fkey'
  ) THEN
    ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_executive_id_fkey" FOREIGN KEY (executive_id) REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
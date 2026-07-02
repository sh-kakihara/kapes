-- AlterEnum
ALTER TYPE "EvaluationStatus" ADD VALUE 'SUBMITTED_TO_LEADER';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LEADER';

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "has_leader" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "leader_id" TEXT,
ADD COLUMN     "submitted_to_leader_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EvaluationPeriod" ADD COLUMN     "submission_deadline" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

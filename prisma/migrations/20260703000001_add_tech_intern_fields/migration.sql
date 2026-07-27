-- AlterTable: EmployeeRecord に技能実習生・特定技能の開始日フィールドを追加
ALTER TABLE "EmployeeRecord"
  ADD COLUMN IF NOT EXISTS "tech_intern_1_date"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tech_intern_3_date"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "specified_skilled_date" TIMESTAMP(3);

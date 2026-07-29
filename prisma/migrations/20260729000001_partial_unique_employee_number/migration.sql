-- 社員番号ユニーク制約を部分インデックスに変更（論理削除済みは除外）
DROP INDEX IF EXISTS "User_employee_number_key";
CREATE UNIQUE INDEX "User_employee_number_key"
  ON "User"("employee_number")
  WHERE deleted_at IS NULL AND employee_number IS NOT NULL;

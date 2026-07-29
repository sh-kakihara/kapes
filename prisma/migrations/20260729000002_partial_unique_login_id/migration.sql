-- ログインIDユニーク制約を部分インデックスに変更（論理削除済みは除外）
DROP INDEX IF EXISTS "User_login_id_key";
CREATE UNIQUE INDEX "User_login_id_key"
  ON "User"("login_id")
  WHERE deleted_at IS NULL;

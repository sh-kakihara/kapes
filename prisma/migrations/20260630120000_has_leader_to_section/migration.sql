-- Section に has_leader を追加（Department の has_leader を課単位へ移行）
ALTER TABLE "Section" ADD COLUMN "has_leader" BOOLEAN NOT NULL DEFAULT false;

-- 既存データ: Department の has_leader が true なら配下の Section にも反映
UPDATE "Section" s
SET "has_leader" = true
FROM "Department" d
WHERE s.department_id = d.id AND d.has_leader = true AND s.deleted_at IS NULL;

-- Department から has_leader を削除
ALTER TABLE "Department" DROP COLUMN "has_leader";

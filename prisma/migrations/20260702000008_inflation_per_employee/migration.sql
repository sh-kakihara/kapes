-- 旧テーブル削除
DROP TABLE IF EXISTS "InflationAllowance";

-- インフレ手当 期別設定
CREATE TABLE "InflationSetting" (
  "id"          TEXT NOT NULL,
  "fiscal_year" INTEGER NOT NULL,
  "season"      TEXT NOT NULL,
  "enabled"     BOOLEAN NOT NULL DEFAULT true,
  "notice_date" TEXT NOT NULL DEFAULT '',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"  TEXT,
  "updated_by"  TEXT,
  CONSTRAINT "InflationSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InflationSetting_fiscal_year_season_key"
  ON "InflationSetting"("fiscal_year", "season");

-- インフレ手当 個人上書き
CREATE TABLE "InflationEmployee" (
  "id"         TEXT NOT NULL,
  "setting_id" TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "amount"     INTEGER NOT NULL,
  CONSTRAINT "InflationEmployee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InflationEmployee_setting_id_fkey"
    FOREIGN KEY ("setting_id") REFERENCES "InflationSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InflationEmployee_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InflationEmployee_setting_id_user_id_key"
  ON "InflationEmployee"("setting_id", "user_id");

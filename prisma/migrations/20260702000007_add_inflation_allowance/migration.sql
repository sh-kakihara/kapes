-- インフレ手当設定テーブル
CREATE TABLE "InflationAllowance" (
  "id"          TEXT NOT NULL,
  "fiscal_year" INTEGER NOT NULL,
  "season"      TEXT NOT NULL,
  "amount"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"  TEXT,
  "updated_by"  TEXT,

  CONSTRAINT "InflationAllowance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InflationAllowance_fiscal_year_season_key"
  ON "InflationAllowance"("fiscal_year", "season");

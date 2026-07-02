CREATE TABLE IF NOT EXISTS "NoticeConfig" (
  "id" TEXT NOT NULL,
  "representative_name" TEXT NOT NULL DEFAULT '代表取締役　柿原邦博',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  CONSTRAINT "NoticeConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NoticeDocument" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fiscal_year" INTEGER NOT NULL,
  "season" TEXT NOT NULL,
  "notice_date" TEXT NOT NULL DEFAULT '',
  "comment" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "updated_by" TEXT,
  CONSTRAINT "NoticeDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NoticeDocument_type_fiscal_year_season_key"
  ON "NoticeDocument"("type", "fiscal_year", "season");

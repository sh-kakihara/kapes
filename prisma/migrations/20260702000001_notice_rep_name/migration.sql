ALTER TABLE "NoticeDocument"
  ADD COLUMN IF NOT EXISTS "representative_name" TEXT NOT NULL DEFAULT '代表取締役　柿原邦博';

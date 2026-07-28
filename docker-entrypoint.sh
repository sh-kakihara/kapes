#!/bin/sh

echo "Running database migrations..."

if [ -n "$DATABASE_URL" ]; then
  # psql は sslmode=no-verify を解釈できないため sslmode=require に置換
  PSQL_URL=$(echo "$DATABASE_URL" | sed 's/sslmode=no-verify/sslmode=require/g')

  # _prisma_migrations テーブルを作成（存在しない場合）
  psql "$PSQL_URL" -c "
    CREATE TABLE IF NOT EXISTS \"_prisma_migrations\" (
      id VARCHAR(36) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL DEFAULT '',
      finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    );
  " 2>&1 || true

  # 各マイグレーションを適用（適用済みはスキップ）
  for sql_file in $(ls -d prisma/migrations/*/migration.sql 2>/dev/null | sort); do
    migration_name=$(basename "$(dirname "$sql_file")")

    # 適用済みチェック
    applied=$(psql "$PSQL_URL" -t -c "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE migration_name = '$migration_name' AND finished_at IS NOT NULL;" 2>/dev/null | tr -d ' ')

    if [ "$applied" = "1" ]; then
      echo "  skip: $migration_name"
    else
      echo "  apply: $migration_name"
      psql "$PSQL_URL" -f "$sql_file" 2>&1 && \
      psql "$PSQL_URL" -c "
        INSERT INTO \"_prisma_migrations\" (id, migration_name, finished_at, applied_steps_count)
        VALUES (gen_random_uuid()::text, '$migration_name', CURRENT_TIMESTAMP, 1)
        ON CONFLICT DO NOTHING;
      " 2>&1 || echo "  warning: $migration_name failed (may already be applied)"
    fi
  done

  echo "Migrations done."
else
  echo "DATABASE_URL not set, skipping migrations."
fi

exec node server.js

#!/bin/sh

echo "Running database migrations..."

if [ -n "$DATABASE_URL" ]; then
  # psql は sslmode=no-verify を解釈できないため sslmode=require に置換
  PSQL_URL=$(echo "$DATABASE_URL" | sed 's/sslmode=no-verify/sslmode=require/g')

  # 各マイグレーション SQL を順番に実行（エラーは無視）
  for sql_file in $(find prisma/migrations -name "migration.sql" 2>/dev/null | sort); do
    echo "  applying: $sql_file"
    psql "$PSQL_URL" -f "$sql_file" 2>&1 || true
  done

  echo "Migrations done."
else
  echo "DATABASE_URL not set, skipping migrations."
fi

exec node server.js

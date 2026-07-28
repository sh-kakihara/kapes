#!/bin/sh

echo "Running database migrations..."

if [ -n "$DATABASE_URL" ]; then
  # psql 用に URL を整形（schema パラメータ除去・sslmode を require に）
  PSQL_URL=$(node -e "
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete('schema');
    url.searchParams.set('sslmode', 'require');
    process.stdout.write(url.toString());
  ")

  for sql_file in $(find prisma/migrations -name "migration.sql" 2>/dev/null | sort); do
    echo "  applying: $sql_file"
    psql "$PSQL_URL" -f "$sql_file" 2>&1 || true
  done

  echo "Migrations done."
else
  echo "DATABASE_URL not set, skipping migrations."
fi

exec node server.js

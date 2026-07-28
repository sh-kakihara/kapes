#!/bin/sh

echo "Running database migrations..."
npx prisma migrate deploy && echo "Migrations complete." || echo "Migration failed, continuing anyway."

exec node server.js

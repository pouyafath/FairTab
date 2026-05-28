#!/bin/sh
set -e

DB_FILE="${DATABASE_URL:-/data/fairtab.db}"

# On the very first container start, initialise the SQLite schema.
# Subsequent starts skip this — the file already exists.
if [ ! -f "$DB_FILE" ]; then
  echo "FairTab: first run — initialising database at $DB_FILE ..."
  node /app/scripts/migrate.js
  echo "FairTab: database ready."
fi

exec "$@"

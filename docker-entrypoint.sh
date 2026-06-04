#!/bin/sh
set -e

# Run migrations on every boot — the runner is idempotent and skips
# already-applied files, so this is safe for existing databases.
echo "FairTab: applying migrations ..."
node /app/scripts/migrate.js
echo "FairTab: database ready."

exec "$@"

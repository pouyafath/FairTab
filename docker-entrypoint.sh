#!/bin/sh
set -e

# Run migrations on every boot. The runner is idempotent — it records applied
# files in a _migrations table and skips them next time — so this is safe for
# both fresh and existing databases.
echo "FairTab: applying migrations ..."
node /app/scripts/migrate.js
echo "FairTab: database ready."

mkdir -p "${UPLOADS_DIR:-/data/uploads}"

exec "$@"

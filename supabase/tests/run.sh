#!/usr/bin/env bash
# Tests the database on a local Postgres (no Supabase needed).
# Every supabase/tests/*_test.sql file runs against its own fresh database with all migrations applied.
# Usage: supabase/tests/run.sh [test-file...]   (expects `psql` to connect as a superuser, e.g. PGUSER=postgres)
# TEST_DB_PREFIX changes the scratch database names, so several runs can share one Postgres server.
set -euo pipefail
cd "$(dirname "$0")/../.."
PREFIX=${TEST_DB_PREFIX:-fairtab_test}
if [[ ! $PREFIX =~ ^[a-z_][a-z0-9_]*$ ]]; then
  echo "TEST_DB_PREFIX must use only lowercase letters, digits and _ (got: $PREFIX)" >&2
  exit 1
fi
psql -q -v ON_ERROR_STOP=1 -d postgres -c "do \$\$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end \$\$"
if [ "$#" -gt 0 ]; then tests=("$@"); else tests=(supabase/tests/*_test.sql); fi
for test in "${tests[@]}"; do
  db="${PREFIX}_$(basename "$test" .sql)"
  echo "== $test"
  psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
  sed '/^create role/d' supabase/tests/local_auth_stub.sql | psql -q -v ON_ERROR_STOP=1 -d "$db"
  for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$f"; done
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$test"
  psql -q -d postgres -c "drop database if exists $db"
done

#!/usr/bin/env bash
# Tests the database schema on a local Postgres (no Supabase needed).
# Usage: supabase/tests/run.sh   (expects `psql` to connect as a superuser, e.g. PGUSER=postgres)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=opensplit_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d postgres -c "do \$\$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end \$\$"
sed '/^create role/d' supabase/tests/local_auth_stub.sql | psql -q -v ON_ERROR_STOP=1 -d $DB
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/schema_test.sql

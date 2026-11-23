#!/usr/bin/env bash
# Roda os testes pgTAP do banco num Postgres local temporário, sem Docker e
# sem projeto Supabase. Requer PostgreSQL 15+ com as extensões pgtap e
# unaccent, e o pg_prove (Debian/Ubuntu: postgresql-16-pgtap e
# libtap-parser-sourcehandler-pgtap-perl).
#
# Uso: scripts/test-db.sh [arquivo.test.sql ...]
# Sem argumentos, roda todos os testes de supabase/tests/database.
#
# Com o Supabase CLI, o equivalente é: supabase db reset && supabase test db
set -euo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# O Postgres não roda como root: refaz a chamada como o usuário postgres.
if [ "$(id -u)" = "0" ]; then
  exec runuser -u postgres -- "$0" "$@"
fi

PG_BIN="${PG_BIN:-$(pg_config --bindir 2>/dev/null || ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
TMP="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
export PGHOST="$TMP" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

cleanup() { "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$TMP/data" -U postgres --auth=trust --locale=C.UTF-8 >/dev/null
"$PG_BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -p $PORT -c listen_addresses='' -c wal_level=logical" -l "$TMP/log" -w start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/local/supabase_shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f" >/dev/null || { echo "Falhou ao aplicar $f"; exit 1; }
done

if [ "$#" -gt 0 ]; then TESTS=("$@"); else TESTS=("$ROOT"/supabase/tests/database/*.test.sql); fi
pg_prove --ext .sql "${TESTS[@]}"

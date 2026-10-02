#!/usr/bin/env bash
# The whole seminar stack, one command.
#
#   ./stack.sh up       # docker (mail + db), seed, mocks, runner, the OperonX app, Studio
#   ./stack.sh status   # what answers where
#   ./stack.sh check    # every playground (mock model) + the meeting-prep golden eval
#   ./stack.sh down     # stop what `up` started (the docker services keep running)
#
# Expects the sibling checkouts:
#   ../meeting-prep-projects   (MEETING_PREP_DIR)
#   operonx-studio             (STUDIO_DIR, default ../../operonx-studio)
# PREP_DB_PORT moves the database off 5433 when another Postgres holds it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PREP="${MEETING_PREP_DIR:-$ROOT/../meeting-prep-projects}"
STUDIO_DIR="${STUDIO_DIR:-$ROOT/../../operonx-studio}"
STUDIO_PORT="${STUDIO_PORT:-8766}"
export PREP_DB_PORT="${PREP_DB_PORT:-5433}"
export PREP_DB_URL="${PREP_DB_URL:-postgresql://prep:prep@127.0.0.1:$PREP_DB_PORT/prep}"
RUN="$ROOT/.stack"
mkdir -p "$RUN"

listening() { ss -ltn 2>/dev/null | grep -q ":$1 "; }

start() {   # name port dir command...
  local name=$1 port=$2 dir=$3; shift 3
  if listening "$port"; then echo "  $name: :$port already in use, left as is"; return; fi
  (cd "$dir" && nohup "$@" >"$RUN/$name.log" 2>&1 & echo $! >"$RUN/$name.pid")
  for _ in $(seq 60); do listening "$port" && { echo "  $name: :$port"; return; }; sleep 1; done
  echo "  $name: did not come up on :$port, see $RUN/$name.log"; return 1
}

up() {
  echo "world (mail :8025, db :$PREP_DB_PORT)"
  (cd "$PREP/meeting-prep-world" && docker compose up -d --quiet-pull >/dev/null && uv sync -q)
  for _ in $(seq 30); do (cd "$PREP/meeting-prep-world" && uv run -q prep-seed >/dev/null 2>&1) && break; sleep 1; done
  echo "  seeded"
  (cd "$ROOT" && uv sync -q)
  (cd "$PREP/meeting-prep-operonx" && uv sync -q)
  start runner 8000 "$ROOT" uv run python -m runner.server
  start mocks 8100 "$PREP/meeting-prep-world" uv run prep-mocks
  start app 8200 "$PREP/meeting-prep-operonx" uv run operonx-serve
  OPERONX_STUDIO_AUTH=off start studio "$STUDIO_PORT" "$STUDIO_DIR" \
    uv run operonx-studio "$PREP/meeting-prep-operonx" --port "$STUDIO_PORT" --no-open
  status
}

down() {
  for f in "$RUN"/*.pid; do
    [ -e "$f" ] || continue
    pkill -P "$(cat "$f")" 2>/dev/null || true; kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"
  done
  echo "stopped (docker: cd $PREP/meeting-prep-world && docker compose down)"
}

status() {
  for p in "site + runner:8000" "Mailpit inbox:8025" "database:$PREP_DB_PORT" "search/web mocks:8100" \
           "OperonX app:8200" "Studio:$STUDIO_PORT"; do
    if listening "${p##*:}"; then echo "  ok   ${p%:*}  http://127.0.0.1:${p##*:}"; else echo "  DOWN ${p%:*}  :${p##*:}"; fi
  done
}

check() {
  (cd "$ROOT" && uv run python -m runner.check)
  (cd "$PREP/meeting-prep-operonx" && uv run operonx-run golden)
}

"${1:-status}"

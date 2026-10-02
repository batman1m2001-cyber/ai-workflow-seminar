#!/usr/bin/env bash
# The whole seminar stack, one command.
#
#   ./stack.sh up       # docker (mail + db), seed, mocks, runner, the OperonX app, Studio
#   ./stack.sh status   # what answers where
#   ./stack.sh check    # every playground (mock model) + the meeting-prep golden eval
#   ./stack.sh down     # stop what `up` started (the docker services keep running)
#   ./stack.sh tunnel   # public https URLs for the site and Studio (cloudflared quick tunnels)
#
# Everything is behind one password, so a tunnel never exposes the code runner or
# Studio's assistant: SEMINAR_PASSWORD, or a generated one kept in .stack/password.
#   site:   any user name + the password (browser prompt)
#   Studio: user "seminar" + the password
#
# Expects the sibling checkouts:
#   ../meeting-prep-projects   (MEETING_PREP_DIR)
#   operonx-studio             (STUDIO_DIR, default ../../operonx-studio)
# PREP_DB_PORT moves the database off 5433 when another Postgres holds it.
# SEMINAR_MODEL_MODE=real (default) sends meeting-prep's model calls through the runner's
# router (.env: in-house model, tools -> gpt-4o-mini); =mock uses the scripted mock.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PREP="${MEETING_PREP_DIR:-$ROOT/../meeting-prep-projects}"
STUDIO_DIR="${STUDIO_DIR:-$ROOT/../../operonx-studio}"
STUDIO_PORT="${STUDIO_PORT:-8766}"
export PREP_DB_PORT="${PREP_DB_PORT:-5433}"
export PREP_DB_URL="${PREP_DB_URL:-postgresql://prep:prep@127.0.0.1:$PREP_DB_PORT/prep}"
RUN="$ROOT/.stack"
mkdir -p "$RUN"
[ -s "$RUN/password" ] || { umask 077; head -c 12 /dev/urandom | base64 | tr -d '/+=' >"$RUN/password"; }
export SEMINAR_PASSWORD="${SEMINAR_PASSWORD:-$(cat "$RUN/password")}"

if [ "${SEMINAR_MODEL_MODE:-real}" = real ]; then
  MODEL_ENV=(OPENAI_BASE_URL=http://127.0.0.1:8000/llm/v1 OPENAI_API_KEY="$SEMINAR_PASSWORD")
else
  MODEL_ENV=(OPENAI_BASE_URL=http://127.0.0.1:8000/mock/v1 OPENAI_API_KEY=mock)
fi

listening() { ss -ltn 2>/dev/null | grep -q ":$1 "; }

start() {   # name port dir command...
  local name=$1 port=$2 dir=$3; shift 3
  if listening "$port"; then echo "  $name: :$port already in use, left as is"; return; fi
  (cd "$dir" && exec "$@" >"$RUN/$name.log" 2>&1 </dev/null) & echo $! >"$RUN/$name.pid"
  for _ in $(seq 60); do listening "$port" && { echo "  $name: :$port"; return; }; sleep 1; done
  echo "  $name: did not come up on :$port, see $RUN/$name.log"; return 1
}

up() {
  echo "world (mail :8025, db :$PREP_DB_PORT), model: ${SEMINAR_MODEL_MODE:-real}"
  (cd "$PREP/meeting-prep-world" && docker compose up -d --quiet-pull >/dev/null && uv sync -q)
  (cd "$ROOT" && uv sync -q)
  (cd "$PREP/meeting-prep-operonx" && uv sync -q)
  start runner 8000 "$ROOT" uv run python -m runner.server
  # the knowledge base is embedded by the model in use: re-seed when it changes
  for _ in $(seq 30); do (cd "$PREP/meeting-prep-world" && env "${MODEL_ENV[@]}" uv run -q prep-seed >/dev/null 2>&1) && break; sleep 1; done
  echo "  seeded"
  start mocks 8100 "$PREP/meeting-prep-world" env "${MODEL_ENV[@]}" uv run prep-mocks
  start app 8200 "$PREP/meeting-prep-operonx" env "${MODEL_ENV[@]}" uv run operonx-serve
  # its own accounts: the first start makes "seminar" the admin, with the password;
  # jobs and services it starts inherit the model settings
  OPERONX_STUDIO_STATE_DIR="$RUN/studio-state" OPERONX_STUDIO_USER=seminar OPERONX_STUDIO_PASS="$SEMINAR_PASSWORD" \
    start studio "$STUDIO_PORT" "$STUDIO_DIR" \
    env "${MODEL_ENV[@]}" uv run operonx-studio "$PREP/meeting-prep-operonx" --port "$STUDIO_PORT" --no-open
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

tunnel() {
  for t in "site 8000" "studio $STUDIO_PORT"; do
    set -- $t
    [ -e "$RUN/tunnel-$1.pid" ] && kill -0 "$(cat "$RUN/tunnel-$1.pid")" 2>/dev/null && continue
    cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$2" >"$RUN/tunnel-$1.log" 2>&1 </dev/null &
    echo $! >"$RUN/tunnel-$1.pid"
  done
  for t in site studio; do
    for _ in $(seq 30); do grep -qo 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/tunnel-$t.log" && break; sleep 1; done
    echo "  $t: $(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/tunnel-$t.log" | head -1)"
  done
  echo "  password: $SEMINAR_PASSWORD   (Studio user: seminar)"
}

check() {
  (cd "$ROOT" && uv run python -m runner.check)
  (cd "$PREP/meeting-prep-operonx" && env "${MODEL_ENV[@]}" uv run operonx-run golden)
}

"${1:-status}"

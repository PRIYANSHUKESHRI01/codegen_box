#!/usr/bin/env bash
# Installs the four runtimes the judge supports on every Piston node, then
# applies the JVM launcher tuning. Safe to re-run: existing runtimes are
# skipped and the Java patch is idempotent.
#
#   ./install-runtimes.sh                       # the nodes in docker-compose.yml
#   NODES="http://10.0.0.5:2000 http://10.0.0.6:2000" ./install-runtimes.sh   # remote nodes (skips the Java patch: run
#                                                # `docker compose exec -T <svc> sh -s < patch-java-runtime.sh` on each host)
set -euo pipefail
cd "$(dirname "$0")"

PACKAGES=("node:18.15.0" "python:3.10.0" "java:15.0.2" "gcc:10.2.0")   # must match config/piston.php 'languages'
COMPOSE_MODE=0
if [ -z "${NODES:-}" ]; then
  NODES="http://127.0.0.1:2001 http://127.0.0.1:2002"
  COMPOSE_MODE=1
fi

for node in $NODES; do
  echo "== $node"
  for _ in $(seq 1 30); do
    curl -fsS "$node/api/v2/runtimes" >/dev/null 2>&1 && break
    sleep 2
  done
  curl -fsS "$node/api/v2/runtimes" >/dev/null || { echo "   not reachable, skipping"; continue; }

  installed=$(curl -fsS "$node/api/v2/runtimes")
  for pkg in "${PACKAGES[@]}"; do
    lang=${pkg%%:*}; ver=${pkg##*:}
    # Piston reports node as "javascript" and gcc as "c++"/"c" — match on the version instead.
    if grep -q "\"version\":\"$ver\"" <<<"$installed"; then
      echo "   $lang $ver already installed"
      continue
    fi
    echo "   installing $lang $ver (downloads a few hundred MB; be patient)..."
    curl -fsS -X POST "$node/api/v2/packages" -H 'Content-Type: application/json' \
      -d "{\"language\":\"$lang\",\"version\":\"$ver\"}" >/dev/null
  done
done

if [ "$COMPOSE_MODE" = 1 ]; then
  for svc in $(docker compose config --services); do
    echo "== tuning the Java launcher on $svc"
    docker compose exec -T "$svc" sh -s < patch-java-runtime.sh
  done
fi

echo "done. Verify with:  php artisan judge:status   (from the app)"

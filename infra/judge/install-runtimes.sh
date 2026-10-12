#!/usr/bin/env bash
# Installs the runtimes the judge supports on every Piston node — JavaScript
# (node), TypeScript, Python 3 and 2, Java, C/C++ (gcc: one package, both
# languages), C# (mono), Go, Kotlin, Scala, Rust, Swift, Ruby, PHP, Dart,
# Elixir, Erlang and Racket — then applies the launcher tuning (Java, and
# Kotlin/Scala/TypeScript: see patch-runtimes.sh). Safe to re-run: existing
# runtimes are skipped and the patches are idempotent.
#
# DISK: the full set is about 11.4 GB per node once extracted (measured: gcc 2.8
# GB, Rust 1.5, Swift 1.3, Racket 0.9, Python 3 0.8, Dart 0.6, mono 0.6, Java 0.5,
# Go 0.4, Python 2 0.3, Kotlin 0.3, Ruby 0.2, Scala 0.2, node 0.2, TypeScript
# 0.2, PHP 0.2, Elixir 0.2, Erlang 0.1). Check the Docker host has room first —
# a full disk takes Docker (and the judge) down with it.
#
#   ./install-runtimes.sh                       # the nodes in docker-compose.yml
#   NODES="http://10.0.0.5:2000 http://10.0.0.6:2000" ./install-runtimes.sh   # remote nodes (skips the Java patch: run
#                                                # `docker compose exec -T <svc> sh -s < patch-java-runtime.sh` on each host)
set -euo pipefail
cd "$(dirname "$0")"

# Must match config/piston.php 'languages' (C and C++ are both the gcc package; C# is the mono package).
PACKAGES=("node:18.15.0" "python:3.10.0" "java:15.0.2" "gcc:10.2.0" "php:8.2.3" "go:1.16.2" "kotlin:1.8.20" "rust:1.68.2" "mono:6.12.0"
          "typescript:5.0.3" "ruby:3.0.1" "elixir:1.11.3" "erlang:23.0.0" "dart:2.19.6" "scala:3.2.2" "python:2.7.18" "swift:5.3.3" "racket:8.3.0")
COMPOSE_MODE=0
FAILED=0

# Piston downloads a package from GitHub's release CDN, which is served from
# several IPs. When the node's network can't reach the one it picks, its fetch
# throws an unhandled rejection that CRASHES the node's API process (compose
# restarts it within ~10 s) and the request dies with an empty reply. So a
# failed request isn't final: wait for the node to come back and ask again —
# the next attempt usually lands on a reachable IP. A package that never
# installs is reported at the end instead of silently leaving a language dead.
install_package() {
  local node=$1 lang=$2 ver=$3
  for attempt in 1 2 3 4 5; do
    if curl -fsS -X POST "$node/api/v2/packages" -H 'Content-Type: application/json' \
         -d "{\"language\":\"$lang\",\"version\":\"$ver\"}" >/dev/null; then
      return 0
    fi
    echo "   attempt $attempt/5 failed (the node may have restarted); waiting for it to come back..."
    for _ in $(seq 1 30); do
      curl -fsS "$node/api/v2/runtimes" >/dev/null 2>&1 && break
      sleep 2
    done
  done
  return 1
}
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
    echo "   installing $lang $ver (downloads up to a few hundred MB; be patient)..."
    install_package "$node" "$lang" "$ver" || { echo "   FAILED to install $lang $ver on $node — re-run this script to retry"; FAILED=1; }
  done
done

if [ "$COMPOSE_MODE" = 1 ]; then
  for svc in $(docker compose config --services); do
    echo "== tuning the Java launcher on $svc"
    # tr: a Windows checkout (core.autocrlf) has CRLF endings, which the container's sh can't parse.
    tr -d '\r' < patch-java-runtime.sh | docker compose exec -T "$svc" sh -s

    echo "== tuning Kotlin / Scala / TypeScript on $svc"
    tuned=$(tr -d '\r' < patch-runtimes.sh | docker compose exec -T "$svc" sh -s)
    echo "$tuned"
    # Piston reads a package's .env when it starts, so a node that was just tuned needs a restart.
    if grep -qE 'flags set|launcher tuned|compiler set' <<<"$tuned"; then
      echo "   restarting $svc to load the tuned environment"
      docker compose restart "$svc" >/dev/null
    fi
  done
fi

if [ "$FAILED" = 1 ]; then
  echo "finished WITH FAILURES (see above): at least one runtime is missing, so that language will not judge." >&2
  exit 1
fi
echo "done. Verify with:  php artisan judge:status   (from the app)"

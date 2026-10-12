#!/usr/bin/env bash
# Build the workspace image.   build-image.sh [full|lite] [tag]
#
#   full  everything students can need (Node, PHP/Composer, Python, Java/Maven, MariaDB, PostgreSQL, Redis) — ~3.5 GB
#   lite  Node, PHP/Composer, Python, SQLite only — ~1.3 GB; for a laptop or a smoke test
set -euo pipefail

FLAVOR="${1:-full}"
TAG="${2:-aptrun/workspace:latest}"
HERE="$(cd "$(dirname "$0")" && pwd)"

case "$FLAVOR" in full|lite) ;; *) echo "flavor must be full or lite" >&2; exit 1 ;; esac

docker network inspect aptrun-workspaces >/dev/null 2>&1 || docker network create aptrun-workspaces >/dev/null
echo "Building $TAG ($FLAVOR)…"
docker build --build-arg "FLAVOR=$FLAVOR" -t "$TAG" "$HERE"
echo "Built $TAG."

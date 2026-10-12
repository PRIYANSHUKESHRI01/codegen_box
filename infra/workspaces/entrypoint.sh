#!/bin/bash
# Starts the editor. The control plane (Laravel) passes the access token in the
# environment of `docker run`; it is moved into a file and removed from the
# environment so the terminals a student opens don't inherit it.
set -euo pipefail

: "${CONNECTION_TOKEN:?CONNECTION_TOKEN is required}"

PORT="${IDE_PORT:-13370}"
export HOME=/home/workspace

umask 077
printf '%s' "$CONNECTION_TOKEN" > /tmp/.ide-token
unset CONNECTION_TOKEN
umask 022

DATA="$HOME/.openvscode-server"
mkdir -p "$DATA/data"

# Extensions are the curated set baked into the image, in a folder the workspace user cannot write to
# (see the Dockerfile): students cannot install more, so no AI-autocomplete extension can write their code.
EXTENSIONS=/opt/aptrun-extensions

# Folder-level defaults, written once into a new workspace; after that the file is the student's.
mkdir -p "$HOME/.vscode"
[ -f "$HOME/.vscode/settings.json" ] || cp /opt/workspace-settings.json "$HOME/.vscode/settings.json"

# Platform-owned settings, rewritten on EVERY start so an image upgrade reaches existing workspaces.
# They are the server's "machine" settings, which the browser client loads before it lays itself out:
# first-launch layout choices (hide the AI chat panel it cannot sign in to) are ignored when they
# sit in the folder's .vscode/settings.json, which is read too late.
mkdir -p "$DATA/data/Machine"
cp /opt/machine-settings.json "$DATA/data/Machine/settings.json"

exec /opt/openvscode-server/bin/openvscode-server \
    --host 0.0.0.0 \
    --port "$PORT" \
    --connection-token-file /tmp/.ide-token \
    --telemetry-level off \
    --disable-workspace-trust \
    --user-data-dir "$DATA/data" \
    --extensions-dir "$EXTENSIONS"

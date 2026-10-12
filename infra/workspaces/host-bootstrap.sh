#!/usr/bin/env bash
# One-time setup of a Project Lab workspace host (Ubuntu 22.04 / 24.04, x86_64 or arm64).
#
#   sudo ./host-bootstrap.sh [--gvisor] [--deploy-key "ssh-ed25519 AAAA… control-plane"]
#
# What it does (idempotent — safe to run again):
#   1. installs Docker Engine (if missing)
#   2. optionally installs gVisor (runsc) and registers it as a Docker runtime — strongly
#      recommended: it puts a user-space kernel between student code and the host kernel
#   3. creates the `aptrun-workspaces` network with a FIXED subnet (the firewall depends on it)
#   4. applies host-firewall.sh and installs a systemd unit that re-applies it after Docker starts
#   5. creates a `deploy` user for the Laravel control plane to reach Docker over ssh://
#
# It does NOT build the workspace image or start the gateway; see docs/project-lab.md §5.
#
# NOTE: this was written for a Linux host and has not been run on one from the
# Windows machine it was authored on. Read it, run it on a fresh VM, then run
# verify-isolation.sh before admitting students.
set -euo pipefail

SUBNET="${WORKSPACE_SUBNET:-172.30.0.0/16}"
GATEWAY_IP="${GATEWAY_IP:-172.30.0.2}"
NET="${WORKSPACE_NETWORK:-aptrun-workspaces}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WANT_GVISOR=0
DEPLOY_KEY=""

while [ $# -gt 0 ]; do
    case "$1" in
        --gvisor) WANT_GVISOR=1 ;;
        --deploy-key) DEPLOY_KEY="${2:?--deploy-key needs a public key}"; shift ;;
        *) echo "unknown option $1" >&2; exit 1 ;;
    esac
    shift
done

[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 1; }

echo "==> Docker Engine"
if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if [ "$WANT_GVISOR" -eq 1 ]; then
    echo "==> gVisor (runsc)"
    if ! command -v runsc >/dev/null; then
        ARCH="$(uname -m)"
        URL="https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}"
        curl -fsSL "$URL/runsc" -o /usr/local/bin/runsc
        curl -fsSL "$URL/containerd-shim-runsc-v1" -o /usr/local/bin/containerd-shim-runsc-v1
        chmod +x /usr/local/bin/runsc /usr/local/bin/containerd-shim-runsc-v1
    fi
    /usr/local/bin/runsc install   # registers the runtime in /etc/docker/daemon.json
    systemctl restart docker
    echo "    gVisor installed. Set WORKSPACE_OCI_RUNTIME=runsc in the backend's environment."
fi

echo "==> Workspace network ($NET, $SUBNET)"
if ! docker network inspect "$NET" >/dev/null 2>&1; then
    docker network create --driver bridge --subnet "$SUBNET" --gateway "${SUBNET%.*.*}.0.1" \
        --label aptrun.managed=1 "$NET"
fi

echo "==> Firewall"
WORKSPACE_SUBNET="$SUBNET" GATEWAY_IP="$GATEWAY_IP" "$HERE/host-firewall.sh"

cat >/etc/systemd/system/aptrun-workspace-firewall.service <<UNIT
[Unit]
Description=AptRun workspace network isolation
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
Environment=WORKSPACE_SUBNET=$SUBNET
Environment=GATEWAY_IP=$GATEWAY_IP
ExecStart=$HERE/host-firewall.sh

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable aptrun-workspace-firewall.service

echo "==> Control-plane access (deploy user)"
if ! id deploy >/dev/null 2>&1; then
    useradd -m -s /bin/bash deploy
fi
usermod -aG docker deploy   # NOTE: membership of the docker group is root-equivalent on this host. The host holds nothing but student workspaces.
if [ -n "$DEPLOY_KEY" ]; then
    install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
    grep -qxF "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys 2>/dev/null || echo "$DEPLOY_KEY" >>/home/deploy/.ssh/authorized_keys
    chown deploy:deploy /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys
fi

cat <<DONE

Host is ready. Next:
  1. Build or pull the image:      $HERE/build-image.sh full       (tag it aptrun/workspace:latest)
  2. Configure + start the gateway: cd $HERE && cp .env.example .env && \$EDITOR .env && docker compose up -d --build
  3. Verify isolation:              $HERE/verify-isolation.sh
  4. In the backend's environment:
       WORKSPACE_HOSTS='[{"name":"ws-1","docker_host":"ssh://deploy@THIS_HOST","capacity":24,"domain":"<WORKSPACE_DOMAIN>","scheme":"https"}]'
       WORKSPACE_IMAGE=aptrun/workspace:latest
       # with gVisor:  WORKSPACE_OCI_RUNTIME=runsc
DONE

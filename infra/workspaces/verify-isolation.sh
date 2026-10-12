#!/usr/bin/env bash
# Proves the isolation promises instead of assuming them. Run on the workspace host
# AFTER host-bootstrap.sh / host-firewall.sh. It starts two throwaway workspace
# containers with exactly the flags the app uses, then attacks from inside one.
#
#   infra/workspaces/verify-isolation.sh [image]
#
# Exits non-zero if anything that should be blocked is reachable. On Docker Desktop
# (a developer laptop) the network checks are expected to FAIL: the firewall is a
# property of the Linux host, not of the image.
set -uo pipefail

IMAGE="${1:-aptrun/workspace:latest}"
NET="${WORKSPACE_NETWORK:-aptrun-workspaces}"
SUBNET_GW="${WORKSPACE_GATEWAY:-172.30.0.1}"
A="isolation-test-a-$$"
B="isolation-test-b-$$"
FAILS=0

flags=(--detach --network "$NET" --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges:true
       --memory 512m --pids-limit 256 --env CONNECTION_TOKEN=isolation-test)

cleanup() { docker rm -f "$A" "$B" >/dev/null 2>&1; }
trap cleanup EXIT

check() { # description, expected (blocked|allowed), command...
    local desc="$1" expect="$2"; shift 2
    if docker exec "$A" "$@" >/dev/null 2>&1; then got=allowed; else got=blocked; fi
    if [ "$got" = "$expect" ]; then printf '  PASS  %s\n' "$desc"; else printf '  FAIL  %s  (expected %s, was %s)\n' "$desc" "$expect" "$got"; FAILS=$((FAILS + 1)); fi
}

echo "Starting two test workspaces on network '$NET'…"
docker run "${flags[@]}" --name "$A" "$IMAGE" >/dev/null || { echo "could not start container A"; exit 2; }
docker run "${flags[@]}" --name "$B" "$IMAGE" >/dev/null || { echo "could not start container B"; exit 2; }
sleep 6
B_IP="$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" "$B")"

echo "Container flags"
check "runs as a non-root user"                      allowed  sh -c '[ "$(id -u)" = 1000 ]'
check "has no capabilities (CapEff is zero)"         allowed  sh -c 'grep -q "^CapEff:\s*0000000000000000" /proc/self/status'
check "cannot gain privileges (setuid is inert)"     allowed  sh -c 'grep -q "^NoNewPrivs:\s*1" /proc/self/status'
check "cannot write system files"                    blocked  sh -c 'touch /etc/aptrun-test'

echo "Network isolation"
check "cannot reach ANOTHER workspace ($B_IP:13370)" blocked  nc -z -w 3 "$B_IP" 13370
check "cannot reach the host ($SUBNET_GW:22)"         blocked  nc -z -w 3 "$SUBNET_GW" 22
check "cannot reach the cloud metadata service"      blocked  curl -s -m 4 -o /dev/null http://169.254.169.254/
check "cannot reach a private network (10.0.0.1)"    blocked  nc -z -w 3 10.0.0.1 80
check "cannot send mail (smtp.gmail.com:587)"        blocked  nc -z -w 4 smtp.gmail.com 587
check "CAN reach the internet (npm registry)"        allowed  curl -s -m 8 -o /dev/null https://registry.npmjs.org/

echo
if [ "$FAILS" -eq 0 ]; then echo "All isolation checks passed."; else echo "$FAILS check(s) FAILED — do not put students on this host yet."; exit 1; fi

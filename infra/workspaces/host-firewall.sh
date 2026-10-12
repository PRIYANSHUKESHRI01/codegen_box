#!/usr/bin/env bash
# Network isolation for student workspaces. Run as root on the workspace host
# (host-bootstrap.sh does it, and re-run it after a reboot — it is idempotent).
#
# A student's container is running arbitrary code. Out of the box Docker lets it:
#   - talk to every OTHER student's container on the same network,
#   - reach the host itself and anything on the host's private network,
#   - read the cloud provider's instance-metadata service (which holds credentials),
#   - send mail (spam) from your IP.
# This script closes all four, and leaves the public internet open (npm, composer, pip).
#
# It only touches the DOCKER-USER chain (which Docker never rewrites) and INPUT for
# the workspace subnet, and tags every rule with a comment so it can be removed cleanly.
#
# Order matters and is explicit: Docker's DOCKER-USER chain ends in a catch-all
# RETURN, so a rule APPENDED with -A would sit after it and never run. Every rule
# here is INSERTED at a fixed position, top to bottom, in the order it is written.
set -euo pipefail

SUBNET="${WORKSPACE_SUBNET:-172.30.0.0/16}"
GATEWAY_IP="${GATEWAY_IP:-172.30.0.2}"
TAG="aptrun-workspaces"

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

# Remove our previous rules (identified by comment) so re-running never stacks duplicates.
for chain in DOCKER-USER INPUT; do
    while iptables -S "$chain" 2>/dev/null | grep -q -- "--comment $TAG"; do
        rule="$(iptables -S "$chain" | grep -- "--comment $TAG" | head -1 | sed "s/^-A /-D /")"
        # shellcheck disable=SC2086
        eval "iptables $rule"
    done
done

# Create DOCKER-USER if Docker has not (it exists whenever dockerd has run once).
iptables -N DOCKER-USER 2>/dev/null || true

fwd_pos=1
fwd() { iptables -I DOCKER-USER "$fwd_pos" "$@" -m comment --comment "$TAG"; fwd_pos=$((fwd_pos + 1)); }

# ── Containers (the FORWARD path, via DOCKER-USER), first match wins ───────────
# 1. Replies to connections that were allowed are always fine.
fwd -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN

# 2. The gateway may reach any workspace — that is how the editor and previews are served.
fwd -s "$GATEWAY_IP" -d "$SUBNET" -j RETURN

# 3. Nothing else may: workspace ↔ workspace is dropped, so one student cannot scan another's dev server.
fwd -s "$SUBNET" -d "$SUBNET" -j DROP

# 4. Private networks, link-local (the cloud metadata service is 169.254.169.254),
#    carrier-grade NAT and loopback. (172.16.0.0/12 contains the workspace subnet
#    itself, which is why rules 1–3 come first.)
for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10 127.0.0.0/8; do
    fwd -s "$SUBNET" -d "$net" -j DROP
done

# 5. Outbound mail — a free workspace must not become a spam relay.
fwd -s "$SUBNET" -p tcp -m multiport --dports 25,465,587,2525 -j DROP

# Everything else (the public internet) falls through to Docker's own RETURN and is allowed.

# ── Towards the host itself (the INPUT path) ───────────────────────────────────
# A workspace has no business talking to the host's own services (SSH, the Docker API, …).
in_pos=1
inp() { iptables -I INPUT "$in_pos" "$@" -m comment --comment "$TAG"; in_pos=$((in_pos + 1)); }

inp -s "$SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
inp -s "$GATEWAY_IP" -j ACCEPT
inp -s "$SUBNET" -j DROP

echo "Workspace network rules applied for $SUBNET (gateway $GATEWAY_IP)."
echo
iptables -S DOCKER-USER | grep -- "--comment $TAG" || true
echo
echo "Persist them across reboots: install iptables-persistent, or run this script from a systemd unit after docker.service."
echo "Verify:  infra/workspaces/verify-isolation.sh"

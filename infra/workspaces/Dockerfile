# syntax=docker/dockerfile:1.7
#
# aptrun/workspace — the student's browser VS Code for Project Lab.
#
# One image, two flavours:
#   FLAVOR=full  Node, PHP/Composer, Python, Java/Maven, MariaDB, PostgreSQL, Redis, SQLite (~3.5 GB). Production.
#   FLAVOR=lite  Node, PHP/Composer, Python, SQLite (~1.3 GB). For a laptop or a quick end-to-end check.
#
# Build:  infra/workspaces/build-image.sh [full|lite]      (or build-image.ps1 on Windows)
#
# The container runs as uid 1000 ("coder") with HOME=/home/workspace. That
# directory is the student's persistent volume; everything else is disposable
# and replaced whenever the image is upgraded. See docs/project-lab.md.

FROM ubuntu:24.04

ARG FLAVOR=full
ARG OPENVSCODE_VERSION=1.109.5
ARG NODE_VERSION=20.20.2

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    HOME=/home/workspace \
    IDE_PORT=13370 \
    NPM_CONFIG_PREFIX=/home/workspace/.npm-global \
    PATH=/home/workspace/.npm-global/bin:/home/workspace/.composer/vendor/bin:/home/workspace/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

# Services (mariadb, postgres, redis) must neither start nor fail while the image builds.
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod +x /usr/sbin/policy-rc.d

# ── Base tools, PHP, Python ───────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl wget git openssh-client gnupg unzip zip xz-utils jq less nano vim-tiny \
        procps iproute2 iputils-ping dnsutils netcat-openbsd tree bash-completion locales tzdata \
        build-essential pkg-config \
        python3 python3-pip python3-venv python3-dev \
        php-cli php-mbstring php-xml php-curl php-zip php-sqlite3 php-mysql php-pgsql php-gd php-intl php-bcmath php-redis \
        sqlite3 libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Full flavour: Java + the database servers ─────────────────────────────────
RUN if [ "$FLAVOR" = "full" ]; then \
        apt-get update && apt-get install -y --no-install-recommends \
            openjdk-21-jdk-headless maven \
            mariadb-server postgresql redis-server \
        && rm -rf /var/lib/apt/lists/* \
        # Never auto-run as services; the student starts what they need with `lab-db`.
        && rm -rf /var/lib/mysql /var/lib/postgresql/*/main /etc/redis/redis.conf.dpkg-dist; \
    fi

# ── Node (tarball: deterministic, and the same on amd64 and arm64) ────────────
RUN set -eux; \
    case "$(dpkg --print-architecture)" in amd64) N=x64 ;; arm64) N=arm64 ;; *) echo "unsupported arch" >&2; exit 1 ;; esac; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${N}.tar.xz" | tar -xJ -C /usr/local --strip-components=1; \
    corepack enable; \
    node --version; npm --version

# ── Composer ──────────────────────────────────────────────────────────────────
RUN curl -fsSL https://getcomposer.org/download/latest-stable/composer.phar -o /usr/local/bin/composer \
    && chmod +x /usr/local/bin/composer && composer --version

# ── OpenVSCode Server (MIT; upstream VS Code in the browser) ──────────────────
RUN set -eux; \
    case "$(dpkg --print-architecture)" in amd64) A=x64 ;; arm64) A=arm64 ;; esac; \
    curl -fsSL "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-${A}.tar.gz" \
        | tar -xz -C /opt; \
    mv /opt/openvscode-server-v* /opt/openvscode-server

# ── The workspace user ────────────────────────────────────────────────────────
# ubuntu:24.04 ships a user "ubuntu" at uid 1000; it makes way for ours.
RUN userdel -r ubuntu 2>/dev/null || true; \
    groupadd -g 1000 coder; \
    useradd -u 1000 -g 1000 -d /home/workspace -m -s /bin/bash coder

# ── The curated extension set (Open VSX), baked into a READ-ONLY folder ──────────
# Students write the code themselves, and an AI-autocomplete extension would write it for them with no paste at
# all. So the set is fixed here: the server runs with --extensions-dir /opt/aptrun-extensions, which the workspace
# user (coder) cannot write to, so the Extensions panel, `code --install-extension` in the terminal and "Install
# from VSIX" all fail. (The Marketplace itself is removed from product.json below.)
# One id at a time, each allowed to fail: a missing extension must not fail the whole build.
COPY extensions.txt /tmp/extensions.txt
RUN set -eu; mkdir -p /opt/aptrun-extensions; \
    while read -r ext flavor; do \
        case "$ext" in ''|\#*) continue ;; esac; \
        if [ "${flavor:-all}" = "full" ] && [ "$FLAVOR" != "full" ]; then continue; fi; \
        /opt/openvscode-server/bin/openvscode-server --extensions-dir /opt/aptrun-extensions --install-extension "$ext" \
            || echo "WARN: could not install $ext (skipped)"; \
    done < /tmp/extensions.txt; \
    rm -f /tmp/extensions.txt; \
    chown -R root:root /opt/aptrun-extensions; \
    chmod -R a+rX,go-w /opt/aptrun-extensions

# ── Defaults ──────────────────────────────────────────────────────────────────
# Folder-level VS Code settings, copied into a new workspace on first start (see entrypoint.sh).
# They are window-scoped on purpose: the web client keeps a user's own settings in the BROWSER, which no
# server-side file can reach, but settings in the opened folder apply to everyone who opens it.
COPY workspace-settings.json /opt/workspace-settings.json
# Platform-owned editor settings (no AI chat panel, no tips), rewritten on every start by entrypoint.sh.
COPY machine-settings.json /opt/machine-settings.json

# The AI chat agent that ships with the server is removed: it would only be a panel that cannot sign in. The
# extension Marketplace is removed too (after the build-time installs above): see the curated set.
RUN jq 'del(.defaultChatAgent) | del(.extensionsGallery)' /opt/openvscode-server/product.json > /tmp/product.json \
    && mv /tmp/product.json /opt/openvscode-server/product.json

# The browser client decides its first-launch layout BEFORE the server's settings reach it, so on a brand-new
# workspace it opened an AI chat panel that cannot sign in (about 4 launches in 5) and a generic "Get Started with
# VS Code for the Web" tab, even with both set in machine-settings.json. Change the shipped defaults instead of
# racing them. The build fails if a VS Code upgrade changes this text, so a version bump cannot silently bring either back.
RUN python3 - <<'PY'
import re, sys
path = "/opt/openvscode-server/out/vs/code/browser/workbench/workbench.js"
text = open(path, encoding="utf-8").read()

def set_default(key, old, new):
    global text
    anchor = '"%s":{' % key
    if text.count(anchor) != 1:
        sys.exit("VS Code changed: expected one registration of %s, found %d" % (key, text.count(anchor)))
    start = text.index(anchor)
    end = text.find("}", start)  # the registration object ends at its first closing brace
    block = text[start:end]
    needle = 'default:"%s"' % old
    if block.count(needle) != 1:
        sys.exit("VS Code changed: %s no longer defaults to %s" % (key, old))
    text = text[:start] + block.replace(needle, 'default:"%s"' % new) + text[end:]

set_default("workbench.secondarySideBar.defaultVisibility", "visibleInWorkspace", "hidden")
set_default("workbench.startupEditor", "welcomePage", "none")

# chat.disableAIFeatures is registered under a minified constant, so it is matched by shape: default false -> true.
# That one switch removes the chat panel, the title-bar chat button, the "Open Chat" hint and the Copilot status icon.
ai_off = re.compile(r'(\[\w+\.AIDisabled\]:\{type:"boolean",description:d\(\d+,null\),default:)!1(,scope:4\})')
if len(ai_off.findall(text)) != 1:
    sys.exit("VS Code changed: cannot find the chat.disableAIFeatures registration")
text = ai_off.sub(lambda m: m.group(1) + "!0" + m.group(2), text)
open(path, "w", encoding="utf-8").write(text)
PY

# ── The authorship guard ──────────────────────────────────────────────────────
# Loaded by the editor page BEFORE VS Code starts: text can be pasted only if it was copied inside the workspace
# (or is a command from a SOW bash block). See guard/aptrun-guard.js and docs/project-lab.md. The `?v=` hash makes
# browsers fetch a new guard whenever it changes. The build fails if a VS Code upgrade changes the page template.
COPY guard/aptrun-guard.js /opt/openvscode-server/out/vs/code/browser/workbench/aptrun-guard.js
RUN python3 - <<'PY'
import hashlib, sys
root = "/opt/openvscode-server/out/vs/code/browser/workbench/"
version = hashlib.sha256(open(root + "aptrun-guard.js", "rb").read()).hexdigest()[:12]
html = open(root + "workbench.html", encoding="utf-8").read()
anchor = '<meta charset="utf-8" />'
if html.count(anchor) != 1 or "aptrun-guard" in html:
    sys.exit("VS Code changed: workbench.html no longer has the expected <head> to load the guard from")
tag = '<script src="{{WORKBENCH_WEB_BASE_URL}}/out/vs/code/browser/workbench/aptrun-guard.js?v=%s"></script>' % version
html = html.replace(anchor, anchor + "\n\t\t<!-- AptRun authorship guard: must run before the workbench starts -->\n\t\t" + tag, 1)
open(root + "workbench.html", "w", encoding="utf-8").write(html)
print("guard version", version)
PY
RUN chmod a+r /opt/openvscode-server/out/vs/code/browser/workbench/aptrun-guard.js

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY lab-db /usr/local/bin/lab-db
COPY lab-db.cnf /etc/mysql/mariadb.conf.d/99-lab.cnf
# `sed` strips carriage returns: a Windows checkout turns `#!/bin/bash` into `#!/bin/bash\r`, and then the container
# dies with "exec ... No such file or directory". (.gitattributes asks for LF, but a build must not depend on it.)
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh /usr/local/bin/lab-db /etc/mysql/mariadb.conf.d/99-lab.cnf \
    && chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/lab-db \
    && mkdir -p /etc/mysql/mariadb.conf.d \
    && git config --system init.defaultBranch main \
    && git config --system --add safe.directory '*' \
    && printf '\n# AptRun workspace\nexport PS1="\\[\\e[1;36m\\]\\w\\[\\e[0m\\] \\$ "\nalias ll="ls -alF"\n' >> /home/workspace/.bashrc \
    && chown -R coder:coder /home/workspace

USER coder
WORKDIR /home/workspace
EXPOSE 13370

# Any HTTP answer (even 403 for a missing token) proves the server is up; 000 means it isn't listening yet.
HEALTHCHECK --interval=3s --timeout=3s --start-period=5s --retries=40 \
    CMD curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${IDE_PORT}/version" | grep -qv '^000$'

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

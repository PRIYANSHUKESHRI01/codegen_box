#!/bin/sh
# Idempotently give Piston's Java launcher judge-friendly JVM flags.
#
# Piston runs `java Main.java` (source-launcher mode: javac runs in-process on
# every submission). With default flags the JVM starts one GC/JIT thread per
# core, so CPU cost grows with the host: a trivial program measured 0.97-1.5
# CPU-s on an idle 8-thread host and 2-3 s when the host was busy (one run was
# killed at 3034 ms by Piston's default 3 s cap). Serial GC + 2 JIT threads cut
# it by about a third (A/B against the stock launcher on the same idle host,
# 4 runs each: 0.97-1.52 CPU-s -> 0.69-1.0 CPU-s) while keeping the optimising
# JIT, so genuinely heavy solutions still run fast.
#
# Usage:  docker compose exec -T piston-1 sh -s < patch-java-runtime.sh
#   (TARGET_FILE overrides the file to patch — used by tests.)
FLAGS='-XX:+UseSerialGC -XX:CICompilerCount=2 -Xshare:auto -XX:-UsePerfData'
f="${TARGET_FILE:-/piston/packages/java/15.0.2/run}"

[ -f "$f" ] || { echo "java runtime not installed at $f - install it first"; exit 0; }
grep -q 'UseSerialGC' "$f" && { echo "java launcher already tuned"; exit 0; }

sed -i "s#^java \$filename#java $FLAGS \$filename#" "$f"
grep -q 'UseSerialGC' "$f" && echo "java launcher tuned" || { echo "FAILED to patch $f (launcher format changed?)"; exit 1; }

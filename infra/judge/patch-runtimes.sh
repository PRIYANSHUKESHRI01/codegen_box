#!/bin/sh
# Idempotently tunes the Piston packages whose stock behaviour doesn't suit a judge. Companion to
# patch-java-runtime.sh (which does the same for Java); install-runtimes.sh runs both on every node.
#
# Usage:  docker compose exec -T piston-1 sh -s < patch-runtimes.sh
#   (PACKAGES_DIR overrides /piston/packages — used by tests.)
#
# KOTLIN and SCALA — a JVM per compile AND per run, and a compiler is a *big* JVM program. With default flags
# the JVM starts a GC/JIT thread per core and burns CPU several times faster than the clock: measured on an
# 8-thread host, `kotlinc` on a 30-line file took 15 s wall / 34.7 CPU-seconds and `scalac` 7.5 s / 25.3 CPU-s
# — over Piston's 15 s CPU ceiling after only ~6 s of real time, so every submission died as "compilation
# stopped". Serial GC + the C1-only JIT (a compiler runs for seconds; C2 never pays for itself) brought them to
# 7.6 and 6.2 CPU-seconds. Both launchers read JAVA_OPTS, and Piston loads a package's `.env` as the compile/run
# environment, so that is where the compile flags go. The *run* step is a plain `java -jar`, which ignores
# JAVA_OPTS, so its launcher line is rewritten — with the same flags patch-java-runtime.sh gives Java (the
# optimising JIT is kept: a student's solution may genuinely be CPU-heavy).
#
# TYPESCRIPT — Piston runs a bare `tsc *.ts`, which targets ES5 with only the ES5 library: `Map`, `Set` and
# for-of over them (all ordinary in a DSA solution) don't type-check. Compile for ES2020 as CommonJS (what
# `node` runs a script as).
PKGS="${PACKAGES_DIR:-/piston/packages}"
COMPILE_OPTS='-Xmx256M -Xms32M -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:CICompilerCount=1 -Xshare:auto -XX:-UsePerfData'
RUN_OPTS='-XX:+UseSerialGC -XX:CICompilerCount=2 -Xshare:auto -XX:-UsePerfData'
status=0

# tune_jvm <package> <version> <jar the run script launches>
tune_jvm() {
  name=$1; version=$2; jar=$3
  dir="$PKGS/$name/$version"
  if [ ! -d "$dir" ]; then echo "$name $version not installed at $dir - install it first"; return; fi

  if grep -q '^JAVA_OPTS=' "$dir/.env"; then
    echo "$name: compile flags already set"
  else
    printf '\nJAVA_OPTS=%s\n' "$COMPILE_OPTS" >> "$dir/.env"
    grep -q '^JAVA_OPTS=' "$dir/.env" && echo "$name: compile flags set" || { echo "FAILED to set JAVA_OPTS for $name"; status=1; }
  fi

  if grep -q 'UseSerialGC' "$dir/run"; then
    echo "$name: run launcher already tuned"
  else
    sed -i "s#^java -jar $jar#java $RUN_OPTS -jar $jar#" "$dir/run"
    grep -q 'UseSerialGC' "$dir/run" && echo "$name: run launcher tuned" || { echo "FAILED to patch $dir/run (launcher format changed?)"; status=1; }
  fi
}

tune_jvm kotlin 1.8.20 code.jar
tune_jvm scala 3.2.2 out.jar

# SCALA also swallows its own compile errors: the package's compile script carries on after a failed `scalac` to
# build the jar manifest, `jar ufm` then creates a stub jar and exits 0, and the student sees a confusing
# "could not find or load main class" at run time instead of the compiler's message. Stop at the failure.
# And scalac colours its diagnostics with ANSI escape codes even when its output is not a terminal; the student
# sees those as garbage, so turn the colour off.
scala_compile="$PKGS/scala/3.2.2/compile"
if [ -f "$scala_compile" ]; then
  if grep -q '^scalac -color:never .* || exit 1' "$scala_compile"; then
    echo "scala: compile errors already stop the build"
  else
    sed -i 's#^scalac .*#scalac -color:never "$@" -d out.jar || exit 1#' "$scala_compile"
    grep -q '^scalac -color:never .* || exit 1' "$scala_compile" && echo "scala: compile errors now stop the build (compiler set)" || { echo "FAILED to patch $scala_compile (compile script format changed?)"; status=1; }
  fi
fi

ts="$PKGS/typescript/5.0.3/compile"
if [ ! -f "$ts" ]; then
  echo "typescript 5.0.3 not installed at $ts - install it first"
elif grep -q -- '--skipLibCheck' "$ts"; then
  echo "typescript: compiler already targets ES2020"
else
  # --skipLibCheck: don't re-type-check TypeScript's own (large) lib .d.ts files on every submission; it saves
  # about a third of the compile CPU and cannot change a diagnostic about the student's code.
  sed -i 's#^tsc .*\*\.ts#tsc --target es2020 --module commonjs --skipLibCheck *.ts#' "$ts"
  grep -q -- '--skipLibCheck' "$ts" && echo "typescript: compiler set to ES2020" || { echo "FAILED to patch $ts (compile script format changed?)"; status=1; }
fi

exit $status

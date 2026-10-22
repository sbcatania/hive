#!/bin/sh
# Builds the arena: test/arena.sh <out> <A source> "<A cflags>" <B source> "<B cflags>"
# e.g. test/arena.sh build/arena src/ai.c "" test/ai_v1.c ""
set -e
OUT=$1; AS=$2; AF=$3; BS=$4; BF=$5
ROOT=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p /tmp/hivegb
T=$(mktemp -d /tmp/hivegb/arena.XXXXXX)
ren() { echo "-Dai_choose=$1_ai_choose -Drng_state=$1_rng_state -Drnd8=$1_rnd8 -Dai_progress=$1_ai_progress -Dlast_work=$1_last_work"; }
/usr/bin/cc -O2 -c -I"$ROOT/src" $(ren A) $AF -o "$T/a.o" "$AS"
/usr/bin/cc -O2 -c -I"$ROOT/src" $(ren B) $BF -o "$T/b.o" "$BS"
/usr/bin/cc -O2 -c -o "$T/stub.o" -x c - <<'C'
#include <stdint.h>
__attribute__((weak)) uint16_t A_last_work, B_last_work, A_work_total, B_work_total;
C
/usr/bin/cc -O2 -o "$OUT" "$ROOT/test/arena.c" "$ROOT/src/rules.c" "$T/a.o" "$T/b.o" "$T/stub.o"
rm -rf "$T"

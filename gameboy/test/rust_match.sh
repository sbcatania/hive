#!/bin/sh
# Plays C AI builds against the reference Rust engine (read-only use of
# /Users/scatania/Dev/hive/engine). Usage: test/rust_match.sh <games> "<rust_level>:<ms> ..."
# Compares the current src/ai.c (HARD and NORMAL) with test/ai_v1.c (old HARD).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
T=/tmp/hivegb/rust
mkdir -p "$T"
G=${1:-100}
LEVELS=${2:-"easy:100 medium:100 hard:20"}
(cd "$ROOT/test/rustarena" && CARGO_TARGET_DIR="$T/target" cargo build --release --offline -q)
/usr/bin/cc -O2 -o "$T/cp_new" "$ROOT/test/cplayer.c" "$ROOT/src/rules.c" "$ROOT/src/ai.c"
/usr/bin/cc -O2 -I"$ROOT/src" -o "$T/cp_v1" "$ROOT/test/cplayer.c" "$ROOT/src/rules.c" "$ROOT/test/ai_v1.c"
for lv in $LEVELS; do
    l=${lv%%:*}; ms=${lv##*:}
    for who in "new 2 HARD-new" "v1 2 HARD-old" "new 1 NORMAL"; do
        set -- $who
        (r=$("$T/target/release/rustarena" "$T/cp_$1" "$2" "$l" "$ms" "$G" 1 2>/dev/null); echo "$3: $r") &
    done
done
wait

#!/bin/sh
# Builds build/hive.gbc: a 32 KiB, ROM-only (no mapper), Game Boy Color-only ROM.
# GBDK's lcc crashes on long paths and paths with spaces, so compile in a short
# temporary directory and copy the result back.
set -e
GBDK=${GBDK:-$HOME/gbdk}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d /tmp/hivegbc.XXXXXX)
cp "$ROOT"/src/*.c "$ROOT"/src/*.h "$TMP"/
(cd "$TMP" && "$GBDK/bin/lcc" -Wl-m -Wm-yC -Wm-ynHIVE -Wf--max-allocs-per-node50000 \
    -o hive.gbc main.c rules.c ai.c assets.c)
mkdir -p "$ROOT/build"
cp "$TMP/hive.gbc" "$TMP/hive.map" "$TMP/hive.noi" "$ROOT/build/" 2>/dev/null || cp "$TMP/hive.gbc" "$TMP/hive.map" "$ROOT/build/"
rm -rf "$TMP"
"$GBDK/bin/romusage" "$ROOT/build/hive.map" -g | tail -12

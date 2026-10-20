#!/usr/bin/env bash
# Builds the Rust engine to WebAssembly and writes the JS bindings to web/src/wasm.
# Requires: rustup target add wasm32-unknown-unknown
#           cargo install wasm-bindgen-cli --version <same as wasm-bindgen in Cargo.lock>
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"
cargo build -p hive-engine --release --target wasm32-unknown-unknown --features wasm
wasm-bindgen --target web --out-dir web/src/wasm --out-name hive_engine \
  target/wasm32-unknown-unknown/release/hive_engine.wasm
if command -v wasm-opt >/dev/null; then
  wasm-opt -O3 --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int \
    web/src/wasm/hive_engine_bg.wasm -o web/src/wasm/hive_engine_bg.wasm
fi
cp web/src/wasm/hive_engine_bg.wasm web/public/wasm/hive_engine_bg.wasm
ls -la web/src/wasm web/public/wasm

GBDK ?= $(HOME)/gbdk

build/hive.gbc: src/*.c src/*.h
	GBDK=$(GBDK) ./scripts/build.sh

src/assets.c src/assets.h: tools/gen_assets.py
	python3 tools/gen_assets.py

# Random games from the web version's Rust engine, used as the rules oracle.
test/rust_games.txt: test/rustdump/src/main.rs ../engine/src/*.rs
	cargo run --release -q --manifest-path test/rustdump/Cargo.toml -- 300 > $@

test: test/rust_games.txt
	mkdir -p build
	/usr/bin/cc -O2 -Wall -DNO_SPAN_LIMIT -o build/host_test test/host_test.c src/rules.c
	./build/host_test test/rust_games.txt
	/usr/bin/cc -O2 -Wall -o build/filter_test test/filter_test.c src/rules.c
	./build/filter_test
	/usr/bin/cc -O2 -Wall -o build/span_test test/span_test.c src/rules.c
	./build/span_test

clean:
	rm -rf build

.PHONY: test clean

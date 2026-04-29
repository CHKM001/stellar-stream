setup:
	rustup target add wasm32-unknown-unknown
	cargo fetch
	cargo build --target wasm32-unknown-unknown

test:
	cargo test --locked
# Frozen v1 protocol fixtures

These test-only gzip files are copied from the read-only frozen protocol worktree.
They are excluded from npm/JSR releases. They are data drivers, not deployable
contracts. Tests exercise their actual WASM encode/decode implementations.

Reference HEAD: `4e7eff846445a80160804e6e99ab3f0c7d957dfd` (`fix/frozen-verification`). Sources:

- `contracts/crates/dusk-domains-types/tests/fixtures/frozen-v1.json`
- `contracts/crates/dusk-domains-types/tests/fixtures/frozen-v1-max.json`
- `contracts/crates/dusk-domains-marketplace-v1/tests/market-v1.json`
- `target/frozen-drivers/wasm32-unknown-unknown/release/*.wasm`

`drivers.json` pins each uncompressed WASM's SHA-256 and byte count. The source
`schema.rs` SHA-256 is
`2ee0be6fbbc3596f82b7b2dc1348402f6d22b90245661ee65c69a4bc4e5a9eae`;
shared `driver.rs` is
`38dd40c8a4aac0b49612a665a901a86f5eb0d4a2af24f4418a3f29047c48372e`.
The digest tests additionally transcribe pinned results from
`dusk-domains-types/tests/frozen_wire.rs`.

Refresh fixtures from reviewed protocol output; never download deployment drivers
inside the test suite. Production drivers always come from the release manifest
and are hash-verified before instantiation.

# Frozen v1 protocol fixtures

These test-only gzip files are copied from the read-only frozen protocol worktree.
They are excluded from npm/JSR releases. They are data drivers, not deployable
contracts. Tests exercise their actual WASM encode/decode implementations.

Reference HEAD: `766e73d161dc0ae71575b200fa500100eb9e2288` (logic port code `e7fdcf5`). Sources:

- `contracts/crates/dusk-domains-types/tests/fixtures/frozen-v1.json`
- `contracts/crates/dusk-domains-types/tests/fixtures/frozen-v1-max.json`
- `contracts/crates/dusk-domains-marketplace-v1/tests/market-v1.json`
- `target/frozen-drivers/wasm32-unknown-unknown/release/*.wasm`

`drivers.json` pins each uncompressed WASM's SHA-256 and byte count. The source
`schema.rs` SHA-256 is
`b8e26e3dc5a7caf729e5fc7e18b64db3921ab155c94b0b79c0d0f27e13a7f9a7`;
shared `driver.rs` is
`cb982a8a38bee7bf13588b25b091dd2788edd4d496aede0e41ba01760c9bd7fc`.
The digest tests additionally transcribe pinned results from
`dusk-domains-types/tests/frozen_wire.rs`.

Refresh fixtures from reviewed protocol output; never download deployment drivers
inside the test suite. Production drivers always come from the release manifest
and are hash-verified before instantiation.

# Frozen v1 protocol fixtures

These test-only gzip files are copied from the read-only frozen protocol worktree.
They are excluded from npm/JSR releases. They are data drivers, not deployable
contracts. Tests exercise their actual WASM encode/decode implementations.

Reference HEAD: `d18f0a65bbb23e637b1028dfd8dbc3b464a53566` (the worktree also
contains the frozen implementation). Sources:

- `contracts/crates/dusk-domains-types/tests/fixtures/frozen-v1.json`
- `contracts/crates/dusk-domains-types/tests/fixtures/frozen-v1-max.json`
- `contracts/crates/dusk-domains-marketplace-v1/tests/market-v1.json`
- `target/frozen-drivers/wasm32-unknown-unknown/release/*.wasm`

`drivers.json` pins each uncompressed WASM's SHA-256 and byte count. The source
`schema.rs` SHA-256 is
`5ef5900d8f17d80cbb8b0228fc94667662bb90a0204f0727c811d1984c7f4773`;
shared `driver.rs` is
`3e60f1b107f2a143525601a6c8917f46dcefe531216c88a974f1dcee99fc9263`.
The digest tests additionally transcribe pinned results from
`dusk-domains-types/tests/frozen_wire.rs`.

Refresh fixtures from reviewed protocol output; never download deployment drivers
inside the test suite. Production drivers always come from the release manifest
and are hash-verified before instantiation.

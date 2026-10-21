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

`primary-verification.json.gz` contains binary node replies produced by
`primary-verification.rs` using the same pinned protocol types and `wire::encode`.
Its authority expectations independently transcribe the pinned store's
`src/entrypoints/records.rs::resolve_primary` predicate; these are read fixtures,
not contract execution traces. The SDK regression tests use the real WASM drivers
for input encoding, input decoding and output decoding, with a simulated transport.

To regenerate, copy `primary-verification.rs` into
`contracts/crates/dusk-domains-types/examples/` in an isolated checkout of the
reference revision, run `cargo run -p dusk-domains-types --example primary-verification
--features serde` from `contracts`, and gzip stdout with `gzip -n`.

## Multicall

`multicall.wasm.gz` and `multicall-driver.wasm.gz` are the Multicall for Dusk v0.1.0 release
assets (SHA-256 `65f77a27…` and `d2ed9e7b…` uncompressed), `multicall-vectors.json` its
`tests/vectors.json`. The SDK ships neither Wasm: tests check its hand codec against the driver.
`multicall-testnet.json.gz` is one `aggregate` the deployed contract answered on testnet, against
the ab905e64 rehearsal stack, with each call read directly at the same block.

## Launch policy

`launch-policy.wasm.gz` and `launch-policy-driver.wasm.gz` are the launch policy, which releases 1- and
2-character roots, as protocol `feat/short-name-launch-policy` (d42877d2) builds it:
`target/frozen-contracts/wasm32-unknown-unknown/release/dusk_domains_policy.wasm`, the contract, BLAKE3
`fc0bf306…` (its code hash), 151,729 bytes; and
`target/frozen-drivers/wasm32-unknown-unknown/release/dusk_domains_policy.wasm`, its data driver,
SHA-256 `4d4d3d4e…`, 1,624,064 bytes. Both gzip `-n -9`.

## Read lens

The lens fixtures come from the deployed testnet lens, not from this repository:

- `lens.wasm.gz`: the lens data driver, `dusk-domains-lens` built with `data-driver-js`
  from protocol `feat/read-lens` (9a89d6e2): SHA-256
  `63198ec4b085d2c97b571adf77eecf9f49a2a5663dd4470d0c0e96a3ec8779ad`, 364,299 bytes,
  as the testnet deployment handoff pins it. Its contract WASM is `f4a86245…`.
- `testnet-lens-golden.json.gz` (`dusk-domains/lens-golden/v1`): arguments and replies,
  as rkyv hex and decoded JSON, read from testnet lens
  `0x9a0dd8847fa6d7ad5ad4f905d59b83181521259a8d23fbbda9b1ec9373b2c2ed` at height 4,618,370,
  with the lens's init argument and `initHash`.
- `testnet-release.json`: the SDK fields of the testnet rehearsal release that lens is
  bound to (protocol 686f2501, directory `0x7d2544d3…`, network 2), and the lens
  deployment handoff's SDK `lens` entry and `init`, `initArchive` and `initHash`.

The tests decode every golden with the real driver, recompute the init commitment, and run
the SDK's evidence checks and a client on the real replies.

## Renewal exactness

`renewal-exactness.json.gz` (`dusk-domains/renewal-exactness/v1`, 254 states, pinned by its
SHA-256 in `tests/renewal-exactness.test.ts`) is what protocol `ab905e64`'s own code answers:
the store's `get_name`, its production `quote_renewal` entrypoint at year counts 0 to 12 and
255, and the lens's `renewal_inputs`. Its states cover every label-length tier, registrations
of 1 and 10 years with and without a referrer, every horizon step, valid and invalid renewal
schedules, a subname, moves, custody, renewals in grace, re-registration, an absent name, a
grace end off the grace period and heights at the end of u64. The generator, which runs the
store's code natively in a checkout of that revision, is kept outside this repository.

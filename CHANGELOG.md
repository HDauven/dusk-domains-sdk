# Changelog

## 0.3.0 (2026-10-07)

- Require the observed commit height in `registrationCalls` and accept a separately
  reviewed reveal deadline bounded by the commitment window.
- Project emitters admitted earlier in the same committed receipt in event order.
- Separate retained event payloads from mutable projection state.
- Keep directory revisions synchronized through delay changes and role handovers.
- Preserve store admission roles when projecting `SetAcceptsMoves`.

Breaking release for ADR 0004's fresh frozen deployment. No legacy state migration.

- Replace router/core/treasury and legacy marketplace clients with manifest-loaded
  directory, store shards, registry-keyed resolvers, policy, vault and marketplace v1.
- Verify driver hashes before execution and contract interface/deployment bindings;
  discover admissions and follow root-keyed forwarding with bounded monotone hops.
- Acquire current block height automatically for canonical reads (#186), retain
  lossless u64 values, exact Lux strings and authoritative generated wire shapes.
- Add all public write builders, exact deposits/referrals, reviewed marketplace
  custody/orders, vault claims, shard moves and explicit per-action Connect gas.
- Replace legacy projections with the complete frozen journal/event catalog,
  transaction-atomic replay, implicit descendant/custody effects, sealed move
  reconciliation, cooldowns and reorg checkpoints.
- Align npm/JSR exports, retain `./chain-addresses` (#185), remove obsolete
  `./internal` and `./write-proof`, and rewrite all integration guides.
- Add real protocol WASM golden-vector, builder, manifest, gas, forwarding and
  replay tests. Driver fixtures are test-only; this release is not published here.

- Restore frozen name/policy analysis, exact local pricing and premium estimates,
  directory renewal/lifecycle math, commit-window helpers and secure secrets.
- Restore deployment/shard-scoped pending-reservation recovery, record validation
  and mutation simulation, typed principal parsing and primary verification status.
- Add the frozen projection HTTP v1 client/types, snapshot-bound pagination and
  write confirmation, plus manifest/env runtime configuration.
- Require public-balance preflight for Connect writes and restore transaction
  tracking without activity/error presentation copy.
- Test each golden vector separately and expand every read, helper, event journal,
  manifest and forwarding-boundary regression matrix.

## 0.2.0 (2026-10-06)

First release since 0.1.6. Entrypoints changed: `./connect` and `./local-dev` are gone; `./writes`,
`./write-proof`, `./marketplace`, `./connect-app`, `./event-catalog` and `./projection` are new.
Clients route through the contract-pool router.

- Export action-based gas limits with extra allowance for Moonlight recipient key checks.
- Forward validated gas prices through both wallet write paths, capping automatic estimates while preserving explicit u64 prices.

- Decode and project auction and fixed-sale IDs. Require reviewed marketplace identities in write helpers and wallet context. Bids carry the chosen amount and auction ID; settlement carries the auction ID.
- Retain auction duration, start deadline, creation height and fee in canonical reads. Reject missing or inexact IDs in reads, events and writes.

- Accept decimal-string integers in driver events and outputs, including scalar premium reads. ([#124])

- Expose dropped-name premiums in registration quotes. ([#124])
- Preserve exact treasury and referral Lux totals beyond the safe-number range. ([#124])
- Keep registration projection independent of premium accounting failures. ([#124])

- Add validated Bitcoin, Ethereum, Solana and default EVM address records with canonical write values. ([#242])
- Export shared chain-address validators for plain Node consumers. ([#242])
- Distinguish primary-name set and cleared activity while retaining legacy activity support. ([#243])

- Return chain- and contract-bound preparation envelopes and reject stale or unbound submissions. ([#239])
- Require the current wallet chain for call preparation. ([#239])
- Reject zero contract overrides and configured placeholders at live call boundaries. ([#239])
- Export dense, non-zero contract ID decoding through the writes entrypoint. ([#239])
- Bind exact indexer lookups to their requested identities. ([#239])
- Require canonical authorities and lifecycle status for indexed-name verification. ([#239])
- Require the caller’s expected name for indexed-resolution verification. ([#239])
- Scope bounded route caches to successful operations on a transport, chain and router. ([#239])
- Reject sparse and zero registry contract IDs. ([#239])
- Expose immutable offer IDs and fees in canonical reads and acceptance payloads. ([#239])

- Document rejection of unchanged ancestor assignments and take-back entries. ([#237])
- Expose raw on-chain primary mappings for endpoint cleanup after expiry. ([#237])
- Explain mandatory identity clearing for ancestor owner or manager changes. ([#237])

- Clarify that clearing a primary name requires only endpoint control. ([#237])

- Expose optional transfer reset in call builders and wire encoding. ([#237])
- Distinguish name permissions from ancestor namespace control. ([#237])

- Add namespace call builders, event decoding and indexer response types. ([#237])
- Project subname authority changes and cleared identity without duplicate root rows. ([#237])

- Explain marketplace escrow renewal failures with guidance to close the listing. ([#235])
- Describe open root renewal and identify the renewal actor as the payer. ([#235])
- Explain the 16-reservation cap in wallet errors. ([#235])
- Apply reserved-name policy only to roots while keeping subnames out of public registration. ([#235])

[#235]: https://github.com/HDauven/dusk-domains-protocol/issues/235
[#237]: https://github.com/HDauven/dusk-domains-protocol/issues/237
[#239]: https://github.com/HDauven/dusk-domains-protocol/issues/239
[#242]: https://github.com/HDauven/dusk-domains-protocol/issues/242
[#243]: https://github.com/HDauven/dusk-domains-protocol/issues/243
[#124]: https://github.com/HDauven/dusk-domains-protocol/issues/124

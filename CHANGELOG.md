# Changelog

## 0.4.1 (2026-10-18)

- Read no tip for a view the lens answers in one query.
- Keep the lens deployment check and the lens's health, with 10-minute holdoffs, in `verificationCache`.
- Send a rate-limited lens read again after its `Retry-After`, three times a call; add `NodeReadError`.
- Add `previewRenewal`, a name page's renewal price without a read, which builders refuse.
- Read a policy's config once where a quote or price verifies it.

## 0.4.0 (2026-10-13)

Breaking: pass `client.release`, not the loaded release, to the Connect app. It signs
only for contracts whose release descriptor carries `codeHash` and `initHash`, and a
reveal only for terms the same client quoted. Rebuild a stored reservation from a fresh
quote: a stored, copied or edited quote throws `UnverifiedQuoteError`.

- Verify the selected policy wherever a registration is quoted, built or signed,
  instead of in `discover()` and `createClientFromManifest`. A governance `SetPolicy`
  can select a policy the release manifest does not list yet; client creation,
  renewals, records and market operations no longer fail until the manifest is
  republished. `quoteRegistration`, and so `prepareRegistration`, verifies the policy
  that priced the quote against the release before returning it. `registrationCalls`
  builds only from such a quote, and the Connect app prepares and submits `register`
  and `issue_reserved` only at a policy selection a client verified against the same
  release.
- Verify each contract transactionally; one that fails a check stays refused.
- Keep verification per client: `client.release` is now the client's own copy.
- Sign in the Connect app only for contracts its client verified, not map entries.
- Sign only for contracts whose release descriptor carries `codeHash` and `initHash`.
- Sign custody hand-offs only to a marketplace the client verified, with its intent.
- Sign a reveal only for terms its client quoted, under the selection it read.
- Check verification again immediately before `dusk_sendTransaction`.
- Quote in `quoteRegistration` under the directory's policy selection only.
- Build `registrationCalls` only from the unchanged quote object a client returned.
- Throw a retryable `UnverifiedQuoteError` for a stored, copied or edited quote.
- Compare the preferred marketplace with its directory record during discovery.
- Compare admission init hashes, and a policy's live initialization, with `initHash`.
- Read `prepareRegistration` again at one height when a block lands meanwhile.
- Treat a null `codeHash` or `initHash` in a release manifest as absent.
- Add `projectedProposal` and `projectedProposals`, deriving `Expired` and `Invalidated`.
- Export `ContractRefusedError` for a contract a client refused.
- Mirror the launch policy's reserved list (61 labels): add human, reserved on request.
- Share identical reads at one height between a client's operations, and read membership and each home once per snapshot.
- Add `verificationCache` to keep verification reads across clients, for example in `sessionStorage`.
- Open a snapshot at a height read that arrived within `heightReuseMs` (1000 by default; 0 reads it every time).
- Read a name from its home-store hint, verify contracts on first use, and take a probed admission's interface and binding from the directory; add `previewRegistration`.
- Sign for, or quote under, a contract only `verificationCache` vouched for after verifying it, and the directory, from the chain; key entries by `transportNamespace`, keeping none for a custom transport or `fetch` without one.
- Read the tip's block hash with its height, so a block replaced at the same height is read again.
- Add `UnverifiedContractError` and the `eager` option of `createClientFromManifest`.
- Read through the release's top-level `lens` when it has one, falling back to direct reads.
- Add `resolve`, `namePage`, `pricing` and `bootstrap`.
- Add the `useLens` and `onLensFallback` options.
- Refuse call arguments holding objects a lens `bootstrap()` returned.

## 0.3.4 (2026-10-12)

- Mirror the launch policy's reserved list (60 labels): add george, gamo, moana,
  mocello, hein, hdauven, heindauven, thomas, neotamandua, autholykos, tminus, pieswap,
  sozu, nocturne-standards, rannier, tdi, mochavi and seppia, each reserved on request.

## 0.3.3 (2026-10-11)

- Use the protocol's `resolve_primary` in `verifyPrimary`, preserving current-home,
  incarnation, lifecycle, forward-record and pool-uniqueness checks.
- Require the endpoint's current owner or manager authority in `primaryNameStatus`,
  returning `unauthorized` when a raw mapping survives escrow or an identity-preserving transfer.
- Expose indexer raw mappings as `getRawPrimary`; retain `getPrimary` as a deprecated
  compatibility alias and `store(id).read_primary` for endpoint cleanup.

## 0.3.2 (2026-10-09)

- Follow the frozen verification ABI and semantics: compressed payout-key bytes,
  referral pruning/release events, reclaimable marketplace refunds, and
  authority-aware primary resolution.
- Match data-driver validation for wire-version literals, vault fee metadata,
  aggregate record mutations, Unicode strings and integer JSON spellings.

- Align controller call consent and governance version guards with protocol
  [#268](https://github.com/HDauven/dusk-domains-protocol/pull/268).

- Support the frozen logic port: retiring admissions, controller governance and consent,
  delegated operations, RegisterFor, released-root reads and cession events.
- Prepare registration at the eligible successor of a retiring canonical home,
  preserving the released generation and grace end in quote verification.
- Project controller admissions and suspension; retain permanent
  cession forwards and operation occurrence identity for controller provenance.

## 0.3.1 (2026-10-07)

- Calibrate wallet gas budgets against VM measurements, admission reserves and
  bounded existing state, including expired subtrees and full proposal tables.
  A failed call is charged its full limit, so the old limits (up to 1e9) could cost
  a user about 1 DUSK when they lost a race for a listing. See `docs/gas-policy.md`.
- Answer projected identity reads, such as `projectedPrimary`, from the existing
  projection indexes instead of scanning every entity.
- Reuse identical verified data drivers within one release instead of loading one
  per admitted contract.
- Mark modules as free of import side effects so bundlers can tree-shake them.

## 0.3.0 (2026-10-07)

- Apply projection receipts in place with atomic undo, constant-time receipt
  membership and incremental indexes/accounting; remove history-wide replay copies.
- Add explicit `snapshotProjection`/`restoreProjection` and projector checkpoints.
  Projection returns/getters are live, receipt IDs are a record, and checkpoint
  schema version 2 requires replaying old snapshots. See the indexer event guide.
- Make effect history retention optional with `retainEffects: false` for indexers
  that persist their own history; retained logs append without replay copies.

- Require the observed commit height in `registrationCalls` and accept a separately
  reviewed reveal deadline bounded by the commitment window.
- Project emitters admitted earlier in the same committed receipt in event order.
- Separate retained event payloads from mutable projection state.
- Keep directory revisions synchronized through delay changes and role handovers.
- Preserve store admission roles when projecting `SetAcceptsMoves`.
- Publish compiled npm runtime entrypoints usable by plain Node while keeping
  the same TypeScript source entrypoints for JSR.

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

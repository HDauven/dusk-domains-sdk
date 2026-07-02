# src/names

TypeScript protocol and integration layer for Dusk Domains.

This package is the boundary between the React app, the local indexer, Dusk Connect, and the contract data-driver schemas.

Responsibilities:

- Name normalization, policy checks, and namehashing.
- Principal and endpoint conversion.
- Typed record helpers and record draft conversion.
- Core and treasury call builders.
- Dusk Connect runtime adapters.
- SDK-style read helpers for both direct contract reads and indexer-backed product reads.
- Indexer client and read-model utilities.
- Registration, reservation, referral, and primary-name helpers.

Boundaries:

- No React components here.
- UI copy belongs in `src/features`.
- Raw contract argument shapes belong in call builders.
- Search, lists, history, and activity can use the indexer.
- Canonical ownership, record, primary-name, and treasury checks should be backed by contract reads when trust matters.

## Public Client

Prefer `createDuskDomainsClientFromManifest` for third-party integrations. The manifest gives the SDK the deployed contract IDs, data-driver URLs, method signatures, event schema version, and artifact hashes.

```ts
const domains = await createDuskDomainsClientFromManifest({
  manifestUrl: 'https://artifacts.example/dusk-domains/devnet/manifest.json',
  indexerUrl: 'https://indexer.example',
  app: duskConnectApp,
})
```

The public client uses two read paths internally:

- Canonical known-name reads go to the core contract when a Dusk Connect read transport is configured.
- Discovery, history, search, My Domains, subdomains, treasury, and referral dashboards go to the indexer.

Use `domains.checkIndexer()` before trusting indexed discovery for UI confirmation, and use `domains.verifyIndexedName(...)` before using an indexed owner/name row in a value-bearing flow.

For indexer operators, `createDuskDomainsProjector` and `applyDuskDomainsIndexedEvent` replay normalized JSON event envelopes into the same read-model reducers used by the app and local indexer. Data-driver/RKYV decoding happens before that boundary.

## Lower-Level Read Paths

Use `createDuskDomainsOnChainClient` when an integration deliberately wants a contract-only client. It calls the core contract directly through a small read transport and does not require the indexer.

Good direct-read use cases:

- `getName('aurora.dusk')`
- `getNameOwner('aurora.dusk')`
- `getRecord('aurora.dusk', 'moonlight_address')`
- `getPrimaryName(endpoint)`
- `verifyPrimaryName(endpoint)`
- `getPendingCommitment(commitment)`
- `getFeeConfig()`

Use the indexer client for discovery and history:

- Search and availability lists.
- My Domains / owner-to-domain lists.
- Subdomain lists.
- Activity and record history.
- Recent-change warnings.
- Referral and treasury dashboards.

Use `createDuskDomainsClient({ onChain, indexer, manifest, contracts })` only when callers have already constructed the source-specific clients. The combined client prefers canonical contract reads for known-name resolution and uses the indexer for discovery/history methods.

`getRecords(name)` on the on-chain client reads a bounded set of known keys. It cannot enumerate arbitrary dynamic records from contract state. Use `getRecord(name, key)` when the caller knows the key, and use the indexer when the UI needs list/discovery behavior.

Release manifests can be validated with `validateDuskDomainsReleaseManifest` and converted into a `DuskNameContractMap` with `contractsFromDuskDomainsReleaseManifest`. Public package and artifact release rules are documented in [Public Integration Release](../../docs/public-integration-release.md).

Useful files:

- `callBuilders.ts`: low-level core and treasury call payloads.
- `records.ts`: typed record keys and values.
- `principal.ts`: Moonlight and authority conversions.
- `sdkOnChain.ts`: canonical direct-read SDK client.
- `client.ts`: public manifest-first Dusk Domains client plus lower-level source-specific constructors.
- `releaseManifest.ts`: public artifact/provenance manifest validation.
- `indexerClient.ts`: HTTP client for the local/hosted indexer.
- `indexerKit.ts`: public projector helpers for third-party indexer operators.
- `sdk.ts`: compatibility read/write client used by wallet-style integrations.
- `internal.ts`: broad app-internal barrel; do not use as a public SDK entrypoint.
- `index.ts`: narrow public SDK barrel.

Useful commands:

```sh
npm run test -- src/names/sdkOnChain.test.ts src/names/sdk.test.ts --run
npm run test -- src/names/client.test.ts src/names/releaseManifest.test.ts --run
npm run build
```

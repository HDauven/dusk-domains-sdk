# Integration trust model

Contracts are canonical for ownership, lifecycle, records, orders and funds.
The indexer provides discovery, history and derived warnings.

## Client behavior

`createDuskDomainsClient({ onChain, indexer })` combines the sources:

- `resolveName` tries the on-chain client first. A contract-read or missing-height
  failure can fall back to indexed resolution. Inspect `result.value.source.kind`;
  indexed fallback is not canonical proof.
- `getName`, `getNameOwner`, `getRecord`, `getPrimaryNameOnChain` and
  `verifyPrimaryNameOnChain` require the on-chain client.
- Search, lists, activity and dashboards require the indexer. Array-returning list
  methods read one page; use the indexer's page methods or scoped complete-set
  helpers for further results.
- `checkIndexer` checks health, API/event schema, routes, deployment binding,
  SQLite schema when present, lag and history. A degraded/partial-history status
  is distinct from full compatibility even when `ok` is true.

The direct client needs `currentBlockHeight` for active routing and primary-name
verification. Stored ownership can survive expiry; an owner lookup alone does not
prove the name is active. For signing, check the exact current contract state and
height. Display a primary only after typed forward/reverse verification.

## Manifests

`createDuskDomainsClientFromManifest` accepts a manifest or manifest URL, optional
Dusk Connect `app`/read transport, indexer URL and `currentBlockHeight` reader.
Validation requires router, core and treasury metadata, contract IDs, artifact
descriptor shapes and required method names. It does not fetch and hash driver
bytes, verify deployed bytecode or perform the indexer compatibility check for you.
The generated contract map contains router, core and treasury; marketplace setup
uses its own configured preset.

Call `checkIndexer()` explicitly for indexed confirmation. Validate deployment
provenance and driver bytes through your release process. The lower-level clients
can be used without a manifest; they do not reject startup merely because it is absent.

## Shared projection

`@duskdomains/sdk/projection` normalizes decoded event payloads and applies them
to in-memory state. The operator supplies finalized order, deduplication,
provenance, persistence and HTTP serving. Raw data-driver/RKYV decoding precedes
normalization. An indexed warning or balance is not authorization to mutate or claim.

See [examples](examples/direct-onchain-reads.md), [events](indexer-events.md),
[HTTP contract](https://github.com/HDauven/dusk-domains-indexer/blob/main/docs/indexer-api.md) and
[artifact tooling](https://github.com/HDauven/dusk-domains-protocol/blob/main/docs/public-integration-release.md).

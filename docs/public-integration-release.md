# Public Integration Release

Status: beta packaging plan
Owner issues: [#128](https://github.com/HDauven/dusk-domains/issues/128), [#129](https://github.com/HDauven/dusk-domains/issues/129), [#130](https://github.com/HDauven/dusk-domains/issues/130), [#131](https://github.com/HDauven/dusk-domains/issues/131), [#132](https://github.com/HDauven/dusk-domains/issues/132), [#133](https://github.com/HDauven/dusk-domains/issues/133), [#134](https://github.com/HDauven/dusk-domains/issues/134)

This document defines what third-party wallets, explorers, dApps, and operators can consume without needing the private contract source tree. Contract state remains canonical; the indexer and SDKs are convenience layers. The source-specific read rules are defined in [Integration Trust Model](integration-trust-model.md).

## Release Boundary

Public at beta:

- TypeScript SDK read helpers.
- Dusk Connect read/write adapter types and call builders needed by integrations.
- Data-driver WASM files for `dusk-domains-core` and `dusk-domains-treasury`.
- Contract IDs, data-driver hashes, method manifests, event schema version, and call examples.
- Indexer API docs, HTTP client, guards, and the local/hosted indexer implementation when the public-surface check passes.
- Integration examples for direct reads, indexer-backed reads, primary-name verification, and My Domains style discovery.

Private at beta:

- Full contract source until the public contract surface is frozen, reviewed, and licensing is decided.
- Deployment keys, operator custody material, mnemonics, private RPC credentials, and host-specific service secrets.
- Privileged deployment and incident-operation scripts that assume operator access.
- Internal abuse/escalation notes that include private reporter or investigation data.

This split is acceptable for beta only if every public package points to a release manifest with contract IDs, hashes, method schemas, event schema version, SDK version, and source commit. Integrators should never rely on a copied `.env` file as the source of truth.

## Trust Model

Direct contract reads are the trust-minimized path for known-name checks:

- ownership;
- one explicit record key;
- one explicit primary-name endpoint;
- fee configuration;
- treasury/referral state;
- typed forward/reverse verification.

Indexer reads are for discovery and product UX:

- search and availability;
- My Domains owner lists;
- subdomain lists;
- activity and record history;
- recent-update warnings;
- fast dashboards.

The indexer is non-canonical. If indexed state disagrees with direct contract reads, value-bearing flows must prefer direct reads or fail closed.

Use [Integration Trust Model](integration-trust-model.md) as the short public-facing rule set for when a wallet, explorer, dApp, or third-party indexer may rely on each source.

Third parties may rely semantically on:

- deployed contract IDs recorded in the manifest;
- method signatures and data-driver hashes in the method manifest;
- event schema version;
- public SDK APIs documented here;
- the rule that primary-name display requires reverse lookup plus typed forward verification.

Third parties should not rely on:

- internal source layout;
- preview/local write bridges;
- private deployment scripts;
- old split-stack contract IDs;
- indexer-only warnings as canonical authorization state.

## Package Layout

Current package names and possible package-manager names:

| Package | Contents |
| --- | --- |
| `@duskdomains/sdk` now, possible `@duskdomains/sdk` later | Direct on-chain client, combined client, record/name/principal helpers, manifest validation, and public call builders. |
| `@dusk-domains/artifacts` | Release manifest, method manifest, call examples, data-driver WASM files, optional contract WASM checksums. |
| `@dusk-domains/indexer-client` | HTTP client, response guards, and stable v1 API types. |
| `@hdauven/dusk-domains-indexer` now, possible `@dusk-domains/indexer` later | Public indexer server when released with the surface check passing. |

The first beta can publish these from this repo. A separate public repo is optional later if contract source remains private.

Recommended licensing for public beta:

- SDK, indexer client, examples, and indexer implementation: MIT.
- Artifact bundle and generated manifests: MIT-compatible redistribution grant for integration and verification.
- Contract source: private/no public source license until the source is intentionally released.

Before a public package is cut, update `package.json` metadata and release notes with the final license wording.

## Versioning

Use semver for public packages:

- Patch: docs, examples, indexer client guard fixes that do not alter API shape.
- Minor: additive SDK methods, additive indexer routes, additive record keys, additive manifest fields.
- Major: breaking SDK API, breaking manifest schema, breaking event schema, method signature changes, contract redeploys that change public semantics.

The release manifest has its own `manifestVersion`. The indexer API exposes `apiVersion: "v1"` and `schemaVersion`. Contract/data-driver changes must produce a new artifact bundle even when the npm SDK version does not change.

## Artifact Bundle

Generate a reproducible public artifact bundle:

```sh
npm run release:artifacts -- \
  --network devnet \
  --chain-id dusk:3 \
  --env-file .env.devnet.local
```

Default output:

```text
target/public-release/dusk-domains/<network>/
  manifest.json
  method-manifest.json
  call-examples.json
  package-manifest.json
  contracts/
    dusk_domains_core.datadriver.wasm
    dusk_domains_treasury.datadriver.wasm
    dusk_domains_core.wasm
    dusk_domains_treasury.wasm
```

Each artifact descriptor includes SHA-256 and BLAKE2b-256 hashes. The script fails if required contract IDs or data-driver WASM files are missing.

`package-manifest.json` is the public package boundary for the release candidate. It records the intended public package names, publish status, package contents, trust boundary, source commit, SDK version, and the private-at-beta boundary. Third parties can use it to distinguish public SDK/indexer/artifact surfaces from private contract source or operator material.

Verify artifact generation:

```sh
npm run check:release-artifacts -- --source-commit current
```

For public beta, the release manifest source commit must match the release-candidate checkout. Omit `--source-commit current` only when inspecting an intentionally historical bundle.

## Provenance Manifest

The SDK exposes manifest helpers:

```ts
import {
  contractsFromDuskDomainsReleaseManifest,
  validateDuskDomainsReleaseManifest,
} from '@duskdomains/sdk'

const response = await fetch('https://artifacts.example/dusk-domains/devnet/manifest.json')
const parsed = validateDuskDomainsReleaseManifest(await response.json())

if (!parsed.ok) {
  throw new Error(parsed.error.message)
}

const contracts = contractsFromDuskDomainsReleaseManifest(
  parsed.value,
  'https://artifacts.example/dusk-domains/devnet/',
)
```

The validator checks:

- product and manifest version;
- release, SDK version, network, chain ID, and source commit shape;
- core and treasury contract IDs;
- required data-driver hash descriptors;
- required public method signatures for the configured two-contract surface.

## Manifest-First SDK Client

Use one manifest-rooted client for public integrations:

```ts
import {
  createDuskDomainsClientFromManifest,
} from '@duskdomains/sdk'
```

```ts
const domains = await createDuskDomainsClientFromManifest({
  manifestUrl: 'https://artifacts.example/dusk-domains/devnet/manifest.json',
  indexerUrl: 'https://indexer.example',
  app: duskConnectApp,
})

const owner = await domains.getNameOwner('aurora.dusk')
const resolved = await domains.resolveName('aurora.dusk', 'moonlight_address')
const myDomains = await domains.listNames({ owner: 'moonlight:...' })
const indexerStatus = await domains.checkIndexer()
```

The SDK uses the release manifest as the source of truth for contract IDs, data-driver URLs, method signatures, event schema version, package versions, and artifact hashes. Known-name reads use contract reads when an on-chain transport is configured. Discovery, history, search, and dashboards use the indexer.

Lower-level constructors remain available for advanced users:

```ts
createDuskDomainsOnChainClient(...)
createDuskDomainsIndexerClient(...)
createDuskDomainsClient({ onChain, indexer, manifest, contracts })
```

Those constructors are source-specific escape hatches. Public docs should lead with `createDuskDomainsClientFromManifest`.

## Indexer Compatibility

The SDK can check whether a configured indexer matches the release manifest:

```ts
const compatibility = await domains.checkIndexer()

if (!compatibility.ok || !compatibility.value.ok) {
  throw new Error('Indexer is not safe for value-bearing UI confirmation.')
}
```

The compatibility report checks:

- indexer health;
- indexer event schema version against the manifest;
- indexer API version against the manifest;
- required API routes;
- deployment chain ID and core/treasury contract IDs when `/health` exposes deployment binding;
- SQLite schema version when `/health` is served from SQLite/WAL mode;
- reported block lag;
- whether the indexer reports replayed event history.

If the indexer is healthy but cannot prove replayed deployment history, the SDK reports `partial_history`. Browsing can continue, but value-bearing flows should direct-read contract state before final display or signing.

Indexer operators who build their own event pipeline should decode data-driver/RKYV payloads into normalized JSON envelopes before projection. The SDK exposes `duskDomainsIndexedEventTypes`, `normalizeDuskDomainsIndexedEventEnvelope`, `createDuskDomainsProjector`, and `applyDuskDomainsIndexedEvent` so external indexers can use the same event family catalog and projection semantics as the hosted indexer. Raw decoding, persistence, HTTP routing, checkpoints, and archive-node operation remain operator-specific.

Indexed results can be verified explicitly:

```ts
const indexed = await domains.listNames({ owner: 'moonlight:...' })
const verified = await domains.verifyIndexedName(indexed[0])

if (verified.ok && verified.value.verified) {
  renderTrustedOwner(verified.value.indexed)
}
```

## Integration Guidance

Known-name resolution:

1. Normalize the name.
2. Use `domains.resolveName(...)`.
3. The combined client direct-reads one record key when on-chain transport is configured.
4. Reject expired names and missing records.
5. Show the raw endpoint before signing.

Primary-name display:

1. Direct-read or indexer-read the reverse primary for the typed endpoint.
2. Forward-resolve the candidate name for the same endpoint type.
3. Display the name only when the forward value matches exactly.
4. Otherwise display the raw endpoint.

My Domains and history:

1. Use the indexer `GET /names?owner=...` or `listNames`.
2. Show health/staleness when `/health` is unsafe.
3. For value-bearing actions on a listed name, call `verifyIndexedName(...)` or direct-read owner/manager state before preparing the transaction.

Errors:

- `read_transport_missing`: caller used a direct-read method without an on-chain transport.
- `invalid_manifest`: release manifest is missing required shape, contract IDs, hashes, or method signatures.
- Indexed stale/degraded state: keep browsing possible, but do not present final write success without healthy indexed confirmation.

## Public Indexer Release

The public indexer surface must be free of embedded secrets, mnemonics, operator-only assumptions, and private deployment material.

Run:

```sh
npm run check:public-indexer-surface
npm run check:public-indexer-surface:test
```

Serve a durable beta indexer with SQLite/WAL and a single writer:

```sh
npm run indexer:local -- \
  --sqlite /var/lib/dusk-domains/indexer.sqlite \
  --event-log /var/lib/dusk-domains/events.jsonl \
  --cursor /var/lib/dusk-domains/cursor.json \
  --strict-health \
  --host 0.0.0.0 \
  --port 8787 \
  --watch
```

Public API routes are versioned as the v1 indexer API and documented in [Indexer API](indexer-api.md). Backup, restore, monitoring, and launch-health requirements are documented in [Public Beta Operator Guide](public-beta-operator-guide.md).

Replay and durability checks:

```sh
npm run check:indexer-local-event-log
npm run check:indexer-sqlite
npm run check:indexer-production
```

Third-party indexer operators should keep the decode, projection, and serving boundaries separate:

```text
raw DuskDS/W3sper data-driver event
  -> scripts/indexer-operator/event-decoder.mjs
  -> normalized JSON event envelope
  -> shared SDK/operator projector semantics
  -> server persistence, HTTP routes, health, and checkpoints
```

`scripts/indexer-operator/event-decoder.mjs` is the beta reference decoder for W3sper/data-driver decoded contract event payloads. It emits stable camelCase JSON envelopes. Public packages should expose this boundary rather than forcing operators to copy logic out of `scripts/local-event-collector.mjs`.

Third-party indexer operators can use the public projector kit once they have normalized DuskDS contract events with the matching data-driver:

```ts
import {
  applyDuskDomainsIndexedEvent,
  createDuskDomainsProjector,
  normalizeDuskDomainsIndexedEventEnvelope,
} from '@duskdomains/sdk'

const projector = createDuskDomainsProjector()

for await (const envelope of decodedEventStream) {
  applyDuskDomainsIndexedEvent(projector, normalizeDuskDomainsIndexedEventEnvelope(envelope))
}
```

The decoded event stream should use the stable JSON event envelope:

```ts
{
  event: { type: 'name_registered', ... },
  meta: { txId, blockHeight }
}
```

Data-driver/RKYV decoding is deployment-specific and should be performed with the data-driver WASM referenced by the release manifest. The projector consumes the normalized JSON event schema after decoding, and `normalizeDuskDomainsIndexedEventEnvelope` fails closed for unknown event names or malformed envelopes before replay. Server implementations may choose JSONL, SQLite/WAL, or another durable store, but they should persist the normalized envelope and provenance metadata before projection. Projection tables and HTTP caches must be rebuildable from the event ledger.

## Release Checklist

Before publishing public integration artifacts:

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run check:release-artifacts -- --source-commit current`
- `npm run check:public-indexer-surface`
- `npm run check:public-indexer-surface:test`
- `npm run check:indexer-production` against the release event journal when publishing a hosted indexer
- Generate `manifest.json`, `method-manifest.json`, `call-examples.json`, and `package-manifest.json`
- Record contract IDs, hashes, SDK version, event schema version, source commit, and chain ID in release notes
- Confirm `package-manifest.json` marks SDK, artifacts, indexer client, and indexer package surfaces without exposing contract source or operator secrets
- Confirm old split-stack contracts are absent from public runtime metadata
- Confirm no mnemonics, operator keys, RPC secrets, or private incident notes are included

## Contract Source Release Triggers

Open the contract source later when at least one of these is true:

- external audit or formal Foundation/community handoff requires source review;
- public mainnet beta is planned;
- third-party wallet/explorer integrations need source-level verification beyond data-driver artifacts;
- storage layout and method surface are frozen;
- licensing for contract source is explicitly decided.

Until then, the public manifest/artifact bundle is the integration contract.

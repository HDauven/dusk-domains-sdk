# Public SDK Surface

Status: private beta boundary

The SDK has two package entrypoints:

```ts
import { ... } from '@hdauven/dusk-domains-sdk'
import { ... } from '@hdauven/dusk-domains-sdk/internal'
import { ... } from '@hdauven/dusk-domains-sdk/event-catalog'
```

## Public Entry Point

The public entrypoint is for wallets, explorers, dApps and read-focused services.

Stable-ish exports:

- `createDuskDomainsClientFromManifest`
- `createDuskDomainsClient`
- `createDuskDomainsOnChainClient`
- `createDuskDomainsIndexerClient`
- `createDuskDomainsReadWriteClient`
- `namehash`, `namehashHex`
- record helpers such as `createResolverRecord`, `getRecordDefinition` and `validateRecordValue`
- principal display/normalization helpers
- release-manifest helpers
- indexed event envelope helpers and projector helpers

The public entrypoint must not require app components, React, browser-only globals, private deployment material, mnemonics, operator secrets or the Dusk Domains contract source tree.

## Event Catalog Entry Point

The event catalog entrypoint is a Node-safe JavaScript export for standalone indexers and event decoders:

```js
import {
  duskDomainsIndexedEventTypes,
  isDuskDomainsIndexedEventType,
} from '@hdauven/dusk-domains-sdk/event-catalog'
```

Use this entrypoint when plain Node must route decoded Dusk Domains events without compiling TypeScript source. Keep the catalog additive unless a contract redeploy intentionally changes the event schema.

## Internal Entry Point

The internal entrypoint is for first-party Dusk Domains app, local proof tooling, write bridges, indexer operators and deployment scripts.

Internal exports include:

- runtime call builders and call metadata
- transaction submission helpers
- Dusk Connect app/runtime adapters
- local development wallet helpers
- preview write-proof helpers
- low-level indexer/projector state helpers

Internal exports may change before a public package release. Do not document them as third-party APIs unless they are promoted to the public entrypoint first.

## Promotion Rule

Promote an internal helper only when all of these are true:

- a wallet, explorer, dApp or standalone indexer needs it outside the app repo;
- the helper can be explained without private contract-source assumptions;
- it has focused tests in this package;
- it does not expose operator custody, deployment secrets or preview-only write paths;
- the change is recorded in `docs/release-versioning.md`.

## Current Package Name

The package is private and scoped as `@hdauven/dusk-domains-sdk`. A later public release can rename or republish it, but downstream code should currently depend on a specific Git commit or tag.

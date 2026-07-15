# Dusk Domains SDK

TypeScript SDK for resolving and integrating `.dusk` domains.

The SDK gives wallets, explorers, dApps and indexers a stable way to work with Dusk Domains without depending on the frontend repository.

## Install

```bash
deno add jsr:@duskdomains/sdk
npx jsr add @duskdomains/sdk
```

For npm projects, install the JSR npm compatibility package with an alias:

```json
{
  "dependencies": {
    "@duskdomains/sdk": "npm:@jsr/duskdomains__sdk@^0.1.0"
  }
}
```

## Usage

```ts
import { createDuskDomainsClientFromManifest } from '@duskdomains/sdk'

const domains = await createDuskDomainsClientFromManifest({
  manifestUrl: 'https://artifacts.example/dusk-domains/testnet/manifest.json',
  indexerUrl: 'https://indexer.example',
  app: duskConnectApp,
})

const record = await domains.resolveName('aurora.dusk', 'moonlight_address')
```

Use the public entrypoint for third-party integrations:

```ts
import { namehashHex, createDuskDomainsClientFromManifest } from '@duskdomains/sdk'
```

## Read Paths

The SDK supports two read paths:

- On-chain reads for canonical ownership, records, primary-name checks and fee config.
- Indexer reads for search, history, My Domains, subdomains, treasury views,
  referral dashboards and marketplace discovery.

Value-bearing flows should verify indexed discovery with canonical reads before treating a domain as authoritative.

`getCurrentBlockHeight()` uses the direct client's configured node-height
reader. Applications should combine it with direct ownership and order reads
immediately before preparing lifecycle-sensitive writes. Indexer height is for
discovery and display, not signing authorization.

The marketplace entrypoint exposes fixed-sale, English-auction, offer and
aggregate-refund call builders plus matching indexed read models:

```ts
import {
  MARKETPLACE_MIN_AMOUNT_LUX,
  marketplacePlaceBidRuntimeCall,
  marketplaceReadAuctionCall,
} from '@duskdomains/sdk/marketplace'
```

Paid calls derive their exact DUSK deposit from typed call metadata.
Marketplace writes remain runtime-bound and require a matching core, treasury
and marketplace deployment plus Forge data drivers.

JavaScript write builders reject Lux amounts above `Number.MAX_SAFE_INTEGER`
(about 9,007,199 DUSK) instead of risking JSON precision loss. Canonical reads
retain the full contract `u64` as `bigint`.

## Entrypoints

- `@duskdomains/sdk`: public client, records, namehashing, principals and release manifests.
- `@duskdomains/sdk/marketplace`: marketplace constants, call builders and indexed models.
- `@duskdomains/sdk/event-catalog`: event names for independent indexer implementations.

The JSR package intentionally excludes first-party browser wallet adapters, local development shims and write-proof tooling. Those remain repository-internal until their public contracts are stable.

## Source Layout

```text
src/
  client/       public and combined SDK clients
  contracts/    contract call builders, wire args and wallet display context
  core/         name policy, namehashing, records, principals and domain helpers
  dev/          local development wallet utilities
  indexer/      event types, projectors, indexer client and read-model helpers
  onchain/      direct contract read client and decoders
  proof/        browser write proof capture
  runtime/      runtime config and release manifests
  wallet/       Dusk Connect adapters
  writes/       transaction tracking and write confirmation helpers
```

Root files are package entrypoint facades. Implementation code should live in the folders above.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## License

MIT

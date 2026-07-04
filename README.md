# Dusk Domains SDK

TypeScript SDK for resolving and integrating `.dusk` domains.

The SDK gives wallets, explorers, dApps and indexers a stable way to work with Dusk Domains without depending on the frontend repository.

## Install

```bash
npm install @hdauven/dusk-domains-sdk
```

The package is currently private and pre-production. Pin exact versions or commit hashes until public releases are cut.

## Usage

```ts
import { createDuskDomainsClientFromManifest } from '@hdauven/dusk-domains-sdk'

const domains = await createDuskDomainsClientFromManifest({
  manifestUrl: 'https://artifacts.example/dusk-domains/testnet/manifest.json',
  indexerUrl: 'https://indexer.example',
  app: duskConnectApp,
})

const record = await domains.resolveName('aurora.dusk', 'moonlight_address')
```

Use the public entrypoint for third-party integrations:

```ts
import { namehashHex, createDuskDomainsClientFromManifest } from '@hdauven/dusk-domains-sdk'
```

Use internal entrypoints only from first-party Dusk Domains apps and operator tooling:

```ts
import { coreCompleteRegistrationRuntimeCall } from '@hdauven/dusk-domains-sdk/writes'
import { installLocalDevDuskWallet } from '@hdauven/dusk-domains-sdk/local-dev'
```

## Read Paths

The SDK supports two read paths:

- On-chain reads for canonical ownership, records, primary-name checks and fee config.
- Indexer reads for search, history, My Domains, subdomains, treasury views and referral dashboards.

Value-bearing flows should verify indexed discovery with canonical reads before treating a domain as authoritative.

## Entrypoints

- `@hdauven/dusk-domains-sdk`: public client, records, namehashing, principals and release manifests.
- `@hdauven/dusk-domains-sdk/internal`: first-party internal surface.
- `@hdauven/dusk-domains-sdk/writes`: contract call builders, Dusk Connect adapters and transaction helpers.
- `@hdauven/dusk-domains-sdk/local-dev`: local browser wallet shim for development.
- `@hdauven/dusk-domains-sdk/write-proof`: browser write proof capture helpers.
- `@hdauven/dusk-domains-sdk/event-catalog`: indexed event catalog.

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

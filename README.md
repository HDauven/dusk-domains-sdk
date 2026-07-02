# Dusk Domains SDK

Private TypeScript SDK for Dusk Domains.

This package was extracted from `HDauven/dusk-names` so wallet, explorer and dApp integrations can consume the name-resolution layer without depending on the web app repository.

## Contents

- `src/index.ts`: public SDK surface for Dusk Domains clients, records, namehashing, release manifests and indexer event helpers.
- `src/internal.ts`: broader internal surface used by the Dusk Domains app and integration tooling.
- `docs/`: integration notes copied from the app repo.

## Package Boundary

Use the public entrypoint for third-party integrations:

```ts
import { createDuskDomainsClientFromManifest } from '@hdauven/dusk-domains-sdk'
```

Use `@hdauven/dusk-domains-sdk/internal` only from first-party Dusk Domains app, indexer and operator tooling. The internal surface includes call builders, wallet transport helpers, preview/local test utilities and write-proof helpers that can change while the protocol is still pre-production.

Read [Public Surface](docs/public-surface.md) and [Release Versioning](docs/release-versioning.md) before wiring a wallet, explorer or standalone service to this package.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

The package is private while the protocol is still pre-production. Keep contract internals in the main app/contracts repo for now; expose only stable integration helpers here.

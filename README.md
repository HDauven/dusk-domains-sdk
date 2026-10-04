# Dusk Domains SDK

TypeScript clients, contract-call builders and shared event projection for `.dusk`
names. Direct reads use DuskDS contracts; indexer reads provide search, lists,
history and dashboards.

## Use

The package is `@duskdomains/sdk`. Pin a version or exact source revision
compatible with the deployment.
The package exports TypeScript sources; plain Node projection and event catalog
entrypoints are also available.

```ts
import { namehashHex } from '@duskdomains/sdk'

const node = namehashHex('aurora.dusk')
```

[Direct reads and primary-name verification](docs/examples/direct-onchain-reads.md)
show client setup, including the current chain-height reader needed for routing.

For writes, pass `gas.limit = duskDomainCallGasLimit(call, { senderAddress })`
from `@duskdomains/sdk/writes`. Limits cover the action, with extra allowance for
subtrees and Moonlight recipient key checks. Passing them keeps failed calls
from consuming the wallet's default limit; the Connect adapter fills in an omitted
gas price from the wallet's median, falling back to 1 for invalid or unavailable
estimates and capping it at `DUSK_DOMAIN_MAX_AUTO_GAS_PRICE` (10 Lux per gas).
Rusk's sample includes deployments priced at least 2,000 Lux per gas, so their
median can overprice calls. Explicit u64 prices remain uncapped; users can also
raise the price in the wallet.

## Development

Use Node 24. From this repository's root:

```sh
npm ci
npm test
npm run build
npm run typecheck
git diff --exit-code -- src/indexer/events/indexerEventCatalog.mjs
```

The build regenerates the committed plain-Node event catalog. Tests include the
check for missing npm scripts in tracked Markdown.

## Documentation

- [Entrypoints, writes and version boundaries](docs/public-surface.md)
- [Integration trust model](docs/integration-trust-model.md)
- [Resolver record keys](docs/records.md)
- [Shared event schema and projection](docs/indexer-events.md)
- [Registration quotes and premiums](docs/registration.md)
- [Operator handover](docs/operator-handover.md)
- [Protocol standard](https://github.com/HDauven/dusk-domains-protocol/blob/main/docs/dusk-domains-standard.md)
- [Indexer API and pagination](https://github.com/HDauven/dusk-domains-indexer/blob/main/docs/indexer-api.md)

Licensed under [MIT](LICENSE).

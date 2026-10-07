# Dusk Domains SDK

TypeScript SDK for the ADR 0004 frozen layer: directory, store shards,
registry-qualified resolvers, vault, replaceable policy and marketplace v1.
Version **0.3.0** targets a fresh frozen deployment. The 0.2 router/core/treasury
clients and legacy events have been removed.

## Quickstart

Install `@duskdomains/sdk` from JSR (`npx jsr add @duskdomains/sdk`). Serve the
release manifest and its driver artifacts over HTTP(S). The manifest supplies
contract IDs, chain ID, network byte, node URL and indexer URL.

```ts
import { createClientFromManifest } from '@duskdomains/sdk'

// Replace this URL with the frozen deployment's published manifest.
const client = await createClientFromManifest(
  'https://your-release-host.example/frozen/manifest.json',
)
const result = await client.getName('example.dusk')
if (result.value !== 'Absent' && 'Local' in result.value) {
  const { name, active, renewable } = result.value.Local
  console.log(result.store, name.owner, active, renewable, result.height)
  const records = await client.store(result.store).read_records(name.key)
  console.log(records)
}
```

No wallet or supplied block height is needed. The client fetches the current
height, verifies deployment interfaces/bindings, discovers directory admissions,
and follows permanent forwarding with a 63-hop default limit. Multi-read
operations retry when the height changes. Use a consistent node endpoint;
height bracketing is not a historical-state or same-height-reorg proof.
Unavailable dependencies throw; they are never interpreted as absence.

## Manifest

The loader accepts a contract array or a role-keyed object (store/resolver roles
may be arrays). It preserves extra deployment/compiler/init metadata. Required
SDK fields have this shape; use the deploy tool's real IDs and hashes:

```ts
interface SdkManifestFields {
  chainId: string // e.g. "dusk:2", matching the wallet
  network: number // frozen Binding.network / host chain_id, 0..255
  nodeUrl: string
  indexerUrl: string
  contracts: Array<{
    role:
      | 'directory'
      | 'store'
      | 'resolver'
      | 'vault'
      | 'policy'
      | 'marketplace'
    contractId: string // nonzero 32-byte hex, optional 0x prefix
    codeHash?: string // BLAKE3, compared with directory admission when supplied
    dataDriver: {
      path: string // resolved relative to manifest URL
      bytes?: number
      sha256?: string
      blake2b256?: string
      blake3?: string // at least one digest; every supplied digest is verified
    }
  }>
}
```

`networkId` is also accepted when the manifest uses a human-readable `network`.
A numeric CAIP-2 chain ID supplies the byte when network is a label; contradictory
chain/network values reject.
For an in-memory manifest, provide `{ artifactBaseUrl }`. Node/indexer URLs can
be overridden explicitly in options. New admissions are discovered from reads;
`resolveContract(role, id, admission)` can supply reviewed release metadata for
an implementation absent from the initial manifest. It is subjected to the same
hash, interface and binding checks. `admitDirectoryEvent` also accepts committed,
authenticated directory initialization/admission events.

## Reads and writes

Read scopes use the exact snake_case ABI: `client.directory.roles()`,
`client.directory.registration_context()`, `client.directory.renewal_schedule()`,
`client.store(id).children(page)`, `client.policy(id).quote(request)`,
`client.resolver(id).read_record_slot({ slot })`, `client.vault.read_state()`, and
`client.marketplace(id).read_order({ id: 1n })`. Every public canonical read takes
its current height itself. `verifyPrimary(endpointBytes)` verifies the current
incarnation, lifecycle and forward `moonlight_address` across admitted stores.

Use `getName` or `quoteRenewal` when the result's destination shard is needed for
a new write. Every `Located` read follows forwarding. Commitment reads stay on
their original shard. Never resend an already signed call to a new destination.

```ts
import { storeRenewCall } from '@duskdomains/sdk/writes'
import { createDuskDomainsConnectApp } from '@duskdomains/sdk/connect-app'

// Continue from the quickstart. `dusk` is a connected @dusk/connect app.
const name = await client.getName('example.dusk')
if (name.value !== 'Absent' && 'Local' in name.value) {
  const current = name.value.Local.name
  const quote = await client.quoteRenewal(name.store, {
    name: { key: current.key, incarnation: current.incarnation },
    years: 1,
  })
  if (quote.value !== 'Absent' && 'Local' in quote.value) {
    const call = storeRenewCall(quote.store, {
      name: { key: current.key, incarnation: current.incarnation },
      years: 1,
      expected_schedule_version: quote.value.Local.schedule_version,
      expected_fee_lux: quote.value.Local.total_lux,
      valid_until: quote.height + 60n,
    })
    const wallet = createDuskDomainsConnectApp(dusk.wallet, client.release)
    await wallet.submit(call)
  }
}
```

Calls contain immutable reviewed arguments, an exact decimal deposit and an
explicit action gas limit. The wallet sends public transactions with transaction
value zero, checks public balance for deposit plus maximum gas cost, rechecks the
chain before submission and uses verified driver bytes.
It never accepts a caller-substituted prepared payload. Automatic gas price is
bounded to 1–10 Lux/gas; `gasPrice` can be supplied explicitly. Included failures
can consume the full gas limit even when the principal deposit is refunded.
The [gas policy](docs/gas-policy.md) distinguishes spec budgets from provisional
wallet limits; no live measurements are claimed.

Wire byte arrays are ordinary `number[]`. Lux is decimal text; other u64 fields
are `bigint`. Use `parseJson`/`stringifyJson`, not `JSON.parse`/`JSON.stringify`,
for driver or indexer JSON containing large u64 values. Fields and enum shapes
are exactly those in the shared protocol types; missing/extra wire fields reject.

## Integrator helpers

The root entrypoint also exports name validation/analysis, local policy price
estimates, premium schedules, directory renewal estimates, lifecycle/commit-window
math, secure secrets, pending-reservation persistence, typed principals and record
validation/mutation helpers. These use frozen byte limits and bigint heights;
`formatLuxAsDusk` preserves exact amounts. Estimates are marked `estimate: true`
and must be replaced with canonical quotes before signing.

```ts
import {
  normalizeNameInput,
  validateName,
  launchPolicyConfig,
  createDuskDomainsRuntimeConfig,
} from '@duskdomains/sdk'

const canonical = normalizeNameInput(' Alice ')
const validation = validateName(canonical, launchPolicyConfig())
// ok means valid store structure; rootEligibility is Public / Reserved / Denied.
const runtime = createDuskDomainsRuntimeConfig(client.release.manifest, {
  DUSK_DOMAINS_NODE_URL: 'https://your-node.example',
})
```

Runtime config accepts explicit env objects, including Vite's
`VITE_DUSK_DOMAINS_NODE_URL`, `...INDEXER_URL`, and `...CHAIN_ID`; unprefixed
`DUSK_DOMAINS_*` takes precedence. URLs override manifest endpoints. A numeric
chain override must match the manifest's frozen network byte; switching networks
requires the corresponding release. Pass `runtime.manifest` to the loader with
its artifact base. No process environment, baked-in deployment or UI configuration
is read implicitly.

`@duskdomains/sdk/indexer` supplies the frozen projection HTTP client and
`waitForIndexerWrite`. `submitDuskDomainWrite` in `./writes` reports typed
transaction states; a hash alone is `submitted`, never `executed`. Use Connect
execution handles or observe the indexer after inclusion. Presentation copy,
activity descriptions and record edit drafts belong to the app.

## Integration guides

- [Public exports and API map](docs/public-surface.md)
- [Registration and referral](docs/registration.md)
- [Records and primaries](docs/records.md)
- [Namespace, custody and moves](docs/namespace.md)
- [Event-only indexer projection](docs/indexer-events.md)
- [Indexer HTTP API and confirmation](docs/indexer-http.md)
- [Trust model and migration](docs/integration-trust-model.md)
- [Directory governance](docs/operator-handover.md)
- [Direct canonical reads](docs/examples/direct-onchain-reads.md)

## Development

```sh
npm ci
npm test
npm run build
npm run typecheck
git diff --exit-code -- src/indexer/events/indexerEventCatalog.mjs
npx jsr publish --dry-run --allow-dirty
```

Golden tests run the protocol's real, pinned WASM data drivers and JSON/rkyv
fixtures locally. No test contacts a chain. `npm run generate` regenerates the
TypeScript types, builders and catalog from reviewed schema snapshots. This
repository does not publish or deploy as part of the build.

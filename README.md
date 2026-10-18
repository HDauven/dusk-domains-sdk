# Dusk Domains SDK

TypeScript SDK for the ADR 0004 frozen layer: directory, store shards,
registry-qualified resolvers, vault, replaceable policy and marketplace v1.
Version **0.4.1** targets a fresh frozen deployment. The 0.2 router/core/treasury
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
height and follows permanent forwarding with a 63-hop default limit.
`createClientFromManifest` verifies the directory; every other contract is verified the
first time an operation reads through it, so a contract that fails a check throws its
`ContractRefusedError` there. `discover()` verifies every admitted one up front, as a
health check, and `{ eager: true }` makes the factory run it before returning.
Verification checks the release artifact, the directory's admission or market
record, interface, deployment binding and init commitment. The directory reads a
contract's interface and binding when it admits it, so the client reads neither for a
contract the directory probed, only for those its init admitted unprobed
([trust model](docs/integration-trust-model.md#the-directorys-admission-as-proof)).
Verification belongs to the client. Nothing becomes readable or
signable until every check passes, a contract that fails one stays refused, and
`client.release` is the client's own copy of the release, so a contract another
client resolved or verified is never trusted here. Discovery does not
verify the selected policy: after a `SetPolicy` selects a policy the manifest does not
list yet, other reads and writes keep working. Registration verifies that policy
against the release wherever it is quoted, built or signed. `quoteRegistration` and
`prepareRegistration` report the missing release artifact, `registrationCalls` takes
only the unchanged quote object they returned, and the Connect app signs a reveal only
for terms its client quoted under the selection it read. Connect signs only for
contracts whose release descriptor commits to their code and initialization (`codeHash`
and `initHash`); others are readable only. For a target its client has not verified, it
throws an `UnverifiedContractError`, whose `cause` is the client's refusal when it
refused the contract. Multi-read operations, including
`prepareRegistration`, run at one height: a sequence that crosses a block is read
again, up to three times. The default transport reads the tip's height and block hash in
one request, so a block that replaces the tip at the same height counts as a new tip.
Operations share identical reads made at one tip, in flight or answered, open at a
height read that arrived in the last `heightReuseMs` (1 s by default), and close with a
height read sent after every reply they used, so a page reads each fact about once per
block. A view the release's lens answers in one query reads no tip: its reply reports its
height. A custom transport without `currentBlock` gives heights only: operations then
share an answered read only within `heightReuseMs`, as such a transport cannot show a
same-height replacement. Use a consistent node endpoint; height bracketing is not a
historical-state proof. The node is a
trust root for reads; the chain still enforces what a signed call pays
([trust model](docs/integration-trust-model.md#what-the-node-can-and-cannot-do)).
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
    codeHash?: string // BLAKE3 of the reviewed WASM; compared with the directory's evidence
    initHash?: string // init commitment; compared with the directory's evidence and a policy's live init
    // Without both, a store, resolver, policy or marketplace is readable but never signed for.
    dataDriver: {
      path: string // resolved relative to manifest URL
      bytes?: number
      sha256?: string
      blake2b256?: string
      blake3?: string // at least one digest; every supplied digest is verified
    }
  }>
  // Optional: the read lens, top-level only. The same fields, role 'lens', both commitments.
  lens?: { role?: 'lens'; contractId: string; codeHash: string; initHash: string; dataDriver: object }
}
```

`networkId` is also accepted when the manifest uses a human-readable `network`.
A numeric CAIP-2 chain ID supplies the byte when network is a label; contradictory
chain/network values reject.
For an in-memory manifest, provide `{ artifactBaseUrl }`. Node/indexer URLs can
be overridden explicitly in options. New admissions are discovered from reads;
`resolveContract(role, id, admission)` can supply reviewed release metadata for
an implementation absent from the initial manifest. It is subjected to the same
artifact, admission, interface, binding and init checks, and enters `client.release`
only once all of them pass. `verificationCache` (for example `sessionStorage`) keeps
what verification read about each contract, which a deployed contract cannot change,
for clients created later; every check runs again on it, and state is never kept. It
also keeps the lens deployment check and the lens's health, and is trusted for read
correctness ([trust model](docs/integration-trust-model.md#contract-verification)). A
contract verified from it serves reads only: before Connect signs for it, or a
registration is quoted under it, the client verifies it from the chain, once, and the
directory with it. Entries are keyed by the chain state the client's reads reach:
`transportNamespace` when given, else the default transport's node URL. A custom
`transport` without a `namespace`, or a custom `fetch`, keeps no entries unless
`transportNamespace` names where its reads go, and a custom `fetch` must otherwise send
each request to its URL. `admitDirectoryEvent` also accepts committed,
authenticated directory initialization/admission events; one that contradicts what
the client reads is rejected, and the contract stays verified.

## Reads and writes

Read scopes use the exact snake_case ABI: `client.directory.roles()`,
`client.directory.registration_context()`, `client.directory.renewal_schedule()`,
`client.store(id).children(page)`, `client.policy(id).quote(request)`,
`client.resolver(id).read_record_slot({ slot })`, `client.vault.read_state()`, and
`client.marketplace(id).read_order({ id: 1n })`. Every public canonical read takes
its current height itself. `verifyPrimary(endpointBytes)` verifies the current
owner/manager authority through `resolve_primary`, incarnation, lifecycle and
forward `moonlight_address` across admitted stores. Raw mappings remain available
through `client.store(id).read_primary({ endpoint })` for endpoint cleanup.

Use `getName` or `quoteRenewal` when the result's destination shard is needed for
a new write. Every `Located` read follows forwarding. Commitment reads stay on
their original shard. Never resend an already signed call to a new destination.

Pass the indexer's home store for the name or primary (`homeShard` in its rows, `store`
in the projection client's) as the hint in `getName(name, homeHint)` and
`verifyPrimary(endpoint, homeHint)`; `locate`, `quoteRenewal` and every `Located` read
start at the store they are given. A name page then makes the same reads however many
stores the directory admits. A hint is only where to look first: a wrong one costs
reads, never the answer, and without one the client asks every store.
`previewRegistration({ label, years, actor }, homeHint)` shows a registration quote for
display, letting the chain place the root; `prepareRegistration`, which reads every
store's home, builds the registration to sign.

`resolve(name, recordKeys, homeHint)` adds up to 16 records by key to `getName`.
`namePage(name, homeHint)` reads what a name's page shows at one height: the name, its
records, the verified primary of its `moonlight_address` endpoint and, for a root, its
renewal inputs. `pricing()` and `bootstrap()` read the selected policy's config and the
directory's state for a home page. When the release lists a `lens`, these, `getName`,
`verifyPrimary` and `previewRegistration` take one contract query each and no tip read,
however many stores the directory admits; the client checks the lens once, or once a
session with `verificationCache`, and every reply's evidence against the release, and reads
directly instead when a check fails or the lens refuses (`onLensFallback` reports why;
`useLens: false` always reads directly).
A rate-limited lens read is sent again after its `Retry-After`, three times a call, never
read directly instead. `previewRenewal(page, years)` shows a
page's renewal price without a read where it is the store's own quote, and quotes directly
elsewhere; builders refuse it, so a renewal is signed from `quoteRenewal`. Lens replies
never enter the client's verification or quote provenance, so the Connect app signs only
for contracts verified directly (`verifyContract`, or a direct read through it), and a
registration only from a direct quote. Builders refuse objects a lens `bootstrap()` or
`previewRenewal` returned; any other value passed to a builder is the caller's
responsibility, as from a direct read. To re-read a name directly before signing:
`client.store(page.store).get_name(page.key)`
([trust model](docs/integration-trust-model.md#the-read-lens)).

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

Pass `client.release` to the Connect app: it prepares and signs a call only for a
contract that client verified against release commitments, a custody hand-off only to
such a marketplace, and a reveal only for terms that client quoted; `submit` checks
again right before sending. Calls contain immutable reviewed arguments, an exact
decimal deposit and an explicit action gas limit. The wallet sends public transactions with transaction
value zero, checks public balance for deposit plus maximum gas cost, rechecks the
chain before submission and uses verified driver bytes.
It never accepts a caller-substituted prepared payload. Automatic gas price is
bounded to 1–10 Lux/gas; `gasPrice` can be supplied explicitly. Included failures
can consume the full gas limit even when the principal deposit is refunded.
The [gas policy](docs/gas-policy.md) documents measured VM budgets, contract
admission reserves and the bounds of the workload coverage.

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
fixtures locally, the lens's against replies read from the testnet lens. To compare the
client without a lens against the SDK before it, point `SDK_BASELINE` at a checkout of
`fedc2d24` with its dependencies installed:
`SDK_BASELINE=/path/to/sdk npx vitest run tests/lens-baseline.test.ts` (skipped otherwise). No test contacts a chain. `npm run generate` regenerates the
TypeScript types, builders and catalog from reviewed schema snapshots. This
repository does not publish or deploy as part of the build.

Property tests in `tests/fuzz` (fast-check) compare every catalog input with
the pinned drivers byte for byte, check that the strict schemas and the drivers
accept the same values and JSON text, decode mutated envelopes, and replay
arbitrary event sequences through the projection. `npm test` runs them with a
fixed seed and 20 cases each. For a long campaign, use
`npm run test:fuzz -- --duration 900 --numRuns 100 --seed 20261010`; it repeats
the properties with a new seed per batch and writes counts to `.fuzz/`.
`FUZZ_NUM_RUNS`, `FUZZ_SEED` and `FUZZ_PATH` replay a reported failure with
`npm test`. Both the SDK and frozen data drivers accept only canonical object-form
structs and string-form unit enums; serde's positional structs and
`{ "Variant": null }` spellings are rejected with regression coverage.

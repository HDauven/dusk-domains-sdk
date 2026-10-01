# Direct reads and primary-name display

Use a Dusk Connect app and a `contracts` map containing the deployed router,
core and treasury presets with matching IDs and data-driver URLs. The transport
routes names through the router to their home registry.

```ts
import {
  createDuskDomainsOnChainClient,
  createDuskDomainsOnChainReadTransport,
} from '@duskdomains/sdk'

const domains = createDuskDomainsOnChainClient({
  read: createDuskDomainsOnChainReadTransport(duskConnectApp, contracts),
  currentBlockHeight: readCurrentNodeHeight,
})
```

`duskConnectApp`, `contracts` and `readCurrentNodeHeight` are supplied by the
integrating application. The height callback returns a current nonnegative safe
integer from the configured node. Without it, active routing returns
`lifecycle_unavailable`.

## Resolve a record

```ts
const result = await domains.resolveName('aurora.dusk', 'moonlight_address')
if (!result.ok) throw new Error(result.error.message)

showRecipient(result.value.record.value)
```

`resolveName` checks active lifecycle and the requested record. `getNameOwner`
returns stored ownership; it does not alone prove an active registration.
`getRecords` reads a bounded configured key list, not arbitrary enumeration.
Use an explicit key for dynamic `text.*` or `service_endpoint.*` records.

## Verify a wallet display name

```ts
const endpoint = { type: 'moonlight_address', value: moonlightPublicKey } as const
const result = await domains.verifyPrimaryName(endpoint)

renderRecipient({
  label: result.ok ? result.value.primaryName : endpoint.value,
  raw: endpoint.value,
  verified: result.ok,
})
```

`moonlightPublicKey` is the real base58-encoded public key from the wallet.
Verification reads the primary mapping, checks active lifecycle, then compares
the forward record for the same endpoint type and value. Phoenix endpoints are
not v1 public primary names. Contract, asset and EVM records are separate
metadata types, never default Dusk wallet recipients.

Search, owner lists, subname lists and history use the indexer. See the
[integration trust model](../integration-trust-model.md) for fallback behavior
and [public surface](../public-surface.md) for write builders.

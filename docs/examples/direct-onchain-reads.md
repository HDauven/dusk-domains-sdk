# Direct On-Chain Reads

Status: MVP integration example

Dusk Domains has two read paths:

- Direct on-chain reads for canonical known-name lookups.
- Indexer reads for search, lists, history, and discovery.

Use direct reads when trust matters and the caller already knows the name or endpoint to check.

## Create a Direct-Read Client

```ts
import {
  createDuskDomainsOnChainClient,
  createDuskDomainsOnChainReadTransport,
} from '@dusk-domains/sdk'

const domains = createDuskDomainsOnChainClient({
  read: createDuskDomainsOnChainReadTransport(duskConnectApp, contracts),
})
```

The transport calls the deployed core contract read entrypoints:

- `get_name`
- `read_record`
- `read_primary_name`
- `pending_commitment`
- `fee_config`

## Owner Lookup

```ts
const owner = await domains.getNameOwner('aurora.dusk')

if (!owner.ok) {
  throw new Error(owner.error.message)
}

console.log(owner.value)
```

This does not require the Dusk Domains indexer.

## Record Lookup

```ts
const address = await domains.getRecord('aurora.dusk', 'moonlight_address')

if (!address.ok) {
  throw new Error(address.error.message)
}

sendTo(address.value.value)
```

`dusk_public_address` is accepted as an SDK alias for `moonlight_address`. The canonical contract record key remains `moonlight_address`.

## Primary-Name Verification

```ts
const endpoint = {
  type: 'moonlight_address',
  value: 'dusk1...',
} as const

const verification = await domains.verifyPrimaryName(endpoint)

if (verification.ok) {
  renderName(verification.value.primaryName)
} else {
  renderAddress(endpoint.value)
}
```

Verification uses only contract reads:

1. `read_primary_name(endpoint)` to get the candidate name.
2. `read_record(node, endpoint.type)` to prove the name points back to the same endpoint.

Do not display reverse records without the forward check.

## What Still Needs The Indexer

Direct contract reads intentionally do not replace the indexer. Use the indexer for:

- Search.
- My Domains.
- Subdomain lists.
- Activity and record history.
- Recent-change warnings.
- Referral and treasury dashboards.

The on-chain `getRecords(name)` helper reads a bounded set of known keys. It is not arbitrary record enumeration.

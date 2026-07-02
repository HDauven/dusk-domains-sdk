# Integration Quickstart

Status: MVP example

These examples show the minimum safe integration paths for wallets, explorers, DuskDS apps, and DuskEVM-facing apps. Use direct on-chain SDK reads for canonical known-name checks, and use the indexer/API response shape in `docs/indexer-api.md` for search, lists, history, and warning state.

For a direct-read-only example, see `docs/examples/direct-onchain-reads.md`. For package names, artifact manifests, provenance validation, and public/private release boundaries, see `docs/public-integration-release.md`.

## Public SDK Client

Use the manifest-first Dusk Domains client when integrating from public packages:

```ts
import { createDuskDomainsClientFromManifest } from '@dusk-domains/sdk'
```

```ts
const domains = await createDuskDomainsClientFromManifest({
  manifestUrl: 'https://artifacts.example/dusk-domains/devnet/manifest.json',
  indexerUrl: 'https://indexer.example',
  app: duskConnectApp,
})
```

The client uses contract reads for canonical known-name checks when `app` is provided, and indexer reads for search, My Domains, subdomains, history, warnings, and dashboards. Lower-level `createDuskDomainsOnChainClient`, `createDuskDomainsIndexerClient`, and `createDuskDomainsClient` constructors are available for advanced integrations that already manage those sources themselves.

## Wallet Recipient Display

Wallets must never display a primary name from reverse lookup alone. Resolve the endpoint to a candidate name, then forward-resolve the name back to the same typed endpoint.

```ts
const endpoint = {
  type: 'moonlight_address',
  value: 'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
} as const

const display = await domains.verifyPrimaryNameOnChain(endpoint)

recipientField.render({
  label: display.ok ? display.value.primaryName : abbreviate(endpoint.value),
  raw: endpoint.value,
  warning: display.ok ? null : display.error.message,
})
```

Before final confirmation, also inspect `resolveForward(...).warnings`. Recent resolver, primary-name, or high-risk record changes should be shown to the user before signing.

## Explorer Labels

Explorers can label public Moonlight accounts and contract IDs, but should keep labels secondary to raw identifiers.

```ts
async function labelMoonlightAddress(address: string) {
  const endpoint = { type: 'moonlight_address', value: address } as const
  const display = await domains.verifyPrimaryNameOnChain(endpoint)

  return {
    primary: display.ok ? display.value.primaryName : abbreviate(address),
    secondary: display.ok ? abbreviate(address) : null,
    verified: display.ok,
  }
}
```

Do not label Phoenix payment endpoints as public primary-name identities in v1. If a Phoenix endpoint appears as public metadata, show an explicit privacy warning and avoid reverse-primary display.

## DuskDS Contract Records

DuskDS apps should resolve typed `dusk_contract` records when routing to official or app-specific contracts. They should reject expired names, missing resolvers, unsupported resolvers, and missing records.

```ts
const bridge = await domains.resolveName('bridge.dusk', 'dusk_contract')

if (!bridge.ok) {
  throw new Error(bridge.error.message)
}

await callDuskContract({
  contractId: bridge.value.record.value,
  method: 'deposit',
  args,
})
```

Contract-level callers should read one explicit record at a time. They should not enumerate arbitrary text/profile records or rely on indexer-only warning state.

## DuskEVM Address Records

DuskEVM-facing apps can read `evm_address` records as external metadata. They must not treat those records as default Dusk transfer targets.

```ts
const evm = await domains.resolveName('issuer.acme.dusk', 'evm_address')

if (evm.ok) {
  renderExternalAddress({
    label: evm.value.canonicalName,
    address: evm.value.record.value,
    network: 'DuskEVM',
  })
}
```

If a flow sends DUSK or Dusk-native assets, prefer a verified `moonlight_address` record. If a flow sends on DuskEVM, show the EVM address and network explicitly before signing.

## Record Write Intents

Apps with a Dusk transaction transport can expose record updates through the lower-level write-intent client without bypassing name and record validation.

```ts
import { createDuskDomainsReadWriteClient } from '@dusk-domains/sdk'

const writes = createDuskDomainsReadWriteClient({ read, write })

const update = await writes.setRecord('aurora.dusk', 'website', 'https://dusk.domains')
const remove = await writes.clearRecord('aurora.dusk', 'website')

if (!update.ok || !remove.ok) {
  throw new Error((update.ok ? remove.error : update.error).message)
}
```

The write transport is responsible for preparing, signing, and submitting the underlying Dusk contract call. After a confirmed write, refetch the name from the indexer instead of assuming optimistic state is canonical.

For multiple record changes, use the bounded batch helper so the contract applies the set/clear operations atomically:

```ts
const batch = await writes.mutateRecords('aurora.dusk', [
  { action: 'set', key: 'website', value: 'https://dusk.domains' },
  { action: 'clear', key: 'avatar' },
])

if (!batch.ok) {
  throw new Error(batch.error.message)
}
```

The batch helper rejects duplicate keys and unsupported or invalid records before creating the write intent.

## One-Hour Integration Checklist

- Normalize user input before lookup.
- Use typed record keys; never ask for a generic `address`.
- For display names, use reverse lookup plus typed forward verification.
- Show the raw address or contract ID before signing.
- Surface `warnings` from forward-resolution responses before final confirmation.
- Treat Phoenix endpoint records as opt-in public metadata, not primary identities.
- Reject expired names, missing resolvers, invalid resolvers, and invalid records.
- Keep official/custom resolver policy explicit for value-bearing flows.

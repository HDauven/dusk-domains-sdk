# Wallet Primary-Name Display Example

Wallets and explorers must display `.dusk` names only after typed reverse-plus-forward verification.

```ts
import { createDuskDomainsReadWriteClient } from '@hdauven/dusk-domains-sdk'

const domains = createDuskDomainsReadWriteClient({
  read: {
    async getRecords(canonicalName) {
      return indexer.records(canonicalName)
    },
    async getPrimaryName(endpoint) {
      return indexer.primaryName(endpoint.type, endpoint.value)
    },
  },
})

const endpoint = {
  type: 'moonlight_address',
  value: 'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
} as const

const display = await domains.getDisplayName(endpoint)

renderRecipient({
  label: display.display,
  raw: display.raw,
  verified: display.verified,
  reason: display.reason?.message,
})
```

Rules:

- `moonlight_address` is eligible for default v1 primary-name display.
- `phoenix_payment_endpoint` is rejected for v1 primary-name display and falls back to the raw endpoint.
- `dusk_contract`, `dusk_asset`, and `evm_address` are not default Dusk wallet recipients.
- Any mismatch between reverse lookup and forward lookup falls back to the raw endpoint with a reason.

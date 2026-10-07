# Direct canonical reads

```ts
import { createClientFromManifest, nameKey } from '@duskdomains/sdk'

const client = await createClientFromManifest(
  'https://your-release-host.example/frozen/manifest.json',
)
const deployment = await client.discover()
console.log(deployment.config.registration.operator_paused)
console.log(await client.directory.roles())
console.log(await client.directory.renewal_schedule())
console.log(await client.vault.read_balance())

const located = await client.getName('example.dusk')
if (located.value !== 'Absent' && 'Local' in located.value) {
  const records = await client.store(located.store).read_records(
    nameKey('example.dusk'),
  )
  console.log(records, located.height)
}
```

These calls acquire block height themselves. Supply `{ nodeUrl, indexerUrl }`
only when deliberately overriding manifest endpoints. A custom `ReadTransport`
implements raw contract-byte reads and `currentBlockHeight`; the public default
HTTP transport already supplies both.

All u64 fields decode to bigint, except Lux which remains decimal text. All
failures propagate, including height, membership, binding and resolver failures.
The final home returned by getName is the target for a newly constructed write.
`read_primary` is raw; use `verifyPrimary` for verified endpoint display.

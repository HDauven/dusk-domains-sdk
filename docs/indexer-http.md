# Frozen projection HTTP API v1

`@duskdomains/sdk/indexer` exports the HTTP client, response types and write
confirmation helpers. `createIndexerClientFromManifest(manifest, options?)` binds
the client to the release's indexer URL, chain and directory. For explicit setup,
use `createDuskDomainsIndexerClient({ baseUrl, chainId, directory, fetch?, timeoutMs? })`.
No request is made during construction. The default request timeout is 10 seconds.

This is the frozen indexer's integration contract, **not the legacy 0.2 HTTP
schema**. The indexer migration must implement these routes and fixtures. No
running indexer was contacted to establish deployment compatibility.

Every GET returns the same envelope (including absence):

```ts
interface IndexerResponse<T> {
  apiVersion: 1
  chainId: string
  directory: string // unprefixed contract hex
  snapshot: { height: bigint; blockHash: string }
  data: T
}
```

Serialize with `stringifyJson`: heights/IDs are integer tokens, Lux is decimal
text, bytes are number arrays. The client uses lossless parsing, validates wire
objects and checks deployment and request identities. HTTP errors, malformed
responses and unavailable state throw; absence is an explicit null/`Absent` in
a successful envelope. Extra envelope metadata may be added; ABI objects remain
strict. All routes are relative to `<baseUrl>/v1/`.

| Route            | Query                                                  | `data`                                                                 |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `health`         | none                                                   | `{ complete, finalizedHeight, lagBlocks }`                             |
| `name`           | `store, root, node`                                    | `{ store, key, value: Located<NameView> }`                             |
| `records`        | `store, root, node`                                    | `{ store, key, value: Located<RecordsView> }`                          |
| `children`       | `store, root, node, start?, limit`                     | `{ store, key, value: Located<Children> }`                             |
| `home`           | `store, root`                                          | `{ store, root, value: Home }`                                         |
| `cooldowns`      | `store, root, node, initiator`                         | `{ store, key, value: Located<MoveCooldowns> }`                        |
| `names`          | `store?, owner?, cursor?, limit, blockHash?`           | `{ items: Array<{store, name: Name}>, nextCursor }`                    |
| `primary`        | `store, endpoint`                                      | `{ store, endpoint, value: PrimaryView \| null }` (raw mapping)        |
| `commitment`     | `store, actor, hash`                                   | `{ store, key: CommitmentKey, value: Commitment \| null }`             |
| `move`, `import` | `store, id`                                            | `{ store, id, value: MoveStatus \| ImportStatus \| null }`             |
| `directory`      | none                                                   | `DirectoryConfig`                                                      |
| `renewal`        | none                                                   | `RenewalSchedule`                                                      |
| `policy`         | `policy`                                               | `{ policy, config: PolicyConfig }`                                     |
| `vault`          | none                                                   | `ProjectionState['vault']` (accounted funds, not runtime surplus)      |
| `referral`       | `kind, bytes`                                          | `{ beneficiary, value: ReferralRow \| null }`                          |
| `orders`         | `market, cursor?, limit, blockHash?`                   | `{ items: Array<{market, order: Order}>, nextCursor }`                 |
| `refund`         | `market, authority`                                    | `{ market, authority, value: Refund \| null }`                         |
| `transaction`    | `id`                                                   | `{ id, height, blockHash, success } \| null`                           |
| `events`         | `transactionId?, emitter?, cursor?, limit, blockHash?` | `{ items: Array<{transactionId, event: CommittedEvent}>, nextCursor }` |

Queries encode bytes as unprefixed hex. The name family exposes the projection's
`projectedName`, `projectedRecords`, `projectedChildren`, `projectedHome`,
`projectedCommitment`, `projectedMoveStatus` and `projectedCooldowns` semantics.
It preserves source forwards instead of hiding their destination. Raw primaries
must be verified against active name and forward endpoint before identity use.
Do not fabricate lifecycle from wall time or merge legacy IDs with generations,
serials, epochs, mapping IDs or custody nonces.

`getNameState`/`searchName` require a store scope; canonical discovery is
`FrozenClient.getName`. The records, names, order and event APIs return envelopes
so consumers retain observation height and block identity. General page limits
are 1–100 (default 50), children use 1–16 (default 16).
`collectIndexerPages(load, { maxItems?, signal? })` pins the first block hash,
checks snapshot height and cursor progress and fails at its item bound rather
than returning a silently partial set. The server must honor `blockHash` or fail
when that snapshot is no longer retained. Cursors are opaque and must retain
filters and snapshot identity. Reorgs require rollback/replay before publishing
responses; do not serve replaced transactions as current confirmations.

Store the source transaction ID/block hash/success alongside projection receipts;
`ProjectionState.receipts` alone is not an execution-receipt database. Failed
transactions can be reported by `transaction`, but their effects never appear in
`events` or the projected tables. Event data has no activity labels/descriptions.

```ts
import {
  createIndexerClientFromManifest,
  waitForIndexerWrite,
} from '@duskdomains/sdk/indexer'

const indexer = createIndexerClientFromManifest(client.release.manifest)
const confirmation = await waitForIndexerWrite(indexer, txHash, {
  attempts: 20,
  delayMs: 1000,
  signal: abortController.signal,
  // Optional additional check that the intended projected state is visible.
  check: async () => {
    const row = await indexer.getNameState(store, key)
    return typeof row.data.value === 'object' && 'Local' in row.data.value
  },
})
```

`waitForIndexerConfirmation({ check, attempts?, delayMs?, wait?, signal? })`
supports other writes. Results are `{ confirmed, attempts, error }`; exhaustion
is not success. `waitForIndexerWrite` requires the exact successful transaction
on the indexer's canonical branch before an optional state check. Confirmation
is an observation, not consensus finality, and may be invalidated by a reorg.
Use canonical node reads for a newly reviewed payment or write.

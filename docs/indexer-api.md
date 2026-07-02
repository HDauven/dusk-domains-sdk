# Indexer API

Status: MVP baseline

The indexer/API layer is a read model over DuskDS events and contract reads. It must not become the canonical source of ownership, resolver records, or reverse records.

## Health And Replay State

Local and hosted indexers should expose operational read-model status through:

```text
GET /health
```

Response fields:

| Field | Meaning |
| --- | --- |
| `ok` | Whether the indexer process can serve reads. |
| `generatedAt` | Timestamp for the loaded snapshot or replayed event-log view. |
| `source` | Human-readable source identifier. |
| `mode` | `snapshot` or `event-log`. |
| `currentBlockHeight` | Best known local chain height, derived from the live collector cursor when available. |
| `routes` | Advertised local-live read routes served by this indexer instance. |
| `names` | Number of active indexed names currently served by list/search/resolve routes. |
| `degradedReason` | Reason code and message when `ok=false`; omitted when the indexer is healthy. |
| `warnings` | Non-fatal replay warnings, such as malformed skipped event-log rows. |
| `cursor` | Optional live collector status when a collector cursor file is available. |
| `checkpoint` | Optional event-log replay checkpoint derived from the log itself. |

`checkpoint` is a local-live diagnostic, not canonical protocol state. It reports the number of deduped events replayed, raw event rows, duplicate count, warning count, and the last replayed event's contract, event name, transaction ID, and block height when those fields are known.

## Forward Resolution

MVP forward resolution is represented by `src/names/indexer.ts`.

Request shape:

```text
GET /resolve?name=aurora.dusk
```

Equivalent path-style routing may be used:

```text
GET /resolve/aurora.dusk
```

Response fields:

| Field | Meaning |
| --- | --- |
| `canonicalName` | Normalized `.dusk` name. |
| `node` | BLAKE2b-256 recursive namehash. |
| `records` | Typed public resolver records. |
| `resolver.resolverId` | Resolver contract/module identifier when known. |
| `resolver.health` | `ok`, `missing`, or `invalid`. |
| `expiry.status` | `active`, `expired`, or `missing`. |
| `expiry.expiresAt` | Expiry timestamp when known. |
| `cache.asOf` | Time the indexer response was produced. |
| `cache.ttlSeconds` | Safe cache duration for the response. |
| `cache.staleAt` | Time after which clients should refresh. |
| `warnings` | Recent high-risk change warnings derived from indexer activity state. |
| `verificationStatus` | `forward_resolved` only when no blocking errors exist. |
| `errors` | Structured errors for missing names, expired names, resolver failures, or invalid records. |

## Cache Rules

- The response TTL is the lower of the default indexer TTL and positive TTLs on returned records.
- The default TTL is 300 seconds.
- Missing or invalid names return `ttlSeconds: 0`.
- HTTP adapters should set `Cache-Control: public, max-age=<ttlSeconds>`.
- Wallets may cache successful reads until `cache.staleAt`, but value-bearing flows should refresh before signing.
- Recent-change warnings are separate indexer state and should not be inferred only from cache TTL.

## Recent-Change Warnings

Wallets and explorers should inspect the `warnings` array before final confirmation in value-bearing flows. MVP warnings are generated for:

| Warning | Trigger |
| --- | --- |
| `recent_resolver_change` | Resolver reference changed within the warning window. |
| `recent_primary_name_change` | Reverse primary-name state changed within the warning window. |
| `recent_high_risk_record_change` | A high-risk resolver record changed within the warning window. |

The default warning window is 3 days. High-risk resolver records include value-routing or trust-sensitive records such as `moonlight_address`, `phoenix_payment_endpoint`, `dusk_contract`, `dusk_asset`, `evm_address`, `website`, `compliance_ref`, and `service_endpoint.<name>`.

Warnings are advisory metadata, not canonical state. Clients must still refresh resolution before signing and must still require typed forward/reverse verification before displaying primary names.

## Direct Resolver Records

Resolver records are indexed generically by `(node, key)`. Known keys get product semantics from the record vocabulary, but the current-state index and history index do not require a schema change when a new record key is added.

Request shapes:

```text
GET /records?node=0x...
GET /record?node=0x...&key=website
GET /record-history?node=0x...
GET /record-history?node=0x...&key=website
```

`/records` returns the current resolver records for the node. `/record` returns the current record for one key, or `null`. `/record-history` returns append-only set/clear events with current and previous record payloads when available:

| Field | Meaning |
| --- | --- |
| `node` | Namehash node. |
| `key` | Resolver record key, for example `moonlight_address`, `website`, `text.notice`, or `service_endpoint.compliance`. |
| `action` | `set` or `clear`. |
| `record` | New resolver record for `set`, otherwise `null`. |
| `previousRecord` | Previous current record if the indexer had one before this event. |
| `controller` | Principal or controller value attached to the resolver event. |
| `updatedAt` | Record update timestamp or indexer fallback timestamp for clears. |
| `txId` / `blockHeight` / `eventIndex` | Event envelope metadata when available. |
| `eventType` | Source event, `record_changed` or `record_cleared`. |

These routes are read-model helpers. Contract resolver state remains canonical, and value-bearing clients should still refresh typed forward resolution before signing.

## Error Rules

Forward resolution should return structured errors rather than ambiguous failures:

| Error | Meaning |
| --- | --- |
| `missing_name` | Name is invalid or unavailable to the indexer. |
| `expired_name` | Name exists but is expired. |
| `missing_resolver` | Name has no resolver. |
| `invalid_resolver` | Resolver is present but rejected by indexer policy. |
| `invalid_record` | A record fails typed record validation. |

Clients should treat any error as `verificationStatus: unverified` and avoid displaying a name as safely resolved.

## Treasury State

Local and hosted indexers may expose protocol fee read-model state through:

```text
GET /treasury
```

Response fields:

| Field | Meaning |
| --- | --- |
| `initialized` | Whether treasury operator settings have been indexed. |
| `operator` | Typed principal allowed to claim protocol fees, encoded as `{ kind, bytes }` where `kind` is `Moonlight`, `Phoenix`, or `Contract`. |
| `operatorRecipient` | Moonlight recipient configured for withdrawals. |
| `operatorAuthority` | Legacy compatibility key derived from `operator` when reading old snapshots or event logs. New consumers should prefer `operator`. |
| `allowedFeeSources` | Controller/registrar contract IDs accepted as protocol-fee sources. |
| `totalReceivedLux` | Total protocol fees observed by the read model. |
| `availableLux` | Fees currently available to claim according to indexed treasury events. |
| `registrationReceivedLux` | Cumulative registration fees observed by the read model. |
| `renewalReceivedLux` | Cumulative renewal fees observed by the read model. |
| `otherReceivedLux` | Cumulative future/other fee receipts observed by the read model. |
| `lastFeeSourceContract` | Most recent fee-source contract ID, when the latest accounting event was a fee receipt. |
| `lastFeeReason` | Most recent fee reason: `registration`, `renewal`, or `other`. |
| `lastFeeNode` | Name node attached to the latest fee receipt when relevant. |
| `lastEventType` | Latest treasury event applied. |
| `claims` | Recent operator claim events with amount, remaining balance, transaction ID, and block height. |

This is a read model over treasury events. Contract state remains canonical.

## Referral State

Deployments that support referral rewards should expose referrer accounting through:

```text
GET /referrals?referrer=0x...
```

Response fields:

| Field | Meaning |
| --- | --- |
| `supported` | Whether this deployment has referral reward accounting enabled. |
| `referrer` | Stable referrer principal key requested by the client, when supplied. Typed principal event payloads are normalized to this key by the indexer. |
| `claimableLux` | Referral rewards currently claimable by the connected referrer. |
| `claimedLux` | Referral rewards already claimed by the referrer. |
| `referralCount` | Number of indexed referral-attributed registrations. |
| `recentActivity` | Recent referral accrual and claim rows, including amount, transaction ID, block height, and counterparty when indexed. |

When referral rewards are implemented, this route is a read model over `referral_reward_accrued` and `referral_reward_claimed` events. Contract state remains canonical for claim authorization and payouts. If referral rewards are supported but the requested referrer has no rewards, return `supported: true` with zero balances and an empty activity list. When referral rewards are not implemented for a deployment, return `supported: false` with zero balances and an empty activity list. The frontend must not submit referral claim actions in that state.

Direct node and endpoint routes fail fast on malformed route parameters before loading the backing snapshot or event-log store:

| HTTP status | Error | Trigger |
| --- | --- | --- |
| `400` | `missing_node` | `/name`, `/activity`, or `/subname` is missing `node`, or `/subnames` is missing `parentNode`. |
| `400` | `invalid_node` | A `node` or `parentNode` parameter is not a 32-byte hex node, with or without the `0x` prefix. |
| `400` | `missing_commitment` | `/commitment` is missing `commitment`. |
| `400` | `invalid_commitment` | A `commitment` parameter is not a 32-byte hex value, with or without the `0x` prefix. |
| `400` | `missing_record_key` | `/record` is missing `key`. |
| `400` | `invalid_record_key` | `/record` or `/record-history` has a malformed `key`. |
| `400` | `missing_endpoint` | `/reverse` is missing either `type` or `value`. |
| `400` | `unsupported_endpoint_type` | `/reverse` was called with an endpoint type outside the MVP reverse lookup allowlist. |

## Search And Availability

Search returns the same name-analysis shape used by the web app. It combines normalization, reserved-name policy, availability, launch pricing, and blocking warnings.

Request shape:

```text
GET /search?query=aurora
```

Response fields:

| Field | Meaning |
| --- | --- |
| `canonical` | Canonical `.dusk` form used for downstream calls. |
| `canonicalRaw` | Raw canonical form retained for display/debugging. |
| `displayName` | Display-safe name. |
| `label` | Registrable second-level label. |
| `status` | `available`, `registered`, `reserved`, or `invalid`. |
| `price` | Annual base registration price in DUSK. |
| `issues` | Search warnings/errors with `tone` and `text`. |
| `transactionBlocked` | Whether registration should be blocked before signing. |
| `reserved` | Reserved-name policy when applicable. |

Availability is derived from lifecycle state. Active names and expired names still inside their grace window return `registered`. Released names and expired names whose grace period has ended return `available`, while their historical lifecycle and activity rows remain readable through `/name` and `/activity`. Available historical names must not remain in active `/resolve`, `/reverse`, or owner-filtered `/names` results.

## Indexed Name State

Lifecycle state is keyed by node. It is a read model over registrar and registry events, not canonical contract state.

Request shape:

```text
GET /name?node=0x...
```

Response is either `null` or an `IndexedLifecycleName`:

| Field | Meaning |
| --- | --- |
| `node` | Namehash node. |
| `canonicalName` | Current canonical name label known to the indexer. |
| `owner` | Current owner, if known. |
| `manager` | Current manager/controller, if known. |
| `resolverId` | Current resolver contract ID, if known. |
| `expiresAt` | Expiry timestamp, if known. |
| `graceEndsAt` | Grace-period end timestamp, if known. |
| `status` | `active`, `expired`, or `released`. |
| `lastEventType` | Latest lifecycle event that updated the row. |

## Indexed Names List

The My Names view uses the names list route. It returns lifecycle rows enriched with the summary fields needed for a portfolio-style list. The optional owner filter matches either owner or manager/controller.

Request shape:

```text
GET /names
GET /names?owner=0x...
```

Each row includes the `IndexedLifecycleName` fields plus:

| Field | Meaning |
| --- | --- |
| `records` | Current resolver records indexed for the name. |
| `primaryName` | Reverse primary name for the indexed Moonlight address, when one is known. `null` when missing or no Moonlight address is set. |
| `primaryStatus` | `verified`, `missing`, `mismatch`, or `no_address`. `verified` means the indexed Moonlight address reverse-resolves to this same name and the reverse row points to the same node. |
| `subnameCount` | Count of active indexed subnames under this parent name. Revoked subnames remain inspectable through `/subname` but do not count here. |
| `activityCount` | Count of indexed activity items for this name. |

## Activity

Activity is keyed by node and includes lifecycle, resolver, reverse, and subname activity relevant to that node.

Request shape:

```text
GET /activity?node=0x...
```

Response is an array of `ActivityEntry` objects with `id`, `eventType`, `node`, `name`, `actor`, `timestamp`, `blockHeight`, and optional `txId` / `target`.

## Registration Commitments

The local live app uses the controller commitment read model to unlock reveal after the committed block has matured.

Request shape:

```text
GET /commitment?commitment=0x...
```

Response is an `IndexedRegistrationCommitment` row or `null`. Committed rows include `committedTxId` and `committedBlockHeight`; revealed rows additionally include `node`, `revealedTxId`, and `revealedBlockHeight`.

Clients should use this route only as a reactive UI/read-model aid. The controller contract remains the source of truth for whether reveal is actually allowed.

## Subnames

Subname dashboards need both parent-scoped lists and single subname reads.

Request shapes:

```text
GET /subnames?parentNode=0x...
GET /subname?node=0x...
```

`/subnames` returns an array of `IndexedSubname` rows. `/subname` returns one row or `null`.

Each `IndexedSubname` includes parent/name identifiers, owner, manager, resolver, expiry policy, revocation policy, status, creation/revocation timestamps, and transaction/block metadata. Subname records remain resolver records on the subname node and must not be merged into the parent records.

`/subnames` is an active namespace list. It excludes revoked subnames and returns an empty list if the parent name is released or expired beyond grace, even if historical subname rows remain inspectable through `/subname`.

## Typed Reverse Lookup

Reverse lookup is typed by endpoint kind. MVP clients use it for Moonlight primary-name verification and may later use it for contract labels or external address families. Phoenix endpoints are recognized endpoint metadata, but they must not be treated as default public identity targets in v1.

Request shape:

```text
GET /reverse?type=moonlight_address&value=dusk1...
```

Unknown endpoint types return `400 unsupported_endpoint_type`. Recognized endpoint types that are not public primary-name identities, such as `phoenix_payment_endpoint`, return `null` rather than a displayable primary name.

Response shape:

```json
{
  "primaryName": "aurora.dusk",
  "name": "aurora.dusk",
  "node": "0x..."
}
```

Clients should treat `primaryName` / `name` as the candidate primary name and `node` as diagnostic/indexed reverse metadata. The display rule still requires typed forward verification against the queried endpoint. Equivalent accepted beta shapes are:

```json
{ "name": "aurora.dusk" }
```

```json
null
```

Clients must forward-resolve the returned name for the same endpoint type and verify that it points back to the queried endpoint before displaying it as a primary name.

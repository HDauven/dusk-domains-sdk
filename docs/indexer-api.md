# Indexer API

Status: MVP baseline

The indexer/API layer is a read model over DuskDS events and contract reads. It must not become the canonical source of ownership, resolver records, or reverse records.

## Pagination and public HTTP policy

All collection requests accept `limit` (default **50**, maximum **200**) and an
opaque `cursor`. `limit` must be a positive decimal integer; values above 200
are clamped. Empty, negative, fractional, nonnumeric, or repeated limits return
400 `invalid_limit`. Malformed, oversized, repeated, or mismatched cursors return
400 `invalid_cursor` before the store is read.

```text
GET /names?owner=0x...&limit=50
GET /names?owner=0x...&limit=50&cursor=<nextCursor from the previous response>
```

```json
{ "names": [], "nextCursor": null }
```

Pass cursors back verbatim (URL-encoded) with the same route and filters. The page
size may change. A non-null `nextCursor` means another page exists; `null` is the
last page, including an empty result. Cursors encode the last sort key and query
scope, never an offset. Inserting or deleting earlier rows does not shift later
pages. These are live reads, not a frozen snapshot: rows inserted before the
cursor are seen on a fresh traversal, and ownership, expiry, or order changes may
remove rows between requests. Cursors are versioned continuation tokens, not
credentials or encrypted data.

**Migration:** these endpoints previously returned bare arrays, so there were no
existing top-level item field names to retain. They now return the named arrays
below plus `nextCursor`; every item keeps its existing fields. Direct HTTP clients
must unwrap the array. The updated SDK keeps its existing array-returning methods
(first page), adds `*Page` methods exposing the named array and cursor, and accepts
legacy array responses for a staged rollout. Deploy compatible clients before
switching the server. `/names` without `owner` is always paginated.

All 24 GET routes were reviewed:

| Route | Pagination and ordering |
| --- | --- |
| `/health` | `warnings` + `nextCursor`; stable diagnostic keys. Other arrays are bounded route/schema/deployment diagnostics. |
| `/commitment` | Single commitment or null. |
| `/search` | Single exact-name availability result, **not** a search-results list in this API. Existing fields retained; accepts/validates `limit` and returns `nextCursor: null`. No continuation cursor is valid. |
| `/names` | `names`; canonical name then node, ascending. Owner/controller filter applies before pagination. |
| `/resolve` | `warnings` + `nextCursor`, newest timestamp first with immutable event identity as a tie-breaker. Resolution fields retained; embedded current records are contract-bounded (16). |
| `/name` | Single lifecycle state or null. |
| `/records` | `records`; record key ascending (also contract-bounded to 16). |
| `/record` | Single record or null. |
| `/record-history` | `history`; block height, event index, timestamp descending, then transaction/key/content digest to break ties. Optional `key` filter retained. |
| `/activity` | `activity`; block height and timestamp descending, then transaction/ID/content digest to break ties. Missing height sorts after known heights. |
| `/reverse` | Single reverse result or null. |
| `/subnames` | `subnames`; name then node ascending; only live entries. |
| `/subname` | Single live subname or null. |
| `/treasury` | Single aggregate; `claims` already capped at 12 by the projection, fee sources are contract configuration. |
| `/referrals` | Single referrer's aggregate; `recentActivity` already capped at 12. |
| `/fee-config` | Single configuration. |
| `/marketplace/config` | Single configuration. |
| `/marketplace/fixed-sales` | `fixedSales`; node ascending. |
| `/marketplace/fixed-sale` | Single order or null. |
| `/marketplace/auctions` | `auctions`; node ascending (bids do not move an order between pages). |
| `/marketplace/auction` | Single order or null. |
| `/marketplace/offers` | `offers`; node then buyer authority ascending; optional filters apply before pagination. |
| `/marketplace/offer` | Single offer or null. |
| `/marketplace/refund` | Single refund balance or null. |

String keys use deterministic code-point ordering. Selection retains at most
`limit + 1` rows and hydrates only the selected name/order summaries. The existing
in-memory read model still requires a linear scan; this is not a database-index
migration. A reverse-proxy limit remains recommended to bound aggregate traffic.

SDK examples:

```ts
const page = await indexer.getNamesPage({ owner, limit: 50 })
if (page.nextCursor) {
  const next = await indexer.getNamesPage({ owner, cursor: page.nextCursor })
}
const allOwned = await indexer.getAllNames({ owner, maxItems: 1000 })
const allChildren = await indexer.getAllSubnames(parentNode, 1000)
```

Complete-set helpers require an owner/parent, use pages of at most 200, and have a
hard maximum of 10,000 items (caller may lower it). Legacy bare arrays may exceed
200 items; they are still validated and complete-set reads enforce the same cap.
They throw on overflow or a non-advancing cursor instead of silently returning a partial set. They must not be
used to crawl the global namespace. `getActivityPage`, `getNodeRecordsPage`,
`getRecordHistoryPage`, `getSubnamesPage`, `getMarketplaceFixedSalesPage`,
`getMarketplaceAuctionsPage`, and `getMarketplaceOffersPage` expose the other
collections. `getHealth({ limit, cursor })` pages diagnostics.
`resolveForward(name, { limit, cursor })` pages recent-change warnings while
retaining the current resolution fields. Warning age is not part of the cursor;
warnings can age out of the three-day window between requests.

### Rate limiting and proxy trust

The app uses a fixed window per IPv4 address or IPv6 /64 prefix, before loading
the store. Defaults:

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `NODE_ENV` | development behavior unless `production` | Production turns on limits and closes empty CORS configuration. |
| `DUSK_DOMAINS_INDEXER_RATE_LIMIT` | `true` in production; `false` otherwise | Enable/disable the app limiter (`true`/`false` or `1`/`0`). |
| `DUSK_DOMAINS_INDEXER_RATE_LIMIT_MAX` | `200` | Requests per IPv4 address or IPv6 /64 per window; positive integer. |
| `DUSK_DOMAINS_INDEXER_RATE_LIMIT_WINDOW_MS` | `60000` | Window duration in milliseconds; positive integer. |
| `DUSK_DOMAINS_INDEXER_TRUST_PROXY` | `false` | Use the last `X-Forwarded-For` address, the one the proxy appended, when valid instead of the socket peer. |
| `DUSK_DOMAINS_INDEXER_CORS_ORIGINS` | `*` in development; empty in production | Comma-separated exact browser origins. |

All requests, including health checks and preflights, count. Exhaustion returns
HTTP 429, `{ "error": "rate_limited", "message": "Too many requests." }`, and
`Retry-After` in seconds. Expired budgets are pruned before admitting a new client.
At most 100,000 active client keys are retained; new clients receive 429 while
that table is full. Budgets are
process-local and reset on restart. Add a reverse-proxy/global limit in front of
multiple instances. Keep proxy trust off unless the indexer is reachable only
through one trusted proxy. With trust on, the indexer reads the last
`X-Forwarded-For` entry, which that proxy writes, so addresses a client puts in
the header itself are ignored. Behind a chain of proxies, have the outermost one
overwrite the header.

The frontend fixture session (home, search, a name with 20 subnames, marketplace,
and two continuation pages) makes 49 requests, including health and two wallet
owner queries. The 200-request default provides roughly four such sessions per
minute. Child resolution uses four workers and shares a successful health check
for five seconds; explicit health polling remains fresh. Requests across tabs or
users sharing a client key consume the same budget.

### Errors and CORS

Client errors retain short codes and specific messages, e.g.
`{ "error": "invalid_limit", "message": "limit must be a positive integer." }`.
Unknown routes return 404 `not_found`; absent entities retain their existing
200/null semantics. Forward-resolution validation retains its structured `errors`
array. Unexpected failures return HTTP 500 with only:

```json
{ "error": "internal_error", "requestId": "server-generated UUID" }
```

Every response also has `X-Request-Id`. Detailed exceptions are logged with the
same ID, never sent to clients. Health warnings/degradation retain diagnostic
codes and status, with generic public messages; detailed warnings, cursor errors,
and durability checks are logged with the health request ID. Local database and
checkpoint paths are omitted from public diagnostics. Default responses use
`Cache-Control: no-store`; successful forward resolution keeps its existing TTL.

Configure `DUSK_DOMAINS_INDEXER_CORS_ORIGINS=https://dusk.domains,https://app.example`.
Only matching request origins receive `Access-Control-Allow-Origin`; responses
vary on `Origin`. OPTIONS, error responses, and 429s use the same policy.
`Retry-After` and `X-Request-Id` are exposed to allowed browser origins. Development
keeps `*` by default. In production an empty allowlist (or `*` alone) grants no
cross-origin access and logs a startup warning. CORS controls browsers, not
server-to-server access; the public read API requires no authentication.

`DUSK_DOMAINS_INDEXER_CORS_ORIGIN` remains a compatibility alias; the plural variable
takes precedence, even when empty. `--cors-origin` overrides either with the same
comma-separated allowlist syntax. The systemd unit and Docker image select
production mode; `.env.example` enables the limiter and lists the frontend origin.

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
| `400` | `invalid_controller` | A `/commitment` `controller` parameter is not a 32-byte hex value, with or without the `0x` prefix. |
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
| `subnameCount` | Count of active indexed subnames under this parent name. Expired subnames are excluded. Contract capacity is reclaimed only by recreation, explicit pruning, or root re-registration. |
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
GET /commitment?commitment=0x...&controller=0x...
```

Response is an `IndexedRegistrationCommitment` row or `null`. Committed rows include `committedTxId` and `committedBlockHeight`; revealed rows additionally include `node`, `revealedTxId`, and `revealedBlockHeight`.

Commitments are scoped per controller, as the core contract keys them by `(controller, commitment)`. With `controller`, the route returns that controller's row for the hash or `null`. Without it, the route returns the most recently updated row for the hash, whichever controller wrote it; clients reading their own commitment should pass `controller` (`getCommitment(commitment, controller)`).

Clients should use this route only as a reactive UI/read-model aid. The controller contract remains the source of truth for whether reveal is actually allowed.

## Subnames

Subname dashboards need both parent-scoped lists and single subname reads.

Request shapes:

```text
GET /subnames?parentNode=0x...
GET /subname?node=0x...
```

`/subnames` returns an array of `IndexedSubname` rows. `/subname` returns one row or `null`.

Each `IndexedSubname` includes parent/name identifiers, owner, manager, resolver, expiry and grace end, expiry policy, status, creation timestamp, and transaction/block metadata. Subname records remain resolver records on the subname node and must not be merged into the parent records.

A subname's `graceEndsAt` is the grace end its parent had when the subname was created. Renewing a root name also renews each `inherits_parent` subname whose ancestors up to that root all inherit too: those rows take the root's new `expiresAt` and `graceEndsAt`. A `fixed_before_parent` subname keeps its lifecycle, and so do the subnames below it.

`/subnames` is an active namespace list. It excludes expired or pruned subnames and returns an empty list if the parent name is released or expired beyond grace. `/subname` also returns null for inactive subnames.

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

# Indexer Event Schema

Status: MVP baseline

Dusk Domains indexers should treat DuskDS contract events as the source for search, history, availability caches, recent-change warnings, and wallet/explorer display metadata. Contract state remains canonical; indexer state is a read model.

Implementation references:

- `scripts/indexer-operator/event-decoder.mjs` normalizes decoded W3sper/data-driver contract event payloads into stable JSON event envelopes.
- `src/names/indexerEventCatalog.mjs` is the runtime-safe event type catalog shared by the public SDK and Node indexer router.
- `src/names/indexerKit.ts` and `src/names/lifecycleProjector.ts` define the shared SDK/operator projector semantics for those envelopes.
- `server/local-indexer/*` owns persistence, HTTP routes, health, SQLite/WAL import, and checkpointing around the shared event semantics.

## Shared Rules

- Every event must include a fixed-size `node` identifier when it concerns a name.
- Every mutation event must include an `actor` principal when the contract input can identify the actor.
- Events should include expiry and grace-period fields when lifecycle state changes.
- Events should include typed endpoints instead of generic address fields.
- Treasury and referral accounting events should include typed principals instead of raw authority bytes.
- Phoenix payment endpoints must not be indexed as public primary-name identities.
- Indexers should preserve event order and expose transaction/block metadata alongside decoded payloads.
- Unknown event names, malformed event envelopes, unsupported schema versions, and contract-ID mismatches should fail closed into warnings or rejected rows before projection.

## Normalized Event Envelope

Indexer operators should project normalized JSON envelopes, not raw data-driver objects:

```json
{
  "event": {
    "type": "record_changed",
    "node": "0x...",
    "controller": "0x...",
    "record": {
      "key": "moonlight_address",
      "value": "dusk1...",
      "visibility": "public",
      "updatedAt": "2026-06-27T12:00:00.000Z",
      "updatedAtBlockHeight": 123456,
      "ttlSeconds": 300
    }
  },
  "meta": {
    "chainId": "dusk:3",
    "contractKey": "core",
    "contractId": "0x...",
    "txId": "0x...",
    "blockHeight": 123456,
    "eventIndex": 0,
    "observedAt": "2026-06-27T12:00:02.000Z"
  }
}
```

`event` is the stable schema consumed by SDK and server projectors. `meta` is transport/provenance data and should preserve the strongest chain envelope available from the node. The current live collector uses W3sper decoded event payloads plus best available block-height observations; production archive replay should add raw tx/block/event-index metadata when available.

The public SDK exports `duskDomainsIndexedEventTypes`, `isDuskDomainsIndexedEventType`, `normalizeDuskDomainsIndexedEventEnvelope`, `createDuskDomainsProjector`, and `applyDuskDomainsIndexedEvent` from `indexerKit`. Third-party indexers may use those helpers as the semantic boundary after decoding data-driver/RKYV events to JSON. The Node indexer uses the same event type catalog for router dispatch, so adding a new event family should update one catalog and then the SDK/server parity tests.

## Registrar Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `name_registered` | A second-level name was registered. | `node`, `label`, `actor`, `owner`, `expires_at`, `grace_ends_at`, `fee_lux`. |
| `name_renewed` | A registration expiry was extended. | `node`, `actor`, `expires_at`, `grace_ends_at`, `fee_lux`. |
| `name_expired` | A name was observed after its grace window. | `node`, `label`, `actor`, `owner`, `expires_at`, `grace_ends_at`, `observed_at`. |
| `name_released` | An owner explicitly released a name where supported. | `node`, `label`, `actor`, `previous_owner`, `released_at`. |

Expiry is not assumed to emit automatically at the exact expiry height. Indexers should derive current lifecycle state from `expires_at`, `grace_ends_at`, and the latest observed chain time, then treat `name_expired` as an indexable observation event.

When a name is released, indexers must clear derived resolver records, controller associations, and reverse-primary rows for that node so a later registration of the same node cannot inherit stale routing state from the previous owner. Snapshot fallbacks should preserve the released lifecycle row for `/name` and `/activity`, but must not expose the released name through active forward-resolution or reverse-primary indexes.

## Registry Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `name_owner_changed` | Name owner/manager/resolver metadata changed, including transfer. | `node`, `actor`, `previous_owner`, `owner`, `manager`, `resolver`, `expires_at`. |
| `resolver_changed` | Resolver reference changed. | `node`, `actor`, `resolver`. |
| `subname_created` | A parent namespace created a subname. | `parent_node`, `node`, `parent_name`, `name`, `label`, `actor`, `owner`, `manager`, `resolver`, `expires_at`, `parent_expires_at`, `expiry_policy`, `revocation_policy`, `created_at`. |
| `subname_delegated` | A subname controller changed. | `parent_node`, `node`, `name`, `actor`, `manager`, `delegated_at`. |
| `subname_revoked` | A parent-revocable subname was revoked. | `parent_node`, `node`, `name`, `actor`, `revoked_at`. |

For transfer history, indexers should read `previous_owner` and `owner`. For resolver safety warnings, indexers should record `resolver_changed` timestamps and expose recent changes to wallets and explorers.

For subname dashboards, indexers should store subname state keyed by both `parent_node` and `node`. Subname activity should appear in the parent namespace history and in the subname node history. Subname records remain resolver events on the subname `node`; they must not be merged into the parent name records. Parent-scoped subname lists are active namespace views and should be empty once the parent is released or expired beyond grace, while direct subname reads may still expose historical rows.

A subname takes its `expires_at` from `subname_created` and its grace end from its parent at that moment. `name_renewed` on a root name emits nothing for its subnames, but it renews each `inherits_parent` subname whose ancestors up to that root all inherit too: indexers give those subnames the root's new `expires_at` and `grace_ends_at`. A `fixed_before_parent` subname keeps its lifecycle, and so do the subnames below it.

## Controller Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `registration_committed` | A registration commitment was submitted. | `commitment`, `controller`, `created_at`. |
| `registration_revealed` | A commitment was revealed to a concrete node. | `commitment`, `node`, `controller`. |

Commit events intentionally do not include the label, canonical name, or node. Reveal events are the first point where the target node becomes indexable.

Indexers should store commitments separately from name activity. A `registration_committed` event proves a hidden registration attempt exists, but it must not create a name history entry or expose a guessed node before `registration_revealed`.

## Resolver Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `record_changed` | A typed public resolver record was set or updated. | `node`, `controller`, `record`. |
| `record_cleared` | A typed public resolver record was cleared. | `node`, `controller`, `key`. |

`record` values are typed. Indexers must not collapse `moonlight_address`, `phoenix_payment_endpoint`, `dusk_contract`, `dusk_asset`, and `evm_address` into one address column.

Indexers should maintain current resolver records keyed by `(node, key)` and an append-only resolver-record history keyed by `(node, key, block_height, tx_id, event_index)` or the strongest equivalent envelope metadata available. Adding a new public record key should require a record-vocabulary update for validation/display semantics, not a database schema migration.

## Reverse Registry Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `primary_name_changed` | A typed endpoint primary name changed or was cleared. | `endpoint`, `controller`, `node`, `name`, `previous_name`, `updated_at`. |

Indexers may serve reverse lookup results from this event stream, but wallets and explorers must still forward-verify the candidate name for the same endpoint type and value before display.

Phoenix payment endpoints are not v1 public primary-name identities. Indexers should reject or ignore any reverse event that attempts to expose a Phoenix endpoint as a normal display identity.

## Router and Pool Events

A deployment is a contract pool: one router, append-only lists of registries and resolvers, and the treasury and marketplace. Names live in the registry that created them and never move. Records live in a resolver and can move forward to a newer one.

| Event | Emitted by | Purpose | Required payload |
| --- | --- | --- | --- |
| `router_initialized` | router | The pool was set up. A zero `marketplace` means the deployment has none. | `operator`, `treasury`, `marketplace`, `fee_config`. |
| `pool_member_added` | router | A registry or resolver joined the pool. The newest registry creates new names; the newest resolver with room takes new records. | `kind`, `member`, `index`, `operator`. |
| `router_operator_changed` | router | The operator role moved to another principal. | `previous_operator`, `operator`. |
| `fee_config_updated` | router | The operator changed pricing or referral shares for future registrations and renewals. The router's `router_initialized` event carries the starting config. | `operator`, `previous_config`, `config`. |
| `records_moved` | registry | A name's records moved to a newer resolver. The records themselves are unchanged. | `node`, `controller`, `from_resolver`, `to_resolver`, `record_count`. |

Registry events carry the emitting registry in the envelope's `meta.contractId`. Indexers that serve a pool should subscribe to every registry the router lists, including ones added after they start.

## Treasury Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `treasury_initialized` | The protocol fee treasury operator settings were configured. Registries in the router's pool may pay fees in addition to the listed sources. | `operator`, `operator_recipient`, `allowed_fee_sources`, `router`. |
| `treasury_operator_changed` | The proposed operator accepted the treasury role and Moonlight recipient. | `previous_operator`, `operator`, `operator_recipient`. |
| `treasury_fee_received` | A controller or registrar forwarded a claimed protocol fee deposit into treasury custody. | `source_contract`, `reason`, `node`, `amount_lux`, `total_received_lux`, `available_lux`, `registration_received_lux`, `renewal_received_lux`, `other_received_lux`. |
| `treasury_claimed` | The configured operator principal claimed available fees to the configured Moonlight recipient. | `operator`, `operator_recipient`, `amount_lux`, `remaining_lux`. |

Treasury events are protocol accounting metadata. They should not be attached to individual name activity unless a UI is explicitly showing fee accounting.

`operator_authority` and `previous_operator_authority` are legacy compatibility fields accepted by the local indexer for old snapshots and event logs. New contracts, proofs, and fixtures should emit typed `operator` and `previous_operator` values.

## Referral Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `referral_reward_accrued` | A registration or renewal credited claimable rewards to a referrer. | `referrer`, `buyer`, `amount_lux`, `claimable_lux`, `claimed_lux`, `referral_count`. |
| `referral_reward_claimed` | A referrer claimed available referral rewards. | `referrer`, `amount_lux`, `remaining_lux`, `claimed_lux`, `referral_count`. |

Referral events are per-referrer accounting metadata. `referrer` and `buyer` should be typed principals in new events and are normalized by the indexer into stable principal keys. The contract state remains canonical for claim authorization and payment safety.

## Operator Handovers

For router, treasury and marketplace, `<contract>_operator_proposed` carries the current
`operator` and `pending_operator`. Treasury also includes `pending_operator_recipient`.
`<contract>_operator_cancelled` carries the current `operator`. Neither event changes the
active operator or treasury payout key. A second proposal replaces the pending values.

Acceptance emits `<contract>_operator_changed` with `previous_operator` and `operator`.
Treasury retains `operator_recipient`; marketplace also emits its existing
`marketplace_config_updated` so older consumers see the completed change.

Normalized fields are `pendingOperator` and `pendingOperatorRecipient`. Pool state,
treasury state and marketplace config expose the pending operator, clearing it on
cancellation and acceptance. Claims and fee updates leave pending proposals intact.

See [Operator handover calls](operator-handover.md) for the write API and principal types.

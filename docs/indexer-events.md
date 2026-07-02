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

## Core Configuration Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `core_referral_config_changed` | The core operator changed the future referral reward share. | `operator`, `previous_referral_reward_bps`, `referral_reward_bps`. |

This is audit metadata. It does not change name resolution state, but production event stores should retain it so referral economics can be reconstructed from deployment onward.

## Treasury Events

| Event | Purpose | Required payload |
| --- | --- | --- |
| `treasury_initialized` | The protocol fee treasury operator settings were configured. | `operator`, `operator_recipient`, `allowed_fee_sources`. |
| `treasury_operator_changed` | The current operator rotated the treasury operator principal and Moonlight recipient. | `previous_operator`, `operator`, `operator_recipient`. |
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

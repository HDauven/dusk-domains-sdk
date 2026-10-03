# Event schema and projection

`@duskdomains/sdk/event-catalog` exports normalized event families,
`duskDomainsContractEventTopics` for current contract subscriptions and a separate
retired-topic list. [The catalog source](../src/indexer/events/indexerEventCatalog.ts)
and contract data-driver schemas define the complete topic and payload surface.

`normalizeObservedEvent` from `@duskdomains/sdk/projection` converts decoded
W3sper/data-driver payloads into camelCase envelopes. It does not decode raw RKYV
bytes. The collector supplies contract, transaction, block and event identity;
the shared projection supplies lifecycle, records, primary names, treasury,
referrals, pool and marketplace state. Persistence and HTTP serving live in the
[indexer](https://github.com/HDauven/dusk-domains-indexer/blob/main/README.md).

## Envelope

```ts
{
  event: { type: 'record_cleared', node, controller, key },
  meta: { chainId, contractKey: 'core', contractId, txId, blockHeight,
    eventIndex, eventId, observedAt }
}
```

The identifier variables above come from the decoded event and its archive
provenance. The archive collector retains finalized block/transaction ordering,
block hashes and stable event identities. Projection callers order and deduplicate
before applying events; the projector itself does not provide a durable journal.
Unknown/malformed events fail normalization or become replay warnings in the server.

## Current emitted families

| Emitter | Topics |
| --- | --- |
| Registry | `registration_committed`, `registration_revealed`, `name_registered`, `name_renewed`, `name_owner_changed`, `record_changed`, `record_cleared`, `primary_name_changed`, `subname_created`, `subname_pruned`, `records_moved`. |
| Router | `router_initialized`, `pool_member_added`, `fee_config_updated`, `reserved_name_issued`, `registrations_paused_changed` and router handover events. |
| Treasury | `treasury_initialized`, `treasury_fee_received`, `treasury_claimed`, `referral_reward_accrued`, `referral_reward_claimed` and treasury handover events. |
| Marketplace | `marketplace_initialized`, `marketplace_config_updated`, `trading_paused_changed`, fixed-sale/auction/offer lifecycle events, `marketplace_refund_claimed` and marketplace handover events. |

The resolver stores records but emits no separate record events; registry writes
emit them. `name_expired`, `name_released` and `resolver_changed` remain accepted
legacy/synthetic projection types, not current registry emissions. Expiry is
computed from lifecycle heights; there is no automatic expiry transaction.
Retired revocation/delegation topics are not current subname operations.

## Projection semantics

- Commitments are keyed by `(controller, commitment)` and reveal no label/node
  until `registration_revealed`. Physical commitment pruning and automatic same-controller expiry cleanup on commit
  emit no event. Commitment projections retain history; use age and the registry
  read to determine usability.
- `name_registered` resets stale name state; the following ownership/record events
  establish the new registration. `name_renewed.actor` is the payer and never changes ownership or manager rights.
  Renewal extends inheriting subname chains;
  fixed-expiry branches retain their dates. No separate renewal event is emitted
  for each subname.
- `subname_created` also means recreation: clear old records, primary mapping and
  descendants before applying the new row. `subname_pruned` removes the expired
  subtree without a replacement. Historical activity remains.
- Records remain keyed by their own node/key. `records_moved` changes the resolver
  while preserving current records. Pool registries carry their emitting contract
  ID in metadata; membership events extend collector scope.
- `reserved_name_issued` supplements normal registration/ownership events with
  operator/registry provenance. `issuedAsReserved` and `reservedIssuance` survive
  renewal and transfer; another registration resets them.
- Treasury/referral events are accounting read models, not claim authorization.
  Marketplace order closures remove current listings; refund events update
  per-authority balances. Unsafe numeric amounts become warnings rather than
  rounded JavaScript values.
- Primary-name events never replace the caller's typed forward-verification step.
  Phoenix endpoints are excluded from public primary display.
  A nonempty `primary_name_changed.name` produces `primary_name_set` activity;
  an empty name produces `primary_name_cleared`, retaining the endpoint target
  and previous name. Historical `primary_name` activity remains supported.

## Operator handovers

Router, treasury and marketplace emit `<contract>_operator_proposed` with the
current `operator` and `pending_operator`; treasury adds
`pending_operator_recipient`. Reproposal replaces pending values. Cancellation
emits `<contract>_operator_cancelled`. Neither changes active authority.

Acceptance emits `<contract>_operator_changed` with `previous_operator` and
`operator`, plus treasury's `operator_recipient`. Marketplace also emits
`marketplace_config_updated`. Projection exposes camelCase pending fields and
clears them on acceptance/cancellation. Router/treasury operators are typed
principals; marketplace uses 32-byte authority hex. See [handover calls](operator-handover.md).

## Pauses

`registrations_paused_changed` and `trading_paused_changed` carry `paused`,
`operator` and block-height `updated_at`. Projection keeps independent flags,
initially false. Repeated authorized setter values emit nothing; handover and
fee updates preserve pause state. Indexer health exposes
`pause: { registrationsPaused, tradingPaused }` and marketplace config exposes
`tradingPaused`. Healthy indexed status supports display; contracts enforce the gates.

## Namespace control

`name_owner_changed` updates a subname's owner and manager in the subname indexes. Its
optional `dataCleared` flag clears only that node's records and primary name; descendants
keep their data. A holder’s own transfers leave the flag false unless `clearRecords` is requested. Ancestor reassignments and take-back batches set it whenever an owner or manager changes. `subname_removed` removes the
node and its subtree; `subname_pruned` remains expired cleanup.

Name responses may include `namespace` with `descendantCount`, `heldByOthersCount`, all
stored `subnames` (including expired ones), and the `ancestors` used for authority display.
Marketplace summaries compare descendant owners to the seller while the root is escrowed.
A completed purchase records `namespacePurchase` with its buyer and seller so clients can
offer to take back seller-held subnames. A later root transfer clears that purchase marker.

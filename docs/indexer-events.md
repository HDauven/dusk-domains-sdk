# Frozen event catalog and projection

Import `indexerEventCatalog` from `@duskdomains/sdk/event-catalog`. It enumerates
all 56 framing/effect topics from §11 and marketplace v1, their legitimate role
and exact wire type. All effect payloads are `{ version: 1, op_seq, body }`;
`operation_begin` and `operation_end` are unwrapped framing records.

Decode raw event bytes with the release-verified driver's `decodeEvent(topic,
bytes)`. Preserve the host emitter, transaction ID, block height, receipt
ordinal, transaction success and per-event `reverted` flag. Never pass raw JSON
through a parser that rounds u64 fields.

```ts
import { createProjector } from '@duskdomains/sdk/projection'

// `client` comes from createClientFromManifest; start at deployment receipts.
const projector = createProjector({
  directoryId: client.directoryId,
  contracts: Object.fromEntries(
    [...client.release.contracts.values()].map(c => [c.contractId, c.role]),
  ),
})
// A receipt is { id, height: bigint, success, events }.
// Each event is { emitter, topic, data: decodedWireValue, ordinal, reverted? }.
// const state = projector.apply(receipt)
```

The initial scope must be release-verified. Subsequent admissions come from
committed directory initialization/actions; arbitrary callback contracts cannot
assert registry/vault authority. Do not seed this scope from untrusted events.
The indexer retains previously admitted emitters, including old marketplaces.

## Journal semantics

Failed transactions contribute no effects. Reverted events are discarded before
framing. A Begin occurrence is distinguished by ordinal, emitter, sequence and
runtime path. The latest open strict path prefix is its parent. Replaced or
abandoned unfinished journals and their children are discarded; a reused sequence
after rollback cannot inherit the failed occurrence's effects. A child commits
only when its own End and every enclosing frozen End succeeded.

`projectReceipt` applies to a cloned state and returns it only after the entire
receipt validates. Missing move rows, resolver snapshots or readiness seals
throw. `RootImported` and `RootForwarded` must appear together, so no partially
moved tree or duplicate endpoint is externally visible. `createProjector` adds
idempotent receipt application and `rollbackTo(height)` checkpoints. Roll back
the replaced block as a whole before replaying a same-height fork. Persist
checkpoints and prune retained history at your application's finality boundary;
the convenience projector keeps them in memory.

## State semantics

The projection maintains directory configuration, admissions, proposals, source
mirrors, stored commitments, names/counters/incarnations, raw primaries, physical
resolver slots, custody, move preparation/imports/forwards/cooldowns, vault
reservations/liabilities, orders, refunds and a complete committed effect log.
Payloads in that log are copied separately from mutable state, so later state
changes preserve historical events. Committed directory admissions take effect
in receipt order; later events from the admitted emitter in the same receipt
are included. Reverted or unfinished admissions do not expand the scope.
Market cancellation retains ReturnPending until the subsequent return closes it.
Vault effects are authoritative for money; policy/marketplace assertions do not
accrue vault funds.

Subtree summaries remove implicit descendants and their identities. Renewal
walks only InheritsParent edges and stops at fixed-expiry branches. Logical
record clearing leaves physical resolver data stale until a prune event.
Primary cleanup compares incarnation and mapping ID, preserving replacements.

Import rows retain original Name/Primary and destination candidates. Readiness
checks the locked manifest and resolver snapshots. Activation reconciles its live
vector against source renewals, cleared mappings and live revision. Cleared
candidates cannot replace newer primaries. Forwarded cleanup changes physical
storage only; forwarding and root history survive. Automatic lock expiry derives
from block height; renewal after that boundary cannot revive it. Cooldown
eligibility is independent of target cleanup.

`projectedHome`, `projectedName`, `projectedRecords`, `projectedChildren`,
`projectedCommitment`, `projectedPrimary`, `projectedSlotLiveness`,
`projectedMoveStatus`, `projectedCooldowns`, `effectiveMoveLock` and
`moveLockEndsAt` expose derived reads. Pass the same block height to lifecycle
queries. Runtime allocator capacity and actual unsolicited vault surplus are
node observations, not recoverable from domain events.

The TypeScript catalog is the source for the committed standalone
`src/indexer/events/indexerEventCatalog.mjs`, exposed by the npm `event-catalog`
entrypoint. `npm run build` regenerates it;
CI checks it for drift. Frozen projection schemas replace all legacy event rows:
rebuild the index from the fresh deployment's first block.

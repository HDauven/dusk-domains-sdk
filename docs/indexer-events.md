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
import { createProjector, snapshotProjection } from '@duskdomains/sdk/projection'

// `client` comes from createClientFromManifest; start at deployment receipts.
const projector = createProjector({
  directoryId: client.directoryId,
  retainEffects: false, // The indexer stores its own committed event history.
  contracts: Object.fromEntries(
    [...client.release.contracts.values()].map(c => [c.contractId, c.role]),
  ),
})
// A receipt is { id, height: bigint, success, events }.
// Each event is { emitter, topic, data: decodedWireValue, ordinal, reverted? }.
// const state = projector.apply(receipt) // Live state; same object on success.
// After ALL receipts in a complete block:
// projector.checkpoint()
// const stableView = snapshotProjection(projector.state)
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

`projectReceipt(state, receipt)` mutates and returns **the same state object**.
A receipt-scoped undo journal covers nested fields, map writes/deletions, indexes
and effect appends. Missing move rows, resolver snapshots or readiness seals
throw; rollback preserves the previous values, references and property order,
including height, receipt membership and the effects log. A rejected receipt is
never marked applied and can be retried. `RootImported` and `RootForwarded` must
appear together, so a partially moved tree is never published.

Application cost depends on the receipt and the entities affected by its implicit
effects (such as descendants renewed or removed), rather than all indexed history.
Child/primary membership, pending proposals, open moves, import groups and market
balances are indexed incrementally. Receipt membership uses a serializable
`Record<string, true>`: use `Object.hasOwn(state.receipts, receipt.id)`, not
`includes`, `length`, or array iteration. Reapplying a known receipt returns the
same object without decoding or applying it. Failed chain transactions retain the
existing behavior: they contribute no effects but their receipt ID and height are
recorded. This differs from projection validation failure, which changes nothing.

## Explicit checkpoints and indexer migration

Retaining the result of `projectReceipt` or `projector.apply` no longer retains a
historical view. `projector.state` is also live; read it without cloning in the
replay loop. Consumers must not mutate projection maps or indexes themselves.
Use `snapshotProjection(state)` for an independent full copy and
`restoreProjection(snapshot)` to create a new live state from an independent copy
of that checkpoint. Both are intentionally O(total state), including retained
history; call them at chosen checkpoint boundaries, never for every receipt.
After restore, replace the indexer's live state reference. Old references still
refer to the abandoned fork.

```ts
import {
  createProjectionState, projectReceipt, snapshotProjection, restoreProjection,
} from '@duskdomains/sdk/projection'

let state = createProjectionState({ directoryId, contracts, retainEffects: false })
for (const receipt of completeBlock.receipts) projectReceipt(state, receipt)
const checkpoint = snapshotProjection(state) // Associate with this block's hash.
for (const receipt of nextBlock.receipts) projectReceipt(state, receipt)
// Reorg: discard the replaced block and replay from its completed parent.
state = restoreProjection(checkpoint)
for (const receipt of replacementBlock.receipts) projectReceipt(state, receipt)
```

`createProjector` no longer creates automatic receipt checkpoints or clones on
reads/returns. Call `projector.checkpoint()` after a complete block to retain that
height in memory. `rollbackTo(height)` requires an **exact retained checkpoint**,
restores a fresh live state and discards newer checkpoints; a missing checkpoint
throws without changing state. Height zero is retained initially. Checkpoints at
the same height replace each other. Roll back to the completed parent block before
replaying a same-height fork; checkpoints taken midway through a block are unsafe.

The state format is now `schemaVersion: 2`. Persist the whole snapshot, including
`indexes`, `receipts`, `retainEffects` and import `retainedRows`, using storage that
preserves bigint and number types. These are plain serializable objects/arrays;
there are no process-local caches to rebuild after restore. Plain JSON round trips
need a bigint-preserving codec; the wire JSON parser alone does not preserve these
runtime type distinctions. Old receipt-array snapshots cannot be restored; replay
from deployment receipts to populate the new indexes. The HTTP read resource
payloads remain unchanged; the full internal checkpoint format is not an HTTP DTO.

Persist checkpoints with block hashes and prune them at the application's finality
boundary. For long histories, manage snapshots externally with the standalone
helpers; the convenience projector retains explicitly requested checkpoints in
memory until rollback or disposal.

## State semantics

The projection maintains directory configuration, admissions, proposals, source
mirrors, stored commitments, names/counters/incarnations, raw primaries, physical
resolver slots, custody, move preparation/imports/forwards/cooldowns, vault
reservations/liabilities, orders and refunds. `retainEffects` defaults to `true`
for compatibility: `state.effects` is a chronological array, appended in amortized
O(1), never copied during replay. Only the current receipt's retained bodies are
copied separately from mutable entities; later state or input changes preserve
historical event payloads. Retention consumes memory proportional to history.
Set `retainEffects: false` at creation when the indexer stores its own history:
`effects` stays empty and receipts still apply atomically and deduplicate normally.
Persist the original execution receipt alongside your external event history;
`committedEvents` by itself uses the supplied static scope, whereas projection also
discovers directory admissions earlier in the same receipt. Committed admissions
take effect in receipt order; later events from the admitted emitter in the same receipt
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

## Logic port and cession

`projectedControllers(state)` lists current controllers with scopes and suspension.
Keep `controllerVersion` and `controllers` with each checkpoint. There is no
per-authority consent state: consent comes from each direct call to the controller.

`restoreProjection` accepts schema-2 checkpoints containing the retired
`controllerApprovals` map, clones the snapshot, and drops that map. It preserves
all other state, indexes and historical effects without modifying the saved
snapshot. Missing `governance_version` or `recipient_version` fields remain
unknown; they are optional on projected admissions/config for this compatibility
case. Proposal helpers require fresh reads instead of guessing those counters.
Current initialization/action events supply both counters, and `operator_changed`
updates the recipient version. New wire decoding uses only the current protocol;
old predeployment event archives are not a replay format for the new ABI.

Committed effects include `operationOrdinal`, the receipt ordinal of their
operation begin. Associate `controller_used` with effects by receipt, emitter,
operation ordinal and `op_seq`; callback operations have independent provenance.

`root_ceded` retires the old tree and its raw primaries, keeps history, and installs
a permanent forward. The same receipt must register the next generation at the
destination. Cleanup never removes that forward; by-name projected reads return
`Forwarded` at the source, including for old descendants.

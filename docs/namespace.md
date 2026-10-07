# Namespace, custody and moves

Use canonical lowercase ASCII `.dusk` spellings and `nameKey(spelling)` for the
root/node pair. Labels are 1–63 bytes; the policy independently decides root
eligibility. Maximum depth is three below a root, with 64 immediate children and
256 descendants. Expired stored rows count until removed.

Create with `storeCreateSubnameCall`; reassign with `reassignSubnameCall`; take
back 1–256 distinct selected NameRefs with `storeTakeBackSubnamesCall`; remove
or prune a subtree with the corresponding store builder. Ordinary owner changes
preserve descendants. Ancestor reassignment clears the selected identity;
take-back clears each selected identity. Removing a node removes its complete
subtree and implicitly invalidates descendant records, primaries and custody.
`transferCall({ clear_records: true, ... })` maps to the frozen clear-identity
flag, which clears primary identity as well as records.

## Marketplace custody

Construct `createMarketplaceCalls(marketId, directoryId, verifiedDriver)` with
`client.release.drivers.get(marketId)`. `listFixed(intent)` and `auction(intent)`
encode a reviewed `CustodyIntent` into store `transfer_and_call`, with an explicit
500M callback allowance. The intent binds the next custody nonce read from root
counters and the reviewed immutable Terms, including store, incarnation,
recipients, fee, referral, deadline and order ID.

`acceptOffer(reviewedOrder, nextCustodyNonce, validUntil)` also uses
transfer-and-call. The new custody nonce comes from the store counters, not the
offer's stored nonce (an unaccepted offer has no custody episode). `buy`, `bid`,
`cancel`, `settle`, `expire` and `retryReturn` bind the complete reviewed Order.
`offer` binds reviewed Terms. `marketplaceRenewEscrowCall` binds both order and
renewal quote; `marketplaceClaimRefundCall` is an account-level pull claim.

Custody delegates full holder authority. Show origin owner/manager and episode
nonce. Renewal stays open during custody. Cancelling a listing makes refunds
available but can leave `ReturnPending`; return uses a separate retry. Changing
the preferred marketplace does not recover old custody or erase old refunds.

## Whole-tree movement

1. Refresh the home, root NameRef/counters, destination admission ordinal,
   capacity, cooldowns and lifecycle. Only the active root owner prepares;
   custody anywhere in the tree refuses preparation.
2. Submit `storeBeginMoveCall` at the source with the reviewed destination and
   revision. Read its `move_status` and destination `import_status`.
3. Export rows in the protocol's root-first, node-sorted depth-first order.
   Verify each record snapshot, then submit `storeStageMoveRowCall` at the
   destination. Staging is inactive. `ImportReady` seals the complete manifest.
4. Anyone can submit `storeFinalizeMoveCall` at the source before the effective
   deadline. Activation is a single transaction, using the full 3B wallet gas
   envelope; it never publishes partial rows or splits final activation.
5. Follow `RootForwarded` and refresh names, records, orders and primary mapping
   IDs. Cleanup uses separate source, target and resolver calls.

During preparation the tree is write-locked except for renewal and explicit
primary clearing. Those advance live revision without invalidating the sealed
manifest. Lock expiry is the earliest idle (last progress +360), absolute or
lifecycle deadline. Equality unlocks without an event, and late renewal cannot
revive an ended attempt. Show `MovePending` and its deadline; do not blindly
retry edits or auto-cancel the owner's move.

Owner/Idle cancellation imposes 8,640-block source root and initiator cooldowns.
Expired/LifecycleEnded cleanup imposes neither. Destination cleanup never grants
early source readmission. A move needs source cooperation; it is not guaranteed
recovery from an unavailable or compromised shard.

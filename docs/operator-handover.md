# Operator handover calls

Router, treasury and marketplace require proposal followed by acceptance. Import call
builders and `prepareDuskDomainContractCall` from `@duskdomains/sdk/writes` and use the
deployment's current contract IDs and data drivers.

| Contract | Propose | Accept | Cancel |
| --- | --- | --- | --- |
| Router | `routerProposeOperatorRuntimeCall({ operator })` | `routerAcceptOperatorRuntimeCall()` | `routerCancelOperatorRuntimeCall()` |
| Treasury | `treasuryProposeOperatorRuntimeCall({ operator, operatorRecipient })` | `treasuryAcceptOperatorRuntimeCall()` | `treasuryCancelOperatorRuntimeCall()` |
| Marketplace | `marketplaceProposeOperatorRuntimeCall({ operator })` | `marketplaceAcceptOperatorRuntimeCall()` | `marketplaceCancelOperatorRuntimeCall()` |

These target `propose_operator_runtime`, `accept_operator_runtime`, and
`cancel_operator_runtime`. The old `routerSetOperatorRuntimeCall`,
`treasuryUpdateOperatorRuntimeCall` and `marketplaceUpdateOperatorRuntimeCall` builders
and their one-step contract entrypoints are removed.

The current operator submits proposals and cancellation. A new proposal replaces the
previous one. Only the proposed operator can accept, using its own runtime identity;
acceptance and cancellation encode no arguments. Pending proposals leave the active
operator in control until acceptance. Read the current proposal on-chain before accepting.

Router and treasury accept a `DuskPrincipal`; marketplace accepts a hex-encoded 32-byte
runtime authority. Moonlight marketplace authorities are the runtime-derived hash of the
public key, and contract authorities are the contract ID. A plain Phoenix transaction
cannot supply a stable runtime identity to accept the role.

Treasury's `operatorRecipient` is a Moonlight public key encoded in base58. The proposed
recipient moves atomically with the operator on acceptance. Contract operators must also
supply this payout key. There is no separate recipient setter; a self-proposal can rotate
only the recipient through the same two steps.

[Indexers](indexer-events.md#operator-handovers) expose pending and current values for
review. The contract read responses remain canonical: `routerConfigCall()`,
`treasuryReadStateCall()`, and `marketplaceReadConfigCall()` include `pending_operator`,
with `pending_operator_recipient` on treasury.

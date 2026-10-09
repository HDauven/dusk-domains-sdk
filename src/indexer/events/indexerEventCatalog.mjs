// Generated from indexerEventCatalog.ts by npm run build. Do not edit.
// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.
/** Authoritative frozen v1 event topics, emitter roles and wire schemas. @module */
export const indexerEventCatalog = {
    "operation_begin": {
        "role": "*",
        "type": "OperationBegin"
    },
    "operation_end": {
        "role": "*",
        "type": "OperationEnd"
    },
    "directory_initialized": {
        "role": "directory",
        "type": "Event<DirectoryInitialized>"
    },
    "store_initialized": {
        "role": "store",
        "type": "Event<StoreInitialized>"
    },
    "resolver_initialized": {
        "role": "resolver",
        "type": "Event<ResolverInitialized>"
    },
    "vault_initialized": {
        "role": "vault",
        "type": "Event<VaultInitialized>"
    },
    "policy_initialized": {
        "role": "policy",
        "type": "Event<PolicyInitialized>"
    },
    "proposal_created": {
        "role": "directory",
        "type": "Event<ProposalCreated>"
    },
    "proposal_cancelled": {
        "role": "directory",
        "type": "Event<ProposalCancelled>"
    },
    "proposal_executed": {
        "role": "directory",
        "type": "Event<ProposalExecuted>"
    },
    "proposal_pruned": {
        "role": "directory",
        "type": "Event<ProposalPruned>"
    },
    "action_applied": {
        "role": "directory",
        "type": "Event<ActionApplied>"
    },
    "operator_changed": {
        "role": "directory",
        "type": "Event<OperatorChanged>"
    },
    "guardian_changed": {
        "role": "directory",
        "type": "Event<GuardianChanged>"
    },
    "proposals_invalidated": {
        "role": "directory",
        "type": "Event<ProposalsInvalidated>"
    },
    "registration_pause_changed": {
        "role": "directory",
        "type": "Event<RegistrationPauseChanged>"
    },
    "policy_suspension_changed": {
        "role": "directory",
        "type": "Event<PolicySuspensionChanged>"
    },
    "delays_changed": {
        "role": "directory",
        "type": "Event<DelaysChanged>"
    },
    "commitment_created": {
        "role": "store",
        "type": "Event<CommitmentCreated>"
    },
    "commitment_removed": {
        "role": "store",
        "type": "Event<CommitmentRemoved>"
    },
    "root_registered": {
        "role": "store",
        "type": "Event<RootRegistered>"
    },
    "root_renewed": {
        "role": "store",
        "type": "Event<RootRenewed>"
    },
    "subname_created": {
        "role": "store",
        "type": "Event<SubnameCreated>"
    },
    "subtree_removed": {
        "role": "store",
        "type": "Event<SubtreeRemoved>"
    },
    "authorities_changed": {
        "role": "store",
        "type": "Event<AuthoritiesChanged>"
    },
    "identity_cleared": {
        "role": "store",
        "type": "Event<IdentityCleared>"
    },
    "slot_changed": {
        "role": "store",
        "type": "Event<SlotChanged>"
    },
    "primary_changed": {
        "role": "store",
        "type": "Event<PrimaryChanged>"
    },
    "custody_started": {
        "role": "store",
        "type": "Event<CustodyStarted>"
    },
    "custody_ended": {
        "role": "store",
        "type": "Event<CustodyEnded>"
    },
    "root_counters_changed": {
        "role": "store",
        "type": "Event<RootCountersChanged>"
    },
    "store_watermarks_changed": {
        "role": "store",
        "type": "Event<StoreWatermarksChanged>"
    },
    "resolver_slot_written": {
        "role": "resolver",
        "type": "Event<ResolverSlotWritten>"
    },
    "resolver_slot_pruned": {
        "role": "resolver",
        "type": "Event<ResolverSlotPruned>"
    },
    "fee_source_changed": {
        "role": "vault",
        "type": "Event<FeeSourceChanged>"
    },
    "beneficiary_reserved": {
        "role": "vault",
        "type": "Event<BeneficiaryReserved>"
    },
    "fee_received": {
        "role": "vault",
        "type": "Event<FeeReceived>"
    },
    "referral_claimed": {
        "role": "vault",
        "type": "Event<ReferralClaimed>"
    },
    "protocol_claimed": {
        "role": "vault",
        "type": "Event<ProtocolClaimed>"
    },
    "move_started": {
        "role": "store",
        "type": "Event<MoveStarted>"
    },
    "move_progressed": {
        "role": "store",
        "type": "Event<MoveProgressed>"
    },
    "import_prepared": {
        "role": "store",
        "type": "Event<ImportPrepared>"
    },
    "import_row_staged": {
        "role": "store",
        "type": "Event<ImportRowStaged>"
    },
    "import_ready": {
        "role": "store",
        "type": "Event<ImportReady>"
    },
    "root_imported": {
        "role": "store",
        "type": "Event<RootImported>"
    },
    "root_forwarded": {
        "role": "store",
        "type": "Event<RootForwarded>"
    },
    "move_cancelled": {
        "role": "store",
        "type": "Event<MoveCancelled>"
    },
    "import_rows_pruned": {
        "role": "store",
        "type": "Event<ImportRowsPruned>"
    },
    "forwarded_rows_pruned": {
        "role": "store",
        "type": "Event<ForwardedRowsPruned>"
    },
    "market_configured": {
        "role": "marketplace",
        "type": "Event<MarketConfigured>"
    },
    "order_changed": {
        "role": "marketplace",
        "type": "Event<OrderChanged>"
    },
    "order_closed": {
        "role": "marketplace",
        "type": "Event<OrderClosed>"
    },
    "trade_settled": {
        "role": "marketplace",
        "type": "Event<TradeSettled>"
    },
    "refund_changed": {
        "role": "marketplace",
        "type": "Event<RefundChanged>"
    },
    "refund_claimed": {
        "role": "marketplace",
        "type": "Event<RefundClaimed>"
    },
    "escrow_renewed": {
        "role": "marketplace",
        "type": "Event<EscrowRenewed>"
    },
    "controller_changed": {
        "role": "directory",
        "type": "Event<ControllerChanged>"
    },
    "controller_approval_changed": {
        "role": "directory",
        "type": "Event<ControllerApprovalChanged>"
    },
    "controller_suspension_changed": {
        "role": "directory",
        "type": "Event<ControllerSuspensionChanged>"
    },
    "controller_used": {
        "role": "store",
        "type": "Event<ControllerUsed>"
    },
    "root_ceded": {
        "role": "store",
        "type": "Event<RootCeded>"
    }
};
export const duskDomainsIndexedEventTypes = Object.keys(indexerEventCatalog);

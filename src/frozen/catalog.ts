// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.
export const methodCatalog = {
  "directory": [
    {
      "name": "init",
      "input": "InitDirectory",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "propose",
      "input": "Propose",
      "output": "ProposalId",
      "mode": "write"
    },
    {
      "name": "execute",
      "input": "ProposalKey",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "accept_operator",
      "input": "ProposalKey",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "accept_guardian",
      "input": "ProposalKey",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "cancel",
      "input": "Cancel",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "set_registration_pause",
      "input": "DirectorySetRegistrationPauseArgs",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "set_policy_suspension",
      "input": "DirectorySetPolicySuspensionArgs",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "increase_delays",
      "input": "IncreaseDelays",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "prune_proposals",
      "input": "DirectoryPruneProposalsArgs",
      "output": "u16",
      "mode": "write"
    },
    {
      "name": "config",
      "input": "()",
      "output": "DirectoryConfig",
      "mode": "read"
    },
    {
      "name": "registration_context",
      "input": "()",
      "output": "RegistrationContext",
      "mode": "read"
    },
    {
      "name": "renewal_schedule",
      "input": "()",
      "output": "RenewalSchedule",
      "mode": "read"
    },
    {
      "name": "roles",
      "input": "()",
      "output": "DirectoryRolesReturn",
      "mode": "read"
    },
    {
      "name": "operator_payout_key",
      "input": "()",
      "output": "DirectoryPayoutKey",
      "mode": "read"
    },
    {
      "name": "member",
      "input": "MemberQuery",
      "output": "Option<Admission>",
      "mode": "read"
    },
    {
      "name": "members",
      "input": "MemberPage",
      "output": "Members",
      "mode": "read"
    },
    {
      "name": "allocation",
      "input": "()",
      "output": "DirectoryAllocationReturn",
      "mode": "read"
    },
    {
      "name": "market",
      "input": "DirectoryMarketArgs",
      "output": "Option<Market>",
      "mode": "read"
    },
    {
      "name": "proposal",
      "input": "ProposalKey",
      "output": "Option<Proposal>",
      "mode": "read"
    },
    {
      "name": "proposals",
      "input": "ProposalPage",
      "output": "Proposals",
      "mode": "read"
    },
    {
      "name": "interface_version",
      "input": "()",
      "output": "Interface",
      "mode": "read"
    },
    {
      "name": "binding",
      "input": "()",
      "output": "Binding",
      "mode": "read"
    },
    {
      "name": "capacity",
      "input": "()",
      "output": "Capacity",
      "mode": "read"
    },
    {
      "name": "controllers",
      "input": "()",
      "output": "Controllers",
      "mode": "read"
    },
    {
      "name": "controller",
      "input": "ControllerQuery",
      "output": "Option<Controller>",
      "mode": "read"
    },
    {
      "name": "set_controller_suspension",
      "input": "ControllerSuspension",
      "output": "()",
      "mode": "write"
    }
  ],
  "policy": [
    {
      "name": "init",
      "input": "InitPolicy",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "config",
      "input": "()",
      "output": "PolicyConfig",
      "mode": "read"
    },
    {
      "name": "quote",
      "input": "QuoteRequest",
      "output": "PolicyQuote",
      "mode": "read"
    },
    {
      "name": "interface_version",
      "input": "()",
      "output": "Interface",
      "mode": "read"
    },
    {
      "name": "binding",
      "input": "()",
      "output": "Binding",
      "mode": "read"
    }
  ],
  "store": [
    {
      "name": "init",
      "input": "InitStore",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "commit",
      "input": "CommitArgs",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "prune_commitments",
      "input": "StorePruneCommitmentsArgs",
      "output": "u16",
      "mode": "write"
    },
    {
      "name": "consume_commitment",
      "input": "ConsumeCommitment",
      "output": "Height",
      "mode": "internal"
    },
    {
      "name": "register",
      "input": "Register",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "renew",
      "input": "Renew",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "receive_payment",
      "input": "ReceiveFromContract",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "issue_reserved",
      "input": "IssueReserved",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "update_authorities",
      "input": "Authorities",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "mutate_records",
      "input": "MutateRecords",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "replace_records",
      "input": "ReplaceRecords",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "move_records",
      "input": "MoveRecords",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "set_primary",
      "input": "SetPrimary",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "clear_primary",
      "input": "ClearPrimary",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "create_subname",
      "input": "CreateSubname",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "remove_subname",
      "input": "StoreRemoveSubnameArgs",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "prune_subname",
      "input": "StorePruneSubnameArgs",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "take_back_subnames",
      "input": "TakeBack",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "home",
      "input": "StoreHomeArgs",
      "output": "Home",
      "mode": "read"
    },
    {
      "name": "stats",
      "input": "()",
      "output": "StoreStats",
      "mode": "read"
    },
    {
      "name": "get_name",
      "input": "NameKey",
      "output": "Located<NameView>",
      "mode": "read"
    },
    {
      "name": "children",
      "input": "ChildPage",
      "output": "Located<Children>",
      "mode": "read"
    },
    {
      "name": "record_slot",
      "input": "NameKey",
      "output": "Located<Option<SlotPointer>>",
      "mode": "read"
    },
    {
      "name": "read_record",
      "input": "RecordQuery",
      "output": "Located<Option<RecordValue>>",
      "mode": "read"
    },
    {
      "name": "read_records",
      "input": "NameKey",
      "output": "Located<RecordsView>",
      "mode": "read"
    },
    {
      "name": "resolve_record",
      "input": "RecordQuery",
      "output": "Located<Option<RecordValue>>",
      "mode": "read"
    },
    {
      "name": "read_primary",
      "input": "StoreReadPrimaryArgs",
      "output": "Option<PrimaryView>",
      "mode": "read"
    },
    {
      "name": "resolve_primary",
      "input": "StoreResolvePrimaryArgs",
      "output": "Option<PrimaryView>",
      "mode": "read"
    },
    {
      "name": "pending_commitment",
      "input": "CommitmentKey",
      "output": "Option<Commitment>",
      "mode": "read"
    },
    {
      "name": "commitment_raw",
      "input": "CommitmentKey",
      "output": "Option<Commitment>",
      "mode": "read"
    },
    {
      "name": "quote_registration",
      "input": "QuoteRegistration",
      "output": "RegistrationQuote",
      "mode": "read"
    },
    {
      "name": "quote_renewal",
      "input": "StoreQuoteRenewalArgs",
      "output": "Located<RenewalQuote>",
      "mode": "read"
    },
    {
      "name": "slot_liveness",
      "input": "SlotLivenessQuery",
      "output": "SlotLiveness",
      "mode": "read"
    },
    {
      "name": "transfer_and_call",
      "input": "TransferAndCall",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "return_custody",
      "input": "ReturnCustody",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "begin_move",
      "input": "BeginMove",
      "output": "Digest",
      "mode": "write"
    },
    {
      "name": "begin_import",
      "input": "ImportHeader",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "export_move_row",
      "input": "ExportQuery",
      "output": "ExportRow",
      "mode": "read"
    },
    {
      "name": "move_status",
      "input": "MoveKey",
      "output": "Option<MoveStatus>",
      "mode": "read"
    },
    {
      "name": "import_status",
      "input": "MoveKey",
      "output": "Option<ImportStatus>",
      "mode": "read"
    },
    {
      "name": "move_cooldowns",
      "input": "MoveCooldownQuery",
      "output": "Located<MoveCooldowns>",
      "mode": "read"
    },
    {
      "name": "stage_move_row",
      "input": "StageMoveRow",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "confirm_move_progress",
      "input": "ConfirmMoveProgress",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "finalize_move",
      "input": "MoveKey",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "activate_import",
      "input": "MoveKey",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "cancel_move",
      "input": "MoveKey",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "prune_import",
      "input": "PruneImport",
      "output": "u16",
      "mode": "write"
    },
    {
      "name": "prune_forwarded",
      "input": "PruneForwarded",
      "output": "u16",
      "mode": "write"
    },
    {
      "name": "interface_version",
      "input": "()",
      "output": "Interface",
      "mode": "read"
    },
    {
      "name": "binding",
      "input": "()",
      "output": "Binding",
      "mode": "read"
    },
    {
      "name": "capacity",
      "input": "()",
      "output": "Capacity",
      "mode": "read"
    },
    {
      "name": "delegated",
      "input": "Delegated",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "released_root",
      "input": "StoreHomeArgs",
      "output": "ReleasedRoot",
      "mode": "read"
    },
    {
      "name": "cede_released",
      "input": "CedeReleased",
      "output": "ReleasedRoot",
      "mode": "internal"
    }
  ],
  "resolver": [
    {
      "name": "init",
      "input": "InitResolver",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "write_slot",
      "input": "WriteSlot",
      "output": "SlotSnapshot",
      "mode": "internal"
    },
    {
      "name": "apply_mutations",
      "input": "ApplyMutations",
      "output": "SlotSnapshot",
      "mode": "internal"
    },
    {
      "name": "clear_slot",
      "input": "ResolverClearSlotArgs",
      "output": "bool",
      "mode": "internal"
    },
    {
      "name": "prune_stale",
      "input": "ResolverPruneStaleArgs",
      "output": "bool",
      "mode": "write"
    },
    {
      "name": "read_slot_record",
      "input": "SlotRecordQuery",
      "output": "Option<RecordValue>",
      "mode": "read"
    },
    {
      "name": "read_record_slot",
      "input": "ResolverReadRecordSlotArgs",
      "output": "Option<SlotSnapshot>",
      "mode": "read"
    },
    {
      "name": "stats",
      "input": "()",
      "output": "ResolverStats",
      "mode": "read"
    },
    {
      "name": "interface_version",
      "input": "()",
      "output": "Interface",
      "mode": "read"
    },
    {
      "name": "binding",
      "input": "()",
      "output": "Binding",
      "mode": "read"
    },
    {
      "name": "capacity",
      "input": "()",
      "output": "Capacity",
      "mode": "read"
    }
  ],
  "vault": [
    {
      "name": "init",
      "input": "InitVault",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "set_source",
      "input": "SourceUpdate",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "receive_fee",
      "input": "ReceiveFromContract",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "claim_referral",
      "input": "ClaimReferral",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "claim_protocol",
      "input": "ClaimProtocol",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "read_state",
      "input": "()",
      "output": "VaultState",
      "mode": "read"
    },
    {
      "name": "read_referral",
      "input": "VaultReadReferralArgs",
      "output": "Option<ReferralRow>",
      "mode": "read"
    },
    {
      "name": "referrals",
      "input": "ReferralPage",
      "output": "Referrals",
      "mode": "read"
    },
    {
      "name": "source",
      "input": "VaultSourceArgs",
      "output": "Option<FeeSource>",
      "mode": "read"
    },
    {
      "name": "read_balance",
      "input": "()",
      "output": "BalanceView",
      "mode": "read"
    },
    {
      "name": "interface_version",
      "input": "()",
      "output": "Interface",
      "mode": "read"
    },
    {
      "name": "binding",
      "input": "()",
      "output": "Binding",
      "mode": "read"
    },
    {
      "name": "capacity",
      "input": "()",
      "output": "Capacity",
      "mode": "read"
    }
  ],
  "marketplace": [
    {
      "name": "init",
      "input": "InitMarketplace",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "set_pause",
      "input": "SetPause",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "set_fee",
      "input": "SetFee",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "on_name_received",
      "input": "CustodyNotice",
      "output": "CustodyAck",
      "mode": "internal"
    },
    {
      "name": "buy_fixed",
      "input": "Buy",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "place_bid",
      "input": "PlaceBid",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "place_offer",
      "input": "PlaceOffer",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "renew_escrow",
      "input": "RenewOrder",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "receive_payment",
      "input": "ReceiveFromContract",
      "output": "()",
      "mode": "internal"
    },
    {
      "name": "settle_auction",
      "input": "Order",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "cancel_order",
      "input": "Order",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "expire_order",
      "input": "Order",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "retry_return",
      "input": "Order",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "claim_refund",
      "input": "ClaimRefund",
      "output": "()",
      "mode": "write"
    },
    {
      "name": "interface_version",
      "input": "()",
      "output": "Interface",
      "mode": "read"
    },
    {
      "name": "binding",
      "input": "()",
      "output": "Binding",
      "mode": "read"
    },
    {
      "name": "capacity",
      "input": "()",
      "output": "Capacity",
      "mode": "read"
    },
    {
      "name": "config",
      "input": "()",
      "output": "Config",
      "mode": "read"
    },
    {
      "name": "wind_down_state",
      "input": "()",
      "output": "MarketWindDown",
      "mode": "read"
    },
    {
      "name": "order_api_version",
      "input": "()",
      "output": "u16",
      "mode": "read"
    },
    {
      "name": "read_order",
      "input": "OrderKey",
      "output": "Option<Order>",
      "mode": "read"
    },
    {
      "name": "read_refund",
      "input": "RefundKey",
      "output": "Refund",
      "mode": "read"
    },
    {
      "name": "read_listing",
      "input": "ListingKey",
      "output": "Option<Order>",
      "mode": "read"
    },
    {
      "name": "read_offer",
      "input": "OfferKey",
      "output": "Option<Order>",
      "mode": "read"
    },
    {
      "name": "custody_intent",
      "input": "CustodyIntent",
      "output": "()",
      "metadata": true,
      "mode": "metadata"
    },
    {
      "name": "payment_intent",
      "input": "MarketPayment",
      "output": "()",
      "metadata": true,
      "mode": "metadata"
    }
  ]
} as const

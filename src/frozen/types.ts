// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.
/** Frozen v1 wire types. Lux is decimal text; other u64 values are bigint. @module */
export type Located<T> = "Absent" | { Local: T } | { Forwarded: Forward }
export type Event<T> = { version: number; op_seq: bigint; body: T }
export type PrincipalKind = "Moonlight" | "Phoenix" | "Contract"
export type TypedPrincipal = { kind: PrincipalKind; bytes: (number)[] }
export type u8 = number
export type NameKey = { root: Node; node: Node }
export type Node = (number)[]
export type Incarnation = { generation: bigint; serial: bigint }
export type u64 = bigint
export type NameRef = { key: NameKey; incarnation: Incarnation }
export type Deadline = { valid_until: bigint }
export type Height = bigint
export type Binding = { directory: Contract; vault: Contract; network: number }
export type Contract = (number)[]
export type ContractKind = "Directory" | "Store" | "Resolver" | "Vault" | "Policy" | "Marketplace"
export type Interface = { kind: ContractKind; version: number; move_version: number; custody_version: number }
export type u16 = number
export type Page = { after: (Node | null); limit: number }
export type ProposalId = { operator_epoch: bigint; nonce: bigint }
export type RecordInput = { key: string; value: (number)[]; ttl_seconds: bigint }
export type RecordValue = { key: string; value: (number)[]; ttl_seconds: bigint; updated_at: bigint }
export type MutationAction = "Set" | "Clear"
export type RecordMutation = { action: MutationAction; key: string; value: (number)[]; ttl_seconds: bigint }
export type SlotKey = { registry: Contract; node: Node; epoch: bigint }
export type SlotPointer = { resolver: Contract; epoch: bigint; count: number; digest: Digest }
export type Digest = (number)[]
export type ExpiryPolicy = "InheritsParent" | "FixedBeforeParent"
export type Subname = { parent: Node; depth: number; expiry_policy: ExpiryPolicy; created_at: bigint }
export type Custody = { nonce: bigint; incarnation: Incarnation; custodian: Contract; origin_owner: Authority; origin_manager: Authority }
export type Authority = (number)[]
export type Name = { key: NameKey; label: string; incarnation: Incarnation; owner: Authority; manager: Authority; expires_at: bigint; grace_end: bigint; referrer: (TypedPrincipal | null); subname: (Subname | null); records: (SlotPointer | null); custody: (Custody | null) }
export type RootCounters = { generation: bigint; next_serial: bigint; next_epoch: bigint; next_custody: bigint; revision: bigint }
export type Primary = { endpoint: Endpoint; name: NameRef; mapping_id: bigint; updated_at: bigint }
export type Endpoint = (number)[]
export type Forward = { root: Node; destination: Contract; destination_ordinal: number; move_id: Digest; generation: bigint; completed_at: bigint }
export type Home = "Absent" | "Local" | { Forwarded: Forward } | { Staged: Digest }
export type CommitmentKey = { actor: Authority; hash: Digest }
export type Commitment = { key: CommitmentKey; created_at: bigint }
export type Capacity = { memory_bytes: bigint; reserved_bytes: bigint; accepts_new: boolean; sealed: boolean }
export type bool = boolean
export type QuoteRequest = { version: number; directory: Contract; store: Contract; node: Node; label: string; actor: Authority; years: number; height: bigint; previous_generation: bigint; previous_grace_end: (bigint | null); policy_version: bigint }
export type LabelStatus = "Denied" | "Public" | "Reserved"
export type PolicyQuote = { version: number; request_hash: Digest; config_version: bigint; registration_open: boolean; label_status: LabelStatus; base_lux: string; premium_lux: string; base_referral_bps: number; premium_referral_bps: number; referral_lux: string; valid_until: bigint }
export type Lux = string
export type PolicyConfig = { config_version: bigint; registration_open: boolean; minimum_root_bytes: number; annual_lux: string[]; premium_start_lux: string; base_referral_bps: number; premium_referral_bps: number; reserved: (string)[]; denied: (string)[] }
export type InitPolicy = { binding: Binding; config: PolicyConfig }
export type RenewalSchedule = { version: bigint; effective_at: bigint; annual_lux: string[]; referral_bps: number }
export type MemberKind = "Store" | "Resolver"
export type Admission = { id: Contract; interface_version: number; code_hash: Digest; init_hash: Digest; ordinal: number; admitted_at: bigint; accepts_moves: boolean; retiring: boolean; governance_version: bigint }
export type MarketState = "Listed" | "Draining" | "Retired"
export type Market = { id: Contract; state: MarketState; version: bigint; interface_version: number; code_hash: Digest; init_hash: Digest }
export type MarketWindDown = { version: number; new_orders_disabled: boolean; unsettled_orders: bigint; refundable_lux: string }
export type OperatorPair = { principal: TypedPrincipal; recipient: Endpoint }
export type RegistrationContext = { revision: bigint; policy: Contract; policy_version: bigint; operator: TypedPrincipal; operator_paused: boolean; guardian_suspended: boolean; allocation_version: bigint; newest_store: Contract }
export type DirectoryConfig = { binding: Binding; operator: OperatorPair; guardian: TypedPrincipal; operator_epoch: bigint; guardian_epoch: bigint; revision: bigint; proposal_delay: bigint; guardian_delay: bigint; registration: RegistrationContext; renewal: RenewalSchedule; preferred_marketplace: (Contract | null); market_version: bigint; store_count: number; resolver_count: number; source_version: bigint; recipient_version: bigint }
export type Action = { SetPolicy: { expected_version: bigint; admission: Admission } } | { AddStore: { expected_allocation_version: bigint; admission: Admission } } | { AddResolver: { expected_count: number; admission: Admission } } | { SetAcceptsMoves: { store: Contract; value: boolean; expected_version: bigint } } | { SetRenewal: { expected_version: bigint; annual_lux: string[]; referral_bps: number } } | { SetPreferredMarketplace: { expected_version: bigint; market: (Contract | null) } } | { SetMarketplace: { expected_version: bigint; market: Contract; state: MarketState; interface_version: number; code_hash: Digest; init_hash: Digest } } | { SetRecipient: { expected_operator_epoch: bigint; recipient: Endpoint; expected_recipient_version: bigint } } | { ReplaceOperator: { expected_epoch: bigint; next: OperatorPair } } | { ReplaceGuardian: { expected_epoch: bigint; next: TypedPrincipal } } | { AddController: { contract: Contract; scopes: number; expected_version: bigint } } | { RemoveController: { contract: Contract; expected_version: bigint } } | { SetRetiring: { store: Contract; value: boolean; expected_version: bigint } }
export type ProposalStatus = "Pending" | "Executed" | "Cancelled" | "Expired" | "Invalidated"
export type Proposal = { id: ProposalId; action: Action; action_hash: Digest; proposed_at: bigint; ready_at: bigint; expires_at: bigint; status: ProposalStatus }
export type Propose = { action: Action }
export type ProposalKey = { id: ProposalId }
export type Cancel = { id: ProposalId }
export type IncreaseDelays = { proposal_delay: bigint; guardian_delay: bigint }
export type MemberQuery = { kind: MemberKind; id: Contract }
export type MemberPage = { kind: MemberKind; start: number; limit: number }
export type Members = { rows: (Admission)[]; next: (number | null) }
export type ProposalPage = { after_nonce: bigint; limit: number }
export type Proposals = { rows: (Proposal)[]; next_nonce: (bigint | null) }
export type InitDirectory = { network: number; vault: Contract; operator: OperatorPair; guardian: TypedPrincipal; proposal_delay: bigint; guardian_delay: bigint; policy: Admission; renewal_annual_lux: string[]; renewal_referral_bps: number; initial_store: Admission; initial_resolver: Admission; initial_market: (Market | null); operator_paused: boolean }
export type InitStore = { binding: Binding }
export type CommitArgs = { hash: Digest }
export type Register = { node: Node; label: string; years: number; commitment: Digest; secret: Digest; commitment_store: Contract; expected_fee_lux: string; expected_policy_version: bigint; expected_policy_config_version: bigint; valid_until: bigint; referrer: (TypedPrincipal | null); records: (RecordInput)[]; primary: (Endpoint | null) }
export type Renew = { name: NameRef; years: number; expected_schedule_version: bigint; expected_fee_lux: string; valid_until: bigint }
export type PaidOperation = { Register: Register } | { Renew: Renew } | { RegisterFor: RegisterFor }
export type IssueReserved = { node: Node; label: string; years: number; owner: Authority; manager: Authority; expected_policy_version: bigint; expected_policy_config_version: bigint; valid_until: bigint }
export type QuoteRegistration = { node: Node; label: string; years: number; actor: Authority; expected_policy_version: bigint; expected_policy_config_version: bigint }
export type RegistrationQuote = { policy: Contract; policy_version: bigint; quote: PolicyQuote; total_lux: string; height: bigint }
export type RenewalQuote = { schedule_version: bigint; total_lux: string; referral_lux: string; new_expiry: bigint; new_grace_end: bigint }
export type Authorities = { name: NameRef; owner: Authority; manager: Authority; clear_identity: boolean }
export type MutateRecords = { name: NameRef; mutations: (RecordMutation)[] }
export type ReplaceRecords = { name: NameRef; records: (RecordInput)[] }
export type MoveRecords = { name: NameRef; records: (RecordValue)[] }
export type SetPrimary = { name: NameRef; endpoint: Endpoint }
export type ClearPrimary = { endpoint: Endpoint; expected_mapping_id: bigint }
export type CreateSubname = { parent: NameRef; node: Node; label: string; owner: Authority; manager: Authority; expires_at: bigint; expiry_policy: ExpiryPolicy }
export type TakeBack = { ancestor: NameRef; targets: (NameRef)[]; owner: Authority; manager: Authority }
export type NameView = { name: Name; counters: (RootCounters | null); active: boolean; renewable: boolean; move_pending: (Digest | null) }
export type StoreStats = { local_roots: bigint; forwarded_roots: bigint; subnames: bigint; commitments: number; primaries: bigint; outgoing_moves: number; incoming_moves: number }
export type u32 = number
export type RecordQuery = { key: NameKey; record_key: string }
export type RecordsView = { pointer: (SlotPointer | null); records: (RecordValue)[] }
export type PrimaryView = { primary: Primary; spelling: string }
export type ChildPage = { parent: NameKey; after: (Node | null); limit: number }
export type Children = { rows: (Name)[]; next: (Node | null) }
export type ConsumeCommitment = { key: CommitmentKey; node: Node; label: string; secret: Digest; destination: Contract }
export type InitResolver = { binding: Binding }
export type WriteSlot = { node: Node; epoch: bigint; records: (RecordValue)[] }
export type ApplyMutations = { node: Node; epoch: bigint; mutations: (RecordMutation)[] }
export type SlotSnapshot = { records: (RecordValue)[]; count: number; digest: Digest }
export type ResolverStats = { slots: bigint; records: bigint }
export type SlotRecordQuery = { slot: SlotKey; key: string }
export type SlotLiveness = "Current" | "Staged" | "Stale"
export type SlotLivenessQuery = { node: Node; epoch: bigint; resolver: Contract }
export type TransferAndCall = { name: NameRef; target: Contract; callback_gas: bigint; data: (number)[] }
export type CustodyNotice = { version: number; directory: Contract; store: Contract; name: NameRef; nonce: bigint; previous_owner: Authority; previous_manager: Authority; data: (number)[] }
export type CustodyAck = { version: number; magic: number[]; store: Contract; node: Node; incarnation: Incarnation; nonce: bigint }
export type ReturnCustody = { name: NameRef; nonce: bigint }
export type FeeReason = "Registration" | "Renewal" | "Marketplace"
export type FeeMetadata = { version: number; reason: FeeReason; name: NameRef; payer: TypedPrincipal; beneficiary: (TypedPrincipal | null); referral_lux: string }
export type SourceKind = "Store" | "Marketplace"
export type FeeSource = { id: Contract; kind: SourceKind; state: MarketState }
export type SourceUpdate = { expected_version: bigint; source: FeeSource }
export type InitVault = { binding: Binding; sources: (FeeSource)[] }
export type ClaimAmount = "All" | { Exact: string }
export type ClaimReferral = { amount: ClaimAmount; recipient: Endpoint }
export type ClaimProtocol = { amount: ClaimAmount; expected_operator_epoch: bigint }
export type ReferralRow = { beneficiary: TypedPrincipal; claimable_lux: string }
export type VaultState = { protocol_lux: string; liability_lux: string; accounted_lux: string; reserved_beneficiaries: number; max_beneficiaries: number; source_version: bigint }
export type BalanceView = { accounted_lux: string; actual_lux: string; surplus_lux: string }
export type ReferralPage = { after: (TypedPrincipal | null); limit: number }
export type Referrals = { rows: (ReferralRow)[]; next: (TypedPrincipal | null) }
export type BeginMove = { root: NameRef; destination: Contract; expected_revision: bigint; expected_destination_ordinal: number }
export type MoveTicket = { id: Digest; source: Contract; destination: Contract; root: NameRef; initiator: Authority; source_revision: bigint; counters: RootCounters; row_count: number; primary_count: number; manifest: Digest; created_at: bigint; expires_at: bigint }
export type ExportRow = { index: number; name: Name; primary: (Primary | null) }
export type MoveLiveRow = { expires_at: bigint; grace_end: bigint; expiry_policy: (ExpiryPolicy | null); primary_mapping_id: bigint }
export type MoveLiveState = { revision: bigint; rows: (MoveLiveRow)[] }
export type ImportHeader = { ticket: MoveTicket }
export type MoveKey = { id: Digest }
export type ExportQuery = { id: Digest; index: number }
export type StageMoveRow = { id: Digest; index: number; records: (RecordValue)[] }
export type ConfirmMoveProgress = { id: Digest; staged_count: number }
export type MoveCooldownQuery = { root: Node; initiator: Authority }
export type MoveCooldowns = { root_cancelled_at: (bigint | null); initiator_cancelled_at: (bigint | null) }
export type ImportStatus = { ticket: MoveTicket; staged: number[]; staged_count: number; staged_primaries: number; last_progress_at: bigint; ready: boolean; prepared_counters: RootCounters; reserved_bytes: bigint; activated: boolean; cancelled: boolean }
export type MoveStatus = { Preparing: { ticket: MoveTicket; staged_count: number; last_progress_at: bigint; lifecycle_deadline: bigint; lock_ends_at: bigint; stale: boolean; idle: boolean } } | { Finalizing: { ticket: MoveTicket; live: MoveLiveState } } | { Forwarded: Forward }
export type PruneImport = { id: Digest; limit: number }
export type PruneForwarded = { root: Node; limit: number }
export type DirectorySetRegistrationPauseArgs = { paused: boolean }
export type DirectorySetPolicySuspensionArgs = { suspended: boolean }
export type DirectoryPruneProposalsArgs = { ids: (ProposalId)[] }
export type DirectoryRolesReturn = { operator: OperatorPair; guardian: TypedPrincipal; operator_epoch: bigint; guardian_epoch: bigint }
export type DirectoryAllocationReturn = { version: bigint; newest_store: Contract; newest_resolver: Contract }
export type DirectoryMarketArgs = { id: Contract }
export type StorePruneCommitmentsArgs = { keys: (CommitmentKey)[] }
export type StoreRemoveSubnameArgs = { name: NameRef }
export type StorePruneSubnameArgs = { name: NameRef }
export type StoreHomeArgs = { root: Node }
export type StoreReadPrimaryArgs = { endpoint: Endpoint }
export type StoreResolvePrimaryArgs = { endpoint: Endpoint }
export type StoreQuoteRenewalArgs = { name: NameRef; years: number }
export type ResolverClearSlotArgs = { node: Node; epoch: bigint }
export type ResolverPruneStaleArgs = { slot: SlotKey }
export type ResolverReadRecordSlotArgs = { slot: SlotKey }
export type VaultReadReferralArgs = { beneficiary: TypedPrincipal }
export type VaultSourceArgs = { id: Contract }
export type OperationBegin = { op_seq: bigint; height: bigint; call_path: (Contract)[] }
export type OperationEnd = { op_seq: bigint; call_path: (Contract)[] }
export type DirectoryInitialized = { args: InitDirectory; config: DirectoryConfig }
export type StoreInitialized = { args: InitStore }
export type ResolverInitialized = { args: InitResolver }
export type VaultInitialized = { args: InitVault }
export type PolicyInitialized = { args: InitPolicy }
export type ProposalCreated = { proposal: Proposal }
export type ProposalCancelled = { id: ProposalId; actor: TypedPrincipal }
export type ProposalExecuted = { id: ProposalId; action_hash: Digest }
export type ProposalPruned = { id: ProposalId; final_status: ProposalStatus }
export type ActionApplied = { id: ProposalId; action: Action; config: DirectoryConfig; admission: (Admission | null); market: (Market | null) }
export type OperatorChanged = { id: ProposalId; previous: OperatorPair; current: OperatorPair; operator_epoch: bigint; recipient_version: bigint }
export type GuardianChanged = { id: ProposalId; previous: TypedPrincipal; current: TypedPrincipal; guardian_epoch: bigint; suspended: boolean }
export type ProposalsInvalidated = { previous_operator_epoch: bigint; operator_epoch: bigint }
export type RegistrationPauseChanged = { paused: boolean; revision: bigint; actor: TypedPrincipal }
export type PolicySuspensionChanged = { suspended: boolean; revision: bigint; actor: TypedPrincipal }
export type DelaysChanged = { proposal_delay: bigint; guardian_delay: bigint; revision: bigint }
export type CommitmentCreated = { commitment: Commitment }
export type CommitmentRemovedReason = "Expired" | "Consumed"
export type CommitmentRemoved = { commitment: Commitment; reason: CommitmentRemovedReason; destination: (Contract | null) }
export type RootRegisteredReason = "Paid" | "Free" | "Reserved"
export type RootRegistered = { name: Name; previous_generation: bigint; reason: RootRegisteredReason; payer: TypedPrincipal; fee_lux: string; premium_lux: string; referral_lux: string; policy: Contract; policy_version: bigint; policy_config_version: bigint }
export type RootRenewed = { root: NameRef; old_expiry: bigint; expires_at: bigint; old_grace_end: bigint; grace_end: bigint; inheritance_rule: number; years: number; payer: TypedPrincipal; fee_lux: string; referral_lux: string; schedule_version: bigint }
export type SubnameCreated = { name: Name; actor: Authority }
export type SubtreeRemovedReason = "Removed" | "Pruned" | "Recreated" | "Reregistered"
export type SubtreeRemoved = { target: NameRef; include_target: boolean; removed_count: number; reason: SubtreeRemovedReason; actor: Authority }
export type AuthoritiesChangedReason = "Holder" | "Ancestor" | "TakeBack" | "CustodyStart" | "CustodyReturn" | "CustodySale"
export type AuthoritiesChanged = { name: Name; previous_owner: Authority; previous_manager: Authority; actor: Authority; reason: AuthoritiesChangedReason; data_cleared: boolean }
export type IdentityClearedReason = "Holder" | "Ancestor" | "TakeBack" | "Reregistered" | "CustodySale"
export type IdentityCleared = { name: NameRef; old_slot: (SlotPointer | null); old_primary: (Primary | null); reason: IdentityClearedReason }
export type SlotChangedReason = "Initial" | "Mutation" | "Replacement" | "Move"
export type SlotChanged = { name: NameRef; previous: (SlotPointer | null); current: (SlotPointer | null); reason: SlotChangedReason }
export type PrimaryChangedReason = "Set" | "Clear" | "IdentityClear"
export type PrimaryChanged = { endpoint: Endpoint; previous: (Primary | null); current: (Primary | null); reason: PrimaryChangedReason }
export type CustodyStarted = { name: NameRef; custody: Custody; callback_data_hash: Digest }
export type CustodyEndedReason = "Returned" | "Sold" | "Revoked"
export type CustodyEnded = { name: NameRef; nonce: bigint; reason: CustodyEndedReason }
export type RootCountersChanged = { root: Node; counters: RootCounters }
export type StoreWatermarksChanged = { next_slot_epoch: bigint; next_mapping_id: bigint; next_move_sequence: bigint }
export type ResolverSlotWritten = { slot: SlotKey; snapshot: SlotSnapshot }
export type ResolverSlotPrunedReason = "OwnerClear" | "Stale"
export type ResolverSlotPruned = { slot: SlotKey; reason: ResolverSlotPrunedReason }
export type FeeSourceChanged = { source: FeeSource; source_version: bigint }
export type BeneficiaryReserved = { beneficiary: TypedPrincipal; reserved_beneficiaries: number }
export type FeeReceived = { source: Contract; metadata: FeeMetadata; received_lux: string; protocol_lux: string; liability_lux: string; beneficiary_claimable_lux: string }
export type ReferralClaimed = { beneficiary: TypedPrincipal; recipient: Endpoint; amount_lux: string; remaining_lux: string; liability_lux: string }
export type ProtocolClaimed = { operator: TypedPrincipal; operator_epoch: bigint; recipient: Endpoint; amount_lux: string; remaining_lux: string }
export type MoveStarted = { ticket: MoveTicket; lifecycle_deadline: bigint }
export type MoveProgressed = { id: Digest; staged_count: number; last_progress_at: bigint }
export type ImportPrepared = { status: ImportStatus }
export type ImportRowStaged = { id: Digest; index: number; original: ExportRow; imported: Name; imported_primary: (Primary | null) }
export type ImportReady = { id: Digest; manifest: Digest; row_count: number; primary_count: number; counters: RootCounters }
export type RootImported = { ticket: MoveTicket; counters: RootCounters; live: MoveLiveState }
export type RootForwarded = { ticket: MoveTicket; forward: Forward }
export type MoveCancelledReason = "Owner" | "Idle" | "Expired" | "LifecycleEnded"
export type MoveCancelled = { ticket: MoveTicket; reason: MoveCancelledReason; cancelled_at: bigint; cooldown_applied: boolean }
export type ImportRowsPruned = { id: Digest; indices: (number)[]; remaining: number; cancelled: boolean }
export type ForwardedRowsPruned = { root: Node; move_id: Digest; names: (NameRef)[]; remaining: number }
export type ErrorCode = "InvalidWire" | "InvalidArgument" | "Unauthorized" | "PolicyBusy" | "Moved" | "NotFound" | "Stale" | "Overflow" | "Capacity" | "Closed" | "PolicyUnavailable" | "QuoteChanged" | "FeeMismatch" | "DepositFailed" | "PaymentFailed" | "Expired" | "NotAvailable" | "WrongHome" | "CommitmentMissing" | "CommitmentAge" | "CommitmentMismatch" | "CommitmentLimit" | "AlreadyExists" | "PrimaryAlreadySet" | "ForwardMismatch" | "CustodyActive" | "CustodyMismatch" | "CallbackFailed" | "MovePending" | "MoveStale" | "MoveIncomplete" | "MoveCooldown" | "NotReady" | "ProposalExpired" | "Conflict" | "AcceptanceRequired" | "ReferralCapacity" | "InsufficientBalance" | "ExternalReadFailed" | "GasBudget" | "Busy"
export type ReceiveFromContract = { contract: string; value: string; data: string }
export type InitMarketplace = { binding: Binding }
export type SetPause = { paused: boolean }
export type SetFee = { expected_fee_bps: number; fee_bps: number }
export type Referral = { beneficiary: TypedPrincipal; bps: number }
export type Terms = { version: 1; directory: Contract; store: Contract; name: NameRef; id: bigint; kind: OrderKind; amount_lux: string; fee_bps: number; seller: Authority; seller_manager: Authority; seller_recipient: Endpoint; buyer: null | Authority; buyer_manager: null | Authority; deadline: bigint; duration_blocks: bigint; referral: null | Referral }
export type Bid = { payer: TypedPrincipal; manager: Authority; amount_lux: string }
export type Order = { terms: Terms; nonce: bigint; status: OrderStatus; payer: null | TypedPrincipal; highest: null | Bid; started_at: null | bigint; end: null | bigint; maximum_end: null | bigint; bid_count: number }
export type CustodyIntent = { terms: Terms; nonce: bigint; valid_until: bigint }
export type PlaceOffer = { terms: Terms; valid_until: bigint }
export type Buy = { order: Order; manager: Authority; valid_until: bigint }
export type PlaceBid = { order: Order; amount_lux: string; manager: Authority; valid_until: bigint }
export type RenewOrder = { order: Order; renewal: Renew }
export type ClaimRefund = { amount: ClaimAmount; recipient: Endpoint }
export type OrderKey = { id: bigint }
export type RefundKey = { authority: Authority }
export type Refund = { authority: Authority; amount_lux: string }
export type Config = { binding: Binding; fee_bps: number; new_orders_disabled: boolean; next_order_id: bigint; unsettled_orders: bigint; refund_accounts: bigint; held_lux: string; refundable_lux: string }
export type MarketConfigured = { config: Config }
export type OrderChanged = { order: Order }
export type OrderClosed = { order: Order; reason: CloseReason }
export type TradeSettled = { order: Order; payer: TypedPrincipal; buyer: Authority; manager: Authority; gross_lux: string; fee_lux: string; referral_lux: string }
export type RefundChanged = { refund: Refund }
export type RefundClaimed = { authority: Authority; recipient: Endpoint; amount_lux: string }
export type EscrowRenewed = { order_id: bigint; renewal: Renew; payer: TypedPrincipal }
export type OrderKind = "Fixed" | "Auction" | "Offer"
export type OrderStatus = "Open" | "ReturnPending"
export type CloseReason = "Cancelled" | "Expired" | "Returned" | "LostCustody" | "Sold"
export type MarketPayment = { Buy: Buy } | { Bid: PlaceBid } | { Offer: PlaceOffer } | { Renew: RenewOrder }
export type ListingKey = { store: Contract; root: Node }
export type OfferKey = { store: Contract; root: Node; buyer: Authority }
export type DirectoryPayoutKey = { account: string }
export type Controller = { contract: Contract; scopes: number; admitted_at: bigint; suspended: boolean }
export type Controllers = { version: bigint; rows: (Controller)[] }
export type ControllerQuery = { contract: Contract }
export type ControllerSuspension = { controller: Contract; suspended: boolean }
export type Delegated = { principal: TypedPrincipal; op: DelegatedOp }
export type RegisterFor = { registration: Register; owner: Authority; manager: Authority }
export type CedeReleased = { root: Node; destination: Contract }
export type ReleasedRoot = { counters: RootCounters; grace_end: bigint }
export type ControllerChanged = { controller: Controller; listed: boolean; version: bigint }
export type ControllerSuspensionChanged = { controller: Contract; suspended: boolean; actor: TypedPrincipal; version: bigint }
export type ControllerUsed = { principal: TypedPrincipal; via: Contract; scope: number }
export type RootCeded = { forward: Forward; counters: RootCounters; grace_end: bigint }
export type DelegatedOp = { UpdateAuthorities: Authorities } | { TransferAndCall: TransferAndCall } | { CreateSubname: CreateSubname } | { ReassignSubname: Authorities } | { RemoveSubname: StoreRemoveSubnameArgs } | { PruneSubname: StorePruneSubnameArgs } | { TakeBackSubnames: TakeBack } | { MutateRecords: MutateRecords } | { ReplaceRecords: ReplaceRecords } | { MoveRecords: MoveRecords }
export interface WireTypes {
  "PrincipalKind": PrincipalKind
  "TypedPrincipal": TypedPrincipal
  "u8": number
  "NameKey": NameKey
  "Node": Node
  "Incarnation": Incarnation
  "u64": bigint
  "NameRef": NameRef
  "Deadline": Deadline
  "Height": bigint
  "Binding": Binding
  "Contract": Contract
  "ContractKind": ContractKind
  "Interface": Interface
  "u16": number
  "Page": Page
  "Option<Node>": (Node | null)
  "ProposalId": ProposalId
  "RecordInput": RecordInput
  "RecordValue": RecordValue
  "MutationAction": MutationAction
  "RecordMutation": RecordMutation
  "SlotKey": SlotKey
  "SlotPointer": SlotPointer
  "Digest": Digest
  "ExpiryPolicy": ExpiryPolicy
  "Subname": Subname
  "Custody": Custody
  "Authority": Authority
  "Name": Name
  "Option<TypedPrincipal>": (TypedPrincipal | null)
  "Option<Subname>": (Subname | null)
  "Option<SlotPointer>": (SlotPointer | null)
  "Option<Custody>": (Custody | null)
  "RootCounters": RootCounters
  "Primary": Primary
  "Endpoint": Endpoint
  "Forward": Forward
  "Home": Home
  "CommitmentKey": CommitmentKey
  "Commitment": Commitment
  "Capacity": Capacity
  "bool": boolean
  "QuoteRequest": QuoteRequest
  "Option<Height>": (bigint | null)
  "LabelStatus": LabelStatus
  "PolicyQuote": PolicyQuote
  "Lux": string
  "PolicyConfig": PolicyConfig
  "[Lux; 5]": string[]
  "InitPolicy": InitPolicy
  "RenewalSchedule": RenewalSchedule
  "MemberKind": MemberKind
  "Admission": Admission
  "MarketState": MarketState
  "Market": Market
  "MarketWindDown": MarketWindDown
  "OperatorPair": OperatorPair
  "RegistrationContext": RegistrationContext
  "DirectoryConfig": DirectoryConfig
  "Option<Contract>": (Contract | null)
  "Action": Action
  "ProposalStatus": ProposalStatus
  "Proposal": Proposal
  "Propose": Propose
  "ProposalKey": ProposalKey
  "Cancel": Cancel
  "IncreaseDelays": IncreaseDelays
  "MemberQuery": MemberQuery
  "MemberPage": MemberPage
  "Members": Members
  "Option<u16>": (number | null)
  "ProposalPage": ProposalPage
  "Proposals": Proposals
  "Option<u64>": (bigint | null)
  "InitDirectory": InitDirectory
  "Option<Market>": (Market | null)
  "InitStore": InitStore
  "CommitArgs": CommitArgs
  "Register": Register
  "Option<Endpoint>": (Endpoint | null)
  "Renew": Renew
  "PaidOperation": PaidOperation
  "IssueReserved": IssueReserved
  "QuoteRegistration": QuoteRegistration
  "RegistrationQuote": RegistrationQuote
  "RenewalQuote": RenewalQuote
  "Authorities": Authorities
  "MutateRecords": MutateRecords
  "ReplaceRecords": ReplaceRecords
  "MoveRecords": MoveRecords
  "SetPrimary": SetPrimary
  "ClearPrimary": ClearPrimary
  "CreateSubname": CreateSubname
  "TakeBack": TakeBack
  "NameView": NameView
  "Option<RootCounters>": (RootCounters | null)
  "Option<Digest>": (Digest | null)
  "StoreStats": StoreStats
  "u32": number
  "RecordQuery": RecordQuery
  "RecordsView": RecordsView
  "PrimaryView": PrimaryView
  "ChildPage": ChildPage
  "Children": Children
  "ConsumeCommitment": ConsumeCommitment
  "InitResolver": InitResolver
  "WriteSlot": WriteSlot
  "ApplyMutations": ApplyMutations
  "SlotSnapshot": SlotSnapshot
  "ResolverStats": ResolverStats
  "SlotRecordQuery": SlotRecordQuery
  "SlotLiveness": SlotLiveness
  "SlotLivenessQuery": SlotLivenessQuery
  "TransferAndCall": TransferAndCall
  "CustodyNotice": CustodyNotice
  "CustodyAck": CustodyAck
  "[u8;8]": number[]
  "ReturnCustody": ReturnCustody
  "FeeReason": FeeReason
  "FeeMetadata": FeeMetadata
  "SourceKind": SourceKind
  "FeeSource": FeeSource
  "SourceUpdate": SourceUpdate
  "InitVault": InitVault
  "ClaimAmount": ClaimAmount
  "ClaimReferral": ClaimReferral
  "ClaimProtocol": ClaimProtocol
  "ReferralRow": ReferralRow
  "VaultState": VaultState
  "BalanceView": BalanceView
  "ReferralPage": ReferralPage
  "Referrals": Referrals
  "BeginMove": BeginMove
  "MoveTicket": MoveTicket
  "ExportRow": ExportRow
  "Option<Primary>": (Primary | null)
  "MoveLiveRow": MoveLiveRow
  "Option<ExpiryPolicy>": (ExpiryPolicy | null)
  "MoveLiveState": MoveLiveState
  "ImportHeader": ImportHeader
  "MoveKey": MoveKey
  "ExportQuery": ExportQuery
  "StageMoveRow": StageMoveRow
  "ConfirmMoveProgress": ConfirmMoveProgress
  "MoveCooldownQuery": MoveCooldownQuery
  "MoveCooldowns": MoveCooldowns
  "ImportStatus": ImportStatus
  "[u8;33]": number[]
  "MoveStatus": MoveStatus
  "PruneImport": PruneImport
  "PruneForwarded": PruneForwarded
  "DirectorySetRegistrationPauseArgs": DirectorySetRegistrationPauseArgs
  "DirectorySetPolicySuspensionArgs": DirectorySetPolicySuspensionArgs
  "DirectoryPruneProposalsArgs": DirectoryPruneProposalsArgs
  "DirectoryRolesReturn": DirectoryRolesReturn
  "DirectoryAllocationReturn": DirectoryAllocationReturn
  "DirectoryMarketArgs": DirectoryMarketArgs
  "StorePruneCommitmentsArgs": StorePruneCommitmentsArgs
  "StoreRemoveSubnameArgs": StoreRemoveSubnameArgs
  "StorePruneSubnameArgs": StorePruneSubnameArgs
  "StoreHomeArgs": StoreHomeArgs
  "StoreReadPrimaryArgs": StoreReadPrimaryArgs
  "StoreResolvePrimaryArgs": StoreResolvePrimaryArgs
  "StoreQuoteRenewalArgs": StoreQuoteRenewalArgs
  "ResolverClearSlotArgs": ResolverClearSlotArgs
  "ResolverPruneStaleArgs": ResolverPruneStaleArgs
  "ResolverReadRecordSlotArgs": ResolverReadRecordSlotArgs
  "VaultReadReferralArgs": VaultReadReferralArgs
  "VaultSourceArgs": VaultSourceArgs
  "OperationBegin": OperationBegin
  "OperationEnd": OperationEnd
  "DirectoryInitialized": DirectoryInitialized
  "StoreInitialized": StoreInitialized
  "ResolverInitialized": ResolverInitialized
  "VaultInitialized": VaultInitialized
  "PolicyInitialized": PolicyInitialized
  "ProposalCreated": ProposalCreated
  "ProposalCancelled": ProposalCancelled
  "ProposalExecuted": ProposalExecuted
  "ProposalPruned": ProposalPruned
  "ActionApplied": ActionApplied
  "Option<Admission>": (Admission | null)
  "OperatorChanged": OperatorChanged
  "GuardianChanged": GuardianChanged
  "ProposalsInvalidated": ProposalsInvalidated
  "RegistrationPauseChanged": RegistrationPauseChanged
  "PolicySuspensionChanged": PolicySuspensionChanged
  "DelaysChanged": DelaysChanged
  "CommitmentCreated": CommitmentCreated
  "CommitmentRemovedReason": CommitmentRemovedReason
  "CommitmentRemoved": CommitmentRemoved
  "RootRegisteredReason": RootRegisteredReason
  "RootRegistered": RootRegistered
  "RootRenewed": RootRenewed
  "SubnameCreated": SubnameCreated
  "SubtreeRemovedReason": SubtreeRemovedReason
  "SubtreeRemoved": SubtreeRemoved
  "AuthoritiesChangedReason": AuthoritiesChangedReason
  "AuthoritiesChanged": AuthoritiesChanged
  "IdentityClearedReason": IdentityClearedReason
  "IdentityCleared": IdentityCleared
  "SlotChangedReason": SlotChangedReason
  "SlotChanged": SlotChanged
  "PrimaryChangedReason": PrimaryChangedReason
  "PrimaryChanged": PrimaryChanged
  "CustodyStarted": CustodyStarted
  "CustodyEndedReason": CustodyEndedReason
  "CustodyEnded": CustodyEnded
  "RootCountersChanged": RootCountersChanged
  "StoreWatermarksChanged": StoreWatermarksChanged
  "ResolverSlotWritten": ResolverSlotWritten
  "ResolverSlotPrunedReason": ResolverSlotPrunedReason
  "ResolverSlotPruned": ResolverSlotPruned
  "FeeSourceChanged": FeeSourceChanged
  "BeneficiaryReserved": BeneficiaryReserved
  "FeeReceived": FeeReceived
  "ReferralClaimed": ReferralClaimed
  "ProtocolClaimed": ProtocolClaimed
  "MoveStarted": MoveStarted
  "MoveProgressed": MoveProgressed
  "ImportPrepared": ImportPrepared
  "ImportRowStaged": ImportRowStaged
  "ImportReady": ImportReady
  "RootImported": RootImported
  "RootForwarded": RootForwarded
  "MoveCancelledReason": MoveCancelledReason
  "MoveCancelled": MoveCancelled
  "ImportRowsPruned": ImportRowsPruned
  "ForwardedRowsPruned": ForwardedRowsPruned
  "ErrorCode": ErrorCode
  "()": null
  "Option<Proposal>": (Proposal | null)
  "ReceiveFromContract": ReceiveFromContract
  "Located<NameView>": Located<NameView>
  "Located<Children>": Located<Children>
  "Located<Option<SlotPointer>>": Located<(SlotPointer | null)>
  "Located<Option<RecordValue>>": Located<(RecordValue | null)>
  "Option<RecordValue>": (RecordValue | null)
  "Located<RecordsView>": Located<RecordsView>
  "Option<PrimaryView>": (PrimaryView | null)
  "Option<Commitment>": (Commitment | null)
  "Located<RenewalQuote>": Located<RenewalQuote>
  "Option<MoveStatus>": (MoveStatus | null)
  "Option<ImportStatus>": (ImportStatus | null)
  "Located<MoveCooldowns>": Located<MoveCooldowns>
  "Option<SlotSnapshot>": (SlotSnapshot | null)
  "Option<ReferralRow>": (ReferralRow | null)
  "Option<FeeSource>": (FeeSource | null)
  "Event<DirectoryInitialized>": Event<DirectoryInitialized>
  "Event<StoreInitialized>": Event<StoreInitialized>
  "Event<ResolverInitialized>": Event<ResolverInitialized>
  "Event<VaultInitialized>": Event<VaultInitialized>
  "Event<PolicyInitialized>": Event<PolicyInitialized>
  "Event<ProposalCreated>": Event<ProposalCreated>
  "Event<ProposalCancelled>": Event<ProposalCancelled>
  "Event<ProposalExecuted>": Event<ProposalExecuted>
  "Event<ProposalPruned>": Event<ProposalPruned>
  "Event<ActionApplied>": Event<ActionApplied>
  "Event<OperatorChanged>": Event<OperatorChanged>
  "Event<GuardianChanged>": Event<GuardianChanged>
  "Event<ProposalsInvalidated>": Event<ProposalsInvalidated>
  "Event<RegistrationPauseChanged>": Event<RegistrationPauseChanged>
  "Event<PolicySuspensionChanged>": Event<PolicySuspensionChanged>
  "Event<DelaysChanged>": Event<DelaysChanged>
  "Event<CommitmentCreated>": Event<CommitmentCreated>
  "Event<CommitmentRemoved>": Event<CommitmentRemoved>
  "Event<RootRegistered>": Event<RootRegistered>
  "Event<RootRenewed>": Event<RootRenewed>
  "Event<SubnameCreated>": Event<SubnameCreated>
  "Event<SubtreeRemoved>": Event<SubtreeRemoved>
  "Event<AuthoritiesChanged>": Event<AuthoritiesChanged>
  "Event<IdentityCleared>": Event<IdentityCleared>
  "Event<SlotChanged>": Event<SlotChanged>
  "Event<PrimaryChanged>": Event<PrimaryChanged>
  "Event<CustodyStarted>": Event<CustodyStarted>
  "Event<CustodyEnded>": Event<CustodyEnded>
  "Event<RootCountersChanged>": Event<RootCountersChanged>
  "Event<StoreWatermarksChanged>": Event<StoreWatermarksChanged>
  "Event<ResolverSlotWritten>": Event<ResolverSlotWritten>
  "Event<ResolverSlotPruned>": Event<ResolverSlotPruned>
  "Event<FeeSourceChanged>": Event<FeeSourceChanged>
  "Event<BeneficiaryReserved>": Event<BeneficiaryReserved>
  "Event<FeeReceived>": Event<FeeReceived>
  "Event<ReferralClaimed>": Event<ReferralClaimed>
  "Event<ProtocolClaimed>": Event<ProtocolClaimed>
  "Event<MoveStarted>": Event<MoveStarted>
  "Event<MoveProgressed>": Event<MoveProgressed>
  "Event<ImportPrepared>": Event<ImportPrepared>
  "Event<ImportRowStaged>": Event<ImportRowStaged>
  "Event<ImportReady>": Event<ImportReady>
  "Event<RootImported>": Event<RootImported>
  "Event<RootForwarded>": Event<RootForwarded>
  "Event<MoveCancelled>": Event<MoveCancelled>
  "Event<ImportRowsPruned>": Event<ImportRowsPruned>
  "Event<ForwardedRowsPruned>": Event<ForwardedRowsPruned>
  "InitMarketplace": InitMarketplace
  "SetPause": SetPause
  "SetFee": SetFee
  "Referral": Referral
  "Terms": Terms
  "Bid": Bid
  "Order": Order
  "CustodyIntent": CustodyIntent
  "PlaceOffer": PlaceOffer
  "Buy": Buy
  "PlaceBid": PlaceBid
  "RenewOrder": RenewOrder
  "ClaimRefund": ClaimRefund
  "OrderKey": OrderKey
  "RefundKey": RefundKey
  "Refund": Refund
  "Config": Config
  "MarketConfigured": MarketConfigured
  "OrderChanged": OrderChanged
  "OrderClosed": OrderClosed
  "TradeSettled": TradeSettled
  "RefundChanged": RefundChanged
  "RefundClaimed": RefundClaimed
  "EscrowRenewed": EscrowRenewed
  "OrderKind": OrderKind
  "OrderStatus": OrderStatus
  "CloseReason": CloseReason
  "MarketPayment": MarketPayment
  "Option<Order>": (Order | null)
  "Event<MarketConfigured>": Event<MarketConfigured>
  "Event<OrderChanged>": Event<OrderChanged>
  "Event<OrderClosed>": Event<OrderClosed>
  "Event<TradeSettled>": Event<TradeSettled>
  "Event<RefundChanged>": Event<RefundChanged>
  "Event<RefundClaimed>": Event<RefundClaimed>
  "Event<EscrowRenewed>": Event<EscrowRenewed>
  "ListingKey": ListingKey
  "OfferKey": OfferKey
  "DirectoryPayoutKey": DirectoryPayoutKey
  "Controller": Controller
  "Controllers": Controllers
  "ControllerQuery": ControllerQuery
  "ControllerSuspension": ControllerSuspension
  "Delegated": Delegated
  "RegisterFor": RegisterFor
  "CedeReleased": CedeReleased
  "ReleasedRoot": ReleasedRoot
  "ControllerChanged": ControllerChanged
  "ControllerSuspensionChanged": ControllerSuspensionChanged
  "ControllerUsed": ControllerUsed
  "RootCeded": RootCeded
  "Vec<Controller>": (Controller)[]
  "Option<Controller>": (Controller | null)
  "Event<ControllerChanged>": Event<ControllerChanged>
  "Event<ControllerSuspensionChanged>": Event<ControllerSuspensionChanged>
  "Event<ControllerUsed>": Event<ControllerUsed>
  "Event<RootCeded>": Event<RootCeded>
  "DelegatedOp": DelegatedOp
}
export interface Methods {
  directory: {
    init: { input: InitDirectory; output: null }
    propose: { input: Propose; output: ProposalId }
    execute: { input: ProposalKey; output: null }
    accept_operator: { input: ProposalKey; output: null }
    accept_guardian: { input: ProposalKey; output: null }
    cancel: { input: Cancel; output: null }
    set_registration_pause: { input: DirectorySetRegistrationPauseArgs; output: null }
    set_policy_suspension: { input: DirectorySetPolicySuspensionArgs; output: null }
    increase_delays: { input: IncreaseDelays; output: null }
    prune_proposals: { input: DirectoryPruneProposalsArgs; output: number }
    config: { input: null; output: DirectoryConfig }
    registration_context: { input: null; output: RegistrationContext }
    renewal_schedule: { input: null; output: RenewalSchedule }
    roles: { input: null; output: DirectoryRolesReturn }
    operator_payout_key: { input: null; output: DirectoryPayoutKey }
    member: { input: MemberQuery; output: (Admission | null) }
    members: { input: MemberPage; output: Members }
    allocation: { input: null; output: DirectoryAllocationReturn }
    market: { input: DirectoryMarketArgs; output: (Market | null) }
    proposal: { input: ProposalKey; output: (Proposal | null) }
    proposals: { input: ProposalPage; output: Proposals }
    interface_version: { input: null; output: Interface }
    binding: { input: null; output: Binding }
    capacity: { input: null; output: Capacity }
    controllers: { input: null; output: Controllers }
    controller: { input: ControllerQuery; output: (Controller | null) }
    set_controller_suspension: { input: ControllerSuspension; output: null }
  }
  policy: {
    init: { input: InitPolicy; output: null }
    config: { input: null; output: PolicyConfig }
    quote: { input: QuoteRequest; output: PolicyQuote }
    interface_version: { input: null; output: Interface }
    binding: { input: null; output: Binding }
  }
  store: {
    init: { input: InitStore; output: null }
    commit: { input: CommitArgs; output: null }
    prune_commitments: { input: StorePruneCommitmentsArgs; output: number }
    consume_commitment: { input: ConsumeCommitment; output: bigint }
    register: { input: Register; output: null }
    renew: { input: Renew; output: null }
    receive_payment: { input: ReceiveFromContract; output: null }
    issue_reserved: { input: IssueReserved; output: null }
    update_authorities: { input: Authorities; output: null }
    mutate_records: { input: MutateRecords; output: null }
    replace_records: { input: ReplaceRecords; output: null }
    move_records: { input: MoveRecords; output: null }
    set_primary: { input: SetPrimary; output: null }
    clear_primary: { input: ClearPrimary; output: null }
    create_subname: { input: CreateSubname; output: null }
    remove_subname: { input: StoreRemoveSubnameArgs; output: null }
    prune_subname: { input: StorePruneSubnameArgs; output: null }
    take_back_subnames: { input: TakeBack; output: null }
    home: { input: StoreHomeArgs; output: Home }
    stats: { input: null; output: StoreStats }
    get_name: { input: NameKey; output: Located<NameView> }
    children: { input: ChildPage; output: Located<Children> }
    record_slot: { input: NameKey; output: Located<(SlotPointer | null)> }
    read_record: { input: RecordQuery; output: Located<(RecordValue | null)> }
    read_records: { input: NameKey; output: Located<RecordsView> }
    resolve_record: { input: RecordQuery; output: Located<(RecordValue | null)> }
    read_primary: { input: StoreReadPrimaryArgs; output: (PrimaryView | null) }
    resolve_primary: { input: StoreResolvePrimaryArgs; output: (PrimaryView | null) }
    pending_commitment: { input: CommitmentKey; output: (Commitment | null) }
    commitment_raw: { input: CommitmentKey; output: (Commitment | null) }
    quote_registration: { input: QuoteRegistration; output: RegistrationQuote }
    quote_renewal: { input: StoreQuoteRenewalArgs; output: Located<RenewalQuote> }
    slot_liveness: { input: SlotLivenessQuery; output: SlotLiveness }
    transfer_and_call: { input: TransferAndCall; output: null }
    return_custody: { input: ReturnCustody; output: null }
    begin_move: { input: BeginMove; output: Digest }
    begin_import: { input: ImportHeader; output: null }
    export_move_row: { input: ExportQuery; output: ExportRow }
    move_status: { input: MoveKey; output: (MoveStatus | null) }
    import_status: { input: MoveKey; output: (ImportStatus | null) }
    move_cooldowns: { input: MoveCooldownQuery; output: Located<MoveCooldowns> }
    stage_move_row: { input: StageMoveRow; output: null }
    confirm_move_progress: { input: ConfirmMoveProgress; output: null }
    finalize_move: { input: MoveKey; output: null }
    activate_import: { input: MoveKey; output: null }
    cancel_move: { input: MoveKey; output: null }
    prune_import: { input: PruneImport; output: number }
    prune_forwarded: { input: PruneForwarded; output: number }
    interface_version: { input: null; output: Interface }
    binding: { input: null; output: Binding }
    capacity: { input: null; output: Capacity }
    delegated: { input: Delegated; output: null }
    released_root: { input: StoreHomeArgs; output: ReleasedRoot }
    cede_released: { input: CedeReleased; output: ReleasedRoot }
  }
  resolver: {
    init: { input: InitResolver; output: null }
    write_slot: { input: WriteSlot; output: SlotSnapshot }
    apply_mutations: { input: ApplyMutations; output: SlotSnapshot }
    clear_slot: { input: ResolverClearSlotArgs; output: boolean }
    prune_stale: { input: ResolverPruneStaleArgs; output: boolean }
    read_slot_record: { input: SlotRecordQuery; output: (RecordValue | null) }
    read_record_slot: { input: ResolverReadRecordSlotArgs; output: (SlotSnapshot | null) }
    stats: { input: null; output: ResolverStats }
    interface_version: { input: null; output: Interface }
    binding: { input: null; output: Binding }
    capacity: { input: null; output: Capacity }
  }
  vault: {
    init: { input: InitVault; output: null }
    set_source: { input: SourceUpdate; output: null }
    receive_fee: { input: ReceiveFromContract; output: null }
    claim_referral: { input: ClaimReferral; output: null }
    claim_protocol: { input: ClaimProtocol; output: null }
    read_state: { input: null; output: VaultState }
    read_referral: { input: VaultReadReferralArgs; output: (ReferralRow | null) }
    referrals: { input: ReferralPage; output: Referrals }
    source: { input: VaultSourceArgs; output: (FeeSource | null) }
    read_balance: { input: null; output: BalanceView }
    interface_version: { input: null; output: Interface }
    binding: { input: null; output: Binding }
    capacity: { input: null; output: Capacity }
  }
  marketplace: {
    init: { input: InitMarketplace; output: null }
    set_pause: { input: SetPause; output: null }
    set_fee: { input: SetFee; output: null }
    on_name_received: { input: CustodyNotice; output: CustodyAck }
    buy_fixed: { input: Buy; output: null }
    place_bid: { input: PlaceBid; output: null }
    place_offer: { input: PlaceOffer; output: null }
    renew_escrow: { input: RenewOrder; output: null }
    receive_payment: { input: ReceiveFromContract; output: null }
    settle_auction: { input: Order; output: null }
    cancel_order: { input: Order; output: null }
    expire_order: { input: Order; output: null }
    retry_return: { input: Order; output: null }
    claim_refund: { input: ClaimRefund; output: null }
    interface_version: { input: null; output: Interface }
    binding: { input: null; output: Binding }
    capacity: { input: null; output: Capacity }
    config: { input: null; output: Config }
    wind_down_state: { input: null; output: MarketWindDown }
    order_api_version: { input: null; output: number }
    read_order: { input: OrderKey; output: (Order | null) }
    read_refund: { input: RefundKey; output: Refund }
    read_listing: { input: ListingKey; output: (Order | null) }
    read_offer: { input: OfferKey; output: (Order | null) }
    custody_intent: { input: CustodyIntent; output: null }
    payment_intent: { input: MarketPayment; output: null }
  }
}
export interface EventTypes {
  operation_begin: OperationBegin
  operation_end: OperationEnd
  directory_initialized: Event<DirectoryInitialized>
  store_initialized: Event<StoreInitialized>
  resolver_initialized: Event<ResolverInitialized>
  vault_initialized: Event<VaultInitialized>
  policy_initialized: Event<PolicyInitialized>
  proposal_created: Event<ProposalCreated>
  proposal_cancelled: Event<ProposalCancelled>
  proposal_executed: Event<ProposalExecuted>
  proposal_pruned: Event<ProposalPruned>
  action_applied: Event<ActionApplied>
  operator_changed: Event<OperatorChanged>
  guardian_changed: Event<GuardianChanged>
  proposals_invalidated: Event<ProposalsInvalidated>
  registration_pause_changed: Event<RegistrationPauseChanged>
  policy_suspension_changed: Event<PolicySuspensionChanged>
  delays_changed: Event<DelaysChanged>
  commitment_created: Event<CommitmentCreated>
  commitment_removed: Event<CommitmentRemoved>
  root_registered: Event<RootRegistered>
  root_renewed: Event<RootRenewed>
  subname_created: Event<SubnameCreated>
  subtree_removed: Event<SubtreeRemoved>
  authorities_changed: Event<AuthoritiesChanged>
  identity_cleared: Event<IdentityCleared>
  slot_changed: Event<SlotChanged>
  primary_changed: Event<PrimaryChanged>
  custody_started: Event<CustodyStarted>
  custody_ended: Event<CustodyEnded>
  root_counters_changed: Event<RootCountersChanged>
  store_watermarks_changed: Event<StoreWatermarksChanged>
  resolver_slot_written: Event<ResolverSlotWritten>
  resolver_slot_pruned: Event<ResolverSlotPruned>
  fee_source_changed: Event<FeeSourceChanged>
  beneficiary_reserved: Event<BeneficiaryReserved>
  fee_received: Event<FeeReceived>
  referral_claimed: Event<ReferralClaimed>
  protocol_claimed: Event<ProtocolClaimed>
  move_started: Event<MoveStarted>
  move_progressed: Event<MoveProgressed>
  import_prepared: Event<ImportPrepared>
  import_row_staged: Event<ImportRowStaged>
  import_ready: Event<ImportReady>
  root_imported: Event<RootImported>
  root_forwarded: Event<RootForwarded>
  move_cancelled: Event<MoveCancelled>
  import_rows_pruned: Event<ImportRowsPruned>
  forwarded_rows_pruned: Event<ForwardedRowsPruned>
  market_configured: Event<MarketConfigured>
  order_changed: Event<OrderChanged>
  order_closed: Event<OrderClosed>
  trade_settled: Event<TradeSettled>
  refund_changed: Event<RefundChanged>
  refund_claimed: Event<RefundClaimed>
  escrow_renewed: Event<EscrowRenewed>
  controller_changed: Event<ControllerChanged>
  controller_suspension_changed: Event<ControllerSuspensionChanged>
  controller_used: Event<ControllerUsed>
  root_ceded: Event<RootCeded>
}

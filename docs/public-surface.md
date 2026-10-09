# Public surface in 0.3.2

The npm and JSR export maps contain the same eight entrypoints. npm resolves
runtime imports to compiled JavaScript and types to declarations in `dist`; its
`event-catalog` export uses the generated standalone `.mjs` catalog. Plain Node
consumers need no TypeScript loader. JSR continues to export TypeScript sources.

| Import                             | Public API                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@duskdomains/sdk`                 | `createClientFromManifest`, `FrozenClient`, manifest/driver/transport helpers, exact frozen wire types, lossless JSON, name/authority/commitment derivations, write builders and gas policy |
| `@duskdomains/sdk/writes`          | `buildCall`, all public write builders, `registrationCalls`, `transferCall`, `reassignSubnameCall`, `createMarketplaceCalls`, `GAS_LIMITS`                                                  |
| `@duskdomains/sdk/connect-app`     | `createDuskDomainsConnectApp`, `ConnectWallet`, `ConnectApp`, `PreparedCall`                                                                                                                |
| `@duskdomains/sdk/marketplace`     | `createMarketplaceCalls`, order/custody/refund types and builders                                                                                                                           |
| `@duskdomains/sdk/event-catalog`   | `indexerEventCatalog`, `duskDomainsIndexedEventTypes`, `EventTopic`                                                                                                                         |
| `@duskdomains/sdk/projection`      | Receipt journals, projection, projected reads, digest helpers and event catalog                                                                                                             |
| `@duskdomains/sdk/indexer`         | Projection HTTP response types, `createDuskDomainsIndexerClient`, `createIndexerClientFromManifest`, `collectIndexerPages`, `waitForIndexerWrite`                                           |
| `@duskdomains/sdk/chain-addresses` | Ethereum, Bitcoin and Solana address validators; retained as public                                                                                                                         |

`./internal` and `./write-proof` are removed with the legacy clients. The old
`*_runtime` names, router/core/treasury presets, hand-written legacy wire shapes,
legacy marketplace hooks and event projectors have no frozen aliases.

## Canonical reads

`client.directory` and `client.vault` select the manifest's singleton roles.
`client.store(id)`, `.resolver(id)`, `.policy(id)` and `.marketplace(id)` select a
specific implementation. Methods use exact wire names, argument objects and
return shapes. The generated `ReadApi` provides compile-time argument/result
types. Unit reads take no arguments.

| Scope       | Read families                                                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| directory   | `config`, `registration_context`, `renewal_schedule`, `roles`, `operator_payout_key`, `member`, `members`, `allocation`, `market`, `proposal`, `proposals`, `controllers`, `controller`, common interface/binding/capacity                                                                                                    |
| store       | `home`, `released_root`, `get_name`, `children`, `record_slot`, `read_record`, `read_records`, `resolve_record`, `read_primary`, `resolve_primary`, `pending_commitment`, `commitment_raw`, both quotes, slot liveness, move/import status, cooldowns, export rows, stats and common reads |
| resolver    | `read_slot_record`, `read_record_slot`, stats and common reads                                                                                                                                                                                                            |
| policy      | `quote`, `config`, `interface_version`, `binding`                                                                                                                                                                                                                         |
| vault       | `read_state`, `read_balance`, `read_referral`, `referrals`, `source` and common reads                                                                                                                                                                                     |
| marketplace | `config`, `wind_down_state`, `order_api_version`, `read_order`, `read_listing`, `read_offer`, `read_refund` and common reads                                                                                                                                              |

`getName(spelling, homeHint?)` returns `{ store, value, forwards, height }`.
`quoteRenewal(store, args)` retains the same routing metadata. `locate` supports
other `Located` reads when destination metadata is needed. `verifyPrimary`
discovers pool mappings and verifies incarnation/lifecycle/forward resolution.
Low-level `read(role, id, method, args)` also obtains its height automatically.

Every by-name lookup is root-keyed. `NameRef` includes generation and serial.
`Located<T>` is `'Absent' | { Local: T } | { Forwarded: Forward }`; the client's
routing helpers consume forwarding and return the final Local/Absent plus route.
Raw primary reads are distinct from verification. Commitment source IDs are
independent of name placement.

## Write builders

The naming rule is `<role><PascalCaseEntrypoint>Call(targetId, exactWireArgs)`.
For example, `storeCommitCall`, `storeRegisterCall`, `storeRenewCall`,
`storeMutateRecordsCall`, `storeSetPrimaryCall`, `storeClearPrimaryCall`,
`storeCreateSubnameCall`, `storeTakeBackSubnamesCall`, `storeRemoveSubnameCall`,
`vaultClaimReferralCall`, `storeBeginMoveCall`, `storeStageMoveRowCall`,
`storeFinalizeMoveCall`, and `storeCancelMoveCall`.

There is a builder for every public wallet action, including directory proposals,
acceptance/pause controls, preserving/replacing records, maintenance, marketplace
orders and refunds. System-only callbacks, initialization and receipt hooks are
represented in the ABI catalog but refused by `buildCall` as wallet actions.

`transferCall` maps `clear_records` to `update_authorities.clear_identity`.
Ancestor reassignment uses `reassignSubnameCall` and the same underlying entrypoint.
Marketplace listing/auction/offer acceptance use the verified driver's
`custody_intent` encoder inside store `transfer_and_call`. Other marketplace
actions submit the complete reviewed order. Refunds are account-level claims.

All builders deep-copy and freeze arguments. Calls carry `deposit` and
`gasLimit`; the Connect adapter rebuilds both before encoding. No action is
silently forwarded or retried after signing.

## Numeric and byte contracts

`Lux` is decimal text, other u64 values are `bigint`, smaller integers are
`number`, and byte fields are `number[]`. `wireValue` enforces exact fields and
bounds. `encodeJson`/`decodeJson` validate against generated JSON definitions;
the release's verified WASM driver performs canonical rkyv encoding/validation.
The host receipt's contract/metadata fields remain hex, as specified by Dusk.

Runtime sources live in `src/frozen`; generated inputs live in `scripts/frozen`.
The standalone committed event catalog is rebuilt by `npm run build`. Test-only
WASM and golden fixtures live under `tests/fixtures` and are never published.

## Protocol integration helpers

All of these are also exported from the root entrypoint:

| Family        | Helpers / types                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Names         | `normalizeNameInput`, `validateName`, `analyzeName`, `NameResult`, `NameStatus`, `namehashHex`, `rootLabelStatus`, `RESERVED_LABELS`                                                                                 |
| Pricing       | `quoteRegistration` (store/selected policy), `estimateRegistrationQuote`, `launchPolicyConfig`, `registrationPremiumSchedule`, `PREMIUM_WINDOW_DAYS`, `estimateRenewalQuote`, `referralRewardLux`, `formatLuxAsDusk` |
| Lifecycle     | `createRegistrationLifecycle`, `renewRegistrationLifecycle`, `registrationLifecycleStatus`, `blockHeightToUnixSeconds`, `blocksForSeconds`, block constants                                                          |
| Commit/reveal | `createRegistrationSecret`, `registrationCommitmentHex`, `registrationCommitWindow`, reveal-window constants                                                                                                         |
| Recovery      | `PendingNameReservation`, `ReservationStorage`, `ReservationStorageError`, list/upsert/remove/update-block helpers                                                                                                   |
| Records       | Definitions, `validateRecordValue`, `validateRecordInput`, `validateRecordSet`, `createRecordInput`, `createResolverRecord`, `applyRecordMutations`                                                                  |
| Principals    | `typedPrincipalFromWalletAccount`, `contractPrincipal`, authority derivation, claimable checks, Base58, key/label/short-value helpers                                                                                |
| Primary       | `client.verifyPrimary`, `primaryNameStatus`, `PrimaryNameStatus`                                                                                                                                                     |
| Runtime       | `createDuskDomainsRuntimeConfig`, explicit env/config types                                                                                                                                                          |
| Writes        | `checkPublicBalanceForWrite`, `WriteBalanceError`, `submitDuskDomainWrite`, `trackDuskDomainTransaction`, `DuskDomainTxState` / `TransactionState`, busy-state helper                                                |
| Indexer       | HTTP client/types, complete pagination, `waitForIndexerConfirmation`, `waitForIndexerWrite`                                                                                                                          |

Balance, transaction and confirmation helpers are also in `./writes`. Activity
labels/descriptions, user-facing error mapping and record-edit drafts are not
SDK exports. Validation returns codes and protocol state; the app owns wording.

### Projection checkpoint API

The `@duskdomains/sdk/projection` entrypoint exports `snapshotProjection(state)`
and `restoreProjection(snapshot)`. `projectReceipt` and `createProjector().apply`
mutate and return live state; the projector's `state` getter also returns that live
object. `checkpoint()` explicitly retains a completed block height, and
`rollbackTo(height)` requires an exact checkpoint (zero is retained initially).
`ProjectionState.receipts` is now a serializable `Record<string, true>`, and
`ProjectionOptions.retainEffects` controls history retention (default `true`).
Checkpoint schema version 2 includes incremental indexes and import row counts;
old snapshots must be rebuilt from receipts. See the
[indexer migration notes](./indexer-events.md#explicit-checkpoints-and-indexer-migration)
for persistence and reorg ordering.

Governance helpers `setAcceptsMovesProposalCall`, `setRetiringProposalCall` and
`setRecipientProposalCall` derive guards from current admission/config state.
`CONTROLLER_INTERFACE` identifies the controller marker ABI. See
[controller consent and governance guards](registration.md#controllers).

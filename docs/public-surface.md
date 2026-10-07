# Public surface in 0.3.0

The npm and JSR export maps contain the same seven entrypoints and target files.

| Import | Public API |
| --- | --- |
| `@duskdomains/sdk` | `createClientFromManifest`, `FrozenClient`, manifest/driver/transport helpers, exact frozen wire types, lossless JSON, name/authority/commitment derivations, write builders and gas policy |
| `@duskdomains/sdk/writes` | `buildCall`, all public write builders, `registrationCalls`, `transferCall`, `reassignSubnameCall`, `createMarketplaceCalls`, `GAS_LIMITS` |
| `@duskdomains/sdk/connect-app` | `createDuskDomainsConnectApp`, `ConnectWallet`, `ConnectApp`, `PreparedCall` |
| `@duskdomains/sdk/marketplace` | `createMarketplaceCalls`, order/custody/refund types and builders |
| `@duskdomains/sdk/event-catalog` | `indexerEventCatalog`, `duskDomainsIndexedEventTypes`, `EventTopic` |
| `@duskdomains/sdk/projection` | Receipt journals, projection, projected reads, digest helpers and event catalog |
| `@duskdomains/sdk/chain-addresses` | Ethereum, Bitcoin and Solana address validators; retained as public |

`./internal` and `./write-proof` are removed with the legacy clients. The old
`*_runtime` names, router/core/treasury presets, hand-written legacy wire shapes,
legacy marketplace hooks and event projectors have no frozen aliases.

## Canonical reads

`client.directory` and `client.vault` select the manifest's singleton roles.
`client.store(id)`, `.resolver(id)`, `.policy(id)` and `.marketplace(id)` select a
specific implementation. Methods use exact wire names, argument objects and
return shapes. The generated `ReadApi` provides compile-time argument/result
types. Unit reads take no arguments.

| Scope | Read families |
| --- | --- |
| directory | `config`, `registration_context`, `renewal_schedule`, `roles`, `member`, `members`, `allocation`, `market`, `proposal`, `proposals`, common interface/binding/capacity |
| store | `home`, `get_name`, `children`, `record_slot`, `read_record`, `read_records`, `resolve_record`, `read_primary`, `resolve_primary`, `pending_commitment`, `commitment_raw`, both quotes, slot liveness, move/import status, cooldowns, export rows, stats and common reads |
| resolver | `read_slot_record`, `read_record_slot`, stats and common reads |
| policy | `quote`, `config`, `interface_version`, `binding` |
| vault | `read_state`, `read_balance`, `read_referral`, `referrals`, `source` and common reads |
| marketplace | `config`, `wind_down_state`, `order_api_version`, `read_order`, `read_listing`, `read_offer`, `read_refund` and common reads |

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

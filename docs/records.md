# Records and primary names

Store records are pointers into resolver slots keyed by `(registry, node, epoch)`.
Read through `client.store(id).read_records(nameKey)` for pointer/digest-verified
raw records, or `resolve_record` for active-name resolution. `read_record_slot`
on a resolver requires the full registry-qualified slot. TTL is retained
metadata; `updated_at` is a block height. Expired records are not silently deleted.

Use `storeMutateRecordsCall` for Set/Clear batches, `storeReplaceRecordsCall` for
an explicit complete replacement, and `storeMoveRecordsCall` for preserving
records/TTLs/timestamps on a new resolver. Preserving movement requires the
old record snapshot to match the stored digest; verified event history can
supply it when the old resolver is unavailable. Logical clearing drops the
store pointer and never depends on the old resolver being online.

There are at most 16 records/name. Keys are 1–64 UTF-8 bytes, values 1–512 bytes,
TTL 1–86,400 seconds; mutation batches have 1–8 entries and at most 4,096 total
key/value bytes. Complete sets have at most 9,216 bytes. Duplicate keys reject.
Wire shapes use bytes directly, including the 96-byte `moonlight_address` value.

`storeSetPrimaryCall` binds a NameRef and endpoint. Setting requires endpoint
holder authority and a matching forward record. `storeClearPrimaryCall` binds
the endpoint and expected mapping ID and remains allowed after expiration or
during move preparation. Selecting another name across shards is two explicit
transactions: clear old, then set new. The second can fail after the first succeeds.

Use `client.verifyPrimary(endpoint)` for display/payment identity. It discovers
pool mappings, checks the current incarnation and lifecycle and verifies the
forward endpoint. Resolver failure is an error. `read_primary` returns a raw
mapping which can be stale, expired or forward-mismatched.

A whole-tree move transports every still-live raw mapping at activation,
including other endpoints' mappings, preserving endpoint/NameRef/timestamp but
assigning new local mapping IDs. A primary explicitly cleared during preparation
is never restored. Refresh mapping IDs before another signed clear.

## Record and principal helpers

`createRecordInput(key, value, ttlSeconds?)` creates a frozen registration or
replacement input; the store stamps its block height. `createResolverRecord`
additionally requires `updatedAt: bigint` and returns an observed `RecordValue`.
`applyRecordMutations(records, mutations, height)` is an atomic local simulation:
Set stamps the height, Clear is idempotent, untouched timestamps survive, and the
result is sorted by UTF-8 key bytes. It enforces count, byte, duplicate and TTL
bounds. It does not remove records when TTL elapses.

`getRecordDefinition`, `STATIC_RECORD_DEFINITIONS` and `validateRecordValue`
provide optional conventional text validation. Every definition respects the
512-byte frozen wire value ceiling (including website/service values, which
0.2 incorrectly allowed to reach 2,048 bytes). There are no edit drafts, labels,
visibility copy or wall-clock timestamps in these wire objects.

| Keys                                | Convention and encoding                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `moonlight_address`                 | Canonical compressed Moonlight account in Base58; validated as BLS and encoded as 96 bytes |
| `dusk_contract`                     | Nonzero 32-byte hex contract ID, encoded as bytes                                          |
| `phoenix_payment_endpoint`          | Opaque explicit receive-endpoint syntax, UTF-8; not proof of a wallet/identity             |
| `dusk_asset`                        | Opaque identifier, UTF-8                                                                   |
| `evm_address`                       | DuskEVM 20-byte hex, UTF-8                                                                 |
| `address.eth`, `address.evm`        | EIP-55 validation and normalization, UTF-8                                                 |
| `address.btc`                       | Mainnet Base58Check / Bech32 / Bech32m; normalize Bech32 case                              |
| `address.sol`                       | Exactly 32 decoded Base58 bytes; store its text                                            |
| `website`, `service_endpoint.*`     | HTTPS URL without credentials                                                              |
| `avatar`                            | HTTPS, IPFS or Arweave URI                                                                 |
| `content_pointer`                   | HTTPS/IPFS/Arweave URI or bare `bafy…` pointer                                             |
| `attestation_ref`, `compliance_ref` | HTTPS, `urn:` or `dusk:` reference                                                         |
| `text.*`                            | Nonblank UTF-8 text without control characters                                             |
| Other keys                          | Raw UTF-8 convention; all bounded keys are accepted                                        |

The resolver itself is key-agnostic. `validateRecordInput` and `validateRecordSet`
accept **arbitrary bounded keys and binary values**, regardless of the conventions
above. `validateRecordValue` and chain-address validators return issue codes for
the app to translate. No endpoint is made private by its key name.

`typedPrincipalFromWalletAccount` accepts a canonical compressed Moonlight account
or explicit `contract:<hex>`. `contractPrincipal(id)` constructs a contract
principal; `contractPrincipalFromWalletAccount` derives its frozen holder
authority. Bare 32-byte legacy values are ambiguous and are rejected rather than
inventing a Phoenix wallet. Uncompressed 193-byte public keys are also rejected.
`principalKey` matches the projection's `Kind:hex` keys; `principalLabel` returns
the protocol kind and `principalShortValue` abbreviates its bytes.
`hasClaimableReferrerShape` mirrors the protocol's cheap flags/limbs check;
`isClaimableReferrer` performs a full canonical curve/subgroup check. The contract
still decides effective referral eligibility.

`primaryNameStatus({ endpoint, primary, name, record, height })` evaluates an
observation with statuses `missing`, `stale`, `inactive`, `forward_missing`,
`forward_mismatch` or `verified`. Use observations from one snapshot; never map a
failed read to null. `client.verifyPrimary(endpoint)` performs the canonical
cross-store verification, and returns a verified result or null. UI titles,
tones and fallback address copy belong to the app.

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

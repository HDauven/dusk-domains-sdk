# Integration trust model and migration

The release manifest is the deployment trust anchor. Retrieve it from your
reviewed release channel; a matching hash verifies bytes against that manifest,
not its publisher. Every supplied driver digest and byte count is checked before
WASM instantiation. Interface kind/version, move/custody versions and common
network/directory/vault binding are checked against chain reads. Admission code
hashes are compared with manifest codeHash (or contractWasm.blake3) when supplied.
Future compatible code needs its own release-reviewed driver metadata.

Canonical reads go to the manifest's node. They obtain the current height
without a caller-provided callback and bracket multi-read operations with height
checks. A consistent node endpoint is required; same-height reorgs are not detected
by height alone. The indexer URL is configuration for consumers' search/history
queries; this SDK does not assume the legacy HTTP route schema. Indexed search
results must be revalidated on chain before payments or a newly signed action.

Permanent forwarding is root-keyed and monotonically increases admission ordinal.
All Located results follow with a hop bound. A failed destination read never
falls back to stale source data. Commitment reads and cleanup remain at their
original shard. After RootForwarded, invalidate name, slot, primary and order
caches and construct a newly reviewed/signed write for the new home.

Calls freeze reviewed arguments. Paid calls derive the exact deposit from those
arguments; wallet calls set transaction value zero. Connect always encodes
through a hash-verified driver and rechecks chain identity. A returned prepared
payload is inspectable, but submit takes the original call and prepares it again.
Order changes, deadline expiry, new generations and fee changes can reject a
previously reviewed call. No automatic re-signing, forwarding, settlement or
retry is performed.

The wallet integration is direct public Moonlight. A contract wallet must supply
its authenticated C2C adapter and preserve the protocol's immediate-caller
identity/payment rules. Gas policy is explicit, provisional and separated from
the refundable principal deposit. Included failures may consume the full limit.

## Upgrade from 0.2

- Replace hard-coded router/core/treasury IDs and drivers with a frozen manifest.
  Remove legacy contract aliases and `*_runtime` calls.
- Replace node-only identities with NameKey/NameRef. Keep generation, serial,
  resolver epoch, mapping ID and custody nonce as distinct fields.
- Read registration quotes through the current store/policy; read renewal
  economics from the directory. Preserve exact price, versions and deadlines.
- Replace marketplace escrow hooks with transfer-and-call and reviewed Terms/
  Order. Show delegation, old custody, pull refunds and ReturnPending separately.
- Replace reverse-display shortcuts with verified primary resolution. Across
  shards, clear old primary then set new explicitly.
- Rebuild index storage from deployment receipts with all event journals,
  physical resolver snapshots and staging history. Use one block snapshot for
  derived views and whole-transaction rollback.
- Replace the former indexer HTTP client with your new indexer's versioned route
  adapter. `client.release.manifest.indexerUrl` remains available for discovery.
- Replace loss-prone JSON handling with bigint-aware parsing/serialization.

Frozen testnet is a fresh deployment. Do not restore old names, commitments,
money or historical events into the new projection.

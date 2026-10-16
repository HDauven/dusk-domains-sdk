# Integration trust model and migration

The release manifest is the deployment trust anchor. Retrieve it from your
reviewed release channel; a matching hash verifies bytes against that manifest,
not its publisher. Every supplied driver digest and byte count is checked before
WASM instantiation. Future compatible code needs its own release-reviewed driver
metadata.

## Contract verification

A `FrozenClient` verifies each contract once, before it reads it:

- interface kind/version, move/custody versions and the network/directory/vault
  binding, against chain reads;
- for a store or resolver, the directory's admission (`member`), and for a
  marketplace, the directory's market record (`market`): interface version 1, and its
  code and init hashes against the release's `codeHash` (or `contractWasm.blake3`) and
  `initHash` when the release carries them. Discovery checks every admitted store
  and resolver and the preferred marketplace this way, and so does any later read;
- for a policy, whose admission no directory read returns, the init commitment
  recomputed from its live binding and immutable config, against the release's
  `initHash` and against the admission an `admitDirectoryEvent` supplies. Its code
  hash is compared with such an admission only: no read returns it;
- the directory and vault have no admission. The directory is the manifest's trust
  root. The vault is the one the directory and every verified contract's binding
  name, checked against the manifest's vault ID. The code and init of both rest on
  the reviewed manifest and the deploy tool's evidence: a contract ID derives from
  its bytecode, deploy nonce and owner, and only the owner can initialize it.

The Connect app signs only for a contract whose release descriptor carries both
`codeHash` and `initHash`, compared as above, and for the directory and vault. A
descriptor without them, such as one built from contract IDs and driver URLs alone,
is read but never signed for. The deploy tool's release manifest records both for
every contract.

Verification belongs to the client. A contract `resolveContract` supplies enters
`client.release`, the client's own copy of the release, only once every check has
passed. A contract verified inside a multi-read operation, such as discovery, becomes
signable only once that operation's reads committed at one height; an abandoned attempt
leaves nothing. A contract that fails a check against what the client read itself (the
directory's record or the contract) is refused by that client for good, with a
`ContractRefusedError`; recreate the client after the release is fixed. Evidence a
caller supplies, such as an admission event, that contradicts those reads is
rejected, and the contract stays as verified. A missing artifact or a contract the
directory has not admitted yet is not a refusal and is checked again on the next
read. Another client, even one built on the same release object, never changes this
client's decisions.

A contract's interface, binding, order API version and, for a policy, init commitment
never change once it is deployed. A client reads them once: an attempt it abandoned
checks them again from what it read, without new reads. The directory's admission and
market records, and all other state, are read from the chain every time.

## What the node can and cannot do

Dusk nodes return no state proofs, so the node a client reads from (the manifest's
`nodeUrl`, or the transport you pass) is a trust root for every read. A node that
lies can:

- show false state: names, owners, records, primaries, orders, refunds, prices and
  admissions;
- make verification pass for a contract whose state differs from its release
  commitments, by answering the reads that match them, such as a policy's reviewed
  config;
- make a client refuse a good contract, by answering a read that contradicts the
  release. The refusal belongs to that client: create a new client, after a reload
  or against another node, and it verifies again;
- withhold or delay answers.

It cannot:

- make the Connect app sign for a contract outside the reviewed release: contract
  IDs and commitments come from the release, never from a read;
- make the chain charge more than the user approved. A reveal's deposit is exactly
  its `expected_fee_lux`, which the wallet shows. At execution the store recomputes
  the quote with the policy the directory selects, and rejects the call unless the
  selection version, the policy's config version and the total equal the call's
  (`QuoteChanged`, `FeeMismatch`). A renewal binds its total and schedule version the
  same way. A quote's request hash binds it to placement and lifecycle off chain only;
  the chain recomputes those;
- move a name or custody without the authority and terms the store and marketplace
  check on chain.

So a lying node can make a signed call fail, or have the user approve a registration
at the price the wallet shows under terms they cannot otherwise check, such as a
policy's referral split. Read from a node you trust, and treat indexer rows the same
way.

## Reads

Canonical reads go to the manifest's node. They obtain the current height
without a caller-provided callback. Nodes answer reads at their tip only, so a
multi-read operation is bracketed by height reads, and a sequence that crossed a
block is read again, whether it returned or failed, up to three times. A failure at
an unchanged height is final. A client shares reads between its operations: a read
(contract, function and input bytes) made at the height it last saw is made once,
whether in flight or answered, and a failed read is not kept. An operation opens with
a height read that arrived before its first read was sent, possibly one in flight for
another operation, and closes with a height read sent after it began and after every
reply it used arrived, possibly the one it opened with. Each reply was then answered at
a height between the two, so equal heights mean one height. `snapshot` closes with a
height read sent after its operation settles, since that operation may read through
the transport itself. A consistent node endpoint is required; same-height reorgs are
not detected by height alone, and a shared reply is reused while the client sees the
same height. The indexer HTTP client uses the versioned [frozen projection API](indexer-http.md),
with explicit deployment and snapshot binding. Indexed search
results must be revalidated on chain before payments or a newly signed action.

Permanent forwarding is root-keyed and monotonically increases admission ordinal.
All Located results follow with a hop bound. A failed destination read never
falls back to stale source data. Commitment reads and cleanup remain at their
original shard. After RootForwarded, invalidate name, slot, primary and order
caches and construct a newly reviewed/signed write for the new home.

## Writes

Calls freeze reviewed arguments. Paid calls derive the exact deposit from those
arguments; wallet calls set transaction value zero. Connect takes a client's
`client.release` and encodes only for a contract that client verified against its
release commitments, through its verified driver, and rechecks chain identity. A
store `transfer_and_call` gives the name to its target, so Connect signs one only when
that target is such a marketplace and its custody intent decodes with that market's
driver to terms for the same store and name. It signs a `register` only for terms the
same client quoted through `quoteRegistration` or `prepareRegistration`: store, name,
years, selection and config version, and total, under the policy it read as the
directory's selection at that version. It signs `issue_reserved` only at a selection
and config version that client read. No other call needs the selected policy.
`registrationCalls` builds only from the unchanged quote object such a call returned.
`submit` checks all of this again immediately before `dusk_sendTransaction`, so a
contract the client refused while the wallet answered is never sent. A
returned prepared payload is inspectable, but submit takes the original call and
prepares it again. Order changes, deadline expiry, new generations and fee changes
can reject a previously reviewed call. No automatic re-signing, forwarding,
settlement or retry is performed.

The wallet integration is direct public Moonlight. A contract wallet must supply
its authenticated C2C adapter and preserve the protocol's immediate-caller
identity/payment rules. Gas policy uses measured VM workloads and admission
reserves, separately from the refundable principal deposit. Included failures
may consume the full limit; see the [gas policy](gas-policy.md) for coverage bounds.

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
- Use `createIndexerClientFromManifest` and implement the documented frozen
  HTTP v1 projection contract in the indexer; do not serve legacy rows under it.
- Replace loss-prone JSON handling with bigint-aware parsing/serialization.

Frozen testnet is a fresh deployment. Do not restore old names, commitments,
money or historical events into the new projection.

## Portable helpers from 0.2

Name, premium, lifecycle, commitment, persistence, principal, record and write
helpers are restored with frozen semantics. Structure and policy eligibility are
separate; one-character subnames and repeated interior hyphens are valid. The
local name analyzer has no mock registration list. Lux is decimal text and block
heights are bigint. Renewals enforce the ten-year horizon. Pending commitments
are scoped to chain/directory/original store/controller/hash, and storage write
failures are explicit. Legacy entries with no frozen shard binding are not
silently migrated.

Records use the ABI byte layout and block timestamps, including binary Moonlight
endpoints. Known key conventions are optional; raw bounded custom keys remain
valid. Principal parsing requires canonical compressed public keys or explicit
contract IDs; ambiguous bare authority bytes and uncompressed keys are refused.
Validation issues and transaction errors carry codes/data for the app to render.
No activity copy, primary-display copy or edit drafts were restored.

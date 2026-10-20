# Integration trust model and migration

The release manifest is the deployment trust anchor. Retrieve it from your
reviewed release channel; a matching hash verifies bytes against that manifest,
not its publisher. Every supplied driver digest and byte count is checked before
WASM instantiation. Future compatible code needs its own release-reviewed driver
metadata.

## Contract verification

A `FrozenClient` verifies each contract once, the first time an operation reads
through it. `createClientFromManifest` verifies the directory only, so a contract that
fails a check throws its `ContractRefusedError` from the first operation that reads
through it, and an operation that never does succeeds. `discover()` verifies every
admitted store and resolver, the vault and the preferred marketplace up front: call it,
or create the client with `{ eager: true }`, to check the whole deployment before use.
The Connect app throws an `UnverifiedContractError` for a target its client has not
verified, with the client's `ContractRefusedError` as its `cause` when it refused the
target. Verification checks:

- the release artifact: role, driver digests and byte count;
- interface kind/version, move/custody versions and the network/directory/vault
  binding: from the directory's record for a contract the directory probed when it
  admitted it ([below](#the-directorys-admission-as-proof)), else against chain reads;
- for a store or resolver, the directory's admission (`member`), and for a
  marketplace, the directory's market record (`market`): interface version 1, and its
  code and init hashes against the release's `codeHash` (or `contractWasm.blake3`) and
  `initHash` when the release carries them;
- for a marketplace, its order API version, against a chain read;
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
never change once it is deployed. A client reads those the directory has not proved
once: an attempt it abandoned checks them again from what it read, without new reads. A
policy's config, once it decoded and its init commitment is the release's, also answers the
state read of that config at its tip, so a quote reads it once.
With `verificationCache`, such as `sessionStorage`, a later client does the same with
what an earlier one read. An entry is bound to the release's chain, network and
directory with its commitments, the vault, the chain state the client's reads reach
(`transportNamespace` when given, else the transport's `namespace`: the node URL for the
default transport and `fetch`; a custom transport without a `namespace`, or a custom
`fetch`, which may send a node URL's requests anywhere, keeps and reads no entries), and
the contract's ID, role and release descriptor. A custom `fetch` must otherwise send each
request to its URL. It is written only for a contract whose verification committed. An
entry that fails a check is ignored, never a refusal: the contract is checked from the
chain instead. The directory's admission and market records, and all other state, are
always read from the chain.

The cache also keeps what the lens deployment check read, once both checks passed on chain
reads, checked again on every load, and the lens's health under the release and this SDK's
reply checks: each method's strikes, and when a tripped method or a deployment that failed
a check stops being held off, 10 minutes after it began. A client times its holdoffs on a
monotonic clock; one loaded from the cache holds off for what is left of it on the wall
clock, 10 minutes at most, and one ending later is written back ending then. A malformed
entry is ignored whole and written again. Within one JavaScript realm, updates of an entry
through one cache object run one at a time, each merging into the entry as it is (a strike
adds one to its count, a holdoff keeps the latest), so none undoes another; across realms,
health is best effort, and a cache operation that does not settle within a second ends the
client's use of the cache for it. Lens entries are bound as contract entries are, and to the lens entry's ID,
commitments and driver.

`verificationCache` is trusted for read correctness: an entry holding the facts a check
expects stands in for the chain reads, so whatever can write it can make a client read
through a lens misbound to another directory, which reply evidence does not catch. Lens data
never enters verification state or signable quote provenance (below); display quotes
(`previewRegistration`, `previewRenewal`) and write fields a caller supplies may rest on it.
Whatever can write a site's `sessionStorage` can already run code on its pages.

Storage is not the chain: whoever can write it can fill an entry with the facts a check
expects. So a contract verified from an entry serves reads only. Before the Connect app
signs for it, or for a call that names it (the policy a registration selects, the
marketplace a custody hand-off goes to), and before `quoteRegistration` or
`prepareRegistration` quotes under a policy, the client verifies it from the chain, with
the directory first, once per client. The chain's answer replaces the entry's: a
contract the chain contradicts is refused by that client, for reads too, and a quote is
never made under it.

The directory's records and binding vouch for every other contract, a probed one's
interface and binding included. So Connect signs for a contract only while the
directory, too, is verified from the chain and not refused by its client, and nothing is
read through a refused directory. A refusal is final for signing: every later or
concurrent preparation or submission stops at it with an `UnverifiedContractError`
whose `cause` is the refusal, the directory's for a contract it vouched for.

### The directory's admission as proof

Before the directory executes an `AddStore`, `AddResolver`, `SetPolicy`,
`SetMarketplace` or `SetPreferredMarketplace` (with a market), its `probe` reads the
contract's `interface_version` and `binding` and requires them to equal
`interface(kind)` and the directory's own binding; otherwise the action traps. Neither
can change later: every frozen contract answers `interface_version` with a constant of
its code, and sets its binding once, at init. The client verified the directory's
binding against the manifest's directory, vault and network, so a contract the
directory probed passes the client's interface and binding checks, and the client
does not read them. The directory's records show which contracts it probed:

- a store or resolver admitted at ordinal 1 or more: `AddStore` and `AddResolver`
  admit only at the next ordinal, and the directory's init admits ordinal 0;
- a market record past version 1: only `SetMarketplace` writes one, probing the market
  each time;
- the preferred marketplace while the directory's market version is past 1: the last
  `SetPreferredMarketplace` selected it, probing it;
- the selected policy while the directory's policy version is past 1: the last
  `SetPolicy` selected it, probing it.

The directory's init probes nothing. The vault, the store and resolver at ordinal 0,
the init's policy (policy version 1), a market record at version 1 (which may be the
init's) and the directory itself are checked against chain reads, once per client and,
with `verificationCache`, once per cache. The probe does not read a marketplace's order
API or check a policy's init commitment, so the client still does: the order API
against a chain read, and a probed policy's init commitment over the directory's
binding and the config it reads. The code and init hashes in the directory's record are
governance's claims, compared with the release as before: no read shows a contract's
code. This rests on the directory running its reviewed code, which its ID derives
from, and on a deployed contract's code never changing.

It also rests on a node that answers consistently. For a contract the directory probed,
the record replaces the client's own `interface_version` and `binding` reads of the
contract: a node misreporting the record alone (an init store's ordinal as 1, or a
policy, market or preferred-market version past 1) now passes a contract whose interface
or binding it would otherwise also have to misreport. A node is a trust root for every
read either way ([below](#what-the-node-can-and-cannot-do)); this only narrows what a
node that lies about some reads and not others must say.

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

Canonical reads go to the manifest's node. They obtain the current tip without a
caller-provided callback: the default transport reads the tip block's height and hash
in one request (`currentBlock`), and a custom transport may read the height only. Nodes
answer reads at their tip only, so a multi-read operation is bracketed by tip reads, and
a sequence that crossed a block is read again, whether it returned or failed, up to
three times. With block hashes, a block that replaces the tip at the same height is a new
tip too. A failure at an unchanged tip is final. A client shares reads between its
operations: a read (contract, function and input bytes) made at the tip it last saw is
made once, whether in flight or answered, and a failed read is not kept. An operation
opens with a tip read that arrived before its first read was sent: one that arrived less
than `heightReuseMs` ago (1000 by default; 0 reads a new one every time), or one in
flight for another operation, or a new one. It closes with a tip read sent after it began
and after every reply it used arrived, possibly the one it opened with. Each reply was
then answered at a tip between the two, so equal tips mean one block, and that block was
the tip while the operation ran however old its opening read was: the window only
decides how often a first attempt opens at a tip the chain has already left. A view the
lens answers in one query needs no tip read ([below](#the-read-lens)). Such an
attempt is read again at the new tip and is not one of the three. `snapshot` closes with
a tip read sent after its operation settles, since that operation may read through the
transport itself. A consistent node endpoint is required. By height alone, a block
replaced at the same height is not seen, so such a client shares an answered read with
another operation only while it is younger than `heightReuseMs` (with 0, only a read
still in flight). The indexer HTTP client uses the versioned [frozen projection
API](indexer-http.md), with explicit deployment and snapshot binding. Indexed search
results must be revalidated on chain before payments or a newly signed action.

Permanent forwarding is root-keyed and monotonically increases admission ordinal.
All Located results follow with a hop bound. A failed destination read never
falls back to stale source data. Commitment reads and cleanup remain at their
original shard. After RootForwarded, invalidate name, slot, primary and order
caches and construct a newly reviewed/signed write for the new home.

A route reads the directory's admission of each store it reads through, at the
operation's height, and checks each forward against them: the destination admitted at
the forward's ordinal, ordinals rising, no store twice. A hint, such as the indexer's
home store for a name or primary (`homeShard`) passed to `getName` or `verifyPrimary`,
or the store a `Located` read, `locate` or `quoteRenewal` starts at, is not trusted: it
is only where the client looks first. The client accepts what it finds there only when
the chain leads from that store to a `Local` home over forwards that pass these checks.
Anything else (an `Absent` or staged home, a store the directory does not admit or the
client refused, a malformed hint, a failed read) sends the search to every admitted
store in admission order, as without a hint. A wrong or lying hint so costs reads, never
the answer. Two answers rest on the protocol's uniqueness rather than on every store's
answer: a name found at its hinted home (a root has one canonical home), and a primary
the hinted store verifies (`set_primary` refuses an endpoint another admitted store
links). Without a hint, `verifyPrimary` asks every store and rejects two verified
primaries.

Some answers need every store, and still read each one: a name no store holds (absence),
a primary without a hint, `registrationPlacement` and `prepareRegistration` (signing a
registration needs an existing root's home, and proof that no store holds an unseen
one), and `discover()`. `previewRegistration` shows a quote without that, from the
store the hint or the directory's newest store names: `quote_registration` checks
placement against every admitted store on chain, and refuses a root it would not
register there, which sends the preview to the full placement. It is for display only:
`registrationCalls` and Connect take only a quote `quoteRegistration` or
`prepareRegistration` returned.

### The read lens

A release may have a read lens: the manifest's top-level `lens` entry, pinned like a
`contracts` entry by `contractId`, `codeHash`, `initHash` and its `dataDriver` (in
`contracts`, SDKs before the lens reject the unknown role). With one, the client
answers `getName`, `resolve`, `verifyPrimary`, `namePage`, `previewRegistration`,
`pricing` and `bootstrap` with one contract query each: the lens reads the directory,
every store and the policy inside that query, at one state root. Without one, or with
`useLens: false`, every read is direct, as above, and the lens driver is never fetched.
Nor is it for an entry without `codeHash` or `initHash`. A lens driver that cannot be
fetched leaves the client reading directly; bytes other than the entry pins fail the
release, as for every driver.

The lens's ID-to-code mapping rests on the manifest, exactly as the directory's and the
vault's: no read returns a contract's code, and the deploy tool derives the ID from the
reviewed WASM, nonce and owner. The client checks the rest once, on its first lens read
or from its `verificationCache`:
`initHash` is the init commitment of `InitLens { directory }` over the release's
directory with the entry's driver, and the deployed lens's `binding` and
`lens_interface`, read one after the other, are the release's directory, vault and network
and lens v1 with the pool's bounds. A lens that fails a check is held off for 10 minutes.

Each reply is decoded with the verified driver against strict schemas. A view it answers
reads no tip: one contract query reads one state, and its reply reports that state's
height, which is the view's (on Rusk the lens's `block_height()`, the tip the node read).
The client uses a reply only at or above the highest height it has seen, from a tip read
or a reply it used; one below it, or a request the lens refused at that height, is read
again in a snapshot bracketed by tip reads and used only at that snapshot's height, so a
node whose tip went back is read at its tip. Each view sends its own query.

A reply reports no block hash, so a block that replaced the one a query read, at the same
height, while it ran is not seen: that view shows the replaced block, the tip while its query
ran, and the next view the new one. No reply is kept to answer another read, and lens data
never enters verification state or signable quote provenance. Display quotes
(`previewRegistration`, `previewRenewal`) and write fields a caller copies from a reply may
rest on it: read those again directly, or quote again, before signing.
The fix is a node that reports the height and block hash a query ran on.

A reply is used only if it passes these checks:

- every admitted store, in admission order, up to the highest ordinal the client saw at
  or below the reply's height, in a committed direct snapshot that read the directory's
  member list (public or internal; a single `member` admission counts only beside it) or
  an accepted lens reply; and each
  resolver whose records it read: a contract the release lists in that role, at
  interface version 1, with the release's code and init hashes and those the client
  verified it with, and not one the client refused;
- routes over listed stores at rising ordinals from a start below the first hop, and a
  record only for an active name with a record slot, whose resolver is listed;
- the selected policy's whole config, whose init commitment over the release's binding
  is the release's `initHash`, and the policy the client last read at that selection
  version (a committed registration-context or directory-config read, or a quote); the
  allocation and newest store as the directory derives them, from the last admissions;
- for a name page's own primary, everything `verifyPrimary` checks against the page's
  name;
- for `previewRegistration`, a registered root's own name in its lifecycle, a placement
  consistent with the listed admissions, neither stop flag set, registration open, a
  label that is not denied, and the price recomputed from the committed config. Only the
  published v1 policy's pricing is known to the SDK: under another, `previewRegistration`
  and `pricing` read directly.

The lens checks the interface and binding of what the directory did not probe (the
store and resolver at ordinal 0, the vault, a genesis policy or market) in the same
query, as the client would. A hint is passed to the lens, which reads every store
anyway: it only orders the lens's reads.

Anything else (a refusal, a failed query, a reply that does not decode, is at another
height or fails a check) sends that call to the direct reads, never to part of the reply,
and is reported to `onLensFallback` with its reason. A failed deployment check holds the
lens off for 10 minutes, and three decode or evidence failures of one method without a lens
answer in between hold that method off for 10 minutes (`disabled` says so), across the
clients of a `verificationCache`; no other failure holds anything off. A reply that misses a
store only this client's observations require, or rests on a policy whose pricing the
SDK does not know (`unsupported`), adds no such failure. A request the lens refused, in
its reply or inside it (a page's primary), is read directly at that height, and a refusal
for lack of resources (`GasBudget`, `ReadFailed`) makes that method read directly for
30 s in its client; no refusal turns anything off.

A lens read the node rate-limits (429, or 503 with `Retry-After`) is sent again after the
wait the node names, 1 s if none, and never after one over 10 s, however large; an HTTP
date counts from the reply's own `Date`. A call has three retries in all, its deployment
check, query and snapshot attempts together, then fails with that error rather than
multiply the node's load with direct reads: a view sends at most 8 lens queries, 2 more
for its client's deployment check, and 4 tip reads, and waits
at most 30 s. The HTTP transport makes its error from the status and headers, quoting at
most 512 bytes of the body that arrive within 250 ms.

The lens adds no trust in the node. What its evidence cannot show, the reviewed lens
checked on chain, and a node that lies can answer either way, as it can a direct read:

- stores past the highest ordinal the client saw (a fresh client cannot tell a shortened
  list), where a route started (only that a start exists below its first hop), and the
  current flags and versions of the admissions and config `bootstrap` reports;
- for a primary whose name the reply does not carry (`verifyPrimary`, or a page's
  primary for another name), the name's lifecycle, holder and incarnation, its home, and
  which listed resolver its record came from;
- for a registration, which store holds a registered root, the placement store's
  capacity, and a released root's lineage beyond what its request and admissions show;
- a renewal schedule reported together with prices derived from it, which a
  `previewRenewal` price shows too, and the selected policy before the client has read
  the selection directly;
- the store ordinals a client sees: a node that reports a higher one beside a member
  list raises the mark, and lens replies then read directly, which costs reads and is
  safe.

What signing takes from the lens is exactly this:

- lens replies never enter the verification ledger, the verification cache or quote
  provenance: the Connect app signs only for contracts this client verified directly
  (verify a write's target with `verifyContract`, or a direct read through it);
- registration quotes for signing come only from direct store quotes
  (`quoteRegistration`, `prepareRegistration`); a lens quote, like any
  `previewRegistration`, is for display;
- every call builder refuses an argument holding an object a lens `bootstrap()`
  returned, and the governance proposal builders refuse its admissions and config, as
  defense in depth for operator actions: build proposals from direct reads
  (`discover()`, `client.directory.member`, `client.directory.config()`);
- `previewRenewal` computes a renewal price from a name page this client returned only
  where it is exactly the home's `quote_renewal` at the page's height (a root with no move
  pending, years within the page's horizon, a home of the published v1 store's code), and
  quotes directly anywhere else; every builder refuses what it returns, so a renewal is
  signed from `quoteRenewal`;
- any other value a caller passes into a builder is the caller's responsibility, exactly
  as with a direct read: the node vouches for both alike, and Connect checks contracts and
  quotes, not where an argument came from.

Before signing a write about a name the user only saw through the lens, an app should read
it again directly: `await client.store(page.store).get_name(page.key)`, since the
per-contract read scopes never use the lens (as `quoteRenewal`, `locate`,
`quoteRegistration` and `prepareRegistration` do not), or a client created with
`useLens: false`.

### Batched reads

The client sends the contract reads it makes in one tick, before the next task runs, as one
query of [Multicall for Dusk](https://github.com/HDauven/dusk-multicall) v0.1.0 (`aggregate`), at
`MULTICALL_CONTRACT_ID` on mainnet and testnet: its reviewed Wasm, deployed with nonce 0, which the
ID derives from. It is on by default where that deployment is, for a mainnet or testnet release
(network 1 or 2) read through the transport the client builds from the manifest's node URL. Elsewhere,
and through a custom `transport`, it batches only with `multicall: true` or a contract ID, and
`multicall: false` sends every read as its own query. The query goes out at the next task, which a
background tab does not hold back as it holds timers. The multicall runs each call as a sub-call, all in one session at one state,
and returns each callee's reply bytes or error with the height of the block whose state the query
read. Each read decodes its reply with the release's driver, as a direct read does. The multicall adds
no trust: it holds no state, refuses every caller but a query, and its answers are the node's, as a
direct read's are. Identical reads in one tick are one call.

Gas. A query has Rusk's 3e9 bound, and a call with a cap of 0 gets a fair share of what is left. On
testnet every frozen read takes at most 131k gas, far below any share, except a store's
`quote_registration`, which prices only with more than 60M left: it gets 80M. A lens view shares its
gas among the reads it may still make and refuses with `GasBudget` below 1M a read; it gets its
reads × 4M + 30M (`resolve` 390M, `reverse` 842M, `name_page` 1.114e9, `availability` 590M,
`bootstrap` 110M, `pricing` 46M), so each nested read gets at least 2M, and an availability check's
store quote its full 500M, as in a direct query. Capped calls go first, at most 2.5e9 of caps a query,
so a fair share is still at least 1.9M a call when each spends its whole cap. A call that runs out of
gas anyway is sent again alone, and so is a lens view a batch left refusing for want of gas.

Limits. A query takes at most 256 calls and an envelope of 64 KiB, and is planned for 60,000 bytes of
replies, from the largest reply each function returned so far (2 KiB before one did). A query whose
replies pass 64 KiB fails whole.

Heights. A read that alone makes up an operation, a contract read scope's other than a routed
`Located` read or `home`, takes its height from the query and reads no tip: one query reads one
state, as a lens view does. Its answer is used only at or above the highest height the client saw;
one below is read again between tip reads. A multi-read snapshot keeps its tip reads, and each batched
reply it uses must report the attempt's height: one that reports another shows a block landed, or a
node that went back, and the snapshot is read again at once. A query reports no block hash, so a block
replaced at the same height shows only in the closing tip read, as without batching.

Reads made again. What 0.4.1 answers from a reply it shared at a tip it saw within `heightReuseMs` is
answered so, between tip reads, with no query: a read made again within it reads one tip, and
concurrent ones share it. A one-query reply is kept for that too, by its height alone, as a reply a
transport without block hashes reads is: only for the same read made alone, at that height, within
`heightReuseMs`, and forgotten once the client sees another block at that height. No multi-read
snapshot takes one; it shares only replies read between its tip reads. A block replaced at that height
before the client saw either, and within that window, is the one change such a read can miss, as a
one-query read can.

Lens deployment. Batching, the lens deployment check's two reads go out with the directory's
verification, in its query, unless the check would read nothing (its facts kept, the lens off or held
off); the check takes their replies only once the directory verified, and reads for itself what no
multicall answered. A cold page's lens view is then its second query.

Failures. A call that fails fails its read as a direct query would: a callee's panic, a missing
contract or function, with a `NodeReadError` of status 500, as public nodes answer a direct read that
fails. The message names the callee's error (`DuskDS:v1:<code>`), which a public node's direct reply
hides; nothing in the SDK depends on it. A reply past 32 KiB fails as the HTTP transport fails a direct
one. Such a failure is the read's answer at its query's height, held to it as a reply is: one below what
the client saw is read again between tip reads, and in a snapshot one from another height reads the
snapshot again. A read outside any snapshot, such as a contract's verification, uses no reply or failure
from below what the client saw: it is sent again as one direct query, as 0.4.1 sends it. The client takes only a reply that is exactly what rkyv writes, each result's bytes
claimed once and in order, and reads a reply no further than its bound. A query the node rate-limits (429, or 503 with `Retry-After`) fails each of its reads with that
status and wait, as one direct read: a lens view sends its query again after the wait, three times a
call, and any other read fails; none is sent alone, which would multiply the load. Any other failure
of the whole query, such as an error page, a reply that does not decode or a chain without the
multicall, sends its reads again one query each, and a second in a row turns batching off for 5
minutes. The tab keeps that count in `sessionStorage`, under a key derived from the node's URL and the
multicall's ID, so a broken multicall costs a tab two failed queries in all: the record holds only when
it ends and why (one failure, or the holdoff), and expires with it. Where storage is missing or throws,
each client counts its own. `onMulticallFallback` reports each. What verification and
`verificationCache` keep is the same either way: the same facts, from the same replies.

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

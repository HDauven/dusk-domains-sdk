# Integration trust model

Contracts are canonical for ownership, lifecycle, records, orders and funds.
The indexer provides discovery, history and derived warnings.

## Client behavior

`createDuskDomainsClient({ onChain, indexer })` combines the sources:

- `resolveName` tries the on-chain client first. A contract-read or missing-height
  failure can fall back to indexed resolution. Inspect `result.value.source.kind`;
  indexed fallback is not canonical proof.
- `getName`, `getNameOwner`, `getRecord`, `getPrimaryNameOnChain` and
  `verifyPrimaryNameOnChain` require the on-chain client.
- Search, lists, activity and dashboards require the indexer. Array-returning list
  methods read one page; use the indexer's page methods or scoped complete-set
  helpers for further results.
- `checkIndexer` checks health, API/event schema, routes, deployment binding,
  SQLite schema when present, lag and history. A degraded/partial-history status
  is distinct from full compatibility even when `ok` is true.

The direct client needs `currentBlockHeight` for active routing and primary-name
verification. Stored ownership can survive expiry; an owner lookup alone does not
prove the name is active. For signing, check the exact current contract state and
height. Display a primary only after typed forward/reverse verification.

## Exact lookups and verification

Exact indexer lookups reject responses whose identity differs from the normalized
request. Name, fixed-sale, auction and offer responses bind the node to the
canonical namehash; offers also bind the buyer. Commitment, refund and referral
lookups bind their keys. A single record response binds its record key; that HTTP
shape carries no node, so it cannot establish which node stored the value.
Structured reverse responses bind the endpoint and namehash; legacy bare-name
responses require a matching indexed forward record. These checks establish
request consistency, not canonical truth. Lists and history remain discovery data.

`verifyIndexedName(indexed)` requires canonical state and current block height.
Its verified verdict covers only `canonicalName`, recomputed `node`, `owner`,
`manager` and lifecycle `status`. Both authorities must be present. Status is
`active` before expiry, `expired` from expiry until grace ends, and `released`
from the end of grace. A verified expired/released summary is not an active name.
Records, expiry timestamps, primary names, counts, namespace and provenance
metadata are outside that verdict.

`verifyIndexedResolution(expectedName, response, key?)` requires an independent
caller-supplied name. It recomputes that name's node, compares both identities and
the selected record key/value with canonical active resolution, and marks only
those fields `indexed_verified`. Other records and indexed metadata are outside
the verdict. A substituted genuine name never verifies for the requested name.

## Registry routing

Located registries are cached only after a routed read, preparation or write
succeeds. Failures invalidate that route. The cache belongs to the transport and
is keyed by its current `chainId`, router and node, with at most 256 entries per
transport. Expose the current chain ID on `DuskConnectAppLike` (or the transport
passed to `createDuskDomainsConnectApp`); without it, routing remains uncached.
Router IDs must contain all 32 integer bytes and must be nonzero.

## Offer acceptance

Read the canonical offer with the marketplace client's `getOffer(node, buyer)`
before review. Capture its `offerId`, `feeBps` and `amountLux`, and pass them as
`expectedOfferId`, `expectedFeeBps` and `expectedAmountLux` to
`coreAcceptMarketplaceOfferRuntimeCall`. Retain that snapshot through signing;
refreshing it silently would accept terms the seller did not review. The contract
rejects any changed term, including an identical-price replacement in the same
block. IDs and fees are decoded as safe integers; monetary reads remain `bigint`.
The new fields require matching core/marketplace data drivers and deployment ABI.

## Manifests

`createDuskDomainsClientFromManifest` accepts a manifest or manifest URL, optional
Dusk Connect `app`/read transport, indexer URL and `currentBlockHeight` reader.
Validation requires router, core and treasury metadata, contract IDs, artifact
descriptor shapes and required method names. It does not fetch and hash driver
bytes, verify deployed bytecode or perform the indexer compatibility check for you.
The generated contract map contains router, core and treasury; marketplace setup
uses its own configured preset.

Call `checkIndexer()` explicitly for indexed confirmation. Validate deployment
provenance and driver bytes through your release process. The lower-level clients
can be used without a manifest; they do not reject startup merely because it is absent.

## Shared projection

`@duskdomains/sdk/projection` normalizes decoded event payloads and applies them
to in-memory state. The operator supplies finalized order, deduplication,
provenance, persistence and HTTP serving. Raw data-driver/RKYV decoding precedes
normalization. An indexed warning or balance is not authorization to mutate or claim.

See [examples](examples/direct-onchain-reads.md), [events](indexer-events.md),
[HTTP contract](https://github.com/HDauven/dusk-domains-indexer/blob/main/docs/indexer-api.md) and
[artifact tooling](https://github.com/HDauven/dusk-domains-protocol/blob/main/docs/public-integration-release.md).

## Marketplace review bindings

Canonical auction reads expose `auctionId`, `durationBlocks`,
`startDeadlineBlockHeight`, `createdAtBlockHeight`, `feeBps` and the current
bidding state. Compare the auction ID and immutable terms against the indexer
before review, then retain the reviewed identity and chosen bid amount through
signing. Display the canonical highest bid and end height as current information;
an intervening bid does not invalidate the review. The contract accepts the exact
chosen amount if it meets the current minimum and the auction remains open.
`marketplacePlaceBidRuntimeCall`, settlement, auction cancellation and expiry
require `expectedAuctionId`. Settlement is available only after the auction ends,
when further bids cannot change its outcome.

Fixed-sale reads expose `saleId`, `feeBps` and `openedAtBlockHeight`. Purchase,
cancellation and expiry require `expectedSaleId`. Offer cancellation and expiry
require the `expectedOfferId` returned by the canonical offer read. Do not replace
reviewed IDs with newly read IDs during confirmation.

The helpers encode these fields into the contract call and display them in wallet
context. Auction and sale IDs are also retained in all corresponding decoded
events and indexed rows. IDs use positive JavaScript safe integers, matching
offer IDs; missing, zero or inexact IDs fail closed. The ABI requires the
coordinated marketplace redeploy.

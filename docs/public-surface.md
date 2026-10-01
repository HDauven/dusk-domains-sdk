# SDK surface

[package.json](../package.json) defines these exported entrypoints:

| Import | Use |
| --- | --- |
| `@duskdomains/sdk` | Combined/direct/indexer clients, namehash, records, principals, manifests and projector helpers. |
| `@duskdomains/sdk/writes` | Runtime-bound call builders, encoding, preparation, submission and confirmation. |
| `@duskdomains/sdk/marketplace` | Fixed-sale, auction, offer/refund builders and indexed models. |
| `@duskdomains/sdk/connect-app` | Dusk Connect app adapter without a runtime wallet-library dependency. |
| `@duskdomains/sdk/event-catalog` | Plain JavaScript event families and contract topics. |
| `@duskdomains/sdk/projection` | Plain JavaScript projection, decoded-event normalization and reserved-name policy, with types. |
| `@duskdomains/sdk/write-proof` | Write-proof capture helpers. |
| `@duskdomains/sdk/internal` | First-party lower-level helpers; not a stable third-party API. |

Browser wallet runtime creation and local wallet shims are repository-internal.
The package does not export `connect` or `local-dev` subpaths.

## Reads and writes

Start with [direct-read examples](examples/direct-onchain-reads.md) and the
[trust model](integration-trust-model.md). The indexer client's `*Page` methods
expose named arrays and `nextCursor`. Array-returning methods return one page.
`getAllNames({ owner, maxItems })` and `getAllSubnames(parentNode, maxItems)`
traverse scoped collections with a hard 10,000-item cap and fail on overflow or
non-advancing cursors. See the [HTTP API](https://github.com/HDauven/dusk-domains-indexer/blob/main/docs/indexer-api.md).

Write builders produce call metadata; the configured wallet/transport signs and
submits it. Paid builders derive exact deposits and reject Lux values above
`Number.MAX_SAFE_INTEGER`. Canonical marketplace reads retain `u64` as `bigint`.

`coreRenewRuntimeCall({ node, durationYears, feeLux })` accepts any direct Moonlight
payer; no owner or manager credential is required. It extends a root before grace
ends, including during grace and for contract-owned names. It preserves ownership,
records and primary names, and extends inheriting subnames. Subnames cannot renew
independently. The event actor is the payer, and the stored referrer retains the
usual renewal share. Names owned or managed by the pool marketplace must leave escrow
before renewal; `userFacingErrorMessage` explains that the listing must close first.

Each registry permits 16 pending reservations per controller. A commit removes
that controller's expired commitments first; the reveal window includes age 8,640
blocks. `userFacingErrorMessage` explains the cap and points users to My names.
Reserved labels apply only to root names; subname preflight permits reserved words
under ordinary, transferred and operator-issued parents.

The call surface includes `corePruneSubnameRuntimeCall({ node })` for expired
subtrees, `routerIssueReservedNameRuntimeCall({ node, label, owner, manager,
durationYears })` for router-operator issuance, and the two pause setters
`routerSetRegistrationsPausedRuntimeCall({ paused })` and
`marketplaceSetTradingPausedRuntimeCall({ paused })`. Runtime caller authority
remains enforced by contracts. [Operator handovers](operator-handover.md) require
acceptance by the proposed operator; treasury also changes its payout recipient.

For referral input, await `isClaimableReferrer(principal)` for full Moonlight
curve/subgroup validation. It lazily loads Noble. Builders and wire encoding use
the synchronous `hasClaimableReferrerShape` predicate matching the contract's
structural check. Structurally valid off-curve points pass that cheaper boundary.
Failed full validation leaves attribution inactive in the frontend.

## Projection

```js
import { createProjectionState, applyProjectionEvent, normalizeObservedEvent }
  from '@duskdomains/sdk/projection'
```

The caller supplies event order, deduplication, `meta.eventId` and observation
time. Activity uses supplied event/observation time; replay time is not invented.
`createLifecycleEventProjector` exposes getters over the same state engine; its
subname getters use wall-clock expiry. Servers can derive reads at a confirmed
chain height from mutable projection state. [Event semantics](indexer-events.md)
are shared by the standalone indexer.

## Source and versions

`src/core` owns name rules, `contracts` call/wire shapes, `client` public clients,
`onchain` canonical reads, `indexer` HTTP clients/types, `projection` shared
JavaScript state, `runtime` configuration/manifests, `wallet` adapters, `writes`
submission and `proof` proof helpers. Root files are entrypoint facades.

SDK package version, contract deployment/source commit, artifact manifest and
indexer revision are independent compatibility boundaries. A package version
alone does not select a deployed contract. The build regenerates
`src/indexer/events/indexerEventCatalog.mjs` from its TypeScript source; that file
is committed for raw archive installs. LICENSE defines package licensing;
manifest package labels do not prove publication of separate artifact/client packages.

# Integration Trust Model

Status: public beta integration guidance
Owner issue: [#127 Public integration release boundary and artifact strategy](https://github.com/HDauven/dusk-names/issues/127)

Dusk Domains exposes two read paths. They are intentionally different.

## Read Paths

| Path | Use | Trust level |
| --- | --- | --- |
| Direct on-chain reads | Known-name checks, ownership, records, primary-domain verification, fee config, treasury/referral preflight. | Canonical contract state. |
| Indexer reads | Search, My Domains, subdomain lists, activity, record history, recent-change warnings, dashboards. | Derived read model. |

The indexer exists so wallets, explorers, and apps can build useful product surfaces without scanning contract events themselves. It is not the source of ownership, record authority, payment routing, referral claimability, or treasury claimability.

## Value-Bearing Rule

Before a flow asks a user to sign or treats a mutation as final:

1. Check the configured indexer health when using indexed state.
2. Direct-read the relevant contract state when the read is about ownership, a record value, a primary domain, a fee, or a claimable balance.
3. Prefer the direct read if it disagrees with the indexer.
4. Fail closed if the direct read is unavailable and the action depends on value-bearing state.

Examples:

- Search may use the indexer for availability, but purchase preflight should direct-read the registration state and fee config.
- My Domains may use `GET /names?owner=...`, but record edits should direct-read the selected name owner/manager before preparing the transaction.
- Referral and treasury pages may show indexed balances, but claim flows should direct-read claimable state before signing.
- Primary-domain display must verify reverse lookup plus typed forward record equality before showing the name as trusted.

## Public Package Boundary

Public beta integrations should start from the release manifest, not copied env files:

```text
manifest.json
method-manifest.json
call-examples.json
package-manifest.json
contracts/*.datadriver.wasm
```

The manifest binds:

- network and chain ID;
- core and treasury contract IDs;
- data-driver hashes;
- method signatures;
- event schema version;
- SDK version;
- source commit.

The public SDK can use that manifest to create:

- an on-chain read client for canonical known-name checks;
- an indexer client for discovery and dashboards;
- a combined client that chooses the safer path per method.

## Third-Party Indexers

A third-party indexer can be correct without running the official hosted service if it:

1. Starts from the same release manifest and data-driver WASM hashes.
2. Decodes DuskDS contract events into the documented event envelopes.
3. Stores an append-only event ledger with block, transaction, and event ordering metadata.
4. Replays from the deployment height or a retained archive-node snapshot window.
5. Exposes the documented `/health` contract and route manifest.
6. Marks reads unsafe when replay, cursor, checkpoint, lag, or schema evidence is missing.

The project indexer is the reference implementation for public beta, not a privileged source of truth.

## SDK Behavior

Recommended client behavior:

- `resolveName(name, key)`: direct-read when an on-chain transport is configured; otherwise return indexed data with lower confidence.
- `getNameOwner(name)`: direct-read by default.
- `verifyPrimaryName(endpoint)`: direct-read reverse and forward records when possible.
- `listNames({ owner })`: indexer-backed discovery.
- `getActivity(name)`, `getRecordHistory(name, key)`, `getSubnames(name)`: indexer-backed history/discovery.
- `checkIndexer()`: required before using indexed state for final UI confirmation.

If only the indexer is available, the SDK must make that confidence level visible to the caller. It should not silently present indexed state as canonical.

## Failure Handling

| Condition | Expected behavior |
| --- | --- |
| Indexer unhealthy | Keep browsing possible if useful, but hide final value-bearing success states. |
| Indexer and contract disagree | Prefer contract state and report stale indexed state. |
| Direct read unavailable | Block signing for flows that need ownership, fee, record, primary, treasury, or referral proof. |
| Missing release manifest | Refuse public integration startup. |
| Mismatched data-driver hash | Refuse contract calls and event decoding. |
| Missing archive/replay evidence | Allow discovery only with degraded confidence; do not use indexed state as final proof. |

This split keeps Dusk Domains usable for product UX while preserving the contract as the canonical protocol state.

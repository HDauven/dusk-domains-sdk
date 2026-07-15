# Dusk Domains Standard

Status: MVP baseline

This standard defines the boring core that Dusk Domains should implement before product-specific identity, verification, or private-record features are added.

Architecture decision: [ADR 0001: DuskDS-Native Core Architecture](adr/0001-duskds-native-core.md).

## Design Goals

- Keep canonical ownership and resolution state on DuskDS.
- Keep ownership, registration policy, resolver records, and reverse lookup as distinct responsibilities even when they live in the same deployed core contract.
- Treat Dusk endpoint types explicitly; do not flatten Moonlight, Phoenix, contracts, assets, and external addresses into one generic address record.
- Make public-record visibility obvious in wallets, explorers, SDKs, and the web app.
- Preserve forward/reverse primary-name verification as a hard display rule.

## Core Architecture

The MVP core is implemented as two DuskDS-native contracts:

```text
DuskDomainsCore
  Canonical name/node lifecycle
  Registration, renewal, commit/reveal, reserved labels
  Owner and manager authorities
  Typed public records
  Primary-name mappings
  Subnames
  Fee configuration and referral policy

DuskDomainTreasury
  Registration and renewal fee custody
  Operator claims
  Referral reward accrual and claims

Indexer and API
  Watches events, powers search, history, warnings, and cached reads
```

The old registry, registrar, controller, resolver, and reverse-registry split remains useful as a conceptual model, but those pieces are not separate public deployments in the current runtime.

Contract-level resolution requirements are defined in [Contract-Level Resolution Requirements](contract-resolution.md).
Indexer event payloads are defined in [Indexer Event Schema](indexer-events.md).
Forward-resolution API and cache behavior are defined in [Indexer API](indexer-api.md).

## Name Normalization

MVP names are deliberately conservative:

- Suffix: `.dusk`
- Minimum second-level label length: 3
- Maximum total canonical name length: 63 characters
- Allowed characters: lowercase ASCII letters, digits, and interior hyphens
- Disallowed: uppercase, leading/trailing hyphens, empty labels, invisible characters, emoji, mixed script, and all Unicode outside MVP ASCII policy
- Canonicalization: trim, lowercase, append `.dusk` when missing, validate before signing

Unicode support requires a separate normalization and anti-spoofing standard.

Implementation reference: `src/names/namePolicy.ts`.

## Namehash

Dusk Domains should use recursive namehashing, but with a Dusk-native hash choice.

Draft recommendation:

1. Normalize the canonical name.
2. Split into labels.
3. Hash labels from right to left.
4. Use BLAKE2b-256 for the recursive node hash.

This preserves the useful ENS-style fixed-size node model while aligning with Dusk-native hash vocabulary.

Implementation reference: `src/names/namehash.ts`.

## Public Resolver Records

All MVP resolver records are public. UI and SDK docs must say so clearly.

| Record key | Value | MVP rule |
| --- | --- | --- |
| `moonlight_address` | Moonlight public address | Primary Dusk wallet endpoint. Eligible for send-to-name and primary-name display. |
| `phoenix_payment_endpoint` | Phoenix endpoint or future payment endpoint wrapper | Optional payment endpoint only. Not a default public identity target. Requires privacy warning. |
| `dusk_contract` | Dusk contract identifier | Public contract label/routing target. Wallets must not confuse it with a wallet recipient. |
| `dusk_asset` | Asset ID or asset namespace reference | P1 unless needed for an MVP demo. Public metadata/routing only. |
| `evm_address` | `0x` EVM address | Optional external record. Never default Dusk transfer target. |
| `website` | HTTPS URL | Public profile/institution endpoint. HTTPS required in MVP. |
| `avatar` | URI or content reference | Display-only. Not security-significant. |
| `content_pointer` | CID or approved content reference | Public content/profile/docs pointer. |
| `text.<key>` | UTF-8 text | Public text metadata with length caps and key policy. |
| `service_endpoint.<name>` | HTTPS URL or structured endpoint | Public endpoint for docs, status, API, disclosure, compliance, investor relations. |
| `attestation_ref` | Opaque reference | Future proof/attestation pointer. Do not store raw credential data. |
| `compliance_ref` | Opaque reference or HTTPS endpoint | Future issuer/venue pointer. Do not store PII. |

## Reverse Resolution

Reverse records are typed. MVP should support:

- `moonlight_address -> primary .dusk name`
- `dusk_contract -> primary .dusk name` where useful for explorer labels
- Optional external types such as `evm_address`

Phoenix endpoints must not be treated as normal reverse-resolvable public identities in v1.

## Display Rule

Wallets and explorers must display primary names only after reverse-plus-forward verification:

1. Reverse-resolve typed endpoint to candidate name.
2. Forward-resolve candidate name for the same endpoint type.
3. Display the name only if the forward record equals the original endpoint.
4. Otherwise display the raw endpoint and explain the mismatch.

## Subnames

Subnames are independent nodes below a parent namespace, for example `settlement.acme.dusk`.

MVP rules:

- Parent owner or parent manager/controller can create subnames.
- Subname labels follow the same ASCII-only normalization and minimum length policy as other labels.
- Subnames can use independent managers/controllers, resolvers, and typed public records.
- Default expiry policy is `inherits_parent`.
- Optional fixed expiry must be capped at the parent expiry.
- Default revocation policy is `parent_revocable`.
- `locked` subnames cannot be revoked by the parent after creation, but they still cannot outlive the parent expiry.
- Indexers must expose subname state by parent node and subname node.
- UI must show expiry and revocation policy before signing and after creation.

Policy reference: [Subname Policy](subnames.md).

## Expiry and Fees

- Annual rentals for second-level `.dusk` names.
- One-year minimum.
- Grace period after expiry.
- Marketplace auctions are an optional extension, not part of the core naming MVP.
- Fees in DUSK for mainnet beta, framed primarily as anti-squatting.

Implementation reference: `src/names/registration.ts` defines deterministic annual lifecycle helpers for registration, renewal, grace-period calculation, and active/grace/expired status.

## Reserved Names

Reserve official, protocol, support, wallet, security, and partner-sensitive names before public registration.

Policy reference: [Reserved Name Policy](policies/reserved-names.md).

Initial reserved set should include at least:

```text
dusk
wallet
webwallet
rusk
explorer
bridge
docs
support
foundation
staking
faucet
citadel
trade
npex
```

Obvious typos, impersonation variants, and support/security lookalikes should be blocked or reviewed.

## Governance and Branding

Prototype and beta should be explicit about independence:

> Dusk Domains by Mochavi is an independent experimental naming service for the Dusk ecosystem. It is not an official Dusk Foundation or Dusk Network B.V. product unless and until that is publicly announced.

Recommended staged control:

- Prototype: Mochavi-controlled multisig; no public implication of official endorsement.
- Testnet beta: published reserved-name list, upgrade path, and root powers.
- Mainnet beta: narrow multisig powers for registrar, canonical resolver, reserved names, and emergency pause only.
- Handoff: documented path for Foundation/community-designated ownership without changing user-owned name ownership.

## MVP Acceptance

The MVP is credible when:

- Users can register, renew, and manage `name.dusk`.
- Users can set `moonlight_address`, `dusk_contract`, `website`, `avatar`, and `content_pointer`.
- Users can set a Moonlight primary name.
- Wallets/explorers display names only after typed forward/reverse verification.
- Phoenix endpoint records are opt-in and privacy-warned.
- Developers can use SDK helpers without bespoke chain logic.
- Indexer/API supports search, cached reads, history, and recent-change warnings.

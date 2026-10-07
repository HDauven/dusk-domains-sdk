# Registration, quotes and renewal

Discover `client.directory.registration_context()` for the selected policy,
selection version, newest store and the two independent stop flags. Read
`client.policy(policyId).config()` for the policy config version. Obtain the
registration quote through the intended store's `quote_registration`; it performs
the contract's guarded policy validation and returns base, premium, referral,
exact total, quote height and selection/config versions. The policy quote’s
`valid_until` equals its request height; it is not a transaction deadline.
Direct policy `quote` is also available for inspection, but does not guarantee
registration eligibility.

`registrationCalls(store, input)` takes the actor, root label, years, secret,
original commitment store, observed `commitHeight`, reviewed quote, optional
`validUntil` transaction deadline, typed referrer, initial records and primary.
It returns separate `commit` and `reveal` calls.
Persist the secret and commitment shard privately before committing. Wait for
confirmed commitment inclusion and a reveal age of 5–8,640 blocks inclusive;
the SDK does not send both calls automatically. A fresh quote may be needed
before reveal; the commitment is independent of economics. Its derivation is
BLAKE2b-256 over the protocol domain, actor, root, label and secret.

Before inclusion is known, submit `storeCommitCall` using the persisted commitment.
After inclusion, build/rebuild `registrationCalls` with the observed `commitHeight`.
The reveal deadline defaults to `commitHeight + 8_640n` (capped at u64 maximum);
an explicit `validUntil` must lie between `commitHeight + 5n` and that last block,
inclusive. Review this deadline separately from the quote. Re-quoting never extends
the commitment window, and the store checks current economics at reveal inclusion.

The reveal's deposit equals `expected_fee_lux`. All fees are decimal Lux text;
there is no separate transaction value transfer. Referrals are typed principals,
with the contract deciding the effective claimable referrer. Self-referrals are
permitted. Registration events record the effective value. A changed quote,
policy version, deadline or home requires review and a newly signed call.

Renew with `client.quoteRenewal(store, { name, years })`. Follow its returned
`store`; use the Local schedule version/total in `storeRenewCall`. Renewal binds
the complete NameRef, exact price, schedule version and deadline. It uses the
directory's published renewal schedule, including its referral rate, without a
registration-policy dependency. Anyone may pay, including while the name is in
custody or a move is preparing. The original generation referrer is preserved.

Lifecycle uses block heights: YEAR=3,153,600, GRACE=259,200 and a ten-year ahead
horizon. Roots renew before `grace_end`; active resolution requires
`height < expires_at`. A fixed-expiry descendant stops inheritance for its whole
branch. Renewal never recreates removed descendants. Quotes are authoritative
snapshots, not a guarantee against another transaction before inclusion.

`vaultClaimReferralCall` supports `{ amount: 'All', recipient }` and
`{ amount: { Exact: '1000000000' }, recipient }`. Protocol claims additionally
bind the expected operator epoch. Claims remain available during registration
pause/suspension. Contract-principal paid execution requires the authenticated
C2C receipt adapter of that wallet; the Connect integration here submits direct
public Moonlight calls and never inherits an outer signer's contract authority.

## Input, estimates and recovery helpers

`normalizeNameInput` trims and folds ASCII uppercase for a search field. It does
not map Unicode. `validateName` checks the store's 1–63-byte label rules and up to
three subname labels; `ok` describes structure. Its separate `rootEligibility`
uses the policy's denied/reserved/minimum precedence. The launch policy requires
three-byte roots and reserves the 17 labels in `RESERVED_LABELS`. A subname may
have one character, repeated interior hyphens, or a reserved root label.
`namehashHex` requires a canonical full spelling and returns **unprefixed** hex.

`analyzeName(query, { policy, current, height })` produces `NameResult` and a
machine-readable `NameStatus`. Omitted `current` means `unchecked`; explicit
`null` means an observed absent name. There are no hardcoded registered names or
UI messages. This result does not check directory pause, capacity or authorization.

`estimateRegistrationQuote(policyConfig, quoteRequest)` mirrors the published v1
policy: five annual tiers, denied/reserved zero prices, daily premium halving over
`PREMIUM_WINDOW_DAYS` (21), and separate floor rounding for the two referral
shares. It returns `estimate: true`, decimal Lux amounts and a request hash.
`launchPolicyConfig()` provides the initial published rules; fetch the selected
policy config for current estimates. A replacement policy need not implement the
same curve. Estimates do not verify policy binding, availability or stop flags
and must not be substituted for a store quote in a signed transaction.

`registrationPremiumSchedule` returns the premium, next step and end block,
plus optional estimated ISO dates when `nowSeconds` is supplied. Dates use the
10-second target, never wall time for price. Unrepresentable future u64 heights
are null. `estimateRenewalQuote(schedule, name, years, height)` uses all five tiers
of the directory table, applies the existing generation's referral, and enforces
grace and the ten-year horizon. `formatLuxAsDusk` formats without floating point.

`createRegistrationLifecycle`, `renewRegistrationLifecycle` and
`registrationLifecycleStatus` take bigint heights and whole years. Renewal
extends the old expiry even during grace. `blockHeightToUnixSeconds` and
`blocksForSeconds` are explicit target-time estimates. Subnames have no independent
grace or renewal right.

`createRegistrationSecret()` uses secure randomness and returns 0x-prefixed
32-byte hex. `registrationCommitmentHex` accepts hex controller/node/secret,
requires the canonical root label, checks its node and matches the frozen store
commitment. `registrationCommitWindow` distinguishes missing/future observations,
waiting, ready and stale. At age 8,640 the commitment is still ready with
`staleInBlocks: 0n`; it is stale at 8,641. Future inclusion heights require a fresh
observation, for example after a reorg.

The four recovery helpers are `upsertPendingNameReservation`,
`listPendingNameReservations`, `removePendingNameReservation` and
`updatePendingNameReservationBlock`. Pass a synchronous `ReservationStorage`
(`getItem`/`setItem`) or omit it for browser `localStorage`. Records contain:

- Canonical name, root node, controller, commitment and secret.
- Chain ID, directory and **original commitment store**.
- Duration, nullable bigint inclusion height/transaction ID and ISO audit dates.

Save before signing commit. Key mutations by chain, directory, original store,
controller and commitment. A different secret or shard remains a separate entry;
re-quoting must not discard an older pending secret. Heights survive reload above
JavaScript's safe-number range. Clear a block/tx back to null after a reorg.

Unavailable or malformed storage returns no recovered rows. Mutations throw
`ReservationStorageError` with `unavailable`, `corrupt` or `write_failed`; the app
must not claim durable recovery after a failed save. Corrupt storage is not
overwritten. The adapter is not a cross-tab transaction system. Local storage
contains the secret; do not include it in logs or telemetry. Legacy 0.2 entries
cannot be automatically recovered into a fresh frozen deployment because they
lack the original frozen directory/store binding.

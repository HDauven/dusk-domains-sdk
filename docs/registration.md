# Registration, quotes and renewal

Discover `client.directory.registration_context()` for the selected policy,
selection version, newest store and the two independent stop flags. Read
`client.policy(policyId).config()` for the policy config version. Obtain the
registration quote through the intended store's `quote_registration`; it performs
the contract's guarded policy validation and returns base, premium, referral,
exact total, deadline and selection/config versions. Direct policy `quote` is
also available for inspection, but does not guarantee registration eligibility.

`registrationCalls(store, input)` takes the actor, root label, years, secret,
original commitment store, reviewed quote, optional typed referrer, initial
records and optional primary. It returns separate `commit` and `reveal` calls.
Persist the secret and commitment shard privately before committing. Wait for
confirmed commitment inclusion and a reveal age of 5–8,640 blocks inclusive;
the SDK does not send both calls automatically. A fresh quote may be needed
before reveal; the commitment is independent of economics. Its derivation is
BLAKE2b-256 over the protocol domain, actor, root, label and secret.

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

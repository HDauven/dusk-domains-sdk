# Frozen wallet gas policy

Every public write has an explicit entry in `GAS_LIMITS`; there is no generic
wallet fallback. Calls cannot override the limit. The direct public wallet path
is supported; arbitrary additional contract-wallet nesting needs its own budget.

`src/frozen/gas.ts` contains conservative no-input ceilings. Normal builders use
`src/frozen/wallet-gas.ts` to size record payloads, target lists and pruning batches
from the reviewed arguments, without changing those arguments or making reads.
Budgets round upward to whole millions and cover at least twice the measured
successful transaction maximum for the workload, plus any larger contract
admission requirement with forwarding and wrapper headroom. These are measured
fixture envelopes, not estimates of the gas a successful call will spend.

The VM assessment uses protocol 41f0f6f production WASM, Piecrust 0.32.0 and
Rusk 1.7.1 Moonlight transaction accounting, with checks at each chosen budget
and 1M below. The latter is a headroom probe, not a minimum-gas search.

| Action / hidden work | Budget |
| --- | ---: |
| Create subname, including replacement of an expired child with 255 descendants and primaries | 20M |
| Remove or prune subname, including the full subtree | 20M |
| Renew a root or marketplace escrow, including 256 inheriting descendants | 10M |
| Register, including old-tree cleanup and an uncached referrer | 80–164M, input dependent |
| Issue reserved root, including old-tree cleanup | 80M |
| Directory execute / accept operator / accept guardian / cancel, scanning 64 large stored proposals | 16M / 20M / 16M / 12M |
| Prune proposals; every ID can scan all 64 stored bodies, including missing/repeated IDs | 5M + 4M per ID; ceiling 261M |
| Begin / finalize move, including the maximum 257-name tree | 50M / 2,000M |

Input bytes cannot reveal an existing subtree, record set, primary bucket or
proposal body. Those cases reserve for the bounded stored state. In particular,
subname creation traverses and removes the old subtree before replacement, and
proposal pruning cannot assume supplied IDs match small proposals or remove rows.
Directory execution also covers validation of an external policy configuration
with 128 reserved and 128 denied labels, each at its maximum length.
Successful renewals cannot introduce an uncached referrer; registration and
marketplace settlement reserve for uncached payout-key validation when applicable.

The policy quote allowance is 50M plus a 10M failure reserve, with a strictly
larger remaining-gas check. Finalization requires more than 1,650M at the source
before its 1,500M activation call; its 2,000M outer budget also covers one tested
wallet invoke hop. Callback allowances remain unchanged: marketplace custody
builders still request 500M, with a 615M wallet envelope including forwarding.

Revalidate for new contract/VM releases, signature pricing, transaction privacy
paths or extra wallet nesting. Lifetime-global map populations and allocator
peaks near physical capacity are outside these fixture measurements.

Automatic gas price is capped at 10 Lux/gas, retaining the 0.2 price policy; a
one-second estimation timeout or malformed estimate falls back to 1. Set an
explicit positive u64 `gasPrice` when desired. The wallet display separates the
exact principal deposit from maximum gas cost. Included application failure can
consume the full limit, including when the principal deposit is refunded.

Before `submit`, the Connect adapter requests `dusk_getPublicBalance` and requires
`deposit + gas.limit * gas.price` Lux. Missing, malformed or insufficient public
balance prevents signing/submission; `WriteBalanceError.details` carries a code
and exact amounts. This is a conservative maximum-cost preflight, not a gas
estimate, account reservation or guarantee against concurrent spending. Chain
identity is checked again after the balance request.

`submitDuskDomainWrite` / `trackDuskDomainTransaction` expose typed progress
without UI strings. A plain hash remains submitted; only an observed terminal
execution status settles it. Explicit failure, nested receipt errors and Connect
0.2 raw executed-event revert payloads are treated as failed. Timeouts and wallet
rejection remain separate states. Indexer confirmation is a further observation
of projected state, not an automatic retry of the write.

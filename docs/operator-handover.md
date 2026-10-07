# Directory governance

The directory owns operator/recipient and guardian roles. The vault has no
independent operator setter. Read `client.directory.roles()`, `config()`,
`proposal({ id })` and `proposals(page)` for the current office/epochs and journal.

Use `directoryProposeCall(directoryId, { action })` for the exact Action union.
ReplaceOperator binds expected epoch and the incoming typed principal/recipient;
ReplaceGuardian binds its own expected epoch and incoming principal. Recipient,
policy, renewal, store/resolver admission and preferred-marketplace changes each
carry their own reviewed expected state. The contract enforces delays and roles.

`directoryExecuteCall` executes an eligible proposal. Operator/guardian
replacement requires incoming acceptance through `directoryAcceptOperatorCall`
or `directoryAcceptGuardianCall`; it is not an immediate setter. Cancellation,
pruning, pause/suspension and delay-increase builders use the corresponding exact
entrypoints. Display block-based ready/expiry windows and guardian-veto rules.

Read registration pause and guardian suspension separately from policy
registration_open. Policy or role replacement does not silently reset these
flags. Renewal, existing-name service and vault claims have their own liveness
rules and do not depend on the registration policy being open.

The SDK does not deploy, choose operator keys, shorten delays, automatically
execute proposals or claim funds. Show the complete reviewed action and obtain a
new wallet signature if its expected epoch/configuration changed.

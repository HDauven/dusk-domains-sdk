# Namespace control

A name's owner or manager may reassign or remove names below it through active ancestors.
Records, setting primary names and direct child creation require the name's own owner or manager; ancestors must first reassign the name to themselves as owner or manager, clearing its identity. Clearing a primary name requires only control of its endpoint, even after transfer, take-back or removal of the name record.
Subname holders retain their own authority, but an ancestor can reassign or remove them.
Transfers and sales change only the root; descendants keep stored owners and records.

Use `coreReassignSubnameRuntimeCall({ node, owner, manager })` to reassign through
`update_authorities_runtime`. An ancestor who is not the subname's current owner always clears that node's
records and primary name when changing either its owner or manager. The contract rejects unchanged
ancestor assignments, even with `clearRecords: true`. A holder transferring their own name keeps its
data unless reset is requested.

`coreUpdateAuthoritiesRuntimeCall({ node, owner, manager, clearRecords: true })` also
clears the target's records and primary name at constant cost. `clearRecords` is optional
and defaults to false; guards reject non-booleans and the wire encoder sends `clear_records`.
To hand over full control, set both `owner` and `manager` to the recipient. Clearing does
not visit descendants. The `name_owner_changed.dataCleared` event projects the reset.

`coreRemoveSubnameRuntimeCall({ node })` removes an active or expired subtree.
`coreTakeBackSubnamesRuntimeCall({ node, nodes, owner, manager })` takes back 1–256 distinct
subnames below the ancestor `node`. Every entry must change its owner or manager and clears its data,
even if the caller already owns it. An unchanged entry rejects the whole batch before any changes.
Both builders are exported from `@duskdomains/sdk/writes`; calls route to the name's home
registry. Call encoding rejects empty, duplicate and oversized batches.

`NamespaceSummary`, `IndexedNamespace` and `NamespaceAncestor` describe indexer namespace
responses. Root managers may control descendants but cannot transfer the root itself.
During marketplace escrow, the marketplace holds root authority; cancelling returns it.

For endpoint cleanup, `createDuskDomainsOnChainClient(...).readPrimaryName(endpoint)` reads
the stored mapping through router `locate_primary` and registry `read_primary_name`,
even after the name expires or disappears. It returns a decoded record or null without
lifecycle or forward verification. Use `getPrimaryName` and `verifyPrimaryName` for
active routing and verified display.

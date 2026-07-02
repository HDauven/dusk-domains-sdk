# Release Versioning

Status: private beta policy

Dusk Domains integrations must be pinned to a specific SDK source and contract deployment. Do not treat `main` as a stable protocol version.

## Version Axes

Track these independently:

| Axis | Source | Compatibility meaning |
| --- | --- | --- |
| SDK package commit/tag | `@hdauven/dusk-domains-sdk` | TypeScript API and client behavior. |
| Release manifest | deployment artifact bundle | Contract IDs, data-driver URLs, method signatures, event schema and artifact hashes. |
| Contract source commit | `HDauven/dusk-names` | Canonical Rust contract behavior for a deployment. |
| Indexer package commit/tag | `@hdauven/dusk-domains-indexer` | Server projection, SQLite and API behavior. |

## Dependency Rule

For private beta, consumers should use an exact Git ref:

```json
{
  "dependencies": {
    "@hdauven/dusk-domains-sdk": "github:HDauven/dusk-domains-sdk#<commit>"
  }
}
```

Floating branches are acceptable only in local development.

## Manifest Rule

Public integrations should start from `createDuskDomainsClientFromManifest`. The manifest binds the SDK to:

- network and chain ID;
- core and treasury contract IDs;
- data-driver artifact URLs and hashes;
- method signatures;
- event schema version;
- release/source commit metadata;
- required indexer routes.

If the SDK can load a manifest but the indexer health route reports an incompatible schema or missing route, the integration must treat that as degraded or unavailable.

## Change Levels

- Patch: docs, tests, stricter validation or bug fixes that do not change public API shape.
- Minor: additive public SDK methods, additive record keys, additive indexer routes or additive manifest fields.
- Major: renamed/removed public methods, changed event schema semantics, changed data-driver method signatures or contract redeploys that change public behavior.

Pre-production releases may still move quickly, but each pushed app dependency should point at an exact SDK commit.

## Release Checklist

Before updating a downstream app or indexer to a new SDK ref:

- `npm test`
- `npm run typecheck`
- `npm run build`
- check `docs/public-surface.md` for accidental internal promotion
- update downstream package lockfiles
- run downstream build and relevant smoke tests

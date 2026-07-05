# Release Versioning

Status: pre-production beta policy

Dusk Domains integrations must be pinned to a specific SDK package version and contract deployment. Do not treat `main` as a stable protocol version.

## Version Axes

Track these independently:

| Axis | Source | Compatibility meaning |
| --- | --- | --- |
| SDK package version | `@duskdomains/sdk` | TypeScript API and client behavior. |
| Release manifest | deployment artifact bundle | Contract IDs, data-driver URLs, method signatures, event schema and artifact hashes. |
| Contract source commit | `HDauven/dusk-domains` | Canonical Rust contract behavior for a deployment. |
| Indexer package commit/tag | `@hdauven/dusk-domains-indexer` | Server projection, SQLite and API behavior. |

## Dependency Rule

For pre-production beta, consumers should use a published JSR package version:

```json
{
  "dependencies": {
    "@duskdomains/sdk": "npm:@jsr/duskdomains__sdk@^0.1.5"
  }
}
```

Exact package versions are preferred for release bundles. Ranges are acceptable in first-party apps when the release manifest and test suite are updated in the same change.

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

Pre-production releases may still move quickly, but each pushed app dependency should point at a published SDK version.

## Release Checklist

Before updating a downstream app or indexer to a new SDK version:

- `npm test`
- `npm run typecheck`
- `npm run build`
- check `docs/public-surface.md` for accidental internal promotion
- if the indexer changed, verify `@duskdomains/sdk/event-catalog` still loads under plain Node
- update downstream package lockfiles
- run downstream build and relevant smoke tests

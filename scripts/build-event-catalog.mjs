import { readFile, writeFile } from 'node:fs/promises'

// Raw GitHub archive installs need committed JS; JSR uses the TypeScript source.
const compiled = await readFile(new URL('../dist/indexer/events/indexerEventCatalog.js', import.meta.url), 'utf8')
const content = '// Generated from indexerEventCatalog.ts by npm run build. Do not edit.\n'
  + compiled.replace(/^\/\/# sourceMappingURL=.*\n?/gm, '')
await writeFile(new URL('../src/indexer/events/indexerEventCatalog.mjs', import.meta.url), content)

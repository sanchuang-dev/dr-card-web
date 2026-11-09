import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LAST, HISTORY, CATALOG, MANIFEST, KEEP, makeCandidate,
  publish, rollback, pruneHistory, retentionPlan, safeFile, safeId,
} from './oss-prod-release-core.mjs'
import { OssProdStore } from './oss-prod-store.mjs'

class MemoryStore {
  constructor() {
    this.objects = new Map()
    this.removed = []
    this.fail = null
    this.failNthCatalogPut = null
    this.failRemoveOnce = false
  }
  async get(key) { return this.objects.get(key) ?? null }
  async put(key, bytes) {
    if (this.fail === key) { this.fail = null; throw new Error('Injected OSS write interruption') }
    if (key === CATALOG && this.failNthCatalogPut != null) {
      this.failNthCatalogPut--
      if (this.failNthCatalogPut === 0) {
        this.failNthCatalogPut = null
        throw new Error('Injected final catalog write failure')
      }
    }
    this.objects.set(key, Buffer.from(bytes))
  }
  async remove(key) {
    this.removed.push(key)
    this.objects.delete(key)
    if (this.failRemoveOnce) {
      this.failRemoveOnce = false
      throw new Error('Injected interrupted object deletion')
    }
  }
}
function make(version, { at, sha } = {}) {
  const gitSha = sha ?? (String(version).padStart(40, 'a'))
  const files = new Map([
    ['index.html', Buffer.from(`<html><script src="/kbs-web/prod/last/assets/index-${version}.js"></script></html>`)],
    ['build-meta.json', Buffer.from(JSON.stringify({
      appEnvironment: 'prod', dataMode: 'api', bridgeMode: 'native',
      ossWeb: { target: 'prod', path: '/kbs-web/prod/last/' },
      build: { sha: gitSha, id: `10${version}.1` },
    }))],
    [`assets/index-${version}.js`, Buffer.from(`console.log(${version})`)],
    ['images/logo.png', Buffer.from('stable-public-logo')],
  ])
  return makeCandidate({ files, runId: 100 + version, attempt: 1, sha: gitSha,
    at: at ?? new Date(Date.UTC(2026, 9, 10, 0, version, 0)).toISOString() })
}
const ok = async manifest => ({ ok: true, releaseId: manifest.id })
const head = async () => true
async function installed(store, version, options = {}) {
  return publish({ store, candidate: make(version), healthcheck: ok,
    currentHead: head, allowBootstrap: version === 1, ...options })
}
const catalog = store => JSON.parse(store.objects.get(CATALOG)?.toString() || '{"entries":[]}')
const last = store => JSON.parse(store.objects.get(LAST + MANIFEST)?.toString() || 'null')

test('release IDs, safe paths, exact identity and Mock/Native boundaries', () => {
  assert.equal(make(1).manifest.id, 'r101-a1')
  assert.ok(safeFile('assets/a-b.webp'))
  assert.equal(safeFile('../prod/last/index.html'), false)
  assert.equal(safeFile('assets/../../index.html'), false)
  assert.equal(safeFile('assets\\x'), false)
  assert.equal(safeId('r101-a1'), true)
  assert.equal(safeId('r0-a1'), false)
  assert.equal(safeId('../../last'), false)
  assert.equal(KEEP, 5)
  assert.throws(() => makeCandidate({
    files: { 'index.html': 'x', 'build-meta.json': JSON.stringify({ appEnvironment: 'preview' }) },
    runId: 200, attempt: 1, sha: 'a'.repeat(40),
  }), /Refusing nonproduction/)
  const retriedFiles = new Map(make(1).files)
  const retryMeta = JSON.parse(retriedFiles.get('build-meta.json').toString())
  retryMeta.build.id = '101.2'
  retriedFiles.set('build-meta.json', Buffer.from(JSON.stringify(retryMeta)))
  assert.notEqual(makeCandidate({ files: retriedFiles,
    runId: 101, attempt: 2, sha: make(1).manifest.sha }).manifest.id,
  make(1).manifest.id)
})

test('initial last requires explicit bootstrap and mandatory external healthcheck', async () => {
  const store = new MemoryStore()
  await assert.rejects(publish({ store, candidate: make(1), currentHead: head }), /Real Healthcheck/)
  await assert.rejects(publish({ store, candidate: make(1),
    healthcheck: ok, currentHead: head }), /approved bootstrap/)
  assert.equal(store.objects.size, 0)
  const result = await installed(store, 1)
  assert.equal(result.releaseId, 'r101-a1')
  assert.equal(result.previousId, null)
  assert.equal(last(store).id, 'r101-a1')
  assert.equal(catalog(store).entries.length, 0)
})

test('publish archives complete previous version, verifies resources and switches index last', async () => {
  const store = new MemoryStore()
  await installed(store, 1)
  const priorIndex = store.objects.get(LAST + 'index.html').toString()
  await installed(store, 2)
  assert.equal(last(store).id, 'r102-a1')
  assert.equal(catalog(store).entries[0].id, 'r101-a1')
  assert.equal(store.objects.get(HISTORY + 'r101-a1/index.html').toString(), priorIndex)
  assert.ok(store.objects.has(HISTORY + 'r101-a1/assets/index-1.js'))
  assert.ok(store.objects.has(HISTORY + 'r101-a1/images/logo.png'))
  assert.ok(store.objects.has(LAST + 'assets/index-1.js'), 'old JS must remain for cached pages')
  assert.ok(store.objects.has(LAST + 'assets/index-2.js'))
  assert.deepEqual(store.removed, [])
  assert.equal(store.objects.get(HISTORY + 'r101-a1/' + MANIFEST).length > 20, true)
})

test('failing Healthcheck restores verified previous last; history is never pruned', async () => {
  const store = new MemoryStore()
  await installed(store, 1)
  const prior = store.objects.get(LAST + 'index.html').toString()
  await assert.rejects(installed(store, 2, {
    healthcheck: async manifest => ({ ok: manifest.id === 'r101-a1',
      releaseId: manifest.id }),
  }), /Healthcheck failed/)
  assert.equal(last(store).id, 'r101-a1')
  assert.equal(store.objects.get(LAST + 'index.html').toString(), prior)
  assert.deepEqual(store.removed, [])
})

test('failed publish and its failed recovery verification are clearly distinguished', async () => {
  const store = new MemoryStore()
  await installed(store, 1)
  await assert.rejects(installed(store, 2, {
    healthcheck: async manifest => ({ ok: false, releaseId: manifest.id }),
  }), AggregateError)
  assert.equal(last(store).id, 'r101-a1')
  assert.deepEqual(store.removed, [])
})

test('failed historic rollback revalidates restored original release', async () => {
  const store = new MemoryStore()
  for (let i = 1; i <= 3; i++) await installed(store, i)
  await assert.rejects(rollback({ store, releaseId: 'r102-a1',
    authorizeRollback: async () => true,
    healthcheck: async manifest => ({ ok: manifest.id === 'r103-a1', releaseId: manifest.id }),
  }), /Rollback healthcheck failed/)
  assert.equal(last(store).id, 'r103-a1')
  assert.deepEqual(store.removed, [])
})

test('failed index upload restores previous metadata and entry', async () => {
  const store = new MemoryStore()
  await installed(store, 1)
  store.fail = LAST + 'index.html'
  await assert.rejects(installed(store, 2), /Injected OSS write/)
  assert.equal(last(store).id, 'r101-a1')
  assert.equal(JSON.parse(store.objects.get(LAST + 'build-meta.json')).build.id, '101.1')
  assert.deepEqual(store.removed, [])
})

test('damaged previous live file cannot be silently archived or overwritten', async () => {
  const store = new MemoryStore()
  await installed(store, 1)
  store.objects.set(LAST + 'assets/index-1.js', Buffer.from('corrupted'))
  await assert.rejects(installed(store, 2), /Missing or damaged artifact/)
  assert.equal(last(store).id, 'r101-a1')
})

test('identical static keys may be reused but changed unversioned assets are blocked', async () => {
  const store = new MemoryStore()
  await installed(store, 1)
  const normal = make(2)
  normal.files.set('images/logo.png', Buffer.from('changed-logo'))
  const bad = makeCandidate({ files: normal.files, runId: 102, attempt: 1,
    sha: normal.manifest.sha, at: normal.manifest.activatedAt })
  await assert.rejects(publish({ store, candidate: bad, currentHead: head,
    healthcheck: ok }), /Non-versioned static object collision/)
  assert.equal(last(store).id, 'r101-a1')
})

test('rollback restores an exact historic version at same last URL', async () => {
  const store = new MemoryStore()
  for (let i = 1; i <= 3; i++) await installed(store, i)
  const r = await rollback({ store, releaseId: 'r102-a1',
    healthcheck: ok, authorizeRollback: async () => true })
  assert.equal(r.restored, 'r102-a1')
  assert.equal(last(store).id, 'r102-a1')
  assert.match(store.objects.get(LAST + 'index.html').toString(), /index-2.js/)
  assert.ok(store.objects.has(HISTORY + 'r103-a1/index.html'),
    'outgoing current release must be archived for roll-forward')
  assert.deepEqual(store.removed, [])
  await assert.rejects(rollback({ store, releaseId: 'r999-a1',
    healthcheck: ok, authorizeRollback: async () => true }), /Not a catalogued/)
})

test('retention dry-run and 6th history prune delete oldest only with real attestation', async () => {
  const store = new MemoryStore()
  for (let i = 1; i <= 7; i++) await installed(store, i)
  assert.equal(catalog(store).entries.length, 6)
  const plan = await retentionPlan({ store, activeId: 'r107-a1' })
  assert.deepEqual(plan.victims.map(e => e.id), ['r101-a1'])
  assert.equal((await pruneHistory({ store, activeId: 'r107-a1' })).dryRun, true)
  assert.deepEqual(store.removed, [])
  await assert.rejects(pruneHistory({ store, activeId: 'r107-a1', allowDelete: true,
    attestation: { ok: true, releaseId: 'r107-a1' } }), /existing Healthcheck/)
  assert.deepEqual(store.removed, [])
  const done = await pruneHistory({ store, activeId: 'r107-a1', allowDelete: true,
    attestation: { ok: true, releaseId: 'r107-a1', fromExistingHealthcheck: true } })
  assert.deepEqual(done.removed, ['r101-a1'])
  assert.equal(catalog(store).entries.length, 5)
  assert.ok(store.removed.length > 2)
  assert.ok(store.removed.every(k => k.startsWith(HISTORY + 'r101-a1/')))
  assert.ok(store.objects.has(LAST + 'index.html'))
  assert.ok(store.objects.has(HISTORY + 'r102-a1/index.html'))
})

test('crash after history files are removed can resume from durable deletion journal', async () => {
  const store = new MemoryStore()
  for (let i = 1; i <= 7; i++) await installed(store, i)
  store.failNthCatalogPut = 2 // journal succeeds; final removal from catalog fails
  const args = { store, activeId: 'r107-a1', allowDelete: true,
    attestation: { ok: true, releaseId: 'r107-a1', fromExistingHealthcheck: true } }
  await assert.rejects(pruneHistory(args), /Injected final catalog/)
  assert.equal(catalog(store).entries[0].state, 'deleting')
  assert.equal(store.objects.has(HISTORY + 'r101-a1/' + MANIFEST), false)
  const recovered = await pruneHistory(args)
  assert.deepEqual(recovered.removed, ['r101-a1'])
  assert.equal(catalog(store).entries.length, 5)
  assert.ok(store.removed.every(key => key.startsWith(HISTORY + 'r101-a1/')))
})

test('crash halfway through deletion skips removed keys on retry', async () => {
  const store = new MemoryStore()
  for (let i = 1; i <= 7; i++) await installed(store, i)
  store.failRemoveOnce = true
  const args = { store, activeId: 'r107-a1', allowDelete: true,
    attestation: { ok: true, releaseId: 'r107-a1', fromExistingHealthcheck: true } }
  await assert.rejects(pruneHistory(args), /Injected interrupted object deletion/)
  assert.equal(catalog(store).entries[0].state, 'deleting')
  await pruneHistory(args)
  assert.equal(catalog(store).entries.length, 5)
  assert.ok(store.objects.has(LAST + 'index.html'))
  assert.ok(store.removed.every(key => key.startsWith(HISTORY + 'r101-a1/')))
})

test('protected historic snapshots block unsafe prune and do not delete anything', async () => {
  const store = new MemoryStore()
  for (let i = 1; i <= 7; i++) await installed(store, i)
  await assert.rejects(retentionPlan({ store, activeId: 'r107-a1',
    protectedIds: ['r101-a1','r102-a1','r103-a1','r104-a1','r105-a1','r106-a1'] }), /protected history/)
  assert.deepEqual(store.removed, [])
})

test('branch movement fails closed before switching entry', async () => {
  const store = new MemoryStore()
  await installed(store, 1)
  await assert.rejects(installed(store, 2, { currentHead: async () => false }), /Stale/)
  assert.equal(last(store).id, 'r101-a1')
  assert.deepEqual(store.removed, [])
})

test('OSS production driver defaults to read only and rejects all wrong deletion scopes', async () => {
  const store = new OssProdStore()
  await assert.rejects(store.put(LAST + 'index.html', Buffer.from('x')), /writes disabled/)
  await assert.rejects(store.remove(LAST + 'index.html'), /Deletion forbidden/)
  await assert.rejects(store.remove('kbs-web/ui/index.html'), /outside exact/)
  await assert.rejects(store.remove('kbs-web/prod/history/../last/index.html'), /outside exact/)
  const noIndex = new OssProdStore({ allowWrites: true })
  await assert.rejects(noIndex.put(LAST + 'index.html', Buffer.from('x')), /cutover disabled/)
  const noRemove = new OssProdStore({ allowDeletes: true })
  await assert.rejects(noRemove.remove(CATALOG), /Deletion forbidden/)
})

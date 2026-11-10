import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import ts from 'typescript'
import { z } from 'zod'

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

async function listSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(fullPath)))
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function scriptKindFor(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (file.endsWith('.js')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function containsStorageKeyDefinition(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  )
  let found = false

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineStorageKey'
    ) {
      found = true
      return
    }
    if (!found) ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return found
}

function createMemoryStorage() {
  const values = new Map()
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

try {
  const storageModule = await server.ssrLoadModule('/src/storage/storage.ts')
  const keyModule = await server.ssrLoadModule('/src/storage/keys.ts')
  const { createStorageAdapter, storage: browserStorage } = storageModule
  const { defineStorageKey, STORAGE_KEYS } = keyModule

  assert.deepEqual(Object.keys(STORAGE_KEYS), ['authSession', 'profilePinMasks'])
  assert.equal(STORAGE_KEYS.authSession.name, 'dr-card:auth-session')
  assert.equal(STORAGE_KEYS.authSession.area, 'session')
  assert.equal(STORAGE_KEYS.profilePinMasks.name, 'dr-card:profile-pin-masks')
  assert.equal(STORAGE_KEYS.profilePinMasks.area, 'local')

  const localBackend = createMemoryStorage()
  const sessionBackend = createMemoryStorage()
  const adapter = createStorageAdapter((area) =>
    area === 'local' ? localBackend : sessionBackend,
  )

  const localKey = defineStorageKey(
    'h011-local-probe',
    'local',
    z.object({ theme: z.enum(['light', 'dark']) }),
  )
  const sessionKey = defineStorageKey(
    'h011-session-probe',
    'session',
    z.object({ step: z.number().int().nonnegative() }),
  )

  assert.equal(localKey.name, 'dr-card:h011-local-probe')
  assert.equal(sessionKey.name, 'dr-card:h011-session-probe')
  assert.equal(adapter.read(localKey), null)
  assert.equal(adapter.write(localKey, { theme: 'dark' }), true)
  assert.deepEqual(adapter.read(localKey), { theme: 'dark' })
  assert.equal(sessionBackend.values.has(localKey.name), false)

  assert.equal(adapter.write(sessionKey, { step: 2 }), true)
  assert.deepEqual(adapter.read(sessionKey), { step: 2 })
  assert.equal(localBackend.values.has(sessionKey.name), false)

  assert.equal(
    adapter.write(STORAGE_KEYS.authSession, {
      accessToken: 'session-only-probe',
    }),
    true,
  )
  assert.deepEqual(adapter.read(STORAGE_KEYS.authSession), {
    accessToken: 'session-only-probe',
  })
  assert.equal(sessionBackend.values.has(STORAGE_KEYS.authSession.name), true)
  assert.equal(localBackend.values.has(STORAGE_KEYS.authSession.name), false)

  // A saved-PIN marker stores only boolean display state per user, never PIN digits.
  assert.equal(adapter.write(STORAGE_KEYS.profilePinMasks, { '5': true }), true)
  assert.deepEqual(adapter.read(STORAGE_KEYS.profilePinMasks), { '5': true })
  assert.equal(sessionBackend.values.has(STORAGE_KEYS.profilePinMasks.name), false)
  assert.equal(adapter.write(STORAGE_KEYS.profilePinMasks, { '5': '123456' }), false)

  localBackend.values.set(localKey.name, '{broken json')
  assert.equal(adapter.read(localKey), null)
  assert.equal(localBackend.values.has(localKey.name), false)

  localBackend.values.set(localKey.name, JSON.stringify({ theme: 'invalid' }))
  assert.equal(adapter.read(localKey), null)
  assert.equal(localBackend.values.has(localKey.name), false)

  assert.equal(adapter.write(localKey, { theme: 'invalid' }), false)

  const anyKey = defineStorageKey('h011-any-probe', 'session', z.any())
  const circular = {}
  circular.self = circular
  assert.equal(adapter.write(anyKey, circular), false)

  assert.equal(adapter.remove(sessionKey), true)
  assert.equal(adapter.read(sessionKey), null)

  const resolverFailure = createStorageAdapter(() => {
    throw new Error('storage getter blocked')
  })
  assert.equal(resolverFailure.read(localKey), null)
  assert.equal(resolverFailure.write(localKey, { theme: 'light' }), false)
  assert.equal(resolverFailure.remove(localKey), false)

  const readFailure = createStorageAdapter(() => ({
    getItem() {
      throw new Error('getItem blocked')
    },
    setItem() {},
    removeItem() {},
  }))
  assert.equal(readFailure.read(localKey), null)

  const writeFailure = createStorageAdapter(() => ({
    getItem() {
      return null
    },
    setItem() {
      throw new Error('quota exceeded')
    },
    removeItem() {},
  }))
  assert.equal(writeFailure.write(localKey, { theme: 'light' }), false)

  const removeFailure = createStorageAdapter(() => ({
    getItem() {
      return null
    },
    setItem() {},
    removeItem() {
      throw new Error('remove blocked')
    },
  }))
  assert.equal(removeFailure.remove(localKey), false)

  // Vite SSR executes in Node without a browser window. The production facade must degrade safely.
  assert.equal(browserStorage.read(localKey), null)
  assert.equal(browserStorage.write(localKey, { theme: 'light' }), false)
  assert.equal(browserStorage.remove(localKey), false)

  // Direct Web Storage access is already enforced by the repository's AST-based H5 hygiene gate.
  // H011 adds the narrower rule that storage-key construction stays in the central registry.
  const sourceFiles = await listSourceFiles('src')
  const keyRegistry = path.normalize('src/storage/keys.ts')

  for (const file of sourceFiles) {
    const normalized = path.normalize(file)
    if (normalized === keyRegistry) continue

    const source = await readFile(file, 'utf8')
    assert.equal(
      containsStorageKeyDefinition(file, source),
      false,
      `${file} defines a storage key outside the centralized registry`,
    )
  }

  console.log(
    'H011 STORAGE PASS: guarded typed storage behavior, local/session separation, corrupt-value handling, SSR safety, and centralized key construction are verified; direct Web Storage access remains enforced by H5 hygiene.',
  )
} finally {
  await server.close()
}

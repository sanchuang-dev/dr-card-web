// #169: opt-in OSS transport. By default READ ONLY. #170 owns enabling live
// index switches and deletions after the real Healthcheck contract is verified.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LAST, HISTORY, CATALOG, safeFile, safeId } from './oss-prod-release-core.mjs'

const BUCKET = 'oss://kbs-sdl/'
function requireKey(key) {
  if (key === CATALOG) return
  if (key.startsWith(LAST) && safeFile(key.slice(LAST.length))) return
  if (key.startsWith(HISTORY)) {
    const parts = key.slice(HISTORY.length).split('/')
    if (parts.length === 2 && safeId(parts[0]) && safeFile(parts[1])) return
    if (parts.length > 2 && safeId(parts[0]) && safeFile(parts.slice(1).join('/'))) return
  }
  throw new Error('Refusing OSS access outside exact kbs-web/prod/last or history keys')
}
function execOss(...args) {
  const result = spawnSync('ossutil', args, { encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || '').slice(0, 900)
    const error = new Error(`ossutil ${args[0]} failed: ${msg}`)
    error.ossOutput = msg
    throw error
  }
}
function localTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'kbs-prod-oss-'))
  try { return fn(join(dir, 'object')) }
  finally { rmSync(dir, { recursive: true, force: true }) }
}
export class OssProdStore {
  constructor({ allowWrites = false, allowSwitch = false, allowDeletes = false } = {}) {
    this.allowWrites = allowWrites
    this.allowSwitch = allowSwitch
    this.allowDeletes = allowDeletes
  }
  async get(key) {
    requireKey(key)
    return localTemp(path => {
      try { execOss('cp', BUCKET + key, path) }
      catch (error) {
        // Absent object is valid during the first deployment; an ACL/network
        // error is never treated as "empty bucket".
        if (/NoSuchKey|404 Not Found|ObjectNotFound|NoSuchObject/.test(error.ossOutput ?? '')) return null
        throw error
      }
      return readFileSync(path)
    })
  }
  async put(key, bytes) {
    requireKey(key)
    if (!this.allowWrites) throw new Error('OSS writes disabled until #170 approval')
    if (key === LAST + 'index.html' && !this.allowSwitch) {
      throw new Error('Prod last/index.html cutover disabled until #170')
    }
    localTemp(path => {
      writeFileSync(path, bytes)
      // Fixed HTML/metadata must revalidate; versioned hashed assets can
      // safely be cached after content-collision checks in the release core.
      const hashedAsset = key.startsWith(LAST + 'assets/') &&
        /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(key)
      const cache = key === LAST + 'index.html' ||
        key === LAST + 'build-meta.json' || key === LAST + 'release-manifest.json'
          ? 'no-cache, must-revalidate'
          : hashedAsset
            ? 'public, max-age=31536000, immutable'
            : 'no-cache'
      execOss('cp', path, BUCKET + key, '--cache-control', cache)

    })
  }
  async remove(key) {
    requireKey(key)
    // Even the approved cleanup API cannot remove last, catalog, ui/dev/test,
    // or an entire history directory. Only exact release file objects.
    if (!this.allowDeletes || !key.startsWith(HISTORY) ||
      key === CATALOG || !safeId(key.slice(HISTORY.length).split('/')[0])) {
      throw new Error('Deletion forbidden outside approved historic release objects')
    }
    execOss('rm', BUCKET + key)
  }
}

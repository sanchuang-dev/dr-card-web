#!/usr/bin/env node
// #168: deploy only fixed *nonproduction* web prefixes. Never deletes OSS keys.
// Uses the existing verified ossutil binary and scoped GitHub Environment keys.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, dirname, sep } from 'node:path'

const target = process.argv[2]
const expectedApp = { ui: 'preview', dev: 'dev', test: 'test' }
if (!Object.hasOwn(expectedApp, target)) {
  throw new Error('Only ui|dev|test may deploy; production last/history belongs to #169/#170.')
}
const prefix = `oss://kbs-sdl/kbs-web/${target}/`
const root = join(process.cwd(), 'dist')
const meta = JSON.parse(readFileSync(join(root, 'build-meta.json'), 'utf8'))
if (meta.appEnvironment !== expectedApp[target] || meta.ossWeb?.target !== target ||
    meta.ossWeb.path !== `/kbs-web/${target}/`) {
  throw new Error(`Refusing mislabelled package for ${target}`)
}
const expectedBranch = target === 'ui' ? 'preview' : target
if (process.env.GITHUB_REF_NAME !== expectedBranch || process.env.GITHUB_EVENT_NAME !== 'push' ||
    meta.build.sha !== process.env.GITHUB_SHA) {
  throw new Error(`Refusing non-branch or mismatched deployment to ${prefix}`)
}
if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
  throw new Error(`Missing credentials for GitHub Environment oss-${target}; no production fallback is allowed.`)
}

// Refuse late reruns from stale commits, even if a previously queued job starts
// after another branch push. Recheck immediately before switching the index.
function assertCurrentBranchHead() {
  const branch = process.env.GITHUB_REF_NAME
  const result = spawnSync('git', ['ls-remote', '--exit-code', 'origin', `refs/heads/${branch}`], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0 || result.stdout.trim().split(/\s+/)[0] !== process.env.GITHUB_SHA) {
    throw new Error('Stale or unverifiable source branch HEAD: refusing to publish fixed entry.')
  }
}
assertCurrentBranchHead()

function ossutil(...args) {
  const result = spawnSync('ossutil', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.status !== 0) {
    throw new Error(`ossutil ${args[0]} failed for ${args[1] ?? ''}: ${(result.stderr || result.stdout).slice(0, 850)}`)
  }
  return result.stdout
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : []
  }).sort()
}
const files = walk(root).map(file => ({ file, key: relative(root, file).split(sep).join('/') }))
if (!files.find(item => item.key === 'index.html') ||
    !files.find(item => item.key === 'build-meta.json')) {
  throw new Error('Missing index.html or build-meta.json')
}
const temp = mkdtempSync(join(tmpdir(), 'kbs-web-oss-'))
const oldIndex = join(temp, 'prior-index.html')
const oldMeta = join(temp, 'prior-meta.json')
const hadOld = (() => {
  try {
    ossutil('cp', prefix + 'index.html', oldIndex)
    ossutil('cp', prefix + 'build-meta.json', oldMeta)
    return true
  } catch (error) {
    // First publication may not exist; do not suppress permission/network errors.
    const detail = String(error)
    if (/NoSuchKey|NoSuchBucket|404 Not Found/i.test(detail) && !/NoSuchBucket/i.test(detail)) return false
    throw error
  }
})()

function uploadAndVerify(file, key) {
  if (!key || key.startsWith('/') || key.split('/').includes('..')) throw new Error('Unsafe OSS object key')
  const remote = prefix + key
  const downloaded = join(temp, 'check', key)
  mkdirSync(dirname(downloaded), { recursive: true })
  ossutil('cp', file, remote, '-f')
  ossutil('cp', remote, downloaded)
  if (!readFileSync(file).equals(readFileSync(downloaded))) {
    throw new Error(`OSS readback differs: ${key}`)
  }
}
let metadataTouched = false
let indexTouched = false
try {
  // All assets (including non-hashed public files) must be readable before
  // the entry point is switched. Never remove old assets during this phase.
  for (const item of files) {
    if (item.key !== 'index.html' && item.key !== 'build-meta.json') {
      uploadAndVerify(item.file, item.key)
    }
  }
  metadataTouched = true
  uploadAndVerify(join(root, 'build-meta.json'), 'build-meta.json')
  assertCurrentBranchHead()
  indexTouched = true
  uploadAndVerify(join(root, 'index.html'), 'index.html')
  console.log(`Verified ${files.length} files under ${prefix}. Fixed entry point updated last.`)
} catch (error) {
  if (hadOld && (metadataTouched || indexTouched)) {
    try {
      ossutil('cp', oldMeta, prefix + 'build-meta.json', '-f')
      if (indexTouched) ossutil('cp', oldIndex, prefix + 'index.html', '-f')
      console.error('Prior entry state restored after interrupted upload.')
    } catch (restoreError) {
      console.error('CRITICAL: prior entry restore failed:', String(restoreError))
    }
  }
  throw error
} finally {
  rmSync(temp, { recursive: true, force: true })
}

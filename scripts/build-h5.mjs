#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const TARGETS = {
  dev: { mode: 'development', appEnvironment: 'dev', defaultDataMode: 'mock', defaultBridgeMode: 'disabled' },
  preview: { mode: 'preview', appEnvironment: 'preview', defaultDataMode: 'mock', defaultBridgeMode: 'disabled' },
  test: { mode: 'test', appEnvironment: 'test', defaultDataMode: 'api', defaultBridgeMode: 'native' },
  prod: { mode: 'production', appEnvironment: 'prod', defaultDataMode: 'api', defaultBridgeMode: 'native' },
}

const DATA_MODES = new Set(['mock', 'api'])
const BRIDGE_MODES = new Set(['disabled', 'mock', 'native'])
const root = process.cwd()
const requestedTarget = process.argv[2] ?? 'auto'
const dryRun = process.argv.includes('--dry-run')

function fail(message) {
  console.error(`[build-h5] ${message}`)
  process.exit(1)
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

function resolveCloudflareTarget() {
  const branch = process.env.CF_PAGES_BRANCH?.trim()
  if (!branch) fail('CF_PAGES_BRANCH is required for the Cloudflare build target.')

  if (branch === 'main') {
    fail('`main` is the retained legacy branch. Cloudflare production must target `prod`, not `main`.')
  }

  if (branch === 'prod' || branch === 'test' || branch === 'dev' || branch === 'preview') {
    return branch
  }

  // Feature/PR branch previews intentionally use preview semantics: deterministic Mock + fixture tools.
  return 'preview'
}

function resolveRequestedTarget() {
  if (requestedTarget === 'cf') return resolveCloudflareTarget()
  if (requestedTarget === 'auto') {
    // Migration safety: an existing Pages project may still call `npm run build`.
    // When Cloudflare context is present, preserve branch-aware semantics instead of silently building prod.
    return process.env.CF_PAGES_BRANCH ? resolveCloudflareTarget() : 'prod'
  }
  return requestedTarget
}

const cloudflareBuildContext =
  requestedTarget === 'cf' || (requestedTarget === 'auto' && Boolean(process.env.CF_PAGES_BRANCH))
const targetName = resolveRequestedTarget()
const target = TARGETS[targetName]
if (!target) {
  fail(`Unknown build target "${requestedTarget}". Expected auto, dev, preview, test, prod, or cf.`)
}

// #168: fixed OSS web paths are opt-in; old Cloudflare and immutable release
// builds retain their existing artifact and router conventions.
const OSS_WEB_TARGETS = { ui: 'preview', dev: 'dev', test: 'test', prod: 'prod' }
const ossWebTarget = process.env.OSS_WEB_TARGET?.trim() ?? ''
if (ossWebTarget) {
  if (!(ossWebTarget in OSS_WEB_TARGETS) || OSS_WEB_TARGETS[ossWebTarget] !== targetName) {
    fail(`OSS_WEB_TARGET=${ossWebTarget} does not match the ${targetName} build target.`)
  }
  if (process.env.H5_OSS_ARTIFACT !== '1' || cloudflareBuildContext) {
    fail('Fixed-path OSS builds require H5_OSS_ARTIFACT=1 and must not use the Cloudflare target.')
  }
}
const ossWebPath = ossWebTarget
  ? `/kbs-web/${ossWebTarget === 'prod' ? 'prod/last' : ossWebTarget}`
  : ''

const fileEnv = loadEnv(target.mode, root, 'VITE_')
const readEnv = (key) => process.env[key] ?? fileEnv[key]
const errors = []

const explicitAppEnvironment = readEnv('VITE_APP_ENV')?.trim()
if (explicitAppEnvironment && explicitAppEnvironment !== target.appEnvironment) {
  errors.push(
    `VITE_APP_ENV=${explicitAppEnvironment} contradicts build target ${targetName} (${target.appEnvironment}).`,
  )
}

const rawDataMode = readEnv('VITE_DATA_MODE')?.trim()
const dataMode = rawDataMode || target.defaultDataMode
if (!DATA_MODES.has(dataMode)) errors.push(`Unknown VITE_DATA_MODE=${dataMode}. Expected mock or api.`)

const rawBridgeMode = readEnv('VITE_BRIDGE_MODE')?.trim()
const bridgeMode = rawBridgeMode || target.defaultBridgeMode
if (!BRIDGE_MODES.has(bridgeMode)) {
  errors.push(`Unknown VITE_BRIDGE_MODE=${bridgeMode}. Expected disabled, mock, or native.`)
}

const MALL_TARGETS = new Set(['kbs_shop', 'kbs_shop2'])
const mallTarget = readEnv('VITE_MALL_TARGET')?.trim() || 'kbs_shop'
if (!MALL_TARGETS.has(mallTarget)) {
  errors.push(
    `Unknown VITE_MALL_TARGET=${mallTarget}. Expected kbs_shop or kbs_shop2.`,
  )
}

const prodLike = target.appEnvironment === 'test' || target.appEnvironment === 'prod'
if (prodLike && dataMode === 'mock') {
  errors.push(`${target.appEnvironment} builds forbid VITE_DATA_MODE=mock; Mock fallback is not allowed.`)
}
if (prodLike && bridgeMode !== 'native') {
  errors.push(`${target.appEnvironment} builds require VITE_BRIDGE_MODE=native.`)
}
if (
  cloudflareBuildContext &&
  (target.appEnvironment === 'dev' || target.appEnvironment === 'preview') &&
  dataMode !== 'mock'
) {
  errors.push(`Cloudflare ${target.appEnvironment} builds are fixed to VITE_DATA_MODE=mock.`)
}

const configuredApiBaseUrl = readEnv('VITE_API_BASE_URL')?.trim() ?? ''
const apiBaseUrl =
  cloudflareBuildContext && (target.appEnvironment === 'dev' || target.appEnvironment === 'preview')
    ? ''
    : configuredApiBaseUrl
if (target.appEnvironment === 'test' && !apiBaseUrl) {
  errors.push('test builds require VITE_API_BASE_URL; a production-like test bundle must target a real backend.')
}
if (apiBaseUrl) {
  try {
    const parsed = new URL(apiBaseUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      errors.push('VITE_API_BASE_URL must use http:// or https://.')
    }
  } catch {
    errors.push('VITE_API_BASE_URL must be an absolute http(s) URL when provided.')
  }
}

const publicOrigin = readEnv('VITE_BUDDY_PUBLIC_ORIGIN')?.trim() ?? ''
if (dataMode === 'api' && prodLike && !publicOrigin && ossWebTarget !== 'prod') {
  errors.push(`${target.appEnvironment} API builds require VITE_BUDDY_PUBLIC_ORIGIN.`)
}
if (publicOrigin) {
  try {
    const url = new URL(publicOrigin)
    if (!(ossWebTarget === 'prod' ? ['http:', 'https:'].includes(url.protocol) : url.protocol === 'https:') ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      url.origin !== publicOrigin) {
      errors.push('VITE_BUDDY_PUBLIC_ORIGIN must be an exact http(s) origin without path, credentials, query or fragment.')
    }
  } catch {
    errors.push('VITE_BUDDY_PUBLIC_ORIGIN must be a valid HTTPS origin.')
  }
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`[build-h5] config error: ${error}`))
  process.exit(1)
}

const gitSha = commandOutput('git', ['rev-parse', 'HEAD'])
const gitBranch = commandOutput('git', ['branch', '--show-current'])
const buildSha =
  readEnv('VITE_BUILD_SHA')?.trim() ||
  process.env.CF_PAGES_COMMIT_SHA?.trim() ||
  process.env.GITHUB_SHA?.trim() ||
  gitSha ||
  'local'
const sourceBranch =
  readEnv('VITE_SOURCE_BRANCH')?.trim() ||
  process.env.CF_PAGES_BRANCH?.trim() ||
  process.env.GITHUB_HEAD_REF?.trim() ||
  process.env.GITHUB_REF_NAME?.trim() ||
  gitBranch ||
  'local'
const buildId =
  readEnv('VITE_BUILD_ID')?.trim() ||
  (process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}.${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`
    : `${target.appEnvironment}-${buildSha.slice(0, 12)}`)

const runtimeEnv = {
  VITE_APP_ENV: target.appEnvironment,
  VITE_DATA_MODE: dataMode,
  VITE_API_BASE_URL: apiBaseUrl,
  VITE_BUDDY_PUBLIC_ORIGIN: publicOrigin,
  VITE_BRIDGE_MODE: bridgeMode,
  VITE_MALL_TARGET: mallTarget,
  VITE_BUILD_SHA: buildSha,
  VITE_BUILD_ID: buildId,
  VITE_SOURCE_BRANCH: sourceBranch,
  ...(ossWebPath ? { VITE_ROUTER_BASENAME: ossWebPath } : {}),
}

const metadata = {
  schemaVersion: 1,
  viteMode: target.mode,
  appEnvironment: target.appEnvironment,
  dataMode,
  bridgeMode,
  mallTarget,
  apiBaseConfigured: Boolean(apiBaseUrl),
  buddyPublicOriginConfigured: Boolean(publicOrigin),
  ...(ossWebPath ? { ossWeb: { target: ossWebTarget, path: `${ossWebPath}/` } } : {}),
  build: {
    sha: buildSha,
    id: buildId,
    sourceBranch,
  },
}

console.log(
  `[build-h5] env=${metadata.appEnvironment} mode=${metadata.viteMode} data=${dataMode} bridge=${bridgeMode} branch=${sourceBranch} sha=${buildSha.slice(0, 12)} id=${buildId}`,
)
if (!apiBaseUrl) {
  console.warn('[build-h5] VITE_API_BASE_URL is empty; real backend integration remains blocked by H008.')
}

if (dryRun) {
  console.log(JSON.stringify(metadata))
  process.exit(0)
}

const viteBin = resolve(root, 'node_modules/vite/bin/vite.js')
const result = spawnSync(process.execPath, [viteBin, 'build', '--mode', target.mode], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...runtimeEnv },
})

if (result.status !== 0) process.exit(result.status ?? 1)

const mockWorkerPath = resolve(root, 'dist', 'mockServiceWorker.js')
if (dataMode === 'mock') {
  if (!existsSync(mockWorkerPath)) {
    fail('Mock build is missing dist/mockServiceWorker.js; MSW cannot start safely.')
  }
} else {
  rmSync(mockWorkerPath, { force: true })
  if (existsSync(mockWorkerPath)) {
    fail('API build leaked dist/mockServiceWorker.js after cleanup.')
  }
}

mkdirSync(resolve(root, 'dist'), { recursive: true })
writeFileSync(resolve(root, 'dist/build-meta.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
console.log('[build-h5] wrote dist/build-meta.json')

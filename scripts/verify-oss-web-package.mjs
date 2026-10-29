#!/usr/bin/env node
// #168: deterministic bundle assertions for the fixed OSS URL convention.
// This script is safe to run on PRs: it never accesses cloud credentials.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const target = process.argv[2]
const allowed = { ui: 'preview', dev: 'dev', test: 'test', prod: 'prod' }
if (!Object.hasOwn(allowed, target)) {
  throw new Error('Usage: node scripts/verify-oss-web-package.mjs ui|dev|test|prod')
}
const expectedBase = `/kbs-web/${target === 'prod' ? 'prod/last' : target}`
const root = join(process.cwd(), 'dist')
const meta = JSON.parse(readFileSync(join(root, 'build-meta.json'), 'utf8'))
const html = readFileSync(join(root, 'index.html'), 'utf8')
if (meta.appEnvironment !== allowed[target] ||
    meta.ossWeb?.path !== expectedBase + '/' ||
    meta.ossWeb?.target !== target) {
  throw new Error(`OSS package build identity mismatch for ${target}`)
}
if (target === 'test' || target === 'prod') {
  // API/origin readiness is business acceptance, not a prerequisite for
  // uploading a fixed-path test/prod bundle for human verification.
  if (meta.dataMode !== 'api' || meta.bridgeMode !== 'native' ||
      existsSync(join(root, 'mockServiceWorker.js'))) {
    throw new Error('Formal H5 cannot ship Mock or invalid Native bridge')
  }
} else if (meta.dataMode !== 'mock' || !existsSync(join(root, 'mockServiceWorker.js'))) {
  throw new Error('UI/development fixture bundle must preserve its Mock worker')
}
const assetBase = `${expectedBase}/assets/`
const urlRefs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1])
const jsRefs = urlRefs.filter(url => url.startsWith(assetBase) && url.endsWith('.js'))
const cssRefs = urlRefs.filter(url => url.startsWith(assetBase) && url.endsWith('.css'))
if (!jsRefs.length || !cssRefs.length) {
  throw new Error(`Missing fixed-path JS/CSS references below ${assetBase}`)
}
for (const url of urlRefs.filter(url => url.endsWith('.js') || url.endsWith('.css'))) {
  if (!url.startsWith(assetBase) || url.includes('..') ||
      !existsSync(join(root, url.slice(expectedBase.length + 1)))) {
    throw new Error(`Invalid or missing fixed-path static asset: ${url}`)
  }
}
const jsFiles = readdirSync(join(root, 'assets')).filter(name => name.endsWith('.js'))
if (!jsFiles.some(name => readFileSync(join(root, 'assets', name), 'utf8').includes(expectedBase))) {
  throw new Error(`React Router basename ${expectedBase} is absent from JS bundle`)
}
console.log(`OSS ${target}: ${expectedBase}/, relative JS/CSS, router, and runtime policy verified`)

import { z } from 'zod'
import { runtimePolicy } from '../app/config/runtime'
import { validateBuddyQrUrl } from './buddyQr'
import { fetchBackendBuddyList, fetchUserByIdentifyCode } from './buddyBackend'
import { fetchUserProfile } from './userProfile'

/**
 * #107 H5-only contract. #105 Backend and #110 Native have not signed their APIs:
 * no guessed HTTP route, user IDs or Native scan method may be used here.
 * In a later integration PR, wire a real authenticated adapter below.
 */
const memberSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
})
export type BuddyMember = z.infer<typeof memberSchema>

const previewSchema = z.object({
  inviter: memberSchema,
  relationship: z.enum(['available', 'self', 'already-buddies', 'unavailable']),
})
export type BuddyPreview = z.infer<typeof previewSchema> & { demo: boolean; confirmationAvailable?: boolean }
export type BuddyPreviewStatus = BuddyPreview['relationship']

const acceptSchema = z.object({
  result: z.enum(['accepted', 'already-buddies']),
})
const listSchema = z.object({ items: z.array(memberSchema) })

export interface BuddyRelationsBackend {
  trustedOrigin: string
  previewQr: (qrUrl: string) => Promise<unknown>
  acceptQr: (qrUrl: string) => Promise<unknown>
  list: () => Promise<unknown>
}

/** Backend Owner must explicitly supply a signed adapter; never silently use /api/friends CRUD. */
const signedBackend: BuddyRelationsBackend | null = null

export class BuddyRelationsError extends Error {
  constructor(readonly reason: 'not-configured' | 'invalid-code' | 'request-failed' | 'invalid-response') {
    super({
      'not-configured': '搭子关系接口尚未接通，请稍后再试',
      'invalid-code': '不是有效的洗头搭子二维码',
      'request-failed': '网络异常，请稍后重试',
      'invalid-response': '搭子服务返回异常，请稍后重试',
    }[reason])
    this.name = 'BuddyRelationsError'
  }
}

// This exact URL is only a demo marker in dev/preview. It cannot create real relationships.
export const MOCK_BUDDY_SCAN_URL =
  'https://test.dr-card-ui.pages.dev/buddy/invite/scan?demo=qr-preview-only-no-binding'

/** Only Native's future dedicated recognition callback may provide this state. */
export function readBuddyScanNavigation(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const scan = (value as { buddyScan?: unknown }).buddyScan
  if (!scan || typeof scan !== 'object' || Array.isArray(scan)) return null
  const { source, raw } = scan as { source?: unknown; raw?: unknown }
  return source === 'native-buddy-recognition' && typeof raw === 'string' &&
    raw.length > 0 && raw.length <= 2048 ? raw : null
}

/** QR recognition is always a complete, trusted HTTPS URL, never a naked UUID or an external query-driven action. */
export function parseBuddyInviteCode(raw: string, trustedOrigin: string): string {
  try {
    validateBuddyQrUrl(raw, trustedOrigin)
    const url = new URL(raw)
    const values = url.searchParams.getAll('code')
    if ([...url.searchParams.keys()].length !== 1 || values.length !== 1 ||
        !z.string().uuid().safeParse(values[0]).success) {
      throw new Error('unsupported QR parameters')
    }
    return values[0]!
  } catch {
    throw new BuddyRelationsError('invalid-code')
  }
}

function checkQr(raw: string, adapter?: BuddyRelationsBackend): boolean {
  // Reject obviously malformed QR data before the backend is wired. A well-formed
  // QR still requires #105's authenticated server verification, not a client-side guess.
  try {
    const url = new URL(raw)
    if (raw.trim() !== raw || raw.length > 2048 || url.protocol !== 'https:' ||
      url.username || url.password || url.hash || url.port ||
      url.pathname !== '/buddy/invite/scan' ||
      ![...url.searchParams.values()].some(v => v.length >= 16)) {
      throw new Error('unsupported QR')
    }
  } catch {
    throw new BuddyRelationsError('invalid-code')
  }
  if (runtimePolicy.dataMode === 'mock' && raw === MOCK_BUDDY_SCAN_URL && !adapter) return true
  if (!adapter) throw new BuddyRelationsError('not-configured')
  try {
    validateBuddyQrUrl(raw, adapter.trustedOrigin)
    return false
  } catch {
    throw new BuddyRelationsError('invalid-code')
  }
}

export async function previewBuddyQr(
  raw: string,
  adapter: BuddyRelationsBackend | null = signedBackend,
): Promise<BuddyPreview> {
  // #107 independent H5 slice: existing authenticated read-only backend endpoints.
  // Relation creation stays blocked until #105 provides its dedicated authorized QR acceptance.
  if (!adapter && runtimePolicy.dataMode === 'api') {
    const origin = import.meta.env.VITE_BUDDY_PUBLIC_ORIGIN
    if (!origin?.trim()) throw new BuddyRelationsError('not-configured')
    const code = parseBuddyInviteCode(raw, origin)
    try {
      const [inviter, profile, relations] = await Promise.all([
        fetchUserByIdentifyCode(code),
        fetchUserProfile(),
        fetchBackendBuddyList(),
      ])
      const relationship: BuddyPreviewStatus = profile.identifyCode === code
        ? 'self'
        : relations.items.some(member => member.id === inviter.id)
          ? 'already-buddies'
          : 'available'
      return { inviter, relationship, demo: false, confirmationAvailable: false }
    } catch (error) {
      if (error instanceof BuddyRelationsError) throw error
      throw new BuddyRelationsError('request-failed')
    }
  }
  const demo = checkQr(raw, adapter ?? undefined)
  if (demo) return {
    inviter: { id: 'demo-buddy-inviter', nickname: '演示搭子', avatarUrl: null },
    relationship: 'available',
    demo: true,
  }
  try {
    const parsed = previewSchema.safeParse(await adapter!.previewQr(raw))
    if (!parsed.success) throw new BuddyRelationsError('invalid-response')
    return { ...parsed.data, demo: false }
  } catch (error) {
    if (error instanceof BuddyRelationsError) throw error
    throw new BuddyRelationsError('request-failed')
  }
}

export async function acceptBuddyQr(
  raw: string,
  adapter: BuddyRelationsBackend | null = signedBackend,
): Promise<{ result: 'accepted' | 'already-buddies' | 'demo-only'; demo: boolean }> {
  const demo = checkQr(raw, adapter ?? undefined)
  // A preview never mutates the old in-memory buddy fixture or claims durable success.
  if (demo) return { result: 'demo-only', demo: true }
  try {
    const parsed = acceptSchema.safeParse(await adapter!.acceptQr(raw))
    if (!parsed.success) throw new BuddyRelationsError('invalid-response')
    return { ...parsed.data, demo: false }
  } catch (error) {
    if (error instanceof BuddyRelationsError) throw error
    throw new BuddyRelationsError('request-failed')
  }
}

export async function loadBuddyRelations(
  adapter: BuddyRelationsBackend | null = signedBackend,
): Promise<BuddyMember[]> {
  // This read-only relation list endpoint exists on kbs/API master@b6d2821.
  // QR preview/confirmation remain deliberately unavailable until #105 is implemented.
  if (!adapter && runtimePolicy.dataMode !== 'api') throw new BuddyRelationsError('not-configured')
  try {
    const parsed = listSchema.safeParse(adapter ? await adapter.list() : await fetchBackendBuddyList())
    if (!parsed.success) throw new BuddyRelationsError('invalid-response')
    return parsed.data.items
  } catch (error) {
    if (error instanceof BuddyRelationsError) throw error
    throw new BuddyRelationsError('request-failed')
  }
}

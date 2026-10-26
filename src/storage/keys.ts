import type { ZodType } from 'zod'
import { z } from 'zod'

export type StorageArea = 'local' | 'session'

export type StorageKey<T> = Readonly<{
  name: `dr-card:${string}`
  area: StorageArea
  schema: ZodType<T>
}>

/**
 * Storage keys are defined here, not next to pages or stores.
 *
 * H011 intentionally does not add a real business key: the formal H5 currently has
 * no confirmed persistence requirement, and authentication/token persistence is not
 * decided by this task.
 */
export function defineStorageKey<T>(
  name: string,
  area: StorageArea,
  schema: ZodType<T>,
): StorageKey<T> {
  return Object.freeze({
    name: `dr-card:${name}` as const,
    area,
    schema,
  })
}

/**
 * Add only explicitly confirmed persistence keys to this registry.
 * Do not add passwords, consumption/payment PINs, or long-lived secrets.
 */
export const STORAGE_KEYS = {
  authSession: defineStorageKey(
    'auth-session',
    'session',
    z.object({ accessToken: z.string().min(1) }),
  ),
  // User-confirmed UI preference: only retain a per-account six-dot mask flag
  // after successful profile update. Never persist the PIN or its digest.
  profilePinMasks: defineStorageKey(
    'profile-pin-masks',
    'local',
    z.record(z.string(), z.literal(true)),
  ),
} as const

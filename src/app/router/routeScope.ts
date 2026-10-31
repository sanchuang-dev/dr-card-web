import { ROUTES, findRouteByPathname, type RouteMeta } from './routes'

export type RouteOwnership = 'formal-h5' | 'native-reference'
export type RouteEngineeringScope = 'active' | 'deferred'

export interface RouteScopeMeta {
  ownership: RouteOwnership
  engineeringScope: RouteEngineeringScope
  reason?: string
}

export interface ScopedRouteMeta extends RouteMeta, RouteScopeMeta {}

/**
 * Native reference routes are explicit canonical route entries, not pathname-prefix guesses.
 *
 * Important:
 * - `/device/*`, `/vending/*` and the legacy sign-in flow do not contain `legacy`, but are still
 *   Native reference by product ownership.
 * - Keeping the list explicit makes ownership reviewable and prevents `/legacy` string matching
 *   from becoming the product boundary.
 * - These routes remain registered and directly viewable; H002 only removes them from the
 *   formal H5 engineering/test/debug surface.
 */
const NATIVE_REFERENCE_ROUTE_PATHS = new Set<string>([
  '/legacy-home',
  '/legacy-home/scan',
  '/device/:type',
  '/device/connecting',
  '/device/success',
  '/vending/buy',
  '/vending/order',
  '/signin',
  '/signin/detail',
  '/legacy-service',
  '/legacy-service/repair/projects',
  '/legacy-service/repair/form',
  '/legacy-service/feedback',
  '/legacy-profile',
  '/legacy-profile/info',
  '/legacy-profile/nickname',
  '/legacy-profile/email',
  '/legacy-profile/phone',
  '/legacy-profile/settings',
  '/legacy-profile/orders',
  '/legacy-profile/receipts',
  '/legacy-profile/receipts/:id',
  '/legacy-profile/devices/:type',
  '/legacy-profile/avatar-edit',
  '/legacy-profile/phone-change',
  '/legacy-profile/login',
  '/legacy-profile/edit',
  '/legacy-profile/bind-school',
  '/legacy-profile/register',
  '/legacy-profile/forgot-password',
  '/legacy-profile/machine-pin',
  '/legacy-profile/scratch-card',
  '/legacy-profile/my-cards',
  '/legacy-profile/coupons',
  '/legacy-profile/pickup-machine',
  '/legacy-profile/customer-service',
  '/legacy-profile/school-accounts',
  '/legacy-profile/recharge/:id',
  '/legacy-profile/school-refund/:id',
  '/legacy-profile/my-cards/:id',
  '/legacy-profile/my-cards/:id/topup',
  '/legacy-profile/my-cards/:id/topup/success',
  '/legacy-profile/my-cards/:id/topup/fail',
  '/legacy-profile/my-cards/:id/topup-records',
  '/legacy-profile/my-cards/:id/refund-records',
])

/**
 * Formal H5 routes that remain part of the product route graph but are intentionally outside
 * the current engineering round. The user explicitly deferred mall work; this metadata keeps
 * that decision separate from route ownership, so existing product navigation is unchanged.
 */
const DEFERRED_FORMAL_H5_ROUTE_PATHS = new Set<string>([
  '/mall',
  '/mall/goods/:id',
  '/mall/cart',
])

function resolveScope(route: RouteMeta): RouteScopeMeta {
  if (NATIVE_REFERENCE_ROUTE_PATHS.has(route.path)) {
    return {
      ownership: 'native-reference',
      engineeringScope: 'deferred',
      reason: 'Native reference: viewable for native colleagues, outside formal H5 construction and acceptance.',
    }
  }

  if (DEFERRED_FORMAL_H5_ROUTE_PATHS.has(route.path)) {
    return {
      ownership: 'formal-h5',
      engineeringScope: 'deferred',
      reason: 'Formal product route currently deferred from this H5 engineering round.',
    }
  }

  return {
    ownership: 'formal-h5',
    engineeringScope: 'active',
  }
}

function validateScopeRegistry() {
  const registeredPaths = new Set(ROUTES.map((route) => route.path))
  const declaredPaths = [
    ...NATIVE_REFERENCE_ROUTE_PATHS,
    ...DEFERRED_FORMAL_H5_ROUTE_PATHS,
  ]
  const unknownPaths = declaredPaths.filter((path) => !registeredPaths.has(path))
  const overlaps = [...NATIVE_REFERENCE_ROUTE_PATHS].filter((path) =>
    DEFERRED_FORMAL_H5_ROUTE_PATHS.has(path),
  )

  if (unknownPaths.length > 0 || overlaps.length > 0) {
    const problems = [
      unknownPaths.length > 0 ? `unknown route(s): ${unknownPaths.join(', ')}` : null,
      overlaps.length > 0 ? `scope overlap(s): ${overlaps.join(', ')}` : null,
    ].filter(Boolean)
    throw new Error(`Invalid route scope registry: ${problems.join('; ')}`)
  }
}

validateScopeRegistry()

export const SCOPED_ROUTES: ScopedRouteMeta[] = ROUTES.map((route) => ({
  ...route,
  ...resolveScope(route),
}))

export const FORMAL_H5_ROUTES = SCOPED_ROUTES.filter(
  (route) => route.ownership === 'formal-h5',
)

/** Preferred source for current H5 engineering, CI enumeration and future route-wide tooling. */
export const ACTIVE_FORMAL_H5_ROUTES = FORMAL_H5_ROUTES.filter(
  (route) => route.engineeringScope === 'active',
)

export const NATIVE_REFERENCE_ROUTES = SCOPED_ROUTES.filter(
  (route) => route.ownership === 'native-reference',
)

export const DEFERRED_FORMAL_H5_ROUTES = FORMAL_H5_ROUTES.filter(
  (route) => route.engineeringScope === 'deferred',
)

/** Runtime main navigation keeps all formal-H5 tabs, including temporarily deferred product areas. */
export const FORMAL_H5_TAB_ROUTES = FORMAL_H5_ROUTES
  .filter((route) => route.tab)
  .sort(
    (a, b) =>
      (a.tabOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.tabOrder ?? Number.MAX_SAFE_INTEGER),
  )

export function getRouteScope(route: RouteMeta): RouteScopeMeta {
  return resolveScope(route)
}

export function getRouteScopeByPathname(pathname: string): RouteScopeMeta | undefined {
  const route = findRouteByPathname(pathname)
  return route ? resolveScope(route) : undefined
}

export function isFormalH5Route(route: RouteMeta | undefined): route is RouteMeta {
  return Boolean(route && resolveScope(route).ownership === 'formal-h5')
}

export function isActiveFormalH5Route(route: RouteMeta | undefined): route is RouteMeta {
  if (!route) return false
  const scope = resolveScope(route)
  return scope.ownership === 'formal-h5' && scope.engineeringScope === 'active'
}

export function isNativeReferenceRoute(route: RouteMeta | undefined): route is RouteMeta {
  return Boolean(route && resolveScope(route).ownership === 'native-reference')
}

/** Exact tab match: child/detail routes do not display the bottom navigation. */
export function isFormalH5TabPath(pathname: string): boolean {
  return FORMAL_H5_TAB_ROUTES.some((route) => route.path === (pathname === '/index.html' ? '/' : pathname))
}

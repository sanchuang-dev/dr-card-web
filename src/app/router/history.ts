/**
 * React Router 6 BrowserHistory stores its managed entry index in history.state.idx.
 * This is intentionally not window.history.length: that counts document entries and cannot
 * answer whether the current H5 document has a previous SPA route.
 */
export function hasPreviousRouterEntry(historyState: unknown): boolean {
  if (typeof historyState !== 'object' || historyState === null) return false
  const index = (historyState as { idx?: unknown }).idx
  return typeof index === 'number' && Number.isSafeInteger(index) && index > 0
}

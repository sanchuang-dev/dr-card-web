import { describe, expect, it } from 'vitest'
import { hasPreviousRouterEntry } from './history'

describe('React Router history boundary', () => {
  it.each([
    ['missing state', null, false],
    ['missing index', {}, false],
    ['initial document entry', { idx: 0 }, false],
    ['previous H5 route exists', { idx: 1 }, true],
    ['multiple H5 routes exist', { idx: 3 }, true],
    ['negative index', { idx: -1 }, false],
    ['fractional index', { idx: 1.5 }, false],
    ['string index', { idx: '1' }, false],
  ])('classifies %s', (_label, state, expected) => {
    expect(hasPreviousRouterEntry(state)).toBe(expected)
  })
})

import { describe, expect, it } from 'vitest'
import { mergeStates } from './sync-merge.js'

// A per-exercise unit pin is one stamped choice per exercise (upstream #657): the pin with the
// later _ts wins, a cleared pin (the null tombstone) included, either way round.
const base = (over = {}) => ({
  unit: 'kg', restSec: 90, lang: 'en', week: { 1: ['r1'] }, dayPlan: {},
  workouts: [], routines: [], bodyweight: [], customEx: [], favEx: [], exWeights: {}, exNotes: {}, barWeights: {},
  equipProfiles: [], gymCards: [], _ts: 0, ...over
})

describe('per-exercise unit pins merge by their own stamp', () => {
  it('the later pin wins either way round, a clear included', () => {
    // Same copy stamp both sides, so only the pin's own _ts can decide.
    const pinned = base({ _ts: 5, exUnit: { X: { unit: 'kg', _ts: 5 } } })
    const cleared = base({ _ts: 5, exUnit: { X: { unit: null, _ts: 9 } } })
    expect(mergeStates(pinned, cleared).exUnit.X).toEqual({ unit: null, _ts: 9 })
    expect(mergeStates(cleared, pinned).exUnit.X).toEqual({ unit: null, _ts: 9 })
  })
})

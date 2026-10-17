// @vitest-environment happy-dom

/* The store action that pins one exercise to the other unit (issue #8): it hands the state to
 * lib/exercise-unit.js and keeps what comes back, so pinning during a workout converts the
 * stored history and the running entry at once. Calling it with the unit already in force must
 * leave the very same state object alone — a replace there would drop an Undo and a draft. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025'   // barbell bench press

// Profile lb, bench logged at 75, a session running with it at 75.
const LB = () => ({
  ...clone(DEF),
  unit: 'lb',
  exWeights: { [BENCH]: { w: 75, d: '2026-10-01' } },
  workouts: [{
    id: 'w0', d: '2026-10-01', start: 1, end: 2,
    entries: [{ id: BENCH, sets: [{ w: 75, r: 8, done: true }] }],
  }],
  active: { id: 'run', d: '2026-10-03', start: 5, name: 'Push', bw: null, cur: 0, entries: [{ id: BENCH, sets: [{ w: 75, r: 8, done: false }] }] },
})

beforeEach(() => { localStorage.clear(); api.mockReset() })
afterEach(() => { localStorage.clear(); useStore.setState({ S: clone(DEF), user: null, ready: false }) })

describe('pinning an exercise unit from the store', () => {
  it('pins the exercise and converts the history and the running entry', () => {
    useStore.setState({ S: LB(), user: null })
    useStore.getState().setExerciseUnit(BENCH, 'kg')

    const S = useStore.getState().S
    expect(S.exUnit[BENCH].unit).toBe('kg')
    expect(S.unit).toBe('lb')
    // 75 lb on the kg grid is 34 kg, stored back exactly.
    expect(S.workouts[0].entries[0].sets[0].w).toBe(74.9572)
    expect(S.exWeights[BENCH].w).toBe(74.9572)
    expect(S.active.entries[0].sets[0].w).toBe(34)
    expect(S.active.entries[0].unit).toBe('kg')
  })

  it('leaves the very same state when the exercise already uses that unit', () => {
    useStore.setState({ S: LB(), user: null })
    useStore.getState().setExerciseUnit(BENCH, 'kg')
    const afterPin = useStore.getState().S

    useStore.getState().setExerciseUnit(BENCH, 'kg')
    expect(useStore.getState().S).toBe(afterPin)
  })

  it('a profile without any pin carries an empty map', () => {
    expect(DEF.exUnit).toEqual({})
  })
})
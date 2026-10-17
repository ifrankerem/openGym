import { describe, expect, it } from 'vitest'
import { editCompletedSession, saveWorkoutEdit, editChangesNothing } from './session-edit.js'
import { buildCompletedWorkout } from './finish-workout.js'

// Editing a saved workout with a per-exercise unit pin (issue #6): profile lb, dumbbell
// incline press pinned to kg. The stored record is shaped the way a finish wrote it; the
// editor opens it at 35 kg; saving converts back, so an untouched draft leaves the record
// byte-for-byte as it was.
const PINNED = '3545'   // dumbbell incline alternate press

const loggedEntry = (w, r) => ({
  id: PINNED,
  target: { mode: 'reps', sets: 1, reps: 10, weight: 77.1618 },
  planned: { sets: 1, reps: 10, weight: 77.1618 },
  sets: [{ w, r, done: true }],
})
const fixture = () => ({
  unit: 'lb',
  exUnit: { [PINNED]: { unit: 'kg', _ts: 1 } },
  exWeights: {},
  routines: [],
  active: null,
  workouts: [buildCompletedWorkout(
    { id: 'w1', d: '2026-10-01', start: 1000, name: 'Push', entries: [loggedEntry(77.1618, 10)] },
    { end: 2000, prs: [] },
  )],
})

describe('saved workout editing with a per-exercise unit pin', () => {
  it('opens the pinned exercise in its unit', () => {
    const state = fixture()
    editCompletedSession(state, 'w1')
    const [entry] = state.active.entries
    expect(entry.sets.map(s => [s.w, s.r])).toEqual([[35, 10]])
    expect(entry.unit).toBe('kg')
  })

  it('an untouched draft changes nothing and saves nothing', () => {
    const state = fixture()
    const before = structuredClone(state.workouts)
    editCompletedSession(state, 'w1')
    expect(editChangesNothing(state)).toBe(true)
    const saved = saveWorkoutEdit(state)
    expect(saved).toBe(state.workouts[0])
    expect(state.workouts).toEqual(before)
    expect(JSON.stringify(state.workouts[0])).not.toContain('"unit"')
  })

  it('editing the set to 36 kg stores 79.3664 lb with no stamp', () => {
    const state = fixture()
    editCompletedSession(state, 'w1')
    state.active.entries[0].sets[0].w = 36
    expect(editChangesNothing(state)).toBe(false)
    const saved = saveWorkoutEdit(state)
    expect(saved.entries[0].sets.map(s => [s.w, s.r])).toEqual([[79.3664, 10]])
    expect('unit' in saved.entries[0]).toBe(false)
  })
})

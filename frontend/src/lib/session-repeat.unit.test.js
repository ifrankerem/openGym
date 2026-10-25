import { describe, expect, it } from 'vitest'
import { repeatSessionEntries } from './session-repeat.js'

// "Repeat today" puts a pinned exercise in its own unit (upstream #657): profile lb, dumbbell
// incline press pinned to kg, logged at 77.1618 lb × 10. An unpinned exercise repeats as today.
const PINNED = '3545'   // dumbbell incline alternate press
const PLAIN = '0043'    // barbell squat

const st = (over = {}) => ({
  unit: 'lb', exUnit: { [PINNED]: { unit: 'kg', _ts: 1 } },
  workouts: [], exWeights: {}, routines: [], ...over,
})
const logged = (id, w, r, weight) => ({
  id, target: { mode: 'reps', sets: 1, reps: r, weight }, sets: [{ w, r, done: true }],
})
const workout = () => ({
  id: 'w1', d: '2026-10-01', start: 1, end: 2, name: 'Push',
  entries: [logged(PINNED, 77.1618, 10, 77.1618), logged(PLAIN, 100, 5, 100)],
})

describe('repeat today with a per-exercise unit pin', () => {
  it('repeats the pinned exercise in its unit and leaves the rest as today', () => {
    const { entries, skipped } = repeatSessionEntries(st(), workout())
    expect(skipped).toBe(0)
    const pinned = entries.find(e => e.id === PINNED)
    expect(pinned.sets.map(s => [s.w, s.r])).toEqual([[35, 10]])
    expect(pinned.sets.every(s => s.done === false)).toBe(true)
    expect(pinned.unit).toBe('kg')
    const plain = entries.find(e => e.id === PLAIN)
    expect('unit' in plain).toBe(false)
    expect(plain.sets.map(s => [s.w, s.r])).toEqual([[100, 5]])
  })
})

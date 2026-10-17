import { describe, expect, it } from 'vitest'
import { convertStateUnit } from './units.js'

// The profile-wide kg ↔ lb switch with an exercise pinned (issue #11): a pinned exercise's
// weights convert exactly, so a number stored for its own unit comes back unchanged, while every
// other exercise keeps landing on the new unit's plate grid.
const PRESS = '3545'   // dumbbell incline alternate press
const BENCH = '0025'   // barbell bench press
const done = (w, r) => ({ w, r, done: true })

const state = (unit, pin, over = {}) => ({
  unit,
  exUnit: pin ? { [PRESS]: { unit: pin, _ts: 1 } } : {},
  exWeights: { [PRESS]: { w: over.exW ?? 0, d: '2026-10-01' }, [BENCH]: { w: over.benchW ?? 0, d: '2026-10-01' } },
  barWeights: {},
  routines: [{ id: 'r1', name: 'Push', ex: [{ id: PRESS, sets: 3, reps: 10, weight: over.pressW ?? 0, inc: over.pressInc ?? 0, mode: 'reps' }, { id: BENCH, sets: 3, reps: 5, weight: over.benchW ?? 0, mode: 'reps' }] }],
  workouts: [{
    id: 'w1', d: '2026-10-01', start: 1, end: 2, routineIds: ['r1'],
    entries: [
      { id: PRESS, target: { mode: 'reps', sets: 3, reps: 10, weight: over.pressW ?? 0 }, sets: [done(over.pressW ?? 0, 10)] },
      { id: BENCH, target: { mode: 'reps', sets: 3, reps: 5, weight: over.benchW ?? 0 }, sets: [done(over.benchW ?? 0, 5)] },
    ],
  }],
  active: over.active || null,
  ...(over.rest || {}),
})

const pressW = S => S.workouts[0].entries[0].sets[0].w
const benchW = S => S.workouts[0].entries[1].sets[0].w
const slotW = S => S.routines[0].ex[0].weight

describe('profile unit switch with a pinned exercise', () => {
  it('lb to kg converts the pinned exercise exactly, not onto the kg grid', () => {
    // 135 lb is 61.235 kg exactly; the grid would say 61.25.
    const S = state('lb', 'kg', { pressW: 135, exW: 135 })
    const out = convertStateUnit(S, 'kg')
    expect(pressW(out)).toBe(61.235)
    expect(out.exWeights[PRESS].w).toBe(61.235)
    expect(slotW(out)).toBe(61.235)
    expect(out.exUnit).toEqual({ [PRESS]: { unit: 'kg', _ts: 1 } })
  })

  it('kg to lb keeps the pinned exercise exact while the rest lands on the lb grid', () => {
    // 35 kg is 77.1618 lb; the lb grid would say 77.
    const S = state('kg', 'kg', { pressW: 35, exW: 35, benchW: 60 })
    const out = convertStateUnit(S, 'lb')
    expect(pressW(out)).toBe(77.1618)
    expect(out.exWeights[PRESS].w).toBe(77.1618)
    expect(slotW(out)).toBe(77.1618)
    expect(benchW(out)).toBe(132.5)
  })

  it('leaves a running pinned entry alone and converts the others as today', () => {
    const S = state('kg', 'kg', {
      pressW: 35, benchW: 60,
      active: {
        id: 'run', d: '2026-10-02', start: 5, name: 'Push', bw: null, cur: 0,
        entries: [
          { id: PRESS, unit: 'kg', target: { mode: 'reps', sets: 3, reps: 10, weight: 35 }, sets: [{ w: 35, r: 10, done: false }] },
          { id: BENCH, target: { mode: 'reps', sets: 3, reps: 5, weight: 60 }, sets: [{ w: 60, r: 5, done: false }] },
        ],
      },
    })
    const out = convertStateUnit(S, 'lb')
    const [pressed, benched] = out.active.entries
    expect(pressed.sets[0].w).toBe(35)
    expect(pressed.unit).toBe('kg')
    expect(benched.sets[0].w).toBe(132.5)
  })

  it('a profile with no pin converts exactly as it always did', () => {
    const S = state('kg', null, { pressW: 35, benchW: 60 })
    const out = convertStateUnit(S, 'lb')
    expect(pressW(out)).toBe(77)
    expect(benchW(out)).toBe(132.5)
  })
})
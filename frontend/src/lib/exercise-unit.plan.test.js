import { describe, it, expect } from 'vitest'
import { setExerciseUnit } from './exercise-unit.js'
import { convertWeight } from './units.js'

// Switching one exercise's weight unit mid-session (issue #40, upstream #657): a pinned
// exercise's progression line moves with its entry, in the same pass that converts the rows —
// plan.weight and every load in plan.why onto the entry's new unit's grid, everything else
// (reps, sets, stall counts) left as it is.
const X = '0025'   // barbell bench press
const Y = '0043'   // barbell squat
const WHY_UP = 'Every rep last time. {0} {1} more.'
const WHY_DELOAD = 'Stuck for {0} sessions. Deload to {1} {2} and start again at {3} sets of {4}.'

// A kg profile with two planned entries running: X's plan is the one that moves, Y's is the
// bystander whose entry object must come through untouched.
const state = plan => ({
  unit: 'kg',
  active: {
    id: 'a1', d: '2026-10-03', start: 1, name: 'A', bw: null, cur: 0,
    entries: [
      {
        id: X,
        target: { mode: 'reps', sets: 1, reps: 8, weight: 60 },
        sets: [{ w: 60, r: 8, done: false }],
        plan,
      },
      {
        id: Y,
        target: { mode: 'reps', sets: 1, reps: 8, weight: 80 },
        sets: [{ w: 80, r: 8, done: false }],
        plan: { kind: 'up', weight: 100, why: [WHY_UP, 5, 'kg'] },
      },
    ],
  },
})

describe('the switch moves the progression line with the entry (#40)', () => {
  it('moves plan.weight and the load args of plan.why onto the new unit', () => {
    const out = setExerciseUnit(state({ kind: 'up', weight: 12.5, why: [WHY_UP, 2.5, 'kg'] }), X, 'lb', 1)
    expect(out.active.entries[0].plan.weight).toBe(convertWeight(12.5, 'kg', 'lb'))
    expect(out.active.entries[0].plan.why)
      .toEqual([WHY_UP, convertWeight(2.5, 'kg', 'lb'), 'lb'])
  })

  it('moving back to the profile unit converts the line the same way', () => {
    const out = setExerciseUnit(setExerciseUnit(state({ kind: 'up', weight: 12.5, why: [WHY_UP, 2.5, 'kg'] }), X, 'lb', 1), X, 'kg', 2)
    expect(out.active.entries[0].plan.weight).toBe(12.5)
    expect(out.active.entries[0].plan.why).toEqual([WHY_UP, 2.5, 'kg'])
  })

  it('leaves the args that are not loads alone', () => {
    const out = setExerciseUnit(state({ kind: 'off', why: [WHY_DELOAD, 3, 50, 'kg', 3, 8] }), X, 'lb', 1)
    expect(out.active.entries[0].plan.why).toEqual([WHY_DELOAD, 3, convertWeight(50, 'kg', 'lb'), 'lb', 3, 8])
  })

  it('a plan without a why, or with kind off, is left as it is', () => {
    const off = { kind: 'off' }
    const out = setExerciseUnit(state(off), X, 'lb', 1)
    expect(out.active.entries[0].plan).toEqual(off)
  })

  it('an entry other than the one switched is not touched', () => {
    const S = state()
    const bystander = S.active.entries[1]
    const out = setExerciseUnit(S, X, 'lb', 1)
    expect(out.active.entries[1]).toBe(bystander)
  })
})

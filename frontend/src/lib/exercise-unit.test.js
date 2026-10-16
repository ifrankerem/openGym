import { describe, it, expect } from 'vitest'
import {
  UNIT_PLACES_STORED, UNIT_PLACES_SHOWN, convertExact, unitPinOf, exerciseUnit,
  canPinUnit, exerciseView, entryToProfileUnit, setExerciseUnit,
} from './exercise-unit.js'
import { EXDB } from './exercises.js'

// The pure core of a per-exercise weight unit (issue #5): which unit an exercise uses, a
// read-only view of the state in that unit, the conversions at its edges, and the switch.
const X = '0025'   // barbell bench press
const Y = '0043'   // barbell squat
const CARDIO = EXDB.find(e => e.bp === 'cardio').id
const clone = o => JSON.parse(JSON.stringify(o))

describe('exercise unit pins', () => {
  it('exerciseUnit reports the pin, else the profile unit, else kg', () => {
    expect(exerciseUnit({ unit: 'lb' }, X)).toBe('lb')
    expect(exerciseUnit({ unit: 'lb', exUnit: { [X]: { unit: 'kg', _ts: 1 } } }, X)).toBe('kg')
    expect(exerciseUnit({ unit: 'lb', exUnit: { [X]: { unit: null, _ts: 2 } } }, X)).toBe('lb')
    expect(exerciseUnit({}, X)).toBe('kg')
  })

  it('unitPinOf reads only S.exUnit', () => {
    expect(unitPinOf({ unit: 'lb' }, X)).toBeNull()
    expect(unitPinOf({ exUnit: { [X]: { unit: 'kg', _ts: 1 } } }, X)).toBe('kg')
    expect(unitPinOf({ unit: 'lb', exUnit: { [X]: { unit: null, _ts: 2 } } }, X)).toBeNull()
  })

  it('only non-cardio exercises can be pinned', () => {
    expect(canPinUnit({ id: X, mode: 'reps' })).toBe(true)
    expect(canPinUnit({ id: X, mode: 'time' })).toBe(true)
    expect(canPinUnit(EXDB.find(e => e.bp === 'cardio'))).toBe(false)
    expect(canPinUnit({ id: CARDIO })).toBe(false)
  })
})

describe('convertExact', () => {
  it('stores the decimal places the binding names', () => {
    expect(UNIT_PLACES_STORED).toBe(4)
    expect(UNIT_PLACES_SHOWN).toBe(3)
  })

  it('converts with the profile factor, exactly', () => {
    expect(convertExact(35, 'kg', 'lb')).toBe(77.1618)
    expect(convertExact(77.1618, 'lb', 'kg', 3)).toBe(35)
    expect(convertExact(35.25, 'kg', 'lb')).toBe(77.7129)
    expect(convertExact(77.7129, 'lb', 'kg', 3)).toBe(35.25)
  })

  it('passes empty and same-unit values through untouched', () => {
    expect(convertExact(null, 'kg', 'lb')).toBeNull()
    expect(convertExact(undefined, 'kg', 'lb')).toBeUndefined()
    expect(convertExact('', 'kg', 'lb')).toBe('')
    expect(Number.isNaN(convertExact(NaN, 'kg', 'lb'))).toBe(true)
    expect(convertExact(35, 'kg', 'kg')).toBe(35)
  })
})

// Profile lb, X pinned to kg. One workout with an X entry (a straight set, a drop set row and
// a per-side row, topW, target and planned) next to a Y entry.
const lbState = () => ({
  unit: 'lb',
  exUnit: { [X]: { unit: 'kg', _ts: 1 } },
  exWeights: { [X]: { w: 77.1618 }, [Y]: { w: 100 } },
  barWeights: { [X]: 44.0925, Z: 0 },
  routines: [
    { id: 'r1', name: 'R1', ex: [{ id: X, sets: 3, reps: 10, weight: 77.1618, inc: 5.5116, warmup: [{ weight: 44.0925 }], pyramidWeight: [77.1618, 0] }] },
    { id: 'r2', name: 'R2', ex: [{ id: Y, sets: 3, reps: 10, weight: 100 }] },
  ],
  workouts: [{
    id: 'w1', d: '2026-10-01', start: 1, end: 2,
    entries: [
      {
        id: X, topW: 77.1618, target: { weight: 77.1618, inc: 5.5116 }, planned: { weight: 77.1618 },
        sets: [
          { w: 77.1618, r: 10, done: true },
          { w: 55.1156, r: 6, done: true, type: 'dropset', drops: [{ w: 55.1156, r: 6 }] },
          {
            w: 77.1618, r: 20, done: true,
            sides: { L: { w: 77.1618, r: 10, done: true }, R: { w: 77.1618, r: 10, done: true } },
          },
        ],
      },
      { id: Y, sets: [{ w: 100, r: 5, done: true }] },
    ],
  }, {
    id: 'w2', d: '2026-10-02', start: 3, end: 4,
    entries: [{ id: Y, sets: [{ w: 100, r: 5, done: true }] }],
  }],
  bodyweight: [{ d: '2026-10-01', w: 176.4 }],
  targetW: 176.4,
  active: null,
})

describe('exerciseView', () => {
  it('returns the state itself when the exercise follows the profile unit', () => {
    const S = { unit: 'lb', exWeights: {} }
    expect(exerciseView(S, X)).toBe(S)
  })

  it('converts the pinned exercise entries, drops included, sides in sync', () => {
    const S = lbState()
    const view = exerciseView(S, X)
    expect(view).not.toBe(S)
    expect(view.unit).toBe('kg')
    const [straight, dropped, sided] = view.workouts[0].entries[0].sets
    expect(straight.w).toBe(35)
    expect(dropped.w).toBe(25)
    expect(dropped.drops).toEqual([{ w: 25, r: 6 }])
    expect(sided.sides).toEqual({
      L: { w: 35, r: 10, done: true },
      R: { w: 35, r: 10, done: true },
    })
    expect(sided.w).toBe(35)
    expect(sided.r).toBe(20)
    const entry = view.workouts[0].entries[0]
    expect(entry.topW).toBe(35)
    expect(entry.target).toEqual({ weight: 35, inc: 2.5 })
    expect(entry.planned).toEqual({ weight: 35 })
    expect(view.workouts[0].entries[1]).toBe(S.workouts[0].entries[1])
  })

  it('converts the pinned maps, slots and body weight, and shares the rest', () => {
    const S = lbState()
    const view = exerciseView(S, X)
    expect(view.exWeights[X]).toEqual({ w: 35 })
    expect(view.exWeights[Y]).toBe(S.exWeights[Y])
    expect(view.barWeights[X]).toBe(20)
    expect(view.barWeights.Z).toBe(0)
    expect(view.routines[0].ex[0]).toEqual({
      id: X, sets: 3, reps: 10, weight: 35, inc: 2.5,
      warmup: [{ weight: 20 }], pyramidWeight: [35, 0],
    })
    expect(view.routines[1]).toBe(S.routines[1])
    expect(view.workouts[1]).toBe(S.workouts[1])
    expect(view.bodyweight).toEqual([{ d: '2026-10-01', w: 80 }])
    expect(view.targetW).toBe(80)
  })

  it('never mutates the input', () => {
    const S = lbState()
    const snapshot = clone(S)
    exerciseView(S, X)
    expect(S).toEqual(snapshot)
  })

  it('converts active entries into the pin unit and stamps them', () => {
    const S = {
      ...lbState(),
      active: {
        id: 'a1', d: '2026-10-02', start: 5, entries: [
          { id: X, unit: 'kg', sets: [{ w: 35, r: 8, done: false }] },
          { id: X, sets: [{ w: 77.1618, r: 8, done: true }] },
          { id: Y, sets: [{ w: 100, r: 5, done: true }] },
        ],
      },
    }
    const view = exerciseView(S, X)
    expect(view.active.entries[0]).toBe(S.active.entries[0])
    expect(view.active.entries[0].sets[0].w).toBe(35)
    expect(view.active.entries[1].sets[0].w).toBe(35)
    expect(view.active.entries[1].unit).toBe('kg')
    expect(view.active.entries[2]).toBe(S.active.entries[2])
  })
})

describe('setExerciseUnit', () => {
  const profileLb = () => ({
    unit: 'lb',
    exWeights: { [X]: { w: 77 }, [Y]: { w: 100 } },
    barWeights: {},
    routines: [{ id: 'r1', name: 'R1', ex: [
      { id: X, sets: 3, reps: 10, weight: 75 },
      { id: Y, sets: 3, reps: 10, weight: 100 },
    ] }],
    workouts: [
      { id: 'w1', d: '2026-10-01', start: 1, end: 2, vol: 770, entries: [{ id: X, sets: [{ w: 77, r: 10, done: true }] }] },
      { id: 'w2', d: '2026-10-02', start: 3, end: 4, entries: [{ id: X, sets: [{ w: 77.5, r: 8, done: true }] }] },
    ],
    bodyweight: [{ d: '2026-10-01', w: 176.4 }],
    active: { id: 'a1', d: '2026-10-02', start: 5, entries: [{ id: X, sets: [{ w: 77, r: 10, done: false }] }] },
  })

  it('pinning snaps the stored weights onto the new grid, exactly', () => {
    const S = profileLb()
    const snapshot = clone(S)
    const out = setExerciseUnit(S, X, 'kg', 42)
    expect(out).not.toBe(S)
    expect(S).toEqual(snapshot)
    expect(out.exUnit[X]).toEqual({ unit: 'kg', _ts: 42 })
    expect(out.unit).toBe('lb')
    expect(out.workouts[0].entries[0].sets[0].w).toBe(77.1618)
    expect(out.workouts[1].entries[0].sets[0].w).toBe(77.7129)
    expect(out.routines[0].ex[0].weight).toBe(74.9572)
    expect(out.routines[0].ex[1].weight).toBe(100)
    expect(out.exWeights[X]).toEqual({ w: 77.1618 })
    expect(out.active.entries[0].sets[0].w).toBe(35)
    expect(out.active.entries[0].unit).toBe('kg')
    expect(out.bodyweight).toEqual([{ d: '2026-10-01', w: 176.4 }])
    expect(out.workouts[0].vol).toBe(77.1618 * 10)
    expect('vol' in out.workouts[1]).toBe(false)
  })

  it('unpinning snaps back onto the profile grid and drops the stamp', () => {
    const S = {
      unit: 'lb',
      exUnit: { [X]: { unit: 'kg', _ts: 1 } },
      exWeights: { [X]: { w: 77.1618 } },
      barWeights: {},
      routines: [{ id: 'r1', name: 'R1', ex: [{ id: X, sets: 3, reps: 10, weight: 74.9572 }] }],
      workouts: [{
        id: 'w1', d: '2026-10-01', start: 1, end: 2,
        entries: [{ id: X, sets: [{ w: 77.1618, r: 10, done: true }, { w: 77.7129, r: 8, done: true }] }],
      }],
      bodyweight: [],
      active: { id: 'a1', d: '2026-10-02', start: 3, entries: [{ id: X, unit: 'kg', sets: [{ w: 35, r: 10, done: false }] }] },
    }
    const out = setExerciseUnit(S, X, 'lb', 43)
    expect(out.exUnit[X]).toEqual({ unit: null, _ts: 43 })
    expect(out.workouts[0].entries[0].sets.map(s => s.w)).toEqual([77, 77.5])
    expect(out.routines[0].ex[0].weight).toBe(75)
    expect(out.exWeights[X]).toEqual({ w: 77 })
    expect(out.active.entries[0].sets[0].w).toBe(77)
    expect('unit' in out.active.entries[0]).toBe(false)
  })

  it('returns the state itself for a no-op, a bad unit or a cardio exercise', () => {
    const S = { unit: 'lb', exWeights: {} }
    expect(setExerciseUnit(S, X, 'lb', 1)).toBe(S)
    expect(setExerciseUnit(S, X, 'stone', 1)).toBe(S)
    expect(setExerciseUnit({ unit: 'kg', exWeights: {} }, CARDIO, 'lb', 1).unit).toBe('kg')
    const pinned = { unit: 'kg', exWeights: {}, exUnit: { [CARDIO]: { unit: 'kg', _ts: 1 } } }
    expect(setExerciseUnit(pinned, CARDIO, 'lb', 1)).toBe(pinned)
  })
})

describe('entryToProfileUnit', () => {
  const entry = () => ({ id: X, unit: 'kg', sets: [{ w: 35, r: 8 }], target: { weight: 35, inc: 2.5 }, topW: 35 })

  it('converts a stamped entry back into the profile unit and drops the stamp', () => {
    expect(entryToProfileUnit(entry(), 'lb')).toEqual({
      id: X, sets: [{ w: 77.1618, r: 8 }], target: { weight: 77.1618, inc: 5.5116 }, topW: 77.1618,
    })
  })

  it('drops the stamp when the entry is already in the profile unit', () => {
    expect(entryToProfileUnit(entry(), 'kg')).toEqual({
      id: X, sets: [{ w: 35, r: 8 }], target: { weight: 35, inc: 2.5 }, topW: 35,
    })
  })

  it('returns an unstamped entry as the same object', () => {
    const plain = { id: X, sets: [{ w: 77.1618, r: 8 }] }
    expect(entryToProfileUnit(plain, 'lb')).toBe(plain)
  })
})

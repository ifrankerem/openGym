import { describe, it, expect } from 'vitest'
import { buildSessionEntries } from './session-start.js'
import { isWarmupRow } from './workout-model.js'

// A planned session builds a pinned exercise in its own unit (upstream #657): profile lb, bench
// pinned to kg. 77.1618 lb is 35 kg, inc 5.5116 lb is 2.5 kg, 44.0925 lb is 20 kg.
const BENCH = '0025'
const SQUAT = '0043'
const benchCfg = (over = {}) => ({ id: BENCH, sets: 3, reps: 8, weight: 77.1618, inc: 5.5116, prog: 'linear', mode: 'reps', ...over })
const doneWork = (w, r) => ({ w, r, done: true })
const doneWarmup = (w, r) => ({ w, r, done: true, phase: 'warmup', warmup: true })

const historyEntry = sets => ({
  id: BENCH, rid: 'r1',
  target: { ...benchCfg() },
  planned: { sets: 3, reps: 8, weight: 77.1618 },
  sets,
})
const state = (sets, over = {}) => ({
  unit: 'lb',
  exUnit: { [BENCH]: { unit: 'kg', _ts: 1 } },
  exWeights: {}, barWeights: {}, routines: [{ id: 'r1', name: 'R1', ex: [benchCfg()] }],
  workouts: [{ id: 'w0', d: '2026-10-01', start: 1, end: 2, routineIds: ['r1'], entries: [historyEntry(sets)] }],
  week: {}, dayPlan: {}, ...over,
})
const workRows = entry => entry.sets.filter(s => !isWarmupRow(s))
const warmRows = entry => entry.sets.filter(isWarmupRow)

describe('planned session builds a pinned exercise in its own unit', () => {
  it('linear progression prescribes in kg and stamps the entry', () => {
    const st = state([doneWork(77.1618, 8), doneWork(77.1618, 8), doneWork(77.1618, 8)])
    const [entry] = buildSessionEntries(st, st.routines[0])
    expect(entry.unit).toBe('kg')
    expect(workRows(entry).map(s => [s.w, s.r])).toEqual([[37.5, 8], [37.5, 8], [37.5, 8]])
    expect(entry.target.weight).toBe(37.5)
    expect(entry.target.inc).toBe(2.5)
    expect(entry.planned).toEqual({ sets: 3, reps: 8, weight: 35 })
  })

  it('a logged warm-up is carried in kg under startFrom last', () => {
    const st = state([doneWarmup(44.0925, 12), doneWork(77.1618, 8), doneWork(77.1618, 8), doneWork(77.1618, 8)], { startFrom: 'last' })
    const [entry] = buildSessionEntries(st, st.routines[0])
    expect(entry.unit).toBe('kg')
    expect(warmRows(entry).map(s => [s.w, s.r])).toEqual([[20, 12]])
    expect(warmRows(entry).every(s => s.done === false)).toBe(true)
    expect(workRows(entry).map(s => s.w)).toEqual([37.5, 37.5, 37.5])
  })

  it('the ramp floors against the kg bar, not the lb one', () => {
    const cfg = benchCfg({ warmupSets: 2 })
    const st = state([doneWork(77.1618, 8), doneWork(77.1618, 8), doneWork(77.1618, 8)],
      { routines: [{ id: 'r1', name: 'R1', ex: [cfg] }] })
    const [entry] = buildSessionEntries(st, st.routines[0])
    expect(entry.unit).toBe('kg')
    expect(warmRows(entry)).toHaveLength(2)
    expect(warmRows(entry).every(s => s.w >= 20 && s.w < 37.5)).toBe(true)
  })

  it('an unpinned exercise builds exactly as without any pin', () => {
    const squat = { id: SQUAT, sets: 3, reps: 10, weight: 100, prog: 'linear', mode: 'reps' }
    const routine = { id: 'r1', name: 'R1', ex: [benchCfg(), squat] }
    const st = state([doneWork(77.1618, 8), doneWork(77.1618, 8), doneWork(77.1618, 8)], { routines: [routine] })
    const [, pinned] = buildSessionEntries(st, routine)
    const [, plain] = buildSessionEntries({ ...st, exUnit: {} }, routine)
    expect('unit' in pinned).toBe(false)
    expect(pinned).toEqual(plain)
  })

  // Upstream #657's carry case: two warm-ups logged last time, stored in the profile's lb, carried
  // into the pinned build as the kg rows they were logged as.
  it('carries both logged warm-ups in kg, their lb storage read through the view', () => {
    const st = state([
      doneWarmup(44.0925, 10), doneWarmup(88.1849, 5),
      doneWork(77.1618, 8), doneWork(77.1618, 8), doneWork(77.1618, 8),
    ], { startFrom: 'last' })
    const [entry] = buildSessionEntries(st, st.routines[0])
    expect(entry.unit).toBe('kg')
    expect(warmRows(entry).map(s => [s.w, s.r])).toEqual([[20, 10], [40, 5]])
    expect(warmRows(entry).every(s => s.done === false)).toBe(true)
    expect(workRows(entry).map(s => s.w)).toEqual([37.5, 37.5, 37.5])
  })
})

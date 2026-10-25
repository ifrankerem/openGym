// @vitest-environment happy-dom
// The Apple Watch reads a pinned exercise in the profile unit (upstream #657): the snapshot and
// the watch's ticks travel in the profile's unit, and the phone converts at the edge — the pin's
// rows leave home as the profile's numbers and every tick comes back to them exactly.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSnapshot, applyEvents, bindWatchActions, bindWatchAppActions, _resetWatchSync, SNAPSHOT_VERSION } from './watch-sync.js'
import { UNIT_PLACES_STORED, UNIT_PLACES_SHOWN } from './exercise-unit.js'
import { convertExact } from './exercise-unit.js'

// lb profile, the bench press pinned to kg (the state the switch builds, lib/exercise-unit.js):
// its running entry carries the unit stamp and kg rows, the unpinned squat beside it holds the
// profile's numbers.
const BENCH_KG = { id: '0025', unit: 'kg', target: { mode: 'reps', sets: 3, reps: 8, weight: 35 }, sets: [{ w: 35, r: 8, done: false }] }
const SQUAT_LB = { id: '0043', target: { mode: 'reps', sets: 3, reps: 5, weight: 135 }, sets: [{ w: 135, r: 5, done: false }] }

const state = (over = {}) => ({
  unit: 'lb', restSec: 90, routines: [],
  active: { id: 'w-1', name: 'Push', cur: 0, d: '2026-10-13', entries: [BENCH_KG, SQUAT_LB] },
  ...over,
})
const pinnedState = over => state({ exUnit: { '0025': { unit: 'kg', _ts: 1 } }, ...over })

beforeEach(() => { localStorage.clear(); _resetWatchSync() })
afterEach(() => { _resetWatchSync(); vi.restoreAllMocks() })

describe('the snapshot carries a pinned exercise in the profile unit (upstream #657)', () => {
  it('sends the pinned rows as the profile stores them, with the profile unit', () => {
    const snap = buildSnapshot(pinnedState())
    expect(snap.v).toBe(SNAPSHOT_VERSION)
    expect(snap.active.unit).toBe('lb')
    // 35 kg on the pin's grid leaves home as 77.1618 lb, not as 35 under an lb label.
    expect(snap.active.entries[0].sets[0].w).toBe(convertExact(35, 'kg', 'lb', UNIT_PLACES_STORED))
  })

  it('leaves an unpinned entry exactly as the snapshot always read it', () => {
    // Deep equal to the same workout without the pin anywhere.
    const pinned = buildSnapshot(pinnedState()).active.entries[1]
    const plain = buildSnapshot(state()).active.entries[1]
    expect(pinned).toEqual(plain)
  })
})

describe('a watch tick on a pinned exercise comes home in its unit (upstream #657)', () => {
  const ev = (over = {}) => ({ id: 't1', type: 'setDone', wid: 'w-1', exId: '0025', entryIdx: 0, setIdx: 0, r: 8, at: 1, ...over })

  it('a weight the profile stored comes back as the pin unit number it had', () => {
    const S = pinnedState()
    const setDone = vi.fn()
    bindWatchActions({ setDone })
    applyEvents([ev({ w: 77.1618 })], () => ({ S }))
    expect(setDone).toHaveBeenCalledWith(0, 0, { w: convertExact(77.1618, 'lb', 'kg', UNIT_PLACES_SHOWN), r: 8, at: 1, hr: null })
  })

  it('a weight the watch changed converts onto the pin unit grid', () => {
    const S = pinnedState()
    const setDone = vi.fn()
    bindWatchActions({ setDone })
    applyEvents([ev({ w: 80 })], () => ({ S }))
    expect(setDone).toHaveBeenCalledWith(0, 0, { w: convertExact(80, 'lb', 'kg', UNIT_PLACES_SHOWN), r: 8, at: 1, hr: null })
  })

  it('a tick for a finished workout is not converted: it is stored in the profile unit', () => {
    const S = pinnedState({
      active: { id: 'w-live', name: 'Push', cur: 0, d: '2026-10-13', entries: [BENCH_KG, SQUAT_LB] },
      workouts: [{ id: 'w-old', d: '2026-10-12', entries: [{ id: '0025', target: { mode: 'reps', sets: 3, reps: 8 }, sets: [{ w: 77.1618, r: 8, done: true }] }] }],
    })
    const patchSet = vi.fn()
    bindWatchAppActions({ start: vi.fn(), patchSet })
    applyEvents([ev({ id: 't2', wid: 'w-old', w: 77.1618, r: 8, at: 900 })], () => ({ S }))
    expect(patchSet).toHaveBeenCalledTimes(1)
    expect(patchSet.mock.calls[0][1]).toMatchObject({ done: true, w: 77.1618, r: 8 })
  })

  it('a profile with no pin passes the tick through unchanged', () => {
    const S = state({ active: { id: 'w-1', name: 'Push', cur: 0, d: '2026-10-13', entries: [{ id: '0043', target: { mode: 'reps', sets: 3, reps: 5, weight: 100 }, sets: [{ w: 100, r: 5, done: false }] }] } })
    const setDone = vi.fn()
    bindWatchActions({ setDone })
    applyEvents([{ id: 't3', type: 'setDone', wid: 'w-1', exId: '0043', entryIdx: 0, setIdx: 0, w: 100, r: 5, at: 1 }], () => ({ S }))
    expect(setDone).toHaveBeenCalledWith(0, 0, { w: 100, r: 5, at: 1, hr: null })
  })
})

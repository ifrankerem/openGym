// @vitest-environment happy-dom
// Swapping a running exercise for one pinned to another unit (issue #6): profile lb,
// dumbbell incline press pinned to kg, last logged at 77.1618 lb × 10. A freestyle swap
// opens it at 35 kg with the unit stamp. Drives the real swapTo path in sheets.jsx.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { swapActiveWorkoutExercise } from './sheets.jsx'
import { EXDB } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const clone = value => JSON.parse(JSON.stringify(value))
const PINNED = EXDB.find(e => e.id === '3545')
const BENCH = EXDB[0].id

function installActive() {
  const S = clone(DEF)
  S.unit = 'lb'
  S.exUnit = { [PINNED.id]: { unit: 'kg', _ts: 1 } }
  S.workouts = [{
    id: 'w0', d: '2026-10-01', start: 1, end: 2,
    entries: [{
      id: PINNED.id,
      target: { mode: 'reps', sets: 1, reps: 10, weight: 77.1618 },
      planned: { sets: 1, reps: 10, weight: 77.1618 },
      sets: [{ w: 77.1618, r: 10, done: true }],
    }],
  }]
  S.active = {
    id: 'swap-test', d: '2026-10-03', start: Date.now(), routineId: null,
    name: 'Swap test', bw: null, cur: 0,
    entries: [{
      id: BENCH,
      target: { mode: 'reps', sets: 1, reps: 5, weight: 40 },
      sets: [{ w: 40, r: 5, done: false }],
    }],
  }
  useStore.setState({ S, user: null })
}

function submitSwap(index, exercise, config) {
  swapActiveWorkoutExercise(index)
  const picker = useUI.getState().sheets.at(-1)
  const pickerView = picker.render(picker.close)
  act(() => pickerView.props.onPick(exercise))
  const configSheet = useUI.getState().sheets.at(-1)
  const configView = configSheet.render(configSheet.close)
  act(() => configView.props.onSave(config))
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  localStorage.clear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], timer: null, work: null })
  installActive()
})

describe('freestyle swap onto a pinned exercise', () => {
  it('opens the pinned exercise in its unit', () => {
    submitSwap(0, PINNED, { mode: 'reps', sets: 1, reps: 10, weight: 0 })
    const [swapped] = useStore.getState().S.active.entries
    expect(swapped.id).toBe(PINNED.id)
    expect(swapped.sets.map(s => [s.w, s.r])).toEqual([[35, 10]])
    expect(swapped.unit).toBe('kg')
  })
})

// Issue #34's planned-backup case: a routine slot offers Y as a planned substitute; swapping
// the slot to it builds through the routine (buildPlannedEntry), so Y lands already pinned.
describe("swap to a routine slot's planned backup", () => {
  beforeEach(() => {
    const S = clone(DEF)
    S.unit = 'lb'
    S.exUnit = { [PINNED.id]: { unit: 'kg', _ts: 1 } }
    // Last time Y was lifted at 77.1618 lb (= 35 kg) but short of the 10 reps, so the swap's
    // planned build holds at that weight instead of stepping up.
    S.workouts = [{
      id: 'w0', d: '2026-10-01', start: 1, end: 2,
      entries: [{
        id: PINNED.id,
        target: { mode: 'reps', sets: 1, reps: 10, weight: 77.1618 },
        planned: { sets: 1, reps: 10, weight: 77.1618 },
        sets: [{ w: 77.1618, r: 7, done: true }],
      }],
    }]
    S.routines = [{ id: 'r1', name: 'R1', ex: [{ id: BENCH, sets: 1, reps: 5, weight: 40, prog: 'linear', mode: 'reps', subs: [PINNED.id] }] }]
    S.active = {
      id: 'swap-test', d: '2026-10-25', start: Date.now(), routineId: 'r1',
      name: 'Planned', bw: null, cur: 0,
      entries: [{
        id: BENCH, rid: 'r1', noProg: false,
        target: { mode: 'reps', sets: 1, reps: 5, weight: 40, prog: 'linear', subs: [PINNED.id] },
        sets: [{ w: 40, r: 5, done: false }],
      }],
    }
    useStore.setState({ S, user: null })
  })

  it('swaps to the pinned backup in its unit', () => {
    submitSwap(0, PINNED, { mode: 'reps', sets: 1, reps: 10, weight: 0 })
    const [swapped] = useStore.getState().S.active.entries
    expect(swapped.id).toBe(PINNED.id)
    expect(swapped.sets.map(s => [s.w, s.r])).toEqual([[35, 10]])
    expect(swapped.unit).toBe('kg')
    expect(useStore.getState().S.workouts).toHaveLength(1)
  })
})

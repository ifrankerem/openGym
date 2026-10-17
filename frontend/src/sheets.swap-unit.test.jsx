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

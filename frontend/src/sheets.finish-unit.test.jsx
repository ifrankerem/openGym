// @vitest-environment happy-dom
// Finishing a workout stores a pinned exercise back in the profile unit (upstream #657): profile
// lb, bench pinned to kg, the session logged at 37.5 kg. The saved workout holds 82.6733 lb
// with no unit stamp, and the PR and working weight are judged in lb.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout } from './sheets.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const BENCH = '0025'
const work = (w, r) => ({ w, r, done: true })

function install() {
  const st = clone(DEF)
  st.unit = 'lb'
  st.exUnit = { [BENCH]: { unit: 'kg', _ts: 1 } }
  st.exWeights = { [BENCH]: { w: 77.1618, d: '2026-10-01' } }
  st.routines = [{ id: 'r1', name: 'R1', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 77.1618, inc: 5.5116, prog: 'linear', mode: 'reps' }] }]
  st.workouts = [{
    id: 'w0', d: '2026-10-01', start: 1, end: 2, routineIds: ['r1'], entries: [{
      id: BENCH, rid: 'r1',
      target: { id: BENCH, sets: 3, reps: 8, weight: 77.1618, inc: 5.5116, prog: 'linear', mode: 'reps' },
      planned: { sets: 3, reps: 8, weight: 77.1618 },
      sets: [work(77.1618, 8), work(77.1618, 8), work(77.1618, 8)],
    }],
  }]
  st.active = {
    id: 'fin', d: '2026-10-03', start: Date.now() - 20 * 60000, routineIds: ['r1'], name: 'R1', bw: null, cur: 0,
    entries: [{
      id: BENCH, rid: 'r1', unit: 'kg',
      target: { id: BENCH, sets: 3, reps: 8, weight: 37.5, inc: 2.5, prog: 'linear', mode: 'reps' },
      planned: { sets: 3, reps: 8, weight: 35 },
      sets: [work(37.5, 8), work(37.5, 8), work(37.5, 8)],
    }],
  }
  useStore.setState({ S: st, user: null })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  localStorage.clear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], timer: null, work: null })
})
afterEach(() => {
  document.body.innerHTML = ''
  useUI.getState().stopWork()
  vi.useRealTimers()
})

describe('finish stores a pinned exercise back in the profile unit', () => {
  it('saves lb numbers, judges the PR in lb and advances the working weight', () => {
    install()
    act(() => finishWorkout())
    expect(S().active).toBeNull()
    const w = S().workouts.find(x => x.id === 'fin')
    const [entry] = w.entries
    expect(entry.sets.map(s => s.w)).toEqual([82.6733, 82.6733, 82.6733])
    expect('unit' in entry).toBe(false)
    expect(entry.target.weight).toBe(82.6733)
    expect(entry.target.inc).toBe(5.5116)
    expect(entry.planned.weight).toBe(77.1618)
    expect(w.vol).toBeCloseTo(1984.1592, 2)
    expect(w.prs).toContain(BENCH)
    expect(S().exWeights[BENCH].w).toBe(82.6733)
  })

  // Upstream #657: heart rate per set is not a weight — it rides along the conversion untouched.
  it('keeps a logged hr on the set while the weights convert', () => {
    install()
    S().active.entries[0].sets[0].hr = 130
    act(() => finishWorkout())
    const [entry] = S().workouts.find(x => x.id === 'fin').entries
    expect(entry.sets[0]).toMatchObject({ w: 82.6733, r: 8, done: true, hr: 130 })
    expect('unit' in entry).toBe(false)
  })
})

// @vitest-environment happy-dom
// Finishing a workout stores a pinned exercise back in the profile unit (issue #6): profile
// lb, bench pinned to kg, the session logged at 37.5 kg. The saved workout holds 82.6733 lb
// with no unit stamp, and the PR and working weight are judged in lb.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout } from './sheets.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const BENCH = '0025'
const work = (w, r) => ({ w, r, done: true })
const mounted = []

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
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
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
})

// The summary reads a pinned exercise in its own unit (issue #10), both the day just logged and
// what the next one opens at — found live on Android, where a press pinned to kg read
// "Today: 44.1 lb × 10, 10, 10" and "Next time: 20 lb × 10, 10, 10 · same again". The session's
// own total volume stays in the profile unit.
describe('finish summary with a pinned exercise', () => {
  const PRESS = '3545'   // dumbbell incline alternate press

  // lb profile, a routine on "Repeat last session", the press pinned to kg. Yesterday's press
  // at 20 kg is what today's session repeats, and today is logged at the same 20 kg.
  function installRepeat() {
    const st = clone(DEF)
    st.unit = 'lb'
    st.exUnit = { [PRESS]: { unit: 'kg', _ts: 1 } }
    st.routines = [{ id: 'r1', name: 'Push', prog: 'repeat', ex: [{ id: PRESS, sets: 3, reps: 10, weight: 44.0925, mode: 'reps' }] }]
    st.workouts = [{
      id: 'w0', d: '2026-09-30', start: 1, end: 2, routineIds: ['r1'],
      entries: [{
        id: PRESS, rid: 'r1',
        target: { id: PRESS, sets: 3, reps: 10, weight: 44.0925, mode: 'reps' },
        planned: { sets: 3, reps: 10, weight: 44.0925 },
        sets: [work(44.0925, 10), work(44.0925, 10), work(44.0925, 10)],
      }],
    }]
    st.active = {
      id: 'fin', d: '2026-10-03', start: Date.now() - 20 * 60000, routineIds: ['r1'], name: 'Push', bw: null, cur: 0,
      entries: [{
        id: PRESS, rid: 'r1', unit: 'kg',
        target: { id: PRESS, sets: 3, reps: 10, weight: 20, mode: 'reps' },
        planned: { sets: 3, reps: 10, weight: 20 },
        sets: [work(20, 10), work(20, 10), work(20, 10)],
      }],
    }
    useStore.setState({ S: st, user: null })
  }

  function summaryText() {
    const sheet = useUI.getState().sheets.at(-1)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    mounted.push([root, host])
    act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    return host.textContent
  }

  it('reads today and next time in kg, and the total volume in lb', () => {
    installRepeat()
    act(() => finishWorkout())
    const text = summaryText()
    expect(text).toContain('Today: 20 kg × 10, 10, 10')
    expect(text).toContain('Last time: 20 kg × 10, 10, 10')
    expect(text).toContain('Next time: 20 kg × 10, 10, 10 · same again')
    // The volume is the session's own, in the profile unit.
    const volume = [...mounted.at(-1)[1].querySelectorAll('.tile .v')].map(el => el.textContent).find(v => v.includes('lb'))
    expect(volume).toBeTruthy()
  })
})

// @vitest-environment happy-dom
// A saved workout's detail sheet with one exercise pinned to another unit (issue #10): the
// pinned dumbbell press reads in kg, the bench beside it stays in lb, and the session's own
// total volume stays in the profile unit.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { workoutDetailSheet } from './sheets.jsx'
import { EXDB } from './lib/exercises-data.js'
import { setExerciseUnit } from './lib/exercise-unit.js'

const PRESS = EXDB.find(e => e.id === '3545')    // dumbbell incline alternate press
const BENCH = EXDB.find(e => e.id === '0025')   // barbell bench press
const mounted = []

function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

// Profile lb, the press pinned to kg — built by the switch (lib/exercise-unit.js), the only thing
// that writes a pin. 77.1618 lb is 35 kg exactly, so the snap leaves the stored numbers as they
// were and only the reading changes. Two routines, so the sheet shows each block's own header —
// the one that carries the session's volume line.
function installPinned() {
  const done = (weight, reps) => ({ w: weight, r: reps, done: true })
  const workout = {
    id: 'w1', d: '2026-09-15', start: Date.UTC(2026, 8, 15, 17), end: Date.UTC(2026, 8, 15, 18), name: 'Push',
    vol: 135 * 5, prs: [], routineIds: ['A', 'B'],
    entries: [
      {
        id: PRESS.id, rid: 'A', target: { mode: 'reps', sets: 3, reps: 10, weight: 77.1618 },
        sets: [done(77.1618, 10), done(77.1618, 10), done(77.1618, 10)],
      },
      { id: BENCH.id, rid: 'B', target: { mode: 'reps', sets: 1, reps: 5, weight: 135 }, sets: [done(135, 5)] },
    ],
  }
  const S = JSON.parse(JSON.stringify(DEF))
  S.unit = 'lb'
  S.workouts = [workout]
  useStore.setState({ S: setExerciseUnit(S, PRESS.id, 'kg', 1), user: null })
}

const rowOf = (host, name) => [...host.querySelectorAll('.wd-ex')]
  .find(r => r.querySelector('.tt')?.textContent.includes(name))
const setLine = (host, name) => rowOf(host, name).querySelector('.ss').textContent
const volumeLine = host => [...host.querySelectorAll('.small.dim')]
  .map(el => el.textContent).find(text => text.includes('sets'))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toast: vi.fn() })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('workout detail with a pinned exercise', () => {
  it('lists the pinned exercise in its unit and the rest in the profile\'s', () => {
    installPinned()
    workoutDetailSheet(useStore.getState().S.workouts[0])
    const host = mountTopSheet()

    expect(setLine(host, PRESS.n)).toContain('35')
    expect(setLine(host, PRESS.n)).toContain('10')
    expect(rowOf(host, PRESS.n).textContent).toContain('kg')
    expect(setLine(host, PRESS.n)).not.toContain('77')

    expect(setLine(host, BENCH.n)).toContain('135')
    expect(setLine(host, BENCH.n)).toContain('5')
    expect(rowOf(host, BENCH.n).textContent).toContain('lb')
  })

  it('leaves the session\'s own total volume in the profile unit', () => {
    installPinned()
    workoutDetailSheet(useStore.getState().S.workouts[0])
    const volume = volumeLine(mountTopSheet())
    expect(volume).toContain('lb')
    expect(volume).not.toContain('kg')
  })

  it('an unpinned exercise is read exactly as before', () => {
    const S = JSON.parse(JSON.stringify(DEF))
    S.unit = 'lb'
    S.workouts = [{
      id: 'w1', d: '2026-09-15', start: 1, end: 2, name: 'Push', vol: 675, prs: [], routineIds: [],
      entries: [{
        id: BENCH.id, target: { mode: 'reps', sets: 1, reps: 5, weight: 135 },
        sets: [{ w: 135, r: 5, done: true }],
      }],
    }]
    useStore.setState({ S, user: null })
    workoutDetailSheet(S.workouts[0])
    const host = mountTopSheet()
    expect(setLine(host, BENCH.n)).toBe('135×5')
  })
})
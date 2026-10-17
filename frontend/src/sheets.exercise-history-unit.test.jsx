// @vitest-environment happy-dom
// The exercise's own history sheet and its 1RM estimate, for an exercise pinned to another
// unit (issue #10): the sessions, the best and the estimate read in kg. An unpinned exercise
// reads exactly as before.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exerciseHistorySheet, exerciseDetailSheet } from './sheets.jsx'
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

const session = (id, d, weight, reps) => ({
  id, d, start: Date.parse(d + 'T17:00:00'), end: Date.parse(d + 'T18:00:00'), name: 'Push', routineIds: [],
  entries: [{
    id, target: { mode: 'reps', sets: 3, reps, weight },
    sets: [0, 1, 2].map(() => ({ w: weight, r: reps, done: true })),
  }],
})

// lb profile, the press pinned to kg (through the switch — the only thing that writes a pin).
function installPinned(extras = []) {
  const S = JSON.parse(JSON.stringify(DEF))
  S.unit = 'lb'
  S.workouts = [
    session(PRESS.id, '2026-09-10', 77.1618, 10),
    ...extras,
  ]
  useStore.setState({ S: setExerciseUnit(S, PRESS.id, 'kg', 1), user: null })
}

const historyRows = host => [...host.querySelectorAll('.item')].filter(r => r.querySelector('.tt'))
const bestLine = host => [...host.querySelectorAll('.small.row')]
  .map(el => el.textContent).find(text => text.includes('Best:'))
const fromLog = host => [...host.querySelectorAll('.small')]
  .map(el => el.textContent).find(text => text.includes('From your log:'))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toast: vi.fn() })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('exercise history with a pinned exercise', () => {
  it('lists the sessions and the best in the exercise\'s unit', () => {
    installPinned()
    exerciseHistorySheet(PRESS.id)
    const host = mountTopSheet()
    const [row] = historyRows(host)

    expect(row.querySelector('.ss').textContent).toContain('35')
    expect(row.querySelector('.ss').textContent).toContain('10')
    expect(row.querySelector('.ss').textContent).not.toContain('77')
    expect(row.textContent).toContain('kg')
    expect(bestLine(host)).toContain('35 kg')
  })

  it('an unpinned exercise keeps the profile unit', () => {
    const S = JSON.parse(JSON.stringify(DEF))
    S.unit = 'lb'
    S.workouts = [session(BENCH.id, '2026-09-10', 135, 5)]
    useStore.setState({ S, user: null })
    exerciseHistorySheet(BENCH.id)
    const host = mountTopSheet()
    const row = historyRows(host)[0]
    expect(row.querySelector('.ss').textContent).toContain('135×5')
    expect(row.textContent).toContain('lb')
    expect(bestLine(host)).toContain('135 lb')
  })
})

describe('estimated 1RM for a pinned exercise', () => {
  it('gives the estimate and the set it came from in the exercise\'s unit', () => {
    installPinned()
    exerciseDetailSheet(PRESS)
    const host = mountTopSheet()
    const line = fromLog(host)
    expect(line).toContain('35 kg × 10')
    expect(line).not.toContain('lb')
    // The estimate itself, in kg.
    const estimate = [...host.querySelectorAll('.row.between b')].map(el => el.textContent).join(' ')
    expect(estimate).toContain(' kg')
    expect(estimate).not.toContain(' lb')
  })

  it('an unpinned exercise keeps the profile unit', () => {
    const S = JSON.parse(JSON.stringify(DEF))
    S.unit = 'lb'
    S.workouts = [session(BENCH.id, '2026-09-10', 135, 5)]
    useStore.setState({ S, user: null })
    exerciseDetailSheet(BENCH)
    const host = mountTopSheet()
    expect(fromLog(host)).toContain('135 lb × 5')
  })
})
// @vitest-environment happy-dom
// "Exercise settings" mid-workout on an exercise pinned to another unit (issue #9): the sheet
// edits in the exercise's unit, and saving rebuilds the rows in it at the plan's own weight.
// The routine slot is not written by this path, as it never was.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setExerciseUnit } from '../lib/exercise-unit.js'
import { isWarmupRow } from '../lib/workout-model.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025'   // barbell bench press

let root, container, sheetRoot, sheetContainer
const mounted = []

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// lb profile, bench pinned to kg (built by the switch, the only thing that writes a pin), a
// routine slot at 77.1618 lb and a running session at 35 kg on the pinned bench.
function mount() {
  const slot = { id: BENCH, sets: 3, reps: 8, weight: 77.1618, inc: 5.5116, mode: 'reps' }
  const S = clone(DEF)
  S.unit = 'lb'
  S.routines = [{ id: 'r1', name: 'Push', ex: [slot] }]
  S.active = {
    id: 'settings-unit', d: '2026-10-03', start: Date.now(), routineIds: ['r1'], name: 'Push', bw: null, cur: 0,
    entries: [{
      id: BENCH, rid: 'r1',
      // A running entry of a pinned exercise holds its weights in the pin unit and says so
      // (task 05). Without the stamp the switch reads 35 as 35 lb and makes it 16 kg.
      unit: 'kg',
      target: { id: BENCH, sets: 3, reps: 8, weight: 35, inc: 2.5, mode: 'reps' },
      planned: { sets: 3, reps: 8, weight: 35 },
      sets: [{ w: 35, r: 8, done: false }, { w: 35, r: 8, done: false }, { w: 35, r: 8, done: false }],
    }],
  }
  useStore.setState({ S: setExerciseUnit(S, BENCH, 'kg', 1), user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}

// Opened outside the act() that taps into it: React does not flush a nested act.
function openSettingsSheet() {
  act(() => container.querySelector('button[aria-label="More"]').click())
  const menu = useUI.getState().sheets.at(-1)
  sheetContainer = document.createElement('div')
  document.body.appendChild(sheetContainer)
  sheetRoot = createRoot(sheetContainer)
  act(() => sheetRoot.render(menu.render(() => useUI.getState().closeSheet(menu.id))))
  const item = [...sheetContainer.querySelectorAll('.menu-item')]
    .find(el => el.querySelector('.tt')?.textContent === 'Exercise settings')
  expect(item).toBeTruthy()
  act(() => item.click())
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const sheetRoot2 = createRoot(host)
  mounted.push([sheetRoot2, host])
  act(() => sheetRoot2.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const field = (host, label) => [...host.querySelectorAll('.stp-w')]
  .find(w => w.querySelector('.stp-l')?.textContent.startsWith(label))
const save = host => act(() => [...host.querySelectorAll('button')]
  .find(b => /^(save|add to this workout|use in this workout)$/i.test(b.textContent.trim())).click())

const workRows = () => useStore.getState().S.active.entries[0].sets.filter(s => !isWarmupRow(s))

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  localStorage.clear()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([r, host]) => { r.unmount(); host.remove() }) })
  if (sheetRoot) act(() => sheetRoot.unmount())
  if (sheetContainer) sheetContainer.remove()
  if (root) act(() => root.unmount())
  if (container) container.remove()
  sheetRoot = sheetContainer = root = container = null
  useUI.getState().stopRest()
})

describe('exercise settings mid-workout on a pinned exercise', () => {
  it('edits in the exercise\'s unit and rebuilds the rows there', () => {
    mount()
    const host = openSettingsSheet()
    expect(field(host, 'Weight (').querySelector('.stp-l').textContent).toBe('Weight (kg)')
    expect(field(host, 'Weight (').querySelector('input').value).toBe('35')

    act(() => type(field(host, 'Sets').querySelector('input'), '4'))
    save(host)

    expect(workRows().map(s => s.w)).toEqual([35, 35, 35, 35])
    expect(useStore.getState().S.active.entries[0].unit).toBe('kg')
    // The routine is not this path's business.
    expect(useStore.getState().S.routines[0].ex[0].weight).toBe(77.1618)
  })
})
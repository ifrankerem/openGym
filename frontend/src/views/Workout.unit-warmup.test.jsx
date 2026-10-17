// @vitest-environment happy-dom
// "Add warm-up set" mid-workout for an exercise pinned to another unit (issue #20): the ramp
// uses the exercise's own increment and its own bar floor, so a kg bench ramps in kg and never
// lands on the 45 lb bar the profile would use.
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
const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'   // barbell bench press — 2.5 kg / 5 lb increment, 20 kg / 45 lb bar

let root, container, sheetRoot, sheetContainer

// lb profile. `pinKg` goes through the switch (lib/exercise-unit.js), the only thing that ever
// writes a pin, and the running entry of a pinned exercise carries its unit stamp (task 05) —
// so a pinned fixture is a state the app can actually hold.
function mount({ pinKg = false, workW = 60 } = {}) {
  const S = clone(DEF)
  S.unit = 'lb'
  S.active = {
    id: 'warmup-unit', d: '2026-10-03', start: Date.now(), routineId: null, name: 'Units', bw: null, cur: 0,
    entries: [{
      id: BENCH,
      ...(pinKg ? { unit: 'kg' } : {}),
      target: { mode: 'reps', sets: 1, reps: 8, weight: workW },
      sets: [{ w: workW, r: 8, done: false }],
    }],
  }
  useStore.setState({ S: pinKg ? setExerciseUnit(S, BENCH, 'kg', 1) : S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}

// Opened outside the act() that taps into it: React does not flush a nested act.
function openMore() {
  act(() => container.querySelector('button[aria-label="More"]').click())
  const sheet = useUI.getState().sheets.at(-1)
  sheetContainer = document.createElement('div')
  document.body.appendChild(sheetContainer)
  sheetRoot = createRoot(sheetContainer)
  act(() => sheetRoot.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return sheetContainer
}

function addWarmup() {
  const menu = openMore()
  const item = [...menu.querySelectorAll('.menu-item')]
    .find(el => el.querySelector('.tt')?.textContent === 'Add warm-up set')
  expect(item).toBeTruthy()
  act(() => item.click())
}

const warmupWeights = () => useStore.getState().S.active.entries[0].sets
  .filter(s => isWarmupRow(s)).map(s => s.w)

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  localStorage.clear()
})
afterEach(() => {
  if (sheetRoot) act(() => sheetRoot.unmount())
  if (sheetContainer) sheetContainer.remove()
  if (root) act(() => root.unmount())
  if (container) container.remove()
  sheetRoot = sheetContainer = root = container = null
  useUI.getState().stopRest()
})

describe('add a warm-up set to a pinned exercise', () => {
  it('ramps in its own unit, on its own grid and above its own bar', () => {
    mount({ pinKg: true })
    addWarmup()
    // Half of 60 kg is 30 kg, a multiple of the 2.5 kg increment and above the 20 kg bar.
    expect(warmupWeights()).toEqual([30])
  })

  it('ramps the second warm-up on the same grid between the first and the work set', () => {
    mount({ pinKg: true })
    addWarmup()
    addWarmup()
    expect(warmupWeights()).toEqual([30, 45])
  })

  it('an unpinned exercise ramps on the profile unit, as it always did', () => {
    mount({ workW: 135 })
    addWarmup()
    // Half of 135 lb on the 5 lb grid, never under the 45 lb bar.
    expect(warmupWeights()).toEqual([65])
  })
})
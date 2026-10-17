// @vitest-environment happy-dom
// The Focus view of one exercise pinned to another unit (issue #8): profile lb, bench pinned
// to kg — the Load stepper reads its weight in kg and steps by the kg increment.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'   // barbell bench press

let root, container

function mount(over = {}) {
  const S = clone(DEF)
  S.unit = 'lb'
  Object.assign(S, over)
  S.active = {
    id: 'focus-unit', d: '2026-10-03', start: Date.now(), routineId: null, name: 'Focus', bw: null, cur: 0,
    workoutView: 'focus',
    entries: [{
      id: BENCH,
      target: { mode: 'reps', sets: 1, reps: 8, weight: 135 },
      sets: [{ w: 135, r: 8, done: false }],
    }],
  }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}

const loadStepper = () => [...container.querySelectorAll('.stp-w')]
  .find(el => el.querySelector('.stp-l')?.textContent.startsWith('Load ('))
const loadInput = () => loadStepper().querySelector('input')

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
})
afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  root = container = null
  useUI.getState().stopRest()
})

describe('Focus view of a pinned exercise', () => {
  it('shows the load in the exercise\'s unit and steps it there', () => {
    mount({ exUnit: { [BENCH]: { unit: 'kg', _ts: 1 } } })
    expect(loadStepper().querySelector('.stp-l').textContent).toBe('Load (kg)')
    expect(loadInput().value).toBe('61.25')

    act(() => loadStepper().querySelector('button[aria-label="Increase load"]').click())
    expect(useStore.getState().S.active.entries[0].sets[0].w).toBe(63.75)
  })

  it('stays on the profile unit for an unpinned exercise', () => {
    mount()
    expect(loadStepper().querySelector('.stp-l').textContent).toBe('Load (lb)')
    expect(loadInput().value).toBe('135')
  })
})
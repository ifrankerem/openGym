// @vitest-environment happy-dom
// The routine editor with an exercise pinned to another unit (upstream #657): profile lb, bench
// pinned to kg. The row reads the plan's weight in kg, its sheet edits in kg, and saving gives
// the exact stored number back — 35 kg is 77.1618 lb again, not a drifted 77.162.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setExerciseUnit, convertExact, UNIT_PLACES_STORED } from '../lib/exercise-unit.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
// Media's default export too: the real exConfigSheet (not mocked here) renders a Thumb.
vi.mock('../components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025'   // barbell bench press

let root, container, sheetRoot, sheetContainer
const mounted = []

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// The lb profile with the bench pinned to kg, built the way the app builds it: the switch
// (lib/exercise-unit.js) writes the pin and snaps the slot's stored weights onto the kg grid.
function mountPinned(slot) {
  const S = clone(DEF)
  S.unit = 'lb'
  S.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [slot] }]
  useStore.setState({ S: setExerciseUnit(S, BENCH, 'kg', 1), user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <MemoryRouter initialEntries={['/plan/r/r1']}>
      <Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  ))
}

const rowLine = () => container.querySelector('[data-row-open] .ss')?.textContent
// Opened outside the act() that taps into it: React does not flush a nested act.
function openRowSheet() {
  act(() => container.querySelector('[data-row-open]').click())
  const sheet = useUI.getState().sheets.at(-1)
  sheetContainer = document.createElement('div')
  document.body.appendChild(sheetContainer)
  sheetRoot = createRoot(sheetContainer)
  act(() => sheetRoot.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return sheetContainer
}
const field = (host, label) => [...host.querySelectorAll('.stp-w')]
  .find(w => w.querySelector('.stp-l')?.textContent.startsWith(label))
const save = host => act(() => [...host.querySelectorAll('button')]
  .find(b => /^(save|add to routine)$/i.test(b.textContent.trim())).click())
const slotOf = () => useStore.getState().S.routines[0].ex[0]

const benchSlot = () => ({ id: BENCH, sets: 3, reps: 8, weight: 77.1618, inc: 5.5116, mode: 'reps' })

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  localStorage.clear()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([r, h]) => { r.unmount(); h.remove() }) })
  if (sheetRoot) act(() => sheetRoot.unmount())
  if (sheetContainer) sheetContainer.remove()
  if (root) act(() => root.unmount())
  if (container) container.remove()
  sheetRoot = sheetContainer = root = container = null
})

describe('routine editor with an exercise pinned to kg', () => {
  it('prints the plan in the exercise\'s unit', () => {
    mountPinned(benchSlot())
    expect(rowLine()).toContain('35 kg')
  })

  it('edits and saves in kg, storing the exact number back', () => {
    mountPinned(benchSlot())
    const host = openRowSheet()
    expect(field(host, 'Weight (').querySelector('.stp-l').textContent).toBe('Weight (kg)')
    expect(field(host, 'Weight (').querySelector('input').value).toBe('35')
    expect(field(host, 'Step (').querySelector('.stp-l').textContent).toBe('Step (kg)')
    expect(field(host, 'Step (').querySelector('input').value).toBe('2.5')

    save(host)
    // Untouched: the same two numbers as before, not 35 kg typed over 77.1618 lb.
    expect(slotOf()).toMatchObject({ id: BENCH, sets: 3, reps: 8, weight: 77.1618, inc: 5.5116 })
  })

  it('stores a typed 40 kg as 88.1849 lb', () => {
    mountPinned(benchSlot())
    const host = openRowSheet()
    act(() => type(field(host, 'Weight (').querySelector('input'), '40'))
    save(host)
    expect(slotOf().weight).toBe(88.1849)
  })
})

// Upstream #657's lb-on-a-kg-profile machine: the leg press is
// pinned to lb on a kg profile, so the row sheet takes the step in lb, stores it exactly in the
// profile's unit, and the warm-up rest is untouched by any of it.
describe('a routine row sheet with an lb-pinned machine on a kg profile', () => {
  const LP = '2224'   // sled 45° leg press

  // The pin written by the switch, the only thing that ever writes one: it snaps the slot's
  // stored 80 kg and 5 kg step onto the lb grid (175 lb, 10 lb).
  function mountLegPress() {
    const S = clone(DEF)
    S.unit = 'kg'
    S.routines = [{ id: 'r1', name: 'Legs', emoji: 'dumbbell', ex: [{ id: LP, sets: 3, reps: 8, weight: 80, inc: 5, mode: 'reps' }] }]
    useStore.setState({ S: setExerciseUnit(S, LP, 'lb', 1), user: null })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(
      <MemoryRouter initialEntries={['/plan/r/r1']}>
        <Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes>
      </MemoryRouter>
    ))
  }

  // The sheet stack above the row sheet (the warm-up rest's menu, then the duration wheel).
  function topSheet() {
    const sheet = useUI.getState().sheets.at(-1)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const r = createRoot(host)
    act(() => r.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    mounted.push([r, host])
    return host
  }

  it('takes the 10 lb step and stores it exactly in kg, reopening as 10 lb', () => {
    mountLegPress()
    const host = openRowSheet()
    expect(field(host, 'Step (').querySelector('.stp-l').textContent).toBe('Step (lb)')
    act(() => type(field(host, 'Step (').querySelector('input'), '10'))
    save(host)
    // Stored in the profile's unit, exactly: 10 lb is 4.5359 kg, not a snapped 5.
    expect(slotOf().inc).toBe(convertExact(10, 'lb', 'kg', UNIT_PLACES_STORED))
    // Reopening reads the step back in the exercise's unit.
    expect(field(openRowSheet(), 'Step (').querySelector('input').value).toBe('10')
  })

  it('saves the warm-up rest as 45 seconds, untouched by the unit', () => {
    mountLegPress()
    const host = openRowSheet()
    const rowOf = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
    act(() => rowOf('Rest between warm-ups').click())
    const menu = topSheet()
    act(() => [...menu.querySelectorAll('.menu-item')].find(el => el.querySelector('.tt')?.textContent === 'Pick a time').click())
    const wheel = topSheet()
    const key = (el, k) => act(() => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })))
    const sec = wheel.querySelector('[aria-label="Seconds"]')
    for (let i = 0; i < 15; i++) key(sec, 'ArrowUp')   // the wheel opens at 0:30
    act(() => [...wheel.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done').click())
    save(host)
    // Seconds are seconds whatever the weights' unit: 45 saved as 45, no conversion.
    expect(slotOf().warmupRestSec).toBe(45)
    // Reopening says 45s.
    const host2 = openRowSheet()
    expect([...host2.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === 'Rest between warm-ups')
      .querySelector('.lrow-v').textContent).toBe('45s')
  })
})
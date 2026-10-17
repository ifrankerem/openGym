// @vitest-environment happy-dom
// Switching one exercise's weight unit from the workout card's ⋯ menu (issue #8): profile lb,
// bench pinned to kg — the card header, its rows, its step, its bar line and its history read in
// kg while every other exercise stays in lb. Unpinning puts the card back on lb.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXDB } from '../lib/exercises.js'
import { setExerciseUnit } from '../lib/exercise-unit.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'   // barbell bench press
const CARDIO = EXDB.find(e => e.bp === 'cardio').id

let root, container, sheetRoot, sheetContainer

function entry(id, sets, target = {}) {
  return { id, target: { sets: sets.length, reps: 8, ...target }, sets }
}
const work = w => ({ w, r: 8, done: false })

// lb profile, bench at 135, its last session at 135 too. An unpinned exercise to check it is
// left alone, and a cardio one for the menu that must not offer a unit at all.
// `pinKg` goes through the switch itself (lib/exercise-unit.js), the only thing that ever writes
// a pin: it snaps every stored weight of the exercise onto the kg grid. A pin written by hand
// over unsnapped 135 lb would read as the exact 61.235 the conversion gives, not the 61.25 the
// lifter actually loaded.
function mount({ pinKg = false, ...over } = {}) {
  const S = clone(DEF)
  S.unit = 'lb'
  Object.assign(S, over)
  S.workouts = [{
    id: 'w0', d: '2026-10-01', start: 1, end: 2,
    entries: [{ id: BENCH, target: { mode: 'reps', sets: 1, reps: 8, weight: 135 }, sets: [{ w: 135, r: 8, done: true }] }],
  }]
  S.active = {
    id: 'unit-test', d: '2026-10-03', start: Date.now(), routineId: null, name: 'Units', bw: null, cur: 0,
    workoutView: 'list',
    entries: [
      entry(BENCH, [work(135)]),
      entry(CARDIO, [{ min: 20, speed: 8, done: false }], { mode: 'cardio', sets: 1, min: 20, speed: 8 }),
    ],
  }
  useStore.setState({ S: pinKg ? setExerciseUnit(S, BENCH, 'kg', 1) : S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}

function renderTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  sheetContainer = document.createElement('div')
  document.body.appendChild(sheetContainer)
  sheetRoot = createRoot(sheetContainer)
  act(() => sheetRoot.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return sheetContainer
}

// The ⋯ menu of one card, then whatever sheet it opens.
function openExerciseMenu(idx = 0) {
  act(() => container.querySelectorAll('button[aria-label="More"]')[idx].click())
  return renderTopSheet()
}
const itemNamed = (host, label) => [...host.querySelectorAll('.menu-item')]
  .find(el => el.querySelector('.tt')?.textContent === label)

const headOf = (idx = 0) => container.querySelectorAll('.sethead')[idx].querySelector('.w-sp').textContent
const rowValues = (idx = 0) => [...container.querySelectorAll('.setrow')]
  .filter((_, i) => i === idx)
  .map(row => row.querySelector('input.num').value)

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
})
afterEach(() => {
  if (sheetRoot) act(() => sheetRoot.unmount())
  if (sheetContainer) sheetContainer.remove()
  if (root) act(() => root.unmount())
  if (container) container.remove()
  sheetRoot = sheetContainer = root = container = null
  useUI.getState().stopRest()
})

describe('switching one exercise\'s weight unit from the workout', () => {
  it('offers "Weight unit" with the exercise\'s unit, and picks kg', () => {
    mount()
    const menu = openExerciseMenu()
    const item = itemNamed(menu, 'Weight unit')
    expect(item).toBeTruthy()
    expect(item.querySelector('.ss').textContent).toBe('lb')

    act(() => item.click())
    const unitMenu = renderTopSheet()
    expect(unitMenu.querySelector('h3').textContent).toBe('Weight unit')
    expect(unitMenu.querySelector('.muted.small').textContent).toBe('For this exercise, in every routine. Its history is converted.')
    const profileOne = itemNamed(unitMenu, 'lb')
    expect(profileOne.querySelector('.ss').textContent).toBe('Same as your profile')
    expect(profileOne.querySelector('.menu-on.is-on')).toBeTruthy()

    act(() => itemNamed(unitMenu, 'kg').click())

    expect(useStore.getState().S.exUnit[BENCH].unit).toBe('kg')
  })

  it('the card reads, steps and plates in kg once pinned', () => {
    mount({ pinKg: true })
    expect(headOf()).toBe('Weight (kg)')
    expect(container.querySelector('.setrow input.num').value).toBe('61.25')   // 135 lb on the kg grid
    const bestTag = [...container.querySelectorAll('.tag.nocap')].find(el => el.textContent.includes('Best'))
    expect(bestTag?.textContent).toContain('61.25 kg')
    expect(itemNamed(openExerciseMenu(), 'Plate loading').querySelector('.ss').textContent).toBe('Bar 20 kg')

    // The + step is the exercise's kg increment (2.5), not the lb one (5).
    act(() => container.querySelector('.setrow .stp button[aria-label="Increase"]').click())
    expect(useStore.getState().S.active.entries[0].sets[0].w).toBe(63.75)
  })

  it('picking lb again unpins it and the card is back on lb', () => {
    mount({ pinKg: true })
    // Hoisted out of the act() below: React does not flush a nested act, so opening the menu
    // inside it left the sheet unrendered and the item undefined.
    const menu = openExerciseMenu()
    act(() => itemNamed(menu, 'Weight unit').click())
    const unitMenu = renderTopSheet()
    act(() => itemNamed(unitMenu, 'lb').click())

    expect(useStore.getState().S.exUnit[BENCH].unit).toBeNull()
    expect(headOf()).toBe('Weight (lb)')
    expect(rowValues()).toEqual(['135'])
  })

  it('a cardio exercise has no unit to switch', () => {
    mount()
    expect(itemNamed(openExerciseMenu(1), 'Weight unit')).toBeUndefined()
  })
})

// Every new string reaches every locale, and Turkish reads as bound.
describe('the weight unit strings', () => {
  const keys = [
    'Weight unit',
    'For this exercise, in every routine. Its history is converted.',
    'Same as your profile',
  ]
  const packs = import.meta.glob('../locales/*.js', { eager: true, import: 'default' })

  it('are translated in every locale pack', () => {
    expect(Object.keys(packs).length).toBeGreaterThan(0)
    Object.entries(packs).forEach(([path, pack]) => {
      for (const key of keys) expect(pack, `${path} is missing ${key}`).toHaveProperty(key)
    })
    expect(packs['../locales/tr.js']['Weight unit']).toBe('Ağırlık birimi')
    expect(packs['../locales/tr.js']['For this exercise, in every routine. Its history is converted.']).toBe('Bu hareket için, tüm rutinlerde geçerli. Geçmişi de çevrilir.')
    expect(packs['../locales/tr.js']['Same as your profile']).toBe('Profilinle aynı')
  })
})
// @vitest-environment happy-dom
// Stats' exercise progress for an exercise pinned to another unit (upstream #657): profile lb, the
// press pinned to kg. Its picker label, chart, session lines and best read in kg; the bench
// beside it stays in lb.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Stats from './Stats.jsx'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { EXDB } from '../lib/exercises-data.js'
import { setExerciseUnit } from '../lib/exercise-unit.js'

const mocks = vi.hoisted(() => ({ charts: [], S: null }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, calendarSheet: () => {}, workoutDetailSheet: () => {}, exerciseHistorySheet: () => {},
  dayOverrideSheet: () => {}, weighInsSheet: () => {},
  WorkoutRow: () => null, bwDeltaColor: () => 'inherit',
}))
vi.mock('../components/LineChart.jsx', () => ({ default: props => { mocks.charts.push(props); return null } }))
vi.mock('../components/Heatmap.jsx', () => ({ default: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null, BodyMapLegend: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const PRESS = EXDB.find(e => e.id === '3545')    // dumbbell incline alternate press
const BENCH = EXDB.find(e => e.id === '0025')   // barbell bench press
const mounted = []

const session = (id, d, weight, reps) => ({
  id, d, start: Date.parse(d + 'T10:00:00Z'), end: Date.parse(d + 'T10:40:00Z'), name: 'Push', routineIds: [],
  entries: [{ id, target: { id, mode: 'reps', sets: 3, reps, weight }, sets: [{ w: weight, r: reps, done: true }] }],
})

// lb profile with the press pinned to kg — built by the switch, the only thing that writes a pin,
// so this is a state the app can actually hold.
function state() {
  return setExerciseUnit({
    body: 'male', effort: 'none', targetW: null, bodyweight: [], routines: [], exWeights: {},
    unit: 'lb',
    workouts: [session(PRESS.id, '2026-09-01', 77.1618, 10), session(BENCH.id, '2026-09-08', 135, 5)],
  }, PRESS.id, 'kg', 1)
}

function mount() {
  bindUI(useUI)
  useUI.setState({ sheets: [], timer: null, work: null })
  mocks.S = state()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(<Stats />))
  return host
}

// Opened outside the act() that taps into it: React does not flush a nested act.
function openExercisePicker(host) {
  const row = [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === 'Exercise')
  expect(row).toBeTruthy()
  act(() => row.click())
  const sheet = useUI.getState().sheets.at(-1)
  const box = document.createElement('div')
  document.body.appendChild(box)
  const sheetRoot = createRoot(box)
  mounted.push([sheetRoot, box])
  act(() => sheetRoot.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return box
}
// Exercise names are shown title-cased, so the match is case-insensitive.
const optionNamed = (box, text) => [...box.querySelectorAll('button.lrow')]
  .find(b => b.querySelector('.lrow-t')?.textContent.toLowerCase().includes(text.toLowerCase()))
const exerciseRow = host => [...host.querySelectorAll('.lrow')]
  .find(r => r.querySelector('.lrow-t')?.textContent === 'Exercise')

afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  useUI.setState({ sheets: [] })
  mocks.charts = []
})

describe('Stats — exercise progress of a pinned exercise', () => {
  it('labels each exercise in its own unit', () => {
    const host = mount()
    const box = openExercisePicker(host)
    expect(optionNamed(box, PRESS.n).textContent).toContain('35 kg')
    expect(optionNamed(box, BENCH.n).textContent).toContain('135 lb')
  })

  it('charts and reads the best of the pinned exercise in kg', () => {
    const host = mount()
    const box = openExercisePicker(host)
    act(() => optionNamed(box, PRESS.n).click())

    expect(exerciseRow(host).textContent).toContain('35 kg')
    const chart = mocks.charts.filter(c => c.color === 'var(--blue)').at(-1)
    expect(chart.unit).toBe('kg')
    expect(chart.points.map(p => p.y)).toEqual([35])
    expect(host.textContent).toContain('35 kg')
    expect(host.textContent).not.toContain('77.2')
  })
})
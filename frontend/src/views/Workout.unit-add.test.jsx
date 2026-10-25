import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'

// Adding an exercise freestyle onto one pinned to another unit (issue #6): profile lb,
// dumbbell incline press pinned to kg, last logged at 77.1618 lb × 10. The added entry
// opens at 35 kg with the unit stamp. Drives the real add flow in Workout.jsx: the Add
// exercise button, the picker callback and the config commit.
const mocks = vi.hoisted(() => {
  const state = {
    S: null,
    user: null,
    timer: null,
    work: null,
    startWork: vi.fn(),
    startRest: vi.fn(),
    stopRest: null,
    stopWork: null,
    confirmSheet: vi.fn(),
    workoutCompleteSheet: vi.fn(),
    exercisePicker: vi.fn(),
    exConfigSheet: vi.fn(),
    toast: vi.fn(),
    scrollCalls: [],
    headerHeight: 0,
    swapActiveWorkoutExercise: vi.fn(),
    menuSheet: vi.fn(),
    effortPickerSheet: vi.fn(),
    exerciseHistorySheet: vi.fn(),
    renameWorkoutSheet: vi.fn(),
    durationSheet: vi.fn(),
    workoutSettingsSheet: vi.fn(),
    nav: vi.fn(),
    setNoteSheet: vi.fn(),
  }
  state.stopRest = vi.fn(() => { state.timer = null })
  state.stopWork = vi.fn(() => { state.work = null })
  state.storeSnapshot = () => ({
    S: state.S,
    user: state.user,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
  })
  state.uiSnapshot = () => ({
    timer: state.timer,
    work: state.work,
    startRest: state.startRest,
    stopRest: state.stopRest,
    stopWork: state.stopWork,
    shiftRestOwner: vi.fn(),
    startWork: state.startWork,
    toast: state.toast,
  })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  useUI.setState = patch => {
    const next = typeof patch === 'function' ? patch(mocks.uiSnapshot()) : patch
    if ('timer' in next) mocks.timer = next.timer
    if ('work' in next) mocks.work = next.work
  }
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../sheets.jsx', () => ({
  startFlow: vi.fn(),
  exercisePicker: mocks.exercisePicker,
  exConfigSheet: mocks.exConfigSheet,
  exerciseDetailSheet: vi.fn(),
  finishWorkout: vi.fn(),
  finishWorkoutSheet: vi.fn(),
  exitWorkoutEdit: vi.fn(),
  workoutCompleteSheet: mocks.workoutCompleteSheet,
  confirmSheet: mocks.confirmSheet,
  swapActiveWorkoutExercise: mocks.swapActiveWorkoutExercise,
  menuSheet: mocks.menuSheet,
  barWeightSheet: vi.fn(),
  exerciseNoteSheet: vi.fn(),
  setNoteSheet: mocks.setNoteSheet,
  sessionNoteSheet: vi.fn(),
  renameWorkoutSheet: mocks.renameWorkoutSheet,
  effortPickerSheet: mocks.effortPickerSheet,
  exerciseHistorySheet: mocks.exerciseHistorySheet,
  addRoutineToSessionSheet: vi.fn(),
  finishWorkoutNow: vi.fn(),
}))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
vi.mock('../components/WorkoutThumb.jsx', () => ({
  default: ({ onExpand }) => React.createElement('button', { className: 'wthumb', 'aria-label': 'Expand', onClick: onExpand }),
  hasWorkoutMedia: () => true,
}))
vi.mock('../components/DurationWheel.jsx', () => ({ durationSheet: mocks.durationSheet }))
vi.mock('../components/WorkoutSettingsSheet.jsx', () => ({ workoutSettingsSheet: mocks.workoutSettingsSheet }))
// api.js reads navigator.userAgent at module scope. This file installs its own DOM inside the
// tests rather than declaring a vitest environment, so it must not depend on an ambient one.
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})),
  beacon: vi.fn(),
  IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))

let dom
let root
let container

function exercise(id, sets, extra = {}) {
  return {
    id,
    target: { mode: 'reps', reps: 5, weight: 60, bodyweight: false },
    sets: sets.map(done => ({ w: 60, r: 5, done })),
    ...extra,
  }
}

function workout(entries, cur = 0, overrides = {}) {
  const { active: activeOverrides = {}, ...stateOverrides } = overrides
  return {
    unit: 'kg', restSec: 90, sound: false, effort: 'none', gifSize: 'full',
    workouts: [], exWeights: {}, routines: [],
    active: { id: 'active', name: 'Test workout', start: Date.now(), cur, entries, ...activeOverrides },
    ...stateOverrides,
  }
}

const frames = []

function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  dom.Element.prototype.scrollIntoView = vi.fn(function (options) {
    mocks.scrollCalls.push({ node: this, options })
  })
  frames.length = 0
  dom.requestAnimationFrame = cb => frames.push(cb)
  dom.cancelAnimationFrame = id => { const i = frames.indexOf(id); if (i >= 0) frames.splice(i, 1) }
  Object.defineProperty(dom.HTMLElement.prototype, 'offsetHeight', {
    configurable: true, get() { return this.classList.contains('whdr') ? mocks.headerHeight : 0 },
  })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
}

async function mount(entries, cur = 0, overrides = {}) {
  mocks.S = workout(entries, cur, overrides)
  installDom()
  await act(async () => { root.render(React.createElement(Workout)) })
}

async function unmount() {
  if (!root) return
  await act(async () => { root.unmount() })
  root = null
  container = null
  dom = null
}

async function addExerciseThroughSheets(ex, cfg) {
  const addButton = [...container.querySelectorAll('button')]
    .find(button => button.textContent.trim() === 'Add exercise')
  expect(addButton).toBeTruthy()
  await act(async () => { addButton.dispatchEvent(new dom.Event('click', { bubbles: true })) })

  const pickerCall = mocks.exercisePicker.mock.calls.at(-1)
  expect(pickerCall?.[0]).toEqual(expect.any(Function))
  await act(async () => { pickerCall[0](ex) })

  const configCall = mocks.exConfigSheet.mock.calls.at(-1)
  expect(configCall?.[2]).toEqual(expect.any(Function))
  await act(async () => { configCall[2](cfg) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = null
  mocks.timer = null
  mocks.work = null
  mocks.scrollCalls.length = 0
  mocks.headerHeight = 0
})

afterEach(async () => {
  await unmount()
})

describe('freestyle add onto a pinned exercise', () => {
  it('opens the pinned exercise in its unit', async () => {
    await mount([exercise('plain-bench', [false])], 0, {
      unit: 'lb',
      exUnit: { 3545: { unit: 'kg', _ts: 1 } },
      workouts: [{
        id: 'w0', d: '2026-10-01', start: 1, end: 2,
        entries: [{
          id: '3545',
          target: { mode: 'reps', sets: 1, reps: 10, weight: 77.1618 },
          planned: { sets: 1, reps: 10, weight: 77.1618 },
          sets: [{ w: 77.1618, r: 10, done: true }],
        }],
      }],
    })
    await addExerciseThroughSheets({ id: '3545' }, { mode: 'reps', sets: 1, reps: 10, weight: 0 })
    const added = mocks.S.active.entries.at(-1)
    expect(added.id).toBe('3545')
    expect(added.sets.map(s => [s.w, s.r])).toEqual([[35, 10]])
    expect(added.unit).toBe('kg')
  })
})

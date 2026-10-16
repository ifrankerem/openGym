// @vitest-environment happy-dom
// Finishing a workout on "Repeat last session" (#13): the summary's "Next time" line shows the
// sets the next session will actually open with. Found live on Android, where the summary said
// "Next time: 0 kg × 8 · lighter" while the next session correctly opened at the logged sets.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout } from './sheets.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const BENCH = '0025'
const mounted = []

function install() {
  const cfg = { id: BENCH, sets: 4, reps: 8, weight: 60, mode: 'reps' }
  const st = clone(DEF)
  st.unit = 'kg'
  st.routines = [{ id: 'r1', name: 'A', prog: 'repeat', ex: [cfg] }]
  st.active = {
    id: 'fin', d: '2026-10-03', start: Date.now() - 20 * 60000, routineIds: ['r1'], name: 'A', bw: null, cur: 0,
    entries: [{ id: BENCH, rid: 'r1', target: { ...cfg }, planned: { sets: 4, reps: 8, weight: 60 }, sets: [
      { w: 20, r: 12, done: true, phase: 'warmup', warmup: true },
      { w: 60, r: 8, done: true }, { w: 62.5, r: 6, done: true },
      { w: 62.5, r: 8, done: true }, { w: 62.5, r: 7, done: true },
    ] }],
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

describe('finish summary next time for repeat last session (#13)', () => {
  it('reads the logged sets, not 0 kg × plan reps', () => {
    install()
    act(() => finishWorkout())
    expect(useStore.getState().S.active).toBeNull()
    expect(summaryText()).toContain('Next time: 60×8 · 62.5×6 · 62.5×8 · 62.5×7 · same again')
  })
})

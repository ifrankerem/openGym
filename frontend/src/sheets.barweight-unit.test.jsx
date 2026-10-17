// @vitest-environment happy-dom
// The bar weight of a pinned exercise (issue #8): profile lb, bench pinned to kg — the sheet
// shows the bar in kg and stores it in lb, exactly, so reopening reads the same 15 back.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { barWeightSheet } from './sheets.jsx'
import { EXDB } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'   // barbell bench press
const mounted = []

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function open() {
  barWeightSheet(BENCH, { mode: 'reps', sets: 1, reps: 8, weight: 135 })
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const barStepper = host => [...host.querySelectorAll('.stp-w')]
  .find(el => el.querySelector('.stp-l')?.textContent.startsWith('Bar ('))

function install(over = {}) {
  const S = clone(DEF)
  S.unit = 'lb'
  Object.assign(S, over)
  useStore.setState({ S, user: null })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
})

describe('bar weight of a pinned exercise', () => {
  it('shows the bar in the exercise\'s unit and stores it in the profile unit', () => {
    install({ exUnit: { [BENCH]: { unit: 'kg', _ts: 1 } } })
    const host = open()
    const stepper = barStepper(host)
    expect(stepper.querySelector('.stp-l').textContent).toBe('Bar (kg)')
    expect(stepper.querySelector('input').value).toBe('20')      // the kg bar, not the 45 lb one

    act(() => type(stepper.querySelector('input'), '15'))
    expect(useStore.getState().S.barWeights[BENCH]).toBe(33.0693)
  })

  it('reopens on the number that was set', () => {
    install({ exUnit: { [BENCH]: { unit: 'kg', _ts: 1 } }, barWeights: { [BENCH]: 33.0693 } })
    expect(barStepper(open()).querySelector('input').value).toBe('15')
  })

  it('leaves an unpinned exercise on the profile unit', () => {
    install()
    const stepper = barStepper(open())
    expect(stepper.querySelector('.stp-l').textContent).toBe('Bar (lb)')
    expect(stepper.querySelector('input').value).toBe('45')
  })

  it('the exercises used here are what the test assumes', () => {
    expect(EXDB.find(e => e.id === BENCH).eq).toBe('barbell')
  })
})
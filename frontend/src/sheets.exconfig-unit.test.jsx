// @vitest-environment happy-dom
// The exercise settings sheet for a per-exercise unit (upstream #657): it opens the weights in the
// exercise's own unit, and its "Weight unit" control pins the exercise and moves the open draft
// onto the new unit's grid. An unpinned exercise's saved config is exactly what it always was.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { exConfigSheet } from './sheets.jsx'
import { EXDB } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const BENCH = EXDB.find(e => e.id === '0025')   // barbell bench press
const mounted = []

function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function open(existing, onSave, routine = null) {
  exConfigSheet(BENCH, existing, onSave, null, routine)
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

// The kg/lb control: the only segmented pair with those two labels.
const unitControl = host => [...host.querySelectorAll('.seg')]
  .find(seg => [...seg.querySelectorAll('button')].map(b => b.textContent).join(',') === 'kg,lb')
const field = (host, label) => [...host.querySelectorAll('.stp-w')]
  .find(w => w.querySelector('.stp-l')?.textContent.startsWith(label))
const save = host => act(() => [...host.querySelectorAll('button')]
  .find(b => /^(save|add to routine|use in this workout)$/i.test(b.textContent.trim())).click())

function install(over = {}) {
  const S = JSON.parse(JSON.stringify(DEF))
  S.unit = 'lb'
  Object.assign(S, over)
  useStore.setState({ S, user: null })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  localStorage.clear()
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
})

describe('the exercise settings sheet and a pinned unit', () => {
  it('switching the unit pins the exercise and moves the draft onto the kg grid', () => {
    install()
    const onSave = vi.fn()
    const host = open({ sets: 3, reps: 8, weight: 135, mode: 'reps' }, onSave)
    expect(host.textContent).toContain('Weight unit')
    expect(unitControl(host).querySelector('button.on').textContent).toBe('lb')

    act(() => [...unitControl(host).querySelectorAll('button')][0].click())   // kg
    expect(useStore.getState().S.exUnit[BENCH.id].unit).toBe('kg')
    expect(field(host, 'Weight (').querySelector('.stp-l').textContent).toBe('Weight (kg)')
    expect(field(host, 'Weight (').querySelector('input').value).toBe('61.25')

    save(host)
    expect(onSave.mock.calls[0][0].weight).toBe(135.0331)
  })

  it('an unpinned exercise saves exactly what it opened with', () => {
    install()
    const onSave = vi.fn()
    const host = open({ sets: 3, reps: 8, weight: 135, inc: 5, mode: 'reps' }, onSave)
    expect(field(host, 'Weight (').querySelector('.stp-l').textContent).toBe('Weight (lb)')
    save(host)
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0]).toMatchObject({ sets: 3, mode: 'reps', reps: 8, weight: 135, inc: 5 })
    expect('unit' in onSave.mock.calls[0][0]).toBe(false)
  })
})
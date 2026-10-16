// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'
import { bindUI } from './components/ui.jsx'

// "Repeat last session" (upstream #485) on the exercise's settings: offered like any rule,
// with no step to ask for — it moves nothing, the way off moves nothing.
const ex = EXDB.find(e => e.id === '0009')
const mounted = []

function render(sheet) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const open = (cfg, onSave = vi.fn()) => {
  exConfigSheet(ex, { sets: 3, reps: 10, weight: 40, mode: 'reps', ...cfg }, onSave)
  return render(useUI.getState().sheets.at(-1))
}
const rowNamed = (host, title) => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const labels = host => [...host.querySelectorAll('.stp-l')].map(l => l.textContent)
const pickRule = (host, name) => {
  act(() => rowNamed(host, 'Rule').click())
  const picker = render(useUI.getState().sheets.at(-1))
  const options = [...picker.querySelectorAll('button.lrow')].map(el => el.querySelector('.lrow-t')?.textContent)
  const el = [...picker.querySelectorAll('button.lrow')].find(b => b.querySelector('.lrow-t')?.textContent === name)
  if (el) act(() => el.click())
  return options
}

describe('exercise settings: repeat last session', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    bindUI(useUI)
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg' } }))
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) }) })

  it('offers "Repeat last session" as the rule', () => {
    const host = open({})
    expect(pickRule(host, 'nothing')).toContain('Repeat last session')
  })

  it('chosen, it explains itself, asks for no step, and saves without one', () => {
    const onSave = vi.fn()
    const host = open({}, onSave)
    pickRule(host, 'Repeat last session')
    expect(host.textContent).toContain('Nothing goes up or down on its own.')
    expect(labels(host).some(l => l.startsWith('Step'))).toBe(false)
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save').click())
    expect(onSave.mock.calls[0][0]).toMatchObject({ prog: 'repeat' })
  })

  it('adds its three strings to every locale pack', () => {
    const locales = import.meta.glob('./locales/*.js', { eager: true })
    const keys = [
      'Repeat last session',
      'Every set opens with the weight and reps you logged last time in this routine. Nothing goes up or down on its own.',
      'Same weight and reps as last time in this routine.',
    ]
    expect(Object.keys(locales)).not.toHaveLength(0)
    for (const module of Object.values(locales)) {
      for (const key of keys) {
        expect(typeof module.default[key]).toBe('string')
        expect(module.default[key].trim()).not.toBe('')
      }
    }
    expect(locales['./locales/tr.js'].default['Repeat last session']).toBe('Son antrenmanı tekrarla')
    expect(locales['./locales/tr.js'].default['Every set opens with the weight and reps you logged last time in this routine. Nothing goes up or down on its own.']).toBe('Her set, bu rutinde en son kaydettiğin ağırlık ve tekrarla başlar. Hiçbir şey kendiliğinden artmaz ya da azalmaz.')
    expect(locales['./locales/tr.js'].default['Same weight and reps as last time in this routine.']).toBe('Bu rutinde son seferki ağırlık ve tekrar.')
  })
})

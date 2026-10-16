import { describe, it, expect } from 'vitest'
import { finishCompare } from './finish-compare.js'

// "Repeat last session" on the finish summary (#13): the "Next time" line shows the sets the
// next session will actually open with, not a weight off the routine's target.
const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const plan = { sets: 4, reps: 8, weight: 60, mode: 'reps' }
const repeatRoutine = ex => ({ id: 'r1', name: 'A', prog: 'repeat', ex: [ex] })
const workout = (id, d, sets, entryExtra = {}) => ({ id, d, start: Date.parse(d + 'T10:00:00'), end: Date.parse(d + 'T11:00:00'),
  entries: [{ id: 'bench', rid: 'r1', target: { id: 'bench', ...plan }, planned: { sets: 4, reps: 8, weight: 60 }, sets, ...entryExtra }] })

describe('next time on the finish summary for repeat last session (#13)', () => {
  it('shows the rows the next session will open with, warm-ups left out', () => {
    const logged = [set(20, 12, { phase: 'warmup', warmup: true }), set(60, 8), set(62.5, 6), set(62.5, 8), set(62.5, 7)]
    const now = workout('w1', '2026-10-03', logged)
    const st = { unit: 'kg', routines: [repeatRoutine({ id: 'bench', ...plan })], workouts: [now], exWeights: {} }
    const [row] = finishCompare(st, now)
    expect(row.next).toEqual({
      rows: [{ w: 60, r: 8 }, { w: 62.5, r: 6 }, { w: 62.5, r: 8 }, { w: 62.5, r: 7 }],
      kind: 'hold',
    })
  })

  it('a repeat restart keeps next from the routine target, as today', () => {
    // The plan was edited mid-session: the stamped plan no longer matches the routine.
    const now = workout('w1', '2026-10-03', [set(50, 5), set(50, 5), set(50, 5)],
      { target: { id: 'bench', sets: 3, reps: 5, weight: 50, mode: 'reps' }, planned: { sets: 3, reps: 5, weight: 50 } })
    const st = { unit: 'kg', routines: [repeatRoutine({ id: 'bench', ...plan })], workouts: [now], exWeights: {} }
    const [row] = finishCompare(st, now)
    expect(row.next.rows).toBeUndefined()
    expect(row.next).toMatchObject({ w: 60, r: 8, sets: 4 })
  })

  it('linear progression is unchanged', () => {
    const cfg = { id: 'bench', sets: 3, reps: 5, weight: 60, mode: 'reps' }
    const now = { id: 'w1', d: '2026-10-03', start: Date.parse('2026-10-03T10:00:00'), end: Date.parse('2026-10-03T11:00:00'),
      entries: [{ id: 'bench', rid: 'r1', target: { ...cfg }, planned: { sets: 3, reps: 5, weight: 60 }, sets: [set(60, 5), set(60, 5), set(60, 5)] }] }
    const st = { unit: 'kg', routines: [{ id: 'r1', name: 'A', prog: 'linear', ex: [cfg] }], workouts: [now], exWeights: {} }
    const [row] = finishCompare(st, now)
    expect(row.next.rows).toBeUndefined()
    expect(row.next).toMatchObject({ w: 62.5, kind: 'up' })
  })
})

import { describe, it, expect } from 'vitest'
import { buildCombinedEntries } from './session-merge.js'
import {
  UNIT_PLACES_STORED, convertExact, setExerciseUnit, activeToProfileUnit, exerciseView,
} from './exercise-unit.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { bestWeightForEntry } from './history.js'
import { beatsWeight } from './exercises.js'

// Upstream #657: a pinned exercise steps in its own unit, session after session, with no drift.
// Machines step 10, 15 or 25 lb while free weights step 2.5 kg, and one profile holds both.
// Every case walks the real path: build → log every work set → finish (activeToProfileUnit +
// buildCompletedWorkout + the exWeights advance doFinishWorkout makes) → build the next one.
const LP = '2224' // sled 45 degrees leg press, upper legs → heavy: 10 lb / 5 kg default step
const HS = '1992' // sled full hack squat, upper legs → 25 lb step comes from its plan's inc
const SQ = '0043' // barbell squat, free weight
const DB = '0289' // dumbbell bench press
const lbOf = kg => convertExact(kg, 'kg', 'lb', UNIT_PLACES_STORED)
const kgOf = lb => convertExact(lb, 'lb', 'kg', UNIT_PLACES_STORED)

const finishOne = (S, n) => {
  const entries = buildCombinedEntries(S, ['r1']).entries
  const planned = {}
  entries.forEach(e => { planned[e.id] = e.sets.map(s => s.w) })
  entries.forEach(e => { e.sets = e.sets.map(s => ({ w: s.w, r: s.r, done: true })) })
  const active = activeToProfileUnit(
    { id: 'w' + n, d: '2026-10-0' + (n + 1), start: n * 1000, routineIds: ['r1'], entries },
    S.unit,
  )
  const w = buildCompletedWorkout(active, { end: n * 2000, prs: [] })
  const exWeights = { ...S.exWeights }
  w.entries.forEach(e => {
    const mx = bestWeightForEntry(e)
    if (mx > 0 && beatsWeight(e.id, mx, (exWeights[e.id] || {}).w || 0)) exWeights[e.id] = { w: mx, d: w.d }
  })
  return { S: { ...S, exWeights, workouts: [...S.workouts, w] }, planned }
}

const stepPlans = (S, n) => {
  const byId = {}
  let st = S
  for (let i = 1; i <= n; i++) {
    const out = finishOne(st, i)
    st = out.S
    for (const id in out.planned) {
      const rows = out.planned[id]
      if (!byId[id]) byId[id] = []
      byId[id].push(rows)
    }
  }
  return { S: st, plans: byId }
}

// One profile (kg) with the leg press and the hack squat pinned to lb and an unpinned barbell
// squat, all seeded at their case-1 starts and run through five finished sessions.
const legDay = (over = {}) => {
  const lp = { id: LP, sets: 3, reps: 10, weight: kgOf(100), prog: 'linear', mode: 'reps', warmupSets: 0 }
  const hs = { id: HS, sets: 3, reps: 10, weight: kgOf(90), inc: kgOf(25), prog: 'linear', mode: 'reps', warmupSets: 0 }
  const sq = { id: SQ, sets: 3, reps: 8, weight: 60, inc: 2.5, prog: 'linear', mode: 'reps', warmupSets: 0 }
  const seed = (cfg, w) => ({
    id: cfg.id, rid: 'r1',
    target: { ...cfg }, planned: { sets: cfg.sets, reps: cfg.reps, weight: cfg.weight },
    sets: Array.from({ length: cfg.sets }, () => ({ w, r: cfg.reps, done: true })),
  })
  const base = {
    unit: 'kg', exWeights: {}, barWeights: {}, plates: {}, bodyweight: [], active: null, ...over,
    routines: [{ id: 'r1', name: 'R1', ex: [lp, hs, sq] }],
    workouts: [{ id: 'w0', d: '2026-10-01', start: 1, end: 2, routineIds: ['r1'], entries: [seed(lp, kgOf(100)), seed(hs, kgOf(90)), seed(sq, 60)] }],
  }
  let S = setExerciseUnit(base, LP, 'lb', 1)
  S = setExerciseUnit(S, HS, 'lb', 2)
  return S
}

describe('a pinned exercise steps in its own unit, no drift over sessions', () => {
  it('the lb-pinned leg press plans 110 to 150 lb over five sessions (case 1)', () => {
    const { plans } = stepPlans(legDay(), 5)
    expect(plans[LP].flat()).toEqual([
      110, 110, 110, 120, 120, 120, 130, 130, 130, 140, 140, 140, 150, 150, 150,
    ])
  })

  it('the hack squat keeps the 25 lb step its plan carries, pinned to lb (case 2)', () => {
    const { plans } = stepPlans(legDay(), 3)
    expect(plans[HS].flat()).toEqual([115, 115, 115, 140, 140, 140, 165, 165, 165])
  })

  it('the unpinned barbell squat steps 2.5 kg in the same sessions (case 3)', () => {
    const { plans } = stepPlans(legDay(), 5)
    expect(plans[SQ].flat()).toEqual([
      62.5, 62.5, 62.5, 65, 65, 65, 67.5, 67.5, 67.5, 70, 70, 70, 72.5, 72.5, 72.5,
    ])
  })

  it('a dumbbell press pinned to kg on an lb profile steps 2.5 kg (case 4)', () => {
    const db = { id: DB, sets: 3, reps: 10, weight: lbOf(20), prog: 'linear', mode: 'reps', warmupSets: 0 }
    const seed = {
      id: DB, rid: 'r1', target: { ...db }, planned: { sets: 3, reps: 10, weight: lbOf(20) },
      sets: [{ w: lbOf(20), r: 10, done: true }, { w: lbOf(20), r: 10, done: true }, { w: lbOf(20), r: 10, done: true }],
    }
    const base = {
      unit: 'lb', exWeights: {}, barWeights: {}, plates: {}, bodyweight: [], active: null,
      routines: [{ id: 'r1', name: 'R1', ex: [db] }],
      workouts: [{ id: 'w0', d: '2026-10-01', start: 1, end: 2, routineIds: ['r1'], entries: [seed] }],
    }
    const S = setExerciseUnit(base, DB, 'kg', 1)
    const { plans } = stepPlans(S, 3)
    expect(plans[DB].flat()).toEqual([22.5, 22.5, 22.5, 25, 25, 25, 27.5, 27.5, 27.5])
  })

  // Case 5: the last logged session was 150 lb, which snaps to 68 kg on the kg grid; linear
  // progression then adds the leg press's kg step (no plan inc, so the kg default, 5 kg).
  it('after the pin is gone the next planned weight is the snap plus the kg step (case 5)', () => {
    const { S } = stepPlans(legDay(), 5)
    const unpinned = setExerciseUnit(S, LP, 'kg', 99)
    const [sixth] = buildCombinedEntries(unpinned, ['r1']).entries
    expect(sixth.unit).toBeUndefined()
    expect(sixth.sets.map(s => s.w)).toEqual([73, 73, 73])
    // the history stays readable in kg: without a pin the view is the state itself
    expect(exerciseView(unpinned, LP)).toBe(unpinned)
  })

  it('every stored leg-press set reads back on lb as a whole multiple of 10 (case 6)', () => {
    const { S } = stepPlans(legDay(), 5)
    const view = exerciseView(S, LP)
    const ws = view.workouts
      .filter(w => w.id !== 'w0')
      .flatMap(w => w.entries.filter(e => e.id === LP).flatMap(e => e.sets.map(s => s.w)))
    expect(ws).toEqual([110, 110, 110, 120, 120, 120, 130, 130, 130, 140, 140, 140, 150, 150, 150])
    ws.forEach(w => expect(Number.isInteger(w / 10)).toBe(true))
  })
})

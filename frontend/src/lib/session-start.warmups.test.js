import { describe, it, expect } from 'vitest'
import { buildPlannedEntry, buildSessionEntries } from './session-start.js'
import { isWarmupRow, syncSideAggregate } from './workout-model.js'

const BENCH = '0025'
const routineWith = cfg => ({ id: 'A', name: 'A', ex: [cfg] })
const cfg = extra => ({ id: BENCH, sets: 3, reps: 8, weight: 60, prog: 'linear', mode: 'reps', ...extra })
const state = (routine, sets = [], startFrom = 'last', extra = {}) => ({
  unit: 'kg', exWeights: {}, routines: [routine], startFrom, workouts: [], week: {}, dayPlan: {}, ...extra,
  ...(sets.length ? { workouts: [{
    id: 'prior', d: '2026-09-01', routineIds: [routine.id],
    entries: [{
      id: routine.ex[0].id, rid: routine.id,
      target: { sets: routine.ex[0].sets, reps: routine.ex[0].reps, sec: routine.ex[0].sec, weight: routine.ex[0].weight, mode: routine.ex[0].mode },
      planned: { sets: routine.ex[0].sets, reps: routine.ex[0].reps, sec: routine.ex[0].sec, weight: routine.ex[0].weight },
      sets,
    }],
  }] } : {}),
})
const loggedWarmup = (w, r, extra = {}) => ({ w, r, done: true, phase: 'warmup', warmup: true, ...extra })
const loggedWork = (w = 60, r = 8) => ({ w, r, done: true })
const entryFor = st => buildSessionEntries(st, st.routines[0])[0]
const plannedEntryFor = st => buildPlannedEntry(st, st.routines[0].ex[0], st.routines[0])
const warmups = entry => entry.sets.filter(isWarmupRow)
const work = entry => entry.sets.filter(set => !isWarmupRow(set))
const generatedWarmups = (st, build = entryFor) => warmups(build({ ...st, startFrom: 'plan' }))

describe('planned warm-ups carried from last session', () => {
  it('case 1: carries all logged reps warm-ups, in order, before work rows, reset for the new session', () => {
    const routine = routineWith(cfg())
    const st = state(routine, [
      loggedWarmup(20, 12), loggedWarmup(30, 8), loggedWarmup(40, 5),
      loggedWork(), loggedWork(), loggedWork(),
    ])
    const entry = entryFor(st)

    expect(warmups(entry).map(row => [row.w, row.r])).toEqual([[20, 12], [30, 8], [40, 5]])
    expect(warmups(entry).every(row => row.done === false && row.phase === 'warmup' && row.warmup === true)).toBe(true)
    expect(entry.sets.slice(3)).toEqual(work(entry))
    expect(work(entry)).toHaveLength(3)
  })

  it('case 2: keeps all carried rows when the routine asks for one warm-up', () => {
    const routine = routineWith(cfg({ warmupSets: 1 }))
    const st = state(routine, [loggedWarmup(20, 12), loggedWarmup(30, 8), loggedWarmup(40, 5), loggedWork(), loggedWork(), loggedWork()])
    expect(warmups(entryFor(st))).toHaveLength(3)
  })

  it('case 3: leaves carried warm-ups unchanged when linear progression raises work weight', () => {
    const routine = routineWith(cfg({ warmupSets: 2 }))
    const st = state(routine, [loggedWarmup(20, 12), loggedWarmup(30, 8), loggedWarmup(40, 5), loggedWork(), loggedWork(), loggedWork()])
    const entry = entryFor(st)

    expect(work(entry).map(row => row.w)).toEqual([62.5, 62.5, 62.5])
    expect(warmups(entry).map(row => [row.w, row.r])).toEqual([[20, 12], [30, 8], [40, 5]])
  })

  it('case 4: does not carry completion, effort, tick time, drops, or clusters', () => {
    const routine = routineWith(cfg())
    const source = loggedWarmup(30, 8, { rir: 2, rpe: 8, effort: 7, at: 123, drops: [{ w: 20, r: 4 }], clusters: [{ r: 4 }] })
    const entry = entryFor(state(routine, [source, loggedWork(), loggedWork(), loggedWork()]))

    expect(warmups(entry)).toEqual([{ w: 30, r: 8, done: false, phase: 'warmup', warmup: true }])
  })

  it('case 5: carries a warm-up even when it was not ticked last time', () => {
    const routine = routineWith(cfg())
    const entry = entryFor(state(routine, [loggedWarmup(25, 10, { done: false }), loggedWork(), loggedWork(), loggedWork()]))
    expect(warmups(entry).map(row => [row.w, row.r])).toEqual([[25, 10]])
  })

  it('case 6: uses the usual generated ramp when the last entry has no warm-ups', () => {
    const routine = routineWith(cfg({ warmupSets: 2 }))
    const st = state(routine, [loggedWork(), loggedWork(), loggedWork()])
    expect(warmups(entryFor(st))).toEqual(generatedWarmups(st))
    expect(warmups(entryFor(st))).toHaveLength(2)
    expect(warmups(entryFor(state(routine)))).toEqual(generatedWarmups(state(routine)))
  })

  it('case 7: leaves the generated ramp in place when setting is plan', () => {
    const routine = routineWith(cfg({ warmupSets: 2 }))
    const st = state(routine, [loggedWarmup(20, 12), loggedWarmup(30, 8), loggedWarmup(40, 5), loggedWork(), loggedWork(), loggedWork()], 'plan')
    expect(warmups(entryFor(st))).toEqual(generatedWarmups(st))
    expect(warmups(entryFor(st)).map(row => [row.w, row.r])).not.toEqual([[20, 12], [30, 8], [40, 5]])
  })

  it('case 8: carries both per-side loads and reps, resetting sides and aggregate', () => {
    const routine = routineWith(cfg({ side: true, warmupSets: 0 }))
    const sideRow = syncSideAggregate({
      phase: 'warmup', warmup: true,
      sides: { L: { w: 10, r: 6, done: true }, R: { w: 12, r: 6, done: true } },
    })
    const entry = entryFor(state(routine, [sideRow, loggedWork(), loggedWork(), loggedWork()]))
    const [row] = warmups(entry)

    expect(row).toBeDefined()
    expect(row.sides).toEqual({ L: { w: 10, r: 6, done: false }, R: { w: 12, r: 6, done: false } })
    expect(row).toMatchObject({ w: 12, r: 12, done: false, phase: 'warmup', warmup: true })
  })

  it('case 9: carries the duration of a timed warm-up', () => {
    const routine = routineWith({ id: 'custom-hold', sets: 2, sec: 45, weight: 0, mode: 'time', warmupSets: 0 })
    const st = state(routine, [
      { sec: 20, w: 0, done: true, phase: 'warmup', warmup: true },
      { sec: 45, w: 0, done: true }, { sec: 45, w: 0, done: true },
    ])
    expect(warmups(entryFor(st)).map(row => [row.sec, row.w])).toEqual([[20, 0]])
  })

  it('case 10: leaves progression-off warm-ups generated from the routine', () => {
    const routine = routineWith(cfg({ prog: 'off', warmupSets: 2 }))
    const st = state(routine, [loggedWarmup(22, 11), loggedWork(), loggedWork(), loggedWork()])
    expect(warmups(entryFor(st))).toEqual(generatedWarmups(st))
  })

  it('case 11: leaves excluded-routine warm-ups generated from the routine', () => {
    const routine = { ...routineWith(cfg({ warmupSets: 2 })), excludeFromProgression: true }
    const st = state(routine, [loggedWarmup(22, 11), loggedWork(), loggedWork(), loggedWork()])
    expect(warmups(entryFor(st))).toEqual(generatedWarmups(st))
  })

  it('case 12: falls back when logged warm-up rows do not match current exercise mode', () => {
    const routine = routineWith({ id: 'custom-hold', sets: 2, sec: 45, weight: 0, mode: 'time', warmupSets: 2 })
    const st = state(routine, [loggedWarmup(30, 8), loggedWork(), loggedWork()])
    expect(warmups(entryFor(st))).toEqual(generatedWarmups(st))

    const repsRoutine = routineWith(cfg({ warmupSets: 2 }))
    const noReps = state(repsRoutine, [{ w: 30, done: true, phase: 'warmup', warmup: true }, loggedWork(), loggedWork(), loggedWork()])
    expect(warmups(entryFor(noReps))).toEqual(generatedWarmups(noReps))
  })

  it('buildPlannedEntry carries warm-ups through its public entry point too', () => {
    const routine = routineWith(cfg({ warmupSets: 0 }))
    const st = state(routine, [loggedWarmup(20, 12), loggedWarmup(30, 8), loggedWarmup(40, 5), loggedWork(), loggedWork(), loggedWork()])
    expect(warmups(plannedEntryFor(st)).map(row => [row.w, row.r])).toEqual([[20, 12], [30, 8], [40, 5]])
  })

  it('does not carry warm-ups for cardio or rest-pause exercises', () => {
    const cardioRoutine = routineWith({ id: 'custom-run', mode: 'cardio', sets: 1, min: 20, speed: 8, warmupSets: 2 })
    const cardioState = state(cardioRoutine, [loggedWarmup(20, 12), { min: 20, speed: 8, done: true }])
    expect(warmups(entryFor(cardioState))).toEqual(generatedWarmups(cardioState))

    const restPauseRoutine = routineWith(cfg({ warmupSets: 1, intensifier: { type: 'restpause', totalReps: 12 } }))
    const restPauseState = state(restPauseRoutine, [loggedWarmup(20, 12), loggedWork(), loggedWork(), loggedWork()])
    expect(warmups(entryFor(restPauseState))).toEqual(generatedWarmups(restPauseState))
  })
})

describe('repeat last session carries its warm-ups too', () => {
  const repeatRoutine = exCfg => ({ id: 'A', name: 'A', prog: 'repeat', ex: [exCfg] })
  const lastSession = [
    loggedWarmup(20, 12), loggedWarmup(30, 8), loggedWarmup(40, 5),
    { w: 70, r: 8, done: true }, { w: 67.5, r: 9, done: true }, { w: 65, r: 12, done: true },
  ]
  const repeatCfg = extra => ({ id: BENCH, sets: 3, reps: 10, weight: 60, mode: 'reps', ...extra })

  for (const startFrom of ['plan', 'last']) {
    it(`carries the logged warm-ups and work rows whatever S.startFrom says (${startFrom})`, () => {
      const routine = repeatRoutine(repeatCfg())
      const entry = entryFor(state(routine, lastSession, startFrom))
      expect(entry.plan).toMatchObject({ policy: 'repeat', kind: 'repeat' })
      expect(warmups(entry).map(row => [row.w, row.r])).toEqual([[20, 12], [30, 8], [40, 5]])
      expect(warmups(entry).every(row => row.done === false)).toBe(true)
      expect(work(entry).map(row => [row.w, row.r])).toEqual([[70, 8], [67.5, 9], [65, 12]])
      expect(entry.carried).toBe(true)
    })
  }

  it('falls back to the generated ramp when the repeated session logged no warm-ups', () => {
    const routine = repeatRoutine(repeatCfg({ warmupSets: 2 }))
    const logged = lastSession.filter(row => !isWarmupRow(row))
    const entry = entryFor(state(routine, logged, 'plan'))
    expect(entry.plan.kind).toBe('repeat')
    expect(warmups(entry)).toHaveLength(2)
    expect(warmups(entry).every(row => row.done === false && isWarmupRow(row))).toBe(true)
    expect(work(entry).map(row => [row.w, row.r])).toEqual([[70, 8], [67.5, 9], [65, 12]])
  })

  it('restarts from the routine numbers with a generated ramp when nothing was logged yet', () => {
    const routine = repeatRoutine(repeatCfg({ warmupSets: 2 }))
    const entry = entryFor(state(routine, [], 'plan'))
    const off = entryFor(state({ ...repeatRoutine(repeatCfg({ prog: 'off', warmupSets: 2 })) }, [], 'plan'))
    expect(entry.plan).toMatchObject({ policy: 'repeat', kind: 'restart' })
    expect(warmups(entry)).toEqual(warmups(off))
    expect(warmups(entry)).toHaveLength(2)
    expect(work(entry).map(row => [row.w, row.r])).toEqual([[60, 10], [60, 10], [60, 10]])
  })

  it('restarts from the routine numbers when the only history lives in another routine', () => {
    const a = repeatRoutine(repeatCfg({ warmupSets: 2 }))
    const b = { id: 'B', name: 'B', ex: [repeatCfg({ sets: 2, reps: 15, weight: 40 })] }
    const st = {
      unit: 'kg', exWeights: {}, routines: [a, b], startFrom: 'plan', workouts: [{
        id: 'prior', d: '2026-09-01', routineIds: ['B'],
        entries: [{
          id: BENCH, rid: 'B',
          target: { sets: 2, reps: 15, weight: 40 },
          planned: { sets: 2, reps: 15, weight: 40 },
          sets: [loggedWarmup(22, 11), { w: 40, r: 15, done: true }, { w: 40, r: 15, done: true }],
        }],
      }], week: {}, dayPlan: {},
    }
    const entry = buildSessionEntries(st, a)[0]
    const off = buildSessionEntries({ ...st, routines: [{ ...a, ex: [{ ...a.ex[0], prog: 'off' }] }] }, { ...a, ex: [{ ...a.ex[0], prog: 'off' }] })[0]
    expect(entry.plan).toMatchObject({ policy: 'repeat', kind: 'restart' })
    expect(warmups(entry)).toEqual(warmups(off))
    expect(warmups(entry).map(row => [row.w, row.r])).not.toEqual([[22, 11]])
    expect(work(entry).map(row => [row.w, row.r])).toEqual([[60, 10], [60, 10], [60, 10]])
  })
})

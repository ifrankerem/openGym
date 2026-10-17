// The finish summary's "last time / next time" (#324): one line per lift, today against the
// previous session of the same exercise, and what the next session will open at. "Next" has no
// rule of its own: it is buildPlannedEntry, the same call Start makes, run on the state right
// after this workout was saved, so the summary cannot promise a number the next session won't.
import { isWarmupRow, isFailureSet } from './workout-model.js'
import { buildPlannedEntry } from './session-start.js'
import { workoutAt, modeOf } from './history.js'
import { exerciseUnit, convertExact, UNIT_PLACES_SHOWN } from './exercise-unit.js'

// Every row the summary can print: warm-ups left out, each reduced to its load and reps.
// `f`: taken to failure, so the summary can mark it; written only when true.
const rowsOf = sets => (Array.isArray(sets) ? sets : [])
  .filter(s => s && !isWarmupRow(s) && Number(s.r) > 0)
  .map(s => ({ w: Number(s.w) || 0, r: Math.round(Number(s.r)), ...(isFailureSet(s) ? { f: true } : {}) }))

const workSets = entry => rowsOf((Array.isArray(entry?.sets) ? entry.sets : []).filter(s => s?.done))

const top = sets => sets.reduce((m, s) => Math.max(m, s.w), 0)
const reps = sets => sets.reduce((n, s) => n + s.r, 0)

/** -1, 0 or 1: today against last time, by the heaviest set first, then by total reps. */
export function trendOf(today, last) {
  if (!last?.length) return null
  const dw = top(today) - top(last)
  if (Math.abs(dw) > 1e-9) return dw > 0 ? 1 : -1
  const dr = reps(today) - reps(last)
  return dr ? Math.sign(dr) : 0
}

/** Rows for the summary of `w`, read from `st` (which already holds `w`). Cardio and timed sets are left out. */
export function finishCompare(st, w) {
  const workouts = (st?.workouts || []).filter(x => x && x !== w && x.id !== w?.id && workoutAt(x) < workoutAt(w))
  const rows = []
  const seen = new Set()
  for (const entry of w?.entries || []) {
    if (!entry?.id || seen.has(entry.id)) continue
    const mode = modeOf(entry.target || entry)
    if (mode !== 'reps') continue
    const logged = workSets(entry)
    if (!logged.length) continue
    seen.add(entry.id)
    let previous = null
    for (let i = workouts.length - 1; i >= 0 && !previous; i--) {
      const prev = (workouts[i].entries || []).find(e => e?.id === entry.id)
      const sets = prev ? workSets(prev) : []
      if (sets.length) previous = sets
    }
    // A pinned exercise reads today and last time in its own unit (issue #10): the record is
    // stored in the profile's, and a weight printed under the wrong unit is worse than none.
    // `next` is built by buildPlannedEntry, which already hands a pinned exercise back in its
    // own unit, so it is left exactly as built.
    const profile = st?.unit || 'kg'
    const unit = exerciseUnit(st, entry.id)
    const reading = unit === profile
      ? rows => rows
      : rows => rows.map(s => ({ ...s, w: convertExact(s.w, profile, unit, UNIT_PLACES_SHOWN) }))
    const today = reading(logged)
    const last = previous ? reading(previous) : null
    let next = null
    const routine = entry.rid ? (st.routines || []).find(r => r.id === entry.rid) : null
    const cfg = routine && !routine.excludeFromProgression && !entry.noProg && !w.noProg
      ? (routine.ex || []).find(c => c?.id === entry.id) : null
    if (cfg) {
      try {
        const built = buildPlannedEntry(st, cfg, routine)
        const nw = built.target?.weight, nr = built.target?.reps
        if (built.plan?.kind === 'repeat') {
          // "Repeat last session" has no single number to promise — it opens at the sets logged,
          // weight and reps set by set — so the line shows those rows rather than one weight off
          // the routine's target, which read as "0 kg × 8 · lighter" (issue #13).
          next = { rows: rowsOf(built.sets), kind: 'hold' }
        } else if (nw != null || nr != null) {
          const kind = built.plan?.kind === 'deload' ? 'deload'
            : nw != null && nw > top(today) + 1e-9 ? 'up'
              : nw != null && nw < top(today) - 1e-9 ? 'down' : 'hold'
          next = { w: nw ?? null, r: nr ?? null, sets: built.target?.sets ?? null, kind }
        }
      } catch { /* a routine the builder cannot read keeps its row without a "next" */ }
    }
    rows.push({ id: entry.id, today, last, trend: trendOf(today, last), next, unit })
  }
  return rows
}

/**
 * The cardio of `w` for the finish summary, which the rows above leave out: one row per cardio
 * exercise with the sets that were done, warm-ups included (a walk to warm up is still a walk).
 * The summary prints them with setLabel, so a treadmill's speed and incline read as logged.
 */
export function finishCardio(w) {
  const rows = []
  for (const entry of w?.entries || []) {
    if (!entry?.id || modeOf({ ...(entry.target || {}), id: entry.id }) !== 'cardio') continue
    const sets = (Array.isArray(entry.sets) ? entry.sets : []).filter(s => s && s.done && (Number(s.min) > 0 || Number(s.speed) > 0))
    if (sets.length) rows.push({ id: entry.id, target: entry.target, sets })
  }
  return rows
}

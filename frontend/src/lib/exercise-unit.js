// Per-exercise weight unit (upstream #657): the pure core — which unit an
// exercise uses, a read-only view of the state in that unit, the conversions at its edges, and
// the switch itself. No store, no UI.
//
// Everything persisted stays in the profile unit `S.unit`, exactly as today, so stats, Coach,
// MCP, imports and exports keep working. An exercise pinned to the other unit is read and
// shown through `exerciseView`, and converted back exactly (never onto a plate grid) so a
// stored value comes back unchanged. The one exception is a running session, which is why an
// active entry carries `unit`.
//
// Imports the same conversion factor as lib/units.js rather than repeating the rounding rules
// around it; units.js already imports history.js, so this adds no cycle.
import { isSideSet, syncSideAggregate } from './workout-model.js'
import { modeOf, workoutVolume } from './history.js'
import { convertWeight, convertBodyWeight } from './units.js'

const LB_PER_KG = 2.2046226218

/** Decimals a stored weight keeps (so it comes back unchanged) and a shown one prints to. */
export const UNIT_PLACES_STORED = 4
export const UNIT_PLACES_SHOWN = 3

/**
 * Convert a weight with the profile's factor and nothing else — no plate rounding, so a value
 * stored through `exerciseView` reads back as the same number. Anything that is not a finite
 * number, and any value in the unit it is already in, comes back untouched.
 */
export function convertExact(value, from, to, places = UNIT_PLACES_STORED) {
  if (from === to || value == null || value === '' || !Number.isFinite(Number(value))) return value
  const v = Number(value) * (to === 'lb' ? LB_PER_KG : 1 / LB_PER_KG)
  const f = 10 ** places
  return Math.round(v * f) / f
}

// The rounding `convertWeight` applies on the way into a unit: lb to the nearest 0.5, kg to the
// nearest 0.25. Spelled out because convertWeight returns a value untouched when both units are
// the same, and the switch needs the snap on its own.
const snapGrid = (v, unit) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return unit === 'lb' ? Math.round(n * 2) / 2 : Math.round(n * 4) / 4
}

/**
 * The unit pinned to this exercise, or null when it follows the profile. `null` is stored as a
 * tombstone (with its own `_ts`) rather than left out, so a sync can tell a cleared pin from an
 * exercise never pinned.
 */
export const unitPinOf = (S, exId) => S?.exUnit?.[exId]?.unit ?? null

/** The unit this exercise is worked in: its pin when it has one, else the profile's. */
export const exerciseUnit = (S, exId) => unitPinOf(S, exId) || S?.unit || 'kg'

/** Cardio carries minutes, speed and incline, never a load: there is no weight to pin. */
export const canPinUnit = cfg => modeOf(cfg) !== 'cardio'

// Every weight-bearing field of a config, converted by `conv`. `inc` is a load only in reps
// mode (lib/units.js); a timed exercise's step is seconds.
const mapCfg = (cfg, conv) => {
  if (!cfg || typeof cfg !== 'object') return cfg
  const out = { ...cfg }
  if (out.weight != null) out.weight = conv(out.weight)
  if (out.inc > 0 && (out.mode == null || out.mode === 'reps')) out.inc = conv(out.inc)
  if (Array.isArray(out.warmup)) out.warmup = out.warmup.map(w => (w && w.weight != null ? { ...w, weight: conv(w.weight) } : w))
  // A pyramid's own weight per set; 0 ("no plan for this set") stays 0.
  if (Array.isArray(out.pyramidWeight)) out.pyramidWeight = out.pyramidWeight.map(w => (w > 0 ? conv(w) : w))
  return out
}

// Every weight-bearing field of a session entry, converted by `conv`: the top set's load, the
// target and the plan the entry was built from, each set's load and drops, and a per-side set
// side by side with its aggregate resynced.
const mapEntry = (entry, conv) => {
  if (!entry || typeof entry !== 'object') return entry
  const side = s => (s && typeof s === 'object' ? { ...s, w: conv(s.w) } : s)
  const set = s => {
    if (!s || typeof s !== 'object') return s
    if (isSideSet(s)) return syncSideAggregate({ ...s, sides: { L: side(s.sides.L), R: side(s.sides.R) } })
    const out = { ...s }
    if (out.w != null) out.w = conv(out.w)
    if (Array.isArray(out.drops)) out.drops = out.drops.map(d => (d && typeof d === 'object' ? { ...d, w: conv(d.w) } : d))
    return out
  }
  return {
    ...entry,
    ...(entry.topW != null ? { topW: conv(entry.topW) } : {}),
    ...(entry.target ? { target: mapCfg(entry.target, conv) } : {}),
    ...(entry.planned ? { planned: mapCfg(entry.planned, conv) } : {}),
    ...(Array.isArray(entry.sets) ? { sets: entry.sets.map(set) } : {}),
  }
}

/** A copy of a routine slot or target config with its weights converted exactly. */
export const cfgInUnit = (cfg, from, to, places = UNIT_PLACES_SHOWN) =>
  (from === to ? cfg : mapCfg(cfg, v => convertExact(v, from, to, places)))

/** A copy of a session entry with its weights converted exactly. */
export const entryInUnit = (entry, from, to, places = UNIT_PLACES_SHOWN) =>
  (from === to ? entry : mapEntry(entry, v => convertExact(v, from, to, places)))

/**
 * A finished entry back into the profile unit, for saving: an entry that says which unit its
 * weights are in (`entry.unit`, a running session's) is converted into the profile unit with
 * stored places and comes back without the stamp — everything persisted is in the profile unit.
 * An entry already in the profile unit only loses the stamp; one without it is the same object.
 */
export function entryToProfileUnit(entry, profileUnit) {
  if (!entry?.unit || !profileUnit) return entry
  const { unit: _stamp, ...rest } = mapEntry(entry, v => convertExact(v, entry.unit, profileUnit, UNIT_PLACES_STORED))
  return rest
}

/**
 * The state as one pinned exercise reads it: `unit` is that exercise's unit and its weights —
 * and only its weights — are converted into it. Every other exercise, and every field that
 * carries no weight of this one, is the very same object as in `S`. An exercise that follows the
 * profile unit needs no view at all, and `S` itself comes back.
 */
export function exerciseView(S, exId) {
  const unit = exerciseUnit(S, exId)
  const from = S?.unit || 'kg'
  if (unit === from) return S
  const c = v => convertExact(v, from, unit, UNIT_PLACES_SHOWN)
  const convSession = s => (s && Array.isArray(s.entries) && s.entries.some(e => e?.id === exId)
    ? { ...s, entries: s.entries.map(e => (e?.id === exId ? mapEntry(e, c) : e)) }
    : s)
  const out = { ...S, unit }
  if (Array.isArray(S.workouts)) out.workouts = S.workouts.map(convSession)
  // A running session's entry holds its weights in its own unit and says so; one that does not
  // is read in the profile's unit.
  if (S.active && Array.isArray(S.active.entries)) {
    out.active = { ...S.active, entries: S.active.entries.map(e => {
      if (e?.id !== exId) return e
      const cur = e.unit || from
      return cur === unit ? e : { ...mapEntry(e, c), unit }
    }) }
  }
  if (S.exWeights) out.exWeights = Object.fromEntries(Object.entries(S.exWeights)
    .map(([k, v]) => [k, k === exId ? (v && typeof v === 'object' ? { ...v, w: c(v.w) } : c(v)) : v]))
  if (S.barWeights) out.barWeights = Object.fromEntries(Object.entries(S.barWeights)
    .map(([k, v]) => [k, k === exId && typeof v === 'number' && v > 0 ? c(v) : v]))
  if (Array.isArray(S.routines)) out.routines = S.routines.map(r => (r?.ex || []).some(cfg => cfg?.id === exId)
    ? { ...r, ex: (r.ex || []).map(cfg => (cfg?.id === exId ? mapCfg(cfg, c) : cfg)) }
    : r)
  // Body weight is not this exercise's weight, but the profile is read in the exercise's unit,
  // so the weigh-ins and the target move with it (lib/units.js convertStateUnit).
  if (Array.isArray(S.bodyweight)) out.bodyweight = S.bodyweight.map(b => ({ ...b, w: convertBodyWeight(b.w, from, unit) }))
  if (S.targetW != null) out.targetW = convertBodyWeight(S.targetW, from, unit)
  return out
}

/**
 * An entry going into a running session, in the unit its exercise is worked in (#657): a pinned
 * exercise's rows are converted into its pin unit and stamped, and an entry that carries a unit
 * the exercise no longer works in (a pin changed, or cleared, since the session started) comes
 * back into the profile unit without the stamp. Anything already in the right unit is the same
 * object, so an unpinned exercise is untouched.
 */
export function sessionEntryInUnit(S, entry) {
  if (!entry || typeof entry !== 'object') return entry
  const profile = S?.unit || 'kg'
  const pin = unitPinOf(S, entry.id)
  const pinned = !!pin && pin !== profile
  const has = entry.unit || profile
  const to = pinned ? pin : profile
  if (has === to) return entry
  // Into the pin it is what the lifter reads; back to the profile it is stored, so it keeps
  // stored places and the record reads back exactly as it was written.
  const places = pinned ? UNIT_PLACES_SHOWN : UNIT_PLACES_STORED
  const { unit: _stamp, ...rest } = entryInUnit(entry, has, to, places)
  return pinned ? { ...rest, unit: pin } : rest
}

/**
 * A running session as it is stored: every entry that says which unit its weights are in comes
 * back converted into the profile unit, unstamped, so the saved workout holds only profile-unit
 * numbers. A session with no pinned exercise is `active` itself.
 */
export function activeToProfileUnit(active, profileUnit) {
  if (!Array.isArray(active?.entries) || !active.entries.some(e => e?.unit)) return active
  return { ...active, entries: active.entries.map(e => entryToProfileUnit(e, profileUnit)) }
}

/**
 * Pin an exercise to a unit, or unpin it back to the profile's: a new state with the pin
 * stamped, every stored weight of that exercise snapped once onto the unit's plate grid, and
 * the active entries moved onto it and restamped. A no-op (the unit it already uses, a unit
 * that is not a weight unit, a cardio exercise) hands back `S` itself.
 */
export function setExerciseUnit(S, exId, unit, now = Date.now()) {
  if (!S || (unit !== 'kg' && unit !== 'lb') || !canPinUnit({ id: exId }) || unit === exerciseUnit(S, exId)) return S
  const from = S.unit || 'kg'
  const pinning = unit !== from
  // Pinning stores the number the pin's grid produced, converted back exactly so reading it
  // again returns the same weight; unpinning rounds onto the profile grid, where the stored
  // number already is.
  const stored = v => (pinning ? convertExact(convertWeight(v, from, unit), unit, from, UNIT_PLACES_STORED) : snapGrid(v, unit))
  const out = { ...S, exUnit: { ...(S.exUnit || {}), [exId]: { unit: pinning ? unit : null, _ts: now } } }
  const convSession = s => {
    if (!s || !Array.isArray(s.entries) || !s.entries.some(e => e?.id === exId)) return s
    const entries = s.entries.map(e => (e?.id === exId ? mapEntry(e, stored) : e))
    // A session's cached total volume reads its set list; it has to move with it.
    return Number.isFinite(s.vol)
      ? { ...s, entries, vol: workoutVolume({ entries: entries.filter(e => Array.isArray(e?.sets)) }) }
      : { ...s, entries }
  }
  if (Array.isArray(S.workouts)) out.workouts = S.workouts.map(convSession)
  if (S.active && Array.isArray(S.active.entries)) {
    out.active = { ...S.active, entries: S.active.entries.map(e => {
      if (e?.id !== exId) return e
      // The active entry is the one that lives in the pin's unit, so it is converted on the
      // grid (what the lifter will load) rather than exactly.
      const moved = mapEntry(e, v => convertWeight(v, e.unit || from, unit))
      if (pinning) return { ...moved, unit }
      const { unit: _stamp, ...rest } = moved
      return rest
    }) }
  }
  if (S.exWeights) out.exWeights = Object.fromEntries(Object.entries(S.exWeights)
    .map(([k, v]) => [k, k === exId ? (v && typeof v === 'object' ? { ...v, w: stored(v.w) } : stored(v)) : v]))
  if (S.barWeights) out.barWeights = Object.fromEntries(Object.entries(S.barWeights)
    .map(([k, v]) => [k, k === exId && typeof v === 'number' && v > 0 ? stored(v) : v]))
  if (Array.isArray(S.routines)) out.routines = S.routines.map(r => (r?.ex || []).some(cfg => cfg?.id === exId)
    ? { ...r, ex: (r.ex || []).map(cfg => (cfg?.id === exId ? mapCfg(cfg, stored) : cfg)) } : r)
  return out
}
// The state one exercise reads in its own unit (upstream #657, lib/exercise-unit.js).
//
// Everything persisted stays in the profile unit; a pinned exercise is read, stepped and shown
// in the unit it is worked in. A view is that state with the exercise's weights converted, so a
// component renders it like any other state, while its writes still go through the store's own
// update on the real one (a running entry of a pinned exercise is already in its unit).
import { useMemo } from 'react'
import { useStore } from './useStore.js'
import { exerciseView } from '../lib/exercise-unit.js'

/** `exerciseView(S, exId)` for the store's current state; the same `S` object when unpinned. */
export function useExerciseView(exId) {
  const S = useStore(s => s.S)
  return useMemo(() => exerciseView(S, exId), [S, exId])
}

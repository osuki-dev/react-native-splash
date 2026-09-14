import type { SplashPhase } from './types'

/** Everything the overlay knows that can move the phase forward. */
export interface SplashPhaseInput {
  /** The native overlay is gone (hide resolved, or native hid itself). */
  nativeHidden: boolean
  /** The app has finished whatever it wanted to load behind the splash. */
  ready: boolean
  /** `minimumDuration` has elapsed since the handoff. */
  minimumElapsed: boolean
  /** The JS or native safety timeout fired. */
  timedOut: boolean
  /** The bundle failed to load or an uncaught error was reported. */
  failed: boolean
  /** The render prop called `finish()` or `exitTimeout` fired. */
  finished: boolean
}

/**
 * One step of the overlay state machine. Pure, so the timing rules are
 * unit-testable without React. The caller re-runs it whenever an input
 * changes; a step never skips a phase so every transition is observable.
 */
export function nextSplashPhase(phase: SplashPhase, input: SplashPhaseInput): SplashPhase {
  switch (phase) {
    case 'native':
      return input.nativeHidden ? 'visible' : 'native'
    case 'visible':
      if (input.timedOut || input.failed) return 'exiting'
      return input.ready && input.minimumElapsed ? 'exiting' : 'visible'
    case 'exiting':
      return input.finished ? 'hidden' : 'exiting'
    case 'hidden':
      return 'hidden'
  }
}

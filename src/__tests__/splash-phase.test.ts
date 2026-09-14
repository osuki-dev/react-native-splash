import { describe, expect, test } from 'bun:test'

import { nextSplashPhase } from '../splash-phase'
import type { SplashPhaseInput } from '../splash-phase'

const idle: SplashPhaseInput = {
  nativeHidden: false,
  ready: false,
  minimumElapsed: false,
  timedOut: false,
  failed: false,
  finished: false,
}

describe('nextSplashPhase', () => {
  test('stays native until the native overlay is gone', () => {
    expect(nextSplashPhase('native', { ...idle, ready: true, minimumElapsed: true })).toBe('native')
    expect(nextSplashPhase('native', { ...idle, nativeHidden: true })).toBe('visible')
  })

  test('never skips visible even when everything is already ready', () => {
    const all = { ...idle, nativeHidden: true, ready: true, minimumElapsed: true }
    expect(nextSplashPhase('native', all)).toBe('visible')
    expect(nextSplashPhase('visible', all)).toBe('exiting')
  })

  test('visible waits for both ready and the minimum duration', () => {
    expect(nextSplashPhase('visible', { ...idle, nativeHidden: true, ready: true })).toBe('visible')
    expect(nextSplashPhase('visible', { ...idle, nativeHidden: true, minimumElapsed: true })).toBe('visible')
    expect(nextSplashPhase('visible', { ...idle, nativeHidden: true, ready: true, minimumElapsed: true })).toBe(
      'exiting',
    )
  })

  test('timeout and failure force the exit regardless of ready', () => {
    expect(nextSplashPhase('visible', { ...idle, nativeHidden: true, timedOut: true })).toBe('exiting')
    expect(nextSplashPhase('visible', { ...idle, nativeHidden: true, failed: true })).toBe('exiting')
  })

  test('exiting waits for finish and hidden is terminal', () => {
    expect(nextSplashPhase('exiting', { ...idle, nativeHidden: true, ready: true })).toBe('exiting')
    expect(nextSplashPhase('exiting', { ...idle, finished: true })).toBe('hidden')
    expect(nextSplashPhase('hidden', idle)).toBe('hidden')
  })
})

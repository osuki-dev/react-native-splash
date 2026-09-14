import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

/**
 * Where the launch sequence is:
 *
 * - `native`: the native overlay is on screen; JS is starting up.
 * - `visible`: the JS overlay is on screen and native is gone. `ready`,
 *   `minimumDuration` and any intro content live here.
 * - `exiting`: the exit animation is running; the overlay ignores touches.
 * - `hidden`: the overlay unmounted; the app is fully visible.
 */
export type SplashPhase = 'native' | 'visible' | 'exiting' | 'hidden'

export type SplashColorScheme = 'light' | 'dark'

export interface SplashLogo {
  /** Platform resource name; also usable as `{ uri }` for `Image`. */
  name: string
  width: number
  height: number
}

export interface SplashManifest {
  backgroundColor: string
  darkBackgroundColor?: string
  logo?: SplashLogo
  darkLogo?: SplashLogo
  logoSizeRatio: number
  statusBarHeight: number
  navigationBarHeight: number
  edgeToEdge: boolean
  autoHide: boolean
  hideTimeoutMs: number
}

export interface SplashLaunchInfo {
  coldStart: boolean
  reload: boolean
  systemSplashShown: boolean
  processStartMs: number
  overlayAttachedMs: number
  colorScheme: SplashColorScheme
  /** False when the native module is unavailable (Jest, Expo Go, web). */
  nativeAvailable: boolean
}

export interface SplashHideOptions {
  /** Cross-dissolve the native overlay instead of removing it instantly. Default false. */
  fade?: boolean
  /** Fade duration in ms. Default 300. */
  duration?: number
}

export interface SplashEventMap {
  phase: { phase: SplashPhase; previous: SplashPhase; timestampMs: number }
  nativeHidden: { timestampMs: number }
  hidden: { timestampMs: number; durationMs: number }
  timeout: { source: 'native' | 'js' }
  error: { reason: 'jsLoadFailed' | 'uncaughtError' }
}

export type SplashEventName = keyof SplashEventMap

export type SplashListener<E extends SplashEventName> = (payload: SplashEventMap[E]) => void

export interface SplashRenderContext {
  phase: Exclude<SplashPhase, 'hidden'>
  manifest: SplashManifest
  launchInfo: SplashLaunchInfo
  colorScheme: SplashColorScheme
  /** Call when your exit animation has finished. */
  finish: () => void
}

export interface SplashOverlayProps {
  /** Gate. The overlay stays in `visible` until this is true. Default true. */
  ready?: boolean
  /** Minimum time on screen after the native handoff, ms. Default 0. */
  minimumDuration?: number
  /** Hard cap after the handoff, ms. 0 disables. Default 15000. */
  timeout?: number
  /** If the render prop never calls `finish()`, unmount after this many ms. Default 2000. */
  exitTimeout?: number
  /**
   * Android: when the OS drew no launch screen (started from a notification,
   * a widget, some intents) go straight to `hidden`. Default false.
   */
  skipWithoutSystemSplash?: boolean
  onPhaseChange?: (phase: SplashPhase) => void
  onHidden?: () => void
  /** Extra styles for the full-screen container (zIndex, backgroundColor). */
  style?: StyleProp<ViewStyle>
  /** Default content is `<SplashMirror />` with a built-in fade. */
  children?: (context: SplashRenderContext) => ReactNode
}

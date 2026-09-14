/**
 * Nitro spec for @osuki-dev/react-native-splash.
 *
 * `nitrogen` turns this file into `HybridSplashScreenSpec` (a Swift protocol
 * and a Kotlin abstract class) that `ios/HybridSplashScreen.swift` and
 * `android/.../HybridSplashScreen.kt` implement. Both are thin adapters over
 * the platform `SplashScreenManager`, which is alive long before JS is.
 *
 * Everything in this file is internal. The public API lives in `src/index.ts`.
 */
import type { HybridObject } from 'react-native-nitro-modules'

// ---------------------------------------------------------------------------
// Plain data
// ---------------------------------------------------------------------------

export interface SplashLogoSpec {
  /**
   * Platform resource name: an asset-catalog image on iOS, a drawable on
   * Android. React Native's `Image` loads both with `{ uri: name }`.
   */
  name: string
  /** Logical size in points / dp. On Android this is the 288 dp icon canvas. */
  width: number
  height: number
}

/**
 * A picture the app asked native to show instead of the compiled launch
 * assets, from the next cold start on: a theme's own artwork, for example.
 * The OS-drawn launch screen still shows the compiled assets for its first
 * frames; this replaces everything the library draws after it.
 */
export interface SplashLaunchImageSpec {
  /** `file://` URI or absolute path of an image on disk. */
  uri: string
  backgroundColor: string
  darkBackgroundColor?: string
  /** Box width as a fraction of the window width. */
  widthFraction: number
  /** Box width cap in points / dp. */
  maxWidth: number
  /** Box width divided by height. */
  aspectRatio: number
}

export interface SplashManifestSpec {
  /** The launch image in effect for this process, if the app set one. */
  launchImage?: SplashLaunchImageSpec
  backgroundColor: string
  darkBackgroundColor?: string
  logo?: SplashLogoSpec
  darkLogo?: SplashLogoSpec
  /** Samsung OneUI 4 draws the Android 12 icon at half size; 1 elsewhere. */
  logoSizeRatio: number
  /** dp, Android only; 0 on iOS. */
  statusBarHeight: number
  /** dp, Android only; 0 on iOS. */
  navigationBarHeight: number
  edgeToEdge: boolean
  /** Whether native hides itself when React content first appears. */
  autoHide: boolean
  /** Native safety cap, ms. 0 disables. */
  hideTimeoutMs: number
}

export type SplashColorScheme = 'light' | 'dark'

export interface SplashLaunchInfoSpec {
  /** True until the overlay has been shown a second time in this process. */
  coldStart: boolean
  /** True once React content has appeared more than once in this process (dev reload). */
  reload: boolean
  /**
   * Whether the OS actually drew a launch screen before the overlay attached.
   * Always true on iOS. On Android 12+ it is false when the app was started
   * from a notification, a widget or an intent that opted out of the splash.
   */
  systemSplashShown: boolean
  /** Milliseconds since the Unix epoch. */
  processStartMs: number
  /** Milliseconds since the Unix epoch; 0 if the overlay never attached. */
  overlayAttachedMs: number
  colorScheme: SplashColorScheme
}

export type SplashNativeEventType = 'attached' | 'hidden' | 'shown' | 'timeout' | 'jsLoadFailed'

export interface SplashNativeEvent {
  type: SplashNativeEventType
  /** Milliseconds since the Unix epoch. */
  timestampMs: number
}

export interface SplashHideOptionsSpec {
  fade: boolean
  durationMs: number
}

// ---------------------------------------------------------------------------
// Hybrid object
// ---------------------------------------------------------------------------

export interface SplashScreen extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  readonly manifest: SplashManifestSpec
  readonly launchInfo: SplashLaunchInfoSpec

  /** Whether the native overlay is currently on screen. */
  isVisible(): boolean

  /** Stop native from hiding itself when React content first appears. */
  preventAutoHide(): void

  /**
   * Remove the native overlay. Resolves once the view is gone. Safe to call
   * before the overlay attached (queued) and after it was hidden (no-op).
   */
  hide(options: SplashHideOptionsSpec): Promise<void>

  /** Present the native overlay again (dev reload, `Updates.reloadAsync()`). */
  show(): Promise<void>

  /**
   * Show this picture on the pack's paper from the next cold start on, in
   * place of the compiled launch assets. Persisted natively.
   */
  setLaunchImage(image: SplashLaunchImageSpec): void
  /** Back to the compiled launch assets from the next cold start on. */
  clearLaunchImage(): void

  /**
   * One listener for all native events; the JS layer fans out. Native holds
   * exactly one strong reference to a JS closure this way.
   */
  setEventListener(listener: (event: SplashNativeEvent) => void): void
  clearEventListener(): void
}

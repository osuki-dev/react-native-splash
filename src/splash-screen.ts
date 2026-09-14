import { getNativeSplashScreen } from './native'
import type { SplashNativeEvent } from './specs/SplashScreen.nitro'
import type {
  SplashEventMap,
  SplashEventName,
  SplashHideOptions,
  SplashLaunchImage,
  SplashLaunchInfo,
  SplashListener,
  SplashManifest,
  SplashPhase,
} from './types'

const FALLBACK_MANIFEST: SplashManifest = {
  backgroundColor: '#ffffff',
  logoSizeRatio: 1,
  statusBarHeight: 0,
  navigationBarHeight: 0,
  edgeToEdge: true,
  autoHide: true,
  hideTimeoutMs: 0,
}

const FALLBACK_LAUNCH_INFO: SplashLaunchInfo = {
  coldStart: true,
  reload: false,
  systemSplashShown: false,
  processStartMs: 0,
  overlayAttachedMs: 0,
  colorScheme: 'light',
  nativeAvailable: false,
}

type ListenerSets = { [E in SplashEventName]?: Set<SplashListener<E>> }

/**
 * Imperative surface over the native overlay plus the JS phase bookkeeping
 * shared with `<SplashOverlay>`. One instance per JS runtime.
 */
class SplashScreenController {
  private phase: SplashPhase = 'native'
  private listeners: ListenerSets = {}
  private nativeListenerInstalled = false
  private overlayAttached = false
  private errorHandlerInstalled = false
  private prevented = false
  private manifestCache: SplashManifest | null = null

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Keep the native overlay up until `hide()` is called. Call this at module
   * scope: React content can appear before the first effect runs.
   */
  preventAutoHide(): void {
    if (this.prevented) return
    this.prevented = true
    this.native()?.preventAutoHide()
  }

  /** Remove the native overlay. Resolves once the view is gone. */
  async hide(options: SplashHideOptions = {}): Promise<void> {
    const native = this.native()
    if (native === null) {
      this.markNativeHidden()
      return
    }
    await native.hide({ fade: options.fade ?? false, durationMs: options.duration ?? 300 })
  }

  /** Present the native overlay again. */
  async show(): Promise<void> {
    const native = this.native()
    if (native === null) return
    await native.show()
    this.setPhase('native')
  }

  /**
   * From the next cold start on, native draws this picture on this paper
   * instead of the compiled launch assets, and `getManifest().launchImage`
   * reports it so `useSplashMirror` paints the same frame. Persisted natively.
   */
  setLaunchImage(image: SplashLaunchImage): void {
    this.native()?.setLaunchImage({ ...image })
  }

  /** Back to the compiled launch assets from the next cold start on. */
  clearLaunchImage(): void {
    this.native()?.clearLaunchImage()
  }

  isVisible(): boolean {
    return this.native()?.isVisible() ?? false
  }

  getPhase(): SplashPhase {
    return this.phase
  }

  getManifest(): SplashManifest {
    if (this.manifestCache) return this.manifestCache
    const native = this.native()
    this.manifestCache = native ? { ...native.manifest } : FALLBACK_MANIFEST
    return this.manifestCache
  }

  getLaunchInfo(): SplashLaunchInfo {
    const native = this.native()
    if (native === null) return FALLBACK_LAUNCH_INFO
    return { ...native.launchInfo, nativeAvailable: true }
  }

  addListener<E extends SplashEventName>(event: E, listener: SplashListener<E>): () => void {
    this.native()
    const sets = this.listeners as Record<SplashEventName, Set<SplashListener<E>> | undefined>
    const set = (sets[event] ??= new Set())
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }

  // -------------------------------------------------------------------------
  // Internal API used by <SplashOverlay>
  // -------------------------------------------------------------------------

  /** @internal */
  attachOverlay(): () => void {
    this.overlayAttached = true
    this.installErrorHandler()
    return () => {
      this.overlayAttached = false
    }
  }

  /** @internal */
  setPhase(phase: SplashPhase): void {
    if (phase === this.phase) return
    const previous = this.phase
    this.phase = phase
    this.emit('phase', { phase, previous, timestampMs: Date.now() })
  }

  /** @internal */
  emit<E extends SplashEventName>(event: E, payload: SplashEventMap[E]): void {
    const set = this.listeners[event] as Set<SplashListener<E>> | undefined
    if (!set) return
    for (const listener of Array.from(set)) {
      try {
        listener(payload)
      } catch (error) {
        console.error('[react-native-splash] listener threw', error)
      }
    }
  }

  /** @internal Test seam: forget cached native state. */
  resetForTesting(): void {
    this.phase = 'native'
    this.listeners = {}
    this.nativeListenerInstalled = false
    this.overlayAttached = false
    this.errorHandlerInstalled = false
    this.prevented = false
    this.manifestCache = null
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  private native() {
    const native = getNativeSplashScreen()
    if (native && !this.nativeListenerInstalled) {
      this.nativeListenerInstalled = true
      native.setEventListener((event) => this.onNativeEvent(event))
    }
    return native
  }

  private onNativeEvent(event: SplashNativeEvent): void {
    switch (event.type) {
      case 'hidden':
        this.markNativeHidden(event.timestampMs)
        return
      case 'shown':
        this.setPhase('native')
        return
      case 'timeout':
        this.emit('timeout', { source: 'native' })
        return
      case 'jsLoadFailed':
        this.emit('error', { reason: 'jsLoadFailed' })
        return
      case 'attached':
        return
    }
  }

  private markNativeHidden(timestampMs: number = Date.now()): void {
    this.emit('nativeHidden', { timestampMs })
    // Without an overlay there is nothing left to show: the app is visible.
    if (!this.overlayAttached && this.phase === 'native') {
      this.setPhase('hidden')
      this.emit('hidden', { timestampMs, durationMs: 0 })
    }
  }

  /**
   * A fatal JS error while the overlay is up would otherwise leave the user
   * staring at the splash forever. Report it so the overlay exits, and drop
   * the native overlay too in case JS is no longer able to.
   */
  private installErrorHandler(): void {
    if (this.errorHandlerInstalled) return
    this.errorHandlerInstalled = true
    const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
    if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) return
    const previous = errorUtils.getGlobalHandler()
    errorUtils.setGlobalHandler((error, isFatal) => {
      if (isFatal && this.phase !== 'hidden') {
        this.emit('error', { reason: 'uncaughtError' })
        void this.hide().catch(() => undefined)
      }
      previous?.(error, isFatal)
    })
  }
}

interface ErrorUtilsLike {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void
}

export const SplashScreen = new SplashScreenController()

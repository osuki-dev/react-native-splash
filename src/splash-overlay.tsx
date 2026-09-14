import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'

import { SplashOverlayContext } from './splash-context'
import type { SplashOverlayContextValue } from './splash-context'
import { SplashMirror } from './splash-mirror'
import { nextSplashPhase } from './splash-phase'
import { SplashScreen } from './splash-screen'
import type { SplashOverlayProps, SplashPhase, SplashRenderContext } from './types'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_EXIT_TIMEOUT_MS = 2_000

/**
 * Full-screen overlay that takes over from the native launch screen.
 *
 * Mount it once, above everything else in the root component. It keeps the
 * native overlay up until its own content has been painted, removes native
 * without a fade, waits for `ready` and `minimumDuration`, then hands the
 * exit to the render prop (or the default `<SplashMirror />`).
 */
export function SplashOverlay({
  ready = true,
  minimumDuration = 0,
  timeout = DEFAULT_TIMEOUT_MS,
  exitTimeout = DEFAULT_EXIT_TIMEOUT_MS,
  skipWithoutSystemSplash = false,
  onPhaseChange,
  onHidden,
  style,
  children,
}: SplashOverlayProps) {
  // Render-phase on purpose: the first render happens before Fabric mounts the
  // tree, which is before native sees "content appeared" and would auto-hide.
  SplashScreen.preventAutoHide()

  const launchInfo = useMemo(() => SplashScreen.getLaunchInfo(), [])
  const manifest = useMemo(() => SplashScreen.getManifest(), [])
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const skip = skipWithoutSystemSplash && launchInfo.nativeAvailable && !launchInfo.systemSplashShown

  const [phase, setPhaseState] = useState<SplashPhase>(() => (skip ? 'hidden' : 'native'))
  const [nativeHidden, setNativeHidden] = useState(!launchInfo.nativeAvailable)
  const [minimumElapsed, setMinimumElapsed] = useState(minimumDuration <= 0)
  const [timedOut, setTimedOut] = useState(false)
  const [failed, setFailed] = useState(false)
  const [finished, setFinished] = useState(false)

  const pendingAssets = useRef(0)
  const laidOut = useRef(false)
  const handoffStarted = useRef(false)
  const handoffAt = useRef<number | null>(null)
  const mountedAt = useRef(Date.now())

  // ---------------------------------------------------------------------------
  // Handoff: paint first, then drop native in the same frame.
  // ---------------------------------------------------------------------------

  const maybeHandoff = useCallback(() => {
    if (handoffStarted.current || !laidOut.current || pendingAssets.current > 0) return
    handoffStarted.current = true
    // Two frames: the first lets Fabric mount what React committed, the
    // second guarantees it has been displayed before native lets go.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void SplashScreen.hide({ fade: false })
          .catch(() => undefined)
          .finally(() => {
            handoffAt.current = Date.now()
            setNativeHidden(true)
          })
      })
    })
  }, [])

  const registerAsset = useCallback(() => {
    pendingAssets.current += 1
    let released = false
    return () => {
      if (released) return
      released = true
      pendingAssets.current -= 1
      maybeHandoff()
    }
  }, [maybeHandoff])

  const onLayout = useCallback(() => {
    laidOut.current = true
    maybeHandoff()
  }, [maybeHandoff])

  // If the native overlay was skipped (no native module), treat the mount as the handoff.
  useEffect(() => {
    if (!launchInfo.nativeAvailable && handoffAt.current === null) handoffAt.current = Date.now()
  }, [launchInfo.nativeAvailable])

  // ---------------------------------------------------------------------------
  // Timers and external signals
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!nativeHidden) return
    const since = handoffAt.current ?? mountedAt.current
    const timers: ReturnType<typeof setTimeout>[] = []
    if (minimumDuration > 0) {
      timers.push(setTimeout(() => setMinimumElapsed(true), Math.max(0, minimumDuration - (Date.now() - since))))
    }
    if (timeout > 0) {
      timers.push(
        setTimeout(
          () => {
            SplashScreen.emit('timeout', { source: 'js' })
            setTimedOut(true)
          },
          Math.max(0, timeout - (Date.now() - since)),
        ),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [nativeHidden, minimumDuration, timeout])

  useEffect(() => {
    const detach = SplashScreen.attachOverlay()
    const subscriptions = [
      SplashScreen.addListener('nativeHidden', () => setNativeHidden(true)),
      SplashScreen.addListener('timeout', ({ source }) => {
        if (source === 'native') setTimedOut(true)
      }),
      SplashScreen.addListener('error', () => setFailed(true)),
    ]
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
      detach()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const next = nextSplashPhase(phase, { nativeHidden, ready, minimumElapsed, timedOut, failed, finished })
    if (next !== phase) setPhaseState(next)
  }, [phase, nativeHidden, ready, minimumElapsed, timedOut, failed, finished])

  useEffect(() => {
    SplashScreen.setPhase(phase)
    onPhaseChange?.(phase)
    if (phase === 'exiting' && exitTimeout > 0) {
      const timer = setTimeout(() => setFinished(true), exitTimeout)
      return () => clearTimeout(timer)
    }
    if (phase === 'hidden') {
      const now = Date.now()
      SplashScreen.emit('hidden', { timestampMs: now, durationMs: now - mountedAt.current })
      onHidden?.()
    }
    return undefined
    // Callbacks are intentionally not dependencies: a re-render must not re-fire them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exitTimeout])

  const finish = useCallback(() => setFinished(true), [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderContext = useMemo<SplashRenderContext | null>(
    () => (phase === 'hidden' ? null : { phase, manifest, launchInfo, colorScheme, finish }),
    [phase, manifest, launchInfo, colorScheme, finish],
  )
  const contextValue = useMemo<SplashOverlayContextValue | null>(
    () => (renderContext ? { ...renderContext, registerAsset } : null),
    [renderContext, registerAsset],
  )

  if (renderContext === null || contextValue === null) return null

  return (
    <SplashOverlayContext.Provider value={contextValue}>
      <View
        style={[styles.overlay, style]}
        pointerEvents={phase === 'exiting' ? 'none' : 'auto'}
        onLayout={onLayout}
        collapsable={false}
        accessibilityViewIsModal
      >
        {children ? children(renderContext) : <SplashMirror />}
      </View>
    </SplashOverlayContext.Provider>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10_000,
    elevation: 10_000,
  },
})

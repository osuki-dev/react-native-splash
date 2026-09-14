import { beforeEach, describe, expect, mock, test } from 'bun:test'

// The controller only touches the native module through this seam, so the
// React Native and Nitro packages never need to load under bun.
mock.module('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => {
      throw new Error('not available in tests')
    },
  },
}))

const { SplashScreen } = await import('../splash-screen')
const { setNativeSplashScreenForTesting } = await import('../native')
type NativeSplashScreen = import('../specs/SplashScreen.nitro').SplashScreen
type SplashNativeEvent = import('../specs/SplashScreen.nitro').SplashNativeEvent

function fakeNative() {
  let listener: ((event: SplashNativeEvent) => void) | null = null
  let visible = true
  const calls: string[] = []
  const native = {
    manifest: {
      backgroundColor: '#F7F3EC',
      darkBackgroundColor: '#050B12',
      logo: { name: 'SplashScreenLogo', width: 128, height: 128 },
      logoSizeRatio: 1,
      statusBarHeight: 0,
      navigationBarHeight: 0,
      edgeToEdge: true,
      autoHide: true,
      hideTimeoutMs: 15000,
    },
    launchInfo: {
      coldStart: true,
      reload: false,
      systemSplashShown: true,
      processStartMs: 1,
      overlayAttachedMs: 2,
      colorScheme: 'light' as const,
    },
    isVisible: () => visible,
    preventAutoHide: () => {
      calls.push('preventAutoHide')
    },
    hide: async () => {
      calls.push('hide')
      visible = false
      listener?.({ type: 'hidden', timestampMs: 10 })
    },
    show: async () => {
      calls.push('show')
      visible = true
      listener?.({ type: 'shown', timestampMs: 20 })
    },
    setEventListener: (next: (event: SplashNativeEvent) => void) => {
      listener = next
    },
    clearEventListener: () => {
      listener = null
    },
  }
  return { native: native as unknown as NativeSplashScreen, calls, emit: (event: SplashNativeEvent) => listener?.(event) }
}

beforeEach(() => {
  SplashScreen.resetForTesting()
  setNativeSplashScreenForTesting(undefined)
})

describe('SplashScreen without a native module', () => {
  test('degrades to no-ops and a fallback manifest', async () => {
    setNativeSplashScreenForTesting(null)
    expect(SplashScreen.isVisible()).toBe(false)
    expect(SplashScreen.getManifest().backgroundColor).toBe('#ffffff')
    expect(SplashScreen.getLaunchInfo().nativeAvailable).toBe(false)
    const hidden: string[] = []
    SplashScreen.addListener('phase', ({ phase }) => hidden.push(phase))
    await SplashScreen.hide()
    expect(hidden).toEqual(['hidden'])
  })
})

describe('SplashScreen with a native module', () => {
  test('reads the manifest and launch info from native', () => {
    const { native } = fakeNative()
    setNativeSplashScreenForTesting(native)
    expect(SplashScreen.getManifest().logo?.name).toBe('SplashScreenLogo')
    expect(SplashScreen.getLaunchInfo()).toMatchObject({ coldStart: true, nativeAvailable: true })
  })

  test('preventAutoHide is forwarded once', () => {
    const { native, calls } = fakeNative()
    setNativeSplashScreenForTesting(native)
    SplashScreen.preventAutoHide()
    SplashScreen.preventAutoHide()
    expect(calls).toEqual(['preventAutoHide'])
  })

  test('hide without an overlay ends in hidden and fans out native events', async () => {
    const { native } = fakeNative()
    setNativeSplashScreenForTesting(native)
    const events: string[] = []
    SplashScreen.addListener('nativeHidden', () => events.push('nativeHidden'))
    SplashScreen.addListener('hidden', ({ durationMs }) => events.push(`hidden:${durationMs}`))
    SplashScreen.addListener('phase', ({ previous, phase }) => events.push(`${previous}>${phase}`))
    await SplashScreen.hide({ fade: true, duration: 120 })
    expect(events).toEqual(['nativeHidden', 'native>hidden', 'hidden:0'])
    expect(SplashScreen.getPhase()).toBe('hidden')
  })

  test('with an overlay attached the overlay owns the phase', async () => {
    const { native } = fakeNative()
    setNativeSplashScreenForTesting(native)
    const detach = SplashScreen.attachOverlay()
    const phases: string[] = []
    SplashScreen.addListener('phase', ({ phase }) => phases.push(phase))
    await SplashScreen.hide()
    expect(phases).toEqual([])
    expect(SplashScreen.getPhase()).toBe('native')
    detach()
  })

  test('native timeout and load failure surface as events', () => {
    const { native, emit } = fakeNative()
    setNativeSplashScreenForTesting(native)
    const seen: string[] = []
    SplashScreen.addListener('timeout', ({ source }) => seen.push(`timeout:${source}`))
    SplashScreen.addListener('error', ({ reason }) => seen.push(`error:${reason}`))
    emit({ type: 'timeout', timestampMs: 1 })
    emit({ type: 'jsLoadFailed', timestampMs: 2 })
    expect(seen).toEqual(['timeout:native', 'error:jsLoadFailed'])
  })

  test('removing a listener stops delivery', () => {
    const { native, emit } = fakeNative()
    setNativeSplashScreenForTesting(native)
    let count = 0
    const remove = SplashScreen.addListener('timeout', () => {
      count += 1
    })
    emit({ type: 'timeout', timestampMs: 1 })
    remove()
    emit({ type: 'timeout', timestampMs: 2 })
    expect(count).toBe(1)
  })
})

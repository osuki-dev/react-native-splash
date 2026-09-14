import { NitroModules } from 'react-native-nitro-modules'

import type { SplashScreen as NativeSplashScreen } from './specs/SplashScreen.nitro'

let cached: NativeSplashScreen | null | undefined

/**
 * The Nitro hybrid object, or null where native code is unavailable (Jest,
 * Expo Go, web, a build that forgot to run `pod install`). Every public API
 * degrades to a no-op in that case so the app still renders.
 */
export function getNativeSplashScreen(): NativeSplashScreen | null {
  if (cached !== undefined) return cached
  try {
    cached = NitroModules.createHybridObject<NativeSplashScreen>('SplashScreen')
  } catch (error) {
    cached = null
    if (__DEV__) {
      console.warn(
        '[react-native-splash] native module unavailable; splash APIs are no-ops. ' +
          'Rebuild the app after installing, and note that Expo Go is not supported.',
        error,
      )
    }
  }
  return cached
}

/** Test seam. */
export function setNativeSplashScreenForTesting(value: NativeSplashScreen | null | undefined): void {
  cached = value
}

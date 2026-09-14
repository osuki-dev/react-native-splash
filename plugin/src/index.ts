import { createRunOncePlugin } from 'expo/config-plugins'
import type { ConfigPlugin } from 'expo/config-plugins'

import { resolveSplashOptions } from './options'
import type { SplashOptions } from './options'
import { withAndroidSplash } from './with-android'
import { withIosSplash } from './with-ios'

const PACKAGE_NAME = '@osuki-dev/react-native-splash'

const withSplash: ConfigPlugin<SplashOptions | undefined> = (config, options) => {
  assertNoExpoSplashScreen(config.plugins)
  config = withIosSplash(config, resolveSplashOptions(options, 'ios'))
  config = withAndroidSplash(config, resolveSplashOptions(options, 'android'))
  return config
}

/**
 * Both libraries claim RN's `loadingView` slot and Android's first-draw
 * hold; running both leaves the app stuck or flashing. Fail early instead.
 */
function assertNoExpoSplashScreen(plugins: unknown): void {
  if (!Array.isArray(plugins)) return
  const found = plugins.some((entry) => {
    const name = Array.isArray(entry) ? entry[0] : entry
    return name === 'expo-splash-screen'
  })
  if (found) {
    throw new Error(
      `[react-native-splash] remove "expo-splash-screen" from app.json plugins (and uninstall it): ${PACKAGE_NAME} replaces it.`,
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../../package.json') as { version: string }

export default createRunOncePlugin(withSplash, PACKAGE_NAME, version)
export type { SplashOptions } from './options'

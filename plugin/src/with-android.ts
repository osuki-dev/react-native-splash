import {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidManifest,
  withAndroidStyles,
  withDangerousMod,
} from 'expo/config-plugins'
import type { ConfigPlugin } from 'expo/config-plugins'
import path from 'node:path'

import { BACKGROUND_COLOR, SPLASH_THEME, SPLASH_THEME_PARENT, generateAndroidDrawables, splashStyleItems } from './generate/android'
import type { ResolvedSplash } from './options'

export const withAndroidSplash: ConfigPlugin<ResolvedSplash> = (config, splash) => {
  const hasLogo = splash.image !== undefined

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resRoot = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res')
      await generateAndroidDrawables({ projectRoot: config.modRequest.projectRoot, resRoot, warn: console.warn }, splash)
      return config
    },
  ])

  config = withAndroidColors(config, (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name: BACKGROUND_COLOR,
      value: splash.backgroundColor,
    })
    return config
  })

  config = withAndroidColorsNight(config, (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name: BACKGROUND_COLOR,
      value: splash.darkBackgroundColor ?? splash.backgroundColor,
    })
    return config
  })

  config = withAndroidStyles(config, (config) => {
    const styles = config.modResults
    const others = (styles.resources.style ?? []).filter((style) => style.$.name !== SPLASH_THEME)
    styles.resources.style = [
      ...others,
      {
        $: { name: SPLASH_THEME, parent: SPLASH_THEME_PARENT },
        item: splashStyleItems(splash, hasLogo).map(({ name, value }) => ({ $: { name }, _: value })),
      },
    ]
    return config
  })

  config = withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults)
    activity.$['android:theme'] = `@style/${SPLASH_THEME}`
    return config
  })

  return config
}

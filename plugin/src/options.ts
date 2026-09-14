/**
 * Options accepted by the Expo config plugin and by `splash.config.js` for
 * the bare CLI. Deliberately the same shape as expo-splash-screen so an
 * existing `app.json` migrates by changing the plugin name.
 */
export interface SplashDarkOptions {
  backgroundColor?: string
  image?: string
}

export interface SplashPlatformOptions {
  backgroundColor?: string
  image?: string
  imageWidth?: number
  dark?: SplashDarkOptions
}

export interface SplashIosOptions extends SplashPlatformOptions {
  /** Separate logo for iPad; falls back to `image`. */
  tabletImage?: string
}

export interface SplashAndroidOptions extends SplashPlatformOptions {
  /** Theme the activity switches to after the splash. Default `AppTheme`. */
  postTheme?: string
}

export interface SplashOptions extends SplashPlatformOptions {
  /** Hide the native overlay when React content first appears. Default true. */
  autoHide?: boolean
  /** Native safety cap in ms; 0 disables. Default 15000. */
  hideTimeout?: number
  ios?: SplashIosOptions
  android?: SplashAndroidOptions
}

export interface ResolvedSplash {
  backgroundColor: string
  darkBackgroundColor?: string
  image?: string
  darkImage?: string
  tabletImage?: string
  imageWidth: number
  autoHide: boolean
  hideTimeoutMs: number
  postTheme: string
}

export const DEFAULT_BACKGROUND = '#ffffff'
export const DEFAULT_IMAGE_WIDTH = 100
export const DEFAULT_HIDE_TIMEOUT_MS = 15_000
export const DEFAULT_POST_THEME = 'AppTheme'

/** Android 12 keeps the icon inside a 192 dp circle on a 288 dp canvas. */
export const ANDROID_ICON_CANVAS_DP = 288
export const ANDROID_ICON_SAFE_DP = 192
export const ANDROID_ICON_WARN_DP = 134

export function resolveSplashOptions(options: SplashOptions | undefined, platform: 'ios' | 'android'): ResolvedSplash {
  const root = options ?? {}
  const platformOptions: SplashIosOptions & SplashAndroidOptions = (platform === 'ios' ? root.ios : root.android) ?? {}
  const dark = { ...root.dark, ...platformOptions.dark }

  const imageWidth = platformOptions.imageWidth ?? root.imageWidth ?? DEFAULT_IMAGE_WIDTH
  if (!Number.isFinite(imageWidth) || imageWidth <= 0) {
    throw new Error(`[react-native-splash] imageWidth must be a positive number, got ${String(imageWidth)}`)
  }
  if (platform === 'android' && imageWidth > ANDROID_ICON_SAFE_DP) {
    throw new Error(
      `[react-native-splash] imageWidth ${imageWidth} exceeds the ${ANDROID_ICON_SAFE_DP} dp Android 12 icon area; the OS would crop it. Use a smaller logo and put full-bleed art in the JS overlay.`,
    )
  }

  const backgroundColor = normalizeColor(platformOptions.backgroundColor ?? root.backgroundColor ?? DEFAULT_BACKGROUND)
  const darkBackgroundColor = dark.backgroundColor ? normalizeColor(dark.backgroundColor) : undefined

  return {
    backgroundColor,
    darkBackgroundColor,
    image: platformOptions.image ?? root.image,
    darkImage: dark.image,
    tabletImage: platform === 'ios' ? platformOptions.tabletImage : undefined,
    imageWidth,
    autoHide: root.autoHide ?? true,
    hideTimeoutMs: root.hideTimeout ?? DEFAULT_HIDE_TIMEOUT_MS,
    postTheme: (platform === 'android' && platformOptions.postTheme) || DEFAULT_POST_THEME,
  }
}

/** `#rgb`, `#rrggbb` or `#rrggbbaa` to upper-case `#RRGGBB`. Alpha is dropped: launch backgrounds must be opaque. */
export function normalizeColor(input: string): string {
  const text = input.trim().replace(/^#/, '')
  const expanded = text.length === 3 ? text.split('').map((c) => c + c).join('') : text
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(expanded)) {
    throw new Error(`[react-native-splash] backgroundColor must be a hex colour like #F7F3EC, got "${input}"`)
  }
  return `#${expanded.slice(0, 6).toUpperCase()}`
}

export function colorComponents(hex: string): { red: number; green: number; blue: number } {
  const value = normalizeColor(hex).slice(1)
  return {
    red: parseInt(value.slice(0, 2), 16) / 255,
    green: parseInt(value.slice(2, 4), 16) / 255,
    blue: parseInt(value.slice(4, 6), 16) / 255,
  }
}

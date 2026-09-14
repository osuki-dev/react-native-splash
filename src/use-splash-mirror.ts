import { useContext, useLayoutEffect, useMemo, useRef } from 'react'
import { Platform, useColorScheme, useWindowDimensions } from 'react-native'
import type { ImageResizeMode, ImageStyle, ImageURISource, ViewStyle } from 'react-native'

import { SplashOverlayContext } from './splash-context'
import { SplashScreen } from './splash-screen'
import type { SplashLaunchImage, SplashLogo, SplashManifest } from './types'

/**
 * The box a launch image is drawn in: `min(width * fraction, maxWidth)` wide,
 * `aspectRatio` tall. The native overlays apply the same rule
 * (`SplashLaunchImageView` on iOS, `SplashOverlayView` on Android), which is
 * what keeps the handoff pixel-identical.
 */
export function launchImageBox(image: SplashLaunchImage, windowWidth: number): { width: number; height: number } {
  const width = Math.min(windowWidth * image.widthFraction, image.maxWidth)
  const ratio = image.aspectRatio > 0 ? image.aspectRatio : 1
  return { width, height: width / ratio }
}

export interface SplashMirrorOptions {
  /**
   * Android, non edge-to-edge apps only: whether the status bar is
   * translucent. When it is not, the overlay is pulled up under it so the
   * mirror covers the same area the native splash did. Default false.
   */
  statusBarTranslucent?: boolean
  /** Same for the navigation bar. Default false. */
  navigationBarTranslucent?: boolean
}

export interface SplashMirror {
  /** Spread onto the full-screen container (`View`, `Animated.View`). */
  container: { style: ViewStyle }
  /**
   * Spread onto the logo (`Image`, `Animated.Image`, expo-image). `source` is
   * undefined when the manifest has no logo; check `hasLogo` first.
   */
  logo: {
    source: ImageURISource | undefined
    style: ImageStyle
    resizeMode: ImageResizeMode
    fadeDuration: number
    onLoadEnd: () => void
    onError: () => void
  }
  hasLogo: boolean
  backgroundColor: string
  manifest: SplashManifest
}

/**
 * Prop bags that reproduce the native launch screen pixel for pixel: same
 * background colour, same logo resource, same logical size, dark mode and
 * Android quirks (OneUI icon scale, system bar insets) applied. Inside
 * `<SplashOverlay>` it also delays the native handoff until the logo has
 * loaded, so the swap never shows an empty frame.
 */
export function useSplashMirror(options: SplashMirrorOptions = {}): SplashMirror {
  const context = useContext(SplashOverlayContext)
  const manifest = context?.manifest ?? SplashScreen.getManifest()
  const dark = useColorScheme() === 'dark'
  const { width: windowWidth } = useWindowDimensions()

  // With a launch image the picture *is* the mark and its paper is the
  // manifest's; the compiled logo is not on screen at all.
  const launchImage = manifest.launchImage
  const logo = useMemo(
    () => (launchImage ? launchImageLogo(launchImage, windowWidth) : pickLogo(manifest, dark)),
    [launchImage, windowWidth, manifest, dark],
  )
  const backgroundColor = dark ? (manifest.darkBackgroundColor ?? manifest.backgroundColor) : manifest.backgroundColor

  // Register the logo with the overlay exactly once per mount, and release it
  // when the image reports back (or the mirror unmounts before it does).
  const release = useRef<(() => void) | null>(null)
  const registerAsset = context?.registerAsset
  useLayoutEffect(() => {
    if (!registerAsset || !logo) return
    release.current = registerAsset()
    return () => {
      release.current?.()
      release.current = null
    }
  }, [registerAsset, logo])

  return useMemo<SplashMirror>(() => {
    const ratio = launchImage ? 1 : manifest.logoSizeRatio
    const size = logo ? { width: logo.width * ratio, height: logo.height * ratio } : null
    const insets = androidInsets(manifest, options)
    const done = () => {
      release.current?.()
      release.current = null
    }
    return {
      container: {
        style: {
          position: 'absolute',
          top: -insets.top,
          bottom: -insets.bottom,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
        },
      },
      logo: {
        source: logo && size ? { uri: logo.name, ...size } : undefined,
        style: size ?? { width: 0, height: 0 },
        resizeMode: 'contain',
        fadeDuration: 0,
        onLoadEnd: done,
        onError: done,
      },
      hasLogo: logo !== undefined,
      backgroundColor,
      manifest,
    }
  }, [logo, launchImage, manifest, backgroundColor, options.statusBarTranslucent, options.navigationBarTranslucent])
}

function launchImageLogo(image: SplashLaunchImage, windowWidth: number): SplashLogo {
  const box = launchImageBox(image, windowWidth)
  return { name: image.uri, width: box.width, height: box.height }
}

function pickLogo(manifest: SplashManifest, dark: boolean): SplashLogo | undefined {
  if (dark && manifest.darkLogo) return manifest.darkLogo
  return manifest.logo
}

function androidInsets(manifest: SplashManifest, options: SplashMirrorOptions): { top: number; bottom: number } {
  if (Platform.OS !== 'android' || manifest.edgeToEdge) return { top: 0, bottom: 0 }
  return {
    top: options.statusBarTranslucent ? 0 : manifest.statusBarHeight,
    bottom: options.navigationBarTranslucent ? 0 : manifest.navigationBarHeight,
  }
}
